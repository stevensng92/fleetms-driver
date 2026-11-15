import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { notificationText, notificationLink, type NotificationKind } from '../notificationText';

// In-app inbox backed by public.push_log (the same table that drives push
// delivery). Each row is one outbound push for this driver; the inbox is
// just a UI on top, with read_at tracked locally via mark_notifications_read.
//
// Kinds (Phase-1 push events — see fleetms migration 20260523):
//   - job_assigned, job_updated, job_cancelled, reassigned, pickup_reminder.

export type { NotificationKind } from '../notificationText';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  enqueuedAt: string;       // ISO
  sentAt: string | null;
  readAt: string | null;
  /** Only a link the app can open; null means the row leads nowhere. */
  deeplink: string | null;
  title: string;
  /** The real job number, shown beside the title. */
  jobNumber: string | null;
  body: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase
        .from('push_log')
        .select('id, kind, payload, enqueued_at, sent_at, read_at')
        .order('enqueued_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const { title, jobNumber, body } = notificationText(r.kind, r.payload);
        const deeplink = notificationLink(r.payload?.deeplink ?? null);
        return {
          id: r.id,
          kind: r.kind,
          enqueuedAt: r.enqueued_at,
          sentAt: r.sent_at,
          readAt: r.read_at,
          deeplink,
          title,
          jobNumber,
          body,
        };
      });
    },
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
