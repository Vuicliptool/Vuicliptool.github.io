/**
 * js/lesson-player.js
 * Điều khiển bài học, lưu tiến độ mở khóa (localStorage),
 * hộp thoại chọn [Học lại / Tập viết] và thanh nút tròn ẩn/hiện thông minh giống video mẫu.
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
    }
  };

  ns.Progress = Progress;

  // ===== 2. TRÌNH PHÁT BÀI HỌC =====
  let currentLesson = null;
  let currentModule = 'data';
  let currentSteps = [];
  let currentStepIdx = 0;
  let stepRunToken = 0;
  let activeCleanup = null;

  function runActiveCleanup() {
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) {}
      activeCleanup = null;
    }
  }

  /**
   * Trích xuất danh sách chặng học đầy đủ (gồm Intro + 3 cấp độ write1/write2/write3)
   */
  function extractStepsFromLesson(lesson) {
    const steps = [];
    if (Array.isArray(lesson.intro)) {
      lesson.intro.forEach(item => {
        if (item.animation) steps.push(item.animation);
        if (Array.isArray(item.animations)) {
          item.animations.forEach(a => steps.push(a));
        }
      });
    }
    if (lesson.write1) steps.push({ name: 'write_svg', level: 1, svg: lesson.write1, label: lesson.name });
    if (lesson.write2) steps.push({ name: 'write_svg', level: 2, svg: lesson.write2, label: lesson.name });
    if (lesson.write3) steps.push({ name: 'write_svg', level: 3, svg: lesson.write3, label: lesson.name });

    if (Array.isArray(lesson.write1s)) {
      lesson.write1s.forEach(svgPath => {
        steps.push({ name: 'write_svg', level: 1, svg: svgPath, label: lesson.name });
      });
    }
    return steps;
  }

  /**
   * Hiện hộp thoại nền tối với 2 nút tròn [🟡 Học lại] và [🟢 Tập viết] giống video
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
      startLessonAtStep(lesson, modName, catName, 0);
    };
    modal.querySelector('#pickWriteNowBtn').onclick = () => {
      modal.classList.remove('open');
      startLessonAtStep(lesson, modName, catName, firstWriteIdx);
    };

    modal.classList.add('open');
  }

  /**
   * Ẩn / hiện thanh nút tròn đáy thông minh ([🔵 Làm lại] + [🟢 Tiếp theo])
   */
  function setSmartActionBar(visible) {
    const smartBar = document.getElementById('smartActionFooter');
    const classicFooter = document.querySelector('.stage-footer');
    if (!smartBar) return;

    if (visible) {
      smartBar.classList.add('show');
    } else {
      smartBar.classList.remove('show');
    }
    if (classicFooter && isSmartWritingLesson()) {
      classicFooter.style.display = 'none';
    }
  }

  function isSmartWritingLesson() {
    if (currentModule === 'write') return true;
    return currentSteps.some(s => s.name === 'write_svg' || (s.name === 'game' && (s.game || '').toLowerCase() === 'tapviet'));
  }

  function openLesson(lesson, modName, catName) {
    ns.Media.playEffect('button');
    if (catName) lesson._catName = catName;
    if (modName) lesson._module = modName;

    const steps = extractStepsFromLesson(lesson);
    const hasIntro = steps.some(s => s.name === 'complex');
    const firstWriteIdx = steps.findIndex(s => s.name === 'write_svg');

    // Nếu là bài tập viết có cả phần hướng dẫn lẫn bảng tập viết -> hiện hộp thoại [Học lại / Tập viết]
    if (hasIntro && firstWriteIdx > 0) {
      showWriteModePicker(lesson, modName || lesson._module || 'write', catName || lesson._catName, firstWriteIdx);
      return;
    }

    startLessonAtStep(lesson, modName || lesson._module || 'data', catName || lesson._catName, 0);
  }

  function startLessonAtStep(lesson, modName, catName, startIdx) {
    ns.Media.stopBgm();
    currentLesson = lesson;
    currentModule = modName || 'data';
    currentSteps = extractStepsFromLesson(lesson);
    currentStepIdx = startIdx || 0;

    document.getElementById('stageTitle').textContent = lesson.name;
    document.getElementById('stageOverlay').classList.add('open');

    // Gắn sự kiện cho 2 nút tròn thông minh
    const smartReplay = document.getElementById('smartReplayBtn');
    const smartNext = document.getElementById('smartNextBtn');
    if (smartReplay) smartReplay.onclick = () => { ns.Media.playEffect('button'); renderCurrentStep(); };
    if (smartNext) smartNext.onclick = () => { ns.Media.playEffect('button'); nextStep(); };

    renderCurrentStep();
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
    document.getElementById('stageOverlay').classList.remove('open');

    if (ns.MainApp && typeof ns.MainApp.renderAllSections === 'function') {
      ns.MainApp.renderAllSections();
    }
    ns.Media.playBgm('bg_lesson');
  }

  function prevStep() {
    if (currentStepIdx > 0) {
      currentStepIdx--;
      renderCurrentStep();
    }
  }

  function nextStep() {
    if (currentStepIdx < currentSteps.length - 1) {
      currentStepIdx++;
      renderCurrentStep();
    } else {
      markCurrentLessonDone();
      ns.Media.playEffect('lesson_complete');
      setSmartActionBar(false);

      const finishToken = ++stepRunToken;
      setTimeout(() => {
        if (finishToken === stepRunToken) closeStage();
      }, 1200);
    }
  }

  function renderCurrentStep() {
    stepRunToken++;
    const myToken = stepRunToken;
    runActiveCleanup();
    ns.Media.stopActiveAudio();

    const body = document.getElementById('stageBody');
    body.innerHTML = '';

    const totalSteps = Math.max(1, currentSteps.length);
    const isLastStep = currentStepIdx >= currentSteps.length - 1;
    const smartMode = isSmartWritingLesson();

    // Điều khiển hiển thị thanh điều hướng cổ điển vs thông minh
    const classicFooter = document.querySelector('.stage-footer');
    const replayTopBtn = document.getElementById('replayStepBtn');
    if (classicFooter) classicFooter.style.display = smartMode ? 'none' : 'flex';
    if (replayTopBtn) replayTopBtn.style.display = smartMode ? 'none' : 'inline-block';
    setSmartActionBar(false); // Luôn ẩn khi đang giảng hoặc bé đang viết!

    document.getElementById('stepIndicator').textContent = `${currentStepIdx + 1} / ${totalSteps}`;
    document.getElementById('prevStepBtn').disabled = currentStepIdx === 0;

    const nextBtn = document.getElementById('nextStepBtn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = isLastStep ? '🎉 Hoàn thành' : 'Tiếp ➡';
      nextBtn.style.background = isLastStep ? 'linear-gradient(180deg, #22c55e, #15803d)' : '';
    }

    const step = currentSteps[currentStepIdx];
    if (!step) {
      body.innerHTML = '<div class="board-card"><p>Bài học đang trống.</p></div>';
      return;
    }

    if (step.name === 'complex') {
      renderComplexAnimation(step, body, myToken, isLastStep, smartMode);
    } else if (step.name === 'write_svg') {
      // Cấp độ 1, 2 hoặc 3: ẩn nút dưới đáy -> xong 5/5 lượt tự trượt 2 nút tròn lên!
      ns.WritingBoard.renderWritingLevel(
        step.svg,
        step.label,
        step.level || 1,
        body,
        () => {
          if (myToken !== stepRunToken) return;
          if (isLastStep) markCurrentLessonDone();
          setSmartActionBar(true);
        }
      ).then(ctrl => {
        if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
      });
    } else if (step.name === 'game') {
      const gameType = (step.game || '').toLowerCase();
      if (gameType === 'tapviet') {
        ns.WritingBoard.renderTapVietGame(step, currentLesson, body, () => {
          if (myToken !== stepRunToken) return;
          markCurrentLessonDone();
          setSmartActionBar(true);
        }).then(ctrl => {
          if (ctrl && ctrl.destroy) activeCleanup = ctrl.destroy;
        });
      } else {
        ns.GamesEngine.renderGameStep(step, currentLesson, body);
      }
    }
  }

  async function renderComplexAnimation(step, container, token, isLastStep, smartMode) {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.style.minHeight = '400px';
    card.style.justifyContent = 'center';

    const visualBox = document.createElement('div');
    visualBox.className = 'svg-stage';
    visualBox.style.width = '100%';
    visualBox.style.height = '340px';
    visualBox.style.maxWidth = '380px';

    if (currentLesson.thumb) {
      visualBox.appendChild(ns.Media.createSmartSvgElement(currentLesson.thumb, currentLesson.name));
    }

    card.appendChild(visualBox);
    container.appendChild(card);

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
        // Chạy hoạt ảnh bàn tay cầm bút viết mẫu trực tiếp trên ô ly!
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

    // Khi đọc giảng xong -> dừng bàn tay lặp và trượt 2 nút tròn [Làm lại / Tiếp theo] lên!
    if (token === stepRunToken) {
      if (isLastStep) markCurrentLessonDone();
      if (smartMode) setSmartActionBar(true);
    }
  }

  ns.LessonPlayer = {
    openLesson,
    closeStage,
    prevStep,
    nextStep,
    replayStep: renderCurrentStep,
    markCurrentLessonDone
  };
})(window.AppTV);
