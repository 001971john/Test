import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LockService } from '../services/LockService';

export const SettingsScreen = () => {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    LockService.isLockEnabled().then(setLockEnabled);
  }, []);

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
