import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useClockStyle } from '../clockPref';
import type { ClockStyle } from '../timeFormat';
import { readNotification, type NotificationKind } from '../notification';

// In-app inbox backed by public.push_log (the same table that drives push
// delivery). Each row is one outbound push for this driver; the inbox is
// just a UI on top, with read_at tracked locally via mark_notifications_read.
//
// Kinds (Phase-1 push events — see fleetms migration 20260523):
//   - job_assigned, job_updated, job_cancelled, reassigned, pickup_reminder.

export type { NotificationKind } from '../notification';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  enqueuedAt: string;       // ISO
  sentAt: string | null;
  readAt: string | null;
  /** Only an allowed link (checked by lib/notification.ts); null means the row leads nowhere. */
  link: string | null;
  title: string;
  /** The real job number, shown beside the title. */
  jobNumber: string | null;
  body: string;
};

/** The driver's last 50 notifications, newest first, each worded and with its link checked. Exported for tests. */
export async function fetchNotifications(clock: ClockStyle): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('push_log')
    .select('id, kind, payload, enqueued_at, sent_at, read_at')
    .order('enqueued_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    kind: r.kind,
    enqueuedAt: r.enqueued_at,
    sentAt: r.sent_at,
    readAt: r.read_at,
    ...readNotification(r.kind, r.payload, clock),
  }));
}

export function useNotifications() {
  // The text carries times, so the Time format setting is part of the key: a
  // change runs the query again. Invalidating ['notifications'] still hits it.
  const clock = useClockStyle();
  return useQuery({
    queryKey: ['notifications', clock],
    queryFn: () => fetchNotifications(clock),
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return (data ?? []).filter(n => n.readAt === null).length;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: ids });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
