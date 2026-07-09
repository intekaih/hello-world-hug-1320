const { chromium } = require('playwright');

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
  
  console.log(`Testing: ${BASE_URL}\n`);
  
  // Test 1: Homepage
  console.log('1. Testing Homepage...');
  try {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - start;
    
    const title = await page.title();
    const hasMovies = await page.locator('.movie-card, .film-grid, [class*="movie"]').count() > 0;
    
    results.push({
      name: 'Homepage',
      status: loadTime < 5000 ? 'PASS' : 'SLOW',
      time: loadTime + 'ms',
      details: `title: ${title}, has movies: ${hasMovies}`
    });
    console.log(`   ✓ Homepage loaded in ${loadTime}ms`);
  } catch (e) {
    results.push({ name: 'Homepage', status: 'FAIL', time: '0ms', details: e.message });
    console.log(`   ✗ Homepage failed: ${e.message}`);
  }
  
  // Test 2: Movie Detail
  console.log('2. Testing Movie Detail...');
  try {
    const start = Date.now();
    await page.goto(`${BASE_URL}/phim/one-piece`, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - start;
    
    const hasEpisodes = await page.locator('.episode, .episodes, [class*="episode"]').count() > 0;
    const title = await page.title();
    
    results.push({
      name: 'Movie Detail',
      status: loadTime < 8000 ? 'PASS' : 'SLOW',
      time: loadTime + 'ms',
      details: `title: ${title}, has episodes: ${hasEpisodes}`
    });
    console.log(`   ✓ Movie detail loaded in ${loadTime}ms`);
  } catch (e) {
    results.push({ name: 'Movie Detail', status: 'FAIL', time: '0ms', details: e.message });
    console.log(`   ✗ Movie detail failed: ${e.message}`);
  }
  
  // Test 3: Search
  console.log('3. Testing Search...');
  try {
    const start = Date.now();
    await page.goto(`${BASE_URL}/tim-kiem?q=one-piece`, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - start;
    
    const hasResults = await page.locator('.movie-card, .film-grid, [class*="movie"]').count() > 0;
    
    results.push({
      name: 'Search',
      status: loadTime < 5000 ? 'PASS' : 'SLOW',
      time: loadTime + 'ms',
      details: `has results: ${hasResults}`
    });
    console.log(`   ✓ Search loaded in ${loadTime}ms`);
  } catch (e) {
    results.push({ name: 'Search', status: 'FAIL', time: '0ms', details: e.message });
    console.log(`   ✗ Search failed: ${e.message}`);
  }
  
  // Test 4: Category Page
  console.log('4. Testing Category Page...');
  try {
    const start = Date.now();
    await page.goto(`${BASE_URL}/the-loai/hanh-dong`, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - start;
    
    const hasMovies = await page.locator('.movie-card, .film-grid, [class*="movie"]').count() > 0;
    
    results.push({
      name: 'Category',
      status: loadTime < 5000 ? 'PASS' : 'SLOW',
      time: loadTime + 'ms',
      details: `has movies: ${hasMovies}`
    });
    console.log(`   ✓ Category loaded in ${loadTime}ms`);
  } catch (e) {
    results.push({ name: 'Category', status: 'FAIL', time: '0ms', details: e.message });
    console.log(`   ✗ Category failed: ${e.message}`);
  }
  
  // Test 5: Console Errors
  console.log('5. Checking Console Errors...');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  results.push({
    name: 'Console Errors',
    status: errors.length === 0 ? 'PASS' : 'WARN',
    time: errors.length + ' errors',
    details: errors.slice(0, 3).join(', ')
  });
  console.log(`   ${errors.length === 0 ? '✓' : '⚠'} Console errors: ${errors.length}`);
  
  // Summary
  console.log('\n=== RESULTS ===');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const slow = results.filter(r => r.status === 'SLOW').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  
  console.log(`PASS: ${pass}/${results.length}`);
  console.log(`SLOW: ${slow}/${results.length}`);
  console.log(`FAIL: ${fail}/${results.length}`);
  console.log(`WARN: ${warn}/${results.length}`);
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'SLOW' ? '⚠' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(`  ${icon} ${r.name}: ${r.status} (${r.time})`);
  });
  
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});