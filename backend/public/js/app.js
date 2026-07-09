/* movieCC - Main Application JavaScript */

// ---- HTML Escape Helper (for dynamic DOM construction) ----
function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ---- CSRF Token Helper ----
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

// ---- Image Fallback & Skeleton Handler ----
document.addEventListener('error', function(e) {
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    var fallback = img.dataset.fallback;
    if (fallback && img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
    }
    var cls = img.dataset.fallbackClass;
    if (cls && img.parentElement) {
        img.parentElement.classList.remove(cls);
    }
}, true);

document.addEventListener('load', function(e) {
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.hasAttribute('data-skeleton-parent') && img.parentElement) {
        img.parentElement.classList.remove('skeleton');
    }
}, true);

// Check already loaded images on startup
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('img[data-skeleton-parent]').forEach(img => {
        if (img.complete) {
            img.parentElement?.classList.remove('skeleton');
        }
    });
});

// ---- Toast Notification System ----
function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(msg);
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Theme Toggle ----
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'light') {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('moviecc-theme', 'light');
    } else {
        html.removeAttribute('data-theme');
        localStorage.setItem('moviecc-theme', 'dark');
    }
}

// ---- Favorites Toggle ----
async function toggleFav(btn) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    const slug = btn.dataset.slug;
    try {
        const res = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({
                movieSlug: slug,
                movieName: btn.dataset.name,
                movieThumb: btn.dataset.thumb,
                movieOriginName: btn.dataset.origin,
                lastEpisode: btn.dataset.episode || ''
            })
        });
        // Guest chưa đăng nhập → redirect login
        if (res.redirected || res.status === 401 || res.status === 403) {
            window.location.href = '/dang-nhap';
            return;
        }
        if (res.ok) {
            const data = await res.json();
            const svg = btn.querySelector('svg');
            if (data.isFavorite) {
                svg.setAttribute('fill', 'var(--primary)');
                svg.setAttribute('stroke', 'var(--primary)');
                btn.classList.remove('fav-highlight');
                btn.classList.add('fav-active', 'fav-pulse');
                setTimeout(() => btn.classList.remove('fav-pulse'), 600);
                showToast('Đã thêm vào yêu thích ❤️ Bạn sẽ nhận thông báo khi có tập mới!');
                if ('Notification' in window) {
                    if (Notification.permission === 'default') {
                        try {
                            var perm = await Notification.requestPermission();
                            if (perm === 'granted') {
                                showToast('🔔 Đã bật thông báo! Bạn sẽ nhận được khi có tập mới.');
                            } else if (perm === 'denied') {
                                showToast('Bạn đã tắt thông báo. Vào cài đặt trình duyệt để bật lại, hoặc xem qua icon 🔔 trên header.', 'info');
                            }
                        } catch (e) { /* Notification API không hỗ trợ */ }
                    } else if (Notification.permission === 'denied') {
                        showToast('Thông báo đang bị chặn. Nhấn icon 🔒 trên thanh địa chỉ để bật lại, hoặc xem qua icon 🔔 trên header.', 'info');
                    }
                }
            } else {
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                btn.classList.remove('fav-active');
                btn.classList.add('fav-highlight');
                showToast('Đã bỏ yêu thích', 'info');
            }
        }
    } catch (e) {
        console.error('Lỗi toggle favorite:', e);
    }
}

// ---- Navbar + Scroll to Top (handled by unified scroll handler below) ----
const navbar = document.getElementById('navbar');
const scrollTopBtn = document.getElementById('scrollTopBtn');

// ---- Mobile navigation ----
function toggleMobileNav() {
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('navOverlay');
    const menuBtn = document.getElementById('mobileMenuBtn');
    if (navLinks) {
        const isOpen = navLinks.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('show', isOpen);
        if (menuBtn) menuBtn.classList.toggle('active', isOpen);
        // Close all open dropdowns when closing the menu
        if (!isOpen) {
            navLinks.querySelectorAll('.nav-dropdown-wrapper.open').forEach(el => el.classList.remove('open'));
        }
    }
}

function closeMobileNav() {
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('navOverlay');
    const menuBtn = document.getElementById('mobileMenuBtn');
    if (navLinks) {
        navLinks.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('show');
        if (menuBtn) menuBtn.classList.remove('active');
        navLinks.querySelectorAll('.nav-dropdown-wrapper.open').forEach(el => el.classList.remove('open'));
    }
}

// Mobile dropdown toggle (The loai / Quoc gia)
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.nav-cat-trigger');
    if (!trigger) return;

    // Only handle on mobile (popup visible)
    if (window.innerWidth > 768) return;

    e.preventDefault();
    e.stopPropagation();

    const wrapper = trigger.closest('.nav-dropdown-wrapper');
    if (!wrapper) return;

    // Close other open dropdowns
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.querySelectorAll('.nav-dropdown-wrapper.open').forEach(el => {
            if (el !== wrapper) el.classList.remove('open');
        });
    }

    wrapper.classList.toggle('open');
});

// Close popup when clicking a menu link (not dropdown triggers)
document.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-mobile-item:not(.nav-cat-trigger)');
    if (link && window.innerWidth <= 768) {
        closeMobileNav();
    }
});

// ---- Search toggle ----
function toggleSearch() {
    const navSearch = document.getElementById('navSearch');
    if (navSearch) {
        navSearch.classList.toggle('active');
        if (navSearch.classList.contains('active')) {
            navSearch.querySelector('input').focus();
        }
    }
}

// ---- Search bar logic ----
(function initSearch() {
    const navSearch = document.getElementById('navSearch');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchToggleBtn');
    const searchForm = document.getElementById('searchForm');
    if (!navSearch || !searchInput || !searchBtn || !searchForm) return;

    // Click icon: mở bar nếu đang đóng; submit nếu đang mở và có text; đóng nếu trống
    searchBtn.addEventListener('click', function () {
        const isActive = navSearch.classList.contains('active');
        if (!isActive) {
            navSearch.classList.add('active');
            searchInput.focus();
        } else if (searchInput.value.trim()) {
            searchForm.submit();
        } else {
            navSearch.classList.remove('active');
        }
    });

    searchForm.addEventListener('submit', function (e) {
        const q = searchInput.value.trim();
        if (q.length > 0) {
            let recents = [];
            try { recents = JSON.parse(localStorage.getItem('moviecc_recent_searches')) || []; } catch (err) { }
            recents = recents.filter(item => item !== q);
            recents.unshift(q);
            if (recents.length > 5) recents.pop();
            localStorage.setItem('moviecc_recent_searches', JSON.stringify(recents));
        } else {
            e.preventDefault();
        }
    });

    // Focus vào input → mở bar
    searchInput.addEventListener('focus', function () {
        navSearch.classList.add('active');
    });

    // Blur khi input trống → đóng bar
    searchInput.addEventListener('blur', function () {
        setTimeout(() => {
            if (!this.value.trim() && !navSearch.contains(document.activeElement)) {
                navSearch.classList.remove('active');
            }
        }, 150);
    });

    // Click ngoài search bar → đóng nếu trống
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#navSearch') && !searchInput.value.trim()) {
            navSearch.classList.remove('active');
        }
    });
})();

// ---- Category dropdown (desktop hover handled by CSS, this is for mobile) ----
document.querySelectorAll('.nav-cat-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const dropdown = trigger.nextElementSibling;
        if (dropdown) dropdown.classList.toggle('show');
    });
});

// ---- Close dropdowns on outside click ----
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown-wrapper')) {
        document.querySelectorAll('#catDropdown').forEach(d => d.classList.remove('show'));
    }
});

// ---- Hero Logo: xóa nền đen bằng Canvas ----
function removeLogoBlackBg(img) {
    try {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var px = data.data;
        for (var i = 0; i < px.length; i += 4) {
            var lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
            if (lum < 15) {
                px[i + 3] = 0;
            } else if (lum < 40) {
                px[i + 3] = Math.round(((lum - 15) / 25) * px[i + 3]);
            }
        }
        ctx.putImageData(data, 0, 0);
        img.src = canvas.toDataURL('image/png');
    } catch (e) {
        // CORS hoặc lỗi khác — giữ nguyên ảnh
    }
}

function attachHeroLogoHandlers() {
    document.querySelectorAll('img.hero-logo[data-remove-bg]').forEach(function(img) {
        function onLoad() {
            removeLogoBlackBg(img);
        }
        function onError() {
            img.style.display = 'none';
            var title = img.nextElementSibling;
            if (title && title.classList.contains('hero-title-hidden')) {
                title.classList.remove('hero-title-hidden');
            }
        }
        if (img.complete && img.naturalWidth > 0) {
            onLoad();
        } else if (img.complete) {
            onError();
        } else {
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
        }
    });
}

document.addEventListener('DOMContentLoaded', attachHeroLogoHandlers);

// ---- Hero Slider ----
// Sử dụng backdrop_url (TMDB, ảnh ngang HD) > poster_url > thumb_url
let currentSlide = 0;
let slideInterval;
const SLIDE_DURATION = 6000; // 6 seconds

// Lấy URL ảnh hero ưu tiên
function getHeroImageUrl(slide) {
    var movieData = slide.dataset.movie ? JSON.parse(slide.dataset.movie) : null;
    if (movieData) {
        return movieData.backdrop_url || movieData.poster_url || movieData.thumb_url || '';
    }
    var heroBg = slide.querySelector('.hero-bg');
    return heroBg ? (heroBg.dataset.bg || '') : '';
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const thumbs = document.querySelectorAll('.hero-thumb');
    const dots = document.querySelectorAll('.hero-dot');
    const progressBar = document.getElementById('heroProgressBar');
    const playBtn = document.getElementById('heroPlayBtn');

    if (!slides.length) return;

    // Remove active from all
    slides.forEach(s => {
        s.classList.remove('active');
        s.style.opacity = '0';
        s.style.visibility = 'hidden';
    });
    thumbs.forEach(t => t.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    // Set active
    currentSlide = index;
    const activeSlide = slides[currentSlide];
    activeSlide.classList.add('active');
    activeSlide.style.opacity = '1';
    activeSlide.style.visibility = 'visible';
    if (thumbs[currentSlide]) thumbs[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');

    // Load hero background image — ưu tiên backdrop_url
    const heroBg = activeSlide.querySelector('.hero-bg');
    if (heroBg && heroBg.dataset.bg) {
        heroBg.style.backgroundImage = "url('" + heroBg.dataset.bg + "')";
    }

    // Update play button link từ movie data
    if (playBtn) {
        var movieData = activeSlide.dataset.movie ? JSON.parse(activeSlide.dataset.movie) : null;
        if (movieData && movieData.slug) {
            var epSlug = movieData.epSlug || '1';
            var href = '/xem/' + movieData.slug + '/tap-' + epSlug;
            playBtn.href = href;
        }
    }

    // Restart progress bar animation
    if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.offsetHeight; // trigger reflow
        progressBar.style.animation = `heroProgress ${SLIDE_DURATION}ms linear forwards`;
    }

    // Restart thumb progress animation
    thumbs.forEach(t => {
        const prog = t.querySelector('.hero-thumb-progress');
        if (prog) {
            prog.style.animation = 'none';
            prog.offsetHeight;
        }
    });
    if (thumbs[currentSlide]) {
        const activeProgress = thumbs[currentSlide].querySelector('.hero-thumb-progress');
        if (activeProgress) {
            activeProgress.style.animation = `thumbProgress ${SLIDE_DURATION}ms linear forwards`;
        }
    }

    // Reset auto-play timer
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, SLIDE_DURATION);
}

function nextSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;
    goToSlide((currentSlide + 1) % slides.length);
}

// Init slider với event listeners
const heroSlider = document.getElementById('heroSlider');
if (heroSlider) {
    const slides = document.querySelectorAll('.hero-slide');
    
    // Add event listeners cho dots
    const dots = document.querySelectorAll('.hero-dot');
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            goToSlide(index);
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, SLIDE_DURATION);
        });
    });

    // Add event listeners cho thumbs
    const thumbs = document.querySelectorAll('.hero-thumb');
    thumbs.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            goToSlide(index);
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, SLIDE_DURATION);
        });
    });

    // Pause on hover
    heroSlider.addEventListener('mouseenter', () => clearInterval(slideInterval));
    heroSlider.addEventListener('mouseleave', () => {
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    });

    // Touch swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    heroSlider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    heroSlider.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextSlide();
            else goToSlide(currentSlide - 1);
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, SLIDE_DURATION);
        }
    }, { passive: true });

    // Initialize first slide background
    if (slides.length > 0) {
        const firstBg = slides[0].querySelector('.hero-bg');
        if (firstBg && firstBg.dataset.bg) {
            firstBg.style.backgroundImage = "url('" + firstBg.dataset.bg + "')";
        }
    }

    // Start auto-play
    slideInterval = setInterval(nextSlide, SLIDE_DURATION);
}

// ---- Hero Trailer Preview ----
function getYoutubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return m ? m[1] : null;
}


// ---- Scroll Animations (PowerPoint-style) handled in enhancedAnimations IIFE below ----

// ---- Server button toggle ----
document.querySelectorAll('.server-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// ---- Navbar category dropdown hover ----
const catWrapper = document.querySelector('.nav-dropdown-wrapper');
if (catWrapper) {
    catWrapper.addEventListener('mouseenter', () => {
        const dropdown = catWrapper.querySelector('.nav-dropdown');
        if (dropdown) { dropdown.style.opacity = '1'; dropdown.style.visibility = 'visible'; dropdown.style.transform = 'translateY(0)'; }
    });
    catWrapper.addEventListener('mouseleave', () => {
        const dropdown = catWrapper.querySelector('.nav-dropdown');
        if (dropdown) { dropdown.style.opacity = '0'; dropdown.style.visibility = 'hidden'; dropdown.style.transform = 'translateY(-8px)'; }
    });
}

// ---- Search Suggestions ----
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
let searchTimeout;

if (searchInput && searchSuggestions) {
    function showRecentSearches() {
        let recents = [];
        try { recents = JSON.parse(localStorage.getItem('moviecc_recent_searches')) || []; } catch (err) { }

        if (recents.length === 0) {
            searchSuggestions.classList.remove('show');
            searchSuggestions.innerHTML = '';
            return;
        }

        searchSuggestions.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'suggestions-list recent-searches';

        const header = document.createElement('div');
        header.className = 'suggestion-header';
        header.innerHTML = '<span>Lịch sử tìm kiếm</span><span class="clear-recent" style="cursor:pointer;font-size:0.8rem;color:var(--primary);text-decoration:underline;">Xóa</span>';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.padding = '12px 14px 6px';
        header.style.fontSize = '0.85rem';
        header.style.color = 'var(--text-secondary)';
        header.style.fontWeight = '600';

        header.querySelector('.clear-recent').onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            localStorage.removeItem('moviecc_recent_searches');
            showRecentSearches();
        };
        searchSuggestions.appendChild(header);

        recents.forEach(q => {
            const item = document.createElement('a');
            item.className = 'suggestion-item recent-item';
            item.href = '/tim-kiem?q=' + encodeURIComponent(q);
            item.style.padding = '10px 14px';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.color = 'var(--text-main)';
            item.style.textDecoration = 'none';
            item.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:12px;opacity:0.6"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><div class="suggestion-info" style="display:flex;align-items:center;"><div class="suggestion-title">' + escapeHtml(q) + '</div></div>';
            list.appendChild(item);
        });

        searchSuggestions.appendChild(list);
        searchSuggestions.classList.add('show');
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            showRecentSearches();
            return;
        }

        searchTimeout = setTimeout(async () => {
            // Hiệu ứng Skeleton Loading
            searchSuggestions.innerHTML = '';
            const skList = document.createElement('div');
            skList.className = 'suggestions-list';
            for (let i = 0; i < 3; i++) {
                const skItem = document.createElement('div');
                skItem.className = 'suggestion-item';
                skItem.style.padding = '10px 14px';
                skItem.style.pointerEvents = 'none';
                skItem.innerHTML = '<div class="skeleton" style="width:40px; height:56px; border-radius:4px; margin-right:12px; flex-shrink:0"></div><div style="flex:1; display:flex; flex-direction:column; gap:8px; justify-content:center"><div class="skeleton" style="width:70%; height:14px; border-radius:3px;"></div><div class="skeleton" style="width:40%; height:12px; border-radius:3px;"></div></div>';
                skList.appendChild(skItem);
            }
            searchSuggestions.appendChild(skList);
            searchSuggestions.classList.add('show');

            try {
                const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
                const movies = await res.json();

                if (movies.length > 0) {
                    searchSuggestions.innerHTML = '';

                    // Danh sách gợi ý (tối đa 5)
                    const list = document.createElement('div');
                    list.className = 'suggestions-list';
                    movies.slice(0, 5).forEach(movie => {
                        const item = document.createElement('a');
                        item.className = 'suggestion-item';
                        item.href = '/phim/' + encodeURIComponent(movie.slug);

                        const img = document.createElement('img');
                        img.className = 'suggestion-thumb';
                        img.src = movie.thumb_url;
                        img.alt = movie.name;
                        img.onerror = function () { this.src = '/images/no-poster.svg'; };

                        const info = document.createElement('div');
                        info.className = 'suggestion-info';
                        const title = document.createElement('div');
                        title.className = 'suggestion-title';
                        title.textContent = movie.name;
                        const meta = document.createElement('div');
                        meta.className = 'suggestion-meta';
                        meta.textContent = (movie.origin_name || '') + (movie.year ? ' (' + movie.year + ')' : '');

                        info.appendChild(title);
                        info.appendChild(meta);
                        item.appendChild(img);
                        item.appendChild(info);
                        list.appendChild(item);
                    });
                    searchSuggestions.appendChild(list);

                    // Nút tìm tất cả
                    const footer = document.createElement('a');
                    footer.className = 'suggestion-footer';
                    footer.href = '/tim-kiem?q=' + encodeURIComponent(query);
                    footer.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Tìm tất cả kết quả cho "<strong>' + escapeHtml(query) + '</strong>"';
                    searchSuggestions.appendChild(footer);

                    searchSuggestions.classList.add('show');
                } else {
                    searchSuggestions.classList.remove('show');
                }
            } catch (err) {
                console.error('Search suggest error:', err);
            }
        }, 300); // Debounce 300ms
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            searchSuggestions.classList.remove('show');
        }
    });

    // Show suggestions again if focused and has content, or show history if empty
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        const hasResults = searchSuggestions.children.length > 0 && !searchSuggestions.querySelector('.recent-searches');
        if (query.length >= 2 && hasResults) {
            searchSuggestions.classList.add('show');
        } else if (query.length < 2) {
            showRecentSearches();
        }
    });
}

// ---- Flash Messages from URL ----
(function checkFlashMessage() {
    const url = new URL(window.location);
    const msg = url.searchParams.get('msg');
    const type = url.searchParams.get('msgtype') || 'error';
    if (msg) {
        showToast(decodeURIComponent(msg), type);
        // Clean URL (remove msg params)
        url.searchParams.delete('msg');
        url.searchParams.delete('msgtype');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
})();

// ---- Remove Favorite from Page ----
async function removeFavFromPage(slug, btn) {
    var csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    try {
        var res = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({ movieSlug: slug })
        });
        if (res.ok) {
            var card = btn.closest('.movie-card');
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(function() { card.remove(); }, 300);
        }
    } catch (e) {
        showToast('Không thể xóa, vui lòng thử lại', 'error');
    }
}

// ---- Remove History Item ----
async function removeHistory(id) {
    try {
        var r = await fetch('/api/watch/history/' + id, {
            method: 'DELETE',
            headers: { 'x-csrf-token': getCsrfToken() }
        });
        if (r.ok) {
            var el = document.getElementById('history-' + id);
            if (el) {
                el.style.transition = 'opacity 0.3s, transform 0.3s';
                el.style.opacity = '0';
                el.style.transform = 'translateX(20px)';
                setTimeout(function() { el.remove(); }, 300);
            }
            setTimeout(function() {
                if (document.querySelectorAll('.history-item').length === 0) {
                    location.reload();
                }
            }, 400);
        }
    } catch (err) {
        showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
    }
}

// ---- Clear All History ----
async function clearAllHistory() {
    if (!confirm('Xóa toàn bộ lịch sử xem phim?')) return;
    try {
        var r = await fetch('/api/watch/history', {
            method: 'DELETE',
            headers: { 'x-csrf-token': getCsrfToken() }
        });
        if (r.ok) location.reload();
    } catch (err) {
        showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
    }
}

// ---- Delegated Event Listener for data-action ----
document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;

    switch (action) {
        case 'toggleTheme':
            toggleTheme();
            break;
        case 'toggleMobileNav':
            toggleMobileNav();
            break;
        case 'scrollTop':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case 'preventDefault':
            e.preventDefault();
            break;
        case 'goToSlide':
            goToSlide(parseInt(target.dataset.slide, 10));
            break;
        case 'scrollRow':
            scrollRow(target, parseInt(target.dataset.dir, 10));
            break;
        case 'toggleFav':
            toggleFav(target);
            break;
        case 'removeFavFromPage':
            removeFavFromPage(target.dataset.slug, target);
            break;
        case 'clearAllHistory':
            clearAllHistory();
            break;
        case 'removeHistory':
            removeHistory(target.dataset.id);
            break;
        case 'clearSearch':
            var form = target.closest('form');
            if (form) {
                form.querySelector('input[name=q]').value = '';
                form.submit();
            }
            break;
        case 'toggleCinemaMode':
            if (typeof window.toggleCinemaMode === 'function') window.toggleCinemaMode();
            break;
        case 'toggleLights':
            if (typeof window.toggleLights === 'function') window.toggleLights();
            break;
        case 'switchServer':
            if (typeof window.switchServer === 'function') window.switchServer(target);
            break;
        case 'reloadPage':
            window.location.reload();
            break;
        case 'closeModal':
            if (typeof window.closeModal === 'function') window.closeModal(target.dataset.modal);
            break;
        case 'editUser':
            if (typeof window.editUser === 'function') window.editUser(target.dataset.id, e);
            break;
        case 'toggleUser':
            if (typeof window.toggleUser === 'function') window.toggleUser(target.dataset.id);
            break;
        case 'deleteUser':
            if (typeof window.deleteUser === 'function') window.deleteUser(target.dataset.id);
            break;
    }
});

document.addEventListener('submit', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'searchSubmit') {
        if (!document.getElementById('searchInput').value.trim().length) {
            e.preventDefault();
        }
    }
});

// ---- Category/Search Filter Functions ----
function applyType(val) {
    if (val) {
        var url = new URL(window.location.origin + val);
        var cur = new URL(window.location);
        var filterType = window.__filterType || '';
        var catEl = document.getElementById('filterCategory');
        var countryEl = document.getElementById('filterCountry');
        var catVal = catEl ? catEl.value : '';
        var countryVal = countryEl ? countryEl.value : '';
        if (!catVal && filterType === 'category') {
            var path = window.location.pathname;
            var m = path.match(/\/the-loai\/([^/]+)/);
            if (m) catVal = m[1];
        }
        if (!countryVal && filterType === 'country') {
            var path = window.location.pathname;
            var m = path.match(/\/quoc-gia\/([^/]+)/);
            if (m) countryVal = m[1];
        }
        if (catVal) url.searchParams.set('category', catVal);
        if (countryVal) url.searchParams.set('country', countryVal);
        var year = cur.searchParams.get('year');
        var sort = cur.searchParams.get('sort');
        if (year) url.searchParams.set('year', year);
        if (sort) url.searchParams.set('sort', sort);
        window.location.assign(url.toString());
    } else {
        var url = new URL(window.location);
        url.searchParams.delete('page');
        window.location.assign(url.toString());
    }
}

function applySort(val) {
    var url = new URL(window.location);
    if (val) { url.searchParams.set('sort', val); } else { url.searchParams.delete('sort'); }
    url.searchParams.delete('page');
    window.location.assign(url.toString());
}

function applyYear(val) {
    var url = new URL(window.location);
    if (val) { url.searchParams.set('year', val); } else { url.searchParams.delete('year'); }
    url.searchParams.delete('page');
    window.location.assign(url.toString());
}

function applyCategory(slug) {
    var filterType = window.__filterType || '';
    if (filterType === 'category') {
        if (!slug) { window.location.href = window.location.pathname; return; }
        window.location.assign('/the-loai/' + slug);
    } else {
        var url = new URL(window.location);
        if (slug) { url.searchParams.set('category', slug); } else { url.searchParams.delete('category'); }
        url.searchParams.delete('page');
        window.location.assign(url.toString());
    }
}

function applyCountry(slug) {
    var filterType = window.__filterType || '';
    if (filterType === 'country') {
        if (!slug) { window.location.href = window.location.pathname; return; }
        window.location.assign('/quoc-gia/' + slug);
    } else {
        var url = new URL(window.location);
        if (slug) { url.searchParams.set('country', slug); } else { url.searchParams.delete('country'); }
        url.searchParams.delete('page');
        window.location.assign(url.toString());
    }
}

function applyFilters() {
    var category = (document.getElementById('filterCategory') || {}).value || '';
    var country = (document.getElementById('filterCountry') || {}).value || '';
    if (category && country) {
        window.location.href = '/the-loai/' + category + '?country=' + country;
    } else if (category) {
        window.location.href = '/the-loai/' + category;
    } else if (country) {
        window.location.href = '/quoc-gia/' + country;
    }
}

// ---- Delegated change handler for data-filter selects ----
document.addEventListener('change', function(e) {
    var target = e.target.closest('[data-filter]');
    if (!target) return;
    var filter = target.dataset.filter;
    var val = target.value;
    switch (filter) {
        case 'applyCategory': applyCategory(val); break;
        case 'applyCountry': applyCountry(val); break;
        case 'applyType': applyType(val); break;
        case 'applyYear': applyYear(val); break;
        case 'applySort': applySort(val); break;
        case 'applyFilters': applyFilters(); break;
    }
});

// ---- Init: set filter select values from URL params ----
(function initFilterSelects() {
    var url = new URL(window.location);
    var cat = url.searchParams.get('category');
    var country = url.searchParams.get('country');
    if (cat) {
        var el = document.querySelector('#filterCategory');
        if (el) el.value = cat;
    }
    if (country) {
        var el = document.querySelector('#filterCountry');
        if (el) el.value = country;
    }
})();

console.log('movieCC loaded');

/* ---- Showcase Component Logic ---- */
const SHOWCASE_INTERVAL = 5000; // 5 seconds

function initShowcases() {
    document.querySelectorAll('.showcase').forEach(showcase => {
        const strip = showcase.querySelector('.showcase-strip');
        if (!strip) return;

        const posters = strip.querySelectorAll('.showcase-poster');
        const slides = showcase.querySelectorAll('.showcase-slide');
        if (posters.length <= 1) return;

        let currentIdx = 0;
        let interval;

        function goToShowcaseSlide(idx) {
            posters.forEach(p => p.classList.remove('active'));
            slides.forEach(s => s.classList.remove('active'));
            currentIdx = idx;
            posters[currentIdx].classList.add('active');
            if (slides[currentIdx]) {
                slides[currentIdx].classList.add('active');
                // Lazy-load showcase background image
                var bg = slides[currentIdx].querySelector('.showcase-bg');
                if (bg && !bg.style.backgroundImage && bg.dataset.bg) {
                    bg.style.backgroundImage = "url('" + bg.dataset.bg + "')";
                }
            }
        }

        function nextShowcase() {
            goToShowcaseSlide((currentIdx + 1) % posters.length);
        }

        function startAutoRotate() {
            clearInterval(interval);
            interval = setInterval(nextShowcase, SHOWCASE_INTERVAL);
        }

        // Manual click
        posters.forEach((poster, index) => {
            poster.addEventListener('click', () => {
                if (currentIdx === index) return;
                goToShowcaseSlide(index);
                startAutoRotate(); // Reset timer on manual click
            });
        });

        // Pause on hover, resume on leave
        showcase.addEventListener('mouseenter', () => clearInterval(interval));
        showcase.addEventListener('mouseleave', () => startAutoRotate());

        // Start auto-rotate
        startAutoRotate();
    });
}
// Init showcases
initShowcases();

// ---- Hover Card (built dynamically from data-attrs, no pre-rendered HTML needed) ----
(function () {
    // Skip on touch/tablet devices — hover card is desktop-only
    if (window.innerWidth <= 1024) return;

    const PW = 300;
    const M = 10;
    let activeCard = null;
    let activeHc = null;
    let hideTimer = null;
    let showTimer = null;

    function buildHoverCard(card) {
        var d = card.dataset;
        if (!d.hoverSlug) return null;
        var href = '/phim/' + d.hoverSlug;
        var rating = d.hoverRating;
        var cats = d.hoverCats ? d.hoverCats.split('|') : [];

        var hc = document.createElement('div');
        hc.className = 'hover-card-clone';

        // Build HTML from data attributes
        var html = '<div class="hover-thumb"><img src="' + escapeHtml(d.hoverThumb || '/images/no-poster.svg') +
            '" alt="' + escapeHtml(d.hoverName) + '" width="300" height="450" data-fallback="/images/no-poster.svg">' +
            '<div class="hover-overlay"></div></div>' +
            '<div class="hover-details"><h4 class="hover-title">' + escapeHtml(d.hoverName) + '</h4>' +
            '<div class="hover-actions">' +
            '<a href="' + href + '" class="hover-btn hover-btn-primary">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Xem ngay</a>' +
            '<button class="hover-btn hover-btn-icon fav-btn" title="Thích" data-slug="' + escapeHtml(d.hoverSlug) +
            '" data-name="' + escapeHtml(d.hoverName) + '" data-thumb="' + escapeHtml(d.hoverThumb) +
            '" data-origin="' + escapeHtml(d.hoverOrigin || '') + '" data-action="toggleFav">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>' +
            '<a href="' + href + '" class="hover-btn hover-btn-icon" title="Chi tiết">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></a>' +
            '</div><div class="hover-meta">';

        if (rating) {
            html += '<span class="hover-rating"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">' +
                '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ' +
                escapeHtml(rating) + '</span>';
        }
        html += '<span class="hover-tag">' + escapeHtml(d.hoverYear || '') + '</span>' +
            '<span class="hover-tag">' + escapeHtml(d.hoverEp || '') + '</span>' +
            '<span class="hover-tag">' + escapeHtml(d.hoverQuality || '') + '</span></div>';

        if (cats.length > 0) {
            html += '<div class="hover-cats">';
            cats.forEach(function(cat, i) {
                if (i > 0) html += '<span class="hover-cat-dot"></span>';
                html += '<span>' + escapeHtml(cat) + '</span>';
            });
            html += '</div>';
        }
        html += '</div>';
        hc.innerHTML = html;
        return hc;
    }

    function showHoverCard(card) {
        if (activeCard === card) return;
        hideHoverCard();

        activeCard = card;
        activeHc = buildHoverCard(card);
        if (!activeHc) { activeCard = null; return; }

        document.body.appendChild(activeHc);

        // Measure
        activeHc.style.cssText = 'position:fixed;z-index:9999;display:block;visibility:hidden;opacity:0;pointer-events:none;width:' + PW + 'px;';
        const hcH = activeHc.offsetHeight || 400;

        // Position centered on card
        const link = card.querySelector('.movie-card-link') || card;
        const r = link.getBoundingClientRect();
        let left = r.left + r.width / 2 - PW / 2;
        let top = r.top + r.height / 2 - hcH / 2;
        left = Math.max(M, Math.min(left, window.innerWidth - PW - M));
        top = Math.max(M, Math.min(top, window.innerHeight - hcH - M));

        activeHc.style.cssText = 'position:fixed;z-index:9999;width:' + PW + 'px;left:' + left + 'px;top:' + top + 'px;';
        // Trigger animation
        requestAnimationFrame(() => {
            if (activeHc) activeHc.classList.add('hover-card-visible');
        });
    }

    function hideHoverCard() {
        if (activeHc) {
            activeHc.remove();
            activeHc = null;
        }
        activeCard = null;
    }

    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.movie-card');
        const clone = e.target.closest('.hover-card-clone');
        if (clone) { clearTimeout(hideTimer); return; }
        if (card) {
            clearTimeout(hideTimer);
            if (activeCard === card) return;
            clearTimeout(showTimer);
            showTimer = setTimeout(() => showHoverCard(card), 400);
        } else {
            clearTimeout(showTimer);
            if (activeHc || activeCard) {
                if (!hideTimer) hideTimer = setTimeout(hideHoverCard, 100);
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.movie-card');
        const clone = e.target.closest('.hover-card-clone');
        if (card || clone) {
            const rel = e.relatedTarget;
            if (rel && typeof rel.closest === 'function') {
                if (rel.closest('.movie-card') === activeCard || rel.closest('.hover-card-clone')) {
                    return;
                }
            } else if (rel && rel.parentElement && typeof rel.parentElement.closest === 'function') {
                if (rel.parentElement.closest('.movie-card') === activeCard || rel.parentElement.closest('.hover-card-clone')) {
                    return;
                }
            }
            clearTimeout(showTimer);
            clearTimeout(hideTimer); 
            hideTimer = setTimeout(hideHoverCard, 100);
        }
    });

    window.addEventListener('scroll', () => { if (activeHc) hideHoverCard(); }, true);
})();

// ---- Navigation Progress Bar (lightweight, non-blocking) ----
// Uses a thin top bar instead of full-screen overlay for smooth UX
var navProgress = {
    bar: null,
    timer: null,
    delayTimer: null,
    active: false,
    init: function() {
        // Reuse page-loader element as progress bar container
        this.bar = document.getElementById('page-loader');
    },
    start: function() {
        if (this.active) return;
        this.active = true;
        var bar = this.bar;
        if (!bar) return;
        // Delay showing — fast navigations won't flash the bar
        this.delayTimer = setTimeout(function() {
            bar.classList.add('active');
        }, 120);
        // Safety timeout: auto-hide after 4s
        this.timer = setTimeout(function() {
            navProgress.done();
        }, 4000);
    },
    done: function() {
        clearTimeout(this.delayTimer);
        clearTimeout(this.timer);
        this.active = false;
        var bar = this.bar;
        if (!bar) return;
        bar.classList.add('done');
        setTimeout(function() {
            bar.classList.remove('active', 'done');
        }, 300);
    }
};
navProgress.init();

// Forcefully reset on bfcache restore
window.addEventListener('pagehide', function() {
    navProgress.done();
});
window.addEventListener('load', function() {
    navProgress.done();
});
window.addEventListener('pageshow', function() {
    navProgress.done();
});

// Show progress bar on internal navigation
document.addEventListener('click', function(e) {
    if (navProgress.active) return;
    var link = e.target.closest('a');
    if (!link || !link.href) return;
    var href = link.getAttribute('href');

    // Skip: javascript, #hash, target, data-action, modifier keys, external links
    if (!href ||
        href === '#' ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        link.getAttribute('target') ||
        link.getAttribute('data-action') ||
        e.ctrlKey || e.metaKey || e.shiftKey ||
        !link.href.startsWith(window.location.origin)
    ) return;

    // Skip if navigating to the same page
    if (link.href === window.location.href) return;
    navProgress.start();
});

// Mobile Nav Helper - ensure click outside closes it
document.addEventListener('click', (e) => {
    const navLinks = document.getElementById('navLinks');
    const mobileBtn = document.getElementById('mobileMenuBtn');

    if (navLinks && navLinks.classList.contains('mobile-open')) {
        if (!navLinks.contains(e.target) && (!mobileBtn || !mobileBtn.contains(e.target))) {
            closeMobileNav();
        }
    }
});

// ---- Netflix-style Horizontal Scroll Row ----
function scrollRow(btn, direction) {
    const row = btn.closest('.movie-row');
    const track = row?.querySelector('.movie-row-track');
    if (!track) return;
    const scrollAmount = track.clientWidth * 0.75;
    track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ---- Bottom Navigation Bar (Mobile) ----
(function initBottomNav() {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;

    // Detect active page
    const path = window.location.pathname;
    const items = {
        bnHome: path === '/',
        bnSearch: path.startsWith('/tim-kiem'),
        bnFav: path.startsWith('/yeu-thich'),
        bnProfile: path.startsWith('/ho-so') || path.startsWith('/dang-nhap')
    };

    Object.entries(items).forEach(([id, isActive]) => {
        const el = document.getElementById(id);
        if (el && isActive) el.classList.add('active');
    });
})();

// ---- Unified Scroll Handler (merged navbar + scrollTop + bottomNav + parallax) ----
// Single rAF-throttled handler instead of 4 separate handlers → no read/write thrashing
(function initUnifiedScrollHandler() {
    var _navbar = document.getElementById('navbar');
    var _scrollBtn = document.getElementById('scrollTopBtn');
    var _bottomNav = document.getElementById('bottomNav');
    var _heroSlider = document.getElementById('heroSlider');
    var _heroBgs = _heroSlider ? _heroSlider.querySelectorAll('.hero-bg') : [];
    
    var _lastY = window.scrollY;
    var _ticking = false;
    
    function onScroll() {
        var y = window.scrollY;
        
        // 1. Navbar: add/remove 'scrolled' class
        if (_navbar) _navbar.classList.toggle('scrolled', y > 50);
        
        // 2. Scroll-to-top button visibility
        if (_scrollBtn) _scrollBtn.classList.toggle('show', y > 300);
        
        // 3. Bottom nav: hide on scroll down, show on scroll up
        if (_bottomNav) {
            if (y > _lastY && y > 200) {
                _bottomNav.classList.add('hidden');
            } else {
                _bottomNav.classList.remove('hidden');
            }
        }
        
        // 4. Parallax hero (desktop only — mobile hero is shorter)
        if (_heroBgs.length && y < 700) {
            var t = 'scale(1.1) translateY(' + (y * 0.15) + 'px)';
            for (var i = 0; i < _heroBgs.length; i++) {
                _heroBgs[i].style.transform = t;
            }
        }
        
        _lastY = y;
        _ticking = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!_ticking) {
            requestAnimationFrame(onScroll);
            _ticking = true;
        }
    }, { passive: true });
})();

// ---- Scroll Animations: PowerPoint-style Reveal ----
(function initScrollAnimations() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    // Animate a list of elements with stagger
    function staggerIn(elements, { dx = 0, dy = 32, scaleFrom = 1, step = 60, duration = 560 } = {}) {
        Array.from(elements).forEach((el, i) => {
            const delay = i * step;
            el.style.opacity = '0';
            el.style.transform = `translateX(${dx}px) translateY(${dy}px) scale(${scaleFrom})`;
            el.style.transition = `opacity ${duration}ms ${easing} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms`;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'none';
            }));
        });
    }

    // Make an observer that fires once
    function makeObserver(callback, opts) {
        return new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px', ...opts });
    }

    // ── Section headers: slide in from left ──
    const headerObs = makeObserver(el => {
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in-view')));
    }, { threshold: 0.15 });

    document.querySelectorAll('.section-header').forEach(el => {
        // Skip elements already fully in viewport on load
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.85 && r.bottom > 0) {
            el.classList.add('sa-fade-right', 'in-view');
            return;
        }
        el.classList.add('sa-fade-right');
        headerObs.observe(el);
    });

    // ── Movie grids: cards stagger fade-up ──
    const gridObs = makeObserver(el => {
        staggerIn(el.children, { dy: 38, step: 65, duration: 580 });
    });
    document.querySelectorAll('.movie-grid').forEach(el => gridObs.observe(el));

    // ── Movie rows: cards stagger fade-up with slight scale ──
    const rowObs = makeObserver(el => {
        const track = el.querySelector('.movie-row-track');
        if (track) staggerIn(track.children, { dy: 28, scaleFrom: 0.94, step: 58, duration: 520 });
    });
    document.querySelectorAll('.movie-row').forEach(el => rowObs.observe(el));

    // ── Featured banner: zoom in ──
    const bannerObs = makeObserver(el => {
        el.classList.add('sa-zoom-in');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in-view')));
    }, { threshold: 0.1 });
    document.querySelectorAll('.featured-banner').forEach(el => bannerObs.observe(el));

    // ── Showcase (Top 10): zoom in ──
    const showcaseObs = makeObserver(el => {
        el.classList.add('sa-zoom-in');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in-view')));
    }, { threshold: 0.05 });
    document.querySelectorAll('.showcase').forEach(el => showcaseObs.observe(el));

    // ── Category chips: stagger slide from left ──
    const chipsObs = makeObserver(el => {
        staggerIn(el.querySelectorAll('.category-chip'), { dx: -18, dy: 0, step: 38, duration: 400 });
    }, { threshold: 0.15 });
    document.querySelectorAll('.category-chips-section').forEach(el => chipsObs.observe(el));

    // ── Continue-watching cards: stagger scale + fade ──
    const cwObs = makeObserver(el => {
        staggerIn(el.children, { dy: 28, scaleFrom: 0.92, step: 70, duration: 540 });
    });
    document.querySelectorAll('.continue-watching-strip').forEach(el => cwObs.observe(el));

    // ── Category browse cards ──
    const browseObs = makeObserver(el => {
        staggerIn(el.querySelectorAll('.category-browse-card'), { dy: 24, scaleFrom: 0.9, step: 50, duration: 480 });
    }, { threshold: 0.1 });
    document.querySelectorAll('.category-browse-grid').forEach(el => browseObs.observe(el));
})();

(function () {
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.pw-toggle');
        if (!btn) return;
        var wrap = btn.closest('.password-wrap');
        var input = wrap.querySelector('input');
        var show = wrap.querySelector('.pw-icon-show');
        var hide = wrap.querySelector('.pw-icon-hide');
        if (input.type === 'password') {
            input.type = 'text';
            show.style.display = 'none';
            hide.style.display = '';
        } else {
            input.type = 'password';
            show.style.display = '';
            hide.style.display = 'none';
        }
    });
})();

// ============ NOTIFICATION SYSTEM ============
(function initNotificationSystem() {
    // Chỉ chạy nếu user đã login (có bell icon)
    var bellBtn = document.getElementById('notifBell');
    if (!bellBtn) return;

    var badge = document.getElementById('notifBadge');
    var panel = document.getElementById('notifPanel');
    var notifList = document.getElementById('notifList');
    var markAllBtn = document.getElementById('notifMarkAll');
    var csrfToken = function () { return document.querySelector('meta[name="csrf-token"]')?.content || ''; };

    // Toggle panel
    bellBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = panel.classList.toggle('show');
        if (isOpen) {
            loadNotifications();
            // Kiểm tra tập mới khi user thực sự mở panel — không tự động mỗi page load
            checkNewEpisodes();
        }
    });

    // Close panel khi click ngoài
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.notif-wrapper')) {
            panel.classList.remove('show');
        }
    });

    // Mark all read
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async function () {
            try {
                await fetch('/api/notifications/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() }
                });
                updateBadge(0);
                document.querySelectorAll('.notif-item.unread').forEach(function (el) {
                    el.classList.remove('unread');
                });
            } catch (e) { /* ignore */ }
        });
    }

    // Load notifications vào panel
    async function loadNotifications() {
        try {
            var res = await fetch('/api/notifications');
            if (!res.ok) return;
            var notifications = await res.json();
            renderNotifications(notifications);
        } catch (e) { /* ignore */ }
    }

    function epSlugFromEpisode(ep) {
        if (!ep) return null;
        var s = ep.toLowerCase().trim();
        if (s === 'full' || s === 'complete') return 'full';
        var m = s.match(/(\d+)/);
        return m ? m[1] : null;
    }

    function renderNotifications(notifications) {
        if (!notifList) return;
        if (!notifications.length) {
            notifList.innerHTML = '<div class="notif-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>Chưa có thông báo nào</p></div>';
            return;
        }
        notifList.innerHTML = '';
        notifications.forEach(function (n) {
            var timeAgo = getTimeAgo(new Date(n.created_at));
            var item = document.createElement('a');
            var epSlug = epSlugFromEpisode(n.latest_episode) || epSlugFromEpisode(n.new_episode) || 'tap-1';
            item.href = '/xem/' + n.movie_slug + '/' + epSlug;
            item.className = 'notif-item' + (n.is_read ? '' : ' unread');
            item.setAttribute('data-id', n._id || n.id);
            var thumbImg = document.createElement('img');
            thumbImg.className = 'notif-thumb';
            thumbImg.alt = '';
            thumbImg.src = n.movie_thumb || '/images/no-poster.svg';
            thumbImg.onerror = function() { this.src = '/images/no-poster.svg'; };
            item.appendChild(thumbImg);
            var contentDiv = document.createElement('div');
            contentDiv.className = 'notif-content';
            var titleDiv = document.createElement('div');
            titleDiv.className = 'notif-title';
            titleDiv.textContent = n.movie_name || n.movie_slug;
            var descDiv = document.createElement('div');
            descDiv.className = 'notif-desc';
            descDiv.textContent = 'Cập nhật: ' + (n.new_episode || '');
            var timeDiv = document.createElement('div');
            timeDiv.className = 'notif-time';
            timeDiv.textContent = timeAgo;
            contentDiv.appendChild(titleDiv);
            contentDiv.appendChild(descDiv);
            contentDiv.appendChild(timeDiv);
            item.appendChild(contentDiv);
            if (!n.is_read) {
                var dot = document.createElement('span');
                dot.className = 'notif-dot';
                item.appendChild(dot);
            }
            // Mark read khi click
            item.addEventListener('click', function () {
                if (!n.is_read) {
                    fetch('/api/notifications/read/' + (n._id || n.id), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() }
                    }).catch(function () { });
                }
            });
            notifList.appendChild(item);
        });
    }

    function getTimeAgo(date) {
        var seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'Vừa xong';
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + ' phút trước';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + ' giờ trước';
        var days = Math.floor(hours / 24);
        if (days < 7) return days + ' ngày trước';
        return date.toLocaleDateString('vi-VN');
    }

    function updateBadge(count) {
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }

    // Browser Notification
    function showBrowserNotif(episodes) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        episodes.forEach(function (ep) {
            try {
                var notif = new Notification('🎬 ' + (ep.movie_name || 'Phim mới'), {
                    body: 'Đã cập nhật: ' + (ep.new_episode || ''),
                    icon: ep.movie_thumb || '/images/no-poster.svg',
                    tag: 'moviecc-' + ep.movie_slug
                });
                notif.onclick = function () {
                    window.focus();
                    var epSlug = epSlugFromEpisode(ep.latest_episode) || epSlugFromEpisode(ep.new_episode) || 'tap-1';
                    window.location.href = '/xem/' + ep.movie_slug + '/' + epSlug;
                };
            } catch (e) { /* ignore */ }
        });
    }

    // Check new episodes — chỉ gọi khi user mở panel, throttle 10 phút
    async function checkNewEpisodes() {
        var lastCheck = localStorage.getItem('moviecc_notif_check');
        var now = Date.now();
        // Throttle 10 phút (tăng từ 5 phút)
        if (lastCheck && now - parseInt(lastCheck) < 600000) {
            return;
        }
        try {
            var res = await fetch('/api/notifications/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() }
            });
            if (res.ok) {
                var data = await res.json();
                updateBadge(data.count);
                localStorage.setItem('moviecc_notif_check', String(now));
                // Browser notification cho tập mới
                if (data.newEpisodes && data.newEpisodes.length > 0) {
                    showBrowserNotif(data.newEpisodes);
                }
            }
        } catch (e) { /* ignore */ }
    }

    // Init: chỉ fetch badge count nhẹ khi page load (1 query DB, không fan-out)
    async function fetchBadgeCount() {
        try {
            var countRes = await fetch('/api/notifications/count');
            if (countRes.ok) {
                var data = await countRes.json();
                updateBadge(data.count);
            }
        } catch (e) { }
    }
    setTimeout(fetchBadgeCount, 2000);
})();

// ---- Grid Ghost Cards: lấp đầy hàng cuối để grid không thừa ô trống ----
(function () {
    var GRID_SEL = '.movie-grid-large, .movie-grid, .tmdb-movie-grid, .actor-grid';
    var CARD_SEL = '.movie-card, .tmdb-movie-card, .actor-card';

    function fillLastRow(grid) {
        grid.querySelectorAll('.ghost-card').forEach(function (g) { g.remove(); });
        var cards = Array.from(grid.querySelectorAll(CARD_SEL + ':not(.ghost-card)'));
        if (cards.length === 0) return;
        var firstCard = cards[0];

        /* Đọc số cột thực tế từ computed style — chính xác hơn tính toán thủ công */
        var tpl = getComputedStyle(grid).gridTemplateColumns || '';
        var cols = tpl.trim() ? tpl.trim().split(/\s+/).length : 1;
        if (cols <= 1) return;

        var rem = cards.length % cols;
        if (rem === 0) return;
        var needed = cols - rem;
        var frag = document.createDocumentFragment();
        for (var i = 0; i < needed; i++) {
            var ghost = document.createElement('div');
            ghost.className = firstCard.classList.contains('tmdb-movie-card')
                ? 'tmdb-movie-card ghost-card'
                : firstCard.classList.contains('actor-card')
                ? 'actor-card ghost-card'
                : 'movie-card ghost-card';
            frag.appendChild(ghost);
        }
        grid.appendChild(frag);
    }

    function fillAll() {
        document.querySelectorAll(GRID_SEL).forEach(fillLastRow);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fillAll);
    } else {
        fillAll();
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fillAll, 150);
    });
})();
