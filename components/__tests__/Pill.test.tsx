import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Pill, PillShell } from '../Pill';
import { FeatureCard } from '../FeatureCard';
import { makeTokens } from '../../theme/tokens';

const L = makeTokens('light');

describe('Pill', () => {
  it('is a 24px pill with the tone tint and text colour', async () => {
    await render(<Pill tone="amber" testID="p">New</Pill>);
    expect(screen.getByTestId('p')).toHaveStyle({
      height: 24, borderRadius: 999, backgroundColor: L.amberSoft,
    });
    expect(screen.getByText('New')).toHaveStyle({ color: L.amberText, fontSize: 12, fontWeight: '600' });
  });

  it('defaults to neutral', async () => {
    await render(<Pill testID="p">Default</Pill>);
    expect(screen.getByTestId('p')).toHaveStyle({ backgroundColor: L.neutralSoft });
  });

  it('draws the optional icon', async () => {
    await render(<Pill tone="green" icon="check" testID="p">Ok</Pill>);
    expect(screen.getByTestId('p-icon')).toBeTruthy();
  });

  it('draws no icon slot without one', async () => {
    await render(<Pill testID="p">Ok</Pill>);
    expect(screen.queryByTestId('p-icon')).toBeNull();
  });

  it('onFeature uses the dark-card tints', async () => {
    await render(<Pill tone="blue" onFeature testID="p">X</Pill>);
    expect(screen.getByTestId('p')).toHaveStyle({ backgroundColor: L.onFeatureStatus.blueSoft });
    expect(screen.getByText('X')).toHaveStyle({ color: L.onFeatureStatus.blueText });
  });

  it('picks the dark tints by itself inside a FeatureCard', async () => {
    await render(<FeatureCard><Pill tone="green" testID="p">X</Pill></FeatureCard>);
    expect(screen.getByTestId('p')).toHaveStyle({ backgroundColor: L.onFeatureStatus.greenSoft });
  });

  it('an explicit onFeature={false} wins inside a FeatureCard', async () => {
    await render(<FeatureCard><Pill tone="green" onFeature={false} testID="p">X</Pill></FeatureCard>);
    expect(screen.getByTestId('p')).toHaveStyle({ backgroundColor: L.greenSoft });
  });

  it('can strike the word through (used by a cancelled status)', async () => {
    await render(<PillShell bg="#000" fg="#fff" struck>Gone</PillShell>);
    expect(screen.getByText('Gone')).toHaveStyle({ textDecorationLine: 'line-through' });
  });
});
