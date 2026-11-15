import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

export type TabItem = {
  key: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
  /** A red dot on the icon (Profile uses it for an app update). */
  badge?: boolean;
};

/** The floating pill: the current tab shows icon and word, the others icon only. */
export function TabBar({ tabs }: { tabs: TabItem[] }) {
  const T = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: insets.bottom + space[3],
        backgroundColor: 'transparent',
      }}
    >
      <View style={{
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        padding: 6, borderRadius: radius.pill, backgroundColor: T.surface, boxShadow: T.shadow2,
      }}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.badge ? `${t.label}, update available` : t.label}
            accessibilityState={{ selected: t.active }}
            onPress={t.onPress}
            style={{
              minHeight: 44, minWidth: 44, borderRadius: radius.pill,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
              paddingHorizontal: t.active ? space[4] : space[3],
              backgroundColor: t.active ? T.ink : 'transparent',
            }}
          >
            <View>
              <Icon name={t.icon} size={20} stroke={2.2} color={t.active ? T.onInk : T.text2}/>
              {t.badge ? (
                <View
                  testID={`tab-badge-${t.key}`}
                  style={{ position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: radius.pill, backgroundColor: T.red }}
                />
              ) : null}
            </View>
            {t.active ? <Text style={{ fontSize: 14, fontWeight: '600', color: T.onInk }}>{t.label}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export type TabConfig = Record<string, { label: string; icon: IconName; badge?: boolean }>;

/**
 * Adapter for expo-router's `tabBar` option: `tabBar={(p) => renderTabBar(p, config)}`.
 * Routes missing from `config` (hidden screens) get no tab.
 */
export function renderTabBar({ state, navigation }: BottomTabBarProps, config: TabConfig) {
  const tabs: TabItem[] = [];
  state.routes.forEach((route, index) => {
    const c = config[route.name];
    if (!c) return;
    const active = state.index === index;
    tabs.push({
      key: route.name,
      label: c.label,
      icon: c.icon,
      badge: c.badge,
      active,
      onPress: () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!active && !event.defaultPrevented) navigation.navigate(route.name);
      },
    });
  });
  return <TabBar tabs={tabs}/>;
}
