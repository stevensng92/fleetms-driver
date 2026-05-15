import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Env vars (set in .env). EXPO_PUBLIC_ prefix exposes them to the client bundle.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Soft-fail at module load so the bundler doesn't crash; the actual screens
  // will surface a clear error.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing. ' +
    'Copy .env.example to .env and fill in the values.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anon ?? 'anon-key-placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabaseConfigured = Boolean(url && anon);
