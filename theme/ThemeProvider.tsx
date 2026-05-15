import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, Tokens, makeTokens } from './tokens';

type Preference = 'system' | 'light' | 'dark';
const PREF_KEY = '@fleetms-driver/theme-pref';

type Ctx = {
  T: Tokens;
  resolvedTheme: ThemeMode;
  preference: Preference;
  setPreference: (p: Preference) => void;
};

const ThemeCtx = createContext<Ctx>({
  T: makeTokens('light'),
  resolvedTheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<Preference>('system');

  useEffect(() => {
    (async () => {
      try {
        const pref = await AsyncStorage.getItem(PREF_KEY);
        if (pref === 'light' || pref === 'dark' || pref === 'system') setPreferenceState(pref);
      } catch {
        // first launch
      }
    })();
  }, []);

  const setPreference = useCallback((p: Preference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
  }, []);

  const resolvedTheme: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const T = useMemo(() => makeTokens(resolvedTheme), [resolvedTheme]);

  return (
    <ThemeCtx.Provider value={{ T, resolvedTheme, preference, setPreference }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTokens(): Tokens {
  return useContext(ThemeCtx).T;
}
export function useThemeControls() {
  const { resolvedTheme, preference, setPreference } = useContext(ThemeCtx);
  return { resolvedTheme, preference, setPreference };
}

export function _debugForceScheme(s: 'light' | 'dark' | null) {
  Appearance.setColorScheme(s);
}
