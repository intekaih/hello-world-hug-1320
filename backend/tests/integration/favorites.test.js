/**
 * Favorites Module Integration Tests
 *
 * Test favorites endpoints qua React API route.
 */

const request = require('supertest');
const { User } = require('../../src/models/User');
const { Favorite } = require('../../src/models/Favorite');
const { createTestApp } = require('../helpers/testApp');
const apiRouter = require('../../src/routes/api');

let app, agent, userId;

beforeAll(async () => {
  app = createTestApp('/api/react', apiRouter);

  const hashedPassword = await require('bcryptjs').hash('password123', 10);
  const user = await User.create({
    username: 'favtest',
    password: hashedPassword,
    display_name: 'Fav Test',
    role: 'user',
    is_active: true,
  });
  userId = user._id.toString();

  agent = request.agent(app);
  await agent
    .post('/api/react/auth/login')
    .send({ username: 'favtest', password: 'password123' });
});

describe('POST /api/react/favorites/toggle', () => {
  it('nên thêm favorite thành công', async () => {
    const res = await agent
      .post('/api/react/favorites/toggle')
      .send({
        movieSlug: 'test-phim-1',
        movieName: 'Test Phim 1',
        movieThumb: 'https://example.com/thumb.jpg',
        movieOriginName: 'Test Movie 1',
        lastEpisode: '1',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('added');
    expect(res.body.isFavorite).toBe(true);
  });

  it('nên bỏ favorite khi toggle lại', async () => {
    await Favorite.create({
      user_id: userId,
      movie_slug: 'test-phim-2',
      movie_name: 'Test Phim 2',
      movie_thumb: null,
      movie_origin_name: null,
      last_episode: null,
    });

    const res = await agent
      .post('/api/react/favorites/toggle')
      .send({ movieSlug: 'test-phim-2' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('removed');
    expect(res.body.isFavorite).toBe(false);
  });

  it('nên trả lỗi khi thiếu movieSlug', async () => {
    const res = await agent
      .post('/api/react/favorites/toggle')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/react/favorites', () => {
  it('nên lấy danh sách favorites', async () => {
    await Favorite.create({
      user_id: userId,
      movie_slug: 'test-phim-3',
      movie_name: 'Test Phim 3',
      movie_thumb: null,
      movie_origin_name: null,
      last_episode: null,
    });

    const res = await agent.get('/api/react/favorites');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/react/favorites/check/:slug', () => {
  it('nên trả true khi là favorite', async () => {
    await Favorite.create({
      user_id: userId,
      movie_slug: 'test-phim-check',
      movie_name: 'Test',
      movie_thumb: null,
      movie_origin_name: null,
      last_episode: null,
    });

    const res = await agent.get('/api/react/favorites/check/test-phim-check');
    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
  });

  it('nên trả false khi không phải favorite', async () => {
    const res = await agent.get('/api/react/favorites/check/phan-mem-vo');
    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(false);
  });
});
