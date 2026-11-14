import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, closeTestDb, connectTestDb, createFixture, createUser, holdSeats, payFully } from './helpers.js';
import { createApp } from '../app.js';
import { initSocket } from '../sockets/index.js';
import { sweepExpiredHolds } from '../services/seatHold.service.js';
import { ShowSeat } from '../models/index.js';

let server;
let url;
const app = api();

beforeAll(async () => {
  await connectTestDb();
  server = http.createServer(createApp());
  initSocket(server, ['http://localhost:5173']);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeTestDb();
});

function listen(showId) {
  const socket = connect(url, { transports: ['websocket'] });
  const events = [];
  socket.on('seats:update', (e) => events.push(e));
  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('show:join', String(showId));
      setTimeout(() => resolve({ socket, events }), 150); // give the join a moment to register
    });
  });
}
const waitFor = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('timed out waiting for socket event');
};

describe('real-time seat updates', () => {
  it('pushes HELD, AVAILABLE and BOOKED events to everyone watching the show', async () => {
    const { show } = await createFixture();
    const other = await createFixture(); // a different show: must stay silent
    const watcher = await listen(show._id);
    const bystander = await listen(other.show._id);
    const [a, b] = await Promise.all([createUser(), createUser()]);

    const lock = (await holdSeats(app, a.token, show._id, ['A1', 'A2'])).body.lock;
    await waitFor(() => watcher.events.some((e) => e.status === 'HELD'));
    expect(watcher.events.find((e) => e.status === 'HELD')).toMatchObject({ showId: String(show._id), seatIds: ['A1', 'A2'] });

    await app.delete(`/api/seat-locks/${lock.lockId}`).set(bearer(a.token));
    await waitFor(() => watcher.events.some((e) => e.status === 'AVAILABLE'));

    await payFully(app, b.token, show._id, ['B1']);
    await waitFor(() => watcher.events.some((e) => e.status === 'BOOKED'));
    expect(watcher.events.find((e) => e.status === 'BOOKED').seatIds).toEqual(['B1']);

    expect(bystander.events).toHaveLength(0);
    watcher.socket.close();
    bystander.socket.close();
  });

  it('tells watchers when the sweeper frees expired holds', async () => {
    const { show } = await createFixture();
    const watcher = await listen(show._id);
    const u = await createUser();
    await holdSeats(app, u.token, show._id, ['C1']);
    await ShowSeat.updateOne({ showId: show._id, seatId: 'C1' }, { holdExpiresAt: new Date(Date.now() - 1000) });
    watcher.events.length = 0;

    await sweepExpiredHolds();
    await waitFor(() => watcher.events.some((e) => e.status === 'AVAILABLE' && e.seatIds.includes('C1')));
    watcher.socket.close();
  });
});
