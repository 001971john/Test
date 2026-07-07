import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LockService } from '../services/LockService';
import { OCRService, OcrLanguage } from '../services/OCRService';
import { LocalAIService, AIModelId } from '../services/LocalAIService';
import { BackupService, BackupFile } from '../services/BackupService';

export const SettingsScreen = () => {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [ocrLang, setOcrLang] = useState<OcrLanguage>('greek');
  const [modelDownloaded, setModelDownloaded] = useState<Record<AIModelId, boolean>>({
    standard: false,
    accurate: false,
  });
  const [activeModel, setActiveModel] = useState<AIModelId>('standard');
  const [downloadingModel, setDownloadingModel] = useState<AIModelId | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);

  const loadBackups = () => BackupService.listBackups().then(setBackups);

  const loadModelStatuses = async () => {
    const { statuses, activeId } = await LocalAIService.getModelStatuses();
    setModelDownloaded({
      standard: statuses.find(s => s.id === 'standard')?.downloaded ?? false,
      accurate: statuses.find(s => s.id === 'accurate')?.downloaded ?? false,
    });
    setActiveModel(activeId);
  };

  useEffect(() => {
    LockService.isLockEnabled().then(setLockEnabled);
    OCRService.getOcrLanguage().then(setOcrLang);
    loadModelStatuses();
    loadBackups();
  }, []);

  const handleDownloadModel = (id: AIModelId) => {
    const model = LocalAIService.models.find(m => m.id === id)!;
    Alert.alert(
      `Download ${model.label} Model`,
      `About ${model.sizeLabel}. ${model.note}. Wi-Fi recommended — you can lock the screen or use other apps, the download continues in the notification bar. Everything runs on your phone; no document leaves your device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            setDownloadingModel(id);
            setModelProgress(0);
            try {
              await LocalAIService.downloadModel(id, setModelProgress);
              await loadModelStatuses();
              Alert.alert('Ready!', `The ${model.label} model is installed.`);
            } catch (e: any) {
              Alert.alert('Download Failed', e?.message ?? 'Please check your connection and try again.');
            } finally {
              setDownloadingModel(null);
            }
          },
        },
      ],
    );
  };

  const handleDeleteModel = (id: AIModelId) => {
    const model = LocalAIService.models.find(m => m.id === id)!;
    Alert.alert('Delete Model', `Delete the ${model.label} model? This frees about ${model.sizeLabel}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await LocalAIService.deleteModel(id);
          await loadModelStatuses();
        },
      },
    ]);
  };

  const handleUseModel = async (id: AIModelId) => {
    await LocalAIService.setPreferredModelId(id);
    setActiveModel(id);
  };

  const handleCreateBackup = async () => {
    setBackupBusy(true);
    try {
      const backup = await BackupService.createBackup();
      await loadBackups();
      Alert.alert(
        'Backup Created',
        `Saved to Downloads/DocScanner/Backups/${backup.filename}\n\nKeep this file safe — it's the only copy of your scans outside this phone.`,
      );
    } catch (e: any) {
      Alert.alert('Backup Failed', e?.message ?? 'Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = (backup: BackupFile) => {
    Alert.alert(
      'Restore Backup',
      `Restore documents from ${backup.filename}? Documents already on this phone won't be duplicated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setBackupBusy(true);
            try {
              const count = await BackupService.restoreBackup(backup.path);
              Alert.alert(
                'Restore Complete',
                count > 0
                  ? `Restored ${count} document${count === 1 ? '' : 's'}. Check your Documents tab.`
                  : 'Everything in this backup is already on your phone.',
              );
            } catch (e: any) {
              Alert.alert('Restore Failed', e?.message ?? 'Please try again.');
            } finally {
              setBackupBusy(false);
            }
          },
        },
      ],
    );
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
            🇬🇷  Ελληνικά (recommended)
          </Text>
          {ocrLang === 'greek' && <Text style={styles.langCheck}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langOption, ocrLang === 'latin' && styles.langOptionActive]}
          onPress={() => handleSetOcrLang('latin')}>
          <Text style={[styles.langOptionText, ocrLang === 'latin' && styles.langOptionTextActive]}>
            🇬🇧  English only (fastest)
          </Text>
          {ocrLang === 'latin' && <Text style={styles.langCheck}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langOption, ocrLang === 'auto' && styles.langOptionActive]}
          onPress={() => handleSetOcrLang('auto')}>
          <Text style={[styles.langOptionText, ocrLang === 'auto' && styles.langOptionTextActive]}>
            ✨  Auto-detect (Greek or English)
          </Text>
          {ocrLang === 'auto' && <Text style={styles.langCheck}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.storageNote}>
          Greek mode uses the Greek engine so Greek documents read as clean Greek. Pick English for
          Latin-only documents. Documents in other languages are always kept exactly as scanned —
          use Translate on the document screen when you need Greek or English.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local AI (Offline)</Text>
        {LocalAIService.models.map(model => {
          const downloaded = modelDownloaded[model.id];
          const isDownloading = downloadingModel === model.id;
          const isActive = activeModel === model.id;
          const bothDownloaded = modelDownloaded.standard && modelDownloaded.accurate;
          return (
            <View key={model.id} style={styles.modelCard}>
              <View style={styles.modelHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelName}>
                    {model.label} · {model.sizeLabel}
                    {downloaded && isActive && bothDownloaded ? '  ✓ In use' : ''}
                  </Text>
                  <Text style={styles.modelNote}>{model.note}</Text>
                </View>
                {downloaded && (
                  <Text style={styles.modelReady}>✅</Text>
                )}
              </View>
              {isDownloading ? (
                <Text style={styles.modelDownloading}>Downloading… {modelProgress}%</Text>
              ) : downloaded ? (
                <View style={styles.modelActions}>
                  {bothDownloaded && !isActive && (
                    <TouchableOpacity onPress={() => handleUseModel(model.id)}>
                      <Text style={styles.modelUse}>Use this model</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteModel(model.id)}>
                    <Text style={styles.modelDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.modelDownloadButton}
                  onPress={() => handleDownloadModel(model.id)}
                  disabled={downloadingModel !== null}>
                  <Text style={styles.modelDownloadText}>⬇️ Download ({model.sizeLabel})</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <Text style={styles.storageNote}>
          Powers ✨ Smart Fill, the Assistant, and Translation. Runs 100% on your phone — your
          documents never leave the device. The High-accuracy model gives noticeably better
          translations if your phone has enough memory.
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
        <Text style={styles.sectionTitle}>Backup & Restore</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateBackup} disabled={backupBusy}>
          <Text style={styles.primaryButtonText}>
            {backupBusy ? 'Working…' : '📦  Create Backup Now'}
          </Text>
        </TouchableOpacity>
        {backups.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {backups.map(b => (
              <View key={b.path} style={styles.backupRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.backupName} numberOfLines={1}>{b.filename}</Text>
                  <Text style={styles.backupMeta}>
                    {b.date.toLocaleDateString()}  ·  {(b.size / 1024 / 1024).toFixed(1)} MB
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRestoreBackup(b)}
                  disabled={backupBusy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.backupRestore}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.storageNote}>
          A backup is a single file with all your scans, saved to Downloads/DocScanner/Backups.
          It protects your documents if you lose or reset your phone — still 100% local, nothing
          is uploaded anywhere.
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
  modelCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7EAF0',
  },
  modelHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  modelName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  modelNote: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  modelReady: { fontSize: 16, marginLeft: 8 },
  modelDownloading: { fontSize: 14, fontWeight: '600', color: '#4F46E5', marginTop: 10 },
  modelActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 10 },
  modelUse: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  modelDelete: { fontSize: 14, fontWeight: '700', color: '#E11D48' },
  modelDownloadButton: {
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  modelDownloadText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
  },
  backupName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  backupMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  backupRestore: { fontSize: 14, fontWeight: '700', color: '#4F46E5', marginLeft: 12 },
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
