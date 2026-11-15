import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { ToastHost, showToast, dismissToast, getToast, _resetToasts } from '../Toast';

afterEach(async () => { await act(async () => { _resetToasts(); }); });

describe('toast store', () => {
  it('shows a toast with the default tone', () => {
    showToast({ text: 'Job accepted' });
    expect(getToast()).toMatchObject({ text: 'Job accepted', tone: 'default' });
  });

  it('a new toast replaces the older one', () => {
    showToast({ text: 'One' });
    showToast({ text: 'Two', tone: 'success' });
    expect(getToast()).toMatchObject({ text: 'Two', tone: 'success' });
  });

  it('dismissToast clears it', () => {
    showToast({ text: 'One' });
    dismissToast();
    expect(getToast()).toBeNull();
  });

  it('dismissing an old id leaves the newer toast alone', () => {
    showToast({ text: 'One' });
    const first = getToast()!.id;
    showToast({ text: 'Two' });
    dismissToast(first);
    expect(getToast()).toMatchObject({ text: 'Two' });
  });

  it('clears itself after durationMs', async () => {
    showToast({ text: 'Quick', durationMs: 20 });
    expect(getToast()).not.toBeNull();
    await waitFor(() => expect(getToast()).toBeNull());
  });

  it('a replaced toast does not clear its successor early', async () => {
    showToast({ text: 'Old', durationMs: 20 });
    showToast({ text: 'New', durationMs: 5000 });
    await new Promise(r => setTimeout(r, 60));
    expect(getToast()).toMatchObject({ text: 'New' });
  });
});

describe('ToastHost', () => {
  it('draws the current toast and swaps it for a newer one', async () => {
    await render(<ToastHost/>);
    expect(screen.queryByText('Job accepted')).toBeNull();
    await act(async () => { showToast({ text: 'Job accepted', tone: 'success' }); });
    expect(screen.getByText('Job accepted')).toBeTruthy();
    expect(screen.getByTestId('toast-check')).toBeTruthy();
    await act(async () => { showToast({ text: 'Expense logged' }); });
    expect(screen.getByText('Expense logged')).toBeTruthy();
    expect(screen.queryByText('Job accepted')).toBeNull();
    expect(screen.queryByTestId('toast-check')).toBeNull();
  });

  it('removes the toast once it is dismissed and the exit has run', async () => {
    await render(<ToastHost bottomOffset={120}/>);
    await act(async () => { showToast({ text: 'Bye' }); });
    expect(screen.getByText('Bye')).toBeTruthy();
    await act(async () => { dismissToast(); });
    await waitFor(() => expect(screen.queryByText('Bye')).toBeNull());
  });
});
