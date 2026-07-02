import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDocuments } from '../hooks/useDocuments';
import { ScannedDocument, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { documents, loading, loadDocuments, removeDocument } = useDocuments();

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
          <TouchableOpacity
            style={styles.deleteIconButton}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
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

  return (
    <View style={styles.container}>
      <FlatList
        data={documents}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadDocuments} />
        }
        contentContainerStyle={documents.length === 0 ? styles.emptyList : styles.list}
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
  deleteIconButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
  },
  deleteIcon: { fontSize: 18 },
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
