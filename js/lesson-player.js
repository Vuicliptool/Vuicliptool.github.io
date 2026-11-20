/**
 * js/lesson-player.js
 * Trình phát bài học thông minh cho cả Tập đọc (data.txt), Tập viết (write.txt), Tư duy & Trò chơi:
 *  - Gom đúng từng chặng (stage) trong intro[] để nhiều hoạt ảnh complex nối tiếp mượt mà
 *  - Ẩn toàn bộ nút khi đang giảng hoặc chơi; tự trượt [🔵 Làm lại] [🟢 Tiếp theo] khi xong chặng
 *  - Tự động hiện nút [?] góc trên phải trong các trò chơi để bé nghe lại câu hỏi bất cứ lúc nào
 *  - Màn hình [Hoàn thành] với 3 ngôi sao bay + 3 nút [Menu / Làm lại / Bài tiếp theo]
 *  - Lưu tiến độ mở khóa vào localStorage
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const STORAGE_KEY = 'APPTV_PROGRESS_V1';

  // ===== 1. QUẢN LÝ TIẾN ĐỘ & MỞ KHÓA BÀI HỌC =====
  function loadProgressMap() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function saveProgressMap(map) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      }
    } catch (e) {}
  }

  function getLessonKey(lesson, catName) {
    if (!lesson) return '';
    const c = (catName || lesson._catName || '').trim();
    const n = (lesson.name || '').trim();
    return c ? `${c}::${n}` : n;
  }

  const Progress = {
    isCompleted(mod, lesson, catName) {
      if (!mod || !lesson) return false;
      const map = loadProgressMap();
      const list = Array.isArray(map[mod]) ? map[mod] : [];
      return list.includes(getLessonKey(lesson, catName));
    },

    markCompleted(mod, lesson, catName) {
      if (!mod || !lesson) return;
      const map = loadProgressMap();
      if (!Array.isArray(map[mod])) map[mod] = [];
      const key = getLessonKey(lesson, catName);
      if (key && !map[mod].includes(key)) {
        map[mod].push(key);
        saveProgressMap(map);
      }
    },

    getNextUncompletedLesson(mod, categories) {
      if (!Array.isArray(categories) || categories.length === 0) return null;
      let firstLesson = null;
      for (const cat of categories) {
        const lessons = cat.lessons || [];
        for (const lesson of lessons) {
          lesson._catName = cat.name;
          lesson._module = mod;
          if (!firstLesson) firstLesson = lesson;
          if (!this.isCompleted(mod, lesson, cat.name)) return lesson;
        }
      }
      return firstLesson;
    },

    // Tìm bài học kế tiếp ngay sau bài hiện tại (dùng cho nút Tiếp theo ở màn hình Hoàn thành)
    getFollowingLesson(mod, currentLes) {
      const categories = (ns.DataLoader && ns.DataLoader.STORE[mod]) || [];
      const curKey = getLessonKey(currentLes, currentLes && currentLes._catName);
      let found = false;
      for (const cat of categories) {
        for (const l of (cat.lessons || [])) {
          l._catName = cat.name;
          l._module = mod;
          if (found) return l;
          if (getLessonKey(l, cat.name) === curKey) found = true;
        }
      }
      return null;
    }
  };

  ns.Progress = Progress;

  // ===== 2. TRÌNH PHÁT BÀI HỌC =====
  let currentLesson = null;
  let currentModule = 'data';
  let currentStages = [];
  let currentStageIdx = 0;
  let stepRunToken = 0;
  let activeCleanup = null;
  let currentHelpFn = null;

  const FULLSCREEN_GAMES = new Set([
    'select apple', 'select balloon', 'select crab', 'select octopus', 'bee',
    'puzzle1', 'dauthanh', 'dongthungchai', 'goal', 'mole', 'memory', 'racing'
  ]);

  function runActiveCleanup() {
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) {}
      activeCleanup = null;
    }
  }

  /**
   * Gom các chặng học theo đúng cấu trúc intro[] của data.txt & write.txt:
   * - Nếu 1 phần tử intro chứa nhiều hoạt ảnh `complex` -> gộp thành 1 stage `complex_group` chạy nối tiếp liền mạch!
   * - Nếu chứa `game` -> tách thành 1 stage `game` riêng.
   * - Các trường `write1`, `write2`, `write3`, `write1s` -> các stage `write_svg` cấp độ 1..3.
   */
  function extractStagesFromLesson(lesson) {
    const stages = [];
    if (Array.isArray(lesson.intro)) {
      lesson.intro.forEach(item => {
        const list = [];
        if (item.animation) list.push(item.animation);
        if (Array.isArray(item.animations)) list.push(...item.animations);

        let complexBuf = [];
        const flushComplex = () => {
          if (complexBuf.length > 0) {
            stages.push({ name: 'complex_group', items: complexBuf });
            complexBuf = [];
          }
        };

        list.forEach(a => {
          if (a && a.name === 'complex') {
            complexBuf.push(a);
          } else if (a) {
            flushComplex();
            stages.push(a);
          }
        });
        flushComplex();
      });
    }

    if (lesson.write1) stages.push({ name: 'write_svg', level: 1, svg: lesson.write1, label: lesson.name });
    if (lesson.write2) stages.push({ name: 'write_svg', level: 2, svg: lesson.write2, label: lesson.name });
    if (lesson.write3) stages.push({ name: 'write_svg', level: 3, svg: lesson.write3, label: lesson.name });

    if (Array.isArray(lesson.write1s)) {
      lesson.write1s.forEach(svgPath => {
        stages.push({ name: 'write_svg', level: 1, svg: svgPath, label: lesson.name });
      });
    }
    return stages;
  }

  function isSmartStageMode() {
    return currentModule === 'data' || currentModule === 'write' || currentModule === 'games';
  }

  function setSmartActionBar(visible) {
    const smartBar = document.getElementById('smartActionFooter');
    if (!smartBar) return;
    smartBar.classList.toggle('show', Boolean(visible));
  }

  function setHelpButton(fn) {
    currentHelpFn = typeof fn === 'function' ? fn : null;
    const helpBtn = document.getElementById('stageHelpBtn');
    if (!helpBtn) return;
    if (currentHelpFn) {
      helpBtn.style.display = 'flex';
      helpBtn.onclick = () => {
        ns.Media.playEffect('button');
        if (currentHelpFn) currentHelpFn();
      };
    } else {
      helpBtn.style.display = 'none';
      helpBtn.onclick = null;
    }
  }

  /**
   * Hộp thoại [🟡 Học lại] / [🟢 Tập viết] cho bài Tập viết
   */
  function showWriteModePicker(lesson, modName, catName, firstWriteIdx) {
    let modal = document.getElementById('writeModeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'writeModeModal';
      modal.className = 'write-mode-modal';
      modal.innerHTML = `
        <div class="write-mode-choices">
          <button type="button" class="mode-circle-choice yellow" id="pickLearnAgainBtn">
            <div class="circle-icon">📘</div>
            <span>Học lại</span>
          </button>
          <button type="button" class="mode-circle-choice green" id="pickWriteNowBtn">
            <div class="circle-icon">✍️</div>
            <span>Tập viết</span>
          </button>
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.querySelector('#pickLearnAgainBtn').onclick = () => {
      modal.classList.remove('open');
      startLessonAtStage(lesson, modName, catName, 0);
    };
    modal.querySelector('#pickWriteNowBtn').onclick = () => {
      modal.classList.remove('open');
      startLessonAtStage(lesson, modName, catName, firstWriteIdx);
    };
    modal.classList.add('open');
  }

  /**
   * Màn hình HOÀN THÀNH giống video (04:18–04:29):
   * Ruy-băng xanh lá "Hoàn thành", 3 ngôi sao bay có cánh + nhân vật vui vẻ + 3 nút tròn [Menu / Làm lại / Tiếp theo]
   */
  function showLessonCompletedScreen() {
    markCurrentLessonDone();
    setSmartActionBar(false);
    setHelpButton(null);
    ns.Media.playEffect('lesson_complete');
    setTimeout(() => ns.Media.playEffect('star'), 450);

    let modal = document.getElementById('lessonCompleteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lessonCompleteModal';
      modal.className = 'complete-overlay';
      modal.innerHTML = `
        <div class="complete-ribbon">Hoàn thành</div>

        <div class="complete-stars-row">
          <div class="flying-star s1">🪽⭐🪽</div>
          <div class="flying-star s2">🪽⭐🪽</div>
          <div class="flying-star s3">🪽⭐🪽</div>
        </div>

        <div class="complete-mascot">
          <svg viewBox="0 0 140 160" width="138" height="158">
            <circle cx="70" cy="46" r="28" fill="#fbd3b0" stroke="#92400e" stroke-width="2"/>
            <path d="M42,42 C44,14 96,14 98,42 C86,28 54,28 42,42 Z" fill="#1e293b"/>
            <circle cx="59" cy="46" r="3.5" fill="#0f172a"/>
            <circle cx="81" cy="46" r="3.5" fill="#0f172a"/>
            <path d="M58,56 Q70,68 82,56 Z" fill="#ef4444"/>
            <path d="M44,82 L18,98" stroke="#fbbf24" stroke-width="12" stroke-linecap="round"/>
            <path d="M96,82 L122,98" stroke="#fbbf24" stroke-width="12" stroke-linecap="round"/>
            <circle cx="15" cy="100" r="7" fill="#fbd3b0"/>
            <circle cx="125" cy="100" r="7" fill="#fbd3b0"/>
            <rect x="44" y="74" width="52" height="38" rx="12" fill="#f59e0b"/>
            <rect x="46" y="108" width="48" height="20" rx="6" fill="#2563eb"/>
            <line x1="56" y1="128" x2="54" y2="148" stroke="#fbd3b0" stroke-width="10" stroke-linecap="round"/>
            <line x1="84" y1="128" x2="86" y2="148" stroke="#fbd3b0" stroke-width="10" stroke-linecap="round"/>
            <ellipse cx="52" cy="152" rx="11" ry="6" fill="#0d9488"/>
            <ellipse cx="88" cy="152" rx="11" ry="6" fill="#0d9488"/>
          </svg>
        </div>

        <div class="complete-btn-row">
          <button type="button" class="complete-round-btn menu" id="compMenuBtn" title="Danh sách bài học">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round">
              <path d="M4 7h16M4 12h16M4 17h16"/>
            </svg>
          </button>
          <button type="button" class="complete-round-btn replay" id="compReplayBtn" title="Học lại bài này">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
          <button type="button" class="complete-round-btn next" id="compNextBtn" title="Bài học tiếp theo">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const nextLesson = Progress.getFollowingLesson(currentModule, currentLesson);
    const nextBtn = modal.querySelector('#compNextBtn');
    nextBtn.style.display = nextLesson ? 'flex' : 'none';

    modal.querySelector('#compMenuBtn').onclick = () => {
      modal.classList.remove('open');
      closeStage();
    };
    modal.querySelector('#compReplayBtn').onclick = () => {
      modal.classList.remove('open');
      startLessonAtStage(currentLesson, currentModule, currentLesson._catName, 0);
    };
    nextBtn.onclick = () => {
      modal.classList.remove('open');
      if (nextLesson) {
        startLessonAtStage(nextLesson, currentModule, nextLesson._catName, 0);
      } else {
        closeStage();
      }
    };

    modal.classList.add('open');
  }

  function openLesson(lesson, modName, catName) {
    ns.Media.playEffect('button');
    if (catName) lesson._catName = catName;
    if (modName) lesson._module = modName;

    const mod = modName || lesson._module || 'data';
    const stages = extractStagesFromLesson(lesson);
    const hasIntro = stages.some(s => s.name === 'complex_group');
    const firstWriteIdx = stages.findIndex(s => s.name === 'write_svg');

    if (mod === 'write' && hasIntro && firstWriteIdx > 0) {
      showWriteModePicker(lesson, mod, catName || lesson._catName, firstWriteIdx);
      return;
    }

    startLessonAtStage(lesson, mod, catName || lesson._catName, 0);
  }

  function startLessonAtStage(lesson, modName, catName, startIdx) {
    ns.Media.stopBgm();
    currentLesson = lesson;
    currentModule = modName || 'data';
    currentStages = extractStagesFromLesson(lesson);
    currentStageIdx = startIdx || 0;

    document.getElementById('stageTitle').textContent = lesson.name;
    document.getElementById('stageOverlay').classList.add('open');

    const smartReplay = document.getElementById('smartReplayBtn');
    const smartNext = document.getElementById('smartNextBtn');
    if (smartReplay) smartReplay.onclick = () => { ns.Media.playEffect('button'); renderCurrentStage(); };
    if (smartNext) smartNext.onclick = () => { ns.Media.playEffect('button'); nextStep(); };

    renderCurrentStage();
  }

  function markCurrentLessonDone() {
    if (currentLesson && currentModule) {
      Progress.markCompleted(currentModule, currentLesson, currentLesson._catName);
    }
  }

  function closeStage() {
    stepRunToken++;
    runActiveCleanup();
    ns.Media.stopActiveAudio();
    setSmartActionBar(false);
    setHelpButton(null);

    const compModal = document.getElementById('lessonCompleteModal');
    if (compModal) compModal.classList.remove('open');

    document.getElementById('stageOverlay').classList.remove('open');
    if (ns.MainApp && typeof ns.MainApp.renderAllSections === 'function') {
      ns.MainApp.renderAllSections();
    }
    ns.Media.playBgm('bg_lesson');
  }

  function prevStep() {
    if (currentStageIdx > 0) {
      currentStageIdx--;
      renderCurrentStage();
    }
  }

  function nextStep() {
    if (currentStageIdx < currentStages.length - 1) {
      currentStageIdx++;
      renderCurrentStage();
    } else {
      showLessonCompletedScreen();
    }
  }

  function renderCurrentStage() {
    stepRunToken++;
    const myToken = stepRunToken;
    runActiveCleanup();
    ns.Media.stopActiveAudio();
    setSmartActionBar(false);
    setHelpButton(null);

    const body = document.getElementById('stageBody');
    body.innerHTML = '';
    body.classList.remove('fullscreen-game');

    const smartMode = isSmartStageMode();
    const totalStages = Math.max(1, currentStages.length);
    const isLastStage = currentStageIdx >= currentStages.length - 1;

    const classicFooter = document.querySelector('.stage-footer');
    const replayTopBtn = document.getElementById('replayStepBtn');
    if (classicFooter) classicFooter.style.display = smartMode ? 'none' : 'flex';
    if (replayTopBtn) replayTopBtn.style.display = smartMode ? 'none' : 'inline-block';

    const indEl = document.getElementById('stepIndicator');
    if (indEl) indEl.textContent = `${currentStageIdx + 1} / ${totalStages}`;
    const prevBtn = document.getElementById('prevStepBtn');
    if (prevBtn) prevBtn.disabled = currentStageIdx === 0;
    const nextBtn = document.getElementById('nextStepBtn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = isLastStage ? '🎉 Hoàn thành' : 'Tiếp ➡';
    }

    const stage = currentStages[currentStageIdx];
    if (!stage) {
      body.innerHTML = '<div class="board-card"><p>Bài học đang trống.</p></div>';
      if (smartMode) setSmartActionBar(true);
      return;
    }

    if (stage.name === 'complex_group') {
      renderComplexGroup(stage.items, body, myToken, smartMode);
    } else if (stage.name === 'write_svg') {
      ns.WritingBoard.renderWritingLevel(
        stage.svg,
        stage.label,
        stage.level || 1,
        body,
        () => {
          if (myToken !== stepRunToken) return;
          if (isLastStage) markCurrentLessonDone();
          setSmartActionBar(true);
        }
      ).then(ctrl => {
        if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
      });
    } else if (stage.name === 'game') {
      const gameType = (stage.game || '').toLowerCase().trim();
      if (gameType === 'tapviet') {
        ns.WritingBoard.renderTapVietGame(stage, currentLesson, body, () => {
          if (myToken !== stepRunToken) return;
          markCurrentLessonDone();
          setSmartActionBar(true);
        }).then(ctrl => {
          if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
        });
      } else {
        if (FULLSCREEN_GAMES.has(gameType)) {
          body.classList.add('fullscreen-game');
        }
        const ctrl = ns.GamesEngine.renderGameStep(stage, currentLesson, body, {
          onComplete() {
            if (myToken !== stepRunToken) return;
            if (isLastStage) markCurrentLessonDone();
            if (smartMode) setSmartActionBar(true);
          },
          setHelpHandler(fn) {
            if (myToken !== stepRunToken) return;
            setHelpButton(fn);
          }
        });
        if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
      }
    }
  }

  /**
   * Chạy nối tiếp tất cả các hoạt ảnh `complex` trong 1 chặng (ví dụ: giới thiệu âm o + đọc to o)
   */
  async function renderComplexGroup(items, container, token, smartMode) {
    const card = document.createElement('div');
    card.className = 'reading-lecture-stage';

    const visualBox = document.createElement('div');
    visualBox.className = 'reading-visual-box';
    if (currentLesson.thumb && (currentLesson.thumb.includes('/') || currentLesson.thumb.endsWith('.svg'))) {
      visualBox.appendChild(ns.Media.createSmartSvgElement(currentLesson.thumb, currentLesson.name));
    }
    card.appendChild(visualBox);
    container.appendChild(card);

    for (const step of items) {
      if (token !== stepRunToken) return;
      const rawText = step.text || '';
      const segments = rawText.split('#');
      const soundQueue = [];

      segments.forEach(seg => {
        let s = seg.trim();
        if (!s) return;
        const safeRegex = /\[(svg|write|animation):([^\]]+)\]/g;
        let match;
        while ((match = safeRegex.exec(s)) !== null) {
          soundQueue.push({ tagType: match[1], tagVal: match[2] });
        }
        const cleanAudio = s.replace(safeRegex, '').trim();
        if (cleanAudio) soundQueue.push({ audio: cleanAudio });
      });

      for (const item of soundQueue) {
        if (token !== stepRunToken) return;
        if (item.tagType === 'write') {
          const demoCtrl = await ns.WritingBoard.renderWriteDemo(item.tagVal, visualBox, { loop: true });
          if (demoCtrl && demoCtrl.stop) activeCleanup = demoCtrl.stop;
        } else if (item.tagType === 'svg') {
          visualBox.innerHTML = '';
          visualBox.appendChild(ns.Media.createSmartSvgElement(item.tagVal, currentLesson.name));
        } else if (item.tagType === 'animation') {
          const parts = item.tagVal.split(':');
          const xamlName = parts[0].replace(/^\/+/, '');
          const sbName = parts[1] || 'sb1';
          visualBox.innerHTML = '';
          await ns.XamlParser.renderXamlToContainer(xamlName, sbName, visualBox);
        } else if (item.audio) {
          await ns.Media.playSoundToken(item.audio);
        }
      }
    }

    if (token === stepRunToken && smartMode) {
      setSmartActionBar(true);
    }
  }

  ns.LessonPlayer = {
    openLesson,
    closeStage,
    prevStep,
    nextStep,
    replayStep: renderCurrentStage,
    markCurrentLessonDone
  };
})(window.AppTV);
