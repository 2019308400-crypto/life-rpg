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
    '📖','🏃','🌙','💪','🧠','🎯','💧','🥗','🍳','🥦','⚽','🏀',
    '🏊','🚴','🚶','🏋️','🤸','🧗','⛳','🏓','🏸','🎱','✍️','💻',
    '🎨','🎸','🎹','🎤','📷','🧘','🛏️','🧹','📝','🗣️','🌱','🌸',
    '☀️','🛁','🦷','🧴','🌍','✈️','🚆','🀄','🧋','🎬','🎮','🍩',
    '🍰','☕','🍷','🍔','🍕','🍣','🍦','🛍️','🎁','🛒','💰','💎',
    '⭐','🏆','👑','🔥','🎖️','🏅','🥇','🧭','🗝️','🛡️','🐉','🌿',
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
        description: '翻开一本书，和作者来一场跨越时空的对话',
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
        description: '系好鞋带，让风成为你的配速员',
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
        description: '放下手机，把今天的故事交给梦境续写',
        unit: '次',
        rewardType: 'fixed',
        perTimeMinutes: 30,
        rewards: { exp: 30, coins: 10, health: 1, intelligence: 0, fitness: 0, discipline: 2 },
      },
    ],

    shopItems: [
      { id: 'sh_song',    name: '听一首歌',     icon: '🎧', description: '给耳朵发一颗糖，三分钟的 mini 假期', price: 10 },
      { id: 'sh_milktea', name: '喝杯奶茶',     icon: '🧋', description: '一杯下肚，烦恼被珍珠嚼碎',           price: 50 },
      { id: 'sh_game',    name: '游戏时间',     icon: '🎮', description: '按下开始键，把压力交给通关',           price: 80 },
      { id: 'sh_movie',   name: '看一场电影',   icon: '🎬', description: '两小时的逃离现实体验券',               price: 100 },
      { id: 'sh_meal',    name: '吃顿好的',     icon: '🍽️', description: '认真对待一顿饭，就是认真对待自己',     price: 200 },
      { id: 'sh_gift',    name: '给自己买礼物', icon: '🎁', description: '奖励过去一段时间里那个努力的自己',     price: 300 },
    ],

    achievements: [
      {
        id: 'ach_first',
        name: '初来乍到',
        icon: '🌟',
        description: '旅程的起点，总是从第一步开始',
        condition: { type: 'total_completions', behaviorId: '', attribute: '', value: 1 },
        rewards: { exp: 100, coins: 20 },
      },
      {
        id: 'ach_read10',
        name: '读书入门',
        icon: '📚',
        description: '十次翻开书本，世界比昨天大了一点点',
        condition: { type: 'total_count', behaviorId: 'bh_read', attribute: '', value: 10 },
        rewards: { exp: 200, coins: 50 },
      },
      {
        id: 'ach_streak3',
        name: '三日之约',
        icon: '🔥',
        description: '连续三天，你已经和惰性交过手并赢了',
        condition: { type: 'streak', behaviorId: 'bh_run', attribute: '', value: 3 },
        rewards: { exp: 300, coins: 80 },
      },
      {
        id: 'ach_bookworm',
        name: '书虫',
        icon: '🐛',
        description: '书架在变厚，大脑也在变厚',
        condition: { type: 'total_count', behaviorId: 'bh_read', attribute: '', value: 30 },
        rewards: { exp: 500, coins: 100 },
      },
      {
        id: 'ach_runner',
        name: '跑者',
        icon: '👟',
        description: '你的鞋底记得每一段路',
        condition: { type: 'total_count', behaviorId: 'bh_run', attribute: '', value: 20 },
        rewards: { exp: 500, coins: 100 },
      },
      {
        id: 'ach_nightowl',
        name: '夜猫克星',
        icon: '🦉',
        description: '和月亮说晚安，和太阳说早安',
        condition: { type: 'total_count', behaviorId: 'bh_sleep', attribute: '', value: 14 },
        rewards: { exp: 400, coins: 120 },
      },
      {
        id: 'ach_century',
        name: '百分百',
        icon: '💯',
        description: '坚持，是这世界上最被低估的超能力',
        condition: { type: 'total_completions', behaviorId: '', attribute: '', value: 100 },
        rewards: { exp: 1000, coins: 300 },
      },
      {
        id: 'ach_lv10',
        name: '升级达人',
        icon: '📈',
        description: '你的经验条，比工资条长得快',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 10 },
        rewards: { exp: 800, coins: 200 },
      },
      {
        id: 'ach_health30',
        name: '钢铁之躯',
        icon: '🛡️',
        description: '身体是革命的本钱，你存了不少',
        condition: { type: 'attribute', behaviorId: '', attribute: 'health', value: 30 },
        rewards: { exp: 600, coins: 150 },
      },
      {
        id: 'ach_int30',
        name: '智者',
        icon: '🦉',
        description: '知识不会背叛努力的人',
        condition: { type: 'attribute', behaviorId: '', attribute: 'intelligence', value: 30 },
        rewards: { exp: 600, coins: 150 },
      },
      {
        id: 'ach_disc30',
        name: '自律即自由',
        icon: '⛓️',
        description: '你正在一寸一寸地解锁自由',
        condition: { type: 'attribute', behaviorId: '', attribute: 'discipline', value: 30 },
        rewards: { exp: 600, coins: 150 },
      },
      {
        id: 'ach_fit30',
        name: '体能觉醒',
        icon: '⚡',
        description: '每一滴汗都不会骗你',
        condition: { type: 'attribute', behaviorId: '', attribute: 'fitness', value: 30 },
        rewards: { exp: 600, coins: 150 },
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
        id: 'ti_warmup',
        name: '渐入佳境',
        icon: '🌱',
        description: '等级达到 Lv.5，你开始摸到节奏了',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 5 },
      },
      {
        id: 'ti_veteran',
        name: '小有所成',
        icon: '⚔️',
        description: '等级达到 Lv.10，不再是新手，是个有故事的人',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 10 },
      },
      {
        id: 'ti_explorer',
        name: '老练冒险家',
        icon: '🛡️',
        description: '等级达到 Lv.20，你的等级条会发光',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 20 },
      },
      {
        id: 'ti_legend',
        name: '传奇玩家',
        icon: '👑',
        description: '等级达到 Lv.50，半百之路，每一步都算数',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 50 },
      },
      {
        id: 'ti_myth',
        name: '满级传说',
        icon: '🐉',
        description: '等级达到 Lv.100，百级之路，你已经走完了',
        condition: { type: 'level', behaviorId: '', attribute: '', value: 100 },
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
