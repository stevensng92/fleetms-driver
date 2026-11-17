import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';
import { LoadError } from '../components/LoadError';
import { Pill } from '../components/Pill';
import { useTokens } from '../theme/ThemeProvider';
import { TABULAR, space, type } from '../theme/tokens';
import {
  useNotifications,
  useMarkNotificationsRead,
  type NotificationItem,
} from '../lib/queries/notifications';
import { useClockStyle } from '../lib/clockPref';
import { notificationWords, sentAt } from '../lib/notification';

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
        <LoadError
          title="Couldn't load notifications"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
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
  const clock = useClockStyle();
  const time = sentAt(item.enqueuedAt, clock);
  // Worded here, not in the download, so the Time format setting redraws the
  // row without downloading anything.
  const { title, body } = notificationWords(item, clock);
  // A row opens its job only when it has an allowed link, already checked by
  // lib/notification.ts. Otherwise it is plain text: not pressable, no chevron.
  const { link } = item;

  const content = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text style={[type.title, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          {!!item.jobNumber && (
            <Text style={[type.caption, TABULAR, { color: T.text3 }]}>{item.jobNumber}</Text>
          )}
          {unread && <Pill tone="blue">New</Pill>}
        </View>
        {!!body && (
          <Text style={[type.label, { color: T.text2 }]} numberOfLines={2}>
            {body}
          </Text>
        )}
        <Text style={[type.caption, TABULAR, { color: T.text3 }]}>
          {time}
        </Text>
      </View>
      {link && <Icon name="chevR" size={18} color={T.text3}/>}
    </>
  );

  const rowStyle = {
    minHeight: 44,
    paddingHorizontal: space[5], paddingVertical: space[4],
    borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.hairline,
    flexDirection: 'row' as const, gap: space[3], alignItems: 'center' as const,
  };

  if (!link) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={() => router.push(link as '/')}
      accessibilityRole="button"
      style={({ pressed }) => ({ ...rowStyle, backgroundColor: pressed ? T.surfaceSunk : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}
