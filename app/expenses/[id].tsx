import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { getSignedReceiptUrl, type ExpenseCategory } from '../../lib/queries/expenses';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';
const CAT_LABEL: Record<ExpenseCategory, string> = { fuel: 'Fuel', toll: 'Toll', other: 'Other' };

type ExpenseDetail = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  receiptPath: string | null;
  notes: string | null;
  voidedAt: string | null;
  vehiclePlate: string;
};

async function fetchExpenseDetail(id: string): Promise<ExpenseDetail> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, category, amount, expense_date, receipt_path, notes, voided_at,
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
      <AppFrame bg={T.surface}>
        <AppHeader title="Receipt" onBack={() => router.back()}/>
        {isError ? (
          <Text style={{ marginHorizontal: 20, color: T.red }}>
            {(error as Error)?.message ?? 'Couldn’t load expense'}
          </Text>
        ) : (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={T.muted}/>
          </View>
        )}
      </AppFrame>
    );
  }

  const dateLabel = new Date(e.expenseDate).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <AppFrame bg={T.surface}>
      <AppHeader
        title={`${CAT_LABEL[e.category]} Receipt`}
        subtitle={dateLabel}
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        {/* Receipt photo (or no-photo placeholder) */}
        <View style={{
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
          borderRadius: 12, padding: 12,
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}>
          {e.receiptPath ? (
            signedUrl ? (
              <Image source={{ uri: signedUrl }} style={{ width: '100%', height: 320, borderRadius: 6 }} resizeMode="cover"/>
            ) : (
              <View style={{ height: 320, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={T.muted}/>
                <Text style={{ marginTop: 10, fontSize: 13, color: T.muted }}>Loading receipt…</Text>
              </View>
            )
          ) : (
            <View style={{
              height: 220, alignItems: 'center', justifyContent: 'center',
              backgroundColor: T.raised, borderRadius: 6,
            }}>
              <Icon name="image" size={28} color={T.mutedLight}/>
              <Text style={{ marginTop: 10, fontSize: 13, color: T.muted }}>No receipt photo</Text>
            </View>
          )}
        </View>

        {/* Meta grid */}
        <View style={{
          backgroundColor: T.raised, borderRadius: 12, padding: 14, marginTop: 16,
          flexDirection: 'row', flexWrap: 'wrap',
        }}>
          {[
            ['Category', CAT_LABEL[e.category]],
            ['Date',     dateLabel],
            ['Amount',   `RM ${e.amount.toFixed(2)}`],
            ['Vehicle',  e.vehiclePlate],
          ].map(([k, v]) => (
            <View key={k} style={{ width: '50%', paddingVertical: 6 }}>
              <Text style={{
                fontSize: 11, color: T.mutedLight, fontWeight: '700',
                letterSpacing: 0.5, textTransform: 'uppercase',
              }}>{k}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.text, marginTop: 3 }}>{v}</Text>
            </View>
          ))}
          {e.notes && (
            <View style={{ width: '100%', paddingTop: 6 }}>
              <Text style={{
                fontSize: 11, color: T.mutedLight, fontWeight: '700',
                letterSpacing: 0.5, textTransform: 'uppercase',
              }}>Notes</Text>
              <Text style={{ fontSize: 14, color: T.text, marginTop: 3, lineHeight: 20 }}>
                {e.notes}
              </Text>
            </View>
          )}
        </View>

        {e.voidedAt && (
          <View style={{
            marginTop: 16, padding: 12, borderRadius: 10,
            backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.red,
          }}>
            <Text style={{ fontSize: 13, color: T.redFg, fontWeight: '700' }}>VOIDED</Text>
            <Text style={{ fontSize: 12, color: T.redFg, marginTop: 4 }}>
              This expense has been voided by your dispatcher and is not counted in your monthly total.
            </Text>
          </View>
        )}

        <Text style={{
          fontSize: 11, color: T.mutedLight, textAlign: 'center', lineHeight: 16, marginTop: 24,
        }}>
          To correct or void this expense, contact your dispatcher.
        </Text>
      </View>
    </AppFrame>
  );
}
