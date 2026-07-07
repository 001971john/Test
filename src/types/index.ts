import { SupportedLanguage } from '../utils/Languages';

export type DocumentType =
  | 'general'
  | 'id_card'
  | 'passport'
  | 'drivers_license'
  | 'receipt'
  | 'medical'
  | 'invoice'
  | 'letter'
  | 'contract';

/** Document types that carry structured ID data (name, number, dates…). */
export const ID_TYPES: DocumentType[] = ['id_card', 'passport', 'drivers_license'];
export type FilterType = 'color' | 'enhanced' | 'grayscale' | 'bw';

export interface ScannedPage {
  id: string;
  originalImageUri: string;
  processedImageUri: string;
  ocrText: string;
  filter: FilterType;
  order: number;
}

export interface ExtractedIDData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  documentNumber?: string;
  issueDate?: string;
  expirationDate?: string;
  issuingAuthority?: string;
  address?: string;
  nationality?: string;
  gender?: string;
  rawMRZ?: string;
  confidence: number;
}

export interface ScannedDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pages: ScannedPage[];
  extractedData?: ExtractedIDData;
  type: DocumentType;
  /** On-demand AI translation of the document text. Original is never modified. */
  translation?: { to: SupportedLanguage; text: string };
}

export type RootStackParamList = {
  MainTabs: undefined;
  ImageEditor: { documentId: string; pageId: string };
  OCRResult: { documentId: string };
  Export: { documentId: string };
  Signature: { documentId: string; pageId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Scanner: undefined;
  Assistant: undefined;
  Settings: undefined;
};
