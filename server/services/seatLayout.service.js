import { AppError } from '../utils/AppError.js';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Rows start at A in front of the screen; premium rows are at the back, gold in the middle. */
export function buildSeatLayout({ numRows, seatsPerRow, goldRows = 0, premiumRows = 0 }) {
  if (goldRows + premiumRows > numRows) {
    throw new AppError(400, 'goldRows + premiumRows cannot be more than numRows');
  }
  const seats = [];
  for (let r = 0; r < numRows; r += 1) {
    const row = ROW_LABELS[r];
    const fromBack = numRows - 1 - r;
    let category = 'REGULAR';
    if (fromBack < premiumRows) category = 'PREMIUM';
    else if (fromBack < premiumRows + goldRows) category = 'GOLD';
    for (let n = 1; n <= seatsPerRow; n += 1) {
      seats.push({ seatId: `${row}${n}`, row, number: n, category });
    }
  }
  return seats;
}
