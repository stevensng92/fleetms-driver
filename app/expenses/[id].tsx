import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { Icon, IconName } from '../../components/Icon';
import { Card } from '../../components/Card';
import { Band } from '../../components/Band';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, radius, space, TABULAR, type } from '../../theme/tokens';
import { formatDateKey } from '../../lib/timeFormat';
import { supabase } from '../../lib/supabase';
import { getSignedReceiptUrl, type ExpenseCategory, type ExpenseStatus } from '../../lib/queries/expenses';

const CAT_LABEL: Record<ExpenseCategory, string> = { fuel: 'Fuel', toll: 'Toll', other: 'Other' };
const CAT_ICON: Record<ExpenseCategory, IconName> = { fuel: 'fuel', toll: 'toll', other: 'dots' };

type ExpenseDetail = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  receiptPath: string | null;
  notes: string | null;
  voidedAt: string | null;
  status: ExpenseStatus;
  vehiclePlate: string;
};

async function fetchExpenseDetail(id: string): Promise<ExpenseDetail> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, category, amount, expense_date, receipt_path, notes, voided_at, status,
      vehicle:vehicles!expenses_org_vehicle_fkey ( plate_number )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    amount: Number(data.amount),
    expenseDate: data.expense_date,
    receiptPath: data.receipt_path,
    notes: data.notes,
    voidedAt: data.voided_at,
    // NOT NULL since the expense-approval migration (in prod before any
    // build with this code shipped) — see note in lib/queries/expenses.ts.
    status: (data as any).status as ExpenseStatus,
    vehiclePlate: (data.vehicle as any)?.plate_number ?? '—',
  };
}

export default function Receipt() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: e, isLoading, isError, error } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => fetchExpenseDetail(id!),
    enabled: Boolean(id),
  });

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (e?.receiptPath) {
      getSignedReceiptUrl(e.receiptPath).then(url => { if (alive) setSignedUrl(url); });
    } else {
      setSignedUrl(null);
    }
    return () => { alive = false; };
  }, [e?.receiptPath]);

  if (isLoading || !e) {
    return (
      <AppFrame bg={T.ground}>
        <AppHeader title="Receipt" onBack={() => router.back()}/>
        {isError ? (
          <Text style={[type.body, { marginHorizontal: space[5], color: T.redText }]}>
            {(error as Error)?.message ?? 'Couldn’t load expense'}
          </Text>
        ) : (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={T.text2}/>
          </View>
        )}
      </AppFrame>
    );
  }

  // Format the DATE-column string directly: see the note in (tabs)/expenses.tsx.
  // new Date('2026-08-01') is UTC midnight and renders a day early west of UTC.
  const dateLabel = formatDateKey(e.expenseDate, { long: true });

  return (
    <AppFrame bg={T.ground}>
      <AppHeader
        title={`${CAT_LABEL[e.category]} receipt`}
        subtitle={dateLabel}
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[4] }}>
        {/* Receipt photo (or no-photo placeholder) */}
        <Card style={{ padding: space[4] }}>
          {e.receiptPath ? (
            signedUrl ? (
              <Image source={{ uri: signedUrl }} style={{ width: '100%', height: 320, borderRadius: radius.md }} resizeMode="cover"/>
            ) : (
              <View style={{ height: 320, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={T.text2}/>
                <Text style={[type.label, { marginTop: space[3], color: T.text2 }]}>Loading receipt…</Text>
              </View>
            )
          ) : (
            <View style={{
              height: 220, alignItems: 'center', justifyContent: 'center',
              backgroundColor: T.surfaceSunk, borderRadius: radius.md,
            }}>
              <Icon name="image" size={32} color={T.text3}/>
              <Text style={[type.body, { marginTop: space[2], color: T.text2 }]}>No receipt photo</Text>
            </View>
          )}
        </Card>

        {/* Details */}
        <Card style={{ padding: space[5], flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4] }}>
          {([
            ['Category', CAT_LABEL[e.category], CAT_ICON[e.category]],
            ['Date',     dateLabel, null],
            ['Amount',   `RM ${e.amount.toFixed(2)}`, null],
            ['Vehicle',  e.vehiclePlate, null],
          ] as const).map(([k, v, icon]) => (
            <View key={k} style={{ width: '50%', gap: space[1] }}>
              <Text style={[type.label, { color: T.text2 }]}>{k}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                {icon && <Icon name={icon} size={16} color={T.text2}/>}
                <Text style={[type.title, TABULAR, { color: T.text }]}>{v}</Text>
              </View>
            </View>
          ))}
          {e.notes && (
            <View style={{ width: '100%', gap: space[1] }}>
              <Text style={[type.label, { color: T.text2 }]}>Notes</Text>
              <Text style={[type.body, { color: T.text }]}>{e.notes}</Text>
            </View>
          )}
        </Card>

        {e.voidedAt ? (
          <Band tone="neutral" icon="ban">
            <Text style={[type.body, { color: T.text2 }]}>
              <Text style={{ fontFamily: fontFor('700'), fontWeight: '700' }}>Voided.</Text> This expense has been voided by your dispatcher and is not counted in your monthly total.
            </Text>
          </Band>
        ) : e.status === 'rejected' ? (
          <Band tone="red" icon="circleX">
            <Text style={[type.body, { color: T.redText }]}>
              <Text style={{ fontFamily: fontFor('700'), fontWeight: '700' }}>Rejected.</Text> Your dispatcher reviewed this expense and declined it. It is not counted in your monthly total.
            </Text>
          </Band>
        ) : e.status === 'pending' ? (
          <Band tone="amber" icon="clock">
            <Text style={[type.body, { color: T.amberText }]}>
              <Text style={{ fontFamily: fontFor('700'), fontWeight: '700' }}>Pending review.</Text> Your dispatcher hasn&apos;t reviewed this expense yet. It stays in your monthly total unless it&apos;s rejected.
            </Text>
          </Band>
        ) : null}

        <Text style={[type.caption, { color: T.text3, textAlign: 'center', marginTop: space[2] }]}>
          To correct or void this expense, contact your dispatcher.
        </Text>
      </View>
    </AppFrame>
  );
}
