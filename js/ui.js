/* ============================================================
 * LIFE RPG - 通用 UI 组件
 * 弹窗 / Toast / 确认框 / 升级特效 / 图标选择器 / 反馈动画
 * ============================================================ */

const UI = (() => {

  /* ---------- 工具 ---------- */

  /** HTML 转义（用户输入内容必须经过这里再插入 HTML） */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* ---------- Toast ---------- */

  function toast(html, type = 'info', duration = 2600) {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = html;
    root.appendChild(el);
    // 触发入场动画
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /** 完成行为的奖励反馈：+30 EXP / +5 🪙 / +1 🧠 */
  function rewardToast(gained) {
    const parts = [];
    if (gained.exp) parts.push(`<span class="rw rw-exp">+${fmtNum(gained.exp)} EXP</span>`);
    if (gained.coins) parts.push(`<span class="rw rw-coin">+${fmtNum(gained.coins)} 🪙</span>`);
    CONFIG.attributes.forEach(a => {
      const v = gained[a.key];
      if (v) parts.push(`<span class="rw rw-attr" style="--rw-color:${a.color}">+${fmtNum(v)} ${a.icon}</span>`);
    });
    if (!parts.length) parts.push('<span class="rw">完成！</span>');
    toast(parts.join(''), 'reward', 3000);
  }

  /* ---------- 确认框（Promise 风格） ---------- */

  function confirmDialog(message, { danger = true, okText = '删除' } = {}) {
    return new Promise(resolve => {
      openModal({
        title: danger ? '⚠️ 确认操作' : '确认操作',
        content: `<p class="confirm-msg">${message}</p>`,
        actions: [
          { label: '取消', class: 'btn-ghost', onClick: () => { closeModal(); resolve(false); } },
          { label: okText, class: danger ? 'btn-danger' : 'btn-primary', onClick: () => { closeModal(); resolve(true); } },
        ],
      });
    });
  }

  /* ---------- 弹窗 ---------- */

  /**
   * openModal({ title, content(html), actions:[{label,class,onClick(modalEl)}], wide })
   * 内容渲染后可对 modalEl 绑定事件。
   */
  function openModal({ title, content = '', actions = [], wide = false, onClose }) {
    const root = $('#modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-mask" id="modal-mask">
        <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog">
          <div class="modal-head">
            <span class="modal-title">${title}</span>
            <button class="modal-close" id="modal-close-btn">✕</button>
          </div>
          <div class="modal-body" id="modal-body">${content}</div>
          ${actions.length ? `<div class="modal-foot" id="modal-foot"></div>` : ''}
        </div>
      </div>`;
    const mask = $('#modal-mask');
    requestAnimationFrame(() => mask.classList.add('show'));

    const close = () => {
      mask.classList.remove('show');
      setTimeout(() => { root.innerHTML = ''; }, 200);
      if (onClose) onClose();
    };
    UI._closeModal = close;

    $('#modal-close-btn').addEventListener('click', close);
    mask.addEventListener('click', e => { if (e.target === mask) close(); });

    const foot = $('#modal-foot');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.class || 'btn-primary'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => a.onClick ? a.onClick(mask, close) : close());
      foot.appendChild(btn);
    });
    return mask;
  }

  function closeModal() {
    if (typeof UI._closeModal === 'function') UI._closeModal();
    UI._closeModal = null;
  }

  /* ---------- 全屏 LEVEL UP 特效 ---------- */

  function levelUpOverlay(from, to) {
    const root = $('#overlay-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'levelup-overlay';
    el.innerHTML = `
      <div class="levelup-box">
        <div class="levelup-rays"></div>
        <div class="levelup-title">LEVEL UP!</div>
        <div class="levelup-sub">Lv.${from} → Lv.${to}</div>
      </div>`;
    root.appendChild(el);
    setTimeout(() => el.classList.add('fadeout'), 2200);
    setTimeout(() => el.remove(), 2900);
  }

  /* ---------- 图标选择器 ---------- */

  /** 在容器内生成 emoji 网格，点击写入 targetInput 并高亮 */
  function iconPicker(containerHtml, targetInput) {
    const grid = containerHtml.querySelector('.icon-grid');
    if (!grid) return;
    const sync = () => {
      $$('.icon-cell', grid).forEach(c =>
        c.classList.toggle('active', c.textContent === targetInput.value));
    };
    grid.innerHTML = CONFIG.iconPresets.map(e =>
      `<button type="button" class="icon-cell">${e}</button>`).join('');
    grid.addEventListener('click', e => {
      const cell = e.target.closest('.icon-cell');
      if (!cell) return;
      targetInput.value = cell.textContent;
      sync();
    });
    targetInput.addEventListener('input', sync);
    sync();
  }

  /* ---------- 通用小组件 ---------- */

  function emptyState(icon, text) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${esc(text)}</div></div>`;
  }

  /** 属性增益徽章列表（gained 对象 → 若干徽章） */
  function gainBadges(gained, { skipZero = true } = {}) {
    const parts = [];
    if (gained.exp) parts.push(`<span class="badge badge-exp">EXP +${fmtNum(gained.exp)}</span>`);
    if (gained.coins) parts.push(`<span class="badge badge-coin">🪙 +${fmtNum(gained.coins)}</span>`);
    CONFIG.attributes.forEach(a => {
      const v = gained[a.key];
      if (!skipZero || v) parts.push(`<span class="badge badge-attr" style="--attr-color:${a.color}">${a.icon} +${fmtNum(v || 0)}</span>`);
    });
    return parts.join('');
  }

  /* ---------- 智能描述生成 ---------- */

  /**
   * 根据名称智能生成有趣描述
   * @param {string} name - 名称
   * @param {string} type - 'behavior' | 'shop' | 'achievement' | 'title'
   * @returns {string} 描述
   */
  function generateDescription(name, type) {
    if (!name) return '';
    const map = type === 'behavior' ? CONFIG.descriptionMap.behaviors
              : type === 'shop' ? CONFIG.descriptionMap.shopItems
              : null;

    // 1. 精确匹配
    if (map && map[name]) return map[name];

    // 2. 模糊匹配（包含关键词）
    if (map) {
      for (const key in map) {
        if (name.includes(key) || key.includes(name)) return map[key];
      }
    }

    // 3. 按类型生成通用有趣描述
    const templates = {
      behavior: [
        `${name}，是你给自己定下的一场小冒险`,
        `每一次${name}，都在雕刻更好的自己`,
        `${name}，让平凡的日子多一点光芒`,
        `坚持${name}，时间会给你答案`,
        `${name}，是和自己的一场温柔较量`,
      ],
      shop: [
        `用${name}奖励一下努力的自己`,
        `${name}，是辛苦生活里的小确幸`,
        `值得拥有的${name}，值得拥有的你`,
        `${name}，给自己的一份犒赏`,
        `用${name}，给生活加点甜`,
      ],
      achievement: [
        `解锁「${name}」的瞬间，就是最好的证明`,
        `${name}，是你一路坚持的勋章`,
        `拿下${name}，你比想象中更强`,
        `${name}，藏着你不为人知的努力`,
        `当${name}亮起，所有付出都有了意义`,
      ],
      title: [
        `配得上「${name}」的，是不平凡的你`,
        `${name}，是时间给你的加冕`,
        `戴上${name}，你就是自己的英雄`,
        `${name}，刻着你走过的每一步`,
        `成为${name}的路上，你从未放弃`,
      ],
    };
    const arr = templates[type] || templates.behavior;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  return { esc, $, $$, toast, rewardToast, confirmDialog, openModal, closeModal, levelUpOverlay, iconPicker, emptyState, gainBadges, generateDescription };
})();

// 全局暴露快捷选择器（供各页面直接使用 $ / $$）
const $ = UI.$;
const $$ = UI.$$;
