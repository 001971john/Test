import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ScannedDocument } from '../types';

const DOCUMENTS_KEY = '@docscanner/documents';

const getDocumentsDir = () => {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/DocScanner`;
};

const ensureDir = async () => {
  const dir = getDocumentsDir();
  const exists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  return dir;
};

const getAllDocuments = async (): Promise<ScannedDocument[]> => {
  const json = await AsyncStorage.getItem(DOCUMENTS_KEY);
  return json ? JSON.parse(json) : [];
};

const saveAllDocuments = async (docs: ScannedDocument[]): Promise<void> => {
  await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
};

const saveDocument = async (doc: ScannedDocument): Promise<void> => {
  const docs = await getAllDocuments();
  const index = docs.findIndex(d => d.id === doc.id);
  if (index >= 0) {
    docs[index] = doc;
  } else {
    docs.unshift(doc);
  }
  await saveAllDocuments(docs);
};

const deleteDocument = async (id: string): Promise<void> => {
  const docs = await getAllDocuments();
  const doc = docs.find(d => d.id === id);
  if (doc) {
    for (const page of doc.pages) {
      try {
        await ReactNativeBlobUtil.fs.unlink(page.originalImageUri);
        if (page.processedImageUri !== page.originalImageUri) {
          await ReactNativeBlobUtil.fs.unlink(page.processedImageUri);
        }
      } catch {}
    }
  }
  await saveAllDocuments(docs.filter(d => d.id !== id));
};

const saveImage = async (sourceUri: string, filename: string): Promise<string> => {
  const dir = await ensureDir();
  const destPath = `${dir}/${filename}`;
  // The document scanner returns file:// URIs; blob-util needs raw paths.
  const sourcePath = sourceUri.replace(/^file:\/\//, '');
  await ReactNativeBlobUtil.fs.cp(sourcePath, destPath);
  return destPath;
};

const getImageBase64 = async (uri: string): Promise<string> => {
  return await ReactNativeBlobUtil.fs.readFile(uri, 'base64');
};

export const StorageService = {
  getAllDocuments,
  saveDocument,
  deleteDocument,
  saveImage,
  getImageBase64,
  getDocumentsDir,
  ensureDir,
};
