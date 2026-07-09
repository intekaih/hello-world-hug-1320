(function () {
    'use strict';

    function sanitizeUrl(url) {
        if (!url) return '';
        try {
            var u = new URL(url, window.location.origin);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
            return u.href;
        } catch (e) { return ''; }
    }
    function escAttr(s) {
        return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    var wd = document.getElementById('watchData');
    if (!wd) return;

    var serverDataEl = document.getElementById('serverData');
    var serverEmbeds = JSON.parse(serverDataEl.getAttribute('data-embeds') || '{}');
    var serverStreams = JSON.parse(serverDataEl.getAttribute('data-streams') || '{}');
    var serverEmbedFallbacks = JSON.parse(serverDataEl.getAttribute('data-embed-fallbacks') || '{}');
    var currentStreamHash = wd.dataset.streamHash || '';
    var currentEmbedUrl = wd.dataset.embedUrl || '';
    var currentEmbedFallback = wd.dataset.embedFallback || '';

    var nextEpUrl = wd.dataset.next || '';
    var prevEpUrl = wd.dataset.prev || '';

    // Start progress saving
    if (typeof startProgressSave === 'function') {
        startProgressSave(wd.dataset.slug, wd.dataset.episode, wd.dataset.name, wd.dataset.thumb, wd.dataset.origin);
    }

    // --- Custom Player Logic ---
    var video = document.getElementById('hlsVideo');
    var customPlayer = document.getElementById('customPlayer');
    var hlsInstance = null;
    var _cpAbort = null; // AbortController cho document/window listeners
    var _cpSaveInterval = null; // interval save progress
    var _embedSaveInterval = null; // interval save progress cho embed
    var _embedElapsed = 0; // elapsed time cho embed autosave
    var _embedAbort = null; // AbortController cho embed listeners

    if (video && customPlayer && currentStreamHash) {
        initCustomPlayer();
    }

    function initCustomPlayer() {
        // Cleanup listeners cũ nếu được gọi lại (switchServer)
        if (_cpAbort) _cpAbort.abort();
        if (_cpSaveInterval) clearInterval(_cpSaveInterval);
        _cpAbort = new AbortController();
        var signal = _cpAbort.signal;

        var cpLoading = document.getElementById('cpLoading');
        var cpBigPlay = document.getElementById('cpBigPlay');
        var cpControls = document.getElementById('cpControls');
        var cpPlayBtn = document.getElementById('cpPlayBtn');
        var cpRewBtn = document.getElementById('cpRewBtn');
        var cpFwdBtn = document.getElementById('cpFwdBtn');
        var cpMuteBtn = document.getElementById('cpMuteBtn');
        var cpVolSlider = document.getElementById('cpVolSlider');
        var cpTime = document.getElementById('cpTime');
        var cpFullBtn = document.getElementById('cpFullBtn');
        var cpPipBtn = document.getElementById('cpPipBtn');
        var cpSettingsBtn = document.getElementById('cpSettingsBtn');
        var cpSettingsPanel = document.getElementById('cpSettingsPanel');
        var cpSpeedOptions = document.getElementById('cpSpeedOptions');
        var cpProgressWrap = document.getElementById('cpProgressWrap');
        var cpPlayed = document.getElementById('cpPlayed');
        var cpBuffered = document.getElementById('cpBuffered');
        var cpTooltip = document.getElementById('cpTooltip');

        var hideTimer = null;
        var isSeeking = false;
        var seekTime = parseInt(localStorage.getItem('cp_seek_time')) || 10;
        var cpSeekOptions = document.getElementById('cpSeekOptions');
        var cpSkipIntroBtn = document.getElementById('cpSkipIntroBtn');

        var skipForwardTime = parseInt(localStorage.getItem('cp_skip_forward')) || 90;

        // --- Restore player preferences ---
        var savedSpeed = parseFloat(localStorage.getItem('cp_speed')) || 1;
        var savedVolume = parseFloat(localStorage.getItem('cp_volume'));
        var savedMuted = localStorage.getItem('cp_muted') === 'true';
        if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
            video.volume = savedVolume;
        }
        video.muted = savedMuted;
        video.playbackRate = savedSpeed;

        // Gọi progress ngay song song với load stream để khi metadata xong đã có sẵn → seek nhanh hơn
        var slug = wd.dataset.slug;
        var episode = wd.dataset.episode;
        var progressPromise = (slug && episode)
            ? fetch('/api/watch/progress/' + encodeURIComponent(slug) + '/' + encodeURIComponent(episode), { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .catch(function () { return null; })
            : Promise.resolve(null);

        loadStream(currentStreamHash);

        // Đọc ?t= param từ URL (resume từ detail page)
        var urlResumeTime = 0;
        try {
            var urlParams = new URLSearchParams(window.location.search);
            urlResumeTime = parseInt(urlParams.get('t')) || 0;
        } catch (e) { }

        // Phát tiếp từ vị trí đã lưu (resume) — dùng kết quả đã gọi song song ở trên
        function applyProgressAndSeek(data) {
            // Ưu tiên ?t= param (từ detail page resume CTA)
            if (urlResumeTime > 0) {
                video.currentTime = urlResumeTime;
                urlResumeTime = 0; // chỉ dùng 1 lần
                return;
            }
            if (!data || !data.progress || !data.progress.current_time) return;
            var cur = data.progress.current_time;
            var dur = video.duration || 0;
            if (dur > 0 && cur > 0 && cur < dur - 15) {
                showResumeDialog(cur);
            }
        }

        function showResumeDialog(savedTime) {
            var dialog = document.createElement('div');
            dialog.className = 'resume-dialog';
            dialog.id = 'cpResumeDialog';
            dialog.innerHTML = '<div class="resume-dialog-box">' +
                '<h3>Ti\u1ebfp t\u1ee5c xem?</h3>' +
                '<div class="resume-time-display">' + formatTime(savedTime) + '</div>' +
                '<p>B\u1ea1n \u0111\u00e3 xem \u0111\u1ebfn v\u1ecb tr\u00ed n\u00e0y tr\u01b0\u1edbc \u0111\u00f3</p>' +
                '<div class="resume-dialog-actions">' +
                '<button class="resume-btn resume-btn-secondary" id="cpResumeNo">Xem t\u1eeb \u0111\u1ea7u</button>' +
                '<button class="resume-btn resume-btn-primary" id="cpResumeYes">Ti\u1ebfp t\u1ee5c t\u1eeb ' + formatTime(savedTime) + '</button>' +
                '</div>' +
                '</div>';
            document.body.appendChild(dialog);

            document.getElementById('cpResumeYes').addEventListener('click', function () {
                video.currentTime = savedTime;
                video.play().catch(function () { });
                dialog.remove();
            });

            document.getElementById('cpResumeNo').addEventListener('click', function () {
                video.currentTime = 0;
                video.play().catch(function () { });
                dialog.remove();
            });

            dialog.addEventListener('click', function (e) {
                if (e.target === dialog) {
                    video.currentTime = savedTime;
                    video.play().catch(function () { });
                    dialog.remove();
                }
            });
        }

        var resumeListener = function () {
            video.removeEventListener('loadedmetadata', resumeListener);
            progressPromise.then(applyProgressAndSeek);
        };
        video.addEventListener('loadedmetadata', resumeListener);

        // Flag: HLS manifest đã parse xong chưa (tránh gọi play() quá sớm)
        var hlsManifestReady = false;
        var pendingPlay = false;

        function loadStream(hash) {
            hlsManifestReady = false;
            pendingPlay = false;
            cpLoading.classList.remove('hidden');

            if (hash.startsWith('/') || hash.startsWith('http')) {
                console.log('[Player] Stream is direct URL, skipping /api/stream fetch');
                setupHLS(hash);
                return;
            }

            fetch('/api/stream/' + hash, { credentials: 'same-origin' })
                .then(function (r) {
                    console.log('[Player] /api/stream status:', r.status);
                    if (!r.ok) throw new Error('stream_api_failed');
                    return r.json();
                })
                .then(function (data) {
                    if (!data || !data.url) {
                        console.warn('[Player] No stream URL → embed');
                        fallbackToEmbed(); return;
                    }
                    // Giao thẳng cho HLS.js — nó tự detect lỗi manifest/network
                    // và có 15s timeout + fallback-to-embed logic sẵn
                    console.log('[Player] Got stream URL, loading HLS...');
                    setupHLS(data.url);
                })
                .catch(function (err) {
                    console.error('[Player] loadStream error:', err);
                    fallbackToEmbed();
                });
        }

        function setupHLS(url) {
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }
            hlsManifestReady = false;
            pendingPlay = false;

            console.log('[Player] setupHLS url:', url);

            // Luôn ưu tiên HLS.js (xử lý proxy URL đúng), chỉ dùng native HLS cho Safari
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                hlsInstance = new Hls({
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    startLevel: -1,
                    enableWorker: true,
                    lowLatencyMode: false,
                    manifestLoadingMaxRetry: 1,
                    manifestLoadingRetryDelay: 500,
                    levelLoadingMaxRetry: 1,
                    levelLoadingRetryDelay: 500,
                });
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(video);

                var manifestTimeout = setTimeout(function () {
                    if (hlsInstance) {
                        console.warn('[Player] Manifest timeout → embed');
                        hlsInstance.destroy(); hlsInstance = null;
                        fallbackToEmbed();
                    }
                }, 8000);

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
                    clearTimeout(manifestTimeout);
                    hlsManifestReady = true;
                    cpLoading.classList.add('hidden');
                    cpBigPlay.classList.add('hidden');
                    console.log('[Player] MANIFEST_PARSED ✓ levels:', hlsInstance.levels.length);
                    // Đợi 1 tick cho MediaSource setup xong rồi mới play
                    setTimeout(function () {
                        video.play().catch(function (e) {
                            console.warn('[Player] Autoplay blocked:', e.message);
                            cpBigPlay.classList.remove('hidden');
                        });
                    }, 100);
                    // Nếu user đã click play trong khi đang load
                    if (pendingPlay) {
                        pendingPlay = false;
                        setTimeout(function () { video.play().catch(function () { }); }, 200);
                    }
                });


                hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.error('[Player] HLS FATAL:', data.type, '|', data.details, '| HTTP:', data.response && data.response.code, '| URL:', data.url || (data.frag && data.frag.url) || 'N/A');
                        clearTimeout(manifestTimeout);
                        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                                data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                hlsInstance.destroy(); hlsInstance = null;
                                fallbackToEmbed();
                            } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
                                data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
                                // Segment/level load failed — retry once then fallback
                                console.warn('[Player] Network error on segment/level, retrying...');
                                hlsInstance.startLoad();
                                setTimeout(function () {
                                    if (hlsInstance && video.readyState < 2 && !hlsManifestReady) {
                                        console.warn('[Player] Still no media after retry → embed');
                                        hlsInstance.destroy(); hlsInstance = null;
                                        fallbackToEmbed();
                                    }
                                }, 5000);
                            } else {
                                hlsInstance.startLoad();
                            }
                        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            console.warn('[Player] Media error, attempting recovery...');
                            hlsInstance.recoverMediaError();
                        } else {
                            hlsInstance.destroy(); hlsInstance = null;
                            fallbackToEmbed();
                        }
                    } else {
                        console.warn('[Player] HLS warn:', data.details, data.url || '');
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS fallback (Safari / iOS)
                video.src = url;
                hlsManifestReady = true;
                video.addEventListener('loadedmetadata', function () {
                    cpLoading.classList.add('hidden');
                });
            } else {
                fallbackToEmbed();
            }
        }

        function fallbackToEmbed() {
            // Ưu tiên: embed trực tiếp → embed fallback (NguonC m3u8 chết) → hiện lỗi
            var url = currentEmbedUrl || currentEmbedFallback;
            if (!url) {
                var wrapper = document.getElementById('playerWrapper');
                wrapper.innerHTML = '<div class="cp-no-video" style="padding:40px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">' +
                    '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                    '<h3 style="margin-top:16px;font-size:1.2rem;color:#e74c3c">Lỗi phát Video</h3>' +
                    '<p style="margin-top:8px;color:var(--text-secondary);font-size:0.95rem;line-height:1.5">Video không khả dụng hoặc Server đang gặp sự cố.<br>Vui lòng <b>Tải lại trang</b> hoặc <b>Chuyển Server khác</b> ở danh sách bên dưới.</p>' +
                    '<button data-action="reloadPage" style="margin-top:20px;padding:10px 24px;background:var(--primary);color:#0a0a12;border-radius:6px;border:none;cursor:pointer;font-weight:600;font-size:1rem;display:flex;align-items:center;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Thử Lại Ngay</button>' +
                    '</div>';
                return;
            }
            var wrapper = document.getElementById('playerWrapper');
            wrapper.innerHTML = '<iframe id="embedPlayer" src="' + escAttr(sanitizeUrl(url)) + '" allowfullscreen style="width:100%;height:100%;border:none;background:#000"></iframe>';
        }

        // --- Play / Pause ---
        function togglePlay() {
            if (video.paused) {
                if (!hlsManifestReady && hlsInstance) {
                    // HLS đang load, đặt flag play khi manifest ready
                    pendingPlay = true;
                    return;
                }
                video.play().catch(function (e) {
                    console.warn('[Player] togglePlay failed:', e.message);
                });
            } else {
                video.pause();
            }
        }

        cpBigPlay.addEventListener('click', function () {
            if (hlsManifestReady) {
                video.play().catch(function (e) {
                    console.warn('[Player] Play failed:', e.message);
                });
            } else if (hlsInstance) {
                // HLS đang load, đặt flag để play ngay khi manifest ready
                pendingPlay = true;
            } else if (video.src && !video.src.startsWith('blob:')) {
                // Native HLS (Safari)
                video.play().catch(function () { });
            }
        });

        cpPlayBtn.addEventListener('click', togglePlay);

        video.addEventListener('click', function (e) {
            if (e.target === video) {
                if (hlsManifestReady || (!hlsInstance && video.readyState >= 2)) togglePlay();
            }
        });

        video.addEventListener('play', function () {
            cpBigPlay.classList.add('hidden');
            showPauseIcon();
            resetHideTimer();
        });

        video.addEventListener('pause', function () {
            showPlayIcon();
            customPlayer.classList.remove('cp-hide-controls');
            lastTouchShowTime = Date.now();
            clearTimeout(hideTimer);
        });

        function showPlayIcon() {
            cpPlayBtn.querySelector('.cp-icon-play').style.display = '';
            cpPlayBtn.querySelector('.cp-icon-pause').style.display = 'none';
        }

        function showPauseIcon() {
            cpPlayBtn.querySelector('.cp-icon-play').style.display = 'none';
            cpPlayBtn.querySelector('.cp-icon-pause').style.display = '';
        }

        // --- Controls visibility ---
        var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        var lastTouchShowTime = 0;

        function getHideDelay() {
            var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (isFs && isTouchDevice) return 4000;
            if (isFs) return 4000;
            return 3500;
        }

        function resetHideTimer() {
            if (customPlayer.classList.contains('cp-hide-controls')) {
                lastTouchShowTime = Date.now();
            }
            customPlayer.classList.remove('cp-hide-controls');
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(function () {
                    if (!cpSettingsPanel.classList.contains('visible') && !isSeeking) {
                        customPlayer.classList.add('cp-hide-controls');
                    }
                }, getHideDelay());
            }
        }

        customPlayer.addEventListener('mousemove', resetHideTimer);
        customPlayer.addEventListener('touchstart', function (e) {
            if (e.target.closest('#cpControls') || e.target.closest('#cpSettingsPanel') || e.target.closest('#cpTitleOverlay') || e.target.closest('#cpBigPlay')) {
                resetHideTimer();
                return;
            }
            if (customPlayer.classList.contains('cp-hide-controls')) {
                // Controls are hidden → show them
                resetHideTimer();
            } else if (!video.paused) {
                // Controls are visible → only hide if shown for >0.5s to prevent ghost taps
                if (Date.now() - lastTouchShowTime > 500) {
                    customPlayer.classList.add('cp-hide-controls');
                } else {
                    resetHideTimer();
                }
            }
        }, { passive: true });

        // --- Seek ---
        function updateSeekBtnLabels() {
            var rewSvg = cpRewBtn.querySelector('text');
            var fwdSvg = cpFwdBtn.querySelector('text');
            if (rewSvg) rewSvg.textContent = seekTime;
            if (fwdSvg) fwdSvg.textContent = seekTime;
            cpRewBtn.title = 'Tua lại ' + seekTime + 's';
            cpFwdBtn.title = 'Tua tới ' + seekTime + 's';
        }
        updateSeekBtnLabels();

        cpRewBtn.addEventListener('click', function () {
            video.currentTime = Math.max(0, video.currentTime - seekTime);
            showSeekIndicator('left', '-' + seekTime + 's');
        });

        cpFwdBtn.addEventListener('click', function () {
            video.currentTime = Math.min(video.duration || 0, video.currentTime + seekTime);
            showSeekIndicator('right', '+' + seekTime + 's');
        });

        function showSeekIndicator(side, text) {
            var el = document.createElement('div');
            el.className = 'cp-seek-indicator ' + side;
            el.textContent = text;
            customPlayer.appendChild(el);
            setTimeout(function () { el.remove(); }, 700);
        }

        // --- Skip forward button (>>) ---
        function doSkipForward() {
            var dur = video.duration || 0;
            var target = video.currentTime + skipForwardTime;
            if (dur > 0) target = Math.min(target, dur);
            video.currentTime = target;
            showSeekIndicator('right', '+' + skipForwardTime + 's');
        }

        if (cpSkipIntroBtn) {
            cpSkipIntroBtn.addEventListener('click', doSkipForward);
        }

        function updateSkipBtnTitle() {
            if (cpSkipIntroBtn) {
                cpSkipIntroBtn.title = 'Tua tới ' + skipForwardTime + 's (I)';
            }
        }
        updateSkipBtnTitle();

        // --- Volume ---
        cpMuteBtn.addEventListener('click', function () {
            video.muted = !video.muted;
            localStorage.setItem('cp_muted', video.muted);
            updateVolumeUI();
        });

        cpVolSlider.addEventListener('input', function () {
            video.volume = parseFloat(this.value);
            video.muted = false;
            localStorage.setItem('cp_volume', video.volume);
            localStorage.setItem('cp_muted', 'false');
            updateVolumeUI();
        });

        video.addEventListener('volumechange', updateVolumeUI);

        function updateVolumeUI() {
            var muted = video.muted || video.volume === 0;
            cpMuteBtn.querySelector('.cp-icon-vol').style.display = muted ? 'none' : '';
            cpMuteBtn.querySelector('.cp-icon-mute').style.display = muted ? '' : 'none';
            cpVolSlider.value = video.muted ? 0 : video.volume;
            var pct = (video.muted ? 0 : video.volume) * 100;
            cpVolSlider.style.background = 'linear-gradient(to right, var(--primary, #f4abb4) ' + pct + '%, rgba(255,255,255,0.3) ' + pct + '%)';
        }

        updateVolumeUI();

        // --- Time display ---
        video.addEventListener('timeupdate', function () {
            if (isSeeking) return;
            var cur = video.currentTime || 0;
            var dur = video.duration || 0;
            cpTime.textContent = formatTime(cur) + ' / ' + formatTime(dur);
            if (dur > 0) {
                cpPlayed.style.width = (cur / dur * 100) + '%';
            }
        });

        video.addEventListener('waiting', function () {
            cpLoading.classList.remove('hidden');
        });

        video.addEventListener('canplay', function () {
            cpLoading.classList.add('hidden');
        });

        // --- Buffer ---
        video.addEventListener('progress', function () {
            if (video.buffered.length > 0 && video.duration > 0) {
                var end = video.buffered.end(video.buffered.length - 1);
                cpBuffered.style.width = (end / video.duration * 100) + '%';
            }
        });

        // --- Progress bar seeking ---
        cpProgressWrap.addEventListener('mousedown', function (e) {
            isSeeking = true;
            seekTo(e);
            document.addEventListener('mousemove', onSeekMove);
            document.addEventListener('mouseup', onSeekUp);
        });

        cpProgressWrap.addEventListener('touchstart', function (e) {
            isSeeking = true;
            seekTo(e.touches[0]);
        }, { passive: true });

        cpProgressWrap.addEventListener('touchmove', function (e) {
            if (isSeeking) seekTo(e.touches[0]);
        }, { passive: true });

        cpProgressWrap.addEventListener('touchend', function () {
            isSeeking = false;
        });

        function onSeekMove(e) {
            if (isSeeking) seekTo(e);
        }

        function onSeekUp() {
            isSeeking = false;
            document.removeEventListener('mousemove', onSeekMove);
            document.removeEventListener('mouseup', onSeekUp);
        }

        function seekTo(e) {
            var rect = cpProgressWrap.getBoundingClientRect();
            var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            var dur = video.duration || 0;
            video.currentTime = pct * dur;
            cpPlayed.style.width = (pct * 100) + '%';
            cpTime.textContent = formatTime(pct * dur) + ' / ' + formatTime(dur);
        }

        // Tooltip
        cpProgressWrap.addEventListener('mousemove', function (e) {
            var rect = cpProgressWrap.getBoundingClientRect();
            var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            var dur = video.duration || 0;
            cpTooltip.textContent = formatTime(pct * dur);
            cpTooltip.style.left = (pct * 100) + '%';
        });

        // --- Fullscreen ---
        cpFullBtn.addEventListener('click', toggleFullscreen);

        function toggleFullscreen() {
            var wrapper = document.getElementById('playerWrapper');
            var isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
            if (isFullscreen) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            } else {
                if (wrapper.requestFullscreen) {
                    wrapper.requestFullscreen();
                } else if (wrapper.webkitRequestFullscreen) {
                    wrapper.webkitRequestFullscreen();
                } else if (wrapper.mozRequestFullScreen) {
                    wrapper.mozRequestFullScreen();
                } else if (wrapper.msRequestFullscreen) {
                    wrapper.msRequestFullscreen();
                } else if (video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                } else if (video.requestFullscreen) {
                    video.requestFullscreen();
                }
            }
        }

        document.addEventListener('fullscreenchange', onFsChange, { signal: signal });
        document.addEventListener('webkitfullscreenchange', onFsChange, { signal: signal });

        function onFsChange() {
            var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            cpFullBtn.querySelector('.cp-icon-expand').style.display = isFs ? 'none' : '';
            cpFullBtn.querySelector('.cp-icon-compress').style.display = isFs ? '' : 'none';

            if (isFs) {
                // Khóa xoay ngang màn hình (Android/thiết bị hỗ trợ)
                try {
                    if (screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock('landscape').catch(function (err) {
                            console.warn('[Player] Orientation lock failed:', err.message);
                        });
                    } else if (screen.lockOrientation) {
                        screen.lockOrientation('landscape');
                    } else if (screen.webkitLockOrientation) {
                        screen.webkitLockOrientation('landscape');
                    } else if (screen.mozLockOrientation) {
                        screen.mozLockOrientation('landscape');
                    } else if (screen.msLockOrientation) {
                        screen.msLockOrientation('landscape');
                    }
                } catch (e) {}
            } else {
                // Mở khóa xoay màn hình khi thoát
                try {
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    } else if (screen.unlockOrientation) {
                        screen.unlockOrientation();
                    } else if (screen.webkitUnlockOrientation) {
                        screen.webkitUnlockOrientation();
                    } else if (screen.mozUnlockOrientation) {
                        screen.mozUnlockOrientation();
                    } else if (screen.msUnlockOrientation) {
                        screen.msUnlockOrientation();
                    }
                } catch (e) {}
            }
        }

        // --- Double-click fullscreen ---
        var dblClickTimer = null;
        video.addEventListener('dblclick', function (e) {
            e.preventDefault();
            toggleFullscreen();
        });

        // --- PiP ---
        if (cpPipBtn) {
            if (!document.pictureInPictureEnabled) {
                cpPipBtn.style.display = 'none';
            } else {
                cpPipBtn.addEventListener('click', function () {
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else {
                        video.requestPictureInPicture().catch(function () { });
                    }
                });
            }
        }

        // --- Settings panel ---
        cpSettingsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            cpSettingsPanel.classList.toggle('visible');
        });

        document.addEventListener('click', function (e) {
            if (!cpSettingsPanel.contains(e.target) && e.target !== cpSettingsBtn) {
                cpSettingsPanel.classList.remove('visible');
            }
        }, { signal: signal });

        // --- Speed options ---
        var speedBtns = cpSpeedOptions.querySelectorAll('button');
        // Restore saved speed UI
        for (var i = 0; i < speedBtns.length; i++) {
            if (parseFloat(speedBtns[i].getAttribute('data-speed')) === savedSpeed) {
                for (var j = 0; j < speedBtns.length; j++) speedBtns[j].classList.remove('active');
                speedBtns[i].classList.add('active');
            }
        }
        for (var i = 0; i < speedBtns.length; i++) {
            speedBtns[i].addEventListener('click', function () {
                var speed = parseFloat(this.getAttribute('data-speed'));
                video.playbackRate = speed;
                localStorage.setItem('cp_speed', speed);
                for (var j = 0; j < speedBtns.length; j++) speedBtns[j].classList.remove('active');
                this.classList.add('active');
            });
        }

        // --- Seek time options ---
        if (cpSeekOptions) {
            var seekBtns = cpSeekOptions.querySelectorAll('button');
            var savedSeek = seekTime;
            for (var i = 0; i < seekBtns.length; i++) {
                if (parseInt(seekBtns[i].getAttribute('data-seek')) === savedSeek) {
                    for (var j = 0; j < seekBtns.length; j++) seekBtns[j].classList.remove('active');
                    seekBtns[i].classList.add('active');
                }
                seekBtns[i].addEventListener('click', function () {
                    seekTime = parseInt(this.getAttribute('data-seek'));
                    localStorage.setItem('cp_seek_time', seekTime);
                    for (var j = 0; j < seekBtns.length; j++) seekBtns[j].classList.remove('active');
                    this.classList.add('active');
                    updateSeekBtnLabels();
                });
            }
        }

        // --- Skip Forward settings ---
        function setupSkipFwdPresets() {
            var container = document.getElementById('cpSkipFwdPresets');
            if (!container) return;
            var btns = container.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
                if (parseInt(btns[i].getAttribute('data-skip')) === skipForwardTime) {
                    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
                    btns[i].classList.add('active');
                }
                btns[i].addEventListener('click', (function (btn) {
                    return function () {
                        skipForwardTime = parseInt(btn.getAttribute('data-skip'));
                        localStorage.setItem('cp_skip_forward', skipForwardTime);
                        updateSkipBtnTitle();
                        var allBtns = document.getElementById('cpSkipFwdPresets').querySelectorAll('button');
                        for (var j = 0; j < allBtns.length; j++) allBtns[j].classList.remove('active');
                        btn.classList.add('active');
                    };
                })(btns[i]));
            }
        }

        setupSkipFwdPresets();

        function setupSkipFwdCustom() {
            var input = document.getElementById('cpSkipFwdCustom');
            var btn = document.getElementById('cpSkipFwdCustomBtn');
            if (!input || !btn) return;
            btn.addEventListener('click', function () {
                var val = parseInt(input.value);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 600) val = 600;
                skipForwardTime = val;
                localStorage.setItem('cp_skip_forward', skipForwardTime);
                updateSkipBtnTitle();
                var presetBtns = document.getElementById('cpSkipFwdPresets').querySelectorAll('button');
                for (var j = 0; j < presetBtns.length; j++) {
                    presetBtns[j].classList.remove('active');
                    if (parseInt(presetBtns[j].getAttribute('data-skip')) === val) {
                        presetBtns[j].classList.add('active');
                    }
                }
            });
            input.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Enter') btn.click();
            });
        }

        setupSkipFwdCustom();

        // --- Brightness / Contrast ---
        function updateSliderGradient(slider) {
            var min = parseFloat(slider.min);
            var max = parseFloat(slider.max);
            var val = parseFloat(slider.value);
            var pct = ((val - min) / (max - min)) * 100;
            slider.style.background = 'linear-gradient(to right, var(--primary, #f4abb4) ' + pct + '%, rgba(255,255,255,0.2) ' + pct + '%)';
        }

        function setupFilters() {
            var brightnessSlider = document.getElementById('cpBrightness');
            var contrastSlider = document.getElementById('cpContrast');
            var brightnessVal = document.getElementById('cpBrightnessVal');
            var contrastVal = document.getElementById('cpContrastVal');
            var resetBtn = document.getElementById('cpFilterReset');
            if (!brightnessSlider || !contrastSlider) return;

            var savedB = parseInt(localStorage.getItem('cp_brightness')) || 100;
            var savedC = parseInt(localStorage.getItem('cp_contrast')) || 100;
            brightnessSlider.value = savedB;
            contrastSlider.value = savedC;
            brightnessVal.textContent = savedB + '%';
            contrastVal.textContent = savedC + '%';
            updateSliderGradient(brightnessSlider);
            updateSliderGradient(contrastSlider);
            applyVideoFilters();

            brightnessSlider.addEventListener('input', function () {
                brightnessVal.textContent = this.value + '%';
                localStorage.setItem('cp_brightness', this.value);
                updateSliderGradient(this);
                applyVideoFilters();
            });

            contrastSlider.addEventListener('input', function () {
                contrastVal.textContent = this.value + '%';
                localStorage.setItem('cp_contrast', this.value);
                updateSliderGradient(this);
                applyVideoFilters();
            });

            if (resetBtn) {
                resetBtn.addEventListener('click', function () {
                    brightnessSlider.value = 100;
                    contrastSlider.value = 100;
                    brightnessVal.textContent = '100%';
                    contrastVal.textContent = '100%';
                    localStorage.removeItem('cp_brightness');
                    localStorage.removeItem('cp_contrast');
                    updateSliderGradient(brightnessSlider);
                    updateSliderGradient(contrastSlider);
                    applyVideoFilters();
                });
            }
        }

        function applyVideoFilters() {
            var b = document.getElementById('cpBrightness');
            var c = document.getElementById('cpContrast');
            if (!b || !c) return;
            video.style.filter = 'brightness(' + (b.value / 100) + ') contrast(' + (c.value / 100) + ')';
        }

        setupFilters();

        // --- Double-tap to seek (mobile) ---
        function setupDoubleTap() {
            if (!('ontouchstart' in window)) return;

            ['left', 'right'].forEach(function (side) {
                var zone = document.createElement('div');
                zone.className = 'cp-tap-zone cp-tap-zone-' + side;
                customPlayer.appendChild(zone);

                var lastTap = 0;
                var singleTimer = null;

                zone.addEventListener('touchstart', function (e) {
                    e.stopPropagation();
                }, { passive: true });

                zone.addEventListener('touchend', function (e) {
                    var now = Date.now();

                    if (now - lastTap < 300) {
                        clearTimeout(singleTimer);
                        lastTap = 0;

                        if (side === 'left') {
                            video.currentTime = Math.max(0, video.currentTime - seekTime);
                            showSeekIndicator('left', '-' + seekTime + 's');
                        } else {
                            video.currentTime = Math.min(video.duration || 0, video.currentTime + seekTime);
                            showSeekIndicator('right', '+' + seekTime + 's');
                        }
                        showDoubleTapFeedback(side);
                    } else {
                        lastTap = now;
                        singleTimer = setTimeout(function () {
                            if (customPlayer.classList.contains('cp-hide-controls')) {
                                // Controls hidden → show them
                                lastTouchShowTime = Date.now();
                                resetHideTimer();
                            } else if (!video.paused) {
                                // Controls visible → only hide if shown long enough
                                if (Date.now() - lastTouchShowTime > 1500) {
                                    customPlayer.classList.add('cp-hide-controls');
                                } else {
                                    resetHideTimer();
                                }
                            }
                            lastTap = 0;
                        }, 300);
                    }
                });
            });
        }

        function showDoubleTapFeedback(side) {
            var el = document.createElement('div');
            el.className = 'cp-tap-feedback ' + side;
            el.innerHTML = side === 'left'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>';
            customPlayer.appendChild(el);
            setTimeout(function () { el.remove(); }, 500);
        }

        setupDoubleTap();

        // --- Subtitle button (placeholder) ---
        var cpSubBtn = document.getElementById('cpSubBtn');
        if (cpSubBtn) {
            cpSubBtn.style.opacity = '0.4';
            cpSubBtn.title = 'Phụ đề (chưa hỗ trợ)';
        }

        // --- Keyboard shortcuts ---
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (!video || !customPlayer) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - seekTime);
                    showSeekIndicator('left', '-' + seekTime + 's');
                    break;
                case 'arrowright':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + seekTime);
                    showSeekIndicator('right', '+' + seekTime + 's');
                    break;
                case 'arrowup':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    video.muted = false;
                    updateVolumeUI();
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    updateVolumeUI();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    video.muted = !video.muted;
                    updateVolumeUI();
                    break;
                case 'p':
                    e.preventDefault();
                    if (cpPipBtn && document.pictureInPictureEnabled) cpPipBtn.click();
                    break;
                case 'i':
                    e.preventDefault();
                    doSkipForward();
                    break;
                case 'c':
                    e.preventDefault();
                    if (typeof toggleCinemaMode === 'function') toggleCinemaMode();
                    break;
                case 'l':
                    e.preventDefault();
                    if (typeof toggleLights === 'function') toggleLights();
                    break;
                case 'n':
                    e.preventDefault();
                    if (nextEpUrl) window.location.href = nextEpUrl;
                    break;
                case 'b':
                    e.preventDefault();
                    if (prevEpUrl) window.location.href = prevEpUrl;
                    break;
                case 'r':
                    e.preventDefault();
                    var rBtn = document.getElementById('cpAspectBtn');
                    if (rBtn) rBtn.click();
                    break;
                case '?':
                    e.preventDefault();
                    toggleShortcutsModal();
                    break;
                case 'escape':
                    var scModal = document.getElementById('cpShortcutsModal');
                    if (scModal && scModal.style.display !== 'none') {
                        e.preventDefault();
                        scModal.style.display = 'none';
                        break;
                    }
                    var resumeDlg = document.getElementById('cpResumeDialog');
                    if (resumeDlg) {
                        e.preventDefault();
                        resumeDlg.remove();
                        break;
                    }
                    var autoNextOv = document.getElementById('cpAutoNextOverlay');
                    if (autoNextOv) {
                        e.preventDefault();
                        clearInterval(autoNextInterval);
                        autoNextOv.remove();
                        break;
                    }
                    break;
            }
        }, { signal: signal });

        // --- Ended (auto next episode with countdown) ---
        var autoNextInterval = null;

        video.addEventListener('ended', function () {
            showPlayIcon();
            cpBigPlay.classList.remove('hidden');
            customPlayer.classList.remove('cp-hide-controls');
            if (nextEpUrl) {
                showAutoNextOverlay();
            }
        });

        function showAutoNextOverlay() {
            var count = 5;
            var overlay = document.createElement('div');
            overlay.className = 'cp-auto-next-overlay';
            overlay.id = 'cpAutoNextOverlay';

            overlay.innerHTML = '<div class="cp-auto-next-inner">' +
                '<h3>T\u1eadp ti\u1ebfp theo</h3>' +
                '<p>T\u1ef1 \u0111\u1ed9ng chuy\u1ec3n sau</p>' +
                '<div class="cp-auto-next-countdown" id="cpAutoNextCount">' +
                '<span>' + count + '</span>' +
                '<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="40" id="cpAutoNextCircle"/></svg>' +
                '</div>' +
                '<div class="cp-auto-next-actions">' +
                '<button class="cp-auto-next-cancel" id="cpAutoNextCancel">H\u1ee7y</button>' +
                '<a href="' + escAttr(sanitizeUrl(nextEpUrl)) + '" class="cp-auto-next-play">Chuy\u1ec3n ngay</a>' +
                '</div>' +
                '</div>';

            customPlayer.appendChild(overlay);

            var circle = document.getElementById('cpAutoNextCircle');
            var circumference = 2 * Math.PI * 40;
            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = '0';

            var countSpan = overlay.querySelector('.cp-auto-next-countdown span');

            autoNextInterval = setInterval(function () {
                count--;
                if (count <= 0) {
                    clearInterval(autoNextInterval);
                    window.location.href = nextEpUrl;
                    return;
                }
                countSpan.textContent = count;
                circle.style.strokeDashoffset = ((5 - count) / 5 * circumference);
            }, 1000);

            document.getElementById('cpAutoNextCancel').addEventListener('click', function () {
                clearInterval(autoNextInterval);
                overlay.remove();
            });
        }

        // --- Save progress with actual time ---
        function doSaveProgress() {
            if (typeof saveProgress === 'function' && video.currentTime > 0) {
                saveProgress(
                    wd.dataset.slug, wd.dataset.episode,
                    Math.floor(video.currentTime), Math.floor(video.duration || 0),
                    wd.dataset.name, wd.dataset.thumb, wd.dataset.origin
                );
            }
        }

        _cpSaveInterval = setInterval(doSaveProgress, 30000);

        // Lưu khi thoát trang
        window.addEventListener('beforeunload', function () {
            doSaveProgress();
            clearInterval(_cpSaveInterval);
        }, { signal: signal });

        // Lưu khi tab bị ẩn (chuyển tab, thu nhỏ trình duyệt)
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                doSaveProgress();
            }
        }, { signal: signal });

        // ================================================================
        // MOBILE ENHANCEMENTS
        // ================================================================

        // --- 1. Screen Wake Lock (keep screen on during playback) ---
        var wakeLock = null;
        async function requestWakeLock() {
            try {
                if ('wakeLock' in navigator && !wakeLock) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    wakeLock.addEventListener('release', function () { wakeLock = null; });
                }
            } catch (e) { /* wake lock not available */ }
        }
        function releaseWakeLock() {
            if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
        }
        video.addEventListener('play', requestWakeLock);
        video.addEventListener('pause', releaseWakeLock);
        video.addEventListener('ended', releaseWakeLock);
        // Re-acquire wake lock when returning to tab
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && !video.paused) requestWakeLock();
        }, { signal: signal });

        // --- 2. Long-press 2x speed (mobile touch) ---
        if (isTouchDevice) {
            var longPressTimer = null;
            var isLongPressing = false;
            var savedPlaybackRate = 1;
            var speedIndicator = null;

            function showSpeedOverlay() {
                if (speedIndicator) speedIndicator.remove();
                speedIndicator = document.createElement('div');
                speedIndicator.className = 'cp-speed-indicator';
                speedIndicator.id = 'cpSpeedIndicator';
                speedIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> 2x Tua nhanh';
                customPlayer.appendChild(speedIndicator);
            }
            function hideSpeedOverlay() {
                var el = document.getElementById('cpSpeedIndicator');
                if (el) el.remove();
                speedIndicator = null;
            }

            customPlayer.addEventListener('touchstart', function (e) {
                // Skip if touching controls, settings, or big play
                if (e.target.closest('#cpControls') || e.target.closest('#cpSettingsPanel') || e.target.closest('#cpBigPlay') || e.target.closest('.cp-tap-zone')) return;
                if (video.paused) return;
                longPressTimer = setTimeout(function () {
                    isLongPressing = true;
                    savedPlaybackRate = video.playbackRate;
                    video.playbackRate = 2;
                    showSpeedOverlay();
                }, 500);
            }, { passive: true, signal: signal });

            customPlayer.addEventListener('touchend', function () {
                clearTimeout(longPressTimer);
                if (isLongPressing) {
                    isLongPressing = false;
                    video.playbackRate = savedPlaybackRate;
                    hideSpeedOverlay();
                }
            }, { passive: true, signal: signal });

            customPlayer.addEventListener('touchcancel', function () {
                clearTimeout(longPressTimer);
                if (isLongPressing) {
                    isLongPressing = false;
                    video.playbackRate = savedPlaybackRate;
                    hideSpeedOverlay();
                }
            }, { passive: true, signal: signal });
        }

        // --- 3. Swipe horizontal to seek (full video area) ---
        if (isTouchDevice) {
            var swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;
            var isSwipeSeeking = false;
            var swipeSeekIndicator = null;
            var SWIPE_THRESHOLD = 30; // px before activating
            var swipeAxis = null; // 'horizontal' | 'vertical' | null

            customPlayer.addEventListener('touchstart', function (e) {
                if (e.target.closest('#cpControls') || e.target.closest('#cpSettingsPanel') || e.target.closest('#cpBigPlay') || e.target.closest('.cp-tap-zone')) return;
                if (e.touches.length !== 1) return;
                swipeStartX = e.touches[0].clientX;
                swipeStartY = e.touches[0].clientY;
                swipeStartTime = video.currentTime;
                isSwipeSeeking = false;
                swipeAxis = null;
            }, { passive: true, signal: signal });

            customPlayer.addEventListener('touchmove', function (e) {
                if (e.target.closest('#cpControls') || e.target.closest('#cpSettingsPanel')) return;
                if (e.touches.length !== 1) return;
                var dx = e.touches[0].clientX - swipeStartX;
                var dy = e.touches[0].clientY - swipeStartY;

                // Determine axis on first significant move
                if (!swipeAxis) {
                    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        swipeAxis = 'horizontal';
                    } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.5) {
                        swipeAxis = 'vertical';
                    } else {
                        return;
                    }
                }

                if (swipeAxis === 'horizontal') {
                    // Horizontal seek
                    if (isLongPressing) return; // don't seek during long-press 2x
                    isSwipeSeeking = true;
                    var rect = customPlayer.getBoundingClientRect();
                    var seekSeconds = (dx / rect.width) * (video.duration || 0) * 0.5; // 50% sensitivity
                    var target = Math.max(0, Math.min(video.duration || 0, swipeStartTime + seekSeconds));

                    // Show seek overlay
                    if (!swipeSeekIndicator) {
                        swipeSeekIndicator = document.createElement('div');
                        swipeSeekIndicator.className = 'cp-swipe-seek-indicator';
                        customPlayer.appendChild(swipeSeekIndicator);
                    }
                    var delta = target - swipeStartTime;
                    swipeSeekIndicator.textContent = (delta >= 0 ? '+' : '') + formatTime(Math.abs(delta)) + ' → ' + formatTime(target);

                    // Update progress bar visually
                    cpPlayed.style.width = (target / (video.duration || 1) * 100) + '%';
                }

                if (swipeAxis === 'vertical') {
                    // Vertical gesture: left side = brightness, right side = volume
                    var screenMid = customPlayer.getBoundingClientRect().width / 2;
                    var isLeft = swipeStartX < customPlayer.getBoundingClientRect().left + screenMid;
                    var change = -dy / 200; // inverted: up = increase

                    if (isLeft) {
                        // Brightness
                        var bSlider = document.getElementById('cpBrightness');
                        if (bSlider) {
                            var newB = Math.max(50, Math.min(150, parseInt(bSlider.value) + change * 30));
                            bSlider.value = Math.round(newB);
                            localStorage.setItem('cp_brightness', bSlider.value);
                            var bVal = document.getElementById('cpBrightnessVal');
                            if (bVal) bVal.textContent = bSlider.value + '%';
                            applyVideoFilters();
                            showGestureLevel('brightness', (newB - 50) / 100);
                        }
                    } else {
                        // Volume
                        var newVol = Math.max(0, Math.min(1, video.volume + change * 0.5));
                        video.volume = newVol;
                        video.muted = false;
                        localStorage.setItem('cp_volume', newVol);
                        localStorage.setItem('cp_muted', 'false');
                        updateVolumeUI();
                        showGestureLevel('volume', newVol);
                    }
                    // Reset swipe origin for continuous adjustment
                    swipeStartY = e.touches[0].clientY;
                }
            }, { passive: true, signal: signal });

            customPlayer.addEventListener('touchend', function () {
                if (isSwipeSeeking && swipeAxis === 'horizontal') {
                    // Apply seek
                    var dx = 0;
                    if (swipeSeekIndicator) {
                        // Parse from indicator
                        dx = parseFloat(cpPlayed.style.width) / 100 * (video.duration || 0);
                        video.currentTime = dx;
                        swipeSeekIndicator.remove();
                        swipeSeekIndicator = null;
                    }
                    isSwipeSeeking = false;
                }
                swipeAxis = null;
                // Hide gesture level
                setTimeout(function () {
                    var gl = document.getElementById('cpGestureLevel');
                    if (gl) gl.remove();
                }, 600);
            }, { passive: true, signal: signal });

            // Gesture level indicator (brightness/volume bar overlay)
            function showGestureLevel(type, pct) {
                var el = document.getElementById('cpGestureLevel');
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'cp-gesture-level';
                    el.id = 'cpGestureLevel';
                    customPlayer.appendChild(el);
                }
                var icon = type === 'volume'
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
                el.innerHTML = icon + '<div class="cp-gesture-bar"><div class="cp-gesture-fill" style="width:' + Math.round(pct * 100) + '%"></div></div>';
            }
        }

        // --- 4. Aspect Ratio toggle ---
        var aspectModes = ['contain', 'cover', 'fill'];
        var currentAspectIdx = 0;
        var savedAspect = localStorage.getItem('cp_aspect');
        if (savedAspect && aspectModes.indexOf(savedAspect) !== -1) {
            currentAspectIdx = aspectModes.indexOf(savedAspect);
            video.style.objectFit = savedAspect;
        }
        // Will bind to cpAspectBtn if exists (added in HTML)
        var cpAspectBtn = document.getElementById('cpAspectBtn');
        if (cpAspectBtn) {
            cpAspectBtn.addEventListener('click', function () {
                currentAspectIdx = (currentAspectIdx + 1) % aspectModes.length;
                video.style.objectFit = aspectModes[currentAspectIdx];
                localStorage.setItem('cp_aspect', aspectModes[currentAspectIdx]);
                var labels = { contain: 'Vừa', cover: 'Lấp đầy', fill: 'Kéo dãn' };
                showSeekIndicator('right', labels[aspectModes[currentAspectIdx]]);
            });
        }

        // --- 5. Volume slider touch-friendly (tap to toggle) ---
        if (isTouchDevice) {
            var volWrap = document.querySelector('.cp-volume-wrap');
            if (volWrap) {
                volWrap.addEventListener('touchstart', function (e) {
                    if (e.target.closest('.cp-vol-slider')) return; // slider itself
                    var sliderWrap = volWrap.querySelector('.cp-vol-slider-wrap');
                    if (sliderWrap) {
                        var isOpen = sliderWrap.style.width === '80px';
                        sliderWrap.style.width = isOpen ? '0' : '80px';
                    }
                }, { passive: true });
            }
        }

    } // end initCustomPlayer()

    // --- Keyboard Shortcuts Modal ---
    var shortcutsModalEl = null;

    function toggleShortcutsModal() {
        if (!shortcutsModalEl) {
            shortcutsModalEl = createShortcutsModal();
        }
        shortcutsModalEl.style.display = shortcutsModalEl.style.display === 'none' ? '' : 'none';
    }

    function createShortcutsModal() {
        var modal = document.createElement('div');
        modal.className = 'cp-shortcuts-overlay';
        modal.id = 'cpShortcutsModal';
        modal.style.display = 'none';

        var shortcuts = [
            ['Space / K', 'Ph\u00e1t / T\u1ea1m d\u1eebng'],
            ['\u2190', 'Tua l\u1ea1i'],
            ['\u2192', 'Tua t\u1edbi'],
            ['\u2191', 'T\u0103ng \u00e2m l\u01b0\u1ee3ng'],
            ['\u2193', 'Gi\u1ea3m \u00e2m l\u01b0\u1ee3ng'],
            ['F', 'To\u00e0n m\u00e0n h\u00ecnh'],
            ['M', 'T\u1eaft / B\u1eadt ti\u1ebfng'],
            ['P', 'Picture-in-Picture'],
            ['I', 'Tua t\u1edbi (>>)'],
            ['C', 'Ch\u1ebf \u0111\u1ed9 r\u1ea1p phim'],
            ['L', 'T\u1eaft \u0111\u00e8n'],
            ['N', 'T\u1eadp ti\u1ebfp theo'],
            ['B', 'T\u1eadp tr\u01b0\u1edbc'],
            ['Gi\u1eef X', 'Tua nhanh 2x'],
            ['?', 'B\u1ea3ng ph\u00edm t\u1eaft']
        ];

        var html = '<div class="cp-shortcuts-box"><h3>Ph\u00edm t\u1eaft</h3><div class="cp-shortcuts-grid">';
        for (var i = 0; i < shortcuts.length; i++) {
            html += '<div class="cp-shortcut-item"><span class="cp-shortcut-label">' + shortcuts[i][1] + '</span><span class="cp-shortcut-key">' + shortcuts[i][0] + '</span></div>';
        }
        html += '</div><button class="cp-shortcuts-close" id="cpShortcutsClose">\u0110\u00f3ng</button><div class="cp-shortcuts-hint">Nh\u1ea5n ? ho\u1eb7c Esc \u0111\u1ec3 \u0111\u00f3ng</div></div>';

        modal.innerHTML = html;
        document.body.appendChild(modal);

        document.getElementById('cpShortcutsClose').addEventListener('click', function () {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        return modal;
    }

    // --- Hold X for temporary 2x speed ---
    var isHoldingX = false;
    var originalPlaybackRate = 1;

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!video || !customPlayer) return;
        if (e.key.toLowerCase() === 'x' && !e.repeat && !isHoldingX) {
            isHoldingX = true;
            originalPlaybackRate = video.playbackRate;
            video.playbackRate = 2;
            showSpeedIndicator();
        }
    });

    document.addEventListener('keyup', function (e) {
        if (e.key.toLowerCase() === 'x' && isHoldingX) {
            isHoldingX = false;
            video.playbackRate = originalPlaybackRate;
            hideSpeedIndicator();
        }
    });

    window.addEventListener('blur', function () {
        if (isHoldingX) {
            isHoldingX = false;
            if (video) video.playbackRate = originalPlaybackRate;
            hideSpeedIndicator();
        }
    });

    function showSpeedIndicator() {
        var existing = document.getElementById('cpSpeedIndicator');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.className = 'cp-speed-indicator';
        el.id = 'cpSpeedIndicator';
        el.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> 2x Tua nhanh';
        customPlayer.appendChild(el);
    }

    function hideSpeedIndicator() {
        var el = document.getElementById('cpSpeedIndicator');
        if (el) el.remove();
    }

    // --- Cleanup hàm dùng chung ---
    function cleanupAllPlayerState() {
        // Cleanup HLS listeners
        if (_cpAbort) { _cpAbort.abort(); _cpAbort = null; }
        if (_cpSaveInterval) { clearInterval(_cpSaveInterval); _cpSaveInterval = null; }
        // Cleanup HLS instance
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        // Cleanup embed autosave
        if (_embedSaveInterval) { clearInterval(_embedSaveInterval); _embedSaveInterval = null; }
        if (_embedAbort) { _embedAbort.abort(); _embedAbort = null; }
    }

    function startEmbedAutoSave() {
        _embedElapsed = 0;
        _embedAbort = new AbortController();
        var sig = _embedAbort.signal;
        // Lưu ngay
        if (typeof saveProgress === 'function') {
            saveProgress(wd.dataset.slug, wd.dataset.episode, 0, 0, wd.dataset.name, wd.dataset.thumb, wd.dataset.origin);
        }
        _embedSaveInterval = setInterval(function () {
            _embedElapsed += 30;
            if (typeof saveProgress === 'function') {
                saveProgress(wd.dataset.slug, wd.dataset.episode, _embedElapsed, 0, wd.dataset.name, wd.dataset.thumb, wd.dataset.origin);
            }
        }, 30000);
        window.addEventListener('beforeunload', function () {
            if (_embedElapsed > 0 && typeof saveProgress === 'function') {
                saveProgress(wd.dataset.slug, wd.dataset.episode, _embedElapsed, 0, wd.dataset.name, wd.dataset.thumb, wd.dataset.origin);
            }
        }, { signal: sig });
    }

    // --- Server switching ---
    window.switchServer = function (btn) {
        var idx = parseInt(btn.getAttribute('data-idx'));
        var btns = document.querySelectorAll('.server-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        btn.classList.add('active');

        var serverName = btn.textContent.trim();
        document.cookie = "preferred_server=" + encodeURIComponent(serverName) + "; path=/; max-age=31536000";

        // Lưu progress ngay trước khi cleanup để không mất vị trí xem hiện tại
        if (video && typeof saveProgress === 'function') {
            var curTime = video.currentTime;
            if (curTime > 0) {
                saveProgress(
                    wd.dataset.slug, wd.dataset.episode,
                    Math.floor(curTime), Math.floor(video.duration || 0),
                    wd.dataset.name, wd.dataset.thumb, wd.dataset.origin
                );
            }
        }

        // Cleanup trước khi đổi player
        cleanupAllPlayerState();

        var streamHash = serverStreams[idx];
        var embedUrl = serverEmbeds[idx];

        if (streamHash && typeof Hls !== 'undefined') {
            var epLabel = (wd.dataset.episode === 'Full' || wd.dataset.episode === 'full') ? 'Full' : 'Tập ' + (wd.dataset.episode || '');
            var titleOverlay = '<div class="cp-title-overlay" id="cpTitleOverlay"><div class="cp-title-overlay-left"><span class="cp-title-overlay-text">' + (wd.dataset.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</span><span class="cp-title-overlay-ep">' + epLabel.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span></div><span class="cp-title-overlay-brand">movieCC</span></div>';
            var wrapper = document.getElementById('playerWrapper');
            wrapper.innerHTML = '<div class="custom-player" id="customPlayer">' +
                '<video id="hlsVideo" playsinline></video>' +
                titleOverlay +
                '<div class="cp-loading" id="cpLoading"><div class="cp-spinner"></div></div>' +
                '<div class="cp-big-play" id="cpBigPlay"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></div>' +
                '<div class="cp-controls" id="cpControls">' +
                '<div class="cp-progress-wrap" id="cpProgressWrap"><div class="cp-progress-bar"><div class="cp-progress-buffered" id="cpBuffered"></div><div class="cp-progress-played" id="cpPlayed"><div class="cp-progress-thumb"></div></div></div><div class="cp-progress-tooltip" id="cpTooltip">00:00</div></div>' +
                '<div class="cp-controls-row"><div class="cp-left">' +
                '<button class="cp-btn" id="cpPlayBtn" title="Phát / Tạm dừng"><svg class="cp-icon-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg><svg class="cp-icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></button>' +
                '<button class="cp-btn" id="cpRewBtn" title="Tua lại 10s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-weight="bold">10</text></svg></button>' +
                '<button class="cp-btn" id="cpFwdBtn" title="Tua tới 10s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-weight="bold">10</text></svg></button>' +
                '<button class="cp-btn cp-skip-btn" id="cpSkipIntroBtn" title="Tua tới (I)"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><polygon points="13,4 23,12 13,20"/></svg></button>' +
                '<div class="cp-volume-wrap"><button class="cp-btn" id="cpMuteBtn" title="Tắt/Bật tiếng"><svg class="cp-icon-vol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><svg class="cp-icon-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg></button><div class="cp-vol-slider-wrap"><input type="range" class="cp-vol-slider" id="cpVolSlider" min="0" max="1" step="0.01" value="1"></div></div>' +
                '<span class="cp-time" id="cpTime">00:00 / 00:00</span>' +
                '</div><div class="cp-right">' +
                (nextEpUrl ? '<a href="' + escAttr(sanitizeUrl(nextEpUrl)) + '" class="cp-btn" id="cpNextBtn" title="Tập tiếp theo"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="3" height="16"/></svg></a>' : '') +
                '<button class="cp-btn" id="cpPipBtn" title="PiP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3"/></svg></button>' +
                '<button class="cp-btn" id="cpAspectBtn" title="Tỉ lệ khung hình (R)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="7" width="12" height="10" rx="1" opacity="0.3"/></svg></button>' +
                '<button class="cp-btn" id="cpSettingsBtn" title="Cài đặt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>' +
                '<button class="cp-btn" id="cpFullBtn" title="Toàn màn hình"><svg class="cp-icon-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg><svg class="cp-icon-compress" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>' +
                '</div></div>' +
                '</div>' +
                '<div class="cp-settings-panel" id="cpSettingsPanel"><div class="cp-settings-title">Tốc độ phát</div><div class="cp-speed-options" id="cpSpeedOptions"><button data-speed="0.5">0.5x</button><button data-speed="0.75">0.75x</button><button data-speed="1" class="active">1x</button><button data-speed="1.25">1.25x</button><button data-speed="1.5">1.5x</button><button data-speed="2">2x</button></div><div class="cp-settings-divider"></div><div class="cp-settings-title">Thời gian tua (giây)</div><div class="cp-seek-options" id="cpSeekOptions"><button data-seek="5">5s</button><button data-seek="10" class="active">10s</button><button data-seek="15">15s</button><button data-seek="30">30s</button><button data-seek="60">60s</button></div><div class="cp-settings-divider"></div><div class="cp-settings-title">Nút tua tới (>>)</div><div class="cp-skip-section"><div class="cp-skip-presets" id="cpSkipFwdPresets"><button data-skip="30">30s</button><button data-skip="60">60s</button><button data-skip="90" class="active">90s</button><button data-skip="120">120s</button><button data-skip="150">150s</button></div><div class="cp-skip-custom"><input type="number" id="cpSkipFwdCustom" class="cp-skip-input" min="1" max="600" placeholder="Nhập số giây..."><button id="cpSkipFwdCustomBtn" class="cp-skip-apply">OK</button></div></div><div class="cp-skip-hint">Phím tắt: I = tua tới, ? = phím tắt</div><div class="cp-settings-divider"></div><div class="cp-settings-title">Hình ảnh</div><div class="cp-filter-group"><div class="cp-filter-row"><span class="cp-filter-label">Độ sáng</span><input type="range" class="cp-filter-slider" id="cpBrightness" min="50" max="150" value="100"><span class="cp-filter-value" id="cpBrightnessVal">100%</span></div><div class="cp-filter-row"><span class="cp-filter-label">Tương phản</span><input type="range" class="cp-filter-slider" id="cpContrast" min="50" max="150" value="100"><span class="cp-filter-value" id="cpContrastVal">100%</span></div><button class="cp-filter-reset" id="cpFilterReset">Đặt lại</button></div></div>' +
                '</div>';

            currentStreamHash = streamHash;
            currentEmbedUrl = embedUrl || '';
            currentEmbedFallback = serverEmbedFallbacks[idx] || '';
            video = document.getElementById('hlsVideo');
            customPlayer = document.getElementById('customPlayer');
            initCustomPlayer();
        } else if (embedUrl) {
            var wrapper = document.getElementById('playerWrapper');
            wrapper.innerHTML = '<iframe id="embedPlayer" src="' + embedUrl + '" allowfullscreen style="width:100%;height:100%;border:none;background:#000"></iframe>';
        } else {
            var wrapper = document.getElementById('playerWrapper');
            wrapper.innerHTML = '<div class="cp-no-video"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><p>Server này chưa có link.</p></div>';
        }
    };

    // --- Cinema & Lights mode ---
    window.toggleCinemaMode = function () {
        var container = document.getElementById('playerContainer');
        container.classList.toggle('cinema-mode');
        var btn = document.getElementById('cinemaModeBtn');
        if (btn) btn.classList.toggle('active');
        var isOn = container.classList.contains('cinema-mode');
        localStorage.setItem('cp_cinema', isOn);
    };

    // Restore cinema mode từ localStorage
    (function restoreCinemaMode() {
        if (localStorage.getItem('cp_cinema') === 'true') {
            var container = document.getElementById('playerContainer');
            if (container) {
                container.classList.add('cinema-mode');
                var btn = document.getElementById('cinemaModeBtn');
                if (btn) btn.classList.add('active');
            }
        }
    })();

    window.toggleLights = function () {
        document.body.classList.toggle('lights-off');
        var btn = document.getElementById('lightsBtn');
        if (btn) btn.classList.toggle('active');
    };

    // --- Utility ---
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        if (h > 0) {
            return h + ':' + pad(m) + ':' + pad(s);
        }
        return pad(m) + ':' + pad(s);
    }

    function pad(n) {
        return n < 10 ? '0' + n : '' + n;
    }
})();
