import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  NativeModules,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SignatureView from 'react-native-signature-canvas';
import { RootStackParamList, ScannedDocument } from '../types';
import { StorageService } from '../services/StorageService';

type ScreenRouteProp = RouteProp<RootStackParamList, 'Signature'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_WIDTH = SCREEN_WIDTH - 32;
const MIN_SIG_WIDTH = 60;
const MAX_SIG_WIDTH = CONTAINER_WIDTH;
const SIG_STEP = 24;

export const SignatureScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { documentId, pageId } = route.params;

  const [step, setStep] = useState<'draw' | 'position' | 'saving'>('draw');
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [page, setPage] = useState<ScannedDocument['pages'][number] | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(CONTAINER_WIDTH * 1.3);
  const [sigWidth, setSigWidth] = useState(180);
  const [sigAspect, setSigAspect] = useState(0.4); // height/width fallback

  const pos = useRef({ x: CONTAINER_WIDTH / 2 - 90, y: 100 });
  const [, forceRender] = useState(0);

  useEffect(() => {
    StorageService.getAllDocuments().then(docs => {
      const doc = docs.find(d => d.id === documentId);
      if (doc) {
        setDocument(doc);
        const p = doc.pages.find(pg => pg.id === pageId);
        if (p) {
          setPage(p);
          Image.getSize(
            `file://${p.processedImageUri}`,
            (w, h) => setContainerHeight(CONTAINER_WIDTH * (h / w)),
            () => {},
          );
        }
      }
    });
  }, [documentId, pageId]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_evt, gesture) => {
        pos.current = {
          x: Math.max(0, Math.min(CONTAINER_WIDTH - sigWidth, pos.current.x + gesture.dx)),
          y: Math.max(0, Math.min(containerHeight - sigWidth * sigAspect, pos.current.y + gesture.dy)),
        };
        forceRender(n => n + 1);
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  const handleOK = (signature: string) => {
    setSignatureDataUrl(signature);
    Image.getSize(
      signature,
      (w, h) => setSigAspect(h / w),
      () => {},
    );
    setStep('position');
  };

  const handlePlace = async () => {
    if (!document || !page || !signatureDataUrl) return;
    setStep('saving');
    try {
      const dir = await StorageService.ensureDir();
      const destPath = `${dir}/${document.id}_${page.id}_signed.jpg`;
      const xPct = pos.current.x / CONTAINER_WIDTH;
      const yPct = pos.current.y / containerHeight;
      const widthPct = sigWidth / CONTAINER_WIDTH;

      await NativeModules.ImageEnhance.stampSignature(
        page.processedImageUri,
        signatureDataUrl,
        xPct,
        yPct,
        widthPct,
        destPath,
      );

      const updatedPages = document.pages.map(p =>
        p.id === page.id ? { ...p, processedImageUri: destPath } : p,
      );
      const updatedDoc: ScannedDocument = {
        ...document,
        pages: updatedPages,
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveDocument(updatedDoc);
      navigation.goBack();
    } catch (error: any) {
      setStep('position');
      Alert.alert('Signature Error', error?.message ?? 'Could not place the signature.');
    }
  };

  if (!page) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (step === 'draw') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Draw Your Signature</Text>
        <SignatureView
          onOK={handleOK}
          onEmpty={() => Alert.alert('Empty', 'Please draw your signature first.')}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle=".m-signature-pad--footer {display: flex;} .m-signature-pad {box-shadow: none; border: none;}"
          style={styles.signaturePad}
          backgroundColor="#FFFFFF"
        />
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'saving') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.savingText}>Placing signature…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Position Your Signature</Text>
      <Text style={styles.subtitle}>Drag to move, use the buttons to resize</Text>
      <View style={[styles.pageContainer, { height: containerHeight }]}>
        <Image
          source={{ uri: `file://${page.processedImageUri}` }}
          style={{ width: CONTAINER_WIDTH, height: containerHeight }}
          resizeMode="stretch"
        />
        {signatureDataUrl && (
          <View
            {...panResponder.panHandlers}
            style={{
              position: 'absolute',
              left: pos.current.x,
              top: pos.current.y,
              width: sigWidth,
              height: sigWidth * sigAspect,
            }}>
            <Image
              source={{ uri: signatureDataUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
        )}
      </View>

      <View style={styles.sizeRow}>
        <TouchableOpacity
          style={styles.sizeButton}
          onPress={() => setSigWidth(w => Math.max(MIN_SIG_WIDTH, w - SIG_STEP))}>
          <Text style={styles.sizeButtonText}>− Smaller</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sizeButton}
          onPress={() => setSigWidth(w => Math.min(MAX_SIG_WIDTH, w + SIG_STEP))}>
          <Text style={styles.sizeButtonText}>+ Bigger</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.placeButton} onPress={handlePlace}>
        <Text style={styles.placeButtonText}>✓ Place Signature</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={() => setStep('draw')}>
        <Text style={styles.cancelButtonText}>Redraw Signature</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F7', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF1F7' },
  savingText: { marginTop: 12, color: '#6B7280', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  signaturePad: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  pageContainer: {
    width: CONTAINER_WIDTH,
    backgroundColor: '#E7EAF0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sizeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sizeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  sizeButtonText: { color: '#4F46E5', fontWeight: '700', fontSize: 14 },
  placeButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  placeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 12 },
  cancelButtonText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
});
