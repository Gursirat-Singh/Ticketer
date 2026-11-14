import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MoviesAPI } from '../services/endpoints.js';
import { useAsync } from '../hooks/useAsync.js';
import MovieCard, { MovieCardSkeleton } from '../components/MovieCard.jsx';
import Poster from '../components/Poster.jsx';
import { ErrorState, EmptyState } from '../components/States.jsx';
import { formatDuration } from '../utils/format.js';
import { posterGradient } from '../utils/poster.js';
import { GENRES, LANGUAGES } from '../utils/constants.js';

function Rail({ title, movies, loading, emptyText, to }) {
  return (
    <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6" aria-label={title}>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-4xl font-extrabold">{title}</h2>
        {to && <Link to={to} className="text-sm text-paper-dim hover:text-white">See all</Link>}
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <MovieCardSkeleton key={i} />)}</div>
      ) : movies.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">{movies.map((m) => <MovieCard key={m._id} movie={m} />)}</div>
      )}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [minRating, setMinRating] = useState('');

  const showing = useAsync(() => MoviesAPI.list({ status: 'now_showing', sort: 'rating', limit: 30 }), []);
  const upcoming = useAsync(() => MoviesAPI.list({ status: 'upcoming', sort: 'newest', limit: 6 }), []);

  const { hero, trending, recommended } = useMemo(() => {
    const list = showing.data?.movies || [];
    const hero = list.find((m) => m.featured) || list[0];
    const rest = list.filter((m) => m._id !== hero?._id);
    return { hero, trending: rest.slice(0, 4), recommended: rest.slice(4, 10) };
  }, [showing.data]);

  const search = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (genre) p.set('genre', genre);
    if (language) p.set('language', language);
    if (minRating) p.set('minRating', minRating);
    navigate(`/movies?${p.toString()}`);
  };

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-ink-700">
        <div className="absolute inset-0 -z-10 opacity-60" style={{ background: hero ? posterGradient(hero.title) : '#17171b' }} />
        <div className="hero-light absolute -top-40 right-[8%] -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,226,200,0.28),transparent_65%)]" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />

        <div className="mx-auto grid max-w-7xl items-end gap-10 px-4 pb-12 pt-16 sm:px-6 md:grid-cols-[1.4fr_1fr] md:pt-24">
          {showing.loading ? (
            <div className="skeleton h-64" />
          ) : showing.error ? (
            <ErrorState message={showing.error} onRetry={showing.reload} />
          ) : hero ? (
            <div>
              <p className="text-sm text-paper-dim">Now showing, {hero.genres?.slice(0, 2).join(' / ')}</p>
              <h1 className="mt-2 text-6xl font-black leading-[0.9] sm:text-8xl">{hero.title}</h1>
              <p className="mt-4 max-w-xl text-lg text-paper-dim">{hero.description}</p>
              <p className="mt-3 text-sm text-paper-mute">{hero.language}, {formatDuration(hero.durationMin)}, rated {hero.certification}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={`/movies/${hero._id}/shows`} className="btn btn-primary px-7 py-3 text-base">Book tickets</Link>
                <Link to={`/movies/${hero._id}`} className="btn btn-ghost px-7 py-3 text-base">Details and trailer</Link>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-6xl font-black leading-[0.9] sm:text-8xl">Your seat is waiting</h1>
              <p className="mt-4 text-paper-dim">No movies are showing yet. Check back soon.</p>
            </div>
          )}
          {hero && <Poster movie={hero} className="hidden aspect-[2/3] w-64 justify-self-end rounded-2xl shadow-lift md:block" titleClass="text-5xl" />}
        </div>

        <form onSubmit={search} className="mx-auto -mb-px max-w-7xl px-4 pb-8 sm:px-6" role="search" aria-label="Find a movie">
          <div className="panel grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-mute" aria-hidden />
              <input className="input pl-9" placeholder="Search by movie title" aria-label="Movie title" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Any genre</option>{GENRES.map((g) => <option key={g}>{g}</option>)}
            </select>
            <select className="input" aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Any language</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select className="input" aria-label="Minimum rating" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="">Any rating</option>{[9, 8, 7, 6].map((r) => <option key={r} value={r}>{r}+ rating</option>)}
            </select>
            <button className="btn btn-primary">Search</button>
          </div>
        </form>
      </section>

      <Rail title="Trending now" movies={trending} loading={showing.loading} emptyText="Nothing trending yet" to="/movies?sort=rating" />
      <Rail title="Coming soon" movies={upcoming.data?.movies || []} loading={upcoming.loading} emptyText="No upcoming releases announced" to="/movies?status=upcoming" />
      {(recommended.length > 0 || showing.loading) && <Rail title="Recommended for you" movies={recommended} loading={showing.loading} emptyText="No recommendations yet" to="/movies" />}
    </>
  );
}
