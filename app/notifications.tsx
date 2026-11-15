import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';
import { Band } from '../components/Band';
import { Button } from '../components/Button';
import { useTokens } from '../theme/ThemeProvider';
import { TABULAR, radius, space, type } from '../theme/tokens';
import {
  useNotifications,
  useMarkNotificationsRead,
  type NotificationItem,
} from '../lib/queries/notifications';
import { formatDateTime } from '../lib/timeFormat';

// Notifications inbox. Opens from the bell button on the Jobs tab.
//
// On mount we eagerly mark everything currently visible as read so the bell
// badge clears the moment the user opens the screen — same UX as iOS Mail.
// Taps still deeplink to the underlying job (or whatever the payload says).

export default function Notifications() {
  const T = useTokens();
  const { data, isLoading, error, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (!data) return;
    const unread = data.filter(n => n.readAt === null).map(n => n.id);
    if (unread.length > 0) markRead.mutate(unread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.length]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.ground }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[4],
      }}>
        <Text style={[type.figure, { color: T.text }]}>
          Notifications
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 44, height: 44, marginRight: -space[3], alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
          hitSlop={8}
        >
          <Icon name="x" size={20} color={T.text2}/>
        </Pressable>
      </View>

      {isLoading && (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={T.text2}/>
        </View>
      )}

      {error && (
        <View style={{ paddingHorizontal: space[4] }}>
          <Band
            tone="red"
            action={<Button variant="secondary" onPress={() => refetch()}>Retry</Button>}
          >
            <Text style={[type.title, { color: T.redText, marginBottom: space[1] }]}>
              Couldn&apos;t load notifications
            </Text>
            <Text style={[type.label, { color: T.redText }]}>
              {(error as Error).message}
            </Text>
          </Band>
        </View>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <View style={{ paddingHorizontal: space[4] }}>
          <Card style={{ alignItems: 'center', paddingVertical: space[8], paddingHorizontal: space[8] }}>
            <Icon name="bell" size={32} color={T.text3}/>
            <Text style={[type.title, { color: T.text, marginTop: space[3] }]}>
              No notifications yet
            </Text>
            <Text style={[type.label, { color: T.text2, marginTop: space[2], textAlign: 'center' }]}>
              New job assignments and pickup reminders will appear here.
            </Text>
          </Card>
        </View>
      )}

      {data && data.length > 0 && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ overflow: 'hidden' }}>
            {data.map((n, i) => (
              <NotificationRow
                key={n.id}
                item={n}
                isLast={i === data.length - 1}
              />
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ item, isLast }: { item: NotificationItem; isLast: boolean }) {
  const T = useTokens();
  const unread = item.readAt === null;
  const time = formatDateTime(item.enqueuedAt, { weekday: false });

  // Deeplinks come from server-controlled push_log.payload.deeplink. Allowlist
  // by prefix so a compromised/bug-buggy trigger can't route the driver to
  // an unexpected screen. Expo Router resolves only the app's route tree so
  // there's no RCE here — this is defence-in-depth against routing bugs.
  function onPress() {
    if (!item.deeplink) return;
    const ALLOWED = ['/jobs/', '/notifications', '/(tabs)', '/profile/'];
    if (ALLOWED.some(p => item.deeplink!.startsWith(p))) {
      router.push(item.deeplink as '/');
    }
  }

  return (
    <Pressable
      onPress={onPress}
      // Unread = subtle red dot only (industry standard: iOS Mail, Slack).
      // No row-wide background tint — that read as "selected" rather than
      // "unread" and clashed visually with the header.
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: space[5], paddingVertical: space[4],
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.hairline,
        backgroundColor: pressed ? T.surfaceSunk : 'transparent',
        flexDirection: 'row', gap: space[3], alignItems: 'flex-start',
      })}
    >
      <View style={{
        marginTop: 6,
        width: 8, height: 8, borderRadius: radius.pill,
        backgroundColor: unread ? T.red : 'transparent',
      }}/>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={[type.title, { color: T.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.body && (
          <Text style={[type.label, { color: T.text2 }]} numberOfLines={2}>
            {item.body}
          </Text>
        )}
        <Text style={[type.caption, TABULAR, { color: T.text3 }]}>
          {time}
        </Text>
      </View>
    </Pressable>
  );
}
