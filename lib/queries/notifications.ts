import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { formatDateTime } from '../timeFormat';

// In-app inbox backed by public.push_log (the same table that drives push
// delivery). Each row is one outbound push for this driver; the inbox is
// just a UI on top, with read_at tracked locally via mark_notifications_read.
//
// Kinds (Phase-1 push events — see fleetms migration 20260523):
//   - job_assigned, job_updated, job_cancelled, reassigned, pickup_reminder.

export type NotificationKind =
  | 'job_assigned'
  | 'job_updated'
  | 'job_cancelled'
  | 'reassigned'
  | 'pickup_reminder'
  | string; // open for future kinds

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  enqueuedAt: string;       // ISO
  sentAt: string | null;
  readAt: string | null;
  deeplink: string | null;
  title: string;
  body: string;
};

export const KIND_LABEL: Record<string, string> = {
  job_assigned:    'New job',
  job_updated:     'Job updated',
  job_cancelled:   'Job cancelled',
  reassigned:      'Reassigned',
  pickup_reminder: 'Pickup reminder',
};

// Synthesize a one-line title + body from the payload jsonb. Each kind shapes
// its own copy; payloads come from the dispatcher's push-event triggers.
function renderNotification(row: { kind: string; payload: any }): { title: string; body: string; deeplink: string | null } {
  const p = row.payload ?? {};
  const deeplink: string | null = p.deeplink ?? null;
  const title = KIND_LABEL[row.kind] ?? row.kind.replace(/_/g, ' ');

  const pickupTime = p.pickup_datetime ? formatDateTime(p.pickup_datetime) : null;

  switch (row.kind) {
    case 'job_assigned':
      return {
        title: `New job · ${p.job_number ?? ''}`.trim(),
        body: [p.client_name, p.pickup_location, pickupTime].filter(Boolean).join(' · '),
        deeplink,
      };
    case 'pickup_reminder':
      return {
        title: `Pickup soon · ${p.job_number ?? ''}`.trim(),
        body: [p.pickup_location, pickupTime].filter(Boolean).join(' · '),
        deeplink,
      };
    case 'job_updated':
      return {
        title: `Job updated · ${p.job_number ?? ''}`.trim(),
        body: [p.pickup_location, pickupTime].filter(Boolean).join(' · '),
        deeplink,
      };
    case 'job_cancelled':
      return {
        title: `Job cancelled · ${p.job_number ?? ''}`.trim(),
        body: p.pickup_location ?? '',
        deeplink,
      };
    case 'reassigned':
      return {
        title: `Reassigned · ${p.job_number ?? ''}`.trim(),
        body: p.pickup_location ?? '',
        deeplink,
      };
    default:
      return { title, body: JSON.stringify(p).slice(0, 120), deeplink };
  }
}

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
        const { title, body, deeplink } = renderNotification({ kind: r.kind, payload: r.payload });
        return {
          id: r.id,
          kind: r.kind,
          enqueuedAt: r.enqueued_at,
          sentAt: r.sent_at,
          readAt: r.read_at,
          deeplink,
          title,
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
