import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useApp } from '../AppState';
import { remote } from '../lib/remote';
import { C } from '../theme';
import Icon from './Icon';

export function Header({ title, sub }: { title: string; sub?: string }) {
  const { toast, hasPowerCode, hid } = useApp();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      <Pressable
        style={({ pressed }) => [s.power, pressed && { opacity: 0.6 }]}
        onPress={() => {
          if (!hasPowerCode && hid.state !== 'connected') {
            toast('Configure o infravermelho nos Ajustes');
            return;
          }
          remote.power();
        }}
      >
        <Icon name="power" color={C.red} />
      </Pressable>
    </View>
  );
}

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={s.chip}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.chipTxt}>{label}</Text>
    </View>
  );
}

export function Section({ children }: { children: string }) {
  return <Text style={s.sec}>{children}</Text>;
}

export function Btn({
  label, onPress, style, primary, danger, small,
}: { label: string; onPress: () => void; style?: ViewStyle; primary?: boolean; danger?: boolean; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && { height: 40, paddingHorizontal: 12 },
        primary && { backgroundColor: C.acc, borderColor: C.acc },
        danger && { backgroundColor: C.redBg, borderColor: C.redLine },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[s.btnTxt, primary && { color: '#fff' }, danger && { color: C.red }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.mut} {...props} style={[s.field, props.style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  h1: { color: C.txt, fontSize: 22, fontWeight: '700' },
  sub: { color: C.mut, fontSize: 12, marginTop: 2 },
  power: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redLine,
    alignItems: 'center', justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1,
    borderColor: C.line, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { color: C.mut, fontSize: 12 },
  sec: { color: C.mut, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  btn: {
    height: 48, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
  },
  btnTxt: { color: C.txt, fontSize: 14, fontWeight: '600' },
  field: {
    height: 48, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    color: C.txt, paddingHorizontal: 14, fontSize: 15,
  },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 },
});
