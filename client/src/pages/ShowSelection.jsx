import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MoviesAPI } from '../services/endpoints.js';
import { useAsync } from '../hooks/useAsync.js';
import ShowtimeList from '../components/ShowtimeList.jsx';
import Poster from '../components/Poster.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { formatDuration } from '../utils/format.js';

export default function ShowSelection() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => MoviesAPI.get(id), [id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { movie } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link to={`/movies/${movie._id}`} className="inline-flex items-center gap-1.5 text-sm text-paper-mute hover:text-white"><ArrowLeft className="h-4 w-4" /> Movie details</Link>
      <div className="mt-4 flex items-center gap-5">
        <Poster movie={movie} className="hidden h-28 w-20 shrink-0 rounded-lg sm:block" titleClass="text-lg" />
        <div>
          <h1 className="text-5xl font-black">{movie.title}</h1>
          <p className="mt-1 text-paper-mute">{movie.genres?.join(', ')}, {movie.language}, {formatDuration(movie.durationMin)}</p>
        </div>
      </div>
      <h2 className="mb-4 mt-10 text-3xl font-bold">Choose a date, cinema and showtime</h2>
      {movie.status === 'upcoming' ? <p className="panel p-6 text-paper-dim">This movie is not on sale yet.</p> : <ShowtimeList movieId={movie._id} />}
    </div>
  );
}
