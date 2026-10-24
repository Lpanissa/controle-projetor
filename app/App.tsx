import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { nativeLoadError } from './modules/projector-native';
import ErrorScreen, { ErrorBoundary } from './src/ErrorScreen';
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
  const [error, setError] = useState<string | null>((global as any).__appError || null);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('appError', (m: string) => setError(m));
    return () => sub.remove();
  }, []);
  if (error) return <ErrorScreen message={error} />;
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>('control');
  return (
    <AppProvider>
      <SafeAreaView style={st.root}>
        <StatusBar style="light" />
        {nativeLoadError ? (
          <Text selectable style={{ color: '#ff4d4f', fontSize: 11, padding: 8, marginTop: 28 }}>
            Parte nativa não carregou: {nativeLoadError}
          </Text>
        ) : null}
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
