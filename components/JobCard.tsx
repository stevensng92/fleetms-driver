import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { StatusPill, StatusKind } from './StatusPill';
import { Button } from './Button';
import { Icon } from './Icon';
import { CommissionPill } from './CommissionPill';
import { useTokens } from '../theme/ThemeProvider';

export type Job = {
  /** Human-readable identifier from jobs.job_number, shown on cards. */
  id: string;
  /** DB primary key; required for status-change mutations. Optional on mock data. */
  jobUuid?: string;
  /** Current assignment uuid; required for confirm/reject mutations. */
  assignmentId?: string;
  time: string;
  /** "Thu, 2 Jul" — the pickup's calendar date. Only shown when `overdue`. */
  pickupDate?: string;
  vehicle: string;
  from: string;
  to: string;
  client: string;
  pax: number;
  status: StatusKind;
  /** Commission rate for this job when it differs from the driver's normal
   *  org rate (e.g. 20 → "20% comm"). null = pays the standard rate, so no
   *  badge renders. Resolved in lib/commissionRate.ts — an override pinned to
   *  the default rate is deliberately NOT special. */
  specialRatePct?: number | null;
};

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

export function JobCard({
  job, dim, overdue, hideActions, onAccept, onReject, onView, onPress,
}: {
  job: Job;
  dim?: boolean;
  /** Pickup already passed on a previous day and the job is still open.
   *  Marks the PICKUP chip red and swaps in the missed date so it can't be
   *  mistaken for a job scheduled today. */
  overdue?: boolean;
  hideActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onView?: () => void;
  onPress?: () => void;
}) {
  const T = useTokens();
  const accent =
    job.status === 'pending'   ? T.pendingDot :
    job.status === 'confirmed' ? T.confirmDot :
    job.status === 'progress'  ? T.progressDot :
    job.status === 'done'      ? T.doneDot :
    undefined;

  return (
    <Card
      accent={accent}
      dim={dim}
      onPress={onPress}
      pulse={job.status === 'progress'}
      style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, marginHorizontal: 16, marginBottom: 12 }}
    >
      {/* Header row: PICKUP block (left) + client + meta + status pill */}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        {/* PICKUP time block — anchors the card, most-scanned info.
            Overdue cards get a red tint + the missed date so they can't be
            mistaken for a job scheduled today. */}
        <View style={{
          paddingHorizontal: 10, paddingVertical: 8,
          borderRadius: 8, backgroundColor: overdue ? T.redSoft : T.raised,
          alignItems: 'center', minWidth: 64,
        }}>
          <Text style={{
            fontSize: 9.5, fontWeight: '800', color: overdue ? T.red : T.muted,
            letterSpacing: 0.8, textTransform: 'uppercase',
          }}>{overdue ? 'Missed' : 'Pickup'}</Text>
          <Text style={{
            fontSize: 18, fontWeight: '800', color: overdue ? T.redFg : T.text,
            letterSpacing: -0.3, marginTop: 2,
            // tabular-nums keeps the time numerals same-width so cards line
            // up vertically (12:30 vs 9:00 don't shift).
            fontVariant: ['tabular-nums'],
          }}>{job.time}</Text>
          {overdue && job.pickupDate && (
            <Text style={{
              fontSize: 10.5, fontWeight: '700', color: T.red, marginTop: 3,
            }}>{job.pickupDate}</Text>
          )}
        </View>

        {/* Right side: client + meta + status pill */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Text
              style={{
                flex: 1, fontSize: 16, fontWeight: '700', color: T.text,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {job.client}
            </Text>
            <StatusPill kind={job.status} pulse={job.status === 'progress'}/>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="users" size={12} color={T.muted}/>
            <Text style={{ fontSize: 12.5, color: T.muted, fontWeight: '500' }}>
              {job.pax} pax
            </Text>
            <Text style={{ fontSize: 12.5, color: T.borderHard }}>·</Text>
            <Text style={{ fontSize: 12.5, color: T.muted, fontWeight: '500' }} numberOfLines={1}>
              {job.vehicle}
            </Text>
            <Text style={{ fontSize: 12.5, color: T.borderHard }}>·</Text>
            <Text style={{
              fontSize: 12, fontFamily: MONO, color: T.mutedLight, fontWeight: '600',
              letterSpacing: 0.2,
            }} numberOfLines={1}>
              {job.id}
            </Text>
          </View>

          {/* Non-default commission rate. Its own row rather than another chip
              in the crowded meta line above — it only appears on the handful of
              jobs that carry one, and a pay figure shouldn't be the thing that
              gets truncated on a narrow phone. */}
          <CommissionPill pct={job.specialRatePct} style={{ marginTop: 6 }}/>
        </View>
      </View>

      {/* Route timeline */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 6 }}>
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: T.text }}/>
          <View style={{ width: 2, flex: 1, backgroundColor: T.border, marginVertical: 3 }}/>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: T.accent }}/>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 10.5, color: T.mutedLight, fontWeight: '700', letterSpacing: 0.5 }}>FROM</Text>
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: T.text, letterSpacing: -0.2 }} numberOfLines={1}>
              {job.from}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 10.5, color: T.mutedLight, fontWeight: '700', letterSpacing: 0.5 }}>TO</Text>
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: T.text, letterSpacing: -0.2 }} numberOfLines={1}>
              {job.to}
            </Text>
          </View>
        </View>
      </View>

      {/* Action row */}
      {!hideActions && job.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button variant="danger" full style={{ flex: 1, minHeight: 44 }} onPress={onReject}>Reject</Button>
          <Button full style={{ flex: 1, minHeight: 44 }} onPress={onAccept}>Accept</Button>
        </View>
      )}
      {!hideActions && job.status === 'confirmed' && (
        <View style={{ marginTop: 10 }}>
          <Button variant="secondary" full style={{ minHeight: 44 }} onPress={onView} trailingIcon="chevR">
            View Details
          </Button>
        </View>
      )}
      {!hideActions && job.status === 'done' && (
        <View style={{
          marginTop: 10, paddingTop: 10,
          borderTopWidth: 1, borderTopColor: T.border,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="checkCirc" size={16} color={T.greenFg}/>
          <Text style={{ fontSize: 13, color: T.greenFg, fontWeight: '600' }}>
            Completed
          </Text>
        </View>
      )}
    </Card>
  );
}
