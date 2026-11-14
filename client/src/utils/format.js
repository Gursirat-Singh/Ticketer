/** All money from the API is in paise (INR x 100). */
export function formatMoney(paise = 0) {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export const formatDuration = (min = 0) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('en-IN', opts);

export const formatTime = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export const formatDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** For <input type="datetime-local"> */
export function toLocalInput(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export const clampText = (s = '', n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Turns a YouTube watch/share URL into an embed URL, or null for anything else. */
export function youtubeEmbed(url = '') {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0` : null;
}
