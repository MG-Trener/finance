// Phase 10 - pirate date ribbon for transaction date selection.
(function(){
  const DAY=86400000;
  const dow=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const mon=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
  function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
  function parseLocalInput(v){if(!v)return new Date();const d=new Date(v);return Number.isNaN(d.getTime())?new Date():d}
  function setInputDate(input,date){
    const old=parseLocalInput(input.value);
    const next=new Date(date.getFullYear(),date.getMonth(),date.getDate(),old.getHours(),old.getMinutes(),0,0);
    const pad=n=>String(n).padStart(2,'0');
    input.value=`${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
    state.year=next.getFullYear();
    state.month=next.getMonth()+1;
  }

  function decorateDateRibbon(){
    if(state.view!=='overview')return;
    const form=document.getElementById('txForm');
    const details=form?.querySelector('.time-details');
    const input=document.getElementById('occurredAt');
    if(!form||!details||!input||form.querySelector('.pirate-date-picker'))return;

    const wrap=document.createElement('div');
    wrap.className='pirate-date-picker';
    wrap.innerHTML=`<div class="pirate-date-head"><div class="pirate-date-title">Дата операции</div><button type="button" class="pirate-today">Сегодня</button></div><div class="pirate-date-shell"><div class="pirate-date-track"></div></div><div class="pirate-date-hint">Колесо мыши — сменить дату</div>`;
    details.before(wrap);
    const track=wrap.querySelector('.pirate-date-track');
    const today=startOfDay(new Date());
    let selected=startOfDay(parseLocalInput(input.value));

    function render(){
      track.innerHTML='';
      for(let i=-8;i<=8;i++){
        const d=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()+i);
        const b=document.createElement('button');
        b.type='button';
        b.className='pirate-day'+(sameDay(d,selected)?' selected':'')+(sameDay(d,today)?' today':'');
        b.innerHTML=`<span class="dow">${dow[d.getDay()]}</span><span class="num">${d.getDate()}</span><span class="mon">${mon[d.getMonth()]}</span>`;
        b.onclick=()=>{selected=startOfDay(d);setInputDate(input,selected);render()};
        track.appendChild(b);
      }
      requestAnimationFrame(()=>track.querySelector('.selected')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}));
    }

    function shift(days){selected=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()+days);setInputDate(input,selected);render()}
    wrap.querySelector('.pirate-today').onclick=()=>{selected=startOfDay(new Date());setInputDate(input,selected);render()};
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
