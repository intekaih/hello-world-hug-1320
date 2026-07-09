/**
 * Hero Slider - Xử lý banner hero với:
 * - Preload tất cả hero images
 * - Lazy load background images
 * - Smooth transitions
 * - Auto-play với progress bar
 * - Parallax effect
 */

(function() {
  'use strict';

  const SLIDE_DURATION = 6000; // 6 seconds per slide
  let currentSlide = 0;
  let slideInterval = null;
  let isPaused = false;

  /**
   * Lấy URL ảnh hero ưu tiên: backdrop_url > poster_url > thumb_url
   */
  function getHeroImageUrl(movie) {
    return movie.backdrop_url || movie.poster_url || movie.thumb_url || '';
  }

  /**
   * Preload tất cả hero images
   */
  function preloadHeroImages(slides) {
    slides.forEach((slide, index) => {
      const movie = slide.dataset.movie ? JSON.parse(slide.dataset.movie) : null;
      if (!movie) return;
      
      const url = getHeroImageUrl(movie);
      if (!url) return;

      // Slide đầu tiên: preload ngay lập tức
      if (index === 0) {
        const img = new Image();
        img.src = url;
        img.fetchPriority = 'high';
      } else {
        // Các slide khác: lazy preload sau khi trang load xong
        setTimeout(() => {
          const img = new Image();
          img.src = url;
        }, 100 + index * 200);
      }
    });
  }

  /**
   * Chuyển đến slide index cụ thể
   */
  function goToSlide(index, slides) {
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    // Remove active from all slides
    slides.forEach((slide, i) => {
      slide.classList.remove('active');
      slide.style.opacity = '0';
      slide.style.visibility = 'hidden';
    });

    // Set current slide
    currentSlide = ((index % totalSlides) + totalSlides) % totalSlides;
    const activeSlide = slides[currentSlide];
    activeSlide.classList.add('active');
    activeSlide.style.opacity = '1';
    activeSlide.style.visibility = 'visible';

    // Load background image nếu chưa load
    const heroBg = activeSlide.querySelector('.hero-bg');
    if (heroBg && heroBg.dataset.bg && !heroBg.style.backgroundImage) {
      heroBg.style.backgroundImage = "url('" + heroBg.dataset.bg + "')";
    }

    // Update progress bar
    const progressBar = document.getElementById('heroProgressBar');
    if (progressBar) {
      progressBar.style.animation = 'none';
      progressBar.offsetHeight; // trigger reflow
      progressBar.style.animation = `heroProgress ${SLIDE_DURATION}ms linear forwards`;
    }

    // Update dots
    const dots = document.querySelectorAll('.hero-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });

    // Update thumbnails
    const thumbs = document.querySelectorAll('.hero-thumb');
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === currentSlide);
      // Reset progress animation
      const prog = thumb.querySelector('.hero-thumb-progress');
      if (prog) {
        prog.style.animation = 'none';
        prog.offsetHeight;
        if (i === currentSlide) {
          prog.style.animation = `thumbProgress ${SLIDE_DURATION}ms linear forwards`;
        }
      }
    });

    // Update play button link
    const playBtn = document.getElementById('heroPlayBtn');
    const movie = activeSlide.dataset.movie ? JSON.parse(activeSlide.dataset.movie) : null;
    if (playBtn && movie) {
      const epSlug = movie.epSlug || (movie.episode_current ? movie.episode_current.replace(/\D/g, '').substring(0, 2) || '1' : '1');
      playBtn.href = `/xem-phim/${movie.slug}/tap-${epSlug}`;
    }
  }

  /**
   * Chuyển đến slide tiếp theo
   */
  function nextSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    goToSlide(currentSlide + 1, slides);
  }

  /**
   * Bắt đầu auto-play
   */
  function startAutoPlay() {
    if (slideInterval) clearInterval(slideInterval);
    if (!isPaused) {
      slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }
  }

  /**
   * Dừng auto-play
   */
  function stopAutoPlay() {
    if (slideInterval) {
      clearInterval(slideInterval);
      slideInterval = null;
    }
  }

  /**
   * Parallax effect cho hero background
   */
  function initParallax() {
    const heroBgs = document.querySelectorAll('.hero-slide.active .hero-bg');
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          if (scrollY < 600) {
            heroBgs.forEach(bg => {
              bg.style.transform = `scale(1.1) translateY(${scrollY * 0.15}px)`;
            });
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Khởi tạo hero slider
   */
  function initHeroSlider() {
    const heroSlider = document.getElementById('heroSlider');
    if (!heroSlider) return;

    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;

    // Preload images
    preloadHeroImages(slides);

    // Initialize first slide background
    const firstBg = slides[0].querySelector('.hero-bg');
    if (firstBg && firstBg.dataset.bg) {
      firstBg.style.backgroundImage = "url('" + firstBg.dataset.bg + "')";
    }

    // Add event listeners for dots
    const dots = document.querySelectorAll('.hero-dot');
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        goToSlide(index, slides);
        stopAutoPlay();
        startAutoPlay(); // Restart timer
      });
    });

    // Add event listeners for thumbnails
    const thumbs = document.querySelectorAll('.hero-thumb');
    thumbs.forEach((thumb, index) => {
      thumb.addEventListener('click', () => {
        goToSlide(index, slides);
        stopAutoPlay();
        startAutoPlay();
      });
    });

    // Pause on hover
    heroSlider.addEventListener('mouseenter', () => {
      isPaused = true;
      stopAutoPlay();
    });

    heroSlider.addEventListener('mouseleave', () => {
      isPaused = false;
      startAutoPlay();
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    heroSlider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    heroSlider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide(); // Swipe left = next
        } else {
          goToSlide(currentSlide - 1, slides); // Swipe right = prev
        }
        stopAutoPlay();
        startAutoPlay();
      }
    }, { passive: true });

    // Start auto-play
    startAutoPlay();

    // Init parallax
    initParallax();

    // Update play button for first slide
    const playBtn = document.getElementById('heroPlayBtn');
    const firstMovie = slides[0].dataset.movie ? JSON.parse(slides[0].dataset.movie) : null;
    if (playBtn && firstMovie) {
      const epSlug = firstMovie.epSlug || (firstMovie.episode_current ? firstMovie.episode_current.replace(/\D/g, '').substring(0, 2) || '1' : '1');
      playBtn.href = `/xem-phim/${firstMovie.slug}/tap-${epSlug}`;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSlider);
  } else {
    initHeroSlider();
  }

  // Expose for manual initialization if needed
  window.MovieCCHero = {
    goToSlide: (index) => {
      const slides = document.querySelectorAll('.hero-slide');
      goToSlide(index, slides);
    },
    next: nextSlide,
    pause: () => { isPaused = true; stopAutoPlay(); },
    resume: () => { isPaused = false; startAutoPlay(); }
  };
})();
