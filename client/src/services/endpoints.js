import { api } from './api.js';

const data = (p) => p.then((r) => r.data);

export const AuthAPI = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  logout: () => data(api.post('/auth/logout')),
  me: () => data(api.get('/auth/me')),
  refresh: () => data(api.post('/auth/refresh')),
  updateProfile: (body) => data(api.put('/auth/profile', body)),
  changePassword: (body) => data(api.put('/auth/password', body)),
};

const crud = (path, key) => ({
  list: (params) => data(api.get(path, { params })),
  get: (id) => data(api.get(`${path}/${id}`)),
  create: (body) => data(api.post(path, body)),
  update: (id, body) => data(api.put(`${path}/${id}`, body)),
  remove: (id) => data(api.delete(`${path}/${id}`)),
  key,
});

export const MoviesAPI = crud('/movies', 'movies');
export const CinemasAPI = crud('/cinemas', 'cinemas');
export const ScreensAPI = crud('/screens', 'screens');
export const ShowsAPI = {
  ...crud('/shows', 'shows'),
  seats: (id) => data(api.get(`/shows/${id}/seats`)),
};

export const SeatLocksAPI = {
  create: (body) => data(api.post('/seat-locks', body)),
  release: (lockId) => data(api.delete(`/seat-locks/${lockId}`)),
};

export const BookingsAPI = {
  create: (body) => data(api.post('/bookings', body)),
  mine: (bucket) => data(api.get('/bookings/my-bookings', { params: { bucket } })),
  get: (id) => data(api.get(`/bookings/${id}`)),
  cancel: (id) => data(api.post(`/bookings/${id}/cancel`)),
  ticket: (id) => api.get(`/bookings/${id}/ticket`, { responseType: 'blob' }).then((r) => r.data),
};

export const PaymentsAPI = {
  createOrder: (bookingId) => data(api.post('/payments/create-order', { bookingId })),
  verify: (body) => data(api.post('/payments/verify', body)),
  fail: (bookingId) => data(api.post('/payments/fail', { bookingId })),
  mockComplete: (orderId) => data(api.post('/payments/mock/complete', { orderId })),
};

export const AdminAPI = {
  dashboard: () => data(api.get('/admin/dashboard')),
  analytics: () => data(api.get('/admin/analytics')),
  bookings: (params) => data(api.get('/admin/bookings', { params })),
  users: (params) => data(api.get('/admin/users', { params })),
  payments: (params) => data(api.get('/admin/payments', { params })),
  refund: (id) => data(api.post(`/admin/payments/${id}/refund`)),
};
