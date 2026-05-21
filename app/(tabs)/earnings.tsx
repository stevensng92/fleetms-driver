import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { useTokens } from '../../theme/ThemeProvider';
import { useDriverEarnings, type EarningsPeriod, type EarningsRow, type EarningsPaymentStatus } from '../../lib/queries/earnings';
import { useDriverProfile } from '../../lib/queries/driverProfile';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

const PERIOD_LABEL: Record<EarningsPeriod, { tab: string; headline: string }> = {
  week:  { tab: 'This Week',  headline: 'This week' },
  month: { tab: 'This Month', headline: 'This month' },
  all:   { tab: 'All Time',   headline: 'All time' },
};

// Map paymentStatus to a StatusPill kind. Driver-facing rule: a 'paid' job is
// shown as 'done' (green pill); everything else surfaces as 'pending' (amber).
function pillKindFor(status: EarningsPaymentStatus): 'done' | 'pending' | 'voided' {
  if (status === 'paid')    return 'done';
  if (status === 'refunded') return 'voided';
  return 'pending';
}

function formatRM(amount: number): { whole: string; cents: string } {
  const fixed = amount.toFixed(2);
  const [whole, cents] = fixed.split('.');
  // Group thousands with commas
  const grouped = Number(whole).toLocaleString('en-MY');
  return { whole: grouped, cents };
}

function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

export default function Earnings() {
  const T = useTokens();
  const [period, setPeriod] = useState<EarningsPeriod>('month');
  const { data: profile } = useDriverProfile();
  const { data, isLoading, isError, error, refetch, isRefetching } = useDriverEarnings(period);

  const commissionTotal = data?.commissionTotal ?? 0;
  const fareTotal       = data?.fareTotal ?? 0;
  const commissionParts = formatRM(commissionTotal);
  const avgParts        = formatRM(data?.avgCommissionPerJob ?? 0);
  const missing         = data?.missingCommissionCount ?? 0;

  return (
    <AppFrame>
      <AppHeader title="Earnings" subtitle={profile?.org.name ?? ''}/>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={T.muted}/>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
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
                    {PERIOD_LABEL[p].tab}
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
            }}>{PERIOD_LABEL[period].headline}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              {isLoading ? (
                <ActivityIndicator color={T.muted} style={{ marginTop: 12 }}/>
              ) : (
                <>
                  <Text style={{ fontSize: 40, fontWeight: '800', color: T.text, letterSpacing: -1.4 }}>
                    RM {commissionParts.whole}
                  </Text>
                  <Text style={{ fontSize: 16, color: T.muted, fontWeight: '600' }}>.{commissionParts.cents}</Text>
                </>
              )}
            </View>
            {!isLoading && (
              <Text style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
                RM {formatRM(fareTotal).whole} in fares
              </Text>
            )}
            {missing > 0 && (
              <View style={{
                marginTop: 10, paddingHorizontal: 10, paddingVertical: 7,
                borderRadius: 6, backgroundColor: T.amberSoft,
                flexDirection: 'row', gap: 6, alignItems: 'flex-start',
              }}>
                <Text style={{ fontSize: 12, color: T.amberFg, fontWeight: '600' }}>
                  {missing} {missing === 1 ? 'job is' : 'jobs are'} awaiting commission from dispatcher.
                </Text>
              </View>
            )}
            <View style={{
              flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12,
              borderTopWidth: 1, borderTopColor: T.border,
            }}>
              <Mini label="Jobs" value={String(data?.jobsCount ?? 0)} color={T.text}/>
              <View style={{ width: 1, backgroundColor: T.border }}/>
              <Mini
                label="Pending"
                value={
                  (data?.pendingCount ?? 0) === 0
                    ? 'None'
                    : `${data!.pendingCount} ${data!.pendingCount === 1 ? 'job' : 'jobs'}`
                }
                color={(data?.pendingCount ?? 0) > 0 ? T.amber : T.text}
              />
              <View style={{ width: 1, backgroundColor: T.border }}/>
              <Mini label="Avg / job" value={`RM ${avgParts.whole}`} color={T.text}/>
            </View>
          </Card>
        </View>

        <SectionLabel>Recent jobs</SectionLabel>

        {isError && (
          <Card style={{ marginHorizontal: 16, padding: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.red, marginBottom: 4 }}>
              Couldn&apos;t load earnings
            </Text>
            <Text style={{ fontSize: 13, color: T.red, marginBottom: 10 }}>
              {(error as Error)?.message ?? 'Unknown error'}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={{
                alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 6, borderWidth: 1, borderColor: T.red,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.red }}>Retry</Text>
            </Pressable>
          </Card>
        )}

        {!isError && !isLoading && (data?.rows ?? []).length === 0 && (
          <Card style={{ marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center' }}>
              No completed jobs {period === 'all' ? 'yet' : `in ${PERIOD_LABEL[period].headline.toLowerCase()}`}.
            </Text>
          </Card>
        )}

        {!isError && (data?.rows ?? []).length > 0 && (
          <Card style={{ marginHorizontal: 16, overflow: 'hidden' }}>
            {data!.rows.map((row, i) => (
              <EarningsRowItem
                key={row.jobId}
                row={row}
                isLast={i === data!.rows.length - 1}
              />
            ))}
          </Card>
        )}

        <View style={{ height: 8 }}/>
      </ScrollView>
    </AppFrame>
  );
}

function EarningsRowItem({ row, isLast }: { row: EarningsRow; isLast: boolean }) {
  const T = useTokens();
  const commissionLabel = row.commission == null ? '—' : `RM ${row.commission.toFixed(2)}`;
  return (
    <Pressable
      onPress={() => router.push(`/jobs/${row.jobId}` as '/')}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 14, fontWeight: '700', color: T.text,
          fontFamily: MONO, letterSpacing: 0.2,
        }}>{row.jobNumber}</Text>
        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{formatRowDate(row.completedAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 96 }}>
        <Text style={{
          fontSize: 16, fontWeight: '700',
          color: row.commission == null ? T.muted : T.text,
          letterSpacing: -0.3,
        }}>{commissionLabel}</Text>
        <Text style={{ fontSize: 11, color: T.mutedLight, marginTop: 2 }}>
          RM {row.fare.toFixed(2)} fare
        </Text>
      </View>
      <StatusPill kind={pillKindFor(row.paymentStatus)}/>
    </Pressable>
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
