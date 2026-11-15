import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormField } from '../FormField';
import { Input } from '../Input';
import { Segmented } from '../Segmented';

describe('FormField', () => {
  it('shows label, control and hint', async () => {
    await render(<FormField label="Amount" hint="In ringgit"><Text>control</Text></FormField>);
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByText('control')).toBeTruthy();
    expect(screen.getByText('In ringgit')).toBeTruthy();
  });

  it('the error replaces the hint', async () => {
    await render(<FormField label="Amount" hint="In ringgit" error="Enter an amount"><Text>control</Text></FormField>);
    expect(screen.getByText('Enter an amount')).toBeTruthy();
    expect(screen.queryByText('In ringgit')).toBeNull();
  });

  it('marks required', async () => {
    await render(<FormField label="Amount" required><Text>control</Text></FormField>);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('draws no required mark by default', async () => {
    await render(<FormField label="Amount"><Text>control</Text></FormField>);
    expect(screen.queryByText('*')).toBeNull();
  });
});

describe('Input', () => {
  it('forwards TextInput props and changes', async () => {
    const onChangeText = jest.fn();
    await render(<Input placeholder="Plate" value="" onChangeText={onChangeText}/>);
    await fireEvent.changeText(screen.getByPlaceholderText('Plate'), 'ABC 123');
    expect(onChangeText).toHaveBeenCalledWith('ABC 123');
  });

  it('draws the ink ring on focus and removes it on blur', async () => {
    const onFocus = jest.fn(); const onBlur = jest.fn();
    await render(<Input placeholder="Plate" onFocus={onFocus} onBlur={onBlur}/>);
    const input = screen.getByPlaceholderText('Plate');
    expect(input).toHaveStyle({ borderColor: 'transparent', borderWidth: 2, height: 48 });
    await fireEvent(input, 'focus');
    expect(input).toHaveStyle({ borderColor: '#131316' });
    expect(onFocus).toHaveBeenCalled();
    await fireEvent(input, 'blur');
    expect(input).toHaveStyle({ borderColor: 'transparent' });
    expect(onBlur).toHaveBeenCalled();
  });

  it('invalid draws the red ring, even when focused', async () => {
    await render(<Input placeholder="Plate" invalid/>);
    const input = screen.getByPlaceholderText('Plate');
    expect(input).toHaveStyle({ borderColor: '#EF4444' });
    await fireEvent(input, 'focus');
    expect(input).toHaveStyle({ borderColor: '#EF4444' });
  });

  it('multiline grows instead of keeping the fixed height', async () => {
    await render(<Input placeholder="Note" multiline/>);
    expect(screen.getByPlaceholderText('Note')).toHaveStyle({ minHeight: 96 });
  });
});

describe('Segmented', () => {
  const options = [{ value: 'a', label: 'Cash' }, { value: 'b', label: 'Card' }];

  it('marks the selected option as a checked radio', async () => {
    await render(<Segmented options={options} value="a" onChange={jest.fn()}/>);
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Card' })).not.toBeChecked();
    expect(screen.getByText('Cash')).toHaveStyle({ fontWeight: '600' });
    expect(screen.getByText('Card')).toHaveStyle({ fontWeight: '500' });
  });

  it('pressing another option calls onChange with its value', async () => {
    const onChange = jest.fn();
    await render(<Segmented options={options} value="a" onChange={onChange}/>);
    await fireEvent.press(screen.getByRole('radio', { name: 'Card' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('block stretches segments; default does not', async () => {
    const { rerender } = await render(<Segmented options={options} value="a" onChange={jest.fn()} block/>);
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveStyle({ flex: 1 });
    await rerender(<Segmented options={options} value="a" onChange={jest.fn()}/>);
    expect(screen.getByRole('radio', { name: 'Cash' })).not.toHaveStyle({ flex: 1 });
  });
});
