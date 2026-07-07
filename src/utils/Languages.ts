export type SupportedLanguage = 'greek' | 'english' | 'german' | 'italian' | 'french';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'greek',
  'english',
  'german',
  'italian',
  'french',
];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  greek: 'Ελληνικά',
  english: 'English',
  german: 'Deutsch',
  italian: 'Italiano',
  french: 'Français',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  greek: '🇬🇷',
  english: '🇬🇧',
  german: '🇩🇪',
  italian: '🇮🇹',
  french: '🇫🇷',
};
