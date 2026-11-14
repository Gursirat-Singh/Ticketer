import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRICES, api, bearer, closeTestDb, connectTestDb, createUser, payFully } from './helpers.js';
import { Show, ShowSeat } from '../models/index.js';

const app = api();
let admin;
let customer;

beforeAll(async () => {
  await connectTestDb();
  [admin, customer] = await Promise.all([createUser('admin'), createUser('customer')]);
});
afterAll(closeTestDb);

const post = (path, body, who = admin) => app.post(path).set(bearer(who.token)).send(body);

describe('catalog management', () => {
  let cinema;
  let screen;
  let movie;

  it('lets an admin create a cinema, a screen with a generated layout, and a movie', async () => {
    cinema = (await post('/api/cinemas', { name: 'Admin Cinema', city: 'Testville', address: '1 Test Road' })).body.cinema;
    expect(cinema.name).toBe('Admin Cinema');

    const res = await post('/api/screens', { cinemaId: cinema._id, name: 'Screen A', numRows: 5, seatsPerRow: 8, aisleAfter: 4, goldRows: 2, premiumRows: 1 });
    expect(res.status).toBe(201);
    expect(res.body.screen.totalSeats).toBe(40);
    screen = res.body.screen;

    const m = await post('/api/movies', { title: 'Admin Movie', language: 'Hindi', durationMin: 120, releaseDate: '2026-01-01', genres: ['Drama'], rating: 8.2 });
    expect(m.status).toBe(201);
    movie = m.body.movie;
  });

  it('keeps customers out of every management endpoint', async () => {
    for (const [method, path, body] of [
      ['post', '/api/movies', { title: 'x', language: 'x', durationMin: 1, releaseDate: '2026-01-01' }],
      ['post', '/api/cinemas', { name: 'x', city: 'x' }],
      ['post', '/api/screens', { cinemaId: cinema._id, name: 'x', numRows: 1, seatsPerRow: 1 }],
      ['post', '/api/shows', { movieId: movie._id, screenId: screen._id, startTime: '2030-01-01T10:00:00Z', priceByCategory: PRICES }],
      ['delete', `/api/movies/${movie._id}`],
    ]) {
      const res = await app[method](path).set(bearer(customer.token)).send(body);
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it('validates input', async () => {
    const res = await post('/api/movies', { title: '', language: 'Hindi', durationMin: -5, releaseDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('creates a show with one ShowSeat per screen seat and refuses overlapping shows', async () => {
    const startTime = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const res = await post('/api/shows', { movieId: movie._id, screenId: screen._id, startTime, priceByCategory: PRICES });
    expect(res.status).toBe(201);
    const showId = res.body.show.id;
    expect(await ShowSeat.countDocuments({ showId })).toBe(40);
    expect(res.body.show.priceByCategory).toEqual(PRICES);

    const clash = await post('/api/shows', { movieId: movie._id, screenId: screen._id, startTime, priceByCategory: PRICES });
    expect(clash.status).toBe(409);
  });

  it('exposes shows publicly with seat availability', async () => {
    const res = await app.get(`/api/shows?movieId=${movie._id}`);
    expect(res.status).toBe(200);
    expect(res.body.shows).toHaveLength(1);
    expect(res.body.shows[0]).toMatchObject({ totalSeats: 40, availableSeats: 40 });
  });

  it('refuses to delete a movie or screen that still has shows, and to change the seat layout', async () => {
    expect((await app.delete(`/api/movies/${movie._id}`).set(bearer(admin.token))).status).toBe(409);
    expect((await app.delete(`/api/screens/${screen._id}`).set(bearer(admin.token))).status).toBe(409);
    const res = await app.put(`/api/screens/${screen._id}`).set(bearer(admin.token)).send({ numRows: 9 });
    expect(res.status).toBe(409);
  });

  it('cancelling a show refunds its confirmed bookings', async () => {
    const show = await Show.findOne({ movieId: movie._id });
    const buyer = await createUser();
    const { booking } = await payFully(app, buyer.token, show._id, ['A1']);

    // can't hard-delete a show that has bookings
    expect((await app.delete(`/api/shows/${show._id}`).set(bearer(admin.token))).status).toBe(409);

    const res = await app.put(`/api/shows/${show._id}`).set(bearer(admin.token)).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    const mine = await app.get(`/api/bookings/${booking.id}`).set(bearer(buyer.token));
    expect(mine.body.booking.status).toBe('CANCELLED');
    expect(mine.body.booking.refundStatus).toBe('REFUNDED');
    // customers no longer see the cancelled show
    expect((await app.get(`/api/shows?movieId=${movie._id}`)).body.shows).toHaveLength(0);
  });

  it('lets an admin delete a show with no bookings', async () => {
    const startTime = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    const created = await post('/api/shows', { movieId: movie._id, screenId: screen._id, startTime, priceByCategory: PRICES });
    const res = await app.delete(`/api/shows/${created.body.show.id}`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(await ShowSeat.countDocuments({ showId: created.body.show.id })).toBe(0);
  });
});

describe('movie search and filters', () => {
  it('filters by text, language and genre, and treats regex characters literally', async () => {
    await post('/api/movies', { title: 'Alpha (Part 1)', language: 'English', durationMin: 90, releaseDate: '2026-02-01', genres: ['Action'], rating: 6 });
    const byText = await app.get('/api/movies').query({ q: 'alpha (part' });
    expect(byText.body.movies.map((m) => m.title)).toContain('Alpha (Part 1)');
    const injection = await app.get('/api/movies').query({ q: '.*' });
    expect(injection.body.movies).toHaveLength(0); // ".*" is searched literally, not as a regex
    const byLang = await app.get('/api/movies?language=hindi');
    expect(byLang.body.movies.every((m) => m.language === 'Hindi')).toBe(true);
    const rated = await app.get('/api/movies?minRating=8&sort=rating');
    expect(rated.body.movies.every((m) => m.rating >= 8)).toBe(true);
  });
});

describe('dashboard', () => {
  it('reports revenue, bookings and occupancy', async () => {
    const res = await app.get('/api/admin/dashboard').set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('occupancyPercent');
    const analytics = await app.get('/api/admin/analytics').set(bearer(admin.token));
    expect(analytics.status).toBe(200);
    expect(Array.isArray(analytics.body.popularMovies)).toBe(true);
    expect((await app.get('/api/admin/bookings').set(bearer(admin.token))).status).toBe(200);
    expect((await app.get('/api/admin/users').set(bearer(admin.token))).status).toBe(200);
    expect((await app.get('/api/admin/payments').set(bearer(admin.token))).status).toBe(200);
  });
});
