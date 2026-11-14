import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { MoviesAPI } from '../services/endpoints.js';
import { errorMessage } from '../services/api.js';
import MovieCard, { MovieCardSkeleton } from '../components/MovieCard.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { GENRES, LANGUAGES } from '../utils/constants.js';

const TABS = [['now_showing', 'Now showing'], ['upcoming', 'Coming soon']];

export default function Movies() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'now_showing';
  const genre = params.get('genre') || '';
  const language = params.get('language') || '';
  const minRating = params.get('minRating') || '';
  const sort = params.get('sort') || 'newest';
  const [qInput, setQInput] = useState(params.get('q') || '');
  const q = useDebounce(qInput);

  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q) next.set('q', q); else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = params.get('q') || '';
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    MoviesAPI.list({ status, genre: genre || undefined, language: language || undefined, minRating: minRating || undefined, sort, q: query || undefined, page: 1, limit: 12 })
      .then((d) => { if (!active) return; setMovies(d.movies); setPage(1); setPages(d.pages); setTotal(d.total); })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [status, genre, language, minRating, sort, query]);

  const loadMore = async () => {
    try {
      const d = await MoviesAPI.list({ status, genre: genre || undefined, language: language || undefined, minRating: minRating || undefined, sort, q: query || undefined, page: page + 1, limit: 12 });
      setMovies((m) => [...m, ...d.movies]);
      setPage(page + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const clear = () => { setQInput(''); setParams({ status }, { replace: true }); };
  const filtered = genre || language || minRating || query;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black">Movies</h1>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Release status">
        {TABS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={status === value} onClick={() => update('status', value === 'now_showing' ? '' : value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${status === value ? 'border-accent bg-accent text-white' : 'border-ink-600 text-paper-dim hover:bg-ink-800'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="panel mt-5 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <input className="input lg:col-span-2" placeholder="Search by title" aria-label="Search by title" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select className="input" aria-label="Genre" value={genre} onChange={(e) => update('genre', e.target.value)}>
          <option value="">Any genre</option>{GENRES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select className="input" aria-label="Language" value={language} onChange={(e) => update('language', e.target.value)}>
          <option value="">Any language</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className="input" aria-label="Minimum rating" value={minRating} onChange={(e) => update('minRating', e.target.value)}>
          <option value="">Any rating</option>{[9, 8, 7, 6].map((r) => <option key={r} value={r}>{r}+ rating</option>)}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-paper-mute">
        <span>{loading ? 'Loading…' : `${total} ${total === 1 ? 'movie' : 'movies'}`}</span>
        <label className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Sort
          <select className="input w-auto py-1.5" value={sort} onChange={(e) => update('sort', e.target.value)}>
            <option value="newest">Newest</option><option value="rating">Top rated</option><option value="title">Title A-Z</option>
          </select>
        </label>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <MovieCardSkeleton key={i} />)}</div>
      ) : movies.length === 0 ? (
        <EmptyState title="No movies match" hint={filtered ? 'Try removing a filter.' : 'Nothing here yet.'} action={filtered && <button className="btn btn-ghost btn-sm mt-3" onClick={clear}>Clear filters</button>} />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">{movies.map((m) => <MovieCard key={m._id} movie={m} />)}</div>
          {page < pages && <div className="mt-10 text-center"><button className="btn btn-ghost" onClick={loadMore}>Show more movies</button></div>}
        </>
      )}
    </div>
  );
}
