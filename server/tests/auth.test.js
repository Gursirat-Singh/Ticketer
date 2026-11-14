import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTestDb, connectTestDb, createUser, bearer } from './helpers.js';
import { createApp } from '../app.js';
import { User } from '../models/index.js';

const app = createApp();
beforeAll(connectTestDb);
afterAll(closeTestDb);

const creds = { name: 'Asha Verma', email: 'asha@example.com', password: 'Passw0rd!', phone: '9876543210' };

describe('authentication', () => {
  it('registers, sets httpOnly cookies and returns the profile without secrets', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: creds.email, role: 'customer' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/access_token=.*HttpOnly/i);
    expect(cookies).toMatch(/refresh_token=.*HttpOnly/i);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    expect((await request(app).post('/api/auth/register').send(creds)).status).toBe(409);
    const weak = await request(app).post('/api/auth/register').send({ ...creds, email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('never lets a client choose its own role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, email: 'sneaky@example.com', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('logs in with the right password only', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: 'wrong-password1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rd!' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password })).status).toBe(200);
  });

  it('blocks NoSQL operator injection in the login body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('requires authentication and the right role', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    const customer = await createUser('customer');
    expect((await request(app).get('/api/admin/dashboard').set(bearer(customer.token))).status).toBe(403);
    const admin = await createUser('admin');
    expect((await request(app).get('/api/admin/dashboard').set(bearer(admin.token))).status).toBe(200);
  });

  it('revokes tokens on logout and refreshes with the refresh cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect((await agent.post('/api/auth/refresh')).status).toBe(200);

    const user = await User.findOne({ email: creds.email });
    const stale = (await import('../utils/tokens.js')).signAccessToken(user);
    expect((await request(app).get('/api/auth/me').set(bearer(stale))).status).toBe(200);

    await agent.post('/api/auth/logout');
    expect((await request(app).get('/api/auth/me').set(bearer(stale))).status).toBe(401); // old token is dead
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });

  it('changes the password and keeps the current session alive', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const bad = await agent.put('/api/auth/password').send({ currentPassword: 'nope-nope1', newPassword: 'NewPassw0rd' });
    expect(bad.status).toBe(400);
    const ok = await agent.put('/api/auth/password').send({ currentPassword: creds.password, newPassword: 'NewPassw0rd' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password })).status).toBe(401);
  });

  it('rejects state-changing requests from an unknown origin (CSRF guard)', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: creds.email, password: 'x' });
    expect(res.status).toBe(403);
  });
});
