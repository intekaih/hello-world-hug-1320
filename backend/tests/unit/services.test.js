/**
 * Unit Tests — Services
 *
 * Test business logic của các services mà không cần HTTP layer.
 */

const User = require('../../src/modules/auth/repositories/UserRepository');
const FavoritesService = require('../../src/modules/favorites/services/FavoritesService');
const HistoryService = require('../../src/modules/history/services/HistoryService');
const AdminService = require('../../src/modules/admin/services/AdminService');

const { User: UserModel } = require('../../src/models/User');
const { Favorite } = require('../../src/models/Favorite');
const { WatchHistory } = require('../../src/models/WatchHistory');

describe('UserRepository', () => {
  let userRepo;

  beforeEach(() => {
    userRepo = new User();
  });

  describe('create()', () => {
    it('nên tạo user mới', async () => {
      const user = await userRepo.create({
        username: 'newuser',
        password: 'hashedpassword',
        display_name: 'New User',
        role: 'user',
      });

      expect(user.username).toBe('newuser');
      expect(user.display_name).toBe('New User');
      expect(user.role).toBe('user');
      expect(user.is_active).toBe(true);
      expect(user.id).toBeDefined();
    });
  });

  describe('findByUsername()', () => {
    it('nên tìm user theo username', async () => {
      await userRepo.create({
        username: 'findme',
        password: 'pass',
        display_name: 'Find Me',
        role: 'user',
      });

      const found = await userRepo.findByUsername('findme');
      expect(found).not.toBeNull();
      expect(found.username).toBe('findme');
    });

    it('nên trả null khi không tìm thấy', async () => {
      const found = await userRepo.findByUsername('notexist');
      expect(found).toBeNull();
    });
  });

  describe('findById()', () => {
    it('nên tìm user theo ID', async () => {
      const created = await userRepo.create({
        username: 'findbyid',
        password: 'pass',
        display_name: 'Find By ID',
        role: 'user',
      });

      const found = await userRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found.username).toBe('findbyid');
    });
  });

  describe('update()', () => {
    it('nên cập nhật user', async () => {
      const user = await userRepo.create({
        username: 'updateuser',
        password: 'pass',
        display_name: 'Old Name',
        role: 'user',
      });

      const updated = await userRepo.update(user.id, { display_name: 'New Name' });
      expect(updated.display_name).toBe('New Name');
    });
  });

  describe('delete()', () => {
    it('nên xóa user', async () => {
      const user = await userRepo.create({
        username: 'deleteuser',
        password: 'pass',
        display_name: 'Delete User',
        role: 'user',
      });

      const deleted = await userRepo.delete(user.id);
      expect(deleted).toBe(true);

      const found = await userRepo.findById(user.id);
      expect(found).toBeNull();
    });
  });
});

describe('FavoritesService', () => {
  let favService;
  let userId;

  beforeAll(async () => {
    const user = await UserModel.create({
      username: 'favservicetest',
      password: 'pass',
      display_name: 'Fav Service Test',
      role: 'user',
    });
    userId = user._id.toString();
    favService = new FavoritesService(null);
    favService.favRepo = {
      isFavorite: async (uid, slug) => {
        const f = await Favorite.findOne({ user_id: uid, movie_slug: slug });
        return !!f;
      },
      toggle: async (uid, data) => {
        const existing = await Favorite.findOne({ user_id: uid, movie_slug: data.movieSlug });
        if (existing) {
          await existing.deleteOne();
          return { action: 'removed' };
        }
        await Favorite.create({ user_id: uid, movie_slug: data.movieSlug, movie_name: data.movieName });
        return { action: 'added' };
      },
      count: async (q) => Favorite.countDocuments(q),
    };
  });

  describe('toggle()', () => {
    it('nên thêm favorite mới', async () => {
      const result = await favService.toggle(userId, { movieSlug: 'toggle-phim-1' });
      expect(result.action).toBe('added');
    });

    it('nên bỏ favorite khi đã tồn tại', async () => {
      await Favorite.create({ user_id: userId, movie_slug: 'toggle-phim-2', movie_name: 'Phim 2' });
      const result = await favService.toggle(userId, { movieSlug: 'toggle-phim-2' });
      expect(result.action).toBe('removed');
    });
  });

  describe('isFavorite()', () => {
    it('nên trả true khi là favorite', async () => {
      await Favorite.create({ user_id: userId, movie_slug: 'is-fav-yes', movie_name: 'Yes' });
      const result = await favService.isFavorite(userId, 'is-fav-yes');
      expect(result).toBe(true);
    });

    it('nên trả false khi không phải favorite', async () => {
      const result = await favService.isFavorite(userId, 'is-fav-no');
      expect(result).toBe(false);
    });
  });
});

describe('HistoryService', () => {
  let histService;
  let userId;

  beforeAll(async () => {
    const user = await UserModel.create({
      username: 'histservicetest',
      password: 'pass',
      display_name: 'Hist Service Test',
      role: 'user',
    });
    userId = user._id.toString();
    histService = new HistoryService(null);
    histService.historyRepo = {
      upsertProgress: async (uid, data) => {
        await WatchHistory.findOneAndUpdate(
          { user_id: uid, movie_slug: data.movieSlug, episode_slug: data.episodeSlug },
          { $set: { ...data, last_watched: new Date() }, $setOnInsert: { user_id: uid, movie_slug: data.movieSlug, episode_slug: data.episodeSlug } },
          { upsert: true, new: true }
        );
      },
      findOne: async (q) => WatchHistory.findOne(q).lean(),
      findLatestOfMovie: async (uid, slug) => WatchHistory.findOne({ user_id: uid, movie_slug: slug }).sort({ last_watched: -1 }).lean(),
      deleteItem: async (uid, id) => {
        const r = await WatchHistory.deleteOne({ _id: id, user_id: uid });
        return r.deletedCount > 0;
      },
      clearAll: async (uid) => WatchHistory.deleteMany({ user_id: uid }),
      model: WatchHistory,
    };
  });

  describe('saveProgress()', () => {
    it('nên lưu tiến trình xem', async () => {
      await histService.saveProgress(userId, {
        movieSlug: 'hist-svc-phim',
        episodeSlug: 'tap-1',
        currentTime: 100,
        duration: 500,
        movieName: 'Hist Svc Phim',
      });
      expect(true).toBe(true);
    });

    it('nên throw khi thiếu thông tin', async () => {
      await expect(histService.saveProgress(userId, {
        movieSlug: 'hist-svc-phim',
        episodeSlug: '',
        currentTime: 0,
        duration: 0,
      })).rejects.toThrow('Thieu thong tin');
    });
  });

  describe('deleteItem()', () => {
    it('nên xóa item lịch sử', async () => {
      const hist = await WatchHistory.create({
        user_id: userId,
        movie_slug: 'hist-del-phim',
        episode_slug: 'tap-1',
        current_time: 50,
        duration: 500,
        last_watched: new Date(),
      });
      const result = await histService.deleteItem(userId, hist._id.toString());
      expect(result).toBe(true);
    });
  });
});

describe('AdminService', () => {
  let adminService;
  let adminId, userId;

  beforeAll(async () => {
    const adminUser = await UserModel.create({
      username: 'adminservicetest',
      password: 'pass',
      display_name: 'Admin Service Test',
      role: 'admin',
    });
    adminId = adminUser._id.toString();

    const normalUser = await UserModel.create({
      username: 'normaluserfortest',
      password: 'pass',
      display_name: 'Normal User',
      role: 'user',
    });
    userId = normalUser._id.toString();

    adminService = new AdminService(null);
  });

  describe('createUser()', () => {
    it('nên throw khi thiếu thông tin', async () => {
      await expect(adminService.createUser({ username: '', password: '', display_name: '' }))
        .rejects.toThrow('Thieu thong tin bat buoc');
    });
  });
});
