import AsyncStorage from '@react-native-async-storage/async-storage';

export type Shortcut = { pkg: string; label: string };
export type Saved = { id: string; title: string; url: string; pkg?: string; appLabel?: string; at: number };
export type Step =
  | { type: 'power' }
  | { type: 'app'; pkg: string; label: string }
  | { type: 'alexa'; device: string }
  | { type: 'wait'; seconds: number }
  | { type: 'sleep'; minutes: number };
export type Automation = { id: string; name: string; steps: Step[] };

export type Settings = {
  vibrate: boolean;
  volumeKeys: boolean;
  notification: boolean;
  projectorIp: string;
  voiceMonkeyToken: string;
};

const DEFAULTS: Settings = {
  vibrate: true,
  volumeKeys: true,
  notification: true,
  projectorIp: '',
  voiceMonkeyToken: '',
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const getSettings = async () => ({ ...DEFAULTS, ...(await read<Partial<Settings>>('settings', {})) });
export const saveSettings = (s: Settings) => write('settings', s);

export const getShortcuts = () => read<Shortcut[] | null>('shortcuts', null);
export const saveShortcuts = (s: Shortcut[]) => write('shortcuts', s);

export const getSaved = () => read<Saved[]>('saved', []);
export const saveSaved = (s: Saved[]) => write('saved', s);

export const getAutomations = () =>
  read<Automation[]>('automations', [
    {
      id: 'cinema',
      name: 'Modo cinema',
      steps: [{ type: 'power' }, { type: 'wait', seconds: 25 }, { type: 'alexa', device: 'modo-cinema' }],
    },
    { id: 'dormir', name: 'Hora de dormir', steps: [{ type: 'sleep', minutes: 30 }] },
  ]);
export const saveAutomations = (a: Automation[]) => write('automations', a);

export const uid = () => Math.random().toString(36).slice(2, 10);
