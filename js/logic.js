/* ============================================================
 * LIFE RPG - 核心规则引擎
 * 奖励计算 / 等级 / 条件判断 / 派生统计。
 * 页面不写死任何数字，全部调用这里。
 * ============================================================ */

/* ---------- 通用工具 ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 本地日期键 YYYY-MM-DD（按用户时区，不用 UTC） */
function dateKey(d) {
  d = d || new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dateKey(d)} ${hm}`;
}

/** 数字展示：整数直接显示，小数最多保留 1 位 */
function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

/* ---------- 等级公式（读 CONFIG.level，可自行修改） ---------- */

function expToNext(level) {
  const { base, growth } = CONFIG.level;
  return Math.round(base * Math.pow(growth, level - 1));
}

/** 返回 { levelUps: [ [from,to], ... ] }，会直接修改 player */
function addExp(amount) {
  const p = state.player;
  p.exp += amount;
  const levelUps = [];
  while (p.level < CONFIG.level.maxLevel && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    const from = p.level;
    p.level += 1;
    levelUps.push([from, p.level]);
  }
  return levelUps;
}

/** 反向扣 EXP：EXP 不足时逐级降级（最低 Lv.1，EXP 归零）。返回降级列表 [ [from,to] ] */
function removeExp(amount) {
  const p = state.player;
  p.exp -= amount;
  const downs = [];
  while (p.exp < 0 && p.level > 1) {
    p.level -= 1;
    p.exp += expToNext(p.level); // 退回上一级所需阈值
    downs.push([p.level + 1, p.level]);
  }
  if (p.level === 1 && p.exp < 0) p.exp = 0;
  return downs;
}

/* ---------- 奖励计算 ---------- */

/**
 * 按行为配置计算实际奖励。
 * fixed    : 直接取 rewards
 * per_unit : rewards * quantity
 * per_time : rewards * (minutes / perTimeMinutes)
 * EXP/金币取整；属性保留 1 位小数。
 */
function calcGained(behavior, quantity) {
  const q = Math.max(0, Number(quantity) || 0);
  let factor = 1;
  if (behavior.rewardType === 'per_unit') factor = q;
  if (behavior.rewardType === 'per_time') {
    const per = Math.max(1, Number(behavior.perTimeMinutes) || 30);
    factor = q / per;
  }
  const roundAttr = v => Math.round(v * 10) / 10;
  const r = behavior.rewards || {};
  return {
    exp: Math.round((Number(r.exp) || 0) * factor),
    coins: Math.round((Number(r.coins) || 0) * factor),
    health: roundAttr((Number(r.health) || 0) * factor),
    intelligence: roundAttr((Number(r.intelligence) || 0) * factor),
    fitness: roundAttr((Number(r.fitness) || 0) * factor),
    discipline: roundAttr((Number(r.discipline) || 0) * factor),
  };
}

/** 奖励预览文本行（不落库，仅展示） */
function rewardSummary(behavior) {
  const r = behavior.rewards || {};
  const parts = [`EXP+${fmtNum(r.exp)}`, `🪙+${fmtNum(r.coins)}`];
  CONFIG.attributes.forEach(a => {
    const v = Number(r[a.key]) || 0;
    if (v) parts.push(`${a.icon}+${fmtNum(v)}`);
  });
  return parts.join('  ');
}

/**
 * 完成行为：写入独立历史记录（保存当时实际获得的奖励）、发放奖励、升级、检测成就/称号。
 * 返回 { gained, levelUps, unlockedAchievements, unlockedTitles }
 */
function completeBehavior(behaviorId, quantity) {
  const b = state.behaviors.find(x => x.id === behaviorId);
  if (!b) return null;
  const gained = calcGained(b, quantity);

  const record = {
    id: uid(),
    behaviorId: b.id,
    behaviorName: b.name, // 快照：删除模板后历史仍在
    behaviorIcon: b.icon,
    quantity: Number(quantity) || 0,
    unit: b.unit || '',
    rewardType: b.rewardType,
    time: Date.now(),
    gained, // ★ 保存当时实际获得的奖励，之后修改模板不影响
  };
  state.history.push(record);

  // 发放奖励
  const p = state.player;
  p.coins += gained.coins;
  CONFIG.attributes.forEach(a => {
    p.attributes[a.key] = Math.round((p.attributes[a.key] + gained[a.key]) * 10) / 10;
  });
  const levelUps = addExp(gained.exp);

  // 检测成就 / 称号（在等级/属性更新后判断）。
  // 成就奖励的 EXP 可能再次触发升级 → 解锁更多成就/称号，循环直到无新解锁。
  const unlockedAchievements = [];
  const unlockedTitles = [];
  const extraLevelUps = [];
  for (let guard = 0; guard < 100; guard++) {
    const a = checkAllUnlockable('achievement');
    const t = checkAllUnlockable('title');
    unlockedAchievements.push(...a.items);
    unlockedTitles.push(...t.items);
    extraLevelUps.push(...a.levelUps);
    if (!a.items.length && !t.items.length) break;
  }

  // 联动：若该行为在"当日清单"里且本次数量达标，自动打勾
  syncDailyAfterComplete(record);

  saveState();
  return {
    gained,
    levelUps: levelUps.concat(extraLevelUps),
    unlockedAchievements,
    unlockedTitles,
    record,
  };
}

/**
 * 撤回一条完成记录：按记录中"当时实际获得的奖励"反向扣回，并删除记录。
 * 金币/属性不足时扣到 0；EXP 不足时逐级降级（最低 Lv.1）。
 * 已解锁的成就/称号保留（成就一旦获得不回收）。
 * 返回 { gained, levelDowns } 或 null。
 */
function removeRecord(recordId) {
  const idx = state.history.findIndex(r => r.id === recordId);
  if (idx === -1) return null;
  const record = state.history[idx];
  const gained = record.gained || {};
  const p = state.player;

  p.coins = Math.max(0, p.coins - (Number(gained.coins) || 0));
  CONFIG.attributes.forEach(a => {
    p.attributes[a.key] = Math.max(0, Math.round((p.attributes[a.key] - (gained[a.key] || 0)) * 10) / 10);
  });
  const levelDowns = removeExp(Number(gained.exp) || 0);

  state.history.splice(idx, 1);
  // 联动：撤回记录后，对应的每日任务取消打勾（宝箱已开则保持已开）
  uncheckDailyTask(recordId);
  saveState();
  return { gained, levelDowns };
}

/* ---------- 派生统计 ---------- */

/** 今日汇总（从历史记录实时统计，天然与记录一致） */
function todayStats() {
  return periodStats('day', new Date());
}

/* ---------- 周期统计（日 / 周 / 月） ---------- */

const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 周期范围：{ start(00:00), end(23:59:59.999) }
 * 周以周一为起点（国内习惯）
 */
function periodRange(period, base) {
  const b = base ? new Date(base) : new Date();
  if (period === 'day') {
    const start = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'week') {
    const dow = b.getDay(); // 0=周日
    const diff = dow === 0 ? -6 : 1 - dow; // 回到本周一
    const start = new Date(b.getFullYear(), b.getMonth(), b.getDate() + diff);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
  }
  // month：本月1号 ~ 本月最后一天
  const start = new Date(b.getFullYear(), b.getMonth(), 1);
  const end = new Date(b.getFullYear(), b.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** 周期偏移后的基准日期（offset: 0=当前, -1=上一个, 1=下一个） */
function shiftedBase(period, offset) {
  const b = new Date();
  if (period === 'day') b.setDate(b.getDate() + offset);
  else if (period === 'week') b.setDate(b.getDate() + offset * 7);
  else b.setMonth(b.getMonth() + offset);
  return b;
}

/** 周期文字标签 */
function periodLabel(period, base) {
  const { start, end } = periodRange(period, base);
  const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
  if (period === 'day') return `${dateKey(start)} ${WEEKDAYS_CN[start.getDay()]}`;
  if (period === 'week') return `${md(start)} ~ ${md(end)}`;
  return `${start.getFullYear()}年${start.getMonth() + 1}月`;
}

/** 汇总指定周期内的全部奖励 */
function periodStats(period, base) {
  const { start, end } = periodRange(period, base);
  const stats = { exp: 0, coins: 0, health: 0, intelligence: 0, fitness: 0, discipline: 0, completions: 0 };
  state.history.forEach(r => {
    const t = new Date(r.time);
    if (t < start || t > end) return;
    stats.exp += r.gained.exp;
    stats.coins += r.gained.coins;
    CONFIG.attributes.forEach(a => { stats[a.key] += r.gained[a.key] || 0; });
    stats.completions += 1;
  });
  CONFIG.attributes.forEach(a => { stats[a.key] = Math.round(stats[a.key] * 10) / 10; });
  return stats;
}

/**
 * 记录分组键
 * day → YYYY-MM-DD；week → 该周周一的 YYYY-MM-DD；month → YYYY-MM
 */
function groupKeyOf(ts, period) {
  const d = new Date(ts);
  if (period === 'day') return dateKey(d);
  if (period === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return dateKey(periodRange('week', d).start);
}

/** 分组标题 */
function groupLabel(key, period) {
  if (period === 'day') {
    const d = new Date(key + 'T00:00:00');
    const todayK = dateKey();
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const tag = key === todayK ? ' · 今天' : key === dateKey(yest) ? ' · 昨天' : '';
    return `${key} ${WEEKDAYS_CN[d.getDay()]}${tag}`;
  }
  if (period === 'month') {
    const [y, m] = key.split('-');
    return `${y}年${parseInt(m, 10)}月`;
  }
  const monday = new Date(key + 'T00:00:00');
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
  return `📅 ${md(monday)} ~ ${md(sunday)}`;
}

/** 汇总任意一组记录的奖励（分组标题用） */
function sumRecords(records) {
  const s = { exp: 0, coins: 0, health: 0, intelligence: 0, fitness: 0, discipline: 0, completions: records.length };
  records.forEach(r => {
    s.exp += r.gained.exp || 0;
    s.coins += r.gained.coins || 0;
    CONFIG.attributes.forEach(a => { s[a.key] += r.gained[a.key] || 0; });
  });
  CONFIG.attributes.forEach(a => { s[a.key] = Math.round(s[a.key] * 10) / 10; });
  s.exp = Math.round(s.exp * 10) / 10;
  s.coins = Math.round(s.coins * 10) / 10;
  return s;
}

/** 某行为的累计次数 / 累计数量 */
function behaviorStats(behaviorId) {
  let count = 0, quantity = 0;
  state.history.forEach(r => {
    if (r.behaviorId !== behaviorId) return;
    count += 1;
    quantity += Number(r.quantity) || 0;
  });
  return { count, quantity: Math.round(quantity * 10) / 10 };
}

/** 所有行为累计完成总次数 */
function totalCompletions() {
  return state.history.length;
}

/**
 * 某行为的连续天数：从今天（或昨天）往前数连续完成的天数。
 * 今天没做不打断（还能补），连续断两天则归零。
 */
function streakOf(behaviorId) {
  const days = new Set();
  state.history.forEach(r => {
    if (r.behaviorId === behaviorId) days.add(dateKey(new Date(r.time)));
  });
  if (days.size === 0) return 0;
  const d = new Date();
  const keyAt = dd => dateKey(dd);
  if (!days.has(keyAt(d))) {
    d.setDate(d.getDate() - 1); // 宽限：从昨天开始算
    if (!days.has(keyAt(d))) return 0;
  }
  let streak = 0;
  while (days.has(keyAt(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ---------- 条件判断（成就 / 称号共用） ---------- */

function conditionProgress(cond) {
  const c = cond || {};
  const val = Number(c.value) || 0;
  let cur = 0;
  switch (c.type) {
    case 'first_complete':    cur = state.history.some(r => r.behaviorId === c.behaviorId) ? 1 : 0; break;
    case 'total_count':       cur = behaviorStats(c.behaviorId).count; break;
    case 'total_quantity':    cur = behaviorStats(c.behaviorId).quantity; break;
    case 'total_completions': cur = totalCompletions(); break;
    case 'level':             cur = state.player.level; break;
    case 'attribute':         cur = state.player.attributes[c.attribute] || 0; break;
    case 'streak':            cur = streakOf(c.behaviorId); break;
    default: cur = 0;
  }
  // first_complete 是布尔事件：完成过即算（与 value 无关，防止 value=0 时凭空满足）
  if (c.type === 'first_complete') return { current: cur, target: 1, done: cur >= 1 };
  return { current: cur, target: val, done: cur >= val };
}

function conditionText(cond) {
  const c = cond || {};
  const t = CONFIG.conditionTypes[c.type];
  if (!t) return '未知条件';
  const bName = id => {
    const b = state.behaviors.find(x => x.id === id);
    return b ? `「${b.name}」` : '已删除行为';
  };
  switch (c.type) {
    case 'first_complete':    return `第一次完成 ${bName(c.behaviorId)}`;
    case 'total_count':       return `${bName(c.behaviorId)} 累计 ${fmtNum(c.value)} 次`;
    case 'total_quantity':    return `${bName(c.behaviorId)} 累计 ${fmtNum(c.value)} 单位`;
    case 'total_completions': return `累计完成任意行为 ${fmtNum(c.value)} 次`;
    case 'level':             return `等级达到 Lv.${c.value}`;
    case 'attribute': {
      const a = CONFIG.attributes.find(x => x.key === c.attribute);
      return `${a ? a.icon + ' ' + a.name : c.attribute} ≥ ${fmtNum(c.value)}`;
    }
    case 'streak':            return `连续 ${fmtNum(c.value)} 天完成 ${bName(c.behaviorId)}`;
    default: return '未知条件';
  }
}

/**
 * 解锁成就：标记解锁 + 按成就自身配置发放金币 / EXP（数字由用户设置）。
 * 返回奖励 EXP 引发的升级列表。
 */
function grantAchievement(item, time) {
  item.unlocked = true;
  item.unlockedAt = time || Date.now();
  const r = item.rewards || {};
  state.player.coins += Number(r.coins) || 0;
  return addExp(Number(r.exp) || 0);
}

/**
 * 检查某类（achievement/title）全部条目，解锁满足条件的新条目。
 * 成就解锁时同时发放其奖励。
 * 返回 { items: 本次解锁条目, levelUps: 成就奖励引发的升级 }。
 */
function checkAllUnlockable(kind) {
  const list = kind === 'achievement' ? state.achievements : state.titles;
  const items = [];
  const levelUps = [];
  list.forEach(item => {
    if (item.unlocked) return;
    if (conditionProgress(item.condition).done) {
      items.push(item);
      if (kind === 'achievement') levelUps.push(...grantAchievement(item));
      else { item.unlocked = true; item.unlockedAt = Date.now(); }
    }
  });
  return { items, levelUps };
}

/* ---------- 商店 ---------- */

/** 购买商品：金币足够则扣款并保存消费记录；返回 { ok, reason } */
function buyItem(itemId) {
  const item = state.shopItems.find(x => x.id === itemId);
  if (!item) return { ok: false, reason: '商品不存在' };
  if (state.player.coins < item.price) return { ok: false, reason: '金币不足' };
  state.player.coins -= item.price;
  state.purchases.unshift({
    id: uid(),
    itemId: item.id,
    itemName: item.name, // 快照
    icon: item.icon,
    price: item.price,
    time: Date.now(),
  });
  saveState();
  return { ok: true };
}

/* ---------- 数据保护 ---------- */

/** 佩戴中的称号被删除后置空 */
function cleanTitleRef() {
  if (state.player.titleId && !state.titles.find(t => t.id === state.player.titleId)) {
    state.player.titleId = null;
  }
}

/* ============================================================
 * 每日任务引擎
 * ------------------------------------------------------------
 * state.daily = {
 *   'YYYY-MM-DD': {
 *     tasks: [{
 *       id, kind:'behavior'|'custom',
 *       behaviorId, name(快照), icon, target(目标量), unit,
 *       rewards:{exp,coins},   // 仅临时任务
 *       done, doneAt, recordId // 关联历史记录（库行为）
 *     }],
 *     chest: { opened, time, rewards }
 *   }
 * }
 * ============================================================ */

/**
 * 每日日期键：早上 6:00 分界。
 * 0:00~5:59 仍算前一天；6:00 之后算当天。
 */
function dailyKey(when) {
  const d = when ? new Date(when) : new Date();
  if (d.getHours() < (CONFIG.daily.resetHour || 6)) d.setDate(d.getDate() - 1);
  return dateKey(d);
}

/**
 * 相对今天偏移 N 个"每日日"的键（offset: 0=今天, 1=明天, -1=昨天）。
 * 以当天正午为锚点计算，避免在分界时刻附近算错。
 */
function dailyKeyOffset(offset) {
  const now = new Date();
  const anchor = now.getHours() < (CONFIG.daily.resetHour || 6)
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  anchor.setDate(anchor.getDate() + offset);
  return dateKey(anchor);
}

/** 取得某天的清单（没有则新建空结构） */
function ensureDaily(key) {
  if (!state.daily) state.daily = {};
  if (!state.daily[key]) {
    state.daily[key] = { tasks: [], chest: { opened: false, time: null, rewards: null } };
  }
  return state.daily[key];
}

/** 库行为的默认今日目标量 */
function defaultDailyTarget(b) {
  if (b.rewardType === 'fixed') return 1;
  if (b.rewardType === 'per_time') return b.perTimeMinutes || 30;
  return 1; // per_unit
}

/** 当天全部任务是否已完成（至少 1 项） */
function dailyAllDone(day) {
  return day && day.tasks.length > 0 && day.tasks.every(t => t.done);
}

/**
 * 从行为库添加任务到指定日期。
 * @returns 任务对象；重复添加返回 { duplicated:true }
 */
function addBehaviorDailyTask(key, behaviorId, target) {
  const b = state.behaviors.find(x => x.id === behaviorId);
  if (!b) return null;
  const day = ensureDaily(key);
  if (day.tasks.some(t => t.kind === 'behavior' && t.behaviorId === behaviorId)) {
    return { duplicated: true };
  }
  const t = {
    id: uid(),
    kind: 'behavior',
    behaviorId: b.id,
    name: b.name, // 快照：库中改名/删除后清单仍可读
    icon: b.icon,
    target: Number(target) > 0 ? Number(target) : defaultDailyTarget(b),
    unit: b.unit || '',
    rewards: null,
    done: false,
    doneAt: null,
    recordId: null,
  };
  day.tasks.push(t);
  saveState();
  return t;
}

/**
 * 添加临时小任务（拿快递等一次性小事）。
 * @param {{name,icon,exp,coins}} data 奖励自定义
 */
function addCustomDailyTask(key, data) {
  const day = ensureDaily(key);
  const t = {
    id: uid(),
    kind: 'custom',
    behaviorId: '',
    name: data.name,
    icon: data.icon || '📝',
    target: 1,
    unit: '',
    rewards: {
      exp: Math.max(0, Number(data.exp) || 0),
      coins: Math.max(0, Number(data.coins) || 0),
    },
    done: false,
    doneAt: null,
    recordId: null,
  };
  day.tasks.push(t);
  saveState();
  return t;
}

/** 删除某日的某条任务 */
function removeDailyTask(key, taskId) {
  const day = state.daily[key];
  if (!day) return;
  day.tasks = day.tasks.filter(t => t.id !== taskId);
  saveState();
}

/** 修改库行为任务的今日目标量（已完成不可改） */
function updateDailyTarget(key, taskId, target) {
  const day = state.daily[key];
  const t = day && day.tasks.find(x => x.id === taskId);
  if (!t || t.kind !== 'behavior' || t.done) return;
  if (Number(target) > 0) { t.target = Number(target); saveState(); }
}

/**
 * 完成一条每日任务。
 * - 库行为：按目标量走完整结算 completeBehavior（其内部钩子自动打勾）
 * - 临时任务：直接发放自定义 EXP/金币
 * 返回可供过场播放的结果；行为已被删除返回 { missing:true }
 */
function completeDailyTask(key, taskId) {
  const day = ensureDaily(key);
  const t = day.tasks.find(x => x.id === taskId);
  if (!t || t.done) return null;

  if (t.kind === 'behavior') {
    const b = state.behaviors.find(x => x.id === t.behaviorId);
    if (!b) return { missing: true };
    return completeBehavior(t.behaviorId, t.target);
  }
  // 临时任务
  const r = t.rewards || {};
  const gained = {
    exp: Math.max(0, Number(r.exp) || 0),
    coins: Math.max(0, Number(r.coins) || 0),
  };
  state.player.coins += gained.coins;
  const levelUps = addExp(gained.exp);
  t.done = true;
  t.doneAt = Date.now();
  saveState();
  return { custom: true, task: t, gained, levelUps };
}

/** 复制今天的清单到明天（跳过重复项；不复制完成状态） */
function copyDailyToTomorrow() {
  const today = state.daily[dailyKey()];
  const tKey = dailyKeyOffset(1);
  const tomorrow = ensureDaily(tKey);
  let n = 0;
  (today ? today.tasks : []).forEach(t => {
    const dup = t.kind === 'behavior'
      ? tomorrow.tasks.some(x => x.kind === 'behavior' && x.behaviorId === t.behaviorId)
      : tomorrow.tasks.some(x => x.kind === 'custom' && x.name === t.name);
    if (!dup) {
      tomorrow.tasks.push({
        ...t,
        id: uid(),
        rewards: t.rewards ? { ...t.rewards } : null,
        done: false, doneAt: null, recordId: null,
      });
      n += 1;
    }
  });
  saveState();
  return n;
}

/**
 * 开启当日全清宝箱：随机 EXP + 金币（区间在 config.daily.chest）。
 * 未全清 / 已开过 → null。
 */
function openDailyChest(key) {
  const day = ensureDaily(key);
  if (!dailyAllDone(day) || day.chest.opened) return null;
  const c = CONFIG.daily.chest;
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const gained = {
    exp: randInt(c.expMin, c.expMax),
    coins: randInt(c.coinsMin, c.coinsMax),
  };
  state.player.coins += gained.coins;
  const levelUps = addExp(gained.exp);
  day.chest = { opened: true, time: Date.now(), rewards: { ...gained } };
  saveState();
  return { gained, levelUps };
}

/* ---------- 联动钩子（completeBehavior / removeRecord 调用） ---------- */

/** 完成行为后：当天清单里同行为、数量达标且未打勾的任务 → 自动完成 */
function syncDailyAfterComplete(record) {
  const day = state.daily[dailyKey(record.time)];
  if (!day) return;
  day.tasks.forEach(t => {
    if (t.kind === 'behavior' && !t.done && t.behaviorId === record.behaviorId) {
      if ((Number(record.quantity) || 0) >= (Number(t.target) || 0)) {
        t.done = true;
        t.doneAt = record.time;
        t.recordId = record.id;
      }
    }
  });
}

/** 撤回历史记录后：关联任务取消打勾（宝箱已开则保持） */
function uncheckDailyTask(recordId) {
  Object.values(state.daily || {}).forEach(day => {
    day.tasks.forEach(t => {
      if (t.recordId === recordId) {
        t.done = false;
        t.doneAt = null;
        t.recordId = null;
      }
    });
  });
}
