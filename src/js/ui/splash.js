// Programmatic startup scene: distance-driven medallion rotation and canvas fire particles.
(function(){
  const splash=document.getElementById('financeSplash');
  const canvas=document.getElementById('financeSplashCanvas');
  const medallion=document.getElementById('financeSplashMedallion');
  const reflection=document.getElementById('financeSplashReflection');
  const track=document.getElementById('financeSplashTrack');
  const appRoot=document.getElementById('app');
  if(!splash||!canvas||!medallion||!track)return;

  const context=canvas.getContext('2d',{alpha:true});
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ROLL_MS=reducedMotion?650:6600;
  const MAX_WAIT_MS=reducedMotion?1800:14000;
  const FADE_MS=reducedMotion?200:480;
  const startedAt=performance.now();
  const particles=[];
  const trail=[];
  let width=0,height=0,dpr=1,lastFrame=startedAt,lastTrailAt=0,emissionCarry=0;
  let appReady=false,finishing=false,finished=false;

  function resize(){
    const rect=splash.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    context.setTransform(dpr,0,0,dpr,0,0);
  }

  function smootherStep(value){
    const t=Math.max(0,Math.min(1,value));
    return t*t*t*(t*(t*6-15)+10);
  }

  function screenIsReady(){
    const first=appRoot?.firstElementChild;
    return Boolean(first&&!first.classList.contains('boot'));
  }

  function markReady(){appReady=true}

  function spawnParticle(x,y,progress,spark=false){
    const heat=.65+progress*.35;
    const life=spark?560+Math.random()*740:360+Math.random()*560;
    particles.push({
      x:x-(4+Math.random()*18),
      y:y+(Math.random()-.5)*12,
      vx:(spark?-60:-28)-Math.random()*(spark?120:72),
      vy:spark?(-75-Math.random()*185):(-26-Math.random()*95),
      gravity:spark?220:-18,
      size:spark?1+Math.random()*2.2:5+Math.random()*12,
      born:performance.now(),life,spark,heat
    });
  }

  function emit(x,y,progress,delta){
    const rate=reducedMotion?18:88;
    emissionCarry+=rate*Math.min(delta,.04);
    while(emissionCarry>=1){
      spawnParticle(x,y,progress,false);
      if(Math.random()<.2)spawnParticle(x,y,progress,true);
      emissionCarry-=1;
    }
  }

  function drawTrail(now,trackStart,currentX,trackY,progress){
    context.save();
    context.globalCompositeOperation='lighter';
    const base=context.createLinearGradient(trackStart,0,currentX,0);
    base.addColorStop(0,'rgba(104,38,3,.03)');
    base.addColorStop(.55,'rgba(255,104,4,.18)');
    base.addColorStop(1,'rgba(255,229,111,.82)');
    context.strokeStyle=base;
    context.lineCap='round';
    context.lineWidth=5+progress*4;
    context.shadowBlur=22;
    context.shadowColor='#ff7a08';
    context.beginPath();context.moveTo(trackStart,trackY);context.lineTo(currentX,trackY);context.stroke();

    for(let i=trail.length-1;i>=0;i--){
      const point=trail[i],age=now-point.time;
      if(age>2700){trail.splice(i,1);continue}
      const alpha=(1-age/2700)*.72;
      context.fillStyle=`rgba(255,${Math.round(102+point.heat*92)},28,${alpha})`;
      context.shadowBlur=18;context.shadowColor='#ff5b00';
      context.beginPath();
      context.ellipse(point.x,point.y-Math.sin(age*.012+point.seed)*point.lift,point.size,point.size*(.35+alpha),0,0,Math.PI*2);
      context.fill();
    }
    context.restore();
  }

  function drawParticles(now,delta){
    context.save();context.globalCompositeOperation='lighter';
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i],age=now-p.born;
      if(age>=p.life){particles.splice(i,1);continue}
      p.vy+=p.gravity*delta;p.x+=p.vx*delta;p.y+=p.vy*delta;
      const remaining=1-age/p.life;
      if(p.spark){
        context.strokeStyle=`rgba(255,224,118,${remaining})`;
        context.lineWidth=Math.max(.6,p.size*remaining);
        context.beginPath();context.moveTo(p.x,p.y);context.lineTo(p.x-p.vx*.026,p.y-p.vy*.026);context.stroke();
      }else{
        const radius=Math.max(.2,p.size*remaining);
        const glow=context.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
        glow.addColorStop(0,`rgba(255,244,166,${remaining})`);
        glow.addColorStop(.26,`rgba(255,159,24,${remaining*.9})`);
        glow.addColorStop(1,'rgba(200,38,0,0)');
        context.fillStyle=glow;context.beginPath();context.arc(p.x,p.y,radius,0,Math.PI*2);context.fill();
      }
    }
    context.restore();
  }

  function finish(){
    if(finishing)return;
    finishing=true;splash.classList.add('is-finished');
    setTimeout(()=>{
      splash.classList.add('is-ending');
      setTimeout(()=>{finished=true;splash.remove()},FADE_MS+40);
    },Math.max(220,FADE_MS*.72));
  }

  function frame(now){
    if(finished)return;
    const delta=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    const elapsed=now-startedAt;
    const rawProgress=Math.min(elapsed/ROLL_MS,1);
    const progress=smootherStep(rawProgress);
    const splashRect=splash.getBoundingClientRect();
    const trackRect=track.getBoundingClientRect();
    const coinSize=parseFloat(getComputedStyle(medallion).width)||120;
    const radius=coinSize*.47;
    const trackStart=trackRect.left-splashRect.left;
    const trackEnd=trackRect.right-splashRect.left;
    const distance=(trackEnd-trackStart)*progress;
    const centerX=trackStart+distance;
    const trackY=trackRect.top-splashRect.top+trackRect.height/2;
    const bounce=reducedMotion?0:Math.sin(rawProgress*Math.PI*12)*Math.sin(rawProgress*Math.PI)*Math.min(7,coinSize*.045);
    const coinLeft=centerX-coinSize/2;
    const coinTop=trackY-coinSize+bounce+3;
    const rotationDeg=(distance/(2*Math.PI*radius))*360;
    medallion.style.transform=`translate3d(${coinLeft}px,${coinTop}px,0) rotate(${rotationDeg}deg)`;
    reflection.style.transform=`translate3d(${centerX-coinSize*.46}px,${trackY+coinSize*.02}px,0) scaleX(${.76+Math.sin(rawProgress*Math.PI)*.24})`;
    reflection.style.opacity=String(.42+Math.sin(rawProgress*Math.PI)*.32);

    context.clearRect(0,0,width,height);
    if(rawProgress<1){
      emit(centerX-radius*.66,trackY-3,progress,delta);
      if(now-lastTrailAt>28){
        trail.push({x:centerX-radius*.7-Math.random()*12,y:trackY-2-Math.random()*8,size:3+Math.random()*7,lift:4+Math.random()*14,seed:Math.random()*Math.PI*2,heat:Math.random(),time:now});
        lastTrailAt=now;
      }
    }
    drawTrail(now,trackStart,centerX-radius*.35,trackY,progress);
    drawParticles(now,delta);

    if(rawProgress>=.965)splash.classList.add('is-finished');
    if(rawProgress>=1&&(appReady||screenIsReady()||elapsed>=MAX_WAIT_MS))finish();
    requestAnimationFrame(frame);
  }

  const observer=new MutationObserver(()=>{if(screenIsReady())markReady()});
  if(appRoot)observer.observe(appRoot,{childList:true,subtree:false});
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('orientationchange',resize,{passive:true});
  window.FinanceSplash={markReady};
  resize();
  if(screenIsReady())markReady();
  requestAnimationFrame(frame);
})();
