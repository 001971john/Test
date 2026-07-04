import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  NativeModules,
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList, ScannedDocument, FilterType } from '../types';
import { StorageService } from '../services/StorageService';

type ScreenRouteProp = RouteProp<RootStackParamList, 'ImageEditor'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTERS: { label: string; value: FilterType; icon: string }[] = [
  { label: 'Original', value: 'color', icon: '🎨' },
  { label: 'Enhance', value: 'enhanced', icon: '✨' },
  { label: 'Grayscale', value: 'grayscale', icon: '🌑' },
  { label: 'B&W', value: 'bw', icon: '⬛' },
];

const NATIVE_MODE: Record<string, string> = {
  enhanced: 'enhance',
  grayscale: 'grayscale',
  bw: 'bw',
};

export const ImageEditorScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation();
  const { documentId, pageId } = route.params;
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('color');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [imageKey, setImageKey] = useState(0);

  useEffect(() => {
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDocument = async () => {
    const docs = await StorageService.getAllDocuments();
    const doc = docs.find(d => d.id === documentId);
    if (doc) {
      setDocument(doc);
      const page = doc.pages.find(p => p.id === pageId);
      if (page) {
        setSelectedFilter(page.filter);
      }
    }
    setLoading(false);
  };

  const applyFilter = async (filter: FilterType) => {
    if (!document || applying) return;
    const page = document.pages.find(p => p.id === pageId);
    if (!page) return;

    setApplying(true);
    try {
      let newProcessedUri = page.originalImageUri;

      if (filter !== 'color') {
        const dir = await StorageService.ensureDir();
        newProcessedUri = `${dir}/${document.id}_${pageId}_${filter}.jpg`;
        await NativeModules.ImageEnhance.enhance(
          page.originalImageUri,
          NATIVE_MODE[filter],
          newProcessedUri,
        );
      }

      // Remove the previous filtered file if it's now unused.
      if (
        page.processedImageUri !== page.originalImageUri &&
        page.processedImageUri !== newProcessedUri
      ) {
        try {
          await ReactNativeBlobUtil.fs.unlink(page.processedImageUri);
        } catch {}
      }

      const updatedPages = document.pages.map(p =>
        p.id === pageId ? { ...p, filter, processedImageUri: newProcessedUri } : p,
      );
      const updatedDoc: ScannedDocument = {
        ...document,
        pages: updatedPages,
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveDocument(updatedDoc);
      setDocument(updatedDoc);
      setSelectedFilter(filter);
      setImageKey(k => k + 1); // force the Image to reload the new file
    } catch (error: any) {
      Alert.alert('Filter Error', error?.message ?? 'Could not apply the filter.');
    } finally {
      setApplying(false);
    }
  };

  if (loading || !document) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const page = document.pages.find(p => p.id === pageId);
  if (!page) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Page not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.imageContainer}>
        <Image
          key={imageKey}
          source={{ uri: `file://${page.processedImageUri}?v=${imageKey}` }}
          style={styles.image}
          resizeMode="contain"
        />
        {applying && (
          <View style={styles.applyingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.applyingText}>Applying filter…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <Text style={styles.controlsTitle}>Filters</Text>
        <View style={styles.filterRow}>
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                selectedFilter === filter.value && styles.filterButtonActive,
              ]}
              disabled={applying}
              onPress={() => applyFilter(filter.value)}>
              <Text style={styles.filterIcon}>{filter.icon}</Text>
              <Text
                style={[
                  styles.filterLabel,
                  selectedFilter === filter.value && styles.filterLabelActive,
                ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  image: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH * 1.3,
    borderRadius: 8,
  },
  applyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  applyingText: { color: '#FFFFFF', marginTop: 12, fontSize: 15, fontWeight: '600' },
  controls: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  controlsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  filterButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 78,
  },
  filterButtonActive: {
    backgroundColor: '#4F46E5',
  },
  filterIcon: { fontSize: 26, marginBottom: 4 },
  filterLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  filterLabelActive: { color: '#FFFFFF', fontWeight: '600' },
  doneButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
