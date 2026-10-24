import { requireNativeModule } from 'expo-modules-core';

type HidStateEvent = { state: 'off' | 'starting' | 'ready' | 'connected'; name: string | null };

interface ProjectorNativeModule {
  startHid(): string;
  hidState(): { state: HidStateEvent['state']; name: string | null; bluetoothOn: boolean };
  bondedDevices(): { name: string; address: string }[];
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

export type { HidStateEvent };
export default requireNativeModule<ProjectorNativeModule>('ProjectorNative');
