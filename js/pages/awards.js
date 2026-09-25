/* ============================================================
 * LIFE RPG - 页面：成就 & 称号
 * 两个独立系统，条件类型完全共用，内容由用户自建。
 *
 * 成就：支持按「已达成 / 未达成」+「学习 / 运动 / 生活…领域」筛选。
 * 领域归属：成就自带 categoryId 优先；老数据 / 未指定时智能推断
 *           （关联行为 → 跟行为的分类；属性条件 → 按属性映射；其余 → 综合）。
 * 称号：支持按「已达成 / 未达成」筛选，未达成按进度排序。
 * ============================================================ */

Pages = window.Pages || {};

/* ---------- 成就领域智能推断 ---------- */

/** 特殊分组：综合（等级、累计总次数等跨领域成就） */
const AWARD_GENERAL = 'cat_general';

/** 按名称关键词找用户分类（如"学习""运动"），找不到返回 null */
function findCatByKeyword(kw) {
  return state.categories.find(c => c.name.includes(kw)) || null;
}

/** 根据条件智能推断所属领域 id（不考虑成就自身已保存的 categoryId） */
function inferAwardCategory(cond) {
  const c = cond || {};

  // 1. 条件关联了某个行为 → 跟着该行为的分类走
  if (c.behaviorId) {
    const b = state.behaviors.find(x => x.id === c.behaviorId);
    if (b && b.categoryId && state.categories.some(cc => cc.id === b.categoryId)) {
      return b.categoryId;
    }
  }

  // 2. 属性条件 → 按属性含义映射
  if (c.type === 'attribute') {
    if (c.attribute === 'intelligence') {
      const c1 = findCatByKeyword('学');
      if (c1) return c1.id;
    }
    if (c.attribute === 'health' || c.attribute === 'fitness') {
      const c1 = findCatByKeyword('运动') || findCatByKeyword('体');
      if (c1) return c1.id;
    }
  }

  // 3. 等级 / 累计总次数 / 其他 → 综合
  return AWARD_GENERAL;
}

/** 成就最终所属领域：自身保存的字段优先（且分类仍存在），否则智能推断 */
function awardCategoryId(a) {
  if (a.categoryId && state.categories.some(c => c.id === a.categoryId)) return a.categoryId;
  return inferAwardCategory(a.condition);
}

/** 领域展示信息：用户分类或「综合」兜底 */
function awardCatInfo(cid) {
  const fallback = { id: AWARD_GENERAL, name: '综合', icon: '🎯', color: '#b07cff' };
  if (cid === AWARD_GENERAL) return fallback;
  const c = state.categories.find(x => x.id === cid);
  return c ? { id: c.id, name: c.name, icon: c.icon || '🏷️', color: c.color || '#8a93b2' }
           : fallback;
}

/** 状态筛选是否命中：status = all | unlocked | locked */
function matchStatus(item, status) {
  if (status === 'unlocked') return !!item.unlocked;
  if (status === 'locked') return !item.unlocked;
  return true;
}

/** 条件进度比例 0~1（排序用） */
function progressPct(item) {
  const prog = conditionProgress(item.condition);
  return prog.target > 0 ? Math.min(1, prog.current / prog.target) : (prog.done ? 1 : 0);
}

/* ---------- 页面 ---------- */

Pages.awards = {
  tab: 'achievement',   // 'achievement' | 'title'
  achStatus: 'all',     // all | unlocked | locked
  achCat: 'all',        // all | 分类 id
  titleStatus: 'all',   // all | unlocked | locked

  render(view) {
    cleanTitleRef();
    const isAch = this.tab === 'achievement';
    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head">
          <h1>🏆 成就 & 称号</h1>
          <div class="head-actions">
            <button class="btn btn-primary" id="btn-new-award">＋ 新建${isAch ? '成就' : '称号'}</button>
          </div>
        </div>

        <div class="tab-row">
          <button class="tab ${isAch ? 'active' : ''}" data-tab="achievement">🎖️ 成就 <span class="tab-count">${state.achievements.filter(a => a.unlocked).length}/${state.achievements.length}</span></button>
          <button class="tab ${!isAch ? 'active' : ''}" data-tab="title">👑 称号 <span class="tab-count">${state.titles.filter(t => t.unlocked).length}/${state.titles.length}</span></button>
        </div>

        ${isAch ? this.renderAchFilters() : this.renderTitleFilters()}
        <div class="award-list">${isAch ? this.renderAchievements() : this.renderTitles()}</div>
      </div>
    `;

    // 成就 / 称号 主 tab
    UI.$$('.tab', view).forEach(t => t.addEventListener('click', () => {
      this.tab = t.dataset.tab;
      this.render(view);
    }));
    $('#btn-new-award').addEventListener('click', () => openAwardForm(this.tab, null));

    // 状态 / 领域 chip
    UI.$$('[data-ach-status]', view).forEach(c => c.addEventListener('click', () => {
      this.achStatus = c.dataset.achStatus; this.render(view);
    }));
    UI.$$('[data-ach-cat]', view).forEach(c => c.addEventListener('click', () => {
      this.achCat = c.dataset.achCat; this.render(view);
    }));
    UI.$$('[data-title-status]', view).forEach(c => c.addEventListener('click', () => {
      this.titleStatus = c.dataset.titleStatus; this.render(view);
    }));

    // 成就/称号卡片操作
    UI.$$('[data-award-id]', view).forEach(card => {
      const kind = card.dataset.awardKind;
      const id = card.dataset.awardId;
      const list = kind === 'achievement' ? state.achievements : state.titles;
      const item = list.find(x => x.id === id);
      if (!item) return;
      const editBtn = card.querySelector('.act-award-edit');
      const delBtn = card.querySelector('.act-award-del');
      if (editBtn) editBtn.addEventListener('click', () => openAwardForm(kind, id));
      if (delBtn) delBtn.addEventListener('click', async () => {
        const ok = await UI.confirmDialog(`确定删除「${UI.esc(item.name)}」？`);
        if (!ok) return;
        if (kind === 'achievement') state.achievements = state.achievements.filter(x => x.id !== id);
        else state.titles = state.titles.filter(x => x.id !== id);
        cleanTitleRef();
        saveState();
        UI.toast('已删除', 'info');
        App.refresh();
      });
      const equipBtn = card.querySelector('.act-equip');
      if (equipBtn) equipBtn.addEventListener('click', () => {
        state.player.titleId = state.player.titleId === id ? null : id;
        saveState();
        UI.toast(state.player.titleId ? `👑 已佩戴「${UI.esc(item.name)}」` : '已卸下称号', 'success');
        App.refresh();
      });
    });
  },

  /* ---------- 筛选 chip ---------- */

  /** 成就：状态行 + 领域行（领域行只列当前状态下实际出现的分组） */
  renderAchFilters() {
    const aList = state.achievements;
    const n = {
      all: aList.length,
      unlocked: aList.filter(a => a.unlocked).length,
      locked: aList.filter(a => !a.unlocked).length,
    };
    const statusChip = (val, label) =>
      `<button class="chip ${this.achStatus === val ? 'active' : ''}" data-ach-status="${val}">${label} <span class="chip-n">${n[val]}</span></button>`;

    // 状态筛选后出现过的领域，按用户分类顺序排列，综合最后
    const statusFiltered = aList.filter(a => matchStatus(a, this.achStatus));
    const catIds = [...new Set(statusFiltered.map(awardCategoryId))];
    const orderedCats = state.categories.map(c => c.id).filter(id => catIds.includes(id));
    if (catIds.includes(AWARD_GENERAL)) orderedCats.push(AWARD_GENERAL);

    const catChip = cid => {
      const info = awardCatInfo(cid);
      const count = statusFiltered.filter(a => awardCategoryId(a) === cid).length;
      return `<button class="chip ${this.achCat === cid ? 'active' : ''}" data-ach-cat="${cid}">${UI.esc(info.icon)} ${UI.esc(info.name)} <span class="chip-n">${count}</span></button>`;
    };

    return `
      <div class="chip-row">
        ${statusChip('all', '📋 全部')}
        ${statusChip('unlocked', '✅ 已达成')}
        ${statusChip('locked', '🔒 未达成')}
      </div>
      ${orderedCats.length ? `
      <div class="chip-row chip-row-cats">
        <button class="chip ${this.achCat === 'all' ? 'active' : ''}" data-ach-cat="all">🏷️ 全部领域</button>
        ${orderedCats.map(catChip).join('')}
      </div>` : ''}`;
  },

  /** 称号：状态行 */
  renderTitleFilters() {
    const tList = state.titles;
    const n = {
      all: tList.length,
      unlocked: tList.filter(t => t.unlocked).length,
      locked: tList.filter(t => !t.unlocked).length,
    };
    const chip = (val, label) =>
      `<button class="chip ${this.titleStatus === val ? 'active' : ''}" data-title-status="${val}">${label} <span class="chip-n">${n[val]}</span></button>`;
    return `
      <div class="chip-row">
        ${chip('all', '📋 全部')}
        ${chip('unlocked', '✅ 已达成')}
        ${chip('locked', '🔒 未达成')}
      </div>`;
  },

  /* ---------- 成就列表（按领域分组） ---------- */

  renderAchievements() {
    if (!state.achievements.length) {
      return UI.emptyState('🎖️', '还没有成就。创建一个吧，例如"第一次完成任意行为"。');
    }

    // 状态筛选
    const filtered = state.achievements.filter(a => matchStatus(a, this.achStatus));

    // 按领域分组（同时应用领域筛选）
    const groups = new Map();
    filtered.forEach(a => {
      const cid = awardCategoryId(a);
      if (this.achCat !== 'all' && cid !== this.achCat) return;
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid).push(a);
    });
    if (!groups.size) return UI.emptyState('🔍', '当前筛选条件下没有成就');

    // 组顺序：用户分类顺序，综合最后
    const order = state.categories.map(c => c.id).concat(AWARD_GENERAL).filter(id => groups.has(id));

    return order.map(cid => {
      const info = awardCatInfo(cid);
      const items = groups.get(cid);

      // 组内：已达成在前（按解锁时间新→旧）；未达成在后（按进度高→低）
      items.sort((x, y) => {
        if (!!x.unlocked !== !!y.unlocked) return x.unlocked ? -1 : 1;
        if (x.unlocked) return (y.unlockedAt || 0) - (x.unlockedAt || 0);
        return progressPct(y) - progressPct(x);
      });

      const unlockedN = items.filter(a => a.unlocked).length;
      return `
      <section class="award-group">
        <div class="award-group-head" style="--cat-color:${info.color}">
          <span class="agh-icon">${UI.esc(info.icon)}</span>
          <span class="agh-name">${UI.esc(info.name)}</span>
          <span class="agh-count">${unlockedN}/${items.length}</span>
        </div>
        ${items.map(a => this.achCard(a)).join('')}
      </section>`;
    }).join('');
  },

  /** 单个成就卡片 */
  achCard(a) {
    const prog = conditionProgress(a.condition);
    const pct = Math.min(100, prog.target > 0 ? (prog.current / prog.target) * 100 : (prog.done ? 100 : 0));
    return `
      <div class="card award-card ${a.unlocked ? 'unlocked' : ''}" data-award-kind="achievement" data-award-id="${a.id}">
        <div class="award-main">
          <span class="award-icon ${a.unlocked ? 'glow' : 'gray'}">${UI.esc(a.icon || '🎖️')}</span>
          <div class="award-info">
            <div class="award-name">${UI.esc(a.name)} ${a.unlocked ? '<span class="unlock-tag">已解锁</span>' : '<span class="lock-tag">🔒 未解锁</span>'}</div>
            ${a.description ? `<div class="award-desc">${UI.esc(a.description)}</div>` : ''}
            <div class="award-cond">${UI.esc(conditionText(a.condition))}</div>
            <div class="award-reward-line">
              🎁 奖励：<b class="ar-exp">+${fmtNum((a.rewards || {}).exp)} EXP</b>
              <b class="ar-coin">+${fmtNum((a.rewards || {}).coins)} 🪙</b>
            </div>
            <div class="award-progress">
              <div class="award-bar"><div class="award-fill" style="width:${pct}%"></div></div>
              <span class="award-nums">${fmtNum(prog.current)} / ${fmtNum(prog.target)}</span>
            </div>
            ${a.unlocked ? `<div class="award-date">解锁于 ${formatTime(a.unlockedAt)}</div>` : ''}
          </div>
        </div>
        <div class="award-actions">
          <button class="btn btn-ghost btn-sm act-award-edit">✏️</button>
          <button class="btn btn-ghost btn-sm act-award-del">🗑️</button>
        </div>
      </div>`;
  },

  /* ---------- 称号列表 ---------- */

  renderTitles() {
    if (!state.titles.length) {
      return UI.emptyState('👑', '还没有称号。创建一个吧，例如"终身学习者：Intelligence ≥ 50"。');
    }
    const filtered = state.titles.filter(t => matchStatus(t, this.titleStatus));
    if (!filtered.length) return UI.emptyState('🔍', '当前筛选条件下没有称号');

    // 已达成在前（佩戴中的最前）；未达成按进度高→低
    filtered.sort((x, y) => {
      if (!!x.unlocked !== !!y.unlocked) return x.unlocked ? -1 : 1;
      if (x.unlocked) {
        const xe = state.player.titleId === x.id, ye = state.player.titleId === y.id;
        if (xe !== ye) return xe ? -1 : 1;
        return (y.unlockedAt || 0) - (x.unlockedAt || 0);
      }
      return progressPct(y) - progressPct(x);
    });

    return filtered.map(t => {
      const prog = conditionProgress(t.condition);
      const equipped = state.player.titleId === t.id;
      const remaining = prog.target > prog.current ? fmtNum(prog.target - prog.current) : 0;
      const remainText = t.unlocked ? '' :
        (t.condition.type === 'level') ? `还需升级 ${remaining} 次` :
        `还差 ${remaining}`;
      return `
      <div class="card award-card ${t.unlocked ? 'unlocked' : ''} ${equipped ? 'equipped' : ''}" data-award-kind="title" data-award-id="${t.id}">
        <div class="award-main">
          <span class="award-icon ${t.unlocked ? 'glow' : 'gray'}">${UI.esc(t.icon || '👑')}</span>
          <div class="award-info">
            <div class="award-name">${UI.esc(t.name)}
              ${equipped ? '<span class="equip-tag">当前佩戴</span>' : t.unlocked ? '<span class="unlock-tag">已获得</span>' : '<span class="lock-tag">🔒 未解锁</span>'}
            </div>
            ${t.description ? `<div class="award-desc">${UI.esc(t.description)}</div>` : ''}
            <div class="award-cond">${UI.esc(conditionText(t.condition))}</div>
            <div class="award-progress">
              <div class="award-bar"><div class="award-fill" style="width:${Math.min(100, prog.target > 0 ? (prog.current / prog.target) * 100 : 0)}%"></div></div>
              <span class="award-nums">${fmtNum(prog.current)} / ${fmtNum(prog.target)}</span>
            </div>
            ${!t.unlocked && remainText ? `<div class="award-remain">🚀 ${remainText}即可解锁此称号</div>` : ''}
          </div>
        </div>
        <div class="award-actions">
          ${t.unlocked ? `<button class="btn ${equipped ? 'btn-ghost' : 'btn-primary'} btn-sm act-equip">${equipped ? '卸下' : '👑 佩戴'}</button>` : ''}
          <button class="btn btn-ghost btn-sm act-award-edit">✏️</button>
          <button class="btn btn-ghost btn-sm act-award-del">🗑️</button>
        </div>
      </div>`;
    }).join('');
  },
};

/* ================= 新建 / 编辑成就 / 称号弹窗 ================= */

function openAwardForm(kind, itemId) {
  const isAch = kind === 'achievement';
  const list = isAch ? state.achievements : state.titles;
  const item = itemId ? list.find(x => x.id === itemId) : null;
  const cond = (item && item.condition) || { type: 'level', behaviorId: '', attribute: '', value: 1 };
  const label = isAch ? '成就' : '称号';

  // 成就领域初始值：已保存字段 → 智能推断
  const initialCat = item ? (item.categoryId || inferAwardCategory(item.condition))
                         : inferAwardCategory(cond);

  const condNeeds = type => (CONFIG.conditionTypes[type] || { needs: [] }).needs;

  const content = `
    <div class="form-grid">
      <label class="field">
        <span class="field-label">${label}名称 *</span>
        <input type="text" class="input" id="aw-name" maxlength="30" placeholder="例如：终身学习者" value="${UI.esc(item ? item.name : '')}">
      </label>
      <label class="field">
        <span class="field-label">图标（emoji）</span>
        <input type="text" class="input" id="aw-icon" maxlength="4" placeholder="${isAch ? '🎖️' : '👑'}" value="${UI.esc(item ? item.icon : '')}">
      </label>
      ${isAch ? `
      <label class="field field-full">
        <span class="field-label">所属领域（按条件可自动判断，也可手动改）</span>
        <select class="input" id="aw-category">
          <option value="${AWARD_GENERAL}">🎯 综合（等级 / 累计总次数等跨领域）</option>
          ${state.categories.map(c => `<option value="${c.id}" ${initialCat === c.id ? 'selected' : ''}>${UI.esc(c.icon)} ${UI.esc(c.name)}</option>`).join('')}
        </select>
      </label>` : ''}
      <label class="field field-full">
        <span class="field-label">描述（可选）</span>
        <div class="input-with-btn">
          <input type="text" class="input" id="aw-desc" maxlength="60" placeholder="这个${label}的意义" value="${UI.esc(item ? item.description : '')}">
          <button type="button" class="btn btn-gen" id="aw-gen-desc">✨生成</button>
        </div>
      </label>

      <div class="field field-full">
        <span class="field-label">解锁条件</span>
        <div class="cond-row">
          <select class="input" id="aw-cond-type">
            ${Object.entries(CONFIG.conditionTypes).map(([k, v]) =>
              `<option value="${k}" ${cond.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}
          </select>
          <select class="input" id="aw-cond-behavior" style="display:none">
            <option value="">选择行为…</option>
            ${state.behaviors.map(b => `<option value="${b.id}" ${cond.behaviorId === b.id ? 'selected' : ''}>${UI.esc(b.icon)} ${UI.esc(b.name)}</option>`).join('')}
          </select>
          <select class="input" id="aw-cond-attribute" style="display:none">
            ${CONFIG.attributes.map(a => `<option value="${a.key}" ${cond.attribute === a.key ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('')}
          </select>
          <input type="number" class="input" id="aw-cond-value" min="1" step="any" placeholder="数值" value="${cond.value || ''}" style="display:none">
        </div>
        <div class="cond-desc" id="aw-cond-desc"></div>
      </div>

      ${isAch ? `
      <div class="field field-full">
        <span class="field-label">解锁奖励（达成时自动发放，可都填 0）</span>
        <div class="reward-row">
          <label class="mini-field"><span>EXP</span>
            <input type="number" class="input" id="aw-reward-exp" min="0" step="any" placeholder="0"
              value="${item && item.rewards ? item.rewards.exp ?? '' : ''}"></label>
          <label class="mini-field"><span>🪙 金币</span>
            <input type="number" class="input" id="aw-reward-coins" min="0" step="any" placeholder="0"
              value="${item && item.rewards ? item.rewards.coins ?? '' : ''}"></label>
        </div>
      </div>` : ''}

      <div class="field-full icon-picker-wrap">
        <span class="field-label">快捷图标</span>
        <div class="icon-grid"></div>
      </div>
    </div>`;

  const mask = UI.openModal({
    title: item ? `✏️ 编辑${label}` : `✨ 新建${label}`,
    content,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: item ? '保存修改' : `创建${label}`, class: 'btn-primary', onClick: (m, close) => {
          const name = UI.$('#aw-name', m).value.trim();
          if (!name) { UI.toast('名称不能为空', 'error'); return; }
          const type = UI.$('#aw-cond-type', m).value;
          const needs = condNeeds(type);
          const condition = { type, behaviorId: '', attribute: '', value: 0 };
          if (needs.includes('behaviorId')) {
            const bid = UI.$('#aw-cond-behavior', m).value;
            if (!bid) { UI.toast('该条件需要选择一个行为', 'error'); return; }
            condition.behaviorId = bid;
          }
          if (needs.includes('attribute')) condition.attribute = UI.$('#aw-cond-attribute', m).value;
          if (needs.includes('value')) {
            const v = parseFloat(UI.$('#aw-cond-value', m).value);
            if (isNaN(v) || v <= 0) { UI.toast('请填写大于 0 的数值', 'error'); return; }
            condition.value = v;
          }
          const data = {
            name,
            icon: UI.$('#aw-icon', m).value.trim() || (isAch ? '🎖️' : '👑'),
            description: UI.$('#aw-desc', m).value.trim(),
            condition,
          };
          if (isAch) {
            data.categoryId = UI.$('#aw-category', m).value;
            const rExp = Math.max(0, parseFloat(UI.$('#aw-reward-exp', m).value) || 0);
            const rCoins = Math.max(0, parseFloat(UI.$('#aw-reward-coins', m).value) || 0);
            data.rewards = { exp: rExp, coins: rCoins };
          }
          if (item) {
            Object.assign(item, data);
            UI.toast(`${label}已保存`, 'success');
          }
          else {
            const entry = { id: uid(), ...data, unlocked: false, unlockedAt: null };
            // 创建即满足条件则立刻解锁；成就同时发放奖励
            if (conditionProgress(condition).done) {
              if (isAch) {
                const ups = grantAchievement(entry);
                // 与全站统一：走智能过场小窗
                setTimeout(() => {
                  Cutscene.achievement(entry);
                  ups.forEach(([from, to]) => Cutscene.levelUp(from, to));
                  Cutscene.play();
                }, 120);
              } else {
                entry.unlocked = true;
                entry.unlockedAt = Date.now();
              }
            }
            list.push(entry);
            UI.toast(`${label}「${UI.esc(name)}」已创建`, 'success');
          }
          saveState();
          close();
          App.refresh();
        } },
    ],
  });

  const typeSel = UI.$('#aw-cond-type', mask);
  const bSel = UI.$('#aw-cond-behavior', mask);
  const aSel = UI.$('#aw-cond-attribute', mask);
  const vInput = UI.$('#aw-cond-value', mask);
  const descEl = UI.$('#aw-cond-desc', mask);
  const catSel = isAch ? UI.$('#aw-category', mask) : null;

  /** 按当前表单条件智能联动领域选择 */
  const syncCategory = () => {
    if (!catSel) return;
    catSel.value = inferAwardCategory({
      type: typeSel.value,
      behaviorId: bSel.value,
      attribute: aSel.value,
    });
  };

  const sync = ({ autoCat = false } = {}) => {
    const needs = condNeeds(typeSel.value);
    bSel.style.display = needs.includes('behaviorId') ? '' : 'none';
    aSel.style.display = needs.includes('attribute') ? '' : 'none';
    vInput.style.display = needs.includes('value') ? '' : 'none';
    descEl.textContent = (CONFIG.conditionTypes[typeSel.value] || {}).desc || '';
    if (autoCat) syncCategory();
  };

  // 条件类型 / 行为 / 属性变化时，自动更新所属领域
  typeSel.addEventListener('change', () => sync({ autoCat: true }));
  if (catSel) {
    bSel.addEventListener('change', syncCategory);
    aSel.addEventListener('change', syncCategory);
  }
  UI.iconPicker(mask, UI.$('#aw-icon', mask));

  // 智能生成描述
  UI.$('#aw-gen-desc', mask).addEventListener('click', () => {
    const name = UI.$('#aw-name', mask).value.trim();
    if (!name) { UI.toast('请先填写名称', 'error'); return; }
    UI.$('#aw-desc', mask).value = UI.generateDescription(name, isAch ? 'achievement' : 'title');
  });
  sync(); // 初始化（领域保持 initialCat，不自动覆盖）
}
