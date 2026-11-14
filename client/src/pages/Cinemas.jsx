import { MapPin } from 'lucide-react';
import { CinemasAPI } from '../services/endpoints.js';
import { useAsync } from '../hooks/useAsync.js';
import { EmptyState, ErrorState, Spinner } from '../components/States.jsx';

export default function Cinemas() {
  const { data, loading, error, reload } = useAsync(() => CinemasAPI.list(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { cinemas, cities } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black">Cinemas</h1>
      {cinemas.length === 0 ? <EmptyState title="No cinemas yet" /> : cities.map((city) => (
        <section key={city} className="mt-10">
          <h2 className="text-3xl font-bold">{city}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {cinemas.filter((c) => c.city === city).map((c) => (
              <li key={c._id} className="panel p-5">
                <h3 className="text-2xl font-bold">{c.name}</h3>
                <p className="mt-1 text-sm text-paper-mute">{c.address || c.location}</p>
                <a className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-hover hover:underline" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.name} ${c.address || c.city}`)}`}>
                  <MapPin className="h-4 w-4" /> Open in Maps
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
