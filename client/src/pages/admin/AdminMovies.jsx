import ResourceManager from '../../components/admin/ResourceManager.jsx';
import Poster from '../../components/Poster.jsx';
import { StatusBadge } from '../../components/States.jsx';
import { MoviesAPI } from '../../services/endpoints.js';
import { formatDate, formatDuration } from '../../utils/format.js';

const fields = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'language', label: 'Language', type: 'text', required: true, placeholder: 'English' },
  { name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, min: 1 },
  { name: 'releaseDate', label: 'Release date', type: 'date', required: true },
  { name: 'genres', label: 'Genres', type: 'list', help: 'Comma separated, for example Action, Drama' },
  { name: 'certification', label: 'Certification', type: 'select', default: 'UA', options: ['U', 'UA', 'A', 'S'].map((v) => ({ value: v, label: v })) },
  { name: 'rating', label: 'Rating (0 to 10)', type: 'number', step: '0.1', min: 0, max: 10, default: 0 },
  { name: 'status', label: 'Status', type: 'select', default: 'now_showing', options: [{ value: 'now_showing', label: 'Now showing' }, { value: 'upcoming', label: 'Coming soon' }, { value: 'archived', label: 'Archived' }] },
  { name: 'description', label: 'Synopsis', type: 'textarea' },
  { name: 'poster', label: 'Poster image URL', type: 'text', wide: true, placeholder: 'https://…  (optional, a title card is used without it)' },
  { name: 'banner', label: 'Banner image URL', type: 'text', wide: true, placeholder: 'https://…' },
  { name: 'trailerUrl', label: 'Trailer URL', type: 'text', wide: true, placeholder: 'YouTube link' },
  { name: 'cast', label: 'Cast', type: 'list', wide: true, help: 'Comma separated names' },
  { name: 'crew', label: 'Crew', type: 'list', wide: true, help: 'Comma separated, for example Director: Name' },
  { name: 'featured', label: 'Featured on the home page', type: 'checkbox', checkboxLabel: 'Feature this movie' },
];

const columns = [
  { header: 'Movie', cell: (m) => (
    <div className="flex items-center gap-3">
      <Poster movie={m} className="h-14 w-10 shrink-0 rounded" titleClass="text-[8px]" />
      <div><p className="font-semibold">{m.title}</p><p className="text-xs text-paper-mute">{m.genres?.join(', ')}</p></div>
    </div>
  ) },
  { header: 'Language', cell: (m) => m.language },
  { header: 'Duration', cell: (m) => formatDuration(m.durationMin) },
  { header: 'Rating', cell: (m) => (m.rating ? m.rating.toFixed(1) : 'n/a') },
  { header: 'Released', cell: (m) => formatDate(m.releaseDate) },
  { header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
];

export default function AdminMovies() {
  return (
    <ResourceManager title="Movies" subtitle="Posters, trailers, cast and release status" singular="movie" api={MoviesAPI} listKey="movies"
      listParams={{ status: 'all', sort: 'newest', limit: 100 }} columns={columns} fields={fields}
      deleteMessage={(m) => `Delete "${m.title}"? Movies that still have shows cannot be deleted: archive them instead.`} />
  );
}
