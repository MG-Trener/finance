// Refactored from phase8.js: attach uploaded pirate image assets to dynamic controls.
function decoratePirateAssets(){
  document.querySelectorAll('.editTx,.editCat').forEach(b=>b.classList.add('asset-edit'));
  document.querySelectorAll('.deleteTx,.deleteCat,.deleteBudget,.deleteRecurring').forEach(b=>b.classList.add('asset-delete'));
  document.querySelectorAll('.toggleRecurring').forEach(b=>{
    b.classList.remove('asset-play','asset-pause');
    const t=(b.textContent||'').trim();
    b.classList.add(t.includes('Ⅱ')||t.includes('II')?'asset-pause':'asset-play');
  });
  document.querySelectorAll('.status-chip').forEach(el=>{
    el.classList.remove('asset-status-active','asset-status-pause');
    const t=(el.textContent||'').trim().toLowerCase();
    if(t==='активен')el.classList.add('asset-status-active');
    if(t==='пауза')el.classList.add('asset-status-pause');
  });
  document.querySelectorAll('.due-chip').forEach(el=>{
    el.classList.remove('asset-status-today','asset-status-soon');
    const t=(el.textContent||'').trim().toLowerCase();
    if(t==='сегодня')el.classList.add('asset-status-today');
    else if(t==='завтра'||t.startsWith('через '))el.classList.add('asset-status-soon');
  });
}

let pirateAssetsQueued=false;
function schedulePirateAssets(){
  if(pirateAssetsQueued)return;
  pirateAssetsQueued=true;
  requestAnimationFrame(()=>{pirateAssetsQueued=false;decoratePirateAssets()});
}

new MutationObserver(schedulePirateAssets).observe(document.getElementById('app'),{subtree:true,childList:true});
window.addEventListener('DOMContentLoaded',schedulePirateAssets);
window.addEventListener('load',schedulePirateAssets);
setTimeout(schedulePirateAssets,0);
