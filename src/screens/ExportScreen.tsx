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
import { RootStackParamList, ScannedDocument } from '../types';
import { StorageService } from '../services/StorageService';
import { ExportService } from '../services/ExportService';

type ScreenRouteProp = RouteProp<RootStackParamList, 'Export'>;

export const ExportScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const { documentId } = route.params;
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, []);

  const loadDocument = async () => {
    const docs = await StorageService.getAllDocuments();
    const doc = docs.find(d => d.id === documentId);
    setDocument(doc || null);
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!document) return;
    setExporting(format);
    try {
      let filePath: string;
      if (format === 'pdf') {
        filePath = await ExportService.exportToPDF(document);
      } else {
        filePath = await ExportService.exportToDOCX(document);
      }
      setLastExportPath(filePath);
      Alert.alert(
        'Export Successful',
        `Document exported as ${format.toUpperCase()}`,
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => ExportService.shareFile(filePath, format),
          },
        ],
      );
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
                  Best for sharing and printing. Includes images and extracted text.
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
                  Editable format with structured data table. Great for ID data extraction.
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
