import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { CommissionPill } from '../../components/CommissionPill';
import { useTokens } from '../../theme/ThemeProvider';
import {
  useDriverEarnings, useEarningsMonths, ROW_LIMIT,
  type EarningsRow, type EarningsPaymentStatus,
} from '../../lib/queries/earnings';
import { monthPeriod, monthKeyOf, type EarningsPeriod } from '../../lib/earningsPeriod';
import { useDriverProfile } from '../../lib/queries/driverProfile';
import { formatDate, formatMonthKey, formatMonthKeyChip } from '../../lib/timeFormat';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

/** Chip label — what the driver taps. */
function periodTab(p: EarningsPeriod): string {
  if (p === 'week')  return 'This Week';
  if (p === 'month') return 'This Month';
  if (p === 'all')   return 'All Time';
  return formatMonthKeyChip(monthKeyOf(p)!);
}

/** Card heading — the period named in full, since there's room for it here. */
function periodHeadline(p: EarningsPeriod): string {
  if (p === 'week')  return 'This week';
  if (p === 'month') return 'This month';
  if (p === 'all')   return 'All time';
  return formatMonthKey(monthKeyOf(p)!, { long: true });
}

/**
 * "No completed jobs in July 2026" — built as one sentence rather than by
 * lowercasing the headline, which turned month names into "july 2026".
 */
function emptyStateText(p: EarningsPeriod): string {
  if (p === 'all')   return 'No completed jobs yet.';
  if (p === 'week')  return 'No completed jobs this week.';
  if (p === 'month') return 'No completed jobs this month.';
  return `No completed jobs in ${periodHeadline(p)}.`;
}

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

// Uses the shared pinned-timezone helper rather than toLocaleDateString: the
// row's date has to agree with every clock elsewhere in the app, and the old
// call also built a fresh Intl formatter per row on a list of up to 200.
const formatRowDate = formatDate;

export default function Earnings() {
  const T = useTokens();
  const [period, setPeriod] = useState<EarningsPeriod>('month');
  const { data: profile } = useDriverProfile();
  const { data, isLoading, isError, error, refetch, isRefetching } = useDriverEarnings(period);
  const { data: pastMonths } = useEarningsMonths();

  // This Week / This Month first (the everyday questions), then each past month
  // newest-first, then All Time as the backstop. A month strip that failed to
  // load simply doesn't render its chips — the three fixed periods still work,
  // which matters because this list is a nicety and they are the screen.
  const periods: EarningsPeriod[] = [
    'week',
    'month',
    ...(pastMonths ?? []).map(monthPeriod),
    'all',
  ];

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
        {/* Period selector.
            Was three equal-width tabs; a driver with a year of history needs
            fifteen options, so it scrolls horizontally with content-width chips
            instead of dividing a phone's width N ways. The selected-chip
            treatment (raised track, surface-coloured active chip) is unchanged,
            so the control still reads as the same thing it was. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // The track is the scrolling element, so its padding lives on the
          // content container — putting it on the ScrollView itself clips the
          // first and last chips instead of insetting them.
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 0 }}
        >
          <View style={{
            flexDirection: 'row', backgroundColor: T.raised,
            borderRadius: 8, padding: 4, gap: 2,
          }}>
            {periods.map(p => {
              const sel = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  // Named in full for screen readers — "Jul" alone doesn't say
                  // it's a period, or which year.
                  accessibilityLabel={periodHeadline(p)}
                  style={{
                    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6,
                    alignItems: 'center', minWidth: 64,
                    backgroundColor: sel ? T.surface : 'transparent',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13, fontWeight: sel ? '700' : '500',
                      color: sel ? T.text : T.muted,
                    }}
                  >
                    {periodTab(p)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Summary */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Card style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, borderWidth: 1, borderColor: T.border }}>
            <Text style={{
              fontSize: 12, color: T.muted, fontWeight: '700',
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>{periodHeadline(period)}</Text>
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
            {/* The totals above cover only the rows we fetched. Say so rather
                than showing a number that silently understates — this screen is
                what a driver uses to check they were paid correctly. */}
            {data?.truncated && (
              <View style={{
                marginTop: 10, paddingHorizontal: 10, paddingVertical: 7,
                borderRadius: 6, backgroundColor: T.raised,
              }}>
                {/* One interpolated string, not mixed JSX children — split
                    children render as separate text nodes, which breaks both
                    text matching in tests and screen-reader continuity. */}
                <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>
                  {`Showing your ${ROW_LIMIT} most recent jobs${
                    data.totalCount != null && data.totalCount > ROW_LIMIT
                      ? ` of ${data.totalCount}`
                      : ''
                  }. Older jobs aren't counted in these totals.`}
                </Text>
              </View>
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
              {emptyStateText(period)}
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
      // Typed params, not an interpolated path. `job_number` is rendered from
      // the org-editable `organizations.job_format` template, so a format
      // carrying "/" or "?" would break a hand-built path — and the `as '/'`
      // cast the old form needed is exactly what let the uuid-vs-job_number bug
      // compile clean in the first place.
      onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: row.jobNumber } })}
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
        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{formatRowDate(row.jobDate)}</Text>
        {/* Only the handful of jobs that paid a non-standard rate get this —
            it's the answer to "why is my cut different on this one?". On a
            fixed-fee row it also explains a take-home that bears no relation to
            the fare printed beside it. */}
        <CommissionPill commission={row.specialCommission} style={{ marginTop: 5 }}/>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 96 }}>
        <Text style={{
          fontSize: 16, fontWeight: '700',
          color: row.commission == null ? T.muted : T.text,
          letterSpacing: -0.3,
        }}>{commissionLabel}</Text>
        {/* A fixed-fee job can have no fare at all, and "RM 0.00 fare" beside a
            real commission reads as a bug rather than as an absent figure. */}
        <Text style={{ fontSize: 11, color: T.mutedLight, marginTop: 2 }}>
          {row.fare == null ? 'No fare set' : `RM ${row.fare.toFixed(2)} fare`}
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
