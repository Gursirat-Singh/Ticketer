import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Play, Star } from 'lucide-react';
import { MoviesAPI } from '../services/endpoints.js';
import { useAsync } from '../hooks/useAsync.js';
import Poster from '../components/Poster.jsx';
import Modal from '../components/Modal.jsx';
import ShowtimeList from '../components/ShowtimeList.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { formatDate, formatDuration, youtubeEmbed } from '../utils/format.js';
import { posterGradient } from '../utils/poster.js';

export default function MovieDetails() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => MoviesAPI.get(id), [id]);
  const [trailer, setTrailer] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { movie } = data;
  const embed = youtubeEmbed(movie.trailerUrl);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-ink-700">
        {movie.banner
          ? <img src={movie.banner} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
          : <div className="absolute inset-0 -z-10 opacity-60" style={{ background: posterGradient(movie.title) }} />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/30" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[250px_1fr]">
          <Poster movie={movie} className="aspect-[2/3] w-44 rounded-2xl shadow-lift md:w-full" titleClass="text-4xl" />
          <div className="flex flex-col justify-end">
            <div className="flex flex-wrap gap-2">
              {movie.genres?.map((g) => <span key={g} className="chip">{g}</span>)}
              <span className="chip">{movie.certification}</span>
            </div>
            <h1 className="mt-3 text-6xl font-black leading-[0.9] sm:text-7xl">{movie.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-paper-dim">
              {movie.rating > 0 && <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 fill-gold text-gold" aria-hidden /> <b className="text-paper">{movie.rating.toFixed(1)}</b>/10</span>}
              <span>{formatDuration(movie.durationMin)}</span>
              <span>{movie.language}</span>
              <span>Released {formatDate(movie.releaseDate)}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {movie.status !== 'upcoming' && <Link to={`/movies/${movie._id}/shows`} className="btn btn-primary px-6 py-3">Book tickets</Link>}
              {movie.trailerUrl && (embed
                ? <button className="btn btn-ghost px-6 py-3" onClick={() => setTrailer(true)}><Play className="h-4 w-4" /> Watch trailer</button>
                : <a className="btn btn-ghost px-6 py-3" href={movie.trailerUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Watch trailer</a>)}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="text-3xl font-bold">Synopsis</h2>
          <p className="mt-3 max-w-prose leading-relaxed text-paper-dim">{movie.description || 'No synopsis yet.'}</p>

          {movie.status === 'upcoming' ? (
            <p className="panel mt-10 p-6 text-paper-dim">Tickets open closer to the release on {formatDate(movie.releaseDate)}.</p>
          ) : (
            <>
              <h2 className="mb-4 mt-12 text-3xl font-bold">Cinemas and showtimes</h2>
              <ShowtimeList movieId={movie._id} />
            </>
          )}
        </div>

        <aside className="space-y-8">
          {movie.cast?.length > 0 && (
            <section><h2 className="text-2xl font-bold">Cast</h2>
              <ul className="mt-2 space-y-1 text-paper-dim">{movie.cast.map((c) => <li key={c}>{c}</li>)}</ul></section>
          )}
          {movie.crew?.length > 0 && (
            <section><h2 className="text-2xl font-bold">Crew</h2>
              <ul className="mt-2 space-y-1 text-paper-dim">{movie.crew.map((c) => <li key={c}>{c}</li>)}</ul></section>
          )}
        </aside>
      </div>

      {trailer && embed && (
        <Modal title={`${movie.title}: trailer`} onClose={() => setTrailer(false)} wide>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe src={embed} title={`${movie.title} trailer`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        </Modal>
      )}
    </>
  );
}
