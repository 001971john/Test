import { DocumentType, ExtractedIDData } from '../types';
import { MRZParser } from './MRZParser';

const parseField = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
};

const parseName = (text: string): { fullName?: string; firstName?: string; lastName?: string } => {
  const namePatterns = [
    /(?:name|full\s*name|nom)\s*[:\-]?\s*([A-Za-z\s\-']+)/i,
    /(?:fn|first\s*name|given\s*name|prénom)\s*[:\-]?\s*([A-Za-z\s\-']+)/i,
    /(?:ln|last\s*name|surname|family\s*name|nom)\s*[:\-]?\s*([A-Za-z\s\-']+)/i,
  ];

  const fullName = parseField(text, [namePatterns[0]]);
  const firstName = parseField(text, [namePatterns[1]]);
  const lastName = parseField(text, [namePatterns[2]]);

  return { fullName, firstName, lastName };
};

const parseDateOfBirth = (text: string): string | undefined => {
  return parseField(text, [
    /(?:dob|date\s*of\s*birth|born|birth\s*date|née?|d\.o\.b)\s*[:\-]?\s*(\d{1,2}[\\/\-\.]\d{1,2}[\\/\-\.]\d{2,4})/i,
    /(?:dob|date\s*of\s*birth|born|birth\s*date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  ]);
};

const parseDocumentNumber = (text: string): string | undefined => {
  return parseField(text, [
    /(?:dl|license\s*(?:no|number|#)|licence|id\s*(?:no|number|#)|document\s*(?:no|number|#)|card\s*(?:no|number|#)|no\.?)\s*[:\-]?\s*([A-Z0-9\-]{4,20})/i,
    /(?:passport\s*(?:no|number|#))\s*[:\-]?\s*([A-Z0-9]{6,12})/i,
  ]);
};

const parseExpiration = (text: string): string | undefined => {
  return parseField(text, [
    /(?:exp|expiry|expiration|expires|valid\s*(?:until|thru|through)|exp\s*date)\s*[:\-]?\s*(\d{1,2}[\\/\-\.]\d{1,2}[\\/\-\.]\d{2,4})/i,
    /(?:exp|expiry|expiration)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  ]);
};

const parseAddress = (text: string): string | undefined => {
  return parseField(text, [
    /(?:address|addr|residence|domicile)\s*[:\-]?\s*(.+(?:\n.+)?)/i,
  ]);
};

const parseGender = (text: string): string | undefined => {
  return parseField(text, [
    /(?:sex|gender)\s*[:\-]?\s*(M|F|Male|Female|X)/i,
  ]);
};

const parseNationality = (text: string): string | undefined => {
  return parseField(text, [
    /(?:nationality|nation|citizenship|country)\s*[:\-]?\s*([A-Za-z\s]+)/i,
  ]);
};

const calculateConfidence = (data: ExtractedIDData): number => {
  const fields = [
    data.fullName || data.firstName || data.lastName,
    data.dateOfBirth,
    data.documentNumber,
    data.expirationDate,
    data.address,
    data.gender,
    data.nationality,
  ];
  const found = fields.filter(Boolean).length;
  return found / fields.length;
};

const parseIDDocument = (text: string, type: DocumentType): ExtractedIDData => {
  const mrzData = MRZParser.extractMRZ(text);
  if (mrzData) {
    return mrzData;
  }

  const names = parseName(text);
  const data: ExtractedIDData = {
    ...names,
    dateOfBirth: parseDateOfBirth(text),
    documentNumber: parseDocumentNumber(text),
    expirationDate: parseExpiration(text),
    address: parseAddress(text),
    gender: parseGender(text),
    nationality: parseNationality(text),
    confidence: 0,
  };

  data.confidence = calculateConfidence(data);
  return data;
};

export const IDParser = {
  parseIDDocument,
};
