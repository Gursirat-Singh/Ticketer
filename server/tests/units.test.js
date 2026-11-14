import { describe, expect, it } from 'vitest';
import { computeTotals } from '../services/pricing.service.js';
import { buildSeatLayout } from '../services/seatLayout.service.js';
import { mockProvider } from '../services/providers/mock.js';
import { generateBookingCode } from '../utils/codes.js';

describe('pricing', () => {
  it('adds a per-ticket convenience fee and tax on (tickets + fee), in integer paise', () => {
    const t = computeTotals([{ price: 15000 }, { price: 25000 }]);
    expect(t).toEqual({ subtotal: 40000, convenienceFee: 4000, tax: 7920, totalAmount: 51920 });
    expect(Number.isInteger(t.totalAmount)).toBe(true);
  });
});

describe('seat layout', () => {
  it('puts premium rows at the back, gold in the middle and regular in front', () => {
    const seats = buildSeatLayout({ numRows: 6, seatsPerRow: 4, goldRows: 2, premiumRows: 1 });
    expect(seats).toHaveLength(24);
    const cat = (row) => seats.find((s) => s.row === row).category;
    expect([cat('A'), cat('C'), cat('D'), cat('E'), cat('F')]).toEqual(['REGULAR', 'REGULAR', 'GOLD', 'GOLD', 'PREMIUM']);
    expect(new Set(seats.map((s) => s.seatId)).size).toBe(24);
  });

  it('rejects impossible layouts', () => {
    expect(() => buildSeatLayout({ numRows: 2, seatsPerRow: 4, goldRows: 2, premiumRows: 1 })).toThrow();
  });
});

describe('mock payment provider', () => {
  it('only accepts signatures for the exact order and payment ids', () => {
    const sig = mockProvider.sign({ orderId: 'o1', paymentId: 'p1' });
    expect(mockProvider.verifySignature({ orderId: 'o1', paymentId: 'p1', signature: sig })).toBe(true);
    expect(mockProvider.verifySignature({ orderId: 'o1', paymentId: 'p2', signature: sig })).toBe(false);
    expect(mockProvider.verifySignature({ orderId: 'o2', paymentId: 'p1', signature: sig })).toBe(false);
    expect(mockProvider.verifySignature({ orderId: 'o1', paymentId: 'p1', signature: '' })).toBe(false);
  });
});

describe('booking codes', () => {
  it('are readable and unique enough', () => {
    const codes = new Set(Array.from({ length: 2000 }, generateBookingCode));
    expect(codes.size).toBe(2000);
    for (const c of codes) expect(c).toMatch(/^CB-[2-9A-HJKMNP-TV-Z]{8}$/);
  });
});
