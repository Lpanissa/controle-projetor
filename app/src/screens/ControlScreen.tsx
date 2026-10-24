import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import DPad from '../components/DPad';
import Icon, { IconName } from '../components/Icon';
import Shortcuts from '../components/Shortcuts';
import Touchpad from '../components/Touchpad';
import { Btn, Chip, Header } from '../components/ui';
import { KEY, MEDIA, remote } from '../lib/remote';
import { C } from '../theme';

function SmallBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.small, pressed && st.pressed]}>
      <Icon name={icon} size={20} />
      <Text style={st.smallTxt}>{label}</Text>
    </Pressable>
  );
}

function VolBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.vol, pressed && st.pressed]}>
      <Icon name={icon} size={18} />
      <Text style={st.volTxt}>{label}</Text>
    </Pressable>
  );
}

export default function ControlScreen() {
  const { hid, wifiOk, hasIr, hasPowerCode } = useApp();
  const [touch, setTouch] = useState(false);
  const [kb, setKb] = useState(false);
  const [text, setText] = useState('');
  const [scrollOn, setScrollOn] = useState(true);

  const btColor = hid.state === 'connected' ? C.ok : hid.state === 'ready' ? C.warn : C.red;
  const irColor = !hasIr ? C.red : hasPowerCode ? C.ok : C.warn;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} scrollEnabled={scrollOn}>
      <Header title="Projetor" sub={hid.name ? hid.name : 'Smart Projector'} />
      <View style={st.chips}>
        <Chip label="Bluetooth" color={btColor} />
        <Chip label="Wi-Fi" color={wifiOk ? C.ok : C.red} />
        <Chip label="Infravermelho" color={irColor} />
      </View>

      <Shortcuts />

      <View style={st.ctl}>
        <View style={st.ctlMain}>{touch ? <Touchpad height={250} onActive={(a) => setScrollOn(!a)} /> : <DPad />}</View>
        <Pressable
          onPress={() => setTouch(!touch)}
          style={({ pressed }) => [st.toggle, touch && st.toggleOn, pressed && st.pressed]}
          hitSlop={8}
        >
          <Icon name={touch ? 'dpad' : 'touchpad'} size={20} color={touch ? C.acc : C.mut} />
        </Pressable>
      </View>

      <View style={st.row}>
        <SmallBtn icon="back" label="Voltar" onPress={() => remote.media(MEDIA.BACK)} />
        <SmallBtn icon="home" label="Início" onPress={() => remote.media(MEDIA.HOME)} />
        <SmallBtn icon="menu" label="Menu" onPress={() => remote.media(MEDIA.MENU)} />
        <SmallBtn icon="keyboard" label="Teclado" onPress={() => setKb(true)} />
      </View>
      <View style={st.row}>
        <VolBtn icon="volDown" label="Vol" onPress={() => remote.media(MEDIA.VOL_DOWN)} />
        <VolBtn icon="mute" label="Mudo" onPress={() => remote.media(MEDIA.MUTE)} />
        <VolBtn icon="volUp" label="Vol" onPress={() => remote.media(MEDIA.VOL_UP)} />
      </View>
      <View style={st.row}>
        <VolBtn icon="rewind" label="" onPress={() => remote.media(MEDIA.REWIND)} />
        <VolBtn icon="playPause" label="" onPress={() => remote.media(MEDIA.PLAY_PAUSE)} />
        <VolBtn icon="forward" label="" onPress={() => remote.media(MEDIA.FAST_FORWARD)} />
      </View>

      <Modal visible={kb} transparent animationType="fade" onRequestClose={() => setKb(false)}>
        <View style={st.kbBack}>
          <View style={st.kbBox}>
            <Text style={st.kbTitle}>Digitar no projetor</Text>
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="Escreva aqui e toque em Enviar"
              placeholderTextColor={C.mut}
              style={st.kbInput}
              onSubmitEditing={() => {
                if (text) remote.type(text);
                setText('');
              }}
              returnKeyType="send"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Apagar" onPress={() => remote.key(KEY.BACKSPACE)} style={{ flex: 1 }} />
              <Btn
                label="Enviar"
                primary
                style={{ flex: 1 }}
                onPress={() => {
                  if (text) remote.type(text);
                  setText('');
                }}
              />
            </View>
            <Btn label="Fechar" onPress={() => setKb(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  ctl: { width: 330, height: 258, alignSelf: 'center', marginBottom: 14, flexDirection: 'row' },
  ctlMain: { flex: 1, alignItems: 'center', paddingRight: 12 },
  toggle: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleOn: { backgroundColor: C.accBg, borderColor: C.accLine },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 10 },
  small: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  smallTxt: { color: C.mut, fontSize: 10 },
  vol: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  volTxt: { color: C.txt, fontSize: 13 },
  pressed: { backgroundColor: '#232831' },
  kbBack: { flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 20 },
  kbBox: { backgroundColor: C.bg, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 },
  kbTitle: { color: C.txt, fontSize: 17, fontWeight: '700' },
  kbInput: {
    height: 52, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, color: C.txt,
    paddingHorizontal: 14, fontSize: 16,
  },
});
