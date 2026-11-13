/**
 * js/games-engine.js
 * Xử lý toàn bộ các trò chơi trong data.txt, write.txt, thinking.txt, games.txt
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  function renderGameStep(step, lesson, container) {
    const gameType = (step.game || '').toLowerCase();

    if (['danhvan1', 'danhvan2', 'danhvan3', 'tapviet'].includes(gameType)) {
      return renderReadingListGame(step, container);
    }
    if (gameType === 'danhvan4') {
      return renderIdiomsGame(step, container);
    }
    if (gameType === 'tapdoc' && Array.isArray(step.data)) {
      return renderPoemReader(step, container);
    }
    if (gameType === 'connection') {
      return renderConnectionGame(step, container);
    }
    if (gameType === 'options') {
      return renderOptionsQuizGame(step, container);
    }
    if (gameType === 'chinhta') {
      return renderChinhTaGame(step, lesson, container);
    }
    if (['puzzle2', 'puzzle3', 'ghep van'].includes(gameType)) {
      return renderCombineSoundGame(step, container);
    }
    return renderListenAndPickGame(step, container);
  }

  // 1. Đánh vần / Tập đọc / Tập viết từ
  function renderReadingListGame(step, container) {
    const values = step.values || [];
    let idx = 0;
    const card = document.createElement('div');
    card.className = 'board-card';

    function updateView() {
      const rawWord = values[idx] || '';
      const cleanWord = rawWord.replace(/[0-9_]/g, '');
      card.innerHTML = `
        <div style="font-size:0.9rem; color:#64748b; margin-bottom:6px;">
          ${step.game === 'tapviet' ? '✍️ Luyện viết từ / câu' : '🗣️ Luyện đánh vần & đọc to'} (${idx + 1}/${values.length})
        </div>
        <div class="big-letter" style="font-size:2.8rem; margin: 18px 0;">${cleanWord}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
          <button class="speak-btn" id="readWordBtn">🔊 Nghe phát âm</button>
          ${idx > 0 ? '<button class="speak-btn" id="prevWBtn" style="background:#64748b">⬅ Từ trước</button>' : ''}
          ${idx < values.length - 1 ? '<button class="speak-btn" id="nextWBtn" style="background:#ff6b35">Từ tiếp ➡</button>' : ''}
        </div>
      `;
      card.querySelector('#readWordBtn').onclick = () => ns.Media.playSoundToken(cleanWord.toLowerCase().replace(/\./g, ''));
      if (card.querySelector('#prevWBtn')) {
        card.querySelector('#prevWBtn').onclick = () => { idx--; updateView(); };
      }
      if (card.querySelector('#nextWBtn')) {
        card.querySelector('#nextWBtn').onclick = () => { idx++; updateView(); };
      }
      ns.Media.playSoundToken(cleanWord.toLowerCase().replace(/\./g, ''));
    }

    container.appendChild(card);
    updateView();
  }

  // 2. Thành ngữ - Tục ngữ
  function renderIdiomsGame(step, container) {
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
          <button class="speak-btn" id="prevIdiom" style="background:#64748b">⬅ Trước</button>
          <button class="speak-btn" id="randIdiom">🎲 Ngẫu nhiên</button>
          <button class="speak-btn" id="nextIdiom" style="background:var(--primary)">Tiếp ➡</button>
        </div>
      `;
      card.querySelector('#prevIdiom').onclick = () => { idx = (idx - 1 + v1.length) % v1.length; showIdiom(); };
      card.querySelector('#nextIdiom').onclick = () => { idx = (idx + 1) % v1.length; showIdiom(); };
      card.querySelector('#randIdiom').onclick = () => { idx = Math.floor(Math.random() * v1.length); showIdiom(); };
    }
    container.appendChild(card);
    showIdiom();
  }

  // 3. Đọc Thơ Ca
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
          <button class="speak-btn" id="prevPoem" style="background:#64748b">⬅ Bài trước</button>
          <button class="speak-btn" id="speakPoem">🔊 Nghe đọc</button>
          <button class="speak-btn" id="nextPoem" style="background:var(--primary)">Bài tiếp ➡</button>
        </div>
      `;
      card.querySelector('#prevPoem').onclick = () => { idx = (idx - 1 + poems.length) % poems.length; showPoem(); };
      card.querySelector('#nextPoem').onclick = () => { idx = (idx + 1) % poems.length; showPoem(); };
      card.querySelector('#speakPoem').onclick = () => ns.Media.playSoundToken(p.title.toLowerCase());
    }
    container.appendChild(card);
    showPoem();
  }

  // 4. Nối từ
  function renderConnectionGame(step, container) {
    const v1 = step.values1 || [];
    const v2 = step.values2 || [];
    const pairs = v1.map((left, i) => ({ id: i, left, right: v2[i] }));
    const rightShuffled = [...pairs].sort(() => Math.random() - 0.5);

    let selectedLeft = null;
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
          ns.Media.playEffect('hooray');
          selectedLeft.el.classList.remove('selected');
          selectedLeft.el.classList.add('matched');
          btn.classList.add('matched');
          ns.Media.playSoundToken(`${selectedLeft.text} ${p.right}`);
          selectedLeft = null;
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
  }

  // 5. Hỏi xoáy đáp xoay
  function renderOptionsQuizGame(step, container) {
    const questions = step.values1 || [];
    const answers = step.values2 || [];
    let qIdx = 0;
    const card = document.createElement('div');
    card.className = 'board-card';

    function showQ() {
      const correctAns = answers[qIdx];
      const distractors = answers.filter((_, i) => i !== qIdx).sort(() => Math.random() - 0.5).slice(0, 3);
      const choices = [correctAns, ...distractors].sort(() => Math.random() - 0.5);

      card.innerHTML = `
        <div style="font-size:0.85rem; color:#64748b;">Câu đố (${qIdx + 1}/${questions.length})</div>
        <div class="subtitle-box" style="margin:14px 0; font-size:1.08rem;">❓ ${questions[qIdx]}</div>
        <div class="choices-grid" id="optGrid"></div>
      `;
      const grid = card.querySelector('#optGrid');
      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.style.fontSize = '1.12rem';
        btn.textContent = c;
        btn.onclick = () => {
          if (c === correctAns) {
            btn.classList.add('correct');
            ns.Media.playEffect('hooray');
            ns.Media.playSoundToken(c);
            setTimeout(() => {
              qIdx = (qIdx + 1) % questions.length;
              showQ();
            }, 1100);
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
  }

  // 6. Phân biệt Chính tả (L/N, S/X, R/D/GI, Tr/Ch, Hỏi/Ngã...)
  function renderChinhTaGame(step, lesson, container) {
    const words = step.values1 || [];
    const groups = step.values2 || [];
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
        <p style="color:#64748b; font-weight:700;">Từ dưới đây thuộc nhóm âm/vần nào?</p>
        <div class="big-letter" style="font-size:2.5rem; margin:12px 0;">${word}</div>
      `;
      card.appendChild(prompt);

      const speak = document.createElement('button');
      speak.className = 'speak-btn';
      speak.textContent = '🔊 Nghe từ';
      speak.onclick = () => ns.Media.playSoundToken(word);
      card.appendChild(speak);

      const grid = document.createElement('div');
      grid.className = 'choices-grid';
      groups.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = g.toUpperCase();
        btn.onclick = () => {
          const lowerW = word.toLowerCase();
          let isMatch = lowerW.includes(g.toLowerCase());
          if (g === 'hỏi') isMatch = /[ảẳẩẻểỉỏổởủửỷ]/.test(lowerW);
          if (g === 'ngã') isMatch = /[ãẵẫẽễĩõỗỡũữỹ]/.test(lowerW);

          if (isMatch) {
            btn.classList.add('correct');
            ns.Media.playEffect('hooray');
            setTimeout(nextWord, 900);
          } else {
            btn.classList.add('wrong');
            ns.Media.playEffect('fail');
          }
        };
        grid.appendChild(btn);
      });
      card.appendChild(grid);
      ns.Media.playSoundToken(word);
    }

    container.appendChild(card);
    nextWord();
  }

  // 7. Ghép âm / vần
  function renderCombineSoundGame(step, container) {
    const onset = step.phuam || step.van || '';
    const finals = step.values || [];
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <h3>🧩 Ghép âm với: <span style="color:var(--primary); font-size:1.6rem;">${onset}</span></h3>
      <div class="big-letter" id="combinedResult" style="margin:16px 0;">${onset} + ...</div>
      <div class="choices-grid" id="combineGrid"></div>
    `;
    const resBox = card.querySelector('#combinedResult');
    const grid = card.querySelector('#combineGrid');

    finals.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = v;
      btn.onclick = async () => {
        const word = step.phuam ? `${step.phuam}${v}` : v;
        resBox.textContent = word;
        btn.classList.add('correct');
        if (step.phuam) {
          await ns.Media.playSoundToken(step.phuam);
          await ns.Media.playSoundToken(v);
        }
        await ns.Media.playSoundToken(word);
      };
      grid.appendChild(btn);
    });
    container.appendChild(card);
  }

  // 8. Nghe & chọn chữ đúng (mole, bee, select crab, apple, balloon, octopus, goal, racing...)
  function renderListenAndPickGame(step, container) {
    const pool = [...(step.values || []), ...(step.options || [])];
    const targets = step.values || [];
    const card = document.createElement('div');
    card.className = 'board-card';

    const icons = {
      'mole': '🐹', 'bee': '🐝', 'select crab': '🦀', 'select apple': '🍎',
      'select balloon': '🎈', 'select octopus': '🐙', 'goal': '⚽', 'racing': '🏎️'
    };
    const icon = icons[(step.game || '').toLowerCase()] || '🎯';

    function nextRound() {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const others = pool.filter(x => x !== target).sort(() => Math.random() - 0.5).slice(0, 3);
      const choices = Array.from(new Set([target, ...others])).sort(() => Math.random() - 0.5);

      card.innerHTML = `
        <div style="font-size:0.9rem; color:#64748b; font-weight:700;">
          Trò chơi: ${(step.game || '').toUpperCase()}
        </div>
        <p style="margin:8px 0; font-weight:700;">Nghe và chạm vào chữ đúng nhé!</p>
        <button class="speak-btn" id="listenTargetBtn" style="font-size:1.1rem; padding:12px 24px;">
          🔊 Nghe âm: "${target}"
        </button>
        <div class="choices-grid" id="pickGrid"></div>
      `;

      card.querySelector('#listenTargetBtn').onclick = () => ns.Media.playSoundToken(target.toLowerCase());
      const grid = card.querySelector('#pickGrid');

      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `<div>${icon}</div><div>${c}</div>`;
        btn.onclick = () => {
          if (c === target) {
            btn.classList.add('correct');
            ns.Media.playEffect('hooray');
            ns.Media.playSoundToken(c.toLowerCase());
            setTimeout(nextRound, 1000);
          } else {
            btn.classList.add('wrong');
            ns.Media.playEffect('fail');
          }
        };
        grid.appendChild(btn);
      });

      ns.Media.playSoundToken(target.toLowerCase());
    }

    container.appendChild(card);
    nextRound();
  }

  ns.GamesEngine = {
    renderGameStep
  };
})(window.AppTV);
