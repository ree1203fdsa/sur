// ==========================================
//   네오폴리스 — 수도 1인칭 탐험
//   game.js  (레이캐스팅 3D 엔진)
// ==========================================

// ── CANVAS SETUP ──
const c   = document.getElementById('c');
const ctx = c.getContext('2d');
const mm  = document.getElementById('minimap');
const mctx = mm.getContext('2d');

const RW = 640, RH = 360;
c.width  = RW;
c.height = RH;

const imgData = ctx.createImageData(RW, RH);
const pix     = imgData.data;

// ── MAP CONSTANTS ──
const MW = 64, MH = 64, MCX = 32, MCY = 32;
const MAP = [];

// ── BUILDING INFO ──
// acc = accent (window glow colour)   base = wall base colour
const BINFO = {
  1:  { name: '정부 종합청사',   acc: [160,  80, 255], base: [40, 15, 70] },
  2:  { name: '국제금융센터',    acc: [255, 180,  50], base: [80, 55, 10] },
  3:  { name: '비즈니스 지구',   acc: [  0, 180, 255], base: [10, 30, 80] },
  4:  { name: '테크노 밸리',     acc: [  0, 230, 220], base: [ 8, 55, 60] },
  5:  { name: '상업 지구',       acc: [255, 110,  40], base: [75, 25, 10] },
  6:  { name: '올드타운',        acc: [210, 160,  80], base: [55, 35, 10] },
  7:  { name: '미디어&문화',     acc: [200,  60, 255], base: [45, 10, 70] },
  8:  { name: '주거 단지',       acc: [100, 120, 255], base: [18, 20, 55] },
  9:  { name: '에코 파크',       acc: [ 60, 220,  80], base: [10, 45, 15] },
  10: { name: '헬스플러스 병원', acc: [  0, 230, 180], base: [10, 45, 40] },
  11: { name: '교육 지구',       acc: [ 60, 210, 100], base: [10, 45, 22] },
  12: { name: '스포츠 아레나',   acc: [255,  60,  60], base: [65, 12, 12] },
};

// ── MAP GENERATION (radial city) ──
(function buildMap() {
  for (let y = 0; y < MH; y++) {
    MAP[y] = [];
    for (let x = 0; x < MW; x++) {
      const dx = x - MCX, dy = y - MCY;
      const r  = Math.sqrt(dx * dx + dy * dy);
      const a  = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;

      const gridRoad = (x % 7 < 2) || (y % 7 < 2);
      const ringRoad = Math.abs(r - 6) < 1.1 || Math.abs(r - 13) < 1.2 || Math.abs(r - 21) < 1.3;

      if (gridRoad || ringRoad || r < 3 || r > 28) { MAP[y][x] = 0; continue; }

      const sec = Math.floor(a / 45) % 8;
      let t;
      if      (r < 7)  t = [2, 3, 7, 5, 5, 6, 4, 1][sec];
      else if (r < 14) t = [2, 8, 3, 7, 5, 6, 4, 1][sec];
      else             t = [9, 8,10, 9,11,11,12, 8][sec];
      MAP[y][x] = t;
    }
  }
})();

// ── BUILDING HEIGHT (taller near centre) ──
function bHeight(r) { return Math.max(1, Math.min(3, 3 - r / 10)); }

// ── INTERACTIVE BUILDINGS ──
const BLDS = [
  { tx:32, ty:26, w:3, h:3, type:1, name:'🏛️ 정부 종합청사',
    greet:'네오폴리스 정부 종합청사입니다.\n대통령 집무실과 국무회의실이 있습니다.',
    items:[{ label:'국무회의 참관 (무료)', fn: p => { p.happy = cap(p.happy + 5); return '국무회의를 참관했습니다!' }}] },

  { tx:28, ty:25, w:3, h:3, type:2, name:'🏦 국제금융센터',
    greet:'NPX 국제금융센터입니다.\n세계 금융의 중심입니다.',
    items:[
      { label:'₦100,000 출금',    fn: p => { p.money += 100000; return '₦100,000 출금 완료!' }},
      { label:'주가 확인 (무료)', fn: p => { p.happy = cap(p.happy + 3); return 'NPX 지수: 3,248 (+1.2%) 강세!' }},
    ]},

  { tx:37, ty:28, w:3, h:3, type:3, name:'🏢 대기업 본사',
    greet:'비즈니스 지구 대기업 본사입니다.\n글로벌 기업들이 입주해 있습니다.',
    items:[{ label:'입사 지원서 제출', fn: p => { p.happy = cap(p.happy + 8); return '지원서를 제출했습니다! 연락 드리겠습니다.' }}] },

  { tx:26, ty:32, w:3, h:3, type:4, name:'🔬 AI 연구소',
    greet:'테크노 밸리 AI 연구소입니다.\n최첨단 인공지능을 연구합니다.',
    items:[{ label:'연구 투어 (₦5,000)', fn: p => { if (p.money < 5000) return '비용 부족!'; p.money -= 5000; p.happy = cap(p.happy + 12); return '🤖 최첨단 AI 기술을 직접 봤습니다!' }}] },

  { tx:32, ty:37, w:3, h:3, type:5, name:'🛍️ 프리미엄 백화점',
    greet:'네오폴리스 최대 백화점입니다.\n명품부터 생활용품까지 모두 있습니다.',
    items:[
      { label:'명품 쇼핑 (₦80,000)',  fn: p => { if (p.money < 80000) return '잔액 부족!'; p.money -= 80000; p.happy = cap(p.happy + 25); return '🛍️ 명품 쇼핑 완료! 기분이 최고예요.' }},
      { label:'식품관 식사 (₦15,000)',fn: p => { if (p.money < 15000) return '잔액 부족!'; p.money -= 15000; p.hunger = cap(p.hunger + 40); return '맛있게 먹었습니다!' }},
    ]},

  { tx:29, ty:37, w:3, h:3, type:6, name:'🏺 올드타운 레스토랑',
    greet:'전통 요리를 현대적으로 재해석한 레스토랑입니다.',
    items:[
      { label:'전통 한정식 (₦18,000)', fn: p => { if (p.money < 18000) return '잔액 부족!'; p.money -= 18000; p.hunger = 100; p.happy = cap(p.happy + 20); return '🍱 맛있는 한정식! 배가 불러요.' }},
      { label:'커피 한 잔 (₦4,000)',   fn: p => { if (p.money < 4000) return '잔액 부족!';  p.money -= 4000;  p.energy = cap(p.energy + 15); return '☕ 커피 한 잔, 기분 전환 완료!' }},
    ]},

  { tx:36, ty:33, w:3, h:3, type:7, name:'📺 미디어타워',
    greet:'네오폴리스 미디어 허브입니다.\n6개 방송국이 입주해 있습니다.',
    items:[{ label:'방송국 견학 (₦8,000)', fn: p => { if (p.money < 8000) return '비용 부족!'; p.money -= 8000; p.happy = cap(p.happy + 12); return '📺 TV 스튜디오 견학! 정말 흥미롭네요.' }}] },

  { tx:22, ty:28, w:3, h:3, type:9, name:'🌿 에코 파크',
    greet:'자연과 함께하는 도심 속 휴식 공간입니다.',
    items:[
      { label:'산책하기 (무료)',   fn: p => { p.happy = cap(p.happy + 20); p.energy = cap(p.energy + 10); return '🌳 공원 산책! 마음이 맑아졌어요.' }},
      { label:'벤치 휴식 (무료)', fn: p => { p.energy = cap(p.energy + 35); return '😌 완전히 쉬었습니다. 피로 해소!' }},
    ]},

  { tx:22, ty:37, w:3, h:3, type:10, name:'🏥 헬스플러스 병원',
    greet:'헬스플러스 대학병원입니다.\n최고 수준의 의료 서비스를 제공합니다.',
    items:[
      { label:'진료받기 (₦15,000)',    fn: p => { if (p.money < 15000) return '비용 부족!'; p.money -= 15000; p.health = cap(p.health + 35); return '🏥 치료 완료! 건강이 많이 회복됐어요.' }},
      { label:'종합 건강검진 (₦80,000)',fn: p => { if (p.money < 80000) return '비용 부족!'; p.money -= 80000; p.health = 100; return '✅ 건강검진 완료. 완벽한 상태입니다!' }},
    ]},

  { tx:38, ty:22, w:3, h:3, type:8, name:'✈️ 국제공항',
    greet:'네오폴리스 국제공항입니다.\n여행객 터미널 1, 2가 운영 중입니다.',
    items:[
      { label:'해외여행 출발 (₦500,000)', fn: p => { if (p.money < 500000) return '비용 부족!'; p.money -= 500000; p.happy = cap(p.happy + 40); return '✈️ 해외여행을 다녀왔습니다! 추억 가득!' }},
      { label:'공항 레스토랑 (₦12,000)', fn: p => { if (p.money < 12000) return '비용 부족!'; p.money -= 12000; p.hunger = cap(p.hunger + 45); return '🍴 공항 레스토랑에서 식사했습니다.' }},
    ]},

  { tx:22, ty:22, w:3, h:3, type:11, name:'🎓 네오리아 국립대 (NNU)',
    greet:'NNU 네오리아 국립대학교입니다.\n취업률 91%의 명문 대학교.',
    items:[
      { label:'특강 수강 (₦30,000)',   fn: p => { if (p.money < 30000) return '비용 부족!'; p.money -= 30000; p.happy = cap(p.happy + 12); return '📚 특강 수료! 지식이 늘었습니다.' }},
      { label:'도서관 이용 (무료)',     fn: p => { p.happy = cap(p.happy + 5); return '📖 도서관에서 공부했습니다.' }},
    ]},

  { tx:36, ty:39, w:3, h:3, type:12, name:'🏟️ 스포츠 아레나',
    greet:'네오폴리스 종합 스포츠 아레나입니다.\ne-스포츠 대회와 각종 경기가 열립니다.',
    items:[
      { label:'경기 관람 (₦25,000)',       fn: p => { if (p.money < 25000) return '비용 부족!'; p.money -= 25000; p.happy = cap(p.happy + 30); return '⚽ 스포츠 경기 관람! 정말 흥미진진!' }},
      { label:'e-스포츠 참가 (₦10,000)',   fn: p => { if (p.money < 10000) return '비용 부족!'; p.money -= 10000; p.happy = cap(p.happy + 22); return '🎮 e-스포츠 대회 참가! 승리했습니다!' }},
    ]},
];

// Build collision lookup for interactive buildings
const bldMap = {};
BLDS.forEach(b => {
  for (let dy = 0; dy < b.h; dy++)
    for (let dx = 0; dx < b.w; dx++)
      bldMap[`${b.tx + dx},${b.ty + dy}`] = b;
});

// ── PLAYER STATE ──
const P = {
  x: 32.5, y: 24.5,
  angle: -Math.PI / 2,
  health: 100, happy: 75, hunger: 80, energy: 100,
  money: 500000,
};

// ── GAME TIME ──
let gMin    = 480;  // starts at 08:00
let dayN    = 1;
let dlgOpen = false;
let locked  = false;

// ── STARS (pre-computed, static) ──
const STARS = Array.from({ length: 220 }, () => ({
  x: Math.floor(Math.random() * RW),
  y: Math.floor(Math.random() * RH * 0.48),
  b: 0.3 + Math.random() * 0.7,
  big: Math.random() > 0.95,
}));

// ── RAIN PARTICLES ──
const RAIN = Array.from({ length: 80 }, () => ({
  x:   Math.random() * RW,
  y:   Math.random() * RH,
  spd: 4 + Math.random() * 6,
  len: 8 + Math.random() * 12,
}));

// ── UTILITY ──
function cap(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

// ── INPUT ──
const K = {};

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('lock-screen').style.display = 'none';
  c.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === c;
});

document.addEventListener('mousemove', e => {
  if (locked && !dlgOpen) P.angle += e.movementX * 0.002;
});

addEventListener('keydown', e => {
  K[e.key] = true;
  if (e.key === 'Escape' && dlgOpen) closeDialog();
  else if (e.key === 'Escape' && locked) document.exitPointerLock();
  if (e.key === 'e' || e.key === 'E') interact();
  e.preventDefault();
});
addEventListener('keyup', e => { K[e.key] = false; });

// ── DIALOG ──
function openDialog(name, text, items) {
  dlgOpen = true;
  document.exitPointerLock();

  document.getElementById('dn').textContent = name;
  document.getElementById('dt').innerHTML   = text.replace(/\n/g, '<br>');

  const ic = document.getElementById('di');
  ic.innerHTML = '';

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className  = 'dbtn';
    btn.textContent = item.label;
    btn.onclick = () => { showNotice(item.fn(P)); updateHUD(); };
    ic.appendChild(btn);
  });

  const cl = document.createElement('button');
  cl.className  = 'dbtn cl';
  cl.textContent = '닫기';
  cl.onclick = closeDialog;
  ic.appendChild(cl);

  document.getElementById('dialog').style.display = 'block';
}

function closeDialog() {
  dlgOpen = false;
  document.getElementById('dialog').style.display = 'none';
  c.requestPointerLock();
}

function showNotice(msg) {
  const n = document.getElementById('notice');
  n.textContent  = msg;
  n.style.opacity = '1';
  clearTimeout(n._t);
  n._t = setTimeout(() => (n.style.opacity = '0'), 3200);
}

// ── INTERACT ──
function interact() {
  if (dlgOpen) { closeDialog(); return; }

  // Cast a fan of rays in front of player and check for nearby walls
  for (let col = RW / 2 - 10; col < RW / 2 + 10; col++) {
    const a   = P.angle - FOV / 2 + (col / RW) * FOV;
    const ray = castRay(P.x, P.y, a);
    if (ray.dist < 1.9 && ray.hit > 0) {
      const b = bldMap[`${ray.mapX},${ray.mapY}`];
      if (b) { openDialog(b.name, b.greet, b.items); return; }
      const bi = BINFO[ray.hit];
      if (bi) { openDialog(bi.name, '이 건물 내부에는 현재 들어갈 수 없습니다.', []); return; }
    }
  }
  showNotice('가까이 다가가서 [E] 를 눌러 상호작용하세요.');
}

// ── COLLISION ──
function canMove(nx, ny) {
  const pad = 0.28;
  return [[-pad, -pad], [pad, -pad], [-pad, pad], [pad, pad]].every(([cx, cy]) => {
    const tx = Math.floor(nx + cx), ty = Math.floor(ny + cy);
    return tx >= 0 && tx < MW && ty >= 0 && ty < MH && MAP[ty][tx] === 0;
  });
}

// ── RAYCASTING (DDA) ──
const FOV      = Math.PI / 3;   // 60°
const HALF_FOV = FOV / 2;

function castRay(px, py, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let mapX = Math.floor(px), mapY = Math.floor(py);

  const ddx  = Math.abs(1 / cos), ddy = Math.abs(1 / sin);
  const stepX = cos < 0 ? -1 : 1,  stepY = sin < 0 ? -1 : 1;
  let sdx = cos < 0 ? (px - mapX) * ddx : (mapX + 1 - px) * ddx;
  let sdy = sin < 0 ? (py - mapY) * ddy : (mapY + 1 - py) * ddy;

  let side = 0, hit = 0, dist = 0;
  for (let i = 0; i < 80; i++) {
    if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
    else           { sdy += ddy; mapY += stepY; side = 1; }
    if (mapX < 0 || mapX >= MW || mapY < 0 || mapY >= MH) { dist = 100; break; }
    if (MAP[mapY][mapX] > 0) {
      hit  = MAP[mapY][mapX];
      dist = side === 0 ? sdx - ddx : sdy - ddy;
      break;
    }
  }

  // Exact wall-hit horizontal fraction (for window pattern)
  let wallX = side === 0 ? py + dist * sin : px + dist * cos;
  wallX -= Math.floor(wallX);

  return { dist, hit, side, wallX, mapX, mapY };
}

// ── HUD UPDATE ──
function updateHUD() {
  document.getElementById('mv').textContent = P.money.toLocaleString();

  [['health','bh','nh'], ['happy','bp','np'], ['hunger','bf','nf'], ['energy','be','ne']]
    .forEach(([k, bi, ni]) => {
      const v = Math.max(0, Math.min(100, Math.round(P[k])));
      document.getElementById(bi).style.width  = v + '%';
      document.getElementById(ni).textContent = v;
    });

  const h = Math.floor(gMin / 60) % 24;
  const m = Math.floor(gMin) % 60;
  document.getElementById('tv').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  document.getElementById('td').textContent = `${dayN}일차`;

  const tx = Math.floor(P.x), ty = Math.floor(P.y);
  const t  = MAP[ty]?.[tx] || 0;
  document.getElementById('dname').textContent = t > 0 ? (BINFO[t]?.name || '건물') : '도로 / 광장';
}

// ── PIXEL WRITE ──
function sp(x, y, r, g, b) {
  const i = (y * RW + x) * 4;
  pix[i] = r; pix[i+1] = g; pix[i+2] = b; pix[i+3] = 255;
}

// ── MAIN RENDER LOOP ──
let prevT = 0;

function render(ts) {
  const dt = Math.min((ts - prevT) / 1000, 0.1);
  prevT = ts;

  // ─ Movement ─
  if (!dlgOpen && locked) {
    const spd = 0.055;
    if (K['w'] || K['W'] || K['ArrowUp']) {
      const nx = P.x + Math.cos(P.angle) * spd;
      const ny = P.y + Math.sin(P.angle) * spd;
      if (canMove(nx, P.y)) P.x = nx;
      if (canMove(P.x, ny)) P.y = ny;
    }
    if (K['s'] || K['S'] || K['ArrowDown']) {
      const nx = P.x - Math.cos(P.angle) * spd * 0.65;
      const ny = P.y - Math.sin(P.angle) * spd * 0.65;
      if (canMove(nx, P.y)) P.x = nx;
      if (canMove(P.x, ny)) P.y = ny;
    }
    if (K['a'] || K['A']) {
      const nx = P.x + Math.cos(P.angle - Math.PI / 2) * spd * 0.7;
      const ny = P.y + Math.sin(P.angle - Math.PI / 2) * spd * 0.7;
      if (canMove(nx, P.y)) P.x = nx;
      if (canMove(P.x, ny)) P.y = ny;
    }
    if (K['d'] || K['D']) {
      const nx = P.x + Math.cos(P.angle + Math.PI / 2) * spd * 0.7;
      const ny = P.y + Math.sin(P.angle + Math.PI / 2) * spd * 0.7;
      if (canMove(nx, P.y)) P.x = nx;
      if (canMove(P.x, ny)) P.y = ny;
    }
    if (K['ArrowLeft'])  P.angle -= 0.04;
    if (K['ArrowRight']) P.angle += 0.04;
  }

  // ─ Game time ─
  gMin += dt * 6;
  if (gMin >= 1440) { gMin -= 1440; dayN++; P.hunger = Math.max(0, P.hunger - 10); }

  const h24        = (gMin / 60) % 24;
  const isNight    = h24 < 6 || h24 > 20;
  const nightFac   = isNight ? 1 : h24 < 8 ? (8 - h24) / 4 : h24 > 18 ? (h24 - 18) / 4 : 0;
  const ambientMul = 1 - nightFac * 0.55;

  // ─ Precompute floor ray directions ─
  const rdx0 = Math.cos(P.angle - HALF_FOV), rdy0 = Math.sin(P.angle - HALF_FOV);
  const rdx1 = Math.cos(P.angle + HALF_FOV), rdy1 = Math.sin(P.angle + HALF_FOV);

  // ════════════════════════════════════════
  //   SKY  &  FLOOR  (pixel buffer pass)
  // ════════════════════════════════════════
  const starSet = new Map(STARS.map(s => [`${s.x},${s.y}`, s]));

  for (let row = 0; row < RH; row++) {
    if (row < RH / 2) {
      // ── Sky ──
      const t = row / RH;
      for (let col = 0; col < RW; col++) {
        const key = `${col},${row}`;
        if (starSet.has(key)) {
          const s  = starSet.get(key);
          const bv = Math.floor((0.5 + Math.sin(ts * 0.0008 + col * 0.3) * 0.5) * s.b * 255);
          sp(col, row, bv, bv, Math.min(255, bv + 20));
        } else {
          const sv = Math.floor(t * 40) * nightFac;
          sp(col, row,
            Math.floor(sv * 0.3 * (1 - nightFac)),
            Math.floor(sv * 0.4 * (1 - nightFac)),
            Math.floor(5 + sv * 2 + t * 15 * (1 - nightFac * 0.8)));
        }
      }
    } else {
      // ── Floor casting ──
      const p       = row - RH / 2;
      const rowDist = (RH / 2) / p;
      const fsX = rowDist * (rdx1 - rdx0) / RW;
      const fsY = rowDist * (rdy1 - rdy0) / RW;
      let fx = P.x + rowDist * rdx0;
      let fy = P.y + rowDist * rdy0;

      const fog = Math.max(0, 1 - rowDist / 14);

      for (let col = 0; col < RW; col++) {
        fx += fsX; fy += fsY;
        const onRoad = MAP[Math.floor(fy) & 63]?.[Math.floor(fx) & 63] === 0;
        const f      = Math.floor(fog * (onRoad ? 22 : 28) * ambientMul);

        const fracX = fx - Math.floor(fx), fracY = fy - Math.floor(fy);
        const isLine = (Math.abs(fracX - 0.5) < 0.03 || Math.abs(fracY - 0.5) < 0.03) && onRoad;

        if (isLine) sp(col, row, Math.floor(f * 2.5), Math.floor(f * 2.5), Math.floor(f * 1.5));
        else        sp(col, row, Math.floor(f * 0.7), Math.floor(f * 0.7), f);
      }
    }
  }

  // ════════════════════════════════════════
  //   WALLS  (raycasting pass)
  // ════════════════════════════════════════
  let nearDist = 99, nearHit = 0, nearMX = 0, nearMY = 0;

  for (let col = 0; col < RW; col++) {
    const rayA = P.angle - HALF_FOV + (col / RW) * FOV;
    const ray  = castRay(P.x, P.y, rayA);
    const perp = ray.dist * Math.cos(rayA - P.angle); // fish-eye correction

    if (ray.dist < nearDist && ray.hit > 0) {
      nearDist = ray.dist; nearHit = ray.hit;
      nearMX = ray.mapX; nearMY = ray.mapY;
    }
    if (ray.hit <= 0) continue;

    const bi = BINFO[ray.hit];
    if (!bi) continue;

    const [br, bg, bb] = bi.base;
    const [ar, ag, ab] = bi.acc;

    // Building height scaled by distance from city centre
    const distFromCentre = Math.sqrt((ray.mapX - MCX) ** 2 + (ray.mapY - MCY) ** 2);
    const bh     = bHeight(distFromCentre);
    const wallH  = Math.min(RH * 2.5, Math.floor((RH / perp) * bh));
    const wallTop = Math.max(0, Math.floor(RH / 2 - wallH / 2));
    const wallBot = Math.min(RH, Math.floor(RH / 2 + wallH / 2));

    const fog      = Math.max(0, 1 - perp / 16) * ambientMul;
    const sideMul  = ray.side ? 0.55 : 1.0;

    for (let row = wallTop; row < wallBot; row++) {
      const wy = (row - wallTop) / (wallBot - wallTop);

      // Deterministic window pattern (hash by map pos + window grid cell)
      const wc   = Math.floor(ray.wallX * 14);
      const wr   = Math.floor(wy * 24);
      const isWin = (wc % 4 < 3) && (wr % 5 < 4);
      const hash  = Math.abs(Math.sin(ray.mapX * 97.3 + ray.mapY * 131.7 + wc * 53.1 + wr * 23.9));
      const winLit = isWin && hash > 0.28;

      let r, g, b;
      if (winLit) {
        // Lit window — accent colour with glow falloff
        const wx2 = (wc % 4) / 3, wy2 = (wr % 5) / 4;
        const glow = 1 - Math.max(Math.abs(wx2 - 0.5), Math.abs(wy2 - 0.5)) * 2;
        const gm   = Math.max(0.4, glow) * fog + (isNight ? 0.28 : 0);
        r = Math.min(255, ar * gm + (isNight ? ar * 0.2 : 0));
        g = Math.min(255, ag * gm + (isNight ? ag * 0.2 : 0));
        b = Math.min(255, ab * gm + (isNight ? ab * 0.2 : 0));
      } else if (isWin) {
        // Dark window
        r = br * sideMul * 0.25;
        g = bg * sideMul * 0.25;
        b = bb * sideMul * 0.25;
      } else {
        // Wall surface
        r = br * sideMul * fog;
        g = bg * sideMul * fog;
        b = bb * sideMul * fog;
        // Subtle accent edge at top/bottom of building
        if (row === wallTop || row === wallTop + 1 || row === wallBot - 1) {
          r = Math.min(255, r + ar * fog * 0.18);
          g = Math.min(255, g + ag * fog * 0.18);
          b = Math.min(255, b + ab * fog * 0.18);
        }
      }
      sp(col, row, Math.floor(r), Math.floor(g), Math.floor(b));
    }
  }

  // ── Blit pixel buffer to canvas ──
  ctx.putImageData(imgData, 0, 0);

  // ════════════════════════════════════════
  //   CANVAS 2D OVERLAY  (rain, HUD hints)
  // ════════════════════════════════════════

  // Rain streaks
  ctx.strokeStyle = 'rgba(100,160,255,0.18)';
  ctx.lineWidth   = 1;
  RAIN.forEach(r => {
    r.y += r.spd;
    if (r.y > RH) { r.y = 0; r.x = Math.random() * RW; }
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 1, r.y + r.len);
    ctx.stroke();
  });

  // ── Nearest building name + interact prompt ──
  const dn = document.getElementById('dist-name');
  const ip = document.getElementById('interact-prompt');
  if (nearDist < 2.2 && nearHit > 0) {
    const bi = BINFO[nearHit];
    if (bi) { dn.textContent = bi.name; dn.style.opacity = '1'; }
    ip.style.display = nearDist < 1.9 ? 'block' : 'none';
  } else {
    dn.style.opacity = '0';
    ip.style.display = 'none';
  }

  // ════════════════════════════════════════
  //   MINIMAP
  // ════════════════════════════════════════
  const MS = 100, VIEW = 16; // show 16 tiles around player
  mctx.fillStyle = 'rgba(0,5,15,0.95)';
  mctx.fillRect(0, 0, MS, MS);

  const sc   = MS / (VIEW * 2);
  const offX = P.x - VIEW;
  const offY = P.y - VIEW;

  for (let ty = 0; ty < VIEW * 2; ty++) {
    for (let tx = 0; tx < VIEW * 2; tx++) {
      const mx = Math.floor(offX + tx), my = Math.floor(offY + ty);
      if (mx < 0 || mx >= MW || my < 0 || my >= MH) continue;
      const t = MAP[my][mx];
      if (t > 0) {
        const bi = BINFO[t];
        mctx.fillStyle = `rgb(${bi.acc[0] * 0.3 | 0},${bi.acc[1] * 0.3 | 0},${bi.acc[2] * 0.3 | 0})`;
        mctx.fillRect(tx * sc, ty * sc, sc + 0.5, sc + 0.5);
      }
    }
  }

  // Player dot
  mctx.fillStyle   = '#fff';
  mctx.shadowColor = '#00c8ff';
  mctx.shadowBlur  = 7;
  mctx.beginPath();
  mctx.arc(VIEW * sc, VIEW * sc, 2.8, 0, Math.PI * 2);
  mctx.fill();

  // View direction line
  mctx.strokeStyle = 'rgba(0,200,255,0.75)';
  mctx.lineWidth   = 1;
  mctx.shadowBlur  = 0;
  mctx.beginPath();
  mctx.moveTo(VIEW * sc, VIEW * sc);
  mctx.lineTo(VIEW * sc + Math.cos(P.angle) * 7 * sc, VIEW * sc + Math.sin(P.angle) * 7 * sc);
  mctx.stroke();

  // ── Stats decay ──
  P.hunger = Math.max(0, P.hunger - dt * 0.22);
  P.energy = Math.max(0, P.energy - dt * 0.12);
  if (P.hunger < 15) P.health = Math.max(0, P.health - dt * 0.35);
  if (P.energy < 10) P.happy  = Math.max(0, P.happy  - dt * 0.22);

  updateHUD();
  requestAnimationFrame(render);
}

// ── START ──
requestAnimationFrame(render);
showNotice('🏙️ 네오폴리스 수도에 오신 것을 환영합니다!');
