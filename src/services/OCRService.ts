import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ScannedDocument } from '../types';
import { IDParser } from '../utils/IDParser';
import { StorageService } from './StorageService';

const recognizeText = async (imageUri: string): Promise<string> => {
  const result = await TextRecognition.recognize(imageUri);
  return result.text;
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

  if (document.type !== 'general') {
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
};
