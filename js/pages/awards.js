/* ============================================================
 * LIFE RPG - 页面：成就 & 称号
 * 两个独立系统，条件类型完全共用，内容由用户自建。
 * ============================================================ */

Pages = window.Pages || {};
Pages.awards = {
  tab: 'achievement', // 'achievement' | 'title'

  render(view) {
    cleanTitleRef();
    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head">
          <h1>🏆 成就 & 称号</h1>
          <div class="head-actions">
            <button class="btn btn-primary" id="btn-new-award">＋ 新建${this.tab === 'achievement' ? '成就' : '称号'}</button>
          </div>
        </div>

        <div class="tab-row">
          <button class="tab ${this.tab === 'achievement' ? 'active' : ''}" data-tab="achievement">🎖️ 成就 <span class="tab-count">${state.achievements.filter(a => a.unlocked).length}/${state.achievements.length}</span></button>
          <button class="tab ${this.tab === 'title' ? 'active' : ''}" data-tab="title">👑 称号 <span class="tab-count">${state.titles.filter(t => t.unlocked).length}/${state.titles.length}</span></button>
        </div>

        <div class="award-list">${this.tab === 'achievement' ? this.renderAchievements() : this.renderUpcomingTitles() + this.renderTitles()}</div>
      </div>
    `;

    UI.$$('.tab', view).forEach(t => t.addEventListener('click', () => {
      this.tab = t.dataset.tab;
      this.render(view);
    }));
    $('#btn-new-award').addEventListener('click', () => openAwardForm(this.tab, null));

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

  renderAchievements() {
    if (!state.achievements.length) return UI.emptyState('🎖️', '还没有成就。创建一个吧，例如"第一次完成任意行为"。');
    return state.achievements.map(a => {
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
    }).join('');
  },

  /** 称号页顶部：按进度排序展示最接近解锁的未解锁称号（最多 3 个） */
  renderUpcomingTitles() {
    const locked = state.titles.filter(t => !t.unlocked);
    if (!locked.length) return '';
    const ranked = locked.map(t => {
      const prog = conditionProgress(t.condition);
      const pct = prog.target > 0 ? prog.current / prog.target : 0;
      return { t, prog, pct };
    }).sort((a, b) => b.pct - a.pct);
    const top = ranked.slice(0, 3);
    if (!top.length) return '';
    return `
      <div class="card upcoming-card">
        <div class="upcoming-head">🚀 即将解锁 · 升级/努力就能拿到的新称号</div>
        <div class="upcoming-list">
          ${top.map(({ t, prog, pct }) => {
            const remain = prog.target > prog.current ? fmtNum(prog.target - prog.current) : 0;
            const remainText =
              (t.condition.type === 'level') ? `再升 ${remain} 级` :
              (t.condition.type === 'attribute') ? `还差 ${remain}` :
              `还差 ${remain}`;
            return `
            <div class="upcoming-item">
              <span class="upcoming-icon">${UI.esc(t.icon || '👑')}</span>
              <div class="upcoming-info">
                <div class="upcoming-name">${UI.esc(t.name)}</div>
                <div class="upcoming-cond">${UI.esc(conditionText(t.condition))}</div>
              </div>
              <div class="upcoming-meta">
                <div class="award-bar"><div class="award-fill" style="width:${Math.min(100, pct * 100)}%"></div></div>
                <span class="upcoming-remain">${remainText}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  renderTitles() {
    if (!state.titles.length) return UI.emptyState('👑', '还没有称号。创建一个吧，例如"终身学习者：Intelligence ≥ 50"。');
    return state.titles.map(t => {
      const prog = conditionProgress(t.condition);
      const equipped = state.player.titleId === t.id;
      const remaining = prog.target > prog.current ? fmtNum(prog.target - prog.current) : 0;
      const remainText = t.unlocked ? '' :
        (t.condition.type === 'level') ? `还需升级 ${remaining} 次` :
        (t.condition.type === 'attribute') ? `还差 ${remaining}` :
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
                const rw = entry.rewards || {};
                setTimeout(() => {
                  UI.toast(`🏆 成就已解锁：${UI.esc(entry.icon)} ${UI.esc(entry.name)}` +
                    (rw.exp || rw.coins ? `（+${fmtNum(rw.exp)} EXP +${fmtNum(rw.coins)} 🪙）` : ''), 'unlock', 3600);
                  ups.forEach(([from, to], i) => setTimeout(() => UI.levelUpOverlay(from, to), 300 + i * 400));
                }, 100);
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

  const sync = () => {
    const needs = condNeeds(typeSel.value);
    bSel.style.display = needs.includes('behaviorId') ? '' : 'none';
    aSel.style.display = needs.includes('attribute') ? '' : 'none';
    vInput.style.display = needs.includes('value') ? '' : 'none';
    descEl.textContent = (CONFIG.conditionTypes[typeSel.value] || {}).desc || '';
  };
  typeSel.addEventListener('change', sync);
  UI.iconPicker(mask, UI.$('#aw-icon', mask));

  // 智能生成描述
  UI.$('#aw-gen-desc', mask).addEventListener('click', () => {
    const name = UI.$('#aw-name', mask).value.trim();
    if (!name) { UI.toast('请先填写名称', 'error'); return; }
    UI.$('#aw-desc', mask).value = UI.generateDescription(name, isAch ? 'achievement' : 'title');
  });
  sync();
}
