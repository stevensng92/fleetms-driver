import React from 'react';
import { View, Text, Linking, Alert } from 'react-native';
import { Button } from './Button';
import { GoFill } from './GoFill';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../theme/tokens';

// Build navigation deeplinks for a stop. When we have coords we use them
// (most accurate); falling back to the place text means the user lands at a
// search result, which is still useful when seed data has no coords.
function buildWazeUrl(place: string, lat?: number, lng?: number): string {
  if (lat != null && lng != null) {
    return `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://www.waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`;
}
function buildMapsUrl(place: string, lat?: number, lng?: number): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

async function openUrl(url: string) {
  try { await Linking.openURL(url); }
  catch { Alert.alert('Could not open', `No app available to handle:\n${url}`); }
}

export type Stop = {
  /** The name the driver reads: "Pickup", "Stop 1", "Drop-off" (see lib/route.ts stopLabel). */
  kind: string;
  /** The stop's time, already formatted. Null or missing: no time shows. */
  arrive?: string | null;
  /** Not drawn any more (the time now stands alone beside the name). Kept so data/mock.ts still type-checks. */
  arriveLabel?: string;
  place: string;
  depart?: string | null;
  /** Optional coords for accurate nav. When absent, Waze/Maps fall back to
   *  searching `place` as a text query. */
  lat?: number | null;
  lng?: number | null;
};

type State = 'upcoming' | 'current' | 'done';
/** Which pin a stop wears: the ink ring (first), the green pin (last), or a grey square between. */
export type PinKind = 'from' | 'via' | 'to';

/** The pin for stop `i` of `n`: ring first, green pin last, grey square between. */
export function pinFor(i: number, n: number): PinKind {
  return i === 0 ? 'from' : i === n - 1 ? 'to' : 'via';
}

/** The 12px pin the route lines use. Ring for the start, green gradient for the end, grey square between. */
function Pin({ kind }: { kind: PinKind }) {
  const T = useTokens();
  if (kind === 'to') {
    return (
      <View style={{ width: 12, height: 12, borderRadius: 6, overflow: 'hidden' }}>
        <GoFill radius={6}/>
      </View>
    );
  }
  if (kind === 'via') {
    return <View style={{ width: 10, height: 10, margin: 1, borderRadius: 3, backgroundColor: T.text3 }}/>;
  }
  return <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: T.surface, borderWidth: 2, borderColor: T.ink }}/>;
}

export function TimelineStop({ stop, isLast, state = 'upcoming', pin }: {
  stop: Stop; isLast: boolean; state?: State;
  /** Defaults to 'to' for the last stop and 'from' otherwise. */
  pin?: PinKind;
}) {
  const T = useTokens();
  const done = state === 'done';
  const current = state === 'current';
  const pinKind: PinKind = pin ?? (isLast ? 'to' : 'from');
  const labelColor = done ? T.text3 : T.text;
  const strong = { fontFamily: fontFor('600'), fontWeight: '600' } as const;

  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'stretch' }}>
      {/* rail */}
      <View style={{ alignItems: 'center', paddingTop: 4, width: 18 }}>
        {done ? (
          <View style={{
            width: 18, height: 18, borderRadius: 9, backgroundColor: T.go,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="check" size={12} stroke={3} color={T.onGo}/>
          </View>
        ) : (
          <View style={{ height: 18, justifyContent: 'center' }}><Pin kind={pinKind}/></View>
        )}
        {!isLast && (
          <View style={{
            width: 2, flex: 1, minHeight: 40,
            backgroundColor: done ? T.go : T.hairlineStrong, marginTop: 4,
          }}/>
        )}
      </View>

      {/* content */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : space[5] }}>
        <View style={{
          paddingHorizontal: current ? space[3] : 0, paddingVertical: current ? space[2] : 0,
          borderRadius: 12,
          backgroundColor: current ? T.surfaceSunk : 'transparent',
          marginLeft: current ? -space[3] : 0,
          gap: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <Text style={[type.label, strong, { color: done ? T.text3 : T.text2 }]}>{stop.kind}</Text>
            {!!stop.arrive && (
              <Text style={[
                type.body, strong, TABULAR,
                { color: labelColor, textDecorationLine: done ? 'line-through' : 'none' },
              ]}>
                {stop.arrive}
              </Text>
            )}
          </View>

          <Text style={[
            type.title,
            { color: labelColor, textDecorationLine: done ? 'line-through' : 'none' },
          ]}>{stop.place}</Text>

          {(stop.depart === null || !!stop.depart) && (
            <Text style={[
              type.label, TABULAR,
              { color: done ? T.text3 : T.text2, fontStyle: stop.depart === null ? 'italic' : 'normal' },
            ]}>
              {stop.depart === null ? 'Depart on arrival' : `Depart: ${stop.depart}`}
            </Text>
          )}

          {!done && (
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
              <Button
                variant="secondary" icon="navigation"
                onPress={() => openUrl(buildWazeUrl(stop.place, stop.lat ?? undefined, stop.lng ?? undefined))}
              >
                Waze
              </Button>
              <Button
                variant="secondary"
                onPress={() => openUrl(buildMapsUrl(stop.place, stop.lat ?? undefined, stop.lng ?? undefined))}
              >
                Maps
              </Button>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
