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
  const [ci, setCi] = useState(0);
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
      history.current = [...history.current.slice(-11), q[i]];
      await sendCode(q[i]);
      await new Promise((r) => setTimeout(r, 380));
    }
    if (!stop.current) {
      toast('Testei todos os códigos comuns');
      setPhase('intro');
    }
  };

  const itTurnedOn = () => {
    stop.current = true;
    setCandidates([...history.current].reverse());
    setCi(0);
    setPhase('confirm');
  };

  const save = (c: IrCode) => {
    Native.savePowerCode(c.address, c.command);
    refreshIr();
    setPhase('done');
  };

  const nextCandidate = () => {
    if (ci + 1 >= candidates.length) {
      toast('Nenhum desses. Vou continuar a busca.');
      startSweep(pos + 1);
    } else setCi(ci + 1);
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
            <>
              <Text style={st.p}>
                Agora vamos achar qual código foi.{'\n'}
                <Text style={st.b}>Desligue o projetor</Text> com o controle original e toque em Testar.
              </Text>
              <Text style={st.small}>
                Teste {ci + 1} de {candidates.length}  ·  {hex(candidates[ci].address)} / {hex(candidates[ci].command)}
              </Text>
              <Btn label="Testar este" primary onPress={() => sendCode(candidates[ci])} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn label="Não ligou" style={{ flex: 1 }} onPress={nextCandidate} />
                <Btn label="Ligou, salvar" primary style={{ flex: 1 }} onPress={() => save(candidates[ci])} />
              </View>
            </>
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
