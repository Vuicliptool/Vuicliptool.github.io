/**
 * js/media.js
 * Quản lý âm thanh (hanoi/, effects/games/, dấu phẩy -> gạch dưới), hình ảnh SVG và nhạc nền tự động
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let activeAudio = null;
  const bgmAudio = new Audio();
  bgmAudio.loop = true;
  bgmAudio.volume = 0.25;

  let bgmEnabled = true;
  try {
    bgmEnabled = localStorage.getItem('APPTV_BGM_MUTED') !== '1';
  } catch (e) {}

  let currentBgmTrack = '';
  let desiredBgmTrack = 'bg_home';

  function toTelexFilename(str) {
    if (!str) return '';
    return str
      .replace(/ă/g, 'aw').replace(/â/g, 'aa').replace(/đ/g, 'dd')
      .replace(/ê/g, 'ee').replace(/ô/g, 'oo').replace(/ơ/g, 'ow').replace(/ư/g, 'uw')
      .replace(/Ă/g, 'Aw').replace(/Â/g, 'Aa').replace(/Đ/g, 'Dd')
      .replace(/Ê/g, 'Ee').replace(/Ô/g, 'Oo').replace(/Ơ/g, 'Ow').replace(/Ư/g, 'Uw');
  }

  function resolveSvgCandidates(rawPath) {
    if (!rawPath) return [];
    let clean = rawPath.trim().replace(/^\/+/, '');
    if (!clean.endsWith('.svg')) clean += '.svg';
    const telex = toTelexFilename(clean);
    const baseName = clean.split('/').pop();
    const telexBase = telex.split('/').pop();

    return [
      clean,
      `assets/${clean}`,
      `data/${clean}`,
      `assets/data/${clean}`,
      `images/${baseName}`,
      `assets/images/${baseName}`,
      `images/${telexBase}`,
      `assets/images/${telexBase}`,
      `data/Writing/${baseName}`,
      `assets/data/Writing/${baseName}`,
      `Writing/${baseName}`,
      telex
    ];
  }

  function createSmartSvgElement(rawPath, fallbackLabel = '📘') {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    const candidates = resolveSvgCandidates(rawPath);
    const img = document.createElement('img');
    img.alt = fallbackLabel;

    let idx = 0;
    function tryNext() {
      if (idx < candidates.length) {
        img.src = candidates[idx++];
      } else {
        img.remove();
        const fb = document.createElement('div');
        fb.className = 'thumb-fallback';
        const shortText = (fallbackLabel || '📘').replace(/^Bài\s+/i, 'B.');
        fb.textContent = shortText.length > 6 ? shortText.slice(0, 2).toUpperCase() : shortText;
        wrapper.appendChild(fb);
      }
    }

    img.onerror = tryNext;
    wrapper.appendChild(img);
    tryNext();
    return wrapper;
  }

  function playSoundToken(token) {
    return new Promise((resolve) => {
      if (!token) return resolve();
      let clean = String(token).trim().replace(/^~+/, '');
      if (!clean || clean === 'second') {
        return setTimeout(resolve, 750);
      }
      stopActiveAudio();

      // Trong data.txt có dấu phẩy (vd: "bài này, chúng ta...") nhưng tên file mp3 đổi thành dấu gạch dưới "_"
      const norm = clean.replace(/,/g, '_');
      const lower = clean.toLowerCase();
      const lowerNorm = norm.toLowerCase();

      const rawCandidates = [
        `Sounds/hanoi/${lowerNorm}.mp3`,
        `Sounds/hanoi/${lower}.mp3`,
        `Sounds/hanoi/${norm}.mp3`,
        `Sounds/hanoi/${clean}.mp3`,
        `Sounds/effects/games/${lowerNorm}.mp3`,
        `Sounds/effects/${lowerNorm}.mp3`,
        `Sounds/${lowerNorm}.mp3`,
        `assets/Sounds/hanoi/${lowerNorm}.mp3`,
        `assets/Sounds/hanoi/${lower}.mp3`,
        `assets/Sounds/effects/games/${lowerNorm}.mp3`,
        `assets/Sounds/effects/${lowerNorm}.mp3`,
        `assets/Sounds/${lowerNorm}.mp3`
      ];
      const candidates = Array.from(new Set(rawCandidates));

      let idx = 0;
      const audio = new Audio();
      activeAudio = audio;

      function tryPlay() {
        if (activeAudio !== audio) return resolve();
        if (idx >= candidates.length) {
          setTimeout(resolve, 260);
          return;
        }
        audio.src = candidates[idx++];
        audio.play().catch(() => tryPlay());
      }
      audio.onended = () => resolve();
      audio.onerror = () => tryPlay();
      tryPlay();
    });
  }

  // Phát tuần tự 1 danh sách token giọng đọc, hỗ trợ hủy giữa chừng qua checkCancelled()
  async function playSoundSequence(tokens, checkCancelled) {
    for (const tk of tokens) {
      if (typeof checkCancelled === 'function' && checkCancelled()) return;
      if (tk) await playSoundToken(tk);
    }
  }

  function stopActiveAudio() {
    if (activeAudio) {
      try { activeAudio.pause(); } catch (e) {}
      activeAudio = null;
    }
  }

  function playEffect(name) {
    if (!name) return;
    const clean = String(name).trim().replace(/\.mp3$/i, '');
    const candidates = [
      `Sounds/${clean}.mp3`,
      `Sounds/effects/games/${clean}.mp3`,
      `Sounds/effects/${clean}.mp3`,
      `assets/Sounds/${clean}.mp3`,
      `assets/Sounds/effects/games/${clean}.mp3`
    ];
    let i = 0;
    const a = new Audio();
    function next() {
      if (i >= candidates.length) return;
      a.src = candidates[i++];
      a.play().catch(next);
    }
    a.onerror = next;
    next();
  }

  function playGameEffect(name) {
    if (!name) return;
    const clean = String(name).trim().replace(/\.mp3$/i, '');
    const candidates = [
      `Sounds/effects/games/${clean}.mp3`,
      `Sounds/effects/${clean}.mp3`,
      `Sounds/${clean}.mp3`,
      `assets/Sounds/effects/games/${clean}.mp3`,
      `assets/Sounds/${clean}.mp3`
    ];
    let i = 0;
    const a = new Audio();
    function next() {
      if (i >= candidates.length) return;
      a.src = candidates[i++];
      a.play().catch(next);
    }
    a.onerror = next;
    next();
  }

  function playWritingFail() {
    const r = Math.floor(Math.random() * 3) + 1;
    playSoundToken(`fail${r}`);
  }

  function syncBgmButtonUI() {
    const btn = document.getElementById('toggleBgmBtn');
    if (!btn) return;
    btn.textContent = bgmEnabled ? '🔊 Nhạc: Bật' : '🔇 Nhạc: Tắt';
  }

  function playBgm(trackName) {
    if (trackName) desiredBgmTrack = trackName;
    syncBgmButtonUI();
    if (!bgmEnabled || !desiredBgmTrack) return;

    const trackPath = `Sounds/${desiredBgmTrack}.mp3`;
    if (currentBgmTrack !== desiredBgmTrack) {
      bgmAudio.src = trackPath;
      currentBgmTrack = desiredBgmTrack;
    }
    if (bgmAudio.paused) {
      bgmAudio.play().catch(() => {
        bgmAudio.src = `assets/Sounds/${desiredBgmTrack}.mp3`;
        bgmAudio.play().catch(() => {});
      });
    }
  }

  function stopBgm() {
    bgmAudio.pause();
    currentBgmTrack = '';
    desiredBgmTrack = null;
  }

  function toggleBgm(btnEl, defaultTrack = 'bg_home') {
    bgmEnabled = !bgmEnabled;
    try {
      localStorage.setItem('APPTV_BGM_MUTED', bgmEnabled ? '0' : '1');
    } catch (e) {}

    if (bgmEnabled) {
      playBgm(defaultTrack);
    } else {
      bgmAudio.pause();
      currentBgmTrack = '';
    }
    syncBgmButtonUI();
  }

  function unlockBgmOnInteraction() {
    if (bgmEnabled && desiredBgmTrack && bgmAudio.paused) {
      playBgm(desiredBgmTrack);
    }
  }
  document.addEventListener('touchstart', unlockBgmOnInteraction, { passive: true });
  document.addEventListener('click', unlockBgmOnInteraction, { passive: true });
  document.addEventListener('DOMContentLoaded', syncBgmButtonUI);

  ns.Media = {
    toTelexFilename,
    resolveSvgCandidates,
    createSmartSvgElement,
    playSoundToken,
    playSoundSequence,
    stopActiveAudio,
    playEffect,
    playGameEffect,
    playWritingFail,
    playBgm,
    stopBgm,
    toggleBgm
  };
})(window.AppTV);
