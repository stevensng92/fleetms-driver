import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { StatusPill, StatusKind } from './StatusPill';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

export type Job = {
  /** Human-readable identifier from jobs.job_number, shown on cards. */
  id: string;
  /** DB primary key; required for status-change mutations. Optional on mock data. */
  jobUuid?: string;
  /** Current assignment uuid; required for confirm/reject mutations. */
  assignmentId?: string;
  time: string;
  vehicle: string;
  from: string;
  to: string;
  client: string;
  pax: number;
  status: StatusKind;
};

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

export function JobCard({
  job, dim, hideActions, onAccept, onReject, onView, onPress,
}: {
  job: Job;
  dim?: boolean;
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
      style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, marginHorizontal: 16, marginBottom: 12 }}
    >
      {/* meta row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{
          fontFamily: MONO, fontSize: 12.5, fontWeight: '700',
          color: T.muted, letterSpacing: 0.4,
        }}>
          {job.id} · {job.time} · {job.vehicle}
        </Text>
        <StatusPill kind={job.status}/>
      </View>

      {/* route */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 10 }}>
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: T.text }}/>
          <View style={{ width: 2, flex: 1, backgroundColor: T.border, marginVertical: 3 }}/>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: T.accent }}/>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: T.mutedLight, fontWeight: '600', letterSpacing: 0.4 }}>FROM</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2 }}>{job.from}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: T.mutedLight, fontWeight: '600', letterSpacing: 0.4 }}>TO</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2 }}>{job.to}</Text>
          </View>
        </View>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="user" size={14} color={T.muted}/>
          <Text style={{ fontSize: 13, color: T.muted, fontWeight: '500' }}>{job.client}</Text>
        </View>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.borderHard }}/>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="users" size={14} color={T.muted}/>
          <Text style={{ fontSize: 13, color: T.muted, fontWeight: '500' }}>{job.pax} pax</Text>
        </View>
      </View>

      {!hideActions && job.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Button variant="danger" full style={{ flex: 1, minHeight: 44 }} onPress={onReject}>Reject</Button>
          <Button full style={{ flex: 1, minHeight: 44 }} onPress={onAccept}>Accept</Button>
        </View>
      )}
      {!hideActions && job.status === 'confirmed' && (
        <View style={{ marginTop: 4 }}>
          <Button variant="secondary" full style={{ minHeight: 44 }} onPress={onView} trailingIcon="chevR">
            View Details
          </Button>
        </View>
      )}
      {!hideActions && job.status === 'done' && (
        <View style={{
          marginTop: 4, paddingTop: 10, paddingBottom: 2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="checkCirc" size={16} color={T.greenFg}/>
          <Text style={{ fontSize: 13, color: T.greenFg, fontWeight: '600' }}>
            Completed · RM 72.00 logged
          </Text>
        </View>
      )}
    </Card>
  );
}
