import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useTokens } from '../theme/ThemeProvider';
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.surface }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: T.border,
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, letterSpacing: -0.4 }}>
          Notifications
        </Text>
        <Pressable
          onPress={() => router.back()}
          // Icon-only — no fill. Avoids the contrast block on top of the
          // header that didn't match the rest of the surface.
          style={({ pressed }) => ({
            width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
          hitSlop={8}
        >
          <Icon name="x" size={18} color={T.muted}/>
        </Pressable>
      </View>

      {isLoading && (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={T.muted}/>
        </View>
      )}

      {error && (
        <View style={{ padding: 20 }}>
          <View style={{
            padding: 14, borderRadius: 10,
            borderWidth: 1, borderColor: T.redSoft, backgroundColor: T.redSoft,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.redFg, marginBottom: 4 }}>
              Couldn&apos;t load notifications
            </Text>
            <Text style={{ fontSize: 13, color: T.redFg, marginBottom: 10 }}>
              {(error as Error).message}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={{
                alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 6, borderWidth: 1, borderColor: T.red,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.red }}>Retry</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <View style={{ paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 }}>
          <Icon name="bell" size={40} color={T.mutedLight}/>
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.text, marginTop: 14 }}>
            No notifications yet
          </Text>
          <Text style={{ fontSize: 13, color: T.muted, marginTop: 6, textAlign: 'center' }}>
            New job assignments and pickup reminders will appear here.
          </Text>
        </View>
      )}

      {data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {data.map((n, i) => (
            <NotificationRow
              key={n.id}
              item={n}
              isLast={i === data.length - 1}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ item, isLast }: { item: NotificationItem; isLast: boolean }) {
  const T = useTokens();
  const unread = item.readAt === null;
  const time = formatDateTime(item.enqueuedAt, { day: '2-digit', month: 'short' });

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
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.border,
        backgroundColor: pressed ? T.raised : 'transparent',
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
      })}
    >
      <View style={{
        marginTop: 6,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: unread ? T.red : 'transparent',
      }}/>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.body && (
          <Text style={{ fontSize: 13, color: T.muted, marginTop: 3 }} numberOfLines={2}>
            {item.body}
          </Text>
        )}
        <Text style={{ fontSize: 11, color: T.mutedLight, marginTop: 4 }}>
          {time}
        </Text>
      </View>
    </Pressable>
  );
}
