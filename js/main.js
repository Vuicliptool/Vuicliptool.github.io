/**
 * js/main.js
 * Điều phối danh sách bài học trên lessons.html:
 *  - Đồng bộ màu sắc & thanh tiến độ trực tiếp theo từng môn (Tập đọc / Tập viết / Tư duy / Trò chơi)
 *  - Bỏ ổ khóa cho bài đã học xong, gắn nhãn nổi bật [▶ Học tiếp] cho bài mới tiếp theo
 *  - Nút Play dưới đáy hiển thị tên bài tiếp theo và mở thẳng vào bài chưa hoàn thành
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let currentModule = 'data';
  let searchQuery = '';

  const CARD_THEMES = ['theme-blue', 'theme-yellow', 'theme-green'];

  const MODULE_META = {
    data:     { title: '📖 Tập đọc' },
    write:    { title: '✍️ Tập viết ô ly' },
    thinking: { title: '🧠 Tư duy ngôn ngữ' },
    games:    { title: '🎮 Trò chơi' }
  };

  /**
   * Đọc môn học & từ khóa tìm kiếm từ URL (?mod=...&q=...), hash (#...) hoặc localStorage
   */
  function getInitialModuleAndQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      const modParam = params.get('mod');
      const qParam = params.get('q');
      if (modParam && MODULE_META[modParam]) currentModule = modParam;
      if (qParam) searchQuery = qParam.trim().toLowerCase();
    } catch (e) {}

    if (window.location.hash) {
      const h = window.location.hash.replace(/^#/, '').trim();
      if (MODULE_META[h]) currentModule = h;
    }

    try {
      if (window.localStorage) {
        const savedMod = window.localStorage.getItem('APPTV_CURRENT_MOD');
        if (!window.location.search && !window.location.hash && savedMod && MODULE_META[savedMod]) {
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

  function syncClearSearchBtn() {
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
  }

  /**
   * Cập nhật huy hiệu tiến độ trên thanh tiêu đề (⭐ X / Y bài)
   */
  function updateModuleProgressHeader(categories) {
    let total = 0;
    let done = 0;
    (categories || []).forEach((cat) => {
      (cat.lessons || []).forEach((lesson) => {
        total++;
        if (ns.Progress && ns.Progress.isCompleted(currentModule, lesson, cat.name)) {
          done++;
        }
      });
    });

    const textEl = document.getElementById('modProgressText');
    const fillEl = document.getElementById('modProgressFill');
    if (textEl) textEl.textContent = `${done} / ${total} bài`;
    if (fillEl) {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      fillEl.style.width = `${pct}%`;
    }
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
    syncClearSearchBtn();

    // Chuyển nhanh giữa 4 môn ngay trên trang lessons.html
    document.querySelectorAll('.mode-pill[data-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        currentModule = btn.dataset.mod;
        try {
          if (window.localStorage) window.localStorage.setItem('APPTV_CURRENT_MOD', currentModule);
        } catch (e) {}
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        syncClearSearchBtn();
        syncTopbarWithModule();
        renderAllSections();

        const mainEl = document.getElementById('mainContainer');
        if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Ô tìm kiếm & nút xóa nhanh từ khóa
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        syncClearSearchBtn();
        renderAllSections();
      });
    }

    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        syncClearSearchBtn();
        renderAllSections();
        searchInput.focus();
      });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        searchQuery = (searchInput.value || '').trim().toLowerCase();
        syncClearSearchBtn();
        renderAllSections();
      });
    }

    // Nạp thủ công 4 file .txt dự phòng
    const txtFileInput = document.getElementById('txtFileInput');
    if (txtFileInput) {
      txtFileInput.addEventListener('change', (e) => {
        ns.DataLoader.handleManualFileUpload(e.target.files, renderAllSections);
      });
    }

    // Nút Bật/Tắt nhạc nền (Sounds/bg_lesson.mp3)
    const bgmBtn = document.getElementById('toggleBgmBtn');
    if (bgmBtn) {
      bgmBtn.addEventListener('click', () => ns.Media.toggleBgm(bgmBtn, 'bg_lesson'));
    }

    // NÚT PLAY THÔNG MINH: Mở ngay bài học MỚI tiếp theo mà bé chưa hoàn thành
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

    // Gắn sự kiện điều khiển màn hình học (Modal)
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
    document.body.setAttribute('data-mod', currentModule);

    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) {
      titleEl.textContent = (MODULE_META[currentModule] && MODULE_META[currentModule].title) || 'Bé Học Tiếng Việt';
    }

    document.querySelectorAll('.mode-pill[data-mod]').forEach((btn) => {
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
    updateModuleProgressHeader(categories);

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="empty-search-card">
          <div style="font-size:2.4rem; margin-bottom:8px;">🐖</div>
          <h3 style="color:#0369a1; margin-bottom:6px;">Chưa nạp dữ liệu ${currentModule}.txt</h3>
          <p style="font-size:0.95rem; line-height:1.5;">
            Chạm vào biểu tượng chú heo ở góc trên bên phải để chọn 4 file
            <code>data.txt, write.txt, thinking.txt, games.txt</code>.
          </p>
        </div>`;
      return;
    }

    // Xác định bài học MỚI tiếp theo để hiển thị nhãn nổi bật [▶ Học tiếp] & cập nhật nút Play
    const nextToPlay = ns.Progress
      ? ns.Progress.getNextUncompletedLesson(currentModule, categories)
      : null;

    const quickPlayBtn = document.getElementById('quickPlayBtn');
    const quickPlayLabel = document.getElementById('quickPlayLabel');
    if (nextToPlay) {
      if (quickPlayBtn) quickPlayBtn.title = `Học tiếp: ${nextToPlay.name}`;
      if (quickPlayLabel) quickPlayLabel.textContent = `▶ Học tiếp: ${nextToPlay.name}`;
    } else if (quickPlayLabel) {
      quickPlayLabel.textContent = '▶ Học ngay!';
    }

    // Chế độ Tư duy ngôn ngữ: hiển thị thẻ rộng minh họa trực quan
    if (currentModule === 'thinking') {
      const allItems = [];
      categories.forEach((cat) => {
        (cat.lessons || []).forEach((l) => {
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

    // Các môn Tập đọc, Tập viết ô ly, Trò chơi: nhóm theo từng khung ruy-băng chủ đề
    let renderedCards = 0;

    categories.forEach((cat) => {
      const allInCat = cat.lessons || [];
      const doneInCat = allInCat.filter(
        (l) => ns.Progress && ns.Progress.isCompleted(currentModule, l, cat.name)
      ).length;

      const lessons = allInCat.filter((l) => {
        if (!searchQuery) return true;
        return (l.name || '').toLowerCase().includes(searchQuery) ||
               (l.thumb || '').toLowerCase().includes(searchQuery);
      });

      if (lessons.length === 0) return;

      const panel = document.createElement('div');
      panel.className = 'category-panel';

      const ribbon = document.createElement('div');
      ribbon.className = 'ribbon-banner';
      ribbon.innerHTML = `<span>${cat.name}</span><span class="cat-count-chip">${doneInCat}/${allInCat.length}</span>`;
      panel.appendChild(ribbon);

      const grid = document.createElement('div');
      grid.className = 'panel-grid';

      lessons.forEach((lesson, idx) => {
        renderedCards++;
        lesson._catName = cat.name;
        lesson._module = currentModule;

        const isDone = ns.Progress && ns.Progress.isCompleted(currentModule, lesson, cat.name);
        const isNextUp = !isDone && nextToPlay && nextToPlay.name === lesson.name && nextToPlay._catName === cat.name;

        const themeClass = CARD_THEMES[idx % CARD_THEMES.length];
        const card = document.createElement('div');
        card.className = `lesson-card ${themeClass}` + (isNextUp ? ' is-next-lesson' : '');

        if (isNextUp) {
          const nextTag = document.createElement('div');
          nextTag.className = 'next-up-tag';
          nextTag.textContent = '▶ Học tiếp';
          card.appendChild(nextTag);
        }

        const whiteBox = document.createElement('div');
        const isWritingStroke = currentModule === 'write' &&
          lesson.thumb && lesson.thumb.toLowerCase().includes('writing/');
        whiteBox.className = 'lesson-white-box' + (isWritingStroke ? ' oly-grid-bg' : '');

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

    // Hiện thông báo thân thiện nếu tìm kiếm không khớp bài nào
    if (renderedCards === 0 && searchQuery) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-search-card';
      emptyBox.innerHTML = `
        <div style="font-size:2.4rem; margin-bottom:6px;">🔍</div>
        <h3 style="color:#0369a1; margin-bottom:6px;">Không tìm thấy bài "${searchQuery}"</h3>
        <p style="font-size:0.92rem;">Bé thử tìm chữ cái khác hoặc bấm nút bên dưới để xem tất cả bài nhé!</p>
        <button type="button" class="empty-search-btn" id="resetSearchEmptyBtn">Xem lại tất cả bài</button>
      `;
      emptyBox.querySelector('#resetSearchEmptyBtn').onclick = () => {
        searchQuery = '';
        const si = document.getElementById('searchInput');
        if (si) si.value = '';
        syncClearSearchBtn();
        renderAllSections();
      };
      container.appendChild(emptyBox);
    }
  }

  ns.MainApp = {
    renderAllSections,
    syncTopbarWithModule
  };

  document.addEventListener('DOMContentLoaded', initApp);
})(window.AppTV);
