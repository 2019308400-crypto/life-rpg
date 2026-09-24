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
    achievements: [], // { id, name, icon, description, condition, rewards:{exp,coins}, unlocked, unlockedAt }
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
    ...a, condition: { ...a.condition }, rewards: { exp: 0, coins: 0, ...(a.rewards || {}) },
    unlocked: false, unlockedAt: null,
  }));
  s.titles = CONFIG.seed.titles.map(t => ({
    ...t, condition: { ...t.condition }, unlocked: false, unlockedAt: null,
  }));
  return s;
}

/**
 * 种子合并迁移：让已有存档也能看到种子里的新描述和新增项。
 * - 按 id 追加种子中存在但存档里没有的项（成就/称号追加时 unlocked=false）
 * - 已存在的项：更新 description（用种子新描述覆盖旧描述）
 * - 成就：rewards 全为 0 时用种子奖励补齐（不覆盖用户自定义的非零奖励）
 * 不会改动用户自建的项、奖励数值、解锁状态。
 */
function mergeSeedDefaults(s) {
  const mergeList = (list, seedList, kind) => {
    let changed = false;
    seedList.forEach(seed => {
      const existing = list.find(x => x.id === seed.id);
      if (!existing) {
        // 追加缺失的种子项
        const entry = { ...seed, condition: { ...seed.condition } };
        if (kind === 'achievement') {
          entry.rewards = { exp: 0, coins: 0, ...(seed.rewards || {}) };
          entry.unlocked = false;
          entry.unlockedAt = null;
        } else if (kind === 'title') {
          entry.unlocked = false;
          entry.unlockedAt = null;
        }
        list.push(entry);
        changed = true;
      } else {
        // 只填充空描述，不覆盖用户自己写的描述
        if (seed.description && !existing.description) {
          existing.description = seed.description;
          changed = true;
        }
        // 成就：奖励为 0 时补齐
        if (kind === 'achievement' && seed.rewards) {
          const r = existing.rewards || { exp: 0, coins: 0 };
          if ((!r.exp && seed.rewards.exp) || (!r.coins && seed.rewards.coins)) {
            existing.rewards = {
              exp: r.exp || seed.rewards.exp || 0,
              coins: r.coins || seed.rewards.coins || 0,
            };
            changed = true;
          }
        }
      }
    });
    return changed;
  };

  let changed = false;
  // 只对成就和称号做合并（行为/商品完全由用户自己做主，不追加种子项）
  if (mergeList(s.achievements, CONFIG.seed.achievements, 'achievement')) changed = true;
  if (mergeList(s.titles, CONFIG.seed.titles, 'title')) changed = true;
  return changed;
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
    // 迁移：老成就补齐奖励字段
    merged.achievements = merged.achievements.map(a => ({
      ...a,
      rewards: { exp: 0, coins: 0, ...((a && a.rewards) || {}) },
    }));
    // 种子合并迁移：补全新描述和新增项
    mergeSeedDefaults(merged);
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

/* ---------- 备份 / 恢复 ---------- */

/** 导出完整存档为 JSON 文件并触发下载 */
function exportBackup() {
  try {
    const data = {
      app: 'LIFE RPG',
      version: 1,
      exportedAt: new Date().toISOString(),
      storageKey: CONFIG.storageKey,
      state: state,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = dateKey().replace(/-/g, '');
    a.href = url;
    a.download = `life-rpg-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('备份失败', e);
    return false;
  }
}

/**
 * 从备份 JSON 恢复存档。
 * @param {string} jsonText
 * @returns {{ok:boolean, msg:string}}
 */
function importBackup(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    // 兼容两种格式：直接是 state，或包装成 { state: ... }
    const restored = data && data.state ? data.state : data;
    if (!restored || typeof restored !== 'object' || !restored.player) {
      return { ok: false, msg: '文件格式不正确：缺少 player 字段' };
    }
    // 用默认值补齐缺失字段，保证兼容
    const def = defaultState();
    const merged = { ...def, ...restored };
    merged.player = { ...def.player, ...restored.player };
    merged.player.attributes = { ...def.player.attributes, ...restored.player.attributes };
    ['categories', 'behaviors', 'history', 'achievements', 'titles', 'shopItems', 'purchases']
      .forEach(k => { if (!Array.isArray(merged[k])) merged[k] = []; });
    // 覆盖当前 state 并保存
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, merged);
    saveState();
    return { ok: true, msg: '恢复成功' };
  } catch (e) {
    console.error('恢复失败', e);
    return { ok: false, msg: '文件解析失败：' + e.message };
  }
}

// 全局唯一状态（storage.js 先于其他业务脚本加载）
let state = loadState();
if (state.firstOpen) {
  state.firstOpen = false;
}
// 持久化合并迁移的结果（新描述/新增项），保证刷新后不丢
saveState();
