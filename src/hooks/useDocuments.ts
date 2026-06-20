import { useState, useEffect, useCallback } from 'react';
import { ScannedDocument } from '../types';
import { StorageService } from '../services/StorageService';

export const useDocuments = () => {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await StorageService.getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const updateDocument = useCallback(async (doc: ScannedDocument) => {
    await StorageService.saveDocument(doc);
    setDocuments(prev => {
      const index = prev.findIndex(d => d.id === doc.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = doc;
        return updated;
      }
      return [doc, ...prev];
    });
  }, []);

  const removeDocument = useCallback(async (id: string) => {
    await StorageService.deleteDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  return {
    documents,
    loading,
    loadDocuments,
    updateDocument,
    removeDocument,
  };
};
