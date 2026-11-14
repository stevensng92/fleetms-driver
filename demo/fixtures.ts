// Demo data for the web preview. NOT shipped in builds: only metro.config.js
// reaches this, and only when EXPO_PUBLIC_DEMO_DATA=1 on web.
//
// The story mirrors the redesign mock's fake day (driver Azman, Continental
// Travel, a Toyota Alphard, jobs JOB-124 / JOB-132 / JOB-137..144) so the two
// sides of a before/after comparison show the same data. Everything here is
// invented: names, phone numbers and plates are the mock's own fakes.
//
// The mock's "today" is 12 Dec 2026. Every date below is written as that day's
// calendar and shifted so the mock's today lands on the REAL Malaysia today,
// which is what puts the overdue / today / tomorrow / upcoming jobs in the
// right groups whenever the demo is opened.
//
// Rows are stored NORMALISED, one array per table, and nested shapes (the
// `jobs:job_id (...)` embeds) are built at read time by fakeSupabase.ts. That
// keeps the data free of circular references and lets a mutation change one
// place only.

export const MOCK_TODAY = '2026-12-12';
const DAY_MS = 86_400_000;
const MY_OFFSET_MS = 8 * 3_600_000;

/** "YYYY-MM-DD" of the Malaysia calendar day containing this instant. */
export function malaysiaDateKey(d: Date): string {
  return new Date(d.getTime() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
}

/** Shift a "YYYY-MM-DD" key by whole days. */
export function shiftDateKey(key: string, days: number): string {
  return new Date((dayNumber(key) + days) * DAY_MS).toISOString().slice(0, 10);
}

// ---- row types (the columns the app's selects read) ------------------------

export type JobStatus = 'pending' | 'confirmed' | 'in_progress' | 'done' | 'cancelled' | 'rejected';

export interface VehicleRow { id: string; plate_number: string; type: string; model: string; capacity: number; is_default: boolean }
export interface ClientRow { id: string; name: string; phone: string }
export interface DriverRow {
  id: string; org_id: string; name: string; phone: string; license_class: string | null;
  availability: 'available' | 'pending_confirmation' | 'on_job' | 'unavailable';
  is_active: boolean; pin_set: boolean;
  commission_rate: number | null; commission_fixed_amount: number | null;
  default_vehicle_id: string;
}
export interface OrgRow { id: string; name: string; driver_commission_rate: number }
export interface JobRow {
  id: string; job_number: string; status: JobStatus;
  pickup_datetime: string; pickup_location: string; pickup_detail: string | null; pickup_lat: number | null; pickup_lng: number | null;
  dropoff_location: string; dropoff_detail: string | null; dropoff_lat: number | null; dropoff_lng: number | null;
  client_id: string; client_name: string; passenger_name: string | null; passenger_phone: string | null;
  pax: number | null; vehicle_type_required: string | null;
  amount: number | null; commission_amount: number | null; payment_status: 'paid' | 'unpaid' | 'waived' | 'refunded';
  commission_rate_override: number | null; commission_fixed_amount: number | null;
  special_instructions: string | null;
}
export interface AssignmentRow { id: string; job_id: string; driver_id: string; is_current: boolean; vehicle_id: string; completed_at: string | null }
export interface StopRow { id: string; job_id: string; position: number; area: string; detail: string | null; scheduled_arrival_at: string | null; lat: number | null; lng: number | null }
export interface SurchargeRow { id: string; job_id: string; name_snapshot: string; amount_snapshot: number; treatment_snapshot: 'commissionable' | 'pass_through'; paid_in_advance: boolean }
export interface ExpenseRow {
  id: string; category: 'fuel' | 'toll' | 'other'; amount: number; expense_date: string;
  receipt_path: string | null; notes: string | null; voided_at: string | null;
  status: 'pending' | 'approved' | 'rejected'; vehicle_id: string; created_at: string;
}
export interface TimeOffRow {
  id: string; starts_at: string; ends_at: string; reason: 'leave' | 'mc' | 'off_duty';
  notes: string | null; status: 'pending' | 'approved' | 'rejected'; created_at: string;
}
export interface PushLogRow {
  id: string; kind: string; payload: Record<string, unknown>;
  enqueued_at: string; sent_at: string | null; read_at: string | null;
}

export interface Db {
  /** Whole days the mock calendar was shifted by. */
  offsetDays: number;
  /** The Malaysia calendar day the demo treats as today. */
  todayKey: string;
  org: OrgRow;
  driver: DriverRow;
  vehicles: VehicleRow[];
  clients: ClientRow[];
  jobs: JobRow[];
  assignments: AssignmentRow[];
  jobStops: StopRow[];
  surcharges: SurchargeRow[];
  expenses: ExpenseRow[];
  timeOff: TimeOffRow[];
  pushLog: PushLogRow[];
  nextId: number;
}

// ---- the mock's data, as plain literals ------------------------------------

type Pay = { kind: 'rate'; pct: number } | { kind: 'fixed'; amount: number } | null;
type MockStop = { kind: 'pickup' | 'stop' | 'dropoff'; place: string; detail?: string; time?: string };
type MockSurcharge = { name: string; amount: number; treatment: 'pass_through' | 'commission'; paidInAdvance: boolean };
interface MockJob {
  number: string; date: string; time: string; status: JobStatus;
  client: string; passengerName?: string; passengerPhone?: string; pax: number | null;
  vehicleType?: string; stops: MockStop[]; instructions?: string; surcharges?: MockSurcharge[];
  fare: number | null; pay?: Pay; commission?: number | null; payment?: string; assignmentId?: string;
}

const CLIENTS: ClientRow[] = [
  { id: 'c-petra', name: 'Petra Holdings', phone: '+60 3-2141 8800' },
  { id: 'c-apex', name: 'Apex Events', phone: '+60 3-7728 1450' },
  { id: 'c-tan', name: 'Mr Tan', phone: '+60 12-337 9021' },
  { id: 'c-seri', name: 'Seri Mutiara Hotel', phone: '+60 3-2026 5500' },
  { id: 'c-nusantara', name: 'Nusantara Weddings', phone: '+60 3-6201 3377' },
  { id: 'c-bookinghub', name: 'BookingHub', phone: '+60 3-9212 4400' },
];
const clientByName = (name: string) => CLIENTS.find(c => c.name === name)!;

const MOCK_JOBS: MockJob[] = [
  // Overdue: Thursday's airport run was never marked done.
  {
    number: 'JOB-139', date: '2026-12-10', time: '20:00', status: 'confirmed', client: 'Seri Mutiara Hotel',
    passengerName: 'Mr Kenji Watanabe', passengerPhone: '+60 17-204 5518', pax: 2,
    stops: [{ kind: 'pickup', place: 'Seri Mutiara Hotel', detail: 'Jalan Ampang', time: '20:00' }, { kind: 'dropoff', place: 'KLIA T1', detail: 'Departures, door 4' }],
    fare: 220,
  },
  // Today
  {
    number: 'JOB-124', date: MOCK_TODAY, time: '06:30', status: 'done', client: 'Petra Holdings', pax: 2,
    stops: [{ kind: 'pickup', place: 'Mandarin Oriental KL', time: '06:30' }, { kind: 'dropoff', place: 'KLIA T1', time: '07:45' }],
    fare: 240, commission: 144, payment: 'paid',
  },
  {
    number: 'JOB-137', date: MOCK_TODAY, time: '09:15', status: 'in_progress', client: 'Nusantara Weddings',
    passengerName: 'Puan Farah Idris', passengerPhone: '+60 12-880 7314', pax: 4,
    stops: [
      { kind: 'pickup', place: 'Sunway Resort', detail: 'Main lobby', time: '09:15' },
      { kind: 'stop', place: 'Masjid Wilayah', detail: 'Jalan Duta', time: '10:00' },
      { kind: 'dropoff', place: 'Majestic Hotel KL', detail: 'Ballroom entrance', time: '11:30' },
    ],
    instructions: 'Bridal party. Wait at the lobby with the white ribbon on the car. Ribbon is in the boot. Call the planner Hafiz if the bride is running late, never the bride.',
    surcharges: [{ name: 'Decoration', amount: 50, treatment: 'pass_through', paidInAdvance: false }],
    fare: 380, pay: { kind: 'fixed', amount: 80 },
  },
  {
    number: 'JOB-138', date: MOCK_TODAY, time: '14:30', status: 'pending', assignmentId: 'asg-138', client: 'Apex Events', pax: 6,
    stops: [{ kind: 'pickup', place: 'KL Sentral', detail: 'Level 1, Hilton side', time: '14:30' }, { kind: 'dropoff', place: 'Resorts World Genting', time: '16:00' }],
    surcharges: [
      { name: 'Highway toll', amount: 18.6, treatment: 'pass_through', paidInAdvance: false },
      { name: 'Waiting time', amount: 40, treatment: 'commission', paidInAdvance: false },
    ],
    fare: 420, pay: { kind: 'rate', pct: 70 },
  },
  {
    number: 'JOB-140', date: MOCK_TODAY, time: '19:00', status: 'confirmed', client: 'BookingHub',
    passengerName: 'Ms Sarah Tan', passengerPhone: '', pax: 1,
    stops: [{ kind: 'pickup', place: 'KLIA T1', detail: 'Arrivals, meet at pillar 7', time: '19:00' }, { kind: 'dropoff', place: 'TRX', detail: 'Exchange 106' }],
    surcharges: [{ name: 'Paging', amount: 20, treatment: 'commission', paidInAdvance: true }],
    fare: 190,
  },
  {
    number: 'JOB-144', date: MOCK_TODAY, time: '21:30', status: 'cancelled', client: 'Mr Tan', pax: 2,
    stops: [{ kind: 'pickup', place: 'Pavilion KL', time: '21:30' }, { kind: 'dropoff', place: 'Bangsar' }],
    fare: 120,
  },
  // Tomorrow
  {
    number: 'JOB-132', date: '2026-12-13', time: '10:30', status: 'confirmed', client: 'Mr Tan', pax: 2,
    stops: [{ kind: 'pickup', place: 'Shangri-La KL', time: '10:30' }, { kind: 'dropoff', place: 'Pavilion KL', time: '11:30' }],
    fare: 120, payment: 'paid',
  },
  {
    number: 'JOB-141', date: '2026-12-13', time: '18:00', status: 'pending', assignmentId: 'asg-141', client: 'Petra Holdings',
    passengerName: 'Mr Daniel Wong', passengerPhone: '12345', pax: 3,
    stops: [{ kind: 'pickup', place: 'Petra Holdings HQ', detail: 'Menara Petra, Jalan Sultan Ismail', time: '18:00' }, { kind: 'dropoff', place: 'Four Seasons KL' }],
    fare: 160,
  },
  // Upcoming
  {
    number: 'JOB-142', date: '2026-12-15', time: '07:00', status: 'confirmed', client: 'Petra Holdings', pax: 2, vehicleType: 'Executive',
    stops: [{ kind: 'pickup', place: 'Mandarin Oriental KL', time: '07:00' }, { kind: 'dropoff', place: 'KLIA T1' }],
    fare: 240,
  },
  {
    number: 'JOB-143', date: '2026-12-18', time: '15:45', status: 'pending', assignmentId: 'asg-143', client: 'Apex Events', pax: 5,
    stops: [{ kind: 'pickup', place: 'MITEC', detail: 'Hall 3 loading bay', time: '15:45' }, { kind: 'dropoff', place: 'Hilton KL' }],
    fare: null,
  },
];

// Done earlier: Earnings reads these. [number, date, time, client, fare, payment, commission, from, to]
const MOCK_EARLIER: [string, string, string, string, number, string, number | null, string, string][] = [
  ['JOB-088', '2026-11-09', '18:30', 'Petra Holdings', 500, 'invoiced', 300, 'KLIA T1', 'Mandarin Oriental KL'],
  ['JOB-096', '2026-12-01', '15:30', 'BookingHub', 190, 'paid', 114, 'KLIA T1', 'Mandarin Oriental KL'],
  ['JOB-101', '2026-12-03', '21:15', 'Mr Tan', 120, 'paid', 72, 'Pavilion KL', 'Bangsar'],
  ['JOB-102', '2026-12-04', '06:00', 'Petra Holdings', 600, 'invoiced', 360, 'Four Seasons KL', 'Ipoh'],
  ['JOB-117', '2026-12-10', '17:30', 'BookingHub', 190, 'unpaid', 114, 'KLIA T1', 'TRX'],
  ['JOB-118', '2026-12-10', '14:30', 'Mr Tan', 180, 'paid', 108, 'Bangsar South', 'KL Sentral'],
  ['JOB-122', '2026-12-11', '07:15', 'Petra Holdings', 240, 'unpaid', null, 'Mandarin Oriental KL', 'KLIA T1'],
];

const MOCK_EXPENSES = [
  { id: 'x1', category: 'fuel', date: '2026-12-12', amount: 185.5, notes: '', receipt: true, review: 'pending', voided: false },
  { id: 'd-x3', category: 'toll', date: '2026-12-10', amount: 9.8, notes: 'Plus highway, KL to Seremban', receipt: false, review: 'approved', voided: false },
  { id: 'x8', category: 'toll', date: '2026-12-05', amount: 22.4, notes: '', receipt: true, review: 'approved', voided: false },
  { id: 'd-x2', category: 'other', date: '2026-12-03', amount: 35, notes: 'Car wash', receipt: true, review: 'rejected', voided: false },
  { id: 'd-x1', category: 'fuel', date: '2026-12-02', amount: 120, notes: '', receipt: false, review: 'approved', voided: true },
] as const;

const MOCK_TIME_OFF = [
  { id: 't1', start: '2026-12-24', end: '2026-12-26', reason: 'leave', notes: 'Family in Penang', status: 'approved' },
  { id: 't2', start: '2027-01-04', end: '2027-01-04', reason: 'off_duty', notes: '', status: 'pending' },
] as const;

const MOCK_NOTIFICATIONS: { id: string; kind: string; job: string; at: string; read: boolean }[] = [
  { id: 'n6', kind: 'job_assigned', job: 'JOB-143', at: '2026-12-12T09:22', read: false },
  { id: 'n5', kind: 'pickup_reminder', job: 'JOB-137', at: '2026-12-12T08:45', read: false },
  { id: 'n4', kind: 'job_cancelled', job: 'JOB-144', at: '2026-12-12T08:10', read: true },
  { id: 'n3', kind: 'job_updated', job: 'JOB-138', at: '2026-12-11T18:02', read: true },
  { id: 'n2', kind: 'job_assigned', job: 'JOB-141', at: '2026-12-11T17:40', read: true },
  { id: 'n1', kind: 'reassigned', job: 'JOB-136', at: '2026-12-11T09:05', read: true },
];
/** The job a cancelled / reassigned notice used to start from: that job has left the driver's list. */
const GONE_PLACE: Record<string, { place: string; client: string }> = { 'JOB-136': { place: 'Hilton KL', client: 'Apex Events' } };

const VEHICLE_TYPE: Record<string, string> = { MPV: 'mpv', Executive: 'sedan_executive' };

// ---- builder ---------------------------------------------------------------

export function buildDb(now: Date = new Date()): Db {
  const todayKey = malaysiaDateKey(now);
  const offsetDays = dayNumber(todayKey) - dayNumber(MOCK_TODAY);
  const shift = (key: string) => shiftDateKey(key, offsetDays);
  /** Mock wall clock (Malaysia) to a real UTC instant string. */
  const at = (date: string, time: string) => new Date(`${shift(date)}T${time}:00+08:00`).toISOString();
  const myMidnight = (key: string) => new Date(`${key}T00:00:00+08:00`).toISOString();
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;

  const jobIdOf = (n: string) => `00000000-0000-4000-8000-000000000${n.replace(/\D/g, '').padStart(3, '0')}`;

  const vehicles: VehicleRow[] = [
    { id: 'v-alphard', plate_number: 'VKA 2231', type: 'mpv', model: 'Toyota Alphard', capacity: 7, is_default: true },
    { id: 'v-innova', plate_number: 'VFG 3390', type: 'mpv', model: 'Toyota Innova', capacity: 7, is_default: false },
    { id: 'v-vellfire', plate_number: 'WXY 8102', type: 'sedan_executive', model: 'Toyota Vellfire', capacity: 6, is_default: false },
  ];

  const jobs: JobRow[] = [];
  const assignments: AssignmentRow[] = [];
  const jobStops: StopRow[] = [];
  const surcharges: SurchargeRow[] = [];

  function addJob(m: MockJob, extra: { commission?: number | null; payment?: string } = {}) {
    const id = jobIdOf(m.number);
    const client = clientByName(m.client);
    const pick = m.stops[0];
    const drop = m.stops[m.stops.length - 1];
    const pay = m.pay ?? null;
    jobs.push({
      id, job_number: m.number, status: m.status,
      pickup_datetime: at(m.date, m.time), pickup_location: pick.place, pickup_detail: pick.detail ?? null, pickup_lat: null, pickup_lng: null,
      dropoff_location: drop.place, dropoff_detail: drop.detail ?? null, dropoff_lat: null, dropoff_lng: null,
      client_id: client.id, client_name: client.name,
      passenger_name: m.passengerName ?? null, passenger_phone: m.passengerPhone ?? null,
      pax: m.pax, vehicle_type_required: m.vehicleType ? VEHICLE_TYPE[m.vehicleType] ?? m.vehicleType.toLowerCase() : 'mpv',
      amount: m.fare,
      commission_amount: extra.commission ?? m.commission ?? null,
      // The mock also says "invoiced"; the app's enum has no such value, so it reads as unpaid.
      payment_status: ((extra.payment ?? m.payment ?? 'unpaid') === 'paid' ? 'paid' : 'unpaid'),
      commission_rate_override: pay?.kind === 'rate' ? pay.pct : null,
      commission_fixed_amount: pay?.kind === 'fixed' ? pay.amount : null,
      special_instructions: m.instructions ?? null,
    });
    assignments.push({
      id: m.assignmentId ?? `asg-${m.number.replace(/\D/g, '')}`, job_id: id, driver_id: 'driver-azman',
      is_current: true, vehicle_id: 'v-alphard', completed_at: m.status === 'done' ? at(m.date, m.time) : null,
    });
    // job_stops holds everything AFTER the pickup; the last one is the drop-off.
    m.stops.slice(1).forEach((s, i) => {
      jobStops.push({
        id: `${id}-s${i + 1}`, job_id: id, position: i + 1, area: s.place, detail: s.detail ?? null,
        scheduled_arrival_at: s.time ? at(m.date, s.time) : null, lat: null, lng: null,
      });
    });
    (m.surcharges ?? []).forEach((s, i) => {
      surcharges.push({
        id: `${id}-c${i + 1}`, job_id: id, name_snapshot: s.name, amount_snapshot: s.amount,
        treatment_snapshot: s.treatment === 'commission' ? 'commissionable' : 'pass_through', paid_in_advance: s.paidInAdvance,
      });
    });
  }

  for (const m of MOCK_JOBS) addJob(m);
  for (const [number, date, time, client, fare, payment, commission, from, to] of MOCK_EARLIER) {
    addJob({
      number, date, time, status: 'done', client, pax: 2, fare, commission, payment,
      stops: [{ kind: 'pickup', place: from, time }, { kind: 'dropoff', place: to }],
    });
  }
  // The list shows work in time order (the real query orders its embed by pickup).
  const byPickup = (a: { job_id: string }, b: { job_id: string }) =>
    Date.parse(jobs.find(j => j.id === a.job_id)!.pickup_datetime) - Date.parse(jobs.find(j => j.id === b.job_id)!.pickup_datetime);
  assignments.sort(byPickup);

  const expenses: ExpenseRow[] = MOCK_EXPENSES.map(e => {
    // The app lists "this month" only. Keep the story's recent days inside it
    // when the demo is opened early in a month.
    let date = shift(e.date);
    if (date < monthStartKey) date = monthStartKey;
    return {
      id: e.id, category: e.category, amount: e.amount, expense_date: date,
      receipt_path: e.receipt ? `demo/${e.id}.svg` : null, notes: e.notes || null,
      voided_at: e.voided ? myMidnight(date) : null, status: e.review, vehicle_id: 'v-alphard',
      created_at: new Date(`${date}T12:00:00+08:00`).toISOString(),
    };
  });

  const timeOff: TimeOffRow[] = MOCK_TIME_OFF.map(t => ({
    id: t.id,
    starts_at: myMidnight(shift(t.start)),
    // Half-open: the last day is inclusive, so the bound is the next midnight.
    ends_at: myMidnight(shiftDateKey(shift(t.end), 1)),
    reason: t.reason, notes: t.notes || null, status: t.status, created_at: now.toISOString(),
  }));

  const pushLog: PushLogRow[] = MOCK_NOTIFICATIONS.map(n => {
    const stamp = new Date(`${shift(n.at.slice(0, 10))}T${n.at.slice(11)}:00+08:00`).toISOString();
    const job = jobs.find(j => j.job_number === n.job);
    const gone = GONE_PLACE[n.job];
    return {
      id: n.id, kind: n.kind,
      payload: {
        job_number: n.job,
        client_name: job?.client_name ?? gone?.client,
        pickup_location: job?.pickup_location ?? gone?.place,
        pickup_datetime: job?.pickup_datetime,
        deeplink: job ? `/jobs/${n.job}` : '/notifications',
      },
      enqueued_at: stamp, sent_at: stamp, read_at: n.read ? stamp : null,
    };
  });

  return {
    offsetDays, todayKey,
    org: { id: 'org-continental', name: 'Continental Travel', driver_commission_rate: 60 },
    driver: {
      id: 'driver-azman', org_id: 'org-continental', name: 'Azman bin Yusof', phone: '+60 12-418 2290',
      license_class: 'D', availability: 'on_job', is_active: true, pin_set: true,
      commission_rate: 60, commission_fixed_amount: null, default_vehicle_id: 'v-alphard',
    },
    vehicles, clients: CLIENTS, jobs, assignments, jobStops, surcharges, expenses, timeOff, pushLog,
    nextId: 1,
  };
}
