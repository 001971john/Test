import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Share from 'react-native-share';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDocuments } from '../hooks/useDocuments';
import { ScannedDocument, RootStackParamList, DocumentType } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 14;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP) / 2;

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  general: { label: 'Document', icon: '📄', color: '#4F46E5' },
  id_card: { label: 'ID Card', icon: '🪪', color: '#0891B2' },
  passport: { label: 'Passport', icon: '🛂', color: '#7C3AED' },
  drivers_license: { label: 'License', icon: '🚗', color: '#D97706' },
};

type ChipFilter = 'all' | DocumentType;

const CHIPS: { key: ChipFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'general', label: '📄 Docs' },
  { key: 'id_card', label: '🪪 IDs' },
  { key: 'passport', label: '🛂 Passports' },
  { key: 'drivers_license', label: '🚗 Licenses' },
];

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { documents, loading, loadDocuments, removeDocument } = useDocuments();
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ChipFilter>('all');

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments]),
  );

  const query = search.trim().toLowerCase();
  const filteredDocuments = documents.filter(doc => {
    if (chip !== 'all' && doc.type !== chip) return false;
    if (!query) return true;
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.pages.some(p => p.ocrText?.toLowerCase().includes(query))
    );
  });

  const idCount = documents.filter(d => d.type !== 'general').length;

  const handleShare = async (doc: ScannedDocument) => {
    const urls = doc.pages.map(p => `file://${p.processedImageUri}`);
    if (urls.length === 0) {
      Alert.alert('Nothing to Share', 'This document has no pages.');
      return;
    }
    try {
      await Share.open({ urls });
    } catch {
      // user dismissed the share sheet
    }
  };

  const handleDelete = (doc: ScannedDocument) => {
    Alert.alert('Delete Document', `Delete "${doc.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeDocument(doc.id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: ScannedDocument }) => {
    const thumbnail = item.pages[0]?.processedImageUri;
    const meta = TYPE_META[item.type] ?? TYPE_META.general;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('OCRResult', { documentId: item.id })}
        onLongPress={() => handleDelete(item)}>
        <View style={styles.thumbWrap}>
          {thumbnail ? (
            <Image source={{ uri: `file://${thumbnail}` }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.placeholderThumb]}>
              <Text style={styles.placeholderIcon}>{meta.icon}</Text>
            </View>
          )}
          <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
            <Text style={styles.typeBadgeText}>
              {meta.icon} {meta.label}
            </Text>
          </View>
          {item.pages.length > 1 && (
            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>{item.pages.length}p</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => handleShare(item)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                <Text style={styles.actionIcon}>📤</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                <Text style={styles.actionIcon}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIcon}>📄</Text>
      </View>
      <Text style={styles.emptyTitle}>No Documents Yet</Text>
      <Text style={styles.emptySubtitle}>
        Scan IDs, passports and papers — extract their text automatically and export to PDF or
        Word.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Scanner' as never)}>
        <Text style={styles.emptyButtonText}>📷  Scan Your First Document</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No Matches</Text>
      <Text style={styles.emptySubtitle}>
        Nothing here matches your search or filter. Try something else.
      </Text>
    </View>
  );

  const filtering = query.length > 0 || chip !== 'all';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>DocScanner</Text>
            <Text style={styles.brandSub}>
              {documents.length === 0
                ? 'Your private, offline document scanner'
                : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'}${
                    idCount > 0 ? ` · ${idCount} ID${idCount === 1 ? '' : 's'}` : ''
                  }`}
            </Text>
          </View>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>📑</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Search titles and scanned text…"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearch('')}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {documents.length > 0 && (
        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {CHIPS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, chip === c.key && styles.chipActive]}
                onPress={() => setChip(c.key)}>
                <Text style={[styles.chipText, chip === c.key && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredDocuments}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={filteredDocuments.length > 0 ? styles.gridRow : undefined}
        ListEmptyComponent={filtering ? renderNoResults : renderEmpty}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDocuments} />}
        contentContainerStyle={filteredDocuments.length === 0 ? styles.emptyList : styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7' },
  header: {
    backgroundColor: '#3730A3',
    paddingTop: 54,
    paddingBottom: 34,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 3,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brandMarkText: { fontSize: 22 },
  searchWrap: {
    marginTop: -22,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#111827',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  searchClear: {
    position: 'absolute',
    right: 32,
    top: 14,
  },
  searchClearText: { fontSize: 15, color: '#9CA3AF' },
  chipsWrap: { marginTop: 14 },
  chipsRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EAF0',
  },
  chipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#FFFFFF' },
  list: { padding: 16, paddingTop: 14, paddingBottom: 96 },
  emptyList: { flexGrow: 1 },
  gridRow: { gap: GRID_GAP },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: GRID_GAP,
    overflow: 'hidden',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },
  thumbWrap: { position: 'relative' },
  thumbnail: {
    width: '100%',
    height: CARD_WIDTH * 1.18,
    backgroundColor: '#E7EAF0',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: { fontSize: 44 },
  typeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  pageBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(17,24,39,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pageBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: '#111827' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  cardDate: { fontSize: 12, color: '#6B7280' },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionIcon: { fontSize: 15 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 30,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E3E7FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 10 },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
  },
  emptyButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
