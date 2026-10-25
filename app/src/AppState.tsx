import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, ToastAndroid } from 'react-native';
import Native, { HidStateEvent } from '../modules/projector-native';
import { projector, ProjectorApp } from './lib/projector';
import { setVibrate } from './lib/remote';
import {
  Automation, getAutomations, getSaved, getSettings, getShortcuts, Saved, saveAutomations,
  saveSaved, saveSettings, saveShortcuts, Settings, Shortcut, uid,
} from './lib/store';

type Ctx = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  hid: { state: HidStateEvent['state']; name: string | null };
  wifiOk: boolean;
  hasIr: boolean;
  hasPowerCode: boolean;
  refreshIr: () => void;
  apps: ProjectorApp[];
  refreshApps: () => Promise<void>;
  shortcuts: Shortcut[];
  setShortcuts: (s: Shortcut[]) => void;
  saved: Saved[];
  setSaved: (s: Saved[]) => void;
  automations: Automation[];
  setAutomations: (a: Automation[]) => void;
  toast: (msg: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppCtx');
  return c;
};

// Pacotes conhecidos dos apps de TV, para abrir o link no app certo.
const URL_APPS: { match: RegExp; pkg: string; label: string }[] = [
  { match: /netflix\.com/i, pkg: 'com.netflix.ninja', label: 'Netflix' },
  { match: /(youtube\.com|youtu\.be)/i, pkg: 'com.google.android.youtube.tv', label: 'YouTube' },
  { match: /(primevideo\.com|amazon\.com)/i, pkg: 'com.amazon.amazonvideo.livingroom', label: 'Prime Video' },
  { match: /(disneyplus\.com|disney\.com)/i, pkg: 'com.disney.disneyplus', label: 'Disney+' },
  { match: /globoplay/i, pkg: 'com.globo.globotv', label: 'Globoplay' },
  { match: /(max\.com|hbomax)/i, pkg: 'com.wbd.stream', label: 'Max' },
];

async function canUseBluetooth() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
}

async function askPermissions() {
  if (Platform.OS !== 'android') return;
  const wanted: string[] = [];
  const v = Number(Platform.Version);
  if (v >= 31) {
    wanted.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
    );
  }
  if (v >= 33) wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (wanted.length) await PermissionsAndroid.requestMultiple(wanted as any);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hid, setHid] = useState<Ctx['hid']>({ state: 'off', name: null });
  const [wifiOk, setWifiOk] = useState(false);
  const [hasIr, setHasIr] = useState(false);
  const [hasPowerCode, setHasPowerCode] = useState(false);
  const [apps, setApps] = useState<ProjectorApp[]>([]);
  const [shortcuts, setShortcutsState] = useState<Shortcut[]>([]);
  const [saved, setSavedState] = useState<Saved[]>([]);
  const [automations, setAutomationsState] = useState<Automation[]>([]);
  const settingsRef = useRef<Settings | null>(null);
  const savedRef = useRef<Saved[]>([]);

  const toast = useCallback((msg: string) => ToastAndroid.show(msg, ToastAndroid.SHORT), []);

  const refreshIr = useCallback(() => {
    try {
      setHasIr(Native.hasIr());
      setHasPowerCode(Native.hasPowerCode());
    } catch {}
  }, []);

  const setSaved = useCallback((s: Saved[]) => {
    savedRef.current = s;
    setSavedState(s);
    saveSaved(s);
  }, []);

  const handleShare = useCallback(
    (text: string) => {
      const url = text.match(/https?:\/\/\S+/)?.[0];
      if (!url) return;
      let title = text.replace(url, '').replace(/\s+/g, ' ').trim();
      title = title.replace(/^(assista|watch|veja)\s*/i, '').replace(/[:\-–]+$/, '').trim();
      const app = URL_APPS.find((a) => a.match.test(url));
      if (!title) title = app ? `Algo da ${app.label}` : 'Link salvo';
      const item: Saved = { id: uid(), title: title.slice(0, 80), url, pkg: app?.pkg, appLabel: app?.label, at: Date.now() };
      setSaved([item, ...savedRef.current.filter((s) => s.url !== url)]);
      toast('Salvo em Assistindo');
    },
    [setSaved, toast]
  );

  // ---- inicialização ----
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      settingsRef.current = s;
      setSettings(s);
      setVibrate(s.vibrate);
      const sv = await getSaved();
      savedRef.current = sv;
      setSavedState(sv);
      setAutomationsState(await getAutomations());
      const sc = await getShortcuts();
      if (sc) setShortcutsState(sc);

      await askPermissions();
      try {
        Native.startHid();
        Native.setVolumeKeys(s.volumeKeys);
        if (s.notification && (await canUseBluetooth())) Native.startService();
        const st = Native.hidState();
        setHid({ state: st.state, name: st.name });
      } catch {}
      refreshIr();

      const shared = Native.consumeShare();
      if (shared) handleShare(shared);
    })();

    const a = Native.addListener('onHidState', (e) => setHid({ state: e.state, name: e.name }));
    const b = Native.addListener('onShare', () => {
      const t = Native.consumeShare();
      if (t) handleShare(t);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, [handleShare, refreshIr]);

  // conecta de novo ao último projetor quando o Bluetooth fica pronto
  useEffect(() => {
    if (hid.state !== 'ready') return;
    // tenta reconectar agora e a cada 15 s, até o projetor ligar e aceitar
    const tryConnect = () => {
      const last = Native.lastDevice();
      if (last) Native.connect(last).catch(() => {});
    };
    tryConnect();
    const t = setInterval(tryConnect, 15000);
    return () => clearInterval(t);
  }, [hid.state]);

  const refreshApps = useCallback(async () => {
    const ip = settingsRef.current?.projectorIp;
    if (!ip) return;
    try {
      const list = await projector.apps(ip);
      setApps(list);
      setWifiOk(true);
      // primeira vez: monta os atalhos com os apps do projetor
      const current = await getShortcuts();
      if (!current) {
        const first = list.filter((x) => !/settings|configura|launcher|activitylauncher|f-?droid/i.test(x.pkg + x.label)).slice(0, 8);
        setShortcutsState(first);
        saveShortcuts(first);
      }
    } catch {
      setWifiOk(false);
    }
  }, []);

  // checa o Wi-Fi do projetor de tempos em tempos
  useEffect(() => {
    if (!settings?.projectorIp) return;
    refreshApps();
    const t = setInterval(async () => {
      const ok = !!(await projector.ping(settings.projectorIp));
      setWifiOk(ok);
    }, 15000);
    return () => clearInterval(t);
  }, [settings?.projectorIp, refreshApps]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...(settingsRef.current as Settings), ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    if ('vibrate' in patch) setVibrate(next.vibrate);
    if ('volumeKeys' in patch) Native.setVolumeKeys(next.volumeKeys);
    if ('notification' in patch) {
      if (!next.notification) Native.stopService();
      else canUseBluetooth().then((ok) => ok && Native.startService());
    }
  }, []);

  const setShortcuts = useCallback((s: Shortcut[]) => {
    setShortcutsState(s);
    saveShortcuts(s);
  }, []);

  const setAutomations = useCallback((a: Automation[]) => {
    setAutomationsState(a);
    saveAutomations(a);
  }, []);

  if (!settings) return null;

  return (
    <AppCtx.Provider
      value={{
        settings, updateSettings, hid, wifiOk, hasIr, hasPowerCode, refreshIr, apps, refreshApps,
        shortcuts, setShortcuts, saved, setSaved, automations, setAutomations, toast,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}
