// Extends the launch quote rotation from 200 classic writer quotes to 500 total entries.
// The original 200-entry bank remains the source for classic quotations; this layer
// adds 300 original financial aphorisms and mixes both banks into one no-repeat deck.
(function(){
  const legacy=window.FinanceLaunchQuote;
  if(!legacy?.quote)return;

  const OPENINGS=Object.freeze([
    'Деньги любят ясную цель',
    'Бюджет честнее памяти',
    'Сбережения любят регулярность',
    'Доход ценнее, когда у него есть назначение',
    'Расход становится опасным, когда его перестают замечать',
    'Капитал растёт прежде всего из привычек',
    'Долг всегда занимает место в завтрашнем доходе',
    'Финансовый резерв покупает спокойствие',
    'Учёт превращает догадки в решения',
    'Бережливость начинается с уважения к труду',
    'Прибыль любит терпение больше азарта',
    'Финансовая свобода начинается не с роскоши',
    'Семейный бюджет крепче, когда о нём говорят открыто',
    'Планирование делает деньги послушнее',
    'Цена и ценность редко бывают одним и тем же',
    'Труд создаёт то, что деньги лишь измеряют',
    'Время — самый невосполнимый капитал',
    'Риск полезен только вместе с расчётом',
    'Щедрость сильнее, когда она не создаёт долгов',
    'Роскошь быстро превращается в привычный расход',
    'Финансовая привычка сильнее разового порыва',
    'Каждая записанная трата становится понятнее',
    'Дисциплина сохраняет больше денег, чем удача',
    'Запас даёт выбор там, где спешка его отнимает',
    'Кредит удобен ровно до момента потери меры',
    'Хорошая покупка начинается до магазина',
    'Экономия полезна, пока не экономят на важном',
    'Достаток начинается с ощущения меры',
    'Независимость растёт вместе с финансовой подушкой',
    'Семейная казна крепнет от маленьких разумных решений'
  ]);

  const ENDINGS=Object.freeze([
    'сначала решают, что важно, и только потом открывают кошелёк.',
    'маленькие решения, повторённые много раз, становятся большим результатом.',
    'незапланированная мелочь чаще всего и превращается в заметный расход.',
    'спокойный расчёт почти всегда дешевле спешки и эмоций.',
    'финансовая свобода растёт из повторяемых действий, а не из редких порывов.',
    'лучший рубеж между желанием и покупкой — короткая пауза на размышление.',
    'сегодняшняя умеренность часто становится завтрашней свободой выбора.',
    'честные цифры полезнее самых приятных предположений.',
    'деньги служат лучше, когда человек заранее определил их работу.',
    'порядок в небольших суммах постепенно создаёт порядок и в больших.'
  ]);

  const SOURCES=Object.freeze([
    'Финансовая мудрость',
    'Семейный афоризм',
    'Практическая мудрость',
    'Афоризм о деньгах',
    'Мудрость о достатке',
    'Семейная казна'
  ]);

  const EXTRA_QUOTES=Object.freeze(OPENINGS.flatMap((opening,openingIndex)=>
    ENDINGS.map((ending,endingIndex)=>Object.freeze({
      text:`${opening}; ${ending}`,
      author:SOURCES[(openingIndex+endingIndex)%SOURCES.length]
    }))
  ));

  const LEGACY_TOTAL=Number(legacy.total)||200;
  const TOTAL=LEGACY_TOTAL+EXTRA_QUOTES.length;
  const MIX_DECK_KEY='finance.launchQuote.mixDeck.v2';
  const LEGACY_DECK_KEY='finance.launchQuote.deck.v1';
  const LEGACY_CURRENT_KEY='finance.launchQuote.current.v1';
  const LEGACY_MIRROR_KEY='finance.launchQuote.legacyMirror.v2';

  function shuffledIndexes(total){
    const items=Array.from({length:total},(_,index)=>index);
    for(let index=items.length-1;index>0;index--){
      const swap=Math.floor(Math.random()*(index+1));
      [items[index],items[swap]]=[items[swap],items[index]];
    }
    return items;
  }

  function readDeck(key,total){
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'[]');
      if(!Array.isArray(parsed))return [];
      const clean=parsed.filter(index=>Number.isInteger(index)&&index>=0&&index<total);
      return new Set(clean).size===clean.length?clean:[];
    }catch(_){
      return [];
    }
  }

  function writeDeck(key,deck){
    try{localStorage.setItem(key,JSON.stringify(deck))}catch(_ ){}
  }

  function chooseMixSlot(){
    let deck=readDeck(MIX_DECK_KEY,TOTAL);
    if(!deck.length)deck=shuffledIndexes(TOTAL);
    const firstExpandedLaunch=localStorage.getItem(LEGACY_MIRROR_KEY)===null;
    let slot;
    if(firstExpandedLaunch){
      const legacyPosition=deck.findIndex(index=>index<LEGACY_TOTAL);
      slot=deck.splice(legacyPosition>=0?legacyPosition:deck.length-1,1)[0];
    }else{
      slot=deck.pop();
    }
    writeDeck(MIX_DECK_KEY,deck);
    return {slot,firstExpandedLaunch};
  }

  function currentLegacyIndex(){
    const value=Number(localStorage.getItem(LEGACY_CURRENT_KEY));
    return Number.isInteger(value)&&value>=0&&value<LEGACY_TOTAL?value:null;
  }

  function initializeLegacyCycle(current){
    if(current==null)return;
    const remaining=shuffledIndexes(LEGACY_TOTAL).filter(index=>index!==current);
    writeDeck(LEGACY_DECK_KEY,remaining);
    try{
      localStorage.setItem(LEGACY_CURRENT_KEY,String(current));
      localStorage.setItem(LEGACY_MIRROR_KEY,String(current));
    }catch(_ ){}
  }

  function commitLegacySelection(current){
    if(current==null)return;
    try{localStorage.setItem(LEGACY_MIRROR_KEY,String(current))}catch(_ ){}
  }

  function rollbackLegacySelection(current){
    if(current==null)return;
    const deck=readDeck(LEGACY_DECK_KEY,LEGACY_TOTAL);
    if(!deck.includes(current))deck.push(current);
    writeDeck(LEGACY_DECK_KEY,deck);
    const previous=localStorage.getItem(LEGACY_MIRROR_KEY);
    try{
      if(previous===null||previous==='')localStorage.removeItem(LEGACY_CURRENT_KEY);
      else localStorage.setItem(LEGACY_CURRENT_KEY,previous);
    }catch(_ ){}
  }

  const selection=chooseMixSlot();
  const legacyIndex=currentLegacyIndex();
  const useLegacy=selection.slot<LEGACY_TOTAL;

  if(selection.firstExpandedLaunch){
    initializeLegacyCycle(legacyIndex);
  }else if(useLegacy){
    commitLegacySelection(legacyIndex);
  }else{
    rollbackLegacySelection(legacyIndex);
  }

  const selectedQuote=useLegacy
    ?legacy.quote
    :EXTRA_QUOTES[selection.slot-LEGACY_TOTAL]||EXTRA_QUOTES[0];

  function safe(value){
    if(typeof esc==='function')return esc(value);
    return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function applySelectedQuote(markup){
    if(useLegacy||typeof markup!=='string'||!markup.includes('finance-launch-quote'))return markup;
    return markup
      .replace(/(<span class="finance-launch-quote-text">)[\s\S]*?(<\/span>)/,`$1«${safe(selectedQuote.text)}»$2`)
      .replace(/(<span class="finance-launch-quote-author">)[\s\S]*?(<\/span>)/,`$1— ${safe(selectedQuote.author)}$2`);
  }

  if(typeof husbandCalendarPage==='function'){
    const baseHusbandCalendarPage500=husbandCalendarPage;
    husbandCalendarPage=function(person){return applySelectedQuote(baseHusbandCalendarPage500(person))};
  }
  if(typeof wifeCalendarPage==='function'){
    const baseWifeCalendarPage500=wifeCalendarPage;
    wifeCalendarPage=function(person){return applySelectedQuote(baseWifeCalendarPage500(person))};
  }

  window.FinanceLaunchQuote={...legacy,quote:selectedQuote,total:TOTAL};
  window.FinanceLaunchQuoteExpanded={
    quote:selectedQuote,
    total:TOTAL,
    classic:LEGACY_TOTAL,
    aphorisms:EXTRA_QUOTES.length,
    source:useLegacy?'classic':'aphorism'
  };
})();
