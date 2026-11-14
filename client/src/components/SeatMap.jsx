import { Fragment, useMemo } from 'react';
import { CATEGORY_LABEL } from '../utils/constants.js';
import { formatMoney } from '../utils/format.js';

const stateOf = (seat, selected) => {
  if (selected?.has(seat.seatId)) return 'SELECTED';
  if (seat.mine) return 'MINE';
  return seat.status;
};

const STATE_WORD = {
  AVAILABLE: 'available', SELECTED: 'selected', MINE: 'held for you', BOOKED: 'already booked', HELD: 'held by another customer',
};

export function SeatLegend() {
  const item = (state, label, category = 'REGULAR') => (
    <li className="flex items-center gap-2"><span className="seat pointer-events-none !h-5 !w-5" data-state={state} data-category={category} aria-hidden /> {label}</li>
  );
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-paper-dim" aria-label="Seat legend">
      {item('AVAILABLE', 'Regular', 'REGULAR')}
      {item('AVAILABLE', 'Gold', 'GOLD')}
      {item('AVAILABLE', 'Premium', 'PREMIUM')}
      {item('SELECTED', 'Selected')}
      {item('HELD', 'Locked by someone else')}
      {item('BOOKED', 'Booked')}
    </ul>
  );
}

export default function SeatMap({ seats, selected, onToggle, aisleAfter = 0, readOnly = false }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of seats) {
      if (!map.has(s.row)) map.set(s.row, []);
      map.get(s.row).push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([row, list]) => ({ row, category: list[0].category, price: list[0].price, seats: list.sort((a, b) => a.number - b.number) }));
  }, [seats]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto w-max min-w-full px-2">
        <div className="screen-glow" aria-hidden />
        <p className="mb-6 mt-2 text-center text-xs text-paper-mute">All eyes this way</p>

        <div role="group" aria-label="Seats" className="flex flex-col items-center gap-1.5">
          {rows.map((r, i) => (
            <Fragment key={r.row}>
              {(i === 0 || rows[i - 1].category !== r.category) && (
                <p className="mt-3 text-xs font-semibold text-paper-mute first:mt-0">
                  {CATEGORY_LABEL[r.category]}{r.price != null ? `, ${formatMoney(r.price)}` : ''}
                </p>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-center text-xs text-paper-mute" aria-hidden>{r.row}</span>
                <div className="flex items-center gap-1.5">
                  {r.seats.map((s) => {
                    const state = stateOf(s, selected);
                    const clickable = !readOnly && (state === 'AVAILABLE' || state === 'SELECTED');
                    return (
                      <Fragment key={s.seatId}>
                        <button
                          type="button"
                          className="seat"
                          data-state={readOnly ? 'AVAILABLE' : state}
                          data-category={s.category}
                          disabled={!clickable}
                          aria-pressed={state === 'SELECTED'}
                          aria-label={`Seat ${s.seatId}, ${CATEGORY_LABEL[s.category]}${s.price != null ? `, ${formatMoney(s.price)}` : ''}, ${readOnly ? 'layout preview' : STATE_WORD[state]}`}
                          onClick={() => onToggle?.(s)}
                        >
                          {s.number}
                        </button>
                        {aisleAfter > 0 && s.number === aisleAfter && s.number !== r.seats.length && <span className="seat-gap" aria-hidden />}
                      </Fragment>
                    );
                  })}
                </div>
                <span className="w-5 text-center text-xs text-paper-mute" aria-hidden>{r.row}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
