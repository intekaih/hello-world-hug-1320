/**
 * CSS & JS Build Script for movieCC
 * Gộp tất cả CSS files thành 1 file duy nhất
 * Minify JS bằng terser
 */

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

const CSS_DIR = path.join(__dirname, 'public', 'css');

// Main bundle CSS files (shared across all pages)
const CSS_FILES = [
    'animations.css',
    'navbar.css',
    'hero.css',
    'buttons.css',
    'movie-card.css',
    'card-variants.css',
    'detail.css',
    'auth.css',
    'search.css',
    'footer.css',
    'pages.css',
    'suggestions.css',
    'showcase.css',
    'hover-card.css',
    'homepage-enhancements.css',
    'bottom-nav.css',
    'responsive.css',
];

// Route-specific CSS — loaded conditionally per page
const SPLIT_CSS = [
    { file: 'player.css', output: 'player.min.css' },
    { file: 'admin.css', output: 'admin.min.css' },
];

function buildCSS() {
    console.log('📦 Building CSS bundles...');

    // Đọc style.css và loại bỏ @import statements (giữ lại Google Fonts)
    let mainCSS = fs.readFileSync(path.join(CSS_DIR, 'style.css'), 'utf8');
    mainCSS = mainCSS.replace(/@import url\('(?!https?:\/\/)[^']+'\);\s*/g, '');

    // Đọc và gộp tất cả component CSS files
    let bundled = '';
    for (const file of CSS_FILES) {
        const filePath = path.join(CSS_DIR, file);
        if (fs.existsSync(filePath)) {
            bundled += `\n/* ---- ${file} ---- */\n`;
            bundled += fs.readFileSync(filePath, 'utf8');
        } else {
            console.warn(`⚠️  Missing: ${file}`);
        }
    }

    // Gộp: component CSS trước, rồi style.css (chứa design system + overrides)
    const finalCSS = bundled + '\n' + mainCSS;
    // Disable ALL CleanCSS optimization to preserve original CSS rules and media queries
    const cleanOpts = { level: { 1: false, 2: false } };

    const minified = new CleanCSS(cleanOpts).minify(finalCSS).styles;

    // Ghi file bundle
    fs.writeFileSync(path.join(CSS_DIR, 'bundle.css'), finalCSS);
    fs.writeFileSync(path.join(CSS_DIR, 'bundle.min.css'), minified);

    const originalSize = CSS_FILES.reduce((sum, file) => {
        const fp = path.join(CSS_DIR, file);
        return sum + (fs.existsSync(fp) ? fs.statSync(fp).size : 0);
    }, fs.statSync(path.join(CSS_DIR, 'style.css')).size);

    console.log(`✅ Main CSS: ${(originalSize / 1024).toFixed(1)}KB → ${(minified.length / 1024).toFixed(1)}KB minified`);

    // Build split CSS files (route-specific)
    for (const { file, output } of SPLIT_CSS) {
        const fp = path.join(CSS_DIR, file);
        if (!fs.existsSync(fp)) { console.warn(`⚠️  Missing split: ${file}`); continue; }
        const src = fs.readFileSync(fp, 'utf8');
        const min = new CleanCSS(cleanOpts).minify(src).styles;
        fs.writeFileSync(path.join(CSS_DIR, output), min);
        console.log(`✅ Split: ${file} ${(src.length / 1024).toFixed(1)}KB → ${output} ${(min.length / 1024).toFixed(1)}KB`);
    }
}

async function buildJS() {
    console.log('📦 Building JS bundles...');
    const { minify } = require('terser');
    const JS_DIR = path.join(__dirname, 'public', 'js');

    const jsFiles = ['app.js', 'player.js', 'custom-player.js', 'admin.js', 'starlight.js'];

    for (const file of jsFiles) {
        const filePath = path.join(JS_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Missing: ${file}`);
            continue;
        }
        const code = fs.readFileSync(filePath, 'utf8');
        const result = await minify(code, { compress: { drop_console: true }, mangle: true });
        const outName = file.replace('.js', '.min.js');
        fs.writeFileSync(path.join(JS_DIR, outName), result.code);
        console.log(`✅ ${file}: ${(code.length / 1024).toFixed(1)}KB → ${(result.code.length / 1024).toFixed(1)}KB minified`);
    }
}

buildCSS();
buildJS().catch(err => {
    console.error('❌ JS build failed:', err);
    process.exit(1);
});
