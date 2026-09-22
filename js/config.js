/* ============================================================
 * LIFE RPG - 全局配置
 * 所有"可以修改"的东西都集中在这里。
 * 页面代码不会写死任何奖励数字，全部读取这里或用户自建数据。
 * ============================================================ */

const CONFIG = {
  // localStorage 存储键
  storageKey: 'life_rpg_save_v1',

  /* ---------- 等级公式（集中管理，可自行调整成长速度） ----------
   * 每级所需 EXP = round(base * growth ^ (level - 1))
   * Lv.1→2 = 1000；Lv.2→3 = 1150；Lv.3→4 = 1323 ...
   * 想改快慢：调 base（基础值）或 growth（每级倍率 1 = 不增长）
   */
  level: {
    base: 1000,
    growth: 1.15,
    maxLevel: 999,
  },

  /* ---------- 四大属性（顺序即展示顺序） ----------
   * milestone 仅为进度条展示用的参考值，可随意修改
   */
  attributes: [
    { key: 'health',        name: 'Health',        zh: '体质', icon: '❤️', color: '#ff5c7a', milestone: 100 },
    { key: 'intelligence',  name: 'Intelligence',  zh: '智力', icon: '🧠', color: '#5cc8ff', milestone: 100 },
    { key: 'fitness',       name: 'Fitness',       zh: '体能', icon: '💪', color: '#ffc24b', milestone: 100 },
    { key: 'discipline',    name: 'Discipline',    zh: '自律', icon: '🎯', color: '#b07cff', milestone: 100 },
  ],

  /* ---------- 奖励方式 ---------- */
  rewardTypes: {
    fixed:    { name: '固定奖励', desc: '每完成一次，获得固定奖励' },
    per_unit: { name: '按数量',   desc: '按填写的数量计算，例如每 1 公里' },
    per_time: { name: '按时间',   desc: '按记录的分钟数计算，例如每 30 分钟' },
  },

  /* ---------- 成就 / 称号 可用的条件类型 ---------- */
  conditionTypes: {
    first_complete:    { name: '第一次完成',   needs: ['behaviorId'],        desc: '第一次完成某个行为' },
    total_count:       { name: '累计次数',     needs: ['behaviorId', 'value'], desc: '某行为累计完成 N 次' },
    total_quantity:    { name: '累计数量',     needs: ['behaviorId', 'value'], desc: '某行为累计完成 N 个单位' },
    total_completions: { name: '累计完成所有行为', needs: ['value'],          desc: '所有行为累计完成 N 次' },
    level:             { name: '达到等级',     needs: ['value'],             desc: '玩家等级达到 Lv.N' },
    attribute:         { name: '属性达到',     needs: ['attribute', 'value'], desc: '某项属性 ≥ N' },
    streak:            { name: '连续天数',     needs: ['behaviorId', 'value'], desc: '连续 N 天完成某行为' },
  },

  /* ---------- 创建行为/商品时的快捷图标 ---------- */
  iconPresets: [
    '📖','🏃','🌙','💪','🧠','🎯','💧','🥗','⚽','🏀','🏊','🚴',
    '✍️','💻','🎨','🎸','🎹','🧘','🛏️','🧹','📝','🗣️','🌍','🀄',
    '🧋','🎬','🎮','🍰','☕','🎁','🛒','💰','⭐','🏆','👑','🔥',
  ],

  /* ---------- 首次打开时的示例内容（全部可编辑/删除/重建，只是模板） ---------- */
  seed: {
    categories: [
      { id: 'cat_study',   name: '学习', icon: '📚' },
      { id: 'cat_sport',   name: '运动', icon: '🏃' },
      { id: 'cat_life',    name: '生活', icon: '🌙' },
      { id: 'cat_work',    name: '工作', icon: '💼' },
      { id: 'cat_hobby',   name: '兴趣', icon: '🎨' },
      { id: 'cat_other',   name: '其他', icon: '📦' },
    ],

    behaviors: [
      {
        id: 'bh_read',
        name: '阅读',
        categoryId: 'cat_study',
        icon: '📖',
        description: '读书 / 学习资料',
        unit: '分钟',
        rewardType: 'per_time',
        perTimeMinutes: 30,
        rewards: { exp: 20, coins: 5, health: 0, intelligence: 1, fitness: 0, discipline: 0 },
      },
      {
        id: 'bh_run',
        name: '跑步',
        categoryId: 'cat_sport',
        icon: '🏃',
        description: '户外跑 / 跑步机',
        unit: '公里',
        rewardType: 'per_unit',
        perTimeMinutes: 30,
        rewards: { exp: 20, coins: 5, health: 0, intelligence: 0, fitness: 1, discipline: 0 },
      },
      {
        id: 'bh_sleep',
        name: '早睡',
        categoryId: 'cat_life',
        icon: '🌙',
        description: '23:30 前睡觉',
        unit: '次',
        rewardType: 'fixed',
        perTimeMinutes: 30,
        rewards: { exp: 30, coins: 10, health: 1, intelligence: 0, fitness: 0, discipline: 2 },
      },
    ],

    shopItems: [
      { id: 'sh_milktea', name: '喝奶茶', icon: '🧋', description: '一杯快乐水', price: 50 },
      { id: 'sh_movie',   name: '看一场电影', icon: '🎬', description: '去电影院看一部想看的电影', price: 100 },
    ],

    achievements: [
      {
        id: 'ach_first',
        name: '初来乍到',
        icon: '🌟',
        description: '第一次完成任意行为',
        condition: { type: 'total_completions', behaviorId: '', attribute: '', value: 1 },
      },
      {
        id: 'ach_read10',
        name: '读书入门',
        icon: '📚',
        description: '累计完成「阅读」10 次',
        condition: { type: 'total_count', behaviorId: 'bh_read', attribute: '', value: 10 },
      },
      {
        id: 'ach_streak3',
        name: '三日之约',
        icon: '🔥',
        description: '连续 3 天完成「跑步」',
        condition: { type: 'streak', behaviorId: 'bh_run', attribute: '', value: 3 },
      },
    ],

    titles: [
      {
        id: 'ti_newbie',
        name: '初出茅庐',
        icon: '🐣',
        description: '等级达到 Lv.3',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 3 },
      },
      {
        id: 'ti_learner',
        name: '终身学习者',
        icon: '🧠',
        description: 'Intelligence ≥ 50',
        condition: { type: 'attribute', behaviorId: '', attribute: 'intelligence', value: 50 },
      },
    ],
  },
};
