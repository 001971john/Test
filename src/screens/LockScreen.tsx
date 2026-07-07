import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LockService } from '../services/LockService';

interface Props {
  onUnlock: () => void;
}

export const LockScreen = ({ onUnlock }: Props) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const tryBiometrics = useCallback(async () => {
    const available = await LockService.isBiometricsAvailable();
    setBiometricsAvailable(available);
    if (available) {
      const success = await LockService.promptBiometrics();
      if (success) {
        onUnlock();
      }
    }
  }, [onUnlock]);

  useEffect(() => {
    tryBiometrics();
  }, [tryBiometrics]);

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    const valid = await LockService.verifyPin(pin);
    if (valid) {
      onUnlock();
    } else {
      setError('Wrong PIN. Try again.');
      setPin('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>DocScanner is Locked</Text>
      <Text style={styles.subtitle}>Enter your PIN to continue</Text>

      <TextInput
        style={styles.pinInput}
        value={pin}
        onChangeText={text => {
          setPin(text.replace(/[^0-9]/g, ''));
          setError('');
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={8}
        placeholder="• • • •"
        placeholderTextColor="rgba(255,255,255,0.4)"
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.unlockButton} onPress={handlePinSubmit}>
        <Text style={styles.unlockButtonText}>Unlock</Text>
      </TouchableOpacity>

      {biometricsAvailable && (
        <TouchableOpacity style={styles.biometricButton} onPress={tryBiometrics}>
          <Text style={styles.biometricButtonText}>👆  Use Fingerprint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3730A3',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 32,
  },
  pinInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 8,
    textAlign: 'center',
    width: '80%',
    marginBottom: 12,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 14,
    marginBottom: 8,
  },
  unlockButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    width: '80%',
    marginTop: 12,
  },
  unlockButtonText: {
    color: '#3730A3',
    fontSize: 17,
    fontWeight: '700',
  },
  biometricButton: {
    marginTop: 20,
    padding: 12,
  },
  biometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
