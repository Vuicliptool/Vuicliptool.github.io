/**
 * js/writing-board.js
 * Bảng tập viết ô ly tích hợp thuật toán AI nhận diện nét vẽ so với nét mờ & Tự động chuyển bài.
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  function renderWritingCanvas(svgPath, label, container) {
    let writeCount = 0;
    const targetCount = 5; // Tổng số lần hoàn thành

    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:8px;">
        <h3 style="font-size:1rem; color:#1e293b;">✍️ Luyện viết: ${label}</h3>
        <div id="counterBadge" style="background:#fef3c7; color:#d97706; padding:4px 10px; border-radius:12px; font-weight:800; font-size:0.85rem;">
          Đã viết: 0 / ${targetCount} lần
        </div>
      </div>
      <div id="feedbackMsg" style="font-size:0.85rem; font-weight:700; color:#3b82f6; min-height:20px; margin-bottom:4px;">
        Bé hãy viết đè lên nét mờ nhé!
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.className = 'writing-wrap';

    // Nét chữ mờ hướng dẫn
    const guide = document.createElement('div');
    guide.className = 'writing-guide';
    guide.appendChild(ns.Media.createSmartSvgElement(svgPath, label));

    const canvas = document.createElement('canvas');
    canvas.className = 'writing-canvas';
    canvas.width = 300;
    canvas.height = 300;

    wrap.appendChild(guide);
    wrap.appendChild(canvas);
    card.appendChild(wrap);

    const controls = document.createElement('div');
    controls.style.marginTop = '12px';
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    controls.style.width = '100%';
    controls.style.justifyContent = 'center';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'speak-btn';
    clearBtn.style.background = '#ef4444';
    clearBtn.textContent = '🗑️ Xóa viết lại';

    const soundBtn = document.createElement('button');
    soundBtn.className = 'speak-btn';
    soundBtn.style.background = '#3b82f6';
    soundBtn.textContent = '🔊 Đọc mẫu';
    soundBtn.onclick = () => ns.Media.playSoundToken(label.toLowerCase());

    controls.appendChild(clearBtn);
    controls.appendChild(soundBtn);
    card.appendChild(controls);
    container.appendChild(card);

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ff6b35';

    let drawing = false;
    let hasDrawn = false;

    // Trích xuất điểm ảnh của nét mẫu mờ từ SVG guide để làm chuẩn so khớp
    let guidePoints = [];
    const guideCanvas = document.createElement('canvas');
    guideCanvas.width = 300;
    guideCanvas.height = 300;
    const guideCtx = guideCanvas.getContext('2d');

    const tempImg = new Image();
    const candidates = ns.Media.resolveSvgCandidates(svgPath);
    let cIdx = 0;
    function loadGuideImage() {
      if (cIdx < candidates.length) {
        tempImg.src = candidates[cIdx++];
      }
    }
    tempImg.onload = () => {
      guideCtx.clearRect(0, 0, 300, 300);
      guideCtx.drawImage(tempImg, 20, 20, 260, 260);
      const imgData = guideCtx.getImageData(0, 0, 300, 300);
      const data = imgData.data;
      guidePoints = [];
      for (let y = 0; y < 300; y += 4) {
        for (let x = 0; x < 300; x += 4) {
          const idx = (y * 300 + x) * 4 + 3; // Lấy kênh Alpha
          if (data[idx] > 30) {
            guidePoints.push({ x, y });
          }
        }
      }
    };
    tempImg.onerror = loadGuideImage;
    loadGuideImage();

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      hasDrawn = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // THUẬT TOÁN TỰ ĐỘNG NHẬN DIỆN KHI BÉ NHẤC TAY
    async function end() {
      if (!drawing) return;
      drawing = false;
      if (!hasDrawn) return;

      const feedback = card.querySelector('#feedbackMsg');

      // Nếu chưa kịp tải xong điểm nét mẫu mờ, dùng tạm bộ đếm dung lượng nét vẽ cơ bản
      const userImgData = ctx.getImageData(0, 0, 300, 300);
      const uPixels = userImgData.data;
      let userPaintedCount = 0;
      let matchedCount = 0;

      for (let i = 3; i < uPixels.length; i += 4) {
        if (uPixels[i] > 50) userPaintedCount++;
      }

      if (userPaintedCount < 80) {
        // Viết quá ít / chưa viết
        return;
      }

      // So khớp tọa độ nét vẽ của bé với nét mờ chuẩn
      if (guidePoints.length > 0) {
        for (let y = 0; y < 300; y += 4) {
          for (let x = 0; x < 300; x += 4) {
            const idx = (y * 300 + x) * 4 + 3;
            if (uPixels[idx] > 50) {
              // Kiểm tra xem điểm này có nằm gần đường nét mờ không (bán kính 18px)
              const isNearGuide = guidePoints.some(gp => Math.abs(gp.x - x) < 18 && Math.abs(gp.y - y) < 18);
              if (isNearGuide) matchedCount++;
            }
          }
        }
      }

      const matchRatio = guidePoints.length > 0 ? (matchedCount / (userPaintedCount / 4 + 1)) : 0.5;
      const isCorrect = guidePoints.length === 0 ? (userPaintedCount > 120) : (matchRatio > 0.25 && userPaintedCount > 100);

      if (isCorrect) {
        // ===== BÉ VIẾT ĐÚNG =====
        writeCount++;
        feedback.textContent = '🌟 Bé viết rất chuẩn! Giỏi quá!';
        feedback.style.color = '#15803d';

        const randTrue = Math.floor(Math.random() * 5) + 1; // Chọn ngẫu nhiên true1 -> true5
        await ns.Media.playSoundToken(`true${randTrue}`);

        const badge = card.querySelector('#counterBadge');
        if (writeCount < targetCount) {
          badge.textContent = `Đã viết: ${writeCount} / ${targetCount} lần`;
          setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn = false;
            feedback.textContent = 'Bé tiếp tục lượt tiếp theo nào!';
            feedback.style.color = '#3b82f6';
          }, 800);
        } else {
          badge.textContent = `🎉 Hoàn thành 5/5 lần!`;
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
          feedback.textContent = '🎉 Chúc mừng bé đã hoàn thành xuất sắc bài viết!';
          ns.Media.playEffect('hooray');
        }
      } else {
        // ===== BÉ VIẾT CHƯA ĐÚNG =====
        feedback.textContent = '❌ Bé viết chưa đúng nét mờ, thử lại nhé!';
        feedback.style.color = '#ef4444';

        const randFail = Math.floor(Math.random() * 3) + 1; // Chọn ngẫu nhiên fail1 -> fail3
        await ns.Media.playSoundToken(`fail${randFail}`);

        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasDrawn = false;
          feedback.textContent = 'Bé viết lại theo nét mờ nhé!';
          feedback.style.color = '#3b82f6';
        }, 1200);
      }
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    clearBtn.onclick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      card.querySelector('#feedbackMsg').textContent = 'Bé hãy viết đè lên nét mờ nhé!';
      card.querySelector('#feedbackMsg').style.color = '#3b82f6';
    };
  }

  ns.WritingBoard = {
    renderWritingCanvas
  };
})(window.AppTV);
