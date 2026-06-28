import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'goodpint_user_id';

let cached: string | null = null;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getUserId(): Promise<string> {
  if (cached) return cached;

  if (Platform.OS === 'web') {
    const existing = localStorage.getItem(KEY);
    if (existing) { cached = existing; return existing; }
    const id = generateId();
    localStorage.setItem(KEY, id);
    cached = id;
    return id;
  }

  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) { cached = existing; return existing; }
  const id = generateId();
  await SecureStore.setItemAsync(KEY, id);
  cached = id;
  return id;
}
