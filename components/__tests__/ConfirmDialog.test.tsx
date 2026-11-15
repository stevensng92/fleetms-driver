import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ConfirmDialog } from '../ConfirmDialog';

const base = { visible: true, title: 'Mark this job done?', confirmLabel: 'Mark done', cancelLabel: 'Keep job open' };

describe('ConfirmDialog', () => {
  it('shows the title, the body and both buttons', async () => {
    await render(<ConfirmDialog {...base} body="The fare is final." onConfirm={jest.fn()} onCancel={jest.fn()}/>);
    expect(screen.getByText('Mark this job done?')).toBeTruthy();
    expect(screen.getByText('The fare is final.')).toBeTruthy();
    expect(screen.getByText('Mark done')).toBeTruthy();
    expect(screen.getByText('Keep job open')).toBeTruthy();
  });

  it('draws nothing when not visible', async () => {
    await render(<ConfirmDialog {...base} visible={false} onConfirm={jest.fn()} onCancel={jest.fn()}/>);
    expect(screen.queryByText('Mark done')).toBeNull();
  });

  it('fires nothing until a button is pressed', async () => {
    const onConfirm = jest.fn(); const onCancel = jest.fn();
    await render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel}/>);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('confirm calls onConfirm with no reason when there is no reason box', async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={jest.fn()}/>);
    await fireEvent.press(screen.getByText('Mark done'));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('cancel calls onCancel and never onConfirm', async () => {
    const onConfirm = jest.fn(); const onCancel = jest.fn();
    await render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel}/>);
    await fireEvent.press(screen.getByText('Keep job open'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a tap on the scrim counts as keeping', async () => {
    const onCancel = jest.fn(); const onConfirm = jest.fn();
    await render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel}/>);
    await fireEvent.press(screen.getByLabelText('Dismiss', { includeHiddenElements: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('passes the typed reason to onConfirm', async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmDialog {...base} reason={{ label: 'Why?', placeholder: 'Optional note', optional: true }} onConfirm={onConfirm} onCancel={jest.fn()}/>);
    expect(screen.getByText('Why?')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Optional note'), '  Car broke down ');
    await fireEvent.press(screen.getByText('Mark done'));
    expect(onConfirm).toHaveBeenCalledWith('Car broke down');
  });

  it('an optional reason may stay empty', async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmDialog {...base} reason={{ label: 'Why?', optional: true }} onConfirm={onConfirm} onCancel={jest.fn()}/>);
    await fireEvent.press(screen.getByText('Mark done'));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('a required reason locks confirm until something is typed', async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmDialog {...base} reason={{ label: 'Why?', placeholder: 'Reason' }} onConfirm={onConfirm} onCancel={jest.fn()}/>);
    await fireEvent.press(screen.getByText('Mark done'));
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByPlaceholderText('Reason'), 'Too far');
    await fireEvent.press(screen.getByText('Mark done'));
    expect(onConfirm).toHaveBeenCalledWith('Too far');
  });

  it('accepts the danger tone', async () => {
    await render(<ConfirmDialog {...base} tone="danger" onConfirm={jest.fn()} onCancel={jest.fn()}/>);
    expect(screen.getByText('Mark done')).toHaveStyle({ color: '#FFFFFF' });
  });

  it('the default tone is the ink fill with onInk text', async () => {
    await render(<ConfirmDialog {...base} onConfirm={jest.fn()} onCancel={jest.fn()}/>);
    expect(screen.getByText('Mark done')).toHaveStyle({ color: '#FFFFFF' });
  });
});
