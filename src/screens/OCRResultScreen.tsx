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
import { RootStackParamList, ScannedDocument, ExtractedIDData } from '../types';
import { StorageService } from '../services/StorageService';
import { OCRService } from '../services/OCRService';
import { ExportService } from '../services/ExportService';

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
    }
    setLoading(false);
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
      const filePath = await ExportService.exportToDOCX(updatedDoc);
      Alert.alert(
        'Word Document Ready',
        'Your scan has been saved as a Word (.docx) document.',
        [
          { text: 'OK' },
          {
            text: 'Share / Open',
            onPress: () => ExportService.shareFile(filePath, 'docx'),
          },
        ],
      );
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
    { label: 'Last Name', key: 'lastName' },
    { label: 'Date of Birth', key: 'dateOfBirth' },
    { label: 'Document Number', key: 'documentNumber' },
    { label: 'Expiration Date', key: 'expirationDate' },
    { label: 'Address', key: 'address' },
    { label: 'Nationality', key: 'nationality' },
    { label: 'Gender', key: 'gender' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        value={document.title}
        onChangeText={text => setDocument({ ...document, title: text })}
        placeholder="Document Title"
      />

      <Text style={styles.docType}>
        {document.type.replace(/_/g, ' ').toUpperCase()}
      </Text>

      {document.pages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pagesScroll}>
          {document.pages.map((page, index) => (
            <TouchableOpacity
              key={page.id}
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
          ))}
        </ScrollView>
      )}

      {editedData && document.type !== 'general' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extracted Information</Text>
          <Text style={styles.confidenceText}>
            Confidence: {Math.round((editedData.confidence || 0) * 100)}%
          </Text>
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
    marginRight: 12,
    backgroundColor: '#E7EAF0',
  },
  pageLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
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
