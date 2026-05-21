import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { useTokens, useThemeControls } from '../../theme/ThemeProvider';
import { useDriverProfile, formatVehicleLine, availabilityBadge } from '../../lib/queries/driverProfile';
import { useDriverTimeOff, REASON_LABEL, type TimeOffEntry, type TimeOffStatus } from '../../lib/queries/timeOff';
import { useCancelTimeOff } from '../../lib/mutations/timeOff';
import { signOut } from '../../lib/auth';
import { Alert, ActivityIndicator } from 'react-native';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

export default function Profile() {
  const T = useTokens();
  const { preference, setPreference } = useThemeControls();
  const { data: profile, isLoading } = useDriverProfile();

  const badge = profile ? availabilityBadge(profile.availability) : null;

  return (
    <AppFrame>
      <AppHeader title="Profile"/>

      {/* Identity card */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32, backgroundColor: T.heroBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {isLoading ? (
              <ActivityIndicator color={T.heroFg}/>
            ) : (
              <Text style={{ color: T.heroFg, fontSize: 22, fontWeight: '700', letterSpacing: 0.5 }}>
                {profile?.initials ?? '—'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, letterSpacing: -0.4 }}>
              {profile?.name ?? '—'}
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, marginTop: 2, fontFamily: MONO }}>
              {profile?.phone ?? '—'}
            </Text>
            {badge && (
              <View style={{
                alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: 9999, backgroundColor: badge.on ? T.doneBg : T.raised,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}>
                <Icon name="checkCirc" size={11} color={badge.on ? T.doneFg : T.muted}/>
                <Text style={{
                  fontSize: 11, fontWeight: '700',
                  color: badge.on ? T.doneFg : T.muted, letterSpacing: 0.3,
                }}>
                  {profile?.isActive === false ? 'INACTIVE' : badge.label}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </View>

      <SectionLabel>Driver info</SectionLabel>
      <Card style={{ marginHorizontal: 16, marginBottom: 18, overflow: 'hidden' }}>
        <InfoRow k="License class"   v={profile?.licenseClass || '—'}/>
        <InfoRow k="Organisation"    v={profile?.org.name ?? '—'}/>
        <InfoRow k="Vehicle assigned" v={formatVehicleLine(profile?.vehicle ?? null)} last/>
      </Card>

      <SectionLabel
        right={
          <Pressable
            onPress={() => router.push('/profile/time-off')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="plus" size={14} color={T.primary}/>
            <Text style={{ fontSize: 13, color: T.primary, fontWeight: '700' }}>Request Time Off</Text>
          </Pressable>
        }
      >Time Off</SectionLabel>
      <TimeOffList/>

      <SectionLabel>Appearance</SectionLabel>
      <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
        <Text style={{ fontSize: 11, color: T.mutedLight, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Theme
        </Text>
        <View style={{ flexDirection: 'row', backgroundColor: T.raised, borderRadius: 8, padding: 4, marginTop: 8 }}>
          {(['system', 'light', 'dark'] as const).map(p => {
            const sel = p === preference;
            return (
              <Pressable
                key={p}
                onPress={() => setPreference(p)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center',
                  backgroundColor: sel ? T.surface : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: sel ? '700' : '500',
                  color: sel ? T.text : T.muted,
                  textTransform: 'capitalize',
                }}>{p}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ marginHorizontal: 16, marginVertical: 24, alignItems: 'center' }}>
        <Pressable onPress={async () => { await signOut(); router.replace('/sign-in'); }}>
          <Text style={{ fontSize: 15, color: T.red, fontWeight: '700' }}>Sign Out</Text>
        </Pressable>
      </View>
    </AppFrame>
  );
}

// -----------------------------------------------------------------------------
// TimeOffList — live driver_time_off rows. Pending rows surface a Cancel
// affordance (calls cancel_driver_time_off RPC). Approved/rejected rows are
// read-only — drivers must talk to dispatcher.
// -----------------------------------------------------------------------------
function TimeOffList() {
  const T = useTokens();
  const { data, isLoading, error } = useDriverTimeOff();
  const cancel = useCancelTimeOff();

  if (isLoading) {
    return (
      <Card style={{ marginHorizontal: 16, marginBottom: 18, paddingVertical: 28, alignItems: 'center' }}>
        <ActivityIndicator color={T.muted}/>
      </Card>
    );
  }
  if (error) {
    return (
      <Card style={{ marginHorizontal: 16, marginBottom: 18, paddingHorizontal: 16, paddingVertical: 14 }}>
        <Text style={{ fontSize: 13, color: T.red }}>Couldn&apos;t load time off.</Text>
      </Card>
    );
  }
  const rows = (data ?? []).filter(r => new Date(r.endsAt) > new Date());
  if (rows.length === 0) {
    return (
      <Card style={{ marginHorizontal: 16, marginBottom: 18, paddingHorizontal: 16, paddingVertical: 18 }}>
        <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>
          No upcoming time off. Tap &ldquo;Request Time Off&rdquo; to plan a day.
        </Text>
      </Card>
    );
  }

  function onCancel(id: string) {
    Alert.alert(
      'Withdraw request?',
      'You can submit a new one any time before approval.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try { await cancel.mutateAsync(id); }
            catch (err) {
              const msg = err instanceof Error ? err.message : 'Cancel failed.';
              Alert.alert('Could not withdraw', msg);
            }
          },
        },
      ],
    );
  }

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 18, paddingHorizontal: 16, paddingVertical: 14 }}>
      {rows.map((t, i) => (
        <TimeOffRow
          key={t.id}
          entry={t}
          last={i === rows.length - 1}
          onCancel={() => onCancel(t.id)}
          cancelling={cancel.isPending && cancel.variables === t.id}
        />
      ))}
    </Card>
  );
}

function statusVisuals(T: ReturnType<typeof useTokens>, status: TimeOffStatus) {
  switch (status) {
    case 'pending':  return { dot: T.pendingDot, bg: T.pendingBg, fg: T.pendingFg, label: 'PENDING' };
    case 'approved': return { dot: T.doneDot,    bg: T.doneBg,    fg: T.doneFg,    label: 'APPROVED' };
    case 'rejected': return { dot: T.red,        bg: T.redSoft,   fg: T.redFg,     label: 'REJECTED' };
  }
}

function formatRange(startsAt: string, endsAt: string): { range: string; days: number } {
  const s = new Date(startsAt);
  // ends_at is the exclusive end (next day 00:00). Subtract a millisecond for
  // a human-friendly "to" date.
  const eExclusive = new Date(endsAt);
  const eInclusive = new Date(eExclusive.getTime() - 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' });
  const sameDay = s.toDateString() === eInclusive.toDateString();
  const range = sameDay ? fmt(s) : `${fmt(s)} – ${fmt(eInclusive)}`;
  const days = Math.max(1, Math.round((eExclusive.getTime() - s.getTime()) / 86400000));
  return { range, days };
}

function TimeOffRow({
  entry, last, onCancel, cancelling,
}: { entry: TimeOffEntry; last: boolean; onCancel: () => void; cancelling: boolean }) {
  const T = useTokens();
  const v = statusVisuals(T, entry.status);
  const { range, days } = formatRange(entry.startsAt, entry.endsAt);
  const canCancel = entry.status === 'pending';

  return (
    <View style={{
      paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: T.border,
    }}>
      <View style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: v.dot }}/>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{range}</Text>
        <Text style={{ fontSize: 12, color: T.muted }}>
          {days} {days === 1 ? 'day' : 'days'} · {REASON_LABEL[entry.reason]}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999,
          backgroundColor: v.bg,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: v.fg }}>
            {v.label}
          </Text>
        </View>
        {canCancel && (
          <Pressable onPress={onCancel} disabled={cancelling} style={{ paddingVertical: 2 }}>
            <Text style={{ fontSize: 12, color: T.red, fontWeight: '600' }}>
              {cancelling ? 'Withdrawing…' : 'Withdraw'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InfoRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const T = useTokens();
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: T.border,
    }}>
      <Text style={{
        fontSize: 11, color: T.mutedLight, fontWeight: '700',
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{k}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: T.text, marginTop: 3 }}>{v}</Text>
    </View>
  );
}
