import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CinemasAPI, ShowsAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import { addDays, formatMoney, formatTime, startOfDay } from '../utils/format.js';
import { EmptyState, ErrorState } from './States.jsx';

const DAYS = 7;
const CITY_KEY = 'marquee_city';

function dayLabel(d, i) {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

function availability(show) {
  if (show.availableSeats === 0) return { tone: 'border-ink-700 text-paper-mute line-through', label: 'Sold out', disabled: true };
  const ratio = show.availableSeats / show.totalSeats;
  if (ratio < 0.2) return { tone: 'border-accent/60 text-accent-hover hover:bg-accent/10', label: 'Filling fast' };
  if (ratio < 0.5) return { tone: 'border-gold/60 text-gold hover:bg-gold/10', label: 'Selling well' };
  return { tone: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10', label: 'Available' };
}

export default function ShowtimeList({ movieId }) {
  const navigate = useNavigate();
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(startOfDay(new Date()), i)), []);
  const [dayIdx, setDayIdx] = useState(0);
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) || '');
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    CinemasAPI.list().then((d) => {
      setCities(d.cities);
      setCity((c) => (c && d.cities.includes(c) ? c : d.cities[0] || ''));
    }).catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!city) { setLoading(false); return undefined; }
    localStorage.setItem(CITY_KEY, city);
    let active = true;
    setLoading(true);
    setError('');
    ShowsAPI.list({ movieId, city, from: days[dayIdx].toISOString(), to: addDays(days[dayIdx], 1).toISOString(), limit: 100 })
      .then((d) => active && setShows(d.shows))
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [movieId, city, dayIdx, days]);

  const byCinema = useMemo(() => {
    const map = new Map();
    for (const s of shows) {
      if (!map.has(s.cinema.id)) map.set(s.cinema.id, { cinema: s.cinema, shows: [] });
      map.get(s.cinema.id).shows.push(s);
    }
    return [...map.values()];
  }, [shows]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Choose a date">
          {days.map((d, i) => (
            <button key={d.toISOString()} role="tab" aria-selected={dayIdx === i} onClick={() => setDayIdx(i)}
              className={`min-w-[4.25rem] shrink-0 rounded-xl border px-3 py-2 text-center ${dayIdx === i ? 'border-accent bg-accent text-white' : 'border-ink-600 hover:bg-ink-800'}`}>
              <span className="block text-xs opacity-80">{dayLabel(d, i)}</span>
              <span className="block text-xl font-bold leading-tight">{d.getDate()}</span>
              <span className="block text-xs opacity-80">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
            </button>
          ))}
        </div>
        {cities.length > 0 && (
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-paper-mute">
            City
            <select className="input w-auto py-2" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>

      {error ? <ErrorState message={error} /> : loading ? (
        <div className="mt-6 space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-28 rounded-2xl bg-ink-800" />)}</div>
      ) : byCinema.length === 0 ? (
        <EmptyState title="No shows on this day" hint={`Try another date${cities.length > 1 ? ' or city' : ''}.`} />
      ) : (
        <ul className="mt-6 space-y-4">
          {byCinema.map(({ cinema, shows: list }) => (
            <li key={cinema.id} className="panel p-4 sm:p-5">
              <h3 className="text-2xl font-bold">{cinema.name}</h3>
              <p className="text-sm text-paper-mute">{cinema.address}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {list.map((s) => {
                  const a = availability(s);
                  const from = Math.min(...Object.values(s.priceByCategory));
                  return (
                    <button key={s.id} disabled={a.disabled} onClick={() => navigate(`/shows/${s.id}/seats`)}
                      title={`${a.label}, ${s.availableSeats} of ${s.totalSeats} seats left`}
                      className={`rounded-lg border px-4 py-2 text-left transition-colors disabled:cursor-not-allowed ${a.tone}`}>
                      <span className="block text-base font-bold">{formatTime(s.startTime)}</span>
                      <span className="block text-xs opacity-80">{s.screen.name}, from {formatMoney(from)}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-paper-mute">Green means plenty of seats, amber is selling well, red is filling fast.</p>
    </div>
  );
}
