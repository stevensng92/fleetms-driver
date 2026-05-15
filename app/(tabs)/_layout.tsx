import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';

// Bottom tab bar — visually approximates iOS UITabBar / Material 3 Navigation Bar.
export default function TabsLayout() {
  const T = useTokens();

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
            <Icon name="user" size={24} stroke={focused ? 2.2 : 1.8} color={color}/>
          ),
        }}
      />
    </Tabs>
  );
}
