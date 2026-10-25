import { requireNativeModule } from 'expo-modules-core';

type HidStateEvent = { state: 'off' | 'starting' | 'ready' | 'connected'; name: string | null };

interface ProjectorNativeModule {
  startHid(): string;
  hidState(): { state: HidStateEvent['state']; name: string | null; bluetoothOn: boolean };
  bondedDevices(): { name: string; address: string }[];
  myName(): string;
  connect(address: string): Promise<boolean>;
  lastDevice(): string | null;
  disconnect(): Promise<void>;
  requestDiscoverable(): void;
  openBluetoothSettings(): void;
  key(usage: number, modifiers: number): Promise<boolean>;
  consumer(usage: number): Promise<boolean>;
  mouseMove(dx: number, dy: number, wheel: number): Promise<boolean>;
  click(): Promise<boolean>;
  typeText(text: string): Promise<boolean>;
  hasIr(): boolean;
  sendNec(address: number, command: number): Promise<boolean>;
  savePowerCode(address: number, command: number): void;
  hasPowerCode(): boolean;
  power(): Promise<void>;
  startService(): void;
  stopService(): void;
  sleepTimer(minutes: number): void;
  sleepAt(): number;
  setVolumeKeys(enabled: boolean): void;
  consumeShare(): string | null;
  addListener(event: 'onHidState', cb: (e: HidStateEvent) => void): { remove(): void };
  addListener(event: 'onShare', cb: (e: { text: string }) => void): { remove(): void };
}

export let nativeLoadError: string | null = null;

// Se a parte nativa não carregar, o app ainda abre (e mostra o erro) em vez de fechar.
function load(): ProjectorNativeModule {
  try {
    return requireNativeModule<ProjectorNativeModule>('ProjectorNative');
  } catch (e: any) {
    nativeLoadError = String(e?.message || e);
    const noop = () => {
      throw new Error('Parte nativa indisponível: ' + nativeLoadError);
    };
    return new Proxy({} as ProjectorNativeModule, {
      get: (_t, prop) => {
        if (prop === 'addListener') return () => ({ remove() {} });
        if (prop === 'hidState') return () => ({ state: 'off', name: null, bluetoothOn: false });
        if (prop === 'bondedDevices') return () => [];
        if (prop === 'myName') return () => '';
        if (prop === 'hasIr' || prop === 'hasPowerCode') return () => false;
        if (prop === 'consumeShare' || prop === 'lastDevice') return () => null;
        if (prop === 'sleepAt') return () => 0;
        return noop;
      },
    });
  }
}

export type { HidStateEvent };
export default load();
