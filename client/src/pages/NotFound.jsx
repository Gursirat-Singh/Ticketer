import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-display text-8xl font-black text-accent">404</p>
      <h1 className="mt-2 text-4xl font-bold">This reel is missing</h1>
      <p className="mt-3 text-paper-mute">The page you are looking for does not exist or has moved.</p>
      <Link to="/movies" className="btn btn-primary mt-8">Browse movies</Link>
    </div>
  );
}
