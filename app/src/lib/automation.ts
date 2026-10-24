import Native from '../../modules/projector-native';
import { projector } from './projector';
import { Automation, getSettings, Step } from './store';

/** Chama uma rotina da Alexa pelo Voice Monkey (o "device" é o nome do gatilho criado lá). */
export async function triggerAlexa(device: string) {
  const s = await getSettings();
  if (!s.voiceMonkeyToken) throw new Error('Configure o Voice Monkey nos Ajustes');
  const url =
    `https://api-v2.voicemonkey.io/trigger?token=${encodeURIComponent(s.voiceMonkeyToken)}` +
    `&device=${encodeURIComponent(device)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('A Alexa não respondeu');
}

export function describeStep(st: Step): string {
  switch (st.type) {
    case 'power':
      return 'Ligar/desligar';
    case 'app':
      return `Abrir ${st.label}`;
    case 'alexa':
      return `Alexa: ${st.device}`;
    case 'wait':
      return `Esperar ${st.seconds} s`;
    case 'sleep':
      return `Desligar em ${st.minutes} min`;
  }
}

export function describe(a: Automation) {
  return a.steps.map(describeStep).join(' · ');
}

export async function runAutomation(a: Automation, onStep?: (i: number) => void) {
  const s = await getSettings();
  for (let i = 0; i < a.steps.length; i++) {
    onStep?.(i);
    const st = a.steps[i];
    switch (st.type) {
      case 'power':
        await Native.power();
        break;
      case 'app':
        if (s.projectorIp) await projector.launch(s.projectorIp, st.pkg);
        break;
      case 'alexa':
        await triggerAlexa(st.device);
        break;
      case 'wait':
        await new Promise((r) => setTimeout(r, st.seconds * 1000));
        break;
      case 'sleep':
        Native.sleepTimer(st.minutes);
        break;
    }
  }
}
