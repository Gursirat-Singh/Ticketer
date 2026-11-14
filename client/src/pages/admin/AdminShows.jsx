import ResourceManager from '../../components/admin/ResourceManager.jsx';
import { StatusBadge } from '../../components/States.jsx';
import { MoviesAPI, ScreensAPI, ShowsAPI } from '../../services/endpoints.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

const fields = [
  { name: 'movieId', label: 'Movie', type: 'select', required: true, onlyOnCreate: true, optionsLoader: async () => (await MoviesAPI.list({ limit: 100, sort: 'title' })).movies.filter((m) => m.status !== 'upcoming').map((m) => ({ value: m._id, label: m.title })) },
  { name: 'screenId', label: 'Cinema and screen', type: 'select', required: true, onlyOnCreate: true, optionsLoader: async () => (await ScreensAPI.list()).screens.map((s) => ({ value: s._id, label: `${s.cinemaId?.name}, ${s.name}` })) },
  { name: 'startTime', label: 'Start time', type: 'datetime', required: true, onlyOnCreate: true, help: 'The end time is worked out from the movie length plus 15 minutes for cleaning.' },
  { name: 'priceREGULAR', label: 'Regular price (₹)', type: 'money', required: true, default: 150 },
  { name: 'priceGOLD', label: 'Gold price (₹)', type: 'money', required: true, default: 250 },
  { name: 'pricePREMIUM', label: 'Premium price (₹)', type: 'money', required: true, default: 350 },
  { name: 'status', label: 'Status', type: 'select', onlyOnEdit: true, options: [{ value: 'SCHEDULED', label: 'Scheduled' }, { value: 'CANCELLED', label: 'Cancelled (refunds every confirmed booking)' }] },
];

const toForm = (s) => ({
  priceREGULAR: String(s.priceByCategory.REGULAR / 100),
  priceGOLD: String(s.priceByCategory.GOLD / 100),
  pricePREMIUM: String(s.priceByCategory.PREMIUM / 100),
  status: s.status,
});

function toPayload({ priceREGULAR, priceGOLD, pricePREMIUM, ...rest }, isEdit) {
  const priceByCategory = { REGULAR: priceREGULAR, GOLD: priceGOLD, PREMIUM: pricePREMIUM };
  return isEdit ? { priceByCategory, status: rest.status || undefined } : { ...rest, priceByCategory };
}

const columns = [
  { header: 'Movie', cell: (s) => <span className="font-semibold">{s.movie.title}</span> },
  { header: 'Cinema', cell: (s) => `${s.cinema.name}, ${s.screen.name}` },
  { header: 'Starts', cell: (s) => formatDateTime(s.startTime) },
  { header: 'Prices', cell: (s) => <span className="text-paper-dim">{formatMoney(s.priceByCategory.REGULAR)} / {formatMoney(s.priceByCategory.GOLD)} / {formatMoney(s.priceByCategory.PREMIUM)}</span> },
  { header: 'Seats left', cell: (s) => `${s.availableSeats ?? 0} / ${s.totalSeats ?? 0}` },
  { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
];

export default function AdminShows() {
  return (
    <ResourceManager title="Shows" subtitle="Schedule showtimes and set ticket prices per seat category" singular="show" api={ShowsAPI} listKey="shows"
      listParams={{ all: 'true', limit: 200 }} columns={columns} fields={fields} toForm={toForm} toPayload={toPayload} rowId={(s) => s.id}
      deleteMessage={() => 'Shows with bookings cannot be deleted. Set them to Cancelled to refund customers instead.'} />
  );
}
