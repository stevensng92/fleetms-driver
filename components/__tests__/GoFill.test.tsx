import React from 'react';
import { processColor } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GoFill } from '../GoFill';
import { makeTokens } from '../../theme/tokens';

const L = makeTokens('light');

// react-native-svg renders as native host nodes under Jest; find one by its type name.
function find(type: string): any {
  const hit = (n: any): any => {
    if (!n || typeof n === 'string') return undefined;
    if (n.type === type) return n;
    for (const c of n.children ?? []) { const r = hit(c); if (r) return r; }
    return undefined;
  };
  return hit(screen.toJSON());
}
const argb = (hex: string) => (processColor(hex) as number) | 0;

describe('GoFill', () => {
  it('fills its parent without catching touches', async () => {
    await render(<GoFill testID="g"/>);
    expect(screen.getByTestId('g')).toHaveStyle({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    expect(screen.getByTestId('g').props.pointerEvents).toBe('none');
  });

  it('runs goFrom to goTo, left to right by default', async () => {
    await render(<GoFill/>);
    const g = find('RNSVGLinearGradient').props;
    expect(g).toMatchObject({ x1: '0', y1: '0', x2: '1', y2: '0' });
    // gradient is [offset, colour, offset, colour]
    expect(g.gradient).toEqual([0, argb(L.goFrom), 1, argb(L.goTo)]);
  });

  it('vertical runs top to bottom', async () => {
    await render(<GoFill vertical/>);
    expect(find('RNSVGLinearGradient').props).toMatchObject({ x2: '0', y2: '1' });
  });

  it('rounds the fill to the given radius', async () => {
    await render(<GoFill radius={16}/>);
    expect(find('RNSVGRect').props).toMatchObject({ rx: 16, ry: 16 });
  });

  it('is square by default and paints the rect with the gradient', async () => {
    await render(<GoFill/>);
    const rect = find('RNSVGRect').props;
    expect(rect).toMatchObject({ rx: 0, ry: 0 });
    expect(rect.fill.brushRef).toBe(find('RNSVGLinearGradient').props.name);
  });
});
