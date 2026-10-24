import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KEY, remote } from '../lib/remote';
import { C } from '../theme';
import Icon, { IconName } from './Icon';

const SIZE = 250;

// Segurar a seta repete o comando (para rolar listas rápido).
function useRepeat(fn: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    fn();
    timer.current = setTimeout(function tick() {
      fn();
      timer.current = setTimeout(tick, 110);
    }, 420);
  };
  return { onPressIn: start, onPressOut: stop };
}

function Arrow({ icon, usage, style }: { icon: IconName; usage: number; style: object }) {
  const rep = useRepeat(() => remote.key(usage));
  return (
    <Pressable {...rep} style={({ pressed }) => [st.arrow, style, pressed && st.pressed]} hitSlop={10}>
      <Icon name={icon} />
    </Pressable>
  );
}

export default function DPad() {
  return (
    <View style={st.pad}>
      <Arrow icon="up" usage={KEY.UP} style={{ top: 6, left: SIZE / 2 - 32 }} />
      <Arrow icon="down" usage={KEY.DOWN} style={{ bottom: 6, left: SIZE / 2 - 32 }} />
      <Arrow icon="left" usage={KEY.LEFT} style={{ left: 6, top: SIZE / 2 - 32 }} />
      <Arrow icon="right" usage={KEY.RIGHT} style={{ right: 6, top: SIZE / 2 - 32 }} />
      <Pressable onPress={() => remote.key(KEY.ENTER)} style={({ pressed }) => [st.ok, pressed && st.pressed]}>
        <Text style={st.okTxt}>OK</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  pad: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  arrow: { position: 'absolute', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  ok: {
    position: 'absolute', left: 78, top: 78, width: SIZE - 156, height: SIZE - 156, borderRadius: (SIZE - 156) / 2,
    backgroundColor: C.card2, borderWidth: 1, borderColor: '#303641', alignItems: 'center', justifyContent: 'center',
  },
  okTxt: { color: C.txt, fontSize: 17, fontWeight: '700' },
  pressed: { backgroundColor: '#232831' },
});
