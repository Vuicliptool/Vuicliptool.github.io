/**
 * js/sgk-player.js
 * Điều phối nhánh học theo Sách Giáo Khoa Tiếng Việt 1 - Tập Một (Kết nối tri thức với cuộc sống)
 *  - Tải toàn bộ mục lục 17 tuần / 85 bài từ data/sgk_tv1_tap1.json
 *  - Liên kết trực tiếp tới nguồn sách điện tử chính thức Hành Trang Số (NXB Giáo dục Việt Nam — 0% quảng cáo)
 *  - Tái sử dụng 100% âm thanh Sounds/hanoi/, bảng tập viết 3 cấp độ (WritingBoard),
 *    6 trò chơi XAML (GamesEngine) và màn hình Hoàn thành (lesson_completed.xaml + star3.xaml)
 *  - Lưu tiến độ riêng vào localStorage (APPTV_SGK1_PROGRESS_V1)
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const SGK_PROGRESS_KEY = 'APPTV_SGK1_PROGRESS_V1';
  const FULLSCREEN_GAMES = new Set([
    'select apple', 'select balloon', 'select crab', 'select octopus', 'bee',
    'puzzle1', 'dauthanh', 'dongthungchai', 'goal', 'mole', 'memory', 'racing', 'box matching'
  ]);
  const CARD_THEMES = ['theme-blue', 'theme-yellow', 'theme-green'];

  let sgkData = null;
  let allFlatLessons = [];
  let selectedWeek = 'all';
  let searchQuery = '';

  // Trạng thái màn hình học bài
  let currentLesson = null;
  let currentStages = [];
  let currentStageIdx = 0;
  let runToken = 0;
  let activeCleanup = null;
  let completeWidgets = [];

  // ===== 1. LƯU TIẾN ĐỘ SGK (localStorage) =====
  function loadCompletedIds() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(SGK_PROGRESS_KEY) : null;
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    return [];
  }

  function isLessonDone(lessonId) {
    return loadCompletedIds().includes(lessonId);
  }

  function markLessonDone(lessonId) {
    if (!lessonId) return;
    const list = loadCompletedIds();
    if (!list.includes(lessonId)) {
      list.push(lessonId);
      try {
        if (window.localStorage) {
          window.localStorage.setItem(SGK_PROGRESS_KEY, JSON.stringify(list));
        }
      } catch (e) {}
    }
  }

  function getNextUncompletedLesson() {
    if (allFlatLessons.length === 0) return null;
    const doneSet = new Set(loadCompletedIds());
    for (const l of allFlatLessons) {
      if (!doneSet.has(l.id)) return l;
    }
    return allFlatLessons[0];
  }

  function getFollowingLesson(curLesson) {
    if (!curLesson) return null;
    const idx = allFlatLessons.findIndex(l => l.id === curLesson.id);
    if (idx >= 0 && idx < allFlatLessons.length - 1) {
      return allFlatLessons[idx + 1];
    }
    return null;
  }

  // ===== 2. TẢI DỮ LIỆU SGK =====
  async function loadSgkJson() {
    const candidates = [
      'data/sgk_tv1_tap1.json',
      'assets/data/sgk_tv1_tap1.json',
      'sgk_tv1_tap1.json'
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
    }
    return null;
  }

  // ===== 3. RENDER MỤC LỤC THEO TUẦN & TIẾN ĐỘ =====
  function createLockBadgeSvg() {
    const div = document.createElement('div');
    div.className = 'lock-badge';
    div.innerHTML = `
      <svg viewBox="0 0 64 64" width="26" height="26">
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
    div.style.transform = 'none';
    div.innerHTML = `
      <svg viewBox="0 0 64 64" width="26" height="26">
        <circle cx="32" cy="32" r="26" fill="#22c55e" stroke="#ffffff" stroke-width="4"/>
        <path d="M20 33l8 8 16-18" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    return div;
  }

  function updateHeaderProgress() {
    const total = allFlatLessons.length;
    const done = loadCompletedIds().length;
    const textEl = document.getElementById('sgkProgressText');
    const fillEl = document.getElementById('sgkProgressFill');
    if (textEl) textEl.textContent = `${done} / ${total} bài`;
    if (fillEl) {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      fillEl.style.width = `${pct}%`;
    }
  }

  function renderWeekTabs() {
    const tabsEl = document.getElementById('sgkWeekTabs');
    if (!tabsEl || !sgkData) return;
    tabsEl.innerHTML = '';

    const tabItems = [{ key: 'all', label: '📚 Tất cả' }];
    sgkData.weeks.forEach(w => {
      tabItems.push({
        key: String(w.week),
        label: w.week === 0 ? '🎒 Khởi động' : `Tuần ${w.week}`
      });
    });

    tabItems.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'week-tab-btn' + (selectedWeek === item.key ? ' active' : '');
      btn.textContent = item.label;
      btn.onclick = () => {
        if (ns.Media) ns.Media.playEffect('button');
        selectedWeek = item.key;
        renderWeekTabs();
        renderSgkList();
        const main = document.getElementById('sgkMainContainer');
        if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
      };
      tabsEl.appendChild(btn);
    });
  }

  function renderSgkList() {
    const container = document.getElementById('sgkSectionsContainer');
    if (!container) return;
    container.innerHTML = '';

    updateHeaderProgress();

    if (!sgkData || !Array.isArray(sgkData.weeks)) {
      container.innerHTML = `
        <div class="empty-search-card">
          <div style="font-size:2.4rem; margin-bottom:8px;">📚</div>
          <h3 style="color:#0369a1; margin-bottom:6px;">Chưa tải được dữ liệu SGK</h3>
          <p style="font-size:0.92rem;">Hãy đảm bảo file <code>data/sgk_tv1_tap1.json</code> đã được đẩy lên GitHub Pages hoặc mở qua máy chủ cục bộ Termux.</p>
        </div>
      `;
      return;
    }

    const nextLesson = getNextUncompletedLesson();
    const playLabel = document.getElementById('sgkQuickPlayLabel');
    if (playLabel && nextLesson) {
      playLabel.textContent = `▶ Học tiếp: ${nextLesson.code} (${nextLesson.content})`;
    }

    const doneSet = new Set(loadCompletedIds());
    let renderedCount = 0;

    sgkData.weeks.forEach(weekObj => {
      if (selectedWeek !== 'all' && String(weekObj.week) !== selectedWeek) return;

      const allInWeek = weekObj.lessons || [];
      const doneInWeek = allInWeek.filter(l => doneSet.has(l.id)).length;

      const filtered = allInWeek.filter(l => {
        if (!searchQuery) return true;
        const hay = `${l.code} ${l.content} trang ${l.bookPage}`.toLowerCase();
        return hay.includes(searchQuery);
      });

      if (filtered.length === 0) return;

      const panel = document.createElement('div');
      panel.className = 'category-panel';

      const ribbon = document.createElement('div');
      ribbon.className = 'ribbon-banner';
      ribbon.innerHTML = `<span>${weekObj.title}</span><span class="cat-count-chip">${doneInWeek}/${allInWeek.length}</span>`;
      panel.appendChild(ribbon);

      const grid = document.createElement('div');
      grid.className = 'panel-grid';

      filtered.forEach((lesson, idx) => {
        renderedCount++;
        const isDone = doneSet.has(lesson.id);
        const isNext = !isDone && nextLesson && nextLesson.id === lesson.id;
        const themeClass = CARD_THEMES[idx % CARD_THEMES.length];

        const card = document.createElement('div');
        card.className = `lesson-card sgk-lesson-card ${themeClass}` + (isNext ? ' is-next-lesson' : '');

        if (isNext) {
          const tag = document.createElement('div');
          tag.className = 'next-up-tag';
          tag.textContent = '▶ Học tiếp';
          card.appendChild(tag);
        }

        const whiteBox = document.createElement('div');
        whiteBox.className = 'lesson-white-box';

        const codeChip = document.createElement('div');
        codeChip.className = 'sgk-card-code';
        codeChip.textContent = lesson.code;
        whiteBox.appendChild(codeChip);

        whiteBox.appendChild(isDone ? createDoneBadgeSvg() : createLockBadgeSvg());

        const mainTxt = document.createElement('div');
        let txtClass = 'sgk-card-main-text';
        if (lesson.isReview) txtClass += ' review';
        else if ((lesson.content || '').length > 10) txtClass += ' long';
        mainTxt.className = txtClass;
        mainTxt.textContent = lesson.content;
        whiteBox.appendChild(mainTxt);

        const pageChip = document.createElement('div');
        pageChip.className = 'sgk-page-chip';
        pageChip.textContent = `Tr.${lesson.bookPage}`;
        whiteBox.appendChild(pageChip);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'lesson-title';
        titleDiv.textContent = lesson.title;

        card.appendChild(whiteBox);
        card.appendChild(titleDiv);
        card.onclick = () => openSgkLesson(lesson);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
      container.appendChild(panel);
    });

    if (renderedCount === 0 && searchQuery) {
      const empty = document.createElement('div');
      empty.className = 'empty-search-card';
      empty.innerHTML = `
        <div style="font-size:2.4rem; margin-bottom:6px;">🔍</div>
        <h3 style="color:#0369a1; margin-bottom:6px;">Không tìm thấy "${searchQuery}"</h3>
        <button type="button" class="empty-search-btn" id="sgkEmptyResetBtn">Xem lại toàn bộ mục lục</button>
      `;
      empty.querySelector('#sgkEmptyResetBtn').onclick = () => {
        searchQuery = '';
        const inp = document.getElementById('sgkSearchInput');
        if (inp) inp.value = '';
        syncClearBtn();
        renderSgkList();
      };
      container.appendChild(empty);
    }
  }

  // ===== 4. TRÌNH XEM SÁCH LAI THÔNG MINH (ƯU TIÊN ẢNH NỘI BỘ -> DỰ PHÒNG ĐÚNG TRANG KHÔNG CẦN ĐĂNG NHẬP) =====
  const DEFAULT_FLIP_BASE = 'https://online.fliphtml5.com/vjzyu/qbtq/';
  let currentViewerBookPage = 14;
  let currentViewerLessonCode = '';
  let currentZoomPercent = 100;
  let viewerLoadSeq = 0;

  function getFlipBaseUrl() {
    let base = (sgkData && sgkData.flipBaseUrl) || DEFAULT_FLIP_BASE;
    if (!base.endsWith('/')) base += '/';
    return base;
  }

  function getExactFlipUrl(bookPageNum) {
    const offset = (sgkData && typeof sgkData.pageOffset === 'number') ? sgkData.pageOffset : 1;
    const flipPage = Math.max(1, (Number(bookPageNum) || 1) + offset);
    return `${getFlipBaseUrl()}#p=${flipPage}`;
  }

  function applyBookZoom() {
    const img = document.getElementById('sgkBookPageImg');
    if (!img) return;
    img.style.width = `${currentZoomPercent}%`;
    img.style.maxWidth = currentZoomPercent > 100 ? 'none' : '100%';
  }

  function updateViewerHeaderAndNav(bookPageNum) {
    const titleEl = document.getElementById('sgkBookModalTitle');
    const counterEl = document.getElementById('sgkPageCounter');
    const extLink = document.getElementById('sgkBookExternalLink');
    const prevBtn = document.getElementById('sgkPrevPageBtn');
    const nextBtn = document.getElementById('sgkNextPageBtn');

    if (titleEl) {
      titleEl.textContent = currentViewerLessonCode
        ? `📖 ${currentViewerLessonCode} — Trang ${bookPageNum}`
        : `📖 SGK Lớp 1 — Trang ${bookPageNum}`;
    }
    if (counterEl) counterEl.textContent = `Trang ${bookPageNum} / 183`;
    if (extLink) extLink.href = getExactFlipUrl(bookPageNum);
    if (prevBtn) prevBtn.disabled = bookPageNum <= 1;
    if (nextBtn) nextBtn.disabled = bookPageNum >= 183;
  }

  function showExactPageIframe(bookPageNum, seq) {
    const frameWrap = document.getElementById('sgkBookFrameWrap');
    const readerWrap = document.getElementById('sgkBookReaderWrap');
    const zoomTools = document.getElementById('sgkLocalZoomTools');
    const iframe = document.getElementById('sgkBookIframe');

    if (readerWrap) readerWrap.style.display = 'none';
    if (zoomTools) zoomTools.style.display = 'none';
    if (frameWrap) frameWrap.style.display = 'block';

    if (iframe) {
      // Đổi src thẳng tới đúng số trang #p=... (không cần đăng nhập, khóa nhảy quảng cáo bằng sandbox)
      iframe.src = 'about:blank';
      const targetUrl = getExactFlipUrl(bookPageNum);
      setTimeout(() => {
        if (seq !== undefined && seq !== viewerLoadSeq) return;
        iframe.src = targetUrl;
      }, 30);
    }
  }

  /**
   * Tự động thử nạp ảnh nội bộ ở data/sgk1_pages/p{trang}.webp (hoặc .jpg) trước:
   * - Nếu có ảnh nội bộ: hiển thị ảnh sắc nét 0% quảng cáo, phóng to/thu nhỏ mượt, chạy offline.
   * - Nếu chưa có ảnh của trang này: tự chuyển sang đúng trang #p=... (không yêu cầu đăng nhập).
   */
  function renderBookPageHybrid(bookPageNum) {
    const mySeq = ++viewerLoadSeq;
    const pageNum = Math.max(1, Math.min(183, Number(bookPageNum) || 1));
    currentViewerBookPage = pageNum;
    updateViewerHeaderAndNav(pageNum);

    const dir = (sgkData && sgkData.localPagesDir) || 'data/sgk1_pages/';
    const frameWrap = document.getElementById('sgkBookFrameWrap');
    const readerWrap = document.getElementById('sgkBookReaderWrap');
    const zoomTools = document.getElementById('sgkLocalZoomTools');
    const imgEl = document.getElementById('sgkBookPageImg');
    const scroller = document.getElementById('sgkBookImgScroller');

    if (!imgEl) {
      showExactPageIframe(pageNum, mySeq);
      return;
    }

    const pad3 = String(pageNum).padStart(3, '0');
    const candidates = [
      `${dir}p${pad3}.webp`,
      `${dir}p${pageNum}.webp`,
      `${dir}p${pad3}.jpg`,
      `${dir}p${pageNum}.jpg`
    ];

    let idx = 0;
    const probe = new Image();
    probe.onload = () => {
      if (mySeq !== viewerLoadSeq) return;
      if (frameWrap) frameWrap.style.display = 'none';
      if (readerWrap) readerWrap.style.display = 'flex';
      if (zoomTools) zoomTools.style.display = 'flex';
      imgEl.src = probe.src;
      if (scroller) scroller.scrollTo({ top: 0, left: 0 });
      applyBookZoom();
    };
    probe.onerror = () => {
      if (mySeq !== viewerLoadSeq) return;
      if (idx < candidates.length) {
        probe.src = candidates[idx++];
      } else {
        showExactPageIframe(pageNum, mySeq);
      }
    };
    probe.src = candidates[idx++];
  }

  function openBookViewer(lesson) {
    if (!lesson) return;
    if (ns.Media) ns.Media.playEffect('button');

    currentViewerLessonCode = lesson.code || '';
    currentZoomPercent = 100;

    const modal = document.getElementById('sgkBookModal');
    if (modal) modal.classList.add('open');
    renderBookPageHybrid(lesson.bookPage || 14);
  }

  function closeBookViewer() {
    viewerLoadSeq++;
    const modal = document.getElementById('sgkBookModal');
    const iframe = document.getElementById('sgkBookIframe');
    if (modal) modal.classList.remove('open');
    if (iframe) iframe.src = 'about:blank';
  }

  // ===== 5. TRÌNH PHÁT BÀI HỌC SGK (3 CHẶNG: ĐỌC -> TẬP VIẾT Ô LY -> TRÒ CHƠI) =====
  function runCleanup() {
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) {}
      activeCleanup = null;
    }
  }

  function stopCompleteWidgets() {
    completeWidgets.forEach(w => { try { if (w && w.destroy) w.destroy(); } catch (e) {} });
    completeWidgets = [];
  }

  function setSmartFooter(visible) {
    const f = document.getElementById('sgkSmartFooter');
    if (f) f.classList.toggle('show', Boolean(visible));
  }

  function setHelpHandler(fn) {
    const btn = document.getElementById('sgkHelpBtn');
    if (!btn) return;
    if (typeof fn === 'function') {
      btn.style.display = 'flex';
      btn.onclick = () => {
        if (ns.Media) ns.Media.playEffect('button');
        fn();
      };
    } else {
      btn.style.display = 'none';
      btn.onclick = null;
    }
  }

  function buildStagesForLesson(lesson) {
    const stages = [];
    // Chặng 1: Nhận biết, đọc âm/vần, đọc tiếng và câu ứng dụng
    stages.push({ type: 'read', label: '1. Đọc' });
    // Chặng 2: Luyện viết ô ly cho các chữ/vần của bài (giữ tối đa 2 bảng để bé hứng thú)
    const svgs = Array.isArray(lesson.writingSvgs) ? lesson.writingSvgs.slice(0, 2) : [];
    svgs.forEach((svgPath, i) => {
      stages.push({
        type: 'write',
        svg: svgPath,
        label: svgs.length > 1 ? `2.${i + 1} Viết` : '2. Viết'
      });
    });
    // Chặng 3: Trò chơi củng cố (XAML)
    if (lesson.game) {
      stages.push({ type: 'game', gameStep: lesson.game, label: '3. Chơi' });
    }
    return stages;
  }

  function renderStepDots() {
    const dotsEl = document.getElementById('sgkStepDots');
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    currentStages.forEach((st, idx) => {
      const pill = document.createElement('span');
      pill.className = 'sgk-step-pill' +
        (idx === currentStageIdx ? ' active' : idx < currentStageIdx ? ' done' : '');
      pill.textContent = st.label;
      dotsEl.appendChild(pill);
    });
  }

  function openSgkLesson(lesson) {
    if (!lesson) return;
    if (ns.Media) {
      ns.Media.playEffect('button');
      ns.Media.stopBgm();
    }

    currentLesson = lesson;
    currentStages = buildStagesForLesson(lesson);
    currentStageIdx = 0;

    const titleEl = document.getElementById('sgkStageTitle');
    if (titleEl) titleEl.textContent = lesson.title;

    const bookBtn = document.getElementById('sgkOpenBookBtn');
    if (bookBtn) bookBtn.onclick = () => openBookViewer(lesson);

    document.getElementById('sgkStageOverlay').classList.add('open');
    renderCurrentStage();
  }

  function closeSgkStage() {
    runToken++;
    runCleanup();
    stopCompleteWidgets();
    if (ns.Media) ns.Media.stopActiveAudio();
    setSmartFooter(false);
    setHelpHandler(null);
    closeBookViewer();

    const compModal = document.getElementById('sgkCompleteModal');
    if (compModal) compModal.classList.remove('open');

    document.getElementById('sgkStageOverlay').classList.remove('open');
    renderSgkList();
    if (ns.Media) ns.Media.playBgm('bg_lesson');
  }

  function nextSgkStage() {
    if (currentStageIdx < currentStages.length - 1) {
      currentStageIdx++;
      renderCurrentStage();
    } else {
      showSgkCompletedModal();
    }
  }

  function renderCurrentStage() {
    const myToken = ++runToken;
    runCleanup();
    if (ns.Media) ns.Media.stopActiveAudio();
    setSmartFooter(false);
    setHelpHandler(null);
    renderStepDots();

    const body = document.getElementById('sgkStageBody');
    body.innerHTML = '';
    body.classList.remove('fullscreen-game');

    const st = currentStages[currentStageIdx];
    if (!st) {
      showSgkCompletedModal();
      return;
    }

    if (st.type === 'read') {
      renderReadStage(currentLesson, body, myToken);
    } else if (st.type === 'write') {
      renderWriteStage(st.svg, currentLesson.title, body, myToken);
    } else if (st.type === 'game') {
      const gType = (st.gameStep.game || '').toLowerCase().trim();
      if (FULLSCREEN_GAMES.has(gType)) {
        body.classList.add('fullscreen-game');
      }
      const ctrl = ns.GamesEngine.renderGameStep(st.gameStep, currentLesson, body, {
        onComplete() {
          if (myToken !== runToken) return;
          setSmartFooter(true);
        },
        setHelpHandler(fn) {
          if (myToken !== runToken) return;
          setHelpHandler(fn);
        }
      });
      if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
    }
  }

  /**
   * CHẶNG 1: Giao diện Đọc âm/vần, Đọc tiếng và Đọc câu tương tác theo SGK
   */
  function renderReadStage(lesson, container, token) {
    const board = document.createElement('div');
    board.className = 'sgk-read-board';

    // Khối 1: Âm / vần mới hôm nay
    const targetCard = document.createElement('div');
    targetCard.className = 'sgk-read-card';
    targetCard.innerHTML = `
      <div class="sgk-section-heading">
        <h3>🌟 Nhận biết & Đọc âm, vần (Trang ${lesson.bookPage})</h3>
        <button type="button" class="sgk-mini-speak" id="sgkOpenBookInline">📖 Xem trang sách</button>
      </div>
      <div class="sgk-target-row" id="sgkTargetRow"></div>
    `;
    targetCard.querySelector('#sgkOpenBookInline').onclick = () => openBookViewer(lesson);

    const targetRow = targetCard.querySelector('#sgkTargetRow');
    (lesson.targets || []).forEach(tk => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sgk-target-tile';
      btn.textContent = tk;
      btn.onclick = async () => {
        btn.classList.add('speaking');
        await ns.Media.playSoundToken(tk.toLowerCase());
        btn.classList.remove('speaking');
      };
      targetRow.appendChild(btn);
    });
    board.appendChild(targetCard);

    // Khối 2: Luyện đọc tiếng / từ ứng dụng
    const readCard = document.createElement('div');
    readCard.className = 'sgk-read-card';
    readCard.innerHTML = `
      <div class="sgk-section-heading">
        <h3>🗣️ Chạm vào từng tiếng để nghe đọc</h3>
        <button type="button" class="sgk-mini-speak" id="sgkReadAllBtn">🔊 Đọc tất cả</button>
      </div>
      <div class="sgk-syllable-grid" id="sgkSylGrid"></div>
    `;
    const sylGrid = readCard.querySelector('#sgkSylGrid');
    const sylButtons = [];
    (lesson.readItems || []).forEach(w => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sgk-syllable-btn';
      btn.textContent = w;
      btn.onclick = async () => {
        btn.classList.add('speaking');
        await ns.Media.playSoundToken(w.toLowerCase());
        btn.classList.remove('speaking');
      };
      sylGrid.appendChild(btn);
      sylButtons.push({ btn, word: w });
    });

    readCard.querySelector('#sgkReadAllBtn').onclick = async () => {
      for (const item of sylButtons) {
        if (token !== runToken) return;
        item.btn.classList.add('speaking');
        await ns.Media.playSoundToken(item.word.toLowerCase());
        item.btn.classList.remove('speaking');
      }
    };
    board.appendChild(readCard);

    // Khối 3: Câu đọc ứng dụng (chạm từng từ)
    if (lesson.sentence) {
      const sentCard = document.createElement('div');
      sentCard.className = 'sgk-read-card';
      sentCard.innerHTML = `
        <div class="sgk-section-heading">
          <h3>📖 Đọc câu ứng dụng</h3>
          <button type="button" class="sgk-mini-speak" id="sgkReadSentBtn">🔊 Đọc cả câu</button>
        </div>
        <div class="sgk-sentence-words" id="sgkSentWords"></div>
      `;
      const wordsWrap = sentCard.querySelector('#sgkSentWords');
      const rawWords = lesson.sentence.trim().split(/\s+/);
      const wordChips = [];

      rawWords.forEach(rw => {
        const cleanAudio = rw.replace(/[.,!?:;"“”]/g, '').toLowerCase();
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sgk-word-chip';
        chip.textContent = rw;
        chip.onclick = async () => {
          chip.classList.add('speaking');
          await ns.Media.playSoundToken(cleanAudio);
          chip.classList.remove('speaking');
        };
        wordsWrap.appendChild(chip);
        wordChips.push({ chip, cleanAudio });
      });

      sentCard.querySelector('#sgkReadSentBtn').onclick = async () => {
        for (const wc of wordChips) {
          if (token !== runToken) return;
          wc.chip.classList.add('speaking');
          await ns.Media.playSoundToken(wc.cleanAudio);
          wc.chip.classList.remove('speaking');
        }
      };
      board.appendChild(sentCard);
    }

    container.appendChild(board);
    // Ở chặng đọc tự do, luôn trượt sẵn thanh [Làm lại / Tiếp theo] để bé chuyển sang Tập viết khi sẵn sàng
    setSmartFooter(true);

    // Tự đọc âm/từ đầu tiên để chào bé vào bài
    if (lesson.targets && lesson.targets[0] && !lesson.isReview) {
      ns.Media.playSoundToken(lesson.targets[0].toLowerCase());
    }
  }

  /**
   * CHẶNG 2: Bảng tập viết ô ly thông minh (có nút đổi nhanh Cấp độ 1 / 2 / 3)
   */
  function renderWriteStage(svgPath, label, container, token) {
    let curLevel = 1;
    let boardCtrl = null;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%; display:flex; flex-direction:column; align-items:center;';

    const toolbar = document.createElement('div');
    toolbar.className = 'sgk-write-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="sgk-lvl-chip active" data-lvl="1">Cấp 1: Bàn tay mẫu</button>
      <button type="button" class="sgk-lvl-chip" data-lvl="2">Cấp 2: Tô nét mờ</button>
      <button type="button" class="sgk-lvl-chip" data-lvl="3">Cấp 3: Tự viết</button>
    `;

    const mount = document.createElement('div');
    mount.style.cssText = 'width:100%; display:flex; justify-content:center;';

    wrap.appendChild(toolbar);
    wrap.appendChild(mount);
    container.appendChild(wrap);

    function mountLevel(lvl) {
      if (boardCtrl && boardCtrl.destroy) boardCtrl.destroy();
      boardCtrl = null;
      setSmartFooter(false);
      curLevel = lvl;

      toolbar.querySelectorAll('.sgk-lvl-chip').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.lvl) === lvl);
      });

      ns.WritingBoard.renderWritingLevel(svgPath, label, lvl, mount, () => {
        if (token !== runToken) return;
        setSmartFooter(true);
      }).then(ctrl => {
        if (token !== runToken) {
          if (ctrl && ctrl.destroy) ctrl.destroy();
          return;
        }
        boardCtrl = ctrl;
      });
    }

    toolbar.querySelectorAll('.sgk-lvl-chip').forEach(btn => {
      btn.onclick = () => {
        if (ns.Media) ns.Media.playEffect('button');
        mountLevel(Number(btn.dataset.lvl));
      };
    });

    activeCleanup = () => {
      if (boardCtrl && boardCtrl.destroy) boardCtrl.destroy();
    };

    mountLevel(curLevel);
  }

  /**
   * MÀN HÌNH HOÀN THÀNH BÀI SGK (dùng lesson_completed.xaml + star3.xaml)
   */
  function showSgkCompletedModal() {
    if (currentLesson) markLessonDone(currentLesson.id);
    setSmartFooter(false);
    setHelpHandler(null);
    stopCompleteWidgets();

    if (ns.Media) {
      ns.Media.playEffect('lesson_complete');
      setTimeout(() => ns.Media.playEffect('star'), 450);
    }

    let modal = document.getElementById('sgkCompleteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sgkCompleteModal';
      modal.className = 'complete-overlay';
      modal.innerHTML = `
        <div class="complete-ribbon">Hoàn thành</div>
        <div class="complete-stars-row">
          <div class="complete-star-slot s1"></div>
          <div class="complete-star-slot s2"></div>
          <div class="complete-star-slot s3"></div>
        </div>
        <div class="complete-mascot-stage" id="sgkCompMascot"></div>
        <div class="complete-btn-row">
          <button type="button" class="complete-round-btn menu" id="sgkCompMenuBtn" title="Mục lục SGK">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round">
              <path d="M4 7h16M4 12h16M4 17h16"/>
            </svg>
          </button>
          <button type="button" class="complete-round-btn replay" id="sgkCompReplayBtn" title="Học lại bài này">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
          <button type="button" class="complete-round-btn next" id="sgkCompNextBtn" title="Bài SGK tiếp theo">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const nextLes = getFollowingLesson(currentLesson);
    const nextBtn = modal.querySelector('#sgkCompNextBtn');
    nextBtn.style.display = nextLes ? 'flex' : 'none';

    modal.querySelector('#sgkCompMenuBtn').onclick = () => {
      stopCompleteWidgets();
      modal.classList.remove('open');
      closeSgkStage();
    };
    modal.querySelector('#sgkCompReplayBtn').onclick = () => {
      stopCompleteWidgets();
      modal.classList.remove('open');
      openSgkLesson(currentLesson);
    };
    nextBtn.onclick = () => {
      stopCompleteWidgets();
      modal.classList.remove('open');
      if (nextLes) openSgkLesson(nextLes);
      else closeSgkStage();
    };

    modal.classList.add('open');

    const myTok = ++runToken;
    mountCompleteXaml(modal, myTok);
  }

  async function mountCompleteXaml(modal, token) {
    const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';
    const mascotEl = modal.querySelector('#sgkCompMascot');
    const starSlots = Array.from(modal.querySelectorAll('.complete-star-slot'));

    if (canUseXaml && mascotEl) {
      const mWidget = await ns.XamlParser.createInteractiveXaml('animations/lesson_completed.xaml', {
        viewBox: '60 0 280 400',
        textTargetName: null
      });
      if (token !== runToken || !modal.classList.contains('open')) {
        if (mWidget) mWidget.destroy();
        return;
      }
      mascotEl.innerHTML = '';
      if (mWidget) {
        mascotEl.appendChild(mWidget.svg);
        mWidget.playStoryboard('sb', { resetBefore: true, loop: true });
        completeWidgets.push(mWidget);
      }
    }

    for (let i = 0; i < starSlots.length; i++) {
      const slot = starSlots[i];
      let sWidget = null;
      if (canUseXaml) {
        sWidget = await ns.XamlParser.createInteractiveXaml('animations/star3.xaml', {
          viewBox: '0 0 400 400',
          textTargetName: null
        });
      }
      if (token !== runToken || !modal.classList.contains('open')) {
        if (sWidget) sWidget.destroy();
        return;
      }
      slot.innerHTML = '';
      if (sWidget) {
        slot.appendChild(sWidget.svg);
        setTimeout(() => {
          if (token === runToken && modal.classList.contains('open')) {
            sWidget.playStoryboard('sb', { resetBefore: true, loop: true });
          }
        }, i * 160);
        completeWidgets.push(sWidget);
      }
    }
  }

  // ===== 6. KHỞI TẠO TRANG SGK =====
  function syncClearBtn() {
    const cb = document.getElementById('sgkClearSearchBtn');
    if (cb) cb.style.display = searchQuery ? 'flex' : 'none';
  }

  async function initSgkApp() {
    const bgmBtn = document.getElementById('toggleBgmBtn');
    if (bgmBtn && ns.Media) {
      bgmBtn.addEventListener('click', () => ns.Media.toggleBgm(bgmBtn, 'bg_lesson'));
    }

    const searchInput = document.getElementById('sgkSearchInput');
    const clearBtn = document.getElementById('sgkClearSearchBtn');
    const searchBtn = document.getElementById('sgkSearchBtn');

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        syncClearBtn();
        renderSgkList();
      });
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        syncClearBtn();
        renderSgkList();
      });
    }
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        if (ns.Media) ns.Media.playEffect('button');
        searchQuery = (searchInput.value || '').trim().toLowerCase();
        syncClearBtn();
        renderSgkList();
      });
    }

    const quickPlayBtn = document.getElementById('sgkQuickPlayBtn');
    if (quickPlayBtn) {
      quickPlayBtn.addEventListener('click', () => {
        const nextL = getNextUncompletedLesson();
        if (nextL) openSgkLesson(nextL);
      });
    }

    document.getElementById('sgkCloseStageBtn').onclick = closeSgkStage;
    document.getElementById('sgkSmartReplayBtn').onclick = () => {
      if (ns.Media) ns.Media.playEffect('button');
      renderCurrentStage();
    };
    document.getElementById('sgkSmartNextBtn').onclick = () => {
      if (ns.Media) ns.Media.playEffect('button');
      nextSgkStage();
    };

    const bookModal = document.getElementById('sgkBookModal');
    const bookClose = document.getElementById('sgkBookCloseBtn');
    const prevPageBtn = document.getElementById('sgkPrevPageBtn');
    const nextPageBtn = document.getElementById('sgkNextPageBtn');
    const zoomInBtn = document.getElementById('sgkZoomInBtn');
    const zoomOutBtn = document.getElementById('sgkZoomOutBtn');

    if (bookClose) bookClose.onclick = closeBookViewer;
    if (bookModal) {
      bookModal.addEventListener('click', e => {
        if (e.target === bookModal) closeBookViewer();
      });
    }
    if (prevPageBtn) {
      prevPageBtn.onclick = () => {
        if (ns.Media) ns.Media.playEffect('button');
        renderBookPageHybrid(currentViewerBookPage - 1);
      };
    }
    if (nextPageBtn) {
      nextPageBtn.onclick = () => {
        if (ns.Media) ns.Media.playEffect('button');
        renderBookPageHybrid(currentViewerBookPage + 1);
      };
    }
    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        currentZoomPercent = Math.min(200, currentZoomPercent + 30);
        applyBookZoom();
      };
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        currentZoomPercent = Math.max(100, currentZoomPercent - 30);
        applyBookZoom();
      };
    }

    sgkData = await loadSgkJson();
    allFlatLessons = [];
    if (sgkData && Array.isArray(sgkData.weeks)) {
      sgkData.weeks.forEach(w => {
        (w.lessons || []).forEach(l => allFlatLessons.push(l));
      });
    }

    renderWeekTabs();
    renderSgkList();
    if (ns.Media) ns.Media.playBgm('bg_lesson');
  }

  document.addEventListener('DOMContentLoaded', initSgkApp);
})(window.AppTV);
