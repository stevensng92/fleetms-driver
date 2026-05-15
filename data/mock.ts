// Mock data shaped to mirror what real Supabase queries will return.
// Wire each section to the dispatcher's DAL when we move past scaffold:
//   - TODAYS_JOBS  -> SELECT * FROM jobs JOIN assignments WHERE driver_id = $self AND date = today
//   - ROUTE_STOPS  -> SELECT * FROM job_stops WHERE job_id = $1 ORDER BY seq
//   - EXPENSES     -> SELECT * FROM expenses WHERE driver_id = $self AND date_trunc('month', date) = current_month
//   - EARNINGS     -> SELECT job_id, date, amount, status FROM driver_payout_line_items JOIN driver_payouts
//   - PROFILE      -> SELECT * FROM drivers WHERE user_id = auth.uid()
//   - TIME_OFF     -> SELECT * FROM driver_time_off WHERE driver_id = $self
import type { Job } from '../components/JobCard';
import type { Stop } from '../components/TimelineStop';
import type { StatusKind } from '../components/StatusPill';

export const DRIVER = {
  id: 'drv_ahmad',
  name: 'Ahmad bin Hassan',
  initials: 'AH',
  phone: '+60 12-345 6789',
  org: 'Continental Limo Services',
  licenseClass: 'D · GDL',
  vehicle: 'WA 1234 B · MPV · Toyota Alphard',
  onShift: true,
};

export const TODAYS_JOBS: Job[] = [
  { id: 'JOB-047', time: '09:00', vehicle: 'Sedan', from: 'KLCC',       to: 'KL Sentral', client: 'Mega Holdings', pax: 3, status: 'pending'   },
  { id: 'JOB-044', time: '11:30', vehicle: 'MPV',   from: 'Bangsar',    to: 'KLIA T1',    client: 'Sarah Lim',     pax: 4, status: 'confirmed' },
  { id: 'JOB-040', time: '08:00', vehicle: 'Sedan', from: 'Mont Kiara', to: 'KL Tower',   client: 'D. Tan',        pax: 2, status: 'done'      },
];

export const TOMORROW_JOB: Job = {
  id: 'JOB-052', time: '07:15', vehicle: 'MPV',
  from: 'Damansara Heights', to: 'KLIA T2', client: 'A. Rahman', pax: 3, status: 'confirmed',
};

export const ROUTE_STOPS: Stop[] = [
  { kind: 'Pickup',  arriveLabel: '11:30 AM', arrive: '11:30 AM', place: 'Bangsar Shopping Centre, KL', depart: '11:45 AM' },
  { kind: 'Stop 1',  arriveLabel: 'Arrive',   arrive: '12:10 PM', place: 'Mid Valley Megamall',         depart: '12:25 PM' },
  { kind: 'Stop 2',  arriveLabel: 'Arrive',   arrive: '12:40 PM', place: 'Pavilion KL',                 depart: null      },
  { kind: 'Dropoff', arriveLabel: 'Arrive',   arrive: '01:00 PM', place: 'KLIA Terminal 1',             depart: undefined },
];

export type ExpenseCat = 'Fuel' | 'Toll' | 'Other';
export type Expense = {
  id: string;
  cat: ExpenseCat;
  date: string;
  vehicle: string;
  amt: number;
  hasReceipt: boolean;
  note?: string;
  voided?: boolean;
};

export const EXPENSES: Expense[] = [
  { id: 'EXP-091', cat: 'Fuel',  date: 'May 9', vehicle: 'WA 1234 B', amt: 85.00,  hasReceipt: true },
  { id: 'EXP-090', cat: 'Toll',  date: 'May 9', vehicle: 'WA 1234 B', amt: 12.50,  hasReceipt: false },
  { id: 'EXP-089', cat: 'Fuel',  date: 'May 8', vehicle: 'WA 1234 B', amt: 125.00, hasReceipt: true },
  { id: 'EXP-088', cat: 'Other', date: 'May 8', vehicle: 'WA 1234 B', amt: 18.00,  hasReceipt: false, note: 'Car wash' },
  { id: 'EXP-087', cat: 'Fuel',  date: 'May 7', vehicle: 'WA 1234 B', amt: 60.00,  hasReceipt: false, voided: true },
  { id: 'EXP-086', cat: 'Toll',  date: 'May 6', vehicle: 'WA 1234 B', amt: 60.00,  hasReceipt: false },
];

export type Earning = { id: string; date: string; amt: number; status: StatusKind };

export const EARNINGS: Earning[] = [
  { id: 'JOB-047', date: 'May 9', amt: 85.00,  status: 'pendingPay' },
  { id: 'JOB-044', date: 'May 9', amt: 92.00,  status: 'pendingPay' },
  { id: 'JOB-040', date: 'May 8', amt: 72.00,  status: 'paid' },
  { id: 'JOB-038', date: 'May 7', amt: 110.00, status: 'paid' },
  { id: 'JOB-036', date: 'May 7', amt: 65.00,  status: 'paid' },
  { id: 'JOB-031', date: 'May 5', amt: 88.00,  status: 'paid' },
  { id: 'JOB-028', date: 'May 4', amt: 145.00, status: 'paid' },
];

export type TimeOff = {
  id: string;
  range: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved';
};

export const TIME_OFF: TimeOff[] = [
  { id: 'TO-12', range: '17 – 19 May', days: 3, reason: 'Family wedding', status: 'pending' },
  { id: 'TO-11', range: '2 – 4 Jun',   days: 3, reason: 'Personal',       status: 'approved' },
];
