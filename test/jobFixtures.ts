import type { JobDetail } from '../lib/queries/jobDetail';

// Shared by the job detail and active job screen tests. The Date strings are
// UTC; the screens show Malaysia time (UTC+8), so 01:15Z is 09:15 on the clock.
export const PICKUP_AT = '2026-07-29T01:15:00Z';
export const DROPOFF_AT = '2026-07-29T06:05:00Z';

export const stop = (over: Partial<JobDetail['stops'][number]>): JobDetail['stops'][number] => ({
  seq: 0, kind: 'Pickup', location: 'KLIA', detail: null, scheduledAt: null, lat: null, lng: null, ...over,
});

export const job = (over: Partial<JobDetail> = {}): JobDetail => ({
  jobUuid: '9f8e7d6c-5b4a-4321-9876-0f1e2d3c4b5a',
  jobNumber: 'JOB-137',
  status: 'progress',
  rawStatus: 'in_progress',
  assignmentId: 'asg-1',
  pickupAt: PICKUP_AT,
  pickupLocation: 'KLIA',
  pickupDetail: null,
  dropoffLocation: 'Pavilion KL',
  dropoffDetail: null,
  client: 'Nusantara Weddings',
  passengerName: null,
  contact: { phone: null, source: null },
  pax: 3,
  vehicleType: 'mpv',
  vehiclePlate: 'VKA 2231',
  vehicleModel: 'Alphard',
  amount: 500,
  specialCommission: null,
  specialInstructions: null,
  surcharges: [],
  stops: [
    stop({ seq: 0, kind: 'Pickup', location: 'KLIA', scheduledAt: PICKUP_AT }),
    stop({ seq: 1, kind: 'Stop 1', location: 'Mid Valley', scheduledAt: null }),
    stop({ seq: 2, kind: 'Dropoff', location: 'Pavilion KL', scheduledAt: DROPOFF_AT }),
  ],
  ...over,
});
