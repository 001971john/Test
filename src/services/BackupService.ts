import ReactNativeBlobUtil from 'react-native-blob-util';
import { zip, unzip } from 'react-native-zip-archive';
import { ScannedDocument } from '../types';
import { StorageService } from './StorageService';

const MANIFEST_FILENAME = 'manifest.json';
const BACKUPS_SUBDIR = 'DocScanner/Backups';

const getBackupsDir = () => `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/${BACKUPS_SUBDIR}`;

const ensureBackupsDir = async (): Promise<string> => {
  const dir = getBackupsDir();
  const exists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  return dir;
};

export interface BackupFile {
  path: string;
  filename: string;
  size: number;
  date: Date;
}

/** Lists backup zip files this app has created, newest first. */
const listBackups = async (): Promise<BackupFile[]> => {
  const dir = await ensureBackupsDir();
  const names = await ReactNativeBlobUtil.fs.ls(dir);
  const files: BackupFile[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.zip')) continue;
    const path = `${dir}/${name}`;
    try {
      const stat = await ReactNativeBlobUtil.fs.stat(path);
      files.push({ path, filename: name, size: Number(stat.size), date: new Date(Number(stat.lastModified)) });
    } catch {}
  }
  return files.sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * Zips all scanned-document images plus a manifest of document metadata
 * into a single file in Downloads/DocScanner/Backups. Fully local —
 * nothing is uploaded anywhere.
 */
const createBackup = async (): Promise<BackupFile> => {
  const documentsDir = await StorageService.ensureDir();
  const documents = await StorageService.getAllDocuments();

  const manifestPath = `${documentsDir}/${MANIFEST_FILENAME}`;
  await ReactNativeBlobUtil.fs.writeFile(manifestPath, JSON.stringify(documents), 'utf8');

  const backupsDir = await ensureBackupsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = `${backupsDir}/docscanner-backup-${stamp}.zip`;

  try {
    await zip(documentsDir, zipPath);
  } finally {
    try {
      await ReactNativeBlobUtil.fs.unlink(manifestPath);
    } catch {}
  }

  const stat = await ReactNativeBlobUtil.fs.stat(zipPath);
  return {
    path: zipPath,
    filename: zipPath.split('/').pop() || 'backup.zip',
    size: Number(stat.size),
    date: new Date(),
  };
};

/**
 * Restores documents from a backup zip: unzips into a temp folder, merges
 * any documents not already present (matched by id), and copies their
 * images into the app's documents directory.
 */
const restoreBackup = async (zipPath: string): Promise<number> => {
  const tempDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/docscanner-restore-${Date.now()}`;
  await unzip(zipPath, tempDir);

  const manifestPath = `${tempDir}/${MANIFEST_FILENAME}`;
  const manifestExists = await ReactNativeBlobUtil.fs.exists(manifestPath);
  if (!manifestExists) {
    throw new Error('This file is not a valid DocScanner backup (manifest missing).');
  }
  const manifestRaw = await ReactNativeBlobUtil.fs.readFile(manifestPath, 'utf8');
  const backedUpDocs: ScannedDocument[] = JSON.parse(manifestRaw);

  const existingDocs = await StorageService.getAllDocuments();
  const existingIds = new Set(existingDocs.map(d => d.id));
  const documentsDir = await StorageService.ensureDir();

  const basename = (path: string) => path.split('/').pop() || path;

  const restoredDocs: ScannedDocument[] = [];
  for (const backedUpDoc of backedUpDocs) {
    if (existingIds.has(backedUpDoc.id)) continue;

    const restoredPages = [];
    for (const page of backedUpDoc.pages) {
      const originalName = basename(page.originalImageUri);
      const processedName = basename(page.processedImageUri);
      const restoredOriginal = `${documentsDir}/${originalName}`;
      const restoredProcessed = `${documentsDir}/${processedName}`;
      try {
        await ReactNativeBlobUtil.fs.cp(`${tempDir}/${originalName}`, restoredOriginal);
        if (processedName !== originalName) {
          await ReactNativeBlobUtil.fs.cp(`${tempDir}/${processedName}`, restoredProcessed);
        }
      } catch {}
      restoredPages.push({
        ...page,
        originalImageUri: restoredOriginal,
        processedImageUri: processedName !== originalName ? restoredProcessed : restoredOriginal,
      });
    }
    restoredDocs.push({ ...backedUpDoc, pages: restoredPages });
  }

  if (restoredDocs.length > 0) {
    const merged = [...restoredDocs, ...existingDocs];
    await StorageService.saveAllDocuments(merged);
  }

  try {
    await ReactNativeBlobUtil.fs.unlink(tempDir);
  } catch {}

  return restoredDocs.length;
};

export const BackupService = {
  createBackup,
  restoreBackup,
  listBackups,
};
