/* ============================================================
 * LIFE RPG - 页面：行为（App 核心）
 * 行为 CRUD / 分类管理 / 完成行为（含奖励实时预览）
 * openCompleteModal() 同时供首页调用
 * ============================================================ */

Pages = window.Pages || {};

/* ================= 完成行为弹窗（首页 / 行为页共用） ================= */

/** behaviorId 为空时先选行为，再进入数量填写 */
function openCompleteModal(behaviorId) {
  if (!state.behaviors.length) {
    UI.toast('还没有任何行为，先去「行为」页创建一个吧', 'info');
    location.hash = '#/behavior';
    return;
  }
  if (!behaviorId) return openBehaviorPicker();
  return openCompleteForm(behaviorId);
}

function openBehaviorPicker() {
  const cats = state.categories;
  const catOf = id => cats.find(c => c.id === id);
  const content = `
    <div class="picker-grid">
      ${state.behaviors.map(b => {
        const c = catOf(b.categoryId);
        return `<button class="picker-item" data-id="${b.id}">
          <span class="picker-icon">${UI.esc(b.icon || '⚡')}</span>
          <span class="picker-name">${UI.esc(b.name)}</span>
          ${c ? `<span class="picker-cat">${UI.esc(c.name)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
  const mask = UI.openModal({ title: '⚔️ 选择要完成的行为', content });
  UI.$$('.picker-item', mask).forEach(el =>
    el.addEventListener('click', () => openCompleteForm(el.dataset.id)));
}

function openCompleteForm(behaviorId) {
  const b = state.behaviors.find(x => x.id === behaviorId);
  if (!b) return;
  const isTime = b.rewardType === 'per_time';
  const defaultQty = b.rewardType === 'fixed' ? 1 : (isTime ? 30 : 1);

  const unitLabel = isTime ? '分钟' : (b.unit || '单位');
  const perLabel = isTime ? `每 ${b.perTimeMinutes || 30} 分钟` :
    b.rewardType === 'per_unit' ? `每 1 ${b.unit || '单位'}` : '固定奖励';

  const content = `
    <div class="complete-form">
      <div class="cb-info">
        <span class="cb-icon">${UI.esc(b.icon || '⚡')}</span>
        <div>
          <div class="cb-name">${UI.esc(b.name)}</div>
          <div class="cb-rule">${perLabel} · ${UI.esc(rewardSummary(b))}</div>
        </div>
      </div>
      <label class="field">
        <span class="field-label">本次${isTime ? '用时' : '数量'}（${UI.esc(unitLabel)}）</span>
        <div class="qty-row">
          <button type="button" class="qty-btn" id="qty-minus">−</button>
          <input type="number" id="qty-input" class="input qty-input" min="0" step="any" value="${defaultQty}">
          <button type="button" class="qty-btn" id="qty-plus">＋</button>
        </div>
      </label>
      <div class="preview-box">
        <div class="preview-title">预计获得</div>
        <div class="preview-gains" id="preview-gains"></div>
      </div>
    </div>`;

  const mask = UI.openModal({
    title: '⚔️ 完成行为',
    content,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: '完成！', class: 'btn-primary', onClick: (m, close) => {
          const qty = parseFloat(UI.$('#qty-input', m).value);
          if (isNaN(qty) || qty <= 0) { UI.toast('请输入大于 0 的数量', 'error'); return; }
          const result = completeBehavior(behaviorId, qty);
          close();
          showCompleteFeedback(result);
        } },
    ],
  });

  const input = UI.$('#qty-input', mask);
  const preview = UI.$('#preview-gains', mask);
  const renderPreview = () => {
    const qty = parseFloat(input.value);
    const gained = calcGained(b, isNaN(qty) ? 0 : qty);
    preview.innerHTML = UI.gainBadges(gained);
  };
  input.addEventListener('input', renderPreview);
  UI.$('#qty-minus', mask).addEventListener('click', () => {
    const step = isTime ? 5 : 1;
    input.value = Math.max(0, (parseFloat(input.value) || 0) - step);
    renderPreview();
  });
  UI.$('#qty-plus', mask).addEventListener('click', () => {
    const step = isTime ? 5 : 1;
    input.value = (parseFloat(input.value) || 0) + step;
    renderPreview();
  });
  renderPreview();
}

/**
 * 完成后的反馈：智能过场动画小窗排队播放
 * 顺序：行为完成 → 成就解锁 → 称号获得 → 升级（点击卡片可跳过）
 */
function showCompleteFeedback(result) {
  if (!result) return;
  // 先刷新数据（过场层独立于页面，不受重渲染影响）
  if (typeof App !== 'undefined' && App.refresh) App.refresh();

  Cutscene.behavior(result.record.behaviorName, result.record.behaviorIcon, result.gained);
  result.unlockedAchievements.forEach(a => Cutscene.achievement(a));
  result.unlockedTitles.forEach(t => Cutscene.title(t));
  result.levelUps.forEach(([from, to]) => Cutscene.levelUp(from, to));
  Cutscene.play();
}

/* ================= 行为页 ================= */

Pages.behavior = {
  filterCat: 'all',
  subTab: 'list', // 'list' 全部行为 | 'daily' 每日清单
  day: 0,         // 每日清单查看哪天：0=今天，1=明天

  render(view) {
    const cats = state.categories;

    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head">
          <h1>📜 行为</h1>
          <div class="head-actions">
            <button class="btn btn-ghost" id="btn-manage-cats">🏷️ 管理分类</button>
            <button class="btn btn-primary" id="btn-new-behavior">＋ 新建行为</button>
          </div>
        </div>

        <div class="subtabs">
          <button class="subtab ${this.subTab === 'list' ? 'active' : ''}" data-sub="list">⚔️ 全部行为</button>
          <button class="subtab ${this.subTab === 'daily' ? 'active' : ''}" data-sub="daily">📅 每日清单</button>
        </div>

        ${this.subTab === 'list' ? this.renderList(cats) : this.renderDaily()}
      </div>
    `;

    $('#btn-new-behavior').addEventListener('click', () => openBehaviorForm(null));
    $('#btn-manage-cats').addEventListener('click', () => openCategoryManager());

    // 子标签切换
    UI.$$('.subtab', view).forEach(st => st.addEventListener('click', () => {
      this.subTab = st.dataset.sub;
      this.render(view);
    }));

    if (this.subTab === 'list') this.bindList(view);
    else this.bindDaily(view);
  },

  /* ---------------- 子页：全部行为 ---------------- */

  renderList(cats) {
    const catOf = id => cats.find(c => c.id === id);
    const list = state.behaviors.filter(b =>
      this.filterCat === 'all' || b.categoryId === this.filterCat);

    return `
      <div class="chip-row">
        <button class="chip ${this.filterCat === 'all' ? 'active' : ''}" data-cat="all">全部</button>
        ${cats.map(c => `
          <button class="chip ${this.filterCat === c.id ? 'active' : ''}" data-cat="${c.id}">
            ${UI.esc(c.icon)} ${UI.esc(c.name)}
          </button>`).join('')}
      </div>

      <div class="behavior-list">
        ${list.length ? list.map(b => {
          const c = catOf(b.categoryId);
          const perLabel = b.rewardType === 'per_time' ? `每 ${b.perTimeMinutes || 30} 分钟`
            : b.rewardType === 'per_unit' ? `每 1 ${UI.esc(b.unit || '单位')}` : '完成一次';
          return `
          <div class="card behavior-card" data-id="${b.id}">
            <div class="bc-main">
              <span class="bc-icon">${UI.esc(b.icon || '⚡')}</span>
              <div class="bc-info">
                <div class="bc-name-row">
                  <span class="bc-name">${UI.esc(b.name)}</span>
                  ${c ? `<span class="cat-tag" style="--cat-color:${c.color || '#8a93b2'}">${UI.esc(c.icon)} ${UI.esc(c.name)}</span>` : '<span class="cat-tag">未分类</span>'}
                </div>
                ${b.description ? `<div class="bc-desc">${UI.esc(b.description)}</div>` : ''}
                <div class="bc-rewards"><span class="bc-rule">${perLabel}</span> ${UI.esc(rewardSummary(b))}</div>
              </div>
            </div>
            <div class="bc-actions">
              <button class="btn btn-primary btn-sm act-complete">⚔️ 完成</button>
              <button class="btn btn-ghost btn-sm act-edit">✏️</button>
              <button class="btn btn-ghost btn-sm act-del">🗑️</button>
            </div>
          </div>`;
        }).join('') : UI.emptyState('📜', '还没有行为。点击「新建行为」，定义属于你的第一个人生规则吧！')}
      </div>
    `;
  },

  bindList(view) {
    UI.$$('.chip', view).forEach(ch => ch.addEventListener('click', () => {
      this.filterCat = ch.dataset.cat;
      this.render(view);
    }));

    UI.$$('.behavior-card', view).forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.act-complete').addEventListener('click', () => openCompleteModal(id));
      card.querySelector('.act-edit').addEventListener('click', () => openBehaviorForm(id));
      card.querySelector('.act-del').addEventListener('click', async () => {
        const b = state.behaviors.find(x => x.id === id);
        const ok = await UI.confirmDialog(
          `确定删除行为「${UI.esc(b.name)}」？<br><small>历史记录会保留，不会消失。</small>`);
        if (!ok) return;
        state.behaviors = state.behaviors.filter(x => x.id !== id);
        saveState();
        UI.toast(`已删除「${UI.esc(b.name)}」`, 'info');
        App.refresh();
      });
    });
  },

  /* ---------------- 子页：每日清单 ---------------- */

  renderDaily() {
    const off = this.day;
    const key = dailyKeyOffset(off);
    const day = ensureDaily(key); // 保证结构存在
    const isToday = off === 0;

    const doneN = day.tasks.filter(t => t.done).length;
    const total = day.tasks.length;
    const pct = total ? Math.round(doneN / total * 100) : 0;
    const allDone = dailyAllDone(day);

    const dayLabel = o => {
      const d = new Date(dailyKeyOffset(o) + 'T12:00:00');
      return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS_CN[d.getDay()]}`;
    };

    // 顶部状态条（今天：空/进行中/宝箱就绪/已开；明天：提示 + 复制）
    let banner;
    if (!isToday) {
      banner = `
        <div class="daily-banner db-tomorrow">
          <span>🌙 明天（${dayLabel(1)}）已编排 <b>${total}</b> 项，明早 <b>6:00</b> 后自动生效</span>
          <button class="btn btn-sm btn-ghost" id="btn-copy-today">📋 复制今天</button>
        </div>`;
    } else if (!total) {
      banner = `<div class="daily-banner db-empty">📝 今天还没有安排，从下方挑几个行为、或加几件小事吧</div>`;
    } else if (allDone && day.chest.opened) {
      const r = day.chest.rewards || {};
      banner = `
        <div class="daily-banner db-chest-opened">
          ✅ 今日全清！宝箱已开出 <b>+${fmtNum(r.exp)} EXP</b> <b>+${fmtNum(r.coins)} 🪙</b>，明天继续
        </div>`;
    } else if (allDone) {
      banner = `
        <button class="daily-banner db-chest-ready" id="btn-open-chest">
          🎁 今日 ${doneN}/${total} 全部完成！点我开启宝箱
        </button>`;
    } else if (day.chest.opened) {
      // 宝箱已开过（如撤回记录导致又出现未完成项）：不再承诺宝箱
      banner = `
        <div class="daily-banner db-chest-opened">
          <span>📅 今日进度 <b>${doneN}/${total}</b>　今日宝箱已开启 ✅</span>
        </div>`;
    } else {
      banner = `
        <div class="daily-banner db-locked">
          <div class="dprog-text">🔒 今日进度 <b>${doneN}/${total}</b>，再完成 <b>${total - doneN}</b> 项即可开启宝箱</div>
          <div class="dprog"><div class="dprog-bar" style="width:${pct}%"></div></div>
        </div>`;
    }

    return `
      <div class="daily-wrap">
        <div class="day-switch">
          <button class="ds-btn ${off === 0 ? 'active' : ''}" data-day="0">📍 今天 ${dayLabel(0)}</button>
          <button class="ds-btn ${off === 1 ? 'active' : ''}" data-day="1">🌙 明天 ${dayLabel(1)}</button>
        </div>

        ${banner}

        <div class="daily-add-row">
          <button class="btn btn-primary btn-sm" id="btn-add-behavior">➕ 从行为库添加</button>
          <button class="btn btn-ghost btn-sm" id="btn-add-custom">✍️ 新建临时任务</button>
        </div>

        <div class="dt-list">
          ${total
            ? day.tasks.map(t => dailyTaskRow(t, isToday)).join('')
            : UI.emptyState('📅', isToday ? '今天的清单还是空的' : '明天的清单还是空的')}
        </div>
      </div>
    `;
  },

  bindDaily(view) {
    const key = () => dailyKeyOffset(this.day);
    const redraw = () => this.render(view);

    // 今天 / 明天切换
    UI.$$('.ds-btn', view).forEach(b => b.addEventListener('click', () => {
      this.day = parseInt(b.dataset.day, 10);
      redraw();
    }));

    // 复制今天 → 明天
    const copyBtn = view.querySelector('#btn-copy-today');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const n = copyDailyToTomorrow();
      UI.toast(n ? `已复制 ${n} 项到明天` : '没有可复制的新任务', n ? 'success' : 'info');
      redraw();
    });

    // 开启宝箱
    const chestBtn = view.querySelector('#btn-open-chest');
    if (chestBtn) chestBtn.addEventListener('click', () => {
      const r = openDailyChest(dailyKey());
      if (!r) return;
      App.refresh();
      Cutscene.treasure(r.gained);
      r.levelUps.forEach(([from, to]) => Cutscene.levelUp(from, to));
      Cutscene.play();
    });

    // 添加任务
    view.querySelector('#btn-add-behavior')
      .addEventListener('click', () => openDailyBehaviorPicker(this.day, redraw));
    view.querySelector('#btn-add-custom')
      .addEventListener('click', () => openDailyCustomForm(this.day, redraw));

    // 每条任务的按钮
    UI.$$('.dt-row', view).forEach(row => {
      const id = row.dataset.id;

      const go = row.querySelector('.act-dt-go');
      if (go) go.addEventListener('click', () => {
        const r = completeDailyTask(key(), id);
        if (!r) return;
        if (r.missing) { UI.toast('该行为已从库中删除，请移除这条后重新添加', 'error'); return; }
        if (r.custom) {
          // 临时任务：小窗 + 升级（智能匹配名称场景，如"拿快递"）
          App.refresh();
          Cutscene.behavior(r.task.name, r.task.icon, r.gained);
          r.levelUps.forEach(([f, t]) => Cutscene.levelUp(f, t));
          Cutscene.play();
        } else {
          showCompleteFeedback(r); // 库行为：完整反馈链
        }
      });

      const edit = row.querySelector('.act-dt-edit');
      if (edit) edit.addEventListener('click', () => openDailyTargetEditor(key(), id, redraw));

      const del = row.querySelector('.act-dt-del');
      if (del) del.addEventListener('click', async () => {
        const t = state.daily[key()].tasks.find(x => x.id === id);
        const ok = await UI.confirmDialog(`从清单中移除「${UI.esc(t.name)}」？`,
          { danger: false, okText: '移除' });
        if (!ok) return;
        removeDailyTask(key(), id);
        redraw();
      });
    });
  },
};

/* ================= 每日清单：行渲染 / 添加弹窗 ================= */

/** 单条任务行 */
function dailyTaskRow(t, isToday) {
  const hm = t.doneAt
    ? `${String(new Date(t.doneAt).getHours()).padStart(2, '0')}:${String(new Date(t.doneAt).getMinutes()).padStart(2, '0')}`
    : '';

  const target = t.kind === 'behavior'
    ? `<span class="dt-target">目标 ${fmtNum(t.target)} ${UI.esc(t.unit || '次')}</span>`
    : '';

  const hint = t.kind === 'behavior'
    ? '📚 按行为库规则结算（EXP / 金币 / 属性 / 成就）'
    : `🎁 +${fmtNum((t.rewards || {}).exp)} EXP  +${fmtNum((t.rewards || {}).coins)} 🪙`;

  const actions = [];
  if (isToday && !t.done) {
    actions.push(`<button class="btn btn-primary btn-sm act-dt-go">${t.kind === 'behavior' ? '▶️ 完成' : '✔️ 打勾'}</button>`);
    if (t.kind === 'behavior') {
      actions.push(`<button class="btn btn-ghost btn-sm act-dt-edit" title="修改目标量">✏️</button>`);
    }
  }
  actions.push(`<button class="btn btn-ghost btn-sm act-dt-del">🗑️</button>`);

  let stateTag = '';
  if (t.done) stateTag = `<span class="dt-done-tag">✅ 已完成${hm ? ' · ' + hm : ''}</span>`;
  else if (!isToday) stateTag = '<span class="dt-wait">⏳ 待开始</span>';

  return `
    <div class="dt-row ${t.done ? 'is-done' : ''}" data-id="${t.id}">
      <span class="dt-icon">${UI.esc(t.icon)}</span>
      <div class="dt-info">
        <div class="dt-name">${UI.esc(t.name)} ${target}</div>
        <div class="dt-hint">${hint}</div>
      </div>
      <div class="dt-side">
        ${stateTag}
        <div class="dt-actions">${actions.join('')}</div>
      </div>
    </div>`;
}

/** 从行为库挑任务（点一下直接加入，默认目标量） */
function openDailyBehaviorPicker(off, redraw) {
  const key = dailyKeyOffset(off);
  const day = ensureDaily(key);
  const available = state.behaviors.filter(b =>
    !day.tasks.some(t => t.kind === 'behavior' && t.behaviorId === b.id));

  if (!available.length) { UI.toast('行为库里的行为都已经在清单里了', 'info'); return; }

  const content = `
    <div class="picker-grid">
      ${available.map(b => `
        <button class="picker-item" data-id="${b.id}">
          <span class="picker-icon">${UI.esc(b.icon || '⚡')}</span>
          <span class="picker-name">${UI.esc(b.name)}</span>
          <span class="picker-cat">默认目标 ${defaultDailyTarget(b)}${b.unit ? ' ' + UI.esc(b.unit) : ''}</span>
        </button>`).join('')}
    </div>
    <div class="picker-hint">点击即加入${off === 0 ? '今天' : '明天'}，之后可点 ✏️ 改目标量</div>`;

  const mask = UI.openModal({ title: `➕ 从行为库添加到${off === 0 ? '今天' : '明天'}`, content });
  UI.$$('.picker-item', mask).forEach(el => el.addEventListener('click', () => {
    const r = addBehaviorDailyTask(key, el.dataset.id);
    if (r && r.duplicated) { UI.toast('已经在清单里了', 'info'); return; }
    UI.toast('已添加，点 ✏️ 可修改目标量', 'success');
    UI.closeModal();
    redraw();
  }));
}

/** 新建临时小任务（奖励自定义） */
function openDailyCustomForm(off, redraw) {
  const key = dailyKeyOffset(off);
  const d = CONFIG.daily.customDefault;

  const content = `
    <div class="form-grid">
      <label class="field field-full">
        <span class="field-label">任务名称 *</span>
        <input type="text" class="input" id="ct-name" maxlength="20" placeholder="例如：拿快递 / 取外卖 / 帮室友带饭">
      </label>
      <label class="field field-sm">
        <span class="field-label">图标</span>
        <input type="text" class="input" id="ct-icon" maxlength="4" placeholder="📦">
      </label>
      <label class="field field-sm">
        <span class="field-label">奖励 EXP</span>
        <input type="number" class="input" id="ct-exp" min="0" step="any" value="${d.exp}">
      </label>
      <label class="field field-sm">
        <span class="field-label">奖励 🪙 金币</span>
        <input type="number" class="input" id="ct-coins" min="0" step="any" value="${d.coins}">
      </label>
    </div>`;

  const mask = UI.openModal({
    title: `✍️ 新建临时任务（${off === 0 ? '今天' : '明天'}）`,
    content,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: '添加', class: 'btn-primary', onClick: (m, close) => {
          const name = UI.$('#ct-name', m).value.trim();
          if (!name) { UI.toast('任务名称不能为空', 'error'); return; }
          addCustomDailyTask(key, {
            name,
            icon: UI.$('#ct-icon', m).value.trim(),
            exp: parseFloat(UI.$('#ct-exp', m).value) || 0,
            coins: parseFloat(UI.$('#ct-coins', m).value) || 0,
          });
          UI.toast(`临时任务「${UI.esc(name)}」已添加`, 'success');
          close();
          redraw();
        } },
    ],
  });
}

/** 修改库行为任务的今日目标量 */
function openDailyTargetEditor(key, id, redraw) {
  const t = state.daily[key].tasks.find(x => x.id === id);
  if (!t) return;

  const mask = UI.openModal({
    title: '✏️ 修改今日目标',
    content: `
      <label class="field">
        <span class="field-label">「${UI.esc(t.name)}」今日目标量（${UI.esc(t.unit || '次')}）</span>
        <input type="number" class="input" id="te-target" min="0" step="any" value="${t.target}">
      </label>`,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: '保存', class: 'btn-primary', onClick: (m, close) => {
          const v = parseFloat(UI.$('#te-target', m).value);
          if (isNaN(v) || v <= 0) { UI.toast('请填写大于 0 的目标量', 'error'); return; }
          updateDailyTarget(key, id, v);
          close();
          redraw();
        } },
    ],
  });
}

/* ================= 新建 / 编辑行为弹窗 ================= */

function openBehaviorForm(behaviorId) {
  const b = behaviorId ? state.behaviors.find(x => x.id === behaviorId) : null;
  const r = (b && b.rewards) || { exp: 0, coins: 0, health: 0, intelligence: 0, fitness: 0, discipline: 0 };
  const rt = b ? b.rewardType : 'fixed';

  const attrField = a => `
    <label class="field field-sm">
      <span class="field-label">${a.icon} ${a.name}</span>
      <input type="number" class="input" id="rw-${a.key}" min="0" step="any" value="${r[a.key] || 0}">
    </label>`;

  const content = `
    <div class="form-grid">
      <label class="field">
        <span class="field-label">行为名称 *</span>
        <input type="text" class="input" id="bh-name" maxlength="30" placeholder="例如：跑步" value="${UI.esc(b ? b.name : '')}">
      </label>
      <label class="field">
        <span class="field-label">分类</span>
        <select class="input" id="bh-category">
          <option value="">未分类</option>
          ${state.categories.map(c => `<option value="${c.id}" ${b && b.categoryId === c.id ? 'selected' : ''}>${UI.esc(c.icon)} ${UI.esc(c.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="field-label">图标（emoji）</span>
        <input type="text" class="input" id="bh-icon" maxlength="4" placeholder="⚡" value="${UI.esc(b ? b.icon : '')}">
      </label>
      <label class="field">
        <span class="field-label">单位（按数量/时间时展示用）</span>
        <input type="text" class="input" id="bh-unit" maxlength="10" placeholder="例如：公里 / 分钟 / 次" value="${UI.esc(b ? b.unit : '')}">
      </label>
      <label class="field field-full">
        <span class="field-label">描述（可选）</span>
        <div class="input-with-btn">
          <input type="text" class="input" id="bh-desc" maxlength="60" placeholder="简单描述这个行为" value="${UI.esc(b ? b.description : '')}">
          <button type="button" class="btn btn-gen" id="bh-gen-desc">✨生成</button>
        </div>
      </label>

      <div class="field field-full">
        <span class="field-label">奖励方式</span>
        <div class="radio-cards">
          ${Object.entries(CONFIG.rewardTypes).map(([k, v]) => `
            <label class="radio-card ${rt === k ? 'active' : ''}">
              <input type="radio" name="reward-type" value="${k}" ${rt === k ? 'checked' : ''}>
              <span class="rc-name">${v.name}</span><span class="rc-desc">${v.desc}</span>
            </label>`).join('')}
        </div>
      </div>

      <label class="field field-full per-time-field" id="per-time-field" style="display:${rt === 'per_time' ? '' : 'none'}">
        <span class="field-label">每多少分钟结算一轮奖励</span>
        <input type="number" class="input" id="bh-per-time" min="1" step="1" value="${b && b.perTimeMinutes ? b.perTimeMinutes : 30}">
      </label>

      <div class="field field-full">
        <span class="field-label">奖励设置（按上方方式结算）</span>
        <div class="reward-grid">
          <label class="field field-sm"><span class="field-label">⭐ EXP</span><input type="number" class="input" id="rw-exp" min="0" step="any" value="${r.exp || 0}"></label>
          <label class="field field-sm"><span class="field-label">🪙 金币</span><input type="number" class="input" id="rw-coins" min="0" step="any" value="${r.coins || 0}"></label>
          ${CONFIG.attributes.map(attrField).join('')}
        </div>
      </div>

      <div class="icon-picker-wrap field-full">
        <span class="field-label">快捷图标</span>
        <div class="icon-grid"></div>
      </div>
    </div>`;

  const mask = UI.openModal({
    title: b ? '✏️ 编辑行为' : '✨ 新建行为',
    content, wide: true,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: b ? '保存修改' : '创建行为', class: 'btn-primary', onClick: (m, close) => {
          const name = UI.$('#bh-name', m).value.trim();
          if (!name) { UI.toast('行为名称不能为空', 'error'); return; }
          const perTimeEl = UI.$('#bh-per-time', m);
          const rewardType = m.querySelector('input[name="reward-type"]:checked').value;
          const perTimeMinutes = Math.max(1, parseInt(perTimeEl.value, 10) || 30);
          const rewards = {};
          let numErr = false;
          ['exp', 'coins', ...CONFIG.attributes.map(a => a.key)].forEach(k => {
            const v = parseFloat(UI.$(`#rw-${k}`, m).value);
            if (isNaN(v) || v < 0) numErr = true;
            rewards[k] = isNaN(v) || v < 0 ? 0 : v;
          });
          if (numErr) { UI.toast('奖励数值不能为负数', 'error'); return; }
          if (rewardType === 'per_time' && perTimeMinutes < 1) { UI.toast('按时间模式下，每轮分钟数至少为 1', 'error'); return; }

          const data = {
            name,
            categoryId: UI.$('#bh-category', m).value,
            icon: UI.$('#bh-icon', m).value.trim() || '⚡',
            description: UI.$('#bh-desc', m).value.trim(),
            unit: UI.$('#bh-unit', m).value.trim(),
            rewardType,
            perTimeMinutes,
            rewards,
          };
          if (b) { Object.assign(b, data); UI.toast(`已保存「${UI.esc(name)}」`, 'success'); }
          else { state.behaviors.push({ id: uid(), ...data }); UI.toast(`已创建「${UI.esc(name)}」`, 'success'); }
          saveState();
          close();
          App.refresh();
        } },
    ],
  });

  // 奖励方式切换 → 显示/隐藏"每 N 分钟"
  UI.$$('input[name="reward-type"]', mask).forEach(radio =>
    radio.addEventListener('change', () => {
      UI.$('#per-time-field', mask).style.display = radio.value === 'per_time' ? '' : 'none';
      UI.$$('.radio-card', mask).forEach(c =>
        c.classList.toggle('active', c.querySelector('input').checked));
    }));
  UI.iconPicker(mask, UI.$('#bh-icon', mask));

  // 智能生成描述
  UI.$('#bh-gen-desc', mask).addEventListener('click', () => {
    const name = UI.$('#bh-name', mask).value.trim();
    if (!name) { UI.toast('请先填写行为名称', 'error'); return; }
    UI.$('#bh-desc', mask).value = UI.generateDescription(name, 'behavior');
  });
}

/* ================= 分类管理弹窗 ================= */

function openCategoryManager() {
  const renderList = mask => {
    const listEl = UI.$('#cat-list', mask);
    listEl.innerHTML = state.categories.length ? state.categories.map(c => `
      <div class="cat-row" data-id="${c.id}">
        <span class="cat-row-icon">${UI.esc(c.icon)}</span>
        <span class="cat-row-name">${UI.esc(c.name)}</span>
        <button class="btn btn-ghost btn-sm act-cat-edit">✏️</button>
        <button class="btn btn-ghost btn-sm act-cat-del">🗑️</button>
      </div>`).join('')
      : UI.emptyState('🏷️', '暂无分类，在上方新建一个吧');
    UI.$$('.cat-row', listEl).forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.act-cat-edit').addEventListener('click', () => {
        const c = state.categories.find(x => x.id === id);
        UI.$('#cat-name', mask).value = c.name;
        UI.$('#cat-icon', mask).value = c.icon;
        UI.$('#cat-form-id', mask).value = c.id;
        UI.$('#cat-save-btn', mask).textContent = '保存修改';
      });
      row.querySelector('.act-cat-del').addEventListener('click', async () => {
        const c = state.categories.find(x => x.id === id);
        const used = state.behaviors.filter(b => b.categoryId === id).length;
        const ok = await UI.confirmDialog(
          `删除分类「${UI.esc(c.name)}」？${used ? `<br><small>有 ${used} 个行为将变为"未分类"。</small>` : ''}`);
        if (!ok) return;
        state.categories = state.categories.filter(x => x.id !== id);
        saveState();
        UI.toast(`已删除分类「${UI.esc(c.name)}」`, 'info');
        renderList(mask);
        App.refresh();
      });
    });
  };

  const mask = UI.openModal({
    title: '🏷️ 管理分类',
    content: `
      <div class="cat-form">
        <input type="hidden" id="cat-form-id" value="">
        <input type="text" class="input" id="cat-icon" maxlength="4" placeholder="图标">
        <input type="text" class="input" id="cat-name" maxlength="10" placeholder="分类名称">
        <button class="btn btn-primary" id="cat-save-btn">＋ 新建分类</button>
      </div>
      <div class="cat-list" id="cat-list"></div>`,
  });

  UI.$('#cat-save-btn', mask).addEventListener('click', () => {
    const idEl = UI.$('#cat-form-id', mask);
    const name = UI.$('#cat-name', mask).value.trim();
    if (!name) { UI.toast('请填写分类名称', 'error'); return; }
    const icon = UI.$('#cat-icon', mask).value.trim() || '🏷️';
    if (idEl.value) {
      const c = state.categories.find(x => x.id === idEl.value);
      if (c) { c.name = name; c.icon = icon; }
      idEl.value = '';
      UI.$('#cat-save-btn', mask).textContent = '＋ 新建分类';
    } else {
      state.categories.push({ id: uid(), name, icon });
    }
    saveState();
    renderList(mask);
    App.refresh();
  });

  renderList(mask);
}
