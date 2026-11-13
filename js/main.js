/**
 * js/main.js
 * Điều phối giao diện theo phong cách khung Ruy-băng vàng + Thẻ bo tròn 3 màu + Tìm kiếm
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  let currentModule = 'write'; // Mặc định mở "Tập viết chữ ô ly" như ảnh đầu tiên
  let searchQuery = '';

  const CARD_THEMES = ['theme-blue', 'theme-yellow', 'theme-green'];

  // Biểu tượng ổ khóa vàng SVG trang trí trên thẻ giống hệt bản gốc
  function createLockBadgeSvg() {
    const div = document.createElement('div');
    div.className = 'lock-badge';
    div.innerHTML = `
      <svg viewBox="0 0 64 64" width="30" height="30">
        <path d="M18 28V20c0-7.7 6.3-14 14-14s14 6.3 14 14v8" fill="none" stroke="#f5b82e" stroke-width="7" stroke-linecap="round"/>
        <rect x="12" y="26" width="40" height="32" rx="8" fill="#ffd447" stroke="#e09f1f" stroke-width="3"/>
        <circle cx="32" cy="40" r="4" fill="#9c4114"/>
        <path d="M32 44v6" stroke="#9c4114" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `;
    return div;
  }

  function initApp() {
    // Khởi tạo tiêu đề theo tab đang chọn
    syncTopbarWithModule();

    // Sự kiện bấm nút mũi tên trái trên thanh tiêu đề -> Ẩn/hiện thanh chuyển 4 chế độ học
    document.getElementById('topBackBtn').addEventListener('click', () => {
      ns.Media.playEffect('button');
      const switcher = document.getElementById('modeSwitcher');
      switcher.classList.toggle('collapsed');
    });

    // Sự kiện chọn chế độ học (Tập đọc / Tập viết chữ ô ly / Tư duy ngôn ngữ / Trò chơi)
    document.querySelectorAll('.mode-pill[data-mod]').forEach(btn => {
      btn.addEventListener('click', () => {
        ns.Media.playEffect('button');
        document.querySelectorAll('.mode-pill[data-mod]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentModule = btn.dataset.mod;
        searchQuery = '';
        document.getElementById('searchInput').value = '';
        syncTopbarWithModule();
        renderAllSections();
      });
    });

    // Ô tìm kiếm bài học theo thời gian thực
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').trim().toLowerCase();
      renderAllSections();
    });
    document.getElementById('searchBtn').addEventListener('click', () => {
      ns.Media.playEffect('button');
      searchQuery = (searchInput.value || '').trim().toLowerCase();
      renderAllSections();
    });

    // Nạp 4 file .txt khi bấm vào chú heo vàng ở góc phải
    document.getElementById('txtFileInput').addEventListener('change', (e) => {
      ns.DataLoader.handleManualFileUpload(e.target.files, renderAllSections);
    });

    // Bật/tắt nhạc nền
    const bgmBtn = document.getElementById('toggleBgmBtn');
    bgmBtn.addEventListener('click', () => ns.Media.toggleBgm(bgmBtn));

    // Nút Play tròn màu xanh lá ở dưới đáy -> mở ngay bài học đầu tiên của danh mục hiện tại
    document.getElementById('quickPlayBtn').addEventListener('click', () => {
      const categories = ns.DataLoader.STORE[currentModule] || [];
      for (const cat of categories) {
        if (cat.lessons && cat.lessons.length > 0) {
          ns.LessonPlayer.openLesson(cat.lessons[0]);
          return;
        }
      }
    });

    // Sự kiện trong màn hình bài học (Stage)
    document.getElementById('closeStageBtn').onclick = ns.LessonPlayer.closeStage;
    document.getElementById('prevStepBtn').onclick = ns.LessonPlayer.prevStep;
    document.getElementById('nextStepBtn').onclick = ns.LessonPlayer.nextStep;
    document.getElementById('replayStepBtn').onclick = ns.LessonPlayer.replayStep;

    // Tự động tải 4 file .txt
    ns.DataLoader.loadAllTxtFiles(renderAllSections);
  }

  function syncTopbarWithModule() {
    const titles = {
      data: 'Tập đọc',
      write: 'Tập viết chữ ô ly',
      thinking: 'Tư duy ngôn ngữ',
      games: 'Trò chơi'
    };
    document.getElementById('topbarTitle').textContent = titles[currentModule] || 'Bé Học Tiếng Việt';

    // Đồng bộ nút active
    document.querySelectorAll('.mode-pill[data-mod]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mod === currentModule);
    });

    // Ở mục "Tư duy ngôn ngữ", ẩn thanh tìm kiếm & nút Play dưới đáy giống ảnh chụp màn hình
    const isThinking = currentModule === 'thinking';
    document.getElementById('searchSection').classList.toggle('hidden', isThinking);
    document.getElementById('cloudFooter').classList.toggle('hidden', isThinking);
  }

  function renderAllSections() {
    const container = document.getElementById('sectionsContainer');
    container.innerHTML = '';

    const categories = ns.DataLoader.STORE[currentModule] || [];
    if (categories.length === 0) {
      container.innerHTML = `
        <div class="category-panel" style="text-align:center; padding:32px 16px;">
          <div class="ribbon-banner">Thông báo</div>
          <p style="margin-top:12px; font-size:1.05rem; line-height:1.5;">
            Chưa nạp dữ liệu <b>${currentModule}.txt</b>.<br/>
            Hãy chạm vào biểu tượng <b>chú heo vàng 🐖</b> ở góc trên bên phải để chọn 4 file
            <code>data.txt, write.txt, thinking.txt, games.txt</code>.
          </p>
        </div>`;
      return;
    }

    // Giao diện riêng cho mục "Tư duy ngôn ngữ" (Mỗi bài là 1 khung lớn có ruy-băng vàng ở trên)
    if (currentModule === 'thinking') {
      const allLessons = [];
      categories.forEach(cat => {
        (cat.lessons || []).forEach(l => allLessons.push(l));
      });

      allLessons.forEach(lesson => {
        if (searchQuery && !lesson.name.toLowerCase().includes(searchQuery)) return;
        const panel = document.createElement('div');
        panel.className = 'category-panel thinking-panel';

        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon-banner';
        ribbon.textContent = lesson.name;

        const illus = document.createElement('div');
        illus.className = 'thinking-illustration';
        if (lesson.thumb) {
          illus.appendChild(ns.Media.createSmartSvgElement(lesson.thumb, lesson.name));
        }

        panel.appendChild(ribbon);
        panel.appendChild(illus);
        panel.onclick = () => ns.LessonPlayer.openLesson(lesson);
        container.appendChild(panel);
      });
      return;
    }

    // Giao diện khung Ruy-băng vàng + Lưới 2 cột cho Tập đọc, Tập viết chữ ô ly, Trò chơi
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
        const themeClass = CARD_THEMES[idx % CARD_THEMES.length];
        const card = document.createElement('div');
        card.className = `lesson-card ${themeClass}`;

        const whiteBox = document.createElement('div');
        // Nếu là bài viết trong mục Tập viết (dùng ảnh từ Writing/) thì thêm nền kẻ ô ly
        const isWritingStroke = currentModule === 'write' &&
          lesson.thumb && lesson.thumb.toLowerCase().includes('writing/');
        whiteBox.className = 'lesson-white-box' + (isWritingStroke ? ' oly-grid-bg' : '');

        // Thêm ổ khóa vàng trang trí phía trên giống ảnh gốc
        whiteBox.appendChild(createLockBadgeSvg());

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
        card.onclick = () => ns.LessonPlayer.openLesson(lesson);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
      container.appendChild(panel);
    });
  }

  document.addEventListener('DOMContentLoaded', initApp);
})(window.AppTV);
