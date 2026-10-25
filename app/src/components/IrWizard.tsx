import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Native from '../../modules/projector-native';
import { useApp } from '../AppState';
import { COMMON_ADDRESSES, hex, IrCode, sendCode, sweepList } from '../lib/ir';
import { C } from '../theme';
import { Btn, Field } from './ui';

const LIKELY_FIRST = 14; // os 14 primeiros de cada lista são os "power" mais comuns

/** Ordem: primeiro os códigos mais prováveis de todos os endereços, depois a varredura completa. */
function buildQueue(extraAddr?: number): IrCode[] {
  const addrs = extraAddr !== undefined ? [extraAddr, ...COMMON_ADDRESSES.filter((a) => a !== extraAddr)] : COMMON_ADDRESSES;
  const lists = addrs.map(sweepList);
  const q: IrCode[] = [];
  lists.forEach((l) => q.push(...l.slice(0, LIKELY_FIRST)));
  lists.forEach((l) => q.push(...l.slice(LIKELY_FIRST)));
  return q;
}

type Phase = 'intro' | 'sweep' | 'confirm' | 'done' | 'manual';

export default function IrWizard({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { refreshIr, toast, hasIr } = useApp();
  const [phase, setPhase] = useState<Phase>('intro');
  const [pos, setPos] = useState(0);
  const [current, setCurrent] = useState<IrCode | null>(null);
  const [candidates, setCandidates] = useState<IrCode[]>([]);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [addr, setAddr] = useState('');
  const [cmd, setCmd] = useState('');
  const stop = useRef(false);
  const history = useRef<IrCode[]>([]);
  const queue = useRef<IrCode[]>(buildQueue());

  useEffect(() => {
    if (!visible) {
      stop.current = true;
      setPhase('intro');
      setPos(0);
    }
  }, [visible]);

  const startSweep = async (from = 0) => {
    stop.current = false;
    setPhase('sweep');
    const q = queue.current;
    for (let i = from; i < q.length; i++) {
      if (stop.current) return;
      setPos(i);
      setCurrent(q[i]);
      history.current = [...history.current.slice(-39), q[i]];
      await sendCode(q[i]);
      await new Promise((r) => setTimeout(r, 600));
    }
    if (!stop.current) {
      toast('Testei todos os códigos comuns');
      setPhase('intro');
    }
  };

  const startConfirm = (list: IrCode[]) => {
    setCandidates(list);
    setTested(false);
    setPhase('confirm');
  };

  const itTurnedOn = () => {
    stop.current = true;
    // o projetor demora para ligar: o código certo está entre os últimos ~40 enviados
    startConfirm([...history.current]);
  };

  // faixa onde o projetor do Panissa já ligou uma vez (endereço 00, códigos 96 a B4)
  const knownRange = (): IrCode[] => {
    const out: IrCode[] = [];
    for (let c = 0x96; c <= 0xb4; c++) out.push({ address: 0x00, command: c });
    return out;
  };

  const half = () => candidates.slice(0, Math.ceil(candidates.length / 2));

  // manda a primeira metade dos candidatos; se ligar, o código está nela
  const testHalf = async () => {
    setTesting(true);
    for (const c of half()) {
      await sendCode(c);
      await new Promise((r) => setTimeout(r, 450));
    }
    setTesting(false);
    setTested(true);
  };

  const answer = (turnedOn: boolean) => {
    const h = half();
    const next = turnedOn ? h : candidates.slice(h.length);
    if (next.length === 0) {
      toast('Não achei nesse grupo. Vou continuar a busca.');
      startSweep(pos + 1);
      return;
    }
    setCandidates(next);
    setTested(false);
  };

  const save = (c: IrCode) => {
    Native.savePowerCode(c.address, c.command);
    refreshIr();
    setPhase('done');
  };

  const total = queue.current.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.back}>
        <ScrollView style={st.sheet} contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
          <Text style={st.title}>Infravermelho</Text>

          {!hasIr ? (
            <Text style={st.p}>Este celular não tem infravermelho.</Text>
          ) : phase === 'intro' ? (
            <>
              <Text style={st.p}>
                1. Deixe o projetor <Text style={st.b}>desligado</Text>, mas na tomada.{'\n'}
                2. Aponte o topo do celular para a frente do projetor, a uns 2 metros.{'\n'}
                3. Toque em Começar. Quando o projetor <Text style={st.b}>ligar</Text>, toque em "Ligou!".
              </Text>
              <Btn label={pos > 0 ? 'Continuar de onde parou' : 'Começar'} primary onPress={() => startSweep(pos)} />
              <Btn label="Testar a faixa onde ele já ligou (00: 96 a B4)" onPress={() => startConfirm(knownRange())} />
              <Btn label="Digitar código na mão" onPress={() => setPhase('manual')} />
              <Btn label="Fechar" onPress={onClose} />
            </>
          ) : phase === 'sweep' ? (
            <>
              <Text style={st.p}>Mandando códigos... fique apontando para o projetor.</Text>
              <View style={st.bar}><View style={[st.fill, { width: `${(pos / total) * 100}%` }]} /></View>
              <Text style={st.small}>
                {pos + 1} de {total}
                {current ? `  ·  endereço ${hex(current.address)}  ·  código ${hex(current.command)}` : ''}
              </Text>
              <Btn label="Ligou!" primary style={{ height: 64 }} onPress={itTurnedOn} />
              <Btn label="Pausar" onPress={() => { stop.current = true; setPhase('intro'); }} />
            </>
          ) : phase === 'confirm' ? (
            candidates.length === 1 ? (
              <>
                <Text style={st.p}>
                  Achei! Deve ser o código {hex(candidates[0].address)} / {hex(candidates[0].command)}.{'\n'}
                  Desligue o projetor e toque em Testar para confirmar.
                </Text>
                <Btn label="Testar" primary onPress={() => sendCode(candidates[0])} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn label="Não ligou" style={{ flex: 1 }} onPress={() => { toast('Vou continuar a busca.'); startSweep(pos + 1); }} />
                  <Btn label="Ligou, salvar" primary style={{ flex: 1 }} onPress={() => save(candidates[0])} />
                </View>
              </>
            ) : (
              <>
                <Text style={st.p}>
                  Faltam <Text style={st.b}>{candidates.length}</Text> códigos possíveis. Vou testar metade de cada vez.{'\n\n'}
                  1. Se o projetor estiver ligado, <Text style={st.b}>desligue</Text> com o controle original.{'\n'}
                  2. Aponte o celular e toque em <Text style={st.b}>Testar</Text>.{'\n'}
                  3. Espere uns 10 segundos e diga se ligou.
                </Text>
                <Btn label={testing ? 'Mandando...' : 'Testar'} primary onPress={() => !testing && testHalf()} />
                {tested ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Btn label="Não ligou" style={{ flex: 1 }} onPress={() => answer(false)} />
                    <Btn label="Ligou" primary style={{ flex: 1 }} onPress={() => answer(true)} />
                  </View>
                ) : null}
              </>
            )
          ) : phase === 'done' ? (
            <>
              <Text style={st.p}>Código salvo! O botão vermelho, a notificação, o timer e as automações vão usar ele.</Text>
              <Btn label="Fechar" primary onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={st.p}>Código NEC em hexadecimal (ex.: endereço 00, código 45).</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field style={{ flex: 1 }} value={addr} onChangeText={setAddr} placeholder="Endereço" autoCapitalize="characters" />
                <Field style={{ flex: 1 }} value={cmd} onChangeText={setCmd} placeholder="Código" autoCapitalize="characters" />
              </View>
              {(() => {
                const a = parseInt(addr.replace(/^0x/i, ''), 16);
                const c = parseInt(cmd.replace(/^0x/i, ''), 16);
                const ok = !isNaN(a) && !isNaN(c) && a >= 0 && a <= 0xffff && c >= 0 && c <= 0xff;
                return (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Btn label="Testar" style={{ flex: 1 }} onPress={() => ok && sendCode({ address: a, command: c })} />
                    <Btn label="Salvar" primary style={{ flex: 1 }} onPress={() => ok && save({ address: a, command: c })} />
                  </View>
                );
              })()}
              <Btn label="Voltar" onPress={() => setPhase('intro')} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.line, padding: 18 },
  title: { color: C.txt, fontSize: 18, fontWeight: '700' },
  p: { color: C.txt, fontSize: 14, lineHeight: 22 },
  b: { fontWeight: '700' },
  small: { color: C.mut, fontSize: 12 },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.card, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: C.acc },
});
