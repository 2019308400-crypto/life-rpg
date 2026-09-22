/* ============================================================
 * LIFE RPG - 页面：历史 & 每日总结
 * 每条记录保存"当时实际获得的奖励"，永不重算。
 * ============================================================ */

Pages = window.Pages || {};
Pages.history = {
  filterBehavior: 'all',

  render(view) {
    const today = todayStats();

    // 筛选后的记录（新的在前）
    const records = state.history
      .filter(r => this.filterBehavior === 'all' || r.behaviorId === this.filterBehavior)
      .slice()
      .reverse();

    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head"><h1>📜 历史 & 每日总结</h1></div>

        <!-- 今日总结卡片 -->
        <section class="card daily-card">
          <div class="daily-head">
            <h2>📅 今日总结 <span class="daily-date">${dateKey()}</span></h2>
            <button class="btn btn-ghost btn-sm" id="btn-summary-modal">弹窗查看</button>
          </div>
          <div class="daily-grid">
            <div class="daily-item"><span class="di-label">EXP</span><span class="di-value di-exp">+${fmtNum(today.exp)}</span></div>
            <div class="daily-item"><span class="di-label">金币</span><span class="di-value di-coin">+${fmtNum(today.coins)} 🪙</span></div>
            <div class="daily-item"><span class="di-label">完成行为</span><span class="di-value">${today.completions} 次</span></div>
            ${CONFIG.attributes.map(a => `
              <div class="daily-item"><span class="di-label">${a.icon} ${a.name}</span>
              <span class="di-value" style="color:${a.color}">+${fmtNum(today[a.key])}</span></div>`).join('')}
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

        <!-- 记录列表 -->
        <div class="history-list">
          ${records.length ? records.map(r => `
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
            </div>`).join('') : UI.emptyState('📜', '还没有记录。完成一个行为试试！')}
        </div>
      </div>
    `;

    UI.$$('.chip', view).forEach(ch => ch.addEventListener('click', () => {
      this.filterBehavior = ch.dataset.bh;
      this.render(view);
    }));
    $('#btn-summary-modal').addEventListener('click', () => this.openDailySummaryModal());
  },

  /** 每日总结弹窗（首页也可调用） */
  openDailySummaryModal() {
    const today = todayStats();
    const content = `
      <div class="summary-modal">
        <div class="summary-date">📅 ${dateKey()}</div>
        <div class="summary-rows">
          <div class="summary-row big">
            <span>EXP</span><span class="sv sv-exp">+${fmtNum(today.exp)}</span>
          </div>
          <div class="summary-row big">
            <span>金币</span><span class="sv sv-coin">+${fmtNum(today.coins)} 🪙</span>
          </div>
          ${CONFIG.attributes.map(a => `
            <div class="summary-row">
              <span>${a.icon} ${a.name}</span>
              <span class="sv" style="color:${a.color}">+${fmtNum(today[a.key])}</span>
            </div>`).join('')}
          <div class="summary-row">
            <span>⚔️ 完成行为</span><span class="sv">${today.completions} 次</span>
          </div>
        </div>
        ${today.completions === 0 ? '<p class="summary-hint">今天还没有记录，去完成一个行为吧！</p>' : ''}
      </div>`;
    UI.openModal({ title: '📅 今日总结', content, actions: [{ label: '好的', class: 'btn-primary' }] });
  },
};
