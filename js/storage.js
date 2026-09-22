/* ============================================================
 * LIFE RPG - 数据存储
 * 所有数据保存在浏览器 localStorage，刷新不丢失。
 * ============================================================ */

function defaultState() {
  return {
    version: 1,
    player: {
      level: 1,
      exp: 0,
      coins: 0,
      attributes: { health: 0, intelligence: 0, fitness: 0, discipline: 0 },
      titleId: null, // 当前佩戴的称号
      createdAt: Date.now(),
    },
    categories: [],
    behaviors: [],
    history: [],      // 每次完成行为都独立保存"当时实际获得的奖励"，永不重算
    achievements: [], // { id, name, icon, description, condition, unlocked, unlockedAt }
    titles: [],       // { id, name, icon, description, condition, unlocked, unlockedAt }
    shopItems: [],
    purchases: [],    // { id, itemId, itemName, icon, price, time }
    firstOpen: true,
  };
}

/** 首次打开：写入种子示例数据（仅模板，用户可全部编辑/删除） */
function buildSeededState() {
  const s = defaultState();
  s.categories = CONFIG.seed.categories.map(c => ({ ...c }));
  s.behaviors = CONFIG.seed.behaviors.map(b => ({
    ...b,
    rewards: { ...b.rewards },
  }));
  s.shopItems = CONFIG.seed.shopItems.map(i => ({ ...i }));
  s.achievements = CONFIG.seed.achievements.map(a => ({
    ...a, condition: { ...a.condition }, unlocked: false, unlockedAt: null,
  }));
  s.titles = CONFIG.seed.titles.map(t => ({
    ...t, condition: { ...t.condition }, unlocked: false, unlockedAt: null,
  }));
  return s;
}

/** 读取存档；缺失字段用默认值补齐（保证旧存档升级兼容） */
function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return buildSeededState();
    const saved = JSON.parse(raw);
    const def = defaultState();
    const merged = { ...def, ...saved };
    merged.player = { ...def.player, ...(saved.player || {}) };
    merged.player.attributes = { ...def.player.attributes, ...((saved.player || {}).attributes || {}) };
    // 保证数组字段一定存在
    ['categories', 'behaviors', 'history', 'achievements', 'titles', 'shopItems', 'purchases']
      .forEach(k => { if (!Array.isArray(merged[k])) merged[k] = []; });
    return merged;
  } catch (e) {
    console.error('读取存档失败，使用新存档', e);
    return buildSeededState();
  }
}

function saveState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
  } catch (e) {
    console.error('保存失败', e);
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ 保存失败：浏览器存储不可用', 'error');
  }
}

// 全局唯一状态（storage.js 先于其他业务脚本加载）
let state = loadState();
if (state.firstOpen) {
  state.firstOpen = false;
  saveState();
}
