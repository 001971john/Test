import { DocumentType } from '../types';

/** Shared visual metadata for every document category. */
export const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  general: { label: 'Document', icon: '📄', color: '#4F46E5' },
  receipt: { label: 'Receipt', icon: '🧾', color: '#059669' },
  medical: { label: 'Medical', icon: '🏥', color: '#DC2626' },
  invoice: { label: 'Invoice', icon: '💶', color: '#B45309' },
  letter: { label: 'Letter', icon: '✉️', color: '#2563EB' },
  contract: { label: 'Contract', icon: '📜', color: '#6D28D9' },
  id_card: { label: 'ID Card', icon: '🪪', color: '#0891B2' },
  passport: { label: 'Passport', icon: '🛂', color: '#7C3AED' },
  drivers_license: { label: 'License', icon: '🚗', color: '#D97706' },
};

// Greek + English keyword sets per category. Scored by count of matches.
const KEYWORDS: Record<string, RegExp[]> = {
  receipt: [
    /απόδειξη|αποδειξη|receipt/i,
    /σύνολο|συνολο|total/i,
    /μετρητά|μετρητα|cash|card|κάρτα|καρτα/i,
    /φπα|vat|tax/i,
    /ρέστα|ρεστα|change|υποσύνολο|subtotal/i,
    /ταμείο|ταμειο|register|pos\b/i,
  ],
  invoice: [
    /τιμολόγιο|τιμολογιο|invoice/i,
    /αφμ|vat\s*(no|number|id)/i,
    /πληρωτέο|πληρωτεο|amount\s*due|payment\s*due/i,
    /καθαρή\s*αξία|καθαρη\s*αξια|net\s*amount/i,
    /προμηθευτής|προμηθευτης|supplier|bill\s*to/i,
  ],
  medical: [
    /νοσοκομείο|νοσοκομειο|hospital|κλινική|κλινικη|clinic/i,
    /ιατρ|διάγνωση|διαγνωση|diagnosis|doctor|dr\.|md\b/i,
    /ασθενής|ασθενης|patient/i,
    /συνταγή|συνταγη|prescription|φάρμακ|φαρμακ|medication/i,
    /εξέταση|εξεταση|examination|test\s*results|αίμα|αιμα|blood/i,
    /εοπυυ|αμκα|health\s*insurance/i,
  ],
  contract: [
    /σύμβαση|συμβαση|συμβόλαιο|συμβολαιο|contract|agreement/i,
    /όροι|οροι|terms\s*(and|&)\s*conditions/i,
    /συμβαλλόμεν|συμβαλλομεν|parties|hereinafter/i,
    /υπογραφή|υπογραφη|signature|signed/i,
    /άρθρο|αρθρο|article|clause/i,
  ],
  letter: [
    /αγαπητ|αξιότιμ|αξιοτιμ|dear\s+(sir|madam|mr|mrs|ms)/i,
    /με\s*εκτίμηση|με\s*εκτιμηση|sincerely|regards|yours\s*(truly|faithfully)/i,
    /επιστολή|επιστολη/i,
  ],
};

/**
 * Instant, fully-offline keyword classification of OCR text.
 * Returns null when no category is a confident match.
 */
export const classifyByKeywords = (ocrText: string): DocumentType | null => {
  if (!ocrText || ocrText.trim().length < 10) return null;
  let best: { type: DocumentType; score: number } | null = null;
  for (const [type, patterns] of Object.entries(KEYWORDS)) {
    const score = patterns.reduce((sum, p) => sum + (p.test(ocrText) ? 1 : 0), 0);
    if (score >= 2 && (!best || score > best.score)) {
      best = { type: type as DocumentType, score };
    }
  }
  return best?.type ?? null;
};
