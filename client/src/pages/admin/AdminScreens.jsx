import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import ResourceManager from '../../components/admin/ResourceManager.jsx';
import Modal from '../../components/Modal.jsx';
import SeatMap, { SeatLegend } from '../../components/SeatMap.jsx';
import { Spinner } from '../../components/States.jsx';
import { CinemasAPI, ScreensAPI } from '../../services/endpoints.js';
import { CATEGORY_LABEL } from '../../utils/constants.js';

const fields = [
  { name: 'cinemaId', label: 'Cinema', type: 'select', required: true, onlyOnCreate: true, optionsLoader: async () => (await CinemasAPI.list()).cinemas.map((c) => ({ value: c._id, label: `${c.name}, ${c.city}` })) },
  { name: 'name', label: 'Screen name', type: 'text', required: true, placeholder: 'Screen 1' },
  { name: 'numRows', label: 'Rows (A, B, C…)', type: 'number', required: true, min: 1, max: 26, default: 8 },
  { name: 'seatsPerRow', label: 'Seats per row', type: 'number', required: true, min: 1, max: 40, default: 12 },
  { name: 'aisleAfter', label: 'Aisle after seat number', type: 'number', min: 0, default: 6, help: '0 for no aisle' },
  { name: 'goldRows', label: 'Gold rows', type: 'number', min: 0, default: 3, help: 'Counted from the back, just in front of premium' },
  { name: 'premiumRows', label: 'Premium rows', type: 'number', min: 0, default: 2, help: 'The back rows. Remaining rows at the front are Regular.' },
];

function LayoutPreview({ screen, onClose }) {
  const [state, setState] = useState({ loading: true, seats: [] });
  useEffect(() => {
    let active = true;
    ScreensAPI.get(screen._id)
      .then(({ screen: s }) => active && setState({ loading: false, seats: s.seats.map((x) => ({ ...x, status: 'AVAILABLE' })) }))
      .catch(() => active && setState({ loading: false, seats: [] }));
    return () => { active = false; };
  }, [screen._id]);
  return (
    <Modal title={`${screen.name}: seat layout`} onClose={onClose} wide>
      {state.loading ? <Spinner /> : (
        <>
          <SeatMap seats={state.seats} readOnly aisleAfter={screen.aisleAfter} />
          <div className="mt-6"><SeatLegend /></div>
        </>
      )}
    </Modal>
  );
}

export default function AdminScreens() {
  const [preview, setPreview] = useState(null);
  const columns = [
    { header: 'Screen', cell: (s) => <span className="font-semibold">{s.name}</span> },
    { header: 'Cinema', cell: (s) => (s.cinemaId ? `${s.cinemaId.name}, ${s.cinemaId.city}` : 'n/a') },
    { header: 'Layout', cell: (s) => `${s.numRows} rows x ${s.seatsPerRow} seats` },
    { header: 'Categories', cell: (s) => {
      const regular = s.numRows - s.goldRows - s.premiumRows;
      return <span className="text-paper-dim">{[[CATEGORY_LABEL.REGULAR, regular], [CATEGORY_LABEL.GOLD, s.goldRows], [CATEGORY_LABEL.PREMIUM, s.premiumRows]].filter(([, n]) => n > 0).map(([l, n]) => `${l} ${n}`).join(', ')} rows</span>;
    } },
    { header: 'Total seats', cell: (s) => s.totalSeats },
  ];
  return (
    <>
      <ResourceManager title="Screens and seats" subtitle="Seat layouts are generated from rows, aisle and category rows" singular="screen" api={ScreensAPI} listKey="screens"
        columns={columns} fields={fields}
        rowActions={(s) => <button className="btn btn-ghost btn-sm" onClick={() => setPreview(s)}><Eye className="h-3.5 w-3.5" /> Layout</button>}
        deleteMessage={(s) => `Delete "${s.name}"? Screens with shows cannot be deleted.`} />
      {preview && <LayoutPreview screen={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
