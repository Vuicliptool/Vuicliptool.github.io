/**
 * js/media.js
 * Quản lý âm thanh, hình ảnh SVG và phát nhạc nền thông minh (bg_home.mp3 vs bg_lesson.mp3)
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let activeAudio = null;
  const bgmAudio = new Audio();
  bgmAudio.loop = true;
  bgmAudio.volume = 0.25;
    // Thay dòng: let bgmEnabled = false;
  let bgmEnabled = localStorage.getItem('APPTV_BGM_MUTED') !== '1';
  let currentBgmTrack = '';

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
      let clean = token.trim().replace(/^~+/, '');
      if (!clean || clean === 'second') {
        return setTimeout(resolve, 800);
      }
      stopActiveAudio();

      const lower = clean.toLowerCase();
      const candidates = [
        `Sounds/hanoi/${clean}.mp3`,
        `Sounds/hanoi/${lower}.mp3`,
        `Sounds/effects/${clean}.mp3`,
        `Sounds/effects/${lower}.mp3`,
        `Sounds/${clean}.mp3`,
        `Sounds/${lower}.mp3`,
        `assets/Sounds/hanoi/${clean}.mp3`,
        `assets/Sounds/hanoi/${lower}.mp3`,
        `assets/Sounds/effects/${clean}.mp3`,
        `assets/Sounds/${clean}.mp3`
      ];

      let idx = 0;
      const audio = new Audio();
      activeAudio = audio;

      function tryPlay() {
        if (idx >= candidates.length) {
          setTimeout(resolve, 350);
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

  function stopActiveAudio() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
  }

  function playEffect(name) {
    const a = new Audio(`Sounds/${name}.mp3`);
    a.onerror = () => {
      const b = new Audio(`assets/Sounds/${name}.mp3`);
      b.play().catch(() => {});
    };
    a.play().catch(() => {});
  }

  function playBgm(trackName) {
    if (!bgmEnabled) return;
    const trackPath = `Sounds/${trackName}.mp3`;
    if (currentBgmTrack !== trackName) {
      bgmAudio.src = trackPath;
      bgmAudio.play().catch(() => {
        bgmAudio.src = `assets/Sounds/${trackName}.mp3`;
        bgmAudio.play().catch(() => {});
      });
      currentBgmTrack = trackName;
    } else if (bgmAudio.paused) {
      bgmAudio.play().catch(() => {});
    }
  }

  function stopBgm() {
    bgmAudio.pause();
    currentBgmTrack = '';
  }

  function toggleBgm(btnEl, defaultTrack = 'bg_home') {
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled) {
      playBgm(defaultTrack);
      if (btnEl) btnEl.textContent = '🔊 Nhạc: Bật';
    } else {
      stopBgm();
      if (btnEl) btnEl.textContent = '🔇 Nhạc: Tắt';
    }
  }
    function playWritingFail() {
    const r = Math.floor(Math.random() * 3) + 1;
    playSoundToken(`fail${r}`);
  }

  ns.Media = {
    toTelexFilename,
    resolveSvgCandidates,
    createSmartSvgElement,
    playSoundToken,
    playWritingFail,
    stopActiveAudio,
    playEffect,
    playBgm,
    stopBgm,
    toggleBgm
  };
})(window.AppTV);
