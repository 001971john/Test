import { NativeModules } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedDocument, ID_TYPES } from '../types';
import { IDParser } from '../utils/IDParser';
import { StorageService } from './StorageService';

const OCR_LANG_KEY = '@docscanner/ocr_lang';

export type OcrLanguage = 'auto' | 'greek' | 'latin';

const getOcrLanguage = async (): Promise<OcrLanguage> => {
  const value = await AsyncStorage.getItem(OCR_LANG_KEY);
  if (value === 'latin' || value === 'auto') return value;
  // Default to the Greek engine directly. The user scans Greek documents,
  // and auto-detection kept routing to the Latin engine, producing
  // "Greeklish". Greek is the safe, correct default.
  return 'greek';
};

const setOcrLanguage = async (lang: OcrLanguage): Promise<void> => {
  await AsyncStorage.setItem(OCR_LANG_KEY, lang);
};

const recognizeWithMLKit = async (imageUri: string): Promise<string> => {
  // ML Kit expects a URI; stored images are raw file paths.
  const uri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
  const result = await TextRecognition.recognize(uri);
  return result.text;
};

const recognizeWithTesseract = async (
  imageUri: string,
  languages: string,
): Promise<string> => {
  const path = imageUri.replace(/^file:\/\//, '');
  return await NativeModules.TesseractOcr.recognize(path, languages);
};

/**
 * Reads Greek with the Tesseract engine and NEVER silently substitutes
 * the Latin engine (which would turn Greek into "Greeklish"). Tries the
 * Greek-only model first, then the Greek+English model (the config that
 * was readable at v1.0.11) as a fallback. Throws a clear error if both
 * fail, so a genuine engine failure surfaces instead of being masked.
 */
const recognizeGreek = async (imageUri: string): Promise<string> => {
  let firstError = '';
  try {
    const text = await recognizeWithTesseract(imageUri, 'ell');
    if (text && text.trim().length > 0) return text;
  } catch (e: any) {
    firstError = e?.message ?? String(e);
  }
  try {
    const text = await recognizeWithTesseract(imageUri, 'ell+eng');
    if (text && text.trim().length > 0) return text;
    return text; // may be empty, but it's genuine Greek-engine output
  } catch (e: any) {
    throw new Error(`Greek OCR failed: ${firstError || e?.message || 'unknown error'}`);
  }
};

// Full Greek and Coptic (U+0370–U+03FF) + Greek Extended (U+1F00–U+1FFF).
/** Fraction of alphabetic characters that are Greek. */
const greekRatio = (text: string): number => {
  const greek = (text.match(/[Ͱ-Ͽἀ-῿]/g) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  const total = greek + latin;
  return total === 0 ? 0 : greek / total;
};

const countGreekLetters = (text: string): number =>
  (text.match(/[Ͱ-Ͽἀ-῿]/g) || []).length;

const recognizeText = async (imageUri: string): Promise<string> => {
  const lang = await getOcrLanguage();

  if (lang === 'latin') {
    return await recognizeWithMLKit(imageUri);
  }

  if (lang === 'greek') {
    // Greek engine only — never silently downgrade to Latin (Greeklish).
    return await recognizeGreek(imageUri);
  }

  // Auto: prefer the Greek engine, and only use the Latin engine when the
  // Greek result is essentially not Greek (a true Latin / other-language
  // page). This is the mirror of the old logic, which wrongly defaulted
  // to Latin and produced Greeklish on Greek pages.
  let greekText = '';
  try {
    greekText = await recognizeGreek(imageUri);
  } catch {
    return await recognizeWithMLKit(imageUri);
  }

  const greekLetters = countGreekLetters(greekText);
  if (greekLetters >= 8 || greekRatio(greekText) >= 0.3) {
    return greekText;
  }
  // Greek engine found little/no Greek → the page is Latin or another
  // script; the Latin engine will read it better.
  return await recognizeWithMLKit(imageUri);
};

const processPage = async (
  document: ScannedDocument,
  pageId: string,
): Promise<ScannedDocument> => {
  const pageIndex = document.pages.findIndex(p => p.id === pageId);
  if (pageIndex < 0) throw new Error('Page not found');

  const page = document.pages[pageIndex];
  const text = await recognizeText(page.processedImageUri);

  const updatedPages = [...document.pages];
  updatedPages[pageIndex] = { ...page, ocrText: text };

  const updatedDoc: ScannedDocument = {
    ...document,
    pages: updatedPages,
    updatedAt: new Date().toISOString(),
  };

  if (ID_TYPES.includes(document.type)) {
    const allText = updatedDoc.pages.map(p => p.ocrText).join('\n');
    updatedDoc.extractedData = IDParser.parseIDDocument(allText, document.type);
  }

  await StorageService.saveDocument(updatedDoc);
  return updatedDoc;
};

const processAllPages = async (document: ScannedDocument): Promise<ScannedDocument> => {
  let doc = document;
  for (const page of doc.pages) {
    doc = await processPage(doc, page.id);
  }
  return doc;
};

export const OCRService = {
  recognizeText,
  processPage,
  processAllPages,
  getOcrLanguage,
  setOcrLanguage,
};
