// Refactored from phase10.js: pirate date ribbon filters overview history only.
(function(){
  const dow=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const mon=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
  function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
  function dateKey(d){const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function dateFromKey(key){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return Number.isNaN(d.getTime())?null:d}
  function publishSelectedDate(date){
    if(typeof state!=='undefined')state.overviewDateKey=dateKey(date);
    window.dispatchEvent(new CustomEvent('finance:overview-date-selected',{detail:{dateKey:dateKey(date)}}));
  }

  function decorateDateRibbon(){
    if(state.view!=='overview')return;
    const form=document.getElementById('txForm');
    const details=form?.querySelector('.time-details');
    if(!form||!details||form.querySelector('.pirate-date-picker'))return;

    const wrap=document.createElement('div');
    wrap.className='pirate-date-picker';
    wrap.innerHTML=`<div class="pirate-date-head"><div class="pirate-date-title">История по дате</div><button type="button" class="pirate-today">Сегодня</button></div><div class="pirate-date-shell"><div class="pirate-date-track"></div></div><div class="pirate-date-hint">Колесо мыши или перетаскивание — сменить дату истории</div>`;
    details.before(wrap);
    const track=wrap.querySelector('.pirate-date-track');
    const today=startOfDay(new Date());
    const stored=dateFromKey(state.overviewDateKey);
    let selected=stored||today;
    state.overviewDateKey=dateKey(selected);

    function render(){
      track.innerHTML='';
      for(let i=-8;i<=8;i++){
        const d=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()+i);
        const b=document.createElement('button');
        b.type='button';
        b.className='pirate-day'+(sameDay(d,selected)?' selected':'')+(sameDay(d,today)?' today':'');
        b.innerHTML=`<span class="dow">${dow[d.getDay()]}</span><span class="num">${d.getDate()}</span><span class="mon">${mon[d.getMonth()]}</span>`;
        b.onclick=()=>{selected=startOfDay(d);publishSelectedDate(selected);render()};
        track.appendChild(b);
      }
      requestAnimationFrame(()=>track.querySelector('.selected')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}));
    }

    function shift(days){selected=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()+days);publishSelectedDate(selected);render()}
    wrap.querySelector('.pirate-today').onclick=()=>{selected=startOfDay(new Date());publishSelectedDate(selected);render()};
    wrap.querySelector('.pirate-date-shell').addEventListener('wheel',e=>{e.preventDefault();shift(e.deltaY>0||e.deltaX>0?1:-1)},{passive:false});
    render();
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateDateRibbon()})}
  const obs=new MutationObserver(schedule);
  obs.observe(document.getElementById('app'),{subtree:true,childList:true});
  window.addEventListener('load',schedule);
  window.addEventListener('DOMContentLoaded',schedule);
  setTimeout(schedule,0);
})();
