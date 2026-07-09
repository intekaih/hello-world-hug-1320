const request = require('supertest');
const bcrypt = require('bcryptjs');
const { User } = require('../../src/models/User');
const { createTestApp } = require('../helpers/testApp');
const businessAccountsRouter = require('../../src/routes/businessAccounts');

const API_KEY = 'test-business-key';
let app;

beforeAll(() => {
  process.env.BUSINESS_API_KEY = API_KEY;
  app = createTestApp('/api/business/accounts', businessAccountsRouter);
});

function authed(req) {
  return req.set('x-business-api-key', API_KEY);
}

describe('Business account API', () => {
  it('tu choi request thieu API key', async () => {
    const res = await request(app).get('/api/business/accounts');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('tao tai khoan business co thoi han va hash mat khau', async () => {
    const res = await authed(request(app).post('/api/business/accounts'))
      .send({
        username: 'solduser',
        password: 'secret123',
        display_name: 'Sold User',
        durationDays: 30,
        externalRef: 'telegram-order-1',
        plan: '30d',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('solduser');
    expect(res.body.user.status).toBe('active');
    expect(res.body.user.password).toBeUndefined();
    expect(new Date(res.body.user.expires_at).getTime()).toBeGreaterThan(Date.now());

    const dbUser = await User.findOne({ username: 'solduser' }).lean();
    expect(dbUser.account_source).toBe('business_api');
    expect(dbUser.role).toBe('user');
    expect(await bcrypt.compare('secret123', dbUser.password)).toBe(true);
  });

  it('khong cho tao trung username', async () => {
    await authed(request(app).post('/api/business/accounts'))
      .send({ username: 'dupeuser', password: 'secret123', durationDays: 7 });

    const res = await authed(request(app).post('/api/business/accounts'))
      .send({ username: 'dupeuser', password: 'secret456', durationDays: 7 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('khoa, mo khoa va gia han tai khoan business', async () => {
    const created = await authed(request(app).post('/api/business/accounts'))
      .send({ username: 'renewuser', password: 'secret123', durationDays: 1 });
    const userId = created.body.user.id;
    const oldExpiry = new Date(created.body.user.expires_at).getTime();

    const locked = await authed(request(app).patch('/api/business/accounts/renewuser/lock'))
      .send({ reason: 'chargeback' });
    expect(locked.status).toBe(200);
    expect(locked.body.user.status).toBe('locked');

    const renewed = await authed(request(app).patch(`/api/business/accounts/${userId}/renew`))
      .send({ durationDays: 7, plan: '7d-renew' });
    const newExpiry = new Date(renewed.body.user.expires_at).getTime();
    expect(renewed.status).toBe(200);
    expect(newExpiry - oldExpiry).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(renewed.body.user.status).toBe('locked');

    const unlocked = await authed(request(app).patch(`/api/business/accounts/${userId}/unlock`));
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.user.status).toBe('active');
  });

  it('xoa tai khoan business theo id', async () => {
    const created = await authed(request(app).post('/api/business/accounts'))
      .send({ username: 'deletebiz', password: 'secret123', durationDays: 7 });

    const res = await authed(request(app).delete(`/api/business/accounts/${created.body.user.id}`));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await User.findOne({ username: 'deletebiz' })).toBeNull();
  });
});
