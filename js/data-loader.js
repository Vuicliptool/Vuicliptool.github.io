/**
 * js/data-loader.js
 * Quản lý nạp 4 file cấu hình (data.txt, write.txt, thinking.txt, games.txt)
 * và lưu bộ nhớ đệm để dùng ngay khi mở lại.
 */
window.AppTV = window.AppTV || {};

(function (ns) {
  const STORE = {
    data: [],
    write: [],
    thinking: [],
    games: []
  };

  function normalizeDataStructure(key, rawJson) {
    if (!Array.isArray(rawJson)) return [];
    // thinking.txt là mảng các bài học trực tiếp (không có lớp bọc "lessons")
    if (rawJson.length > 0 && !rawJson[0].lessons && rawJson[0].intro) {
      return [{ name: 'Chuyên đề Tư duy', lessons: rawJson }];
    }
    return rawJson;
  }

  async function loadAllTxtFiles(onReady) {
    const files = [
      { key: 'data', paths: ['data/data.txt', 'assets/data/data.txt', 'data.txt'] },
      { key: 'write', paths: ['data/write.txt', 'assets/data/write.txt', 'write.txt'] },
      { key: 'thinking', paths: ['data/thinking.txt', 'assets/data/thinking.txt', 'thinking.txt'] },
      { key: 'games', paths: ['data/games.txt', 'assets/data/games.txt', 'games.txt'] }
    ];

    for (const item of files) {
      let loaded = false;
      for (const p of item.paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const json = await res.json();
            STORE[item.key] = normalizeDataStructure(item.key, json);
            loaded = true;
            break;
          }
        } catch (e) {}
      }
      // Nếu mở qua file:// bị chặn fetch, thử khôi phục từ localStorage
      if (!loaded) {
        try {
          const cached = localStorage.getItem('APPTV_CACHE_' + item.key);
          if (cached) STORE[item.key] = JSON.parse(cached);
        } catch (e) {}
      }
    }

    if (typeof onReady === 'function') onReady();
  }

  async function handleManualFileUpload(fileList, onDone) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const fname = file.name.toLowerCase();
        let targetKey = null;
        if (fname.includes('data')) targetKey = 'data';
        else if (fname.includes('write')) targetKey = 'write';
        else if (fname.includes('thinking')) targetKey = 'thinking';
        else if (fname.includes('game')) targetKey = 'games';

        if (targetKey) {
          STORE[targetKey] = normalizeDataStructure(targetKey, json);
          try {
            localStorage.setItem('APPTV_CACHE_' + targetKey, JSON.stringify(STORE[targetKey]));
          } catch (e) {}
        }
      } catch (err) {
        alert('Lỗi đọc file ' + file.name + ': ' + err.message);
      }
    }
    if (typeof onDone === 'function') onDone();
  }

  ns.DataLoader = {
    STORE,
    loadAllTxtFiles,
    handleManualFileUpload
  };
})(window.AppTV);
