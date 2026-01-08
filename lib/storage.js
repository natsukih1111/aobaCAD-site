// file: lib/storage.js
// まずは簡単に localStorage に保存（後で IndexedDB に置き換え予定）

const KEY = 'cadsite_v1';

export function loadState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getInitialState() {
  return {
    materials: [
      // 例: 密度(kg/m3) とか「kg/mm」などは後で統一します。まずは仮。
      { id: 'steel', name: 'SS400（仮）', unitWeightNote: '未設定' },
    ],
    templates: [
      { id: 'hbeam_100', type: 'H', name: 'H-100（仮）', meta: { h: 100, b: 100, tw: 6, tf: 8 } },
      { id: 'channel_100', type: 'C', name: 'C-100（仮）', meta: { h: 100, b: 50, tw: 5, tf: 7 } },
    ],
  };
}
