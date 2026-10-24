import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'power' | 'up' | 'down' | 'left' | 'right' | 'back' | 'home' | 'menu'
  | 'volDown' | 'volUp' | 'mute' | 'keyboard' | 'touchpad' | 'dpad' | 'play'
  | 'plus' | 'gear' | 'remote' | 'close' | 'chevL' | 'chevR' | 'trash' | 'rewind' | 'forward' | 'playPause';

// Ícones sólidos simples (sem emoji), no mesmo estilo da prévia aprovada.
export default function Icon({ name, size = 22, color = '#e9edf2' }: { name: IconName; size?: number; color?: string }) {
  const p = { fill: color };
  let body: React.ReactNode = null;
  switch (name) {
    case 'power':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
          <Path d="M12 3v8" />
          <Path d="M6.3 6.6a8 8 0 1 0 11.4 0" />
        </Svg>
      );
    case 'up': body = <Path d="M12 6l7 9H5z" {...p} />; break;
    case 'down': body = <Path d="M12 18l-7-9h14z" {...p} />; break;
    case 'left': body = <Path d="M6 12l9-7v14z" {...p} />; break;
    case 'right': body = <Path d="M18 12l-9 7V5z" {...p} />; break;
    case 'back': body = <Path d="M10 6L4 12l6 6v-4h6a4 4 0 0 0 0-8h-2v3h2a1 1 0 0 1 0 2h-6V6z" {...p} />; break;
    case 'home': body = <Path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" {...p} />; break;
    case 'menu': body = <Path d="M4 6h16v2.5H4zM4 10.75h16v2.5H4zM4 15.5h16V18H4z" {...p} />; break;
    case 'volDown': body = <><Path d="M4 9h4l5-4v14l-5-4H4z" {...p} /><Path d="M15 11h6v2h-6z" {...p} /></>; break;
    case 'volUp': body = <><Path d="M4 9h4l5-4v14l-5-4H4z" {...p} /><Path d="M17 11h-2v2h2v2h2v-2h2v-2h-2V9h-2z" {...p} /></>; break;
    case 'mute': body = <><Path d="M4 9h4l5-4v14l-5-4H4z" {...p} /><Path d="M16 15l6-6 1.4 1.4-6 6zM16 10.4L17.4 9l6 6-1.4 1.4z" {...p} /></>; break;
    case 'keyboard': body = <><Rect x={2} y={6} width={20} height={12} rx={3} {...p} /><Rect x={6} y={13} width={12} height={2} fill="#15181d" /><Rect x={5} y={9} width={2} height={2} fill="#15181d" /><Rect x={9} y={9} width={2} height={2} fill="#15181d" /><Rect x={13} y={9} width={2} height={2} fill="#15181d" /><Rect x={17} y={9} width={2} height={2} fill="#15181d" /></>; break;
    case 'touchpad': body = <><Rect x={4} y={3} width={16} height={18} rx={4} {...p} /><Rect x={10} y={15} width={4} height={4} rx={1} fill="#15181d" /></>; break;
    case 'dpad': body = <Path d="M12 2l4 5H8zM12 22l-4-5h8zM2 12l5-4v8zM22 12l-5 4V8z" {...p} />; break;
    case 'play': body = <Path d="M8 5v14l11-7z" {...p} />; break;
    case 'playPause': body = <Path d="M3 5v14l9-7zM14 5h3v14h-3zM19 5h3v14h-3z" {...p} />; break;
    case 'rewind': body = <Path d="M11 6v12l-8-6zM21 6v12l-8-6z" {...p} />; break;
    case 'forward': body = <Path d="M13 6v12l8-6zM3 6v12l8-6z" {...p} />; break;
    case 'plus': body = <Path d="M11 5h2v14h-2zM5 11h14v2H5z" {...p} />; break;
    case 'close': body = <Path d="M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z" {...p} />; break;
    case 'chevL': body = <Path d="M15 5l-7 7 7 7 1.4-1.4L10.8 12l5.6-5.6z" {...p} />; break;
    case 'chevR': body = <Path d="M9 5l7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6z" {...p} />; break;
    case 'trash': body = <Path d="M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z" {...p} />; break;
    case 'remote': body = <><Circle cx={12} cy={12} r={9} {...p} /><Circle cx={12} cy={12} r={3.5} fill="#0e1014" /></>; break;
    case 'gear': body = <><Path d="M12 2l2 3 3.5-.5.5 3.5 3 2-2 3 .5 3.5-3.5.5-2 3-2-3-3.5-.5.5-3.5-2-3 3-2 .5-3.5L10 5z" {...p} /><Circle cx={12} cy={12} r={3} fill="#0e1014" /></>; break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
