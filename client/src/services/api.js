import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// If the short-lived access token expired, refresh once (shared across parallel requests) and retry.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const skip = /\/auth\/(login|register|refresh|logout)/.test(original?.url || '');
    if (error.response?.status === 401 && original && !original._retried && !skip) {
      original._retried = true;
      try {
        refreshing ??= api.post('/auth/refresh').finally(() => { refreshing = null; });
        await refreshing;
        return api(original);
      } catch {
        // fall through with the original 401
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join('. ');
  if (data?.message) return data.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the API is running.';
  return fallback;
}
