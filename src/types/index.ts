export type DocumentType = 'general' | 'id_card' | 'passport' | 'drivers_license';
export type FilterType = 'color' | 'grayscale' | 'bw';

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
  documentNumber?: string;
  expirationDate?: string;
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
}

export type RootStackParamList = {
  MainTabs: undefined;
  ImageEditor: { documentId: string; pageId: string };
  OCRResult: { documentId: string };
  Export: { documentId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Scanner: undefined;
  Settings: undefined;
};
