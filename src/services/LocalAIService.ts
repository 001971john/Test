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

const downloadModel = async (
  onProgress: (percent: number) => void,
): Promise<void> => {
  const dir = getModelDir();
  const dirExists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!dirExists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  const path = getModelPath();
  try {
    await ReactNativeBlobUtil.config({ path, overwrite: true })
      .fetch('GET', MODEL_URL)
      .progress({ interval: 1000 }, (received, total) => {
        const totalBytes = Number(total) > 0 ? Number(total) : MODEL_SIZE_BYTES;
        onProgress(Math.min(99, Math.round((Number(received) / totalBytes) * 100)));
      });
    const ok = await isModelDownloaded();
    if (!ok) {
      throw new Error('Downloaded file is incomplete');
    }
    onProgress(100);
  } catch (e: any) {
    try {
      await ReactNativeBlobUtil.fs.unlink(path);
    } catch {}
    throw new LocalAIError('DOWNLOAD_FAILED', e?.message ?? 'Download failed');
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

const DOC_TYPE_HINTS: Record<DocumentType, string> = {
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
            `You extract structured data from OCR text of ${DOC_TYPE_HINTS[docType]}. ` +
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
  chat,
  releaseContext,
  MODEL_SIZE_GB: 1.1,
};
