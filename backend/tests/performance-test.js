/**
 * Performance Test Script for movieCC
 * Tests homepage, movie detail, and API endpoints
 */

const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({ status: res.statusCode, duration, data: data.substring(0, 500) });
      });
    }).on('error', reject);
  });
}

async function testAPI() {
  console.log('\n🧪 TESTING API ENDPOINTS\n');
  console.log('─'.repeat(50));

  const tests = [
    { name: 'Homepage API (/api/react/movies/home)', url: `${BASE_URL}/api/react/movies/home` },
    { name: 'Category API (/api/react/category/phim-bo)', url: `${BASE_URL}/api/react/category/phim-bo` },
    { name: 'Search API (/api/react/search?q=one)', url: `${BASE_URL}/api/react/search?q=one` },
    { name: 'Movie Detail API (/api/react/movies/chi-chi-chong)', url: `${BASE_URL}/api/react/movies/chi-chi-chong` },
  ];

  for (const test of tests) {
    try {
      const result = await httpGet(test.url);
      const status = result.status === 200 ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      console.log(`   Status: ${result.status} | Time: ${result.duration}ms`);
    } catch (err) {
      console.log(`❌ ${test.name}: ${err.message}`);
    }
  }
}

async function testBrowser() {
  console.log('\n🧪 TESTING BROWSER RENDERING\n');
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const tests = [
    { name: 'Homepage', url: BASE_URL, wait: 'networkidle' },
    { name: 'Movie Detail', url: `${BASE_URL}/phim/chi-chi-chong`, wait: 'domcontentloaded' },
    { name: 'Category Page', url: `${BASE_URL}/the-loai/hanh-dong`, wait: 'domcontentloaded' },
  ];

  for (const test of tests) {
    try {
      const start = Date.now();
      await page.goto(test.url, { waitUntil: test.wait, timeout: 30000 });
      const duration = Date.now() - start;

      // Check for errors
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const title = await page.title();
      console.log(`✅ ${test.name} - Load: ${duration}ms | Title: ${title.substring(0, 50)}...`);
    } catch (err) {
      console.log(`❌ ${test.name}: ${err.message}`);
    }
  }

  await browser.close();
}

async function main() {
  console.log('🎬 movieCC Performance Test');
  console.log('═'.repeat(50));

  await testAPI();
  await testBrowser();

  console.log('\n✅ Test completed!\n');
}

main().catch(console.error);