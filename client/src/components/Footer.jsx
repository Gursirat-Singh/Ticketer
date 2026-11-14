import { Link } from 'react-router-dom';
import { Instagram, Mail, Phone, Twitter, Youtube } from 'lucide-react';
import { Logo } from './Navbar.jsx';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-700 bg-ink-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-paper-mute">Pick your movie, choose your exact seats and get a QR ticket in under a minute.</p>
        </div>
        <div>
          <h2 className="text-lg font-bold">Explore</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-paper-dim">
            <li><Link className="hover:text-white" to="/movies">Movies</Link></li>
            <li><Link className="hover:text-white" to="/cinemas">Cinemas</Link></li>
            <li><Link className="hover:text-white" to="/profile">My bookings</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold">Contact</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-paper-dim">
            <li><a className="inline-flex items-center gap-2 hover:text-white" href="mailto:support@marquee.example"><Mail className="h-4 w-4" /> support@marquee.example</a></li>
            <li><a className="inline-flex items-center gap-2 hover:text-white" href="tel:+911800000000"><Phone className="h-4 w-4" /> 1800 000 000</a></li>
          </ul>
          <div className="mt-4 flex gap-3 text-paper-mute">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-white"><Instagram className="h-5 w-5" /></a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter" className="hover:text-white"><Twitter className="h-5 w-5" /></a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:text-white"><Youtube className="h-5 w-5" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-700 py-4 text-center text-xs text-paper-mute">© {new Date().getFullYear()} Marquee. Demo project, payments run in test mode.</div>
    </footer>
  );
}
