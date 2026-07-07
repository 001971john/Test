const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Tolerantly parses the free-text date strings our OCR/ID parser
 * extracts (DD/MM/YYYY, DD-MM-YYYY, "Month DD, YYYY", or a raw
 * MRZ-style YYMMDD). Returns null when the text isn't a recognizable
 * date rather than throwing.
 */
export const parseFlexibleDate = (text: string | undefined): Date | null => {
  if (!text) return null;
  const trimmed = text.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numeric = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  }

  // "Month DD, YYYY" or "DD Month YYYY"
  const monthName = trimmed.match(
    /([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/,
  );
  if (monthName) {
    const [, m1, d1, y1, d2, m2, y2] = monthName;
    const monthStr = (m1 || m2 || '').slice(0, 3).toLowerCase();
    const month = MONTHS[monthStr];
    const day = Number(d1 || d2);
    const year = Number(y1 || y2);
    if (month !== undefined) {
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Raw MRZ date: YYMMDD
  const mrz = trimmed.match(/^\d{6}$/);
  if (mrz) {
    const yy = Number(trimmed.slice(0, 2));
    const mm = Number(trimmed.slice(2, 4));
    const dd = Number(trimmed.slice(4, 6));
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const date = new Date(year, mm - 1, dd);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
};

/** Days from now until the given date (negative if already past). */
export const daysUntil = (date: Date): number => {
  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfDate.getTime() - startOfNow.getTime()) / (1000 * 60 * 60 * 24));
};
