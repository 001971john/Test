import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReactNativeBlobUtil from 'react-native-blob-util';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { RootStackParamList, ScannedDocument, ExtractedIDData, ID_TYPES } from '../types';
import { StorageService } from '../services/StorageService';
import { ScannerService } from '../services/ScannerService';
import { OCRService } from '../services/OCRService';
import { ExportService } from '../services/ExportService';
import { LocalAIService, LocalAIError } from '../services/LocalAIService';
import { TYPE_META } from '../utils/DocClassifier';

type ScreenRouteProp = RouteProp<RootStackParamList, 'OCRResult'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const OCRResultScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { documentId } = route.params;
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedData, setEditedData] = useState<ExtractedIDData | null>(null);
  const [savingWord, setSavingWord] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [addingPages, setAddingPages] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [aiClassifying, setAiClassifying] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setLoading(true);
    const docs = await StorageService.getAllDocuments();
    const doc = docs.find(d => d.id === documentId);
    if (doc) {
      setDocument(doc);
      setEditedData(doc.extractedData || null);
      refineCategoryWithAI(doc);
    }
    setLoading(false);
  };

  // Non-blocking: let the on-device AI refine the category and title
  // of non-ID documents when the model is available.
  const refineCategoryWithAI = async (doc: ScannedDocument) => {
    if (ID_TYPES.includes(doc.type)) return;
    const allText = doc.pages.map(p => p.ocrText).join('\n').trim();
    if (!allText) return;
    if (!(await LocalAIService.isModelDownloaded())) return;
    setAiClassifying(true);
    try {
      const { category, title } = await LocalAIService.classifyDocument(allText);
      const isDefaultTitle = /^Scan\s/.test(doc.title);
      const updated: ScannedDocument = {
        ...doc,
        type: category,
        title: isDefaultTitle && title ? title : doc.title,
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveDocument(updated);
      setDocument(current =>
        current && current.id === updated.id
          ? { ...current, type: updated.type, title: updated.title }
          : current,
      );
    } catch {
      // Classification is best-effort — keep the keyword-based category.
    } finally {
      setAiClassifying(false);
    }
  };

  const handleKeepOriginal = async () => {
    if (!document) return;
    const updatedDoc: ScannedDocument = {
      ...document,
      extractedData: editedData || document.extractedData,
      updatedAt: new Date().toISOString(),
    };
    await StorageService.saveDocument(updatedDoc);
    setDocument(updatedDoc);
    Alert.alert('Saved', 'Your scan has been saved as the original.', [
      { text: 'OK', onPress: () => navigation.navigate('MainTabs' as never) },
    ]);
  };

  const handleSaveAsWord = async () => {
    if (!document) return;
    setSavingWord(true);
    try {
      const updatedDoc: ScannedDocument = {
        ...document,
        extractedData: editedData || document.extractedData,
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveDocument(updatedDoc);
      const result = await ExportService.exportToDOCX(updatedDoc);
      const location = result.savedToDownloads
        ? `Saved to:\n📁 ${result.downloadsPath}\n\nOpen your Files app → Downloads → DocScanner to find it.`
        : 'Saved inside the app. Use Share to send it anywhere.';
      Alert.alert('Word Document Ready', location, [
        { text: 'OK' },
        {
          text: 'Share / Open',
          onPress: () => ExportService.shareFile(result.filePath, 'docx'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', `Could not create Word document.\n\n${error?.message ?? ''}`);
    } finally {
      setSavingWord(false);
    }
  };

  const handleDeleteScan = () => {
    if (!document) return;
    Alert.alert(
      'Delete Scan',
      `Delete "${document.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteDocument(document.id);
            navigation.navigate('MainTabs' as never);
          },
        },
      ],
    );
  };

  const handleRerunOCR = async () => {
    if (!document) return;
    setLoading(true);
    try {
      const processed = await OCRService.processAllPages(document);
      setDocument(processed);
      setEditedData(processed.extractedData || null);
    } catch {
      Alert.alert('Error', 'Failed to process document.');
    }
    setLoading(false);
  };

  const updateField = (field: keyof ExtractedIDData, value: string) => {
    if (!editedData) return;
    setEditedData({ ...editedData, [field]: value });
  };

  const runTranslate = async (target: 'greek' | 'english') => {
    if (!document) return;
    const allText = document.pages.map(p => p.ocrText).join('\n').trim();
    if (!allText) {
      Alert.alert('No Text', 'Run text recognition first, then translate.');
      return;
    }
    if (!(await LocalAIService.isModelDownloaded())) {
      Alert.alert(
        'AI Model Needed',
        'Translation runs entirely on your phone using the AI model. Download it once from Settings → Local AI (1.1 GB).',
      );
      return;
    }
    setTranslating(true);
    try {
      const text = await LocalAIService.translate(allText, target);
      const updatedDoc: ScannedDocument = {
        ...document,
        translation: { to: target, text },
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveDocument(updatedDoc);
      setDocument(updatedDoc);
    } catch (error: any) {
      Alert.alert('Translation Error', error?.message ?? 'Could not translate. Try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslate = () => {
    Alert.alert(
      '🌐 Translate Document',
      'The original scan stays untouched — the translation is added alongside it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Σε Ελληνικά 🇬🇷', onPress: () => runTranslate('greek') },
        { text: 'To English 🇬🇧', onPress: () => runTranslate('english') },
      ],
    );
  };

  const savePages = async (pages: ScannedDocument['pages']) => {
    if (!document) return;
    const updatedDoc: ScannedDocument = {
      ...document,
      pages: pages.map((p, i) => ({ ...p, order: i })),
      updatedAt: new Date().toISOString(),
    };
    await StorageService.saveDocument(updatedDoc);
    setDocument(updatedDoc);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    if (!document) return;
    const target = index + direction;
    if (target < 0 || target >= document.pages.length) return;
    const pages = [...document.pages];
    [pages[index], pages[target]] = [pages[target], pages[index]];
    savePages(pages);
  };

  const deletePage = (index: number) => {
    if (!document) return;
    if (document.pages.length <= 1) {
      Alert.alert('Cannot Delete', 'A document must keep at least one page. Delete the whole scan instead.');
      return;
    }
    const page = document.pages[index];
    Alert.alert('Delete Page', `Delete page ${index + 1}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ReactNativeBlobUtil.fs.unlink(page.originalImageUri);
            if (page.processedImageUri !== page.originalImageUri) {
              await ReactNativeBlobUtil.fs.unlink(page.processedImageUri);
            }
          } catch {}
          savePages(document.pages.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const addPages = async () => {
    if (!document || addingPages) return;
    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 5,
      });
      if (!result.scannedImages || result.scannedImages.length === 0) return;
      setAddingPages(true);
      let currentDoc = document;
      const newPageIds: string[] = [];
      for (const imageUri of result.scannedImages) {
        const { document: updated, page } = await ScannerService.addPageToDocument(
          currentDoc,
          imageUri,
        );
        currentDoc = updated;
        newPageIds.push(page.id);
      }
      setDocument(currentDoc);
      for (const pid of newPageIds) {
        currentDoc = await OCRService.processPage(currentDoc, pid);
      }
      setDocument(currentDoc);
      setEditedData(currentDoc.extractedData || null);
    } catch (error: any) {
      const message = error?.message ?? '';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Add Page Error', 'Could not add the page. Please try again.');
      }
    } finally {
      setAddingPages(false);
    }
  };

  const handleSmartFill = async () => {
    if (!document) return;
    const allText = document.pages.map(p => p.ocrText).join('\n').trim();
    if (!allText) {
      Alert.alert('No Text Found', 'Run text recognition first, then try Smart Fill.');
      return;
    }
    if (!(await LocalAIService.isModelDownloaded())) {
      Alert.alert(
        'AI Model Not Downloaded',
        'Smart Fill uses a free AI model that runs entirely on your phone — nothing is sent to the internet. Download it once (about 1.1 GB, Wi-Fi recommended) from Settings.',
      );
      return;
    }
    setAiFilling(true);
    try {
      const extracted = await LocalAIService.extractIDData(allText, document.type);
      if (Object.keys(extracted).length === 0) {
        Alert.alert('Nothing Found', 'The AI could not identify any fields in this document.');
        return;
      }
      const base: ExtractedIDData = editedData ?? { confidence: 0 };
      setEditedData({ ...base, ...extracted, confidence: 0.9 });
      Alert.alert(
        'Smart Fill Complete',
        `The AI filled ${Object.keys(extracted).length} field(s). Please review them, then tap Keep Original Scan to save.`,
      );
    } catch (error: any) {
      const message =
        error instanceof LocalAIError && error.code === 'MODEL_LOAD_FAILED'
          ? 'Your phone does not have enough free memory to run the AI right now. Close other apps and try again.'
          : error?.message ?? 'Smart Fill failed.';
      Alert.alert('Smart Fill Error', message);
    } finally {
      setAiFilling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Processing document...</Text>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Document not found</Text>
      </View>
    );
  }

  const fields: { label: string; key: keyof ExtractedIDData }[] = [
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        value={document.title}
        onChangeText={text => setDocument({ ...document, title: text })}
        placeholder="Document Title"
      />

      <View style={styles.docTypeRow}>
        <View
          style={[
            styles.docTypeBadge,
            { backgroundColor: (TYPE_META[document.type] ?? TYPE_META.general).color },
          ]}>
          <Text style={styles.docTypeBadgeText}>
            {(TYPE_META[document.type] ?? TYPE_META.general).icon}{' '}
            {(TYPE_META[document.type] ?? TYPE_META.general).label}
          </Text>
        </View>
        {aiClassifying && (
          <Text style={styles.aiClassifyingText}>  🏷 AI is categorizing…</Text>
        )}
      </View>

      {document.pages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pagesScroll}>
          {document.pages.map((page, index) => (
            <View key={page.id} style={styles.pageItem}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('ImageEditor', {
                    documentId: document.id,
                    pageId: page.id,
                  })
                }>
                <Image
                  source={{ uri: `file://${page.processedImageUri}` }}
                  style={styles.pageThumb}
                />
                <Text style={styles.pageLabel}>Page {index + 1}</Text>
              </TouchableOpacity>
              <View style={styles.pageControls}>
                <TouchableOpacity
                  onPress={() => movePage(index, -1)}
                  disabled={index === 0}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Text style={[styles.pageControl, index === 0 && styles.pageControlDisabled]}>
                    ◀
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deletePage(index)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Text style={styles.pageControlDelete}>🗑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => movePage(index, 1)}
                  disabled={index === document.pages.length - 1}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Text
                    style={[
                      styles.pageControl,
                      index === document.pages.length - 1 && styles.pageControlDisabled,
                    ]}>
                    ▶
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addPageTile} onPress={addPages} disabled={addingPages}>
            {addingPages ? (
              <ActivityIndicator color="#4F46E5" />
            ) : (
              <>
                <Text style={styles.addPageIcon}>➕</Text>
                <Text style={styles.addPageText}>Add page</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {editedData && ID_TYPES.includes(document.type) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extracted Information</Text>
          <Text style={styles.confidenceText}>
            Confidence: {Math.round((editedData.confidence || 0) * 100)}%
          </Text>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={handleSmartFill}
            disabled={aiFilling}>
            {aiFilling ? (
              <View style={styles.aiFillingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.aiButtonText}>
                  {'  '}AI is reading the document… (~30 s, on your phone)
                </Text>
              </View>
            ) : (
              <Text style={styles.aiButtonText}>✨ Smart Fill with AI (offline)</Text>
            )}
          </TouchableOpacity>
          {fields.map(({ label, key }) => (
            <View key={key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(editedData[key] || '')}
                onChangeText={text => updateField(key, text)}
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            </View>
          ))}
        </View>
      )}

      {document.translation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🌐 Translation ({document.translation.to === 'greek' ? 'Ελληνικά' : 'English'})
          </Text>
          <Text style={styles.ocrText}>{document.translation.text}</Text>
        </View>
      )}

      {document.pages.some(p => p.ocrText) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Raw OCR Text</Text>
          {document.pages.map((page, index) => (
            <View key={page.id}>
              {document.pages.length > 1 && (
                <Text style={styles.pageHeader}>Page {index + 1}</Text>
              )}
              <Text style={styles.ocrText}>{page.ocrText || 'No text detected'}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Text style={styles.actionsTitle}>What would you like to do with this scan?</Text>

        <TouchableOpacity style={styles.actionButton} onPress={handleKeepOriginal}>
          <Text style={styles.actionButtonText}>✅  Keep Original Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.wordButton]}
          onPress={handleSaveAsWord}
          disabled={savingWord}>
          {savingWord ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>📘  Save as Word (.docx)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('Export', { documentId: document.id })}>
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            📄  More Export Options (PDF)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleTranslate}
          disabled={translating}>
          {translating ? (
            <View style={styles.aiFillingRow}>
              <ActivityIndicator color="#4F46E5" size="small" />
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                {'  '}Translating on your phone…
              </Text>
            </View>
          ) : (
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              🌐  Translate (Greek / English)
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleRerunOCR}>
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            🔁  Re-run Text Recognition
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDeleteScan}>
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
            🗑  Delete This Scan
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6B7280' },
  errorText: { fontSize: 18, color: '#E11D48' },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  docTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 4,
  },
  docTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  docTypeBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  aiClassifyingText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  docType: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
  },
  pagesScroll: { marginBottom: 20 },
  pageThumb: {
    width: 100,
    height: 130,
    borderRadius: 8,
    backgroundColor: '#E7EAF0',
  },
  pageLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  pageItem: { marginRight: 12, alignItems: 'center' },
  pageControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 92,
    marginTop: 4,
  },
  pageControl: { fontSize: 15, color: '#4F46E5', paddingHorizontal: 4 },
  pageControlDisabled: { color: '#C7CBD4' },
  pageControlDelete: { fontSize: 14 },
  addPageTile: {
    width: 100,
    height: 130,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A5B4FC',
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPageIcon: { fontSize: 24, marginBottom: 6 },
  addPageText: { fontSize: 12, fontWeight: '600', color: '#4F46E5' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  confidenceText: {
    fontSize: 14,
    color: '#4F46E5',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  aiButton: {
    backgroundColor: '#7C3AED',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  aiButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  aiFillingRow: { flexDirection: 'row', alignItems: 'center' },
  fieldRow: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  fieldInput: {
    backgroundColor: '#EEF1F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  pageHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 8,
    marginBottom: 4,
  },
  ocrText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#EEF1F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actions: { marginTop: 8, marginBottom: 40 },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  secondaryButtonText: {
    color: '#4F46E5',
  },
  wordButton: {
    backgroundColor: '#2563EB',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E11D48',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#E11D48',
  },
});
