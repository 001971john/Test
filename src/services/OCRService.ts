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
  if (value === 'latin' || value === 'greek') return value;
  return 'auto';
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

const recognizeWithTesseract = async (imageUri: string): Promise<string> => {
  const path = imageUri.replace(/^file:\/\//, '');
  // Greek only — running ell+eng together confuses lookalike letters
  // across the two alphabets and produces mixed-script garbage.
  return await NativeModules.TesseractOcr.recognize(path, 'ell');
};

// Full Greek and Coptic (U+0370–U+03FF) + Greek Extended (U+1F00–U+1FFF).
/** Fraction of alphabetic characters that are Greek. */
const greekRatio = (text: string): number => {
  const greek = (text.match(/[Ͱ-Ͽἀ-῿]/g) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  const total = greek + latin;
  return total === 0 ? 0 : greek / total;
};

// Accent-stripped common words used to tell which engine read real text.
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const GREEK_WORDS = [
  'και', 'να', 'το', 'της', 'του', 'με', 'σε', 'για', 'απο', 'στο', 'στη',
  'ειναι', 'συνολο', 'αποδειξη', 'τιμολογιο', 'αφμ', 'ευρω', 'φπα',
  'ημερομηνια', 'αριθμος', 'ονομα', 'διευθυνση', 'ελλας', 'ελληνικη',
  'νοσοκομειο', 'ασθενης', 'ποσο', 'πληρωμη', 'στοιχεια', 'κωδικος',
].map(normalize);

const ENGLISH_WORDS = [
  'the', 'and', 'of', 'to', 'in', 'is', 'for', 'total', 'date', 'amount',
  'number', 'invoice', 'receipt', 'name', 'address', 'account', 'payment',
  'customer', 'quantity', 'price', 'balance', 'you', 'your', 'this', 'from',
  'with', 'card', 'cash', 'tax', 'phone',
];

const countWordHits = (text: string, words: string[]): number => {
  const tokens = normalize(text).split(/[^a-zͰ-Ͽἀ-῿]+/);
  const set = new Set(tokens.filter(Boolean));
  return words.reduce((sum, w) => sum + (set.has(w) ? 1 : 0), 0);
};

const recognizeText = async (imageUri: string): Promise<string> => {
  const lang = await getOcrLanguage();

  if (lang === 'latin') {
    return await recognizeWithMLKit(imageUri);
  }

  if (lang === 'greek') {
    try {
      return await recognizeWithTesseract(imageUri);
    } catch {
      return await recognizeWithMLKit(imageUri);
    }
  }

  // Auto: run both engines and keep whichever produced real words —
  // the Greek (Tesseract) engine can only emit Greek glyphs, so a
  // ratio check alone can't tell real Greek from wrong-script garbage.
  let greekText = '';
  let latinText = '';
  try {
    [greekText, latinText] = await Promise.all([
      recognizeWithTesseract(imageUri),
      recognizeWithMLKit(imageUri),
    ]);
  } catch {
    // Tesseract failed — fall back to whatever ML Kit gives.
    return latinText || (await recognizeWithMLKit(imageUri));
  }

  const gHits = countWordHits(greekText, GREEK_WORDS);
  const lHits = countWordHits(latinText, ENGLISH_WORDS);

  if (gHits > lHits) return greekText;
  if (lHits > gHits) return latinText;
  // Tie (short doc / no common words): trust the Greek result only if it
  // is genuinely Greek-heavy, otherwise the Latin engine's reading.
  return greekRatio(greekText) >= 0.3 ? greekText : latinText;
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
