import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeatMap from './SeatMap.jsx';

afterEach(cleanup);

const seats = [
  ...['A1', 'A2', 'A3', 'A4'].map((id, i) => ({ seatId: id, row: 'A', number: i + 1, category: 'REGULAR', price: 15000, status: 'AVAILABLE' })),
  ...['B1', 'B2', 'B3', 'B4'].map((id, i) => ({ seatId: id, row: 'B', number: i + 1, category: 'GOLD', price: 25000, status: 'AVAILABLE' })),
];
seats[1].status = 'BOOKED'; // A2
seats[2].status = 'HELD'; // A3 held by someone else
seats[3].status = 'HELD'; // A4 held by me
seats[3].mine = true;

const seat = (id) => screen.getByRole('button', { name: new RegExp(`^Seat ${id},`) });

describe('SeatMap', () => {
  it('shows a distinct state for every kind of seat', () => {
    render(<SeatMap seats={seats} selected={new Set(['B1'])} aisleAfter={2} />);
    expect(seat('A1').dataset.state).toBe('AVAILABLE');
    expect(seat('A2').dataset.state).toBe('BOOKED');
    expect(seat('A3').dataset.state).toBe('HELD');
    expect(seat('A4').dataset.state).toBe('MINE');
    expect(seat('B1').dataset.state).toBe('SELECTED');
    expect(seat('B1').getAttribute('aria-pressed')).toBe('true');
  });

  it('only lets available and selected seats be clicked', () => {
    const onToggle = vi.fn();
    render(<SeatMap seats={seats} selected={new Set(['B1'])} onToggle={onToggle} />);
    for (const id of ['A2', 'A3', 'A4']) expect(seat(id).disabled).toBe(true);
    fireEvent.click(seat('A2'));
    fireEvent.click(seat('A3'));
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.click(seat('A1'));
    fireEvent.click(seat('B1')); // selected seats can be un-selected
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle.mock.calls[0][0].seatId).toBe('A1');
  });

  it('groups rows by category with the price, and describes seats for screen readers', () => {
    render(<SeatMap seats={seats} selected={new Set()} />);
    expect(screen.getByText('Regular, ₹150')).toBeTruthy();
    expect(screen.getByText('Gold, ₹250')).toBeTruthy();
    expect(seat('A2').getAttribute('aria-label')).toMatch(/already booked/);
    expect(seat('A3').getAttribute('aria-label')).toMatch(/held by another customer/);
  });

  it('is inert in read-only (layout preview) mode', () => {
    const onToggle = vi.fn();
    render(<SeatMap seats={seats} readOnly onToggle={onToggle} />);
    expect(seat('A1').disabled).toBe(true);
    expect(seat('A2').dataset.state).toBe('AVAILABLE');
  });
});
