import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FeatureCard, useOnFeature } from '../FeatureCard';
import { makeTokens } from '../../theme/tokens';

function Probe() {
  return <Text>{useOnFeature() ? 'on-feature' : 'off-feature'}</Text>;
}

describe('FeatureCard', () => {
  it('is the dark card: feature fill, radius 32, 1px edge, padding 20', async () => {
    const T = makeTokens('light');
    await render(<FeatureCard testID="fc"><Text>hi</Text></FeatureCard>);
    expect(screen.getByTestId('fc')).toHaveStyle({
      backgroundColor: T.feature, borderRadius: 32, borderWidth: 1, borderColor: T.featureEdge, padding: 20,
    });
  });

  it('lets callers add style', async () => {
    await render(<FeatureCard testID="fc" style={{ marginTop: 7 }}><Text>x</Text></FeatureCard>);
    expect(screen.getByTestId('fc')).toHaveStyle({ marginTop: 7 });
  });

  it('tells children they are on the feature card', async () => {
    await render(<FeatureCard><Probe/></FeatureCard>);
    expect(screen.getByText('on-feature')).toBeTruthy();
  });

  it('children outside the card are not on feature', async () => {
    await render(<Probe/>);
    expect(screen.getByText('off-feature')).toBeTruthy();
  });
});
