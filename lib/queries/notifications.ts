import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { readNotification, type NotificationDetails } from '../notification';

// In-app inbox backed by public.push_log (the same table that drives push
// delivery). Each row is one outbound push for this driver; the inbox is
// just a UI on top, with read_at tracked locally via mark_notifications_read.
//
// Kinds (Phase-1 push events — see fleetms migration 20260523):
//   - job_assigned, job_updated, job_cancelled, reassigned, pickup_reminder.

export type { NotificationKind } from '../notification';

/** One row as downloaded: its raw details and checked link, no time text.
 *  The screen words it with notificationWords in lib/notification.ts. */
export type NotificationItem = NotificationDetails & {
  id: string;
  enqueuedAt: string;       // ISO
  sentAt: string | null;
  readAt: string | null;
};

/** The driver's last 50 notifications, newest first, each with its raw details and checked link. Exported for tests. */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('push_log')
    .select('id, kind, payload, enqueued_at, sent_at, read_at')
    .order('enqueued_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    enqueuedAt: r.enqueued_at,
    sentAt: r.sent_at,
    readAt: r.read_at,
    ...readNotification(r.kind, r.payload),
  }));
}

export function useNotifications() {
  // The Time format setting is not part of the key: rows are worded on
  // screen, so switching it never downloads the list again.
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
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
