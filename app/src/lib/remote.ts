import * as Haptics from 'expo-haptics';
import Native from '../../modules/projector-native';
import { getSettings } from './store';

// Códigos HID (teclado e controle de mídia) que o Android do projetor entende.
export const KEY = { UP: 0x52, DOWN: 0x51, LEFT: 0x50, RIGHT: 0x4f, ENTER: 0x28, BACKSPACE: 0x2a } as const;
export const MEDIA = {
  BACK: 0x224,
  HOME: 0x223,
  MENU: 0x40,
  VOL_UP: 0xe9,
  VOL_DOWN: 0xea,
  MUTE: 0xe2,
  PLAY_PAUSE: 0xcd,
  FAST_FORWARD: 0xb3,
  REWIND: 0xb4,
  POWER: 0x30,
} as const;

let vibrate = true;
export function setVibrate(v: boolean) {
  vibrate = v;
}
getSettings().then((s) => (vibrate = s.vibrate));

export function buzz() {
  if (vibrate) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export const remote = {
  key(usage: number) {
    buzz();
    return Native.key(usage, 0);
  },
  media(usage: number) {
    buzz();
    return Native.consumer(usage);
  },
  move(dx: number, dy: number) {
    return Native.mouseMove(Math.round(dx), Math.round(dy), 0);
  },
  scroll(amount: number) {
    return Native.mouseMove(0, 0, Math.round(amount));
  },
  click() {
    buzz();
    return Native.click();
  },
  type(text: string) {
    return Native.typeText(text);
  },
  power() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    return Native.power();
  },
};
