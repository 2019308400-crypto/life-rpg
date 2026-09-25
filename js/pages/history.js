/* ============================================================
 * LIFE RPG - 页面：历史 & 总结
 * 支持日 / 周 / 月三种计数单位，记录可折叠分组。
 * 每条记录保存"当时实际获得的奖励"，永不重算。
 * ============================================================ */

Pages = window.Pages || {};
Pages.history = {
  filterBehavior: 'all',
  period: 'day',      // day | week | month
  offset: 0,          // 0=当前周期，-1=上一个，1=下一个
  collapsed: {},      // 分组折叠状态

  PERIOD_NAMES: { day: '日', week: '周', month: '月' },

  render(view) {
    const base = shiftedBase(this.period, this.offset);
    const stats = periodStats(this.period, base);
    const rangeText = periodLabel(this.period, base);
    const isCurrent = this.offset === 0;

    // 筛选后的记录（新的在前）
    const records = state.history
      .filter(r => this.filterBehavior === 'all' || r.behaviorId === this.filterBehavior)
      .slice()
      .sort((a, b) => b.time - a.time);

    // 按周期分组
    const groups = new Map();
    records.forEach(r => {
      const key = groupKeyOf(r.time, this.period);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    const groupKeys = Array.from(groups.keys()).sort().reverse();

    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head"><h1>📜 历史 & 总结</h1></div>

        <!-- 周期总结卡片 -->
        <section class="card daily-card">
          <div class="daily-head">
            <h2>📅 ${this.PERIOD_NAMES[this.period]}总结</h2>
            <button class="btn btn-ghost btn-sm" id="btn-summary-modal">弹窗查看</button>
          </div>

          <!-- 单位切换 + 前后翻页 -->
          <div class="period-bar">
            <button class="period-arrow" id="period-prev" title="上一个${this.PERIOD_NAMES[this.period]}">◀</button>
            <div class="period-seg">
              ${Object.entries(this.PERIOD_NAMES).map(([k, v]) => `
                <button class="seg-item ${this.period === k ? 'active' : ''}" data-period="${k}">${v}</button>`).join('')}
            </div>
            <button class="period-arrow" id="period-next" title="下一个${this.PERIOD_NAMES[this.period]}"
              ${isCurrent ? 'disabled' : ''}>▶</button>
          </div>
          <div class="period-range">
            ${rangeText}
            ${isCurrent ? '<span class="now-tag">当前</span>'
              : '<button class="link-btn" id="back-current">回到当前</button>'}
          </div>

          <div class="daily-grid">
            <div class="daily-item"><span class="di-label">EXP</span><span class="di-value di-exp">+${fmtNum(stats.exp)}</span></div>
            <div class="daily-item"><span class="di-label">金币</span><span class="di-value di-coin">+${fmtNum(stats.coins)} 🪙</span></div>
            <div class="daily-item"><span class="di-label">完成行为</span><span class="di-value">${stats.completions} 次</span></div>
            ${CONFIG.attributes.map(a => `
              <div class="daily-item"><span class="di-label">${a.icon} ${a.name}</span>
              <span class="di-value" style="color:${a.color}">+${fmtNum(stats[a.key])}</span></div>`).join('')}
          </div>
        </section>

        <!-- 行为筛选 -->
        <div class="chip-row chip-row-scroll">
          <button class="chip ${this.filterBehavior === 'all' ? 'active' : ''}" data-bh="all">全部</button>
          ${state.behaviors.map(b => `
            <button class="chip ${this.filterBehavior === b.id ? 'active' : ''}" data-bh="${b.id}">
              ${UI.esc(b.icon)} ${UI.esc(b.name)}
            </button>`).join('')}
        </div>

        <!-- 分组记录列表 -->
        ${groupKeys.length ? groupKeys.map(key => this.renderGroup(key, groups.get(key))).join('')
          : UI.emptyState('📜', '这个范围内还没有记录。')}
      </div>
    `;

    // 行为筛选
    UI.$$('[data-bh]', view).forEach(ch => ch.addEventListener('click', () => {
      this.filterBehavior = ch.dataset.bh;
      this.render(view);
    }));

    // 日/周/月切换
    UI.$$('[data-period]', view).forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.period === this.period) return;
      this.period = btn.dataset.period;
      this.offset = 0;
      this.collapsed = {};
      this.render(view);
    }));

    // 上一个 / 下一个
    $('#period-prev').addEventListener('click', () => { this.offset -= 1; this.render(view); });
    $('#period-next').addEventListener('click', () => {
      if (this.offset < 0) { this.offset += 1; this.render(view); }
    });
    const backBtn = $('#back-current');
    if (backBtn) backBtn.addEventListener('click', () => { this.offset = 0; this.render(view); });

    $('#btn-summary-modal').addEventListener('click', () => this.openSummaryModal());

    // 分组折叠 / 展开
    UI.$$('.hg-toggle', view).forEach(el => el.addEventListener('click', () => {
      const key = el.dataset.gkey;
      this.collapsed[key] = !this.collapsed[key];
      el.classList.toggle('collapsed', this.collapsed[key]);
      const body = el.nextElementSibling;
      if (body) body.style.display = this.collapsed[key] ? 'none' : '';
    }));

    // 撤回记录：二次确认 → 反向扣回奖励 → 刷新
    UI.$$('.hc-del', view).forEach(btn => btn.addEventListener('click', async () => {
      const rec = state.history.find(r => r.id === btn.dataset.rid);
      if (!rec) return;
      const g = rec.gained || {};
      const msg = `撤回 <b>${UI.esc(rec.behaviorName)}</b>（${fmtNum(rec.quantity)} ${UI.esc(rec.unit || '')}）？` +
        `<br><br>将扣回：${UI.gainBadges(g, { skipZero: false })}` +
        `<br><br><span style="color:var(--text-dim,#999);font-size:13px">金币/属性不足时扣到 0，EXP 不足会降级。</span>`;
      const ok = await UI.confirmDialog(msg, { okText: '确认撤回' });
      if (!ok) return;
      const res = removeRecord(rec.id);
      if (!res) return;
      this.render(view);

      // 撤回反馈
      const parts = [];
      if (g.exp) parts.push(`<span class="rw rw-exp">-${fmtNum(g.exp)} EXP</span>`);
      if (g.coins) parts.push(`<span class="rw rw-coin">-${fmtNum(g.coins)} 🪙</span>`);
      CONFIG.attributes.forEach(a => {
        if (g[a.key]) parts.push(`<span class="rw rw-attr" style="--rw-color:${a.color}">-${fmtNum(g[a.key])} ${a.icon}</span>`);
      });
      parts.push('已撤回');
      if (res.levelDowns.length) {
        const [from, to] = res.levelDowns[res.levelDowns.length - 1];
        parts.push(`<b style="color:#ff9f43">Lv.${from} → Lv.${to}</b>`);
      }
      UI.toast(parts.join(''), 'reward', 3200);
    }));
  },

  /** 渲染一个分组（标题含汇总，内容可折叠） */
  renderGroup(key, recs) {
    const s = sumRecords(recs);
    const isCollapsed = !!this.collapsed[key];
    return `
      <div class="hist-group">
        <button class="hg-toggle ${isCollapsed ? 'collapsed' : ''}" data-gkey="${key}">
          <span class="hg-caret">▾</span>
          <span class="hg-title">${groupLabel(key, this.period)}</span>
          <span class="hg-sum">
            <span class="hgs-item">+${fmtNum(s.exp)} EXP</span>
            <span class="hgs-item">+${fmtNum(s.coins)} 🪙</span>
            ${CONFIG.attributes.filter(a => s[a.key]).map(a =>
              `<span class="hgs-item" style="color:${a.color}">+${fmtNum(s[a.key])} ${a.icon}</span>`).join('')}
            <span class="hgs-count">${s.completions} 条</span>
          </span>
        </button>
        <div class="hg-body" style="display:${isCollapsed ? 'none' : ''}">
          ${recs.map(r => `
            <div class="card history-card">
              <div class="hc-main">
                <span class="hc-icon">${UI.esc(r.behaviorIcon || '⚡')}</span>
                <div class="hc-info">
                  <div class="hc-name-row">
                    <span class="hc-name">${UI.esc(r.behaviorName)}</span>
                    <span class="hc-qty">${fmtNum(r.quantity)} ${UI.esc(r.unit || '')}</span>
                  </div>
                  <div class="hc-time">${formatTime(r.time)}</div>
                  <div class="hc-gains">${UI.gainBadges(r.gained)}</div>
                </div>
              </div>
              <button class="hc-del" data-rid="${r.id}" title="撤回这条记录（扣回奖励）" aria-label="撤回">↩️</button>
            </div>`).join('')}
        </div>
      </div>`;
  },

  /** 周期总结弹窗（首页也可调用，默认今日） */
  openSummaryModal() {
    const base = shiftedBase(this.period, this.offset);
    const stats = periodStats(this.period, base);
    const content = `
      <div class="summary-modal">
        <div class="summary-date">📅 ${periodLabel(this.period, base)}（${this.PERIOD_NAMES[this.period]}总结）</div>
        <div class="summary-rows">
          <div class="summary-row big">
            <span>EXP</span><span class="sv sv-exp">+${fmtNum(stats.exp)}</span>
          </div>
          <div class="summary-row big">
            <span>金币</span><span class="sv sv-coin">+${fmtNum(stats.coins)} 🪙</span>
          </div>
          ${CONFIG.attributes.map(a => `
            <div class="summary-row">
              <span>${a.icon} ${a.name}</span>
              <span class="sv" style="color:${a.color}">+${fmtNum(stats[a.key])}</span>
            </div>`).join('')}
          <div class="summary-row">
            <span>⚔️ 完成行为</span><span class="sv">${stats.completions} 次</span>
          </div>
        </div>
        ${stats.completions === 0 ? `<p class="summary-hint">这个${this.PERIOD_NAMES[this.period]}还没有记录，去完成一个行为吧！</p>` : ''}
      </div>`;
    UI.openModal({
      title: `📅 ${this.PERIOD_NAMES[this.period]}总结`,
      content,
      actions: [{ label: '好的', class: 'btn-primary' }],
    });
  },

  /** 首页调用：始终打开今日总结 */
  openDailySummaryModal() {
    this.period = 'day';
    this.offset = 0;
    this.openSummaryModal();
  },
};
