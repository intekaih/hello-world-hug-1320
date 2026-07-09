/**
 * History Module Integration Tests
 *
 * Test watch history endpoints qua React API route.
 */

const request = require('supertest');
const { User } = require('../../src/models/User');
const { WatchHistory } = require('../../src/models/WatchHistory');
const { createTestApp } = require('../helpers/testApp');
const apiRouter = require('../../src/routes/api');

let app, agent, userId;

beforeAll(async () => {
  app = createTestApp('/api/react', apiRouter);

  const hashedPassword = await require('bcryptjs').hash('password123', 10);
  const user = await User.create({
    username: 'histtest',
    password: hashedPassword,
    display_name: 'Hist Test',
    role: 'user',
    is_active: true,
  });
  userId = user._id.toString();

  agent = request.agent(app);
  await agent
    .post('/api/react/auth/login')
    .send({ username: 'histtest', password: 'password123' });
});

describe('POST /api/react/history/progress', () => {
  it('nên lưu tiến trình xem phim', async () => {
    const res = await agent
      .post('/api/react/history/progress')
      .send({
        movieSlug: 'test-phim',
        episodeSlug: 'tap-1',
        currentTime: 300,
        duration: 3600,
        movieName: 'Test Phim',
        movieThumb: 'https://example.com/thumb.jpg',
        movieOriginName: 'Test Movie',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('nên trả lỗi khi thiếu movieSlug hoặc episodeSlug', async () => {
    const res = await agent
      .post('/api/react/history/progress')
      .send({ currentTime: 300, duration: 3600 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/react/history', () => {
  it('nên lấy danh sách lịch sử xem', async () => {
    await WatchHistory.create({
      user_id: userId,
      movie_slug: 'test-phim-hist',
      episode_slug: 'tap-1',
      current_time: 120,
      duration: 3600,
      last_watched: new Date(),
    });

    const res = await agent.get('/api/react/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/react/history/progress/:slug/:episode', () => {
  it('nên trả tiến trình xem của tập phim', async () => {
    await WatchHistory.create({
      user_id: userId,
      movie_slug: 'test-phim-progress',
      episode_slug: 'tap-1',
      current_time: 600,
      duration: 3600,
      last_watched: new Date(),
    });

    const res = await agent.get('/api/react/history/progress/test-phim-progress/tap-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /api/react/history/:id', () => {
  it('nên xóa 1 item lịch sử', async () => {
    const hist = await WatchHistory.create({
      user_id: userId,
      movie_slug: 'test-phim-del',
      episode_slug: 'tap-1',
      current_time: 60,
      duration: 3600,
      last_watched: new Date(),
    });

    const res = await agent.delete(`/api/react/history/${hist._id.toString()}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
