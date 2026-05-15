import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { useTokens } from '../../theme/ThemeProvider';
import { EARNINGS } from '../../data/mock';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';
type Period = 'week' | 'month' | 'all';

export default function Earnings() {
  const T = useTokens();
  const [period, setPeriod] = useState<Period>('month');

  return (
    <AppFrame>
      <AppHeader title="Earnings" subtitle="Continental Limo Services"/>

      {/* Period tabs */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{
          flexDirection: 'row', backgroundColor: T.raised,
          borderRadius: 8, padding: 4,
        }}>
          {(['week', 'month', 'all'] as const).map(p => {
            const sel = p === period;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6,
                  alignItems: 'center',
                  backgroundColor: sel ? T.surface : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: sel ? '700' : '500',
                  color: sel ? T.text : T.muted,
                }}>
                  {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Summary */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, borderWidth: 1, borderColor: T.border }}>
          <Text style={{
            fontSize: 12, color: T.muted, fontWeight: '700',
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}>This month</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 40, fontWeight: '800', color: T.text, letterSpacing: -1.4 }}>RM 1,240</Text>
            <Text style={{ fontSize: 16, color: T.muted, fontWeight: '600' }}>.00</Text>
          </View>
          <View style={{
            flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12,
            borderTopWidth: 1, borderTopColor: T.border,
          }}>
            <Mini label="Jobs" value="18" color={T.text}/>
            <View style={{ width: 1, backgroundColor: T.border }}/>
            <Mini label="Pending" value="3 payouts" color={T.amber}/>
            <View style={{ width: 1, backgroundColor: T.border }}/>
            <Mini label="Avg / job" value="RM 69" color={T.text}/>
          </View>
        </Card>
      </View>

      <SectionLabel>Recent jobs</SectionLabel>
      <Card style={{ marginHorizontal: 16, overflow: 'hidden' }}>
        {EARNINGS.map((e, i) => (
          <View key={e.id} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingHorizontal: 16, paddingVertical: 14,
            borderBottomWidth: i < EARNINGS.length - 1 ? 1 : 0,
            borderBottomColor: T.border,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 14, fontWeight: '700', color: T.text,
                fontFamily: MONO, letterSpacing: 0.2,
              }}>{e.id}</Text>
              <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{e.date}</Text>
            </View>
            <Text style={{
              fontSize: 16, fontWeight: '700', color: T.text,
              letterSpacing: -0.3, minWidth: 80, textAlign: 'right',
            }}>RM {e.amt.toFixed(2)}</Text>
            <StatusPill kind={e.status}/>
          </View>
        ))}
      </Card>
      <View style={{ height: 24 }}/>
    </AppFrame>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  const T = useTokens();
  return (
    <View style={{ flex: 1, paddingLeft: 14 }}>
      <Text style={{
        fontSize: 10.5, color: T.mutedLight, fontWeight: '700',
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
