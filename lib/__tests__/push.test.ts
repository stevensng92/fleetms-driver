// The push tap: where a tapped push goes, and that it marks its row read.
// The database and the push library are mocked, so importing lib/push.ts
// builds no live client and asks no phone for anything.

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockAddListener = jest.fn();
const mockGetToken = jest.fn();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockAddListener(...args),
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.11.0' } } }));

import { handlePushTap, ensurePushNotifications } from '../push';
import { queryClient } from '../queryClient';
import { resetNotificationReported } from '../notification';

const router = () => ({ push: jest.fn() });
// Synthetic row id; this repo is public.
const ROW = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  mockRpc.mockReset();
  mockAddListener.mockReset();
  mockGetToken.mockReset();
  resetNotificationReported();
  jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('tapping a push', () => {
  it('opens the job it is about and marks its row read', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    const r = router();
    await handlePushTap({ deeplink: '/jobs/JOB-047', push_log_id: ROW }, r as any);
    expect(r.push).toHaveBeenCalledWith('/jobs/JOB-047');
    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_read', { p_ids: [ROW] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('opens the Notifications screen when the link is refused', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    const r = router();
    await handlePushTap({ deeplink: '/admin/secret', push_log_id: ROW }, r as any);
    expect(r.push).toHaveBeenCalledWith('/notifications');
  });

  it('still opens the job when marking it read fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const r = router();
    await expect(handlePushTap({ deeplink: '/jobs/JOB-047', push_log_id: ROW }, r as any)).resolves.toBeUndefined();
    expect(r.push).toHaveBeenCalledWith('/jobs/JOB-047');
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('still opens the job when marking it read throws', async () => {
    mockRpc.mockRejectedValue(new Error('network'));
    const r = router();
    await expect(handlePushTap({ deeplink: '/jobs/JOB-047', push_log_id: ROW }, r as any)).resolves.toBeUndefined();
    expect(r.push).toHaveBeenCalledWith('/jobs/JOB-047');
  });

  it('marks nothing when the push names no row', async () => {
    const r = router();
    await handlePushTap({ deeplink: '/(tabs)' }, r as any);
    expect(r.push).toHaveBeenCalledWith('/(tabs)');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('listening for taps', () => {
  it('starts listening even when saving the push address fails', async () => {
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[test-1]' });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const result = await ensurePushNotifications(router() as any);
    expect(result).toEqual({ kind: 'error', message: 'boom' });
    expect(mockAddListener).toHaveBeenCalledTimes(1);
  });

  it('starts listening even when the phone gives no push address', async () => {
    mockGetToken.mockRejectedValue(new Error('no token'));
    const result = await ensurePushNotifications(router() as any);
    expect(result).toEqual({ kind: 'error', message: 'no token' });
    expect(mockAddListener).toHaveBeenCalledTimes(1);
  });

  it('sends a tap to the handler', async () => {
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[test-2]' });
    mockRpc.mockResolvedValue({ data: null, error: null });
    const r = router();
    await ensurePushNotifications(r as any);
    const onTap = mockAddListener.mock.calls[0][0];
    onTap({ notification: { request: { content: { data: { deeplink: '/jobs/JOB-9' } } } } });
    expect(r.push).toHaveBeenCalledWith('/jobs/JOB-9');
  });
});
