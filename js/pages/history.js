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

  PERIOD_NAMES: { day: '日', week: '周', month: '月', calendar: '日历' },

  render(view) {
    const base = shiftedBase(this.period, this.offset);
    const stats = periodStats(this.period, base);
    const rangeText = periodLabel(this.period, base);
    const isCurrent = this.offset === 0;
    const isCalendar = this.period === 'calendar';

    // 列表模式才需要的分组计算（日历视图自行按天聚合）
    let groupKeys = [];
    let groups = new Map();
    if (!isCalendar) {
      const records = state.history
        .filter(r => this.filterBehavior === 'all' || r.behaviorId === this.filterBehavior)
        .slice()
        .sort((a, b) => b.time - a.time);
      records.forEach(r => {
        const key = groupKeyOf(r.time, this.period);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      });
      groupKeys = Array.from(groups.keys()).sort().reverse();
    }

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

        ${isCalendar ? this.renderCalendarHTML(base) : `
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
        `}
      </div>
    `;

    // 日/周/月/日历切换（共通）
    UI.$$('[data-period]', view).forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.period === this.period) return;
      this.period = btn.dataset.period;
      this.offset = 0;
      this.collapsed = {};
      this.render(view);
    }));

    // 上一个 / 下一个（共通）
    $('#period-prev').addEventListener('click', () => { this.offset -= 1; this.render(view); });
    $('#period-next').addEventListener('click', () => {
      if (this.offset < 0) { this.offset += 1; this.render(view); }
    });
    const backBtn = $('#back-current');
    if (backBtn) backBtn.addEventListener('click', () => { this.offset = 0; this.render(view); });

    $('#btn-summary-modal').addEventListener('click', () => this.openSummaryModal());

    if (isCalendar) {
      // 日历格子点击 → 当天详情弹窗
      UI.$$('[data-day]', view).forEach(btn => btn.addEventListener('click', () => {
        this.openDaySummaryModal(btn.dataset.day);
      }));
    } else {
      // 行为筛选
      UI.$$('[data-bh]', view).forEach(ch => ch.addEventListener('click', () => {
        this.filterBehavior = ch.dataset.bh;
        this.render(view);
      }));

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
    }
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

  /** 日历视图 HTML：当月每天一格，粗略显示 EXP/金币，点击看详情 */
  renderCalendarHTML(base) {
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-11
    const todayKey = dateKey(new Date());

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 预先按天聚合当月统计
    const dayStats = {};
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    state.history.forEach(r => {
      const t = new Date(r.time);
      if (t < monthStart || t > monthEnd) return;
      const k = dateKey(t);
      if (!dayStats[k]) dayStats[k] = { exp: 0, coins: 0, completions: 0,
        health: 0, intelligence: 0, fitness: 0, discipline: 0 };
      const s = dayStats[k];
      s.exp += r.gained.exp || 0;
      s.coins += r.gained.coins || 0;
      CONFIG.attributes.forEach(a => { s[a.key] += r.gained[a.key] || 0; });
      s.completions += 1;
    });
    Object.values(dayStats).forEach(s => {
      s.exp = Math.round(s.exp * 10) / 10;
      s.coins = Math.round(s.coins * 10) / 10;
      CONFIG.attributes.forEach(a => { s[a.key] = Math.round(s[a.key] * 10) / 10; });
    });

    // 构建格子（月初前的空白 + 每一天）
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const k = dateKey(date);
      cells.push({
        date, key: k,
        stats: dayStats[k] || null,
        isToday: k === todayKey,
        isFuture: k > todayKey,
      });
    }

    const weekdayHeader = ['日', '一', '二', '三', '四', '五', '六'];

    return `
      <section class="card calendar-card">
        <div class="cal-legend">
          <span class="cal-leg-item"><i class="cal-leg-dot cal-leg-today"></i>今天</span>
          <span class="cal-leg-item"><i class="cal-leg-dot cal-leg-has"></i>有记录</span>
          <span class="cal-leg-hint">点击日期查看当天详情</span>
        </div>
        <div class="cal-weekday">
          ${weekdayHeader.map((w, i) => `<div class="cal-wd${i === 0 || i === 6 ? ' cal-wd-end' : ''}">${w}</div>`).join('')}
        </div>
        <div class="cal-grid">
          ${cells.map(c => {
            if (!c) return '<div class="cal-cell cal-blank"></div>';
            const has = c.stats && c.stats.completions > 0;
            const cls = ['cal-cell'];
            if (c.isToday) cls.push('cal-today');
            if (c.isFuture) cls.push('cal-future');
            if (has) cls.push('cal-has');
            let inner = `<div class="cal-day-num">${c.date.getDate()}</div>`;
            if (has) {
              inner += `<div class="cal-mini">` +
                `<div class="cal-mini-exp">+${fmtNum(c.stats.exp)}</div>` +
                `<div class="cal-mini-coin">+${fmtNum(c.stats.coins)}🪙</div>` +
                `</div>`;
            }
            return `<button type="button" class="${cls.join(' ')}" data-day="${c.key}"${c.isFuture ? ' disabled' : ''}>${inner}</button>`;
          }).join('')}
        </div>
      </section>`;
  },

  /** 某天详情弹窗（日历格子点击） */
  openDaySummaryModal(dayKey) {
    const d = new Date(dayKey + 'T00:00:00');
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const stats = { exp: 0, coins: 0, completions: 0,
      health: 0, intelligence: 0, fitness: 0, discipline: 0 };
    state.history.forEach(r => {
      const t = new Date(r.time);
      if (t < start || t > end) return;
      stats.exp += r.gained.exp || 0;
      stats.coins += r.gained.coins || 0;
      CONFIG.attributes.forEach(a => { stats[a.key] += r.gained[a.key] || 0; });
      stats.completions += 1;
    });
    stats.exp = Math.round(stats.exp * 10) / 10;
    stats.coins = Math.round(stats.coins * 10) / 10;
    CONFIG.attributes.forEach(a => { stats[a.key] = Math.round(stats[a.key] * 10) / 10; });

    const weekday = WEEKDAYS_CN[d.getDay()];
    const todayK = dateKey();
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const tag = dayKey === todayK ? ' · 今天' : dayKey === dateKey(yest) ? ' · 昨天' : '';

    const content = `
      <div class="summary-modal">
        <div class="summary-date">📅 ${dayKey} ${weekday}${tag}</div>
        <div class="summary-rows">
          <div class="summary-row big"><span>EXP</span><span class="sv sv-exp">+${fmtNum(stats.exp)}</span></div>
          <div class="summary-row big"><span>金币</span><span class="sv sv-coin">+${fmtNum(stats.coins)} 🪙</span></div>
          ${CONFIG.attributes.map(a => `
            <div class="summary-row"><span>${a.icon} ${a.name}</span>
            <span class="sv" style="color:${a.color}">+${fmtNum(stats[a.key])}</span></div>`).join('')}
          <div class="summary-row"><span>⚔️ 完成行为</span><span class="sv">${stats.completions} 次</span></div>
        </div>
        ${stats.completions === 0 ? `<p class="summary-hint">这一天还没有记录。</p>` : ''}
      </div>`;
    UI.openModal({
      title: `📅 ${dayKey} ${weekday}`,
      content,
      actions: [{ label: '好的', class: 'btn-primary' }],
    });
  },
};
