import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Persists the session bearer token issued by the API. Mirrors the storage
// strategy in userId.ts: SecureStore on native, localStorage on web.
const KEY = 'goodpint_auth_token';

let cached: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cached) return cached;

  if (Platform.OS === 'web') {
    cached = localStorage.getItem(KEY);
    return cached;
  }

  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
