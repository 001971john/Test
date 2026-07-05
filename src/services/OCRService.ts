import { NativeModules } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedDocument, ID_TYPES } from '../types';
import { IDParser } from '../utils/IDParser';
import { StorageService } from './StorageService';

const OCR_LANG_KEY = '@docscanner/ocr_lang';

export type OcrLanguage = 'greek' | 'latin';

const getOcrLanguage = async (): Promise<OcrLanguage> => {
  const value = await AsyncStorage.getItem(OCR_LANG_KEY);
  return value === 'latin' ? 'latin' : 'greek';
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
  return await NativeModules.TesseractOcr.recognize(path, 'ell+eng');
};

const recognizeText = async (imageUri: string): Promise<string> => {
  const lang = await getOcrLanguage();
  if (lang === 'greek') {
    try {
      return await recognizeWithTesseract(imageUri);
    } catch {
      // Fall back to ML Kit if the Tesseract engine fails for any reason.
      return await recognizeWithMLKit(imageUri);
    }
  }
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
