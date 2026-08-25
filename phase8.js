// Phase 8 - attach real uploaded pirate image assets to dynamic controls.
function phase8Decorate(){
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

let phase8Queued=false;
function phase8Schedule(){
  if(phase8Queued)return;
  phase8Queued=true;
  requestAnimationFrame(()=>{phase8Queued=false;phase8Decorate()});
}

const phase8Observer=new MutationObserver(phase8Schedule);
phase8Observer.observe(document.getElementById('app'),{subtree:true,childList:true});
window.addEventListener('DOMContentLoaded',phase8Schedule);
window.addEventListener('load',phase8Schedule);
setTimeout(phase8Schedule,0);
