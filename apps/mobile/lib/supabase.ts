import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const secureStoreChunkSize = 1700;
let storageGeneration = 0;

function splitUtf8(value: string) {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentBytes = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const characterBytes =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;

    if (currentBytes + characterBytes > secureStoreChunkSize) {
      chunks.push(currentChunk);
      currentChunk = '';
      currentBytes = 0;
    }

    currentChunk += character;
    currentBytes += characterBytes;
  }

  if (currentChunk || chunks.length === 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function readSecureStoreHeader(value: string | null) {
  if (!value) return null;

  try {
    const header = JSON.parse(value) as {
      generation?: unknown;
      count?: unknown;
    };
    if (
      typeof header.generation === 'string' &&
      Number.isInteger(header.count) &&
      Number(header.count) > 0 &&
      Number(header.count) <= 512
    ) {
      return { generation: header.generation, count: Number(header.count) };
    }
  } catch {
    return null;
  }

  return null;
}

const nativeAuthStorage = {
  async getItem(key: string) {
    const header = readSecureStoreHeader(
      await SecureStore.getItemAsync(`${key}.head`),
    );
    if (!header) return null;

    const chunks = await Promise.all(
      Array.from({ length: header.count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${header.generation}.${index}`),
      ),
    );

    return chunks.every((chunk): chunk is string => chunk !== null)
      ? chunks.join('')
      : null;
  },
  async setItem(key: string, value: string) {
    const headerKey = `${key}.head`;
    const previousHeader = readSecureStoreHeader(
      await SecureStore.getItemAsync(headerKey),
    );
    const generation = `${Date.now().toString(36)}-${storageGeneration++}`;
    const chunks = splitUtf8(value);

    try {
      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(`${key}.${generation}.${index}`, chunk),
        ),
      );
      await SecureStore.setItemAsync(
        headerKey,
        JSON.stringify({ generation, count: chunks.length }),
      );
    } catch (error) {
      await Promise.all(
        chunks.map((_, index) =>
          SecureStore.deleteItemAsync(`${key}.${generation}.${index}`).catch(
            () => undefined,
          ),
        ),
      );
      throw error;
    }

    if (previousHeader) {
      await Promise.all(
        Array.from({ length: previousHeader.count }, (_, index) =>
          SecureStore.deleteItemAsync(
            `${key}.${previousHeader.generation}.${index}`,
          ).catch(() => undefined),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const headerKey = `${key}.head`;
    const header = readSecureStoreHeader(
      await SecureStore.getItemAsync(headerKey),
    );
    await SecureStore.deleteItemAsync(headerKey);

    if (header) {
      await Promise.all(
        Array.from({ length: header.count }, (_, index) =>
          SecureStore.deleteItemAsync(
            `${key}.${header.generation}.${index}`,
          ).catch(() => undefined),
        ),
      );
    }
  },
};

const browserAuthStorage = {
  async getItem(key: string) {
    return typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const authStorage =
  Platform.OS === 'web' ? browserAuthStorage : nativeAuthStorage;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
