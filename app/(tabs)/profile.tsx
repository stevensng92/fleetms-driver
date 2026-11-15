import React from 'react';
import { View, Text, Pressable, Linking, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Band } from '../../components/Band';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Segmented } from '../../components/Segmented';
import { useTokens, useThemeControls } from '../../theme/ThemeProvider';
import { fontFor, radius, space, TABULAR, type } from '../../theme/tokens';
import { useDriverProfile, formatVehicleLine, availabilityBadge } from '../../lib/queries/driverProfile';
import { useDriverTimeOff, REASON_LABEL, type TimeOffEntry, type TimeOffStatus } from '../../lib/queries/timeOff';
import { useCancelTimeOff } from '../../lib/mutations/timeOff';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';
import { signOut } from '../../lib/auth';
import { formatDate, myDateKey } from '../../lib/timeFormat';

/** 'AVAILABLE' becomes 'Available': the words stay, the capitals go (change 2). */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const APP_DOWNLOAD_URL = 'https://app.fleetms.my/driver-app';

export default function Profile() {
  const T = useTokens();
  const { preference, setPreference } = useThemeControls();
  const { data: profile, isLoading } = useDriverProfile();
  const versionGate = useAppVersionGate();

  const badge = profile ? availabilityBadge(profile.availability) : null;

  return (
    <AppFrame bg={T.ground}>
      <AppHeader title="Profile"/>

      {/* Identity card */}
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5] }}>
          <View style={{
            width: 56, height: 56, borderRadius: radius.pill, backgroundColor: T.feature,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {isLoading ? (
              <ActivityIndicator color={T.onFeature}/>
            ) : (
              <Text style={[type.title, { color: T.onFeature }]}>
                {profile?.initials ?? '—'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: space[1], alignItems: 'flex-start' }}>
            <Text style={[type.title, { color: T.text }]}>
              {profile?.name ?? '—'}
            </Text>
            <Text style={[type.label, TABULAR, { color: T.text2 }]}>
              {profile?.phone ?? '—'}
            </Text>
            {badge && (
              <View style={{ marginTop: space[1] }}>
                <Pill tone={badge.on && profile?.isActive !== false ? 'green' : 'neutral'} icon={badge.on && profile?.isActive !== false ? 'circleCheck' : 'circleAlert'}>
                  {profile?.isActive === false ? 'Inactive' : sentenceCase(badge.label)}
                </Pill>
              </View>
            )}
          </View>
        </Card>
      </View>

      {versionGate.status !== 'ok' && (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
          <UpdateAvailableRow/>
        </View>
      )}

      <SectionLabel>Driver info</SectionLabel>
      <Card style={{ marginHorizontal: space[4], marginBottom: space[5], overflow: 'hidden' }}>
        <InfoRow k="License class"   v={profile?.licenseClass || '—'}/>
        <InfoRow k="Organisation"    v={profile?.org.name ?? '—'}/>
        <InfoRow k="Vehicle assigned" v={formatVehicleLine(profile?.vehicle ?? null)} last/>
      </Card>

      <SectionLabel
        right={
          <Button variant="secondary" icon="plus" onPress={() => router.push('/profile/time-off')}>
            Request time off
          </Button>
        }
      >Time off</SectionLabel>
      <TimeOffList/>

      <SectionLabel>Appearance</SectionLabel>
      <Card style={{ marginHorizontal: space[4], marginBottom: space[3], padding: space[5], gap: space[3] }}>
        <Text style={[type.label, { color: T.text2 }]}>
          Theme
        </Text>
        <Segmented
          block
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={preference}
          onChange={setPreference}
        />
      </Card>

      <View style={{ marginHorizontal: space[4], marginVertical: space[6] }}>
        <Button
          variant="secondary"
          full
          icon="logOut"
          onPress={async () => { await signOut(); router.replace('/sign-in'); }}
        >
          Sign out
        </Button>
      </View>
    </AppFrame>
  );
}

// -----------------------------------------------------------------------------
// UpdateAvailableRow — soft-nag entry point on the Profile screen. Mirrors the
// visual style of the "Driver info" Card rows. Shown whenever the version
// gate isn't 'ok' (covers both 'recommended' and 'required', though the
// 'required' case is normally intercepted earlier by UpdateRequiredScreen).
// -----------------------------------------------------------------------------
function UpdateAvailableRow() {
  const T = useTokens();
  return (
    <Card style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={() => { Linking.openURL(APP_DOWNLOAD_URL); }}
        accessibilityRole="link"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          padding: space[4],
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{
          width: 40, height: 40, borderRadius: radius.pill,
          backgroundColor: T.amberSoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="circleArrowUp" size={20} color={T.amberText}/>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[type.title, { color: T.text }]}>
            Update available
          </Text>
          <Text style={[type.caption, { color: T.text2 }]}>
            A newer version of FleetMS Driver is ready to install
          </Text>
        </View>
        <Icon name="chevR" size={18} color={T.text3}/>
      </Pressable>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// TimeOffList: live driver_time_off rows. Pending rows surface a Cancel
// affordance (calls cancel_driver_time_off RPC). Approved/rejected rows are
// read-only: drivers must talk to dispatcher.
// -----------------------------------------------------------------------------
function TimeOffList() {
  const T = useTokens();
  const { data, isLoading, error } = useDriverTimeOff();
  const cancel = useCancelTimeOff();

  if (isLoading) {
    return (
      <Card style={{ marginHorizontal: space[4], marginBottom: space[5], paddingVertical: space[7], alignItems: 'center' }}>
        <ActivityIndicator color={T.text2}/>
      </Card>
    );
  }
  if (error) {
    return (
      <Band tone="red" style={{ marginHorizontal: space[4], marginBottom: space[5] }}>
        Couldn&apos;t load time off.
      </Band>
    );
  }
  const rows = (data ?? []).filter(r => new Date(r.endsAt) > new Date());
  if (rows.length === 0) {
    return (
      <Card style={{ marginHorizontal: space[4], marginBottom: space[5], paddingHorizontal: space[4], paddingVertical: space[5] }}>
        <Text style={[type.label, { color: T.text2, textAlign: 'center' }]}>
          No upcoming time off. Tap &ldquo;Request time off&rdquo; to plan a day.
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
    <Card style={{ marginHorizontal: space[4], marginBottom: space[5], paddingHorizontal: space[5], paddingVertical: space[2] }}>
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

const STATUS_PILL: Record<TimeOffStatus, { label: string; tone: 'amber' | 'green' | 'red'; icon: 'clock' | 'circleCheck' | 'circleX' }> = {
  pending:  { label: 'Pending',  tone: 'amber', icon: 'clock' },
  approved: { label: 'Approved', tone: 'green', icon: 'circleCheck' },
  rejected: { label: 'Rejected', tone: 'red',   icon: 'circleX' },
};

function formatRange(startsAt: string, endsAt: string): { range: string; days: number } {
  const s = new Date(startsAt);
  // ends_at is the exclusive end (next day 00:00). Subtract a millisecond for
  // a human-friendly "to" date.
  const eExclusive = new Date(endsAt);
  const eInclusive = new Date(eExclusive.getTime() - 1);
  // MY-pinned: these ranges were submitted as MY days (lib/mutations/timeOff.ts),
  // so rendering them device-local could show a different day than was booked.
  const fmt = (d: Date) => formatDate(d);
  const sameDay = myDateKey(s) === myDateKey(eInclusive);
  const range = sameDay ? fmt(s) : `${fmt(s)} to ${fmt(eInclusive)}`;
  const days = Math.max(1, Math.round((eExclusive.getTime() - s.getTime()) / 86400000));
  return { range, days };
}

function TimeOffRow({
  entry, last, onCancel, cancelling,
}: { entry: TimeOffEntry; last: boolean; onCancel: () => void; cancelling: boolean }) {
  const T = useTokens();
  const v = STATUS_PILL[entry.status];
  const { range, days } = formatRange(entry.startsAt, entry.endsAt);
  const canCancel = entry.status === 'pending';

  return (
    <View style={{
      paddingVertical: space[3],
      flexDirection: 'row', alignItems: 'flex-start', gap: space[3],
      borderBottomWidth: last ? 0 : 1, borderBottomColor: T.hairline,
    }}>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={[type.title, { color: T.text }]}>{range}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[3], rowGap: space[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Icon name="calendarDays" size={13} color={T.text3}/>
            <Text style={[type.caption, { color: T.text2 }]}>{days} {days === 1 ? 'day' : 'days'}</Text>
          </View>
          <Text style={[type.caption, { color: T.text2 }]}>{REASON_LABEL[entry.reason]}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[2] }}>
        <Pill tone={v.tone} icon={v.icon}>{v.label}</Pill>
        {canCancel && (
          <Pressable onPress={onCancel} disabled={cancelling} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.caption, { fontFamily: fontFor('600'), fontWeight: '600', color: T.redText }]}>
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
      paddingHorizontal: space[5], paddingVertical: space[4], gap: space[1],
      borderBottomWidth: last ? 0 : 1, borderBottomColor: T.hairline,
    }}>
      <Text style={[type.label, { color: T.text2 }]}>{k}</Text>
      <Text style={[type.title, { color: T.text }]}>{v}</Text>
    </View>
  );
}
