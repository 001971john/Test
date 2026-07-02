import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';

const LOCK_ENABLED_KEY = '@docscanner/lock_enabled';
const PIN_KEY = '@docscanner/pin_hash';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

// Simple string hash (djb2). Not cryptographic, but the PIN never leaves the
// device and this avoids pulling in a native crypto dependency.
const hashPin = (pin: string): string => {
  let hash = 5381;
  const salted = `docscanner:${pin}:lock`;
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash + salted.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

const isLockEnabled = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(LOCK_ENABLED_KEY);
  return value === 'true';
};

const setPin = async (pin: string): Promise<void> => {
  await AsyncStorage.setItem(PIN_KEY, hashPin(pin));
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, 'true');
};

const verifyPin = async (pin: string): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  return stored !== null && stored === hashPin(pin);
};

const disableLock = async (): Promise<void> => {
  await AsyncStorage.removeItem(PIN_KEY);
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, 'false');
};

const isBiometricsAvailable = async (): Promise<boolean> => {
  try {
    const { available } = await rnBiometrics.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
};

const promptBiometrics = async (): Promise<boolean> => {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: 'Unlock DocScanner',
      cancelButtonText: 'Use PIN',
    });
    return success;
  } catch {
    return false;
  }
};

export const LockService = {
  isLockEnabled,
  setPin,
  verifyPin,
  disableLock,
  isBiometricsAvailable,
  promptBiometrics,
};
