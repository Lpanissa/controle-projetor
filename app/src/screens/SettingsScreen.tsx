import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Native from '../../modules/projector-native';
import { useApp } from '../AppState';
import IrWizard from '../components/IrWizard';
import { Btn, Card, Field, Header, Section } from '../components/ui';
import { triggerAlexa } from '../lib/automation';
import { projector } from '../lib/projector';
import { C } from '../theme';

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={st.tLabel}>{label}</Text>
        {sub ? <Text style={st.tSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accLine, false: C.line }} thumbColor={value ? C.acc : C.mut} />
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings, hid, wifiOk, refreshApps, hasIr, hasPowerCode, toast } = useApp();
  const [devices, setDevices] = useState<{ name: string; address: string }[]>([]);
  const [ip, setIp] = useState(settings.projectorIp);
  const [searching, setSearching] = useState('');
  const [irOpen, setIrOpen] = useState(false);
  const [token, setToken] = useState(settings.voiceMonkeyToken);
  const [testDevice, setTestDevice] = useState('modo-cinema');
  const [sleepLabel, setSleepLabel] = useState('');

  const loadDevices = () => {
    try {
      setDevices(Native.bondedDevices());
    } catch {
      toast('Permita o Bluetooth para o app');
    }
  };

  const findProjector = async () => {
    setSearching('Procurando...');
    const found = await projector.discover((n) => setSearching(`Procurando... ${Math.round((n / 254) * 100)}%`));
    setSearching('');
    if (found) {
      setIp(found);
      updateSettings({ projectorIp: found });
      toast('Projetor encontrado!');
    } else toast('Não achei. Confira se o app Projetor Ponte está aberto no projetor.');
  };

  const setSleep = (min: number) => {
    Native.sleepTimer(min);
    setSleepLabel(min > 0 ? `Desliga em ${min} min` : 'Timer cancelado');
  };

  const btLabel =
    hid.state === 'connected' ? `Conectado a ${hid.name ?? 'projetor'}` : hid.state === 'ready' ? 'Pronto, esperando o projetor' : 'Desligado';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <Header title="Ajustes" />

      <Section>Bluetooth (setas, touchpad, volume)</Section>
      <Card style={st.card}>
        <Text style={st.status}>{btLabel}</Text>
        <Text style={st.help}>
          Para parear a primeira vez: toque em "Deixar o projetor visível" (vai aparecer uma pergunta na tela do
          projetor, aceite). Depois, no Bluetooth do celular, procure o projetor e pareie. Por fim, toque em
          "Aparelhos pareados" e conecte.
        </Text>
        <Btn
          label="Deixar o projetor visível"
          primary
          onPress={async () => {
            if (!settings.projectorIp || !wifiOk) return toast('Primeiro conecte o projetor pelo Wi-Fi (abaixo)');
            try {
              await projector.makeVisible(settings.projectorIp);
              toast('Aceite a pergunta na tela do projetor');
            } catch {
              toast('Não consegui falar com o projetor');
            }
          }}
        />
        <View style={st.rowBtns}>
          <Btn small label="Abrir Bluetooth do celular" onPress={() => Native.openBluetoothSettings()} style={{ flex: 1 }} />
          <Btn small label="Aparelhos pareados" onPress={loadDevices} style={{ flex: 1 }} />
        </View>
        {devices.map((d) => (
          <Pressable
            key={d.address}
            style={({ pressed }) => [st.device, pressed && { opacity: 0.6 }]}
            onPress={async () => {
              const ok = await Native.connect(d.address);
              toast(ok ? `Conectando a ${d.name}...` : 'Não consegui conectar');
            }}
          >
            <Text style={{ color: C.txt }}>{d.name}</Text>
            <Text style={{ color: C.acc, fontSize: 12 }}>Conectar</Text>
          </Pressable>
        ))}
      </Card>

      <Section>Wi-Fi (atalhos e Assistindo)</Section>
      <Card style={st.card}>
        <Text style={st.status}>{wifiOk ? `Conectado ao projetor (${settings.projectorIp})` : 'Projetor não conectado'}</Text>
        <Text style={st.help}>Precisa do app "Projetor Ponte" instalado e aberto no projetor, no mesmo Wi-Fi.</Text>
        <Btn label={searching || 'Procurar o projetor'} primary onPress={findProjector} />
        <View style={st.rowBtns}>
          <Field style={{ flex: 1 }} value={ip} onChangeText={setIp} placeholder="IP (ex.: 192.168.15.19)" keyboardType="decimal-pad" />
          <Btn
            label="Salvar"
            onPress={() => {
              updateSettings({ projectorIp: ip.trim() });
              setTimeout(refreshApps, 300);
            }}
          />
        </View>
        <Btn small label="Atualizar lista de apps" onPress={refreshApps} />
      </Card>

      <Section>Infravermelho (ligar o projetor)</Section>
      <Card style={st.card}>
        <Text style={st.status}>
          {!hasIr ? 'Este celular não tem infravermelho' : hasPowerCode ? 'Código salvo' : 'Ainda sem código'}
        </Text>
        <Btn label={hasPowerCode ? 'Procurar outro código' : 'Encontrar código do infravermelho'} primary onPress={() => setIrOpen(true)} />
      </Card>

      <Section>Timer para desligar</Section>
      <Card style={st.card}>
        <View style={st.rowBtns}>
          {[15, 30, 60, 90].map((m) => (
            <Btn key={m} small label={`${m} min`} onPress={() => setSleep(m)} style={{ flex: 1 }} />
          ))}
        </View>
        <Btn small label="Cancelar timer" onPress={() => setSleep(0)} />
        {sleepLabel ? <Text style={st.help}>{sleepLabel}</Text> : null}
      </Card>

      <Section>Alexa</Section>
      <Card style={st.card}>
        <Text style={st.help}>
          As automações chamam rotinas da Alexa pelo Voice Monkey (grátis). Crie a conta, ative a skill "Voice Monkey" na
          Alexa, crie um gatilho (ex.: modo-cinema) e use ele numa rotina da Alexa. Cole aqui o token da sua conta.
        </Text>
        <Btn small label="Abrir site do Voice Monkey" onPress={() => Linking.openURL('https://voicemonkey.io')} />
        <Field value={token} onChangeText={setToken} placeholder="Token do Voice Monkey" autoCapitalize="none" />
        <Btn label="Salvar token" onPress={() => updateSettings({ voiceMonkeyToken: token.trim() })} />
        <View style={st.rowBtns}>
          <Field style={{ flex: 1 }} value={testDevice} onChangeText={setTestDevice} placeholder="Gatilho" autoCapitalize="none" />
          <Btn
            label="Testar"
            onPress={async () => {
              try {
                await triggerAlexa(testDevice);
                toast('Rotina da Alexa chamada');
              } catch (e: any) {
                toast(e?.message || 'Falhou');
              }
            }}
          />
        </View>
      </Card>

      <Section>Preferências</Section>
      <Card style={st.card}>
        <Toggle label="Vibrar ao tocar" value={settings.vibrate} onChange={(v) => updateSettings({ vibrate: v })} />
        <Toggle
          label="Botões de volume do celular"
          sub="Com o app aberto, controlam o volume do projetor"
          value={settings.volumeKeys}
          onChange={(v) => updateSettings({ volumeKeys: v })}
        />
        <Toggle
          label="Controle na notificação"
          sub="Volume, play/pausa e ligar sem abrir o app"
          value={settings.notification}
          onChange={(v) => updateSettings({ notification: v })}
        />
      </Card>

      <IrWizard visible={irOpen} onClose={() => setIrOpen(false)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, gap: 10 },
  status: { color: C.txt, fontSize: 15, fontWeight: '600' },
  help: { color: C.mut, fontSize: 12, lineHeight: 18 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  device: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: C.card2,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tLabel: { color: C.txt, fontSize: 14 },
  tSub: { color: C.mut, fontSize: 11, marginTop: 2 },
});
