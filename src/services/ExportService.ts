import { generatePDF } from 'react-native-html-to-pdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun } from 'docx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { Buffer } from 'buffer';
import { ScannedDocument } from '../types';
import { StorageService } from './StorageService';

const generatePDFHTML = async (doc: ScannedDocument): Promise<string> => {
  let html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
        .page { margin-bottom: 30px; page-break-after: always; }
        .page img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
        .ocr-text { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #007AFF; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>${doc.title}</h1>
      <p>Scanned on: ${new Date(doc.createdAt).toLocaleString()}</p>
      <p>Document type: ${doc.type.replace(/_/g, ' ').toUpperCase()}</p>
  `;

  if (doc.extractedData) {
    html += '<h2>Extracted Information</h2><table>';
    const data = doc.extractedData;
    const fields: [string, string | undefined][] = [
      ['Full Name', data.fullName],
      ['First Name', data.firstName],
      ['Last Name', data.lastName],
      ['Date of Birth', data.dateOfBirth],
      ['Document Number', data.documentNumber],
      ['Expiration Date', data.expirationDate],
      ['Address', data.address],
      ['Nationality', data.nationality],
      ['Gender', data.gender],
    ];
    for (const [label, value] of fields) {
      if (value) {
        html += `<tr><th>${label}</th><td>${value}</td></tr>`;
      }
    }
    html += `<tr><th>Confidence</th><td>${Math.round(data.confidence * 100)}%</td></tr>`;
    html += '</table>';
  }

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

  html += '</body></html>';
  return html;
};

const exportToPDF = async (doc: ScannedDocument): Promise<string> => {
  const html = await generatePDFHTML(doc);
  const options = {
    html,
    fileName: doc.title.replace(/[^a-zA-Z0-9]/g, '_'),
    directory: 'Documents',
  };
  const file = await generatePDF(options);
  return file.filePath;
};

const exportToDOCX = async (doc: ScannedDocument): Promise<string> => {
  const sections: any[] = [];
  const children: any[] = [
    new Paragraph({
      text: doc.title,
      heading: HeadingLevel.HEADING_1,
    }),
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
  ];

  if (doc.extractedData) {
    children.push(
      new Paragraph({
        text: 'Extracted Information',
        heading: HeadingLevel.HEADING_2,
      }),
    );

    const data = doc.extractedData;
    const fields: [string, string | undefined][] = [
      ['Full Name', data.fullName],
      ['First Name', data.firstName],
      ['Last Name', data.lastName],
      ['Date of Birth', data.dateOfBirth],
      ['Document Number', data.documentNumber],
      ['Expiration Date', data.expirationDate],
      ['Address', data.address],
      ['Nationality', data.nationality],
      ['Gender', data.gender],
    ];

    const rows = fields
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph(value!)],
                width: { size: 70, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
      );

    if (rows.length > 0) {
      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Field', bold: true })] })],
                  width: { size: 30, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true })] })],
                  width: { size: 70, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...rows,
          ],
        }),
      );
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Confidence: ${Math.round(data.confidence * 100)}%`, italics: true }),
        ],
      }),
    );
  }

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        text: `Page ${i + 1}`,
        heading: HeadingLevel.HEADING_2,
      }),
    );

    try {
      const base64 = await StorageService.getImageBase64(page.processedImageUri);
      const imageBuffer = Buffer.from(base64, 'base64');
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width: 500, height: 650 },
              type: 'jpg',
            }),
          ],
        }),
      );
    } catch {}

    if (page.ocrText) {
      children.push(
        new Paragraph({
          text: 'Extracted Text:',
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({ text: page.ocrText }),
      );
    }
  }

  const docx = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(docx);
  const dir = await StorageService.ensureDir();
  const filePath = `${dir}/${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  await ReactNativeBlobUtil.fs.writeFile(filePath, Buffer.from(buffer).toString('base64'), 'base64');
  return filePath;
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
