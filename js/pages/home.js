/* ============================================================
 * LIFE RPG - 页面：首页
 * 等级 / EXP / 金币 / 四属性 / 称号 / 今日概况 / 完成行为入口
 * ============================================================ */

Pages = window.Pages || {};
Pages.home = {

  render(view) {
    cleanTitleRef();
    const p = state.player;
    const need = expToNext(p.level);
    const pct = Math.min(100, (p.exp / need) * 100);
    const today = todayStats();
    const title = state.titles.find(t => t.id === p.titleId);

    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head">
          <h1>⚔️ 角色面板</h1>
        </div>

        <!-- 角色 HUD -->
        <section class="card player-card">
          <div class="player-top">
            <div class="avatar">
              <span class="avatar-emoji">🧙</span>
              <span class="level-badge">Lv.${p.level}</span>
            </div>
            <div class="player-info">
              <div class="player-name-row">
                <span class="player-name">冒险者</span>
                ${title ? `<span class="title-chip">${UI.esc(title.icon)} ${UI.esc(title.name)}</span>` : ''}
              </div>
              <div class="exp-row">
                <div class="exp-bar"><div class="exp-fill" style="width:${pct}%"></div></div>
                <span class="exp-text">${fmtNum(p.exp)} / ${fmtNum(need)} EXP</span>
              </div>
              <div class="coin-row"><span class="coin-chip">🪙 ${fmtNum(p.coins)}</span></div>
            </div>
          </div>
        </section>

        <!-- 四属性 -->
        <section class="attr-grid">
          ${CONFIG.attributes.map(a => {
            const v = p.attributes[a.key] || 0;
            const mpct = Math.min(100, (v / (a.milestone || 100)) * 100);
            return `
            <div class="card attr-card" style="--attr-color:${a.color}">
              <div class="attr-head"><span class="attr-icon">${a.icon}</span><span class="attr-name">${a.name}</span></div>
              <div class="attr-value">${fmtNum(v)}</div>
              <div class="attr-bar"><div class="attr-fill" style="width:${mpct}%"></div></div>
              <div class="attr-milestone">目标 ${a.milestone}</div>
            </div>`;
          }).join('')}
        </section>

        <!-- 今日概况 -->
        <section class="card today-card">
          <div class="today-head">
            <h2>📅 今日战绩</h2>
            <button class="btn btn-ghost btn-sm" id="btn-daily-summary">今日总结</button>
          </div>
          <div class="today-grid">
            <div class="today-item"><span class="ti-label">今日 EXP</span><span class="ti-value ti-exp">+${fmtNum(today.exp)}</span></div>
            <div class="today-item"><span class="ti-label">今日金币</span><span class="ti-value ti-coin">+${fmtNum(today.coins)} 🪙</span></div>
            <div class="today-item"><span class="ti-label">完成行为</span><span class="ti-value">${today.completions} 次</span></div>
          </div>
        </section>

        <!-- 主行动按钮 -->
        <button class="btn-primary-big" id="btn-complete">
          <span class="big-icon">⚔️</span><span>完成行为</span>
        </button>

        <p class="home-hint">去 <a href="#/behavior">行为</a> 页面创建属于你的人生规则 —— 程序只提供引擎，内容由你决定。</p>

        <!-- 备份 / 恢复 -->
        <section class="card backup-card">
          <h2>💾 存档管理</h2>
          <p class="backup-tip">定期备份，防止浏览器数据被清空后丢失。</p>
          <div class="backup-actions">
            <button class="btn btn-ghost" id="btn-export">📤 导出备份</button>
            <button class="btn btn-ghost" id="btn-import">📥 恢复存档</button>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
          </div>
        </section>
      </div>
    `;

    $('#btn-complete').addEventListener('click', () => openCompleteModal(null));
    $('#btn-daily-summary').addEventListener('click', () => Pages.history.openDailySummaryModal());

    $('#btn-export').addEventListener('click', () => {
      if (exportBackup()) {
        UI.toast('✅ 备份已导出，请妥善保存文件', 'success');
      } else {
        UI.toast('⚠️ 备份失败，请重试', 'error');
      }
    });

    const fileInput = $('#import-file');
    $('#btn-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!confirm('恢复将覆盖当前所有数据，确定继续吗？')) {
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const res = importBackup(String(reader.result || ''));
        if (res.ok) {
          UI.toast('✅ ' + res.msg, 'success');
          App.refresh();
        } else {
          UI.toast('⚠️ ' + res.msg, 'error');
        }
        fileInput.value = '';
      };
      reader.onerror = () => {
        UI.toast('⚠️ 文件读取失败', 'error');
        fileInput.value = '';
      };
      reader.readAsText(file);
    });
  },
};
