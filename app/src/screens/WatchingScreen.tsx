import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import AppPicker, { AppIcon } from '../components/AppPicker';
import Icon from '../components/Icon';
import { Btn, Field, Header, Section } from '../components/ui';
import { describe, describeStep, runAutomation } from '../lib/automation';
import { NowPlaying, projector } from '../lib/projector';
import { buzz } from '../lib/remote';
import { Automation, Step, uid } from '../lib/store';
import { C } from '../theme';

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

function Row({ left, title, sub, right, onPress, onLongPress }: {
  left: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; onLongPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={st.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function Letter({ text }: { text: string }) {
  return (
    <View style={st.letter}>
      <Text style={{ color: C.txt, fontWeight: '800' }}>{text.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export default function WatchingScreen() {
  const { settings, wifiOk, saved, setSaved, automations, setAutomations, toast, apps } = useApp();
  const [now, setNow] = useState<NowPlaying>(null);
  const [lastSeen, setLastSeen] = useState<(NonNullable<NowPlaying> & { at: number }) | null>(null);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  // pergunta ao projetor o que está passando (série, episódio)
  useEffect(() => {
    if (!settings.projectorIp || !wifiOk) return;
    let alive = true;
    const tick = async () => {
      const n = await projector.nowPlaying(settings.projectorIp);
      if (!alive) return;
      setNow(n);
      if (n) setLastSeen({ ...n, at: Date.now() });
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [settings.projectorIp, wifiOk]);

  const openSaved = async (url: string, pkg?: string) => {
    buzz();
    if (!settings.projectorIp || !wifiOk) return toast('Projetor não encontrado no Wi-Fi');
    try {
      await projector.openUrl(settings.projectorIp, url, pkg);
    } catch {
      toast('Não consegui abrir no projetor');
    }
  };

  const run = async (a: Automation) => {
    buzz();
    setRunning(a.id);
    try {
      await runAutomation(a);
      toast(`${a.name}: pronto`);
    } catch (e: any) {
      toast(e?.message || 'Falhou');
    } finally {
      setRunning(null);
    }
  };

  const playing = now || lastSeen;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <Header title="Assistindo" sub="Toque para abrir no projetor" />

      {playing ? (
        <>
          <Section>{now ? 'Passando agora' : 'Última vez'}</Section>
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <Row
              left={<AppIcon pkg={playing.pkg} size={44} />}
              title={playing.title}
              sub={[playing.subtitle, playing.appLabel].filter(Boolean).join(' · ')}
              right={<Icon name="play" color={C.acc} />}
              onPress={() => settings.projectorIp && projector.launch(settings.projectorIp, playing.pkg)}
            />
          </View>
        </>
      ) : null}

      <Section>Séries e filmes salvos</Section>
      <View style={{ paddingHorizontal: 20, gap: 10, marginBottom: 18 }}>
        {saved.length === 0 ? (
          <Text style={st.empty}>
            No app da Netflix, YouTube ou outro, abra a série e toque em Compartilhar → Controle do Projetor. Ela aparece aqui.
          </Text>
        ) : (
          saved.map((it) => (
            <Row
              key={it.id}
              left={it.pkg ? <AppIcon pkg={it.pkg} size={44} /> : <Letter text={it.title} />}
              title={it.title}
              sub={[it.appLabel, ago(it.at)].filter(Boolean).join(' · ')}
              right={<Icon name="play" color={C.acc} />}
              onPress={() => {
                setSaved([{ ...it, at: Date.now() }, ...saved.filter((x) => x.id !== it.id)]);
                openSaved(it.url, it.pkg);
              }}
              onLongPress={() =>
                Alert.alert(it.title, 'Remover da lista?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Remover', style: 'destructive', onPress: () => setSaved(saved.filter((x) => x.id !== it.id)) },
                ])
              }
            />
          ))
        )}
      </View>

      <Section>Automações</Section>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {automations.map((a) => (
          <Row
            key={a.id}
            left={<View style={st.autoDot}><Icon name="play" size={16} color={running === a.id ? C.warn : C.acc} /></View>}
            title={a.name}
            sub={running === a.id ? 'Rodando...' : describe(a)}
            onPress={() => run(a)}
            onLongPress={() => setEditing(a)}
          />
        ))}
        <Pressable style={[st.row, st.dashed]} onPress={() => setEditing({ id: uid(), name: '', steps: [] })}>
          <Text style={{ color: C.mut, fontSize: 14, flex: 1, textAlign: 'center' }}>+ Nova automação</Text>
        </Pressable>
        <Text style={st.hint}>Segure uma automação para editar.</Text>
      </View>

      {editing ? (
        <AutomationEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            const exists = automations.some((x) => x.id === a.id);
            setAutomations(exists ? automations.map((x) => (x.id === a.id ? a : x)) : [...automations, a]);
            setEditing(null);
          }}
          onDelete={() => {
            setAutomations(automations.filter((x) => x.id !== editing.id));
            setEditing(null);
          }}
          hasApps={apps.length > 0}
        />
      ) : null}
    </ScrollView>
  );
}

function AutomationEditor({ initial, onClose, onSave, onDelete, hasApps }: {
  initial: Automation; onClose: () => void; onSave: (a: Automation) => void; onDelete: () => void; hasApps: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [picker, setPicker] = useState(false);
  const [extra, setExtra] = useState<'alexa' | 'wait' | 'sleep' | null>(null);
  const [extraVal, setExtraVal] = useState('');

  const addExtra = () => {
    const v = extraVal.trim();
    if (!v) return;
    if (extra === 'alexa') setSteps([...steps, { type: 'alexa', device: v }]);
    if (extra === 'wait') setSteps([...steps, { type: 'wait', seconds: Math.max(1, parseInt(v, 10) || 5) }]);
    if (extra === 'sleep') setSteps([...steps, { type: 'sleep', minutes: Math.max(1, parseInt(v, 10) || 30) }]);
    setExtra(null);
    setExtraVal('');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.back}>
        <ScrollView style={st.sheet} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
          <Text style={st.title}>Automação</Text>
          <Field value={name} onChangeText={setName} placeholder="Nome (ex.: Modo cinema)" />

          <Text style={st.label}>Passos, em ordem</Text>
          {steps.length === 0 ? <Text style={st.empty}>Nenhum passo ainda.</Text> : null}
          {steps.map((stp, i) => (
            <View key={i} style={st.step}>
              <Text style={{ color: C.txt, flex: 1 }}>{i + 1}. {describeStep(stp)}</Text>
              <Pressable hitSlop={10} onPress={() => setSteps(steps.filter((_, j) => j !== i))}>
                <Icon name="trash" size={18} color={C.mut} />
              </Pressable>
            </View>
          ))}

          <Text style={st.label}>Adicionar passo</Text>
          <View style={st.wrap}>
            <Btn small label="Ligar/desligar" onPress={() => setSteps([...steps, { type: 'power' }])} />
            <Btn small label="Abrir app" onPress={() => (hasApps ? setPicker(true) : null)} />
            <Btn small label="Alexa" onPress={() => setExtra('alexa')} />
            <Btn small label="Esperar" onPress={() => setExtra('wait')} />
            <Btn small label="Desligar em..." onPress={() => setExtra('sleep')} />
          </View>
          {extra ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field
                style={{ flex: 1 }}
                autoFocus
                value={extraVal}
                onChangeText={setExtraVal}
                keyboardType={extra === 'alexa' ? 'default' : 'number-pad'}
                placeholder={extra === 'alexa' ? 'Nome do gatilho no Voice Monkey' : extra === 'wait' ? 'Segundos' : 'Minutos'}
              />
              <Btn label="OK" primary onPress={addExtra} />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Btn label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
            <Btn
              label="Salvar"
              primary
              style={{ flex: 1 }}
              onPress={() => onSave({ id: initial.id, name: name.trim() || 'Automação', steps })}
            />
          </View>
          {initial.name ? <Btn label="Apagar automação" danger onPress={onDelete} /> : null}
        </ScrollView>
        <AppPicker
          visible={picker}
          onClose={() => setPicker(false)}
          onPick={(a) => setSteps([...steps, { type: 'app', pkg: a.pkg, label: a.label }])}
        />
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16,
  },
  dashed: { borderStyle: 'dashed', minHeight: 52 },
  rowTitle: { color: C.txt, fontSize: 14 },
  rowSub: { color: C.mut, fontSize: 11, marginTop: 2 },
  letter: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  autoDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accBg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: C.mut, fontSize: 13, lineHeight: 19 },
  hint: { color: C.mut, fontSize: 11, textAlign: 'center' },
  back: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.line, padding: 16 },
  title: { color: C.txt, fontSize: 18, fontWeight: '700' },
  label: { color: C.mut, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.line },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
