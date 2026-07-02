import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import Share from 'react-native-share';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDocuments } from '../hooks/useDocuments';
import { ScannedDocument, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { documents, loading, loadDocuments, removeDocument } = useDocuments();
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const filteredDocuments = query
    ? documents.filter(
        doc =>
          doc.title.toLowerCase().includes(query) ||
          doc.pages.some(p => p.ocrText?.toLowerCase().includes(query)),
      )
    : documents;

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

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments]),
  );

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

  const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
    general: { label: 'Document', icon: '📄', color: '#4F46E5' },
    id_card: { label: 'ID Card', icon: '🪪', color: '#0891B2' },
    passport: { label: 'Passport', icon: '🛂', color: '#7C3AED' },
    drivers_license: { label: "Driver's License", icon: '🚗', color: '#D97706' },
  };

  const renderItem = ({ item }: { item: ScannedDocument }) => {
    const thumbnail = item.pages[0]?.processedImageUri;
    const meta = TYPE_META[item.type] ?? TYPE_META.general;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('OCRResult', { documentId: item.id })}
        onLongPress={() => handleDelete(item)}>
        <View style={styles.cardContent}>
          {thumbnail ? (
            <Image source={{ uri: `file://${thumbnail}` }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.placeholderThumb]}>
              <Text style={styles.placeholderIcon}>{meta.icon}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.typeBadge, { backgroundColor: `${meta.color}18` }]}>
              <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                {meta.icon} {meta.label}
              </Text>
            </View>
            <Text style={styles.cardDate}>
              {new Date(item.createdAt).toLocaleDateString()}  ·  {item.pages.length}{' '}
              {item.pages.length === 1 ? 'page' : 'pages'}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.shareIconButton}
              onPress={() => handleShare(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.actionIcon}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteIconButton}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.actionIcon}>🗑</Text>
            </TouchableOpacity>
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
        Scan IDs, passports and papers — extract their text automatically and export to PDF or Word.
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
        No documents contain "{search.trim()}". Try a different word.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {documents.length > 0 && (
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
      )}
      <FlatList
        data={filteredDocuments}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={query ? renderNoResults : renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadDocuments} />
        }
        contentContainerStyle={filteredDocuments.length === 0 ? styles.emptyList : styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7' },
  list: { padding: 16 },
  emptyList: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardContent: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  thumbnail: {
    width: 68,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#EEF1F7',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: { fontSize: 30 },
  cardInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  cardDate: { fontSize: 13, color: '#6B7280' },
  cardActions: { marginLeft: 8, alignItems: 'center' },
  shareIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    marginBottom: 8,
  },
  deleteIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
  },
  actionIcon: { fontSize: 18 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchClear: {
    position: 'absolute',
    right: 28,
    top: 24,
  },
  searchClearText: { fontSize: 16, color: '#9CA3AF' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
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
