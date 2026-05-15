import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

export type Stop = {
  kind: string;
  arriveLabel: string;
  arrive: string;
  place: string;
  depart?: string | null;
};

type State = 'upcoming' | 'current' | 'done';

export function TimelineStop({ stop, isLast, state = 'upcoming' }: {
  stop: Stop; isLast: boolean; state?: State;
}) {
  const T = useTokens();
  const done = state === 'done';
  const current = state === 'current';
  const dotColor = done ? T.green : current ? T.accent : T.text;
  const labelColor = done ? T.mutedLight : T.text;

  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'stretch' }}>
      {/* rail */}
      <View style={{ alignItems: 'center', paddingTop: 6, width: 22 }}>
        <View style={{
          width: done ? 22 : 18, height: done ? 22 : 18, borderRadius: 99,
          backgroundColor: done ? T.green : current ? T.accent : T.surface,
          borderWidth: done ? 0 : 2.5,
          borderColor: dotColor,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: current ? T.accent : 'transparent',
          shadowOpacity: current ? 0.4 : 0,
          shadowRadius: current ? 6 : 0,
        }}>
          {done && <Icon name="check" size={12} stroke={3} color="#fff"/>}
        </View>
        {!isLast && (
          <View style={{
            width: 2, flex: 1, minHeight: 60,
            backgroundColor: done ? T.green : T.border, marginVertical: 4,
          }}/>
        )}
      </View>

      {/* content */}
      <View style={{ flex: 1, paddingBottom: isLast ? 4 : 24 }}>
        <View style={{
          paddingHorizontal: 14, paddingVertical: 4,
          borderRadius: 10,
          backgroundColor: current ? T.accentSoft : 'transparent',
          borderLeftWidth: current ? 3 : 0,
          borderLeftColor: current ? T.accent : 'transparent',
          marginLeft: current ? -6 : 0,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700',
            color: done ? T.mutedLight : T.muted,
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2,
          }}>{stop.kind}</Text>

          <Text style={{
            fontFamily: MONO, fontSize: 15, fontWeight: '700',
            color: labelColor, marginBottom: 2,
            textDecorationLine: done ? 'line-through' : 'none',
          }}>
            {stop.arriveLabel}: {stop.arrive}
          </Text>

          <Text style={{
            fontSize: current ? 17 : 16, fontWeight: current ? '700' : '600',
            color: labelColor, letterSpacing: -0.2, marginBottom: 4,
            textDecorationLine: done ? 'line-through' : 'none',
          }}>{stop.place}</Text>

          <Text style={{
            fontSize: 13, color: done ? T.mutedLight : T.muted,
            fontFamily: MONO, marginBottom: 8,
            fontStyle: stop.depart === null ? 'italic' : 'normal',
          }}>
            {stop.depart === null
              ? 'Depart on arrival'
              : stop.depart
                ? `Depart: ${stop.depart}`
                : ''}
          </Text>

          {!done && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <NavBtn icon="waze"  label="Waze" tint="#33CCFF"/>
              <NavBtn icon="maps"  label="Maps" tint={T.confirmDot}/>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function NavBtn({ icon, label, tint }: { icon: 'waze' | 'maps'; label: string; tint: string }) {
  const T = useTokens();
  return (
    <Pressable
      style={{
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 6, backgroundColor: T.surface,
        borderWidth: 1, borderColor: T.border,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}
    >
      <Icon name={icon} size={14} color={tint}/>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.text }}>{label}</Text>
    </Pressable>
  );
}
