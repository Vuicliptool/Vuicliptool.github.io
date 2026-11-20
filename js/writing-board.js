/**
 * js/writing-board.js
 * Bộ máy luyện viết thông minh bám quỹ đạo nét SVG (SVG Path Tracing):
 *  - Demo giới thiệu: bàn tay cầm bút viết mẫu từng nét màu tím
 *  - Cấp độ 1 (write1): Ô ly + mũi tên + nét mờ hồng + chấm đỏ + bàn tay hướng dẫn
 *  - Cấp độ 2 (write2): Ô ly + mũi tên + nét mờ hồng + chấm đỏ (không bàn tay)
 *  - Cấp độ 3 (write3): Ô ly trống chỉ có chấm đỏ đặt bút + ô mẫu nhỏ phía trên
 *  - Luyện viết từ / câu (tapviet): Ghép liên hoàn các file trong data/Writing/tapviet/
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const parsedSvgCache = {};

  // Hình bàn tay cầm bút máy dạng SVG gọn nhẹ (đầu ngòi bút đặt đúng tại tọa độ 0, 0)
  function createHandPenSvg() {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'demo-hand-pen');
    g.setAttribute('pointer-events', 'none');
    g.innerHTML = `
      <g transform="translate(0, 0)">
        <!-- Đầu ngòi bút chạm đúng tâm (0,0) -->
        <polygon points="0,0 11,-4 7,-12" fill="#f59e0b" stroke="#92400e" stroke-width="1"/>
        <!-- Thân bút máy nghiêng sang phải-dưới -->
        <g transform="rotate(38)">
          <rect x="10" y="-6" width="52" height="12" rx="3" fill="#334155" stroke="#0f172a" stroke-width="1.2"/>
          <rect x="20" y="-6" width="6" height="12" fill="#ef4444"/>
          <rect x="52" y="-5" width="12" height="10" rx="2" fill="#f59e0b"/>
        </g>
        <!-- Bàn tay cầm bút -->
        <path d="M18,12 C28,6 45,10 54,22 C62,33 56,50 42,54 C30,57 18,48 16,36 C14,28 12,18 18,12 Z"
              fill="#f8c89b" stroke="#d99a6c" stroke-width="1.5"/>
        <ellipse cx="26" cy="20" rx="9" ry="5" transform="rotate(28 26 20)" fill="#fbd7b5" stroke="#d99a6c" stroke-width="1.2"/>
      </g>
    `;
    return g;
  }

  /**
   * Tải và phân tách file SVG tập viết thành:
   * - viewBox, width, height
   * - gridNodes: đường kẻ ô ly (#AAEDF8 id="4", #21BEFF)
   * - helperNodes: mũi tên chỉ hướng, nét đứt gióng (#AAEDF8 khác)
   * - strokes: danh sách đường nét viết theo đúng thứ tự (stroke="#3A85DA")
   */
  async function fetchAndParseWritingSvg(rawPath) {
    if (!rawPath) return null;
    const cacheKey = rawPath.trim();
    if (parsedSvgCache[cacheKey]) return parsedSvgCache[cacheKey];

    const candidates = ns.Media.resolveSvgCandidates(rawPath);
    let xmlText = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text.includes('<svg')) {
            xmlText = text;
            break;
          }
        }
      } catch (e) {}
    }
    if (!xmlText) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'image/svg+xml');
    const svgRoot = doc.querySelector('svg');
    if (!svgRoot) return null;

    const vbAttr = svgRoot.getAttribute('viewBox') || '0 0 300 300';
    const vbParts = vbAttr.trim().split(/[\s,]+/).map(Number);
    const vb = {
      x: vbParts[0] || 0,
      y: vbParts[1] || 0,
      w: vbParts[2] || 300,
      h: vbParts[3] || 300
    };

    const gridPaths = [];
    const helperPaths = [];
    const strokes = [];

    const nodes = svgRoot.querySelectorAll('path, line');
    nodes.forEach((node) => {
      const tag = node.tagName.toLowerCase();
      const fill = (node.getAttribute('fill') || '').toUpperCase();
      const stroke = (node.getAttribute('stroke') || '').toUpperCase();
      const id = (node.getAttribute('id') || '').trim();
      const strokeWidth = parseFloat(node.getAttribute('stroke-width') || '10');

      // Chuyển <line> (ví dụ dấu chấm chữ i) sang cú pháp path d="M x1,y1 L x2,y2"
      let d = '';
      if (tag === 'path') {
        d = node.getAttribute('d') || '';
      } else if (tag === 'line') {
        const x1 = node.getAttribute('x1') || '0';
        const y1 = node.getAttribute('y1') || '0';
        const x2 = node.getAttribute('x2') || '0';
        const y2 = node.getAttribute('y2') || '0';
        d = `M${x1},${y1}L${x2},${y2}`;
      }
      if (!d.trim()) return;

      // 1. Nét viết mẫu: có stroke khác none (chuẩn là #3A85DA)
      if (stroke && stroke !== 'NONE' && stroke !== '#010101') {
        strokes.push({ d, strokeWidth: strokeWidth || 10, id });
      }
      // 2. Đường kẻ ô ly nền
      else if (fill === '#21BEFF' || id === '4') {
        gridPaths.push({ d, fill });
      }
      // 3. Mũi tên hướng dẫn & nét đứt gióng ô ly
      else if (fill && fill !== 'NONE') {
        // Một số file dấu thanh (vd dau nang.svg) đặt khung ô ly ở path #AAEDF8 đầu tiên không có id="4"
        if (gridPaths.length === 0 && helperPaths.length === 0 && fill === '#AAEDF8' && d.length < 180) {
          gridPaths.push({ d, fill });
        } else {
          helperPaths.push({ d, fill });
        }
      }
    });

    const parsed = { vb, gridPaths, helperPaths, strokes };
    parsedSvgCache[cacheKey] = parsed;
    return parsed;
  }

  /**
   * Lấy mẫu tọa độ dày đặc dọc theo 1 SVGPathElement để kiểm tra đường đi của ngón tay
   */
  function sampleStrokePoints(pathEl, step = 2.5) {
    const totalLen = pathEl.getTotalLength();
    const pts = [];
    if (totalLen <= 0.01) {
      const p = pathEl.getPointAtLength(0);
      pts.push({ x: p.x, y: p.y, dist: 0 });
      return { totalLen: 0, pts };
    }
    const steps = Math.max(8, Math.ceil(totalLen / step));
    for (let i = 0; i <= steps; i++) {
      const dist = (i / steps) * totalLen;
      const p = pathEl.getPointAtLength(dist);
      pts.push({ x: p.x, y: p.y, dist });
    }
    return { totalLen, pts };
  }

  function dist2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Tạo thẻ <svg> thu nhỏ của chữ (dùng cho thanh tiến độ 5 chữ phía trên & ô xem trước cấp độ 3)
   */
  function buildMiniLetterSvg(parsed, showGrid, strokeColor) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${parsed.vb.x} ${parsed.vb.y} ${parsed.vb.w} ${parsed.vb.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    if (showGrid) {
      parsed.gridPaths.forEach(g => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', g.d);
        p.setAttribute('fill', g.fill);
        svg.appendChild(p);
      });
    }

    parsed.strokes.forEach(st => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', st.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', strokeColor);
      p.setAttribute('stroke-width', Math.max(10, st.strokeWidth));
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    return svg;
  }

  /**
   * =========================================================================
   * 1. CHẾ ĐỘ DEMO GIỚI THIỆU (HỌC LẠI): Bàn tay cầm bút viết mẫu liên tục
   * =========================================================================
   */
  async function renderWriteDemo(svgPath, container, options = {}) {
    const parsed = await fetchAndParseWritingSvg(svgPath);
    if (!parsed || parsed.strokes.length === 0) {
      container.innerHTML = '';
      container.appendChild(ns.Media.createSmartSvgElement(svgPath, 'Mẫu'));
      return { stop: () => {} };
    }

    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'write-demo-stage';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${parsed.vb.x} ${parsed.vb.y} ${parsed.vb.w} ${parsed.vb.h}`);
    svg.setAttribute('class', 'writing-svg-board');

    // Lớp ô ly + mũi tên hướng dẫn
    parsed.gridPaths.forEach(g => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('fill', g.fill);
      svg.appendChild(p);
    });
    parsed.helperPaths.forEach(h => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', h.d);
      p.setAttribute('fill', '#22c55e');
      p.setAttribute('opacity', '0.78');
      svg.appendChild(p);
    });

    // Nét mờ nền & nét tím đang chạy
    const strokeEls = [];
    parsed.strokes.forEach(st => {
      const bg = document.createElementNS(SVG_NS, 'path');
      bg.setAttribute('d', st.d);
      bg.setAttribute('fill', 'none');
      bg.setAttribute('stroke', '#c7d2fe');
      bg.setAttribute('stroke-width', st.strokeWidth);
      bg.setAttribute('stroke-linecap', 'round');
      bg.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(bg);

      const fg = document.createElementNS(SVG_NS, 'path');
      fg.setAttribute('d', st.d);
      fg.setAttribute('fill', 'none');
      fg.setAttribute('stroke', '#7e22ce');
      fg.setAttribute('stroke-width', st.strokeWidth);
      fg.setAttribute('stroke-linecap', 'round');
      fg.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(fg);

      strokeEls.push({ bg, fg });
    });

    const hand = createHandPenSvg();
    hand.style.display = 'none';
    svg.appendChild(hand);
    stage.appendChild(svg);
    container.appendChild(stage);

    // Chạy hoạt ảnh bàn tay viết từng nét lặp lại cho tới khi gọi stop()
    let stopped = false;
    let rafId = null;

    function resetAllStrokes() {
      strokeEls.forEach(({ fg }) => {
        const len = fg.getTotalLength();
        fg.style.strokeDasharray = `${len} ${len}`;
        fg.style.strokeDashoffset = `${len}`;
      });
    }

    function animateStroke(idx) {
      if (stopped) return;
      if (idx >= strokeEls.length) {
        hand.style.display = 'none';
        if (options.loop !== false) {
          setTimeout(() => {
            if (stopped) return;
            resetAllStrokes();
            animateStroke(0);
          }, 1100);
        }
        return;
      }

      const { fg } = strokeEls[idx];
      const len = Math.max(1, fg.getTotalLength());
      const duration = Math.max(700, Math.min(2200, len * 6.5));
      const startTime = performance.now();
      hand.style.display = 'block';

      function tick(now) {
        if (stopped) return;
        const t = Math.min(1, (now - startTime) / duration);
        const curLen = t * len;
        fg.style.strokeDashoffset = `${len - curLen}`;
        const pt = fg.getPointAtLength(curLen);
        hand.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);

        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setTimeout(() => animateStroke(idx + 1), 280);
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    resetAllStrokes();
    animateStroke(0);

    return {
      stop() {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  }

  /**
   * =========================================================================
   * 2. BẢNG TẬP VIẾT THÔNG MINH 3 CẤP ĐỘ (write1, write2, write3)
   *    level = 1: Có nét mờ + mũi tên + bàn tay mẫu
   *    level = 2: Có nét mờ + mũi tên (không bàn tay)
   *    level = 3: Chỉ có ô ly trống + chấm đỏ đặt bút + ô mẫu nhỏ phía trên
   * =========================================================================
   */
  async function renderWritingLevel(svgPath, label, level, container, onLevelComplete) {
    container.innerHTML = '<div style="padding:30px; color:#64748b; font-weight:700;">Đang chuẩn bị bảng ô ly...</div>';
    const parsed = await fetchAndParseWritingSvg(svgPath);
    if (!parsed || parsed.strokes.length === 0) {
      container.innerHTML = '<div class="board-card"><p>Không tìm thấy dữ liệu nét viết.</p></div>';
      return { destroy: () => {} };
    }

    const totalTurns = 5;
    let completedTurns = 0;
    let destroyed = false;
    let demoRafId = null;

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'smart-write-wrapper';

    // 1. THANH TIẾN ĐỘ 5 CHỮ Ở PHÍA TRÊN (giống video: 5 chữ mờ, viết xong sáng tím)
    const progressStrip = document.createElement('div');
    progressStrip.className = 'write-progress-strip';
    const slotSvgs = [];
    for (let i = 0; i < totalTurns; i++) {
      const slot = document.createElement('div');
      slot.className = 'write-progress-slot';
      const mini = buildMiniLetterSvg(parsed, false, '#cbd5e1');
      slot.appendChild(mini);
      progressStrip.appendChild(slot);
      slotSvgs.push({ slot, mini });
    }
    wrapper.appendChild(progressStrip);

    // 2. CẤP ĐỘ 3: Ô MẪU NHỎ PHÍA TRÊN ĐỂ BÉ NHÌN THEO
    if (level === 3) {
      const refBox = document.createElement('div');
      refBox.className = 'write-level3-ref';
      refBox.appendChild(buildMiniLetterSvg(parsed, true, '#7e22ce'));
      wrapper.appendChild(refBox);
    }

    // 3. KHUNG Ô LY TẬP VIẾT CHÍNH
    const boardBox = document.createElement('div');
    boardBox.className = 'smart-oly-board';
    if (level === 3) boardBox.classList.add('compact-for-l3');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${parsed.vb.x} ${parsed.vb.y} ${parsed.vb.w} ${parsed.vb.h}`);
    svg.setAttribute('class', 'writing-svg-board');

    // Nền ô ly chuẩn
    parsed.gridPaths.forEach(g => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('fill', g.fill);
      svg.appendChild(p);
    });

    // Mũi tên hướng dẫn (chỉ hiện ở Cấp độ 1 và 2)
    if (level === 1 || level === 2) {
      parsed.helperPaths.forEach(h => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', h.d);
        p.setAttribute('fill', '#22c55e');
        p.setAttribute('opacity', '0.82');
        svg.appendChild(p);
      });
    }

    // Dựng các lớp nét cho từng nét của chữ
    const strokeModels = parsed.strokes.map((st) => {
      // Nét gợi ý (guide)
      const guideEl = document.createElementNS(SVG_NS, 'path');
      guideEl.setAttribute('d', st.d);
      guideEl.setAttribute('fill', 'none');
      guideEl.setAttribute('stroke', '#c7d2fe');
      guideEl.setAttribute('stroke-width', st.strokeWidth);
      guideEl.setAttribute('stroke-linecap', 'round');
      guideEl.setAttribute('stroke-linejoin', 'round');
      guideEl.style.opacity = level === 3 ? '0' : '1';
      svg.appendChild(guideEl);

      // Nét tím đã tô đúng
      const traceEl = document.createElementNS(SVG_NS, 'path');
      traceEl.setAttribute('d', st.d);
      traceEl.setAttribute('fill', 'none');
      traceEl.setAttribute('stroke', '#7e22ce');
      traceEl.setAttribute('stroke-width', st.strokeWidth);
      traceEl.setAttribute('stroke-linecap', 'round');
      traceEl.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(traceEl);

      return { st, guideEl, traceEl, totalLen: 0, pts: [] };
    });

    // Nét đỏ hiển thị tạm khi bé kéo lệch quỹ đạo
    const errorPathEl = document.createElementNS(SVG_NS, 'path');
    errorPathEl.setAttribute('fill', 'none');
    errorPathEl.setAttribute('stroke', '#ef4444');
    errorPathEl.setAttribute('stroke-width', '8');
    errorPathEl.setAttribute('stroke-linecap', 'round');
    errorPathEl.setAttribute('stroke-linejoin', 'round');
    errorPathEl.style.display = 'none';
    svg.appendChild(errorPathEl);

    // Chấm đỏ nhấp nháy tại điểm đặt bút của nét đang viết
    const startDotGroup = document.createElementNS(SVG_NS, 'g');
    const pulseCircle = document.createElementNS(SVG_NS, 'circle');
    pulseCircle.setAttribute('r', '10');
    pulseCircle.setAttribute('fill', 'rgba(239,68,68,0.32)');
    pulseCircle.setAttribute('class', 'pulse-ring');
    const coreDot = document.createElementNS(SVG_NS, 'circle');
    coreDot.setAttribute('r', '4.8');
    coreDot.setAttribute('fill', '#ef4444');
    startDotGroup.appendChild(pulseCircle);
    startDotGroup.appendChild(coreDot);
    svg.appendChild(startDotGroup);

    // Bàn tay cầm bút hướng dẫn (chỉ dùng cho Cấp độ 1)
    const handPen = createHandPenSvg();
    handPen.style.display = 'none';
    svg.appendChild(handPen);

    boardBox.appendChild(svg);
    wrapper.appendChild(boardBox);
    container.appendChild(wrapper);

    // Tính toán tọa độ mẫu sau khi SVG đã gắn vào DOM
    strokeModels.forEach(m => {
      const sampled = sampleStrokePoints(m.traceEl, 2.5);
      m.totalLen = sampled.totalLen;
      m.pts = sampled.pts;
    });

    // ===== TRẠNG THÁI VẼ =====
    let activeStrokeIdx = 0;
    let isDrawing = false;
    let currentDist = 0;
    let locked = false;
    let errPoints = [];
    let wrongCountOnStroke = 0;

    function stopHandDemo() {
      if (demoRafId) {
        cancelAnimationFrame(demoRafId);
        demoRafId = null;
      }
      handPen.style.display = 'none';
    }

    // Chạy bàn tay đi mẫu 1 lần cho nét đang kích hoạt (Cấp độ 1)
    function playHandDemoForStroke(idx) {
      if (level !== 1 || destroyed || isDrawing || locked) return;
      stopHandDemo();
      const model = strokeModels[idx];
      if (!model) return;

      const len = model.totalLen;
      if (len < 12) {
        const pt = model.pts[0];
        handPen.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
        handPen.style.display = 'block';
        setTimeout(() => { if (!isDrawing) handPen.style.display = 'none'; }, 900);
        return;
      }

      const dur = Math.max(900, Math.min(2000, len * 6.5));
      const t0 = performance.now();
      handPen.style.display = 'block';

      function tick(now) {
        if (destroyed || isDrawing || locked || activeStrokeIdx !== idx) {
          handPen.style.display = 'none';
          return;
        }
        const t = Math.min(1, (now - t0) / dur);
        const pt = model.traceEl.getPointAtLength(t * len);
        handPen.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
        if (t < 1) {
          demoRafId = requestAnimationFrame(tick);
        } else {
          setTimeout(() => {
            if (!isDrawing) handPen.style.display = 'none';
          }, 350);
        }
      }
      demoRafId = requestAnimationFrame(tick);
    }

    function updateStrokeVisuals() {
      strokeModels.forEach((m, idx) => {
        const len = Math.max(0.1, m.totalLen);
        if (idx < activeStrokeIdx) {
          // Nét đã xong -> Tím đậm 100%
          m.traceEl.style.strokeDasharray = 'none';
          m.traceEl.style.strokeDashoffset = '0';
          m.traceEl.style.opacity = '1';
          m.guideEl.style.opacity = '0';
        } else if (idx === activeStrokeIdx) {
          // Nét đang viết -> Gợi ý màu hồng nhạt (ở L1/L2), ẩn ở L3
          m.guideEl.setAttribute('stroke', '#f5a9c8');
          m.guideEl.style.opacity = level === 3 ? '0' : '1';
          m.traceEl.style.strokeDasharray = `${len} ${len}`;
          m.traceEl.style.strokeDashoffset = `${Math.max(0, len - currentDist)}`;
          m.traceEl.style.opacity = currentDist > 0 ? '1' : '0';
        } else {
          // Nét chưa tới lượt
          m.guideEl.setAttribute('stroke', '#c7d2fe');
          m.guideEl.style.opacity = level === 3 ? '0' : '0.85';
          m.traceEl.style.strokeDasharray = `${len} ${len}`;
          m.traceEl.style.strokeDashoffset = `${len}`;
          m.traceEl.style.opacity = '0';
        }
      });

      const cur = strokeModels[activeStrokeIdx];
      if (cur && cur.pts.length > 0 && completedTurns < totalTurns) {
        const startPt = cur.pts[0];
        startDotGroup.setAttribute('transform', `translate(${startPt.x}, ${startPt.y})`);
        startDotGroup.style.display = isDrawing ? 'none' : 'block';
      } else {
        startDotGroup.style.display = 'none';
      }
    }

    function resetTurn(playDemo) {
      activeStrokeIdx = 0;
      currentDist = 0;
      isDrawing = false;
      wrongCountOnStroke = 0;
      errorPathEl.style.display = 'none';
      updateStrokeVisuals();
      if (playDemo && level === 1) {
        setTimeout(() => playHandDemoForStroke(0), 250);
      }
    }

    // Chuyển tọa độ chuột / cảm ứng sang hệ tọa độ SVG viewBox (0..300)
    function clientToSvgPoint(e) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = svg.getBoundingClientRect();
      return {
        x: parsed.vb.x + ((clientX - rect.left) / rect.width) * parsed.vb.w,
        y: parsed.vb.y + ((clientY - rect.top) / rect.height) * parsed.vb.h
      };
    }

    function flashErrorAndResetStroke(failedTrail) {
      isDrawing = false;
      locked = true;
      wrongCountOnStroke++;
      currentDist = 0;

      // Vẽ vệt đỏ lỗi giống video
      if (failedTrail && failedTrail.length > 1) {
        const dStr = failedTrail.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        errorPathEl.setAttribute('d', dStr);
        errorPathEl.style.display = 'block';
      }

      // Phát âm thanh báo sai (fail1..fail3 trong hanoi hoặc fail.mp3)
      if (ns.Media.playWritingFail) {
        ns.Media.playWritingFail();
      } else {
        const r = Math.floor(Math.random() * 3) + 1;
        ns.Media.playSoundToken(`fail${r}`);
      }

      // Ở Cấp độ 3, nếu bé viết sai thì nháy mờ nét gợi ý 0.8s để bé biết hướng đi
      const cur = strokeModels[activeStrokeIdx];
      if (level === 3 && cur) {
        cur.guideEl.setAttribute('stroke', '#f5a9c8');
        cur.guideEl.style.opacity = '0.55';
      }

      setTimeout(() => {
        if (destroyed) return;
        errorPathEl.style.display = 'none';
        locked = false;
        updateStrokeVisuals();
        if (level === 1) playHandDemoForStroke(activeStrokeIdx);
      }, 650);
    }

    async function completeActiveStroke() {
      isDrawing = false;
      const cur = strokeModels[activeStrokeIdx];
      currentDist = cur.totalLen;
      activeStrokeIdx++;
      currentDist = 0;
      wrongCountOnStroke = 0;
      updateStrokeVisuals();

      if (activeStrokeIdx < strokeModels.length) {
        // Xong 1 nét trong chữ (vd xong thân chữ e, chuyển sang dấu mũ ^)
        ns.Media.playEffect('confirm');
        if (level === 1) {
          setTimeout(() => playHandDemoForStroke(activeStrokeIdx), 200);
        }
      } else {
        // ===== HOÀN THÀNH 1 LƯỢT VIẾT TRỌN VẸN =====
        locked = true;
        completedTurns++;

        // Làm sáng chữ tím trên thanh tiến độ 5 chữ phía trên
        const slotObj = slotSvgs[completedTurns - 1];
        if (slotObj) {
          slotObj.slot.classList.add('done');
          slotObj.mini.querySelectorAll('path').forEach(p => p.setAttribute('stroke', '#7e22ce'));
        }

        // Phát âm thanh khen (true1..true5)
        const randTrue = Math.floor(Math.random() * 5) + 1;
        await ns.Media.playSoundToken(`true${randTrue}`);
        if (destroyed) return;

        if (completedTurns < totalTurns) {
          // Phát câu nhắc lượt tiếp theo ("Lại lần nữa nào", "Tiếp tục nào", "Cố lên sắp xong rồi", "Lần cuối nào")
          const againIdx = Math.min(4, completedTurns);
          await ns.Media.playSoundToken(`games/writing_again${againIdx}`);
          if (destroyed) return;

          locked = false;
          resetTurn(level === 1);
        } else {
          // ===== HOÀN THÀNH ĐỦ 5 / 5 LƯỢT CỦA CẤP ĐỘ =====
          ns.Media.playEffect('hooray');
          if (typeof onLevelComplete === 'function') {
            onLevelComplete();
          }
        }
      }
    }

    function onPointerDown(e) {
      if (locked || destroyed || completedTurns >= totalTurns) return;
      e.preventDefault();
      stopHandDemo();

      const cur = strokeModels[activeStrokeIdx];
      if (!cur || cur.pts.length === 0) return;

      const pt = clientToSvgPoint(e);
      const startPt = cur.pts[0];
      const startTolerance = 32; // Độ rộng vùng đặt bút thân thiện với ngón tay bé

      if (dist2D(pt, startPt) > startTolerance) {
        // Chạm quá xa chấm đỏ -> rung nhẹ chấm đỏ nhắc đặt đúng chỗ
        startDotGroup.classList.add('shake-dot');
        setTimeout(() => startDotGroup.classList.remove('shake-dot'), 350);
        return;
      }

      // Xử lý nét chấm rất ngắn (dấu nặng, dấu chấm chữ i) -> chạm đúng là xong ngay
      if (cur.totalLen < 14) {
        completeActiveStroke();
        return;
      }

      isDrawing = true;
      currentDist = 2;
      errPoints = [pt];
      updateStrokeVisuals();
    }

    function onPointerMove(e) {
      if (!isDrawing || locked || destroyed) return;
      e.preventDefault();

      const cur = strokeModels[activeStrokeIdx];
      if (!cur) return;

      const pt = clientToSvgPoint(e);
      errPoints.push(pt);

      // Tìm điểm gần nhất trên nét mẫu trong cửa sổ tiến về phía trước (tránh nhảy cóc qua vòng khép kín)
      const lookBack = 16;
      const lookAhead = 78;
      const minD = Math.max(0, currentDist - lookBack);
      const maxD = Math.min(cur.totalLen, currentDist + lookAhead);

      let bestDistToPath = Infinity;
      let bestProgress = currentDist;

      for (let i = 0; i < cur.pts.length; i++) {
        const sample = cur.pts[i];
        if (sample.dist < minD || sample.dist > maxD) continue;
        const d = dist2D(pt, sample);
        if (d < bestDistToPath) {
          bestDistToPath = d;
          bestProgress = sample.dist;
        }
      }

      const pathTolerance = level === 3 ? 38 : 34;

      if (bestDistToPath <= pathTolerance) {
        if (bestProgress > currentDist) {
          currentDist = bestProgress;
          updateStrokeVisuals();
        }
        // Đạt >= 87% độ dài nét -> tự động khóa nét tím đẹp hoàn hảo
        if (currentDist >= cur.totalLen * 0.87) {
          completeActiveStroke();
        }
      } else {
        // Kéo lệch quá xa khỏi đường nét chuẩn -> báo đỏ và viết lại nét đó
        flashErrorAndResetStroke(errPoints);
      }
    }

    function onPointerUp() {
      if (!isDrawing || locked || destroyed) return;
      const cur = strokeModels[activeStrokeIdx];
      if (cur && currentDist >= cur.totalLen * 0.82) {
        completeActiveStroke();
      } else {
        // Nhấc tay giữa chừng khi chưa viết hết nét -> báo viết lại nét đó
        flashErrorAndResetStroke(errPoints);
      }
    }

    svg.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    svg.addEventListener('touchstart', onPointerDown, { passive: false });
    svg.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Khởi tạo lượt đầu tiên + đọc câu hướng dẫn cấp độ tương ứng
    resetTurn(false);
    const introPrompt = level === 1 ? 'games/writing1'
      : level === 2 ? 'games/writing2'
      : 'games/writing3';
    ns.Media.playSoundToken(introPrompt).then(() => {
      if (!destroyed && level === 1 && completedTurns === 0 && !isDrawing) {
        playHandDemoForStroke(0);
      }
    });

    return {
      destroy() {
        destroyed = true;
        stopHandDemo();
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchend', onPointerUp);
      }
    };
  }

  /**
   * =========================================================================
   * 3. CHẾ ĐỘ LUYỆN VIẾT TỪ / VIẾT CÂU (game: "tapviet" - như Bài 29 trong video)
   *    Ghép ngang các file trong data/Writing/tapviet/<token>.svg và tự trượt
   * =========================================================================
   */
  async function renderTapVietGame(step, lesson, container, onAllDone) {
    const sentences = Array.isArray(step.values) ? step.values : [];
    if (sentences.length === 0) {
      container.innerHTML = '<div class="board-card"><p>Chưa có danh sách từ/câu luyện viết.</p></div>';
      return { destroy: () => {} };
    }

    let sentenceIdx = 0;
    let destroyed = false;
    let cleanupListeners = null;

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'smart-write-wrapper tapviet-wrapper';
    container.appendChild(wrapper);

    // Phát câu mở đầu ("Bài tập viết từ" / "Bài tập viết câu")
    const isSentenceMode = sentences.some(s => s.split(' ').length >= 4);
    ns.Media.playSoundToken(isSentenceMode ? 'games/tapviet_cau' : 'games/tapviet_tu');

    async function loadTokenParsed(token) {
      const direct = await fetchAndParseWritingSvg(`Writing/tapviet/${token}.svg`);
      if (direct) return [direct];
      // Dự phòng nếu thiếu file ghép (vd: "chúm" -> tách thành "chú" + "m")
      if (token.length > 2) {
        const p1 = await fetchAndParseWritingSvg(`Writing/tapviet/${token.slice(0, -1)}.svg`);
        const p2 = await fetchAndParseWritingSvg(`Writing/tapviet/${token.slice(-1)}.svg`);
        if (p1 && p2) return [p1, p2];
      }
      return [];
    }

    async function loadSentence(sIdx) {
      if (cleanupListeners) { cleanupListeners(); cleanupListeners = null; }
      if (destroyed) return;

      wrapper.innerHTML = '<div style="padding:24px; color:#64748b; font-weight:700;">Đang tải dòng chữ mẫu...</div>';
      const rawSentence = sentences[sIdx] || '';
      const words = rawSentence.trim().split(/\s+/);

      // Phân tích từng từ thành mảng SVG nối tiếp nhau
      const tokenItems = [];
      let cursorX = 16;
      const H = 296;

      for (let w = 0; w < words.length; w++) {
        const parts = words[w].split('_').filter(Boolean);
        const wordText = words[w].replace(/[0-9_]/g, '');

        for (let p = 0; p < parts.length; p++) {
          const parsedList = await loadTokenParsed(parts[p]);
          for (const parsed of parsedList) {
            tokenItems.push({
              xOffset: cursorX,
              width: parsed.vb.w,
              parsed,
              wordText,
              isWordStart: p === 0
            });
            cursorX += parsed.vb.w;
          }
        }
        // Chèn khoảng trắng giữa các tiếng
        if (w < words.length - 1) {
          const spaceParsed = await fetchAndParseWritingSvg('Writing/tapviet/space.svg');
          const spW = spaceParsed ? spaceParsed.vb.w : 54;
          tokenItems.push({ xOffset: cursorX, width: spW, parsed: spaceParsed, isSpace: true });
          cursorX += spW;
        }
      }
      const totalWidth = Math.max(320, cursorX + 20);

      if (destroyed) return;
      wrapper.innerHTML = '';

      // 1. THANH XEM TRƯỚC CẢ CÂU Ở PHÍA TRÊN
      const previewScroll = document.createElement('div');
      previewScroll.className = 'tapviet-preview-bar';
      const previewSvg = document.createElementNS(SVG_NS, 'svg');
      previewSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${H}`);
      previewSvg.style.height = '68px';
      previewSvg.style.width = `${Math.round((totalWidth / H) * 68)}px`;

      // 2. BẢNG VIẾT Ô LY PHÓNG TO CUỘN NGANG PHÍA DƯỚI
      const mainScroll = document.createElement('div');
      mainScroll.className = 'tapviet-main-scroll';
      const mainSvg = document.createElementNS(SVG_NS, 'svg');
      mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${H}`);
      const mainHeightPx = 330;
      const mainWidthPx = Math.round((totalWidth / H) * mainHeightPx);
      mainSvg.style.height = `${mainHeightPx}px`;
      mainSvg.style.width = `${mainWidthPx}px`;
      mainSvg.setAttribute('class', 'tapviet-main-svg');

      // Đường kẻ ô ly chạy suốt toàn bộ chiều ngang
      const bgLines = [4, 35.7, 67.8, 99.9, 130.5, 162.2, 194.3, 225.4, 257, 288.7];
      bgLines.forEach(y => {
        const isBold = (y === 67.8 || y === 194.3);
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('x2', String(totalWidth));
        line.setAttribute('y1', String(y));
        line.setAttribute('y2', String(y));
        line.setAttribute('stroke', isBold ? '#21BEFF' : '#bae6fd');
        line.setAttribute('stroke-width', isBold ? '2.2' : '1');
        mainSvg.appendChild(line);

        const pLine = line.cloneNode();
        previewSvg.appendChild(pLine);
      });

      // Gom toàn bộ nét của cả câu theo đúng thứ tự
      const allStrokes = [];
      tokenItems.forEach((tk) => {
        if (!tk.parsed || tk.isSpace) return;
        const gMain = document.createElementNS(SVG_NS, 'g');
        gMain.setAttribute('transform', `translate(${tk.xOffset}, 0)`);
        const gPrev = document.createElementNS(SVG_NS, 'g');
        gPrev.setAttribute('transform', `translate(${tk.xOffset}, 0)`);

        tk.parsed.strokes.forEach((st) => {
          // Nét trên thanh xem trước
          const pStroke = document.createElementNS(SVG_NS, 'path');
          pStroke.setAttribute('d', st.d);
          pStroke.setAttribute('fill', 'none');
          pStroke.setAttribute('stroke', '#93c5fd');
          pStroke.setAttribute('stroke-width', '7');
          pStroke.setAttribute('stroke-linecap', 'round');
          pStroke.setAttribute('stroke-linejoin', 'round');
          gPrev.appendChild(pStroke);

          // Nét gợi ý & nét tô tím trên bảng chính
          const guideEl = document.createElementNS(SVG_NS, 'path');
          guideEl.setAttribute('d', st.d);
          guideEl.setAttribute('fill', 'none');
          guideEl.setAttribute('stroke', '#bfdbfe');
          guideEl.setAttribute('stroke-width', st.strokeWidth || 7);
          guideEl.setAttribute('stroke-linecap', 'round');
          guideEl.setAttribute('stroke-linejoin', 'round');
          gMain.appendChild(guideEl);

          const traceEl = document.createElementNS(SVG_NS, 'path');
          traceEl.setAttribute('d', st.d);
          traceEl.setAttribute('fill', 'none');
          traceEl.setAttribute('stroke', '#7e22ce');
          traceEl.setAttribute('stroke-width', (st.strokeWidth || 7) + 1);
          traceEl.setAttribute('stroke-linecap', 'round');
          traceEl.setAttribute('stroke-linejoin', 'round');
          gMain.appendChild(traceEl);

          allStrokes.push({
            xOffset: tk.xOffset,
            centerX: tk.xOffset + tk.width / 2,
            wordText: tk.wordText,
            guideEl,
            traceEl,
            pStroke,
            totalLen: 0,
            pts: []
          });
        });

        previewSvg.appendChild(gPrev);
        mainSvg.appendChild(gMain);
      });

      const startDot = document.createElementNS(SVG_NS, 'circle');
      startDot.setAttribute('r', '5');
      startDot.setAttribute('fill', '#ef4444');
      mainSvg.appendChild(startDot);

      previewScroll.appendChild(previewSvg);
      mainScroll.appendChild(mainSvg);

      const counterPill = document.createElement('div');
      counterPill.style.cssText = 'font-size:0.85rem; font-weight:800; color:#475569; margin:4px 0;';
      counterPill.textContent = `Dòng ${sIdx + 1} / ${sentences.length}: ${rawSentence.replace(/[0-9_]/g, '')}`;

      wrapper.appendChild(previewScroll);
      wrapper.appendChild(counterPill);
      wrapper.appendChild(mainScroll);

      // Lấy mẫu tọa độ toàn cầu (cộng xOffset)
      allStrokes.forEach(s => {
        const sampled = sampleStrokePoints(s.traceEl, 2.5);
        s.totalLen = sampled.totalLen;
        s.pts = sampled.pts.map(p => ({ x: p.x + s.xOffset, y: p.y, dist: p.dist }));
      });

      let activeIdx = 0;
      let isDrawing = false;
      let curDist = 0;
      let locked = false;
      let lastSpokenWord = '';

      function scrollToStroke(idx) {
        const st = allStrokes[idx];
        if (!st) return;
        const pxPerUnit = mainWidthPx / totalWidth;
        const targetMainLeft = Math.max(0, st.centerX * pxPerUnit - mainScroll.clientWidth * 0.45);
        mainScroll.scrollTo({ left: targetMainLeft, behavior: 'smooth' });

        const prevPxPerUnit = (previewSvg.getBoundingClientRect().width || 1) / totalWidth;
        const targetPrevLeft = Math.max(0, st.centerX * prevPxPerUnit - previewScroll.clientWidth * 0.45);
        previewScroll.scrollTo({ left: targetPrevLeft, behavior: 'smooth' });

        if (st.wordText && st.wordText !== lastSpokenWord) {
          lastSpokenWord = st.wordText;
          ns.Media.playSoundToken(st.wordText.toLowerCase());
        }
      }

      function refreshVisuals() {
        allStrokes.forEach((s, idx) => {
          const len = Math.max(0.1, s.totalLen);
          if (idx < activeIdx) {
            s.traceEl.style.strokeDasharray = 'none';
            s.traceEl.style.strokeDashoffset = '0';
            s.traceEl.style.opacity = '1';
            s.guideEl.style.opacity = '0';
            s.pStroke.setAttribute('stroke', '#7e22ce');
          } else if (idx === activeIdx) {
            s.guideEl.setAttribute('stroke', '#f5a9c8');
            s.guideEl.style.opacity = '1';
            s.traceEl.style.strokeDasharray = `${len} ${len}`;
            s.traceEl.style.strokeDashoffset = `${Math.max(0, len - curDist)}`;
            s.traceEl.style.opacity = curDist > 0 ? '1' : '0';
          } else {
            s.guideEl.setAttribute('stroke', '#bfdbfe');
            s.guideEl.style.opacity = '0.9';
            s.traceEl.style.strokeDasharray = `${len} ${len}`;
            s.traceEl.style.strokeDashoffset = `${len}`;
            s.traceEl.style.opacity = '0';
          }
        });
        const cur = allStrokes[activeIdx];
        if (cur && cur.pts.length > 0) {
          startDot.setAttribute('cx', cur.pts[0].x);
          startDot.setAttribute('cy', cur.pts[0].y);
          startDot.style.display = isDrawing ? 'none' : 'block';
        } else {
          startDot.style.display = 'none';
        }
      }

      function getPoint(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = mainSvg.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / rect.width) * totalWidth,
          y: ((clientY - rect.top) / rect.height) * H
        };
      }

      async function finishStroke() {
        isDrawing = false;
        activeIdx++;
        curDist = 0;
        refreshVisuals();

        if (activeIdx < allStrokes.length) {
          ns.Media.playEffect('confirm');
          scrollToStroke(activeIdx);
        } else {
          locked = true;
          const r = Math.floor(Math.random() * 5) + 1;
          await ns.Media.playSoundToken(`true${r}`);
          if (destroyed) return;

          if (sentenceIdx < sentences.length - 1) {
            sentenceIdx++;
            setTimeout(() => loadSentence(sentenceIdx), 500);
          } else {
            ns.Media.playEffect('hooray');
            if (typeof onAllDone === 'function') onAllDone();
          }
        }
      }

      function down(e) {
        if (locked || destroyed || activeIdx >= allStrokes.length) return;
        const cur = allStrokes[activeIdx];
        const pt = getPoint(e);
        if (dist2D(pt, cur.pts[0]) > 34) return;
        e.preventDefault();
        if (cur.totalLen < 12) { finishStroke(); return; }
        isDrawing = true;
        curDist = 2;
        refreshVisuals();
      }

      function move(e) {
        if (!isDrawing || locked || destroyed) return;
        e.preventDefault();
        const cur = allStrokes[activeIdx];
        const pt = getPoint(e);
        const minD = Math.max(0, curDist - 16);
        const maxD = Math.min(cur.totalLen, curDist + 75);
        let bestD = Infinity, bestP = curDist;

        for (let i = 0; i < cur.pts.length; i++) {
          const sp = cur.pts[i];
          if (sp.dist < minD || sp.dist > maxD) continue;
          const d = dist2D(pt, sp);
          if (d < bestD) { bestD = d; bestP = sp.dist; }
        }

        if (bestD <= 36) {
          if (bestP > curDist) { curDist = bestP; refreshVisuals(); }
          if (curDist >= cur.totalLen * 0.85) finishStroke();
        } else {
          isDrawing = false;
          curDist = 0;
          ns.Media.playEffect('fail');
          refreshVisuals();
        }
      }

      function up() {
        if (!isDrawing || locked || destroyed) return;
        const cur = allStrokes[activeIdx];
        if (cur && curDist >= cur.totalLen * 0.8) {
          finishStroke();
        } else {
          isDrawing = false;
          curDist = 0;
          refreshVisuals();
        }
      }

      mainSvg.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      mainSvg.addEventListener('touchstart', down, { passive: false });
      mainSvg.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);

      cleanupListeners = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchend', up);
      };

      refreshVisuals();
      scrollToStroke(0);
    }

    loadSentence(0);

    return {
      destroy() {
        destroyed = true;
        if (cleanupListeners) cleanupListeners();
      }
    };
  }

  // Giữ tương thích ngược nếu có chỗ gọi tên hàm cũ renderWritingCanvas
  function renderWritingCanvas(svgPath, label, container, onDone) {
    return renderWritingLevel(svgPath, label, 1, container, onDone);
  }

  ns.WritingBoard = {
    fetchAndParseWritingSvg,
    renderWriteDemo,
    renderWritingLevel,
    renderTapVietGame,
    renderWritingCanvas
  };
})(window.AppTV);
