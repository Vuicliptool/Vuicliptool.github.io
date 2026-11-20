/**
 * js/main.js
 * Điều phối hiển thị danh sách bài học trên lessons.html, mở khóa bài đã học và nhảy tới bài mới khi bấm Play
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let currentModule = 'data';
  let searchQuery = '';

  const CARD_THEMES = ['theme-blue', 'theme-yellow', 'theme-green'];

  function getInitialModuleAndQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      const modParam = params.get('mod');
      const qParam = params.get('q');
      if (modParam && ['data', 'write', 'thinking', 'games'].includes(modParam)) {
        currentModule = modParam;
      }
      if (qParam) {
        searchQuery = qParam.trim().toLowerCase();
      }
    } catch (e) {}

    if (window.location.hash) {
      const h = window.location.hash.replace(/^#/, '').trim();
      if (['data', 'write', 'thinking', 'games'].includes(h)) {
        currentModule = h;
      }
    }

    try {
      if (window.localStorage) {
        const savedMod = window.localStorage.getItem('APPTV_CURRENT_MOD');
        if (!window.location.search && !window.location.hash && savedMod && ['data', 'write', 'thinking', 'games'].includes(savedMod)) {
          currentModule = savedMod;
        }
        const savedQ = window.localStorage.getItem('APPTV_SEARCH_Q');
        if (savedQ && !searchQuery) {
          searchQuery = savedQ.trim().toLowerCase();
          window.localStorage.removeItem('APPTV_SEARCH_Q');
        }
      }
    } catch (e) {}
  }

  function createLockBadgeSvg() {
    const div = document.createElement('div');
    div.className = 'lock-badge';
    div.innerHTML = `
      <svg viewBox="0 0 64 64" width="32" height="32">
        <path d="M18 28V20c0-7.7 6.3-14 14-14s14 6.3 14 14v8" fill="none" stroke="#f5b82e" stroke-width="7" stroke-linecap="round"/>
        <rect x="12" y="26" width="40" height="32" rx="8" fill="#ffd447" stroke="#e09f1f" stroke-width="3"/>
        <circle cx="32" cy="40" r="4" fill="#9c4114"/>
        <path d="M32 44v6" stroke="#9c4114" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `;
    return div;
  }

  function createDoneBadgeSvg() {
    const div = document.createElement('div');
    div.className = 'lock-badge';
    div.style.transform = 'translateX(-50%)';
    div.innerHTML = `
      <svg viewBox="0 0 64 64" width="32" height="32">
        <circle cx="32" cy="32" r="26" fill="#22c55e" stroke="#ffffff" stroke-width="4"/>
        <path d="M20 33l8 8 16-18" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    return div;
  }

  function initApp() {
    const container = document.getElementById('sectionsContainer');
    if (!container) return;

    getInitialModuleAndQuery();
    syncTopbarWithModule();

    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchQuery) {
      searchInput.value = searchQuery;
    }

    const topBackBtn = document.getElementById('topBackBtn');
    if (topBackBtn) {
      topBackBtn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        const switcher = document.getElementById('modeSwitcher');
        if (switcher) switcher.classList.toggle('collapsed');
      });
    }

    document.querySelectorAll('.mode-pill[data-mod]').forEach(btn => {
      btn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        currentModule = btn.dataset.mod;
        try {
          if (window.localStorage) window.localStorage.setItem('APPTV_CURRENT_MOD', currentModule);
        } catch (e) {}
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        syncTopbarWithModule();
        renderAllSections();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        renderAllSections();
      });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        searchQuery = (searchInput.value || '').trim().toLowerCase();
        renderAllSections();
      });
    }

    const txtFileInput = document.getElementById('txtFileInput');
    if (txtFileInput) {
      txtFileInput.addEventListener('change', (e) => {
        ns.DataLoader.handleManualFileUpload(e.target.files, renderAllSections);
      });
    }

    const bgmBtn = document.getElementById('toggleBgmBtn');
    if (bgmBtn) {
      bgmBtn.addEventListener('click', () => ns.Media.toggleBgm(bgmBtn, 'bg_lesson'));
    }

    // NÚT PLAY XANH LÁ: Tự động mở bài học MỚI tiếp theo mà bé chưa học xong
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
      quickPlayBtn.addEventListener('click', () => {
        const categories = ns.DataLoader.STORE[currentModule] || [];
        const nextLesson = ns.Progress
          ? ns.Progress.getNextUncompletedLesson(currentModule, categories)
          : (categories[0] && categories[0].lessons ? categories[0].lessons[0] : null);

        if (nextLesson) {
          ns.LessonPlayer.openLesson(nextLesson, currentModule, nextLesson._catName);
        }
      });
    }

    const closeStageBtn = document.getElementById('closeStageBtn');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const replayStepBtn = document.getElementById('replayStepBtn');

    if (closeStageBtn) closeStageBtn.onclick = ns.LessonPlayer.closeStage;
    if (prevStepBtn) prevStepBtn.onclick = ns.LessonPlayer.prevStep;
    if (nextStepBtn) nextStepBtn.onclick = ns.LessonPlayer.nextStep;
    if (replayStepBtn) replayStepBtn.onclick = ns.LessonPlayer.replayStep;

    ns.DataLoader.loadAllTxtFiles(() => {
      renderAllSections();
      ns.Media.playBgm('bg_lesson');
    });
  }

  function syncTopbarWithModule() {
    const titles = {
      data: 'Tập đọc',
      write: 'Tập viết chữ ô ly',
      thinking: 'Tư duy ngôn ngữ',
      games: 'Trò chơi'
    };
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) {
      titleEl.textContent = titles[currentModule] || 'Bé Học Tiếng Việt';
    }

    document.querySelectorAll('.mode-pill[data-mod]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mod === currentModule);
    });

    const isThinking = currentModule === 'thinking';
    const searchSec = document.getElementById('searchSection');
    const cloudFoot = document.getElementById('cloudFooter');
    if (searchSec) searchSec.classList.toggle('hidden', isThinking);
    if (cloudFoot) cloudFoot.classList.toggle('hidden', isThinking);
  }

  function renderAllSections() {
    const container = document.getElementById('sectionsContainer');
    if (!container) return;
    container.innerHTML = '';

    ns.Media.playBgm('bg_lesson');

    const categories = ns.DataLoader.STORE[currentModule] || [];
    if (categories.length === 0) {
      container.innerHTML = `
        <div class="category-panel" style="text-align:center; padding:36px 16px;">
          <div class="ribbon-banner">Thông báo</div>
          <p style="margin-top:14px; font-size:1.1rem; line-height:1.6; color:#e0f2fe;">
            Chưa nạp dữ liệu <b>${currentModule}.txt</b>.<br/>
            Hãy chạm vào biểu tượng <b>chú heo vàng 🐖</b> ở góc trên bên phải để chọn 4 file
            <code>data.txt, write.txt, thinking.txt, games.txt</code>.
          </p>
        </div>`;
      return;
    }

    // Cập nhật tooltip cho nút Play để biết bài học mới sắp mở
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    const nextToPlay = ns.Progress
      ? ns.Progress.getNextUncompletedLesson(currentModule, categories)
      : null;
    if (quickPlayBtn && nextToPlay) {
      quickPlayBtn.title = `Học tiếp: ${nextToPlay.name}`;
    }

    if (currentModule === 'thinking') {
      const allItems = [];
      categories.forEach(cat => {
        (cat.lessons || []).forEach(l => {
          l._catName = cat.name;
          l._module = currentModule;
          allItems.push({ lesson: l, catName: cat.name });
        });
      });

      allItems.forEach(({ lesson, catName }) => {
        if (searchQuery && !lesson.name.toLowerCase().includes(searchQuery)) return;
        const isDone = ns.Progress && ns.Progress.isCompleted(currentModule, lesson, catName);

        const panel = document.createElement('div');
        panel.className = 'category-panel thinking-panel';

        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon-banner';
        ribbon.textContent = (isDone ? '✅ ' : '') + lesson.name;

        const illus = document.createElement('div');
        illus.className = 'thinking-illustration';
        if (lesson.thumb) {
          illus.appendChild(ns.Media.createSmartSvgElement(lesson.thumb, lesson.name));
        }

        panel.appendChild(ribbon);
        panel.appendChild(illus);
        panel.onclick = () => ns.LessonPlayer.openLesson(lesson, currentModule, catName);
        container.appendChild(panel);
      });
      return;
    }

    categories.forEach((cat) => {
      const lessons = (cat.lessons || []).filter(l => {
        if (!searchQuery) return true;
        return (l.name || '').toLowerCase().includes(searchQuery) ||
               (l.thumb || '').toLowerCase().includes(searchQuery);
      });

      if (lessons.length === 0) return;

      const panel = document.createElement('div');
      panel.className = 'category-panel';

      const ribbon = document.createElement('div');
      ribbon.className = 'ribbon-banner';
      ribbon.textContent = cat.name;
      panel.appendChild(ribbon);

      const grid = document.createElement('div');
      grid.className = 'panel-grid';

      lessons.forEach((lesson, idx) => {
        lesson._catName = cat.name;
        lesson._module = currentModule;

        const isDone = ns.Progress && ns.Progress.isCompleted(currentModule, lesson, cat.name);
        const themeClass = CARD_THEMES[idx % CARD_THEMES.length];
        const card = document.createElement('div');
        card.className = `lesson-card ${themeClass}`;

        const whiteBox = document.createElement('div');
        const isWritingStroke = currentModule === 'write' &&
          lesson.thumb && lesson.thumb.toLowerCase().includes('writing/');
        whiteBox.className = 'lesson-white-box' + (isWritingStroke ? ' oly-grid-bg' : '');

        // Nếu bài ĐÃ học xong -> bỏ ổ khóa, thay bằng dấu tích xanh hoàn thành
        // Nếu bài CHƯA học xong -> giữ ổ khóa vàng
        if (isDone) {
          whiteBox.appendChild(createDoneBadgeSvg());
        } else {
          whiteBox.appendChild(createLockBadgeSvg());
        }

        if (lesson.thumb && (lesson.thumb.includes('/') || lesson.thumb.endsWith('.svg'))) {
          whiteBox.appendChild(ns.Media.createSmartSvgElement(lesson.thumb, lesson.name));
        } else {
          const fb = document.createElement('div');
          fb.className = 'thumb-fallback';
          fb.textContent = (lesson.thumb || lesson.name || '?').replace(/_/g, '');
          whiteBox.appendChild(fb);
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = 'lesson-title';
        titleDiv.textContent = lesson.name;

        card.appendChild(whiteBox);
        card.appendChild(titleDiv);
        card.onclick = () => ns.LessonPlayer.openLesson(lesson, currentModule, cat.name);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
      container.appendChild(panel);
    });
  }

  ns.MainApp = {
    renderAllSections,
    syncTopbarWithModule
  };

  document.addEventListener('DOMContentLoaded', initApp);
})(window.AppTV);
