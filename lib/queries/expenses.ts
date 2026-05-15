import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ExpenseCategory = 'fuel' | 'toll' | 'other';

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;       // YYYY-MM-DD
  receiptPath: string | null;
  notes: string | null;
  voidedAt: string | null;
  vehiclePlate: string;
};

export type ExpensesSummary = {
  rows: ExpenseRow[];
  totalsByCategory: Record<ExpenseCategory, number>;
  total: number;
};

function startOfMonthIso(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  // YYYY-MM-DD
  return x.toISOString().slice(0, 10);
}
function startOfNextMonthIso(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return x.toISOString().slice(0, 10);
}

async function fetchMyExpenses(): Promise<ExpensesSummary> {
  // RLS scopes to is_driver_self(driver_id), so anon JWT only ever returns own rows.
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, category, amount, expense_date, receipt_path, notes, voided_at,
      vehicle:vehicle_id ( plate_number )
    `)
    .gte('expense_date', startOfMonthIso())
    .lt('expense_date',  startOfNextMonthIso())
    .order('expense_date', { ascending: false })
    .order('created_at',   { ascending: false });

  if (error) throw error;

  const rows: ExpenseRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    category: r.category as ExpenseCategory,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    receiptPath: r.receipt_path,
    notes: r.notes,
    voidedAt: r.voided_at,
    vehiclePlate: r.vehicle?.plate_number ?? '—',
  }));

  const totalsByCategory: Record<ExpenseCategory, number> = { fuel: 0, toll: 0, other: 0 };
  let total = 0;
  for (const r of rows) {
    if (r.voidedAt) continue; // voided rows excluded from totals
    totalsByCategory[r.category] += r.amount;
    total += r.amount;
  }

  return { rows, totalsByCategory, total };
}

export function useMyExpenses() {
  return useQuery({
    queryKey: ['expenses', 'this-month'],
    queryFn: fetchMyExpenses,
  });
}

export async function getSignedReceiptUrl(receiptPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('expense_receipts')
    .createSignedUrl(receiptPath, 60 * 10); // 10 min
  if (error || !data) return null;
  return data.signedUrl;
}
