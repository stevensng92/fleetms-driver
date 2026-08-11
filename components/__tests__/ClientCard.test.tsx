import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ClientCard } from '../ClientCard';
import type { JobContact } from '../../lib/jobContact';

// NOTE: @testing-library/react-native v14 made `render` ASYNC (React 19
// concurrent rendering). Every render must be awaited — see CommissionPill.test.

const passengerContact: JobContact = { phone: '+60123456789', source: 'passenger' };
const clientContact:    JobContact = { phone: '+60111111111', source: 'client' };
const noContact:        JobContact = { phone: null, source: null };

function card(props: Partial<React.ComponentProps<typeof ClientCard>> = {}) {
  return (
    <ClientCard
      clientName="Continental Travel"
      passengerName={null}
      contact={noContact}
      pax={null}
      vehicleType={null}
      vehicleModel={null}
      vehiclePlate={null}
      {...props}
    />
  );
}

describe('ClientCard — headline', () => {
  it('shows the passenger as the headline when there is one', async () => {
    await render(card({ passengerName: 'Mr Tan' }));
    expect(screen.getByText('Passenger')).toBeTruthy();
    expect(screen.getByText('Mr Tan')).toBeTruthy();
  });

  it('falls back to the billing client when no passenger is named', async () => {
    await render(card());
    expect(screen.getByText('Client')).toBeTruthy();
    expect(screen.getByText('Continental Travel')).toBeTruthy();
  });
});

describe('ClientCard — contact number', () => {
  it('shows the passenger number with no attribution caption', async () => {
    // The headline name IS whose line this is, so a caption would be noise.
    await render(card({ passengerName: 'Mr Tan', contact: passengerContact }));
    expect(screen.getByText('+60123456789')).toBeTruthy();
    expect(screen.queryByText('(Continental Travel)')).toBeNull();
  });

  it('captions a client number shown under a passenger name', async () => {
    // The case worth being honest about: the driver reads "Mr Tan" but the
    // line answers to the booking office. Without the caption they ask for
    // Mr Tan and get told they have the wrong number.
    await render(card({ passengerName: 'Mr Tan', contact: clientContact }));
    expect(screen.getByText('+60111111111')).toBeTruthy();
    expect(screen.getByText('(Continental Travel)')).toBeTruthy();
  });

  it('does not caption a client number when the client IS the headline', async () => {
    await render(card({ contact: clientContact }));
    expect(screen.getByText('+60111111111')).toBeTruthy();
    expect(screen.queryByText('(Continental Travel)')).toBeNull();
  });

  it('shows a passenger number under a client headline without a caption', async () => {
    // The fourth combination of the caption rule: the number IS the
    // passenger's own, but no passenger name was captured, so the headline
    // falls back to the client. Rare in real data. Pinned deliberately rather
    // than left accidental — if dispatchers start capturing numbers without
    // names in volume, this is the case to revisit.
    await render(card({ passengerName: null, contact: passengerContact }));
    expect(screen.getByText('+60123456789')).toBeTruthy();
    expect(screen.queryByText('(Continental Travel)')).toBeNull();
  });

  it.each([
    ['*21*60123456789#',           'USSD forwarding code'],
    ['+60123456789 ext 12',        'strips into a valid-looking 13 digits'],
    ['call the office on 03-1234', 'prose someone typed into the field'],
  ])('never renders %s as a tappable number (%s)', async (stored) => {
    // The important half is the RENDER, not the tap. An earlier version of
    // this component validated only on press, so a value like these still
    // appeared verbatim in green next to a phone icon — arbitrary text chosen
    // by anyone with write access to the clients table, sitting in a surface
    // the driver trusts more than a dialog. Now it never reaches the screen.
    await render(card({ contact: { phone: stored, source: 'client' } }));
    expect(screen.queryByText(stored)).toBeNull();
    expect(screen.getByText('Number on file is not valid — contact dispatch')).toBeTruthy();
  });

  it('distinguishes "no number" from "the number on file is junk"', async () => {
    // Two different problems for dispatch: one needs a number captured, the
    // other needs a bad one corrected. Showing nothing for both would hide the
    // second forever.
    await render(card({ contact: noContact }));
    expect(screen.queryByText('Number on file is not valid — contact dispatch')).toBeNull();
  });

  it('renders no call row when nothing is on file', async () => {
    // Roughly a quarter of real jobs. A dead tap target is worse than none.
    await render(card({ passengerName: 'Mr Tan' }));
    expect(screen.queryByText('+60123456789')).toBeNull();
    expect(screen.queryByText('(Continental Travel)')).toBeNull();
  });
});

describe('ClientCard — dialling', () => {
  // spyOn hands back the SAME mock when the method is already spied, so a
  // per-test `const open = jest.spyOn(...)` inherits the previous test's call
  // history. Set both up once and clear between tests instead.
  let open: jest.SpyInstance;
  let alert: jest.SpyInstance;

  beforeEach(() => {
    open  = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    open.mockClear();
    alert.mockClear();
  });

  afterAll(() => jest.restoreAllMocks());

  it('dials the resolved number', async () => {
    await render(card({ contact: clientContact }));
    fireEvent.press(screen.getByText('+60111111111'));
    expect(open).toHaveBeenCalledWith('tel:+60111111111');
  });

  it('strips cosmetic formatting before dialling', async () => {
    await render(card({ contact: { phone: '+6012-345 6789', source: 'passenger' } }));
    fireEvent.press(screen.getByText('+6012-345 6789'));
    expect(open).toHaveBeenCalledWith('tel:+60123456789');
  });

  it('warns when the dialer refuses the tel: URL', async () => {
    open.mockRejectedValueOnce(new Error('no activity found'));
    await render(card({ contact: clientContact }));
    fireEvent.press(screen.getByText('+60111111111'));
    // .catch() resolves on the microtask queue, so the assertion has to wait a
    // tick. Deliberately NOT `await act(async () => {})` — that detaches
    // `screen` from subsequent renders and silently broke the four vehicle-line
    // tests and the pax test further down this file, which then failed with
    // "unable to find an element" while passing in isolation.
    await Promise.resolve();
    expect(alert).toHaveBeenCalledWith('Could not start call', 'The dialer would not open.');
  });
});

describe('ClientCard — vehicle line', () => {
  it('joins type, model and plate', async () => {
    await render(card({ vehicleType: 'mpv', vehicleModel: 'Alphard', vehiclePlate: 'WA 1234 B' }));
    expect(screen.getByText('MPV · Alphard · WA 1234 B')).toBeTruthy();
  });

  it('falls back to the requested type alone before a vehicle is assigned', async () => {
    await render(card({ vehicleType: 'sedan_executive' }));
    expect(screen.getByText('Executive')).toBeTruthy();
  });

  it('passes an unmapped vehicle type through rather than blanking the row', async () => {
    await render(card({ vehicleType: 'limousine' }));
    expect(screen.getByText('limousine')).toBeTruthy();
  });

  it('says so when there is no vehicle at all', async () => {
    await render(card());
    expect(screen.getByText('No vehicle assigned')).toBeTruthy();
  });
});

describe('ClientCard — pax', () => {
  it('shows the pax chip when a count is set', async () => {
    await render(card({ pax: 4 }));
    expect(screen.getByText('4 pax')).toBeTruthy();
  });

  it('renders no chip when pax is unknown', async () => {
    await render(card());
    expect(screen.queryByText(/pax$/)).toBeNull();
  });
});
