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
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList, ScannedDocument, FilterType } from '../types';
import { StorageService } from '../services/StorageService';

type ScreenRouteProp = RouteProp<RootStackParamList, 'ImageEditor'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTERS: { label: string; value: FilterType; icon: string }[] = [
  { label: 'Color', value: 'color', icon: '🎨' },
  { label: 'Grayscale', value: 'grayscale', icon: '🌑' },
  { label: 'B&W', value: 'bw', icon: '⬛' },
];

export const ImageEditorScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation();
  const { documentId, pageId } = route.params;
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('color');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocument();
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
    if (!document) return;
    setSelectedFilter(filter);

    const updatedPages = document.pages.map(p =>
      p.id === pageId ? { ...p, filter } : p,
    );

    const updatedDoc: ScannedDocument = {
      ...document,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveDocument(updatedDoc);
    setDocument(updatedDoc);
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
          source={{ uri: `file://${page.processedImageUri}` }}
          style={[
            styles.image,
            selectedFilter === 'grayscale' && { opacity: 0.8 },
          ]}
          resizeMode="contain"
        />
        {selectedFilter !== 'color' && (
          <Text style={styles.filterBadge}>
            Filter: {selectedFilter.toUpperCase()} (preview only — native filters applied on export)
          </Text>
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
  filterBadge: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
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
    width: 90,
  },
  filterButtonActive: {
    backgroundColor: '#4F46E5',
  },
  filterIcon: { fontSize: 28, marginBottom: 4 },
  filterLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
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
