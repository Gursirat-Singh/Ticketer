import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

function Field({ label, id, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-accent-hover">{error}</p>}
    </div>
  );
}

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto grid max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-5xl font-black">{title}</h1>
      <p className="mb-8 mt-2 text-paper-mute">{subtitle}</p>
      <div className="panel p-6">{children}</div>
      <p className="mt-6 text-center text-sm text-paper-mute">{footer}</p>
    </div>
  );
}

function useRedirect() {
  const location = useLocation();
  return (user) => (user.role === 'admin' && !location.state?.from ? '/admin' : location.state?.from || '/');
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const redirect = useRedirect();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || (user.role === 'admin' ? '/admin' : '/')} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const u = await login(form);
      navigate(redirect(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not log in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Welcome back" subtitle="Log in to pick seats and see your tickets." footer={<>New here? <Link className="text-accent-hover hover:underline" to="/register" state={location.state}>Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-hover">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="mt-4 rounded-lg bg-ink-800 p-3 text-xs text-paper-mute">
        Demo accounts after seeding: <b className="text-paper-dim">user@cinema.test</b> / User@1234 and <b className="text-paper-dim">admin@cinema.test</b> / Admin@1234
      </p>
    </Shell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Use at least 8 characters with a letter and a number.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await register(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Create your account" subtitle="One account for bookings, tickets and refunds." footer={<>Already registered? <Link className="text-accent-hover hover:underline" to="/login" state={location.state}>Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="name" label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Field id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
        {error && <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-hover">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </Shell>
  );
}
