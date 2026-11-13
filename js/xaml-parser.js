/**
 * js/xaml-parser.js
 * Đọc chính xác từng Storyboard trong file .xaml, ẩn toàn bộ các Path không liên quan để không bị đè chữ.
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const xamlCache = {};

  async function fetchAndParseXaml(xamlPath) {
    let cleanPath = xamlPath.trim().replace(/^\/+/, '');
    if (!cleanPath.endsWith('.xaml')) cleanPath += '.xaml';
    if (!cleanPath.startsWith('animations/')) {
      cleanPath = 'animations/' + cleanPath;
    }

    if (xamlCache[cleanPath]) return xamlCache[cleanPath];

    const candidates = [
      cleanPath,
      'assets/' + cleanPath,
      cleanPath.replace('animations/', ''),
      'animations/' + cleanPath.split('/').pop()
    ];

    let xmlText = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          xmlText = await res.text();
          break;
        }
      } catch (e) {}
    }

    if (!xmlText) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    // Lấy kích thước thiết kế gốc của XAML (thường là 400x400)
    const rootNode = xmlDoc.documentElement;
    const designW = rootNode.getAttribute('d:DesignWidth') || '400';
    const designH = rootNode.getAttribute('d:DesignHeight') || '400';

    // Phân tích toàn bộ Storyboard
    const storyboards = {};
    const sbNodes = xmlDoc.querySelectorAll('Storyboard');
    sbNodes.forEach(sb => {
      const sbName = sb.getAttribute('x:Name') || sb.getAttribute('Name');
      if (!sbName) return;

      const animations = {};
      const frames = sb.querySelectorAll('DoubleAnimationUsingKeyFrames');
      frames.forEach(frame => {
        const targetName = frame.getAttribute('Storyboard.TargetName');
        const targetProp = frame.getAttribute('Storyboard.TargetProperty') || '';
        if (!targetName) return;

        if (!animations[targetName]) {
          animations[targetName] = { opacity: [], scaleX: [], scaleY: [], translateX: [], translateY: [] };
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
          }
        });
      });
      storyboards[sbName] = animations;
    });

    // Lấy toàn bộ thẻ Path kèm Opacity và Transform gốc của nó
    const pathNodes = xmlDoc.querySelectorAll('Path');
    const pathsData = [];
    pathNodes.forEach(p => {
      const name = p.getAttribute('x:Name') || p.getAttribute('Name') || '';
      const data = p.getAttribute('Data') || '';
      const fill = p.getAttribute('Fill') || '#F4821F';
      const baseOpacity = p.getAttribute('Opacity'); // Nếu XAML đặt Opacity="0" thì mặc định ẩn

      // Đọc CompositeTransform gốc nếu có
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

  function parseKeyTimeToSeconds(timeStr) {
    try {
      const parts = timeStr.split(':');
      if (parts.length === 3) {
        return (parseFloat(parts[0]) || 0) * 3600 +
               (parseFloat(parts[1]) || 0) * 60 +
               (parseFloat(parts[2]) || 0);
      }
    } catch (e) {}
    return 0;
  }

  async function renderXamlToContainer(xamlPath, storyboardName, containerEl) {
    containerEl.innerHTML = '';
    const parsed = await fetchAndParseXaml(xamlPath);
    if (!parsed || !parsed.paths || parsed.paths.length === 0) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${parsed.designW} ${parsed.designH}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";

    const sbData = (parsed.storyboards && storyboardName) ? parsed.storyboards[storyboardName] : null;
    const hasStoryboard = sbData && Object.keys(sbData).length > 0;

    parsed.paths.forEach(item => {
      const isTargetInSb = hasStoryboard && item.name && sbData[item.name];

      // QUAN TRỌNG: Nếu đang chạy một Storyboard cụ thể (ví dụ a0, a1, sb1)
      // thì BỎ QUA hoàn toàn các Path không thuộc Storyboard đó để không bao giờ bị đè chữ!
      if (hasStoryboard && !isTargetInSb) {
        // Chỉ giữ lại nếu Path đó không có Opacity="0" và không có tên (nền cố định)
        if (item.baseOpacity === '0' || item.name) return;
      }

      const pathEl = document.createElementNS(svgNS, "path");
      pathEl.setAttribute("d", item.data);
      pathEl.setAttribute("fill", item.fill);
      pathEl.style.transformBox = "fill-box";
      pathEl.style.transformOrigin = "center center";

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

  ns.XamlParser = {
    fetchAndParseXaml,
    renderXamlToContainer
  };
})(window.AppTV);
