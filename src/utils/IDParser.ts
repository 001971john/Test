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

// Matches Latin and Greek letters in field values.
const NAME_CHARS = "[A-Za-z\\u0370-\\u03FF\\u1F00-\\u1FFF\\s\\-']";

const parseName = (text: string): { fullName?: string; firstName?: string; lastName?: string } => {
  const fullName = parseField(text, [
    new RegExp(`(?:full\\s*name|name|nom|ονοματεπώνυμο)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`, 'i'),
  ]);
  const firstName = parseField(text, [
    new RegExp(`(?:first\\s*name|given\\s*names?|fn|prénom|όνομα)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`, 'i'),
  ]);
  const lastName = parseField(text, [
    new RegExp(`(?:last\\s*name|surname|family\\s*name|ln|επώνυμο)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`, 'i'),
  ]);

  return { fullName, firstName, lastName };
};

const parseDateOfBirth = (text: string): string | undefined => {
  return parseField(text, [
    /(?:dob|date\s*of\s*birth|born|birth\s*date|née?|d\.o\.b|ημ(?:ερομηνία)?\.?\s*γενν(?:ήσεως|ησης)?)\s*[:\-]?\s*(\d{1,2}[\\/\-\.]\d{1,2}[\\/\-\.]\d{2,4})/i,
    /(?:dob|date\s*of\s*birth|born|birth\s*date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  ]);
};

const parsePlaceOfBirth = (text: string): string | undefined => {
  return parseField(text, [
    new RegExp(
      `(?:place\\s*of\\s*birth|pob|birthplace|τόπος\\s*γενν(?:ήσεως|ησης)?)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`,
      'i',
    ),
  ]);
};

const parseIssueDate = (text: string): string | undefined => {
  return parseField(text, [
    /(?:date\s*of\s*issue|issued?\s*(?:on|date)?|ημ(?:ερομηνία)?\.?\s*έκδοσης)\s*[:\-]?\s*(\d{1,2}[\\/\-\.]\d{1,2}[\\/\-\.]\d{2,4})/i,
  ]);
};

const parseIssuingAuthority = (text: string): string | undefined => {
  return parseField(text, [
    new RegExp(
      `(?:issuing\\s*authority|authority|issued\\s*by|(?:εκδούσα\\s*)?αρχή(?:\\s*έκδοσης)?)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`,
      'i',
    ),
  ]);
};

const parseDocumentNumber = (text: string): string | undefined => {
  return parseField(text, [
    /(?:passport\s*(?:no|number|#)|αρ(?:ιθμός)?\.?\s*διαβατηρίου)\s*[:\-]?\s*([A-ZΑ-Ω0-9]{6,12})/i,
    /(?:dl|license\s*(?:no|number|#)|licence|id\s*(?:no|number|#)|document\s*(?:no|number|#)|card\s*(?:no|number|#)|αρ(?:ιθμός)?\.?\s*(?:δελτίου|ταυτότητας)|α\.?δ\.?τ\.?|no\.?)\s*[:\-]?\s*([A-ZΑ-Ω0-9\-]{4,20})/i,
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
    /(?:sex|gender|φύλο)\s*[:\-]?\s*(M|F|Male|Female|X|Α|Θ|Άρρεν|Θήλυ)/i,
  ]);
};

const parseNationality = (text: string): string | undefined => {
  return parseField(text, [
    new RegExp(
      `(?:nationality|nation|citizenship|country|ιθαγένεια|υπηκοότητα)\\s*[:\\-]?\\s*(${NAME_CHARS}+)`,
      'i',
    ),
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
    placeOfBirth: parsePlaceOfBirth(text),
    documentNumber: parseDocumentNumber(text),
    issueDate: parseIssueDate(text),
    expirationDate: parseExpiration(text),
    issuingAuthority: parseIssuingAuthority(text),
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
