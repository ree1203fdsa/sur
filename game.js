// ==========================================
//   네오폴리스 — 수도 3D 탐험
//   game.js  (Three.js 3D 엔진)
// ==========================================

// ── CANVAS & MINIMAP SETUP ──
const c = document.getElementById('c');
const mm = document.getElementById('minimap');
const mctx = mm.getContext('2d');

// ── THREE.JS GLOBALS ──
let scene, camera, renderer;
let ambientLight, dirLight, hemiLight;
let cameraYaw = -Math.PI / 2;
let cameraPitch = 0.2;
const bldMaterials = {};
const geomCache = {};

// ── MAP CONSTANTS ──
const MW = 64, MH = 64, MCX = 32, MCY = 32;
const MAP = [];

// ── BUILDING INFO ──
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
  x: 32.5, y: 32.5,
  angle: -Math.PI / 2,
  health: 100, happy: 75, hunger: 80, energy: 100,
  money: 500000,
};

// ── GAME TIME ──
let gMin    = 480;  // starts at 08:00
let dayN    = 1;
let dlgOpen = false;
let locked  = false;

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
  if (locked && !dlgOpen) {
    cameraYaw += e.movementX * 0.0025;
    cameraPitch -= e.movementY * 0.0025;
    cameraPitch = Math.max(-0.6, Math.min(0.8, cameraPitch));
    P.angle = cameraYaw;
  }
});

addEventListener('keydown', e => {
  K[e.key] = true;
  if (e.key === 'Escape' && dlgOpen) closeDialog();
  else if (e.key === 'Escape' && locked) document.exitPointerLock();
  if (e.key === 'e' || e.key === 'E') interact();
  
  // Prevent page scroll for navigation keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].includes(e.key)) {
    e.preventDefault();
  }
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

  // Check what building is in front of the camera view direction
  const ray = castRay(P.x, P.y, cameraYaw);
  if (ray.dist < 1.9 && ray.hit > 0) {
    const b = bldMap[`${ray.mapX},${ray.mapY}`];
    if (b) { openDialog(b.name, b.greet, b.items); return; }
    const bi = BINFO[ray.hit];
    if (bi) { openDialog(bi.name, '이 건물 내부에는 현재 들어갈 수 없습니다.', []); return; }
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
// Pure logical DDA check (used for HUD building name detection and interaction detection)
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

// ── THREE.JS SCENE INITIALIZATION ──

// Create stylized canvas texture for roads and parks footprints
function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Ground base
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, 1024, 1024);

  const scale = 1024 / 64; // 16 pixels per grid tile

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const t = MAP[y][x];
      const px = x * scale;
      const py = y * scale;

      if (t === 0) {
        // Road
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(px, py, scale, scale);

        // Thin blue road lines
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, scale, scale);

        // Center lines on major avenues (grid pattern roads)
        const onMainX = (x % 7 === 0);
        const onMainY = (y % 7 === 0);
        if (onMainX || onMainY) {
          ctx.strokeStyle = 'rgba(255, 176, 48, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          if (onMainX) {
            ctx.moveTo(px + scale/2, py);
            ctx.lineTo(px + scale/2, py + scale);
          }
          if (onMainY) {
            ctx.moveTo(px, py + scale/2);
            ctx.lineTo(px + scale, py + scale/2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (t === 9) {
        // Eco park lawn
        ctx.fillStyle = '#081e0f';
        ctx.fillRect(px, py, scale, scale);
      } else {
        // Building footprint
        ctx.fillStyle = '#05070a';
        ctx.fillRect(px, py, scale, scale);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Generate procedurally textured materials for buildings with neon glowing window grids
function getBuildingMaterial(type, bldInfo, height) {
  const cacheKey = `${type}_${height}`;
  if (bldMaterials[cacheKey]) return bldMaterials[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const base = bldInfo.base;
  const acc = bldInfo.acc;

  // Building base wall color
  ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
  ctx.fillRect(0, 0, 128, 256);

  // Draw windows
  const rows = 12 * height;
  const cols = 4;
  const winW = 20;
  const winH = 10;
  const padX = 9;
  const padY = 8;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Deterministic windows layout based on trigonometric hashes
      const hash = Math.abs(Math.sin(type * 13.7 + r * 27.9 + c * 37.1));
      const winLit = hash > 0.35; // ~65% window lit rate

      const x = padX + c * (winW + padX);
      const y = padY + r * (winH + padY);

      if (winLit) {
        // Glowing neon windows
        ctx.fillStyle = `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})`;
      } else {
        // Dark windows
        ctx.fillStyle = `rgb(${Math.floor(base[0] * 0.18)}, ${Math.floor(base[1] * 0.18)}, ${Math.floor(base[2] * 0.18)})`;
      }
      ctx.fillRect(x, y, winW, winH);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base[0]/255, base[1]/255, base[2]/255),
    roughness: 0.6,
    metalness: 0.2,
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0.8, 0.8, 0.8),
    emissiveIntensity: 1.0
  });

  bldMaterials[cacheKey] = mat;
  return mat;
}

function getBuildingGeometry(height) {
  if (geomCache[height]) return geomCache[height];
  const H = height * 4.0;
  // A box slightly smaller than the 1x1 grid tile to leave space for streets
  const geom = new THREE.BoxGeometry(0.88, H, 0.88);
  geomCache[height] = geom;
  return geom;
}

// Build 3D City Meshes
function init3DCity() {
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const t = MAP[y][x];
      if (t > 0) {
        const bi = BINFO[t];
        if (!bi) continue;

        const distFromCentre = Math.sqrt((x - MCX) ** 2 + (y - MCY) ** 2);
        const bh = bHeight(distFromCentre);
        const H = bh * 4.0;

        const geom = getBuildingGeometry(bh);
        const mat = getBuildingMaterial(t, bi, bh);

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x + 0.5, H / 2, y + 0.5);
        scene.add(mesh);

        // Add a neon styling roof cap
        const capGeom = new THREE.BoxGeometry(0.88, 0.08, 0.88);
        const capMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(bi.acc[0]/255, bi.acc[1]/255, bi.acc[2]/255)
        });
        const capMesh = new THREE.Mesh(capGeom, capMat);
        capMesh.position.set(x + 0.5, H + 0.04, y + 0.5);
        scene.add(capMesh);
      }
    }
  }
}

// ── 3D PLAYER MODEL SETUP ──
let playerGroup;
let leftLegGroup, rightLegGroup, leftArmGroup, rightArmGroup;
let torso, head, visorMat;
let walkTime = 0;

function initPlayer3D() {
  playerGroup = new THREE.Group();

  // Materials
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x8a9ba8, // Light metallic silver-blue
    metalness: 0.8,
    roughness: 0.2
  });
  
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2c3e50, // Darker metal trim
    metalness: 0.9,
    roughness: 0.1
  });

  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 2.0
  });

  const orangeGlow = new THREE.MeshStandardMaterial({
    color: 0xffb030,
    emissive: 0xffb030,
    emissiveIntensity: 2.0
  });

  // Torso (chunkier: 0.5 x 0.6 x 0.4)
  const torsoGeom = new THREE.BoxGeometry(0.5, 0.6, 0.4);
  torso = new THREE.Mesh(torsoGeom, metalMat);
  torso.position.y = 0.75;
  playerGroup.add(torso);

  // Power Core on the back (facing Z = -0.21)
  const coreGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
  const core = new THREE.Mesh(coreGeom, glowMat);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.75, -0.21);
  playerGroup.add(core);

  // Head
  const headGeom = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  head = new THREE.Mesh(headGeom, darkMetalMat);
  head.position.y = 1.2;
  playerGroup.add(head);

  // Visor (glowing cyan on the front)
  visorMat = glowMat;
  const visorGeom = new THREE.BoxGeometry(0.3, 0.08, 0.05);
  const visor = new THREE.Mesh(visorGeom, visorMat);
  visor.position.set(0, 1.22, 0.18);
  playerGroup.add(visor);

  // Antennas on ears
  const antennaGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8);
  const leftAntenna = new THREE.Mesh(antennaGeom, darkMetalMat);
  leftAntenna.position.set(-0.19, 1.25, 0);
  leftAntenna.rotation.z = Math.PI / 6;
  playerGroup.add(leftAntenna);
  
  const rightAntenna = new THREE.Mesh(antennaGeom, darkMetalMat);
  rightAntenna.position.set(0.19, 1.25, 0);
  rightAntenna.rotation.z = -Math.PI / 6;
  playerGroup.add(rightAntenna);

  // Orange glowing antenna tips
  const leftTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), orangeGlow);
  leftTip.position.set(-0.22, 1.31, 0);
  playerGroup.add(leftTip);

  const rightTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), orangeGlow);
  rightTip.position.set(0.22, 1.31, 0);
  playerGroup.add(rightTip);

  // Legs and Arms
  const legW = 0.13, legH = 0.45;
  const armW = 0.11, armH = 0.45;

  // Left Leg Group
  leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.16, 0.45, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), darkMetalMat);
  leftLegMesh.position.y = -legH / 2;
  leftLegGroup.add(leftLegMesh);
  
  const footGeom = new THREE.BoxGeometry(legW + 0.04, 0.08, legW + 0.08);
  const leftFoot = new THREE.Mesh(footGeom, metalMat);
  leftFoot.position.set(0, -legH + 0.04, 0.04);
  leftLegGroup.add(leftFoot);
  playerGroup.add(leftLegGroup);

  // Right Leg Group
  rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.16, 0.45, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), darkMetalMat);
  rightLegMesh.position.y = -legH / 2;
  rightLegGroup.add(rightLegMesh);
  
  const rightFoot = new THREE.Mesh(footGeom, metalMat);
  rightFoot.position.set(0, -legH + 0.04, 0.04);
  rightLegGroup.add(rightFoot);
  playerGroup.add(rightLegGroup);

  // Left Arm Group
  leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.31, 0.95, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armW), metalMat);
  leftArmMesh.position.y = -armH / 2;
  leftArmGroup.add(leftArmMesh);
  
  const cuffGeom = new THREE.BoxGeometry(armW + 0.02, 0.06, armW + 0.02);
  const leftCuff = new THREE.Mesh(cuffGeom, orangeGlow);
  leftCuff.position.y = -armH + 0.03;
  leftArmGroup.add(leftCuff);
  playerGroup.add(leftArmGroup);

  // Right Arm Group
  rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.31, 0.95, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armW), metalMat);
  rightArmMesh.position.y = -armH / 2;
  rightArmGroup.add(rightArmMesh);
  
  const rightCuff = new THREE.Mesh(cuffGeom, orangeGlow);
  rightCuff.position.y = -armH + 0.03;
  rightArmGroup.add(rightCuff);
  playerGroup.add(rightArmGroup);

  // Set initial position
  playerGroup.position.set(P.x, 0, P.y);
  scene.add(playerGroup);
}

// ── 3D WEATHER & SKY SYSTEMS ──
let rainGeometry, rainParticles;
const rainCount = 800;

function createRain() {
  rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rainCount * 3);

  for (let i = 0; i < rainCount; i++) {
    positions[i * 3] = P.x + (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = Math.random() * 15;
    positions[i * 3 + 2] = P.y + (Math.random() - 0.5) * 30;
  }

  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const rainMat = new THREE.PointsMaterial({
    color: 0x64a0ff,
    size: 0.08,
    transparent: true,
    opacity: 0.35
  });

  rainParticles = new THREE.Points(rainGeometry, rainMat);
  scene.add(rainParticles);
}

function updateRain(dt) {
  if (!rainParticles) return;
  const positions = rainGeometry.attributes.position.array;

  for (let i = 0; i < rainCount; i++) {
    positions[i * 3 + 1] -= 16 * dt; // gravity

    // Reset particle to top if it hits the ground
    if (positions[i * 3 + 1] < 0) {
      positions[i * 3] = P.x + (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = 12 + Math.random() * 5;
      positions[i * 3 + 2] = P.y + (Math.random() - 0.5) * 30;
    }
  }

  rainGeometry.attributes.position.needsUpdate = true;
}

let starGroup;
function createStars3D() {
  const starCount = 250;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random()); // Only upper hemisphere (y >= 0)
    const r = 160;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.8
  });

  starGroup = new THREE.Points(geom, starMat);
  scene.add(starGroup);
}

// ── INITIALIZE GAME ──
function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020512, 0.04);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xfffaed, 0.8);
  dirLight.position.set(20, 40, 20);
  scene.add(dirLight);

  hemiLight = new THREE.HemisphereLight(0xffffff, 0x222244, 0.25);
  scene.add(hemiLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(64, 64);
  const floorTex = createFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.85,
    metalness: 0.15
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(32, 0, 32); // aligned to cover x/z from 0 to 64
  scene.add(floor);

  // Build the city assets
  init3DCity();

  // Create player
  initPlayer3D();

  // Create stars background
  createStars3D();

  // Create rain particle effects
  createRain();
}

// ── WINDOW RESIZING ──
window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

// ── MAIN RENDER LOOP ──
let prevT = 0;

function render(ts) {
  const dt = Math.min((ts - prevT) / 1000, 0.1);
  prevT = ts;

  if (!scene) {
    // If scene is not initialized yet, set it up
    init3D();
  }

  // ─ Movement ─
  let isMoving = false;
  if (!dlgOpen && locked) {
    const spd = 4.2 * dt;
    let moveX = 0, moveZ = 0;

    // Movement forward/backwards relative to camera rotation
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);

    if (K['w'] || K['W'] || K['ArrowUp']) {
      moveX += fx;
      moveZ += fz;
      isMoving = true;
    }
    if (K['s'] || K['S'] || K['ArrowDown']) {
      moveX -= fx;
      moveZ -= fz;
      isMoving = true;
    }
    if (K['a'] || K['A']) {
      moveX += Math.cos(cameraYaw);
      moveZ -= Math.sin(cameraYaw);
      isMoving = true;
    }
    if (K['d'] || K['D']) {
      moveX -= Math.cos(cameraYaw);
      moveZ += Math.sin(cameraYaw);
      isMoving = true;
    }

    // Keyboard camera steering
    if (K['ArrowLeft']) {
      cameraYaw -= 2.0 * dt;
      P.angle = cameraYaw;
    }
    if (K['ArrowRight']) {
      cameraYaw += 2.0 * dt;
      P.angle = cameraYaw;
    }

    if (isMoving) {
      // Normalize movement direction
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX = (moveX / len) * spd;
      moveZ = (moveZ / len) * spd;

      // Apply collisions using MAP boundaries (P.y is the Z coord in maps)
      const nx = P.x + moveX;
      const nz = P.y + moveZ;
      if (canMove(nx, P.y)) P.x = nx;
      if (canMove(P.x, nz)) P.y = nz;

      // Rotate player group to face movement direction
      const targetRotationY = Math.atan2(moveX, moveZ);
      let diff = targetRotationY - playerGroup.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      playerGroup.rotation.y += diff * 0.15; // smooth rotation
    }
  }

  // Update 3D player position
  if (playerGroup) {
    playerGroup.position.set(P.x, 0, P.y);

    // Player limb animations
    if (isMoving) {
      walkTime += dt;
      leftLegGroup.rotation.x = Math.sin(walkTime * 12) * 0.55;
      rightLegGroup.rotation.x = -Math.sin(walkTime * 12) * 0.55;
      leftArmGroup.rotation.x = -Math.sin(walkTime * 12) * 0.55;
      rightArmGroup.rotation.x = Math.sin(walkTime * 12) * 0.55;

      // slight walking bob
      torso.position.y = 0.55 + Math.abs(Math.sin(walkTime * 12)) * 0.035;
      head.position.y = 0.85 + Math.abs(Math.sin(walkTime * 12)) * 0.035;
    } else {
      // return back to idle pose
      leftLegGroup.rotation.x *= 0.8;
      rightLegGroup.rotation.x *= 0.8;
      leftArmGroup.rotation.x *= 0.8;
      rightArmGroup.rotation.x *= 0.8;

      // breathing bob
      torso.position.y = 0.55 + Math.sin(ts * 0.0025) * 0.01;
      head.position.y = 0.85 + Math.sin(ts * 0.0025) * 0.01;
    }

    // Visor pulsating cyan glow
    if (visorMat) {
      visorMat.emissiveIntensity = 1.6 + Math.sin(ts * 0.004) * 0.4;
    }
  }

  // ─ Camera position tracking 3rd person ─
  if (camera) {
    const camDist = 4.2;
    camera.position.x = P.x - Math.sin(cameraYaw) * Math.cos(cameraPitch) * camDist;
    camera.position.y = 0.8 + Math.sin(cameraPitch) * camDist;
    camera.position.z = P.y - Math.cos(cameraYaw) * Math.cos(cameraPitch) * camDist;
    camera.lookAt(new THREE.Vector3(P.x, 0.75, P.y));
  }

  // ─ Stars follow player center to feel infinite ─
  if (starGroup && playerGroup) {
    starGroup.position.copy(playerGroup.position);
  }

  // ─ Rain update ─
  updateRain(dt);

  // ─ Game time progression ─
  gMin += dt * 6;
  if (gMin >= 1440) { gMin -= 1440; dayN++; P.hunger = Math.max(0, P.hunger - 10); }

  // ─ Ambient Lighting & Sky Colors Cycle ─
  const h24        = (gMin / 60) % 24;
  const isNight    = h24 < 6 || h24 > 20;
  const nightFac   = isNight ? 1 : h24 < 8 ? (8 - h24) / 4 : h24 > 18 ? (h24 - 18) / 4 : 0;
  const ambientMul = 1 - nightFac * 0.55;

  const daySkyColor = new THREE.Color(0x1a2130);
  const nightSkyColor = new THREE.Color(0x020510);
  const skyColor = new THREE.Color().lerpColors(daySkyColor, nightSkyColor, nightFac);

  renderer.setClearColor(skyColor);
  scene.fog.color.copy(skyColor);

  // Lights adjustments
  ambientLight.intensity = 0.15 + (1 - nightFac) * 0.35;
  dirLight.intensity = 0.15 + (1 - nightFac) * 0.65;

  const dayLightCol = new THREE.Color(0xfffaed);
  const nightLightCol = new THREE.Color(0x00bfff);
  dirLight.color.lerpColors(dayLightCol, nightLightCol, nightFac);

  // Orbit sun/moon position
  const sunAngle = (gMin / 1440) * Math.PI * 2 - Math.PI / 2;
  dirLight.position.set(
    P.x + Math.cos(sunAngle) * 40,
    15 + Math.sin(sunAngle) * 30,
    P.y + Math.sin(sunAngle * 0.5) * 15
  );

  // Star opacity fade (visible only at night)
  if (starGroup) {
    starGroup.material.opacity = nightFac * 0.85;
  }

  // Building lights intensity (neon glow)
  for (let key in bldMaterials) {
    bldMaterials[key].emissiveIntensity = 0.25 + nightFac * 1.55;
  }

  // ─ HUD hints for nearest building in screen path ─
  const lookRay = castRay(P.x, P.y, cameraYaw);
  const nearDist = lookRay.dist;
  const nearHit = lookRay.hit;

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
  //   MINIMAP RENDERING (2D overlay)
  // ════════════════════════════════════════
  const MS = 100, VIEW = 16;
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

  // WebGL Render pass
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// ── START ──
requestAnimationFrame(render);
showNotice('🏙️ 네오폴리스 수도에 오신 것을 환영합니다! (3D)');
