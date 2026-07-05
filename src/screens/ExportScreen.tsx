import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, ScannedDocument, ID_TYPES } from '../types';
import { StorageService } from '../services/StorageService';
import { ExportService } from '../services/ExportService';

type ScreenRouteProp = RouteProp<RootStackParamList, 'Export'>;

export const ExportScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const { documentId } = route.params;
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [idCardSheet, setIdCardSheet] = useState(false);
  const [includeExtras, setIncludeExtras] = useState(false);

  useEffect(() => {
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDocument = async () => {
    const docs = await StorageService.getAllDocuments();
    const doc = docs.find(d => d.id === documentId);
    setDocument(doc || null);
    if (doc && ID_TYPES.includes(doc.type) && doc.pages.length === 2) {
      setIdCardSheet(true);
    }
  };

  const idCardSheetAvailable =
    !!document && ID_TYPES.includes(document.type) && document.pages.length >= 2;

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!document) return;
    setExporting(format);
    try {
      const result =
        format === 'pdf'
          ? await ExportService.exportToPDF(document, {
              idCardSheet: idCardSheetAvailable && idCardSheet,
              includeExtras,
            })
          : await ExportService.exportToDOCX(document, { includeExtras });
      setLastExportPath(result.filePath);
      const location = result.savedToDownloads
        ? `Saved to:\n📁 ${result.downloadsPath}\n\nOpen your Files app → Downloads → DocScanner to find it.`
        : 'Saved inside the app. Use the Share button to send it anywhere.';
      Alert.alert(`${format.toUpperCase()} Ready`, location, [
        { text: 'OK' },
        {
          text: 'Share',
          onPress: () => ExportService.shareFile(result.filePath, format),
        },
      ]);
    } catch (error) {
      Alert.alert('Export Failed', `Could not export as ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const handleShare = async () => {
    if (!lastExportPath) return;
    const format = lastExportPath.endsWith('.pdf') ? 'pdf' : 'docx';
    try {
      await ExportService.shareFile(lastExportPath, format as 'pdf' | 'docx');
    } catch {}
  };

  if (!document) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.subtitle}>
          {document.pages.length} page(s) | {document.type.replace(/_/g, ' ')}
        </Text>
      </View>

      {idCardSheetAvailable && (
        <TouchableOpacity
          style={[styles.idCardToggle, idCardSheet && styles.idCardToggleActive]}
          onPress={() => setIdCardSheet(v => !v)}>
          <Text style={styles.idCardToggleIcon}>🪪</Text>
          <View style={styles.idCardToggleInfo}>
            <Text style={styles.idCardToggleTitle}>Both sides on one page</Text>
            <Text style={styles.idCardToggleDesc}>
              Front and back of the card together on a single A4 sheet (PDF only)
            </Text>
          </View>
          <Text style={styles.idCardToggleCheck}>{idCardSheet ? '✅' : '⬜'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.idCardToggle, includeExtras && styles.idCardToggleActive]}
        onPress={() => setIncludeExtras(v => !v)}>
        <Text style={styles.idCardToggleIcon}>📝</Text>
        <View style={styles.idCardToggleInfo}>
          <Text style={styles.idCardToggleTitle}>Add extracted data & text pages</Text>
          <Text style={styles.idCardToggleDesc}>
            Off = a faithful copy of your scan. On = adds extra pages with the recognized text,
            ID fields and translation.
          </Text>
        </View>
        <Text style={styles.idCardToggleCheck}>{includeExtras ? '✅' : '⬜'}</Text>
      </TouchableOpacity>

      <View style={styles.options}>
        <Text style={styles.sectionTitle}>Choose Export Format</Text>

        <TouchableOpacity
          style={[styles.exportOption, styles.pdfOption]}
          onPress={() => handleExport('pdf')}
          disabled={exporting !== null}>
          {exporting === 'pdf' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.exportIcon}>📕</Text>
              <View style={styles.exportInfo}>
                <Text style={styles.exportLabel}>PDF Document</Text>
                <Text style={styles.exportDesc}>
                  A faithful copy of your scan — same as the original.
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportOption, styles.docxOption]}
          onPress={() => handleExport('docx')}
          disabled={exporting !== null}>
          {exporting === 'docx' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.exportIcon}>📘</Text>
              <View style={styles.exportInfo}>
                <Text style={styles.exportLabel}>Word Document (.docx)</Text>
                <Text style={styles.exportDesc}>
                  Your scan as an editable Word file — same as the original.
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {lastExportPath && (
        <View style={styles.shareSection}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share Last Export</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280' },
  idCardToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  idCardToggleActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  idCardToggleIcon: { fontSize: 26, marginRight: 12 },
  idCardToggleInfo: { flex: 1 },
  idCardToggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  idCardToggleDesc: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  idCardToggleCheck: { fontSize: 20, marginLeft: 8 },
  options: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  pdfOption: { backgroundColor: '#E11D48' },
  docxOption: { backgroundColor: '#4F46E5' },
  exportIcon: { fontSize: 36, marginRight: 16 },
  exportInfo: { flex: 1 },
  exportLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  exportDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  shareSection: { marginTop: 8 },
  shareButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
