// Wife calendar client lookup: search by name, phone or keywords in appointment comments.
(function(){
  if(typeof wifeCalendarPage!=='function'||typeof bindWifeCalendar!=='function')return;

  const baseWifeCalendarPage=wifeCalendarPage;
  const baseBindWifeCalendar=bindWifeCalendar;
  let lastQuery='';
  let lastCandidates=[];
  let lastCommentMatches=[];

  function normalizeName(value){
    return String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ');
  }
  function normalizeComment(value){
    return String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ');
  }
  function phoneDigits(value){return String(value||'').replace(/\D/g,'')}
  function clientName(row){return String(row?.client_name||row?.title||'').trim()}
  function wifeAppointments(person){
    return calendarPersonEntries(person.id).filter(row=>row.kind==='appointment');
  }
  function rowStamp(row){return `${row.entry_date||''}T${calendarTimeText(row.start_time)||'00:00'}`}
  function historySort(a,b){return rowStamp(b).localeCompare(rowStamp(a))}
  function latestPhone(rows){
    return [...rows].sort(historySort).map(row=>String(row.client_phone||'').trim()).find(Boolean)||'';
  }
  function candidateHistory(person,candidate){
    return wifeAppointments(person).filter(row=>{
      const sameName=candidate.nameKey&&normalizeName(clientName(row))===candidate.nameKey;
      const rowPhone=phoneDigits(row.client_phone);
      const samePhone=candidate.phoneDigits&&rowPhone&&rowPhone===candidate.phoneDigits;
      return sameName||samePhone;
    }).sort(historySort);
  }
  function buildCandidates(person,query){
    const nameQuery=normalizeName(query);
    const digitQuery=phoneDigits(query);
    const useName=nameQuery.length>=2;
    const usePhone=digitQuery.length>=3;
    const groups=new Map();

    wifeAppointments(person).forEach(row=>{
      const name=clientName(row);
      const nameKey=normalizeName(name);
      const directPhone=phoneDigits(row.client_phone);
      const legacyPhoneText=phoneDigits(row.comment);
      const matchedByName=useName&&nameKey.includes(nameQuery);
      const matchedByPhone=usePhone&&((directPhone&&directPhone.includes(digitQuery))||(legacyPhoneText&&legacyPhoneText.includes(digitQuery)));
      if(!matchedByName&&!matchedByPhone)return;

      const key=nameKey||`phone:${directPhone||legacyPhoneText}`;
      const group=groups.get(key)||{key,name:name||'Клиент',nameKey,rows:[],phoneDigits:''};
      group.rows.push(row);
      if(!group.phoneDigits&&directPhone)group.phoneDigits=directPhone;
      groups.set(key,group);
    });

    return [...groups.values()].map(group=>{
      const history=candidateHistory(person,group);
      const phone=latestPhone(history);
      return {
        ...group,
        phone,
        phoneDigits:phoneDigits(phone)||group.phoneDigits,
        history,
        count:history.length,
        total:history.reduce((sum,row)=>sum+Number(row.amount||0),0),
        latest:history[0]||group.rows.sort(historySort)[0]||null
      };
    }).sort((a,b)=>rowStamp(b.latest||{}).localeCompare(rowStamp(a.latest||{}))||a.name.localeCompare(b.name,'ru'));
  }
  function buildCommentMatches(person,query){
    const keyword=normalizeComment(query);
    const hasText=/[a-zа-яё]/i.test(String(query||''));
    if(keyword.length<2||!hasText)return [];
    return wifeAppointments(person)
      .filter(row=>normalizeComment(row.comment).includes(keyword))
      .sort(historySort);
  }
  function rowPhoneForDisplay(person,row){
    const direct=String(row.client_phone||'').trim();
    if(direct)return direct;
    const nameKey=normalizeName(clientName(row));
    if(!nameKey)return '';
    return latestPhone(candidateHistory(person,{nameKey,phoneDigits:''}));
  }

  function clientSearchMarkup(){
    return `<section class="card salon-client-search-card" aria-label="Поиск клиента и записей">
      <div class="salon-client-search-copy">
        <strong>Поиск по записям</strong>
        <span>По имени, телефону или ключевому слову из комментария.</span>
      </div>
      <form class="salon-client-search-form" id="salonClientSearchForm">
        <input id="salonClientSearchInput" type="search" maxlength="120" autocomplete="off" placeholder="Имя, телефон или ключевое слово" aria-label="Имя, телефон или ключевое слово">
        <button type="submit" class="btn btn-soft btn-small">Найти</button>
      </form>
      <div class="salon-client-search-hint" id="salonClientSearchHint" aria-live="polite"></div>
    </section>`;
  }

  wifeCalendarPage=function(person){
    const html=baseWifeCalendarPage(person);
    const closeIndex=html.lastIndexOf('</div>');
    if(closeIndex<0)return `${html}${clientSearchMarkup()}`;
    return `${html.slice(0,closeIndex)}${clientSearchMarkup()}${html.slice(closeIndex)}`;
  };

  function prepareClientModal(){
    const modal=document.querySelector('#modal>.modal');
    if(modal)modal.classList.add('salon-client-history-modal');
    window.FinanceModalStability?.refresh?.();
  }

  function resultCardMarkup(candidate,index){
    const latestDate=candidate.latest?.entry_date?calendarDateLabel(candidate.latest.entry_date,{weekday:false}):'';
    return `<button type="button" class="salon-client-result" data-client-result="${index}">
      <span class="salon-client-result-main"><strong>${esc(candidate.name)}</strong>${candidate.phone?`<small>${esc(candidate.phone)}</small>`:''}</span>
      <span class="salon-client-result-meta"><b>${candidate.count}</b> ${candidate.count===1?'запись':'записей'} · ${money(candidate.total)}${latestDate?`<small>Последняя: ${esc(latestDate)}</small>`:''}</span>
    </button>`;
  }

  function historyTime(row){
    const start=calendarTimeText(row.start_time);
    if(!start)return 'Время не указано';
    const duration=Number(row.duration_minutes||0);
    if(!duration)return start;
    const endMinutes=calendarMinutes(start)+duration;
    return `${start}–${calendarTimeFromMinutes(endMinutes)}`;
  }
  function commentResultMarkup(person,row,index){
    const name=clientName(row)||'Клиент';
    const phone=rowPhoneForDisplay(person,row);
    const date=calendarDateLabel(row.entry_date,{weekday:false});
    const service=String(row.service_name||'').trim();
    const comment=String(row.comment||'').trim();
    return `<article class="salon-comment-result">
      <div class="salon-comment-result-head">
        <div><strong>${esc(name)}</strong>${phone?`<small>${esc(phone)}</small>`:''}</div>
        <button type="button" class="btn btn-soft btn-small" data-comment-result="${index}">Открыть запись</button>
      </div>
      <div class="salon-comment-result-meta">${esc(date)} · ${esc(historyTime(row))}${service?` · ${esc(service)}`:''}</div>
      <div class="salon-comment-result-text"><span>Комментарий</span><p>${esc(comment)}</p></div>
    </article>`;
  }

  function openSearchResults(person,query,{forceList=false}={}){
    lastQuery=String(query||'').trim();
    lastCandidates=buildCandidates(person,lastQuery);
    lastCommentMatches=buildCommentMatches(person,lastQuery);

    if(lastCandidates.length===1&&!lastCommentMatches.length&&!forceList){
      openClientHistory(person,lastCandidates[0]);
      return;
    }
    if(!lastCandidates.length&&!lastCommentMatches.length){
      calendarModal(`${calendarModalHead('Ничего не найдено',`Поиск: ${lastQuery}`)}
        <div class="salon-client-empty">Совпадений по имени, телефону или комментариям не найдено.</div>`);
      prepareClientModal();
      return;
    }

    const clientSection=lastCandidates.length?`<section class="salon-search-section">
      <div class="salon-search-section-title"><strong>Совпадения по клиентам</strong><span>${lastCandidates.length}</span></div>
      <div class="salon-client-results">${lastCandidates.map(resultCardMarkup).join('')}</div>
    </section>`:'';
    const commentSection=lastCommentMatches.length?`<section class="salon-search-section">
      <div class="salon-search-section-title"><strong>Совпадения в комментариях</strong><span>${lastCommentMatches.length}</span></div>
      <div class="salon-comment-results">${lastCommentMatches.map((row,index)=>commentResultMarkup(person,row,index)).join('')}</div>
    </section>`:'';

    calendarModal(`${calendarModalHead('Результаты поиска',`Поиск: ${lastQuery}`)}
      <div class="salon-client-results-summary">Клиентов: <strong>${lastCandidates.length}</strong> · записей по комментарию: <strong>${lastCommentMatches.length}</strong></div>
      ${clientSection}${commentSection}`);
    prepareClientModal();
    document.querySelectorAll('[data-client-result]').forEach(button=>{
      button.onclick=()=>{
        const candidate=lastCandidates[Number(button.dataset.clientResult)];
        if(candidate)openClientHistory(person,candidate);
      };
    });
    document.querySelectorAll('[data-comment-result]').forEach(button=>{
      button.onclick=()=>{
        const row=lastCommentMatches[Number(button.dataset.commentResult)];
        if(row)openSalonAppointment(row.entry_date,calendarTimeText(row.start_time),row.id);
      };
    });
  }

  function historyItemMarkup(row){
    const date=calendarDateLabel(row.entry_date,{weekday:false});
    const amount=row.amount!=null&&row.amount!==''?money(row.amount):'Без суммы';
    const service=String(row.service_name||'').trim();
    const comment=String(row.comment||'').trim();
    return `<article class="salon-client-history-item">
      <div class="salon-client-history-row">
        <div><strong>${esc(date)}</strong><span>${esc(historyTime(row))}${service?` · ${esc(service)}`:''}</span></div>
        <b>${esc(amount)}</b>
      </div>
      ${comment?`<div class="salon-client-history-comment"><span>Комментарий</span><p>${esc(comment)}</p></div>`:'<div class="salon-client-history-no-comment">Комментария нет</div>'}
    </article>`;
  }

  function openClientHistory(person,candidate){
    const history=candidateHistory(person,candidate);
    const phone=latestPhone(history)||candidate.phone||'';
    const total=history.reduce((sum,row)=>sum+Number(row.amount||0),0);
    const backMarkup=(lastCandidates.length>1||lastCommentMatches.length)?'<button type="button" class="salon-back-button" id="salonClientHistoryBack" aria-label="Вернуться к результатам поиска">‹</button>':'';
    calendarModal(`<div class="modal-head salon-client-history-head">
      <div class="salon-editor-heading">${backMarkup}<div><h2>${esc(candidate.name)}</h2><p class="quick-amount-context">История записей клиента</p></div></div>
      <button type="button" class="icon-btn" id="closeModal" aria-label="Закрыть">×</button>
    </div>
    <div class="salon-client-profile">
      <div><span>Записей</span><strong>${history.length}</strong></div>
      <div><span>Сумма</span><strong>${money(total)}</strong></div>
      ${phone?`<a href="tel:${phoneDigits(phone)}"><span>Телефон</span><strong>${esc(phone)}</strong></a>`:'<div><span>Телефон</span><strong>Не указан</strong></div>'}
    </div>
    <div class="salon-client-history-list">${history.map(historyItemMarkup).join('')}</div>`);
    prepareClientModal();
    const back=document.getElementById('salonClientHistoryBack');
    if(back)back.onclick=()=>openSearchResults(person,lastQuery,{forceList:true});
  }

  bindWifeCalendar=function(){
    baseBindWifeCalendar();
    const form=document.getElementById('salonClientSearchForm');
    const input=document.getElementById('salonClientSearchInput');
    if(!form||!input)return;
    form.onsubmit=event=>{
      event.preventDefault();
      const query=input.value.trim();
      const digits=phoneDigits(query);
      const normalized=normalizeName(query);
      const hint=document.getElementById('salonClientSearchHint');
      if(normalized.length<2&&digits.length<3){
        if(hint)hint.textContent='Введите минимум 2 символа или 3 цифры телефона.';
        return;
      }
      if(hint)hint.textContent='';
      openSearchResults(calendarCurrentPerson(),query);
    };
  };

  window.FinanceSalonClientSearch={search:openSearchResults};
})();
