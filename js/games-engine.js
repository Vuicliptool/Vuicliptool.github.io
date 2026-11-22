/**
 * js/games-engine.js
 * Hệ thống trò chơi tương tác toàn màn hình cho phần Tập đọc (data.txt),
 * Tư duy ngôn ngữ (thinking.txt) và Trò chơi (games.txt):
 *  - Hứng táo rơi (select apple) + Bóng bay / Cua biển / Bạch tuộc / Ong bay
 *  - Kéo thả mảnh ghép chữ & dấu (puzzle1 dùng SVG trong data/puzzle1/)
 *  - Bảng gỗ treo hỏi dấu thanh (dauthanh)
 *  - Băng chuyền đóng thùng chai (dongthungchai: dau / amdau / van)
 *  - Thủ môn bắt bóng (goal)
 *  - Đập chuột chũi (mole), Lật thẻ (memory), Đua xe (racing), Ghép vần, Chính tả, Nối từ...
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ===== HÀM PHÂN TÍCH DẤU THANH & ÂM TIẾNG VIỆT =====
  const TONE_MAP = {
    huyen: { name: 'huyền', symbol: '̀', label: '\\', telex: 'f', chars: 'àằầèềìòồờùừỳ' },
    sac:   { name: 'sắc',   symbol: '́', label: '/',  telex: 's', chars: 'áắấéếíóốớúứý' },
    hoi:   { name: 'hỏi',   symbol: '̉', label: '?',  telex: 'r', chars: 'ảẳẩẻểỉỏổởủửỷ' },
    nga:   { name: 'ngã',   symbol: '̃', label: '~',  telex: 'x', chars: 'ãẵẫẽễĩõỗỡũữỹ' },
    nang:  { name: 'nặng',  symbol: '̣', label: '.',  telex: 'j', chars: 'ạặậẹệịọộợụựỵ' }
  };

  // Bảng ghép dấu thanh vào 1 nguyên âm gốc (cho puzzle1)
  const VOWEL_TONES = {
    'a':  { huyen: 'à', sac: 'á', hoi: 'ả', nga: 'ã', nang: 'ạ' },
    'ă':  { huyen: 'ằ', sac: 'ắ', hoi: 'ẳ', nga: 'ẵ', nang: 'ặ' },
    'â':  { huyen: 'ầ', sac: 'ấ', hoi: 'ẩ', nga: 'ẫ', nang: 'ậ' },
    'e':  { huyen: 'è', sac: 'é', hoi: 'ẻ', nga: 'ẽ', nang: 'ẹ' },
    'ê':  { huyen: 'ề', sac: 'ế', hoi: 'ể', nga: 'ễ', nang: 'ệ' },
    'i':  { huyen: 'ì', sac: 'í', hoi: 'ỉ', nga: 'ĩ', nang: 'ị' },
    'o':  { huyen: 'ò', sac: 'ó', hoi: 'ỏ', nga: 'õ', nang: 'ọ' },
    'ô':  { huyen: 'ồ', sac: 'ố', hoi: 'ổ', nga: 'ỗ', nang: 'ộ' },
    'ơ':  { huyen: 'ờ', sac: 'ớ', hoi: 'ở', nga: 'ỡ', nang: 'ợ' },
    'u':  { huyen: 'ù', sac: 'ú', hoi: 'ủ', nga: 'ũ', nang: 'ụ' },
    'ư':  { huyen: 'ừ', sac: 'ứ', hoi: 'ử', nga: 'ữ', nang: 'ự' },
    'y':  { huyen: 'ỳ', sac: 'ý', hoi: 'ỷ', nga: 'ỹ', nang: 'ỵ' },
    'ia': { huyen: 'ìa', sac: 'ía', hoi: 'ỉa', nga: 'ĩa', nang: 'ịa' },
    'iê': { huyen: 'iề', sac: 'iế', hoi: 'iể', nga: 'iễ', nang: 'iệ' },
    'yê': { huyen: 'yề', sac: 'yế', hoi: 'yể', nga: 'yễ', nang: 'yệ' },
    'ua': { huyen: 'ùa', sac: 'úa', hoi: 'ủa', nga: 'ũa', nang: 'ụa' },
    'uô': { huyen: 'uồ', sac: 'uố', hoi: 'uổ', nga: 'uỗ', nang: 'uộ' },
    'ưa': { huyen: 'ừa', sac: 'ứa', hoi: 'ửa', nga: 'ữa', nang: 'ựa' },
    'ươ': { huyen: 'ườ', sac: 'ướ', hoi: 'ưở', nga: 'ưỡ', nang: 'ượ' }
  };

  function detectTone(word) {
    if (!word) return null;
    const low = word.toLowerCase();
    for (const key of Object.keys(TONE_MAP)) {
      for (const ch of low) {
        if (TONE_MAP[key].chars.includes(ch)) return key;
      }
    }
    return null;
  }

  function stripTone(word) {
    if (!word) return '';
    const map = {
      'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
      'ằ':'ă','ắ':'ă','ẳ':'ă','ẵ':'ă','ặ':'ă',
      'ầ':'â','ấ':'â','ẩ':'â','ẫ':'â','ậ':'â',
      'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
      'ề':'ê','ế':'ê','ể':'ê','ễ':'ê','ệ':'ê',
      'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
      'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
      'ồ':'ô','ố':'ô','ổ':'ô','ỗ':'ô','ộ':'ô',
      'ờ':'ơ','ớ':'ơ','ở':'ơ','ỡ':'ơ','ợ':'ơ',
      'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
      'ừ':'ư','ứ':'ư','ử':'ư','ữ':'ư','ự':'ư',
      'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y'
    };
    return word.split('').map(c => map[c] || map[c.toLowerCase()] || c).join('');
  }

  function splitOnsetRime(syllable) {
    const low = (syllable || '').toLowerCase().trim();
    const onsets = ['ngh', 'ng', 'nh', 'ch', 'gh', 'gi', 'kh', 'ph', 'qu', 'th', 'tr',
                    'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x'];
    for (const on of onsets) {
      if (low.startsWith(on) && low.length > on.length) {
        return { onset: on, rime: stripTone(low.slice(on.length)) };
      }
    }
    return { onset: '', rime: stripTone(low) };
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function toPuzzle1Filename(baseVowel, toneKey) {
    const telexBase = ns.Media.toTelexFilename(baseVowel.toLowerCase());
    const tCode = TONE_MAP[toneKey] ? TONE_MAP[toneKey].telex : '';
    return `${telexBase}${tCode}.svg`;
  }

  function playRandomTrue() {
    const r = Math.floor(Math.random() * 5) + 1;
    return ns.Media.playSoundToken(`true${r}`);
  }

  function getPromptTypeIdx(typeVal) {
    const t = String(typeVal || '1');
    if (t === '2') return '2';
    if (t === '3') return '3';
    return '1';
  }

  // ===== ĐỊNH TUYẾN CHÍNH CHO TẤT CẢ TRÒ CHƠI =====
  function renderGameStep(step, lesson, container, callbacks) {
    const cb = callbacks || {};
    const onComplete = typeof cb.onComplete === 'function' ? cb.onComplete : () => {};
    const setHelpHandler = typeof cb.setHelpHandler === 'function' ? cb.setHelpHandler : () => {};
    const gameType = (step.game || '').toLowerCase().trim();

    if (gameType === 'select apple') {
      return renderCatchAppleGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'select crab') {
      return renderCrabXamlGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'select octopus') {
      return renderOctopusXamlGame(step, container, onComplete, setHelpHandler);
    }
    if (['select balloon', 'bee'].includes(gameType)) {
      return renderArcadeTapGame(gameType, step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'puzzle1') {
      return renderPuzzle1Game(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'dauthanh') {
      return renderDauThanhGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'dongthungchai') {
      return renderDongThungChaiGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'goal') {
      return renderGoalGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'mole') {
      return renderMoleGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'memory') {
      return renderMemoryGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'racing') {
      return renderRacingGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'box matching') {
      return renderBoxMatchingGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'timam') {
      return renderTimAmGame(step, container, onComplete, setHelpHandler);
    }
    if (['puzzle2', 'puzzle3', 'puzzle4', 'ghep van', 'banam'].includes(gameType)) {
      return renderCombineSoundGame(step, container, onComplete, setHelpHandler);
    }
    if (['danhvan1', 'danhvan2', 'danhvan3', 'tapviet'].includes(gameType)) {
      return renderReadingListGame(step, container, onComplete, setHelpHandler);
    }
    if (gameType === 'danhvan4') {
      return renderIdiomsGame(step, container, onComplete);
    }
    if (gameType === 'tapdoc' && Array.isArray(step.data)) {
      return renderPoemReader(step, container, onComplete);
    }
    if (gameType === 'connection') {
      return renderConnectionGame(step, container, onComplete);
    }
    if (gameType === 'options') {
      return renderOptionsQuizGame(step, container, onComplete);
    }
    if (gameType === 'chinhta') {
      return renderChinhTaGame(step, lesson, container, onComplete);
    }

    return renderListenAndPickGame(step, container, onComplete, setHelpHandler);
  }

  /**
   * =========================================================================
   * GAME 1: HỨNG TÁO RƠI (select apple) — Giống hệt 00:40–01:12 trong video
   * =========================================================================
   */
  function renderCatchAppleGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['o', 'O', 'a', 'A'];
    const typeIdx = getPromptTypeIdx(step.type);
    const targetGoal = Number(step.answer) || 8;
    const targetBase = values[0].toLowerCase();

    // Với type="1" (nhận diện âm thường & hoa như o và O), cả o và O đều đúng
    function isTargetValue(val) {
      if (typeIdx === '1') return val.toLowerCase() === targetBase;
      return val === values[0];
    }

    let score = 0;
    let destroyed = false;
    let finished = false;
    let rafId = null;
    let lastTime = performance.now();
    let spawnTimer = 0;

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage apple-stage';
    stage.innerHTML = `
      <!-- Thanh tiến độ ở trên -->
      <div class="game-progress-track">
        <div class="game-progress-fill" id="appleProgFill" style="width:0%"></div>
      </div>

      <!-- Phông nền cây táo + đồng cỏ SVG -->
      <svg class="apple-bg-svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMax slice">
        <rect width="360" height="640" fill="#d8f3ff"/>
        <!-- Đồi cỏ -->
        <path d="M-20,560 Q90,480 200,545 T390,520 L390,660 L-20,660 Z" fill="#a3d95b"/>
        <path d="M-20,600 Q140,540 380,585 L380,660 L-20,660 Z" fill="#8bc34a"/>
        <!-- Hoa nhỏ -->
        <circle cx="55" cy="575" r="4" fill="#fff59d"/>
        <circle cx="300" cy="560" r="4" fill="#ffab91"/>
        <circle cx="120" cy="610" r="3.5" fill="#f48fb1"/>
        <!-- Thân cây táo -->
        <path d="M150,230 C162,320 155,460 135,605 L235,605 C215,460 208,320 220,230 Z" fill="#6d4328"/>
        <path d="M168,250 C175,340 170,470 158,595" stroke="#53301a" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M196,260 C192,360 198,480 208,590" stroke="#53301a" stroke-width="5" fill="none" stroke-linecap="round"/>
        <!-- Tán lá xanh rậm -->
        <circle cx="50" cy="110" r="95" fill="#388e3c"/>
        <circle cx="310" cy="120" r="95" fill="#388e3c"/>
        <circle cx="180" cy="145" r="125" fill="#4caf50"/>
        <circle cx="95" cy="85" r="85" fill="#66bb6a"/>
        <circle cx="255" cy="85" r="90" fill="#66bb6a"/>
        <circle cx="175" cy="55" r="90" fill="#8bc34a"/>
        <circle cx="30" cy="40" r="65" fill="#8bc34a"/>
        <circle cx="335" cy="45" r="70" fill="#8bc34a"/>
      </svg>

      <!-- Lớp chứa những quả táo rơi -->
      <div class="apple-layer" id="appleLayer"></div>

      <!-- Chiếc giỏ mây kéo ngang -->
      <div class="apple-basket" id="appleBasket">
        <svg viewBox="0 0 130 72" width="118" height="66">
          <path d="M6,16 L124,16 L112,64 C110,69 104,70 98,70 L32,70 C26,70 20,69 18,64 Z" fill="#b4692e" stroke="#6d3b14" stroke-width="3"/>
          <rect x="2" y="8" width="126" height="14" rx="7" fill="#c97b38" stroke="#6d3b14" stroke-width="3"/>
          <line x1="20" y1="36" x2="110" y2="36" stroke="#85491c" stroke-width="2.5"/>
          <line x1="24" y1="52" x2="106" y2="52" stroke="#85491c" stroke-width="2.5"/>
          <line x1="42" y1="22" x2="46" y2="68" stroke="#85491c" stroke-width="2.5"/>
          <line x1="65" y1="22" x2="65" y2="68" stroke="#85491c" stroke-width="2.5"/>
          <line x1="88" y1="22" x2="84" y2="68" stroke="#85491c" stroke-width="2.5"/>
        </svg>
      </div>
    `;
    container.appendChild(stage);

    const appleLayer = stage.querySelector('#appleLayer');
    const basketEl = stage.querySelector('#appleBasket');
    const progFill = stage.querySelector('#appleProgFill');

    let basketX = 0.5; // Tỉ lệ 0..1 theo chiều ngang sân chơi
    function updateBasketPos() {
      const w = stage.clientWidth || 360;
      const bw = basketEl.offsetWidth || 118;
      const px = Math.max(bw / 2, Math.min(w - bw / 2, basketX * w));
      basketEl.style.left = `${px}px`;
    }

    let dragging = false;
    function moveBasketByClientX(clientX) {
      const rect = stage.getBoundingClientRect();
      basketX = Math.max(0.1, Math.min(0.9, (clientX - rect.left) / rect.width));
      updateBasketPos();
    }

    function onDown(e) {
      dragging = true;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      moveBasketByClientX(cx);
    }
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      moveBasketByClientX(cx);
    }
    function onUp() { dragging = false; }

    stage.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    stage.addEventListener('touchstart', onDown, { passive: true });
    stage.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    const apples = [];
    const targetList = values.filter(isTargetValue);
    const distractorList = values.filter(v => !isTargetValue(v));

    function spawnApple() {
      const w = stage.clientWidth || 360;
      const wantTarget = distractorList.length === 0 || Math.random() < 0.58;
      const pool = wantTarget ? targetList : distractorList;
      const label = pool[Math.floor(Math.random() * pool.length)];

      const el = document.createElement('div');
      el.className = 'falling-apple';
      el.innerHTML = `
        <svg viewBox="0 0 80 86" width="68" height="73">
          <path d="M40,18 C40,8 46,4 50,3" stroke="#5d4037" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M42,15 C52,4 64,6 60,18 C54,22 45,20 42,15 Z" fill="#4caf50"/>
          <path d="M40,22 C24,14 6,28 10,50 C14,72 28,84 40,78 C52,84 66,72 70,50 C74,28 56,14 40,22 Z" fill="#ef3b36"/>
          <ellipse cx="26" cy="36" rx="5" ry="9" transform="rotate(-20 26 36)" fill="rgba(255,255,255,0.28)"/>
        </svg>
        <span class="apple-letter">${label}</span>
      `;
      const x = 42 + Math.random() * Math.max(80, w - 84);
      const y = 55;
      const speed = 105 + Math.random() * 48; // px / giây
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      appleLayer.appendChild(el);
      apples.push({ el, x, y, speed, label, isTarget: isTargetValue(label) });
    }

    function speakPrompt() {
      ns.Media.playSoundSequence([`games/select apple${typeIdx}`, targetBase], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function loop(now) {
      if (destroyed || finished) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      spawnTimer += dt;
      if (spawnTimer >= 1.15 && apples.length < 5) {
        spawnTimer = 0;
        spawnApple();
      }

      const stageH = stage.clientHeight || 560;
      const catchY = stageH - 96;
      const basketCenterX = basketX * (stage.clientWidth || 360);

      for (let i = apples.length - 1; i >= 0; i--) {
        const ap = apples[i];
        ap.y += ap.speed * dt;
        ap.el.style.top = `${ap.y}px`;

        // Kiểm tra táo rơi trúng giỏ
        if (ap.y >= catchY - 26 && ap.y <= catchY + 26 && Math.abs(ap.x - basketCenterX) < 58) {
          ap.el.remove();
          apples.splice(i, 1);

          if (ap.isTarget) {
            score++;
            progFill.style.width = `${Math.min(100, (score / targetGoal) * 100)}%`;
            ns.Media.playGameEffect('apple_fall');
            ns.Media.playSoundToken(ap.label.toLowerCase());
            basketEl.classList.add('basket-pop');
            setTimeout(() => basketEl.classList.remove('basket-pop'), 200);

            if (score >= targetGoal) {
              finished = true;
              apples.forEach(a => a.el.remove());
              apples.length = 0;
              ns.Media.playEffect('hooray');
              playRandomTrue().then(() => { if (!destroyed) onComplete(); });
              return;
            }
          } else {
            ns.Media.playEffect('fail');
            basketEl.classList.add('basket-shake');
            setTimeout(() => basketEl.classList.remove('basket-shake'), 320);
          }
          continue;
        }

        // Táo rơi quá đáy màn hình
        if (ap.y > stageH + 40) {
          ap.el.remove();
          apples.splice(i, 1);
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    updateBasketPos();
    speakPrompt();
    spawnApple();
    rafId = requestAnimationFrame(loop);

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
      }
    };
  }

  /**
   * =========================================================================
   * GAME 1A-XAML: CHỌN CUA BIỂN (select crab) — Dùng đồ họa & hoạt ảnh từ animations/crab.xaml
   *   - sb (lặp): Cua cử động càng & chân bò ngang trên bãi cát biển
   *   - sb_true: Cua nhảy cao lên trời cười tít mắt rồi biến mất
   *   - sb_fail: Cua nghiêng người hoa mắt xoay tròn
   * =========================================================================
   */
  function renderCrabXamlGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['a', 'A', 'o', 'O'];
    const typeIdx = getPromptTypeIdx(step.type);
    const totalQuestions = Number(step.questions) || 1;
    const perQGoal = Math.min(Number(step.answer) || 6, 10);

    let qIdx = 0;
    let score = 0;
    let totalCaught = 0;
    const totalNeeded = totalQuestions * perQGoal;
    let destroyed = false;
    let finished = false;
    let rafId = null;
    let lastTime = performance.now();
    let spawnTimer = 0;
    let currentTarget = values[0];

    function pickTargetForRound() {
      if (typeIdx === '1') return values[0];
      return values[qIdx % values.length];
    }
    function isMatch(val) {
      if (typeIdx === '1') return val.toLowerCase() === currentTarget.toLowerCase();
      return val === currentTarget;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage crab-xaml-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="crabProgFill" style="width:0%"></div>
      </div>
      <div class="arcade-hint-badge" id="crabHintBadge"></div>

      <!-- Khung cảnh bãi biển nắng vàng + sóng biển vỗ bờ -->
      <div class="beach-backdrop" aria-hidden="true">
        <div class="beach-sky">
          <span class="beach-sun">☀️</span>
        </div>
        <div class="beach-sea">
          <div class="sea-wave w1"></div>
          <div class="sea-wave w2"></div>
        </div>
        <div class="beach-sand">
          <span class="sand-shell s1">🐚</span>
          <span class="sand-shell s2">⭐</span>
        </div>
      </div>

      <div class="crab-playfield" id="crabPlayfield"></div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#crabProgFill');
    const hintBadge = stage.querySelector('#crabHintBadge');
    const playfield = stage.querySelector('#crabPlayfield');
    const entities = [];

    function speakPrompt() {
      ns.Media.playSoundSequence([`games/select${typeIdx}`, currentTarget.toLowerCase()], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function removeEntity(ent) {
      const idx = entities.indexOf(ent);
      if (idx !== -1) entities.splice(idx, 1);
      if (ent.widget) ent.widget.destroy();
      if (ent.el && ent.el.parentNode) ent.el.remove();
    }

    async function spawnCrab() {
      if (destroyed || finished || entities.length >= 5) return;

      const targets = values.filter(isMatch);
      const others = values.filter(v => !isMatch(v));
      const pool = (others.length === 0 || Math.random() < 0.56) ? targets : others;
      const val = pool[Math.floor(Math.random() * pool.length)];

      const el = document.createElement('div');
      el.className = 'xaml-entity-crab';

      let widget = null;
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';
      if (canUseXaml) {
        widget = await ns.XamlParser.createInteractiveXaml('animations/crab.xaml', {
          viewBox: '0 40 400 325',
          textTargets: {
            box1_2: { x: 200, y: 200, fill: '#ffffff', stroke: '#7f1d1d', strokeWidth: 7, baseSize: 78, maxWidth: 168 }
          }
        });
      }
      if (destroyed || finished) {
        if (widget) widget.destroy();
        return;
      }

      if (widget) {
        widget.setText(val);
        widget.playStoryboard('sb', { loop: true });
        el.appendChild(widget.svg);
      } else {
        el.classList.add('fallback-entity');
        el.innerHTML = `<span class="arcade-emoji">🦀</span><span class="arcade-lbl">${val}</span>`;
      }

      const pfW = playfield.clientWidth || 360;
      const pfH = playfield.clientHeight || 420;
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? -115 : pfW + 15;
      const dir = fromLeft ? 1 : -1;
      // 3 làn cát thoáng để cua ít chồng đè lên nhau
      const lanes = [0.22, 0.48, 0.72];
      const laneRatio = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() * 0.08 - 0.04);
      const y = Math.max(70, Math.min(pfH - 125, pfH * laneRatio));
      const speed = 58 + Math.random() * 36;

      el.style.left = `${startX}px`;
      el.style.top = `${y}px`;
      playfield.appendChild(el);

      const ent = { el, widget, val, x: startX, y, dir, speed, busy: false };
      entities.push(ent);

      el.addEventListener('click', () => {
        if (ent.busy || finished || destroyed) return;
        ent.busy = true;

        if (isMatch(ent.val)) {
          ns.Media.playEffect('confirm');
          ns.Media.playSoundToken(ent.val.toLowerCase());
          score++;
          totalCaught++;
          progFill.style.width = `${Math.min(100, (totalCaught / totalNeeded) * 100)}%`;

          const doneAnim = ent.widget
            ? ent.widget.playStoryboard('sb_true')
            : new Promise(r => { el.classList.add('popped'); setTimeout(r, 260); });

          doneAnim.then(() => removeEntity(ent));

          if (score >= perQGoal) {
            qIdx++;
            if (qIdx >= totalQuestions) {
              finished = true;
              setTimeout(() => {
                if (destroyed) return;
                [...entities].forEach(removeEntity);
                ns.Media.playEffect('hooray');
                playRandomTrue().then(() => { if (!destroyed) onComplete(); });
              }, 700);
            } else {
              score = 0;
              currentTarget = pickTargetForRound();
              hintBadge.textContent = `Tìm chú cua mang chữ: "${currentTarget}"`;
              setTimeout(() => { if (!destroyed && !finished) speakPrompt(); }, 650);
            }
          }
        } else {
          ns.Media.playEffect('fail');
          const failAnim = ent.widget
            ? ent.widget.playStoryboard('sb_fail')
            : new Promise(r => { el.classList.add('wrong-shake'); setTimeout(r, 400); });
          failAnim.then(() => removeEntity(ent));
        }
      });
    }

    function loop(now) {
      if (destroyed || finished) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      spawnTimer += dt;
      if (spawnTimer >= 1.25 && entities.length < 5) {
        spawnTimer = 0;
        spawnCrab();
      }

      const pfW = playfield.clientWidth || 360;
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.busy) continue;
        ent.x += ent.dir * ent.speed * dt;
        ent.el.style.left = `${ent.x}px`;
        if ((ent.dir > 0 && ent.x > pfW + 135) || (ent.dir < 0 && ent.x < -145)) {
          removeEntity(ent);
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    currentTarget = pickTargetForRound();
    hintBadge.textContent = `Tìm chú cua mang chữ: "${currentTarget}"`;
    speakPrompt();
    spawnCrab();
    setTimeout(() => { if (!destroyed && !finished) spawnCrab(); }, 550);
    rafId = requestAnimationFrame(loop);

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        [...entities].forEach(removeEntity);
      }
    };
  }

  /**
   * =========================================================================
   * GAME 1B-XAML: CHỌN BẠCH TUỘC (select octopus) — Dùng animations/octopus.xaml
   *   - sb (lặp): Bạch tuộc hồng uốn xúc tu, chớp nhìn ngang bơi dưới đại dương
   *   - sb_true: Cười tít mắt (`path4`) rồi thu nhỏ biến mất
   *   - sb_fail: Hoa mắt xoay tròn (`path5`, `path6`) rồi lặn mất
   * =========================================================================
   */
  function renderOctopusXamlGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['y', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ'];
    const typeIdx = getPromptTypeIdx(step.type);
    const totalQuestions = Number(step.questions) || 3;
    const perQGoal = Math.min(Number(step.answer) || 5, 8);

    let qIdx = 0;
    let score = 0;
    let totalCaught = 0;
    const totalNeeded = totalQuestions * perQGoal;
    let destroyed = false;
    let finished = false;
    let rafId = null;
    let lastTime = performance.now();
    let spawnTimer = 0;
    let currentTarget = values[0];

    function pickTargetForRound() {
      if (typeIdx === '1') return values[0];
      return values[qIdx % values.length];
    }
    function isMatch(val) {
      if (typeIdx === '1') return val.toLowerCase() === currentTarget.toLowerCase();
      return val === currentTarget;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage octopus-xaml-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="octoProgFill" style="width:0%"></div>
      </div>
      <div class="arcade-hint-badge" id="octoHintBadge"></div>

      <!-- Khung cảnh đại dương xanh với bong bóng nước nổi & rong biển -->
      <div class="ocean-backdrop" aria-hidden="true">
        <span class="sea-bubble b1"></span>
        <span class="sea-bubble b2"></span>
        <span class="sea-bubble b3"></span>
        <span class="sea-bubble b4"></span>
        <div class="ocean-floor">
          <span class="seaweed sw1">🌿</span>
          <span class="seaweed sw2">🪸</span>
          <span class="seaweed sw3">🌿</span>
        </div>
      </div>

      <div class="octopus-playfield" id="octoPlayfield"></div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#octoProgFill');
    const hintBadge = stage.querySelector('#octoHintBadge');
    const playfield = stage.querySelector('#octoPlayfield');
    const entities = [];

    function speakPrompt() {
      ns.Media.playSoundSequence([`games/select${typeIdx}`, currentTarget.toLowerCase()], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function removeEntity(ent) {
      const idx = entities.indexOf(ent);
      if (idx !== -1) entities.splice(idx, 1);
      if (ent.widget) ent.widget.destroy();
      if (ent.el && ent.el.parentNode) ent.el.remove();
    }

    async function spawnOctopus() {
      if (destroyed || finished || entities.length >= 5) return;

      const targets = values.filter(isMatch);
      const others = values.filter(v => !isMatch(v));
      const pool = (others.length === 0 || Math.random() < 0.56) ? targets : others;
      const val = pool[Math.floor(Math.random() * pool.length)];

      const el = document.createElement('div');
      el.className = 'xaml-entity-octopus';

      let widget = null;
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';
      if (canUseXaml) {
        widget = await ns.XamlParser.createInteractiveXaml('animations/octopus.xaml', {
          viewBox: '45 5 310 390',
          textTargetName: null,
          injectTexts: {
            label: { parent: 'grid1', x: 192, y: 122, fill: '#ffffff', stroke: '#9f1239', strokeWidth: 7, baseSize: 78, maxWidth: 185 }
          }
        });
      }
      if (destroyed || finished) {
        if (widget) widget.destroy();
        return;
      }

      if (widget) {
        widget.setText(val, 'label');
        widget.playStoryboard('sb', { loop: true });
        el.appendChild(widget.svg);
      } else {
        el.classList.add('fallback-entity');
        el.innerHTML = `<span class="arcade-emoji">🐙</span><span class="arcade-lbl">${val}</span>`;
      }

      const pfW = playfield.clientWidth || 360;
      const pfH = playfield.clientHeight || 460;
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? -115 : pfW + 15;
      const dir = fromLeft ? 1 : -1;
      const lanes = [0.18, 0.44, 0.68];
      const baseY = Math.max(76, Math.min(pfH - 140, pfH * lanes[Math.floor(Math.random() * lanes.length)]));
      const speed = 46 + Math.random() * 32;
      const phase = Math.random() * Math.PI * 2;

      el.style.left = `${startX}px`;
      el.style.top = `${baseY}px`;
      playfield.appendChild(el);

      const ent = { el, widget, val, x: startX, baseY, dir, speed, phase, age: 0, busy: false };
      entities.push(ent);

      el.addEventListener('click', () => {
        if (ent.busy || finished || destroyed) return;
        ent.busy = true;

        if (isMatch(ent.val)) {
          ns.Media.playGameEffect('balloonpop');
          ns.Media.playSoundToken(ent.val.toLowerCase());
          score++;
          totalCaught++;
          progFill.style.width = `${Math.min(100, (totalCaught / totalNeeded) * 100)}%`;

          const okAnim = ent.widget
            ? ent.widget.playStoryboard('sb_true', { speed: 1.5 })
            : new Promise(r => { el.classList.add('popped'); setTimeout(r, 260); });
          okAnim.then(() => removeEntity(ent));

          if (score >= perQGoal) {
            qIdx++;
            if (qIdx >= totalQuestions) {
              finished = true;
              setTimeout(() => {
                if (destroyed) return;
                [...entities].forEach(removeEntity);
                ns.Media.playEffect('hooray');
                playRandomTrue().then(() => { if (!destroyed) onComplete(); });
              }, 700);
            } else {
              score = 0;
              currentTarget = pickTargetForRound();
              hintBadge.textContent = `Tìm bạch tuộc mang chữ: "${currentTarget}"`;
              setTimeout(() => { if (!destroyed && !finished) speakPrompt(); }, 650);
            }
          }
        } else {
          ns.Media.playEffect('fail');
          const failAnim = ent.widget
            ? ent.widget.playStoryboard('sb_fail', { speed: 1.5 })
            : new Promise(r => { el.classList.add('wrong-shake'); setTimeout(r, 400); });
          failAnim.then(() => removeEntity(ent));
        }
      });
    }

    function loop(now) {
      if (destroyed || finished) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      spawnTimer += dt;
      if (spawnTimer >= 1.3 && entities.length < 5) {
        spawnTimer = 0;
        spawnOctopus();
      }

      const pfW = playfield.clientWidth || 360;
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.busy) continue;
        ent.age += dt;
        ent.x += ent.dir * ent.speed * dt;
        const bobY = ent.baseY + Math.sin(ent.age * 2.6 + ent.phase) * 16;
        ent.el.style.left = `${ent.x}px`;
        ent.el.style.top = `${bobY}px`;
        if ((ent.dir > 0 && ent.x > pfW + 135) || (ent.dir < 0 && ent.x < -145)) {
          removeEntity(ent);
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    currentTarget = pickTargetForRound();
    hintBadge.textContent = `Tìm bạch tuộc mang chữ: "${currentTarget}"`;
    speakPrompt();
    spawnOctopus();
    setTimeout(() => { if (!destroyed && !finished) spawnOctopus(); }, 550);
    rafId = requestAnimationFrame(loop);

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        [...entities].forEach(removeEntity);
      }
    };
  }

  /**
   * =========================================================================
   * GAME 1B: BÓNG BAY / CUA BIỂN / BẠCH TUỘC / ONG BAY (Arcade Tap)
   * =========================================================================
   */
  function renderArcadeTapGame(gameType, step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['a', 'A', 'o', 'O'];
    const typeIdx = getPromptTypeIdx(step.type);
    const totalQuestions = Number(step.questions) || 1;
    const perQGoal = Number(step.answer) || 6;

    const themes = {
      'select balloon': { bg: 'linear-gradient(180deg,#7dd3fc 0%,#e0f2fe 70%,#bbf7d0 100%)', icon: '🎈', prompt: `games/select balloon${typeIdx}`, okSfx: 'balloonpop', failSfx: 'balloon_fail1' },
      'select crab':    { bg: 'linear-gradient(180deg,#38bdf8 0%,#bae6fd 45%,#fde68a 45%,#f59e0b 100%)', icon: '🦀', prompt: `games/select${typeIdx}`, okSfx: 'confirm', failSfx: 'fail' },
      'select octopus': { bg: 'linear-gradient(180deg,#0284c7 0%,#0369a1 60%,#0c4a6e 100%)', icon: '🐙', prompt: `games/select${typeIdx}`, okSfx: 'balloonpop', failSfx: 'fail' },
      'bee':            { bg: 'linear-gradient(180deg,#bae6fd 0%,#ecfccb 65%,#84cc16 100%)', icon: '🐝', prompt: `games/bee${typeIdx}`, okSfx: 'confirm', failSfx: 'bee_fail' }
    };
    const theme = themes[gameType] || themes['select balloon'];

    let qIdx = 0;
    let score = 0;
    let destroyed = false;
    let finished = false;
    let currentTarget = values[0];
    let spawnInterval = null;

    function pickTargetForRound() {
      if (typeIdx === '1') return values[0];
      return values[qIdx % values.length];
    }
    function isMatch(val) {
      if (typeIdx === '1') return val.toLowerCase() === currentTarget.toLowerCase();
      return val === currentTarget;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage arcade-stage';
    stage.style.background = theme.bg;
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="arcProgFill" style="width:0%"></div>
      </div>
      <div class="arcade-hint-badge" id="arcHintBadge"></div>
      <div class="arcade-playfield" id="arcPlayfield"></div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#arcProgFill');
    const hintBadge = stage.querySelector('#arcHintBadge');
    const playfield = stage.querySelector('#arcPlayfield');
    const totalNeeded = totalQuestions * perQGoal;
    let totalCaught = 0;

    function speakPrompt() {
      ns.Media.playSoundSequence([theme.prompt, currentTarget.toLowerCase()], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function spawnEntity() {
      if (destroyed || finished) return;
      if (playfield.children.length >= 6) return;

      const targets = values.filter(isMatch);
      const others = values.filter(v => !isMatch(v));
      const wantTarget = others.length === 0 || Math.random() < 0.55;
      const pool = wantTarget ? targets : others;
      const val = pool[Math.floor(Math.random() * pool.length)];

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'arcade-item';
      item.style.left = `${10 + Math.random() * 72}%`;
      item.style.top = `${16 + Math.random() * 64}%`;
      item.innerHTML = `<span class="arcade-emoji">${theme.icon}</span><span class="arcade-lbl">${val}</span>`;

      const removeTimer = setTimeout(() => { if (item.parentNode) item.remove(); }, 3400);

      item.onclick = () => {
        if (finished || destroyed) return;
        clearTimeout(removeTimer);
        if (isMatch(val)) {
          item.classList.add('popped');
          ns.Media.playGameEffect(theme.okSfx);
          ns.Media.playSoundToken(val.toLowerCase());
          score++;
          totalCaught++;
          progFill.style.width = `${Math.min(100, (totalCaught / totalNeeded) * 100)}%`;
          setTimeout(() => item.remove(), 220);

          if (score >= perQGoal) {
            qIdx++;
            if (qIdx >= totalQuestions) {
              finished = true;
              clearInterval(spawnInterval);
              playfield.innerHTML = '';
              ns.Media.playEffect('hooray');
              playRandomTrue().then(() => { if (!destroyed) onComplete(); });
            } else {
              score = 0;
              currentTarget = pickTargetForRound();
              hintBadge.textContent = `Tìm: "${currentTarget}"`;
              playfield.innerHTML = '';
              speakPrompt();
            }
          }
        } else {
          item.classList.add('wrong-shake');
          ns.Media.playGameEffect(theme.failSfx);
          setTimeout(() => item.classList.remove('wrong-shake'), 350);
        }
      };

      playfield.appendChild(item);
    }

    currentTarget = pickTargetForRound();
    hintBadge.textContent = `Tìm: "${currentTarget}"`;
    speakPrompt();
    spawnEntity();
    spawnEntity();
    spawnInterval = setInterval(spawnEntity, 950);

    return {
      destroy() {
        destroyed = true;
        if (spawnInterval) clearInterval(spawnInterval);
      }
    };
  }

  /**
   * =========================================================================
   * GAME 2: KÉO THẢ MẢNH GHÉP CHỮ & DẤU (puzzle1) — Giống 01:23–01:33 trong video
   * =========================================================================
   */
  function renderPuzzle1Game(step, container, onComplete, setHelpHandler) {
    const baseVowel = ((step.values && step.values[0]) || 'o').toLowerCase();
    const totalRounds = Number(step.questions) || 3;
    const toneKeys = shuffle(['huyen', 'sac', 'hoi', 'nga', 'nang']).slice(0, totalRounds);

    let roundIdx = 0;
    let destroyed = false;
    let cleanupDrag = null;

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage puzzle1-stage';
    container.appendChild(stage);

    function speakHelp() {
      ns.Media.playSoundToken('games/puzzle1');
    }
    setHelpHandler(speakHelp);

    async function fetchPuzzleSvg(filename) {
      const candidates = [
        `data/puzzle1/${filename}`,
        `assets/data/puzzle1/${filename}`,
        `puzzle1/${filename}`
      ];
      for (const u of candidates) {
        try {
          const res = await fetch(u);
          if (res.ok) {
            const txt = await res.text();
            if (txt.includes('<svg')) return txt;
          }
        } catch (e) {}
      }
      return null;
    }

    async function startRound() {
      if (cleanupDrag) { cleanupDrag(); cleanupDrag = null; }
      if (destroyed) return;

      const toneKey = toneKeys[roundIdx];
      const targetChar = (VOWEL_TONES[baseVowel] && VOWEL_TONES[baseVowel][toneKey]) || baseVowel;
      const svgFile = toPuzzle1Filename(baseVowel, toneKey);
      const xmlText = await fetchPuzzleSvg(svgFile);
      if (destroyed) return;

      stage.innerHTML = `
        <div class="puzzle1-top-zone"></div>
        <div class="puzzle1-bottom-zone"></div>
        <svg class="puzzle1-svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid meet"></svg>
      `;
      const svg = stage.querySelector('.puzzle1-svg');

      let piecesData = [];
      if (xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, 'image/svg+xml');
        const groups = Array.from(doc.querySelectorAll('svg > g'));
        piecesData = groups.map((g, i) => ({
          id: g.getAttribute('id') || `p${i}`,
          inner: g.innerHTML
        }));
      }

      // Dự phòng nếu chưa có file SVG trong data/puzzle1/
      if (piecesData.length === 0) {
        const toneSym = TONE_MAP[toneKey] ? TONE_MAP[toneKey].label : '';
        piecesData = [
          { id: 'tone', text: toneSym === '\\' ? '̀' : toneSym === '/' ? '́' : toneSym, x: 200, y: 120, isFallback: true },
          { id: 'base', text: baseVowel, x: 200, y: 240, isFallback: true }
        ];
      }

      const targetOffsetY = 330; // Khung đích ở nửa dưới màn hình màu xanh nhạt
      let placedCount = 0;
      const dragModels = [];

      // 1. Vẽ bóng mờ (slot đích) ở nửa dưới
      piecesData.forEach((p) => {
        const ghost = document.createElementNS(SVG_NS, 'g');
        ghost.setAttribute('transform', `translate(0, ${targetOffsetY})`);
        if (p.isFallback) {
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', p.x);
          t.setAttribute('y', p.y);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', '180');
          t.setAttribute('font-weight', '800');
          t.setAttribute('fill', '#bae6fd');
          t.textContent = p.text;
          ghost.appendChild(t);
        } else {
          ghost.innerHTML = p.inner;
          ghost.querySelectorAll('path').forEach(pt => {
            if ((pt.getAttribute('fill') || '').toUpperCase() !== '#FFFFFF') {
              pt.setAttribute('fill', '#bae6fd');
              pt.setAttribute('stroke', '#ffffff');
              pt.setAttribute('stroke-width', '3');
            }
          });
        }
        svg.appendChild(ghost);
      });

      // 2. Vẽ các mảnh kéo thả nằm rải ở nửa trên
      piecesData.forEach((p, idx) => {
        const startX = (idx % 2 === 0 ? -42 : 42);
        const startY = -10 + (idx * 12);

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'puzzle-piece');
        g.setAttribute('transform', `translate(${startX}, ${startY})`);
        if (p.isFallback) {
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', p.x);
          t.setAttribute('y', p.y);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', '180');
          t.setAttribute('font-weight', '800');
          t.setAttribute('fill', '#2563eb');
          t.textContent = p.text;
          g.appendChild(t);
        } else {
          g.innerHTML = p.inner;
          g.querySelectorAll('path').forEach(pt => {
            if ((pt.getAttribute('fill') || '').toUpperCase() !== '#FFFFFF') {
              pt.setAttribute('fill', '#2563eb');
            }
          });
        }
        svg.appendChild(g);

        dragModels.push({
          el: g,
          startX,
          startY,
          x: startX,
          y: startY,
          targetX: 0,
          targetY: targetOffsetY,
          placed: false
        });
      });

      let activePiece = null;
      let pointerStart = null;
      let pieceOrigin = null;

      function clientToSvg(e) {
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = svg.getBoundingClientRect();
        return {
          x: ((cx - rect.left) / rect.width) * 400,
          y: ((cy - rect.top) / rect.height) * 720
        };
      }

      dragModels.forEach(m => {
        function down(e) {
          if (m.placed || destroyed) return;
          e.preventDefault();
          activePiece = m;
          pointerStart = clientToSvg(e);
          pieceOrigin = { x: m.x, y: m.y };
          svg.appendChild(m.el); // Đưa mảnh đang kéo lên trên cùng
          ns.Media.playGameEffect('select');
        }
        m.el.addEventListener('mousedown', down);
        m.el.addEventListener('touchstart', down, { passive: false });
      });

      function onMove(e) {
        if (!activePiece || destroyed) return;
        e.preventDefault();
        const pt = clientToSvg(e);
        activePiece.x = pieceOrigin.x + (pt.x - pointerStart.x);
        activePiece.y = pieceOrigin.y + (pt.y - pointerStart.y);
        activePiece.el.setAttribute('transform', `translate(${activePiece.x}, ${activePiece.y})`);
      }

      function onUp() {
        if (!activePiece || destroyed) return;
        const m = activePiece;
        activePiece = null;

        const dx = m.x - m.targetX;
        const dy = m.y - m.targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 75) {
          m.x = m.targetX;
          m.y = m.targetY;
          m.placed = true;
          m.el.style.transition = 'transform 0.18s ease';
          m.el.setAttribute('transform', `translate(${m.targetX}, ${m.targetY})`);
          ns.Media.playEffect('confirm');
          placedCount++;

          if (placedCount >= dragModels.length) {
            setTimeout(async () => {
              if (destroyed) return;
              await ns.Media.playSoundToken(targetChar.toLowerCase());
              await playRandomTrue();
              if (destroyed) return;
              roundIdx++;
              if (roundIdx < totalRounds) {
                startRound();
              } else {
                ns.Media.playEffect('hooray');
                onComplete();
              }
            }, 250);
          }
        } else {
          // Thả sai vị trí -> trượt về chỗ cũ
          m.x = m.startX;
          m.y = m.startY;
          m.el.style.transition = 'transform 0.25s ease';
          m.el.setAttribute('transform', `translate(${m.startX}, ${m.startY})`);
          setTimeout(() => { m.el.style.transition = ''; }, 260);
        }
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);

      cleanupDrag = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };

      if (roundIdx === 0) speakHelp();
    }

    startRound();

    return {
      destroy() {
        destroyed = true;
        if (cleanupDrag) cleanupDrag();
      }
    };
  }

  /**
   * =========================================================================
   * GAME 3: BẢNG GỖ TREO HỎI DẤU THANH (dauthanh) — Giống 01:35–02:06 trong video
   * =========================================================================
   */
  function renderDauThanhGame(step, container, onComplete, setHelpHandler) {
    const allVals = Array.isArray(step.values) ? step.values : ['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ'];
    const tonedVals = allVals.filter(v => detectTone(v) !== null);
    const totalQ = Math.min(Number(step.questions) || 3, Math.max(1, tonedVals.length));
    const questionPool = shuffle(tonedVals).slice(0, totalQ);

    let qIdx = 0;
    let destroyed = false;
    let locked = false;

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage dauthanh-stage';
    container.appendChild(stage);

    let curAnswer = '';
    let curToneName = '';

    function speakQuestion() {
      ns.Media.playSoundSequence(['games/dauthanh1', curToneName], () => destroyed);
    }
    setHelpHandler(speakQuestion);

    function showQuestion() {
      if (destroyed) return;
      locked = false;
      curAnswer = questionPool[qIdx];
      const tKey = detectTone(curAnswer);
      curToneName = TONE_MAP[tKey] ? TONE_MAP[tKey].name : '';

      const distractors = shuffle(allVals.filter(v => v !== curAnswer)).slice(0, 2);
      const options = shuffle([curAnswer, ...distractors]);

      stage.innerHTML = '';
      const stack = document.createElement('div');
      stack.className = 'wooden-boards-stack';

      options.forEach(opt => {
        const board = document.createElement('button');
        board.type = 'button';
        board.className = 'wooden-sign-btn';
        board.innerHTML = `
          <span class="rope left"></span>
          <span class="rope right"></span>
          <span class="nail left"></span>
          <span class="nail right"></span>
          <span class="wooden-letter">${opt}</span>
        `;
        board.onclick = async () => {
          if (locked || destroyed) return;
          if (opt === curAnswer) {
            locked = true;
            board.classList.add('correct');
            ns.Media.playEffect('confirm');
            const base = stripTone(curAnswer);
            await ns.Media.playSoundSequence([base, curToneName, curAnswer.toLowerCase()], () => destroyed);
            await playRandomTrue();
            if (destroyed) return;

            qIdx++;
            if (qIdx < totalQ) {
              setTimeout(showQuestion, 450);
            } else {
              ns.Media.playEffect('hooray');
              onComplete();
            }
          } else {
            board.classList.add('wrong');
            ns.Media.playEffect('fail');
            setTimeout(() => board.classList.remove('wrong'), 450);
          }
        };
        stack.appendChild(board);
      });

      stage.appendChild(stack);
      speakQuestion();
    }

    showQuestion();

    return {
      destroy() { destroyed = true; }
    };
  }

  /**
   * =========================================================================
   * GAME 4: BĂNG CHUYỀN ĐÓNG THÙNG CHAI (dongthungchai) — Giống 02:08–03:09 video
   * =========================================================================
   */
  function renderDongThungChaiGame(step, container, onComplete, setHelpHandler) {
    const rawValues = Array.isArray(step.values) ? step.values : ['ò', 'ó', 'ỏ', 'õ', 'ọ'];
    const modeType = (step.type || 'dau').toLowerCase(); // 'dau' | 'amdau' | 'van'

    function getGroupKey(val) {
      if (modeType === 'dau') {
        const tk = detectTone(val);
        return tk ? TONE_MAP[tk].label : '0';
      }
      if (modeType === 'amdau') {
        return splitOnsetRime(val).onset || val[0];
      }
      return splitOnsetRime(val).rime || val;
    }

    // Gom theo nhóm thùng (mỗi vòng tối đa 3 thùng để giao diện thoáng dễ kéo cho bé)
    const uniqueKeys = Array.from(new Set(rawValues.map(getGroupKey)));
    const rounds = [];
    if (uniqueKeys.length === 5) {
      // Giống video: Vòng 1 có 2 thùng, Vòng 2 có 3 thùng
      rounds.push(uniqueKeys.slice(0, 2));
      rounds.push(uniqueKeys.slice(2, 5));
    } else {
      for (let i = 0; i < uniqueKeys.length; i += 3) {
        rounds.push(uniqueKeys.slice(i, i + 3));
      }
    }

    let roundIdx = 0;
    let destroyed = false;
    let rafId = null;
    let cleanupDrag = null;

    const promptAudio = modeType === 'amdau' ? 'games/dongthungchai1_amdau'
      : modeType === 'van' ? 'games/dongthungchai1_van'
      : 'games/dongthungchai1_dau';

    function speakPrompt() {
      ns.Media.playSoundToken(promptAudio);
    }
    setHelpHandler(speakPrompt);

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage factory-stage';
    container.appendChild(stage);

    function startRound() {
      if (rafId) cancelAnimationFrame(rafId);
      if (cleanupDrag) { cleanupDrag(); cleanupDrag = null; }
      if (destroyed) return;

      const boxKeys = rounds[roundIdx];
      // Tạo 2 chai cho mỗi thùng (tổng 4-6 chai mỗi vòng cho vừa sức bé)
      let bottlePool = [];
      boxKeys.forEach(bk => {
        const matching = rawValues.filter(v => getGroupKey(v) === bk);
        const picks = shuffle(matching).slice(0, 2);
        if (picks.length === 1) picks.push(picks[0]);
        picks.forEach(val => bottlePool.push({ val, group: bk }));
      });
      bottlePool = shuffle(bottlePool);

      stage.innerHTML = `
        <div class="conveyor-zone">
          <div class="bottles-track" id="bottlesTrack"></div>
          <div class="conveyor-belt">
            <span class="gear-wheel">⚙️</span>
            <span class="gear-wheel">⚙️</span>
            <span class="gear-wheel">⚙️</span>
            <span class="gear-wheel">⚙️</span>
          </div>
        </div>
        <div class="boxes-zone" id="boxesZone"></div>
      `;

      const trackEl = stage.querySelector('#bottlesTrack');
      const boxesZone = stage.querySelector('#boxesZone');

      // Dựng các thùng các-tông trên xe đẩy bánh đỏ
      const boxEls = boxKeys.map(bk => {
        const box = document.createElement('div');
        box.className = 'carton-box-wrap';
        box.dataset.group = bk;
        const displayMark = bk === '\\' ? '̀' : bk === '/' ? '́' : bk === '?' ? '̉' : bk === '~' ? '̃' : bk === '.' ? '̣' : bk;
        const isToneMark = ['\\', '/', '?', '~', '.'].includes(bk);
        box.innerHTML = `
          <div class="carton-body">
            <div class="carton-label ${isToneMark ? 'tone-mark' : ''}">${isToneMark ? bk : displayMark}</div>
            <div class="carton-count" data-count="0"></div>
          </div>
          <div class="carton-wheels">
            <span class="wheel"></span><span class="wheel"></span>
          </div>
        `;
        boxesZone.appendChild(box);
        return box;
      });

      const stageW = stage.clientWidth || 360;
      const bottles = bottlePool.map((item, i) => {
        const bEl = document.createElement('div');
        bEl.className = 'glass-bottle';
        bEl.innerHTML = `
          <svg viewBox="0 0 64 118" width="60" height="110">
            <path d="M23,6 L41,6 L41,14 L39,18 L39,34 C50,42 58,52 58,68 L58,106 C58,112 52,115 44,115 L20,115 C12,115 6,112 6,106 L6,68 C6,52 14,42 25,34 L25,18 L23,14 Z"
                  fill="rgba(235,248,255,0.9)" stroke="#bae6fd" stroke-width="2.5"/>
            <rect x="21" y="4" width="22" height="7" rx="3" fill="#cbd5e1"/>
            <path d="M14,66 C14,56 18,50 22,46" stroke="rgba(255,255,255,0.8)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          </svg>
          <span class="bottle-text">${item.val}</span>
        `;
        trackEl.appendChild(bEl);
        return {
          el: bEl,
          val: item.val,
          group: item.group,
          x: stageW + i * 115,
          dragging: false,
          sorted: false
        };
      });

      let draggingBottle = null;
      let sortedCount = 0;

      bottles.forEach(b => {
        function down(e) {
          if (b.sorted || destroyed) return;
          e.preventDefault();
          draggingBottle = b;
          b.dragging = true;
          b.el.classList.add('is-dragging');
          ns.Media.playSoundToken(b.val.toLowerCase());
          moveBottleToPointer(e);
        }
        b.el.addEventListener('mousedown', down);
        b.el.addEventListener('touchstart', down, { passive: false });
      });

      function moveBottleToPointer(e) {
        if (!draggingBottle) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = stage.getBoundingClientRect();
        draggingBottle.el.style.position = 'fixed';
        draggingBottle.el.style.left = `${cx - 30}px`;
        draggingBottle.el.style.top = `${cy - 55}px`;
        draggingBottle.el.style.zIndex = '50';

        // Đánh dấu sáng thùng đang kéo qua
        boxEls.forEach(bx => {
          const br = bx.getBoundingClientRect();
          const over = cx >= br.left && cx <= br.right && cy >= br.top && cy <= br.bottom;
          bx.classList.toggle('drag-over', over);
        });
      }

      function onMove(e) {
        if (!draggingBottle || destroyed) return;
        e.preventDefault();
        moveBottleToPointer(e);
      }

      function onUp(e) {
        if (!draggingBottle || destroyed) return;
        const b = draggingBottle;
        draggingBottle = null;
        b.dragging = false;
        b.el.classList.remove('is-dragging');

        const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

        let matchedBox = null;
        let droppedOnAnyBox = false;
        boxEls.forEach(bx => {
          bx.classList.remove('drag-over');
          const br = bx.getBoundingClientRect();
          if (cx >= br.left - 12 && cx <= br.right + 12 && cy >= br.top - 16 && cy <= br.bottom + 12) {
            droppedOnAnyBox = true;
            if (bx.dataset.group === b.group) matchedBox = bx;
          }
        });

        if (matchedBox) {
          b.sorted = true;
          b.el.remove();
          sortedCount++;
          ns.Media.playEffect('confirm');
          ns.Media.playSoundToken(b.val.toLowerCase());
          matchedBox.classList.add('box-bounce');
          setTimeout(() => matchedBox.classList.remove('box-bounce'), 320);

          if (sortedCount >= bottles.length) {
            cancelAnimationFrame(rafId);
            playRandomTrue().then(() => {
              if (destroyed) return;
              roundIdx++;
              if (roundIdx < rounds.length) {
                startRound();
              } else {
                ns.Media.playEffect('hooray');
                onComplete();
              }
            });
          }
        } else {
          // Trả chai lại băng chuyền
          if (droppedOnAnyBox) ns.Media.playEffect('fail');
          b.el.style.position = 'absolute';
          b.el.style.top = '';
          b.el.style.zIndex = '';
          b.el.style.left = `${b.x}px`;
        }
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);

      cleanupDrag = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };

      // Chạy băng chuyền liên tục (chai trôi qua mép trái sẽ vòng lại mép phải)
      let lastT = performance.now();
      function tick(now) {
        if (destroyed) return;
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        const w = stage.clientWidth || 360;

        bottles.forEach(b => {
          if (b.sorted || b.dragging) return;
          b.x -= 48 * dt;
          if (b.x < -75) {
            // Vòng lại sau chai xa nhất bên phải
            const maxX = Math.max(w, ...bottles.filter(o => !o.sorted).map(o => o.x));
            b.x = maxX + 110;
          }
          b.el.style.left = `${b.x}px`;
        });
        rafId = requestAnimationFrame(tick);
      }

      speakPrompt();
      rafId = requestAnimationFrame(tick);
    }

    startRound();

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (cleanupDrag) cleanupDrag();
      }
    };
  }

  /**
   * =========================================================================
   * GAME 5: THỦ MÔN BẮT BÓNG (goal) — Dùng trực tiếp đồ họa & 10 Storyboard từ animations/goal.xaml
   *   - sb_stand (lặp vô hạn): Thủ môn nhún người sẵn sàng bắt bóng
   *   - sb_{keeperPos}{ballPos} (1=Trái, 2=Giữa, 3=Phải):
   *       + sb_11, sb_22, sb_33: Thủ môn bay đúng góc đẩy bóng văng ra ngoài (Đúng!)
   *       + sb_12, sb_13, sb_21, sb_23, sb_31, sb_32: Đổ người sai góc, bóng lọt lưới (Thử lại!)
   * =========================================================================
   */
  function renderGoalGame(step, container, onComplete, setHelpHandler) {
    const allVals = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ'];
    const typeIdx = getPromptTypeIdx(step.type);
    const totalQ = Number(step.questions) || 5;

    let qIdx = 0;
    let destroyed = false;
    let locked = false;
    let currentTarget = '';
    let xamlWidget = null;
    const pendingTimers = [];

    function schedule(fn, ms) {
      const id = setTimeout(() => {
        if (!destroyed) fn();
      }, ms);
      pendingTimers.push(id);
      return id;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage goal-stage goal-xaml-stage';
    stage.innerHTML = `
      <!-- Thanh tiến độ phía trên -->
      <div class="game-progress-track">
        <div class="game-progress-fill" id="goalProgFill" style="width:0%"></div>
      </div>

      <!-- Khung sân khấu 400x400 đồng bộ tọa độ với goal.xaml -->
      <div class="goal-xaml-scene" id="goalXamlScene">
        <!-- Lớp nền sân vận động neo chính xác theo đường biên ngang của goal1 (y = 148) -->
        <div class="goal-stadium-backdrop" aria-hidden="true">
          <div class="goal-sky-top">
            <span class="g-cloud gc1"></span>
            <span class="g-cloud gc2"></span>
            <div class="g-stands-outer"></div>
            <div class="g-stands-inner"></div>
          </div>
          <div class="goal-pitch-bottom">
            <div class="g-pitch-line"></div>
            <div class="g-pitch-box"></div>
            <div class="g-pitch-arc"></div>
          </div>
        </div>

        <!-- Lớp chứa SVG từ animations/goal.xaml (hoặc dự phòng nếu mở file:// offline) -->
        <div class="goal-xaml-mount" id="goalXamlMount"></div>

        <!-- 3 ô chữ mục tiêu đặt gọn trong khung thành phía trên đầu thủ môn -->
        <div class="goal-xaml-targets" id="goalTargets"></div>
      </div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#goalProgFill');
    const mountEl = stage.querySelector('#goalXamlMount');
    const targetsRow = stage.querySelector('#goalTargets');

    function speakPrompt(includeIntro) {
      const seq = [];
      if (includeIntro) seq.push('games/goal_start');
      seq.push(`games/goal${typeIdx}`, currentTarget.toLowerCase());
      ns.Media.playSoundSequence(seq, () => destroyed);
    }
    setHelpHandler(() => speakPrompt(false));

    // Dự phòng SVG gọn nhẹ nếu trình duyệt không tải được animations/goal.xaml (ví dụ chạy file://)
    function mountFallbackGoalSvg() {
      mountEl.innerHTML = `
        <svg viewBox="0 0 400 400" width="100%" height="100%" style="overflow:visible;">
          <rect x="66" y="6" width="270" height="142" fill="rgba(15,23,42,0.14)" stroke="#ffffff" stroke-width="7" rx="6"/>
          <g id="fbGoalie" style="transition: transform 0.45s cubic-bezier(0.22,0.85,0.36,1);">
            <circle cx="200" cy="84" r="17" fill="#fbd3b0" stroke="#92400e" stroke-width="2"/>
            <path d="M183,82 C184,66 216,66 217,82 C210,74 190,74 183,82 Z" fill="#1e293b"/>
            <rect x="184" y="102" width="32" height="32" rx="8" fill="#f97316"/>
            <text x="200" y="123" text-anchor="middle" fill="#fde047" font-weight="900" font-size="16">1</text>
            <rect x="185" y="132" width="30" height="14" rx="4" fill="#dc2626"/>
            <line x1="192" y1="146" x2="190" y2="168" stroke="#fbd3b0" stroke-width="7" stroke-linecap="round"/>
            <line x1="208" y1="146" x2="210" y2="168" stroke="#fbd3b0" stroke-width="7" stroke-linecap="round"/>
          </g>
          <g id="fbBall" style="transition: transform 0.55s cubic-bezier(0.22,0.85,0.36,1);">
            <circle cx="200" cy="354" r="36" fill="#ffffff" stroke="#1e293b" stroke-width="3"/>
            <polygon points="200,334 214,344 209,360 191,360 186,344" fill="#1e293b"/>
          </g>
        </svg>
      `;
    }

    function startIdleStand() {
      if (xamlWidget) {
        xamlWidget.playStoryboard('sb_stand', { resetBefore: true, loop: true });
      } else {
        const g = mountEl.querySelector('#fbGoalie');
        const b = mountEl.querySelector('#fbBall');
        if (g) g.style.transform = 'translate(0px, 0px)';
        if (b) {
          b.style.transition = 'none';
          b.style.transform = 'translate(0px, 0px) scale(1)';
        }
      }
    }

    function playKickAnimation(keeperPos, ballPos) {
      if (xamlWidget) {
        const sbName = `sb_${keeperPos}${ballPos}`;
        return xamlWidget.playStoryboard(sbName, { resetBefore: true });
      }
      // Dự phòng nếu không có goal.xaml
      const g = mountEl.querySelector('#fbGoalie');
      const b = mountEl.querySelector('#fbBall');
      const kx = keeperPos === 1 ? -92 : keeperPos === 3 ? 92 : 0;
      const bx = ballPos === 1 ? -105 : ballPos === 3 ? 105 : 0;
      if (g) g.style.transform = `translate(${kx}px, -36px)`;
      if (b) {
        b.style.transition = 'transform 0.55s cubic-bezier(0.22,0.85,0.36,1)';
        b.style.transformOrigin = '200px 354px';
        b.style.transform = `translate(${bx}px, -310px) scale(0.45)`;
      }
      return new Promise(r => schedule(r, 1100));
    }

    function nextRound() {
      if (destroyed) return;
      locked = false;
      targetsRow.classList.remove('shooting');
      startIdleStand();

      currentTarget = allVals[Math.floor(Math.random() * allVals.length)];
      const others = shuffle(allVals.filter(v => v !== currentTarget)).slice(0, 2);
      const choices = shuffle([currentTarget, ...others]);

      targetsRow.innerHTML = '';
      choices.forEach((ch, idx) => {
        const oval = document.createElement('button');
        oval.type = 'button';
        oval.className = 'goal-target-oval';
        oval.textContent = ch;

        oval.onclick = async () => {
          if (locked || destroyed) return;
          locked = true;

          const keeperPos = idx + 1; // 1 = Trái, 2 = Giữa, 3 = Phải
          const ballPos = choices.indexOf(currentTarget) + 1;
          const isCorrect = keeperPos === ballPos;

          targetsRow.classList.add('shooting');
          ns.Media.playGameEffect('goal_kick');

          // Thời điểm bóng chạm tay thủ môn / bay vào lưới khớp chuẩn keyframe goal.xaml
          const impactMs = keeperPos === 2 ? 480 : 620;
          schedule(() => {
            ns.Media.playGameEffect(isCorrect ? 'goal_catch' : 'goal_fail');
          }, impactMs);

          await playKickAnimation(keeperPos, ballPos);
          if (destroyed) return;

          if (isCorrect) {
            qIdx++;
            if (progFill) {
              progFill.style.width = `${Math.min(100, (qIdx / totalQ) * 100)}%`;
            }
            await playRandomTrue();
            if (destroyed) return;

            if (qIdx < totalQ) {
              nextRound();
            } else {
              ns.Media.playGameEffect('goal_end');
              onComplete();
            }
          } else {
            // Đổ người sai góc -> chờ 350ms để bé nhìn bóng trong lưới rồi cho thử lại
            schedule(() => {
              targetsRow.classList.remove('shooting');
              startIdleStand();
              locked = false;
              speakPrompt(false);
            }, 350);
          }
        };
        targetsRow.appendChild(oval);
      });

      speakPrompt(qIdx === 0);
    }

    async function initGoalScene() {
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';
      if (canUseXaml) {
        xamlWidget = await ns.XamlParser.createInteractiveXaml('animations/goal.xaml', {
          viewBox: '0 -10 400 415',
          textTargetName: null
        });
      }
      if (destroyed) {
        if (xamlWidget) xamlWidget.destroy();
        return;
      }

      if (xamlWidget) {
        mountEl.innerHTML = '';
        mountEl.appendChild(xamlWidget.svg);
      } else {
        mountFallbackGoalSvg();
      }
      nextRound();
    }

    initGoalScene();

    return {
      destroy() {
        destroyed = true;
        pendingTimers.forEach(id => clearTimeout(id));
        if (xamlWidget) xamlWidget.destroy();
      }
    };
  }

  /**
   * =========================================================================
   * GAME 6: ĐẬP CHUỘT CHŨI (mole) — Sử dụng trực tiếp đồ họa & hoạt ảnh từ animations/mole.xaml
   *   - sb_show: Chuột chũi nhô lên kèm bong bóng thoại trắng chứa chữ ở phía trên đầu
   *   - sb_hide: Chuột thụt xuống hang
   *   - sb_true: Búa đập xuống, chuột hoa mắt xoay tròn & nổ sao rồi biến mất
   *   - sb_fail: Chuột đội mũ bảo hiểm đỏ cản búa, búa văng ngược lên trời
   * =========================================================================
   */
  function renderMoleGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['a', 'à', 'á'];
    const typeIdx = getPromptTypeIdx(step.type);
    const totalQ = Number(step.questions) || 3;
    const perQGoal = Math.min(Number(step.answer) || 3, 5);

    let qIdx = 0;
    let score = 0;
    let destroyed = false;
    let finished = false;
    let timerId = null;
    let currentTarget = values[0];

    function isMatch(val) {
      if (typeIdx === '1') return val.toLowerCase() === currentTarget.toLowerCase();
      return val === currentTarget;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage mole-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="moleProgFill" style="width:0%"></div>
      </div>
      <div class="arcade-hint-badge" id="moleHint"></div>
      <div class="mole-grid mole-grid-xaml" id="moleGrid"></div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#moleProgFill');
    const hintEl = stage.querySelector('#moleHint');
    const grid = stage.querySelector('#moleGrid');

    function speakPrompt() {
      ns.Media.playSoundSequence(['games/mole', currentTarget.toLowerCase()], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    const totalNeed = totalQ * perQGoal;
    let totalHit = 0;
    const slots = [];

    function handleSlotTap(slot) {
      if (slot.state !== 'up' || finished || destroyed) return;
      slot.state = 'hitting';
      if (slot.hideTimer) {
        clearTimeout(slot.hideTimer);
        slot.hideTimer = null;
      }

      const val = slot.currentVal;
      ns.Media.playGameEffect('mole_hammer');

      if (isMatch(val)) {
        ns.Media.playGameEffect('mole_true');
        ns.Media.playSoundToken(val.toLowerCase());
        score++;
        totalHit++;
        progFill.style.width = `${Math.min(100, (totalHit / totalNeed) * 100)}%`;

        const animPromise = slot.widget
          ? slot.widget.playStoryboard('sb_true')
          : Promise.resolve();

        animPromise.then(() => {
          if (slot.widget) slot.widget.resetToInitial();
          slot.el.classList.remove('up');
          slot.state = 'idle';
        });

        if (score >= perQGoal) {
          qIdx++;
          if (qIdx >= totalQ) {
            finished = true;
            if (timerId) clearInterval(timerId);
            setTimeout(() => {
              if (destroyed) return;
              ns.Media.playEffect('hooray');
              playRandomTrue().then(() => { if (!destroyed) onComplete(); });
            }, 900);
          } else {
            score = 0;
            currentTarget = typeIdx === '1' ? values[0] : values[qIdx % values.length];
            hintEl.textContent = `Đập chuột mang chữ: "${currentTarget}"`;
            // Ẩn các chuột đang trồi của câu cũ
            slots.forEach(s => {
              if (s !== slot && s.state === 'up') {
                if (s.hideTimer) clearTimeout(s.hideTimer);
                s.state = 'hiding';
                if (s.widget) {
                  s.widget.playStoryboard('sb_hide').then(() => {
                    s.widget.resetToInitial();
                    s.state = 'idle';
                  });
                } else {
                  s.el.classList.remove('up');
                  s.state = 'idle';
                }
              }
            });
            setTimeout(() => { if (!destroyed && !finished) speakPrompt(); }, 700);
          }
        }
      } else {
        ns.Media.playGameEffect('mole_fail');
        const animPromise = slot.widget
          ? slot.widget.playStoryboard('sb_fail')
          : Promise.resolve();

        animPromise.then(() => {
          if (slot.widget) slot.widget.resetToInitial();
          slot.el.classList.remove('up');
          slot.state = 'idle';
        });
      }
    }

    function popRandomMole() {
      if (destroyed || finished || slots.length === 0) return;
      const idleSlots = slots.filter(s => s.state === 'idle');
      if (idleSlots.length === 0) return;

      // Giới hạn tối đa 3 chuột trồi cùng lúc để bé dễ quan sát và không rối mắt
      const upCount = slots.filter(s => s.state === 'up').length;
      if (upCount >= 3) return;

      const slot = idleSlots[Math.floor(Math.random() * idleSlots.length)];

      const targets = values.filter(isMatch);
      const others = values.filter(v => !isMatch(v));
      const pool = (others.length === 0 || Math.random() < 0.56) ? targets : others;
      const val = pool[Math.floor(Math.random() * pool.length)];

      slot.state = 'up';
      slot.currentVal = val;
      ns.Media.playGameEffect('mole_show');

      if (slot.widget) {
        slot.widget.resetToInitial();
        slot.widget.setText(val);
        slot.widget.playStoryboard('sb_show');
      } else {
        const wEl = slot.el.querySelector('.mole-word');
        if (wEl) wEl.textContent = val;
        slot.el.classList.add('up');
      }

      slot.hideTimer = setTimeout(() => {
        if (slot.state !== 'up' || destroyed || finished) return;
        slot.state = 'hiding';
        if (slot.widget) {
          slot.widget.playStoryboard('sb_hide').then(() => {
            if (slot.state === 'hiding') {
              slot.widget.resetToInitial();
              slot.state = 'idle';
            }
          });
        } else {
          slot.el.classList.remove('up');
          slot.state = 'idle';
        }
      }, 2700);
    }

    async function initMoleSlots() {
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';

      for (let i = 0; i < 6; i++) {
        const h = document.createElement('div');
        let widget = null;

        if (canUseXaml) {
          widget = await ns.XamlParser.createInteractiveXaml('animations/mole.xaml', {
            viewBox: '25 5 365 365',
            textTargetName: 'box1_2'
          });
        }

        if (destroyed) {
          if (widget) widget.destroy();
          return;
        }

        if (widget) {
          h.className = 'mole-hole-xaml';
          h.appendChild(widget.svg);
        } else {
          // Dự phòng CSS nếu không tải được file mole.xaml
          h.className = 'mole-hole';
          h.innerHTML = `<button type="button" class="mole-pop"><span class="mole-face">🐹</span><span class="mole-word"></span></button><div class="mole-mound"></div>`;
        }

        const slot = { el: h, widget, state: 'idle', currentVal: '', hideTimer: null };
        h.addEventListener('click', () => handleSlotTap(slot));
        grid.appendChild(h);
        slots.push(slot);
      }

      currentTarget = values[0];
      hintEl.textContent = `Đập chuột mang chữ: "${currentTarget}"`;
      speakPrompt();
      popRandomMole();
      timerId = setInterval(popRandomMole, 1050);
    }

    initMoleSlots();

    return {
      destroy() {
        destroyed = true;
        if (timerId) clearInterval(timerId);
        slots.forEach(s => {
          if (s.hideTimer) clearTimeout(s.hideTimer);
          if (s.widget) s.widget.destroy();
        });
      }
    };
  }

  /**
   * =========================================================================
   * GAME 7: LẬT VỎ SÒ TRÍ NHỚ (memory) — Dùng đồ họa & hoạt ảnh từ animations/memory.xaml
   *   - grid1: Vỏ sò đóng kín trên bãi biển
   *   - sb1: Vỏ sò nhảy lên mở toang khoe chữ sáng bên trong (`grid`)
   *   - sb2: Vỏ sò khép lại khi không khớp cặp
   * =========================================================================
   */
  function renderMemoryGame(step, container, onComplete, setHelpHandler) {
    const raw = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['e', 'è', 'é', 'ẻ'];
    const baseCards = shuffle(raw).slice(0, 6);
    const deck = shuffle([...baseCards, ...baseCards]);

    let first = null;
    let lock = false;
    let matchedPairs = 0;
    let destroyed = false;
    const shellWidgets = [];

    setHelpHandler(() => ns.Media.playSoundToken('games/memory'));

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage memory-stage memory-xaml-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="memProgFill" style="width:0%"></div>
      </div>
      <div class="memory-grid memory-xaml-grid" id="memGrid"></div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#memProgFill');
    const grid = stage.querySelector('#memGrid');

    async function initShells() {
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';

      for (let i = 0; i < deck.length; i++) {
        const val = deck[i];
        const slot = document.createElement('button');
        slot.type = 'button';
        let widget = null;

        if (canUseXaml) {
          widget = await ns.XamlParser.createInteractiveXaml('animations/memory.xaml', {
            viewBox: '42 65 316 345',
            textTargetName: null,
            injectTexts: {
              label: { parent: 'grid', x: 200, y: 208, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 9, baseSize: 82, maxWidth: 195 }
            }
          });
        }
        if (destroyed) {
          if (widget) widget.destroy();
          return;
        }

        if (widget) {
          widget.setText(val, 'label');
          slot.className = 'memory-shell-btn';
          slot.appendChild(widget.svg);
          shellWidgets.push(widget);
        } else {
          slot.className = 'memory-card';
          slot.innerHTML = `<span class="mem-front">🐚</span><span class="mem-back">${val}</span>`;
        }

        const item = { el: slot, widget, val, flipped: false, matched: false };

        slot.onclick = () => {
          if (lock || destroyed || item.flipped || item.matched) return;
          item.flipped = true;
          slot.classList.add('flipped');
          ns.Media.playGameEffect('memory_open');
          ns.Media.playSoundToken(val.toLowerCase());

          if (item.widget) item.widget.playStoryboard('sb1');

          if (!first) {
            first = item;
          } else {
            lock = true;
            const prev = first;
            first = null;

            if (prev.val === item.val) {
              prev.matched = true;
              item.matched = true;
              prev.el.classList.add('matched');
              item.el.classList.add('matched');
              matchedPairs++;
              if (progFill) {
                progFill.style.width = `${Math.min(100, (matchedPairs / baseCards.length) * 100)}%`;
              }
              setTimeout(() => {
                if (destroyed) return;
                ns.Media.playEffect('confirm');
                lock = false;
                if (matchedPairs >= baseCards.length) {
                  ns.Media.playEffect('hooray');
                  playRandomTrue().then(() => { if (!destroyed) onComplete(); });
                }
              }, 420);
            } else {
              setTimeout(() => {
                if (destroyed) return;
                ns.Media.playGameEffect('memory_close');
                const p1 = prev.widget ? prev.widget.playStoryboard('sb2') : Promise.resolve();
                const p2 = item.widget ? item.widget.playStoryboard('sb2') : Promise.resolve();
                Promise.all([p1, p2]).then(() => {
                  if (destroyed) return;
                  prev.flipped = false;
                  item.flipped = false;
                  prev.el.classList.remove('flipped');
                  item.el.classList.remove('flipped');
                  lock = false;
                });
              }, 900);
            }
          }
        };

        grid.appendChild(slot);
      }

      ns.Media.playSoundToken('games/memory');
    }

    initShells();

    return {
      destroy() {
        destroyed = true;
        shellWidgets.forEach(w => w.destroy());
      }
    };
  }

  /**
   * =========================================================================
   * GAME 8: ĐUA XE CHỌN LÀN (racing)
   * =========================================================================
   */
  function renderRacingGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) ? step.values : ['ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ'];
    const totalQ = Number(step.questions) || 5;
    let qIdx = 0;
    let destroyed = false;
    let locked = false;
    let target = '';

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage racing-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="raceProg" style="width:0%"></div>
      </div>
      <div class="race-gates" id="raceGates"></div>
      <div class="race-road">
        <div class="race-lane-line"></div>
        <div class="race-lane-line"></div>
        <div class="race-car" id="raceCar">🏎️</div>
      </div>
    `;
    container.appendChild(stage);

    const gatesEl = stage.querySelector('#raceGates');
    const carEl = stage.querySelector('#raceCar');
    const progEl = stage.querySelector('#raceProg');

    function speakPrompt() {
      ns.Media.playSoundSequence(['games/racing', target.toLowerCase()], () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function nextLap() {
      if (destroyed) return;
      locked = false;
      carEl.style.left = '50%';
      target = values[Math.floor(Math.random() * values.length)];
      const choices = shuffle([target, ...shuffle(values.filter(v => v !== target)).slice(0, 2)]);

      gatesEl.innerHTML = '';
      choices.forEach((ch, idx) => {
        const laneX = idx === 0 ? '18%' : idx === 1 ? '50%' : '82%';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'race-gate-btn';
        btn.textContent = ch;
        btn.onclick = async () => {
          if (locked || destroyed) return;
          locked = true;
          carEl.style.left = laneX;

          if (ch === target) {
            btn.classList.add('correct');
            ns.Media.playGameEffect('racing_pass');
            qIdx++;
            progEl.style.width = `${(qIdx / totalQ) * 100}%`;
            await playRandomTrue();
            if (destroyed) return;
            if (qIdx < totalQ) nextLap();
            else { ns.Media.playEffect('hooray'); onComplete(); }
          } else {
            btn.classList.add('wrong');
            ns.Media.playGameEffect('racing_crash');
            setTimeout(() => { btn.classList.remove('wrong'); locked = false; }, 650);
          }
        };
        gatesEl.appendChild(btn);
      });
      speakPrompt();
    }

    nextLap();
    return { destroy() { destroyed = true; } };
  }

  /**
   * =========================================================================
   * GAME 9: TÌM ÂM (timam) & GHÉP HỘP (box matching)
   * =========================================================================
   */
  function renderTimAmGame(step, container, onComplete, setHelpHandler) {
    return renderListenAndPickGame(step, container, onComplete, setHelpHandler, 'games/timam_1');
  }

  /**
   * =========================================================================
   * GAME 9B: CÁNH TAY ROBOT GHÉP HỘP (box matching) — Dùng animations/box.xaml
   *   - sb1: Băng chuyền đưa hộp mẫu `box1` vào, tay robot kẹp nhấc lên cao,
   *          băng chuyền tiếp tục đưa 2 hộp lựa chọn `box2` (trái) & `box3` (phải)
   *   - sb2: Robot đưa `box1` đặt chồng lên hộp trái (`box2`) rồi băng chuyền cuốn đi
   *   - sb3: Robot đưa `box1` đặt chồng lên hộp phải (`box3`) rồi băng chuyền cuốn đi
   * =========================================================================
   */
  function renderBoxMatchingGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['ê', 'ề', 'ế', 'ể', 'ễ'];
    const distractorPool = Array.isArray(step.options) && step.options.length > 0 ? step.options : values;
    const totalQ = Number(step.questions) || 5;

    let qIdx = 0;
    let destroyed = false;
    let readyForPick = false;
    let target = '';
    let leftText = '';
    let rightText = '';
    let widget = null;
    const timers = [];

    function schedule(fn, ms) {
      const id = setTimeout(() => { if (!destroyed) fn(); }, ms);
      timers.push(id);
      return id;
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'game-full-stage box-xaml-stage';
    stage.innerHTML = `
      <div class="game-progress-track">
        <div class="game-progress-fill" id="boxProgFill" style="width:0%"></div>
      </div>

      <div class="box-factory-scene">
        <div class="box-xaml-mount" id="boxXamlMount"></div>
        <!-- 2 vùng bấm khớp chính xác vị trí box2 (x: 171..250, y: 244..284) & box3 (x: 271..350, y: 244..284) -->
        <button type="button" class="box-hit-zone left" id="boxHitLeft" aria-label="Hộp bên trái"></button>
        <button type="button" class="box-hit-zone right" id="boxHitRight" aria-label="Hộp bên phải"></button>
      </div>

      <div class="box-status-pill" id="boxStatusPill">🤖 Robot đang gắp hộp...</div>
    `;
    container.appendChild(stage);

    const progFill = stage.querySelector('#boxProgFill');
    const mountEl = stage.querySelector('#boxXamlMount');
    const hitLeft = stage.querySelector('#boxHitLeft');
    const hitRight = stage.querySelector('#boxHitRight');
    const statusPill = stage.querySelector('#boxStatusPill');

    function speakPrompt(includeIntro) {
      const seq = includeIntro ? ['games/box matching', target.toLowerCase()] : [target.toLowerCase()];
      ns.Media.playSoundSequence(seq, () => destroyed);
    }
    setHelpHandler(() => speakPrompt(true));

    function setHitActive(active) {
      readyForPick = active;
      hitLeft.classList.toggle('active', active);
      hitRight.classList.toggle('active', active);
    }

    async function handleBoxPick(side) {
      if (!readyForPick || destroyed) return;
      const chosen = side === 'left' ? leftText : rightText;
      const hitBtn = side === 'left' ? hitLeft : hitRight;

      if (chosen === target) {
        setHitActive(false);
        statusPill.textContent = `🌟 Chính xác: "${target}"!`;
        ns.Media.playEffect('confirm');
        ns.Media.playGameEffect('box_move');
        ns.Media.playSoundToken(target.toLowerCase());

        schedule(() => ns.Media.playGameEffect('box_gear'), 2200);
        await widget.playStoryboard(side === 'left' ? 'sb2' : 'sb3', { speed: 1.45 });
        if (destroyed) return;

        qIdx++;
        if (progFill) {
          progFill.style.width = `${Math.min(100, (qIdx / totalQ) * 100)}%`;
        }
        await playRandomTrue();
        if (destroyed) return;

        if (qIdx < totalQ) {
          startRound();
        } else {
          ns.Media.playEffect('hooray');
          onComplete();
        }
      } else {
        ns.Media.playEffect('fail');
        hitBtn.classList.add('wrong-flash');
        statusPill.textContent = 'Thử chọn hộp còn lại nhé!';
        schedule(() => hitBtn.classList.remove('wrong-flash'), 420);
      }
    }

    hitLeft.onclick = () => handleBoxPick('left');
    hitRight.onclick = () => handleBoxPick('right');

    async function startRound() {
      if (destroyed || !widget) return;
      setHitActive(false);
      statusPill.textContent = '🤖 Cánh tay robot đang nâng hộp...';

      target = values[qIdx % values.length];
      const candidates = distractorPool.filter(v => v !== target);
      const fallbackOthers = values.filter(v => v !== target);
      const pool = candidates.length > 0 ? candidates : fallbackOthers;
      const distractor = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : target;

      if (Math.random() < 0.5) {
        leftText = target;
        rightText = distractor;
      } else {
        leftText = distractor;
        rightText = target;
      }

      widget.setText(target, 'box1_2');
      widget.setText(leftText, 'box2_2');
      widget.setText(rightText, 'box3_2');

      ns.Media.playGameEffect('box_gear');
      schedule(() => ns.Media.playGameEffect('box_move'), 1100);
      if (qIdx === 0) {
        speakPrompt(true);
      }

      await widget.playStoryboard('sb1', { resetBefore: true, speed: 1.45 });
      if (destroyed) return;

      statusPill.textContent = `👆 Chạm vào hộp giống chữ ở trên!`;
      setHitActive(true);
      speakPrompt(false);
    }

    async function initBoxFactory() {
      const canUseXaml = ns.XamlParser && typeof ns.XamlParser.createInteractiveXaml === 'function';
      if (canUseXaml) {
        widget = await ns.XamlParser.createInteractiveXaml('animations/box.xaml', {
          viewBox: '0 0 400 400',
          overflow: 'hidden',
          textTargets: {
            box1_2: { x: 200, y: 200, fill: '#1e293b', baseSize: 28, maxWidth: 66 },
            box2_2: { x: 200, y: 200, fill: '#1e293b', baseSize: 28, maxWidth: 66 },
            box3_2: { x: 200, y: 200, fill: '#1e293b', baseSize: 28, maxWidth: 66 }
          }
        });
      }

      if (destroyed) {
        if (widget) widget.destroy();
        return;
      }

      if (widget) {
        mountEl.innerHTML = '';
        mountEl.appendChild(widget.svg);
        startRound();
      } else {
        // Dự phòng nếu mở bằng file:// không fetch được box.xaml
        renderListenAndPickGame(step, container, onComplete, setHelpHandler, 'games/box matching');
      }
    }

    initBoxFactory();

    return {
      destroy() {
        destroyed = true;
        timers.forEach(id => clearTimeout(id));
        if (widget) widget.destroy();
      }
    };
  }

  // Game nghe chọn tổng quát có thanh tiến độ + nút ? nghe lại
  function renderListenAndPickGame(step, container, onComplete, setHelpHandler, customPrompt) {
    const values = Array.isArray(step.values) && step.values.length > 0 ? step.values : ['a', 'o', 'e'];
    const totalQ = Math.min(Number(step.questions) || 4, Math.max(3, values.length));
    let qIdx = 0;
    let destroyed = false;
    let locked = false;
    let target = '';

    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'board-card';
    container.appendChild(card);

    function speakPrompt() {
      const seq = customPrompt ? [customPrompt, target.toLowerCase()] : ['games/select3', target.toLowerCase()];
      ns.Media.playSoundSequence(seq, () => destroyed);
    }
    setHelpHandler(speakPrompt);

    function nextRound() {
      if (destroyed) return;
      locked = false;
      target = values[Math.floor(Math.random() * values.length)];
      const pool = Array.from(new Set([...values, ...(step.options || [])]));
      const distractors = shuffle(pool.filter(v => v !== target)).slice(0, 3);
      const choices = shuffle([target, ...distractors]);

      card.innerHTML = `
        <div class="game-progress-track" style="position:static; margin-bottom:14px;">
          <div class="game-progress-fill" style="width:${(qIdx / totalQ) * 100}%"></div>
        </div>
        <h3 style="color:#1e293b; margin-bottom:10px;">🎧 Nghe và chọn đúng chữ (${qIdx + 1}/${totalQ})</h3>
        <button type="button" class="speak-btn" id="reListenBtn">🔊 Nghe lại</button>
        <div class="choices-grid" id="pickGrid"></div>
      `;
      card.querySelector('#reListenBtn').onclick = speakPrompt;

      const grid = card.querySelector('#pickGrid');
      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = c;
        btn.onclick = async () => {
          if (locked || destroyed) return;
          if (c === target) {
            locked = true;
            btn.classList.add('correct');
            ns.Media.playEffect('confirm');
            await playRandomTrue();
            if (destroyed) return;
            qIdx++;
            if (qIdx < totalQ) nextRound();
            else { ns.Media.playEffect('hooray'); onComplete(); }
          } else {
            btn.classList.add('wrong');
            ns.Media.playEffect('fail');
            setTimeout(() => btn.classList.remove('wrong'), 450);
          }
        };
        grid.appendChild(btn);
      });
      speakPrompt();
    }

    nextRound();
    return { destroy() { destroyed = true; } };
  }

  // Ghép vần / Puzzle 2, 3, 4 / Bán âm
  function renderCombineSoundGame(step, container, onComplete, setHelpHandler) {
    const values = Array.isArray(step.values) ? step.values : [];
    const prefix = step.phuam || '';
    const suffix = step.amcuoi || '';
    const van = step.van || '';
    let idx = 0;
    let destroyed = false;

    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'board-card';
    container.appendChild(card);

    function speakCurrent() {
      const item = values[idx] || '';
      const word = (prefix + item + suffix).replace(/[0-9_]/g, '');
      ns.Media.playSoundToken(word.toLowerCase());
    }
    setHelpHandler(speakCurrent);

    function showItem() {
      const item = values[idx] || '';
      const combined = (prefix + item + suffix).replace(/[0-9_]/g, '');
      const partsHtml = prefix
        ? `<span style="color:#2563eb">${prefix}</span> + <span style="color:#f97316">${item}</span> = `
        : suffix
          ? `<span style="color:#f97316">${item}</span> + <span style="color:#2563eb">${suffix}</span> = `
          : van ? `<span style="color:#64748b; font-size:1.2rem;">Vần "${van}"</span><br/>` : '';

      card.innerHTML = `
        <div style="font-size:0.9rem; color:#64748b; font-weight:700;">Ghép vần & Đọc to (${idx + 1}/${values.length})</div>
        <div class="big-letter" style="font-size:3rem; margin:20px 0;">${partsHtml}<span style="color:#7e22ce">${combined}</span></div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button type="button" class="speak-btn" id="readCombBtn">🔊 Đọc mẫu</button>
          <button type="button" class="speak-btn" id="nextCombBtn" style="background:linear-gradient(180deg,#4ade80,#16a34a)">
            ${idx < values.length - 1 ? 'Từ tiếp ➡' : '🎉 Xong'}
          </button>
        </div>
      `;
      card.querySelector('#readCombBtn').onclick = speakCurrent;
      card.querySelector('#nextCombBtn').onclick = () => {
        if (idx < values.length - 1) {
          idx++;
          showItem();
        } else {
          ns.Media.playEffect('hooray');
          onComplete();
        }
      };
      speakCurrent();
    }

    if (values.length > 0) showItem();
    else onComplete();

    return { destroy() { destroyed = true; } };
  }

  // ===== CÁC GAME ĐÁNH VẦN / TƯ DUY NGÔN NGỮ (GIỮ NGUYÊN & TƯƠNG THÍCH) =====
  function renderReadingListGame(step, container, onComplete, setHelpHandler) {
    const values = step.values || [];
    let idx = 0;
    let destroyed = false;
    const card = document.createElement('div');
    card.className = 'board-card';

    function speakWord() {
      const cleanWord = (values[idx] || '').replace(/[0-9_]/g, '');
      ns.Media.playSoundToken(cleanWord.toLowerCase().replace(/\./g, ''));
    }
    setHelpHandler(speakWord);

    function updateView() {
      const cleanWord = (values[idx] || '').replace(/[0-9_]/g, '');
      card.innerHTML = `
        <div style="font-size:0.9rem; color:#64748b; font-weight:700; margin-bottom:6px;">
          🗣️ Luyện đánh vần & đọc to (${idx + 1}/${values.length})
        </div>
        <div class="big-letter" style="font-size:2.8rem; margin: 18px 0;">${cleanWord}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
          <button type="button" class="speak-btn" id="readWordBtn">🔊 Nghe phát âm</button>
          ${idx > 0 ? '<button type="button" class="speak-btn" id="prevWBtn" style="background:#64748b">⬅ Từ trước</button>' : ''}
          <button type="button" class="speak-btn" id="nextWBtn" style="background:#ff6b35">${idx < values.length - 1 ? 'Từ tiếp ➡' : '🎉 Xong'}</button>
        </div>
      `;
      card.querySelector('#readWordBtn').onclick = speakWord;
      if (card.querySelector('#prevWBtn')) {
        card.querySelector('#prevWBtn').onclick = () => { idx--; updateView(); };
      }
      card.querySelector('#nextWBtn').onclick = () => {
        if (idx < values.length - 1) { idx++; updateView(); }
        else { ns.Media.playEffect('hooray'); onComplete(); }
      };
      speakWord();
    }

    container.appendChild(card);
    if (values.length > 0) updateView();
    else onComplete();
    return { destroy() { destroyed = true; } };
  }

  function renderIdiomsGame(step, container, onComplete) {
    const v1 = step.values1 || [];
    const v2 = step.values2 || [];
    let idx = 0;
    const card = document.createElement('div');
    card.className = 'board-card';
    function showIdiom() {
      card.innerHTML = `
        <div style="font-size:0.85rem; color:#64748b;">Thành ngữ - Tục ngữ (${idx + 1}/${v1.length})</div>
        <h2 style="color:var(--primary); margin:12px 0; font-size:1.45rem;">“${v1[idx]}”</h2>
        <div class="poem-box" style="font-size:1rem; text-align:left;">💡 <b>Ý nghĩa:</b> ${v2[idx] || ''}</div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" class="speak-btn" id="prevIdiom" style="background:#64748b">⬅ Trước</button>
          <button type="button" class="speak-btn" id="randIdiom">🎲 Ngẫu nhiên</button>
          <button type="button" class="speak-btn" id="nextIdiom" style="background:var(--primary)">Tiếp ➡</button>
        </div>
      `;
      card.querySelector('#prevIdiom').onclick = () => { idx = (idx - 1 + v1.length) % v1.length; showIdiom(); };
      card.querySelector('#nextIdiom').onclick = () => { idx = (idx + 1) % v1.length; showIdiom(); };
      card.querySelector('#randIdiom').onclick = () => { idx = Math.floor(Math.random() * v1.length); showIdiom(); };
    }
    container.appendChild(card);
    showIdiom();
    return { destroy() {} };
  }

  function renderPoemReader(step, container) {
    const poems = step.data || [];
    let idx = 0;
    const card = document.createElement('div');
    card.className = 'board-card';
    function showPoem() {
      const p = poems[idx];
      card.innerHTML = `
        <div style="font-size:0.85rem; color:#64748b;">Bài thơ (${idx + 1}/${poems.length})</div>
        <h2 style="color:var(--primary); margin:8px 0;">🌸 ${p.title}</h2>
        <div class="poem-box">${p.desc}</div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button type="button" class="speak-btn" id="prevPoem" style="background:#64748b">⬅ Bài trước</button>
          <button type="button" class="speak-btn" id="speakPoem">🔊 Nghe đọc</button>
          <button type="button" class="speak-btn" id="nextPoem" style="background:var(--primary)">Bài tiếp ➡</button>
        </div>
      `;
      card.querySelector('#prevPoem').onclick = () => { idx = (idx - 1 + poems.length) % poems.length; showPoem(); };
      card.querySelector('#nextPoem').onclick = () => { idx = (idx + 1) % poems.length; showPoem(); };
      card.querySelector('#speakPoem').onclick = () => ns.Media.playSoundToken(p.title.toLowerCase());
    }
    container.appendChild(card);
    showPoem();
    return { destroy() {} };
  }

  function renderConnectionGame(step, container, onComplete) {
    const v1 = step.values1 || [];
    const v2 = step.values2 || [];
    const pairs = v1.map((left, i) => ({ id: i, left, right: v2[i] }));
    const rightShuffled = shuffle(pairs);

    let selectedLeft = null;
    let matched = 0;
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `<h3>🔗 Nối hai cột tạo thành từ có nghĩa</h3>`;

    const cols = document.createElement('div');
    cols.className = 'conn-columns';
    const leftCol = document.createElement('div');
    leftCol.className = 'conn-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'conn-col';

    pairs.forEach(p => {
      const btn = document.createElement('div');
      btn.className = 'conn-item';
      btn.textContent = p.left;
      btn.onclick = () => {
        ns.Media.playSoundToken(p.left);
        leftCol.querySelectorAll('.conn-item').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        selectedLeft = { id: p.id, el: btn, text: p.left };
      };
      leftCol.appendChild(btn);
    });

    rightShuffled.forEach(p => {
      const btn = document.createElement('div');
      btn.className = 'conn-item';
      btn.textContent = p.right;
      btn.onclick = () => {
        if (!selectedLeft) return;
        if (selectedLeft.id === p.id) {
          ns.Media.playEffect('confirm');
          selectedLeft.el.classList.remove('selected');
          selectedLeft.el.classList.add('matched');
          btn.classList.add('matched');
          ns.Media.playSoundToken(`${selectedLeft.text} ${p.right}`);
          selectedLeft = null;
          matched++;
          if (matched >= pairs.length) {
            ns.Media.playEffect('hooray');
            setTimeout(onComplete, 700);
          }
        } else {
          ns.Media.playEffect('fail');
        }
      };
      rightCol.appendChild(btn);
    });

    cols.appendChild(leftCol);
    cols.appendChild(rightCol);
    card.appendChild(cols);
    container.appendChild(card);
    return { destroy() {} };
  }

  function renderOptionsQuizGame(step, container, onComplete) {
    const questions = step.values1 || [];
    const answers = step.values2 || [];
    let qIdx = 0;
    const card = document.createElement('div');
    card.className = 'board-card';

    function showQ() {
      const correctAns = answers[qIdx];
      const distractors = shuffle(answers.filter((_, i) => i !== qIdx)).slice(0, 3);
      const choices = shuffle([correctAns, ...distractors]);

      card.innerHTML = `
        <div style="font-size:0.85rem; color:#64748b;">Câu đố (${qIdx + 1}/${questions.length})</div>
        <div class="subtitle-box" style="margin:14px 0; font-size:1.08rem;">❓ ${questions[qIdx]}</div>
        <div class="choices-grid" id="optGrid"></div>
      `;
      const grid = card.querySelector('#optGrid');
      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.style.fontSize = '1.12rem';
        btn.textContent = c;
        btn.onclick = () => {
          if (c === correctAns) {
            btn.classList.add('correct');
            ns.Media.playEffect('hooray');
            ns.Media.playSoundToken(c);
            setTimeout(() => {
              qIdx++;
              if (qIdx < questions.length) showQ();
              else onComplete();
            }, 1000);
          } else {
            btn.classList.add('wrong');
            ns.Media.playEffect('fail');
          }
        };
        grid.appendChild(btn);
      });
    }
    container.appendChild(card);
    showQ();
    return { destroy() {} };
  }

  function renderChinhTaGame(step, lesson, container, onComplete) {
    const words = step.values1 || [];
    const groups = step.values2 || [];
    let count = 0;
    const total = Math.min(5, words.length);
    const card = document.createElement('div');
    card.className = 'board-card';

    function nextWord() {
      const word = words[Math.floor(Math.random() * words.length)];
      card.innerHTML = '';
      if (lesson && lesson.hint) {
        const hint = document.createElement('div');
        hint.className = 'hint-box';
        hint.textContent = '💡 Mẹo chính tả:\n' + lesson.hint;
        card.appendChild(hint);
      }
      const prompt = document.createElement('div');
      prompt.innerHTML = `
        <p style="color:#64748b; font-weight:700;">Từ dưới đây thuộc nhóm âm/vần nào? (${count + 1}/${total})</p>
        <div class="big-letter" style="font-size:2.5rem; margin:12px 0;">${word}</div>
      `;
      card.appendChild(prompt);

      const grid = document.createElement('div');
      grid.className = 'choices-grid';
      groups.forEach(g => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = g;
        btn.onclick = () => {
          const lowW = word.toLowerCase();
          const lowG = g.toLowerCase();
          const ok = lowW.includes(lowG) || (detectTone(lowW) && TONE_MAP[detectTone(lowW)].name === lowG);
          if (ok) {
            btn.classList.add('correct');
            ns.Media.playEffect('confirm');
            count++;
            setTimeout(() => {
              if (count < total) nextWord();
              else { ns.Media.playEffect('hooray'); onComplete(); }
            }, 700);
          } else {
            btn.classList.add('wrong');
            ns.Media.playEffect('fail');
          }
        };
        grid.appendChild(btn);
      });
      card.appendChild(grid);
    }

    container.appendChild(card);
    nextWord();
    return { destroy() {} };
  }

  ns.GamesEngine = {
    renderGameStep
  };
})(window.AppTV);
