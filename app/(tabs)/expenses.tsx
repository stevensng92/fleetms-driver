import React from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Icon, IconName } from '../../components/Icon';
import { Card } from '../../components/Card';
import { FeatureCard } from '../../components/FeatureCard';
import { LoadError } from '../../components/LoadError';
import { Pill } from '../../components/Pill';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, radius, space, TABULAR, type } from '../../theme/tokens';
import { formatDateKey, formatMonthLong } from '../../lib/timeFormat';
import { useMyExpenses, type ExpenseRow, type ExpenseCategory } from '../../lib/queries/expenses';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

const CAT_ICON: Record<ExpenseCategory, IconName> = {
  fuel: 'fuel', toll: 'toll', other: 'dots',
};
const CAT_LABEL: Record<ExpenseCategory, string> = {
  fuel: 'Fuel', toll: 'Toll', other: 'Other',
};

export default function Expenses() {
  const T = useTokens();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyExpenses();

  // MY month, matching the MY range the totals are computed over (see
  // lib/queries/expenses.ts). Device-local would let the label say one month
  // while the figures below cover another.
  const monthLabel = formatMonthLong();
  const totals = data?.totalsByCategory ?? { fuel: 0, toll: 0, other: 0 };
  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.ground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={T.text2}
          />
        }
      >
        <AppHeader title="Expenses" subtitle={monthLabel}/>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={T.text2}/>
          </View>
        ) : isError ? (
          <LoadError title="Couldn't load expenses" message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>
        ) : (
          <>
            {/* Month total: the dark card when there is something to show */}
            <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
              {rows.length ? (
                <FeatureCard style={{ gap: space[3] }}>
                  <Text style={[type.label, { color: T.onFeature2 }]}>Logged this month</Text>
                  <Text style={[type.figure, TABULAR, { color: T.onFeature }]}>RM {total.toFixed(2)}</Text>
                  <View style={{
                    flexDirection: 'row', gap: space[3], marginTop: space[1], paddingTop: space[4],
                    borderTopWidth: 1, borderTopColor: T.featureTrack,
                  }}>
                    {(['fuel', 'toll', 'other'] as const).map((k) => (
                      <View key={k} style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                          <Icon name={CAT_ICON[k]} size={14} color={T.onFeature2}/>
                          <Text style={[type.label, { color: T.onFeature2 }]}>{CAT_LABEL[k]}</Text>
                        </View>
                        <Text style={[type.body, TABULAR, { fontFamily: fontFor('600'), fontWeight: '600', marginTop: space[1], color: T.onFeature }]}>
                          RM {totals[k].toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </FeatureCard>
              ) : (
                <Card style={{ padding: space[5], gap: space[1] }}>
                  <Text style={[type.label, { color: T.text2 }]}>Logged this month</Text>
                  <Text style={[type.figure, TABULAR, { color: T.text3 }]}>RM {total.toFixed(2)}</Text>
                </Card>
              )}
            </View>

            <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
              <Button full icon="plus" onPress={() => router.push('/expenses/log')}>
                Log expense
              </Button>
            </View>

            {rows.length === 0 ? (
              <Card style={{
                marginHorizontal: space[4], marginTop: space[2], paddingHorizontal: space[5], paddingVertical: space[10],
                alignItems: 'center',
              }}>
                <View style={{
                  width: 64, height: 64, borderRadius: radius.pill, backgroundColor: T.surfaceSunk,
                  alignItems: 'center', justifyContent: 'center', marginBottom: space[3],
                }}>
                  <Icon name="receipt" size={28} color={T.text3}/>
                </View>
                <Text style={[type.title, { color: T.text, marginBottom: space[1] }]}>
                  No expenses logged yet this month
                </Text>
                <Text style={[type.label, { color: T.text2, textAlign: 'center', lineHeight: 19 }]}>
                  Tap <Text style={{ fontFamily: fontFor('700'), fontWeight: '700' }}>Log expense</Text> above to record fuel, toll or other costs.
                </Text>
              </Card>
            ) : (
              <>
                <SectionLabel>Recent</SectionLabel>
                <Card style={{ marginHorizontal: space[4], overflow: 'hidden' }}>
                  {rows.map((e, i) => (
                    <ExpenseRowView key={e.id} e={e} last={i === rows.length - 1}/>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ExpenseRowView({ e, last }: { e: ExpenseRow; last?: boolean }) {
  const T = useTokens();
  const voided   = Boolean(e.voidedAt);
  const rejected = !voided && e.status === 'rejected';
  const pending  = !voided && e.status === 'pending';
  // Rejected reads like voided (dead row, struck through) but keeps its own
  // label: the dispatcher declined this claim, vs. cancelled the record.
  const dead = voided || rejected;
  // expenseDate is a DATE column ("2026-08-01"). new Date() parses a bare
  // date-only string as UTC, then toLocaleDateString renders it device-local,
  // so on any UTC-negative device this showed the DAY BEFORE the expense was
  // filed. Format the string instead; it has no timezone to apply.
  const dayShort = formatDateKey(e.expenseDate, { year: false });

  return (
    <Pressable
      onPress={() => router.push(`/expenses/${e.id}`)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[3],
        paddingHorizontal: space[5], paddingVertical: space[3], minHeight: 64,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.hairline,
        opacity: dead ? 0.55 : 1,
      }}
    >
      <View style={{
        width: 40, height: 40, borderRadius: radius.sm, backgroundColor: T.surfaceSunk,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={CAT_ICON[e.category]} size={20} color={dead ? T.text3 : T.text2}/>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={[type.title, {
          color: dead ? T.text2 : T.text,
          textDecorationLine: dead ? 'line-through' : 'none',
        }]}>
          {CAT_LABEL[e.category]}{e.notes ? `, ${e.notes}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[3], rowGap: space[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Icon name="calendar" size={13} color={T.text3}/>
            <Text style={[type.caption, TABULAR, { color: T.text2 }]}>{dayShort}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Icon name="car" size={13} color={T.text3}/>
            <Text style={[type.caption, { fontFamily: MONO, color: T.text2 }]}>{e.vehiclePlate}</Text>
          </View>
          {voided && <Pill tone="neutral" icon="ban">Voided</Pill>}
          {rejected && <Pill tone="red" icon="circleX">Rejected</Pill>}
          {pending && <Pill tone="amber" icon="clock">Pending</Pill>}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text style={[type.title, TABULAR, {
          color: dead ? T.text2 : T.text,
          textDecorationLine: dead ? 'line-through' : 'none',
        }]}>RM {e.amount.toFixed(2)}</Text>
        {e.receiptPath && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Icon name="image" size={13} color={T.text2}/>
            <Text style={[type.caption, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>Receipt</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
