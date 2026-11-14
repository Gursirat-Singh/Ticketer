import ResourceManager from '../../components/admin/ResourceManager.jsx';
import { CinemasAPI } from '../../services/endpoints.js';

const fields = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'city', label: 'City', type: 'text', required: true },
  { name: 'location', label: 'Area or landmark', type: 'text' },
  { name: 'address', label: 'Full address', type: 'textarea' },
];

const columns = [
  { header: 'Cinema', cell: (c) => <span className="font-semibold">{c.name}</span> },
  { header: 'City', cell: (c) => c.city },
  { header: 'Area', cell: (c) => c.location || 'n/a' },
  { header: 'Address', cell: (c) => <span className="text-paper-dim">{c.address || 'n/a'}</span> },
];

export default function AdminCinemas() {
  return (
    <ResourceManager title="Cinemas" subtitle="Venues customers can book at" singular="cinema" api={CinemasAPI} listKey="cinemas"
      columns={columns} fields={fields} deleteMessage={(c) => `Delete "${c.name}"? Delete its screens first.`} />
  );
}
