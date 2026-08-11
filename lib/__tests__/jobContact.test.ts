import { resolveJobContact, isDialable, toDialString } from '../jobContact';

// This chain is the whole reason drivers could not reach anyone. The card read
// jobs.passenger_phone and nothing else, and dispatchers fill that in on only
// about one job in ten — while most of the rest had a billing client WITH a
// number on file. Every case below is a row shape that exists in real data.
// (Tenant-level counts live in the private dispatcher repo; this one is public.)

describe('resolveJobContact — passenger wins', () => {
  it('uses the passenger number when there is one', async () => {
    expect(resolveJobContact('+60123456789', '+60111111111'))
      .toEqual({ phone: '+60123456789', source: 'passenger' });
  });

  it('prefers the passenger even when no client number exists', async () => {
    expect(resolveJobContact('+60123456789', null))
      .toEqual({ phone: '+60123456789', source: 'passenger' });
  });

  it('trims surrounding whitespace off the number it returns', async () => {
    // tel: gets the cleaned value downstream, but the visible label is this
    // string — a leading space renders as a ragged row.
    expect(resolveJobContact('  +60123456789 ', null))
      .toEqual({ phone: '+60123456789', source: 'passenger' });
  });
});

describe('resolveJobContact — client fallback', () => {
  it('falls back to the billing client when the passenger has no number', async () => {
    expect(resolveJobContact(null, '+60111111111'))
      .toEqual({ phone: '+60111111111', source: 'client' });
  });

  it('falls through a blank passenger number rather than stopping on it', async () => {
    // The bug this guards: `??` treats '' as present and short-circuits, so a
    // legacy/imported row holding '' would swallow a real client number.
    expect(resolveJobContact('', '+60111111111'))
      .toEqual({ phone: '+60111111111', source: 'client' });
  });

  it('falls through a whitespace-only passenger number', async () => {
    expect(resolveJobContact('   ', '+60111111111'))
      .toEqual({ phone: '+60111111111', source: 'client' });
  });

  it('trims the client number too', async () => {
    expect(resolveJobContact(null, ' +60111111111 '))
      .toEqual({ phone: '+60111111111', source: 'client' });
  });
});

describe('resolveJobContact — nothing on file', () => {
  it('reports no contact when both are null', async () => {
    // Roughly a quarter of real jobs. The card must render no call row at all
    // rather than a dead tap target.
    expect(resolveJobContact(null, null)).toEqual({ phone: null, source: null });
  });

  it('reports no contact when both are blank', async () => {
    expect(resolveJobContact('  ', '')).toEqual({ phone: null, source: null });
  });

  it('treats undefined the same as null on both arguments', async () => {
    // The RPC helper returns null on failure, but the job row field arrives
    // straight off PostgREST and can be undefined if the column is unselected.
    expect(resolveJobContact(undefined, undefined)).toEqual({ phone: null, source: null });
  });
});

// isDialable gates BOTH the render and the tap, so every case here is really
// asking two questions at once: would we show this to a driver, and would we
// dial it. Neither source column has a CHECK constraint and both are writable
// by dispatcher-role accounts, so these are untrusted-input tests, not
// formatting tests.

describe('isDialable — accepts real numbers', () => {
  it.each([
    ['+60123456789',      'E.164'],
    ['0123456789',        'local, no country code'],
    ['+60 12-345 6789',   'spaces and hyphens'],
    ['(03) 1234-5678',    'brackets'],
    ['+6012345678901',    '15 digits, the documented ceiling'],
    ['1234567',           '7 digits, the documented floor'],
  ])('accepts %s (%s)', async (phone) => {
    expect(isDialable(phone)).toBe(true);
  });
});

describe('isDialable — rejects what must never dial', () => {
  it.each([
    ['*21*60123456789#',            'USSD forwarding code'],
    ['+6012,,3456789',              'comma is a dial pause'],
    ['+60123456789;12',             'semicolon is a wait'],
    ['+60123456789 ext 12',         'strips into a valid-looking 13 digits'],
    ['call the office on 03-1234',  'prose'],
    ['-------1234567',              'does not start with a digit'],
    ['123456',                      'too short once stripped'],
    ['+601234567890123456',         'too long once stripped'],
    ['',                            'empty'],
  ])('rejects %s (%s)', async (phone) => {
    expect(isDialable(phone)).toBe(false);
  });

  it('rejects whitespace that is not a plain space', async () => {
    // The bug this pins: `\s` in the shape check would admit newlines and
    // wide spaces, so this would render as a number with a stray "99" pushed
    // below where the driver stops reading, and dial 031234567899 — a number
    // that was never displayed. A literal space in the class is what stops it.
    expect(isDialable('0312345678\n\n\n\n\n\n99')).toBe(false);
    expect(isDialable('0312345678　 9999')).toBe(false);
    expect(isDialable('0312345678 9999')).toBe(false);
  });

  it('rejects null and undefined', async () => {
    expect(isDialable(null)).toBe(false);
    expect(isDialable(undefined)).toBe(false);
  });
});

describe('toDialString', () => {
  it('keeps digits and a leading plus, drops cosmetic formatting', async () => {
    expect(toDialString('+60 12-345 6789')).toBe('+60123456789');
    expect(toDialString('(03) 1234-5678')).toBe('0312345678');
  });

  it('what gets dialled is what the card displayed, modulo formatting', async () => {
    // The invariant the two functions exist to hold together: for anything
    // isDialable accepts, stripping only removes characters a reader ignores.
    const shown = '+60 12-345 6789';
    expect(isDialable(shown)).toBe(true);
    expect(toDialString(shown)).toBe('+60123456789');
  });
});
