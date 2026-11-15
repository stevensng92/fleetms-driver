import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { type ClockStyle, parseClockStyle, setClockStyle as applyClockStyle } from '../lib/timeFormat';

// The driver's 12-hour / 24-hour choice, picked on Profile > Appearance.
// Stored on the phone only, like the theme choice beside it.
export const CLOCK_STYLE_KEY = '@fleetms-driver/clock-style';

type Ctx = { clockStyle: ClockStyle; setClockStyle: (s: ClockStyle) => void };

const ClockStyleCtx = createContext<Ctx>({ clockStyle: '24h', setClockStyle: () => {} });

export function ClockStyleProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [clockStyle, setState] = useState<ClockStyle>('24h');

  // Some clock labels are built inside query functions and cached (job cards,
  // notification rows), so a style change also refetches to rebuild them.
  const apply = useCallback((s: ClockStyle) => {
    applyClockStyle(s);
    setState(s);
    qc.invalidateQueries();
  }, [qc]);

  useEffect(() => {
    AsyncStorage.getItem(CLOCK_STYLE_KEY)
      .then(raw => { if (parseClockStyle(raw) === '12h') apply('12h'); })
      .catch(() => {}); // first launch or storage unavailable: stay on 24h
  }, [apply]);

  const setClockStyle = useCallback((s: ClockStyle) => {
    apply(s);
    AsyncStorage.setItem(CLOCK_STYLE_KEY, s).catch(() => {});
  }, [apply]);

  return (
    <ClockStyleCtx.Provider value={{ clockStyle, setClockStyle }}>
      {children}
    </ClockStyleCtx.Provider>
  );
}

/**
 * The current clock style and a setter. Screens that call formatClock directly
 * should read this too, so they re-render when the driver switches.
 */
export function useClockStyle(): Ctx {
  return useContext(ClockStyleCtx);
}
