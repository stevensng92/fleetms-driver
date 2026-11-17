import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { TimelineStop, pinFor } from './TimelineStop';
import { useTokens } from '../theme/ThemeProvider';
import { space, type } from '../theme/tokens';
import { routeStops, stopCountLabel, type RawStop } from '../lib/route';
import type { ClockStyle } from '../lib/timeFormat';

/**
 * The Route card the job screen and the Trip screen both show: the heading,
 * the stop count and each stop. It takes the stops as the job query returns
 * them and names and times them itself, so the two screens cannot disagree.
 */
export function RouteCard({ stops, clock = '24h' }: { stops: RawStop[]; clock?: ClockStyle }) {
  const T = useTokens();
  const route = routeStops(stops, clock);
  return (
    <Card style={{ padding: space[5], gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] }}>
        <Text style={[type.title, { color: T.text }]}>Route</Text>
        <Text style={[type.label, { color: T.text2 }]}>{stopCountLabel(route.length)}</Text>
      </View>
      <View>
        {route.map((s, i) => (
          <TimelineStop key={i} stop={s} isLast={i === route.length - 1} pin={pinFor(i, route.length)}/>
        ))}
      </View>
    </Card>
  );
}
