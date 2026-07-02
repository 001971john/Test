import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, DocumentType } from '../types';
import { ScannerService } from '../services/ScannerService';
import { OCRService } from '../services/OCRService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DOC_TYPES: { label: string; value: DocumentType }[] = [
  { label: 'General', value: 'general' },
  { label: 'ID Card', value: 'id_card' },
  { label: 'Passport', value: 'passport' },
  { label: "Driver's License", value: 'drivers_license' },
];

export const ScannerScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<React.ComponentRef<typeof Camera>>(null);
  const [selectedType, setSelectedType] = useState<DocumentType>('general');
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async () => {
    try {
      setScanning(true);
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 10,
      });

      if (result.scannedImages && result.scannedImages.length > 0) {
        const doc = ScannerService.createNewDocument(selectedType);
        let currentDoc = doc;

        for (const imageUri of result.scannedImages) {
          const { document } = await ScannerService.addPageToDocument(currentDoc, imageUri);
          currentDoc = document;
        }

        const processedDoc = await OCRService.processAllPages(currentDoc);
        navigation.navigate('OCRResult', { documentId: processedDoc.id });
      }
    } catch (error: any) {
      if (!error?.message?.includes('cancel')) {
        Alert.alert('Scan Error', 'Failed to scan document. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  }, [selectedType, navigation]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          DocScanner needs camera access to scan your documents.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>DocScanner</Text>
        </View>

        <View style={styles.typeSelector}>
          {DOC_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                selectedType === type.value && styles.typeButtonActive,
              ]}
              onPress={() => setSelectedType(type.value)}>
              <Text
                style={[
                  styles.typeButtonText,
                  selectedType === type.value && styles.typeButtonTextActive,
                ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomBar}>
          {scanning ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <TouchableOpacity style={styles.captureButton} onPress={handleScan}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          )}
          <Text style={styles.captureHint}>Tap to scan document</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 50,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  captureHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 40,
  },
  permissionIcon: { fontSize: 64, marginBottom: 20 },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
