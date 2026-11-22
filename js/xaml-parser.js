/**
 * js/xaml-parser.js
 * Đọc file .xaml sang SVG mượt mà:
 *  - renderXamlToContainer(xamlPath, storyboardName, containerEl): dùng cho các hoạt ảnh giảng bài (Tập đọc / Tập viết)
 *  - createInteractiveXaml(xamlPath, options): dựng đối tượng XAML tương tác giữ nguyên cấu trúc lồng nhau
 *    (<Grid>, <Path>, RenderTransformOrigin, CompositeTransform gồm cả Rotation, BackEase)
 *    và hỗ trợ gọi từng Storyboard (sb_show, sb_hide, sb_true, sb_fail...) bằng requestAnimationFrame.
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const xamlCache = {};
  const rawXmlCache = {};

  function parseKeyTimeToSeconds(timeStr) {
    try {
      const parts = String(timeStr || '0:0:0').split(':');
      if (parts.length === 3) {
        return (parseFloat(parts[0]) || 0) * 3600 +
               (parseFloat(parts[1]) || 0) * 60 +
               (parseFloat(parts[2]) || 0);
      }
    } catch (e) {}
    return 0;
  }

  function normalizeXamlPath(xamlPath) {
    let cleanPath = String(xamlPath || '').trim().replace(/^\/+/, '');
    if (!cleanPath.endsWith('.xaml')) cleanPath += '.xaml';
    if (!cleanPath.startsWith('animations/')) {
      cleanPath = 'animations/' + cleanPath;
    }
    return cleanPath;
  }

  async function fetchRawXamlXml(xamlPath) {
    const cleanPath = normalizeXamlPath(xamlPath);
    if (rawXmlCache[cleanPath]) return rawXmlCache[cleanPath];

    const candidates = [
      cleanPath,
      'assets/' + cleanPath,
      cleanPath.replace('animations/', ''),
      'animations/' + cleanPath.split('/').pop()
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('<UserControl')) {
            rawXmlCache[cleanPath] = text;
            return text;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function getXamlAttr(el, attrName) {
    if (!el) return null;
    return el.getAttribute(attrName) ||
           el.getAttribute('x:' + attrName) ||
           el.getAttribute('d:' + attrName);
  }

  // ==================== PHẦN 1: API CŨ CHO BÀI GIẢNG (GIỮ NGUYÊN TƯƠNG THÍCH) ====================
  async function fetchAndParseXaml(xamlPath) {
    const cleanPath = normalizeXamlPath(xamlPath);
    if (xamlCache[cleanPath]) return xamlCache[cleanPath];

    const xmlText = await fetchRawXamlXml(cleanPath);
    if (!xmlText) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    const rootNode = xmlDoc.documentElement;
    const designW = rootNode.getAttribute('d:DesignWidth') || '400';
    const designH = rootNode.getAttribute('d:DesignHeight') || '400';

    const storyboards = {};
    const sbNodes = xmlDoc.querySelectorAll('Storyboard');
    sbNodes.forEach(sb => {
      const sbName = getXamlAttr(sb, 'Name');
      if (!sbName) return;

      const animations = {};
      const frames = sb.querySelectorAll('DoubleAnimationUsingKeyFrames');
      frames.forEach(frame => {
        const targetName = frame.getAttribute('Storyboard.TargetName');
        const targetProp = frame.getAttribute('Storyboard.TargetProperty') || '';
        if (!targetName) return;

        if (!animations[targetName]) {
          animations[targetName] = { opacity: [], scaleX: [], scaleY: [], translateX: [], translateY: [], rotation: [] };
        }

        const kfs = frame.querySelectorAll('EasingDoubleKeyFrame, LinearDoubleKeyFrame, DiscreteDoubleKeyFrame');
        kfs.forEach(kf => {
          const timeStr = kf.getAttribute('KeyTime') || '00:00:00';
          const val = parseFloat(kf.getAttribute('Value') || '0');
          const seconds = parseKeyTimeToSeconds(timeStr);

          if (targetProp.includes('Opacity')) {
            animations[targetName].opacity.push({ time: seconds, val });
          } else if (targetProp.includes('ScaleX')) {
            animations[targetName].scaleX.push({ time: seconds, val });
          } else if (targetProp.includes('ScaleY')) {
            animations[targetName].scaleY.push({ time: seconds, val });
          } else if (targetProp.includes('TranslateX')) {
            animations[targetName].translateX.push({ time: seconds, val });
          } else if (targetProp.includes('TranslateY')) {
            animations[targetName].translateY.push({ time: seconds, val });
          } else if (targetProp.includes('Rotation')) {
            animations[targetName].rotation.push({ time: seconds, val });
          }
        });
      });
      storyboards[sbName] = animations;
    });

    const pathNodes = xmlDoc.querySelectorAll('Path');
    const pathsData = [];
    pathNodes.forEach(p => {
      const name = getXamlAttr(p, 'Name') || '';
      const data = p.getAttribute('Data') || '';
      const fill = p.getAttribute('Fill') || '#F4821F';
      const baseOpacity = p.getAttribute('Opacity');

      let tx = 0, ty = 0, sx = 1, sy = 1;
      const ct = p.querySelector('CompositeTransform');
      if (ct) {
        tx = parseFloat(ct.getAttribute('TranslateX') || '0');
        ty = parseFloat(ct.getAttribute('TranslateY') || '0');
        sx = parseFloat(ct.getAttribute('ScaleX') || '1');
        sy = parseFloat(ct.getAttribute('ScaleY') || '1');
      }

      pathsData.push({ name, data, fill, baseOpacity, tx, ty, sx, sy });
    });

    const parsed = { designW, designH, storyboards, paths: pathsData };
    xamlCache[cleanPath] = parsed;
    return parsed;
  }

  async function renderXamlToContainer(xamlPath, storyboardName, containerEl) {
    containerEl.innerHTML = '';
    const parsed = await fetchAndParseXaml(xamlPath);
    if (!parsed || !parsed.paths || parsed.paths.length === 0) return;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${parsed.designW} ${parsed.designH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';

    const sbData = (parsed.storyboards && storyboardName) ? parsed.storyboards[storyboardName] : null;
    const hasStoryboard = sbData && Object.keys(sbData).length > 0;

    parsed.paths.forEach(item => {
      const isTargetInSb = hasStoryboard && item.name && sbData[item.name];
      if (hasStoryboard && !isTargetInSb) {
        if (item.baseOpacity === '0' || item.name) return;
      }

      const pathEl = document.createElementNS(SVG_NS, 'path');
      pathEl.setAttribute('d', item.data);
      pathEl.setAttribute('fill', item.fill);
      pathEl.style.transformBox = 'fill-box';
      pathEl.style.transformOrigin = 'center center';

      if (isTargetInSb) {
        const anim = sbData[item.name];
        const opFrames = anim.opacity || [];
        const allTimes = Array.from(new Set([
          ...opFrames.map(f => f.time),
          ...(anim.translateX || []).map(f => f.time),
          ...(anim.translateY || []).map(f => f.time),
          ...(anim.scaleX || []).map(f => f.time)
        ])).sort((a, b) => a - b);

        if (allTimes.length > 0) {
          const maxTime = Math.max(...allTimes, 1.5);
          const kfName = 'kf_' + item.name + '_' + Math.random().toString(36).substring(2, 7);

          let curOp = item.baseOpacity !== null ? parseFloat(item.baseOpacity) : 1;
          let curTx = item.tx;
          let curTy = item.ty;
          let curSx = item.sx;
          let curSy = item.sy;

          let cssKf = `@keyframes ${kfName} {\n`;
          allTimes.forEach(t => {
            const fOp = opFrames.find(f => Math.abs(f.time - t) < 0.05);
            const fTx = (anim.translateX || []).find(f => Math.abs(f.time - t) < 0.05);
            const fTy = (anim.translateY || []).find(f => Math.abs(f.time - t) < 0.05);
            const fSx = (anim.scaleX || []).find(f => Math.abs(f.time - t) < 0.05);
            const fSy = (anim.scaleY || []).find(f => Math.abs(f.time - t) < 0.05);

            if (fOp !== undefined) curOp = fOp.val;
            if (fTx !== undefined) curTx = fTx.val;
            if (fTy !== undefined) curTy = fTy.val;
            if (fSx !== undefined) curSx = fSx.val;
            if (fSy !== undefined) curSy = fSy.val;

            const pct = Math.min(100, Math.round((t / maxTime) * 100));
            cssKf += `  ${pct}% { opacity: ${curOp}; transform: translate(${curTx}px, ${curTy}px) scale(${curSx}, ${curSy}); }\n`;
          });
          cssKf += `}\n`;

          const styleTag = document.createElement('style');
          styleTag.textContent = cssKf;
          document.head.appendChild(styleTag);

          pathEl.style.opacity = curOp;
          pathEl.style.animation = `${kfName} ${Math.min(maxTime, 3.5)}s ease-in-out forwards`;
        }
      } else {
        pathEl.style.opacity = item.baseOpacity !== null ? item.baseOpacity : '1';
        pathEl.style.transform = `translate(${item.tx}px, ${item.ty}px) scale(${item.sx}, ${item.sy})`;
      }

      svg.appendChild(pathEl);
    });

    containerEl.appendChild(svg);
  }

  // ==================== PHẦN 2: ENGINE XAML TƯƠNG TÁC CHO MINI-GAME (NHƯ MOLE.XAML) ====================
  const interactiveBlueprintCache = {};

  function parseEasing(kfNode) {
    const easeNode = kfNode.querySelector('BackEase, BounceEase, QuadraticEase, CubicEase, CircleEase');
    if (!easeNode) return 'linear';
    const tag = easeNode.tagName.split(':').pop();
    const mode = easeNode.getAttribute('EasingMode') || 'EaseOut';
    return `${tag}:${mode}`;
  }

  function applyEasing(t, easeSpec) {
    if (!easeSpec || easeSpec === 'linear') return t;
    const [type, mode] = easeSpec.split(':');
    const c = Math.max(0, Math.min(1, t));

    if (type === 'BackEase') {
      const c1 = 1.35;
      const c2 = c1 * 1.525;
      if (mode === 'EaseInOut') {
        return c < 0.5
          ? (Math.pow(2 * c, 2) * ((c2 + 1) * 2 * c - c2)) / 2
          : (Math.pow(2 * c - 2, 2) * ((c2 + 1) * (c * 2 - 2) + c2) + 2) / 2;
      }
      if (mode === 'EaseIn') return (c1 + 1) * c * c * c - c1 * c * c;
      return 1 + (c1 + 1) * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
    }
    if (type === 'CircleEase') {
      if (mode === 'EaseIn') return 1 - Math.sqrt(Math.max(0, 1 - c * c));
      if (mode === 'EaseInOut') {
        return c < 0.5
          ? (1 - Math.sqrt(Math.max(0, 1 - Math.pow(2 * c, 2)))) / 2
          : (Math.sqrt(Math.max(0, 1 - Math.pow(-2 * c + 2, 2))) + 1) / 2;
      }
      return Math.sqrt(Math.max(0, 1 - Math.pow(c - 1, 2)));
    }
    if (type === 'CubicEase') {
      if (mode === 'EaseIn') return c * c * c;
      if (mode === 'EaseInOut') return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
      return 1 - Math.pow(1 - c, 3);
    }
    if (type === 'QuadraticEase') {
      if (mode === 'EaseIn') return c * c;
      if (mode === 'EaseInOut') return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
      return 1 - (1 - c) * (1 - c);
    }
    return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
  }

  function readDirectCompositeTransform(node) {
    const ct = { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 };
    for (let i = 0; i < node.children.length; i++) {
      const ch = node.children[i];
      const tag = ch.tagName.split(':').pop();
      if (tag.endsWith('.RenderTransform')) {
        const comp = ch.querySelector('CompositeTransform');
        if (comp) {
          ct.tx = parseFloat(comp.getAttribute('TranslateX') || '0');
          ct.ty = parseFloat(comp.getAttribute('TranslateY') || '0');
          ct.sx = parseFloat(comp.getAttribute('ScaleX') || '1');
          ct.sy = parseFloat(comp.getAttribute('ScaleY') || '1');
          ct.rot = parseFloat(comp.getAttribute('Rotation') || '0');
        }
      }
    }
    return ct;
  }

  function parseOrigin(node, designW, designH) {
    const raw = node.getAttribute('RenderTransformOrigin');
    if (!raw) return { ox: designW / 2, oy: designH / 2 };
    const parts = raw.split(',').map(Number);
    const rx = isNaN(parts[0]) ? 0.5 : parts[0];
    const ry = isNaN(parts[1]) ? 0.5 : parts[1];
    return { ox: rx * designW, oy: ry * designH };
  }

  async function loadInteractiveBlueprint(xamlPath) {
    const cleanPath = normalizeXamlPath(xamlPath);
    if (interactiveBlueprintCache[cleanPath]) return interactiveBlueprintCache[cleanPath];

    const xmlText = await fetchRawXamlXml(cleanPath);
    if (!xmlText) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const rootNode = xmlDoc.documentElement;
    const designW = parseFloat(rootNode.getAttribute('d:DesignWidth') || '400');
    const designH = parseFloat(rootNode.getAttribute('d:DesignHeight') || '400');

    // 1. Phân tích toàn bộ Storyboard (gồm cả Rotation & BackEase)
    const storyboards = {};
    xmlDoc.querySelectorAll('Storyboard').forEach(sb => {
      const sbName = getXamlAttr(sb, 'Name');
      if (!sbName) return;

      const tracks = {};
      let duration = 0;

      sb.querySelectorAll('DoubleAnimationUsingKeyFrames').forEach(anim => {
        const targetName = anim.getAttribute('Storyboard.TargetName');
        const targetProp = anim.getAttribute('Storyboard.TargetProperty') || '';
        if (!targetName) return;

        let propKey = null;
        if (targetProp.includes('Opacity')) propKey = 'opacity';
        else if (targetProp.includes('ScaleX')) propKey = 'sx';
        else if (targetProp.includes('ScaleY')) propKey = 'sy';
        else if (targetProp.includes('TranslateX')) propKey = 'tx';
        else if (targetProp.includes('TranslateY')) propKey = 'ty';
        else if (targetProp.includes('Rotation')) propKey = 'rot';
        if (!propKey) return;

        if (!tracks[targetName]) tracks[targetName] = {};
        const kfs = [];
        anim.querySelectorAll('EasingDoubleKeyFrame, LinearDoubleKeyFrame, DiscreteDoubleKeyFrame').forEach(kf => {
          const t = parseKeyTimeToSeconds(kf.getAttribute('KeyTime') || '0:0:0');
          const v = parseFloat(kf.getAttribute('Value') || '0');
          const ease = parseEasing(kf);
          if (t > duration) duration = t;
          kfs.push({ t, v, ease });
        });
        kfs.sort((a, b) => a.t - b.t);
        tracks[targetName][propKey] = kfs;
      });

      const repeatForever = (sb.getAttribute('RepeatBehavior') || '').toLowerCase() === 'forever';
      storyboards[sbName] = { duration, tracks, repeatForever };
    });

    // 2. Phân tích cây hiển thị (<Grid> & <Path>) giữ nguyên thứ tự vẽ (z-order) và phân cấp cha-con
    function buildNodeSpec(el) {
      const tag = el.tagName.split(':').pop();
      if (tag === 'UserControl.Resources' || tag.endsWith('.RenderTransform')) return null;

      const name = getXamlAttr(el, 'Name') || '';
      const opacityAttr = el.getAttribute('Opacity');
      const opacity = opacityAttr !== null ? parseFloat(opacityAttr) : 1;
      const origin = parseOrigin(el, designW, designH);
      const transform = readDirectCompositeTransform(el);

      if (tag === 'Path') {
        const d = el.getAttribute('Data') || '';
        if (!d) return null;
        return {
          type: 'path',
          name,
          d,
          fill: el.getAttribute('Fill') || 'none',
          stroke: el.getAttribute('Stroke') || null,
          strokeWidth: el.getAttribute('StrokeThickness') || null,
          opacity,
          origin,
          transform
        };
      }

      if (tag === 'Grid' || tag === 'Canvas') {
        const children = [];
        for (let i = 0; i < el.children.length; i++) {
          const childSpec = buildNodeSpec(el.children[i]);
          if (childSpec) children.push(childSpec);
        }
        return {
          type: 'group',
          name,
          width: el.getAttribute('Width') ? parseFloat(el.getAttribute('Width')) : null,
          height: el.getAttribute('Height') ? parseFloat(el.getAttribute('Height')) : null,
          opacity,
          origin,
          transform,
          children
        };
      }
      return null;
    }

    let rootVisual = null;
    for (let i = 0; i < rootNode.children.length; i++) {
      const tag = rootNode.children[i].tagName.split(':').pop();
      if (tag === 'Grid' || tag === 'Canvas') {
        rootVisual = buildNodeSpec(rootNode.children[i]);
        break;
      }
    }

    const blueprint = { designW, designH, storyboards, rootVisual };
    interactiveBlueprintCache[cleanPath] = blueprint;
    return blueprint;
  }

  function evalKeyframes(kfs, timeSec, fallbackVal) {
    if (!kfs || kfs.length === 0) return fallbackVal;
    if (timeSec <= kfs[0].t) return kfs[0].v;
    const last = kfs[kfs.length - 1];
    if (timeSec >= last.t) return last.v;

    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i];
      const b = kfs[i + 1];
      if (timeSec >= a.t && timeSec <= b.t) {
        const span = b.t - a.t;
        if (span <= 0.0001) return b.v;
        const p = applyEasing((timeSec - a.t) / span, b.ease);
        return a.v + (b.v - a.v) * p;
      }
    }
    return last.v;
  }

  /**
   * Tạo một thực thể SVG tương tác từ file XAML (mole.xaml, goal.xaml, crab.xaml, octopus.xaml, memory.xaml, box.xaml)
   * options:
   *   - viewBox: chuỗi viewBox tùy chỉnh (mặc định `0 0 designW designH`)
   *   - overflow: 'visible' | 'hidden' (mặc định 'visible')
   *   - textTargetName: tên 1 node thay bằng <text> (tương thích ngược với mole.xaml)
   *   - textTargets: { [nodeName]: { x, y, fill, stroke, strokeWidth, baseSize, maxWidth } }
   *   - injectTexts: { [key]: { parent, x, y, fill, stroke, strokeWidth, baseSize, maxWidth } }
   */
  async function createInteractiveXaml(xamlPath, options) {
    const opts = options || {};
    const bp = await loadInteractiveBlueprint(xamlPath);
    if (!bp || !bp.rootVisual) return null;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', opts.viewBox || `0 0 ${bp.designW} ${bp.designH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = opts.overflow || 'visible';

    const namedMap = {};
    const textNodes = {};
    const textConfigs = {};

    // Chuẩn hóa danh sách textTargets (tương thích cả textTargetName cũ lẫn textTargets nhiều ô như box.xaml)
    if (opts.textTargets && typeof opts.textTargets === 'object') {
      Object.keys(opts.textTargets).forEach(k => {
        textConfigs[k] = opts.textTargets[k];
      });
    } else {
      const legacyTarget = opts.textTargetName !== undefined ? opts.textTargetName : 'box1_2';
      if (legacyTarget) {
        textConfigs[legacyTarget] = {
          x: bp.designW / 2 - 4,
          y: bp.designH / 2 + 4,
          fill: '#1d4ed8',
          baseSize: 90,
          maxWidth: 205
        };
      }
    }

    const injectTexts = opts.injectTexts || {};
    let defaultTextKey = Object.keys(textConfigs)[0] || Object.keys(injectTexts)[0] || null;

    function createStyledTextElement(cfg) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(cfg.x !== undefined ? cfg.x : bp.designW / 2));
      t.setAttribute('y', String(cfg.y !== undefined ? cfg.y : bp.designH / 2));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('fill', cfg.fill || '#1d4ed8');
      t.setAttribute('font-family', 'Nunito, Segoe UI, Roboto, Arial, sans-serif');
      t.setAttribute('font-weight', '900');
      t.setAttribute('font-size', String(cfg.baseSize || 72));
      if (cfg.stroke) {
        t.setAttribute('stroke', cfg.stroke);
        t.setAttribute('stroke-width', String(cfg.strokeWidth || 4));
        t.setAttribute('stroke-linejoin', 'round');
        t.style.paintOrder = 'stroke fill';
      }
      t.style.pointerEvents = 'none';
      return t;
    }

    function applyStateToElement(entry) {
      const { el, state, origin } = entry;
      el.setAttribute('opacity', String(Math.max(0, Math.min(1, state.opacity))));
      const isIdentity =
        Math.abs(state.tx) < 0.01 &&
        Math.abs(state.ty) < 0.01 &&
        Math.abs(state.rot) < 0.01 &&
        Math.abs(state.sx - 1) < 0.001 &&
        Math.abs(state.sy - 1) < 0.001;

      if (isIdentity) {
        el.removeAttribute('transform');
      } else {
        const ox = origin.ox;
        const oy = origin.oy;
        el.setAttribute(
          'transform',
          `translate(${(ox + state.tx).toFixed(2)}, ${(oy + state.ty).toFixed(2)}) rotate(${state.rot.toFixed(2)}) scale(${state.sx.toFixed(3)}, ${state.sy.toFixed(3)}) translate(${(-ox).toFixed(2)}, ${(-oy).toFixed(2)})`
        );
      }
    }

    function createDomNode(spec) {
      let el;
      if (spec.type === 'path') {
        el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', spec.d);
        el.setAttribute('fill', spec.fill);
        if (spec.stroke) el.setAttribute('stroke', spec.stroke);
        if (spec.strokeWidth) el.setAttribute('stroke-width', spec.strokeWidth);
      } else {
        el = document.createElementNS(SVG_NS, 'g');
        if (spec.name && textConfigs[spec.name]) {
          const tEl = createStyledTextElement(textConfigs[spec.name]);
          textNodes[spec.name] = { el: tEl, cfg: textConfigs[spec.name] };
          el.appendChild(tEl);
        } else {
          spec.children.forEach(ch => {
            el.appendChild(createDomNode(ch));
          });
        }
      }

      // Chèn thêm text vào trong một nhóm XAML cụ thể (vd: chèn chữ lên trán bạch tuộc hoặc trong vỏ sò mở)
      if (spec.name) {
        Object.keys(injectTexts).forEach(key => {
          const icfg = injectTexts[key];
          if (icfg && icfg.parent === spec.name) {
            const tEl = createStyledTextElement(icfg);
            textNodes[key] = { el: tEl, cfg: icfg };
            el.appendChild(tEl);
          }
        });
      }

      const initialState = {
        opacity: spec.opacity,
        tx: spec.transform.tx,
        ty: spec.transform.ty,
        sx: spec.transform.sx,
        sy: spec.transform.sy,
        rot: spec.transform.rot
      };

      const entry = {
        el,
        origin: spec.origin,
        initial: { ...initialState },
        state: { ...initialState }
      };

      applyStateToElement(entry);

      if (spec.name) {
        namedMap[spec.name] = entry;
      }
      return el;
    }

    svg.appendChild(createDomNode(bp.rootVisual));

    let rafId = null;
    let activeRunId = 0;

    function cancelAnimation() {
      activeRunId++;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function setText(str, targetKey) {
      const key = targetKey || defaultTextKey;
      const rec = key ? textNodes[key] : null;
      if (!rec) return;

      const clean = String(str || '').trim();
      rec.el.textContent = clean;

      const baseSize = rec.cfg.baseSize || 84;
      const maxWidth = rec.cfg.maxWidth || 185;
      // Ước lượng độ rộng chữ (mỗi ký tự rộng khoảng 0.58 * fontSize) để tự động co khít hộp/bong bóng
      const estCharFactor = Math.max(1, clean.length * 0.58);
      const fittedSize = Math.min(baseSize, maxWidth / estCharFactor);
      const finalSize = Math.max(12, Math.round(fittedSize));
      rec.el.setAttribute('font-size', String(finalSize));
    }

    function setPartOpacity(partName, op) {
      const entry = namedMap[partName];
      if (!entry) return;
      entry.state.opacity = op;
      applyStateToElement(entry);
    }

    function getElement(partName) {
      return namedMap[partName] ? namedMap[partName].el : null;
    }

    function resetToInitial() {
      cancelAnimation();
      Object.keys(namedMap).forEach(k => {
        const entry = namedMap[k];
        entry.state = { ...entry.initial };
        applyStateToElement(entry);
      });
    }

    function playStoryboard(sbName, playOpts) {
      const pOpts = playOpts || {};
      cancelAnimation();
      const sb = bp.storyboards[sbName];
      if (!sb) return Promise.resolve();

      if (pOpts.resetBefore) {
        Object.keys(namedMap).forEach(k => {
          const entry = namedMap[k];
          entry.state = { ...entry.initial };
          applyStateToElement(entry);
        });
      }

      const myRun = activeRunId;
      const shouldLoop = pOpts.loop !== undefined ? Boolean(pOpts.loop) : Boolean(sb.repeatForever);
      const speed = pOpts.speed && pOpts.speed > 0 ? pOpts.speed : 1;
      const durationSec = Math.max(0.05, sb.duration);
      const durationMs = (durationSec * 1000) / speed;
      const startTime = performance.now();

      // Trong mole.xaml, sb_true và sb_fail ẩn bóng thoại `path` nhưng không liệt kê `box1_2` -> tự ẩn chữ cùng lúc
      if (defaultTextKey === 'box1_2' && namedMap['path'] && (sbName === 'sb_true' || sbName === 'sb_fail') && namedMap['box1_2'] && !sb.tracks['box1_2']) {
        if (bp.storyboards['sb_show']) {
          setPartOpacity('box1_2', 0);
        }
      }

      return new Promise(resolve => {
        function frame(now) {
          if (myRun !== activeRunId) {
            resolve();
            return;
          }
          const rawElapsedMs = (now - startTime) * speed;
          const elapsedSec = shouldLoop
            ? ((rawElapsedMs / 1000) % durationSec)
            : Math.min(durationSec, rawElapsedMs / 1000);

          Object.keys(sb.tracks).forEach(targetName => {
            const entry = namedMap[targetName];
            if (!entry) return;
            const tr = sb.tracks[targetName];
            if (tr.opacity) entry.state.opacity = evalKeyframes(tr.opacity, elapsedSec, entry.state.opacity);
            if (tr.tx) entry.state.tx = evalKeyframes(tr.tx, elapsedSec, entry.state.tx);
            if (tr.ty) entry.state.ty = evalKeyframes(tr.ty, elapsedSec, entry.state.ty);
            if (tr.sx) entry.state.sx = evalKeyframes(tr.sx, elapsedSec, entry.state.sx);
            if (tr.sy) entry.state.sy = evalKeyframes(tr.sy, elapsedSec, entry.state.sy);
            if (tr.rot) entry.state.rot = evalKeyframes(tr.rot, elapsedSec, entry.state.rot);
            applyStateToElement(entry);
          });

          if (shouldLoop || (now - startTime) < durationMs) {
            rafId = requestAnimationFrame(frame);
          } else {
            rafId = null;
            resolve();
          }
        }
        rafId = requestAnimationFrame(frame);
      });
    }

    return {
      svg,
      setText,
      setPartOpacity,
      getElement,
      playStoryboard,
      resetToInitial,
      destroy: cancelAnimation
    };
  }

  ns.XamlParser = {
    fetchAndParseXaml,
    renderXamlToContainer,
    createInteractiveXaml
  };
})(window.AppTV);
