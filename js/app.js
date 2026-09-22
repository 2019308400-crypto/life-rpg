/* ============================================================
 * LIFE RPG - 应用入口
 * Hash 路由 / 导航（桌面侧边栏 + 手机底部导航）
 * ============================================================ */

const App = (() => {

  const NAV = [
    { id: 'home',     path: '#/home',     icon: '🏰', label: '首页' },
    { id: 'behavior', path: '#/behavior', icon: '⚔️', label: '行为' },
    { id: 'shop',     path: '#/shop',     icon: '🛒', label: '商店' },
    { id: 'awards',   path: '#/awards',   icon: '🏆', label: '成就' },
    { id: 'history',  path: '#/history',  icon: '📜', label: '历史' },
  ];

  let currentRoute = 'home';

  function parseRoute() {
    const hash = location.hash || '#/home';
    const found = NAV.find(n => n.path === hash);
    return found ? found.id : 'home';
  }

  function renderNav() {
    const side = document.getElementById('side-nav');
    const bottom = document.getElementById('bottom-nav');
    side.innerHTML = NAV.map(n => `
      <a class="nav-item ${n.id === currentRoute ? 'active' : ''}" href="${n.path}" data-id="${n.id}">
        <span class="nav-icon">${n.icon}</span><span class="nav-label">${n.label}</span>
      </a>`).join('');
    bottom.innerHTML = NAV.map(n => `
      <a class="nav-item ${n.id === currentRoute ? 'active' : ''}" href="${n.path}" data-id="${n.id}">
        <span class="nav-icon">${n.icon}</span><span class="nav-label">${n.label}</span>
      </a>`).join('');
  }

  function renderPage() {
    const view = document.getElementById('page-view');
    const page = Pages[currentRoute];
    view.innerHTML = '';
    if (page && typeof page.render === 'function') {
      try { page.render(view); }
      catch (e) { console.error('页面渲染失败', e); view.innerHTML = `<div class="page">${UI.emptyState('⚠️', '页面渲染出错，请刷新重试')}</div>`; }
    }
    window.scrollTo(0, 0);
  }

  /** 任何数据变更后调用：重渲染当前页面 */
  function refresh() {
    renderPage();
  }

  function onHashChange() {
    const route = parseRoute();
    if (route !== currentRoute) currentRoute = route;
    renderNav();
    renderPage();
  }

  function init() {
    window.addEventListener('hashchange', onHashChange);
    if (!location.hash) location.hash = '#/home';
    onHashChange();
    console.log('⚔️ LIFE RPG V1.0 启动完成');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { refresh, nav: NAV };
})();
