/**
 * js/lesson-player.js
 * Điều khiển trình chiếu bài học, tích hợp giải mã [svg:...], [write:...], và [animation:...] đọc file .xaml
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let currentLesson = null;
  let currentSteps = [];
  let currentStepIdx = 0;
  let stepRunToken = 0;

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
    if (lesson.write1) {
      steps.push({ name: 'write_svg', svg: lesson.write1, label: lesson.name });
    }
    if (Array.isArray(lesson.write1s)) {
      lesson.write1s.forEach(svgPath => {
        steps.push({ name: 'write_svg', svg: svgPath, label: lesson.name });
      });
    }
    return steps;
  }

  function openLesson(lesson) {
    ns.Media.playEffect('button');
    currentLesson = lesson;
    currentSteps = extractStepsFromLesson(lesson);
    currentStepIdx = 0;
    document.getElementById('stageTitle').textContent = lesson.name;
    document.getElementById('stageOverlay').classList.add('open');
    renderCurrentStep();
  }

  function closeStage() {
    stepRunToken++;
    ns.Media.stopActiveAudio();
    document.getElementById('stageOverlay').classList.remove('open');
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
      ns.Media.playEffect('lesson_complete');
    }
  }

  function renderCurrentStep() {
    stepRunToken++;
    const myToken = stepRunToken;
    ns.Media.stopActiveAudio();

    const body = document.getElementById('stageBody');
    body.innerHTML = '';

    document.getElementById('stepIndicator').textContent =
      `${currentStepIdx + 1} / ${Math.max(1, currentSteps.length)}`;
    document.getElementById('prevStepBtn').disabled = currentStepIdx === 0;

    const step = currentSteps[currentStepIdx];
    if (!step) {
      body.innerHTML = '<div class="board-card"><p>Bài học đang trống.</p></div>';
      return;
    }

    if (step.name === 'complex') {
      renderComplexAnimation(step, body, myToken);
    } else if (step.name === 'write_svg') {
      ns.WritingBoard.renderWritingCanvas(step.svg, step.label, body);
    } else if (step.name === 'game') {
      ns.GamesEngine.renderGameStep(step, currentLesson, body);
    }
  }

  async function renderComplexAnimation(step, container, token) {
    const card = document.createElement('div');
    card.className = 'board-card';
    // Mở rộng chiều cao bảng trắng để hình ảnh hiển thị to rõ, không bị chật
    card.style.minHeight = '420px';
    card.style.justifyContent = 'space-between';

    const visualBox = document.createElement('div');
    visualBox.className = 'svg-stage';
    // Phóng to vùng chứa hoạt ảnh XAML chiếm không gian lớn
    visualBox.style.width = '100%';
    visualBox.style.height = '340px';
    visualBox.style.maxWidth = '380px';

    if (currentLesson.thumb) {
      visualBox.appendChild(ns.Media.createSmartSvgElement(currentLesson.thumb, currentLesson.name));
    }

    // Ẩn chữ tiêu đề to và nhãn phụ bên dưới để tránh bị trùng lặp chữ cam
    const bigText = document.createElement('div');
    bigText.className = 'big-letter';
    bigText.style.display = 'none';

    const subBox = document.createElement('div');
    subBox.className = 'subtitle-box';
    subBox.style.display = 'none';

    card.appendChild(visualBox);
    card.appendChild(bigText);
    card.appendChild(subBox);
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
      if (cleanAudio) {
        soundQueue.push({ audio: cleanAudio });
      }
    });

    for (const item of soundQueue) {
      if (token !== stepRunToken) return;
      if (item.tagType === 'svg' || item.tagType === 'write') {
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

  ns.LessonPlayer = {
    openLesson,
    closeStage,
    prevStep,
    nextStep,
    replayStep: renderCurrentStep
  };
})(window.AppTV);
