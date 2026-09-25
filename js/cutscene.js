/* ============================================================
 * LIFE RPG - 智能过场动画引擎
 * ----------------------------------------------------------------
 * 行为完成 / 商品购买 / 成就解锁 / 称号获得 / 升级
 * 全部以「小窗卡片」形式播放（非全屏），点击卡片可跳过。
 *
 * 智能原理：
 *   按 名称关键词 → 图标 → 通用兜底 的顺序匹配场景。
 *   用户新建的行为/商品只要名字里带常见关键词（如"阅读""跑步"）
 *   就会自动配上对应动画，完全不需要手动设置。
 *
 * 对外 API（全部只是「入队」，最后 play() 开始依次播放）：
 *   Cutscene.behavior(name, icon, gained)
 *   Cutscene.purchase(name, icon, price)
 *   Cutscene.achievement({name, icon, rewards})
 *   Cutscene.title({name, icon})
 *   Cutscene.levelUp(from, to)
 *   Cutscene.play()
 * ============================================================ */

const Cutscene = (() => {

  /* ================= 场景 HTML 组装小工具 ================= */

  /**
   * 通用舞台：影子 + 大主角(emoji + 动画) + 环绕漂浮小 emoji
   * @param {string} heroIcon 主角 emoji
   * @param {string} anim     主角动画 class（见 CSS：cs-anim-*）
   * @param {string[]} floats 漂浮小 emoji（最多 4 个）
   * @param {string} extra    额外自定义 HTML（速度线/光环等）
   * @param {string} heroCls  附加给 .cs-hero 的 class（如 cs-hero-sm）
   */
  function stage(heroIcon, anim, floats = [], extra = '', heroCls = '') {
    return `
      <div class="cs-shadow"></div>
      <div class="cs-hero ${heroCls}"><span class="cs-i ${anim}">${UI.esc(heroIcon)}</span></div>
      ${extra}
      ${floats.map((e, i) => `<span class="cs-float cs-f${i + 1}">${UI.esc(e)}</span>`).join('')}`;
  }

  /** 奔跑 / 骑行用的风线 */
  const SPEED_LINES = `<div class="cs-lines"><i></i><i></i><i></i></div>`;

  /* ================= 场景库 =================
   * 每个场景：{ keywords:[名称关键词], icons:[图标兜底], build(name, icon) }
   * 关键词命中时取「最长关键词」对应的场景（"打篮球"不会被"球"抢走）。
   */
  const SCENES = {

    /* ---------- 克制 / 自律类（不喝奶茶、戒零食…） ---------- */
    resist: {
      keywords: ['忍住', '戒掉'],
      icons: ['🛡️', '⛓️'],
      build: () => stage('🛡️', 'cs-anim-pulse', ['🎯', '✨'],
        `<span class="cs-ring"></span>`),
    },

    /* ---------- 学习 / 读书 ---------- */
    read: {
      keywords: ['阅读', '看书', '读书', '朗读', '晨读', '翻书', '绘本', '背诵', '读书会'],
      icons: ['📖', '📚'],
      build: () => `
        <div class="cs-shadow"></div>
        <div class="cs-hero cs-hero-sm"><span class="cs-i cs-anim-sway">🧒</span></div>
        <div class="cs-book"><span class="cs-i cs-anim-flip">📖</span></div>
        <span class="cs-float cs-f1">✨</span>
        <span class="cs-float cs-f2">🔤</span>
        <span class="cs-float cs-f3">💡</span>`,
    },

    study: {
      keywords: ['学习', '复习', '预习', '刷题', '网课', '考试', '测验', '背单词', '单词',
        '英语', '日语', '韩语', '雅思', '考研', '功课', '作业', '听课', '课程', '公考', '教资'],
      icons: ['🎓', '🧑‍🎓'],
      build: () => stage('🧑‍🎓', 'cs-anim-bob', ['💡', '✨', '✅']),
    },

    write: {
      keywords: ['写作', '写日记', '日记', '周记', '复盘', '笔记', '练字', '书法', '签名', '写稿', '写文章'],
      icons: ['✍️', '📝'],
      build: () => stage('✍️', 'cs-anim-write', ['📄', '✨', '💡']),
    },

    code: {
      keywords: ['编程', '代码', '程序', 'debug', '码农', '写软件', '计算机'],
      icons: ['💻', '⌨️', '🖥️'],
      build: () => stage('💻', 'cs-anim-tap', ['</>', '⚡', '✨'],
        `<span class="cs-codebubble">&lt;/&gt;</span>`),
    },

    science: {
      keywords: ['实验', '化学', '物理', '科研', '显微镜', '解剖'],
      icons: ['🔬', '🧪', '🔭'],
      build: () => stage('🔬', 'cs-anim-bob', ['🧪', '✨', '💡']),
    },

    math: {
      keywords: ['数学', '算数', '奥数'],
      icons: ['🧮', '🔢'],
      build: () => stage('🧮', 'cs-anim-tap', ['🔢', '✨', '💡']),
    },

    /* ---------- 运动 ---------- */
    run: {
      keywords: ['跑步', '晨跑', '夜跑', '慢跑', '马拉松', '冲圈', '跑圈'],
      icons: ['🏃'],
      build: () => stage('🏃', 'cs-anim-run', ['💨'], SPEED_LINES),
    },

    walk: {
      keywords: ['散步', '走路', '步行', '溜达', '健走'],
      icons: ['🚶'],
      build: () => stage('🚶', 'cs-anim-bob', ['🍃', '☁️']),
    },

    bike: {
      keywords: ['骑行', '自行车', '骑车', '单车', '动感单车'],
      icons: ['🚴'],
      build: () => stage('🚴', 'cs-anim-run', ['💨'], SPEED_LINES),
    },

    swim: {
      keywords: ['游泳'],
      icons: ['🏊'],
      build: () => stage('🏊', 'cs-anim-swim', ['🫧', '💧'],
        `<span class="cs-water"></span>`),
    },

    fitness: {
      keywords: ['健身', '锻炼', '举铁', '力量', '哑铃', '肌肉', '俯卧撑', '深蹲', '腹肌', '撸铁'],
      icons: ['🏋️', '💪'],
      build: () => stage('🏋️', 'cs-anim-lift', ['🔥', '💪']),
    },

    ball: {
      keywords: ['篮球', '足球', '羽毛球', '乒乓', '网球', '排球', '台球', '高尔夫', '棒球', '橄榄球', '打球'],
      icons: ['⚽', '🏀', '🏐', '🎾', '🏓', '🏸', '⛳', '🎱'],
      build: (name, icon) => stage(BALL_ICONS.has(icon) ? icon : '⚽', 'cs-anim-jump', ['🔥', '✨']),
    },

    rope: {
      keywords: ['跳绳'],
      icons: ['🪢'],
      build: () => stage('🤸', 'cs-anim-jump', ['😤'],
        `<span class="cs-rope"></span>`),
    },

    climb: {
      keywords: ['爬山', '攀岩', '登山', '登高'],
      icons: ['🧗', '⛰️', '🏔️'],
      build: () => stage('🧗', 'cs-anim-climb', ['💦', '✨']),
    },

    yoga: {
      keywords: ['瑜伽', '冥想', '打坐', '正念', '拉伸', '普拉提'],
      icons: ['🧘', '🧎'],
      build: () => stage('🧘', 'cs-anim-breathe', ['☮️', '✨'],
        `<span class="cs-ring cs-ring-soft"></span>`),
    },

    /* ---------- 作息 ---------- */
    sleep: {
      keywords: ['早睡', '睡觉', '睡眠', '入睡', '入眠', '睡好', '补觉'],
      icons: ['🌙', '😴'],
      build: () => stage('🌙', 'cs-anim-popbob', ['💤', '⭐', '💫']),
    },

    wake: {
      keywords: ['早起', '起床', '晨起'],
      icons: ['🌅', '☀️'],
      build: () => stage('☀️', 'cs-anim-popbob', ['🐦', '✨', '☁️'],
        `<span class="cs-sunrays"></span>`),
    },

    /* ---------- 吃喝 ---------- */
    drink: {
      keywords: ['喝水', '饮水'],
      icons: ['💧', '🥤'],
      build: (name, icon) => stage(icon === '🥤' ? '🥤' : '💧', 'cs-anim-tilt', ['💧', '✨']),
    },

    cook: {
      keywords: ['做饭', '做菜', '烹饪', '烘焙', '下厨', '做早餐'],
      icons: ['🍳', '🥘'],
      build: () => stage('🍳', 'cs-anim-bob', ['♨️', '🥗', '✨']),
    },

    eat: {
      keywords: ['吃', '早餐', '午餐', '晚餐', '宵夜', '夜宵', '零食', '奶茶', '可乐', '咖啡',
        '蛋糕', '甜品', '冰淇淋', '巧克力', '烧烤', '火锅', '外卖', '寿司', '披萨', '汉堡',
        '炸鸡', '自助餐', '麻辣烫', '干饭', '小吃', '烤肉'],
      icons: ['🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥘', '🍲', '🍜', '🍝',
        '🍣', '🍱', '🍙', '🍘', '🍥', '🥟', '🍤', '🍦', '🍰', '🎂', '🧁', '🍫',
        '🍬', '🍭', '🍪', '🍩', '🥐', '🧋', '☕', '🧉', '🍎', '🍊', '🍌', '🥗'],
      build: (name, icon) => stage(icon && icon !== '⚡' ? icon : '🍔', 'cs-anim-chomp', ['😋', '✨']),
    },

    relax: {
      keywords: ['按摩', '足浴', '汗蒸', '足疗', 'spa', '泡脚'],
      icons: ['💆', '🦶'],
      build: () => stage('💆', 'cs-anim-bob', ['😌', '✨', '♨️']),
    },

    /* ---------- 生活起居 ---------- */
    clean: {
      keywords: ['打扫', '整理', '卫生', '扫地', '拖地', '洗碗', '洗衣', '收拾', '清理', '除尘', '倒垃圾', '叠被'],
      icons: ['🧹', '🧺', '🗑️'],
      build: () => stage('🧹', 'cs-anim-sweep', ['✨', '🫧']),
    },

    shower: {
      keywords: ['洗澡', '淋浴', '泡澡', '沐浴', '护肤', '面膜', '刷牙', '洗脸', '洗头', '洗漱'],
      icons: ['🛁', '🚿', '🪥', '🧼', '🦷'],
      build: () => stage('🛁', 'cs-anim-bob', ['🫧', '✨', '🧴']),
    },

    /* ---------- 兴趣 ---------- */
    music: {
      keywords: ['吉他', '钢琴', '乐器', '练琴', '弹琴', '唱歌', '练歌', '音乐', '听歌',
        '播客', '相声', '节奏', '尤克里里', '笛子', '架子鼓', '说唱', '歌曲'],
      icons: ['🎸', '🎹', '🎧', '🎤', '🎵', '🥁', '🎺', '🎺', '🎻'],
      build: (name, icon) => stage(MUSIC_ICONS.has(icon) ? icon : '🎧', 'cs-anim-bob', ['🎵', '🎶', '✨']),
    },

    art: {
      keywords: ['画画', '绘画', '美术', '涂色', '设计', '插画', '手工'],
      icons: ['🎨', '🖌️', '🖍️'],
      build: () => stage('🎨', 'cs-anim-sway', ['🌈', '✨', '🖌️']),
    },

    photo: {
      keywords: ['摄影', '拍照', '照片', '修图', '剪辑', 'vlog'],
      icons: ['📷', '📸', '🎥', '📹'],
      build: () => stage('📸', 'cs-anim-bob', ['✨', '🖼️'],
        `<span class="cs-flash"></span>`),
    },

    game: {
      keywords: ['游戏', '开黑', 'steam', '电竞', '排位', '王者', '原神', '主机'],
      icons: ['🎮', '🕹️'],
      build: () => stage('🎮', 'cs-anim-tap', ['🎲', '⭐', '✨']),
    },

    movie: {
      keywords: ['电影', '看剧', '追剧', '综艺', '动漫', '纪录片', '番剧'],
      icons: ['🎬', '🎞️', '📺'],
      build: () => stage('🎬', 'cs-anim-bob', ['🍿', '⭐', '✨']),
    },

    /* ---------- 社交 / 财 ---------- */
    talk: {
      keywords: ['聊天', '打电话', '电话', '问候', '家人', '倾诉', '语音'],
      icons: ['💬', '📞', '🗣️'],
      build: () => stage('💬', 'cs-anim-pulse', ['💕', '✨']),
    },

    money: {
      keywords: ['存钱', '记账', '理财', '投资', '基金', '攒钱', '省钱'],
      icons: ['💰', '🪙', '💴'],
      build: () => stage('💰', 'cs-anim-bob', ['🪙', '🪙', '✨']),
    },

    /* ---------- 动植物 ---------- */
    plant: {
      keywords: ['植物', '种花', '养花', '绿植', '多肉', '浇花'],
      icons: ['🌱', '🌷', '🌻', '🪴', '🌿'],
      build: (name, icon) => stage(PLANT_ICONS.has(icon) ? icon : '🌱', 'cs-anim-grow', ['🦋', '✨', '💧']),
    },

    pet: {
      keywords: ['遛狗', '撸猫', '宠物', '铲屎', '喂猫', '喂狗'],
      icons: ['🐶', '🐱', '🐕', '🐈', '🦴'],
      build: (name, icon) => stage(PET_ICONS.has(icon) ? icon : '🐶', 'cs-anim-hop', ['💖', '✨']),
    },

    /* ---------- 出行 / 购物 ---------- */
    travel: {
      keywords: ['旅游', '旅行', '露营', '野餐', '游乐园', '动物园', '博物馆', '展览', '度假', '海边', '出去玩'],
      icons: ['✈️', '🏕️', '🏖️', '🎡', '🎪', '🚆'],
      build: (name, icon) => stage(TRAVEL_ICONS.has(icon) ? icon : '✈️', 'cs-anim-bob', ['🗺️', '☁️', '✨']),
    },

    shopping: {
      keywords: ['买衣服', '购物', '网购', '快递', '文具', '包包', '化妆品'],
      icons: ['🛍️', '📦', '🛒'],
      build: () => stage('🛍️', 'cs-anim-bob', ['✨', '💫']),
    },

    gift: {
      keywords: ['礼物', '盲盒', '手办', '周边', '玩具', '礼品'],
      icons: ['🎁', '🎀'],
      build: () => stage('🎁', 'cs-anim-burst-bob', ['✨', '🎉', '💫']),
    },

    /* ---------- 兜底：自带 emoji 当主角，星光环绕 ---------- */
    generic: {
      keywords: [],
      icons: [],
      build: (name, icon) => stage(icon && icon !== '⚡' ? icon : '🌟', 'cs-anim-popbob', ['✨', '💫', '⭐']),
    },
  };

  /* 图标分组集合（build 里判断"用户图标是否属于这一类"用） */
  const BALL_ICONS = new Set(SCENES.ball.icons);
  const MUSIC_ICONS = new Set(['🎸', '🎹', '🎧', '🎤', '🎵', '🥁', '🎺', '🎻']);
  const PLANT_ICONS = new Set(SCENES.plant.icons);
  const PET_ICONS = new Set(SCENES.pet.icons);
  const TRAVEL_ICONS = new Set(SCENES.travel.icons);

  /* ================= 智能匹配 ================= */

  /**
   * 根据名称 + 图标找到最合适的场景
   * 顺序：克制前缀 → 最长关键词 → 图标 → 通用兜底
   */
  function resolveScene(name, icon) {
    const n = String(name || '');

    // 1. 克制类：名字以"不 / 别 / 戒 / 忍住 / 拒绝 / 克制"开头，如"不喝奶茶""戒零食"
    if (/^(不|别|戒|忍住|拒绝|克制)/.test(n)) return SCENES.resist;

    // 2. 关键词：所有场景所有关键词里，命中的最长者获胜
    let best = null;
    let bestLen = 0;
    for (const key in SCENES) {
      const sc = SCENES[key];
      for (const kw of sc.keywords || []) {
        if (kw.length > bestLen && n.includes(kw)) {
          best = sc;
          bestLen = kw.length;
        }
      }
    }
    if (best) return best;

    // 3. 图标直接匹配
    for (const key in SCENES) {
      if ((SCENES[key].icons || []).indexOf(icon) !== -1) return SCENES[key];
    }

    // 4. 兜底
    return SCENES.generic;
  }

  /** 行为 / 商品共用：取场景 HTML */
  function stageFor(name, icon) {
    return resolveScene(name, icon).build(name, icon);
  }

  /* ---------- 系统事件专用舞台（成就 / 称号 / 升级） ---------- */

  /** 成就：自身图标当主角 + 右上角小奖杯；称号：小皇冠 */
  function awardStage(icon, badge, floats) {
    return `
      <div class="cs-shadow"></div>
      <div class="cs-hero"><span class="cs-i cs-anim-burst-bob">${UI.esc(icon || '⭐')}</span></div>
      <span class="cs-badge-mini">${badge}</span>
      ${floats.map((e, i) => `<span class="cs-float cs-f${i + 1}">${UI.esc(e)}</span>`).join('')}`;
  }

  /** 升级：旋转光芒 + 星星爆发 */
  function levelStage() {
    return `
      <span class="cs-rays2"></span>
      <div class="cs-shadow"></div>
      <div class="cs-hero"><span class="cs-i cs-anim-burst-bob">⭐</span></div>
      <span class="cs-float cs-f1">✨</span>
      <span class="cs-float cs-f2">💫</span>
      <span class="cs-float cs-f3">✨</span>`;
  }

  /* ================= 奖励文字 ================= */

  /** 行为奖励行：+EXP / +金币 / +属性 */
  function gainMeta(gained) {
    const g = gained || {};
    const parts = [];
    if (g.exp) parts.push(`<b class="cs-m-exp">+${fmtNum(g.exp)} EXP</b>`);
    if (g.coins) parts.push(`<b class="cs-m-coin">+${fmtNum(g.coins)} 🪙</b>`);
    CONFIG.attributes.forEach(a => {
      const v = g[a.key];
      if (v) parts.push(`<i style="color:${a.color}">+${fmtNum(v)} ${a.icon}</i>`);
    });
    return parts.join(' ') || '完成！';
  }

  /** 成就奖励行 */
  function rewardLine(rewards) {
    const r = rewards || {};
    const parts = [];
    if (r.exp) parts.push(`<b class="cs-m-exp">🎁 +${fmtNum(r.exp)} EXP</b>`);
    if (r.coins) parts.push(`<b class="cs-m-coin">+${fmtNum(r.coins)} 🪙</b>`);
    return parts.join(' ') || '✦ 荣耀记录 ✦';
  }

  /* ================= 队列播放器 ================= */

  let queue = [];        // 待播放事件
  let playing = false;   // 是否正在播放
  let rootEl = null;     // 当前卡片根节点
  let timer = 0;         // 自动消失计时器
  let ending = false;    // 当前卡片是否已在离场

  function enqueue(ev) {
    if (queue.length < 40) queue.push(ev); // 防御性上限
  }

  /** 入队完毕后调用，开始依次播放 */
  function play() {
    if (playing) return;
    playing = true;
    setTimeout(next, 80);
  }

  function next() {
    cleanup();
    if (!queue.length) { playing = false; return; }
    show(queue.shift());
  }

  function show(ev) {
    const mount = document.getElementById('overlay-root');
    if (!mount) { playing = false; return; }

    rootEl = document.createElement('div');
    rootEl.className = 'cs-root';
    rootEl.innerHTML = `
      <div class="cs-mask"></div>
      <div class="cs-card cs-kind-${ev.kind}">
        <div class="cs-tag">${ev.tag}</div>
        <div class="cs-stage">${ev.stage}</div>
        <div class="cs-name">${UI.esc(ev.name)}</div>
        <div class="cs-meta">${ev.meta}</div>
        <div class="cs-skip-hint">点击跳过 ▸</div>
      </div>`;
    mount.appendChild(rootEl);
    requestAnimationFrame(() => rootEl.classList.add('cs-show'));

    ending = false;
    timer = setTimeout(finish, ev.dur);
    // 点击卡片任意位置 → 立即播下一个
    rootEl.addEventListener('click', finish);
  }

  function finish() {
    if (ending || !rootEl) return;
    ending = true;
    clearTimeout(timer);
    rootEl.classList.remove('cs-show');
    rootEl.classList.add('cs-out');
    setTimeout(next, 230);
  }

  function cleanup() {
    if (rootEl) { rootEl.remove(); rootEl = null; }
  }

  /* ================= 对外 API ================= */

  return {
    /** 行为完成 */
    behavior(name, icon, gained) {
      enqueue({
        kind: 'behavior',
        tag: '⚔️ 行为完成',
        name,
        stage: stageFor(name, icon),
        meta: gainMeta(gained),
        dur: 2100,
      });
    },

    /** 商品购买 */
    purchase(name, icon, price) {
      enqueue({
        kind: 'purchase',
        tag: '🛒 购买成功 · 好好享受',
        name,
        stage: stageFor(name, icon),
        meta: `<b class="cs-m-coin">−${fmtNum(price)} 🪙</b>`,
        dur: 2100,
      });
    },

    /** 成就解锁 */
    achievement(a) {
      enqueue({
        kind: 'achievement',
        tag: '🏆 成就解锁',
        name: a.name,
        stage: awardStage(a.icon, '🏆', ['✨', '🎉', '💫']),
        meta: rewardLine(a.rewards),
        dur: 2200,
      });
    },

    /** 称号获得 */
    title(t) {
      enqueue({
        kind: 'title',
        tag: '👑 称号获得',
        name: t.name,
        stage: awardStage(t.icon, '👑', ['✨', '🎀', '💫']),
        meta: '✦ 荣耀加身 ✦',
        dur: 2200,
      });
    },

    /** 升级 */
    levelUp(from, to) {
      enqueue({
        kind: 'levelup',
        tag: '✦ LEVEL UP',
        name: `Lv.${from} → Lv.${to}`,
        stage: levelStage(),
        meta: '你又变强了一点',
        dur: 1900,
      });
    },

    play,

    /** 清空未播放队列（一般不用） */
    clear() { queue = []; },
  };
})();
