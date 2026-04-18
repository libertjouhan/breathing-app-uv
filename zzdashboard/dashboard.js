/* ════════════════════════════════════════════
   BREATHE DASHBOARD — dashboard.js
   ════════════════════════════════════════════ */

const STORAGE_KEY = 'breathe_sessions';

/* ── AURORA ── */
(function() {
  const canvas = document.getElementById('auroraCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  const blobs = [
    { x:.15, y:.15, r:.40, color:'rgba(109,40,217,', s:.00035, p:0 },
    { x:.85, y:.25, r:.35, color:'rgba(168,85,247,', s:.00028, p:2.1 },
    { x:.5,  y:.85, r:.42, color:'rgba(30,40,180,',  s:.00032, p:3.8 },
    { x:.1,  y:.7,  r:.28, color:'rgba(16,185,129,',  s:.00020, p:1.2 },
    { x:.8,  y:.7,  r:.30, color:'rgba(232,121,249,', s:.00025, p:5.0 },
  ];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function draw() {
    ctx.clearRect(0,0,W,H); t++;
    blobs.forEach(b => {
      const ox = Math.sin(t*b.s + b.p)*W*.10, oy = Math.cos(t*b.s*1.3 + b.p)*H*.09;
      const cx = b.x*W+ox, cy = b.y*H+oy, r = Math.min(W,H)*b.r;
      const a = 0.09 + 0.03*Math.sin(t*b.s*2+b.p);
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0, b.color+a+')'); g.addColorStop(0.5, b.color+(a*.3)+')'); g.addColorStop(1, b.color+'0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ── STORAGE ── */
function getSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch(e) { return []; }
}

function saveSessions(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* Public: called by breathing pages */
window.saveBreathingSession = function(session) {
  const sessions = getSessions();
  sessions.push({
    id: Date.now(),
    technique: session.technique || 'Unknown',
    date: session.date || new Date().toISOString(),
    cycles: session.cycles || 0,
    duration: session.duration || 0,
    mood: session.mood || 'Focus',
    completed: session.completed !== false,
  });
  saveSessions(sessions);
};

/* ── HELPERS ── */
function fmt(secs) {
  if (secs < 60) return secs + 's';
  if (secs < 3600) return Math.round(secs/60) + 'm';
  return (secs/3600).toFixed(1) + 'h';
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
function dayKey(iso) {
  const d = new Date(iso);
  return d.toISOString().split('T')[0];
}
function startOfWeek(d) {
  const dd = new Date(d); dd.setDate(dd.getDate() - dd.getDay()); return dayKey(dd.toISOString());
}

/* ── CHART.JS DEFAULTS ── */
Chart.defaults.color = 'rgba(255,255,255,0.35)';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;

const chartInstances = {};
function makeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  chartInstances[id] = new Chart(document.getElementById(id), config);
}

/* ── ANALYTICS ── */
function calcStreak(sessions) {
  if (!sessions.length) return { current: 0, best: 0 };
  const days = [...new Set(sessions.map(s => dayKey(s.date)))].sort();
  let current = 0, best = 0, streak = 1;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i-1]), b = new Date(days[i]);
    const diff = (b - a) / 86400000;
    if (diff === 1) { streak++; } else { best = Math.max(best, streak); streak = 1; }
  }
  best = Math.max(best, streak);
  // Is today or yesterday in the streak?
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now()-86400000).toISOString());
  const last = days[days.length-1];
  current = (last === today || last === yesterday) ? streak : 0;
  return { current, best };
}

function getDailyData(sessions, days=7) {
  const out = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(Date.now() - i*86400000);
    const key = dayKey(d.toISOString());
    const daySessions = sessions.filter(s => dayKey(s.date) === key);
    const totalSecs = daySessions.reduce((a,s) => a + s.duration, 0);
    out.push({ label: d.toLocaleDateString('en-GB', { weekday:'short' }), secs: totalSecs, count: daySessions.length });
  }
  return out;
}

function getWeeklyData(sessions, weeks=4) {
  const out = [];
  for (let i = weeks-1; i >= 0; i--) {
    const start = new Date(Date.now() - (i+1)*7*86400000);
    const end   = new Date(Date.now() - i*7*86400000);
    const wSessions = sessions.filter(s => { const d=new Date(s.date); return d>=start && d<end; });
    const wLabel = `W${weeks-i}`;
    out.push({ label: wLabel, count: wSessions.length, secs: wSessions.reduce((a,s)=>a+s.duration,0) });
  }
  return out;
}

function getTechUsage(sessions) {
  const counts = {};
  sessions.forEach(s => { counts[s.technique] = (counts[s.technique]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

function getMoodUsage(sessions) {
  const counts = {};
  sessions.forEach(s => { counts[s.mood] = (counts[s.mood]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

/* ── CHARTS ── */
const TECH_COLORS = {
  'Box Breathing':     '#a5b4fc',
  '4-7-8 Breathing':  '#f9a8d4',
  'Wim Hof':          '#6ee7b7',
  'Coherent Breathing':'#fde68a',
  'Triangle Breathing':'#c4b5fd',
  'Custom':           '#f0abfc',
};
const MOOD_COLORS = { Focus:'#818cf8', Calm:'#67e8f9', Sleep:'#c4b5fd', Energy:'#fde68a' };

function renderCharts(sessions) {
  const daily   = getDailyData(sessions);
  const weekly  = getWeeklyData(sessions);
  const techUsage = getTechUsage(sessions);
  const moodUsage = getMoodUsage(sessions);

  // Daily bar chart
  makeChart('chartDaily', {
    type: 'bar',
    data: {
      labels: daily.map(d => d.label),
      datasets: [{
        label: 'Minutes',
        data: daily.map(d => Math.round(d.secs/60)),
        backgroundColor: daily.map((d,i) => i === daily.length-1
          ? 'rgba(168,85,247,0.85)'
          : 'rgba(124,58,237,0.45)'),
        borderRadius: 6,
        borderSkipped: false,
        borderColor: daily.map((d,i) => i === daily.length-1
          ? 'rgba(216,180,254,0.7)' : 'transparent'),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => ` ${ctx.raw}m` }}},
      scales: {
        x: { grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'rgba(255,255,255,0.35)' }},
        y: { grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'rgba(255,255,255,0.35)' }, beginAtZero:true },
      }
    }
  });

  // Pie
  if (techUsage.length) {
    makeChart('chartPie', {
      type: 'doughnut',
      data: {
        labels: techUsage.map(t=>t[0]),
        datasets: [{
          data: techUsage.map(t=>t[1]),
          backgroundColor: techUsage.map(t => (TECH_COLORS[t[0]] || '#c4b5fd') + '44'),
          borderColor:     techUsage.map(t => TECH_COLORS[t[0]] || '#c4b5fd'),
          borderWidth: 1.5, hoverOffset: 6,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'70%',
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw}` }}}
      }
    });
    const legend = document.getElementById('pieLegend');
    legend.innerHTML = techUsage.slice(0,5).map(t =>
      `<div class="pie-legend-item">
        <div class="pie-dot" style="background:${TECH_COLORS[t[0]]||'#c4b5fd'}"></div>
        <span>${t[0]}</span>
        <span style="margin-left:auto;color:rgba(255,255,255,.5)">${t[1]}</span>
      </div>`
    ).join('');
  }

  // Weekly line
  makeChart('chartWeekly', {
    type: 'line',
    data: {
      labels: weekly.map(w => w.label),
      datasets: [{
        label: 'Sessions',
        data: weekly.map(w => w.count),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168,85,247,0.08)',
        fill: true,
        tension: 0.45,
        pointBackgroundColor: '#a855f7',
        pointBorderColor: 'rgba(255,255,255,.8)',
        pointBorderWidth: 1.5,
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(255,255,255,.35)'}},
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(255,255,255,.35)'},beginAtZero:true,ticks:{stepSize:1}},
      }
    }
  });

  // Mood bar
  makeChart('chartMood', {
    type: 'bar',
    data: {
      labels: moodUsage.map(m=>m[0]),
      datasets: [{
        data: moodUsage.map(m=>m[1]),
        backgroundColor: moodUsage.map(m => (MOOD_COLORS[m[0]]||'#c4b5fd') + '55'),
        borderColor:     moodUsage.map(m => MOOD_COLORS[m[0]]||'#c4b5fd'),
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(255,255,255,.35)'}, beginAtZero:true },
        y:{ grid:{display:false}, ticks:{color:'rgba(255,255,255,.5)'} },
      }
    }
  });
}

/* ── KPI CARDS ── */
function renderKPIs(sessions) {
  const total    = sessions.length;
  const cycles   = sessions.reduce((a,s) => a+s.cycles, 0);
  const totalSec = sessions.reduce((a,s) => a+s.duration, 0);
  const streak   = calcStreak(sessions);
  const avgSec   = total > 0 ? Math.round(totalSec/total) : 0;
  const techUsage = getTechUsage(sessions);
  const topTech  = techUsage[0];

  // Week-over-week
  const now = Date.now();
  const thisWeek = sessions.filter(s => new Date(s.date) > new Date(now-7*86400000));
  const lastWeek = sessions.filter(s => {
    const d = new Date(s.date);
    return d > new Date(now-14*86400000) && d <= new Date(now-7*86400000);
  });
  const sessChange = lastWeek.length > 0
    ? Math.round((thisWeek.length - lastWeek.length)/lastWeek.length*100)
    : null;

  document.getElementById('kTotalSessions').textContent = total;
  document.getElementById('kTotalCycles').textContent   = cycles;
  document.getElementById('kTotalTime').textContent     = fmt(totalSec);
  document.getElementById('kStreak').textContent        = streak.current;
  document.getElementById('kAvgTime').textContent       = fmt(avgSec);
  document.getElementById('kFavTech').textContent       = topTech ? topTech[0] : '—';

  document.getElementById('kSessionsChange').textContent = sessChange !== null
    ? (sessChange >= 0 ? `+${sessChange}% this week` : `${sessChange}% this week`)
    : 'No prior data';
  document.getElementById('kStreakBest').textContent  = `Best: ${streak.best}`;
  document.getElementById('kFavCount').textContent    = topTech ? `${topTech[1]} sessions` : '—';

  const cyclesThisWeek = thisWeek.reduce((a,s)=>a+s.cycles,0);
  document.getElementById('kCyclesChange').textContent = total > 0 ? `${cyclesThisWeek} this week` : '—';

  const timeThisWeek = thisWeek.reduce((a,s)=>a+s.duration,0);
  document.getElementById('kTimeChange').textContent = total > 0 ? `${fmt(timeThisWeek)} this week` : '—';
}

/* ── INSIGHTS ── */
function renderInsights(sessions) {
  const grid = document.getElementById('insightsGrid');
  const insights = [];

  if (!sessions.length) {
    grid.innerHTML = `<div class="insight-card"><div class="insight-ico">💡</div><div class="insight-text">Complete your first session to unlock personalised insights.</div></div>`;
    return;
  }

  const totalSec = sessions.reduce((a,s)=>a+s.duration,0);
  const cycles   = sessions.reduce((a,s)=>a+s.cycles,0);
  const streak   = calcStreak(sessions);
  const techUsage= getTechUsage(sessions);
  const completed = sessions.filter(s=>s.completed);

  // Peak time of day
  const hours = sessions.map(s=>new Date(s.date).getHours());
  const avgHour = Math.round(hours.reduce((a,b)=>a+b,0)/hours.length);
  const timeLabel = avgHour < 6 ? 'late night' : avgHour < 12 ? 'morning' : avgHour < 17 ? 'afternoon' : avgHour < 21 ? 'evening' : 'night';
  insights.push({ ico:'🌅', text: `You practice most in the <b>${timeLabel}</b>. That's your peak mindfulness window.` });

  // Top technique
  if (techUsage.length) {
    const top = techUsage[0];
    insights.push({ ico:'🏆', text: `<b>${top[0]}</b> is your favourite — you've used it <b>${top[1]}</b> time${top[1]>1?'s':''}.` });
  }

  // Completion rate
  const rate = Math.round(completed.length/sessions.length*100);
  if (rate === 100) insights.push({ ico:'✅', text: `You complete <b>100%</b> of your sessions. Remarkable consistency.` });
  else if (rate >= 70) insights.push({ ico:'📈', text: `<b>${rate}%</b> session completion rate — you finish most of what you start.` });
  else insights.push({ ico:'💪', text: `Try finishing full sessions — your completion rate is <b>${rate}%</b>. Small wins build big habits.` });

  // Streak
  if (streak.current >= 7) insights.push({ ico:'🔥', text: `You're on a <b>${streak.current}-day streak</b>. That's real momentum — keep going.` });
  else if (streak.current > 0) insights.push({ ico:'📅', text: `<b>${streak.current} day streak</b> so far. Reach 7 days to unlock the Week Warrior badge.` });

  // Total time
  if (totalSec >= 3600) insights.push({ ico:'⏳', text: `You've breathed for <b>${(totalSec/3600).toFixed(1)} hours</b> total. That's meaningful time invested in your wellbeing.` });

  // Cycles to next badge
  const cycleMilestones = [100, 500, 1000, 5000];
  const nextMilestone = cycleMilestones.find(m => m > cycles);
  if (nextMilestone) insights.push({ ico:'🎯', text: `You are <b>${nextMilestone - cycles} cycles</b> away from your next milestone badge.` });

  // Variety
  const uniqueTechs = new Set(sessions.map(s=>s.technique)).size;
  if (uniqueTechs < 3) insights.push({ ico:'🌈', text: `You've tried <b>${uniqueTechs} technique${uniqueTechs>1?'s':''}.</b> Explore more to unlock the Explorer badge.` });
  else insights.push({ ico:'🌈', text: `You've explored <b>${uniqueTechs} different techniques</b>. You're building a well-rounded practice.` });

  grid.innerHTML = insights.map(i =>
    `<div class="insight-card"><div class="insight-ico">${i.ico}</div><div class="insight-text">${i.text}</div></div>`
  ).join('');
}

/* ── HISTORY ── */
const TECH_CLASS = {
  'Box Breathing':'tech-box','4-7-8 Breathing':'tech-478','Wim Hof':'tech-wim',
  'Coherent Breathing':'tech-coh','Triangle Breathing':'tech-tri','Custom':'tech-custom',
};
function renderHistory() {
  const filter = document.getElementById('historyFilter').value;
  let sessions = getSessions();
  if (filter !== 'all') sessions = sessions.filter(s=>s.technique===filter);
  sessions = [...sessions].reverse();

  const body  = document.getElementById('historyBody');
  const empty = document.getElementById('historyEmpty');

  if (!sessions.length) {
    body.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  body.innerHTML = sessions.map(s => {
    const cls = TECH_CLASS[s.technique] || 'tech-custom';
    const status = s.completed
      ? `<span class="status-pill status-done">✓ Done</span>`
      : `<span class="status-pill status-stopped">✕ Stopped</span>`;
    return `<tr>
      <td>${fmtShortDate(s.date)}</td>
      <td><span class="tech-badge ${cls}">${s.technique}</span></td>
      <td>${s.cycles}</td>
      <td>${fmt(s.duration)}</td>
      <td>${s.mood}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

/* ── ACHIEVEMENTS ── */
const ACHIEVEMENTS = [
  { id:'first_session',    ico:'🌱', name:'First Breath',       desc:'Complete your first session.',              check: s => s.length >= 1,           max:1,   val: s=>Math.min(1,s.length) },
  { id:'cycles_100',       ico:'💯', name:'Century',            desc:'Complete 100 breathing cycles.',             check: s => s.reduce((a,x)=>a+x.cycles,0)>=100, max:100, val: s=>Math.min(100,s.reduce((a,x)=>a+x.cycles,0)) },
  { id:'cycles_500',       ico:'🚀', name:'Cycle Master',       desc:'Complete 500 breathing cycles.',             check: s => s.reduce((a,x)=>a+x.cycles,0)>=500, max:500, val: s=>Math.min(500,s.reduce((a,x)=>a+x.cycles,0)) },
  { id:'streak_3',         ico:'🌊', name:'Flowing',            desc:'Maintain a 3-day practice streak.',         check: s => calcStreak(s).best>=3,    max:3,   val: s=>Math.min(3,calcStreak(s).best) },
  { id:'streak_7',         ico:'🔥', name:'Week Warrior',       desc:'Maintain a 7-day practice streak.',         check: s => calcStreak(s).best>=7,    max:7,   val: s=>Math.min(7,calcStreak(s).best) },
  { id:'streak_30',        ico:'💎', name:'Diamond Mind',       desc:'Maintain a 30-day practice streak.',        check: s => calcStreak(s).best>=30,   max:30,  val: s=>Math.min(30,calcStreak(s).best) },
  { id:'time_1h',          ico:'⏱',  name:'One Hour',           desc:'Accumulate 1 hour of practice.',            check: s => s.reduce((a,x)=>a+x.duration,0)>=3600, max:3600, val: s=>Math.min(3600,s.reduce((a,x)=>a+x.duration,0)) },
  { id:'time_10h',         ico:'🌟', name:'10 Hours Zen',       desc:'Accumulate 10 hours of practice.',          check: s => s.reduce((a,x)=>a+x.duration,0)>=36000,max:36000, val: s=>Math.min(36000,s.reduce((a,x)=>a+x.duration,0)) },
  { id:'all_techniques',   ico:'🎨', name:'Explorer',           desc:'Try all 5 breathing techniques.',           check: s => new Set(s.map(x=>x.technique)).size>=5, max:5, val: s=>Math.min(5,new Set(s.map(x=>x.technique)).size) },
  { id:'sessions_10',      ico:'🏅', name:'Consistent',         desc:'Complete 10 sessions.',                     check: s => s.length>=10,             max:10,  val: s=>Math.min(10,s.length) },
  { id:'sessions_50',      ico:'🏆', name:'Dedicated',          desc:'Complete 50 sessions.',                     check: s => s.length>=50,             max:50,  val: s=>Math.min(50,s.length) },
  { id:'perfect_completion',ico:'✨', name:'Perfectionist',     desc:'Complete 5 sessions without stopping early.',check: s => s.filter(x=>x.completed).length>=5, max:5, val: s=>Math.min(5,s.filter(x=>x.completed).length) },
];

const UNLOCKED_KEY = 'breathe_achievements';
function getUnlocked() {
  try { return JSON.parse(localStorage.getItem(UNLOCKED_KEY)||'{}'); }
  catch(e) { return {}; }
}

function checkAndUnlockAchievements(sessions) {
  const unlocked = getUnlocked();
  ACHIEVEMENTS.forEach(a => {
    if (!unlocked[a.id] && a.check(sessions)) {
      unlocked[a.id] = new Date().toISOString();
    }
  });
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
}

function renderAchievements() {
  const sessions  = getSessions();
  const unlocked  = getUnlocked();
  const grid      = document.getElementById('badgeGrid');

  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const isUnlocked = !!unlocked[a.id];
    const progress   = a.val(sessions);
    const pct        = Math.round(progress / a.max * 100);

    return `<div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
      <span class="badge-emoji">${a.ico}</span>
      <div class="badge-name">${a.name}</div>
      <div class="badge-desc">${a.desc}</div>
      ${isUnlocked
        ? `<div class="badge-unlock-date">Unlocked ${fmtDate(unlocked[a.id])}</div>`
        : `<div class="badge-progress-wrap">
            <div class="badge-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="badge-progress-txt">${progress} / ${a.max}</div>`
      }
    </div>`;
  }).join('');
}

/* ── NAVIGATION ── */
let activeSection = 'overview';
function showSection(name) {
  activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById('sec-' + name);
  if (sec) { sec.classList.remove('hidden'); sec.style.animation = 'none'; requestAnimationFrame(() => sec.style.animation = ''); }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (name === 'history')      { renderHistory(); }
  if (name === 'achievements') { renderAchievements(); }
  closeSidebar();
}

/* ── SIDEBAR MOBILE ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

/* ── EXPORT / IMPORT ── */
function exportData() {
  const data = { sessions: getSessions(), exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'breathe-data.json'; a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.sessions && Array.isArray(data.sessions)) {
        saveSessions(data.sessions);
        init();
        alert(`Imported ${data.sessions.length} sessions successfully.`);
      } else { alert('Invalid file format.'); }
    } catch(err) { alert('Could not parse file.'); }
  };
  reader.readAsText(file);
}

/* ── RESET ── */
function confirmReset() { document.getElementById('resetModal').classList.remove('hidden'); }
function closeModal()   { document.getElementById('resetModal').classList.add('hidden'); }
function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(UNLOCKED_KEY);
  closeModal(); init();
}

/* ── SEED DEMO DATA (if empty) ── */
function seedDemoData() {
  if (getSessions().length > 0) return;
  const techs = ['Box Breathing','4-7-8 Breathing','Wim Hof','Coherent Breathing','Triangle Breathing'];
  const moods = ['Focus','Calm','Sleep','Energy'];
  const demo  = [];
  for (let i = 29; i >= 0; i--) {
    if (Math.random() < 0.65) {
      const d = new Date(Date.now() - i*86400000);
      d.setHours(Math.floor(Math.random()*14)+7);
      demo.push({
        id: Date.now() - i*86400000,
        technique: techs[Math.floor(Math.random()*techs.length)],
        date: d.toISOString(),
        cycles: Math.floor(Math.random()*8)+2,
        duration: Math.floor(Math.random()*420)+60,
        mood: moods[Math.floor(Math.random()*moods.length)],
        completed: Math.random() > 0.15,
      });
    }
  }
  saveSessions(demo);
}

/* ── INIT ── */
function init() {
  const sessions = getSessions();
  checkAndUnlockAchievements(sessions);
  renderKPIs(sessions);
  renderCharts(sessions);
  renderInsights(sessions);
}

init();

/* ─────────────────────────────────────────────────────────────
   INTEGRATION SNIPPET — paste into every breathing page's
   stopBreathing() / finish() function, or call directly:

   window.saveBreathingSession({
     technique: 'Box Breathing',    // change per page
     date: new Date().toISOString(),
     cycles: doneCycles,
     duration: sessionSecs,
     mood: currentMood || 'Focus',
     completed: true,
   });
──────────────────────────────────────────────────────────────── */
