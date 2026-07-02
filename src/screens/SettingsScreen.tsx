import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsScreen = () => {
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
