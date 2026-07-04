import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LockService } from '../services/LockService';
import { OCRService, OcrLanguage } from '../services/OCRService';
import { LocalAIService } from '../services/LocalAIService';

export const SettingsScreen = () => {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [ocrLang, setOcrLang] = useState<OcrLanguage>('greek');
  const [aiStatus, setAiStatus] = useState<'checking' | 'missing' | 'downloading' | 'ready'>('checking');
  const [aiProgress, setAiProgress] = useState(0);

  useEffect(() => {
    LockService.isLockEnabled().then(setLockEnabled);
    OCRService.getOcrLanguage().then(setOcrLang);
    LocalAIService.isModelDownloaded().then(ready =>
      setAiStatus(ready ? 'ready' : 'missing'),
    );
  }, []);

  const handleDownloadModel = () => {
    Alert.alert(
      'Download AI Model',
      'The Smart Fill AI model is about 1.1 GB. Wi-Fi is strongly recommended. After downloading, all AI runs on your phone — no document ever leaves your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            setAiStatus('downloading');
            setAiProgress(0);
            try {
              await LocalAIService.downloadModel(setAiProgress);
              setAiStatus('ready');
              Alert.alert('Ready!', 'The AI model is installed. Use ✨ Smart Fill on any scanned document.');
            } catch (e: any) {
              setAiStatus('missing');
              Alert.alert('Download Failed', e?.message ?? 'Please check your connection and try again.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteModel = () => {
    Alert.alert('Delete AI Model', 'This frees about 1.1 GB. You can download it again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await LocalAIService.deleteModel();
          setAiStatus('missing');
        },
      },
    ]);
  };

  const handleSetOcrLang = async (lang: OcrLanguage) => {
    setOcrLang(lang);
    await OCRService.setOcrLanguage(lang);
  };

  const handleSavePin = async () => {
    if (newPin.length < 4) {
      Alert.alert('PIN Too Short', 'Please use at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('PINs Do Not Match', 'Please enter the same PIN twice.');
      return;
    }
    await LockService.setPin(newPin);
    setLockEnabled(true);
    setShowPinSetup(false);
    setNewPin('');
    setConfirmPin('');
    Alert.alert('App Lock Enabled', 'DocScanner will now ask for your PIN or fingerprint when it opens.');
  };

  const handleDisableLock = () => {
    Alert.alert('Disable App Lock', 'Remove the PIN and fingerprint lock?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          await LockService.disableLock();
          setLockEnabled(false);
        },
      },
    ]);
  };
  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all scanned documents. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.label}>App</Text>
          <Text style={styles.value}>DocScanner</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Platform</Text>
          <Text style={styles.value}>React Native</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📷</Text>
          <Text style={styles.featureText}>Camera & Document Scanning</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🔍</Text>
          <Text style={styles.featureText}>OCR Text Extraction</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🪪</Text>
          <Text style={styles.featureText}>ID Document Parsing</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📕</Text>
          <Text style={styles.featureText}>PDF Export</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📘</Text>
          <Text style={styles.featureText}>Word (.docx) Export</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🎨</Text>
          <Text style={styles.featureText}>Image Filters & Enhancement</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Recognition Language</Text>
        <TouchableOpacity
          style={[styles.langOption, ocrLang === 'greek' && styles.langOptionActive]}
          onPress={() => handleSetOcrLang('greek')}>
          <Text style={[styles.langOptionText, ocrLang === 'greek' && styles.langOptionTextActive]}>
            🇬🇷  Ελληνικά + English
          </Text>
          {ocrLang === 'greek' && <Text style={styles.langCheck}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langOption, ocrLang === 'latin' && styles.langOptionActive]}
          onPress={() => handleSetOcrLang('latin')}>
          <Text style={[styles.langOptionText, ocrLang === 'latin' && styles.langOptionTextActive]}>
            🇬🇧  English only (faster)
          </Text>
          {ocrLang === 'latin' && <Text style={styles.langCheck}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.storageNote}>
          Choose the language of the documents you scan. Greek mode reads both Greek and English text.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local AI (Offline)</Text>
        <View style={styles.row}>
          <Text style={styles.label}>AI Model</Text>
          <Text style={[styles.value, aiStatus === 'ready' && styles.valueActive]}>
            {aiStatus === 'checking' && 'Checking…'}
            {aiStatus === 'missing' && 'Not downloaded'}
            {aiStatus === 'downloading' && `Downloading… ${aiProgress}%`}
            {aiStatus === 'ready' && '✅ Ready · 1.1 GB'}
          </Text>
        </View>
        {aiStatus === 'missing' && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleDownloadModel}>
            <Text style={styles.primaryButtonText}>⬇️ Download AI Model (1.1 GB)</Text>
          </TouchableOpacity>
        )}
        {aiStatus === 'ready' && (
          <TouchableOpacity style={styles.linkButton} onPress={handleDeleteModel}>
            <Text style={styles.linkButtonText}>Delete AI Model</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.storageNote}>
          Powers ✨ Smart Fill and the Assistant. Runs 100% on your phone — your documents never
          leave the device.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.row}>
          <Text style={styles.label}>App Lock</Text>
          <Text style={[styles.value, lockEnabled && styles.valueActive]}>
            {lockEnabled ? '🔒 Enabled' : 'Off'}
          </Text>
        </View>

        {!showPinSetup ? (
          <View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowPinSetup(true)}>
              <Text style={styles.primaryButtonText}>
                {lockEnabled ? 'Change PIN' : 'Enable Lock (PIN + Fingerprint)'}
              </Text>
            </TouchableOpacity>
            {lockEnabled && (
              <TouchableOpacity style={styles.linkButton} onPress={handleDisableLock}>
                <Text style={styles.linkButtonText}>Disable App Lock</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            <TextInput
              style={styles.pinInput}
              value={newPin}
              onChangeText={t => setNewPin(t.replace(/[^0-9]/g, ''))}
              placeholder="New PIN (at least 4 digits)"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            <TextInput
              style={styles.pinInput}
              value={confirmPin}
              onChangeText={t => setConfirmPin(t.replace(/[^0-9]/g, ''))}
              placeholder="Repeat PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleSavePin}>
              <Text style={styles.primaryButtonText}>Save PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setShowPinSetup(false);
                setNewPin('');
                setConfirmPin('');
              }}>
              <Text style={styles.linkButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.storageNote}>
          When enabled, opening DocScanner requires your fingerprint or PIN.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </TouchableOpacity>
        <Text style={styles.storageNote}>All data is stored locally on your device.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7' },
  content: { padding: 16 },
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
  },
  label: { fontSize: 16, color: '#000' },
  value: { fontSize: 16, color: '#6B7280' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIcon: { fontSize: 20, marginRight: 12, width: 30 },
  featureText: { fontSize: 16, color: '#000' },
  valueActive: { color: '#10B981', fontWeight: '700' },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EEF1F7',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  langOptionText: { fontSize: 16, color: '#111827' },
  langOptionTextActive: { fontWeight: '700', color: '#4F46E5' },
  langCheck: { fontSize: 18, color: '#4F46E5', fontWeight: '700' },
  primaryButton: {
    backgroundColor: '#4F46E5',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', padding: 12 },
  linkButtonText: { color: '#E11D48', fontSize: 15, fontWeight: '600' },
  pinInput: {
    backgroundColor: '#EEF1F7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginTop: 12,
    color: '#111827',
  },
  dangerButton: {
    backgroundColor: '#E11D48',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  storageNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
});
