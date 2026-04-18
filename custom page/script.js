/* ════════════════════════════════════════
   BREATHE — script.js (Box Breathing)
   ════════════════════════════════════════ */

/* ── DASHBOARD INTEGRATION ── */
let currentMood = 'Focus';
const TECHNIQUE_NAME = 'custom'; // ← change per page

function saveSessionToDashboard(cycles, durationSecs, completed) {
  const STORAGE_KEY = 'breathe_sessions';
  try {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    sessions.push({
      id: Date.now(),
      technique: TECHNIQUE_NAME,
      date: new Date().toISOString(),
      cycles: cycles,
      duration: durationSecs,
      mood: currentMood,
      completed: completed,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch(e) {
    console.warn('Could not save session:', e);
  }
}

/* ── STATE ── */
let running    = false;
let paused     = false;
let doneCycles = 0;
let totalBreaths = 0;
let cycleHistory = [];

let sessionSecs       = 0;
let sessionInterval   = null;

let animFrameReq      = null;
let phaseStartTime    = null;
let phasePausedAt     = null;
let phaseTotalMs      = 0;
let currentPhaseKey   = '';
let currentPhaseDuration = 0;
let phaseOnDone       = null;
let cyclePhases       = [];
let cyclePhaseIndex   = 0;
let pendingCycleCallback = null;

let voiceOn     = true;
let hapticOn    = false;
let currentSound = 'none';
let masterVol   = 0.5;
let audioCtx    = null;
let soundNode   = null;
let gainNode    = null;
let lfoNode     = null;
let panelOpen   = false;
let statsOpen   = false;

const CIRC = 2 * Math.PI * 100;

/* ── DOM ── */
const $ = id => document.getElementById(id);
const phaseName    = $('phaseName');
const phaseSub     = $('phaseSub');
const phaseEyebrow = $('phaseEyebrow');
const orbNum       = $('orbNum');
const orbUnit      = $('orbUnit');
const loaderRing   = $('loaderRing');
const loaderDot    = $('loaderDot');
const trackRing    = $('trackRing');
const mainOrb      = $('mainOrb');
const glowHalo     = $('glowHalo');
const orbSvg       = $('orbSvg');
const gs1          = $('gs1');
const gs2          = $('gs2');
const gs3          = $('gs3');
const gg1          = $('gg1');
const lg1          = $('lg1');
const lg2          = $('lg2');
const cycleVal     = $('cycleVal');
const phaseShort   = $('phaseShort');
const sessionTimer = $('sessionTimer');
const startBtn     = $('startBtn');
const stopBtn      = $('stopBtn');
const pauseBtn     = $('pauseBtn');
const pauseIcon    = $('pauseIcon');
const statusDot    = $('statusDot');

/* ── AURORA CANVAS ── */
(function initAurora() {
  const canvas = $('auroraCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, t = 0;
  const blobs = [
    { x:.2, y:.2, r:.45, color:'rgba(109,40,217,', speed:.0004, phase:0 },
    { x:.8, y:.3, r:.38, color:'rgba(232,121,249,', speed:.0003, phase:2 },
    { x:.5, y:.8, r:.42, color:'rgba(30,40,180,',  speed:.00035, phase:4 },
    { x:.1, y:.7, r:.30, color:'rgba(16,185,129,',  speed:.0002, phase:1 },
  ];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function draw() {
    ctx.clearRect(0,0,W,H); t++;
    blobs.forEach(b => {
      const ox = Math.sin(t*b.speed+b.phase)*W*0.12, oy = Math.cos(t*b.speed*1.3+b.phase)*H*0.10;
      const cx = b.x*W+ox, cy = b.y*H+oy, r = Math.min(W,H)*b.r;
      const alpha = 0.10 + 0.04*Math.sin(t*b.speed*2+b.phase);
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0,b.color+alpha+')'); g.addColorStop(0.5,b.color+(alpha*0.4)+')'); g.addColorStop(1,b.color+'0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ── PARTICLE SYSTEM ── */
const pCanvas = $('particleCanvas');
const pCtx    = pCanvas.getContext('2d');
const particles = [];
let particleColor = '#c4b5fd';

function spawnParticles(color) {
  particleColor = color;
  for (let i = 0; i < 3; i++) {
    const angle = Math.random()*Math.PI*2, radius = 88+Math.random()*20;
    particles.push({ x:200+Math.cos(angle)*radius, y:200+Math.sin(angle)*radius,
      vx:(Math.random()-0.5)*0.8, vy:-0.5-Math.random()*1.2,
      life:1, decay:0.008+Math.random()*0.012, size:2+Math.random()*3 });
  }
}

function animateParticles() {
  pCtx.clearRect(0,0,400,400);
  for (let i=particles.length-1; i>=0; i--) {
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy*=0.99; p.life-=p.decay;
    if (p.life<=0){particles.splice(i,1);continue;}
    pCtx.globalAlpha=p.life*0.7; pCtx.fillStyle=particleColor;
    pCtx.beginPath(); pCtx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); pCtx.fill();
  }
  pCtx.globalAlpha=1;
  if (running||particles.length>0) requestAnimationFrame(animateParticles);
}

/* ── HELPERS ── */
function formatTime(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}
function syncLabel(id,labelId,noS) { $(labelId).textContent = noS ? $(id).value : $(id).value+'s'; }
function togglePanel() { panelOpen=!panelOpen; $('panelBody').style.display=panelOpen?'block':'none'; $('chevron').classList.toggle('open',panelOpen); }
function toggleStats() { statsOpen=!statsOpen; $('statsOverlay').classList.toggle('hidden',!statsOpen); if(statsOpen) refreshStats(); }
function closeStatsIfOutside(e) { if(e.target===$('statsOverlay')) toggleStats(); }

function refreshStats() {
  $('sTotalBreaths').textContent = totalBreaths;
  $('sTotalTime').textContent    = formatTime(sessionSecs);
  const rate = sessionSecs>0 ? (totalBreaths/(sessionSecs/60)).toFixed(1) : '—';
  $('sBreathRate').textContent   = rate!=='—' ? rate+'/m' : '—';
  const calm = doneCycles>0 ? Math.min(100,Math.round(60+doneCycles*4)) : '—';
  $('sCalmScore').textContent    = calm!=='—' ? calm+'%' : '—';
  const bars = $('historyBars'); bars.innerHTML='';
  cycleHistory.slice(-12).forEach(h => { const b=document.createElement('div'); b.className='history-bar'; b.style.height=Math.max(6,h*4)+'px'; bars.appendChild(b); });
}

/* ── VOICE ── */
function speak(text) {
  if (!voiceOn||!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.rate=0.80; u.pitch=0.93; u.volume=1;
  window.speechSynthesis.speak(u);
}
function toggleVoice() { voiceOn=!voiceOn; $('voiceTrack').classList.toggle('on',voiceOn); $('voiceLabel').textContent=voiceOn?'On':'Off'; }

/* ── HAPTIC ── */
function toggleHaptic() { hapticOn=!hapticOn; $('hapticTrack').classList.toggle('on',hapticOn); $('hapticLabel').textContent=hapticOn?'On':'Off'; }
function pulse() { if(hapticOn&&navigator.vibrate) navigator.vibrate(30); }

/* ── MOOD ── */
const moods = {
  focus:  {i:4,h1:4,e:4,h2:4,label:'Box Breathing'},
  calm:   {i:5,h1:2,e:7,h2:2,label:'Calm Flow'},
  sleep:  {i:4,h1:7,e:8,h2:0,label:'4-7-8 Sleep'},
  energy: {i:2,h1:1,e:3,h2:1,label:'Energising Breath'},
};

function setMood(mood, btn) {
  currentMood = mood; // ✅ dashboard integration
  document.querySelectorAll('.mood-chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  const m=moods[mood];
  $('inDur').value=m.i;  syncLabel('inDur','inLabel');
  $('h1Dur').value=m.h1; syncLabel('h1Dur','h1Label');
  $('exDur').value=m.e;  syncLabel('exDur','exLabel');
  $('h2Dur').value=m.h2; syncLabel('h2Dur','h2Label');
  phaseEyebrow.textContent=m.label;
}

/* ── SOUND ── */
function stopSoundNode() {
  if(lfoNode){try{lfoNode.stop()}catch(e){}lfoNode=null;}
  if(soundNode){try{soundNode.stop()}catch(e){}soundNode=null;}
}

function makeNoise(type) {
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  gainNode=audioCtx.createGain(); gainNode.gain.value=masterVol*0.12; gainNode.connect(audioCtx.destination);
  const bufLen=audioCtx.sampleRate*4, buf=audioCtx.createBuffer(1,bufLen,audioCtx.sampleRate), data=buf.getChannelData(0);
  for(let i=0;i<bufLen;i++) data[i]=Math.random()*2-1;
  const src=audioCtx.createBufferSource(); src.buffer=buf; src.loop=true;
  if(type==='rain'){const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=600;gainNode.gain.value=masterVol*0.15;src.connect(hp);hp.connect(gainNode);}
  else if(type==='ocean'){const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=350;gainNode.gain.value=masterVol*0.22;src.connect(lp);lp.connect(gainNode);lfoNode=audioCtx.createOscillator();lfoNode.frequency.value=0.06;const lfog=audioCtx.createGain();lfog.gain.value=0.08;lfoNode.connect(lfog);lfog.connect(gainNode.gain);lfoNode.start();}
  else if(type==='forest'){const bp=audioCtx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200;bp.Q.value=0.4;gainNode.gain.value=masterVol*0.08;src.connect(bp);bp.connect(gainNode);}
  else if(type==='fire'){const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=200;gainNode.gain.value=masterVol*0.18;src.connect(lp);lp.connect(gainNode);lfoNode=audioCtx.createOscillator();lfoNode.frequency.value=2.5;const lfog=audioCtx.createGain();lfog.gain.value=0.04;lfoNode.connect(lfog);lfog.connect(gainNode.gain);lfoNode.start();}
  else if(type==='space'){const bp=audioCtx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=80;bp.Q.value=0.1;gainNode.gain.value=masterVol*0.25;src.connect(bp);bp.connect(gainNode);}
  else{gainNode.gain.value=masterVol*0.07;src.connect(gainNode);}
  src.start(); soundNode=src;
}

function setSound(s,btn) {
  currentSound=s;
  document.querySelectorAll('.sound-tile').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
  stopSoundNode(); if(s!=='none') makeNoise(s);
}
function setVolume(v) { masterVol=v/100; if(gainNode) gainNode.gain.value=masterVol*0.15; }

/* ── ORB COLORS ── */
const phaseColors = {
  inhale:  {g1:'#d8b4fe',g2:'#7c3aed',g3:'#0f0720',gg:'rgba(196,181,253,.4)', l1:'#e879f9',l2:'#818cf8',part:'#c4b5fd'},
  holdIn:  {g1:'#f5d0fe',g2:'#c026d3',g3:'#3b0764',gg:'rgba(240,171,252,.45)',l1:'#f472b6',l2:'#e879f9',part:'#f0abfc'},
  exhale:  {g1:'#bfdbfe',g2:'#3b82f6',g3:'#1e1b4b',gg:'rgba(147,197,253,.35)',l1:'#818cf8',l2:'#67e8f9',part:'#93c5fd'},
  holdOut: {g1:'#a7f3d0',g2:'#059669',g3:'#022c22',gg:'rgba(110,231,183,.35)',l1:'#6ee7b7',l2:'#a7f3d0',part:'#6ee7b7'},
  done:    {g1:'#6ee7b7',g2:'#10b981',g3:'#022c22',gg:'rgba(52,211,153,.55)', l1:'#34d399',l2:'#6ee7b7',part:'#34d399'},
  idle:    {g1:'#d8b4fe',g2:'#6d28d9',g3:'#0f0720',gg:'rgba(109,40,217,.25)',l1:'#e879f9',l2:'#818cf8',part:'#c4b5fd'},
};

function applyPhaseColor(phase) {
  const c=phaseColors[phase]||phaseColors.idle;
  gs1.setAttribute('stop-color',c.g1); gs2.setAttribute('stop-color',c.g2); gs3.setAttribute('stop-color',c.g3);
  const m=c.gg.match(/[\d.]+/g);
  gg1.setAttribute('stop-color',`rgb(${m[0]},${m[1]},${m[2]})`); gg1.setAttribute('stop-opacity',m[3]);
  lg1.setAttribute('stop-color',c.l1); lg2.setAttribute('stop-color',c.l2);
  orbSvg.className.baseVal='orb-svg '+({inhale:'g-inhale',holdIn:'g-holdIn',exhale:'g-exhale',holdOut:'g-holdOut',done:'g-done'}[phase]||'');
  particleColor=c.part;
}

function setOrbScale(scale) {
  const t=`translate(160,160) scale(${scale}) translate(-160,-160)`;
  mainOrb.setAttribute('transform',t);
  glowHalo.setAttribute('transform',`translate(160,160) scale(${scale*1.18}) translate(-160,-160)`);
}

function setLoaderProgress(progress) {
  loaderRing.setAttribute('stroke-dashoffset', CIRC*(1-progress));
  trackRing.setAttribute('stroke','rgba(255,255,255,0.07)');
  const angle=(progress*360-90)*Math.PI/180;
  loaderDot.setAttribute('cx',160+100*Math.cos(angle));
  loaderDot.setAttribute('cy',160+100*Math.sin(angle));
  loaderDot.setAttribute('opacity',progress>0&&progress<1?1:0);
}

function resetLoader() {
  loaderRing.setAttribute('stroke-dashoffset',CIRC);
  trackRing.setAttribute('stroke','rgba(255,255,255,0.03)');
  loaderDot.setAttribute('opacity',0);
}

/* ── PHASE RUNNER ── */
function startPhase(phaseDef, onDone) {
  if(!running) return;
  currentPhaseKey=phaseDef.key; currentPhaseDuration=phaseDef.duration;
  phaseTotalMs=phaseDef.duration*1000; phaseOnDone=onDone; phasePausedAt=null;
  phaseName.textContent=phaseDef.label; phaseName.className='phase-name '+phaseDef.key;
  phaseSub.textContent=phaseDef.sub; phaseShort.textContent=phaseDef.label;
  applyPhaseColor(phaseDef.key); speak(phaseDef.label); pulse();
  phaseStartTime=performance.now(); tickPhase();
}

function tickPhase(now) {
  if(!running||paused) return;
  now=now||performance.now();
  const elapsed=now-phaseStartTime, progress=Math.min(elapsed/phaseTotalMs,1);
  const secLeft=Math.max(0,Math.ceil(currentPhaseDuration-elapsed/1000));
  orbNum.textContent=secLeft>0?secLeft:'';
  setLoaderProgress(progress);
  let scale=1;
  if(currentPhaseKey==='inhale')  scale=0.76+0.44*progress;
  if(currentPhaseKey==='holdIn')  scale=1.20;
  if(currentPhaseKey==='exhale')  scale=1.20-0.44*progress;
  if(currentPhaseKey==='holdOut') scale=0.76;
  setOrbScale(scale);
  if(Math.random()<0.12) spawnParticles(particleColor);
  if(progress<1){ animFrameReq=requestAnimationFrame(tickPhase); }
  else{ animFrameReq=null; if(phaseOnDone) phaseOnDone(); }
}

/* ── PAUSE / RESUME ── */
function pauseSession() {
  paused=true;
  if(animFrameReq){cancelAnimationFrame(animFrameReq);animFrameReq=null;}
  phasePausedAt=performance.now()-phaseStartTime;
  clearInterval(sessionInterval);
  if(gainNode) gainNode.gain.setTargetAtTime(0,audioCtx.currentTime,0.5);
  window.speechSynthesis&&window.speechSynthesis.cancel();
  statusDot.className='status-dot paused';
  sessionTimer.classList.add('paused');
  pauseBtn.classList.add('paused-state');
  pauseIcon.innerHTML=`<path d="M3 7L6 7M8 7L11 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M4 2.5L11.5 7L4 11.5V2.5Z" fill="currentColor"/>`;
  phaseName.textContent='Paused'; phaseSub.textContent='Session is paused — tap to continue';
}

function resumeSession() {
  paused=false;
  phaseStartTime=performance.now()-(phasePausedAt||0); phasePausedAt=null;
  sessionInterval=setInterval(()=>{sessionSecs++;sessionTimer.textContent=formatTime(sessionSecs);},1000);
  if(currentSound!=='none'&&gainNode) gainNode.gain.setTargetAtTime(masterVol*0.15,audioCtx.currentTime,0.5);
  statusDot.className='status-dot active'; sessionTimer.classList.remove('paused'); pauseBtn.classList.remove('paused-state');
  pauseIcon.innerHTML=`<rect x="2" y="1.5" width="3.5" height="11" rx="1.5" fill="currentColor"/>
    <rect x="8.5" y="1.5" width="3.5" height="11" rx="1.5" fill="currentColor"/>`;
  phaseName.textContent=({inhale:'Breathe in',holdIn:'Hold',exhale:'Breathe out',holdOut:'Hold'}[currentPhaseKey]||'Ready');
  phaseName.className='phase-name '+currentPhaseKey;
  phaseSub.textContent=({inhale:'Slow steady breath through the nose',holdIn:'Keep the breath held gently',exhale:'Release slowly through the mouth',holdOut:'Pause at the bottom, stay relaxed'}[currentPhaseKey]||'');
  tickPhase();
}

function togglePause() { if(paused) resumeSession(); else pauseSession(); }

/* ── BUILD PHASES ── */
function buildPhases() {
  const d={inhale:parseInt($('inDur').value)||4,holdIn:parseInt($('h1Dur').value)||0,exhale:parseInt($('exDur').value)||4,holdOut:parseInt($('h2Dur').value)||0};
  return [
    {key:'inhale', label:'Breathe in', sub:'Slow steady breath through the nose',duration:d.inhale},
    {key:'holdIn', label:'Hold',        sub:'Keep the breath held gently',         duration:d.holdIn},
    {key:'exhale', label:'Breathe out', sub:'Release slowly through the mouth',    duration:d.exhale},
    {key:'holdOut',label:'Hold',        sub:'Pause at the bottom, stay relaxed',   duration:d.holdOut},
  ].filter(p=>p.duration>0);
}

/* ── CYCLE ── */
function runCycle(onDone) {
  if(!running) return;
  const phases=buildPhases(); let i=0;
  const next=()=>{ if(!running) return; if(i>=phases.length){onDone();return;} startPhase(phases[i++],next); };
  next();
}

/* ── START ── */
function startBreathing() {
  if(running) return;
  running=true; paused=false; doneCycles=0; sessionSecs=0; totalBreaths=0; cycleHistory=[];
  const total=parseInt($('cycleCount').value)||5;
  cycleVal.textContent=`0 / ${total}`;
  startBtn.style.display='none'; stopBtn.style.display='flex'; pauseBtn.classList.remove('hidden');
  statusDot.className='status-dot active';
  sessionInterval=setInterval(()=>{sessionSecs++;sessionTimer.textContent=formatTime(sessionSecs);},1000);
  if(currentSound!=='none') makeNoise(currentSound);
  speak('Starting now. Find a comfortable position.');
  animateParticles();
  setTimeout(()=>{
    if(!running) return;
    const doNext=()=>{
      if(!running) return;
      if(doneCycles>=total){finish();return;}
      runCycle(()=>{
        if(!running) return;
        doneCycles++; totalBreaths++;
        cycleHistory.push(parseInt($('inDur').value)+parseInt($('exDur').value));
        cycleVal.textContent=`${doneCycles} / ${total}`;
        resetLoader(); phaseEyebrow.textContent=`Cycle ${doneCycles} of ${total} complete`;
        if(doneCycles<total) setTimeout(doNext,500); else finish();
      });
    };
    doNext();
  },900);
}

/* ── STOP ── */
function stopBreathing() {
  running=false; paused=false;
  if(animFrameReq){cancelAnimationFrame(animFrameReq);animFrameReq=null;}
  clearInterval(sessionInterval); stopSoundNode();
  window.speechSynthesis&&window.speechSynthesis.cancel();
  resetLoader(); setOrbScale(1); applyPhaseColor('idle');
  orbNum.textContent='—'; orbUnit.textContent='breathe';
  phaseName.textContent='Stopped'; phaseName.className='phase-name';
  phaseSub.textContent='Session ended';
  phaseShort.textContent='—'; cycleVal.textContent='— / —';
  sessionTimer.textContent='00:00'; sessionTimer.classList.remove('paused');
  statusDot.className='status-dot';
  startBtn.style.display='flex'; stopBtn.style.display='none';
  pauseBtn.classList.add('hidden'); pauseBtn.classList.remove('paused-state');

  // ✅ Save to dashboard
  if(doneCycles>0) saveSessionToDashboard(doneCycles, sessionSecs, false);
}

/* ── FINISH ── */
function finish() {
  running=false;
  if(animFrameReq){cancelAnimationFrame(animFrameReq);animFrameReq=null;}
  clearInterval(sessionInterval); stopSoundNode();
  speak(`Session complete. Wonderful work. You completed ${doneCycles} cycles.`);
  applyPhaseColor('done'); setLoaderProgress(1); setOrbScale(1.12);
  orbNum.textContent='✓'; orbUnit.textContent='complete';
  phaseName.textContent='Complete'; phaseName.className='phase-name done';
  phaseSub.textContent=`${doneCycles} cycles · ${formatTime(sessionSecs)}`;
  phaseEyebrow.textContent='Well done'; phaseShort.textContent='Done';
  statusDot.className='status-dot active';
  startBtn.style.display='flex'; stopBtn.style.display='none'; pauseBtn.classList.add('hidden');

  // ✅ Save to dashboard
  saveSessionToDashboard(doneCycles, sessionSecs, true);

  setTimeout(()=>{
    setOrbScale(1); applyPhaseColor('idle');
    orbNum.textContent='—'; orbUnit.textContent='breathe';
    phaseName.textContent='Ready'; phaseName.className='phase-name';
    phaseSub.textContent='Choose your mood and begin your journey';
    phaseEyebrow.textContent='not started'; resetLoader();
    sessionTimer.textContent='00:00'; sessionSecs=0;
    cycleVal.textContent='— / —'; phaseShort.textContent='—';
    statusDot.className='status-dot';
  },6000);
}

/* ── INIT ── */
resetLoader(); setOrbScale(1); applyPhaseColor('idle');