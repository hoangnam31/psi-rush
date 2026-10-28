(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const app = $('#app');
  const hero = $('#hero');
  const eventCard = $('#eventCard');
  const lobbyPanel = $('#lobbyPanel');
  const matchPanel = $('#matchPanel');
  const gameHud = $('#gameHud');
  const finishPanel = $('#finishPanel');
  const mobileControls = $('#mobileControls');

  const COLORS = ['#7d41ff', '#ff389e', '#baff36', '#35e5ff'];
  const BOT_COLORS = ['#ff389e', '#baff36', '#35e5ff', '#ffb12f', '#9456ff', '#ff6658', '#54e48b'];
  const FINISH_Y = 6400;
  const COURSE_W = 1200;
  const ROAD_L = 90;
  const ROAD_R = 1110;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let dpr = 1, W = innerWidth, H = innerHeight;
  let state = 'menu';
  let last = performance.now();
  let menuTime = 0;
  let raceTime = 0;
  let cameraY = 0;
  let selectedColor = COLORS[0];
  let capacity = 200;
  let soundOn = true;
  let matchTimer = null;
  let toastTimer = null;
  let audioCtx = null;
  const keys = Object.create(null);
  const touchAxis = { x: 0, y: 0 };

  const player = {
    x: COURSE_W / 2, y: 100, vx: 0, vy: 0, z: 0, vz: 0,
    r: 29, color: selectedColor, checkpoint: 100, dash: 0, dashCooldown: 0,
    stun: 0, finished: false, name: 'TayĐua'
  };
  let bots = [];

  const solids = [
    {x:90,y:680,w:315,h:95,c:'#ff4f9e'}, {x:535,y:680,w:270,h:95,c:'#ff4f9e'}, {x:935,y:680,w:175,h:95,c:'#ff4f9e'},
    {x:90,y:1160,w:210,h:80,c:'#5d38d5'}, {x:430,y:1160,w:340,h:80,c:'#5d38d5'}, {x:900,y:1160,w:210,h:80,c:'#5d38d5'},
    {x:90,y:2250,w:390,h:95,c:'#23cfd0'}, {x:650,y:2250,w:460,h:95,c:'#23cfd0'},
    {x:220,y:2730,w:275,h:80,c:'#ffb12f'}, {x:700,y:2730,w:280,h:80,c:'#ffb12f'},
    {x:90,y:3880,w:245,h:86,c:'#ff4f9e'}, {x:475,y:3880,w:250,h:86,c:'#ff4f9e'}, {x:865,y:3880,w:245,h:86,c:'#ff4f9e'},
    {x:90,y:5000,w:360,h:90,c:'#5d38d5'}, {x:590,y:5000,w:520,h:90,c:'#5d38d5'},
    {x:240,y:5510,w:300,h:80,c:'#23cfd0'}, {x:670,y:5510,w:300,h:80,c:'#23cfd0'}
  ];
  const movers = [
    {baseX:210,y:3200,w:230,h:82,amp:270,speed:1.35,phase:0,c:'#ffb12f'},
    {baseX:760,y:3450,w:230,h:82,amp:250,speed:1.55,phase:2.2,c:'#ff4f9e'},
    {baseX:240,y:4620,w:280,h:86,amp:330,speed:1.9,phase:.8,c:'#23cfd0'},
    {baseX:710,y:5850,w:250,h:82,amp:260,speed:2.2,phase:3.1,c:'#ffb12f'}
  ];
  const spinners = [
    {x:370,y:1570,len:300,speed:1.75,phase:0,c:'#ff389e'},
    {x:830,y:1820,len:320,speed:-2.05,phase:1.2,c:'#baff36'},
    {x:600,y:4270,len:430,speed:2.4,phase:.5,c:'#ffb12f'},
    {x:370,y:6100,len:285,speed:-2.8,phase:2,c:'#ff389e'},
    {x:830,y:6100,len:285,speed:2.8,phase:0,c:'#35e5ff'}
  ];
  const checkpoints = [100, 2050, 3750, 5300];
  const pads = [
    {x:530,y:920,w:140,h:100}, {x:190,y:2940,w:130,h:100}, {x:850,y:4050,w:130,h:100}, {x:535,y:5700,w:130,h:100}
  ];
  const zoneLabels = [
    {y:390,t:'CỔNG VA ĐẬP'}, {y:1340,t:'MÁY XOAY ĐIÊN CUỒNG'}, {y:3000,t:'VŨ ĐIỆU SÀN TRƯỢT'},
    {y:4020,t:'BÚA TỐC ĐỘ'}, {y:5260,t:'HẺM NÚT CHAI'}, {y:6020,t:'CÚ NƯỚC RÚT CUỐI'}
  ];

  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  function beep(freq = 440, duration = .08, type = 'square', gain = .035) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = gain;
      o.connect(g); g.connect(audioCtx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      o.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function setPanel(panel, open) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
  }
  function setHero(show) {
    hero.classList.toggle('hidden-view', !show);
    eventCard.classList.toggle('hidden-view', !show);
  }
  function showToast(text) {
    const el = $('#toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
  }
  function formatTime(t) {
    const m = Math.floor(t / 60); const s = Math.floor(t % 60); const d = Math.floor((t * 10) % 10);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${d}`;
  }

  function initColors() {
    const picker = $('#colorPicker');
    COLORS.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = c;
      b.className = i === 0 ? 'active' : ''; b.setAttribute('aria-label', `Màu ${i+1}`);
      b.onclick = () => { selectedColor = c; player.color = c; $$('#colorPicker button').forEach(x => x.classList.remove('active')); b.classList.add('active'); beep(620); };
      picker.appendChild(b);
    });
  }
  initColors();

  $('#playBtn').onclick = () => { setHero(false); setPanel(lobbyPanel, true); beep(520); };
  $('#howBtn').onclick = () => { setPanel($('#howModal'), true); beep(520); };
  $$('[data-close]').forEach(b => b.onclick = () => {
    const p = document.getElementById(b.dataset.close); setPanel(p, false);
    if (p === lobbyPanel) setHero(true); beep(320);
  });
  $$('.mode-card').forEach(b => b.onclick = () => {
    $$('.mode-card').forEach(x => x.classList.remove('active')); b.classList.add('active');
    $('#roomCodeWrap').classList.toggle('hidden', b.dataset.mode !== 'private'); beep(610);
  });
  $('#capacity').oninput = (e) => { capacity = +e.target.value; $('#capacityValue').textContent = capacity; };
  $('#soundBtn').onclick = () => { soundOn = !soundOn; $('#soundBtn').textContent = soundOn ? '♪' : '×'; beep(500); };

  function createDots(n) {
    const wrap = $('#playerDots'); wrap.innerHTML = '';
    const dots = Math.min(n, 80);
    for (let i=0;i<dots;i++) { const d=document.createElement('i'); d.style.animationDelay=`${i*.01}s`; d.style.background=BOT_COLORS[i%BOT_COLORS.length]; wrap.appendChild(d); }
  }

  $('#findBtn').onclick = () => {
    player.name = ($('#playerName').value || 'TayĐua').trim().slice(0,16);
    const isPrivate = $('.mode-card.active').dataset.mode === 'private';
    const code = ($('#roomCode').value || 'RUSH' + Math.floor(10+Math.random()*89)).toUpperCase();
    $('#roomLabel').textContent = isPrivate ? `PHÒNG ${code}` : 'ĐUA NHANH · ASIA';
    setPanel(lobbyPanel, false); setPanel(matchPanel, true);
    $('#targetCount').textContent = capacity; $('#joinedCount').textContent = '1'; createDots(1);
    let joined = 1; const started = performance.now();
    matchTimer = setInterval(() => {
      const elapsed = (performance.now()-started)/1000;
      const target = Math.min(capacity, Math.floor(1 + capacity * (1-Math.exp(-elapsed*1.55))));
      if (target > joined) { joined = target; $('#joinedCount').textContent = joined; createDots(joined); beep(280 + joined % 5 * 45, .025, 'sine', .012); }
      if (elapsed > 2.7) { clearInterval(matchTimer); $('#joinedCount').textContent=capacity; createDots(capacity); setTimeout(startCountdown, 400); }
    }, 90);
  };
  $('#cancelMatch').onclick = () => { clearInterval(matchTimer); setPanel(matchPanel,false); setPanel(lobbyPanel,true); };

  function makeBots(n) {
    bots = Array.from({length:n}, (_,i) => ({
      x: 120 + Math.random()*(COURSE_W-240), y: 40 - Math.floor(i/18)*45,
      speed: 185 + Math.random()*105, color: BOT_COLORS[i%BOT_COLORS.length],
      phase: Math.random()*Math.PI*2, wobble: .7+Math.random()*1.4, name:`Rusher${i+2}`,
      stun: Math.random()*.4, finished:false, finishTime:0
    }));
  }

  function resetRace() {
    Object.assign(player, {x:COURSE_W/2,y:100,vx:0,vy:0,z:0,vz:0,checkpoint:100,dash:0,dashCooldown:0,stun:0,finished:false,color:selectedColor});
    raceTime = 0; cameraY = 0; makeBots(capacity-1);
    $('#playerTotal').textContent = capacity; $('#rankValue').textContent = capacity; $('#raceTime').textContent='00:00.0';
    $('#progressFill').style.width='0%'; $('#dashFill').style.width='100%';
  }

  async function startCountdown() {
    clearInterval(matchTimer); setPanel(matchPanel,false); setHero(false); resetRace();
    state = 'countdown'; app.classList.add('playing'); gameHud.classList.add('open'); gameHud.setAttribute('aria-hidden','false');
    mobileControls.classList.add('open'); mobileControls.setAttribute('aria-hidden','false');
    const c = $('#countdown');
    for (const value of ['3','2','1','GO!']) {
      c.textContent=value; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
      beep(value==='GO!'?880:360+Number(value||1)*100, value==='GO!'?.28:.1, 'square', .05);
      await new Promise(r=>setTimeout(r, value==='GO!'?650:760));
    }
    c.classList.remove('show'); state='playing'; last=performance.now();
  }

  function jump() {
    if (state==='playing' && player.z < 2 && player.stun <= 0) { player.vz=590; beep(700,.08,'sine',.025); }
  }
  function dash() {
    if (state==='playing' && player.dashCooldown<=0 && player.stun<=0) { player.dash=.32; player.dashCooldown=3; beep(180,.2,'sawtooth',.035); }
  }
  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.code==='Space') jump(); if (e.key==='Shift') dash();
  });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  $('#jumpBtn').addEventListener('pointerdown', e=>{e.preventDefault();jump();});
  $('#dashBtn').addEventListener('pointerdown', e=>{e.preventDefault();dash();});

  const joy = $('#joystick'), knob = $('#joystickKnob'); let joyId = null;
  function joyMove(e) {
    const r=joy.getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2), len=Math.hypot(dx,dy)||1, max=38, m=Math.min(max,len);
    touchAxis.x=dx/len*Math.min(1,len/max); touchAxis.y=-dy/len*Math.min(1,len/max);
    knob.style.transform=`translate(${dx/len*m}px,${dy/len*m}px)`;
  }
  joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e)});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e)});
  function joyEnd(e){if(e.pointerId===joyId){joyId=null;touchAxis.x=touchAxis.y=0;knob.style.transform=''}}
  joy.addEventListener('pointerup',joyEnd); joy.addEventListener('pointercancel',joyEnd);

  function dynamicMover(m) { return {...m, x:m.baseX + Math.sin(raceTime*m.speed+m.phase)*m.amp}; }
  function collideRect(p, r, oldX, oldY) {
    const nx=Math.max(r.x,Math.min(p.x,r.x+r.w)), ny=Math.max(r.y,Math.min(p.y,r.y+r.h));
    if ((p.x-nx)**2+(p.y-ny)**2 < p.r**2 && p.z < 42) {
      p.x=oldX; p.y=oldY; p.vx*=-.25; p.vy*=-.22; p.stun=Math.max(p.stun,.12); return true;
    } return false;
  }
  function pointSegmentDistance(px,py,x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l));
    return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
  }
  function hitSpinner(s) {
    if (player.stun > .35) return;
    const a=raceTime*s.speed+s.phase, dx=Math.cos(a)*s.len,dy=Math.sin(a)*s.len;
    if(player.z<48 && pointSegmentDistance(player.x,player.y,s.x-dx,s.y-dy,s.x+dx,s.y+dy)<player.r+18){
      const side=Math.sign(Math.cos(a)*(player.y-s.y)-Math.sin(a)*(player.x-s.x))||1;
      player.vx+=Math.cos(a+Math.PI/2)*side*610; player.vy+=Math.sin(a+Math.PI/2)*side*610;
      player.stun=.48; beep(115,.17,'sawtooth',.04);
    }
  }
  function respawn() {
    player.x=COURSE_W/2; player.y=player.checkpoint; player.vx=player.vy=0; player.z=0; player.stun=.25; showToast('TRỞ LẠI CHECKPOINT'); beep(120,.3,'triangle',.05);
  }

  function updatePlayer(dt) {
    const oldX=player.x, oldY=player.y;
    player.stun=Math.max(0,player.stun-dt); player.dashCooldown=Math.max(0,player.dashCooldown-dt); player.dash=Math.max(0,player.dash-dt);
    let ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+touchAxis.x;
    let iy=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)+touchAxis.y;
    const len=Math.hypot(ix,iy); if(len>1){ix/=len;iy/=len;}
    const control=player.stun>0?.15:1, accel=1100*control, max=player.dash>0?720:340;
    player.vx+=ix*accel*dt; player.vy+=iy*accel*dt;
    const friction=Math.pow(player.z>0?.35:.055,dt); player.vx*=friction; player.vy*=friction;
    const speed=Math.hypot(player.vx,player.vy); if(speed>max){player.vx=player.vx/speed*max;player.vy=player.vy/speed*max;}
    player.x+=player.vx*dt; player.y+=player.vy*dt;
    player.vz-=1320*dt; player.z+=player.vz*dt; if(player.z<=0){player.z=0;player.vz=Math.max(0,player.vz*-0.05);}
    if(player.x<ROAD_L-50||player.x>ROAD_R+50){respawn();return;}
    player.x=Math.max(ROAD_L+player.r,Math.min(ROAD_R-player.r,player.x));
    player.y=Math.max(-160,player.y);
    for(const r of solids) if(Math.abs(player.y-(r.y+r.h/2))<150) collideRect(player,r,oldX,oldY);
    for(const m of movers){const r=dynamicMover(m);if(Math.abs(player.y-r.y)<150)collideRect(player,r,oldX,oldY);}
    for(const s of spinners) if(Math.abs(player.y-s.y)<s.len+80)hitSpinner(s);
    for(const p of pads) if(player.x>p.x&&player.x<p.x+p.w&&player.y>p.y&&player.y<p.y+p.h&&player.z<8){player.vy=Math.max(player.vy,610);}
    for(const cp of checkpoints) if(player.y>cp&&cp>player.checkpoint){player.checkpoint=cp;showToast('CHECKPOINT!');beep(940,.18,'sine',.04);}
    if(player.y>=FINISH_Y&&!player.finished)finishRace();
  }

  function updateBots(dt) {
    for(const b of bots){
      if(b.finished)continue; b.stun=Math.max(0,b.stun-dt);
      let factor=b.stun>0?.18:1;
      for(const r of solids) if(b.y<r.y&&r.y-b.y<65&&b.x>r.x-20&&b.x<r.x+r.w+20){b.x+=Math.sin(b.phase+raceTime*2.3)*230*dt;factor*=.33;}
      for(const s of spinners) if(Math.abs(b.y-s.y)<38&&Math.random()<dt*.8){b.stun=.6+Math.random()*.8;b.y-=30+Math.random()*70;}
      b.y+=b.speed*factor*dt; b.x+=Math.sin(raceTime*b.wobble+b.phase)*34*dt;
      b.x=Math.max(ROAD_L+18,Math.min(ROAD_R-18,b.x));
      if(b.y>=FINISH_Y){b.finished=true;b.finishTime=raceTime;}
    }
  }

  function currentRank() { return 1+bots.filter(b=>b.y>player.y).length; }
  function updateRace(dt) {
    raceTime+=dt; updatePlayer(dt); updateBots(dt);
    cameraY+=(player.y-cameraY-160)*Math.min(1,dt*4.5);
    const rank=currentRank(); $('#rankValue').textContent=rank; $('#raceTime').textContent=formatTime(raceTime);
    $('#progressFill').style.width=`${Math.max(0,Math.min(100,player.y/FINISH_Y*100))}%`;
    $('#dashFill').style.width=`${Math.max(0,(1-player.dashCooldown/3)*100)}%`;
  }

  function finishRace() {
    player.finished=true; state='finished'; const rank=currentRank();
    $('#finishBadge').textContent=`#${rank}`; $('#finishTitle').textContent=rank===1?'NHÀ VÔ ĐỊCH!':rank<=10?'QUÁ XUẤT SẮC!':'ĐÃ CÁN ĐÍCH!';
    $('#finalTime').textContent=formatTime(raceTime); $('#xpReward').textContent=`+${Math.max(180,800-rank*5)}`;
    gameHud.classList.remove('open'); mobileControls.classList.remove('open'); makeConfetti();
    setTimeout(()=>setPanel(finishPanel,true),550); beep(660,.18,'square',.04); setTimeout(()=>beep(880,.4,'square',.04),190);
  }
  function makeConfetti(){
    const c=$('#confetti');c.innerHTML='';for(let i=0;i<65;i++){const x=document.createElement('i');x.style.left=`${Math.random()*100}%`;x.style.background=BOT_COLORS[i%BOT_COLORS.length];x.style.setProperty('--t',`${2.2+Math.random()*2.8}s`);x.style.setProperty('--r',`${Math.random()*180}deg`);x.style.setProperty('--x',`${-100+Math.random()*200}px`);x.style.animationDelay=`${Math.random()*2}s`;c.appendChild(x);}
  }
  $('#againBtn').onclick=()=>{setPanel(finishPanel,false);startCountdown();};
  $('#homeBtn').onclick=()=>{setPanel(finishPanel,false);state='menu';app.classList.remove('playing');setHero(true);cameraY=0;};

  function worldScale(){return Math.max(.46,Math.min(.82,W/1450));}
  function sx(x){return W/2+(x-COURSE_W/2)*worldScale();}
  function sy(y){return H*.74-(y-cameraY)*worldScale();}
  function roundRect(x,y,w,h,r,fill,stroke){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function drawMenuBackground(t){
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#30108a');g.addColorStop(.46,'#7d36e8');g.addColorStop(1,'#ff3f9d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.18;ctx.strokeStyle='#fff';ctx.lineWidth=2;
    for(let i=-H;i<W+H;i+=90){ctx.beginPath();ctx.moveTo(i+Math.sin(t)*15,0);ctx.lineTo(i-H+Math.sin(t)*15,H);ctx.stroke();}
    ctx.globalAlpha=.15;
    for(let i=0;i<18;i++){const x=(i*187+Math.sin(t*.3+i)*35)%W,y=(i*97+Math.cos(t*.4+i)*25)%H;ctx.beginPath();ctx.arc(x,y,3+(i%4)*2,0,Math.PI*2);ctx.fillStyle=i%2?'#fff':'#ffe14a';ctx.fill();}
    ctx.globalAlpha=1;
    const glow=ctx.createRadialGradient(W*.73,H*.42,20,W*.73,H*.42,Math.min(W,H)*.5);glow.addColorStop(0,'rgba(255,255,255,.16)');glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  }
  function drawRoad(){
    ctx.fillStyle='#26164f';ctx.fillRect(0,0,W,H);
    const scale=worldScale(), left=sx(ROAD_L), right=sx(ROAD_R), tile=210*scale;
    const g=ctx.createLinearGradient(left,0,right,0);g.addColorStop(0,'#8467ef');g.addColorStop(.5,'#9a7af5');g.addColorStop(1,'#7658dc');ctx.fillStyle=g;ctx.fillRect(left,0,right-left,H);
    const offset=((cameraY*scale)%tile+tile)%tile;
    ctx.globalAlpha=.14;ctx.fillStyle='#fff';
    for(let y=H-offset;y>-tile;y-=tile)for(let x=left;x<right;x+=tile*1.2)ctx.fillRect(x,y,tile*1.2-3,tile-3);
    ctx.globalAlpha=1;ctx.fillStyle='#ff4fa4';ctx.fillRect(left-13,0,13,H);ctx.fillRect(right,0,13,H);
    ctx.fillStyle='rgba(10,5,38,.3)';ctx.fillRect(left-28,0,15,H);ctx.fillRect(right+13,0,15,H);
    for(let y=-80;y<H+100;y+=110){ctx.fillStyle='#ffe14a';ctx.beginPath();ctx.arc(left-18,y+offset%110,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(right+18,y+offset%110,8,0,Math.PI*2);ctx.fill();}
  }
  function drawFinish(){
    const y=sy(FINISH_Y);if(y<-100||y>H+100)return;const l=sx(ROAD_L),r=sx(ROAD_R),cell=32;
    for(let x=l,n=0;x<r;x+=cell,n++)for(let row=0;row<3;row++){ctx.fillStyle=(n+row)%2?'#fff':'#1b0b3c';ctx.fillRect(x,y+row*cell,cell,cell);}
    ctx.font='900 18px Montserrat';ctx.textAlign='center';ctx.fillStyle='#ffe14a';ctx.fillText('VỀ ĐÍCH',W/2,y-18);
  }
  function drawLabels(){
    ctx.textAlign='center';ctx.font='900 11px Montserrat';
    for(const z of zoneLabels){const y=sy(z.y);if(y>-30&&y<H+30){ctx.fillStyle='rgba(24,8,62,.65)';roundRect(W/2-100,y-15,200,30,15,'rgba(24,8,62,.7)');ctx.fillStyle='#fff';ctx.fillText(z.t,W/2,y+4);}}
  }
  function drawPads(){
    for(const p of pads){const y=sy(p.y+p.h),h=p.h*worldScale();if(y<-h||y>H+20)continue;const x=sx(p.x),w=p.w*worldScale();roundRect(x,y,w,h,12,'#baff36');ctx.fillStyle='#34205c';ctx.font=`900 ${Math.max(10,18*worldScale())}px Montserrat`;ctx.textAlign='center';ctx.fillText('»',x+w/2,y+h*.63);}
  }
  function drawObstacle(r){
    const sc=worldScale(),x=sx(r.x),y=sy(r.y+r.h),w=r.w*sc,h=r.h*sc;if(y<-h-30||y>H+30)return;
    ctx.fillStyle='rgba(15,6,42,.25)';roundRect(x+7,y+12,w,h,13,'rgba(15,6,42,.25)');roundRect(x,y,w,h,13,r.c);
    ctx.fillStyle='rgba(255,255,255,.2)';roundRect(x+8,y+7,w-16,Math.max(7,h*.18),7,'rgba(255,255,255,.2)');
    ctx.fillStyle='#fff';ctx.globalAlpha=.35;for(let dx=18;dx<w-12;dx+=35){ctx.beginPath();ctx.arc(x+dx,y+h*.58,4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  }
  function drawSpinner(s){
    const y=sy(s.y),x=sx(s.x),sc=worldScale();if(y<-s.len*sc||y>H+s.len*sc)return;
    const a=raceTime*s.speed+s.phase,len=s.len*sc,dx=Math.cos(a)*len,dy=-Math.sin(a)*len;
    ctx.strokeStyle='rgba(13,4,37,.28)';ctx.lineWidth=28*sc;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-dx+6,y-dy+8);ctx.lineTo(x+dx+6,y+dy+8);ctx.stroke();
    ctx.strokeStyle=s.c;ctx.lineWidth=25*sc;ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,27*sc,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4a238e';ctx.beginPath();ctx.arc(x,y,13*sc,0,Math.PI*2);ctx.fill();
  }
  function drawRunner(p,isPlayer=false){
    const sc=worldScale(),x=sx(p.x),ground=sy(p.y),z=(p.z||0)*sc,y=ground-z;if(y<-60||y>H+70)return;
    const r=(isPlayer?30:20)*sc;
    ctx.globalAlpha=isPlayer?1:.84;
    ctx.fillStyle='rgba(18,5,45,.25)';ctx.beginPath();ctx.ellipse(x,ground+8,r*.86,r*.35,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.color;ctx.strokeStyle=isPlayer?'#fff':'rgba(38,10,74,.6)';ctx.lineWidth=isPlayer?4:2;ctx.beginPath();ctx.roundRect(x-r,y-r*1.2,r*2,r*2.25,r*.8);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y-r*.38,r*.61,r*.45,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a0a39';ctx.beginPath();ctx.ellipse(x-r*.2,y-r*.38,r*.08,r*.14,0,0,Math.PI*2);ctx.ellipse(x+r*.2,y-r*.38,r*.08,r*.14,0,0,Math.PI*2);ctx.fill();
    if(isPlayer){ctx.font='900 10px Montserrat';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='rgba(20,5,50,.8)';ctx.lineWidth=4;ctx.strokeText(player.name,x,y-r*1.55);ctx.fillText(player.name,x,y-r*1.55);}
    ctx.globalAlpha=1;
  }
  function drawRace(){
    drawRoad();drawLabels();drawFinish();drawPads();
    for(const r of solids)drawObstacle(r);for(const m of movers)drawObstacle(dynamicMover(m));for(const s of spinners)drawSpinner(s);
    const visible=bots.filter(b=>Math.abs(b.y-cameraY)<H/worldScale()+160).sort((a,b)=>b.y-a.y);for(const b of visible)drawRunner(b,false);drawRunner(player,true);
  }

  function frame(now){
    const dt=Math.min(.033,(now-last)/1000||.016);last=now;menuTime+=dt;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    if(state==='menu'){drawMenuBackground(menuTime);}else{if(state==='playing')updateRace(dt);else if(state==='countdown')updateBots(dt*.3);drawRace();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let eventLeft=2*3600+14*60+8;
  setInterval(()=>{eventLeft=Math.max(0,eventLeft-1);const h=Math.floor(eventLeft/3600),m=Math.floor(eventLeft%3600/60),s=eventLeft%60;$('#eventTimer').textContent=[h,m,s].map(v=>String(v).padStart(2,'0')).join(':');},1000);

  // Optional hook for a future authoritative WebSocket server. Set `wobble_server`
  // in localStorage to activate transport without changing the game client.
  const serverUrl=localStorage.getItem('wobble_server');
  if(serverUrl){try{const socket=new WebSocket(serverUrl);socket.addEventListener('open',()=>console.info('Wobble realtime transport connected'));}catch(_) {}}
})();
