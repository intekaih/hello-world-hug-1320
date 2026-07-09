/**
 * Unit Tests — PluginProvider (XPath Declarative Rules)
 */

const fs = require('fs');
const path = require('path');
const PluginProvider = require('../../src/services/PluginProvider');

describe('PluginProvider Declarative Rules', () => {
  let provider;
  const mockRule = {
    baseURL: 'https://mocksite.com',
    searchURL: 'https://mocksite.com/search?q=@keyword&page=@page',
    searchList: '//div[@class="movie-card"]',
    searchName: './/h3/a',
    searchResult: './/h3/a',
    searchThumb: './/img',
    chapterRoads: '//div[@class="servers-list"]/div',
    chapterResult: './/a',
    streamSelector: '//iframe/@src',
  };

  const mockSearchHtml = `
    <html>
      <body>
        <div class="movie-card">
          <h3><a href="/movie/test-movie-1">Test Movie 1</a></h3>
          <img src="/poster1.jpg" />
        </div>
        <div class="movie-card">
          <h3><a href="/movie/test-movie-2">Test Movie 2</a></h3>
          <img src="/poster2.jpg" />
        </div>
      </body>
    </html>
  `;

  const mockDetailHtml = `
    <html>
      <body>
        <h1 class="title">Detail Test Movie 1</h1>
        <div class="servers-list">
          <div class="server">
            <h3>Server VIP</h3>
            <a href="/watch/movie-1/ep-1">Tập 1</a>
            <a href="/watch/movie-1/ep-2">Tập 2</a>
          </div>
        </div>
      </body>
    </html>
  `;

  const mockStreamHtml = `
    <html>
      <body>
        <iframe src="https://mockcdn.com/embed/movie1-ep1.m3u8"></iframe>
      </body>
    </html>
  `;

  beforeEach(() => {
    provider = new PluginProvider({
      id: 'mock-provider',
      name: 'Mock Provider',
      scriptUrl: 'plugins/mock_rule.json',
    });

    // Mock _loadScript to immediately resolve with mockRule
    provider.isLoaded = true;
    provider.isDeclarative = true;
    provider.rule = mockRule;
    provider.baseUrl = mockRule.baseURL;
  });

  describe('_toSafeSlug()', () => {
    it('nên chuyển URL thành safe slug', () => {
      const slug = provider._toSafeSlug('https://mocksite.com/movie/test-movie-1');
      expect(slug).toBe('movie--test-movie-1');
    });

    it('nên giữ nguyên slug đơn giản', () => {
      const slug = provider._toSafeSlug('/simple-slug');
      expect(slug).toBe('simple-slug');
    });

    it('nên chuyển pipe thành double-dash', () => {
      const slug = provider._toSafeSlug('123|456|abc');
      expect(slug).toBe('123--456--abc');
    });
  });

  describe('_fromSafeSlug()', () => {
    it('nên khôi phục double-dash thành slash và resolve URL', () => {
      const url = provider._fromSafeSlug('movie--test-movie-1');
      expect(url).toBe('https://mocksite.com/movie/test-movie-1');
    });

    it('nên trả về nguyên nếu đã là URL đầy đủ', () => {
      const url = provider._fromSafeSlug('https://example.com/path');
      expect(url).toBe('https://example.com/path');
    });
  });

  describe('searchMovies()', () => {
    it('nên tìm kiếm phim và phân tích đúng cấu trúc XPath', async () => {
      // Mock apiCall
      provider.apiCall = jest.fn().mockResolvedValue(mockSearchHtml);

      const result = await provider.searchMovies('test keyword', 1);

      expect(provider.apiCall).toHaveBeenCalledWith(
        'https://mocksite.com/search?q=test%20keyword&page=1',
        'mock-provider:search:test keyword:1'
      );
      expect(result.items).toHaveLength(2);
      // Safe slug should be used
      expect(result.items[0].slug).toBe('movie--test-movie-1');
      expect(result.items[0]._id).toBe('https://mocksite.com/movie/test-movie-1');
      expect(result.items[0].name).toBe('Test Movie 1');
    });
  });

  describe('getMovieDetail()', () => {
    it('nên lấy chi tiết phim và tập phim từ cấu trúc XPath', async () => {
      provider.apiCall = jest.fn().mockResolvedValue(mockDetailHtml);

      // Pass safe slug - should be reconstructed to URL internally
      const result = await provider.getMovieDetail('https://mocksite.com/movie/test-movie-1');

      expect(result.name).toBe('Detail Test Movie 1');
      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].server_name).toBe('Server VIP');
      expect(result.episodes[0].server_data).toHaveLength(2);
      // Episode slug should be safe-slugified
      expect(result.episodes[0].server_data[0].slug).toBe('watch--movie-1--ep-1');
      expect(result.episodes[0].server_data[0].name).toBe('1');
      // episode_current should be calculated
      expect(result.episode_current).toBe('Tập 2');
    });
  });

  describe('extractStream()', () => {
    it('nên phân tích và trích xuất luồng phát video sử dụng streamSelector', async () => {
      provider.apiCall = jest.fn().mockResolvedValue(mockStreamHtml);

      const result = await provider.extractStream('https://mocksite.com/watch/movie-1/ep-1');

      expect(provider.apiCall).toHaveBeenCalledWith(
        'https://mocksite.com/watch/movie-1/ep-1',
        'mock-provider:stream:https://mocksite.com/watch/movie-1/ep-1'
      );
      expect(result).toEqual({
        url: 'https://mockcdn.com/embed/movie1-ep1.m3u8',
        headers: { Referer: 'https://mocksite.com' },
      });
    });
  });
});
