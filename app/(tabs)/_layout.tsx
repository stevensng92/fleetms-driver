import React from 'react';
import { Tabs } from 'expo-router';
import { renderTabBar } from '../../components/TabBar';
import { useTokens } from '../../theme/ThemeProvider';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';

// The floating pill tab bar (change 7): the current tab shows icon and word,
// the others icon only. Same four tabs, labels and icons as before.
export default function TabsLayout() {
  const T = useTokens();
  const versionGate = useAppVersionGate();
  // Persistent: does NOT get dismissed like the Jobs-tab banner. Stays until
  // the driver actually updates (status flips back to 'ok').
  const showBadge = versionGate.status !== 'ok';

  return (
    <Tabs
      tabBar={(props) => renderTabBar(props, {
        index: { label: 'Jobs', icon: 'home' },
        expenses: { label: 'Expenses', icon: 'receipt' },
        earnings: { label: 'Earnings', icon: 'wallet' },
        profile: { label: 'Profile', icon: 'user', badge: showBadge },
      })}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: T.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Jobs' }}/>
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }}/>
      <Tabs.Screen name="earnings" options={{ title: 'Earnings' }}/>
      <Tabs.Screen name="profile" options={{ title: 'Profile' }}/>
    </Tabs>
  );
}
