import { ExtractedIDData } from '../types';

const MRZ_LINE_PATTERN = /^[A-Z0-9<]{30,44}$/;

const findMRZLines = (text: string): string[] | null => {
  const lines = text.split('\n').map(l => l.trim().replace(/\s/g, ''));
  const mrzLines: string[] = [];

  for (const line of lines) {
    if (MRZ_LINE_PATTERN.test(line)) {
      mrzLines.push(line);
    } else if (mrzLines.length > 0) {
      break;
    }
  }

  if (mrzLines.length >= 2) {
    return mrzLines;
  }
  return null;
};

const cleanMRZField = (field: string): string => {
  return field.replace(/</g, ' ').trim().replace(/\s+/g, ' ');
};

const parseMRZDate = (dateStr: string): string | undefined => {
  if (dateStr.length !== 6) return undefined;
  const yy = parseInt(dateStr.substring(0, 2), 10);
  const mm = dateStr.substring(2, 4);
  const dd = dateStr.substring(4, 6);
  const year = yy > 50 ? 1900 + yy : 2000 + yy;
  return `${mm}/${dd}/${year}`;
};

const parseTwoLineMRZ = (lines: string[]): ExtractedIDData | null => {
  if (lines.length < 2) return null;

  const line1 = lines[0];
  const line2 = lines[1];

  if (line1.length < 30 || line2.length < 28) return null;

  try {
    const namesSection = line1.substring(5);
    const namesParts = namesSection.split('<<');
    const lastName = cleanMRZField(namesParts[0] || '');
    const firstName = cleanMRZField(namesParts[1] || '');

    const documentNumber = cleanMRZField(line2.substring(0, 9));
    const nationality = cleanMRZField(line2.substring(10, 13));
    const dateOfBirth = parseMRZDate(line2.substring(13, 19));
    const gender = cleanMRZField(line2.substring(20, 21));
    const expirationDate = parseMRZDate(line2.substring(21, 27));

    return {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      documentNumber: documentNumber || undefined,
      nationality: nationality || undefined,
      dateOfBirth,
      gender: gender || undefined,
      expirationDate,
      rawMRZ: lines.join('\n'),
      confidence: 0.9,
    };
  } catch {
    return null;
  }
};

const parseThreeLineMRZ = (lines: string[]): ExtractedIDData | null => {
  if (lines.length < 3) return null;

  const line1 = lines[0];
  const line2 = lines[1];
  const line3 = lines[2];

  try {
    const documentNumber = cleanMRZField(line1.substring(5, 14));
    const nationality = cleanMRZField(line2.substring(15, 18));
    const dateOfBirth = parseMRZDate(line2.substring(0, 6));
    const gender = cleanMRZField(line2.substring(7, 8));
    const expirationDate = parseMRZDate(line2.substring(8, 14));

    const namesSection = line3;
    const namesParts = namesSection.split('<<');
    const lastName = cleanMRZField(namesParts[0] || '');
    const firstName = cleanMRZField(namesParts[1] || '');

    return {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      documentNumber: documentNumber || undefined,
      nationality: nationality || undefined,
      dateOfBirth,
      gender: gender || undefined,
      expirationDate,
      rawMRZ: lines.join('\n'),
      confidence: 0.85,
    };
  } catch {
    return null;
  }
};

const extractMRZ = (text: string): ExtractedIDData | null => {
  const mrzLines = findMRZLines(text);
  if (!mrzLines) return null;

  if (mrzLines.length === 2) {
    return parseTwoLineMRZ(mrzLines);
  }
  if (mrzLines.length >= 3) {
    return parseThreeLineMRZ(mrzLines);
  }
  return null;
};

export const MRZParser = {
  extractMRZ,
  findMRZLines,
};
