import { generatePDF } from 'react-native-html-to-pdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun } from 'docx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { Buffer } from 'buffer';
import { ScannedDocument, ExtractedIDData, ID_TYPES } from '../types';
import { StorageService } from './StorageService';

// Shared field order/labels for the ID information form in every export.
export const ID_FIELD_DEFS: { label: string; key: keyof ExtractedIDData }[] = [
  { label: 'Full Name', key: 'fullName' },
  { label: 'First Name', key: 'firstName' },
  { label: 'Last Name / Surname', key: 'lastName' },
  { label: 'Date of Birth', key: 'dateOfBirth' },
  { label: 'Place of Birth', key: 'placeOfBirth' },
  { label: 'Document / License No.', key: 'documentNumber' },
  { label: 'Date of Issue', key: 'issueDate' },
  { label: 'Expiration Date', key: 'expirationDate' },
  { label: 'Issuing Authority', key: 'issuingAuthority' },
  { label: 'Nationality', key: 'nationality' },
  { label: 'Gender', key: 'gender' },
  { label: 'Address', key: 'address' },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  general: 'GENERAL DOCUMENT',
  id_card: 'IDENTITY CARD',
  passport: 'PASSPORT',
  drivers_license: "DRIVER'S LICENSE",
  receipt: 'RECEIPT',
  medical: 'MEDICAL DOCUMENT',
  invoice: 'INVOICE',
  letter: 'LETTER',
  contract: 'CONTRACT',
};

export interface PDFOptions {
  /** Lay the first two pages (front/back of an ID) on one A4 sheet. */
  idCardSheet?: boolean;
  /** Append extracted data, OCR text and translation pages. Off by default
   *  so the PDF is a faithful copy of the scanned document. */
  includeExtras?: boolean;
}

/**
 * Faithful export: only the scanned page images, edge-to-edge, one per
 * sheet — the PDF looks exactly like the original document.
 */
const generateFaithfulPDFHTML = async (
  doc: ScannedDocument,
  options?: PDFOptions,
): Promise<string> => {
  let body = '';
  if (options?.idCardSheet && doc.pages.length >= 2) {
    const front = await StorageService.getImageBase64(doc.pages[0].processedImageUri);
    const back = await StorageService.getImageBase64(doc.pages[1].processedImageUri);
    body = `
      <div class="sheet" style="padding-top:24px;">
        <img class="card" src="data:image/jpeg;base64,${front}" />
        <img class="card" src="data:image/jpeg;base64,${back}" />
      </div>`;
  } else {
    for (const page of doc.pages) {
      const base64 = await StorageService.getImageBase64(page.processedImageUri);
      body += `<div class="sheet"><img src="data:image/jpeg;base64,${base64}" /></div>`;
    }
  }
  return `
    <html>
    <head>
      <style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; }
        .sheet { page-break-after: always; text-align: center; }
        .sheet img { width: 100%; display: block; }
        .sheet img.card { width: 82%; margin: 18px auto; border-radius: 6px; }
      </style>
    </head>
    <body>${body}</body>
    </html>
  `;
};

const generatePDFHTML = async (doc: ScannedDocument, options?: PDFOptions): Promise<string> => {
  // Default: faithful, image-only copy of the scan.
  if (!options?.includeExtras) {
    return generateFaithfulPDFHTML(doc, options);
  }

  const typeLabel = DOC_TYPE_LABELS[doc.type] ?? doc.type.toUpperCase();
  let html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        .doc-header { background: #4F46E5; color: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 20px; }
        .doc-header h1 { margin: 0 0 4px 0; font-size: 24px; }
        .doc-header .meta { font-size: 12px; opacity: 0.85; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.5); border-radius: 12px; padding: 2px 12px; font-size: 12px; letter-spacing: 1px; margin-bottom: 8px; }
        .form-card { border: 2px solid #4F46E5; border-radius: 10px; overflow: hidden; margin-bottom: 24px; }
        .form-title { background: #EEF2FF; color: #3730A3; font-weight: bold; padding: 10px 16px; font-size: 14px; letter-spacing: 1px; border-bottom: 2px solid #4F46E5; }
        table.form { width: 100%; border-collapse: collapse; }
        table.form td { border: 1px solid #C7D2FE; padding: 0; width: 50%; vertical-align: top; }
        .cell { padding: 10px 14px; }
        .flabel { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
        .fvalue { font-size: 16px; font-weight: bold; color: #111827; min-height: 18px; }
        .confidence { font-size: 11px; color: #6B7280; padding: 8px 16px; background: #F9FAFB; border-top: 1px solid #C7D2FE; }
        .page { margin-bottom: 30px; page-break-after: always; }
        .page h2 { color: #3730A3; font-size: 16px; }
        .page img { max-width: 100%; border: 1px solid #ddd; border-radius: 6px; }
        .ocr-text { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <div class="badge">${typeLabel}</div>
        <h1>${doc.title}</h1>
        <div class="meta">Scanned on ${new Date(doc.createdAt).toLocaleString()} · DocScanner</div>
      </div>
  `;

  if (doc.extractedData && ID_TYPES.includes(doc.type)) {
    const data = doc.extractedData;
    const present = ID_FIELD_DEFS.filter(f => data[f.key]);
    if (present.length > 0) {
      html += `<div class="form-card"><div class="form-title">${typeLabel} — EXTRACTED INFORMATION</div><table class="form">`;
      for (let i = 0; i < present.length; i += 2) {
        const left = present[i];
        const right = present[i + 1];
        html += '<tr>';
        html += `<td><div class="cell"><div class="flabel">${left.label}</div><div class="fvalue">${data[left.key]}</div></div></td>`;
        html += right
          ? `<td><div class="cell"><div class="flabel">${right.label}</div><div class="fvalue">${data[right.key]}</div></div></td>`
          : '<td></td>';
        html += '</tr>';
      }
      html += `</table><div class="confidence">Automatic extraction confidence: ${Math.round(
        data.confidence * 100,
      )}% — please verify all fields against the original document.</div></div>`;
    }
  }

  if (options?.idCardSheet && doc.pages.length >= 2) {
    // Premium "photocopy" layout: front and back of the card on one sheet.
    const front = await StorageService.getImageBase64(doc.pages[0].processedImageUri);
    const back = await StorageService.getImageBase64(doc.pages[1].processedImageUri);
    html += `
      <div style="text-align:center;">
        <div style="display:inline-block; border:1px solid #C7D2FE; border-radius:12px; padding:14px; margin:12px 0;">
          <div style="font-size:10px; color:#6B7280; letter-spacing:1px; margin-bottom:6px;">FRONT / ΕΜΠΡΟΣ</div>
          <img src="data:image/jpeg;base64,${front}" style="width:340px; border-radius:6px;" />
        </div>
        <br/>
        <div style="display:inline-block; border:1px solid #C7D2FE; border-radius:12px; padding:14px; margin:6px 0;">
          <div style="font-size:10px; color:#6B7280; letter-spacing:1px; margin-bottom:6px;">BACK / ΠΙΣΩ</div>
          <img src="data:image/jpeg;base64,${back}" style="width:340px; border-radius:6px;" />
        </div>
      </div>
    `;
  } else {
    for (let i = 0; i < doc.pages.length; i++) {
      const page = doc.pages[i];
      const base64 = await StorageService.getImageBase64(page.processedImageUri);
      html += `
        <div class="page">
          <h2>Page ${i + 1}</h2>
          <img src="data:image/jpeg;base64,${base64}" />
          ${page.ocrText ? `<div class="ocr-text"><h3>Extracted Text</h3><p>${page.ocrText}</p></div>` : ''}
        </div>
      `;
    }
  }

  if (doc.translation) {
    const langLabel = doc.translation.to === 'greek' ? 'ΕΛΛΗΝΙΚΑ' : 'ENGLISH';
    html += `
      <div style="page-break-before: always;">
        <h2 style="color:#3730A3;">Translation (${langLabel})</h2>
        <div class="ocr-text">${doc.translation.text.replace(/\n/g, '<br/>')}</div>
      </div>
    `;
  }

  html += '</body></html>';
  return html;
};

export interface ExportResult {
  filePath: string;
  savedToDownloads: boolean;
  downloadsPath: string;
}

const MIME_PDF = 'application/pdf';
const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Copies an exported file into the phone's public Downloads/DocScanner
 * folder so the user can find it in their Files app. Never throws —
 * on older Android versions the copy may fail, but the private export
 * still succeeds.
 */
const saveToDownloads = async (
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<boolean> => {
  try {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
      { name: filename, parentFolder: 'DocScanner', mimeType },
      'Download',
      filePath,
    );
    return true;
  } catch {
    return false;
  }
};

const exportToPDF = async (doc: ScannedDocument, options?: PDFOptions): Promise<ExportResult> => {
  const html = await generatePDFHTML(doc, options);
  const baseName = doc.title.replace(/[^a-zA-Z0-9]/g, '_');
  const file = await generatePDF({
    html,
    fileName: baseName,
    directory: 'Documents',
  });
  const filename = `${baseName}.pdf`;
  const savedToDownloads = await saveToDownloads(file.filePath, filename, MIME_PDF);
  return {
    filePath: file.filePath,
    savedToDownloads,
    downloadsPath: `Downloads/DocScanner/${filename}`,
  };
};

const exportToDOCX = async (
  doc: ScannedDocument,
  options?: { includeExtras?: boolean },
): Promise<ExportResult> => {
  const includeExtras = !!options?.includeExtras;
  const children: any[] = includeExtras
    ? [
        new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun({ text: `Scanned on: ${new Date(doc.createdAt).toLocaleString()}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Document type: ${doc.type.replace(/_/g, ' ').toUpperCase()}` }),
          ],
        }),
        new Paragraph({ text: '' }),
      ]
    : [];

  if (includeExtras && doc.extractedData && ID_TYPES.includes(doc.type)) {
    const typeLabel = DOC_TYPE_LABELS[doc.type] ?? doc.type.toUpperCase();
    children.push(
      new Paragraph({
        text: `${typeLabel} — Extracted Information`,
        heading: HeadingLevel.HEADING_2,
      }),
    );

    const data = doc.extractedData;
    const rows = ID_FIELD_DEFS.filter(f => data[f.key]).map(
      f =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: f.label.toUpperCase(), bold: true, size: 18, color: '3730A3' })],
                }),
              ],
              width: { size: 38, type: WidthType.PERCENTAGE },
              shading: { fill: 'EEF2FF' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(data[f.key]), bold: true, size: 24 })],
                }),
              ],
              width: { size: 62, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
    );

    if (rows.length > 0) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'EXTRACTION CONFIDENCE', bold: true, size: 18, color: '3730A3' })],
                }),
              ],
              shading: { fill: 'EEF2FF' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${Math.round(data.confidence * 100)}% — verify against the original document`,
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    }

    if (rows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        }),
        new Paragraph({ text: '' }),
      );
    }
  }

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    if (includeExtras) {
      children.push(
        new Paragraph({ text: '' }),
        new Paragraph({ text: `Page ${i + 1}`, heading: HeadingLevel.HEADING_2 }),
      );
    }

    try {
      const base64 = await StorageService.getImageBase64(page.processedImageUri);
      const imageBuffer = Buffer.from(base64, 'base64');
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              // Near-full A4 width for a faithful copy of the scan.
              transformation: { width: 600, height: 780 },
              type: 'jpg',
            }),
          ],
        }),
      );
    } catch {}

    if (includeExtras && page.ocrText) {
      children.push(
        new Paragraph({ text: 'Extracted Text:', heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: page.ocrText }),
      );
    }
  }

  if (includeExtras && doc.translation) {
    const langLabel = doc.translation.to === 'greek' ? 'Ελληνικά' : 'English';
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: `Translation (${langLabel})`, heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: doc.translation.text }),
    );
  }

  const docx = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(docx);
  const dir = await StorageService.ensureDir();
  const filename = `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  const filePath = `${dir}/${filename}`;
  await ReactNativeBlobUtil.fs.writeFile(filePath, Buffer.from(buffer).toString('base64'), 'base64');
  const savedToDownloads = await saveToDownloads(filePath, filename, MIME_DOCX);
  return {
    filePath,
    savedToDownloads,
    downloadsPath: `Downloads/DocScanner/${filename}`,
  };
};

const shareFile = async (filePath: string, type: 'pdf' | 'docx'): Promise<void> => {
  const mimeType = type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await Share.open({
    url: `file://${filePath}`,
    type: mimeType,
  });
};

export const ExportService = {
  exportToPDF,
  exportToDOCX,
  shareFile,
};
