import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClockStyle } from './timeFormat';

// The Time format setting (change 33): 24-hour ("14:30", the default) or
// 12-hour ("2:30 pm"). Kept on the phone like the theme preference
// (theme/ThemeProvider.tsx). It is a small store rather than a React context
// so it can be read and set outside the component tree. Times are formatted
// on screen, never inside a download, so changing it only redraws.

export const CLOCK_KEY = '@fleetms-driver/clock-style';

let current: ClockStyle = '24h';
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export const getClockStyle = (): ClockStyle => current;

export function subscribeClockStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Picks a style now and saves it. If the phone cannot save it, the choice holds for this visit. */
export function setClockStyle(style: ClockStyle): void {
  if (style === current) return;
  current = style;
  AsyncStorage.setItem(CLOCK_KEY, style).catch(() => {});
  notify();
}

/** Reads the saved choice once at start-up. Anything missing or odd leaves 24-hour. */
export async function loadClockStyle(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(CLOCK_KEY);
    if ((saved === '12h' || saved === '24h') && saved !== current) {
      current = saved;
      notify();
    }
  } catch {
    // first launch, or no storage
  }
}

/** The current style; the caller re-renders when it changes. */
export function useClockStyle(): ClockStyle {
  return useSyncExternalStore(subscribeClockStyle, getClockStyle, getClockStyle);
}

export function resetClockStyleForTests(): void {
  current = '24h';
  listeners.clear();
}
