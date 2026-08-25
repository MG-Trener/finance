// Refactored from phase6.js: pirate navigation renderer.
const PIRATE_NAV_ICONS={
  overview:'compass',
  operations:'journal',
  analytics:'map',
  budgets:'chest',
  goals:'chest',
  recurring:'hourglass',
  categories:'tags'
};

nav=function(view,icon,label){
  const due=view==='recurring'&&typeof phase3Upcoming==='function'?phase3Upcoming(3):[];
  const alert=due.length>0;
  const iconName=PIRATE_NAV_ICONS[view]||'compass';
  return `<div class="nav-item pirate-nav ${state.view===view?'active':''} ${alert?'payment-alert':''}" data-view="${view}">
    <span class="nav-icon pirate-icon icon-${iconName}" aria-hidden="true"></span>
    <span class="nav-label">${label}</span>
    ${alert?`<span class="nav-badge pirate-alert" title="Платежи в ближайшие 3 дня">${due.length}</span>`:''}
  </div>`
};
