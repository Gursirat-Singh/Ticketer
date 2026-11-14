import { useState } from 'react';
import { posterGradient } from '../utils/poster.js';

/** Real artwork when available; otherwise a deterministic title card. */
export default function Poster({ movie, className = '', titleClass = 'text-2xl' }) {
  const [failed, setFailed] = useState(false);
  const src = movie?.poster;
  if (src && !failed) {
    return <img src={src} alt={`${movie.title} poster`} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={`${movie?.title} poster`}
      className={`flex items-end overflow-hidden p-4 ${className}`}
      style={{ background: posterGradient(movie?.title) }}
    >
      <span className={`font-display font-extrabold leading-[0.95] text-white/90 ${titleClass}`}>{movie?.title}</span>
    </div>
  );
}
