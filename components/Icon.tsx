import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'receipt' | 'wallet' | 'user'
  | 'chevL' | 'chevR' | 'chevDown'
  | 'check' | 'checkCirc' | 'x'
  | 'pin' | 'clock' | 'phone' | 'car' | 'users'
  | 'fuel' | 'toll' | 'dots' | 'camera'
  | 'calendar' | 'waze' | 'maps' | 'bell'
  | 'plus' | 'image' | 'zoom' | 'arrowRight';

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
};

export function Icon({ name, size = 20, stroke = 2, color = 'currentColor' }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return <Svg {...common}><Path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2z"/></Svg>;
    case 'receipt':
      return <Svg {...common}><Path d="M5 3v18l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2 2 2V3l-2 2-2.5-2-2.5 2-2.5-2-2.5 2L5 3z"/><Path d="M9 9h6M9 13h6M9 17h3"/></Svg>;
    case 'wallet':
      return <Svg {...common}><Path d="M3 7a2 2 0 012-2h13l3 3v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><Path d="M16 13h2"/></Svg>;
    case 'user':
      return <Svg {...common}><Circle cx={12} cy={8} r={4}/><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></Svg>;
    case 'chevL':
      return <Svg {...common}><Path d="M15 6l-6 6 6 6"/></Svg>;
    case 'chevR':
      return <Svg {...common}><Path d="M9 6l6 6-6 6"/></Svg>;
    case 'chevDown':
      return <Svg {...common}><Path d="M6 9l6 6 6-6"/></Svg>;
    case 'check':
      return <Svg {...common}><Path d="M5 12l5 5L20 7"/></Svg>;
    case 'checkCirc':
      return <Svg {...common}><Circle cx={12} cy={12} r={9}/><Path d="M8 12l3 3 5-5"/></Svg>;
    case 'x':
      return <Svg {...common}><Path d="M18 6L6 18M6 6l12 12"/></Svg>;
    case 'pin':
      return <Svg {...common}><Path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"/><Circle cx={12} cy={9} r={2.5}/></Svg>;
    case 'clock':
      return <Svg {...common}><Circle cx={12} cy={12} r={9}/><Path d="M12 7v5l3 2"/></Svg>;
    case 'phone':
      return <Svg {...common}><Path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.5 19.5 0 015 13a19.8 19.8 0 01-3.1-8.7A2 2 0 013.9 2H7a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.4c.9.3 1.8.5 2.7.6A2 2 0 0122 16.9z"/></Svg>;
    case 'car':
      return <Svg {...common}><Path d="M5 17h14M5 17v-4l1.5-4A2 2 0 018.4 8h7.2a2 2 0 011.9 1.5L19 13v4"/><Circle cx={8} cy={17} r={1.5}/><Circle cx={16} cy={17} r={1.5}/></Svg>;
    case 'users':
      return <Svg {...common}><Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><Circle cx={9} cy={7} r={4}/><Path d="M22 21v-2a4 4 0 00-3-3.9"/><Path d="M16 3.1a4 4 0 010 7.8"/></Svg>;
    case 'fuel':
      return <Svg {...common}><Path d="M3 21V5a2 2 0 012-2h7a2 2 0 012 2v16"/><Path d="M3 21h11M14 9h2a2 2 0 012 2v6a2 2 0 002 2v-9.5l-2-2"/><Path d="M6 8h5"/></Svg>;
    case 'toll':
      return <Svg {...common}><Path d="M3 20h18M5 20V8h4v12M15 20V8h4v12M9 14h6"/><Circle cx={12} cy={5} r={2}/></Svg>;
    case 'dots':
      return <Svg {...common}><Circle cx={6} cy={12} r={1.6}/><Circle cx={12} cy={12} r={1.6}/><Circle cx={18} cy={12} r={1.6}/></Svg>;
    case 'camera':
      return <Svg {...common}><Path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><Circle cx={12} cy={13} r={4}/></Svg>;
    case 'calendar':
      return <Svg {...common}><Rect x={3} y={5} width={18} height={16} rx={2}/><Path d="M3 9h18M8 3v4M16 3v4"/></Svg>;
    case 'waze':
      return <Svg {...common}><Path d="M12 2a8 8 0 018 8c0 3-2 5-2 7a3 3 0 01-3 3H9a3 3 0 01-3-3c0-2-2-4-2-7a8 8 0 018-8z"/><Circle cx={9} cy={10} r={1}/><Circle cx={15} cy={10} r={1}/><Path d="M9 14c1 1 4 1 5 0"/></Svg>;
    case 'maps':
      return <Svg {...common}><Path d="M9 3l-6 2v16l6-2 6 2 6-2V3l-6 2-6-2z"/><Path d="M9 3v16M15 5v16"/></Svg>;
    case 'bell':
      return <Svg {...common}><Path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><Path d="M13.7 21a2 2 0 01-3.4 0"/></Svg>;
    case 'plus':
      return <Svg {...common}><Path d="M12 5v14M5 12h14"/></Svg>;
    case 'image':
      return <Svg {...common}><Rect x={3} y={3} width={18} height={18} rx={2}/><Circle cx={9} cy={9} r={1.6}/><Path d="M21 16l-5-5-9 9"/></Svg>;
    case 'zoom':
      return <Svg {...common}><Circle cx={11} cy={11} r={7}/><Path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></Svg>;
    case 'arrowRight':
      return <Svg {...common}><Path d="M5 12h14M13 5l7 7-7 7"/></Svg>;
    default:
      return null;
  }
}
