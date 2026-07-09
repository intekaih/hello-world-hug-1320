/**
 * Auth Module Integration Tests
 *
 * Test các auth endpoints qua React API route.
 * Sử dụng MongoDB Memory Server (được setup trong tests/setup.js).
 */

const request = require('supertest');
const { User } = require('../../src/models/User');
const { createTestApp } = require('../helpers/testApp');
const apiRouter = require('../../src/routes/api');

let app;

beforeAll(() => {
  app = createTestApp('/api/react', apiRouter);
});

describe('POST /api/react/auth/login', () => {
  it('nên trả lỗi khi thiếu username/password', async () => {
    const res = await request(app).post('/api/react/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('nên trả lỗi khi sai username/password', async () => {
    const res = await request(app)
      .post('/api/react/auth/login')
      .send({ username: 'wronguser', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('nên đăng nhập thành công với thông tin hợp lệ', async () => {
    const hashedPassword = await require('bcryptjs').hash('password123', 10);
    await User.create({
      username: 'testuser',
      password: hashedPassword,
      display_name: 'Test User',
      role: 'user',
      is_active: true,
    });

    const res = await request(app)
      .post('/api/react/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.display_name).toBe('Test User');
  });

  it('nên từ chối user bị khóa', async () => {
    const hashedPassword = await require('bcryptjs').hash('password123', 10);
    await User.create({
      username: 'inactiveuser',
      password: hashedPassword,
      display_name: 'Inactive User',
      role: 'user',
      is_active: false,
    });

    const res = await request(app)
      .post('/api/react/auth/login')
      .send({ username: 'inactiveuser', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('nen tu choi user het han', async () => {
    const hashedPassword = await require('bcryptjs').hash('password123', 10);
    await User.create({
      username: 'expireduser',
      password: hashedPassword,
      display_name: 'Expired User',
      role: 'user',
      is_active: true,
      expires_at: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app)
      .post('/api/react/auth/login')
      .send({ username: 'expireduser', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/react/auth/me', () => {
  it('nên trả 401 khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/react/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/react/auth/logout', () => {
  it('nên logout thành công khi đã đăng nhập', async () => {
    const hashedPassword = await require('bcryptjs').hash('password123', 10);
    const user = await User.create({
      username: 'logoutuser',
      password: hashedPassword,
      display_name: 'Logout User',
      role: 'user',
      is_active: true,
    });

    const agent = request.agent(app);
    await agent
      .post('/api/react/auth/login')
      .send({ username: 'logoutuser', password: 'password123' });

    const res = await agent.post('/api/react/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
