import React from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Icon, IconName } from '../../components/Icon';
import { Card } from '../../components/Card';
import { useTokens } from '../../theme/ThemeProvider';
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

  const monthLabel = new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
  const totals = data?.totalsByCategory ?? { fuel: 0, toll: 0, other: 0 };
  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.page }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={T.muted}
          />
        }
      >
        <AppHeader title="Expenses" subtitle={monthLabel}/>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={T.muted}/>
          </View>
        ) : isError ? (
          <ErrorBox message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>
        ) : (
          <>
            {/* Summary hero */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={{
                backgroundColor: rows.length ? T.heroBg : T.surface,
                borderRadius: 12,
                paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
                borderWidth: rows.length ? 0 : 1,
                borderStyle: rows.length ? 'solid' : 'dashed',
                borderColor: T.borderHard,
                shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}>
                <Text style={{
                  fontSize: 12, color: rows.length ? T.heroMuted : T.muted, fontWeight: '600',
                  letterSpacing: 0.4, textTransform: 'uppercase',
                }}>Logged this month</Text>
                <Text style={{
                  fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 2,
                  color: rows.length ? T.heroFg : T.borderHard,
                }}>RM {total.toFixed(2)}</Text>

                {rows.length > 0 && (
                  <View style={{
                    flexDirection: 'row', marginTop: 14, paddingTop: 12,
                    borderTopWidth: 1, borderTopColor: T.heroLine,
                  }}>
                    {([
                      { k: 'fuel',  c: T.pendingDot },
                      { k: 'toll',  c: T.confirmDot },
                      { k: 'other', c: T.voidedDot },
                    ] as const).map(({ k, c }) => (
                      <View key={k} style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }}/>
                          <Text style={{
                            fontSize: 10.5, color: T.heroMuted, fontWeight: '600',
                            letterSpacing: 0.5, textTransform: 'uppercase',
                          }}>{CAT_LABEL[k]}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 4, color: T.heroFg }}>
                          RM {totals[k].toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Button full icon="plus" onPress={() => router.push('/expenses/log')}>
                Log Expense
              </Button>
            </View>

            {rows.length === 0 ? (
              <View style={{
                marginHorizontal: 16, marginTop: 20, paddingHorizontal: 20, paddingVertical: 40,
                backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
                alignItems: 'center',
              }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: T.raised,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}>
                  <Icon name="receipt" size={28} color={T.mutedLight}/>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 4 }}>
                  No expenses logged yet this month
                </Text>
                <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 19 }}>
                  Tap <Text style={{ fontWeight: '700' }}>Log Expense</Text> above to record fuel, toll or other costs.
                </Text>
              </View>
            ) : (
              <>
                <SectionLabel>Recent</SectionLabel>
                <Card style={{ marginHorizontal: 16, overflow: 'hidden' }}>
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
  const tint =
    e.category === 'fuel' ? { bg: T.pendingBg, fg: T.pendingFg } :
    e.category === 'toll' ? { bg: T.confirmBg, fg: T.confirmFg } :
                            { bg: T.voidedBg,  fg: T.voidedFg  };
  const voided   = Boolean(e.voidedAt);
  const rejected = !voided && e.status === 'rejected';
  const pending  = !voided && e.status === 'pending';
  // Rejected reads like voided (dead row, struck through) but keeps its own
  // label — the dispatcher declined this claim, vs. cancelled the record.
  const dead = voided || rejected;
  const dayShort = new Date(e.expenseDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });

  return (
    <Pressable
      onPress={() => router.push(`/expenses/${e.id}`)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.border,
        opacity: dead ? 0.55 : 1,
      }}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 10, backgroundColor: tint.bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={CAT_ICON[e.category]} size={20} color={tint.fg}/>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2,
          textDecorationLine: dead ? 'line-through' : 'none',
        }}>
          {CAT_LABEL[e.category]}{e.notes ? ` · ${e.notes}` : ''}
        </Text>
        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2, fontFamily: MONO }}>
          {dayShort} · {e.vehiclePlate}
          {voided   && <Text style={{ color: T.red,        fontWeight: '600' }}>  VOIDED</Text>}
          {rejected && <Text style={{ color: T.red,        fontWeight: '600' }}>  REJECTED</Text>}
          {pending  && <Text style={{ color: T.pendingDot, fontWeight: '600' }}>  PENDING</Text>}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{
          fontSize: 15, fontWeight: '700', color: T.text, letterSpacing: -0.3,
          textDecorationLine: dead ? 'line-through' : 'none',
        }}>RM {e.amount.toFixed(2)}</Text>
        {e.receiptPath && (
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="image" size={12} color={T.confirmDot}/>
            <Text style={{ fontSize: 11, color: T.confirmDot, fontWeight: '600' }}>Receipt</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  return (
    <View style={{
      marginHorizontal: 16, padding: 16, borderRadius: 12,
      backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.red,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: T.redFg }}>Couldn't load expenses</Text>
      <Text style={{ fontSize: 13, color: T.redFg, lineHeight: 19, marginTop: 4 }}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: T.red }}
      >
        <Text style={{ fontSize: 13, color: T.redFg, fontWeight: '600' }}>Retry</Text>
      </Pressable>
    </View>
  );
}
