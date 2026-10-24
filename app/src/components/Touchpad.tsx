import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { remote } from '../lib/remote';
import { C } from '../theme';

const SPEED = 1.8; // sensibilidade do cursor

/**
 * Arrastar = mover o cursor. Um toque rápido = clique. Dois dedos = rolar.
 * Os movimentos são juntados e enviados em pacotes para não travar o Bluetooth.
 */
export default function Touchpad({ height, onActive }: { height: number; onActive?: (active: boolean) => void }) {
  const acc = useRef({ x: 0, y: 0, wheel: 0 });
  const last = useRef({ dx: 0, dy: 0 });
  const meta = useRef({ start: 0, moved: 0, multi: false });
  const flushing = useRef(false);
  const wheelFrac = useRef(0);

  const flush = () => {
    if (flushing.current) return;
    flushing.current = true;
    requestAnimationFrame(async () => {
      const { x, y, wheel } = acc.current;
      acc.current = { x: 0, y: 0, wheel: 0 };
      try {
        if (wheel !== 0) await remote.scroll(wheel);
        else if (x !== 0 || y !== 0) await remote.move(x, y);
      } finally {
        flushing.current = false;
        if (acc.current.x || acc.current.y || acc.current.wheel) flush();
      }
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          onActive?.(true);
          last.current = { dx: 0, dy: 0 };
          meta.current = { start: Date.now(), moved: 0, multi: false };
        },
        onPanResponderMove: (_e, g) => {
          const ddx = g.dx - last.current.dx;
          const ddy = g.dy - last.current.dy;
          last.current = { dx: g.dx, dy: g.dy };
          meta.current.moved += Math.abs(ddx) + Math.abs(ddy);
          if (g.numberActiveTouches >= 2) {
            meta.current.multi = true;
            // rolagem natural, como no celular: arrastar pra cima sobe o conteúdo
            wheelFrac.current += -ddy / 12;
            const steps = Math.trunc(wheelFrac.current);
            if (steps !== 0) {
              wheelFrac.current -= steps;
              acc.current.wheel += steps;
            }
          } else {
            acc.current.x += Math.round(ddx * SPEED);
            acc.current.y += Math.round(ddy * SPEED);
          }
          flush();
        },
        onPanResponderTerminate: () => onActive?.(false),
        onPanResponderRelease: () => {
          onActive?.(false);
          const m = meta.current;
          if (!m.multi && m.moved < 10 && Date.now() - m.start < 250) remote.click();
        },
      }),
    []
  );

  return (
    <View style={[st.pad, { height }]} {...responder.panHandlers}>
      <Text style={st.hint}>Arraste para mover{'\n'}Toque = clique{'\n'}Dois dedos = rolar</Text>
    </View>
  );
}

const st = StyleSheet.create({
  pad: {
    flex: 1, borderRadius: 24, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { color: C.mut, fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
