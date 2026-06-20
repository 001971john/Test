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

  const renderItem = ({ item }: { item: ScannedDocument }) => {
    const thumbnail = item.pages[0]?.processedImageUri;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('OCRResult', { documentId: item.id })}
        onLongPress={() => handleDelete(item)}>
        <View style={styles.cardContent}>
          {thumbnail ? (
            <Image source={{ uri: `file://${thumbnail}` }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.placeholderThumb]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardType}>{item.type.replace(/_/g, ' ').toUpperCase()}</Text>
            <Text style={styles.cardDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.cardPages}>{item.pages.length} page(s)</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📄</Text>
      <Text style={styles.emptyTitle}>No Documents Yet</Text>
      <Text style={styles.emptySubtitle}>Tap the Scan tab to capture your first document</Text>
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
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  list: { padding: 16 },
  emptyList: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: { flexDirection: 'row', padding: 12 },
  thumbnail: {
    width: 70,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 10, color: '#8E8E93' },
  cardInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#000000', marginBottom: 4 },
  cardType: { fontSize: 12, color: '#007AFF', fontWeight: '500', marginBottom: 2 },
  cardDate: { fontSize: 13, color: '#8E8E93', marginBottom: 2 },
  cardPages: { fontSize: 13, color: '#8E8E93' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#8E8E93', textAlign: 'center' },
});
