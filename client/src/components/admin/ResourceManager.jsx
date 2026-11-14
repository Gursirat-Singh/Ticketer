import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { errorMessage } from '../../services/api.js';
import Modal, { ConfirmModal } from '../Modal.jsx';
import DataTable, { PageHeader } from './DataTable.jsx';
import { toLocalInput } from '../../utils/format.js';

/**
 * A config-driven CRUD screen: a table, a create/edit modal and a delete confirmation.
 * fields: [{ name, label, type, required, options | optionsLoader, help, step, min, max, onlyOnCreate, onlyOnEdit, wide }]
 * types: text, textarea, number, money (rupees in the form, paise in the API), select, list, date, datetime, checkbox
 */

const defaultFormValue = (field, row) => {
  const v = row?.[field.name];
  if (v === undefined || v === null) return field.type === 'checkbox' ? false : '';
  if (field.type === 'list') return v.join(', ');
  if (field.type === 'money') return String(v / 100);
  if (field.type === 'datetime') return toLocalInput(v);
  if (field.type === 'date') return new Date(v).toISOString().slice(0, 10);
  return v;
};

function toPayloadValue(field, raw) {
  switch (field.type) {
    case 'list': return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    case 'number': return raw === '' ? undefined : Number(raw);
    case 'money': return raw === '' ? undefined : Math.round(Number(raw) * 100);
    case 'datetime': return raw ? new Date(raw).toISOString() : undefined;
    case 'checkbox': return Boolean(raw);
    default: return raw === '' ? (field.type === 'text' || field.type === 'textarea' ? '' : undefined) : raw;
  }
}

function FieldInput({ field, value, onChange, options }) {
  const id = `f-${field.name}`;
  const common = { id, required: field.required, 'aria-required': field.required };
  if (field.type === 'textarea') return <textarea {...common} rows={4} className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  if (field.type === 'select') {
    return (
      <select {...common} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'checkbox') {
    return <label className="inline-flex items-center gap-2 text-sm"><input id={id} type="checkbox" className="h-4 w-4 accent-[#e8283a]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {field.checkboxLabel || 'Yes'}</label>;
  }
  const type = { number: 'number', money: 'number', date: 'date', datetime: 'datetime-local' }[field.type] || 'text';
  return <input {...common} type={type} step={field.type === 'money' ? '0.01' : field.step} min={field.min} max={field.max} className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
}

function FormModal({ title, fields, initial, toPayload, onSubmit, onClose, isEdit }) {
  const visible = fields.filter((f) => (isEdit ? !f.onlyOnCreate : !f.onlyOnEdit));
  const [values, setValues] = useState(initial);
  const [options, setOptions] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    visible.filter((f) => f.optionsLoader).forEach((f) => {
      f.optionsLoader().then((o) => setOptions((prev) => ({ ...prev, [f.name]: o }))).catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    for (const f of visible) {
      if (f.required && (values[f.name] === '' || values[f.name] === undefined)) return setError(`${f.label} is required.`);
    }
    const payload = {};
    for (const f of visible) {
      const v = toPayloadValue(f, values[f.name]);
      if (v !== undefined) payload[f.name] = v;
    }
    setBusy(true);
    try {
      await onSubmit(toPayload ? toPayload(payload, isEdit) : payload);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((f) => (
            <div key={f.name} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {f.type !== 'checkbox' && <label htmlFor={`f-${f.name}`} className="label">{f.label}{f.required && <span className="text-accent-hover"> *</span>}</label>}
              {f.type === 'checkbox' && <span className="label">{f.label}</span>}
              <FieldInput field={f} value={values[f.name]} options={options[f.name] || f.options || []} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
              {f.help && <p className="mt-1 text-xs text-paper-mute">{f.help}</p>}
            </div>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-hover">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ResourceManager({
  title, subtitle, singular, api, listKey, listParams = {}, columns, fields, toForm, toPayload,
  canCreate = true, canEdit = true, canDelete = true, rowActions, rowId = (r) => r._id ?? r.id, deleteMessage,
}) {
  const toast = useToast();
  const paramsKey = JSON.stringify(listParams);
  const { data, loading, error, reload } = useAsync(() => api.list(listParams), [paramsKey]);
  const [editing, setEditing] = useState(null); // 'new' | row
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const all = data?.[listKey] || [];
    const s = search.trim().toLowerCase();
    return s ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(s)) : all;
  }, [data, listKey, search]);

  const initial = useMemo(() => {
    if (!editing) return {};
    const row = editing === 'new' ? null : editing;
    const base = Object.fromEntries(fields.map((f) => [f.name, f.default !== undefined && !row ? f.default : defaultFormValue(f, row)]));
    return toForm && row ? { ...base, ...toForm(row) } : base;
  }, [editing, fields, toForm]);

  const save = async (payload) => {
    if (editing === 'new') await api.create(payload);
    else await api.update(rowId(editing), payload);
    toast.success(`${singular} ${editing === 'new' ? 'created' : 'updated'}.`);
    setEditing(null);
    reload();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.remove(rowId(deleting));
      toast.success(`${singular} deleted.`);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const actionColumn = {
    header: 'Actions',
    className: 'whitespace-nowrap',
    cell: (r) => (
      <div className="flex items-center gap-1.5">
        {rowActions?.(r)}
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)} aria-label={`Edit ${singular}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>}
        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(r)} aria-label={`Delete ${singular}`}><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
    ),
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>
        <input className="input w-48" placeholder="Filter this list" aria-label="Filter this list" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canCreate && <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add {singular}</button>}
      </PageHeader>

      {error ? <p role="alert" className="panel p-6 text-accent-hover">{error}</p> : (
        <DataTable columns={[...columns, actionColumn]} rows={rows} loading={loading} emptyTitle={search ? 'No matches' : `No ${singular}s yet`} rowKey={rowId} />
      )}

      {editing && (
        <FormModal
          key={editing === 'new' ? 'new' : rowId(editing)}
          title={editing === 'new' ? `Add ${singular}` : `Edit ${singular}`}
          fields={fields} initial={initial} toPayload={toPayload} isEdit={editing !== 'new'}
          onSubmit={save} onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal title={`Delete this ${singular}?`} confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
          message={deleteMessage?.(deleting) || 'This cannot be undone.'} />
      )}
    </div>
  );
}
