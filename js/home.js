/**
 * js/home.js
 * Điều khiển Trang chủ (index.html):
 *  - Chuyển sang lessons.html kèm tham số môn học + từ khóa tìm kiếm (hỗ trợ cả GitHub Pages & xem trước cục bộ)
 *  - Đọc tiến độ đã học trong localStorage (APPTV_PROGRESS_V1) để hiển thị sao & thanh tiến độ trên 4 thẻ môn
 *  - Tương tác chạm bạn Cú thông minh, nút Học tiếp ngay, Góc phụ huynh & Nhạc nền bg_home.mp3
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const PROGRESS_KEY = 'APPTV_PROGRESS_V1';
  const MOD_LABELS = {
    data: 'Tập đọc',
    write: 'Tập viết chữ ô ly',
    thinking: 'Tư duy ngôn ngữ',
    games: 'Trò chơi'
  };

  const GREETINGS = [
    'Chào bé yêu! Hôm nay học gì nào? ✨',
    'Bé chọn một ô màu rực rỡ bên dưới nhé! 🌈',
    'Học thật vui để nhận thật nhiều sao nào! ⭐',
    'Bấm vào Tập đọc hoặc Tập viết để bắt đầu! 🚀'
  ];
  let greetIdx = 0;

  function safeGetStorage(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function safeSetStorage(key, val) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, val);
    } catch (e) {}
  }

  function loadProgressMap() {
    try {
      const raw = safeGetStorage(PROGRESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function countLessonsInModule(mod) {
    const cats = (ns.DataLoader && ns.DataLoader.STORE && ns.DataLoader.STORE[mod]) || [];
    let total = 0;
    cats.forEach((c) => {
      total += Array.isArray(c.lessons) ? c.lessons.length : 0;
    });
    return total;
  }

  /**
   * Cập nhật số sao tổng, thanh tiến độ mini trên 4 thẻ môn và nút "Học tiếp ngay!"
   */
  function refreshHomeProgressUI() {
    const map = loadProgressMap();
    const mods = ['data', 'write', 'thinking', 'games'];
    let grandDone = 0;

    const summaryList = document.getElementById('progressSummaryList');
    if (summaryList) summaryList.innerHTML = '';

    mods.forEach((mod) => {
      const doneArr = Array.isArray(map[mod]) ? map[mod] : [];
      const doneCount = doneArr.length;
      const totalCount = countLessonsInModule(mod);
      grandDone += doneCount;

      const badge = document.getElementById('badge-' + mod);
      const bar = document.getElementById('bar-' + mod);

      if (badge) {
        if (totalCount > 0 && doneCount > 0) {
          badge.textContent = `⭐ ${doneCount}/${totalCount}`;
        } else if (doneCount > 0) {
          badge.textContent = `⭐ ${doneCount} bài`;
        } else if (totalCount > 0) {
          badge.textContent = `${totalCount} bài`;
        } else {
          badge.textContent = 'Bắt đầu';
        }
      }

      if (bar) {
        const pct = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
        bar.style.width = `${pct}%`;
      }

      if (summaryList) {
        const row = document.createElement('div');
        row.className = 'summary-row';
        row.innerHTML = `
          <span>${MOD_LABELS[mod]}</span>
          <strong>${doneCount}${totalCount > 0 ? ' / ' + totalCount : ''} bài ⭐</strong>
        `;
        summaryList.appendChild(row);
      }
    });

    const totalStarsEl = document.getElementById('totalStarsText');
    if (totalStarsEl) {
      totalStarsEl.textContent = `${grandDone} bài`;
    }

    // Đồng bộ nút "Học tiếp ngay!" theo môn học gần nhất của bé
    const lastMod = safeGetStorage('APPTV_CURRENT_MOD') || 'data';
    const validMod = MOD_LABELS[lastMod] ? lastMod : 'data';
    const subEl = document.getElementById('continueSubText');
    if (subEl) {
      subEl.textContent = `Tiếp tục môn: ${MOD_LABELS[validMod]}`;
    }
  }

  /**
   * Điều hướng sang trang lessons.html với hiệu ứng âm thanh nút bấm
   */
  function goToLessons(mod, searchText) {
    safeSetStorage('APPTV_CURRENT_MOD', mod);
    const q = (searchText || '').trim();
    safeSetStorage('APPTV_SEARCH_Q', q);

    if (ns.Media) ns.Media.playEffect('button');

    let targetUrl = 'lessons.html?mod=' + encodeURIComponent(mod);
    if (q) targetUrl += '&q=' + encodeURIComponent(q);
    targetUrl += '#' + encodeURIComponent(mod);

    // Chờ nhẹ 90ms để âm thanh nút bấm kịp vang lên trước khi chuyển trang
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 90);
  }

  function openParentModal() {
    refreshHomeProgressUI();
    const modal = document.getElementById('parentModal');
    if (modal) modal.classList.add('open');
  }

  function closeParentModal() {
    const modal = document.getElementById('parentModal');
    if (modal) modal.classList.remove('open');
  }

  function initHome() {
    // 1. Gắn sự kiện click cho 4 thẻ môn học 3D
    document.querySelectorAll('.subject-card[data-mod]').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const mod = card.dataset.mod || 'data';
        const qInput = document.getElementById('homeSearchInput');
        goToLessons(mod, qInput ? qInput.value : '');
      });
    });

    // 2. Thanh tìm kiếm nhanh -> tự động mở môn Tập đọc kèm từ khóa
    const searchInput = document.getElementById('homeSearchInput');
    const searchBtn = document.getElementById('homeSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        goToLessons('data', searchInput ? searchInput.value : '');
      });
    }
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') goToLessons('data', searchInput.value);
      });
    }

    // 3. Nút "Học tiếp ngay!" ở phía dưới
    const continueBtn = document.getElementById('quickContinueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        const lastMod = safeGetStorage('APPTV_CURRENT_MOD') || 'data';
        goToLessons(MOD_LABELS[lastMod] ? lastMod : 'data', '');
      });
    }

    // 4. Tương tác chạm bạn Cú thông minh -> nhảy vui vẻ + đổi câu chào + phát tiếng chào
    const mascotBtn = document.getElementById('mascotBtn');
    const speechEl = document.getElementById('heroSpeech');
    if (mascotBtn) {
      mascotBtn.addEventListener('click', () => {
        mascotBtn.classList.remove('happy-jump');
        void mascotBtn.offsetWidth; // Reset animation để nhảy lại mượt
        mascotBtn.classList.add('happy-jump');

        greetIdx = (greetIdx + 1) % GREETINGS.length;
        if (speechEl) speechEl.textContent = GREETINGS[greetIdx];

        if (ns.Media) {
          ns.Media.playSoundToken('chào mừng con đến với bài học mới');
        }
      });
    }

    // 5. Nút Bật/Tắt nhạc nền (bg_home.mp3)
    const bgmBtn = document.getElementById('toggleBgmBtn');
    if (bgmBtn && ns.Media) {
      bgmBtn.addEventListener('click', () => ns.Media.toggleBgm(bgmBtn, 'bg_home'));
    }

    // 6. Hộp thoại Thành tích & Góc phụ huynh
    const starBtn = document.getElementById('starSummaryBtn');
    const gearBtn = document.getElementById('parentMenuBtn');
    const closeBtn = document.getElementById('closeParentModalBtn');
    const parentModal = document.getElementById('parentModal');

    if (starBtn) starBtn.addEventListener('click', () => {
      if (ns.Media) ns.Media.playEffect('button');
      openParentModal();
    });
    if (gearBtn) gearBtn.addEventListener('click', () => {
      if (ns.Media) ns.Media.playEffect('button');
      openParentModal();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeParentModal);
    if (parentModal) {
      parentModal.addEventListener('click', (e) => {
        if (e.target === parentModal) closeParentModal();
      });
    }

    // Nạp thủ công 4 file .txt trong Góc phụ huynh (dự phòng khi chạy offline)
    const txtInput = document.getElementById('txtFileInput');
    if (txtInput && ns.DataLoader) {
      txtInput.addEventListener('change', (e) => {
        ns.DataLoader.handleManualFileUpload(e.target.files, () => {
          refreshHomeProgressUI();
          alert('Đã nạp dữ liệu bài học thành công!');
        });
      });
    }

    // Nút đặt lại tiến độ học của bé
    const resetBtn = document.getElementById('resetProgressBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Ba mẹ có chắc muốn đặt lại toàn bộ số bài đã hoàn thành của bé không?')) {
          try {
            if (window.localStorage) window.localStorage.removeItem(PROGRESS_KEY);
          } catch (e) {}
          refreshHomeProgressUI();
          closeParentModal();
        }
      });
    }

    // 7. Nạp dữ liệu 4 file .txt để đếm tổng số bài & hiển thị tiến độ thật
    refreshHomeProgressUI();
    if (ns.DataLoader) {
      ns.DataLoader.loadAllTxtFiles(refreshHomeProgressUI);
    }

    // 8. Kích hoạt nhạc nền Trang chủ (Sounds/bg_home.mp3)
    if (ns.Media) {
      ns.Media.playBgm('bg_home');
    }
  }

  document.addEventListener('DOMContentLoaded', initHome);
})(window.AppTV);
