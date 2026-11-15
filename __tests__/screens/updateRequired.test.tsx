import React from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UpdateRequiredScreen } from '../../components/UpdateRequiredScreen';
import { makeTokens } from '../../theme/tokens';

describe('UpdateRequiredScreen', () => {
  it('says what is wrong in the mock words', async () => {
    await render(<UpdateRequiredScreen currentVersion="0.11.0" minimumVersion="0.12.0"/>);
    expect(screen.getByText('Update required')).toBeTruthy();
    expect(screen.getByText('This version of FleetMS Driver is no longer supported. Update the app to keep using it.')).toBeTruthy();
    expect(screen.getByText('0.11.0')).toBeTruthy();
    expect(screen.getByText('0.12.0')).toBeTruthy();
  });

  it('opens the download page from the Update now button', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<UpdateRequiredScreen currentVersion="0.11.0" minimumVersion="0.12.0"/>);
    await fireEvent.press(screen.getByText('Update now'));
    expect(open).toHaveBeenCalledWith('https://app.fleetms.my/driver-app');
  });

  it('is a calm card: the button is ink and nothing is red', async () => {
    await render(<UpdateRequiredScreen currentVersion="0.11.0" minimumVersion={null}/>);
    const T = makeTokens('light');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain(T.ink);
    expect(tree).not.toContain(T.red);
    expect(tree).not.toContain(T.redSoft);
  });
});
