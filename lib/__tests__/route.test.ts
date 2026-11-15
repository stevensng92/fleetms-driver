import {
  stopLabel, stopCountLabel, surchargeNote, vehicleTypeLabel, vehicleLine, routeStops,
} from '../route';

// Ported from the mock's rules.test.ts ("stops and surcharges"), adapted to the
// real data: the database gives stops as "Pickup", "Stop 3" (by row position)
// and "Dropoff", and a vehicle as separate type, model and plate fields.

describe('stopLabel', () => {
  it('names stops Pickup, Stop n and Drop-off', () => {
    const stops = [{ kind: 'Pickup' }, { kind: 'Stop 1' }, { kind: 'Dropoff' }];
    expect(stops.map((_s, i) => stopLabel(stops, i))).toEqual(['Pickup', 'Stop 1', 'Drop-off']);
  });

  it('counts the middle stops 1, 2, 3 whatever their row positions were', () => {
    // Row positions can skip (a deleted stop). The driver sees an unbroken count.
    const stops = [{ kind: 'Pickup' }, { kind: 'Stop 2' }, { kind: 'Stop 5' }, { kind: 'Dropoff' }];
    expect(stops.map((_s, i) => stopLabel(stops, i))).toEqual(['Pickup', 'Stop 1', 'Stop 2', 'Drop-off']);
  });

  it('writes Drop-off with a hyphen, never "Dropoff"', () => {
    expect(stopLabel([{ kind: 'Pickup' }, { kind: 'Dropoff' }], 1)).toBe('Drop-off');
  });
});

describe('stopCountLabel', () => {
  it('says 1 stop, not 1 stops', () => {
    expect(stopCountLabel(1)).toBe('1 stop');
  });
  it('pluralises everything else', () => {
    expect(stopCountLabel(2)).toBe('2 stops');
    expect(stopCountLabel(3)).toBe('3 stops');
  });
});

describe('surchargeNote', () => {
  it("says what each surcharge does to the driver's pay", () => {
    expect(surchargeNote({ treatment: 'pass_through', paidInAdvance: false })).toBe('Added to your pay');
    expect(surchargeNote({ treatment: 'commissionable', paidInAdvance: false })).toBe('Counts toward fare');
    expect(surchargeNote({ treatment: 'commissionable', paidInAdvance: true })).toBe('Paid in advance');
  });
  it('lets paid in advance win over the treatment', () => {
    expect(surchargeNote({ treatment: 'pass_through', paidInAdvance: true })).toBe('Paid in advance');
  });
});

describe('vehicleTypeLabel', () => {
  it('is the one list of vehicle type names', () => {
    expect(vehicleTypeLabel('sedan')).toBe('Sedan');
    expect(vehicleTypeLabel('sedan_executive')).toBe('Executive');
    expect(vehicleTypeLabel('mpv')).toBe('MPV');
    expect(vehicleTypeLabel('van')).toBe('Van');
    expect(vehicleTypeLabel('coach')).toBe('Coach');
  });
  it('passes an unknown type through rather than blanking it', () => {
    expect(vehicleTypeLabel('limousine')).toBe('limousine');
  });
});

describe('vehicleLine', () => {
  it('reads "MPV, Alphard WA 1234 B": type, then the car (model and plate)', () => {
    expect(vehicleLine({ type: 'mpv', model: 'Alphard', plate: 'WA 1234 B' })).toBe('MPV, Alphard WA 1234 B');
  });
  it('drops the parts that are missing', () => {
    expect(vehicleLine({ type: 'sedan_executive', model: null, plate: null })).toBe('Executive');
    expect(vehicleLine({ type: null, model: 'Alphard', plate: 'WA 1234 B' })).toBe('Alphard WA 1234 B');
    expect(vehicleLine({ type: 'mpv', model: null, plate: 'WA 1234 B' })).toBe('MPV, WA 1234 B');
    expect(vehicleLine({ type: 'mpv', model: 'Alphard', plate: null })).toBe('MPV, Alphard');
  });
  it('is null when there is nothing to say', () => {
    expect(vehicleLine({ type: null, model: null, plate: null })).toBeNull();
  });
});

describe('routeStops', () => {
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 6, 29, h - 8, m)).toISOString(); // Malaysia time
  it('labels each stop and gives a time only when the stop has one', () => {
    const out = routeStops([
      { kind: 'Pickup', location: 'KLIA', detail: 'Arrivals', scheduledAt: at(9, 15), lat: 1, lng: 2 },
      { kind: 'Stop 1', location: 'Mid Valley', detail: null, scheduledAt: null, lat: null, lng: null },
      { kind: 'Dropoff', location: 'Pavilion', detail: null, scheduledAt: at(14, 5), lat: null, lng: null },
    ]);
    expect(out.map(s => s.label)).toEqual(['Pickup', 'Stop 1', 'Drop-off']);
    expect(out.map(s => s.time)).toEqual(['09:15', null, '14:05']);
    expect(out[0].place).toBe('KLIA, Arrivals');
    expect(out[1].place).toBe('Mid Valley');
    expect(out[0]).toMatchObject({ lat: 1, lng: 2 });
  });
});
