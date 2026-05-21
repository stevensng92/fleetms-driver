import { useMutation, useQueryClient } from '@tanstack/react-query';
// expo-file-system v54 deprecated the top-level readAsStringAsync; the legacy
// submodule keeps the old signature working. Migration to the new File/Directory
// API is on the backlog.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../supabase';
import type { ExpenseCategory } from '../queries/expenses';

export type LogExpenseInput = {
  category: ExpenseCategory;
  amount: number;          // RM, > 0
  expenseDate: string;     // YYYY-MM-DD
  vehicleId: string;
  notes?: string;
  /** Local file URI from expo-image-picker, optional. */
  receiptUri?: string | null;
};

// Compress + downscale the photo before upload. ~85% JPEG quality, max 2048px
// on the longer edge — keeps receipts legible while keeping uploads small on
// LTE.
async function compressReceipt(uri: string): Promise<{ uri: string; ext: 'jpg' }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 2048 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, ext: 'jpg' };
}

async function uploadReceipt(localUri: string): Promise<string> {
  // 1. Compress
  const { uri: outUri, ext } = await compressReceipt(localUri);

  // 2. Resolve target path. We need org_id and driver_id from the current
  //    driver — pull them via the same drivers row that auth.uid() points at.
  const { data: drv, error: drvErr } = await supabase
    .from('drivers')
    .select('id, org_id')
    .limit(1)
    .single();
  if (drvErr || !drv) {
    throw drvErr ?? new Error('No driver row visible for current user');
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${drv.org_id}/${drv.id}/${filename}`;

  // 3. Read the file as binary and upload to Supabase Storage.
  const base64 = await FileSystem.readAsStringAsync(outUri, { encoding: 'base64' });
  const bytes = decodeBase64ToUint8Array(base64);

  const { error: upErr } = await supabase.storage
    .from('expense_receipts')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  return path;
}

// Tiny base64 → Uint8Array. RN doesn't expose Buffer; this is the standard
// hand-rolled decoder used in expo-supabase examples.
function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const len = b64.length;
  let bufferLength = (len * 3) >> 2;
  if (b64[len - 1] === '=') bufferLength--;
  if (b64[len - 2] === '=') bufferLength--;
  const out = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)];
    const e2 = lookup[b64.charCodeAt(i + 1)];
    const e3 = lookup[b64.charCodeAt(i + 2)];
    const e4 = lookup[b64.charCodeAt(i + 3)];
    out[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) out[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) out[p++] = ((e3 & 3)  << 6) | (e4 & 63);
  }
  return out;
}

export function useLogExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogExpenseInput) => {
      const receiptPath = input.receiptUri ? await uploadReceipt(input.receiptUri) : null;
      const { data, error } = await supabase.rpc('driver_log_expense', {
        p_category:     input.category,
        p_amount:       input.amount,
        p_expense_date: input.expenseDate,
        p_vehicle_id:   input.vehicleId,
        p_notes:        input.notes ?? null,
        p_receipt_path: receiptPath,
      });
      if (error) throw error;
      return { id: data as unknown as string, receiptPath };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
