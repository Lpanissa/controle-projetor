import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { projector } from '../lib/projector';
import { buzz } from '../lib/remote';
import { C } from '../theme';
import AppPicker, { AppIcon } from './AppPicker';
import Icon from './Icon';

/** Atalhos dos apps do projetor. Segure um atalho para mudar a ordem ou tirar. */
export default function Shortcuts() {
  const { shortcuts, setShortcuts, settings, toast, wifiOk } = useApp();
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);

  const open = async (pkg: string) => {
    buzz();
    if (!settings.projectorIp || !wifiOk) {
      toast('Projetor não encontrado no Wi-Fi');
      return;
    }
    try {
      await projector.launch(settings.projectorIp, pkg);
    } catch {
      toast('Não consegui abrir no projetor');
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= shortcuts.length) return;
    const next = [...shortcuts];
    [next[i], next[j]] = [next[j], next[i]];
    setShortcuts(next);
    buzz();
  };

  return (
    <View>
      <View style={st.head}>
        <Text style={st.sec}>Atalhos</Text>
        {editing ? (
          <Pressable onPress={() => setEditing(false)} hitSlop={10}>
            <Text style={st.done}>Concluir</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={st.grid}>
        {shortcuts.map((a, i) => (
          <Pressable
            key={a.pkg}
            style={({ pressed }) => [st.app, editing && st.appEdit, pressed && !editing && { opacity: 0.6 }]}
            onPress={() => (editing ? null : open(a.pkg))}
            onLongPress={() => {
              buzz();
              setEditing(true);
            }}
          >
            <AppIcon pkg={a.pkg} />
            <Text style={st.label} numberOfLines={1}>{a.label}</Text>
            {editing ? (
              <>
                <Pressable style={st.remove} hitSlop={8} onPress={() => setShortcuts(shortcuts.filter((x) => x.pkg !== a.pkg))}>
                  <Icon name="close" size={14} color="#fff" />
                </Pressable>
                <View style={st.arrows}>
                  <Pressable hitSlop={6} onPress={() => move(i, -1)} style={st.arrowBtn}>
                    <Icon name="chevL" size={16} color={i === 0 ? C.line : C.txt} />
                  </Pressable>
                  <Pressable hitSlop={6} onPress={() => move(i, 1)} style={st.arrowBtn}>
                    <Icon name="chevR" size={16} color={i === shortcuts.length - 1 ? C.line : C.txt} />
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        ))}
        <Pressable style={[st.app, st.add]} onPress={() => setPicker(true)}>
          <Icon name="plus" size={26} color={C.mut} />
          <Text style={st.label}>Adicionar</Text>
        </Pressable>
      </View>
      <AppPicker
        visible={picker}
        onClose={() => setPicker(false)}
        exclude={shortcuts.map((s) => s.pkg)}
        onPick={(a) => setShortcuts([...shortcuts, { pkg: a.pkg, label: a.label }])}
      />
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  sec: { color: C.mut, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  done: { color: C.acc, fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 12 },
  app: {
    width: '22%', marginHorizontal: '1.5%', marginBottom: 10, height: 76, borderRadius: 16, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  appEdit: { borderColor: C.accLine, height: 92, justifyContent: 'flex-start', paddingTop: 10 },
  add: { borderStyle: 'dashed' },
  label: { color: C.mut, fontSize: 11, maxWidth: 70 },
  remove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
  },
  arrows: { flexDirection: 'row', gap: 10 },
  arrowBtn: { padding: 2 },
});
