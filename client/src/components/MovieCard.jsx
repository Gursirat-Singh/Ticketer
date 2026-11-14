import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import Poster from './Poster.jsx';
import { formatDate, formatDuration } from '../utils/format.js';

export default function MovieCard({ movie }) {
  const upcoming = movie.status === 'upcoming';
  return (
    <article className="group flex flex-col">
      <Link to={`/movies/${movie._id}`} className="relative block overflow-hidden rounded-xl bg-ink-800">
        <Poster movie={movie} className="aspect-[2/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" titleClass="text-3xl" />
        {movie.rating > 0 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-950/85 px-2 py-1 text-xs font-semibold">
            <Star className="h-3 w-3 fill-gold text-gold" aria-hidden /> {movie.rating.toFixed(1)}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-ink-950/85 px-2 py-1 text-xs font-semibold">{movie.certification}</span>
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="text-xl font-bold leading-tight">
          <Link to={`/movies/${movie._id}`} className="hover:text-accent-hover">{movie.title}</Link>
        </h3>
        <p className="mt-1 text-sm text-paper-mute">{movie.genres?.slice(0, 2).join(', ')}</p>
        <p className="text-sm text-paper-mute">{movie.language}, {formatDuration(movie.durationMin)}</p>
        <div className="mt-3 pt-1">
          {upcoming ? (
            <p className="text-sm text-paper-dim">Releases {formatDate(movie.releaseDate, { day: 'numeric', month: 'short' })}</p>
          ) : (
            <Link to={`/movies/${movie._id}/shows`} className="btn btn-primary btn-sm w-full">Book tickets</Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="skeleton">
      <div className="aspect-[2/3] rounded-xl bg-ink-800" />
      <div className="mt-3 h-5 w-3/4 rounded bg-ink-800" />
      <div className="mt-2 h-4 w-1/2 rounded bg-ink-800" />
    </div>
  );
}
