import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppProvider } from './src/AppState';
import Icon, { IconName } from './src/components/Icon';
import ControlScreen from './src/screens/ControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WatchingScreen from './src/screens/WatchingScreen';
import { C } from './src/theme';

type Tab = 'control' | 'watching' | 'settings';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'control', label: 'Controle', icon: 'remote' },
  { key: 'watching', label: 'Assistindo', icon: 'play' },
  { key: 'settings', label: 'Ajustes', icon: 'gear' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('control');
  return (
    <AppProvider>
      <SafeAreaView style={st.root}>
        <StatusBar style="light" />
        <View style={{ flex: 1, paddingTop: 28 }}>
          {tab === 'control' ? <ControlScreen /> : tab === 'watching' ? <WatchingScreen /> : <SettingsScreen />}
        </View>
        <View style={st.nav}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} style={st.navItem} onPress={() => setTab(t.key)}>
                <Icon name={t.icon} color={on ? C.acc : C.mut} />
                <Text style={[st.navTxt, on && { color: C.acc }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </AppProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  nav: { height: 68, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#0e1014' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navTxt: { color: C.mut, fontSize: 11 },
});
