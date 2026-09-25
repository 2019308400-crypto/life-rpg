/* ============================================================
 * LIFE RPG - 页面：商店
 * 商品 CRUD / 金币购买 / 消费记录（内容全部由用户自建）
 * ============================================================ */

Pages = window.Pages || {};
Pages.shop = {

  render(view) {
    const p = state.player;
    // 商品按价格从低到高排序展示（不改原数组，仅展示排序）
    const sortedItems = [...state.shopItems].sort((a, b) => (a.price || 0) - (b.price || 0));

    view.innerHTML = `
      <div class="page anim-in">
        <div class="page-head">
          <h1>🛒 商店</h1>
          <div class="head-actions">
            <span class="coin-chip coin-chip-lg">🪙 ${fmtNum(p.coins)}</span>
            <button class="btn btn-primary" id="btn-new-item">＋ 新建商品</button>
          </div>
        </div>

        <div class="shop-grid">
          ${sortedItems.length ? sortedItems.map(item => {
            const afford = p.coins >= item.price;
            return `
            <div class="card shop-card" data-id="${item.id}">
              <div class="shop-item-top">
                <span class="shop-item-icon">${UI.esc(item.icon || '🎁')}</span>
                <div class="shop-item-info">
                  <div class="shop-item-name">${UI.esc(item.name)}</div>
                  ${item.description ? `<div class="shop-item-desc">${UI.esc(item.description)}</div>` : ''}
                </div>
              </div>
              <div class="shop-item-bottom">
                <span class="shop-price">🪙 ${fmtNum(item.price)}</span>
                <div class="shop-item-actions">
                  <button class="btn btn-ghost btn-sm act-item-edit">✏️</button>
                  <button class="btn btn-ghost btn-sm act-item-del">🗑️</button>
                  <button class="btn ${afford ? 'btn-gold' : 'btn-disabled'} btn-sm act-buy" ${afford ? '' : 'disabled'}>购买</button>
                </div>
              </div>
            </div>`;
          }).join('') : UI.emptyState('🛒', '商店是空的。创建一些奖励给自己吧，例如"喝奶茶" 50 金币。')}
        </div>

        <section class="card purchase-card">
          <h2>🧾 消费记录</h2>
          ${state.purchases.length ? `
          <div class="purchase-list">
            ${state.purchases.slice(0, 50).map(r => `
              <div class="purchase-row">
                <span class="purchase-icon">${UI.esc(r.icon || '🎁')}</span>
                <div class="purchase-info">
                  <span class="purchase-name">${UI.esc(r.itemName)}</span>
                  <span class="purchase-time">${formatTime(r.time)}</span>
                </div>
                <span class="purchase-price">−${fmtNum(r.price)} 🪙</span>
              </div>`).join('')}
          </div>` : UI.emptyState('🧾', '还没有消费记录')}
        </section>
      </div>
    `;

    $('#btn-new-item').addEventListener('click', () => openShopItemForm(null));
    UI.$$('.shop-card', view).forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.act-buy').addEventListener('click', async () => {
        const item = state.shopItems.find(x => x.id === id);
        const ok = await UI.confirmDialog(
          `花费 <b>${fmtNum(item.price)} 🪙</b> 购买「${UI.esc(item.name)}」？`,
          { danger: false, okText: '购买' });
        if (!ok) return;
        const res = buyItem(id);
        App.refresh();
        if (res.ok) {
          // 智能过场：奶茶→喝、游戏→手柄、礼物→礼盒……按名字自动匹配
          Cutscene.purchase(item.name, item.icon, item.price);
          Cutscene.play();
        } else UI.toast(`⚠️ ${res.reason}`, 'error');
      });
      card.querySelector('.act-item-edit').addEventListener('click', () => openShopItemForm(id));
      card.querySelector('.act-item-del').addEventListener('click', async () => {
        const item = state.shopItems.find(x => x.id === id);
        const ok = await UI.confirmDialog(`确定删除商品「${UI.esc(item.name)}」？`);
        if (!ok) return;
        state.shopItems = state.shopItems.filter(x => x.id !== id);
        saveState();
        UI.toast('商品已删除', 'info');
        App.refresh();
      });
    });
  },
};

/* ================= 新建 / 编辑商品弹窗 ================= */

function openShopItemForm(itemId) {
  const item = itemId ? state.shopItems.find(x => x.id === itemId) : null;
  const content = `
    <div class="form-grid">
      <label class="field">
        <span class="field-label">商品名称 *</span>
        <input type="text" class="input" id="sh-name" maxlength="30" placeholder="例如：喝奶茶" value="${UI.esc(item ? item.name : '')}">
      </label>
      <label class="field">
        <span class="field-label">图标（emoji）</span>
        <input type="text" class="input" id="sh-icon" maxlength="4" placeholder="🎁" value="${UI.esc(item ? item.icon : '')}">
      </label>
      <label class="field">
        <span class="field-label">金币价格 *</span>
        <input type="number" class="input" id="sh-price" min="1" step="1" placeholder="50" value="${item ? item.price : ''}">
      </label>
      <label class="field">
        <span class="field-label">描述（可选）</span>
        <div class="input-with-btn">
          <input type="text" class="input" id="sh-desc" maxlength="60" placeholder="给自己的一点奖励" value="${UI.esc(item ? item.description : '')}">
          <button type="button" class="btn btn-gen" id="sh-gen-desc">✨生成</button>
        </div>
      </label>
      <div class="field-full icon-picker-wrap">
        <span class="field-label">快捷图标</span>
        <div class="icon-grid"></div>
      </div>
    </div>`;

  const mask = UI.openModal({
    title: item ? '✏️ 编辑商品' : '✨ 新建商品',
    content,
    actions: [
      { label: '取消', class: 'btn-ghost' },
      { label: item ? '保存修改' : '创建商品', class: 'btn-primary', onClick: (m, close) => {
          const name = UI.$('#sh-name', m).value.trim();
          const price = parseInt(UI.$('#sh-price', m).value, 10);
          if (!name) { UI.toast('商品名称不能为空', 'error'); return; }
          if (isNaN(price) || price < 1) { UI.toast('价格至少为 1 金币', 'error'); return; }
          const data = {
            name,
            icon: UI.$('#sh-icon', m).value.trim() || '🎁',
            description: UI.$('#sh-desc', m).value.trim(),
            price,
          };
          if (item) { Object.assign(item, data); UI.toast('商品已保存', 'success'); }
          else { state.shopItems.push({ id: uid(), ...data }); UI.toast(`已上架「${UI.esc(name)}」`, 'success'); }
          saveState();
          close();
          App.refresh();
        } },
    ],
  });
  UI.iconPicker(mask, UI.$('#sh-icon', mask));

  // 智能生成描述
  UI.$('#sh-gen-desc', mask).addEventListener('click', () => {
    const name = UI.$('#sh-name', mask).value.trim();
    if (!name) { UI.toast('请先填写商品名称', 'error'); return; }
    UI.$('#sh-desc', mask).value = UI.generateDescription(name, 'shop');
  });
}
