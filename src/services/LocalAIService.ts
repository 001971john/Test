import { initLlama, LlamaContext } from 'llama.rn';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ExtractedIDData, DocumentType } from '../types';

const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf';
const MODEL_FILENAME = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';
const MODEL_SIZE_BYTES = 1_120_000_000; // ~1.1 GB, for progress estimation

export class LocalAIError extends Error {
  code: 'MODEL_NOT_DOWNLOADED' | 'MODEL_LOAD_FAILED' | 'DOWNLOAD_FAILED' | 'EXTRACTION_FAILED';
  constructor(code: LocalAIError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const getModelDir = () => `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/models`;
const getModelPath = () => `${getModelDir()}/${MODEL_FILENAME}`;

const isModelDownloaded = async (): Promise<boolean> => {
  const path = getModelPath();
  const exists = await ReactNativeBlobUtil.fs.exists(path);
  if (!exists) return false;
  // Guard against partial downloads left behind by a crash.
  const stat = await ReactNativeBlobUtil.fs.stat(path);
  return Number(stat.size) > MODEL_SIZE_BYTES * 0.95;
};

const getTempDownloadPath = () =>
  `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/DocScanner-model.gguf.part`;

/**
 * Downloads the model via Android's system Download Manager so the
 * transfer survives screen-off, app switching, and process death.
 * The OS shows a progress notification; we also poll the growing file
 * to drive the in-app percentage.
 */
const downloadModel = async (
  onProgress: (percent: number) => void,
): Promise<void> => {
  const dir = getModelDir();
  const dirExists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!dirExists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  const tempPath = getTempDownloadPath();

  // If a previous attempt already downloaded the file fully (e.g. only
  // the finalize step failed), reuse it instead of downloading 1.1 GB again.
  let haveCompleteTemp = false;
  try {
    if (await ReactNativeBlobUtil.fs.exists(tempPath)) {
      const existing = await ReactNativeBlobUtil.fs.stat(tempPath);
      if (Number(existing.size) >= MODEL_SIZE_BYTES * 0.95) {
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
          Math.min(98, Math.round((Number(stat.size) / MODEL_SIZE_BYTES) * 100)),
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
          title: 'DocScanner AI model',
          description: 'Downloading the offline AI model (~1.1 GB)…',
          mime: 'application/octet-stream',
          mediaScannable: false,
          path: tempPath,
        },
      }).fetch('GET', MODEL_URL);
    }

    const stat = await ReactNativeBlobUtil.fs.stat(tempPath);
    if (Number(stat.size) < MODEL_SIZE_BYTES * 0.95) {
      throw new Error('Downloaded file is incomplete');
    }
    downloadSucceeded = true;

    // Bring the finished file into app-internal storage. `mv` fails
    // across storage boundaries on many devices ("mv failed for unknown
    // reasons"), so copy and delete instead.
    onProgress(99);
    const finalPath = getModelPath();
    try {
      await ReactNativeBlobUtil.fs.unlink(finalPath);
    } catch {}
    try {
      await ReactNativeBlobUtil.fs.mv(tempPath, finalPath);
    } catch {
      await ReactNativeBlobUtil.fs.cp(tempPath, finalPath);
    }

    const ok = await isModelDownloaded();
    if (!ok) {
      throw new Error('Model file failed verification after download');
    }
    try {
      await ReactNativeBlobUtil.fs.unlink(tempPath);
    } catch {}
    onProgress(100);
  } catch (e: any) {
    // Keep a fully-downloaded temp file so the next attempt can skip
    // the 1.1 GB download and only redo the finalize step.
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

const deleteModel = async (): Promise<void> => {
  try {
    await ReactNativeBlobUtil.fs.unlink(getModelPath());
  } catch {}
};

let activeContext: LlamaContext | null = null;

const getContext = async (): Promise<LlamaContext> => {
  if (activeContext) return activeContext;
  if (!(await isModelDownloaded())) {
    throw new LocalAIError('MODEL_NOT_DOWNLOADED', 'The AI model has not been downloaded yet.');
  }
  try {
    activeContext = await initLlama({
      model: getModelPath(),
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
  downloadModel,
  deleteModel,
  extractIDData,
  suggestTitle,
  classifyDocument,
  chat,
  releaseContext,
  MODEL_SIZE_GB: 1.1,
};
