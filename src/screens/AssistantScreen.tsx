import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ScannedDocument } from '../types';
import { StorageService } from '../services/StorageService';
import { ExportService } from '../services/ExportService';
import {
  LocalAIService,
  LocalAIError,
  AssistantAction,
  ChatTurn,
} from '../services/LocalAIService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Bubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const WELCOME =
  'Hi! I\'m your offline assistant — I run entirely on your phone. Ask me about your scanned documents ("what documents do I have?", "τι έγγραφα έχω;") or tell me to do something ("export my ID card to PDF", "delete the water bill").';

let bubbleCounter = 0;
const nextBubbleId = () => `b${Date.now().toString(36)}-${bubbleCounter++}`;

export const AssistantScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const documentsRef = useRef<ScannedDocument[]>([]);
  const listRef = useRef<FlatList<Bubble>>(null);

  useFocusEffect(
    useCallback(() => {
      LocalAIService.isModelDownloaded().then(setModelReady);
      StorageService.getAllDocuments().then(docs => {
        documentsRef.current = docs;
      });
    }, []),
  );

  const buildDocsContext = (): string => {
    const docs = documentsRef.current;
    if (docs.length === 0) return 'The user has no scanned documents yet.';
    return docs
      .slice(0, 20)
      .map(d => {
        const excerpt = d.pages
          .map(p => p.ocrText)
          .join(' ')
          .replace(/\s+/g, ' ')
          .slice(0, 300);
        return `- Title: "${d.title}" | Type: ${d.type} | Date: ${new Date(
          d.createdAt,
        ).toLocaleDateString()} | Pages: ${d.pages.length}${excerpt ? ` | Content: ${excerpt}` : ''}`;
      })
      .join('\n');
  };

  const findDocument = (title: string): ScannedDocument | undefined => {
    const docs = documentsRef.current;
    const lower = title.toLowerCase();
    return (
      docs.find(d => d.title.toLowerCase() === lower) ??
      docs.find(d => d.title.toLowerCase().includes(lower) || lower.includes(d.title.toLowerCase()))
    );
  };

  const pushBubble = (role: Bubble['role'], text: string) => {
    setBubbles(prev => [...prev, { id: nextBubbleId(), role, text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const runAction = async (action: AssistantAction) => {
    const doc = findDocument(action.documentTitle);
    if (!doc) {
      pushBubble('assistant', `I couldn't find a document called "${action.documentTitle}".`);
      return;
    }
    switch (action.type) {
      case 'open_document':
        navigation.navigate('OCRResult', { documentId: doc.id });
        break;
      case 'export_pdf': {
        pushBubble('assistant', `Creating the PDF for "${doc.title}"…`);
        const result = await ExportService.exportToPDF(doc);
        pushBubble(
          'assistant',
          result.savedToDownloads
            ? `Done! Saved to ${result.downloadsPath} — check your Files app.`
            : 'Done! The PDF is saved in the app. Open the document and use Share to send it anywhere.',
        );
        break;
      }
      case 'export_docx': {
        pushBubble('assistant', `Creating the Word document for "${doc.title}"…`);
        const result = await ExportService.exportToDOCX(doc);
        pushBubble(
          'assistant',
          result.savedToDownloads
            ? `Done! Saved to ${result.downloadsPath} — check your Files app.`
            : 'Done! The Word file is saved in the app. Open the document and use Share to send it anywhere.',
        );
        break;
      }
      case 'delete_document':
        Alert.alert('Delete Document', `The assistant wants to delete "${doc.title}". Are you sure?`, [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => pushBubble('assistant', 'Okay, I did not delete anything.'),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await StorageService.deleteDocument(doc.id);
              documentsRef.current = documentsRef.current.filter(d => d.id !== doc.id);
              pushBubble('assistant', `"${doc.title}" has been deleted.`);
            },
          },
        ]);
        break;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    pushBubble('user', text);

    if (!modelReady) {
      pushBubble(
        'assistant',
        'I need the AI model to work. Go to Settings → Local AI and download it once (1.1 GB, Wi-Fi recommended). After that I work fully offline!',
      );
      return;
    }

    setThinking(true);
    try {
      const history: ChatTurn[] = [...bubbles, { id: 'x', role: 'user' as const, text }]
        .filter(b => b.id !== 'welcome')
        .map(b => ({ role: b.role, content: b.text }));
      const response = await LocalAIService.chat(history, buildDocsContext());
      pushBubble('assistant', response.reply);
      if (response.action) {
        await runAction(response.action);
      }
    } catch (error: any) {
      const message =
        error instanceof LocalAIError && error.code === 'MODEL_LOAD_FAILED'
          ? 'Not enough free memory to run the AI right now — close some apps and try again.'
          : 'Sorry, something went wrong. Please try again.';
      pushBubble('assistant', message);
    } finally {
      setThinking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={bubbles}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}>
            <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
              {item.text}
            </Text>
          </View>
        )}
        ListFooterComponent={
          thinking ? (
            <View style={[styles.bubble, styles.assistantBubble, styles.thinkingRow]}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.thinkingText}>  Thinking on your phone…</Text>
            </View>
          ) : null
        }
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask or tell me to do something…"
          placeholderTextColor="#9CA3AF"
          multiline
          editable={!thinking}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || thinking) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || thinking}>
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7' },
  list: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  assistantText: { color: '#111827', fontSize: 15, lineHeight: 21 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center' },
  thinkingText: { color: '#6B7280', fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E7EAF0',
  },
  input: {
    flex: 1,
    backgroundColor: '#EEF1F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 110,
  },
  sendButton: {
    marginLeft: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#C7CBD4' },
  sendButtonText: { color: '#FFFFFF', fontSize: 18 },
});
