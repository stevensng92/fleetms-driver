import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';

// Bottom tab bar — visually approximates iOS UITabBar / Material 3 Navigation Bar.
export default function TabsLayout() {
  const T = useTokens();
  const versionGate = useAppVersionGate();
  // Persistent — does NOT get dismissed like the Jobs-tab banner. Stays until
  // the driver actually updates (status flips back to 'ok').
  const showBadge = versionGate.status !== 'ok';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor: T.border,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 8,
          paddingBottom: 30, // approximated iOS safe area; RN handles the actual inset
        },
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.mutedLight,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '500', letterSpacing: 0.1 },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Icon name="home" size={24} stroke={focused ? 2.2 : 1.8} color={color}/>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="receipt" size={24} stroke={focused ? 2.2 : 1.8} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="wallet" size={24} stroke={focused ? 2.2 : 1.8} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Icon name="user" size={24} stroke={focused ? 2.2 : 1.8} color={color}/>
              {showBadge && (
                <View style={{
                  position: 'absolute', top: -2, right: -4,
                  width: 8, height: 8, borderRadius: 4,
                  borderWidth: 1.5, borderColor: T.page,
                  backgroundColor: T.red,
                }}/>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
