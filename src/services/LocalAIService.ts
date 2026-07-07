import { initLlama, LlamaContext } from 'llama.rn';
import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtractedIDData, DocumentType } from '../types';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../utils/Languages';

export type AIModelId = 'standard' | 'accurate';

export interface AIModelInfo {
  id: AIModelId;
  label: string;
  url: string;
  filename: string;
  sizeBytes: number;
  sizeLabel: string;
  note: string;
}

export const AI_MODELS: AIModelInfo[] = [
  {
    id: 'standard',
    label: 'Standard',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1_120_000_000,
    sizeLabel: '1.1 GB',
    note: 'Fast, works on most phones',
  },
  {
    id: 'accurate',
    label: 'High accuracy',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    sizeBytes: 1_930_000_000,
    sizeLabel: '1.9 GB',
    note: 'More accurate; needs ~4 GB+ RAM',
  },
];

const MODEL_PREF_KEY = '@docscanner/ai_model';

const getModelById = (id: AIModelId): AIModelInfo =>
  AI_MODELS.find(m => m.id === id) ?? AI_MODELS[0];

const getPreferredModelId = async (): Promise<AIModelId> => {
  const value = await AsyncStorage.getItem(MODEL_PREF_KEY);
  return value === 'accurate' ? 'accurate' : 'standard';
};

const setPreferredModelId = async (id: AIModelId): Promise<void> => {
  await AsyncStorage.setItem(MODEL_PREF_KEY, id);
  // Force a reload of the context so the newly chosen model is used next call.
  await releaseContext();
};

export class LocalAIError extends Error {
  code: 'MODEL_NOT_DOWNLOADED' | 'MODEL_LOAD_FAILED' | 'DOWNLOAD_FAILED' | 'EXTRACTION_FAILED';
  constructor(code: LocalAIError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const getModelDir = () => `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/models`;
const getModelPath = (model: AIModelInfo) => `${getModelDir()}/${model.filename}`;

const isModelIdDownloaded = async (id: AIModelId): Promise<boolean> => {
  const model = getModelById(id);
  const path = getModelPath(model);
  const exists = await ReactNativeBlobUtil.fs.exists(path);
  if (!exists) return false;
  // Guard against partial downloads left behind by a crash.
  const stat = await ReactNativeBlobUtil.fs.stat(path);
  return Number(stat.size) > model.sizeBytes * 0.9;
};

/** Backward-compatible: true if ANY AI model is downloaded. */
const isModelDownloaded = async (): Promise<boolean> => {
  for (const model of AI_MODELS) {
    if (await isModelIdDownloaded(model.id)) return true;
  }
  return false;
};

export interface ModelStatus {
  id: AIModelId;
  downloaded: boolean;
}

const getModelStatuses = async (): Promise<{ statuses: ModelStatus[]; activeId: AIModelId }> => {
  const statuses: ModelStatus[] = [];
  for (const model of AI_MODELS) {
    statuses.push({ id: model.id, downloaded: await isModelIdDownloaded(model.id) });
  }
  const activeId = await getPreferredModelId();
  return { statuses, activeId };
};

const getTempDownloadPath = (id: AIModelId) =>
  `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/DocScanner-model-${id}.gguf.part`;

/**
 * Downloads a model via Android's system Download Manager so the
 * transfer survives screen-off, app switching, and process death.
 * The OS shows a progress notification; we also poll the growing file
 * to drive the in-app percentage.
 */
const downloadModel = async (
  id: AIModelId,
  onProgress: (percent: number) => void,
): Promise<void> => {
  const model = getModelById(id);
  const dir = getModelDir();
  const dirExists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!dirExists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  const tempPath = getTempDownloadPath(id);

  // If a previous attempt already downloaded the file fully (e.g. only
  // the finalize step failed), reuse it instead of downloading again.
  let haveCompleteTemp = false;
  try {
    if (await ReactNativeBlobUtil.fs.exists(tempPath)) {
      const existing = await ReactNativeBlobUtil.fs.stat(tempPath);
      if (Number(existing.size) >= model.sizeBytes * 0.9) {
        haveCompleteTemp = true;
      } else {
        await ReactNativeBlobUtil.fs.unlink(tempPath);
      }
    }
  } catch {}

  // Poll the partial file's size — DownloadManager doesn't emit
  // blob-util progress events.
  const poller = setInterval(async () => {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(tempPath);
      if (exists) {
        const stat = await ReactNativeBlobUtil.fs.stat(tempPath);
        onProgress(
          Math.min(98, Math.round((Number(stat.size) / model.sizeBytes) * 100)),
        );
      }
    } catch {}
  }, 2000);

  let downloadSucceeded = false;
  try {
    if (!haveCompleteTemp) {
      await ReactNativeBlobUtil.config({
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: `DocScanner AI model (${model.label})`,
          description: `Downloading the offline AI model (~${model.sizeLabel})…`,
          mime: 'application/octet-stream',
          mediaScannable: false,
          path: tempPath,
        },
      }).fetch('GET', model.url);
    }

    const stat = await ReactNativeBlobUtil.fs.stat(tempPath);
    if (Number(stat.size) < model.sizeBytes * 0.9) {
      throw new Error('Downloaded file is incomplete');
    }
    downloadSucceeded = true;

    // Bring the finished file into app-internal storage. `mv` fails
    // across storage boundaries on many devices ("mv failed for unknown
    // reasons"), so copy and delete instead.
    onProgress(99);
    const finalPath = getModelPath(model);
    try {
      await ReactNativeBlobUtil.fs.unlink(finalPath);
    } catch {}
    try {
      await ReactNativeBlobUtil.fs.mv(tempPath, finalPath);
    } catch {
      await ReactNativeBlobUtil.fs.cp(tempPath, finalPath);
    }

    const ok = await isModelIdDownloaded(id);
    if (!ok) {
      throw new Error('Model file failed verification after download');
    }
    try {
      await ReactNativeBlobUtil.fs.unlink(tempPath);
    } catch {}
    onProgress(100);
  } catch (e: any) {
    // Keep a fully-downloaded temp file so the next attempt can skip
    // the download and only redo the finalize step.
    if (!downloadSucceeded) {
      try {
        await ReactNativeBlobUtil.fs.unlink(tempPath);
      } catch {}
    }
    throw new LocalAIError('DOWNLOAD_FAILED', e?.message ?? 'Download failed');
  } finally {
    clearInterval(poller);
  }
};

const deleteModel = async (id: AIModelId): Promise<void> => {
  try {
    await ReactNativeBlobUtil.fs.unlink(getModelPath(getModelById(id)));
  } catch {}
  await releaseContext();
};

let activeContext: LlamaContext | null = null;

/** Resolves which downloaded model to load: the preferred one, else any. */
const resolveActiveModel = async (): Promise<AIModelInfo | null> => {
  const preferred = await getPreferredModelId();
  if (await isModelIdDownloaded(preferred)) return getModelById(preferred);
  for (const model of AI_MODELS) {
    if (await isModelIdDownloaded(model.id)) return model;
  }
  return null;
};

const getContext = async (): Promise<LlamaContext> => {
  if (activeContext) return activeContext;
  const model = await resolveActiveModel();
  if (!model) {
    throw new LocalAIError('MODEL_NOT_DOWNLOADED', 'The AI model has not been downloaded yet.');
  }
  try {
    activeContext = await initLlama({
      model: getModelPath(model),
      // 2048 is the memory-safe window proven across every prior release.
      // Larger windows caused native out-of-memory crashes during long,
      // multi-chunk translations. Chunking keeps documents complete
      // without needing a bigger context.
      n_ctx: 2048,
      use_mlock: false,
    });
    return activeContext;
  } catch (e: any) {
    activeContext = null;
    throw new LocalAIError(
      'MODEL_LOAD_FAILED',
      e?.message ?? 'Could not load the AI model. Your phone may not have enough free memory.',
    );
  }
};

const releaseContext = async (): Promise<void> => {
  if (activeContext) {
    try {
      await activeContext.release();
    } catch {}
    activeContext = null;
  }
};

const DOC_TYPE_HINTS: Partial<Record<DocumentType, string>> = {
  general: 'a general document',
  id_card: 'a national identity card (may be Greek: Δελτίο Ταυτότητας)',
  passport: 'a passport (may be Greek: Διαβατήριο)',
  drivers_license: "a driver's license (may be Greek: Άδεια Οδήγησης)",
};

const EXTRACT_KEYS: (keyof ExtractedIDData)[] = [
  'fullName',
  'firstName',
  'lastName',
  'dateOfBirth',
  'placeOfBirth',
  'documentNumber',
  'issueDate',
  'expirationDate',
  'issuingAuthority',
  'nationality',
  'gender',
  'address',
];

const parseJSONLoose = (text: string): Record<string, unknown> => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('No JSON object in model output');
  }
  return JSON.parse(text.slice(start, end + 1));
};

/**
 * Extracts structured ID fields from OCR text using the on-device model.
 * Runs entirely locally — no data leaves the phone.
 */
const extractIDData = async (
  ocrText: string,
  docType: DocumentType,
): Promise<Partial<ExtractedIDData>> => {
  const context = await getContext();
  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            `You extract structured data from OCR text of ${DOC_TYPE_HINTS[docType] ?? 'a document'}. ` +
            'The text may be in Greek, English, or both, and may contain OCR errors. ' +
            'Respond with ONLY a JSON object using these keys (omit keys you cannot find): ' +
            EXTRACT_KEYS.join(', ') +
            '. Values must be copied from the text (fix obvious OCR errors). Dates as found. No explanations.',
        },
        {
          role: 'user',
          content: `OCR text:\n${ocrText.slice(0, 4000)}`,
        },
      ],
      n_predict: 512,
      temperature: 0,
    });

    const raw = parseJSONLoose(result.text);
    const extracted: Partial<ExtractedIDData> = {};
    for (const key of EXTRACT_KEYS) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'null') {
        (extracted as Record<string, string>)[key] = value.trim();
      }
    }
    return extracted;
  } catch (e: any) {
    if (e instanceof LocalAIError) throw e;
    throw new LocalAIError('EXTRACTION_FAILED', e?.message ?? 'The AI could not read this document.');
  } finally {
    // Free the ~1.5 GB of RAM as soon as we're done.
    await releaseContext();
  }
};

const CLASSIFY_CATEGORIES: DocumentType[] = [
  'general',
  'receipt',
  'medical',
  'invoice',
  'letter',
  'contract',
];

export interface ClassificationResult {
  category: DocumentType;
  title: string;
}

/**
 * Classifies a scanned document by its OCR text and suggests a title.
 * Fully on-device.
 */
const classifyDocument = async (ocrText: string): Promise<ClassificationResult> => {
  const context = await getContext();
  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'Classify the OCR text of a scanned document (Greek or English). ' +
            `Respond with ONLY JSON: {"category": "<one of: ${CLASSIFY_CATEGORIES.join(
              ', ',
            )}>", "title": "<short descriptive title, max 6 words, in the document's language>"}. ` +
            'receipt = shop/purchase receipt; invoice = τιμολόγιο/bill; medical = hospital, doctor, prescription or exam papers; ' +
            'letter = correspondence; contract = agreements/terms; general = anything else.',
        },
        { role: 'user', content: ocrText.slice(0, 3000) },
      ],
      n_predict: 96,
      temperature: 0,
    });
    const raw = parseJSONLoose(result.text);
    const category = CLASSIFY_CATEGORIES.includes(raw.category as DocumentType)
      ? (raw.category as DocumentType)
      : 'general';
    const title =
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 80)
        : '';
    return { category, title };
  } finally {
    await releaseContext();
  }
};

export interface AssistantAction {
  type: 'export_pdf' | 'export_docx' | 'delete_document' | 'open_document';
  documentTitle: string;
}

export interface AssistantReply {
  reply: string;
  action: AssistantAction | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * On-device assistant: answers questions about the user's scanned documents
 * and can request app actions (export, delete, open). Fully offline.
 */
const chat = async (
  history: ChatTurn[],
  documentsContext: string,
): Promise<AssistantReply> => {
  const context = await getContext();
  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'You are the DocScanner assistant, running entirely on the user\'s phone. ' +
            'You help with their scanned documents. The user may write in Greek or English — reply in the same language. ' +
            'Here are the user\'s documents:\n' +
            documentsContext +
            '\n\nALWAYS respond with ONLY a JSON object: ' +
            '{"reply": "<your answer>", "action": null} for questions, or ' +
            '{"reply": "<confirmation>", "action": {"type": "<export_pdf|export_docx|delete_document|open_document>", "documentTitle": "<exact title>"}} ' +
            'when the user asks you to export, delete, or open a document. Use the exact document title from the list. ' +
            'Keep replies short and friendly. No text outside the JSON.',
        },
        ...history.slice(-6).map(t => ({ role: t.role, content: t.content })),
      ],
      n_predict: 384,
      temperature: 0,
    });

    try {
      const raw = parseJSONLoose(result.text);
      const reply = typeof raw.reply === 'string' && raw.reply.trim() ? raw.reply.trim() : result.text.trim();
      const rawAction = raw.action as Record<string, unknown> | null | undefined;
      let action: AssistantAction | null = null;
      if (
        rawAction &&
        typeof rawAction.type === 'string' &&
        ['export_pdf', 'export_docx', 'delete_document', 'open_document'].includes(rawAction.type) &&
        typeof rawAction.documentTitle === 'string'
      ) {
        action = {
          type: rawAction.type as AssistantAction['type'],
          documentTitle: rawAction.documentTitle,
        };
      }
      return { reply, action };
    } catch {
      // Model didn't produce JSON — treat the whole output as the reply.
      return { reply: result.text.trim(), action: null };
    }
  } finally {
    await releaseContext();
  }
};

// Packs OCR text into chunks that fit comfortably in the model's context,
// splitting only on line boundaries so no line is ever cut in half.
// Kept small (Greek is ~1 token/char) so each chunk's input + translation
// stays well within the 2048 window — no context overflow, bounded memory.
const chunkText = (text: string, maxChars = 600): string[] => {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    // A single very long line still goes out whole.
    if (line.length >= maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(line);
      continue;
    }
    if (current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
};

/**
 * Translates document text into any of the supported languages, fully
 * on-device. Long documents are translated in complete chunks so no
 * line is ever dropped. The original document is never modified.
 */
const translate = async (
  text: string,
  target: SupportedLanguage,
  onProgress?: (done: number, total: number) => void,
): Promise<string> => {
  const context = await getContext();
  try {
    const targetName = LANGUAGE_LABELS[target];
    const chunks = chunkText(text.trim());
    const systemPrompt =
      `You are a professional translator. Translate the text into ${targetName}. ` +
      'Translate faithfully and literally; do not paraphrase. ' +
      'Rules: translate EVERY line completely; never omit, summarize, merge, or add lines; ' +
      'keep the same line breaks and the same number of lines; keep all numbers, names, dates, ' +
      'and codes exactly; fix only obvious OCR typos. Output ONLY the translation, nothing else.';

    const translatedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, chunks.length);
      const chunk = chunks[i];
      // Cap output so chunk-input + output stay within the 2048 window
      // (prevents context overflow and keeps peak memory bounded).
      const nPredict = Math.min(900, Math.max(256, chunk.length + 128));
      const result = await context.completion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: chunk },
        ],
        n_predict: nPredict,
        temperature: 0,
      });
      translatedChunks.push(result.text.trim());
    }
    onProgress?.(chunks.length, chunks.length);

    const out = translatedChunks.join('\n').trim();
    if (!out) {
      throw new Error('Empty translation');
    }
    return out;
  } catch (e: any) {
    if (e instanceof LocalAIError) throw e;
    throw new LocalAIError('EXTRACTION_FAILED', e?.message ?? 'Translation failed.');
  } finally {
    await releaseContext();
  }
};

export interface DetectedLanguage {
  language: SupportedLanguage | 'other';
  label: string;
}

/**
 * Identifies the primary language of a document's OCR text. Fully
 * on-device — purely informational, used to show a "Detected: X"
 * chip and to suggest a sensible translation target.
 */
const detectLanguage = async (ocrText: string): Promise<DetectedLanguage> => {
  const context = await getContext();
  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'Identify the primary language of the given text (it may contain OCR errors). ' +
            `Respond with ONLY JSON: {"language": "<one of ${SUPPORTED_LANGUAGES.join(
              ', ',
            )}, other>", "label": "<the language's name in English>"}. ` +
            'Use "other" only if the text is not Greek, English, German, Italian, or French — ' +
            'in that case still give the real language name as the label (e.g. "Russian").',
        },
        { role: 'user', content: ocrText.slice(0, 1500) },
      ],
      n_predict: 48,
      temperature: 0,
    });
    const raw = parseJSONLoose(result.text);
    const language: SupportedLanguage | 'other' = SUPPORTED_LANGUAGES.includes(
      raw.language as SupportedLanguage,
    )
      ? (raw.language as SupportedLanguage)
      : 'other';
    const label =
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : language !== 'other'
        ? LANGUAGE_LABELS[language]
        : 'Unknown';
    return { language, label };
  } finally {
    await releaseContext();
  }
};

/** Suggests a short document title from OCR text. Fully on-device. */
const suggestTitle = async (ocrText: string): Promise<string> => {
  const context = await getContext();
  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'Suggest a short descriptive filename-style title (max 6 words, no quotes, same language as the text) for a scanned document based on its OCR text. Respond with the title only.',
        },
        { role: 'user', content: ocrText.slice(0, 2000) },
      ],
      n_predict: 32,
      temperature: 0,
    });
    return result.text.trim().replace(/^["']|["']$/g, '').slice(0, 80);
  } finally {
    await releaseContext();
  }
};

export const LocalAIService = {
  isModelDownloaded,
  isModelIdDownloaded,
  getModelStatuses,
  getPreferredModelId,
  setPreferredModelId,
  downloadModel,
  deleteModel,
  extractIDData,
  suggestTitle,
  classifyDocument,
  translate,
  detectLanguage,
  chat,
  releaseContext,
  models: AI_MODELS,
};
