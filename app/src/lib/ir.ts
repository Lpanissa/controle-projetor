import Native from '../../modules/projector-native';

// Endereços NEC mais usados em projetores e TVs genéricos chineses.
export const COMMON_ADDRESSES = [0x00, 0x01, 0x02, 0x03, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x7f, 0xfe, 0xff];

// Comandos de "power" mais comuns nesses controles — testados primeiro em cada endereço.
const LIKELY_POWER = [0x45, 0x12, 0x0a, 0x1c, 0x40, 0x08, 0x00, 0x18, 0x02, 0x4d, 0x15, 0x0d, 0x5c, 0x0b];

export type IrCode = { address: number; command: number };

/** Ordem de teste: comandos prováveis primeiro, depois todos os outros. */
export function sweepList(address: number): IrCode[] {
  const rest: number[] = [];
  for (let c = 0; c < 256; c++) if (!LIKELY_POWER.includes(c)) rest.push(c);
  return [...LIKELY_POWER, ...rest].map((command) => ({ address, command }));
}

export const hex = (n: number, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');

export async function sendCode(c: IrCode) {
  // manda duas vezes, alguns aparelhos ignoram o primeiro quadro
  await Native.sendNec(c.address, c.command);
  await new Promise((r) => setTimeout(r, 60));
  await Native.sendNec(c.address, c.command);
}
