/* movieCC - Video Player JavaScript */

// getCsrfToken fallback — đề phòng app.js chưa load kịp
if (typeof getCsrfToken === 'undefined') {
    window.getCsrfToken = function() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    };
}

// Lưu tiến trình xem phim cho embed player (không biết currentTime thực)
function startProgressSave(movieSlug, episodeSlug, movieName, movieThumb, movieOriginName) {
    var iframe = document.getElementById('embedPlayer');
    if (!iframe) return;

    // Lưu ngay khi bắt đầu xem
    saveProgress(movieSlug, episodeSlug, 0, 0, movieName, movieThumb, movieOriginName);

    var elapsed = 0;
    var interval = setInterval(function() {
        elapsed += 30;
        saveProgress(movieSlug, episodeSlug, elapsed, 0, movieName, movieThumb, movieOriginName);
    }, 30000);

    // Lưu lần cuối khi thoát trang
    function saveOnExit() {
        if (elapsed > 0) {
            saveProgress(movieSlug, episodeSlug, elapsed, 0, movieName, movieThumb, movieOriginName);
        }
        clearInterval(interval);
    }

    window.addEventListener('beforeunload', saveOnExit);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            saveProgress(movieSlug, episodeSlug, elapsed, 0, movieName, movieThumb, movieOriginName);
        }
    });
}

function saveProgress(movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName) {
    var token = (typeof getCsrfToken === 'function') ? getCsrfToken() : '';
    fetch('/api/watch/progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token
        },
        body: JSON.stringify({
            movieSlug: movieSlug, episodeSlug: episodeSlug,
            currentTime: currentTime, duration: duration,
            movieName: movieName, movieThumb: movieThumb, movieOriginName: movieOriginName
        })
    }).catch(function() {});
}
