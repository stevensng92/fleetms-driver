import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl, PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { CommissionPill } from '../../components/CommissionPill';
import { Icon, IconName } from '../../components/Icon';
import { Band } from '../../components/Band';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, radius, space, TABULAR, type } from '../../theme/tokens';
import {
  useDriverEarnings, useEarningsHistoryStart, ROW_LIMIT,
  type EarningsRow, type EarningsPaymentStatus,
} from '../../lib/queries/earnings';
import {
  periodCount, periodKeysDesc, periodHeadline, emptyStateText,
  type EarningsMode,
} from '../../lib/earningsPeriod';
import { useDriverProfile } from '../../lib/queries/driverProfile';
import { formatDate } from '../../lib/timeFormat';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

const MODES: { mode: EarningsMode; label: string }[] = [
  { mode: 'week',  label: 'Week' },
  { mode: 'month', label: 'Month' },
  { mode: 'all',   label: 'All Time' },
];

/** How far a horizontal drag must travel before it counts as a page turn. */
const SWIPE_THRESHOLD = 40;

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
  const [mode, setMode] = useState<EarningsMode>('month');
  // How many periods back we're paged. 0 is always the current one.
  const [offset, setOffset] = useState(0);
  const { data: profile } = useDriverProfile();
  const { data: historyStart } = useEarningsHistoryStart();

  // `now` is captured once per render rather than read inside each helper, so
  // the label, the range and the page count cannot disagree with each other by
  // being computed microseconds either side of midnight.
  const now = useMemo(() => new Date(), [mode, historyStart]);
  const count = periodCount(mode, historyStart, now);
  const periods = useMemo(() => periodKeysDesc(mode, count, now), [mode, count, now]);
  // Clamp rather than trust: switching Month→Week shortens the pager, and an
  // offset left over from the longer mode would index past the end.
  const safeOffset = Math.min(offset, periods.length - 1);
  const period = periods[safeOffset] ?? periods[0];

  const { data, isLoading, isError, error, refetch, isRefetching } = useDriverEarnings(period);

  // PanResponder is built from refs, so its handlers are created once and would
  // otherwise close over the FIRST render's values. Functional setState plus a
  // ref for the bound is what keeps a swipe honest after the mode changes.
  const maxOffset = useRef(0);
  maxOffset.current = periods.length - 1;
  const pan = useRef(
    PanResponder.create({
      // Claim the gesture only once it is clearly horizontal — otherwise the
      // card swallows the vertical drag that scrolls the screen and pulls to
      // refresh, which is a far more common gesture than paging.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -SWIPE_THRESHOLD) setOffset(o => Math.min(o + 1, maxOffset.current));
        else if (g.dx >= SWIPE_THRESHOLD) setOffset(o => Math.max(o - 1, 0));
      },
    }),
  ).current;

  const goEarlier = () => setOffset(o => Math.min(o + 1, periods.length - 1));
  const goLater   = () => setOffset(o => Math.max(o - 1, 0));
  const canGoEarlier = safeOffset < periods.length - 1;
  const canGoLater   = safeOffset > 0;
  const pageable = mode !== 'all' && periods.length > 1;

  const commissionTotal = data?.commissionTotal ?? 0;
  const fareTotal       = data?.fareTotal ?? 0;
  const commissionParts = formatRM(commissionTotal);
  const avgParts        = formatRM(data?.avgCommissionPerJob ?? 0);
  const missing         = data?.missingCommissionCount ?? 0;

  return (
    <AppFrame bg={T.ground}>
      <AppHeader title="Earnings" subtitle={profile?.org.name ?? ''}/>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={T.text2}/>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Mode selector: three fixed, equal-width tabs again.
            The previous version grew a chip per past month and scrolled, which
            put the older months off the right edge with the scroll indicator
            disabled; the first person to use it concluded the app only went
            back one month. The period axis moved onto the card below, where the
            gesture has room and can advertise itself. */}
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
          <Segmented
            block
            options={MODES.map(m => ({ value: m.mode, label: m.label }))}
            value={mode}
            onChange={(m) => { setMode(m); setOffset(0); }}
          />
        </View>

        {/* Summary, also the pager. The card is the largest touch target on
            the screen, so the swipe lives here rather than on a cramped chip
            row, and the chevrons + dots make it discoverable without one. */}
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
          <Card
            {...(pageable ? pan.panHandlers : {})}
            style={{ padding: space[5], gap: space[4] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              {pageable && (
                <Pressable
                  onPress={goEarlier}
                  disabled={!canGoEarlier}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Show an earlier period"
                  accessibilityState={{ disabled: !canGoEarlier }}
                  style={{
                    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: T.surfaceSunk,
                    alignItems: 'center', justifyContent: 'center', opacity: canGoEarlier ? 1 : 0.35,
                  }}
                >
                  <Icon name="chevL" size={18} stroke={2.4} color={T.text2}/>
                </Pressable>
              )}
              {/* The period name lives on the card, not the tab: the tab says
                  which KIND of period, this says which one. */}
              <Text
                numberOfLines={1}
                style={[type.body, {
                  flex: 1, textAlign: pageable ? 'center' : 'left',
                  fontFamily: fontFor('600'), fontWeight: '600', color: T.text,
                }]}
              >{periodHeadline(period, now)}</Text>
              {pageable && (
                <Pressable
                  onPress={goLater}
                  disabled={!canGoLater}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Show a later period"
                  accessibilityState={{ disabled: !canGoLater }}
                  style={{
                    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: T.surfaceSunk,
                    alignItems: 'center', justifyContent: 'center', opacity: canGoLater ? 1 : 0.35,
                  }}
                >
                  <Icon name="chevR" size={18} stroke={2.4} color={T.text2}/>
                </Pressable>
              )}
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                {isLoading ? (
                  <ActivityIndicator color={T.text2} style={{ marginTop: space[3] }}/>
                ) : (
                  <>
                    <Text style={[type.display, TABULAR, { color: T.text }]}>
                      RM {commissionParts.whole}
                    </Text>
                    <Text style={[type.title, TABULAR, { color: T.text2 }]}>.{commissionParts.cents}</Text>
                  </>
                )}
              </View>
              {!isLoading && (
                <Text style={[type.label, TABULAR, { color: T.text2, marginTop: space[1] }]}>
                  RM {formatRM(fareTotal).whole} in fares
                </Text>
              )}
            </View>
            {/* The totals above cover only the rows we fetched. Say so rather
                than showing a number that silently understates: this screen is
                what a driver uses to check they were paid correctly. */}
            {data?.truncated && (
              <Band tone="neutral">
                {/* One interpolated string, not mixed JSX children: split
                    children render as separate text nodes, which breaks both
                    text matching in tests and screen-reader continuity. */}
                {`Showing your ${ROW_LIMIT} most recent jobs${
                  data.totalCount != null && data.totalCount > ROW_LIMIT
                    ? ` of ${data.totalCount}`
                    : ''
                }. Older jobs aren't counted in these totals.`}
              </Band>
            )}
            {missing > 0 && (
              <Band tone="amber" icon="clock">
                {`${missing} ${missing === 1 ? 'job is' : 'jobs are'} awaiting commission from dispatcher.`}
              </Band>
            )}
            <View style={{
              flexDirection: 'row', paddingTop: space[4],
              borderTopWidth: 1, borderTopColor: T.hairline,
            }}>
              <Mini label="Jobs" value={String(data?.jobsCount ?? 0)} color={T.text} first/>
              <Mini
                label="Pending"
                value={
                  (data?.pendingCount ?? 0) === 0
                    ? 'None'
                    : `${data!.pendingCount} ${data!.pendingCount === 1 ? 'job' : 'jobs'}`
                }
                color={(data?.pendingCount ?? 0) > 0 ? T.amberText : T.text}
                icon={(data?.pendingCount ?? 0) > 0 ? 'circleAlert' : undefined}
              />
              <Mini label="Avg / job" value={`RM ${avgParts.whole}`} color={T.text}/>
            </View>

            {/* Position indicator. Dots rather than "2 of 3" because the count
                is small by design (MAX_PERIODS is 3) and a dot row reads as
                "there is more this way" at a glance, which is the job. */}
            {pageable && (
              <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center' }}>
                {periods.map((p, i) => (
                  <View
                    key={p}
                    style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: i === safeOffset ? T.text : T.track,
                    }}
                  />
                ))}
              </View>
            )}
          </Card>

          {/* The gesture has to announce itself: the previous design hid its
              extra periods off-screen and the first driver to use it concluded
              they didn't exist. Drops away once they've paged, having done its
              job. */}
          {pageable && safeOffset === 0 && (
            <Text style={[type.caption, { color: T.text3, textAlign: 'center', marginTop: space[2] }]}>
              {`Swipe for earlier ${mode === 'week' ? 'weeks' : 'months'}`}
            </Text>
          )}
        </View>

        <SectionLabel>Recent jobs</SectionLabel>

        {isError && (
          <Band
            tone="red"
            style={{ marginHorizontal: space[4] }}
            action={<Button variant="secondary" onPress={() => refetch()}>Retry</Button>}
          >
            <Text style={[type.title, { color: T.redText, marginBottom: space[1] }]}>
              Couldn&apos;t load earnings
            </Text>
            <Text style={[type.label, { color: T.redText }]}>
              {(error as Error)?.message ?? 'Unknown error'}
            </Text>
          </Band>
        )}

        {!isError && !isLoading && (data?.rows ?? []).length === 0 && (
          <Card style={{ marginHorizontal: space[4], paddingHorizontal: space[4], paddingVertical: space[6], alignItems: 'center' }}>
            <Text style={[type.body, { color: T.text2, textAlign: 'center' }]}>
              {emptyStateText(period, now)}
            </Text>
          </Card>
        )}

        {!isError && (data?.rows ?? []).length > 0 && (
          <Card style={{ marginHorizontal: space[4], overflow: 'hidden' }}>
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
      // carrying "/" or "?" would break a hand-built path, and the `as '/'`
      // cast the old form needed is exactly what let the uuid-vs-job_number bug
      // compile clean in the first place.
      onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: row.jobNumber } })}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space[3],
        paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 64,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start' }}>
        <Text style={[type.body, TABULAR, {
          fontFamily: MONO, fontWeight: '600', color: T.text,
        }]}>{row.jobNumber}</Text>
        <Text style={[type.caption, { color: T.text2 }]}>{formatRowDate(row.jobDate)}</Text>
        {/* Only the handful of jobs that paid a non-standard rate get this:
            it's the answer to "why is my cut different on this one?". On a
            fixed-fee row it also explains a take-home that bears no relation to
            the fare printed beside it. */}
        <CommissionPill commission={row.specialCommission} style={{ marginTop: space[1] }}/>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 96, gap: 2 }}>
        <Text style={[type.title, TABULAR, {
          color: row.commission == null ? T.text2 : T.text,
        }]}>{commissionLabel}</Text>
        {/* A fixed-fee job can have no fare at all, and "RM 0.00 fare" beside a
            real commission reads as a bug rather than as an absent figure. */}
        <Text style={[type.caption, TABULAR, { color: T.text3 }]}>
          {row.fare == null ? 'No fare set' : `RM ${row.fare.toFixed(2)} fare`}
        </Text>
      </View>
      <StatusPill kind={pillKindFor(row.paymentStatus)}/>
    </Pressable>
  );
}

function Mini({ label, value, color, first, icon }: {
  label: string; value: string; color: string; first?: boolean; icon?: IconName;
}) {
  const T = useTokens();
  return (
    <View style={{
      flex: 1, paddingLeft: first ? 0 : space[3], paddingRight: space[3], gap: space[1],
      ...(first ? {} : { borderLeftWidth: 1, borderLeftColor: T.hairline }),
    }}>
      <Text style={[type.caption, { color: T.text2 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        {icon && <Icon name={icon} size={14} stroke={2.4} color={color}/>}
        <Text style={[type.title, TABULAR, { fontFamily: fontFor('700'), fontWeight: '700', color }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}
