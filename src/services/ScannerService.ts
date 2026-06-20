import { v4 as uuidv4 } from 'uuid';
import { ScannedDocument, ScannedPage } from '../types';
import { StorageService } from './StorageService';

const createNewDocument = (type: 'general' | 'id_card' | 'passport' | 'drivers_license' = 'general'): ScannedDocument => {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: `Scan ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    pages: [],
    type,
  };
};

const addPageToDocument = async (
  document: ScannedDocument,
  imageUri: string,
): Promise<{ document: ScannedDocument; page: ScannedPage }> => {
  const pageId = uuidv4();
  const filename = `${document.id}_${pageId}.jpg`;
  const savedUri = await StorageService.saveImage(imageUri, filename);

  const page: ScannedPage = {
    id: pageId,
    originalImageUri: savedUri,
    processedImageUri: savedUri,
    ocrText: '',
    filter: 'color',
    order: document.pages.length,
  };

  const updatedDoc: ScannedDocument = {
    ...document,
    pages: [...document.pages, page],
    updatedAt: new Date().toISOString(),
  };

  await StorageService.saveDocument(updatedDoc);
  return { document: updatedDoc, page };
};

export const ScannerService = {
  createNewDocument,
  addPageToDocument,
};
