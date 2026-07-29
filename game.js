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
let cameraPitch = 0.15;
const bldMaterials = {};
const geomCache = {};

// ── FUTURISTIC SCENE GLOBALS ──
let sunSphere, moonSphere;
let hoverVehicles = [];
let cityLights = [];
let streetlights = []; // 3D Streetlights array
let holoSigns = [];
let lightBeams = [];
let roofAntennaMeshes = [];
let skyDome;

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
function bHeight(r) { return Math.max(2, Math.min(8, 8 - r / 5)); }

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
  h: 0, vh: 0, // 3D Jump physics variables
  angle: -Math.PI / 2,
  health: 100, happy: 75, hunger: 80, energy: 100,
  knowledge: 0,
  diploma: '고등학교 졸업',
  isInterior: false,
  currentInterior: null,
  currentFloor: 1,
  money: 500000,
  portfolio: {
    NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0
  }
};

// ── GAME TIME ──
let gMin    = 480;  // starts at 08:00
let dayN    = 1;
let dlgOpen = false;
let locked  = false;
let simInterval = null;

// ── UTILITY ──
function cap(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

// ── INPUT ──
const K = {};

// ── FIREBASE REALTIME DATABASE CONFIG & HELPERS ──
const DB_URL = "https://our-nation-22b63-default-rtdb.asia-southeast1.firebasedatabase.app/";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDisx3nprEfnTvp75xPO9cyBo5x39O6H2k",
  authDomain: "our-nation-22b63.firebaseapp.com",
  databaseURL: DB_URL,
  projectId: "our-nation-22b63",
  storageBucket: "our-nation-22b63.firebasestorage.app",
  messagingSenderId: "326856301939",
  appId: "1:326856301939:web:456460193c219b02143906",
  measurementId: "G-51EN6TXM5L"
};
if (typeof firebase !== 'undefined' && firebase.apps) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
  } catch (e) {
    console.warn("Firebase initializeApp error:", e);
  }
}
let currentUsername = "";
let currentPassword = "";
let currentUserEmail = "";
let isCloudConnected = false;
let autoSaveInterval = null;

// ── ADMIN STATE (ree1203 전용) ──
const ADMIN_ID = 'ree1203';
const adminState = {
  godMode: false,
  invisible: false,
  flyMode: false,
  serverLocked: false,
  autoSanction: false,
  spectateTarget: null,
  flyY: 0,
  logs: [],
  playerPositions: {},
};
let adminPanelOpen = false;
let adminLogInterval = null;
let adminPlayerInterval = null;

// ── MULTIPLAYER STATE ──
const otherPlayers = {}; // { username: { group, lastSeen, x, y, angle, label } }
let multiplayerBroadcastInterval = null;
let multiplayerFetchInterval = null;
const PLAYER_COLORS = [0x00c8ff, 0xff6600, 0x00ff88, 0xff00cc, 0xffcc00, 0xff4444, 0x88ff00];

function getPlayerColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

function createOtherPlayerModel(username) {
  const group = new THREE.Group();
  const color = getPlayerColor(username);

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
  const accentMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 });

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.22), bodyMat);
  torso.position.y = 0.75;
  group.add(torso);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), bodyMat);
  head.position.y = 1.18;
  group.add(head);
  // Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), accentMat);
  visor.position.set(0, 1.2, 0.15);
  group.add(visor);
  // Legs
  [-0.1, 0.1].forEach(ox => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), bodyMat);
    leg.position.set(ox, 0.35, 0);
    group.add(leg);
  });
  // Arms
  [-0.28, 0.28].forEach(ox => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.12), bodyMat);
    arm.position.set(ox, 0.72, 0);
    group.add(arm);
  });

  // Name label (sprite)
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
  ctx2d.roundRect(4, 4, 248, 56, 8);
  ctx2d.fill();
  ctx2d.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx2d.font = 'bold 28px sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.fillText(username.substring(0, 12), 128, 38);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 1.7;
  group.add(sprite);

  group.scale.set(0.18, 0.18, 0.18);
  scene.add(group);
  return group;
}

async function broadcastPlayerPosition() {
  if (!currentUsername || !isCloudConnected) return;
  if (adminState.invisible) return; // 투명 모드: 브로드캐스트 안 함
  const payload = {
    x: P.x, y: P.y, angle: P.angle,
    t: Date.now()
  };
  try {
    await fetch(`${DB_URL}online_players/${encodeURIComponent(currentUsername)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) { /* silent */ }
}

async function fetchOnlinePlayers() {
  if (!isCloudConnected) return;
  try {
    const res = await fetch(`${DB_URL}online_players.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;
    const now = Date.now();
    const seen = new Set();

    for (const [uname, info] of Object.entries(data)) {
      if (uname === currentUsername) continue;
      if (now - (info.t || 0) > 15000) continue; // stale > 15s
      if (info.spectator) continue; // 관전 모드 중인 플레이어는 렌더링 제외
      seen.add(uname);
      if (!otherPlayers[uname]) {
        otherPlayers[uname] = { group: createOtherPlayerModel(uname), x: info.x, y: info.y, angle: info.angle };
      } else {
        otherPlayers[uname].x = info.x;
        otherPlayers[uname].y = info.y;
        otherPlayers[uname].angle = info.angle;
      }
      otherPlayers[uname].lastSeen = now;
    }

    // Remove disconnected players
    for (const uname of Object.keys(otherPlayers)) {
      if (!seen.has(uname)) {
        scene.remove(otherPlayers[uname].group);
        delete otherPlayers[uname];
      }
    }
    // 플레이어 목록 갱신
    const total = Object.keys(otherPlayers).length + 1;
    const badge = document.getElementById('online-count-badge');
    if (badge) badge.textContent = total;
    if (playerListOpen && typeof updatePlayerList === 'function') updatePlayerList();
  } catch (e) { /* silent */ }
}

async function removePlayerFromOnline() {
  if (!currentUsername) return;
  try {
    await fetch(`${DB_URL}online_players/${encodeURIComponent(currentUsername)}.json`, { method: 'DELETE' });
  } catch (e) { /* silent */ }
}

function startMultiplayer() {
  if (multiplayerBroadcastInterval) clearInterval(multiplayerBroadcastInterval);
  if (multiplayerFetchInterval) clearInterval(multiplayerFetchInterval);
  if (chatFetchIntervalId) clearInterval(chatFetchIntervalId);
  if (window.coChatInterval) { clearInterval(window.coChatInterval); window.coChatInterval = null; }
  broadcastPlayerPosition();
  fetchOnlinePlayers();
  fetchChatMessages();
  multiplayerBroadcastInterval = setInterval(broadcastPlayerPosition, 300);
  multiplayerFetchInterval = setInterval(fetchOnlinePlayers, 1500);
  chatFetchIntervalId = setInterval(fetchChatMessages, 2500);
  setTimeout(_applyStoredResolution, 500);
  startPingMeasure();
}

let _pingInterval = null;
async function measurePing() {
  const el = document.getElementById('ping-value');
  const wrap = document.getElementById('ping-display');
  if (!el || !wrap) return;
  try {
    const t0 = performance.now();
    await fetch(`${DB_URL}.json?shallow=true`, { cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    wrap.style.display = '';
    el.textContent = ms;
    el.className = ms < 120 ? 'ping-good' : ms < 300 ? 'ping-mid' : 'ping-bad';
  } catch {
    el.textContent = '??';
    el.className = 'ping-bad';
    wrap.style.display = '';
  }
}
function startPingMeasure() {
  if (_pingInterval) clearInterval(_pingInterval);
  measurePing();
  _pingInterval = setInterval(measurePing, 8000);
}

window.addEventListener('beforeunload', removePlayerFromOnline);
let viewMode = 'third';
let rainIntensity = 0.0;
let weatherState = 'CLEAR'; // CLEAR, CLOUDY, RAINY, FOGGY
let weatherDuration = 480;  // remaining game-minutes in current state
let cloudiness = 0.0;
let fogIntensity = 0.0;

async function fetchUser(usernameOrEmail) {
  try {
    const res = await fetch(`${DB_URL}users/${encodeURIComponent(usernameOrEmail)}.json`);
    if (res.status === 401) {
      throw new Error("PERMISSION_DENIED");
    }
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return { username: usernameOrEmail, data };
      }
    }

    if (usernameOrEmail.includes('@')) {
      const allRes = await fetch(`${DB_URL}users.json?shallow=false`);
      if (allRes.ok) {
        const allUsers = await allRes.json();
        if (allUsers) {
          for (const [uKey, uData] of Object.entries(allUsers)) {
            if (uData && typeof uData === 'object') {
              if (uKey.toLowerCase() === usernameOrEmail.toLowerCase() || 
                  (uData.email && uData.email.toLowerCase() === usernameOrEmail.toLowerCase())) {
                return { username: uKey, data: uData };
              }
            }
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error("Firebase fetch error:", err);
    throw err;
  }
}

async function saveUser(username, password, email = "") {
  if (!username) return;
  const cloudDot = document.getElementById('cloudDot');
  const cloudText = document.getElementById('cloudText');
  
  if (cloudDot) {
    cloudDot.className = 'cloud-dot saving';
    cloudText.textContent = '클라우드 저장 중...';
  }

  const payload = {
    password: password,
    email: email || currentUserEmail || "",
    x: P.x,
    y: P.y,
    angle: P.angle,
    health: P.health,
    happy: P.happy,
    hunger: P.hunger,
    energy: P.energy,
    money: P.money,
    gMin: gMin,
    dayN: dayN,
    portfolio: P.portfolio,
    ownedProperties: P.ownedProperties || [],
    simState: {
      treasury: Sim.treasury,
      gdp: Sim.gdp,
      taxRateIncome: Sim.taxRateIncome,
      taxRateCorporate: Sim.taxRateCorporate,
      taxRateProperty: Sim.taxRateProperty,
      budgetAllocation: Sim.budgetAllocation
    }
  };

  try {
    const res = await fetch(`${DB_URL}users/${encodeURIComponent(username)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 401) throw new Error("PERMISSION_DENIED");
    if (!res.ok) throw new Error("데이터 저장 오류");
    
    isCloudConnected = true;
    if (cloudDot) {
      cloudDot.className = 'cloud-dot connected';
      cloudText.textContent = `${username} (저장됨)`;
    }
  } catch (err) {
    console.error("Firebase save error:", err);
    isCloudConnected = false;
    if (cloudDot) {
      cloudDot.className = 'cloud-dot';
      if (err.message === "PERMISSION_DENIED") {
        cloudText.textContent = '권한 없음 (401)';
      } else {
        cloudText.textContent = '저장 실패';
      }
    }
  }
}

function setLoginStatus(msg, type = "") {
  const el = document.getElementById('login-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg';
  if (type) el.classList.add(type);
}

function disableLoginInputs(disabled) {
  ['username', 'password', 'loginBtn', 'registerBtn', 'googleLoginBtn', 'guestBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

// ════════════════════════════════════════════════════════
//  GOOGLE LOGIN INTEGRATION (Google Identity Services)
// ════════════════════════════════════════════════════════
const GOOGLE_CLIENT_ID = "326856301939.apps.googleusercontent.com";

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT parse error:", e);
    return null;
  }
}

async function loginWithGoogleAccount(gUsername, gEmail = "") {
  setLoginStatus("Google 계정 프로필 로드 중...", "success");
  disableLoginInputs(true);

  try {
    // 1. 기존 데이터베이스 유저 확인
    let userData = await fetchUser(gUsername);

    // 2. 신규 구글 유저인 경우 프로필 자동 생성
    if (!userData) {
      currentUsername = gUsername;
      currentPassword = "GOOGLE_AUTH_USER";
      isCloudConnected = true;

      P.x = 32.5; P.y = 32.5; P.angle = -Math.PI / 2;
      P.health = 100; P.happy = 75; P.hunger = 80; P.energy = 100;
      P.money = 500000;
      P.portfolio = { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };
      gMin = 480; dayN = 1;

      Sim.init();
      await saveUser(currentUsername, currentPassword);
    } else {
      // 3. 기존 유저 데이터 복원
      currentUsername = gUsername;
      currentPassword = userData.password || "GOOGLE_AUTH_USER";
      isCloudConnected = true;

      const rawX = userData.x !== undefined ? userData.x : 32.5;
      const rawY = userData.y !== undefined ? userData.y : 32.5;
      const safePos = findSafeSpawn(rawX, rawY);
      P.x = safePos.x; P.y = safePos.y;
      P.angle = userData.angle !== undefined ? userData.angle : -Math.PI / 2;
      P.health = userData.health !== undefined ? userData.health : 100;
      P.happy = userData.happy !== undefined ? userData.happy : 75;
      P.hunger = userData.hunger !== undefined ? userData.hunger : 80;
      P.energy = userData.energy !== undefined ? userData.energy : 100;
      P.money = userData.money !== undefined ? userData.money : 500000;
      gMin = userData.gMin !== undefined ? userData.gMin : 480;
      dayN = userData.dayN !== undefined ? userData.dayN : 1;
      P.portfolio = userData.portfolio || { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };
      P.ownedProperties = userData.ownedProperties || [];

      Sim.init();
      if (userData.simState) {
        Sim.treasury = userData.simState.treasury || Sim.treasury;
        Sim.gdp = userData.simState.gdp || Sim.gdp;
      }
    }

    cameraYaw = P.angle;
    if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
    updateHUD();

    const cloudDot = document.getElementById('cloudDot');
    const cloudText = document.getElementById('cloudText');
    if (cloudDot) {
      cloudDot.className = 'cloud-dot connected';
      cloudText.textContent = `${currentUsername} (Google 연결됨)`;
    }

    document.getElementById('lock-screen').style.display = 'none';
    if (c.requestPointerLock) {
      try { c.requestPointerLock(); } catch(e) {}
    }

    if (simInterval) clearInterval(simInterval);
    simInterval = setInterval(() => { Sim.tick(); updateDashboardData(); }, 10000);

    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => { saveUser(currentUsername, currentPassword); }, 15000);

    startMultiplayer();
    if (currentUsername === ADMIN_ID) initAdminPanel();
    if (currentUsername === 'hsy') initHsyPanel();
    if (currentUsername === 'ree1203') initWeaponSystem();
    initCompanyPanel();
    initAllFeatures();
    if (typeof initMobileControls === 'function') initMobileControls();

    showNotice(`🏙️ 환영합니다! Google 계정(${currentUsername})으로 진입했습니다.`);
  } catch (err) {
    console.error("Google Login Exception:", err);
    setLoginStatus("Google 로그인 처리 중 오류 발생: " + err.message, "error");
    disableLoginInputs(false);
  }
}
window.loginWithGoogleAccount = loginWithGoogleAccount;


window.handleGoogleLoginResponse = function(response) {
  if (!response || !response.credential) {
    setLoginStatus("Google 인증 데이터를 수신하지 못했습니다.", "error");
    return;
  }
  const payload = parseJwt(response.credential);
  if (!payload) {
    setLoginStatus("Google 토큰 해독 실패", "error");
    return;
  }

  let rawName = payload.name || payload.given_name || (payload.email ? payload.email.split('@')[0] : "구글유저");
  let cleanName = rawName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  if (!cleanName || cleanName.length < 2) cleanName = "G_" + Math.floor(1000 + Math.random() * 9000);
  const gUsername = ("구글_" + cleanName).slice(0, 15);

  loginWithGoogleAccount(gUsername, payload.email);
};

window.startGoogleLogin = async function() {
  setLoginStatus("Google 계정 로그인 창 요청 중...", "success");
  disableLoginInputs(true);

  const isFileProtocol = location.protocol === 'file:';

  // 1. Firebase Auth Provider (HTTP/HTTPS 환경)
  if (!isFileProtocol && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await firebase.auth().signInWithPopup(provider);
      if (result && result.user) {
        const user = result.user;
        const rawName = user.displayName || (user.email ? user.email.split('@')[0] : "구글유저");
        let cleanName = rawName.replace(/[^a-zA-Z0-9가-힣]/g, '');
        if (!cleanName || cleanName.length < 2) cleanName = "G_" + Math.floor(1000 + Math.random() * 9000);
        const gUsername = ("구글_" + cleanName).slice(0, 15);

        await loginWithGoogleAccount(gUsername, user.email || "");
        return;
      }
    } catch (error) {
      console.warn("Firebase Google Sign-In Error/Cancelled:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setLoginStatus("Google 로그인이 취소되었습니다.", "");
        disableLoginInputs(false);
        return;
      }
      if (error.code === 'auth/unauthorized-domain') {
        const curDomain = location.hostname || '현재 도메인';
        setLoginStatus(`Google 로그인 오류: 승인되지 않은 도메인(${curDomain})입니다. Firebase 콘솔 > Authentication > 설정 > 승인된 도메인에 ${curDomain}을(를) 추가해 주세요.`, "error");
        disableLoginInputs(false);
        return;
      }
      if (error.code !== 'auth/operation-not-supported-in-this-environment') {
        setLoginStatus("Google 로그인 오류: " + (error.message || error.code), "error");
        disableLoginInputs(false);
        return;
      }
    }
  }

  // 2. Google Identity Services (GIS) Token Client
  let activeClientId = localStorage.getItem('custom_google_client_id') || GOOGLE_CLIENT_ID;
  if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2 && activeClientId.includes('-')) {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setLoginStatus("Google 계정 프로필 수신 중...", "success");
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const profile = await res.json();
              if (profile && profile.email) {
                const rawName = profile.name || profile.given_name || profile.email.split('@')[0];
                let cleanName = rawName.replace(/[^a-zA-Z0-9가-힣]/g, '');
                if (!cleanName || cleanName.length < 2) cleanName = "G_" + Math.floor(1000 + Math.random() * 9000);
                const gUsername = ("구글_" + cleanName).slice(0, 15);
                await loginWithGoogleAccount(gUsername, profile.email);
                return;
              }
            } catch (err) {
              console.error("Google userinfo fetch error:", err);
            }
          }
          setLoginStatus("Google 인증에 실패했습니다.", "error");
          disableLoginInputs(false);
        },
        error_callback: (err) => {
          console.warn("Google OAuth Error:", err);
          setLoginStatus("Google 로그인 창이 닫혔거나 취소되었습니다.", "error");
          disableLoginInputs(false);
        }
      });

      tokenClient.requestAccessToken();
      return;
    } catch (e) {
      console.warn("Google OAuth2 Token Client Init Error:", e);
    }
  }

  if (isFileProtocol) {
    setLoginStatus("로컬 파일(file://) 환경에서는 웹 서버(http://) 접속 시 구글 팝업 로그인이 지원됩니다. 아이디/이메일 로그인을 이용해 주세요.", "error");
  } else {
    setLoginStatus("Google 인증 모듈을 로드하지 못했습니다.", "error");
  }
  disableLoginInputs(false);
};

window.doGoogleLogin = function(name = "구글_사용자") {
  loginWithGoogleAccount(name, name + "@gmail.com");
};




// ── LOGIN BUTTON EVENT LISTENER ──
document.getElementById('loginBtn').addEventListener('click', async () => {
  const uInput = document.getElementById('username').value.trim();
  const pInput = document.getElementById('password').value.trim();
  
  if (!uInput || !pInput) {
    setLoginStatus("아이디/이메일과 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9가-힣_]{2,40}$/;
  if (!emailRegex.test(uInput) && !usernameRegex.test(uInput)) {
    setLoginStatus("올바른 아이디 또는 이메일 형식을 입력해 주세요.", "error");
    return;
  }

  setLoginStatus("데이터베이스 연결 중...", "");
  disableLoginInputs(true);

  // Firebase Auth Email 로그인 시도
  if (emailRegex.test(uInput) && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      await firebase.auth().signInWithEmailAndPassword(uInput, pInput);
      console.log("Firebase Auth Email 로그인 성공");
    } catch (authErr) {
      console.warn("Firebase Auth Email 로그인 참고:", authErr.message);
    }
  }

  try {
    const userRecord = await fetchUser(uInput);
    
    if (!userRecord || !userRecord.data) {
      setLoginStatus("존재하지 않는 아이디 또는 이메일입니다.", "error");
      disableLoginInputs(false);
      return;
    }

    const { username: foundUsername, data: userData } = userRecord;

    if (userData.password && userData.password !== pInput) {
      setLoginStatus("비밀번호가 일치하지 않습니다.", "error");
      disableLoginInputs(false);
      return;
    }

    // 로그인 성공
    currentUsername = foundUsername;
    currentPassword = pInput;
    currentUserEmail = emailRegex.test(uInput) ? uInput : (userData.email || "");
    isCloudConnected = true;

    // Load progress
    const rawX = userData.x !== undefined ? userData.x : 32.5;
    const rawY = userData.y !== undefined ? userData.y : 32.5;
    const safePos = findSafeSpawn(rawX, rawY);
    P.x = safePos.x;
    P.y = safePos.y;
    P.angle = userData.angle !== undefined ? userData.angle : -Math.PI / 2;
    P.health = userData.health !== undefined ? userData.health : 100;
    P.happy = userData.happy !== undefined ? userData.happy : 75;
    P.hunger = userData.hunger !== undefined ? userData.hunger : 80;
    P.energy = userData.energy !== undefined ? userData.energy : 100;
    P.money = userData.money !== undefined ? userData.money : 500000;
    gMin = userData.gMin !== undefined ? userData.gMin : 480;
    dayN = userData.dayN !== undefined ? userData.dayN : 1;
    P.portfolio = userData.portfolio || { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };
    P.ownedProperties = userData.ownedProperties || [];

    Sim.init();
    if (userData.simState) {
      Sim.treasury = userData.simState.treasury || Sim.treasury;
      Sim.gdp = userData.simState.gdp || Sim.gdp;
      Sim.taxRateIncome = userData.simState.taxRateIncome || Sim.taxRateIncome;
      Sim.taxRateCorporate = userData.simState.taxRateCorporate || Sim.taxRateCorporate;
      Sim.taxRateProperty = userData.simState.taxRateProperty || Sim.taxRateProperty;
      Sim.budgetAllocation = userData.simState.budgetAllocation || Sim.budgetAllocation;
    }

    cameraYaw = P.angle;

    if (playerGroup) {
      playerGroup.position.set(P.x, 0, P.y);
    }

    updateHUD();
    
    // Set cloud HUD state
    const cloudDot = document.getElementById('cloudDot');
    const cloudText = document.getElementById('cloudText');
    if (cloudDot) {
      cloudDot.className = 'cloud-dot connected';
      cloudText.textContent = `${currentUsername} (연결됨)`;
    }

    // Start game
    document.getElementById('lock-screen').style.display = 'none';
    if (c.requestPointerLock) {
      try { c.requestPointerLock(); } catch(e) {}
    }
    
    if (simInterval) clearInterval(simInterval);
    simInterval = setInterval(() => {
      Sim.tick();
      updateDashboardData();
    }, 10000);

    // Start auto-save loop (every 15 seconds)
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
      saveUser(currentUsername, currentPassword);
    }, 15000);

    startMultiplayer();
    if (currentUsername === ADMIN_ID) initAdminPanel();
    if (currentUsername === 'hsy') initHsyPanel();
    if (currentUsername === 'ree1203') initWeaponSystem();
    initCompanyPanel();
    initAllFeatures();
    if (typeof initMobileControls === 'function') initMobileControls();
    // 대통령 집무실 버튼은 ree1203만 표시
    const _dbBtn = document.getElementById('dashboard-toggle-btn');
    if (_dbBtn) _dbBtn.style.display = currentUsername === 'ree1203' ? '' : 'none';
    // 채팅 전체 삭제 버튼은 ree1203만 표시
    const _chatClearBtn = document.getElementById('chat-clear-all-btn');
    if (_chatClearBtn) _chatClearBtn.style.display = currentUsername === 'ree1203' ? '' : 'none';
    showNotice(`🏙️ 환영합니다, ${currentUsername}님! 로그인되었습니다.`);
  } catch (err) {
    if (err.message === "PERMISSION_DENIED") {
      setLoginStatus("접근 권한이 없습니다. Firebase 규칙(.read/.write)을 true로 설정해 주세요.", "error");
    } else {
      setLoginStatus("연결 실패: " + err.message, "error");
    }
    disableLoginInputs(false);
  }
});

// ── REGISTER BUTTON EVENT LISTENER ──
document.getElementById('registerBtn').addEventListener('click', async () => {
  const uInput = document.getElementById('username').value.trim();
  const pInput = document.getElementById('password').value.trim();
  
  if (!uInput || !pInput) {
    setLoginStatus("아이디/이메일과 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9가-힣_]{2,20}$/;
  const isEmail = emailRegex.test(uInput);
  const isUsername = usernameRegex.test(uInput);

  if (!isEmail && !isUsername) {
    setLoginStatus("아이디(2~20자) 또는 이메일 형식을 입력해 주세요.", "error");
    return;
  }
  
  if (pInput.length < 4) {
    setLoginStatus("비밀번호는 최소 4자 이상이어야 합니다.", "error");
    return;
  }

  setLoginStatus("중복 검사 및 계정 생성 중...", "");
  disableLoginInputs(true);

  let targetUsername = uInput;
  let targetEmail = "";
  if (isEmail) {
    targetEmail = uInput;
    const prefix = uInput.split('@')[0].replace(/[^a-zA-Z0-9가-힣_]/g, '');
    targetUsername = (prefix.length >= 2 ? prefix : "유저_" + Math.floor(1000 + Math.random() * 9000)).slice(0, 15);
  }

  // Firebase Auth Email Signup
  if (isEmail && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      await firebase.auth().createUserWithEmailAndPassword(uInput, pInput);
      console.log("Firebase Auth Email 가입 성공");
    } catch (authErr) {
      console.warn("Firebase Auth Email 가입 참고:", authErr.message);
    }
  }

  const existingRecord = await fetchUser(uInput);
  if (existingRecord) {
    setLoginStatus("이미 존재하거나 가입된 아이디/이메일입니다.", "error");
    disableLoginInputs(false);
    return;
  }

  setLoginStatus("새 계정 프로필 생성 중...", "success");

  currentUsername = targetUsername;
  currentPassword = pInput;
  currentUserEmail = targetEmail;
  isCloudConnected = true;

  P.x = 32.5; P.y = 32.5; P.angle = -Math.PI / 2;
  P.health = 100; P.happy = 75; P.hunger = 80; P.energy = 100;
  P.money = 500000;
  P.portfolio = { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };
  gMin = 480; dayN = 1;

  Sim.init();
  cameraYaw = P.angle;
  if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
  updateHUD();

  await saveUser(currentUsername, currentPassword, currentUserEmail);

  document.getElementById('lock-screen').style.display = 'none';
  if (c.requestPointerLock) { try { c.requestPointerLock(); } catch(e) {} }
  
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => { Sim.tick(); updateDashboardData(); }, 10000);

  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => { saveUser(currentUsername, currentPassword); }, 15000);

  startMultiplayer();
  showNotice(`🏙️ 회원가입 완료! 환영합니다, ${currentUsername}님!`);
});

window.startGuest = function startGuest() {
  currentUsername = '게스트';
  currentPassword = '';
  isCloudConnected = true; // Force online status

  const guestSpawn = findSafeSpawn(32.5, 32.5);
  P.x = guestSpawn.x; P.y = guestSpawn.y; P.angle = -Math.PI / 2;
  P.health = 100; P.happy = 75; P.hunger = 80; P.energy = 100;
  P.money = 500000;
  P.portfolio = { NEO:0, LHM:0, HYH:0, HAN:0, SEC:0, HWA:0, PLI:0, LGU:0, COD:0, WOO:0, TEN:0 };
  gMin = 480; dayN = 1;

  Sim.init();
  cameraYaw = P.angle;
  if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
  updateHUD();

  const cloudDot = document.getElementById('cloudDot');
  const cloudText = document.getElementById('cloudText');
  if (cloudDot) { 
    cloudDot.className = 'cloud-dot connected'; // Green light
    cloudText.textContent = '게스트 (온라인 연결됨)'; 
  }

  document.getElementById('lock-screen').style.display = 'none';

  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => { Sim.tick(); updateDashboardData(); }, 10000);

  startMultiplayer();
  // 게스트는 대통령 집무실 버튼 숨김
  const _dbBtnG = document.getElementById('dashboard-toggle-btn');
  if (_dbBtnG) _dbBtnG.style.display = 'none';
  showNotice('🎮 게스트 모드로 온라인 연결되어 시작합니다!');
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === c;
});

let isDragging = false;
let prevMouseX = 0;
let prevMouseY = 0;

// Mouse Drag-to-Rotate or Pointer Lock
c.addEventListener('mousedown', e => {
  if (document.getElementById('lock-screen').style.display !== 'none') return;
  isDragging = true;
  prevMouseX = e.clientX;
  prevMouseY = e.clientY;
});

window.addEventListener('mousemove', e => {
  if (locked && !dlgOpen) {
    cameraYaw -= e.movementX * 0.0025;
    P.angle = cameraYaw;
  } else if (isDragging && !dlgOpen) {
    const deltaX = e.clientX - prevMouseX;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    cameraYaw -= deltaX * 0.005;
    P.angle = cameraYaw;
  }
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch Drag-to-Rotate (mobile) — 조이스틱 미사용 시 fallback
// patchTouchCamera()가 initMobileControls()에서 더 정밀하게 대체함
c.addEventListener('touchstart', e => {
  if (document.getElementById('lock-screen').style.display !== 'none') return;
  // 조이스틱 영역(왼쪽 160px) 제외
  const t = e.touches[0];
  if (t && t.clientX > 160) {
    isDragging = true;
    prevMouseX = t.clientX;
    prevMouseY = t.clientY;
  }
}, { passive: true });

c.addEventListener('touchmove', e => {
  if (isDragging && !dlgOpen && e.touches.length >= 1) {
    const t = e.touches[0];
    if (t.clientX <= 160) return;
    const deltaX = t.clientX - prevMouseX;
    const deltaY = t.clientY - prevMouseY;
    prevMouseX = t.clientX;
    prevMouseY = t.clientY;
    cameraYaw   -= deltaX * 0.005;
    cameraPitch  = Math.max(-0.5, Math.min(0.8, cameraPitch + deltaY * 0.004));
    P.angle = cameraYaw;
  }
}, { passive: true });

c.addEventListener('touchend', () => {
  isDragging = false;
});

addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  K[e.key] = true;
  if (e.key === 'Escape' && dlgOpen) closeDialog();
  else if (e.key === 'Escape' && isDashboardOpen) toggleDashboard(false);
  else if (e.key === 'Escape' && locked) {
    document.exitPointerLock();
    // 대기 중인 재난이 있으면 ESC 시 자동 표시
    setTimeout(() => { if (_disasterQueue && _disasterQueue.length > 0) showNextDisasterModal(); }, 100);
  }
  if (e.key === 'e' || e.key === 'E') interact();
  
  if (e.key === ' ' || e.key === 'Spacebar') {
    if (!dlgOpen && !isDashboardOpen && (!P.h || P.h === 0)) {
      P.vh = 3.6; // initial vertical speed impulse
      if (typeof playClick === 'function') playClick();
    }
  }
  
  if (e.key === 'Tab') {
    e.preventDefault();
    if (currentUsername === 'ree1203') toggleDashboard(!isDashboardOpen);
  }
  
  if (e.key === 'r' || e.key === 'R') {
    if (viewMode === 'first') {
      viewMode = 'third';
      showNotice("🎥 3인칭 시점으로 변경되었습니다.");
    } else if (viewMode === 'third') {
      viewMode = 'bird';
      showNotice("🛸 대통령 조감도 모드로 변경되었습니다. (WASD로 탐색 가능)");
    } else {
      viewMode = 'first';
      showNotice("👁️ 1인칭 시점으로 변경되었습니다.");
    }
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = viewMode === 'first' ? 'block' : 'none';
    }
  }

  // Prevent page scroll for navigation keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].includes(e.key)) {
    e.preventDefault();
  }
});
addEventListener('keyup', e => { 
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  K[e.key] = false; 
});

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
    btn.onclick = () => { 
      showNotice(item.fn(P)); 
      updateHUD(); 
      if (currentUsername) saveUser(currentUsername, currentPassword);
    };
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
  if (P.isInterior) {
    handleInteriorInteraction();
    return;
  }
  if (dlgOpen) { closeDialog(); return; }

  const ray = castRay(P.x, P.y, cameraYaw);
  if (ray.dist < 1.9 && ray.hit > 0) {
    const b = bldMap[`${ray.mapX},${ray.mapY}`];
    if (b) {
      const dialogItems = [...(b.items || [])];
      const enterableTypes = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12];
      if (enterableTypes.includes(b.type)) {
        dialogItems.push({
          label: '🚪 건물 실내 입장하기',
          fn: p => {
            setTimeout(() => enterBuilding(b), 100);
            return `${b.name} 내부로 입장합니다...`;
          }
        });
      }
      openDialog(b.name, b.greet, dialogItems);
      return;
    }
    const bi = BINFO[ray.hit];
    if (bi) {
      const dialogItems = [
        {
          label: '🚪 건물 실내 입장하기',
          fn: p => {
            const genericBuilding = { name: bi.name, type: ray.hit, tx: ray.mapX, ty: ray.mapY };
            setTimeout(() => enterBuilding(genericBuilding), 100);
            return `${bi.name} 내부로 입장합니다...`;
          }
        }
      ];
      openDialog(bi.name, '네오폴리스 도시계획 건물입니다. 실내로 들어가실 수 있습니다.', dialogItems);
      return;
    }
  }
  showNotice('가까이 다가가서 [E] 를 눌러 상호작용하세요.');
}

// ── COLLISION ──
function canMove(nx, ny) {
  if (P.isInterior) {
    const dx = nx - 32.5;
    const dy = ny - 32.5;
    return Math.abs(dx) < 4.2 && Math.abs(dy) < 4.2;
  }
  const pad = 0.16;
  return [[-pad, -pad], [pad, -pad], [-pad, pad], [pad, pad]].every(([cx, cy]) => {
    const tx = Math.floor(nx + cx), ty = Math.floor(ny + cy);
    return tx >= 0 && tx < MW && ty >= 0 && ty < MH && MAP[ty][tx] === 0;
  });
}

// ── 안전한 스폰 위치 찾기 ──
function findSafeSpawn(prefX, prefY) {
  // 현재 위치가 이미 안전하면 그대로 반환
  if (canMove(prefX, prefY)) return { x: prefX, y: prefY };

  // 중앙에서 가까운 도로 타일 탐색
  for (let r = 1; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = Math.floor(prefX) + dx;
        const ty = Math.floor(prefY) + dy;
        const cx = tx + 0.5, cy = ty + 0.5;
        if (canMove(cx, cy)) return { x: cx, y: cy };
      }
    }
  }
  return { x: 32.5, y: 32.5 };
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

  const kv = Math.max(0, Math.min(100, Math.round(P.knowledge || 0)));
  const bk = document.getElementById('bk');
  const nk = document.getElementById('nk');
  if (bk) bk.style.width = kv + '%';
  if (nk) nk.textContent = kv;

  const h = Math.floor(gMin / 60) % 24;
  const m = Math.floor(gMin) % 60;
  document.getElementById('tv').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  document.getElementById('td').textContent = `${dayN}일차`;

  const isNight = h < 5 || h >= 21;
  const weatherLabels = {
    CLEAR:  isNight ? '🌙 맑음' : '☀️ 맑음',
    CLOUDY: isNight ? '☁️ 흐림' : '⛅ 흐림',
    RAINY:  '🌧️ 비',
    FOGGY:  '🌫️ 안개'
  };
  const tw = document.getElementById('tw');
  if (tw) tw.textContent = weatherLabels[weatherState] || '☀️ 맑음';

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

  // Ground base — grass green
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(0, 0, 1024, 1024);

  const scale = 1024 / 64; // 16 pixels per grid tile

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const t = MAP[y][x];
      const px = x * scale;
      const py = y * scale;

      if (t === 0) {
        // Road — gray asphalt
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(px, py, scale, scale);

        // Asphalt texture noise
        for (let i = 0; i < 6; i++) {
          const nx = px + Math.random() * scale;
          const ny = py + Math.random() * scale;
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(nx, ny, 2, 2);
        }

        // Road edge lines
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, scale, scale);

        // Center dashed lines on major avenues
        const onMainX = (x % 7 === 0);
        const onMainY = (y % 7 === 0);
        if (onMainX || onMainY) {
          ctx.strokeStyle = 'rgba(255, 230, 50, 0.7)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          if (onMainX) {
            ctx.moveTo(px + scale / 2, py);
            ctx.lineTo(px + scale / 2, py + scale);
          }
          if (onMainY) {
            ctx.moveTo(px, py + scale / 2);
            ctx.lineTo(px + scale, py + scale / 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // White center dashes on normal roads
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          if (Math.random() > 0.5) {
            ctx.moveTo(px + scale / 2, py);
            ctx.lineTo(px + scale / 2, py + scale);
          } else {
            ctx.moveTo(px, py + scale / 2);
            ctx.lineTo(px + scale, py + scale / 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (t === 9) {
        // Eco park — bright grass
        const g1 = '#4e8b40', g2 = '#56963f', g3 = '#3f7035';
        const variants = [g1, g2, g3];
        ctx.fillStyle = variants[(x + y) % 3];
        ctx.fillRect(px, py, scale, scale);
        // Grass texture blades
        ctx.strokeStyle = 'rgba(80,160,60,0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
          const bx = px + (i / 4) * scale + Math.random() * 2;
          ctx.beginPath();
          ctx.moveTo(bx, py + scale);
          ctx.lineTo(bx + 1, py + scale * 0.6);
          ctx.stroke();
        }
      } else {
        // Building footprint — concrete
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(px, py, scale, scale);
        // Slight border to show building base
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 0.5, py + 0.5, scale - 1, scale - 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Generate procedurally textured materials for buildings with neon glowing window grids and varied patterns
function getBuildingMaterial(type, bldInfo, height, patternType = 'grid') {
  const cacheKey = `${type}_${Math.round(height)}_${patternType}`;
  if (bldMaterials[cacheKey]) return bldMaterials[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const base = bldInfo ? bldInfo.base : [40, 40, 50];
  const acc = bldInfo ? bldInfo.acc : [0, 200, 255];

  // Base wall color
  ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
  ctx.fillRect(0, 0, 128, 256);

  // Facade subtle wall grid / panel lines
  ctx.strokeStyle = `rgba(0, 0, 0, 0.25)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 128, 256);

  if (patternType === 'curtain') {
    // Glass curtain wall: vertical metallic mullions + glowing windows
    const cols = 8;
    const colW = 128 / cols;
    for (let c = 0; c <= cols; c++) {
      ctx.strokeStyle = `rgba(${acc[0]}, ${acc[1]}, ${acc[2]}, 0.35)`;
      ctx.beginPath();
      ctx.moveTo(c * colW, 0);
      ctx.lineTo(c * colW, 256);
      ctx.stroke();
    }
    const rows = Math.max(8, Math.floor(16 * height));
    const rowH = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = Math.abs(Math.sin(type * 7.1 + r * 19.3 + c * 31.7));
        if (hash > 0.3) {
          ctx.fillStyle = hash > 0.75 
            ? `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})` 
            : `rgba(${acc[0]}, ${acc[1]}, ${acc[2]}, 0.55)`;
          ctx.fillRect(c * colW + 2, r * rowH + 2, colW - 4, rowH - 4);
        }
      }
    }
  } else if (patternType === 'horizontal') {
    // Ribbon / horizontal strip windows
    const rows = Math.max(6, Math.floor(10 * height));
    const rowH = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const hash = Math.abs(Math.sin(type * 11.3 + r * 17.1));
      ctx.fillStyle = hash > 0.25 
        ? `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})` 
        : `rgb(${Math.floor(base[0]*0.2)}, ${Math.floor(base[1]*0.2)}, ${Math.floor(base[2]*0.2)})`;
      ctx.fillRect(8, r * rowH + 4, 112, Math.max(3, rowH - 8));
    }
  } else if (patternType === 'checker') {
    // Staggered checkerboard windows
    const rows = Math.max(8, Math.floor(14 * height));
    const cols = 5;
    const winW = 16, winH = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          const hash = Math.abs(Math.sin(type * 13.1 + r * 23.3 + c * 37.7));
          if (hash > 0.2) {
            ctx.fillStyle = `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})`;
            ctx.fillRect(10 + c * 22, 6 + r * 16, winW, winH);
          }
        }
      }
    }
  } else if (patternType === 'dots') {
    // Matrix dot lights
    for (let r = 0; r < 24; r++) {
      for (let c = 0; c < 8; c++) {
        const hash = Math.abs(Math.sin(type * 9.3 + r * 13.7 + c * 21.1));
        if (hash > 0.4) {
          ctx.fillStyle = `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})`;
          ctx.beginPath();
          ctx.arc(8 + c * 16, 8 + r * 10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    // Grid (default)
    const rows = Math.max(8, Math.floor(12 * height));
    const cols = 4;
    const winW = 20, winH = 10;
    const padX = 9, padY = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = Math.abs(Math.sin(type * 13.7 + r * 27.9 + c * 37.1));
        if (hash > 0.35) {
          ctx.fillStyle = `rgb(${acc[0]}, ${acc[1]}, ${acc[2]})`;
        } else {
          ctx.fillStyle = `rgb(${Math.floor(base[0] * 0.18)}, ${Math.floor(base[1] * 0.18)}, ${Math.floor(base[2] * 0.18)})`;
        }
        ctx.fillRect(padX + c * (winW + padX), padY + r * (winH + padY), winW, winH);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base[0]/255, base[1]/255, base[2]/255),
    roughness: 0.5,
    metalness: 0.3,
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
  const H = height * 8.0;
  const geom = new THREE.BoxGeometry(0.94, H, 0.94);
  geomCache[height] = geom;
  return geom;
}

// ── ROOFTOP DETAILS GENERATOR ──
function addRoofDetails(group, x, H, z, bh, neonColHex) {
  const rng = (a, b) => a + Math.random() * (b - a);
  const neonMat = new THREE.MeshBasicMaterial({ color: neonColHex });

  // 1. Neon cap rim
  const capGeo = new THREE.BoxGeometry(0.96, 0.12, 0.96);
  const capMesh = new THREE.Mesh(capGeo, neonMat);
  capMesh.position.set(x + 0.5, H + 0.06, z + 0.5);
  group.add(capMesh);

  // 2. HVAC Fan Box or Water Tank or Helipad
  const subType = Math.floor((Math.sin(x * 17.3 + z * 31.1) + 1) * 2);
  if (subType === 0) {
    // HVAC box
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.15, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.8, roughness: 0.3 })
    );
    hvac.position.set(x + 0.35, H + 0.18, z + 0.35);
    group.add(hvac);
  } else if (subType === 1) {
    // Water Tank
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x886644, metalness: 0.4, roughness: 0.6 })
    );
    tank.position.set(x + 0.65, H + 0.22, z + 0.65);
    group.add(tank);
  } else if (subType === 2 && bh >= 5) {
    // Helipad marking disc
    const helipad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.02, 16),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    helipad.position.set(x + 0.5, H + 0.13, z + 0.5);
    group.add(helipad);
    const hMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.022, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    hMark.position.set(x + 0.5, H + 0.14, z + 0.5);
    group.add(hMark);
  }

  // 3. Antenna & blinking tip light for tall buildings
  if (bh >= 4) {
    const antH = rng(1.0, 2.8);
    const antGeo = new THREE.CylinderGeometry(0.02, 0.045, antH, 6);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x444466, metalness: 0.9, roughness: 0.1 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.set(x + 0.5, H + antH / 2 + 0.12, z + 0.5);
    group.add(ant);
    roofAntennaMeshes.push(ant);

    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), tipMat);
    tip.position.set(x + 0.5, H + antH + 0.12, z + 0.5);
    tip.userData.blinkPhase = rng(0, Math.PI * 2);
    group.add(tip);
    roofAntennaMeshes.push(tip);

    // Hologram Torus Ring on ultra tall buildings
    if (bh >= 6 && Math.sin(x * 9.1 + z * 14.3) > 0.1) {
      const ringGeo = new THREE.TorusGeometry(0.52, 0.035, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: neonColHex, transparent: true, opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x + 0.5, H + 0.6, z + 0.5);
      ring.rotation.x = Math.PI / 2;
      ring.userData.baseY = H + 0.6;
      ring.userData.phase = rng(0, Math.PI * 2);
      group.add(ring);
      holoSigns.push(ring);
    }
  }
}

// ── CREATE STANDARD 1x1 ARCHITECTURAL BUILDINGS ──
function createStandardBuilding(x, z, t, bi, bh) {
  const group = new THREE.Group();
  const H = bh * 8.0;
  const neonColHex = new THREE.Color(bi.acc[0]/255, bi.acc[1]/255, bi.acc[2]/255);

  // Pick deterministic style and pattern based on position
  const styleSeed = Math.abs(Math.sin(x * 12.9898 + z * 78.233));
  const styleType = Math.floor(styleSeed * 7); // 0 to 6
  const patternTypes = ['grid', 'curtain', 'horizontal', 'checker', 'dots'];
  const patternType = patternTypes[Math.floor(styleSeed * 5)];

  const mat = getBuildingMaterial(t, bi, bh, patternType);

  if (styleType === 0) {
    // Tiered Setback Skyscraper (3 steps)
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.94, H * 0.45, 0.94), mat);
    b1.position.set(x + 0.5, H * 0.225, z + 0.5);
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.74, H * 0.35, 0.74), mat);
    b2.position.set(x + 0.5, H * 0.45 + H * 0.175, z + 0.5);
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);

    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.52, H * 0.20, 0.52), mat);
    b3.position.set(x + 0.5, H * 0.80 + H * 0.10, z + 0.5);
    b3.castShadow = true; b3.receiveShadow = true;
    group.add(b3);

    addRoofDetails(group, x, H, z, bh, neonColHex);
  } else if (styleType === 1) {
    // Cylindrical Glass Tower
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, H, 16), mat);
    cyl.position.set(x + 0.5, H / 2, z + 0.5);
    cyl.castShadow = true; cyl.receiveShadow = true;
    group.add(cyl);

    // Glowing crown ring
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: neonColHex })
    );
    crown.position.set(x + 0.5, H + 0.04, z + 0.5);
    crown.rotation.x = Math.PI / 2;
    group.add(crown);

    addRoofDetails(group, x, H, z, bh, neonColHex);
  } else if (styleType === 2) {
    // Hexagonal Faceted Tower
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, H, 6), mat);
    hex.position.set(x + 0.5, H / 2, z + 0.5);
    hex.rotation.y = (x + z) * 0.5;
    hex.castShadow = true; hex.receiveShadow = true;
    group.add(hex);

    const roofCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: bi.acc, metalness: 0.7, roughness: 0.2 })
    );
    roofCap.position.set(x + 0.5, H + 0.6, z + 0.5);
    group.add(roofCap);

    addRoofDetails(group, x, H + 1.2, z, bh, neonColHex);
  } else if (styleType === 3) {
    // Angled / Pyramidal Top Tower
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, H * 0.82, 0.92), mat);
    baseMesh.position.set(x + 0.5, H * 0.41, z + 0.5);
    baseMesh.castShadow = true; baseMesh.receiveShadow = true;
    group.add(baseMesh);

    const pyramidRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, H * 0.28, 4),
      new THREE.MeshStandardMaterial({ color: neonColHex, metalness: 0.8, roughness: 0.2 })
    );
    pyramidRoof.position.set(x + 0.5, H * 0.82 + H * 0.14, z + 0.5);
    pyramidRoof.rotation.y = Math.PI / 4;
    group.add(pyramidRoof);

    addRoofDetails(group, x, H * 1.1, z, bh, neonColHex);
  } else if (styleType === 4) {
    // Twin Towers with Skybridge
    const tL = new THREE.Mesh(new THREE.BoxGeometry(0.38, H, 0.38), mat);
    tL.position.set(x + 0.27, H / 2, z + 0.5);
    tL.castShadow = true; tL.receiveShadow = true;
    group.add(tL);

    const tR = new THREE.Mesh(new THREE.BoxGeometry(0.38, H, 0.38), mat);
    tR.position.set(x + 0.73, H / 2, z + 0.5);
    tR.castShadow = true; tR.receiveShadow = true;
    group.add(tR);

    // Skybridge
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.18, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.2 })
    );
    bridge.position.set(x + 0.5, H * 0.65, z + 0.5);
    group.add(bridge);

    addRoofDetails(group, x, H, z, bh, neonColHex);
  } else if (styleType === 5) {
    // Chamfered Balcony Block
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, H, 0.92), mat);
    mainBox.position.set(x + 0.5, H / 2, z + 0.5);
    mainBox.castShadow = true; mainBox.receiveShadow = true;
    group.add(mainBox);

    // Balcony ledges
    const balconyMat = new THREE.MeshBasicMaterial({ color: neonColHex, transparent: true, opacity: 0.7 });
    for (let hFrac = 0.25; hFrac < 0.95; hFrac += 0.22) {
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.05, 0.97), balconyMat);
      balcony.position.set(x + 0.5, H * hFrac, z + 0.5);
      group.add(balcony);
    }

    addRoofDetails(group, x, H, z, bh, neonColHex);
  } else {
    // Traditional Pitch Roof Low/Mid-rise
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.90, H * 0.75, 0.90), mat);
    baseMesh.position.set(x + 0.5, H * 0.375, z + 0.5);
    baseMesh.castShadow = true; baseMesh.receiveShadow = true;
    group.add(baseMesh);

    const pitchRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.70, H * 0.35, 4),
      new THREE.MeshStandardMaterial({ color: 0x884433, roughness: 0.7 })
    );
    pitchRoof.position.set(x + 0.5, H * 0.75 + H * 0.175, z + 0.5);
    pitchRoof.rotation.y = Math.PI / 4;
    group.add(pitchRoof);

    addRoofDetails(group, x, H * 1.05, z, bh, neonColHex);
  }

  scene.add(group);
}

// ── CREATE 3x3 MAJESTIC LANDMARK BUILDINGS ──
function createLandmarkBuilding(b) {
  const group = new THREE.Group();
  const cx = b.tx + 1.5;
  const cz = b.ty + 1.5;
  const bi = BINFO[b.type] || { acc: [0, 229, 255], base: [20, 30, 50] };
  const accentHex = new THREE.Color(bi.acc[0]/255, bi.acc[1]/255, bi.acc[2]/255);
  const baseHex = new THREE.Color(bi.base[0]/255, bi.base[1]/255, bi.base[2]/255);

  const matBase = new THREE.MeshStandardMaterial({ color: baseHex, roughness: 0.4, metalness: 0.4 });
  const matNeon = new THREE.MeshBasicMaterial({ color: accentHex });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x002244, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8 });

  if (b.type === 1) {
    // 🏛️ 정부 종합청사 (Government Complex)
    const basePodium = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 2.7), matBase);
    basePodium.position.set(cx, 0.6, cz);
    group.add(basePodium);

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.2, 2.3), matBase);
    mainHall.position.set(cx, 1.2 + 1.6, cz);
    group.add(mainHall);

    // Neoclassical pillars on front facade
    for (let px = -0.9; px <= 0.9; px += 0.45) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 12), new THREE.MeshStandardMaterial({ color: 0xddddee }));
      col.position.set(cx + px, 1.4 + 1.4, cz + 1.22);
      group.add(col);
    }

    // Side wings
    [-1.5, 1.5].forEach(ox => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 2.2), matBase);
      wing.position.set(cx + ox, 1.2, cz);
      group.add(wing);
    });

    // Grand Capitol Dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: accentHex, metalness: 0.8, roughness: 0.2 })
    );
    dome.position.set(cx, 4.4, cz);
    group.add(dome);

    // Gold Spire & Flagpole
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.8, 8), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    spire.position.set(cx, 5.3, cz);
    group.add(spire);

  } else if (b.type === 2) {
    // 🏦 국제금융센터 (IFC Skyscraper)
    const H = 46.0;
    // Lower Tier
    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 16.0, 2.5), matGlass);
    tier1.position.set(cx, 8.0, cz);
    group.add(tier1);

    // Middle Tier with neon vertical edges
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 18.0, 1.9), matGlass);
    tier2.position.set(cx, 16.0 + 9.0, cz);
    group.add(tier2);

    // Upper Diamond Apex
    const apex = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.3, 10.0, 4), matGlass);
    apex.position.set(cx, 34.0 + 5.0, cz);
    apex.rotation.y = Math.PI / 4;
    group.add(apex);

    // Metallic Spire with Blinking Aviation Light
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 6.0, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
    spire.position.set(cx, 44.0 + 3.0, cz);
    group.add(spire);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1100 }));
    beacon.position.set(cx, 50.0, cz);
    beacon.userData.blinkPhase = 0;
    group.add(beacon);
    roofAntennaMeshes.push(beacon);

    // Observation Deck Ring
    const obsRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 12, 36), matNeon);
    obsRing.position.set(cx, 28.0, cz);
    obsRing.rotation.x = Math.PI / 2;
    group.add(obsRing);

  } else if (b.type === 3) {
    // 🏢 대기업 본사 (Corporate HQ)
    const H = 32.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, H, 2.2), matGlass);
    body.position.set(cx, H / 2, cz);
    group.add(body);

    // Atrium cutout band
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(2.54, 3.5, 2.24), matNeon);
    atrium.position.set(cx, H * 0.6, cz);
    group.add(atrium);

    // Helipad on roof
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0x222233 }));
    pad.position.set(cx, H + 0.03, cz);
    group.add(pad);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 24), matNeon);
    padRing.position.set(cx, H + 0.06, cz);
    padRing.rotation.x = Math.PI / 2;
    group.add(padRing);

  } else if (b.type === 4) {
    // 🔬 AI 연구소 (AI Research Lab)
    const baseFac = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 4.0, 8), matBase);
    baseFac.position.set(cx, 2.0, cz);
    group.add(baseFac);

    // 4 Diagonal Pylons
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.0, 0.3), matBase);
      pylon.position.set(cx + Math.cos(a) * 1.6, 2.5, cz + Math.sin(a) * 1.6);
      pylon.rotation.y = a;
      group.add(pylon);
    }

    // Floating Energy Orb
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00c8ff, emissiveIntensity: 1.8, roughness: 0.1 })
    );
    orb.position.set(cx, 6.2, cz);
    group.add(orb);

    // Spinning Hologram Rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 8, 32), matNeon);
    ring1.position.set(cx, 6.2, cz);
    ring1.rotation.x = Math.PI / 3;
    ring1.userData.baseY = 6.2;
    ring1.userData.phase = 0;
    group.add(ring1);
    holoSigns.push(ring1);

  } else if (b.type === 5) {
    // 🛍️ 프리미엄 백화점 (Premium Department Store)
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 2.5, 24, 1, false, 0, Math.PI * 2), matBase);
    tier1.position.set(cx, 1.25, cz);
    group.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2.5, 24), matGlass);
    tier2.position.set(cx, 2.5 + 1.25, cz);
    group.add(tier2);

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 })
    );
    glassDome.position.set(cx, 5.0, cz);
    group.add(glassDome);

    // Facade Neon Ad Signs
    const colors = [0xff0077, 0x00e5ff, 0xffb030, 0xa855f7];
    for (let i = 0; i < 4; i++) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 0.05),
        new THREE.MeshBasicMaterial({ color: colors[i] })
      );
      const angle = (i / 4) * Math.PI * 2;
      sign.position.set(cx + Math.cos(angle) * 1.55, 2.2, cz + Math.sin(angle) * 1.55);
      sign.rotation.y = -angle + Math.PI / 2;
      group.add(sign);
    }

  } else if (b.type === 6) {
    // 🏺 올드타운 레스토랑 (Hanok Pagoda Style)
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x664433, roughness: 0.8 }));
    b1.position.set(cx, 0.75, cz);
    group.add(b1);

    // 3 Curved Pagoda Roofs
    [
      { y: 1.5, size: 2.6, h: 0.6 },
      { y: 2.8, size: 2.0, h: 0.5 },
      { y: 3.9, size: 1.4, h: 0.4 }
    ].forEach(rf => {
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(rf.size * 0.7, rf.h, 4),
        new THREE.MeshStandardMaterial({ color: 0x223322, roughness: 0.4 })
      );
      roof.position.set(cx, rf.y + rf.h / 2, cz);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    });

    // Hanging Lanterns
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      lantern.position.set(cx + Math.cos(a) * 1.2, 1.3, cz + Math.sin(a) * 1.2);
      group.add(lantern);
    }

  } else if (b.type === 7) {
    // 📺 미디어타워 (Media Broadcasting Tower)
    const basePod = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 2.2), matBase);
    basePod.position.set(cx, 2.0, cz);
    group.add(basePod);

    // Tower Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 20.0, 12), new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.8 }));
    stem.position.set(cx, 4.0 + 10.0, cz);
    group.add(stem);

    // Circular Observation Deck Disk
    const obsDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.0, 20), matGlass);
    obsDeck.position.set(cx, 18.0, cz);
    group.add(obsDeck);
    const obsRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 24), matNeon);
    obsRing.position.set(cx, 18.0, cz);
    obsRing.rotation.x = Math.PI / 2;
    group.add(obsRing);

    // Spire Antenna
    const antSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.15, 8.0, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
    antSpire.position.set(cx, 24.0 + 4.0, cz);
    group.add(antSpire);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    beacon.position.set(cx, 32.0, cz);
    beacon.userData.blinkPhase = 1.5;
    group.add(beacon);
    roofAntennaMeshes.push(beacon);

  } else if (b.type === 8) {
    // ✈️ 국제공항 (International Airport Terminal & Control Tower)
    // Terminal Hall with Curved Roof
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.2, 1.8), matGlass);
    terminal.position.set(cx - 0.2, 1.1, cz + 0.2);
    group.add(terminal);

    const roofArch = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.7, 16, 1, false, 0, Math.PI), matBase);
    roofArch.position.set(cx - 0.2, 2.2, cz + 0.2);
    roofArch.rotation.z = Math.PI / 2;
    group.add(roofArch);

    // Air Traffic Control Tower
    const ctrlTower = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 11.0, 10), matBase);
    ctrlTower.position.set(cx + 1.1, 5.5, cz - 1.0);
    group.add(ctrlTower);

    const ctrlCab = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.8, 10), matGlass);
    ctrlCab.position.set(cx + 1.1, 11.4, cz - 1.0);
    group.add(ctrlCab);

  } else if (b.type === 9) {
    // 🌿 에코 파크 (Eco Park Grounds & Trees & Fountain)
    const treePositions = [
      [-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0], [0, -1.1], [0, 1.1]
    ];
    treePositions.forEach(([ox, oz]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x553311 }));
      trunk.position.set(cx + ox, 0.4, cz + oz);
      group.add(trunk);

      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x228833, roughness: 0.6 }));
      leaves.position.set(cx + ox, 1.2, cz + oz);
      group.add(leaves);
    });

    // Central Fountain
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0x8899aa }));
    basin.position.set(cx, 0.125, cz);
    group.add(basin);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0x00c8ff, transparent: true, opacity: 0.8 }));
    water.position.set(cx, 0.24, cz);
    group.add(water);

  } else if (b.type === 10) {
    // 🏥 헬스플러스 병원 (Hospital Tower with Red Cross & Helipad)
    const H = 16.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, H, 2.0), new THREE.MeshStandardMaterial({ color: 0xeeeeff, roughness: 0.3 }));
    body.position.set(cx, H / 2, cz);
    group.add(body);

    // Red Emergency Cross (+) Logo
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.06), redMat);
    crossV.position.set(cx, H - 2.0, cz + 1.02);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.06), redMat);
    crossH.position.set(cx, H - 2.0, cz + 1.02);
    group.add(crossH);

    // Rooftop Helipad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0x334455 }));
    pad.position.set(cx, H + 0.03, cz);
    group.add(pad);

  } else if (b.type === 11) {
    // 🎓 네오리아 국립대 (NNU Campus Clock Tower)
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 2.0), matBase);
    mainHall.position.set(cx, 1.4, cz);
    group.add(mainHall);

    // Historic Clock Tower Spire
    const clockTower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 12.0, 0.9), matBase);
    clockTower.position.set(cx, 6.0, cz);
    group.add(clockTower);

    // Clock Face
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    clockFace.rotation.x = Math.PI / 2;
    clockFace.position.set(cx, 10.5, cz + 0.46);
    group.add(clockFace);

    const roofSpire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x884422 }));
    roofSpire.position.set(cx, 12.0 + 1.1, cz);
    roofSpire.rotation.y = Math.PI / 4;
    group.add(roofSpire);

  } else if (b.type === 12) {
    // 🏟️ 스포츠 아레나 (Sports Arena Dome Stadium)
    const stadiumDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.7, roughness: 0.2 })
    );
    stadiumDome.position.set(cx, 0.8, cz);
    stadiumDome.scale.set(1.0, 0.6, 1.0);
    group.add(stadiumDome);

    // Glowing Stadium Arch Ribbon
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 32, Math.PI), matNeon);
    arch.position.set(cx, 1.6, cz);
    group.add(arch);

    // 4 Floodlight Towers
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([ox, oz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
      pole.position.set(cx + ox, 1.6, cz + oz);
      group.add(pole);

      const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      lightPanel.position.set(cx + ox, 3.2, cz + oz);
      group.add(lightPanel);
    });
  }

  scene.add(group);
}

// ── BUILD ALL 3D CITY MESHES ──
function init3DCity() {
  // Map landmark tile footprints (3x3 grid tiles per interactive building)
  const landmarkTileMap = {};
  BLDS.forEach(b => {
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        landmarkTileMap[`${b.tx + dx},${b.ty + dy}`] = b;
      }
    }
  });

  const createdLandmarks = new Set();

  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const t = MAP[y][x];
      if (t <= 0) continue;

      const bi = BINFO[t];
      if (!bi) continue;

      // Check if this tile is part of a 3x3 Landmark interactive building
      const landmark = landmarkTileMap[`${x},${y}`];
      if (landmark) {
        if (!createdLandmarks.has(landmark.name)) {
          createdLandmarks.add(landmark.name);
          createLandmarkBuilding(landmark);
        }
        continue; // Skip creating individual 1x1 buildings on landmark tiles
      }

      // Height calculation with organic pseudo-random variation
      const distFromCentre = Math.sqrt((x - MCX) ** 2 + (y - MCY) ** 2);
      const heightSeed = Math.abs(Math.sin(x * 17.1 + y * 43.3));
      const heightVar = (heightSeed - 0.5) * 2.2;
      const bh = Math.max(1.8, Math.min(8.5, bHeight(distFromCentre) + heightVar));

      // Generate varied 1x1 architectural building
      createStandardBuilding(x, y, t, bi, bh);
    }
  }
}

// ── 3D PLAYER MODEL SETUP ──
let playerGroup;
let leftLegGroup, rightLegGroup, leftArmGroup, rightArmGroup;
let torso, head, visorMat;

let citizenMeshes = [];
let tsGlobal = 0;
let mouseScreenX = 0;
let mouseScreenY = 0;
let walkTime = 0;

// ── 호버 차량 (공중 미래 이동 수단) ──
function initHoverVehicles() {
  const vehicleColors = [0x00e5ff, 0xa855f7, 0x00e676, 0xff4560, 0xffb030, 0xff00cc];
  const count = 18;
  for (let i = 0; i < count; i++) {
    const grp = new THREE.Group();

    // 차체
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0d1a2e, roughness: 0.15, metalness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.46), bodyMat);
    body.castShadow = true;
    grp.add(body);

    // 앞 유리 (파란 반투명)
    const windGeo = new THREE.BoxGeometry(0.32, 0.18, 0.44);
    const windMat = new THREE.MeshStandardMaterial({ color: 0x003366, transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.3 });
    const wind = new THREE.Mesh(windGeo, windMat);
    wind.position.set(0.3, 0.1, 0);
    grp.add(wind);

    // 엔진 글로우 하단
    const col = vehicleColors[i % vehicleColors.length];
    const glowMat = new THREE.MeshBasicMaterial({ color: col });
    const glL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), glowMat);
    glL.position.set(0, -0.17, 0.18);
    grp.add(glL);
    const glR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), glowMat);
    glR.position.set(0, -0.17, -0.18);
    grp.add(glR);

    // 테일 라이트
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.42), tailMat);
    tail.position.set(-0.56, 0, 0);
    grp.add(tail);

    // 헤드라이트
    const headMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), headMat);
    headL.position.set(0.56, 0, 0.14);
    grp.add(headL);
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), headMat);
    headR.position.set(0.56, 0, -0.14);
    grp.add(headR);

    // 궤도 설정
    const orbitR  = 6 + (i % 6) * 2.8 + Math.random() * 2;
    const height  = 5 + Math.floor(i / 6) * 4 + Math.random() * 3;
    const phase   = (i / count) * Math.PI * 2 + Math.random();
    const speed   = (0.18 + Math.random() * 0.22) * (Math.random() > 0.5 ? 1 : -1);
    const tilt    = (Math.random() - 0.5) * 0.12;

    grp.position.set(
      MCX + Math.cos(phase) * orbitR,
      height,
      MCY + Math.sin(phase) * orbitR
    );
    grp.userData = { orbitR, height, phase, speed, tilt, col };
    scene.add(grp);
    hoverVehicles.push(grp);
  }
}

// ── 빛기둥 이펙트 (고층 건물에서 하늘로 솟는 레이저) ──
function initLightBeams() {
  const beamData = [
    { x: 32, z: 32, col: 0x00e5ff }, { x: 33, z: 27, col: 0xa855f7 },
    { x: 28, z: 25, col: 0x00e676 }, { x: 37, z: 29, col: 0xffb030 },
    { x: 26, z: 33, col: 0xff4560 }, { x: 38, z: 22, col: 0xff00cc },
  ];
  beamData.forEach(({ x, z, col }) => {
    const bGeo = new THREE.CylinderGeometry(0.08, 0.22, 55, 8, 1, true);
    const bMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(bGeo, bMat);
    beam.position.set(x + 0.5, 28, z + 0.5);
    beam.userData.baseOpacity = 0.12;
    beam.userData.phase = Math.random() * Math.PI * 2;
    scene.add(beam);
    lightBeams.push(beam);
  });
}

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
  playerGroup.scale.set(0.18, 0.18, 0.18);
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
  if (!rainParticles || !rainParticles.visible) return;
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
  scene.fog = new THREE.FogExp2(0x020512, 0.025);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 800);

  renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.35;

  // ── 조명 ──
  ambientLight = new THREE.AmbientLight(0x0a0f1e, 0.3);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
  dirLight.position.set(20, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  dirLight.shadow.bias = -0.0003;
  scene.add(dirLight);

  hemiLight = new THREE.HemisphereLight(0x1a3a6e, 0x080418, 0.4);
  scene.add(hemiLight);

  // ── 태양 구체 ──
  sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfffaaa })
  );
  scene.add(sunSphere);

  // ── 달 구체 ──
  moonSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xd0deff })
  );
  scene.add(moonSphere);

  // ── 스카이돔 (대기 그라디언트) ──
  const skyGeo = new THREE.SphereGeometry(350, 32, 16);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x010208, side: THREE.BackSide });
  skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // ── 바닥 ──
  const floorGeo = new THREE.PlaneGeometry(128, 128, 1, 1);
  const floorTex = createFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.55,
    metalness: 0.45,
    envMapIntensity: 0.5
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(32, 0, 32);
  floor.receiveShadow = true;
  scene.add(floor);

  // ── 도로 반사 레이어 (젖은 도로 효과) ──
  const wetGeo = new THREE.PlaneGeometry(128, 128);
  const wetMat = new THREE.MeshStandardMaterial({
    color: 0x050a14,
    roughness: 0.08,
    metalness: 0.95,
    transparent: true,
    opacity: 0.35
  });
  const wetFloor = new THREE.Mesh(wetGeo, wetMat);
  wetFloor.rotation.x = -Math.PI / 2;
  wetFloor.position.set(32, 0.005, 32);
  scene.add(wetFloor);

  // ── 도시 네온 포인트 라이트 배치 ──
  const lightColors = [0x00e5ff, 0xa855f7, 0xff4560, 0x00e676, 0xffb030, 0xff00aa];
  const lightPositions = [
    [32,32],[26,26],[38,26],[26,38],[38,38],
    [22,32],[42,32],[32,22],[32,42],
    [28,28],[36,28],[28,36],[36,36]
  ];
  lightPositions.forEach(([lx, ly], i) => {
    const pl = new THREE.PointLight(lightColors[i % lightColors.length], 0, 14, 2);
    pl.position.set(lx, 0.5, ly);
    scene.add(pl);
    cityLights.push(pl);
  });

  // ── 도시 건물 ──
  init3DCity();

  // ── 호버 차량 ──
  initHoverVehicles();

  // ── 빛기둥 이펙트 ──
  initLightBeams();

  // ── 플레이어 ──
  initPlayer3D();

  // ── 별 ──
  createStars3D();

  // ── 비 ──
  createRain();

  // ── 시민 ──
  init3DCitizens();
  initInteriorEngine();
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
  try {
    const dt = Math.min((ts - prevT) / 1000, 0.1);
    prevT = ts;

    if (!scene) {
      // If scene is not initialized yet, set it up
      init3D();
    }

  // ─ Movement ─
  let isMoving = false;
  if (!dlgOpen) {
    const spd = (adminState.flyMode ? 8.0 : 4.2) * dt;
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

    // 자유 비행 수직 이동 (Q/E)
    if (adminState.flyMode) {
      if (K['q'] || K['Q']) { adminState.flyY = Math.max(0, adminState.flyY - 6 * dt); }
      if (K['e'] || K['E']) { adminState.flyY = Math.min(30, adminState.flyY + 6 * dt); }
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
      if (adminState.flyMode) {
        P.x = Math.max(0.5, Math.min(MW - 0.5, nx));
        P.y = Math.max(0.5, Math.min(MH - 0.5, nz));
      } else {
        if (canMove(nx, P.y)) P.x = nx;
        if (canMove(P.x, nz)) P.y = nz;
      }

      // 수감 중 — 철창 밖으로 못 나가게 (매 프레임 강제 클램프)
      if (typeof prisonState !== 'undefined' && prisonState.imprisoned) {
        var _pdx = P.x - PRISON_CX, _pdz = P.y - PRISON_CZ;
        var _pd = Math.sqrt(_pdx * _pdx + _pdz * _pdz);
        if (_pd > PRISON_RADIUS) {
          var _pr = PRISON_RADIUS / _pd;
          P.x = PRISON_CX + _pdx * _pr;
          P.y = PRISON_CZ + _pdz * _pr;
        }
      }

      // Rotate player group to face movement direction
      const targetRotationY = Math.atan2(moveX, moveZ);
      let diff = targetRotationY - playerGroup.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      playerGroup.rotation.y += diff * 0.15; // smooth rotation
    }
  }

  // Apply vertical jump physics
  if (P.vh !== 0 || P.h > 0) {
    P.vh -= 12.0 * dt; // gravity deceleration
    P.h += P.vh * dt;
    if (P.h <= 0) {
      P.h = 0;
      P.vh = 0;
    }
  }

  // Update 3D player position
  if (playerGroup) {
    const posY = adminState.flyMode ? adminState.flyY : (P.h || 0);
    playerGroup.position.set(P.x, posY, P.y);

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

  // ── 관전 모드 카메라 ──
  if (adminState.spectateTarget && camera) {
    const tgt = otherPlayers[adminState.spectateTarget];
    if (tgt) {
      camera.position.set(tgt.x - Math.sin(cameraYaw) * 5, 4, tgt.y - Math.cos(cameraYaw) * 5);
      camera.lookAt(new THREE.Vector3(tgt.x, 1, tgt.y));
    } else {
      adminState.spectateTarget = null;
      adminLog('관전 대상이 오프라인 상태가 되었습니다.', 'warn');
      const ss = document.getElementById('admin-spectate-status');
      if (ss) ss.textContent = '관전 중 아님 (대상 오프라인)';
    }
  }

  // ── hsy 관전 모드 카메라 ──
  if (hsySpectateTarget && camera && !adminState.spectateTarget) {
    const tgt = otherPlayers[hsySpectateTarget];
    if (tgt) {
      camera.position.set(tgt.x - Math.sin(cameraYaw) * 5, 4, tgt.y - Math.cos(cameraYaw) * 5);
      camera.lookAt(new THREE.Vector3(tgt.x, 1, tgt.y));
    } else {
      hsySpectateTarget = null;
      if (typeof hsyAddLog === 'function') hsyAddLog('관전 대상이 오프라인 상태가 되었습니다.', 'warn');
      const hsySs = document.getElementById('hsy-spectate-status');
      if (hsySs) hsySs.textContent = '관전 중 아님 (대상 오프라인)';
    }
  }

  // ── Camera position tracking (1st / 3rd Person / Bird View Toggle) ──
  if (camera && !adminState.spectateTarget && !hsySpectateTarget) {
    const curH = adminState.flyMode ? adminState.flyY : (P.h || 0);
    if (viewMode === 'third') {
      if (playerGroup) playerGroup.visible = true;
      const camDist = 4.2;
      const dirX = -Math.sin(cameraYaw) * Math.cos(cameraPitch);
      const dirZ = -Math.cos(cameraYaw) * Math.cos(cameraPitch);

      // 카메라 벽 충돌 — 플레이어→이상적 카메라 방향으로 스텝 이동, 벽 감지시 즉시 멈춤
      let safeDist = camDist;
      const steps = 20;
      for (let s = 1; s <= steps; s++) {
        const d = (s / steps) * camDist;
        const tx = Math.floor(P.x + dirX * d);
        const tz = Math.floor(P.y + dirZ * d);
        if (tx >= 0 && tx < MW && tz >= 0 && tz < MH && MAP[tz][tx] > 0) {
          safeDist = Math.max(0.3, (s - 1) / steps * camDist);
          break;
        }
      }

      let camX = P.x + dirX * safeDist;
      let camY = (adminState.flyMode ? 0.8 + adminState.flyY : 0.8) + Math.sin(cameraPitch) * safeDist;
      let camZ = P.y + dirZ * safeDist;

      camY = Math.max(0.18, camY);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(new THREE.Vector3(P.x, 0.75 + curH, P.y));
    } else if (viewMode === 'first') {
      if (playerGroup) playerGroup.visible = false;
      camera.position.set(P.x, 1.25 + (adminState.flyMode ? adminState.flyY : curH), P.y);
      const targetX = P.x + Math.sin(cameraYaw) * Math.cos(cameraPitch);
      const targetY = 1.25 + curH + Math.sin(cameraPitch);
      const targetZ = P.y + Math.cos(cameraYaw) * Math.cos(cameraPitch);
      camera.lookAt(new THREE.Vector3(targetX, targetY, targetZ));
    } else if (viewMode === 'bird') {
      if (playerGroup) playerGroup.visible = true;
      camera.position.set(P.x, 24 + curH, P.y + 12);
      camera.lookAt(new THREE.Vector3(P.x, curH, P.y));
    }
  }

  // ─ Stars & skydome follow player ─
  if (starGroup && playerGroup) {
    starGroup.position.copy(playerGroup.position);
  }
  if (skyDome) skyDome.position.set(P.x, 0, P.y);

  // ─ 호버 차량 애니메이션 ─
  hoverVehicles.forEach(v => {
    const d = v.userData;
    d.phase += d.speed * dt;
    v.position.set(
      MCX + Math.cos(d.phase) * d.orbitR,
      d.height + Math.sin(ts * 0.0008 + d.phase) * 0.4,
      MCY + Math.sin(d.phase) * d.orbitR
    );
    // 진행 방향으로 차 머리 회전
    v.rotation.y = -d.phase + (d.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
    v.rotation.z = d.tilt * Math.sin(ts * 0.001 + d.phase);
  });

  // ─ 홀로그램 링 애니메이션 ─
  holoSigns.forEach(ring => {
    const ph = ring.userData.phase;
    ring.position.y = ring.userData.baseY + Math.sin(ts * 0.0015 + ph) * 0.18;
    ring.rotation.z = ts * 0.0006 * (ph % 2 < 1 ? 1 : -1);
    ring.material.opacity = 0.45 + Math.sin(ts * 0.002 + ph) * 0.3;
  });

  // ─ 빛기둥 맥동 ─
  lightBeams.forEach(beam => {
    beam.material.opacity = beam.userData.baseOpacity * (0.6 + Math.sin(ts * 0.0018 + beam.userData.phase) * 0.4);
  });

  // ─ 안테나 점멸등 ─
  roofAntennaMeshes.forEach(m => {
    if (m.userData.blinkPhase !== undefined) {
      m.visible = Math.sin(ts * 0.003 + m.userData.blinkPhase) > 0.3;
    }
  });

  // ─ Game time progression ─
  gMin += dt * 6;
  if (gMin >= 1440) { gMin -= 1440; dayN++; if (!adminState.godMode) P.hunger = Math.max(0, P.hunger - 10); }

  // ─ Weather State Machine ─
  weatherDuration -= dt * 6;
  if (weatherDuration <= 0) {
    const month = (typeof Sim !== 'undefined') ? Sim.month : 1;
    const isSummer = month >= 6 && month <= 8;
    const isWinter = month === 12 || month <= 2;
    const r = Math.random();
    if (isSummer) {
      weatherState = r < 0.50 ? 'CLEAR' : r < 0.72 ? 'CLOUDY' : 'RAINY';
    } else if (isWinter) {
      weatherState = r < 0.28 ? 'CLEAR' : r < 0.58 ? 'CLOUDY' : r < 0.78 ? 'RAINY' : 'FOGGY';
    } else {
      weatherState = r < 0.38 ? 'CLEAR' : r < 0.62 ? 'CLOUDY' : r < 0.82 ? 'RAINY' : 'FOGGY';
    }
    weatherDuration = 120 + Math.random() * 360;
  }

  const targetRain  = weatherState === 'RAINY'  ? 1.0 : 0.0;
  const targetCloud = (weatherState === 'CLOUDY' || weatherState === 'RAINY') ? 1.0 : 0.0;
  const targetFog   = weatherState === 'FOGGY'  ? 1.0 : weatherState === 'CLOUDY' ? 0.15 : 0.0;

  rainIntensity += (targetRain  - rainIntensity)  * dt * 0.25;
  cloudiness    += (targetCloud - cloudiness)     * dt * 0.12;
  fogIntensity  += (targetFog   - fogIntensity)   * dt * 0.08;

  if (rainParticles) {
    rainParticles.visible = rainIntensity >= 0.01;
    if (rainParticles.visible) rainParticles.material.opacity = rainIntensity * 0.6;
  }
  updateRain(dt);
  if (typeof updateAdminEntities === 'function') updateAdminEntities(dt);

  // ─ Dynamic Day/Night Cycle ─
  // gMin: 0=midnight, 300=5am dawn start, 480=8am full day, 1080=6pm dusk, 1260=9pm full night
  let dayFac = 0;
  if      (gMin >= 300  && gMin < 480)  dayFac = (gMin - 300)  / 180;
  else if (gMin >= 480  && gMin < 1080) dayFac = 1.0;
  else if (gMin >= 1080 && gMin < 1260) dayFac = 1.0 - (gMin - 1080) / 180;
  dayFac = Math.max(0, Math.min(1, dayFac));
  const smoothDay = dayFac * dayFac * (3 - 2 * dayFac); // smoothstep
  const effectiveDayFac = smoothDay * (1 - cloudiness * 0.5) * (1 - rainIntensity * 0.4);

  // Sky color: night → dawn → day → dusk → night
  const nightSky = new THREE.Color(0x010208);
  const dawnSky  = new THREE.Color(0xb84e1a);
  const daySky   = new THREE.Color(0x1a5c9e);
  const duskSky  = new THREE.Color(0xb83818);
  const cloudSky = new THREE.Color(0x1e2530);

  let skyColor = nightSky.clone();
  if (gMin >= 300 && gMin < 600) {
    const t = (gMin - 300) / 300;
    skyColor = t < 0.5
      ? nightSky.clone().lerp(dawnSky, t * 2)
      : dawnSky.clone().lerp(daySky, (t - 0.5) * 2);
  } else if (gMin >= 600 && gMin < 1080) {
    skyColor = daySky.clone();
  } else if (gMin >= 1080 && gMin < 1380) {
    const t = (gMin - 1080) / 300;
    skyColor = t < 0.5
      ? daySky.clone().lerp(duskSky, t * 2)
      : duskSky.clone().lerp(nightSky, (t - 0.5) * 2);
  }
  skyColor.lerp(cloudSky, cloudiness * 0.55);
  skyColor.lerp(new THREE.Color(0x8aa0a8), fogIntensity * 0.55);

  renderer.setClearColor(skyColor);
  scene.fog.color.copy(skyColor);
  scene.fog.density = 0.022 + cloudiness * 0.025 + rainIntensity * 0.07 + fogIntensity * 0.11;

  // Lights: ambient grows with dayFac, directional is the "sun"
  ambientLight.intensity = 0.04 + effectiveDayFac * 0.46;
  dirLight.intensity     = effectiveDayFac * 0.88;

  // Sun color: warm orange at dawn/dusk, cool white at noon
  const noonPeak = Math.max(0, Math.sin(((gMin / 1440) - 0.5) * Math.PI));
  dirLight.color.setRGB(1.0, 0.82 + noonPeak * 0.18, 0.55 + noonPeak * 0.45);

  // Sun arc: rises in the east, sets in the west
  const norm    = gMin / 1440;
  const sunEl   = Math.max(0, Math.sin(norm * Math.PI * 2 - Math.PI / 2 + Math.PI * 0.25));
  const sunAzX  = Math.cos(norm * Math.PI * 2);
  dirLight.position.set(P.x + sunAzX * 42, 1 + sunEl * 40, P.y + Math.sin(norm * Math.PI * 2) * 18);

  // ── 태양 구체 위치 ──
  if (sunSphere) {
    sunSphere.position.copy(dirLight.position);
    sunSphere.visible = sunEl > 0.05;
    // 일출/일몰 색 (주황→노랑→흰)
    const sunCol = new THREE.Color();
    sunCol.setRGB(1.0, 0.65 + sunEl * 0.35, 0.2 + sunEl * 0.8);
    sunSphere.material.color.copy(sunCol);
    const sunScale = 1.0 + (1 - sunEl) * 0.8; // 지평선 근처에서 더 크게
    sunSphere.scale.setScalar(sunScale);
  }

  // ── 달 구체 위치 ──
  if (moonSphere) {
    const moonNorm = (norm + 0.5) % 1;
    const moonEl = Math.max(0, Math.sin(moonNorm * Math.PI * 2 - Math.PI / 2 + Math.PI * 0.25));
    const moonAzX = Math.cos(moonNorm * Math.PI * 2);
    moonSphere.position.set(
      P.x + moonAzX * 38,
      1 + moonEl * 36,
      P.y + Math.sin(moonNorm * Math.PI * 2) * 16
    );
    moonSphere.visible = moonEl > 0.05 && smoothDay < 0.7;
  }

  // ── 스카이돔 색 업데이트 ──
  if (skyDome) skyDome.material.color.copy(skyColor);

  // Stars & moon appear at night
  if (starGroup) {
    const starOpacity = Math.max(0, (1 - smoothDay * 3) * (1 - fogIntensity * 0.7));
    starGroup.material.opacity = Math.min(0.92, starOpacity);
  }

  // ── 야간 도시 포인트 라이트 ──
  const nightGlow = 1 - smoothDay;
  cityLights.forEach((pl, i) => {
    pl.intensity = nightGlow * (1.8 + Math.sin(ts * 0.0012 + i) * 0.3);
    pl.distance = 10 + Math.sin(ts * 0.0008 + i * 0.7) * 2;
  });

  // ── 3D 가로등 야간 불빛 및 전구 토글 ──
  streetlights.forEach((sl, i) => {
    sl.pl.intensity = nightGlow * 1.6;
    if (nightGlow > 0.15) {
      sl.bulb.material.color.setHex(0xffea00); // 켜졌을 때 노란색
    } else {
      sl.bulb.material.color.setHex(0x444444); // 낮에는 꺼진 어두운 색
    }
  });

  // Building neon glow: much brighter at night, dimmer in daylight
  for (let key in bldMaterials) {
    bldMaterials[key].emissiveIntensity = 0.08 + nightGlow * 2.2;
  }

  // ── 빛기둥: 야간에만 ──
  lightBeams.forEach(beam => {
    beam.visible = nightGlow > 0.15;
  });

  // ─ HUD hints for nearest building in screen path ─
  const dn = document.getElementById('dist-name');
  const ip = document.getElementById('interact-prompt');

  if (P.isInterior) {
    let closest = null;
    let minDist = 999;
    interiorProps.forEach(prop => {
      const dx = P.x - prop.x;
      const dz = P.y - prop.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < prop.dist && d < minDist) {
        minDist = d;
        closest = prop;
      }
    });
    
    if (closest) {
      dn.innerHTML = closest.name;
      dn.style.opacity = '1';
      ip.style.display = 'block';
    } else {
      dn.style.opacity = '0';
      ip.style.display = 'none';
    }
  } else {
    const lookRay = castRay(P.x, P.y, cameraYaw);
    const nearDist = lookRay.dist;
    const nearHit = lookRay.hit;

    if (nearDist < 2.2 && nearHit > 0) {
      const bi = BINFO[nearHit];
      if (bi) { dn.textContent = bi.name; dn.style.opacity = '1'; }
      ip.style.display = nearDist < 1.9 ? 'block' : 'none';
    } else {
      dn.style.opacity = '0';
      ip.style.display = 'none';
    }
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

  // 지하철역 마커 (미니맵)
  SUBWAY_STATIONS.forEach(st => {
    const sx = (st.x - offX) * sc;
    const sy = (st.y - offY) * sc;
    if (sx >= 0 && sx <= MS && sy >= 0 && sy <= MS) {
      mctx.fillStyle = '#ffcc00';
      mctx.shadowColor = '#ffcc00';
      mctx.shadowBlur = 5;
      mctx.beginPath();
      mctx.arc(sx, sy, 3, 0, Math.PI * 2);
      mctx.fill();
      mctx.shadowBlur = 0;
    }
  });

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
  if (!adminState.godMode) {
    P.hunger = Math.max(0, P.hunger - dt * 0.22);
    P.energy = Math.max(0, P.energy - dt * 0.12);
    if (P.hunger < 15) P.health = Math.max(0, P.health - dt * 0.35);
    if (P.energy < 10) P.happy  = Math.max(0, P.happy  - dt * 0.22);
  }

  updateHUD();

  // Update wandering citizens in 3D
  update3DCitizens(dt);

  // Raycast for Citizen Hover Tooltip
  updateCitizenTooltip();

  // Update other players' 3D positions
  for (const [, op] of Object.entries(otherPlayers)) {
    op.group.position.set(op.x, 0, op.y);
    op.group.rotation.y = -op.angle + Math.PI;
  }

  // 말풍선 위치 업데이트
  if (typeof updateSpeechBubbles === 'function') updateSpeechBubbles();

  // 임대 수입 체크 (하루 1회)
  if (typeof collectRent === 'function') collectRent();

  // Draw other players on minimap
  for (const [uname, op] of Object.entries(otherPlayers)) {
    const px = (op.x - offX) * sc;
    const py = (op.y - offY) * sc;
    if (px >= 0 && px <= MS && py >= 0 && py <= MS) {
      const col = getPlayerColor(uname);
      const r = (col >> 16) & 0xff, g = (col >> 8) & 0xff, b = col & 0xff;
      mctx.fillStyle = `rgb(${r},${g},${b})`;
      mctx.shadowColor = `rgb(${r},${g},${b})`;
      mctx.shadowBlur = 5;
      mctx.beginPath();
      mctx.arc(px, py, 2.5, 0, Math.PI * 2);
      mctx.fill();
      mctx.shadowBlur = 0;
    }
  }

  // WebGL Render pass
  renderer.render(scene, camera);
  requestAnimationFrame(render);
  } catch (err) {
    console.error("Render Loop Error:", err);
    alert("Render Error: " + err.message + "\nStack: " + err.stack);
  }
}

// ── START ──
requestAnimationFrame(render);
showNotice('🏙️ 네오이현 수도에 오신 것을 환영합니다! (Tab 키를 누르면 집무실이 열립니다)');

// ── 🏛️ DASHBOARD CONTROLLERS ──
let isDashboardOpen = false;
let currentTab = 'overview';
let activePolicies = { basic: false, hours: false, immig: false };
let courtCitizenId = null;

// ── ⚖️ 종합 법률 시스템 데이터베이스 ──
const LAW_DB = [
  // ── 경제 (economy) ──
  { id:'eco01', cat:'economy', icon:'💰', name:'기본소득제 시행령',
    desc:'만 18세 이상 모든 국민에게 월 ₦50,000 보조금을 지급합니다.',
    cost:200000000,
    effects:[
      {type:'positive', label:'행복도 +8%'},
      {type:'negative', label:'재정 -₦2억/월'},
    ],
    apply(){ Sim.popHappiness = Math.min(100, Sim.popHappiness+8); Sim.treasury -= 200000000; },
    revert(){ Sim.popHappiness = Math.max(0, Sim.popHappiness-8); }
  },
  { id:'eco02', cat:'economy', icon:'🏦', name:'법인세 감면 특별법',
    desc:'법인세를 5%p 인하하여 기업 투자를 촉진합니다.',
    cost:0,
    effects:[
      {type:'positive', label:'기업성장 +12%'},
      {type:'negative', label:'세수 감소'},
      {type:'neutral', label:'실업률 -1%'},
    ],
    apply(){ Sim.taxRateCorporate = Math.max(5, Sim.taxRateCorporate-5); Sim.techLevel += 12; },
    revert(){ Sim.taxRateCorporate += 5; Sim.techLevel -= 12; }
  },
  { id:'eco03', cat:'economy', icon:'📊', name:'암호화폐 합법화법',
    desc:'디지털 자산을 법적 화폐로 인정하고 거래소 면허 제도를 도입합니다.',
    cost:50000000,
    effects:[
      {type:'positive', label:'기술수준 +10'},
      {type:'neutral', label:'변동성 리스크'},
      {type:'positive', label:'GDP +1.5%'},
    ],
    apply(){ Sim.techLevel += 10; Sim.gdp *= 1.015; },
    revert(){ Sim.techLevel -= 10; Sim.gdp /= 1.015; }
  },
  { id:'eco04', cat:'economy', icon:'🏗️', name:'부동산 투기 억제법',
    desc:'다주택자 취득세를 3배 인상하고 전매 제한을 강화합니다.',
    cost:0,
    effects:[
      {type:'positive', label:'집값 안정'},
      {type:'negative', label:'건설업 침체'},
      {type:'positive', label:'행복도 +3'},
    ],
    apply(){ Sim.popHappiness += 3; Sim.pollution = Math.max(0, Sim.pollution-2); },
    revert(){ Sim.popHappiness -= 3; Sim.pollution += 2; }
  },

  // ── 노동 (labor) ──
  { id:'lab01', cat:'labor', icon:'⏰', name:'주 52시간 근로 상한제',
    desc:'주간 근로시간을 52시간으로 제한하여 워라밸을 보장합니다.',
    cost:0,
    effects:[
      {type:'positive', label:'스트레스 감소'},
      {type:'positive', label:'행복도 +5'},
      {type:'negative', label:'기업성장 -5'},
    ],
    apply(){ Sim.popHappiness += 5; Sim.techLevel -= 5; },
    revert(){ Sim.popHappiness -= 5; Sim.techLevel += 5; }
  },
  { id:'lab02', cat:'labor', icon:'💵', name:'최저임금 인상법',
    desc:'최저임금을 20% 인상합니다. 저소득층 소비력이 향상되나 중소기업 부담 증가.',
    cost:0,
    effects:[
      {type:'positive', label:'행복도 +4'},
      {type:'negative', label:'실업률 +0.5%'},
      {type:'positive', label:'소비 증가'},
    ],
    apply(){ Sim.popHappiness += 4; Sim.unemploymentRate += 0.5; },
    revert(){ Sim.popHappiness -= 4; Sim.unemploymentRate -= 0.5; }
  },
  { id:'lab03', cat:'labor', icon:'🤝', name:'비정규직 보호법',
    desc:'비정규직 근로자의 정규직 전환을 의무화하고 동일노동 동일임금을 보장합니다.',
    cost:80000000,
    effects:[
      {type:'positive', label:'행복도 +6'},
      {type:'negative', label:'기업비용 증가'},
    ],
    apply(){ Sim.popHappiness += 6; },
    revert(){ Sim.popHappiness -= 6; }
  },
  { id:'lab04', cat:'labor', icon:'👶', name:'육아휴직 의무화법',
    desc:'남녀 모두 1년 유급 육아휴직을 보장합니다. 출산율 증가 기대.',
    cost:120000000,
    effects:[
      {type:'positive', label:'출산율 +15%'},
      {type:'positive', label:'행복도 +4'},
      {type:'negative', label:'재정 -₦1.2억/월'},
    ],
    apply(){ Sim.popHappiness += 4; },
    revert(){ Sim.popHappiness -= 4; }
  },

  // ── 복지 (welfare) ──
  { id:'wel01', cat:'welfare', icon:'🏥', name:'전 국민 무상 의료법',
    desc:'모든 의료비를 국가가 부담합니다. 건강도 대폭 상승, 재정 큰 부담.',
    cost:500000000,
    effects:[
      {type:'positive', label:'건강도 +15'},
      {type:'positive', label:'행복도 +10'},
      {type:'negative', label:'재정 -₦5억/월'},
    ],
    apply(){ Sim.popHealth = Math.min(100, Sim.popHealth+15); Sim.popHappiness += 10; },
    revert(){ Sim.popHealth = Math.max(0, Sim.popHealth-15); Sim.popHappiness -= 10; }
  },
  { id:'wel02', cat:'welfare', icon:'🎓', name:'무상 교육 확대법',
    desc:'유치원부터 대학원까지 전 과정 무상교육을 시행합니다.',
    cost:350000000,
    effects:[
      {type:'positive', label:'교육수준 +20'},
      {type:'positive', label:'기술혁신 가속'},
      {type:'negative', label:'재정 -₦3.5억/월'},
    ],
    apply(){ Sim.techLevel += 20; Sim.popHappiness += 6; },
    revert(){ Sim.techLevel -= 20; Sim.popHappiness -= 6; }
  },
  { id:'wel03', cat:'welfare', icon:'🏠', name:'공공임대주택 확충법',
    desc:'도시 인구의 30%를 수용하는 공공임대주택 단지를 건설합니다.',
    cost:250000000,
    effects:[
      {type:'positive', label:'행복도 +5'},
      {type:'positive', label:'범죄율 -0.3%'},
      {type:'negative', label:'재정 -₦2.5억/월'},
    ],
    apply(){ Sim.popHappiness += 5; Sim.popCrimeRate = Math.max(0, Sim.popCrimeRate-0.3); },
    revert(){ Sim.popHappiness -= 5; Sim.popCrimeRate += 0.3; }
  },
  { id:'wel04', cat:'welfare', icon:'👴', name:'국민연금 보장법',
    desc:'65세 이상 국민에게 월 ₦80,000 연금을 보장합니다.',
    cost:180000000,
    effects:[
      {type:'positive', label:'행복도 +4'},
      {type:'negative', label:'재정 -₦1.8억/월'},
    ],
    apply(){ Sim.popHappiness += 4; },
    revert(){ Sim.popHappiness -= 4; }
  },

  // ── 치안 (security) ──
  { id:'sec01', cat:'security', icon:'🚔', name:'강력범죄 가중처벌법',
    desc:'살인, 강도 등 강력범죄에 대한 형량을 2배 강화합니다.',
    cost:30000000,
    effects:[
      {type:'positive', label:'범죄율 -1.2%'},
      {type:'neutral', label:'인권단체 반발'},
    ],
    apply(){ Sim.popCrimeRate = Math.max(0, Sim.popCrimeRate-1.2); },
    revert(){ Sim.popCrimeRate += 1.2; }
  },
  { id:'sec02', cat:'security', icon:'📹', name:'AI 감시 시스템 도입법',
    desc:'전국 CCTV에 AI 범죄 예측 시스템을 연동합니다.',
    cost:150000000,
    effects:[
      {type:'positive', label:'범죄율 -2%'},
      {type:'negative', label:'행복도 -3 (프라이버시)'},
      {type:'positive', label:'기술수준 +5'},
    ],
    apply(){ Sim.popCrimeRate = Math.max(0, Sim.popCrimeRate-2); Sim.popHappiness -= 3; Sim.techLevel += 5; },
    revert(){ Sim.popCrimeRate += 2; Sim.popHappiness += 3; Sim.techLevel -= 5; }
  },
  { id:'sec03', cat:'security', icon:'🔫', name:'총기 소지 금지법',
    desc:'민간인의 총기 소지를 전면 금지합니다.',
    cost:20000000,
    effects:[
      {type:'positive', label:'범죄율 -0.8%'},
      {type:'positive', label:'안전도 향상'},
    ],
    apply(){ Sim.popCrimeRate = Math.max(0, Sim.popCrimeRate-0.8); Sim.popHappiness += 2; },
    revert(){ Sim.popCrimeRate += 0.8; Sim.popHappiness -= 2; }
  },
  { id:'sec04', cat:'security', icon:'🚒', name:'소방 인력 확충법',
    desc:'소방관 인력을 50% 확충하고 장비를 현대화합니다.',
    cost:100000000,
    effects:[
      {type:'positive', label:'안전도 +10'},
      {type:'positive', label:'건강도 +3'},
      {type:'negative', label:'재정 -₦1억/월'},
    ],
    apply(){ Sim.popHealth += 3; Sim.popHappiness += 2; },
    revert(){ Sim.popHealth -= 3; Sim.popHappiness -= 2; }
  },

  // ── 환경 (environment) ──
  { id:'env01', cat:'environment', icon:'🌱', name:'탄소 배출 제로 목표법',
    desc:'2035년까지 탄소중립을 달성하기 위한 로드맵을 법제화합니다.',
    cost:200000000,
    effects:[
      {type:'positive', label:'오염도 -8%'},
      {type:'negative', label:'산업비용 증가'},
      {type:'positive', label:'기술혁신 촉진'},
    ],
    apply(){ Sim.pollution = Math.max(0, Sim.pollution-8); Sim.techLevel += 8; },
    revert(){ Sim.pollution += 8; Sim.techLevel -= 8; }
  },
  { id:'env02', cat:'environment', icon:'♻️', name:'순환 경제 촉진법',
    desc:'일회용 플라스틱을 금지하고 재활용 의무비율을 80%로 상향합니다.',
    cost:60000000,
    effects:[
      {type:'positive', label:'오염도 -5%'},
      {type:'positive', label:'행복도 +2'},
    ],
    apply(){ Sim.pollution = Math.max(0, Sim.pollution-5); Sim.popHappiness += 2; },
    revert(){ Sim.pollution += 5; Sim.popHappiness -= 2; }
  },
  { id:'env03', cat:'environment', icon:'🌊', name:'해양 생태계 보호법',
    desc:'연안 5km 내 산업시설을 금지하고 해양보호구역을 3배 확대합니다.',
    cost:80000000,
    effects:[
      {type:'positive', label:'오염도 -3%'},
      {type:'positive', label:'식량자급률 +5%'},
      {type:'negative', label:'어업 제한'},
    ],
    apply(){ Sim.pollution = Math.max(0, Sim.pollution-3); Sim.foodSelfRatio = Math.min(100, Sim.foodSelfRatio+5); },
    revert(){ Sim.pollution += 3; Sim.foodSelfRatio -= 5; }
  },
  { id:'env04', cat:'environment', icon:'⚡', name:'신재생에너지 전환법',
    desc:'2030년까지 전력의 60%를 태양광/풍력으로 전환합니다.',
    cost:300000000,
    effects:[
      {type:'positive', label:'오염도 -10%'},
      {type:'positive', label:'에너지충족 +8%'},
      {type:'negative', label:'재정 -₦3억/월'},
    ],
    apply(){ Sim.pollution = Math.max(0, Sim.pollution-10); Sim.energyGridRatio = Math.min(100, Sim.energyGridRatio+8); },
    revert(){ Sim.pollution += 10; Sim.energyGridRatio -= 8; }
  },

  // ── 교육 (education) ──
  { id:'edu01', cat:'education', icon:'💻', name:'AI 코딩 필수교육법',
    desc:'초등 3학년부터 AI 및 코딩 교육을 필수과목으로 지정합니다.',
    cost:90000000,
    effects:[
      {type:'positive', label:'기술수준 +15'},
      {type:'positive', label:'미래경쟁력 강화'},
    ],
    apply(){ Sim.techLevel += 15; },
    revert(){ Sim.techLevel -= 15; }
  },
  { id:'edu02', cat:'education', icon:'🔬', name:'기초과학 연구 진흥법',
    desc:'GDP의 3%를 기초과학 R&D에 의무 투자합니다.',
    cost:160000000,
    effects:[
      {type:'positive', label:'기술수준 +18'},
      {type:'positive', label:'우주진척 +5%'},
      {type:'negative', label:'재정 -₦1.6억/월'},
    ],
    apply(){ Sim.techLevel += 18; Sim.spaceProgress = Math.min(100, Sim.spaceProgress+5); },
    revert(){ Sim.techLevel -= 18; Sim.spaceProgress -= 5; }
  },
  { id:'edu03', cat:'education', icon:'📖', name:'평생교육 보장법',
    desc:'모든 시민에게 연간 ₦200,000 교육 바우처를 지급합니다.',
    cost:140000000,
    effects:[
      {type:'positive', label:'행복도 +3'},
      {type:'positive', label:'실업률 -0.8%'},
    ],
    apply(){ Sim.popHappiness += 3; Sim.unemploymentRate = Math.max(0, Sim.unemploymentRate-0.8); },
    revert(){ Sim.popHappiness -= 3; Sim.unemploymentRate += 0.8; }
  },
  { id:'edu04', cat:'education', icon:'🏫', name:'학교 급식 무상화법',
    desc:'전국 모든 초·중·고교의 급식을 무상으로 제공합니다.',
    cost:70000000,
    effects:[
      {type:'positive', label:'건강도 +4'},
      {type:'positive', label:'행복도 +3'},
      {type:'negative', label:'재정 -₦7천만/월'},
    ],
    apply(){ Sim.popHealth += 4; Sim.popHappiness += 3; },
    revert(){ Sim.popHealth -= 4; Sim.popHappiness -= 3; }
  },

  // ── 외교 (diplomacy) ──
  { id:'dip01', cat:'diplomacy', icon:'🌐', name:'글로벌 우수인재 이민법',
    desc:'해외 고급 인재의 이민 절차를 간소화하고 초기 정착금을 지원합니다.',
    cost:60000000,
    effects:[
      {type:'positive', label:'기술수준 +15'},
      {type:'neutral', label:'범죄율 +0.2%'},
      {type:'positive', label:'GDP +1%'},
    ],
    apply(){ Sim.techLevel += 15; Sim.popCrimeRate += 0.2; Sim.gdp *= 1.01; },
    revert(){ Sim.techLevel -= 15; Sim.popCrimeRate -= 0.2; Sim.gdp /= 1.01; }
  },
  { id:'dip02', cat:'diplomacy', icon:'🕊️', name:'평화 외교 기본법',
    desc:'군사비를 축소하고 외교 예산을 2배로 확대합니다.',
    cost:0,
    effects:[
      {type:'positive', label:'행복도 +4'},
      {type:'negative', label:'군사력 -10%'},
      {type:'positive', label:'외교력 강화'},
    ],
    apply(){ Sim.popHappiness += 4; },
    revert(){ Sim.popHappiness -= 4; }
  },
  { id:'dip03', cat:'diplomacy', icon:'🤝', name:'다자간 자유무역협정법',
    desc:'5개국과 자유무역협정을 체결하여 관세를 철폐합니다.',
    cost:40000000,
    effects:[
      {type:'positive', label:'GDP +2.5%'},
      {type:'positive', label:'물가 -1%'},
      {type:'negative', label:'국내 중소기업 타격'},
    ],
    apply(){ Sim.gdp *= 1.025; Sim.inflation = Math.max(0, Sim.inflation-1); },
    revert(){ Sim.gdp /= 1.025; Sim.inflation += 1; }
  },
  { id:'dip04', cat:'diplomacy', icon:'🚀', name:'국제 우주 협력법',
    desc:'국제 우주 프로젝트에 공동 참여하여 우주개발을 가속화합니다.',
    cost:200000000,
    effects:[
      {type:'positive', label:'우주진척 +10%'},
      {type:'positive', label:'기술수준 +10'},
      {type:'negative', label:'재정 -₦2억/월'},
    ],
    apply(){ Sim.spaceProgress = Math.min(100, Sim.spaceProgress+10); Sim.techLevel += 10; },
    revert(){ Sim.spaceProgress = Math.max(0, Sim.spaceProgress-10); Sim.techLevel -= 10; }
  },
];

// 법률 시행 상태 맵
const lawState = {};
LAW_DB.forEach(l => { lawState[l.id] = false; });
let currentLawFilter = 'all';

function toggleDashboard(show) {
  if (show && currentUsername !== 'ree1203') {
    showNotice('🔒 대통령 집무실은 ree1203만 입장할 수 있습니다.');
    return;
  }
  isDashboardOpen = show;
  const db = document.getElementById('dashboard');
  if (!db) return;
  db.style.display = show ? 'flex' : 'none';

  if (show) {
    document.exitPointerLock();
    updateDashboardData();
  } else {
    c.requestPointerLock();
  }
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.db-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.db-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const buttons = document.querySelectorAll('.db-tab-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });
  
  const targetContent = document.getElementById(`tab-${tabId}`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
  
  updateDashboardData();
}

function updateTaxRates() {
  const inc = parseFloat(document.getElementById('sld-tax-income').value);
  const corp = parseFloat(document.getElementById('sld-tax-corporate').value);
  const prop = parseFloat(document.getElementById('sld-tax-property').value);
  
  Sim.taxRateIncome = inc;
  Sim.taxRateCorporate = corp;
  Sim.taxRateProperty = prop;
  
  document.getElementById('lbl-tax-income').textContent = `${inc}%`;
  document.getElementById('lbl-tax-corporate').textContent = `${corp}%`;
  document.getElementById('lbl-tax-property').textContent = `${prop}%`;
}

function renderBudgetSliders() {
  const container = document.getElementById('budget-sliders-container');
  if (!container) return;
  container.innerHTML = '';
  
  const translations = {
    welfare: '사회 복지',
    education: '공공 교육',
    health: '국민 의료',
    military: '방위/군사',
    police: '치안/경찰',
    fire: '재난/소방',
    environment: '환경 보호',
    energy: '에너지/발전',
    agriculture: '수직 농업',
    space: '우주 개발',
    research: 'R&D 연구',
    transport: '대중 교통',
    urbanDev: '도시 개발',
    diplomacy: '대외 외교',
    industry: '산업 지원'
  };
  
  let totalAlloc = 0;
  Object.keys(Sim.budgetAllocation).forEach(key => {
    totalAlloc += Sim.budgetAllocation[key];
    const row = document.createElement('div');
    row.className = 'slider-group';
    row.innerHTML = `
      <div class="slider-header">
        <label>${translations[key] || key}</label>
        <span id="lbl-budget-${key}">${Sim.budgetAllocation[key]}%</span>
      </div>
      <input type="range" id="sld-budget-${key}" min="0" max="40" value="${Sim.budgetAllocation[key]}" oninput="onBudgetChange('${key}')">
    `;
    container.appendChild(row);
  });
  
  document.getElementById('budget-allocation-sum').textContent = `${totalAlloc}%`;
  if (totalAlloc !== 100) {
    document.getElementById('budget-allocation-sum').className = 'text-red';
  } else {
    document.getElementById('budget-allocation-sum').className = 'text-green';
  }
}

function onBudgetChange(changedKey) {
  const slider = document.getElementById(`sld-budget-${changedKey}`);
  const newVal = parseInt(slider.value);
  
  let otherSum = 0;
  Object.keys(Sim.budgetAllocation).forEach(k => {
    if (k !== changedKey) otherSum += Sim.budgetAllocation[k];
  });
  
  if (newVal + otherSum > 100) {
    const clampedVal = 100 - otherSum;
    slider.value = clampedVal;
    Sim.budgetAllocation[changedKey] = clampedVal;
  } else {
    Sim.budgetAllocation[changedKey] = newVal;
  }
  
  document.getElementById(`lbl-budget-${changedKey}`).textContent = `${Sim.budgetAllocation[changedKey]}%`;
  
  let sum = 0;
  Object.keys(Sim.budgetAllocation).forEach(k => {
    sum += Sim.budgetAllocation[k];
  });
  
  document.getElementById('budget-allocation-sum').textContent = `${sum}%`;
  if (sum !== 100) {
    document.getElementById('budget-allocation-sum').className = 'text-red';
  } else {
    document.getElementById('budget-allocation-sum').className = 'text-green';
  }
}

function renderCitizenList() {
  const tbody = document.getElementById('citizen-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('citizen-search').value.toLowerCase();
  
  let matches = Sim.citizens.filter(c => c.name.toLowerCase().includes(searchVal));
  const limit = 100;
  const slice = matches.slice(0, limit);
  
  slice.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.age}세</td>
      <td>${c.gender}</td>
      <td>${c.education}</td>
      <td>${c.job || '<span class="text-orange">실업자</span>'}</td>
      <td>₦${(c.salary || 0).toLocaleString()}</td>
      <td>₦${c.bankBalance.toLocaleString()}</td>
      <td>${c.happiness}%</td>
      <td>${c.health}%</td>
      <td><button class="trade-btn buy" onclick="openCourt(${c.id})">개명</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function openCourt(id) {
  courtCitizenId = id;
  const c = Sim.citizens.find(x => x.id === id);
  if (!c) return;
  document.getElementById('court-old-name').value = c.name;
  document.getElementById('court-new-name').value = '';
  document.getElementById('court-dialog').style.display = 'block';
}

function closeCourt() {
  document.getElementById('court-dialog').style.display = 'none';
}

function submitNameChange() {
  const newName = document.getElementById('court-new-name').value.trim();
  if (!newName) {
    showNotice('새로운 성명을 입력해 주세요.');
    return;
  }
  
  if (P.money < 50000) {
    showNotice('개명 심리 수수료(₦50,000)가 부족합니다.');
    return;
  }
  
  const target = Sim.citizens.find(x => x.id === courtCitizenId);
  if (target) {
    const oldName = target.name;
    target.name = newName;
    P.money -= 50000;
    
    addEventLog('⚖️ 법원 개명 허가 판결', `국민 '${oldName}'이(가) 법원 판결을 통해 '${newName}'(으)로 개명하였습니다.`);
    
    showNotice(`개명 신청이 승인되었습니다! (${oldName} ➔ ${newName})`);
    closeCourt();
    renderCitizenList();
    updateDashboardData();
  }
}

function renderStockMarket() {
  const tbody = document.getElementById('stock-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  Sim.stocks.forEach(s => {
    const diff = s.price - s.prevPrice;
    const diffPct = ((diff / s.prevPrice) * 100).toFixed(1);
    const sign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'text-green' : 'text-red';
    
    const owned = P.portfolio[s.code] || 0;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.code}</strong></td>
      <td>${s.name}</td>
      <td>${s.type}</td>
      <td>₦${s.price.toLocaleString()}</td>
      <td class="${diffClass} sparkline">${sign}${diffPct}%</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="trade-btn buy" onclick="tradeStock('${s.code}', 'buy')">매수 (10)</button>
          <button class="trade-btn sell" onclick="tradeStock('${s.code}', 'sell')">매도 (10)</button>
          <span style="font-size:10px;margin-left:6px;align-self:center">보유: ${owned}주</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function tradeStock(code, action) {
  const s = Sim.stocks.find(x => x.code === code);
  if (!s) return;
  
  const lot = 10;
  const cost = s.price * lot;
  
  if (action === 'buy') {
    if (P.money < cost) {
      showNotice('개인 잔고가 부족합니다!');
      return;
    }
    P.money -= cost;
    P.portfolio[code] = (P.portfolio[code] || 0) + lot;
    showNotice(`${s.name} ${lot}주를 ₦${cost.toLocaleString()}에 매수하였습니다.`);
  } else {
    const owned = P.portfolio[code] || 0;
    if (owned < lot) {
      showNotice('매도할 주식이 부족합니다!');
      return;
    }
    P.money += cost;
    P.portfolio[code] = owned - lot;
    showNotice(`${s.name} ${lot}주를 ₦${cost.toLocaleString()}에 매도하였습니다.`);
  }
  
  renderStockMarket();
  updateDashboardData();
}

function renderRealEstate() {
  const container = document.getElementById('realestate-container');
  if (!container) return;
  container.innerHTML = '';
  if (!P.ownedProperties) P.ownedProperties = [];

  // 보유 자산 요약
  const totalRent = P.ownedProperties.reduce((sum, id) => {
    const h = Sim.houses.find(x => x.id === id);
    return sum + (h ? h.rent : 0);
  }, 0);
  const summary = document.createElement('div');
  summary.className = 'db-card mini-card';
  summary.style = 'grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;';
  summary.innerHTML = `<span>🏠 보유 ${P.ownedProperties.length}채</span><strong>일일 임대 수입: ₦${totalRent.toLocaleString()}</strong>`;
  container.appendChild(summary);

  Sim.houses.forEach(h => {
    const owned = P.ownedProperties.includes(h.id);
    const canAfford = P.money >= h.price;
    const card = document.createElement('div');
    card.className = 'db-card re-card' + (owned ? ' re-owned' : '');
    card.innerHTML = `
      <div class="re-title">${owned ? '✅' : '🏠'} ${h.name}</div>
      <div class="re-specs">
        면적: ${h.size}㎡ · 방 ${h.rooms}개 / 욕실 ${h.baths}개<br>
        관리비: ₦${h.maintenanceFee.toLocaleString()}/월
      </div>
      <div class="re-price">
        매매가: ₦${h.price.toLocaleString()}<br>
        임대 수입: <strong>₦${h.rent.toLocaleString()}/일</strong>
      </div>
      <div class="re-actions">
        ${owned
          ? `<button class="trade-btn sell" onclick="sellProperty(${h.id})">매도 (75%)</button>`
          : `<button class="trade-btn buy" onclick="buyProperty(${h.id})" ${canAfford ? '' : 'disabled'}>매수</button>`
        }
      </div>
    `;
    container.appendChild(card);
  });
}

// ── ⚖️ 법률 시스템 컨트롤러 ──

const CAT_NAMES = {
  economy:'경제', labor:'노동', welfare:'복지',
  security:'치안', environment:'환경', education:'교육', diplomacy:'외교'
};

function renderLawList() {
  const container = document.getElementById('law-list-container');
  if (!container) return;

  const filteredLaws = currentLawFilter === 'all'
    ? LAW_DB
    : LAW_DB.filter(l => l.cat === currentLawFilter);

  container.innerHTML = '';
  filteredLaws.forEach(law => {
    const enacted = lawState[law.id];
    const card = document.createElement('div');
    card.className = `law-card${enacted ? ' enacted' : ''}`;
    card.id = `law-card-${law.id}`;

    const effectsHTML = law.effects.map(e =>
      `<span class="law-effect-tag ${e.type}">${e.label}</span>`
    ).join('');

    card.innerHTML = `
      <div class="law-icon">${law.icon}</div>
      <div class="law-info">
        <div class="law-name">
          ${law.name}
          <span class="law-category-badge">${CAT_NAMES[law.cat] || law.cat}</span>
        </div>
        <div class="law-desc">${law.desc}</div>
        <div class="law-effects">
          ${law.cost > 0 ? `<span class="law-effect-tag cost">₦${(law.cost/100000000).toFixed(1)}억/월</span>` : ''}
          ${effectsHTML}
        </div>
      </div>
      <div class="law-toggle-area">
        <button class="law-toggle-btn${enacted ? ' enacted' : ''}" onclick="toggleLaw('${law.id}')">
          ${enacted ? '✅ 시행 중' : '제정하기'}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterLaws(cat) {
  currentLawFilter = cat;
  // 카테고리 버튼 active 토글
  document.querySelectorAll('.law-cat-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  renderLawList();
}

function toggleLaw(lawId) {
  const law = LAW_DB.find(l => l.id === lawId);
  if (!law) return;

  const currentlyEnacted = lawState[lawId];

  if (!currentlyEnacted) {
    // 제정
    if (law.cost > 0 && Sim.treasury < law.cost) {
      showNotice(`⚠️ 재정 부족! 이 법률의 월 유지비는 ₦${law.cost.toLocaleString()} 입니다.`);
      return;
    }
    law.apply();
    lawState[lawId] = true;
    showNotice(`📜 법률 제정: "${law.name}" 이(가) 시행되었습니다.`);
    addEventLog(`⚖️ 법률 제정`, `"${law.name}" — ${law.desc}`);

    // 펄스 효과
    const card = document.getElementById(`law-card-${lawId}`);
    if (card) {
      card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 600);
    }
  } else {
    // 폐지
    law.revert();
    lawState[lawId] = false;
    showNotice(`🚫 법률 폐지: "${law.name}" 이(가) 폐지되었습니다.`);
    addEventLog(`❌ 법률 폐지`, `"${law.name}" — 시행이 중단되었습니다.`);
  }

  renderLawList();
  updateActiveLawsList();
  updateLawStats();
  updateDashboardData();
}

function updateActiveLawsList() {
  const container = document.getElementById('active-laws-container');
  if (!container) return;

  const activeLaws = LAW_DB.filter(l => lawState[l.id]);

  if (activeLaws.length === 0) {
    container.innerHTML = '<div class="log-item empty">시행 중인 법률이 없습니다.</div>';
    return;
  }

  container.innerHTML = '';
  activeLaws.forEach(law => {
    const item = document.createElement('div');
    item.className = 'active-law-item';
    item.innerHTML = `
      <span class="law-active-name">${law.icon} ${law.name}</span>
      ${law.cost > 0 ? `<span class="law-active-cost">-₦${(law.cost/100000000).toFixed(1)}억/월</span>` : '<span class="law-active-cost" style="color:#00e676;">무료</span>'}
    `;
    container.appendChild(item);
  });
}

function updateLawStats() {
  const totalEl = document.getElementById('law-total-count');
  const activeEl = document.getElementById('law-active-count');
  const costEl = document.getElementById('law-monthly-cost');
  const approvalEl = document.getElementById('law-approval');

  const activeCount = LAW_DB.filter(l => lawState[l.id]).length;
  const totalCost = LAW_DB.filter(l => lawState[l.id]).reduce((s, l) => s + l.cost, 0);

  // 국민 지지율: 복지/교육 법률이 많을수록 높고, 치안/감시 법률은 약간 낮춤
  let approvalBase = 50;
  LAW_DB.forEach(law => {
    if (!lawState[law.id]) return;
    if (['welfare', 'education'].includes(law.cat)) approvalBase += 4;
    else if (['economy', 'labor', 'environment', 'diplomacy'].includes(law.cat)) approvalBase += 2;
    else if (law.cat === 'security') approvalBase += 1;
  });
  const approval = Math.min(98, Math.max(10, approvalBase));

  if (totalEl) totalEl.textContent = LAW_DB.length;
  if (activeEl) activeEl.textContent = activeCount;
  if (costEl) costEl.textContent = totalCost > 0 ? `₦${(totalCost/100000000).toFixed(1)}억` : '₦0';
  if (approvalEl) approvalEl.textContent = `${approval}%`;
}

// 레거시 호환 (기존 togglePolicy 호출 방지)
function togglePolicy(key) {
  // 기존 정책 키 → 새 법률 ID 매핑
  const mapping = { basic:'eco01', hours:'lab01', immig:'dip01' };
  if (mapping[key]) toggleLaw(mapping[key]);
}

window.onSimulationEvent = (evt) => {
  const items = evt.options.map(opt => ({
    label: opt.text,
    fn: (p) => {
      opt.effect();
      updateDashboardData();
      closeDialog();
      addEventLog(`🚨 긴급 결정: ${evt.title}`, `선택된 조치: ${opt.text}`);
      return `[이벤트] ${evt.title} - 선택한 조치가 실행되었습니다.`;
    }
  }));
  openDialog(`🚨 긴급 특별 리포트: ${evt.title}`, evt.desc, items);
};

function addEventLog(title, desc) {
  const container = document.getElementById('event-logs-container');
  if (!container) return;
  
  const empty = container.querySelector('.empty');
  if (empty) empty.remove();
  
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <div class="log-title">${title}</div>
    <div class="log-desc">${desc}</div>
  `;
  container.insertBefore(item, container.firstChild);
}

function updateDashboardData() {
  if (!isDashboardOpen) return;
  
  if (!Sim.citizens || Sim.citizens.length === 0) {
    Sim.init();
  }
  
  if (!simInterval) {
    simInterval = setInterval(() => {
      Sim.tick();
      updateDashboardData();
    }, 10000);
  }
  
  document.getElementById('db-gdp').textContent = `₦${Sim.gdp.toLocaleString()}`;
  document.getElementById('db-treasury').textContent = `₦${Sim.treasury.toLocaleString()}`;
  document.getElementById('db-inflation').textContent = `${Sim.inflation}%`;
  document.getElementById('db-unemployment').textContent = `${Sim.unemploymentRate}%`;
  
  document.getElementById('bar-happy').style.width = `${Sim.popHappiness}%`;
  document.getElementById('val-happy').textContent = `${Math.round(Sim.popHappiness)}%`;
  
  document.getElementById('bar-health').style.width = `${Sim.popHealth}%`;
  document.getElementById('val-health').textContent = `${Math.round(Sim.popHealth)}%`;
  
  document.getElementById('val-crime').textContent = `${Sim.popCrimeRate}%`;
  document.getElementById('val-pollution').textContent = `${Sim.pollution}%`;
  
  document.getElementById('info-interest').textContent = `${Sim.interestRate}%`;
  document.getElementById('info-tech').textContent = Math.round(Sim.techLevel);
  document.getElementById('info-space').textContent = `${Math.round(Sim.spaceProgress)}%`;
  document.getElementById('info-food').textContent = `${Math.round(Sim.foodSelfRatio)}%`;
  document.getElementById('info-power').textContent = `${Math.round(Sim.energyGridRatio)}%`;
  
  document.getElementById('player-cash').textContent = `₦${P.money.toLocaleString()}`;
  document.getElementById('treasury-cash').textContent = `₦${Sim.treasury.toLocaleString()}`;

  if (currentTab === 'budget') {
    renderBudgetSliders();
  } else if (currentTab === 'citizens') {
    renderCitizenList();
  } else if (currentTab === 'stocks') {
    renderStockMarket();
  } else if (currentTab === 'realestate') {
    renderRealEstate();
  } else if (currentTab === 'laws') {
    renderLawList();
    updateActiveLawsList();
    updateLawStats();
  } else if (currentTab === 'diplomacy') {
    renderDiplomacy();
  }
}

// ── 👤 3D CITIZENS NAVIGATION & RENDER logic ──

function updateCitizenGoal(cm, hour) {
  const citizen = Sim.citizens.find(c => c.id === cm.citizenId);
  if (!citizen) return;

  let targetType = 0; // 0: wander streets

  // Routine schedule
  if (hour >= 8 && hour < 12) {
    // 08:00 ~ 12:00 출근 (회사/연구소/학교/정부청사)
    if (citizen.job) {
      if (citizen.job.includes('IT') || citizen.job.includes('AI')) targetType = 4; // 테크노 밸리
      else if (citizen.job.includes('금융') || citizen.job.includes('경제')) targetType = 2; // 파이낸스
      else if (citizen.job.includes('군사') || citizen.job.includes('치안')) targetType = 1; // 정부청사
      else if (citizen.job.includes('교육') || citizen.job.includes('연구')) targetType = 11; // NNU
      else if (citizen.job.includes('메디컬')) targetType = 10; // 병원
      else targetType = 3; // 비즈니스 대기업
    } else {
      targetType = 0; // 실업자는 배회
    }
  } else if (hour >= 12 && hour < 13) {
    // 12:00 ~ 13:00 점심시간 (상업지구 쇼핑몰/음식점)
    targetType = 5;
  } else if (hour >= 13 && hour < 18) {
    // 13:00 ~ 18:00 오후 근무 복귀
    if (citizen.job) {
      if (citizen.job.includes('IT') || citizen.job.includes('AI')) targetType = 4;
      else if (citizen.job.includes('금융') || citizen.job.includes('경제')) targetType = 2;
      else if (citizen.job.includes('군사') || citizen.job.includes('치안')) targetType = 1;
      else if (citizen.job.includes('교육') || citizen.job.includes('연구')) targetType = 11;
      else if (citizen.job.includes('메디컬')) targetType = 10;
      else targetType = 3;
    } else {
      targetType = 0;
    }
  } else if (hour >= 18 && hour < 22) {
    // 18:00 ~ 22:00 퇴근 및 여가 (부자는 미디어/스포츠, 빈민/일반인은 집)
    if (citizen.classGroup === '자본가') {
      targetType = Math.random() > 0.5 ? 7 : 12; // 미디어타워 또는 스포츠 지구
    } else {
      targetType = 8; // 주거 단지 (집)
    }
  } else {
    // 22:00 ~ 08:00 야간 숙면
    targetType = 8; // 주거 단지
  }

  // Find all buildings of target type
  if (targetType > 0) {
    const list = [];
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (MAP[y][x] === targetType) {
          list.push({x, y});
        }
      }
    }
    if (list.length > 0) {
      const selected = list[Math.floor(Math.random() * list.length)];
      cm.goalX = selected.x;
      cm.goalY = selected.y;
      cm.targetBuildingType = targetType;
    } else {
      cm.goalX = 32; cm.goalY = 32;
      cm.targetBuildingType = 0;
    }
  } else {
    // Wander streets: pick a random road tile
    const roads = [];
    for (let y = 3; y < MH - 3; y++) {
      for (let x = 3; x < MW - 3; x++) {
        if (MAP[y][x] === 0) roads.push({x, y});
      }
    }
    if (roads.length > 0) {
      const selected = roads[Math.floor(Math.random() * roads.length)];
      cm.goalX = selected.x;
      cm.goalY = selected.y;
    } else {
      cm.goalX = 32; cm.goalY = 32;
    }
    cm.targetBuildingType = 0;
  }
}

function init3DCitizens() {
  citizenMeshes.forEach(cm => scene.remove(cm.mesh));
  citizenMeshes = [];

  const citizenGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8);
  
  const roadTiles = [];
  for (let y = 3; y < MH - 3; y++) {
    for (let x = 3; x < MW - 3; x++) {
      if (MAP[y][x] === 0) {
        roadTiles.push({x, y});
      }
    }
  }

  if (roadTiles.length === 0) return;

  const numSpawn = Math.min(50, Sim.citizens.length);
  for (let i = 0; i < numSpawn; i++) {
    const citizen = Sim.citizens[i];
    const spawnTile = roadTiles[Math.floor(Math.random() * roadTiles.length)];
    
    const randomColor = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    const citizenMat = new THREE.MeshStandardMaterial({
      color: randomColor,
      emissive: randomColor,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      metalness: 0.3
    });

    const mesh = new THREE.Mesh(citizenGeom, citizenMat);
    mesh.position.set(spawnTile.x + 0.5, 0.175, spawnTile.y + 0.5);
    scene.add(mesh);

    const cm = {
      mesh: mesh,
      citizenId: citizen.id,
      tx: spawnTile.x,
      ty: spawnTile.y,
      targetX: spawnTile.x,
      targetY: spawnTile.y,
      goalX: spawnTile.x,
      goalY: spawnTile.y,
      targetBuildingType: 0,
      isInside: false,
      lastCheckedHour: -1,
      speed: 0.8 + Math.random() * 0.6
    };
    
    // Set initial goal based on time
    const hour = Math.floor(gMin / 60) % 24;
    updateCitizenGoal(cm, hour);
    cm.lastCheckedHour = hour;
    
    citizenMeshes.push(cm);
  }
}

function update3DCitizens(dt) {
  tsGlobal += dt * 1000;
  const hour = Math.floor(gMin / 60) % 24;
  
  citizenMeshes.forEach(cm => {
    // Check if hour changed to reset goals
    if (cm.lastCheckedHour !== hour) {
      updateCitizenGoal(cm, hour);
      cm.lastCheckedHour = hour;
      cm.isInside = false;
      cm.mesh.visible = true;
      // Spawn near building boundary or random road
      const roads = [];
      for (let y = cm.ty - 1; y <= cm.ty + 1; y++) {
        for (let x = cm.tx - 1; x <= cm.tx + 1; x++) {
          if (x >= 0 && x < MW && y >= 0 && y < MH && MAP[y][x] === 0) {
            roads.push({x, y});
          }
        }
      }
      if (roads.length > 0) {
        const r = roads[Math.floor(Math.random() * roads.length)];
        cm.tx = r.x; cm.ty = r.y;
        cm.targetX = r.x; cm.targetY = r.y;
        cm.mesh.position.set(r.x + 0.5, 0.175, r.y + 0.5);
      }
    }

    if (cm.isInside) {
      return; // Skip walking if inside building
    }

    const pos = cm.mesh.position;
    const targetWorldX = cm.targetX + 0.5;
    const targetWorldZ = cm.targetY + 0.5;

    const dx = targetWorldX - pos.x;
    const dz = targetWorldZ - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.03) {
      cm.tx = cm.targetX;
      cm.ty = cm.targetY;

      // Check if reached building goal
      const distToGoal = Math.abs(cm.tx - cm.goalX) + Math.abs(cm.ty - cm.goalY);
      if (distToGoal <= 1.5 && cm.targetBuildingType > 0) {
        cm.isInside = true;
        cm.mesh.visible = false;
        return;
      }
      
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      let bestDir = null;
      let minTargetDist = Infinity;
      
      dirs.forEach(([ox, oy]) => {
        const nx = cm.tx + ox;
        const ny = cm.ty + oy;
        if (nx >= 0 && nx < MW && ny >= 0 && ny < MH) {
          const isRoad = MAP[ny][nx] === 0;
          const isTarget = nx === cm.goalX && ny === cm.goalY;
          if (isRoad || isTarget) {
            const dX = cm.goalX - nx;
            const dY = cm.goalY - ny;
            const d = dX * dX + dY * dY;
            if (d < minTargetDist) {
              minTargetDist = d;
              bestDir = {x: nx, y: ny};
            }
          }
        }
      });
      
      if (bestDir) {
        cm.targetX = bestDir.x;
        cm.targetY = bestDir.y;
      } else {
        // Fallback random wander
        const validDirs = [];
        dirs.forEach(([ox, oy]) => {
          const nx = cm.tx + ox;
          const ny = cm.ty + oy;
          if (nx >= 0 && nx < MW && ny >= 0 && ny < MH && MAP[ny][nx] === 0) {
            validDirs.push({x: nx, y: ny});
          }
        });
        if (validDirs.length > 0) {
          const next = validDirs[Math.floor(Math.random() * validDirs.length)];
          cm.targetX = next.x;
          cm.targetY = next.y;
        }
      }
    } else {
      const spd = cm.speed * dt;
      pos.x += (dx / dist) * spd;
      pos.z += (dz / dist) * spd;
    }
    
    pos.y = 0.175 + Math.abs(Math.sin(tsGlobal * 0.005 * cm.speed)) * 0.04;
  });
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', e => {
  mouseScreenX = e.clientX;
  mouseScreenY = e.clientY;
  
  if (!locked) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
});

function updateCitizenTooltip() {
  if (!camera || citizenMeshes.length === 0) return;

  if (locked) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  } else {
    raycaster.setFromCamera(mouse, camera);
  }

  const meshesOnly = citizenMeshes.map(cm => cm.mesh);
  const intersects = raycaster.intersectObjects(meshesOnly);
  const tooltip = document.getElementById('citizen-tooltip');

  if (intersects.length > 0 && intersects[0].distance < 12) {
    const hitMesh = intersects[0].object;
    const cm = citizenMeshes.find(x => x.mesh === hitMesh);
    const citizen = Sim.citizens.find(c => c.id === cm.citizenId);

    if (citizen && tooltip) {
      tooltip.style.display = 'block';

      if (locked) {
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.top = 'auto';
        tooltip.style.bottom = '120px';
      } else {
        tooltip.style.transform = 'none';
        tooltip.style.left = `${mouseScreenX + 16}px`;
        tooltip.style.top = `${mouseScreenY + 16}px`;
        tooltip.style.bottom = 'auto';
      }

      tooltip.innerHTML = `
        <div class="tooltip-title">
          <span>👤 ${citizen.name}</span>
          <span style="color:rgba(255,255,255,0.4)">${citizen.age}세 · ${citizen.gender}</span>
        </div>
        <div class="tooltip-job">${citizen.job || '<span class="text-orange">실업자</span>'}</div>
        <div class="tooltip-stats">
          행복도: <span>${citizen.happiness}%</span>
          건강도: <span>${citizen.health}%</span>
          잔고: <span>₦${citizen.bankBalance.toLocaleString()}</span>
          스트레스: <span>${citizen.stress}%</span>
        </div>
        ${citizen.prisonTime > 0 ? '<div style="color:#ff4560;font-weight:700;font-size:10px;margin-top:4px">⚠️ 교도소 수감 중</div>' : ''}
      `;
    }
  } else {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
}

// ══════════════════════════════════════════════════════
//   📰 1. 뉴스/신문 시스템
// ══════════════════════════════════════════════════════
const newsQueue = [];
let newsIndex = 0;
let newsTimer = 0;

window.addNews = function(text) {
  newsQueue.push(text);
  if (newsQueue.length > 30) newsQueue.shift();
};

// 초기 뉴스 항목
(function seedNews() {
  const seeds = [
    '📈 GDP 사상 최고치 달성! 경제 성장세 지속',
    '🌧️ 강력 태풍 수도권 상륙 예고 — 시민 대피 권고',
    '🏦 기준금리 인상으로 주식시장 하락세',
    '🎉 네오폴리스 인구 500만 돌파!',
    '🚇 지하철 4호선 개통 예정 — 교통 편의성 향상',
    '🌿 환경부, 오염물질 감축 목표 달성 발표',
    '📊 네오이현 지지율 상승세 — 국민 여론 긍정적',
    '🏥 무상의료 정책 시행 후 국민 건강도 개선'
  ];
  seeds.forEach(s => newsQueue.push(s));
})();

function updateNewsTicker(dt) {
  newsTimer += dt;
  if (newsTimer >= 8) {  // 8초마다 다음 뉴스
    newsTimer = 0;
    if (newsQueue.length > 0) {
      newsIndex = (newsIndex + 1) % newsQueue.length;
      const el = document.getElementById('news-ticker-text');
      if (el) {
        el.textContent = newsQueue[newsIndex];
        // 애니메이션 재시작
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = 'tickerScroll 30s linear infinite';
      }
      // 뉴스 읽기 퀘스트 카운터
      const q = getCurrentQuest ? getCurrentQuest() : null;
      if (q && q.id === 'newsReader') {
        q.counter = (q.counter || 0) + 1;
      }
    }
  }
}

// ══════════════════════════════════════════════════════
//   🔊 8. 사운드 시스템 (Web Audio API)
// ══════════════════════════════════════════════════════
let audioCtx = null;
let isMuted = false;
let bgmGain = null;
let bgmOsc1 = null;
let bgmOsc2 = null;
let rainNoiseSource = null;
let rainNoiseGain = null;
let walkTimer = 0;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.06;
    bgmGain.connect(audioCtx.destination);
    startBGM();
    initRainNoise();
  } catch(e) { console.warn('Audio init failed:', e); }
}

function startBGM() {
  if (!audioCtx) return;
  // 저주파 신스 앰비언트 — 두 오실레이터 합산
  bgmOsc1 = audioCtx.createOscillator();
  bgmOsc1.type = 'sine';
  bgmOsc1.frequency.value = 55; // A1
  bgmOsc1.connect(bgmGain);
  bgmOsc1.start();

  bgmOsc2 = audioCtx.createOscillator();
  bgmOsc2.type = 'triangle';
  bgmOsc2.frequency.value = 82.5; // E2
  const osc2gain = audioCtx.createGain();
  osc2gain.gain.value = 0.4;
  bgmOsc2.connect(osc2gain);
  osc2gain.connect(bgmGain);
  bgmOsc2.start();
}

function initRainNoise() {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  rainNoiseSource = audioCtx.createBufferSource();
  rainNoiseSource.buffer = buffer;
  rainNoiseSource.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.5;

  rainNoiseGain = audioCtx.createGain();
  rainNoiseGain.gain.value = 0;

  rainNoiseSource.connect(filter);
  filter.connect(rainNoiseGain);
  rainNoiseGain.connect(audioCtx.destination);
  rainNoiseSource.start();
}

function updateBGM() {
  if (!audioCtx || !bgmOsc1) return;
  const h = Math.floor(gMin / 60) % 24;
  const isNight = h < 5 || h >= 21;
  // 낮: 밝은 톤(A2), 밤: 어두운 톤(A1)
  const targetFreq = isNight ? 55 : 110;
  bgmOsc1.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 2.0);
  bgmOsc2.frequency.setTargetAtTime(isNight ? 82.5 : 165, audioCtx.currentTime, 2.0);
  // 빗소리
  if (rainNoiseGain) {
    const targetVol = weatherState === 'RAINY' && !isMuted ? 0.04 : 0;
    rainNoiseGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.5);
  }
  // 음소거
  bgmGain.gain.setTargetAtTime(isMuted ? 0 : 0.06, audioCtx.currentTime, 0.2);
}

function playClick() {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  g.gain.setValueAtTime(0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.06);
}

function playNotice() {
  if (!audioCtx || isMuted) return;
  [880, 1320].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    const t = audioCtx.currentTime + i * 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.2);
  });
}

function playCoin() {
  if (!audioCtx || isMuted) return;
  [880, 1100, 1320, 1760].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = audioCtx.currentTime + i * 0.06;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.14);
  });
}

function playWalk() {
  if (!audioCtx || isMuted) return;
  const noise = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  noise.type = 'sawtooth';
  noise.frequency.value = 60 + Math.random() * 40;
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  noise.connect(g); g.connect(audioCtx.destination);
  noise.start(); noise.stop(audioCtx.currentTime + 0.05);
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
  if (audioCtx) {
    bgmGain.gain.setTargetAtTime(isMuted ? 0 : 0.06, audioCtx.currentTime, 0.2);
    if (rainNoiseGain) rainNoiseGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
  }
}

// ══════════════════════════════════════════════════════
//   ⚙️ 설정 패널
// ══════════════════════════════════════════════════════
let settingsOpen = false;
let currentLang = localStorage.getItem('neoLang') || 'ko';
let masterVolume = parseFloat(localStorage.getItem('neoVolume') || '0.7');

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  settingsOpen = !settingsOpen;
  panel.style.display = settingsOpen ? 'block' : 'none';
  if (settingsOpen) _initSettingsUI();
}

function _initSettingsUI() {
  // 언어 버튼 활성 상태
  document.getElementById('lang-ko-btn')?.classList.toggle('active', currentLang === 'ko');
  document.getElementById('lang-en-btn')?.classList.toggle('active', currentLang === 'en');
  // 볼륨 슬라이더
  const vol = Math.round(masterVolume * 100);
  const slider = document.getElementById('volume-slider');
  if (slider) slider.value = vol;
  const valEl = document.getElementById('volume-val');
  if (valEl) valEl.textContent = vol + '%';
  // 게스트 시 비밀번호 섹션 숨김
  if (currentUsername === '게스트' || currentUsername === '') {
    document.body.classList.add('guest-mode');
  } else {
    document.body.classList.remove('guest-mode');
  }
}

function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('neoLang', lang);
  document.getElementById('lang-ko-btn')?.classList.toggle('active', lang === 'ko');
  document.getElementById('lang-en-btn')?.classList.toggle('active', lang === 'en');
  // i18n 텍스트 교체
  document.querySelectorAll('.i18n').forEach(el => {
    const text = el.getAttribute('data-' + lang);
    if (text) el.textContent = text;
  });
  // 비밀번호 입력 필드 placeholder 교체
  const placeholders = {
    ko: ['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인'],
    en: ['Current password', 'New password', 'Confirm new password']
  };
  const inputs = document.querySelectorAll('#settings-pw-section .settings-input');
  inputs.forEach((inp, i) => { if (placeholders[lang][i]) inp.placeholder = placeholders[lang][i]; });
}

function setMasterVolume(val) {
  masterVolume = val / 100;
  localStorage.setItem('neoVolume', masterVolume);
  const valEl = document.getElementById('volume-val');
  if (valEl) valEl.textContent = val + '%';
  if (!audioCtx) return;
  if (!isMuted) {
    bgmGain.gain.setTargetAtTime(0.06 * masterVolume, audioCtx.currentTime, 0.05);
  }
  if (rainNoiseGain) {
    rainNoiseGain.gain.setTargetAtTime(masterVolume > 0 ? 0.04 * masterVolume : 0, audioCtx.currentTime, 0.05);
  }
}

function setResolution(ratio) {
  renderer.setPixelRatio(ratio);
  // 버튼 활성 상태 업데이트
  document.querySelectorAll('.settings-res-btn').forEach(btn => btn.classList.remove('active'));
  event.target.closest('.settings-res-btn')?.classList.add('active');
  localStorage.setItem('neoPixelRatio', ratio);
}

async function logoutPlayer() {
  if (!confirm(currentLang === 'en' ? 'Are you sure you want to logout?' : '로그아웃 하시겠습니까?')) return;
  await removePlayerFromOnline();
  // 멀티플레이어 인터벌 중지
  if (window.multiplayerBroadcastInterval) clearInterval(multiplayerBroadcastInterval);
  if (window.multiplayerFetchInterval) clearInterval(multiplayerFetchInterval);
  currentUsername = '';
  currentPassword = '';
  // 설정 패널 닫기
  settingsOpen = false;
  const panel = document.getElementById('settings-panel');
  if (panel) panel.style.display = 'none';
  // 모바일 컨트롤 숨기기
  document.body.classList.remove('game-active');
  // 로그인 화면 표시
  document.getElementById('lock-screen').style.display = 'flex';
}

async function changePassword() {
  if (currentUsername === '게스트' || !currentUsername) return;
  const oldPw = document.getElementById('pw-old')?.value.trim();
  const newPw = document.getElementById('pw-new')?.value.trim();
  const confirm2 = document.getElementById('pw-confirm')?.value.trim();
  if (!oldPw || !newPw || !confirm2) {
    showNotice(currentLang === 'en' ? '⚠️ All fields required.' : '⚠️ 모든 항목을 입력해 주세요.'); return;
  }
  if (oldPw !== currentPassword) {
    showNotice(currentLang === 'en' ? '❌ Current password incorrect.' : '❌ 현재 비밀번호가 틀렸습니다.'); return;
  }
  if (newPw !== confirm2) {
    showNotice(currentLang === 'en' ? '❌ New passwords do not match.' : '❌ 새 비밀번호가 일치하지 않습니다.'); return;
  }
  if (newPw.length < 4) {
    showNotice(currentLang === 'en' ? '❌ Password too short (min 4 chars).' : '❌ 비밀번호는 4자 이상이어야 합니다.'); return;
  }
  currentPassword = newPw;
  await saveUser(currentUsername, currentPassword);
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  showNotice(currentLang === 'en' ? '✅ Password changed.' : '✅ 비밀번호가 변경되었습니다.');
}

// 저장된 해상도 설정 복원 (게임 시작 후 renderer 준비되면 적용)
function _applyStoredResolution() {
  const saved = localStorage.getItem('neoPixelRatio');
  if (saved && renderer) renderer.setPixelRatio(parseFloat(saved));
  // 저장된 볼륨 UI 반영
  const savedVol = parseFloat(localStorage.getItem('neoVolume') || '0.7');
  masterVolume = savedVol;
  // 저장된 언어 반영
  if (currentLang !== 'ko') changeLanguage(currentLang);
}

// ══════════════════════════════════════════════════════
//   💬 채팅 시스템
// ══════════════════════════════════════════════════════
let chatOpen = false;
let chatLastTs = 0;
let chatFetchIntervalId = null;
let chatUnread = 0;
const chatBubbles = {};  // { username: { el, expiry } }

function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chat-panel');
  if (panel) panel.style.display = chatOpen ? 'flex' : 'none';
  if (chatOpen) {
    chatUnread = 0;
    const badge = document.getElementById('chat-unread-badge');
    if (badge) badge.style.display = 'none';
    document.getElementById('chat-messages')?.scrollTo(0, 99999);
  }
}

async function sendChat() {
  if (!currentUsername || currentUsername === '게스트') {
    showNotice('💬 채팅은 로그인 후 이용 가능합니다.'); return;
  }
  const input = document.getElementById('chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  input.value = '';
  const payload = { u: currentUsername, m: msg, t: Date.now() };
  try {
    await fetch(`${DB_URL}chat/${payload.t}_${encodeURIComponent(currentUsername)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e) { showNotice('❌ 채팅 전송 실패'); }
}

function sendEmoji(emoji) {
  if (!currentUsername || currentUsername === '게스트') return;
  // 말풍선 + 플로팅 이모지
  _showFloatEmoji(emoji);
  // 채팅으로 전송
  const payload = { u: currentUsername, m: emoji, t: Date.now() };
  fetch(`${DB_URL}chat/${payload.t}_${encodeURIComponent(currentUsername)}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function _showFloatEmoji(emoji) {
  const canvas = document.getElementById('cvs') || document.querySelector('canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-emoji';
  el.textContent = emoji;
  el.style.left = (rect.left + rect.width / 2) + 'px';
  el.style.top  = (rect.top  + rect.height / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

async function fetchChatMessages() {
  if (!isCloudConnected) return;
  try {
    const res = await fetch(`${DB_URL}chat.json?orderBy="$key"&limitToLast=40`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;
    const entries = Object.entries(data).sort((a, b) => a[1].t - b[1].t);
    const newEntries = entries.filter(([, m]) => m.t > chatLastTs);
    if (newEntries.length === 0) return;
    chatLastTs = entries[entries.length - 1][1].t;
    const container = document.getElementById('chat-messages');
    newEntries.forEach(([key, msg]) => {
      // 말풍선 업데이트
      if (msg.u !== currentUsername) {
        showSpeechBubble(msg.u, msg.m);
        if (!chatOpen) {
          chatUnread++;
          const badge = document.getElementById('chat-unread-badge');
          if (badge) { badge.style.display = 'flex'; badge.textContent = chatUnread > 9 ? '9+' : chatUnread; }
        }
      } else {
        showSpeechBubble('__self__', msg.m);
      }
      // 채팅창에 추가
      if (!container) return;
      const div = document.createElement('div');
      const isSelf = msg.u === currentUsername;
      div.className = 'chat-msg ' + (isSelf ? 'self-msg' : 'other-msg');
      div.dataset.chatKey = key;
      let delBtn = '';
      if (currentUsername === 'ree1203') {
        delBtn = `<button onclick="adminDeleteChatMsg('${key}',this.closest('.chat-msg'))" style="margin-left:6px;background:none;border:none;color:#ff4560;cursor:pointer;font-size:11px;opacity:0.7;padding:0 2px;" title="메시지 삭제">✕</button>`;
      }
      const dmLinkHtml = (msg.u !== currentUsername)
        ? `<button onclick="openDmWith('${msg.u}')" style="background:none;border:none;color:#475569;font-size:10px;cursor:pointer;margin-left:4px;" title="귓속말">💬</button>`
        : '';
      div.innerHTML = `<span class="chat-name">${_escapeHtml(msg.u)}</span>${dmLinkHtml}<span class="chat-text">${_escapeHtml(msg.m)}</span>${delBtn}`;
      container.appendChild(div);
      if (typeof addReactionUI === 'function') addReactionUI(div, key);
      // 최대 80개 유지
      while (container.children.length > 80) container.removeChild(container.firstChild);
    });
    if (chatOpen) container?.scrollTo(0, 99999);
  } catch(e) { /* silent */ }
}

function _escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 관리자 채팅 삭제 (ree1203 전용) ──
async function adminDeleteChatMsg(key, el) {
  if (currentUsername !== 'ree1203') return;
  try {
    await fetch(`${DB_URL}chat/${key}.json`, { method: 'DELETE' });
    if (el) el.remove();
    adminLog('채팅 삭제: ' + key, 'warn');
  } catch(e) { showNotice('❌ 채팅 삭제 실패'); }
}

async function adminClearAllChat() {
  if (currentUsername !== 'ree1203') return;
  if (!confirm('전체 채팅을 삭제하시겠습니까?')) return;
  try {
    await fetch(`${DB_URL}chat.json`, { method: 'DELETE' });
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    chatLastTs = 0;
    showNotice('🗑️ 전체 채팅 삭제 완료');
    adminLog('전체 채팅 삭제', 'warn');
  } catch(e) { showNotice('❌ 채팅 삭제 실패'); }
}

function showSpeechBubble(username, message) {
  const layer = document.getElementById('speech-bubbles-layer');
  if (!layer) return;
  let el = chatBubbles[username]?.el;
  if (!el) {
    el = document.createElement('div');
    el.className = 'speech-bubble';
    layer.appendChild(el);
    chatBubbles[username] = { el };
  }
  el.textContent = message;
  el.style.opacity = '1';
  chatBubbles[username].expiry = Date.now() + 5000;
  chatBubbles[username].message = message;
}

function updateSpeechBubbles() {
  const now = Date.now();
  for (const [uname, bub] of Object.entries(chatBubbles)) {
    if (!bub.el) continue;
    // 만료 체크
    if (now > bub.expiry) { bub.el.style.opacity = '0'; continue; }
    // 3D → 2D 위치 계산
    let worldPos;
    if (uname === '__self__') {
      worldPos = new THREE.Vector3(P.x, 2.2, P.y);
    } else {
      const op = otherPlayers[uname];
      if (!op) { bub.el.style.opacity = '0'; continue; }
      worldPos = new THREE.Vector3(op.x, 2.2, op.y);
    }
    worldPos.project(camera);
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    const sx = worldPos.x *  hw + hw;
    const sy = worldPos.y * -hh + hh;
    // 화면 밖이면 숨김
    if (worldPos.z > 1 || sx < 0 || sx > window.innerWidth || sy < 0 || sy > window.innerHeight) {
      bub.el.style.opacity = '0'; continue;
    }
    bub.el.style.opacity = '1';
    bub.el.style.left = sx + 'px';
    bub.el.style.top  = sy + 'px';
  }
}

// ══════════════════════════════════════════════════════
//   👥 플레이어 목록
// ══════════════════════════════════════════════════════
let playerListOpen = false;

function togglePlayerList() {
  playerListOpen = !playerListOpen;
  const panel = document.getElementById('player-list-panel');
  if (panel) panel.style.display = playerListOpen ? 'block' : 'none';
  if (playerListOpen) updatePlayerList();
}

function updatePlayerList() {
  const body = document.getElementById('player-list-body');
  if (!body) return;
  body.innerHTML = '';
  // 자기 자신
  const selfEl = document.createElement('div');
  selfEl.className = 'pl-item';
  selfEl.innerHTML = `<div class="pl-dot self"></div><div class="pl-name">${currentUsername || '나'}</div><div class="pl-you">나</div>`;
  body.appendChild(selfEl);
  // 다른 플레이어
  for (const uname of Object.keys(otherPlayers)) {
    const el = document.createElement('div');
    el.className = 'pl-item';
    el.innerHTML = `<div class="pl-dot"></div><div class="pl-name">${uname}</div>`;
    body.appendChild(el);
  }
  // 접속자 수 뱃지
  const total = Object.keys(otherPlayers).length + 1;
  const badge = document.getElementById('online-count-badge');
  if (badge) badge.textContent = total;
}

// ══════════════════════════════════════════════════════
//   🏢 부동산 매수 / 매도
// ══════════════════════════════════════════════════════
function buyProperty(houseId) {
  if (!P.ownedProperties) P.ownedProperties = [];
  if (P.ownedProperties.includes(houseId)) { showNotice('이미 소유 중인 부동산입니다.'); return; }
  const h = Sim.houses.find(x => x.id === houseId);
  if (!h) return;
  if (P.money < h.price) { showNotice(`💰 잔액 부족! ₦${h.price.toLocaleString()} 필요`); return; }
  P.money -= h.price;
  P.ownedProperties.push(houseId);
  showNotice(`🏠 ${h.name} 구매 완료! 매달 ₦${h.rent.toLocaleString()} 임대 수입`);
  renderRealEstate();
  document.getElementById('mv').textContent = P.money.toLocaleString();
}

function sellProperty(houseId) {
  if (!P.ownedProperties) return;
  const idx = P.ownedProperties.indexOf(houseId);
  if (idx === -1) return;
  const h = Sim.houses.find(x => x.id === houseId);
  if (!h) return;
  const sellPrice = Math.round(h.price * 0.75);
  P.money += sellPrice;
  P.ownedProperties.splice(idx, 1);
  showNotice(`🏠 ${h.name} 매도 완료! ₦${sellPrice.toLocaleString()} 수령`);
  renderRealEstate();
  document.getElementById('mv').textContent = P.money.toLocaleString();
}

// ── 부동산 임대 수입 (게임 하루마다) ──
let _lastRentDay = -1;
function collectRent() {
  if (!P.ownedProperties || P.ownedProperties.length === 0) return;
  if (dayN === _lastRentDay) return;
  _lastRentDay = dayN;
  let total = 0;
  P.ownedProperties.forEach(id => {
    const h = Sim.houses.find(x => x.id === id);
    if (h) total += h.rent;
  });
  if (total > 0) {
    P.money += total;
    showNotice(`🏠 임대 수입 ₦${total.toLocaleString()} 입금 (보유 ${P.ownedProperties.length}채)`);
    document.getElementById('mv').textContent = P.money.toLocaleString();
  }
}

// 첫 클릭/키 입력 시 오디오 활성화
function tryInitAudio() {
  initAudio();
  document.removeEventListener('click', tryInitAudio);
  document.removeEventListener('keydown', tryInitAudio);
}
document.addEventListener('click', tryInitAudio);
document.addEventListener('keydown', tryInitAudio);

// ══════════════════════════════════════════════════════
//   🌙 10. 달 위상 시스템
// ══════════════════════════════════════════════════════
let moonMesh = null;

function createMoon() {
  const geom = new THREE.SphereGeometry(1.5, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xfff8e7,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0.0
  });
  moonMesh = new THREE.Mesh(geom, mat);
  moonMesh.visible = false;
  scene.add(moonMesh);
}

function updateMoon() {
  if (!moonMesh) return;
  const h = Math.floor(gMin / 60) % 24;
  const isNight = h < 5 || h >= 21;
  moonMesh.visible = isNight;

  if (isNight) {
    // 달 위상 계산 (dayN % 30)
    const phase = dayN % 30;
    let brightness;
    if      (phase < 7)  brightness = phase / 7;
    else if (phase < 14) brightness = 1.0;
    else if (phase < 21) brightness = 1.0 - (phase - 14) / 7;
    else                 brightness = (30 - phase) / 9;

    moonMesh.material.emissiveIntensity = 0.05 + brightness * 1.2;
    moonMesh.material.opacity = 0.2 + brightness * 0.8;
    moonMesh.material.transparent = true;

    // 달 위치: 플레이어 중심, 별들처럼 회전
    const norm = gMin / 1440;
    const moonAngle = norm * Math.PI * 2 + Math.PI; // 해와 반대편
    const moonEl = Math.max(0.1, Math.sin(norm * Math.PI * 2 + Math.PI * 0.5));
    moonMesh.position.set(
      P.x + Math.cos(moonAngle) * 80,
      10 + moonEl * 55,
      P.y + Math.sin(moonAngle) * 80
    );
  }
}

// ══════════════════════════════════════════════════════
//   🚗 11. 차량 NPC 시스템
// ══════════════════════════════════════════════════════
const vehicleMeshes = [];
const VEHICLE_COLORS = [0xff2020, 0x2060ff, 0xffcc00, 0xffffff, 0x20cc20, 0xff8020, 0x8020ff];

function initVehicles() {
  const roadTiles = [];
  for (let y = 2; y < MH - 2; y++) {
    for (let x = 2; x < MW - 2; x++) {
      if (MAP[y][x] === 0) roadTiles.push({ x, y });
    }
  }
  if (!roadTiles.length) return;

  const carCount = 12;
  const bodyGeom = new THREE.BoxGeometry(0.55, 0.18, 0.32);
  const roofGeom = new THREE.BoxGeometry(0.3, 0.15, 0.28);

  for (let i = 0; i < carCount; i++) {
    const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.09;
    group.add(body);

    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = 0.245;
    group.add(roof);

    const tile = roadTiles[Math.floor(Math.random() * roadTiles.length)];
    group.position.set(tile.x + 0.5, 0, tile.y + 0.5);
    scene.add(group);

    vehicleMeshes.push({
      group,
      tx: tile.x, ty: tile.y,
      targetX: tile.x, targetY: tile.y,
      speed: 1.8 + Math.random() * 1.4,
      dir: [0, 1]
    });
  }
}

function updateVehicles(dt) {
  vehicleMeshes.forEach(v => {
    const pos = v.group.position;
    const twx = v.targetX + 0.5;
    const twz = v.targetY + 0.5;
    const dx = twx - pos.x;
    const dz = twz - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.05) {
      v.tx = v.targetX;
      v.ty = v.targetY;
      // 직진 우선, 막히면 방향 전환
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      // 현재 방향 우선
      const preferred = [v.dir, ...dirs.filter(d => !(d[0] === v.dir[0] && d[1] === v.dir[1]))];
      let moved = false;
      for (const d of preferred) {
        const nx = v.tx + d[0], ny = v.ty + d[1];
        if (nx >= 0 && nx < MW && ny >= 0 && ny < MH && MAP[ny][nx] === 0) {
          v.targetX = nx; v.targetY = ny; v.dir = d; moved = true; break;
        }
      }
      if (!moved) { v.targetX = v.tx; v.targetY = v.ty; }
    } else {
      const spd = v.speed * dt;
      pos.x += (dx / dist) * spd;
      pos.z += (dz / dist) * spd;
      // 차량이 진행 방향을 바라보도록 회전
      v.group.rotation.y = Math.atan2(dx, dz);
    }
  });
}

// ══════════════════════════════════════════════════════
//   🚇 6. 지하철 빠른 이동 시스템
// ══════════════════════════════════════════════════════
const SUBWAY_STATIONS = [
  { name: '중앙역', x: 32, y: 32 },
  { name: '북부역', x: 32, y:  6 },
  { name: '동부역', x: 55, y: 32 },
  { name: '서부역', x:  8, y: 32 }
];
const subwayMeshes = [];

function initSubwayStations() {
  SUBWAY_STATIONS.forEach(st => {
    const group = new THREE.Group();

    // 기둥
    const pillarGeom = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffcc00,
      emissiveIntensity: 1.5,
      roughness: 0.3
    });
    const pillar = new THREE.Mesh(pillarGeom, pillarMat);
    pillar.position.y = 1.25;
    group.add(pillar);

    // 상단 구체 (표시등)
    const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 3.0
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.y = 2.7;
    group.add(sphere);

    group.position.set(st.x + 0.5, 0, st.y + 0.5);
    scene.add(group);
    subwayMeshes.push({ group, station: st, sphere, sphereMat });
  });
}

function updateSubwayGlow(ts) {
  subwayMeshes.forEach((sm, i) => {
    sm.sphereMat.emissiveIntensity = 2.0 + Math.sin(ts * 0.003 + i * 1.2) * 1.0;
  });
}

function checkSubwayInteract() {
  // E키 누를 때 가까운 지하철역 확인
  let nearest = null;
  let nearDist = 2.5;
  SUBWAY_STATIONS.forEach(st => {
    const d = Math.sqrt((P.x - (st.x + 0.5)) ** 2 + (P.y - (st.y + 0.5)) ** 2);
    if (d < nearDist) { nearest = st; nearDist = d; }
  });
  return nearest;
}

function openSubwayDialog(currentStation) {
  const items = SUBWAY_STATIONS
    .filter(st => st.name !== currentStation.name)
    .map(dest => ({
      label: `🚇 ${dest.name}으로 이동`,
      fn: p => {
        P.x = dest.x + 0.5;
        P.y = dest.y + 0.5;
        if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
        playNotice();
        return `🚇 ${dest.name}에 도착했습니다!`;
      }
    }));
  items.push({ label: '취소', fn: () => '지하철 이용을 취소했습니다.' });
  openDialog(`🚇 ${currentStation.name}`, '어느 역으로 이동하시겠습니까?', items);
}

// ══════════════════════════════════════════════════════
//   🎒 5. 인벤토리 시스템
// ══════════════════════════════════════════════════════
P.inventory = [];  // 최대 10칸

const SHOP_ITEMS = [
  { id:'energy_drink', name:'에너지 드링크', icon:'⚡', price:3000, effect:'에너지 +40', apply(p){ p.energy = cap(p.energy + 40); } },
  { id:'nutrition_bar', name:'영양바', icon:'🍫', price:2000, effect:'배고픔 +30', apply(p){ p.hunger = cap(p.hunger + 30); } },
  { id:'painkiller',   name:'진통제',    icon:'💊', price:5000, effect:'건강 +25',  apply(p){ p.health = cap(p.health + 25); } },
  { id:'premium_coffee', name:'고급 커피', icon:'☕', price:4000, effect:'에너지 +20, 행복 +10', apply(p){ p.energy = cap(p.energy + 20); p.happy = cap(p.happy + 10); } }
];

function toggleInventory() {
  initAudio(); playClick();
  const panel = document.getElementById('inventory-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderInventory();
}

function renderInventory() {
  renderInvSlots();
  renderShopItems();
}

function renderInvSlots() {
  const container = document.getElementById('inv-slots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const item = P.inventory[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (item ? '' : ' empty');
    if (item) {
      slot.innerHTML = `<span class="inv-slot-icon">${item.icon}</span><span class="inv-slot-name">${item.name}</span>`;
      slot.title = item.effect;
      slot.onclick = () => useInventoryItem(i);
    } else {
      slot.innerHTML = '<span style="font-size:18px;opacity:0.15">○</span>';
    }
    container.appendChild(slot);
  }
}

function renderShopItems() {
  const container = document.getElementById('inv-shop-items');
  if (!container) return;
  container.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const div = document.createElement('div');
    div.className = 'inv-shop-item';
    div.innerHTML = `
      <div class="inv-shop-item-info">
        <div class="inv-shop-item-name">${item.icon} ${item.name}</div>
        <div class="inv-shop-item-effect">${item.effect}</div>
      </div>
      <button class="inv-buy-btn" onclick="buyItem('${item.id}')">₦${item.price.toLocaleString()} 구매</button>
    `;
    container.appendChild(div);
  });
}

function buyItem(itemId) {
  initAudio();
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (P.inventory.length >= 10) { showNotice('인벤토리가 가득 찼습니다!'); return; }
  if (P.money < item.price) { showNotice('잔액이 부족합니다!'); return; }
  P.money -= item.price;
  P.inventory.push({ ...item });
  playCoin();
  showNotice(`${item.icon} ${item.name} 구매 완료!`);
  renderInvSlots();
  updateHUD();
}

function useInventoryItem(index) {
  const item = P.inventory[index];
  if (!item) return;
  initAudio();
  item.apply(P);
  P.inventory.splice(index, 1);
  playNotice();
  showNotice(`${item.icon} ${item.name} 사용! (${item.effect})`);
  renderInvSlots();
  updateHUD();
}

// I키로 인벤토리 토글
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'i' || e.key === 'I') {
    e.preventDefault();
    toggleInventory();
  }
});

// ══════════════════════════════════════════════════════
//   📋 7. 퀘스트 시스템
// ══════════════════════════════════════════════════════
const QUEST_POOL = [
  {
    id: 'health100', name: '건강 회복', desc: '건강 수치를 100으로 회복하세요.',
    reward: { money: 50000 }, rewardText: '₦50,000',
    check: () => P.health >= 100
  },
  {
    id: 'rich', name: '재산가', desc: '잔고 ₦1,000,000을 달성하세요.',
    reward: { money: 100000 }, rewardText: '₦100,000',
    check: () => P.money >= 1000000
  },
  {
    id: 'foodie', name: '외식가', desc: '식당 건물 3곳 이상 방문하세요.',
    reward: { happy: 20 }, rewardText: '행복 +20',
    counter: 0, counterMax: 3, buildings: new Set(),
    check: function() { return this.counter >= 3; }
  },
  {
    id: 'energyKing', name: '체력왕', desc: '에너지 100을 3번 달성하세요.',
    reward: { money: 30000 }, rewardText: '₦30,000',
    counter: 0, counterMax: 3,
    check: function() { return this.counter >= 3; }
  },
  {
    id: 'traveler', name: '여행자', desc: '공원, 대학, 병원을 모두 방문하세요.',
    reward: { happy: 15 }, rewardText: '행복 +15',
    visited: new Set(),
    check: function() { return this.visited.has('park') && this.visited.has('univ') && this.visited.has('hospital'); }
  },
  {
    id: 'investor', name: '투자자', desc: '주식을 1종 이상 보유하세요.',
    reward: { money: 200000 }, rewardText: '₦200,000',
    check: () => Object.values(P.portfolio).some(v => v > 0)
  },
  {
    id: 'newsReader', name: '시민기자', desc: '뉴스 헤드라인 5개를 읽으세요.',
    reward: { happy: 10 }, rewardText: '행복 +10',
    counter: 0, counterMax: 5,
    check: function() { return this.counter >= 5; }
  },
  {
    id: 'explorer', name: '도시탐험가', desc: '6개 이상의 건물을 방문하세요.',
    reward: { money: 80000 }, rewardText: '₦80,000',
    visitedBlds: new Set(),
    check: function() { return this.visitedBlds.size >= 6; }
  },
  {
    id: 'walker', name: '운동가', desc: '공원 산책을 5번 하세요.',
    reward: { health: 10 }, rewardText: '건강 +10',
    counter: 0, counterMax: 5,
    check: function() { return this.counter >= 5; }
  },
  {
    id: 'shopper', name: '쇼핑왕', desc: '백화점을 3번 방문하세요.',
    reward: { happy: 25 }, rewardText: '행복 +25',
    counter: 0, counterMax: 3,
    check: function() { return this.counter >= 3; }
  }
];

let currentQuestIndex = 0;
let questCompleted = [];

function getCurrentQuest() {
  while (currentQuestIndex < QUEST_POOL.length && questCompleted.includes(QUEST_POOL[currentQuestIndex].id)) {
    currentQuestIndex++;
  }
  if (currentQuestIndex >= QUEST_POOL.length) return null;
  return QUEST_POOL[currentQuestIndex];
}

function updateQuestPanel() {
  const q = getCurrentQuest();
  const nameEl = document.getElementById('quest-name');
  const descEl = document.getElementById('quest-desc');
  const progEl = document.getElementById('quest-progress');
  if (!nameEl) return;

  if (!q) {
    nameEl.textContent = '모든 퀘스트 완료!';
    descEl.textContent = '훌륭합니다! 모든 임무를 달성했습니다.';
    progEl.textContent = '🏆 완료';
    return;
  }

  nameEl.textContent = q.name;
  descEl.textContent = q.desc;
  progEl.textContent = `보상: ${q.rewardText}`;

  // 진행도 체크
  if (q.check()) {
    completeQuest(q);
  }
}

function completeQuest(q) {
  questCompleted.push(q.id);
  // 보상 지급
  if (q.reward.money)  { P.money  = (P.money  || 0) + q.reward.money;  playCoin(); }
  if (q.reward.happy)  { P.happy  = cap((P.happy  || 0) + q.reward.happy); }
  if (q.reward.health) { P.health = cap((P.health || 0) + q.reward.health); }

  showNotice(`🎉 퀘스트 완료! [${q.name}] — 보상: ${q.rewardText}`);
  playNotice();
  addNews(`🏆 ${currentUsername || '대통령'}님이 퀘스트 [${q.name}]를 완료했습니다!`);
  updateHUD();

  // 다음 퀘스트로 자동 전환
  setTimeout(() => updateQuestPanel(), 1000);
}

function onBuildingVisit(bldName) {
  const q = getCurrentQuest();
  if (!q) return;

  // 탐험가
  if (q.id === 'explorer') { q.visitedBlds = q.visitedBlds || new Set(); q.visitedBlds.add(bldName); }
  // 외식가
  if (q.id === 'foodie' && (bldName.includes('레스토랑') || bldName.includes('백화점') || bldName.includes('식당'))) {
    q.buildings = q.buildings || new Set();
    if (!q.buildings.has(bldName)) { q.buildings.add(bldName); q.counter = (q.counter || 0) + 1; }
  }
  // 쇼핑왕
  if (q.id === 'shopper' && bldName.includes('백화점')) { q.counter = (q.counter || 0) + 1; }
  // 운동가
  if (q.id === 'walker' && bldName.includes('파크')) { q.counter = (q.counter || 0) + 1; }
  // 여행자
  if (q.id === 'traveler') {
    q.visited = q.visited || new Set();
    if (bldName.includes('파크'))   q.visited.add('park');
    if (bldName.includes('국립대') || bldName.includes('대학')) q.visited.add('univ');
    if (bldName.includes('병원'))   q.visited.add('hospital');
  }

  updateQuestPanel();
}

// 뉴스 읽기 퀘스트: 뉴스 업데이트 시 카운트 (updateNewsTicker 내부에 통합됨)

// ══════════════════════════════════════════════════════
//   📊 9. 국가 통계 그래프
// ══════════════════════════════════════════════════════
function drawLineGraph(canvasId, data, color, maxVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || canvas.width;
  const H = canvas.offsetHeight || canvas.height;
  canvas.width = W; canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  // 배경
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  ctx.fillRect(0, 0, W, H);

  const mn = Math.min(...data);
  const mx = maxVal || Math.max(...data);
  const range = Math.max(1, mx - mn);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  data.forEach((v, i) => {
    const px = (i / (data.length - 1)) * (W - 4) + 2;
    const py = H - 4 - ((v - mn) / range) * (H - 8);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // 최신값 점
  const lastV = data[data.length - 1];
  const lx = W - 2;
  const ly = H - 4 - ((lastV - mn) / range) * (H - 8);
  ctx.beginPath();
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = 10;
  ctx.fill();
}

function updateGraphs() {
  if (!isDashboardOpen || currentTab !== 'overview') return;
  if (!Sim.history) return;
  drawLineGraph('graph-gdp',      Sim.history.gdp,       '#00e676');
  drawLineGraph('graph-happy',    Sim.history.happiness,  '#00e5ff', 100);
  drawLineGraph('graph-treasury', Sim.history.treasury,   '#ffb030');
}

// ══════════════════════════════════════════════════════
//   🤝 3. 외교 탭 렌더링
// ══════════════════════════════════════════════════════
function renderDiplomacy() {
  const container = document.getElementById('diplomacy-countries-container');
  if (!container) return;
  container.innerHTML = '';

  const countries = Sim.diplomacy.countries;
  let crisisCount = 0;
  let totalRelation = 0;
  let totalTrade = 0;

  countries.forEach(c => {
    totalRelation += c.relation;
    totalTrade += c.trade;
    if (c.status === '갈등') crisisCount++;

    const card = document.createElement('div');
    card.className = 'diplo-card';
    card.innerHTML = `
      <div class="diplo-country-name">🌐 ${c.name}</div>
      <span class="diplo-status ${c.status}">${c.status}</span>
      <div class="diplo-relation-bar">
        <div class="diplo-relation-fill" style="width:${c.relation}%"></div>
      </div>
      <div class="diplo-info">
        관계도: <strong>${Math.round(c.relation)}%</strong> &nbsp;·&nbsp; 무역량: <strong>₦${c.trade}억</strong>
      </div>
      <div class="diplo-btns">
        <button class="diplo-btn trade" onclick="diploAction('${c.name}','trade')">🤝 무역협정 (₦5억)</button>
        <button class="diplo-btn aid"   onclick="diploAction('${c.name}','aid')">🎁 원조 제공 (₦3억)</button>
        <button class="diplo-btn cut"   onclick="diploAction('${c.name}','cut')">✂️ 관계 단절</button>
      </div>
    `;
    container.appendChild(card);
  });

  const avg = Math.round(totalRelation / countries.length);
  const avgEl = document.getElementById('diplo-avg');
  const tradeEl = document.getElementById('diplo-trade');
  const crisisEl = document.getElementById('diplo-crisis');
  if (avgEl) avgEl.textContent = avg + '%';
  if (tradeEl) tradeEl.textContent = totalTrade + '억';
  if (crisisEl) crisisEl.textContent = crisisCount + '건';
}

function diploAction(countryName, action) {
  initAudio();
  const c = Sim.diplomacy.countries.find(x => x.name === countryName);
  if (!c) return;

  if (action === 'trade') {
    const cost = 500000000;
    if (Sim.treasury < cost) { showNotice('⚠️ 국고가 부족합니다! (₦5억 필요)'); return; }
    Sim.treasury -= cost;
    c.relation = Math.min(100, c.relation + 20);
    c.trade = Math.round(c.trade * 1.15);
    Sim.gdp = Math.round(Sim.gdp * 1.02);
    playClick();
    showNotice(`🤝 ${countryName}와 무역협정 체결! 관계+20, GDP+2%`);
    addEventLog('🤝 무역협정', `${countryName}와 무역협정을 체결하였습니다. GDP 2% 상승.`);
  } else if (action === 'aid') {
    const cost = 300000000;
    if (Sim.treasury < cost) { showNotice('⚠️ 국고가 부족합니다! (₦3억 필요)'); return; }
    Sim.treasury -= cost;
    c.relation = Math.min(100, c.relation + 15);
    playClick();
    showNotice(`🎁 ${countryName}에 원조를 제공했습니다! 관계+15`);
    addEventLog('🎁 원조 제공', `${countryName}에 ₦3억 원조를 제공하였습니다.`);
  } else if (action === 'cut') {
    c.relation = Math.max(0, c.relation - 50);
    c.trade = Math.round(c.trade * 0.5);
    playClick();
    showNotice(`✂️ ${countryName}와의 외교 관계를 단절했습니다.`);
    addEventLog('✂️ 관계 단절', `${countryName}와의 외교 관계를 단절하였습니다.`);
  }

  renderDiplomacy();
  updateDashboardData();
}

// ══════════════════════════════════════════════════════
//   📋 국민 청원 렌더링
// ══════════════════════════════════════════════════════
window.renderPetitions = function() {
  const container = document.getElementById('petition-list');
  if (!container) return;

  if (!Sim.petitions || Sim.petitions.length === 0) {
    container.innerHTML = '<div class="log-item empty">접수된 청원이 없습니다.</div>';
    return;
  }

  container.innerHTML = '';
  Sim.petitions.forEach(petition => {
    const div = document.createElement('div');
    div.className = 'petition-item';
    const costText = petition.cost >= 100000000
      ? `₦${(petition.cost/100000000).toFixed(1)}억`
      : `₦${(petition.cost/10000000).toFixed(0)}천만`;
    div.innerHTML = `
      <div class="petition-text">📋 ${petition.text}</div>
      <div class="petition-cost">${costText}</div>
      <div class="petition-btns">
        <button class="petition-accept" onclick="handlePetition(${petition.id}, true)">수락</button>
        <button class="petition-reject" onclick="handlePetition(${petition.id}, false)">거부</button>
      </div>
    `;
    container.appendChild(div);
  });
};

function handlePetition(id, accept) {
  initAudio();
  const idx = Sim.petitions.findIndex(p => p.id === id);
  if (idx === -1) return;
  const petition = Sim.petitions[idx];

  if (accept) {
    if (Sim.treasury < petition.cost) {
      showNotice('⚠️ 국고가 부족합니다!');
      return;
    }
    Sim.treasury -= petition.cost;
    const ef = petition.effects;
    if (ef.happiness)      Sim.popHappiness    = Math.min(100, Sim.popHappiness    + ef.happiness);
    if (ef.health)         Sim.popHealth       = Math.min(100, Sim.popHealth       + ef.health);
    if (ef.crimeRate)      Sim.popCrimeRate    = Math.max(0,   Sim.popCrimeRate    + ef.crimeRate);
    if (ef.pollution)      Sim.pollution       = Math.max(0,   Sim.pollution       + ef.pollution);
    if (ef.tech)           Sim.techLevel       += ef.tech;
    if (ef.unemploymentRate) Sim.unemploymentRate = Math.max(0, Sim.unemploymentRate + ef.unemploymentRate);
    playCoin();
    showNotice(`✅ 청원 수락: "${petition.text}"`);
    addEventLog('✅ 청원 수락', `"${petition.text}" — 예산 ${(petition.cost/100000000).toFixed(1)}억 집행`);
    addNews(`✅ 청원 수락: "${petition.text}" 정책 시행`);
  } else {
    showNotice(`❌ 청원 거부: "${petition.text}"`);
    addNews(`❌ 청원 "${petition.text}" 거부 — 국민 불만 증가`);
    Sim.approvalRating = Math.max(5, Sim.approvalRating - 3);
  }

  Sim.petitions.splice(idx, 1);
  window.renderPetitions();
  updateDashboardData();
}

// ══════════════════════════════════════════════════════
//   🗳️ 2. 지지율 & 선거 시스템
// ══════════════════════════════════════════════════════
let lastElectionDay = 0;

function checkElection() {
  if (dayN - lastElectionDay >= 100 && lastElectionDay !== dayN) {
    lastElectionDay = dayN;
    openElectionPopup();
  }
}

function openElectionPopup() {
  const popup = document.getElementById('election-popup');
  if (!popup) return;
  const pct = Math.round(Sim.approvalRating);
  document.getElementById('election-desc').textContent =
    `${dayN}일차 선거가 시작되었습니다. 현재 지지율: ${pct}%. 재선에 도전하시겠습니까?`;
  document.getElementById('election-gauge-fill').style.width = pct + '%';
  document.getElementById('election-gauge-val').textContent = pct + '%';
  popup.style.display = 'block';
  document.exitPointerLock();
}

function closeElection() {
  const popup = document.getElementById('election-popup');
  if (popup) popup.style.display = 'none';
}

function runElection() {
  initAudio();
  closeElection();
  const pct = Sim.approvalRating;
  if (pct >= 50) {
    Sim.treasury += 1000000000;
    playCoin();
    showNotice(`🎉 재선 성공! 지지율 ${Math.round(pct)}% — 특별 예산 ₦10억이 지원됩니다!`);
    addEventLog('🗳️ 선거 결과', `재선 성공! 지지율 ${Math.round(pct)}%. 특별 예산 ₦10억 수령.`);
    addNews(`🎉 대통령 재선 성공! 지지율 ${Math.round(pct)}%로 당선 확정`);
  } else {
    P.happy = Math.max(0, P.happy - 20);
    showNotice(`😞 선거 패배... 지지율 ${Math.round(pct)}%로 아쉽게 낙선했습니다.`);
    addEventLog('🗳️ 선거 결과', `선거 패배. 지지율 ${Math.round(pct)}%. 행복도 -20.`);
    addNews(`😞 대통령 선거 패배 — 지지율 ${Math.round(pct)}%`);
  }
  updateHUD();
  updateDashboardData();
}

function updateApprovalBar() {
  const fill = document.getElementById('approval-fill');
  const val  = document.getElementById('approval-val');
  if (!fill || !val) return;
  const pct = Math.round(Sim.approvalRating);
  fill.style.width = pct + '%';
  val.textContent  = pct + '%';
}

// ══════════════════════════════════════════════════════
//   🔌 훅: 기존 함수들을 확장
// ══════════════════════════════════════════════════════

// openDialog를 감싸서 방문 추적 + 클릭음
const _origOpenDialog = openDialog;
openDialog = function(name, text, items) {
  initAudio(); playClick();
  onBuildingVisit(name);
  _origOpenDialog(name, text, items);
};

// updateDashboardData를 확장하여 외교/그래프/지지율도 갱신
const _origUpdateDashboardData = updateDashboardData;
updateDashboardData = function() {
  _origUpdateDashboardData();
  updateApprovalBar();
  if (currentTab === 'diplomacy') renderDiplomacy();
  if (currentTab === 'citizens') window.renderPetitions();
  if (currentTab === 'overview') updateGraphs();
};

// render() 루프에 새 기능 연동 — 기존 requestAnimationFrame을 대체하는 방식으로
// 실제로는 기존 render() 함수 마지막에서 호출되는데,
// 여기서는 별도의 루프 훅을 통해 처리
const _origRenderFn = render;
window._newRenderExtension = function(ts, dt) {
  doExtraInit3D(); // 달, 지하철, 차량 1회 초기화
  if (currentUsername === 'ree1203') updateWeapons(ts, dt);
  updateNewsTicker(dt);
  updateBGM();
  updateMoon();
  updateSubwayGlow(ts);
  updateVehicles(dt);
  updateQuestPanel();
  checkElection();

  // 체력왕 퀘스트 카운터
  const q = getCurrentQuest();
  if (q && q.id === 'energyKing' && P.energy >= 100) {
    if (!q._lastEnergy100) { q.counter = (q.counter || 0) + 1; q._lastEnergy100 = true; }
  } else if (q && q.id === 'energyKing') {
    q._lastEnergy100 = false;
  }

  // 걷기 소리
  if (isMoving) {
    walkTimer += dt;
    if (walkTimer >= 0.3) { walkTimer = 0; playWalk(); }
  } else {
    walkTimer = 0;
  }
};

// 기존 render 함수를 래핑
let isMoving = false;
(function patchRender() {
  const origRaf = window.requestAnimationFrame;
  // render 함수에서 isMoving 변수를 외부에 노출시키기 위해
  // 기존 render의 isMoving 처리를 감지하여 동기화
  // 가장 단순한 방법: render() 마지막에 extensions를 실행하도록 기존 renderer 호출 직전을 패치

  // Three.js renderer.render 가 호출될 때마다 extension 실행
  if (typeof renderer !== 'undefined' && renderer) {
    const origRendererRender = renderer.render.bind(renderer);
    renderer.render = function(s, c) {
      origRendererRender(s, c);
    };
  }
})();

// render loop에서 isMoving 감지 — RAF 패치 방식
(function() {
  const originalRender = window.render;
  let _prevTs = 0;
  window.render = function(ts) {
    const dt = Math.min((ts - _prevTs) / 1000, 0.1);
    _prevTs = ts;

    // isMoving 상태를 감지 (WASD 키로 판단)
    isMoving = !dlgOpen && (K['w']||K['W']||K['ArrowUp']||K['s']||K['S']||K['ArrowDown']||K['a']||K['A']||K['d']||K['D']);

    // 기존 render 실행
    originalRender(ts);

    // 새 기능 확장 실행
    if (window._newRenderExtension) window._newRenderExtension(ts, dt);
  };
})();

// ══════════════════════════════════════════════════════
//   🔧 init3D 확장: 달 + 지하철 + 차량 추가
// ══════════════════════════════════════════════════════
// render() 내부에서 !scene 체크 후 init3D()를 직접 호출하는 구조이므로
// scene 생성 후 추가 오브젝트를 삽입하는 방식으로 처리
// (_newRenderExtension에서 scene 준비 여부 확인 후 1회 실행)
let _extraInitDone = false;
function doExtraInit3D() {
  if (_extraInitDone || !scene) return;
  _extraInitDone = true;
  createMoon();
  initSubwayStations();
  initVehicles();
}

// ══════════════════════════════════════════════════════
//   🚇 E키 지하철 우선 처리
// ══════════════════════════════════════════════════════
const _origInteract = interact;
interact = function() {
  if (dlgOpen) { closeDialog(); return; }
  // 지하철역 먼저 체크
  const station = checkSubwayInteract();
  if (station) {
    openSubwayDialog(station);
    return;
  }
  _origInteract();
};

// ══════════════════════════════════════════════════════
//   초기 퀘스트 표시
// ══════════════════════════════════════════════════════
setTimeout(() => updateQuestPanel(), 1500);

// ══════════════════════════════════════════════════════
//   📣 대통령 연설 시스템
// ══════════════════════════════════════════════════════
let speechCooldownTicks = 0;

const SPEECH_TYPES = {
  economy: {
    label: '경제 성장 연설',
    apply() {
      Sim.gdp *= 1.02;
      Sim.approvalRating = Math.min(100, Sim.approvalRating + 5);
      addEventLog('📣 대통령 연설', '경제 성장 연설: GDP +2%, 지지율 +5');
      addNews('📣 대통령, 경제 성장 비전 제시! 국민 반응 긍정적');
    }
  },
  welfare: {
    label: '복지 강화 연설',
    apply() {
      Sim.popHappiness = Math.min(100, Sim.popHappiness + 8);
      Sim.approvalRating = Math.min(100, Sim.approvalRating + 6);
      addEventLog('📣 대통령 연설', '복지 강화 연설: 행복도 +8, 지지율 +6');
      addNews('📣 대통령 복지 확대 약속! 국민 행복도 상승 기대');
    }
  },
  unity: {
    label: '국민 통합 연설',
    apply() {
      Sim.approvalRating = Math.min(100, Sim.approvalRating + 10);
      Sim.citizens.forEach(c => { c.stress = Math.max(0, c.stress - 10); });
      addEventLog('📣 대통령 연설', '국민 통합 연설: 지지율 +10, 전 국민 스트레스 감소');
      addNews('📣 대통령 통합 연설에 국민 뭉클 — 지지율 사상 최고');
    }
  },
  tech: {
    label: '미래 기술 연설',
    apply() {
      Sim.techLevel += 15;
      Sim.gdp *= 1.01;
      Sim.approvalRating = Math.min(100, Sim.approvalRating + 4);
      addEventLog('📣 대통령 연설', '미래 기술 연설: 기술지수 +15, GDP +1%');
      addNews('📣 대통령 AI·우주 기술 비전 선포 — 첨단산업 기대감 상승');
    }
  }
};

window.doSpeech = function(type) {
  if (speechCooldownTicks > 0) {
    showNotice(`⏳ 연설 쿨다운 중입니다. (${speechCooldownTicks}틱 남음)`);
    return;
  }
  const s = SPEECH_TYPES[type];
  if (!s) return;
  s.apply();
  speechCooldownTicks = 3;
  updateSpeechUI();
  updateDashboardData();
  showNotice(`📣 "${s.label}"이 성공적으로 발표되었습니다!`);
};

function updateSpeechUI() {
  const lbl = document.getElementById('speech-cooldown-label');
  if (!lbl) return;
  if (speechCooldownTicks <= 0) {
    lbl.textContent = '준비 완료';
    lbl.style.color = 'var(--green)';
  } else {
    lbl.textContent = `${speechCooldownTicks}틱 후 가능`;
    lbl.style.color = 'var(--gold)';
  }
  document.querySelectorAll('.speech-btn').forEach(btn => {
    btn.disabled = speechCooldownTicks > 0;
  });
}

// ══════════════════════════════════════════════════════
//   🏗️ 국책 사업 시스템
// ══════════════════════════════════════════════════════
const PROJECTS_DB = [
  {
    id: 'proj01', icon: '🚇', name: '하이퍼루프 전국망 건설',
    desc: '수도~전국 주요 도시를 초고속 하이퍼루프로 연결합니다.',
    cost: 800000000, duration: 5,
    reward: '행복도 +10, GDP +3%, 실업률 -1%',
    apply() { Sim.popHappiness = Math.min(100, Sim.popHappiness+10); Sim.gdp*=1.03; Sim.unemploymentRate=Math.max(0,Sim.unemploymentRate-1); }
  },
  {
    id: 'proj02', icon: '🌙', name: '달 기지 1단계 건설',
    desc: '국제 협력을 통해 달 표면에 무인 기지를 건설합니다.',
    cost: 1500000000, duration: 8,
    reward: '우주진척 +25%, 기술지수 +30',
    apply() { Sim.spaceProgress=Math.min(100,Sim.spaceProgress+25); Sim.techLevel+=30; }
  },
  {
    id: 'proj03', icon: '🏥', name: '국립 메가 의료센터 신설',
    desc: '첨단 AI 진단 시스템을 갖춘 초대형 국립 병원을 건설합니다.',
    cost: 600000000, duration: 4,
    reward: '건강도 +12, 행복도 +5',
    apply() { Sim.popHealth=Math.min(100,Sim.popHealth+12); Sim.popHappiness=Math.min(100,Sim.popHappiness+5); }
  },
  {
    id: 'proj04', icon: '☀️', name: '초대형 태양광 발전 단지',
    desc: '사막 지대에 국가 전력의 40%를 공급하는 태양광 단지를 조성합니다.',
    cost: 400000000, duration: 3,
    reward: '에너지충족 +15%, 오염도 -8%',
    apply() { Sim.energyGridRatio=Math.min(100,Sim.energyGridRatio+15); Sim.pollution=Math.max(0,Sim.pollution-8); }
  },
  {
    id: 'proj05', icon: '🎓', name: '네오이현 연구 특구 조성',
    desc: '최첨단 AI·반도체 연구단지를 조성해 글로벌 인재를 유치합니다.',
    cost: 700000000, duration: 6,
    reward: '기술지수 +25, GDP +2%, 실업률 -1.5%',
    apply() { Sim.techLevel+=25; Sim.gdp*=1.02; Sim.unemploymentRate=Math.max(0,Sim.unemploymentRate-1.5); }
  },
  {
    id: 'proj06', icon: '🌿', name: '국가 수직 농업 인프라',
    desc: '도심 고층 수직 농장 네트워크를 구축해 식량 자급률을 높입니다.',
    cost: 300000000, duration: 3,
    reward: '식량자급률 +20%, 행복도 +3',
    apply() { Sim.foodSelfRatio=Math.min(100,Sim.foodSelfRatio+20); Sim.popHappiness=Math.min(100,Sim.popHappiness+3); }
  },
  {
    id: 'proj07', icon: '🏟️', name: '세계 엑스포 유치 & 건설',
    desc: '네오폴리스에서 국제 세계 박람회를 개최합니다.',
    cost: 1200000000, duration: 7,
    reward: '지지율 +15, GDP +5%, 외교관계 전반 +10',
    apply() {
      Sim.approvalRating=Math.min(100,Sim.approvalRating+15);
      Sim.gdp*=1.05;
      Sim.diplomacy.countries.forEach(c=>{c.relation=Math.min(100,c.relation+10);});
    }
  },
  {
    id: 'proj08', icon: '🚀', name: '국산 우주 발사체 개발',
    desc: '완전 자국 기술로 개발한 우주 발사체로 위성을 궤도에 올립니다.',
    cost: 2000000000, duration: 10,
    reward: '우주진척 +30%, 기술지수 +40, 지지율 +8',
    apply() { Sim.spaceProgress=Math.min(100,Sim.spaceProgress+30); Sim.techLevel+=40; Sim.approvalRating=Math.min(100,Sim.approvalRating+8); }
  }
];

// 프로젝트 진행 상태
const projState = {};
PROJECTS_DB.forEach(p => { projState[p.id] = { started: false, done: false, startTick: 0, progress: 0 }; });

window.startProject = function(id) {
  const proj = PROJECTS_DB.find(p => p.id === id);
  if (!proj) return;
  const st = projState[id];
  if (st.started || st.done) return;
  if (Sim.treasury < proj.cost) {
    showNotice(`⚠️ 국고 부족! 필요: ₦${proj.cost.toLocaleString()}`);
    return;
  }
  Sim.treasury -= proj.cost;
  st.started = true;
  st.startTick = Sim.tickCount;
  st.progress = 0;
  addEventLog(`🏗️ 국책 사업 착공`, `"${proj.icon} ${proj.name}" 공사가 시작되었습니다.`);
  addNews(`🏗️ "${proj.name}" 국책 사업 착공 — 완공 시 ${proj.reward}`);
  showNotice(`🏗️ "${proj.name}" 착공! 완공까지 ${proj.duration}틱`);
  updateDashboardData();
};

function tickProjects() {
  if (speechCooldownTicks > 0) {
    speechCooldownTicks--;
    updateSpeechUI();
  }
  PROJECTS_DB.forEach(proj => {
    const st = projState[proj.id];
    if (!st.started || st.done) return;
    const elapsed = Sim.tickCount - st.startTick;
    st.progress = Math.min(100, Math.round((elapsed / proj.duration) * 100));
    if (elapsed >= proj.duration) {
      st.done = true;
      st.started = false;
      proj.apply();
      addEventLog(`✅ 국책 사업 완공`, `"${proj.icon} ${proj.name}" 완공! 효과: ${proj.reward}`);
      addNews(`🎉 "${proj.name}" 완공! — ${proj.reward} 효과 발생`);
      showNotice(`🎉 "${proj.name}" 완공되었습니다!`);
    }
  });
}

function renderProjects() {
  const container = document.getElementById('projects-container');
  if (!container) return;
  container.innerHTML = '';

  let activeCount = 0, doneCount = 0, totalCost = 0;
  let nextFinish = '-';
  let minTick = Infinity;

  PROJECTS_DB.forEach(proj => {
    const st = projState[proj.id];
    if (st.done) { doneCount++; totalCost += proj.cost; }
    if (st.started) {
      activeCount++;
      totalCost += proj.cost;
      const ticksLeft = proj.duration - (Sim.tickCount - st.startTick);
      if (ticksLeft < minTick) { minTick = ticksLeft; nextFinish = `${ticksLeft}틱 후`; }
    }

    const card = document.createElement('div');
    card.className = `proj-card${st.started ? ' in-progress' : st.done ? ' done' : ''}`;
    card.innerHTML = `
      <div class="proj-title">${proj.icon} ${proj.name}${st.done ? ' ✅' : st.started ? ' 🔨' : ''}</div>
      <div class="proj-desc">${proj.desc}</div>
      <div class="proj-cost">💸 투자: ₦${(proj.cost/100000000).toFixed(1)}억 &nbsp;|&nbsp; ⏱️ 기간: ${proj.duration}틱</div>
      <div class="proj-effect">📈 완공 효과: ${proj.reward}</div>
      ${st.started || st.done ? `
        <div class="proj-progress-wrap">
          <div class="proj-progress-fill" style="width:${st.progress}%"></div>
        </div>
        <div style="font-size:10px;color:var(--text-dim);text-align:right">${st.progress}% 완료</div>
      ` : ''}
      <button class="proj-start-btn" onclick="startProject('${proj.id}')"
        ${st.started || st.done ? 'disabled' : ''}>
        ${st.done ? '✅ 완공' : st.started ? `🔨 건설 중 (${proj.duration-(Sim.tickCount-st.startTick)}틱 남음)` : '🏗️ 착공하기'}
      </button>
    `;
    container.appendChild(card);
  });

  const el = id => document.getElementById(id);
  if (el('proj-active-count')) el('proj-active-count').textContent = activeCount + '건';
  if (el('proj-done-count'))   el('proj-done-count').textContent   = doneCount + '건';
  if (el('proj-total-cost'))   el('proj-total-cost').textContent   = `₦${(totalCost/100000000).toFixed(0)}억`;
  if (el('proj-next-finish'))  el('proj-next-finish').textContent  = nextFinish;
}

// ══════════════════════════════════════════════════════
//   🏆 업적 시스템
// ══════════════════════════════════════════════════════
const ACHIEVEMENTS = [
  { id:'ach01', icon:'💰', name:'경제 대국', desc:'GDP ₦1조 달성', check:()=>Sim.gdp>=1000000000000 },
  { id:'ach02', icon:'😊', name:'행복한 나라', desc:'국민 행복도 90% 이상', check:()=>Sim.popHappiness>=90 },
  { id:'ach03', icon:'🏥', name:'건강 국가', desc:'국민 건강도 95% 이상', check:()=>Sim.popHealth>=95 },
  { id:'ach04', icon:'🚔', name:'치안 완벽', desc:'범죄율 0.5% 이하', check:()=>Sim.popCrimeRate<=0.5 },
  { id:'ach05', icon:'🌿', name:'청정 환경', desc:'환경 오염도 5% 이하', check:()=>Sim.pollution<=5 },
  { id:'ach06', icon:'🚀', name:'우주 강국', desc:'우주개발 진척도 50% 이상', check:()=>Sim.spaceProgress>=50 },
  { id:'ach07', icon:'🤖', name:'기술 초강국', desc:'기술 지수 200 이상', check:()=>Sim.techLevel>=200 },
  { id:'ach08', icon:'🏦', name:'튼튼한 국고', desc:'국고 잔고 ₦100억 이상', check:()=>Sim.treasury>=10000000000 },
  { id:'ach09', icon:'🗳️', name:'국민의 대통령', desc:'지지율 80% 이상', check:()=>Sim.approvalRating>=80 },
  { id:'ach10', icon:'🌐', name:'외교 달인', desc:'5개국 모두 관계도 70 이상', check:()=>Sim.diplomacy.countries.every(c=>c.relation>=70) },
  { id:'ach11', icon:'⚡', name:'에너지 독립', desc:'에너지 충족률 100%', check:()=>Sim.energyGridRatio>=100 },
  { id:'ach12', icon:'🍚', name:'식량 자급 완전', desc:'식량 자급률 100%', check:()=>Sim.foodSelfRatio>=100 },
  { id:'ach13', icon:'📜', name:'입법왕', desc:'10개 이상 법률 동시 시행', check:()=>Object.values(lawState).filter(v=>v).length>=10 },
  { id:'ach14', icon:'🏗️', name:'건설의 신', desc:'국책 사업 5개 이상 완공', check:()=>Object.values(projState).filter(s=>s.done).length>=5 },
  { id:'ach15', icon:'👑', name:'완벽한 대통령', desc:'행복도·건강도·지지율 모두 85% 이상', check:()=>Sim.popHappiness>=85&&Sim.popHealth>=85&&Sim.approvalRating>=85 }
];

const achUnlocked = {};
ACHIEVEMENTS.forEach(a => { achUnlocked[a.id] = { unlocked: false, date: null }; });

function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (achUnlocked[ach.id].unlocked) return;
    if (ach.check()) {
      achUnlocked[ach.id].unlocked = true;
      achUnlocked[ach.id].date = `${Sim.year}년 ${Sim.month}월`;
      showNotice(`🏆 업적 달성: "${ach.icon} ${ach.name}"!`);
      addEventLog(`🏆 업적 달성`, `"${ach.icon} ${ach.name}" — ${ach.desc}`);
    }
  });
}

function renderAchievements() {
  const container = document.getElementById('achievements-container');
  if (!container) return;
  container.innerHTML = '';

  let unlockedCount = 0;
  ACHIEVEMENTS.forEach(ach => {
    const st = achUnlocked[ach.id];
    if (st.unlocked) unlockedCount++;

    const card = document.createElement('div');
    card.className = `ach-card ${st.unlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="ach-icon">${ach.icon}</div>
      <div class="ach-name">${ach.name}</div>
      <div class="ach-desc">${ach.desc}</div>
      ${st.unlocked ? `<div class="ach-date">✅ ${st.date} 달성</div>` : '<div class="ach-desc" style="color:rgba(255,255,255,0.2)">🔒 미달성</div>'}
    `;
    container.appendChild(card);
  });

  const cnt = document.getElementById('ach-count');
  const tot = document.getElementById('ach-total');
  if (cnt) cnt.textContent = unlockedCount;
  if (tot) tot.textContent = ACHIEVEMENTS.length;
}

// ── 기존 updateDashboardData 확장 ──
const _origUpdateDashboard = updateDashboardData;
updateDashboardData = function() {
  _origUpdateDashboard();
  if (!isDashboardOpen) return;
  if (currentTab === 'projects') renderProjects();
  if (currentTab === 'achievements') renderAchievements();
};

// ── 기존 Sim.tick 확장: 프로젝트 틱 + 업적 체크 ──
const _origSimTick = Sim.tick.bind(Sim);
Sim.tick = function() {
  _origSimTick();
  tickProjects();
  checkAchievements();
};

// ══════════════════════════════════════════════════════
//  🌿 월드 디테일: 지형 / 흙 / 도로 / 학교 / 나무
// ══════════════════════════════════════════════════════
function initWorldDetails() {
  if (!scene) return;

  // ── 재료 ──
  const grassMat    = new THREE.MeshStandardMaterial({ color: 0x2a6010, roughness: 0.95 });
  const soilMat     = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1.0 });
  const trunkMat    = new THREE.MeshStandardMaterial({ color: 0x4a2e0a, roughness: 1.0 });
  const leavesMat   = new THREE.MeshStandardMaterial({ color: 0x1e7a12, roughness: 0.8, emissive: 0x0a3a05, emissiveIntensity: 0.25 });
  const curbMat     = new THREE.MeshStandardMaterial({ color: 0x8888aa, roughness: 0.85 });
  const markMat     = new THREE.MeshBasicMaterial({ color: 0xffee33 });
  const whiteMarkM  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const playGndMat  = new THREE.MeshStandardMaterial({ color: 0xe0c87a, roughness: 0.95 });
  const sportsMat   = new THREE.MeshStandardMaterial({ color: 0x185c18, roughness: 0.9 });
  const fenceMat    = new THREE.MeshStandardMaterial({ color: 0x99aabb, metalness: 0.4, roughness: 0.6 });
  const towerMat    = new THREE.MeshStandardMaterial({ color: 0x334466, emissive: 0x112244, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.3 });
  const roofMat     = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.7 });
  const poleMat     = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  const flagTex     = new THREE.TextureLoader().load('neopolis_flag.jpg');
  const flagMat     = new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.6 });

  const planeH = new THREE.PlaneGeometry(0.95, 0.95);
  planeH.rotateX(-Math.PI / 2);

  // ── 1. 풀밭 — 에코 파크 (type 9) ──
  for (let y = 2; y < MH - 2; y++) {
    for (let x = 2; x < MW - 2; x++) {
      if (MAP[y][x] !== 9) continue;
      const m = new THREE.Mesh(planeH, grassMat);
      m.position.set(x + 0.5, 0.007, y + 0.5);
      scene.add(m);
    }
  }

  // ── 2. 흙 — 외곽 도로 타일 (반지름 > 24) ──
  const soilGeo = new THREE.PlaneGeometry(0.88, 0.88);
  soilGeo.rotateX(-Math.PI / 2);
  for (let y = 2; y < MH - 2; y++) {
    for (let x = 2; x < MW - 2; x++) {
      if (MAP[y][x] !== 0) continue;
      const r = Math.sqrt((x - MCX) ** 2 + (y - MCY) ** 2);
      if (r < 24) continue;
      const m = new THREE.Mesh(soilGeo, soilMat);
      m.position.set(x + 0.5, 0.004, y + 0.5);
      scene.add(m);
    }
  }

  // ── 3. 도로 연석 (curb) — 도로와 건물 경계 ──
  const curbSide = new THREE.BoxGeometry(0.88, 0.07, 0.10);
  const curbFwd  = new THREE.BoxGeometry(0.10, 0.07, 0.88);
  for (let y = 8; y < 56; y++) {
    for (let x = 8; x < 56; x++) {
      if (MAP[y][x] !== 0) continue;
      const r = Math.sqrt((x - MCX) ** 2 + (y - MCY) ** 2);
      if (r > 23) continue;

      const check = (bx, by, geoFn, ox, oz) => {
        if (MAP[by]?.[bx] > 0) {
          const m = new THREE.Mesh(geoFn(), curbMat);
          m.position.set(x + 0.5 + ox, 0.035, y + 0.5 + oz);
          scene.add(m);
        }
      };
      check(x + 1, y, () => new THREE.BoxGeometry(0.10, 0.07, 0.88),  0.45, 0);
      check(x - 1, y, () => new THREE.BoxGeometry(0.10, 0.07, 0.88), -0.45, 0);
      check(x, y + 1, () => new THREE.BoxGeometry(0.88, 0.07, 0.10), 0,  0.45);
      check(x, y - 1, () => new THREE.BoxGeometry(0.88, 0.07, 0.10), 0, -0.45);
    }
  }

  // ── 4. 도로 중앙선 — 주요 도로 황색 점선 ──
  const dashH = new THREE.BoxGeometry(0.06, 0.005, 0.36);
  const dashV = new THREE.BoxGeometry(0.36, 0.005, 0.06);
  for (let y = 4; y < MH - 4; y++) {
    for (let x = 4; x < MW - 4; x++) {
      if (MAP[y][x] !== 0) continue;
      const isMainX = x % 7 === 0 || x % 7 === 1;
      const isMainY = y % 7 === 0 || y % 7 === 1;
      if (isMainX && y % 2 === 0) {
        const m = new THREE.Mesh(dashH, markMat);
        m.position.set(x + 0.5, 0.009, y + 0.5);
        scene.add(m);
      }
      if (isMainY && x % 2 === 0) {
        const m = new THREE.Mesh(dashV, markMat);
        m.position.set(x + 0.5, 0.009, y + 0.5);
        scene.add(m);
      }
    }
  }

  // 흰색 횡단보도 — 링 도로와 메인 교차점
  const cwGeo = new THREE.BoxGeometry(0.15, 0.005, 0.7);
  for (let y = 4; y < MH - 4; y++) {
    for (let x = 4; x < MW - 4; x++) {
      if (MAP[y][x] !== 0) continue;
      const r = Math.abs(Math.sqrt((x - MCX)**2 + (y - MCY)**2) - 13);
      const isMainX = x % 7 === 0 || x % 7 === 1;
      const isMainY = y % 7 === 0 || y % 7 === 1;
      if (r < 1.5 && (isMainX || isMainY) && x % 3 === 0) {
        const m = new THREE.Mesh(cwGeo, whiteMarkM);
        m.position.set(x + 0.5, 0.009, y + 0.5);
        scene.add(m);
      }
    }
  }

  // ── 5. 나무 — 에코 파크 ──
  const treeTiles = [];
  for (let y = 2; y < MH - 2; y++)
    for (let x = 2; x < MW - 2; x++)
      if (MAP[y][x] === 9) treeTiles.push({ x, y });

  treeTiles.sort(() => Math.random() - 0.5).slice(0, 30).forEach(pos => {
    const px = pos.x + 0.15 + Math.random() * 0.7;
    const pz = pos.y + 0.15 + Math.random() * 0.7;
    const scale = 0.7 + Math.random() * 0.8;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.45 * scale, 6), trunkMat);
    trunk.position.set(px, 0.225 * scale, pz);
    scene.add(trunk);

    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.30 * scale, 0.72 * scale, 7), leavesMat);
    bot.position.set(px, 0.62 * scale, pz);
    scene.add(bot);

    const top = new THREE.Mesh(new THREE.ConeGeometry(0.20 * scale, 0.55 * scale, 7), leavesMat);
    top.position.set(px, 0.98 * scale, pz);
    scene.add(top);
  });

  // ── 6. 학교 단지 디테일 — NNU (tx:22, ty:22) ──
  const sx = 23, sz = 23;                     // 학교 중심
  const bldDist = Math.sqrt((22 - MCX)**2 + (22 - MCY)**2);
  const bh = Math.max(1, Math.min(3, 3 - bldDist / 10));
  const roofY = bh * 4.0;

  // 운동장 바닥
  const pgGeo = new THREE.PlaneGeometry(3.2, 2.4);
  pgGeo.rotateX(-Math.PI / 2);
  const pg = new THREE.Mesh(pgGeo, playGndMat);
  pg.position.set(sx, 0.008, sz - 3.8);
  scene.add(pg);

  // 농구 코트 라인
  const ctH = new THREE.BoxGeometry(2.9, 0.006, 0.04);
  const ctV = new THREE.BoxGeometry(0.04, 0.006, 2.0);
  [-1.1, 0, 1.1].forEach(off => {
    const m = new THREE.Mesh(ctH, whiteMarkM); m.position.set(sx, 0.011, sz - 3.8 + off); scene.add(m);
  });
  [-1.45, 0, 1.45].forEach(off => {
    const m = new THREE.Mesh(ctV, whiteMarkM); m.position.set(sx + off, 0.011, sz - 3.8); scene.add(m);
  });

  // 잔디 구역
  const sportsGeo = new THREE.PlaneGeometry(2.6, 1.6);
  sportsGeo.rotateX(-Math.PI / 2);
  const sportsField = new THREE.Mesh(sportsGeo, sportsMat);
  sportsField.position.set(sx, 0.009, sz - 6.8);
  scene.add(sportsField);

  // 울타리
  const fpGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
  const frGeo = new THREE.BoxGeometry(6.0, 0.04, 0.04);
  for (let i = 0; i <= 12; i++) {
    const fp = new THREE.Mesh(fpGeo, fenceMat);
    fp.position.set(sx - 3 + i * 0.5, 0.275, sz - 5.2);
    scene.add(fp);
  }
  const fr = new THREE.Mesh(frGeo, fenceMat);
  fr.position.set(sx, 0.46, sz - 5.2);
  scene.add(fr);

  // 깃대
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.03, 2.6, 8);
  const flagpole = new THREE.Mesh(poleGeo, poleMat);
  flagpole.position.set(sx + 1.8, 1.3, sz + 0.2);
  scene.add(flagpole);
  const fg = new THREE.BoxGeometry(0.55, 0.32, 0.02);
  const flag = new THREE.Mesh(fg, flagMat);
  flag.position.set(sx + 2.08, 2.44, sz + 0.2);
  scene.add(flag);

  // 시계탑
  const towerGeo = new THREE.BoxGeometry(0.7, 0.9, 0.7);
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(sx, roofY + 0.45, sz);
  scene.add(tower);

  // 뾰족 지붕
  const peakGeo = new THREE.ConeGeometry(0.55, 0.7, 4);
  const peak = new THREE.Mesh(peakGeo, roofMat);
  peak.position.set(sx, roofY + 1.25, sz);
  peak.rotation.y = Math.PI / 4;
  scene.add(peak);

  // 학교 앞 나무 4그루
  [[sx - 1.4, sz + 0.4], [sx + 2.4, sz + 0.4], [sx - 1.4, sz - 1.4], [sx + 2.4, sz - 1.4]].forEach(([tx2, tz2]) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 6), trunkMat);
    t.position.set(tx2, 0.275, tz2);
    scene.add(t);
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 7), leavesMat);
    l.position.set(tx2, 0.85, tz2);
    scene.add(l);
  });

  // ── 7. 가로등 (3D Streetlights) 배치 ──
  streetlights = [];
  const streetlightPositions = [
    [32.5, 26.5], [32.5, 37.5], [26.5, 32.5], [38.5, 32.5],
    [29.5, 29.5], [35.5, 29.5], [29.5, 35.5], [35.5, 35.5],
    [22.5, 32.5], [42.5, 32.5], [32.5, 22.5], [32.5, 42.5],
    [25.5, 25.5], [39.5, 25.5], [25.5, 39.5], [39.5, 39.5]
  ];

  const stPoleGeo = new THREE.CylinderGeometry(0.02, 0.025, 1.8, 8);
  const stPoleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
  const stLampGeo = new THREE.BoxGeometry(0.12, 0.08, 0.35);
  const stLampMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  
  streetlightPositions.forEach(([sx, sz]) => {
    const group = new THREE.Group();
    group.position.set(sx, 0, sz);

    // 가로등 기둥
    const pole = new THREE.Mesh(stPoleGeo, stPoleMat);
    pole.position.y = 0.9;
    group.add(pole);

    // 가로등 전등갓
    const lamp = new THREE.Mesh(stLampGeo, stLampMat);
    lamp.position.set(0, 1.8, 0.15);
    group.add(lamp);

    // 가로등 전구 (빛나는 연출)
    const bulbGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0, 1.76, 0.25);
    group.add(bulb);

    // 실제 포인트라이트 조명
    const pl = new THREE.PointLight(0xffea00, 0, 8, 2);
    pl.position.set(0, 1.7, 0.25);
    group.add(pl);

    scene.add(group);

    streetlights.push({ pl, bulb, group });
  });
}

// doExtraInit3D에 월드 디테일 연결 (한 번만 실행)
let _worldDetailsDone = false;
const _origDoExtra = doExtraInit3D;
window.doExtraInit3D = function() {
  _origDoExtra();
  if (!_worldDetailsDone && scene) {
    _worldDetailsDone = true;
    initWorldDetails();
  }
};

// ═══════════════════════════════════════════════════════════════
//  🗺️ 네오폴리스 공식 도시계획 지도 — MAP 완전 재설계
//  원형 방사형 도로 + 환형 도로 + 28개 지구 반영
// ═══════════════════════════════════════════════════════════════
(function applyNeopholisOfficialMap() {

  // ── 새 MAP 생성 ──
  for (let y = 0; y < MH; y++) {
    MAP[y] = [];
    for (let x = 0; x < MW; x++) {
      const dx = x - MCX, dy = y - MCY;
      const r  = Math.sqrt(dx * dx + dy * dy);
      const a  = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360; // 0=North CW

      // 외곽 (도시 밖)
      if (r > 28) { MAP[y][x] = 0; continue; }

      // 중앙 광장 (열린 공간)
      if (r < 2.5) { MAP[y][x] = 0; continue; }

      // 환형 도로 6개
      if (
        Math.abs(r -  4.8) < 0.7 ||
        Math.abs(r -  9.2) < 0.8 ||
        Math.abs(r - 14.8) < 0.9 ||
        Math.abs(r - 20.5) < 1.0 ||
        Math.abs(r - 25.5) < 1.0
      ) { MAP[y][x] = 0; continue; }

      // 주요 방사형 도로 (8방향, 45°마다)
      const mod8  = a % 45;
      const wMain = r < 5 ? 2.4 : r < 15 ? 1.8 : 1.3;
      if (mod8 < wMain || mod8 > 45 - wMain) { MAP[y][x] = 0; continue; }

      // 보조 방사형 도로 (16방향, r>9 구간만)
      if (r > 9) {
        const mod16 = a % 22.5;
        if (mod16 < 0.9 || mod16 > 21.6) { MAP[y][x] = 0; continue; }
      }

      // 지구 배정 — 8방위 × 5 반경 구간
      const sec = Math.floor((a + 22.5) / 45) % 8;
      // sec: 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW

      let t;
      if (r < 4.8) {
        // 핵심 중심부: 정부+파이낸스+테크노
        t = [1, 2, 3, 4, 2, 1, 4, 7][sec];
      } else if (r < 9.2) {
        // 내부 도심
        // N=에코파크 NE=파이낸스 E=비즈니스 SE=테크노밸리 S=상업 SW=올드타운 W=미디어 NW=주거
        t = [9, 2, 3, 4, 5, 6, 7, 8][sec];
      } else if (r < 14.8) {
        // 중간 도심
        // N=에코파크 NE=주거 E=비즈니스 SE=테크노 S=상업 SW=올드타운 W=병원 NW=교육
        t = [9, 8, 3, 4, 5, 6, 10, 11][sec];
      } else if (r < 20.5) {
        // 외곽 도시
        // N=에코(고급주거) NE=주거 E=비즈니스/군민 SE=공공서비스 S=산업/물류 SW=올드타운 W=스포츠 NW=녹지벨트
        t = [9, 8, 3, 10, 5, 6, 12, 9][sec];
      } else {
        // 최외곽 (r 20-28)
        // N=에코 NE=주거(신도시) E=주거 SE=연구 S=물류/에너지 SW=공원 W=스포츠 NW=에코
        t = [9, 8, 8, 4, 5, 6, 12, 9][sec];
      }

      MAP[y][x] = t;
    }
  }

  // ── BINFO 업데이트 (공식 지구명 반영) ──
  Object.assign(BINFO, {
    1:  { name: '🏛️ 정부 종합청사',       acc: [160,  80, 255], base: [30, 10, 60] },
    2:  { name: '🏦 파이낸스 지구',       acc: [255, 200,  50], base: [70, 50,  8] },
    3:  { name: '🏢 비즈니스 지구',       acc: [  0, 180, 255], base: [ 8, 28, 75] },
    4:  { name: '💻 테크노 밸리',         acc: [  0, 230, 220], base: [ 6, 50, 55] },
    5:  { name: '🛍️ 상업 지구',          acc: [255, 110,  40], base: [70, 22,  8] },
    6:  { name: '🏘️ 올드타운',           acc: [210, 160,  80], base: [52, 33,  8] },
    7:  { name: '🎬 미디어&문화 지구',    acc: [200,  60, 255], base: [42,  8, 65] },
    8:  { name: '🏠 주거 단지',           acc: [100, 130, 255], base: [16, 20, 55] },
    9:  { name: '🌿 에코 파크 지구',      acc: [ 50, 220,  70], base: [ 8, 42, 12] },
    10: { name: '🏥 병원 지구',           acc: [  0, 220, 180], base: [ 8, 42, 38] },
    11: { name: '🎓 교육 지구',           acc: [ 80, 210, 100], base: [10, 42, 20] },
    12: { name: '🏟️ 스포츠 & 엔터',      acc: [255,  50,  50], base: [62, 10, 10] },
  });

  // ── 인터랙티브 건물 위치 재배치 ──
  const newBLDS = [
    // 핵심 중심부 (r < 4.8)
    { tx:33, ty:27, w:3, h:3, type:1, name:'🏛️ 정부 종합청사',
      greet:'네오폴리스 정부 종합청사입니다.\n대통령 집무실과 국무회의실이 있습니다.',
      items:[{ label:'국무회의 참관 (무료)', fn: p => { p.happy = cap(p.happy+5); return '국무회의를 참관했습니다!' }}]},

    { tx:35, ty:28, w:3, h:3, type:2, name:'🏦 국제금융센터 (NPX)',
      greet:'NPX 국제금융센터입니다.\n파이낸스 지구 심장부입니다.',
      items:[
        { label:'₦100,000 출금',    fn: p => { p.money += 100000; return '₦100,000 출금 완료!' }},
        { label:'주가 확인 (무료)', fn: p => { p.happy = cap(p.happy+3); return 'NPX 지수: 3,248 (+1.2%) 강세!' }},
      ]},

    { tx:36, ty:32, w:3, h:3, type:3, name:'🏢 대기업 본사',
      greet:'비즈니스 지구 본사입니다.',
      items:[
        { label:'대기업 구직 신청', fn: p => {
          if (p.diploma === '고등학교 졸업') {
            return '❌ 서류 탈락: 대기업 신입 입사는 [대학교 학사] 이상의 학위가 필요합니다!';
          } else if (p.diploma === '대학교 학사') {
            p.money += 90000;
            p.happy = cap(p.happy + 15);
            return '💼 대기업 입사 성공! 초임 보너스 ₦90,000 지급!';
          } else {
            p.money += 150000;
            p.happy = cap(p.happy + 25);
            return '🚀 석/박사 우대 채용 성공! 핵심 선임 연구원 보너스 ₦150,000 지급!';
          }
        }},
      ]},

    { tx:35, ty:36, w:3, h:3, type:4, name:'💻 AI 연구소 (테크노 밸리)',
      greet:'네오폴리스 AI 연구소입니다.\n미래 기술 혁신의 중심입니다.',
      items:[
        { label:'AI 수석 연구원 지원', fn: p => {
          if (p.diploma !== '대학원 석사/박사') {
            return '❌ 지원 거절: 수석 연구원은 [대학원 석사/박사] 학위가 필요합니다!';
          }
          p.money += 200000;
          p.happy = cap(p.happy + 30);
          return '🤖 AI 수석 연구원 채용 성공! 사이닝 보너스 ₦200,000 지급!';
        }},
        { label:'AI 특강 수료 (₦10,000)', fn: p => { p.money -= 10000; p.happy = cap(p.happy+10); return 'AI 기술 특강 수료!' }},
      ]},

    // 중간 도심 (r 9-15)
    { tx:32, ty:43, w:3, h:3, type:5, name:'🛍️ 상업 지구 쇼핑몰',
      greet:'네오폴리스 중심 쇼핑몰입니다.',
      items:[
        { label:'쇼핑 (₦30,000)',    fn: p => { p.money -= 30000; p.happy = cap(p.happy+15); return '쇼핑 완료!' }},
        { label:'음식점 (₦5,000)',   fn: p => { p.money -= 5000;  p.hungry = cap(p.hungry+30); return '맛있게 먹었습니다!' }},
      ]},

    { tx:24, ty:40, w:3, h:3, type:6, name:'🏘️ 올드타운 광장',
      greet:'네오폴리스 올드타운입니다.\n역사와 전통의 거리입니다.',
      items:[
        { label:'골동품 구경 (무료)', fn: p => { p.happy = cap(p.happy+8); return '역사적 예술품 감상!' }},
      ]},

    { tx:28, ty:29, w:3, h:3, type:7, name:'🎬 NBC 미디어 타워',
      greet:'미디어&문화 지구 NBC 타워입니다.',
      items:[
        { label:'영화 관람 (₦8,000)', fn: p => { p.money -= 8000; p.happy = cap(p.happy+20); return '블록버스터 관람!' }},
      ]},

    { tx:40, ty:24, w:3, h:3, type:8, name:'🏠 신도시 주거 단지',
      greet:'신도시 스마트 주거 단지입니다.',
      items:[
        { label:'아파트 분양 정보 (무료)', fn: p => { p.happy = cap(p.happy+3); return '분양 안내 확인 완료!' }},
      ]},

    { tx:32, ty:21, w:3, h:3, type:9, name:'🌿 에코 파크',
      greet:'네오폴리스 에코 파크 지구입니다.\n자연 연구소·공원·탄소흡수 숲이 있습니다.',
      items:[
        { label:'자연 산책 (무료)', fn: p => { p.happy = cap(p.happy+15); p.tired = Math.max(0, (p.tired||0)-20); return '자연 속 힐링!' }},
      ]},

    { tx:21, ty:32, w:3, h:3, type:10, name:'🏥 네오폴리스 종합병원',
      greet:'네오폴리스 병원 지구 종합병원입니다.',
      items:[
        { label:'건강검진 (₦20,000)', fn: p => { p.money -= 20000; p.health = cap(p.health+40); return '건강검진 완료! 건강 +40' }},
        { label:'응급처치 (무료)',     fn: p => { p.health = cap(p.health+15); return '응급처치 완료!' }},
      ]},

    { tx:24, ty:24, w:3, h:3, type:11, name:'🎓 네오리아 국립대 (NNU)',
      greet:'네오리아 국립대학교입니다.\n교육 지구 최고 학문 기관입니다.',
      items:[
        { label:'특별 강의 수강 (₦15,000)', fn: p => { p.money -= 15000; p.happy = cap(p.happy+12); return '강의 수료!' }},
      ]},

    { tx:28, ty:20, w:3, h:3, type:11, name:'🏫 네오 코딩 학원',
      greet:'네오폴리스 명문 IT 전문 학원입니다.\n체계적인 프로그래밍 강의로 지식을 빠르게 높일 수 있습니다.',
      items:[
        { label:'속성 코딩 부트캠프 (₦20,000)', fn: p => {
          if (p.money < 20000) return '❌ 수강료(₦20,000)가 부족합니다!';
          p.money -= 20000;
          p.knowledge = cap(p.knowledge + 20);
          p.happy = cap(p.happy - 5);
          p.energy = cap(p.energy - 15);
          return '💻 코딩 부트캠프 수강 완료! 지식 +20, 기력 -15, 행복도 -5';
        }},
        { label:'IT 자격증 대비반 (₦8,000)', fn: p => {
          if (p.money < 8000) return '❌ 수강료(₦8,000)가 부족합니다!';
          p.money -= 8000;
          p.knowledge = cap(p.knowledge + 8);
          p.energy = cap(p.energy - 8);
          return '📚 자격증 특강 수강 완료! 지식 +8, 기력 -8';
        }}
      ]},

    { tx:14, ty:32, w:3, h:3, type:12, name:'🏟️ 스포츠 & 엔터테인먼트',
      greet:'스포츠 & 엔터테인먼트 단지입니다.\n대형 경기장·실내 수영장·영화관 완비.',
      items:[
        { label:'경기 관람 (₦12,000)', fn: p => { p.money -= 12000; p.happy = cap(p.happy+25); return '박진감 넘치는 경기!' }},
        { label:'수영 (₦5,000)',       fn: p => { p.money -= 5000; p.happy = cap(p.happy+12); return '수영 완료! 개운하다!' }},
      ]},
  ];

  BLDS.length = 0;
  newBLDS.forEach(b => BLDS.push(b));

})();

// ═══════════════════════════════════════════════════════════════
//  🏢 11. 건물 내부 (Interior) 및 엘리베이터/계단/공부 시스템
// ═══════════════════════════════════════════════════════════════

let interiorGroup = null;
let interiorProps = [];

function initInteriorEngine() {
  interiorGroup = new THREE.Group();
  scene.add(interiorGroup);
}



// Elevator arrive sound using existing Web Audio API
function playElevatorDing() {
  if (typeof audioCtx === 'undefined' || !audioCtx || (typeof isMuted !== 'undefined' && isMuted)) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.6);
  } catch(e) {}
}

function enterBuilding(b) {
  P.isInterior = true;
  P.currentInterior = b;
  P.currentFloor = 1;
  
  P.prevCityX = P.x;
  P.prevCityY = P.y;
  
  P.x = 32.5;
  P.y = 32.5;
  if (playerGroup) {
    playerGroup.position.set(P.x, 0, P.y);
  }
  cameraYaw = -Math.PI / 2;
  cameraPitch = 0.15;
  
  toggleCityVisibility(false);
  buildInteriorScene();
  
  document.getElementById('interior-hud').style.display = 'flex';
  document.getElementById('interior-name').textContent = b.name;
  updateInteriorHUD();
  
  closeDialog();
  playElevatorDing();
  showNotice(`🏢 ${b.name} 안으로 입장했습니다.`);
}
window.enterBuilding = enterBuilding;

function exitCurrentBuilding() {
  if (!P.isInterior) return;
  P.isInterior = false;
  
  toggleCityVisibility(true);
  clearInteriorScene();
  
  document.getElementById('interior-hud').style.display = 'none';
  document.getElementById('elevator-modal').style.display = 'none';
  document.getElementById('study-modal').style.display = 'none';
  
  P.x = P.prevCityX || 32.5;
  P.y = P.prevCityY || 32.5;
  if (playerGroup) {
    playerGroup.position.set(P.x, 0, P.y);
  }
  
  showNotice('🚪 건물 밖으로 나왔습니다.');
  updateHUD();
}
window.exitCurrentBuilding = exitCurrentBuilding;

function toggleCityVisibility(visible) {
  scene.children.forEach(child => {
    if (child === playerGroup || child === ambientLight || child === dirLight || child === hemiLight || child === skyDome || child === starGroup || child === rainParticles || child === interiorGroup) {
      return;
    }
    child.visible = visible;
  });
}

function clearInteriorScene() {
  if (!interiorGroup) return;
  while (interiorGroup.children.length > 0) {
    const obj = interiorGroup.children[0];
    interiorGroup.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }
  interiorProps = [];
}

function buildInteriorScene() {
  clearInteriorScene();
  if (!P.isInterior) return;
  
  const bType = P.currentInterior.type;
  const floorNum = P.currentFloor;
  
  let floorColor = 0x3e2723; 
  let wallColor = 0x8d6e63;
  
  if (bType === 11) { 
    floorColor = 0x455a64;
    wallColor = 0x78909c;
  } else if ([1, 2, 3, 4].includes(bType)) { 
    floorColor = 0x263238;
    wallColor = 0x455a64;
  } else if (bType === 5) { 
    floorColor = 0xbcaaa4;
    wallColor = 0xd7ccc8;
  } else if (bType === 10) { 
    floorColor = 0xb2dfdb;
    wallColor = 0xe0f2f1;
  }
  
  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
  const floorGeo = new THREE.PlaneGeometry(9, 9);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(32.5, 0.005, 32.5);
  floorMesh.receiveShadow = true;
  interiorGroup.add(floorMesh);
  
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
  
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3, 0.2), wallMat);
  backWall.position.set(32.5, 1.5, 28);
  interiorGroup.add(backWall);
  
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 9.2), wallMat);
  leftWall.position.set(28, 1.5, 32.5);
  interiorGroup.add(leftWall);
  
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 9.2), wallMat);
  rightWall.position.set(37, 1.5, 32.5);
  interiorGroup.add(rightWall);
  
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3, 0.2), wallMat);
  frontWall.position.set(32.5, 1.5, 37);
  interiorGroup.add(frontWall);
  
  const light = new THREE.PointLight(0xffffff, 0.9, 15);
  light.position.set(32.5, 2.5, 32.5);
  interiorGroup.add(light);
  
  const elMat = new THREE.MeshStandardMaterial({ color: 0x112233, metalness: 0.9, roughness: 0.1 });
  const elDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), elMat);
  elDoor.position.set(30, 1.1, 28.1);
  interiorGroup.add(elDoor);
  
  const elGlow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  elGlow.position.set(30, 2.3, 28.15);
  interiorGroup.add(elGlow);
  
  interiorProps.push({
    name: '🛗 엘리베이터 조작반',
    x: 30, z: 29.2, dist: 1.5,
    action: () => openElevatorModal()
  });
  
  const stairDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 }));
  stairDoor.position.set(35, 1.1, 28.1);
  interiorGroup.add(stairDoor);
  
  const stGlow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
  stGlow.position.set(35, 2.3, 28.15);
  interiorGroup.add(stGlow);
  
  interiorProps.push({
    name: '🪜 비상 계단 통로',
    x: 35, z: 29.2, dist: 1.5,
    action: () => {
      showNotice('비상 계단입니다. HUD 패널의 위/아래 버튼을 이용하세요.');
    }
  });

  if (bType === 8) {
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    bedFrame.position.set(29.5, 0.2, 34.5);
    interiorGroup.add(bedFrame);
    
    const bedSheet = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 2.3), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }));
    bedSheet.position.set(29.5, 0.45, 34.55);
    interiorGroup.add(bedSheet);
    
    interiorProps.push({
      name: '🛌 침대 (수면)',
      x: 29.5, z: 34.5, dist: 1.6,
      action: () => sleepInBed()
    });
    
    const tvBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }));
    tvBox.position.set(32.5, 1.2, 28.3);
    interiorGroup.add(tvBox);
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: 0x0a1424 }));
    tvScreen.position.set(32.5, 1.2, 28.4);
    interiorGroup.add(tvScreen);
    
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x1e88e5 }));
    sofa.position.set(32.5, 0.3, 33.5);
    interiorGroup.add(sofa);
    
    interiorProps.push({
      name: '📺 TV & 소파 (휴식)',
      x: 32.5, z: 33.5, dist: 1.6,
      action: () => watchTV()
    });
    
    const fridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.8), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.6 }));
    fridge.position.set(35.5, 1.0, 34.5);
    interiorGroup.add(fridge);
    
    interiorProps.push({
      name: '🍳 주방/냉장고 (식사)',
      x: 35.5, z: 34.5, dist: 1.5,
      action: () => cookFood()
    });
    
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.8), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    desk.position.set(35.5, 0.375, 30.5);
    interiorGroup.add(desk);
    
    const pc = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    pc.position.set(35.5, 0.95, 30.4);
    interiorGroup.add(pc);
    
    interiorProps.push({
      name: '💻 책상/컴퓨터 (공부)',
      x: 35.5, z: 30.5, dist: 1.5,
      action: () => useComputer()
    });
    
    const bathBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.4 }));
    bathBox.position.set(29.5, 1.1, 30.5);
    interiorGroup.add(bathBox);
    
    interiorProps.push({
      name: '🚿 욕실 (샤워)',
      x: 29.5, z: 30.5, dist: 1.5,
      action: () => takeShower()
    });

    // 🪴 [추가] 고급 인테리어 소품 (화분)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x795548 }));
    pot.position.set(35.5, 0.2, 29.5);
    interiorGroup.add(pot);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 }));
    leaf.position.set(35.5, 0.7, 29.5);
    interiorGroup.add(leaf);

    // 🛋️ [추가] 고급 카펫 (소파 밑 러그)
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 1.0 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(32.5, 0.01, 33.5);
    interiorGroup.add(rug);

    // 💡 [추가] 침대 옆 스탠드 조명 (Lamp)
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 }));
    lampPole.position.set(31.0, 0.7, 35.5);
    interiorGroup.add(lampPole);
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff3e0 }));
    lampShade.position.set(31.0, 1.4, 35.5);
    interiorGroup.add(lampShade);
    const lampLight = new THREE.PointLight(0xffb300, 0.6, 5);
    lampLight.position.set(31.0, 1.4, 35.5);
    interiorGroup.add(lampLight);

    // 🚪 [추가] 안락한 욕실 벽체 파티션
    const partition = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 2.5), wallMat);
    partition.position.set(31.0, 1.5, 30.5);
    interiorGroup.add(partition);
    
  } else if (bType === 11) {
    if (floorNum === 1) {
      for (let i = -1.5; i <= 1.5; i += 1.5) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
        shelf.position.set(29.5, 1.1, 32.5 + i);
        interiorGroup.add(shelf);
      }
      
      const studyTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.2), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
      studyTable.position.set(34.5, 0.375, 32.5);
      interiorGroup.add(studyTable);
      
      interiorProps.push({
        name: '📖 도서관 독서대 (공부)',
        x: 34.5, z: 32.5, dist: 1.8,
        action: () => openStudyModal('도서관 열람실')
      });
      
    } else {
      const board = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.7 }));
      board.position.set(32.5, 1.5, 28.2);
      interiorGroup.add(board);
      
      for (let rx = 31.0; rx <= 34.0; rx += 3.0) {
        for (let rz = 31.0; rz <= 34.0; rz += 3.0) {
          const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.7), new THREE.MeshStandardMaterial({ color: 0xafb42b }));
          desk.position.set(rx, 0.375, rz);
          interiorGroup.add(desk);
        }
      }
      
      interiorProps.push({
        name: '📚 교실 책상 (공부)',
        x: 32.5, z: 32.5, dist: 2.2,
        action: () => openStudyModal('2학년 A반 교실')
      });

      // 🏫 [추가] 교실 게시판 (Notice Board)
      const noticeBoard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 3.0), new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 }));
      noticeBoard.position.set(28.1, 1.5, 32.5);
      interiorGroup.add(noticeBoard);

      // 🪴 [추가] 교실 모퉁이 화분
      const schoolPot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x616161 }));
      schoolPot.position.set(35.5, 0.2, 35.5);
      interiorGroup.add(schoolPot);
      const schoolLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1b5e20 }));
      schoolLeaf.position.set(35.5, 0.55, 35.5);
      interiorGroup.add(schoolLeaf);
    }
  } else if (bType === 1) {
    const officeDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.5 }));
    officeDesk.position.set(32.5, 0.4, 30.5);
    interiorGroup.add(officeDesk);
    
    interiorProps.push({
      name: '🏛&nbsp;대통령 집무 데스크',
      x: 32.5, z: 30.5, dist: 1.8,
      action: () => {
        showNotice('대통령 집무실 모니터링 콘솔입니다.');
        toggleDashboard(true);
      }
    });

    // 🇰🇷 [추가] 국기대 및 백그라운드 네오폴리스 공화국 국기 메시
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9 }));
    flagPole.position.set(31.0, 1.1, 28.5);
    interiorGroup.add(flagPole);
    const inFlagTex = new THREE.TextureLoader().load('neopolis_flag.jpg');
    const flagFabric = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.02), new THREE.MeshStandardMaterial({ map: inFlagTex, roughness: 0.6 }));
    flagFabric.position.set(31.3, 1.9, 28.5);
    interiorGroup.add(flagFabric);

    // 🛋️ [추가] 국무 대기용 대형 소파
    const waitingSofa = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a237e }));
    waitingSofa.position.set(35.5, 0.25, 33.5);
    waitingSofa.rotation.y = -Math.PI / 2;
    interiorGroup.add(waitingSofa);

  } else if (bType === 5) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.95, 0.8), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    counter.position.set(32.5, 0.475, 30.5);
    interiorGroup.add(counter);
    
    interiorProps.push({
      name: '🛒 계산대 (상점 쇼핑)',
      x: 32.5, z: 30.5, dist: 1.8,
      action: () => {
        if (typeof toggleInventory === 'function') {
          toggleInventory();
          showNotice('상점 쇼핑 및 인벤토리가 활성화되었습니다.');
        }
      }
    });

    // 🛍️ [추가] 쇼핑몰 내 좌우측 제품 진열대들
    const shelfLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 2.5), new THREE.MeshStandardMaterial({ color: 0xd7ccc8 }));
    shelfLeft.position.set(29.5, 0.9, 33.5);
    interiorGroup.add(shelfLeft);
    const shelfRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 2.5), new THREE.MeshStandardMaterial({ color: 0xd7ccc8 }));
    shelfRight.position.set(35.5, 0.9, 33.5);
    interiorGroup.add(shelfRight);

  } else if (bType === 10) {
    const hBed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 2.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    hBed.position.set(29.5, 0.35, 33.5);
    interiorGroup.add(hBed);
    
    interiorProps.push({
      name: '🏥 환자용 침대 (진료/회복)',
      x: 29.5, z: 33.5, dist: 1.6,
      action: () => {
        if (P.money < 10000) { showNotice('진료비 ₦10,000가 부족합니다.'); return; }
        P.money -= 10000;
        P.health = 100;
        P.energy = cap(P.energy + 30);
        playCoin();
        showNotice('🏥 의사의 전문 진료를 받아 피로와 체력이 완전히 회복되었습니다!');
        updateHUD();
      }
    });
  }
}

function handleInteriorInteraction() {
  if (!P.isInterior) return;
  
  let closest = null;
  let minDist = 999;
  
  interiorProps.forEach(prop => {
    const dx = P.x - prop.x;
    const dz = P.y - prop.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < prop.dist && d < minDist) {
      minDist = d;
      closest = prop;
    }
  });
  
  if (closest) {
    closest.action();
  } else {
    showNotice('상호작용할 수 있는 가구나 통로 근처에서 [E]를 누르세요.');
  }
}

function openElevatorModal() {
  document.getElementById('elevator-modal').style.display = 'block';
  document.exitPointerLock();
  
  const buttonsContainer = document.getElementById('elevator-floor-buttons');
  buttonsContainer.innerHTML = '';
  
  let maxFloors = 5;
  if (P.currentInterior.type === 1) maxFloors = 10;
  if (P.currentInterior.type === 11) maxFloors = 3;
  
  for (let f = 1; f <= maxFloors; f++) {
    const btn = document.createElement('button');
    btn.className = 'elevator-btn';
    if (f === P.currentFloor) btn.classList.add('active');
    btn.textContent = f;
    btn.onclick = () => selectFloor(f);
    buttonsContainer.appendChild(btn);
  }
  
  document.getElementById('elevator-indicator').textContent = P.currentFloor + 'F';
  document.getElementById('elevator-status').textContent = '대기 중';
}
window.openElevatorModal = openElevatorModal;

function closeElevatorModal() {
  document.getElementById('elevator-modal').style.display = 'none';
  c.requestPointerLock();
}
window.closeElevatorModal = closeElevatorModal;

function selectFloor(floorNum) {
  if (floorNum === P.currentFloor) {
    showNotice('이미 현재 층에 있습니다.');
    return;
  }
  
  playClick();
  document.getElementById('elevator-status').textContent = '이동 중...';
  playElevatorDing();
  
  setTimeout(() => {
    P.currentFloor = floorNum;
    document.getElementById('elevator-indicator').textContent = floorNum + 'F';
    document.getElementById('elevator-status').textContent = '도착 완료';
    
    buildInteriorScene();
    updateInteriorHUD();
    
    playElevatorDing();
    showNotice(`🛗 엘리베이터를 이용해 ${floorNum}층으로 이동했습니다.`);
    
    setTimeout(() => {
      closeElevatorModal();
    }, 500);
  }, 1200);
}
window.selectFloor = selectFloor;

function useStairs(direction) {
  let maxFloors = 5;
  if (P.currentInterior.type === 1) maxFloors = 10;
  if (P.currentInterior.type === 11) maxFloors = 3;
  
  if (direction === 'up') {
    if (P.currentFloor >= maxFloors) {
      showNotice('❌ 최상층입니다. 더 이상 올라갈 수 없습니다.');
      return;
    }
    P.currentFloor++;
  } else {
    if (P.currentFloor <= 1) {
      showNotice('❌ 1층입니다. 더 이상 내려갈 수 없습니다.');
      return;
    }
    P.currentFloor--;
  }
  
  playClick();
  buildInteriorScene();
  updateInteriorHUD();
  showNotice(`🪜 계단을 통해 ${P.currentFloor}층으로 이동했습니다.`);
}
window.useStairs = useStairs;

function updateInteriorHUD() {
  const lbl = document.getElementById('interior-floor-label');
  if (lbl) {
    let floorName = `${P.currentFloor}층`;
    if (P.currentInterior.type === 8) {
      floorName = `${P.currentFloor}층 ${300 + P.currentFloor}호`;
    } else if (P.currentInterior.type === 11) {
      floorName = P.currentFloor === 1 ? '1층 도서관' : `${P.currentFloor}층 교실`;
    }
    lbl.textContent = floorName;
  }
}

// 가구 상호작용 함수들
function sleepInBed() {
  playClick();
  const overlay = document.getElementById('sleep-overlay');
  overlay.classList.add('active');
  overlay.style.display = 'flex';
  
  setTimeout(() => {
    gMin = 420; 
    dayN++;
    P.energy = 100;
    P.health = cap(P.health + 40);
    P.hunger = cap(P.hunger - 25);
    updateHUD();
    
    playNotice();
    document.getElementById('sleep-time-msg').textContent = '새 아침이 밝았습니다!';
    
    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      document.getElementById('sleep-time-msg').textContent = '하루의 피로를 풀고 있습니다...';
      showNotice('🛌 잠에서 깼습니다. 에너지와 건강이 완전히 회복되었습니다!');
    }, 1200);
  }, 2000);
}
window.sleepInBed = sleepInBed;

function watchTV() {
  P.happy = cap(P.happy + 18);
  P.energy = cap(P.energy + 5);
  playNotice();
  showNotice('📺 TV 예능 프로그램을 시청했습니다. 행복도 😊 상승!');
  updateHUD();
}
window.watchTV = watchTV;

function cookFood() {
  if (P.money < 3000) {
    showNotice('식재료 구매비 ₦3,000가 부족합니다.');
    return;
  }
  P.money -= 3000;
  P.hunger = cap(P.hunger + 35);
  P.happy = cap(P.happy + 5);
  playNotice();
  showNotice('🍳 요리를 해서 맛있는 식사를 했습니다. 허기 🍔 해소!');
  updateHUD();
}
window.cookFood = cookFood;

function takeShower() {
  P.health = cap(P.health + 10);
  P.happy = cap(P.happy + 10);
  playNotice();
  showNotice('🚿 샤워를 했습니다. 기분이 개운해졌습니다! 😊');
  updateHUD();
}
window.takeShower = takeShower;

function useComputer() {
  P.knowledge = cap(P.knowledge + 3);
  P.energy = cap(P.energy - 8);
  playNotice();
  showNotice('💻 컴퓨터로 인터넷 강의 및 자료 조사를 했습니다. 지식 📚 상승!');
  updateHUD();
}
window.useComputer = useComputer;

// 학교 공부하기 모달
let currentStudyLocation = 'NNU 대학교';
function openStudyModal(locName) {
  currentStudyLocation = locName || 'NNU 대학교';
  document.getElementById('study-modal-title').textContent = currentStudyLocation;
  document.getElementById('study-knowledge-val').textContent = P.knowledge || 0;
  document.getElementById('study-diploma-val').textContent = P.diploma || '고등학교 졸업';
  document.getElementById('study-result-msg').textContent = '';
  document.getElementById('study-modal').style.display = 'block';
  document.exitPointerLock();
}
window.openStudyModal = openStudyModal;

function closeStudyModal() {
  document.getElementById('study-modal').style.display = 'none';
  c.requestPointerLock();
}
window.closeStudyModal = closeStudyModal;

function performStudyAction(type) {
  let cost = 0;
  let kGain = 0;
  let eCost = 0;
  let msg = '';
  
  if (type === 'self') {
    cost = 0;
    kGain = 5;
    eCost = 10;
    msg = '📖 조용히 자습을 했습니다.';
  } else if (type === 'lecture') {
    cost = 15000;
    kGain = 12;
    eCost = 20;
    msg = '👩‍🏫 전공 대학 강의를 수강했습니다.';
  } else if (type === 'library') {
    cost = 5000;
    kGain = 8;
    eCost = 15;
    msg = '📚 도서관 학술지를 탐독했습니다.';
  }
  
  if (P.money < cost) {
    document.getElementById('study-result-msg').textContent = '❌ 등록금/비용이 부족합니다!';
    document.getElementById('study-result-msg').className = 'text-red';
    return;
  }
  if (P.energy < eCost) {
    document.getElementById('study-result-msg').textContent = '❌ 너무 피곤해서 공부에 집중할 수 없습니다! (에너지 부족)';
    document.getElementById('study-result-msg').className = 'text-red';
    return;
  }
  
  P.money -= cost;
  P.energy -= eCost;
  P.knowledge = cap((P.knowledge || 0) + kGain, 0, 150);
  
  playCoin();
  document.getElementById('study-knowledge-val').textContent = P.knowledge;
  document.getElementById('study-result-msg').textContent = `${msg} 지식 +${kGain}!`;
  document.getElementById('study-result-msg').className = 'text-green';
  updateHUD();
}
window.performStudyAction = performStudyAction;

function takeExam() {
  const reqK = P.diploma === '고등학교 졸업' ? 100 : 140;
  const nextDip = P.diploma === '고등학교 졸업' ? '대학교 학사' : '대학원 석사/박사';
  
  if (P.money < 50000) {
    document.getElementById('study-result-msg').textContent = '❌ 시험 응시료 ₦50,000가 부족합니다!';
    document.getElementById('study-result-msg').className = 'text-red';
    return;
  }
  
  if ((P.knowledge || 0) < reqK) {
    document.getElementById('study-result-msg').textContent = `❌ 시험 낙방: 지식이 부족합니다! (${reqK} 필요)`;
    document.getElementById('study-result-msg').className = 'text-red';
    return;
  }
  
  P.money -= 50000;
  P.diploma = nextDip;
  P.happy = cap(P.happy + 30);
  
  playNotice();
  document.getElementById('study-diploma-val').textContent = P.diploma;
  document.getElementById('study-result-msg').textContent = `🎉 축하합니다! 시험에 합격하여 [${nextDip}] 학위를 취득했습니다!`;
  document.getElementById('study-result-msg').className = 'text-green';
  updateHUD();
}
window.takeExam = takeExam;

// ══════════════════════════════════════════════════════
//   👥 NPC 대화 및 상호작용 시스템 비즈니스 로직
// ══════════════════════════════════════════════════════

let selectedCitizen = null;

function enrichCitizensStances() {
  if (!Sim.citizens) return;
  Sim.citizens.forEach(c => {
    if (typeof c.politicalStance === 'undefined') {
      c.politicalStance = Math.random() > 0.5 ? '진보파' : '보수파';
    }
    if (typeof c.classGroup === 'undefined') {
      if (!c.job) {
        c.classGroup = '실업자';
      } else {
        c.classGroup = c.salary >= 3500000 ? '자본가' : '근로자';
      }
    }
    if (typeof c.affinity === 'undefined') {
      c.affinity = 40 + Math.floor(Math.random() * 20); // 40-60%
    }
  });
}

// Hook Sim.init
const _origSimInit = Sim.init.bind(Sim);
Sim.init = function() {
  _origSimInit();
  enrichCitizensStances();
};

function openNpcDialog(citizen) {
  selectedCitizen = citizen;
  const modal = document.getElementById('npc-dialog-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.exitPointerLock();

  // Populate UI
  document.getElementById('npc-name').textContent = citizen.name;
  document.getElementById('npc-age-gender').textContent = `${citizen.age}세 · ${citizen.gender}`;
  document.getElementById('npc-job').textContent = citizen.job || '실업자';
  
  let moodText = '😐 보통';
  let moodColor = 'var(--gold)';
  if (citizen.happiness >= 75) { moodText = '😊 행복'; moodColor = 'var(--green)'; }
  else if (citizen.happiness < 45) { moodText = '😭 불만'; moodColor = '#ff4560'; }
  document.getElementById('npc-mood').textContent = `${moodText} (${Math.round(citizen.happiness)}%)`;
  document.getElementById('npc-mood').style.color = moodColor;

  document.getElementById('npc-stance').textContent = `${citizen.politicalStance} · ${citizen.classGroup}`;
  
  updateNpcAffinityUI();

  // Reset dialogue
  document.getElementById('npc-dialogue-text').textContent = `"안녕하세요, 대통령님! 네오폴리스 시정에 대해 이야기를 나눌 수 있어 영광입니다."`;

  // Build dialogue options
  buildNpcDialogueOptions();
}

function updateNpcAffinityUI() {
  if (!selectedCitizen) return;
  const fill = document.getElementById('npc-affinity-fill');
  const val = document.getElementById('npc-affinity-val');
  if (fill && val) {
    fill.style.width = selectedCitizen.affinity + '%';
    val.textContent = selectedCitizen.affinity + '%';
  }
}

function closeNpcDialog() {
  const modal = document.getElementById('npc-dialog-modal');
  if (modal) modal.style.display = 'none';
  selectedCitizen = null;
  c.requestPointerLock();
}
window.closeNpcDialog = closeNpcDialog;

function buildNpcDialogueOptions() {
  const box = document.getElementById('npc-options-box');
  if (!box) return;
  box.innerHTML = '';

  const options = [
    { label: '👋 "안녕하세요! 오늘 기분은 어떠신가요?"', action: () => selectNpcOption('greet') },
    { label: '🏢 "최근 정부 정책이나 삶에 대해 어떻게 생각하십니까?"', action: () => selectNpcOption('policy') },
    { label: '👥 "대통령으로서 귀하의 의견을 적극 경청하겠습니다."', action: () => selectNpcOption('listen') },
    { label: '🚪 대화 종료', action: () => closeNpcDialog() }
  ];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'npc-option-btn';
    btn.innerHTML = `<span>${opt.label}</span> <span>➔</span>`;
    btn.onclick = () => { playClick(); opt.action(); };
    box.appendChild(btn);
  });
}

function selectNpcOption(type) {
  if (!selectedCitizen) return;
  const dialogueText = document.getElementById('npc-dialogue-text');
  
  let reply = '';
  let affinityChange = 0;

  if (type === 'greet') {
    if (selectedCitizen.happiness >= 75) {
      reply = `"아주 좋습니다! 요즘 네오폴리스는 정말 살기 좋은 도시가 된 것 같습니다."`;
      affinityChange = 5;
    } else if (selectedCitizen.happiness < 45) {
      reply = `"솔직히 요즘 사는 게 너무 팍팍하네요. 걱정이 많습니다."`;
      affinityChange = -2;
    } else {
      reply = `"그저 평범하게 지내고 있습니다. 특별히 나쁜 일은 없네요."`;
      affinityChange = 2;
    }
  } else if (type === 'policy') {
    // Stance/Class based responses
    if (selectedCitizen.classGroup === '실업자') {
      const basicIncomeActive = lawState && lawState['eco01']; // 기본소득제
      if (basicIncomeActive) {
        reply = `"직장이 없어서 막막했는데, 정부의 기본소득 매월 지원제 덕분에 한숨 돌렸습니다. 지지합니다!"`;
        affinityChange = 12;
      } else {
        reply = `"일자리가 없어서 당장 먹고 살 돈조차 부족합니다. 서민 구제 정책을 늘려주세요!"`;
        affinityChange = -8;
      }
    } else if (selectedCitizen.classGroup === '자본가') {
      const taxCorporateReduced = Sim.taxRateCorporate < 10;
      if (taxCorporateReduced) {
        reply = `"법인세 감면과 규제 완화 덕분에 사업하기 정말 좋아졌습니다. 아주 훌륭한 시정입니다."`;
        affinityChange = 15;
      } else {
        reply = `"기업들의 부담이 나날이 커져 걱정입니다. 세금을 줄여 고용을 활성화해야 합니다."`;
        affinityChange = -5;
      }
    } else {
      // 근로자
      const hoursLimitActive = lawState && lawState['lab01']; // 주52시간제
      if (hoursLimitActive) {
        reply = `"주 52시간 상한제 정책 시행 덕분에 저녁에 취미 생활을 즐길 수 있어 만족스럽습니다."`;
        affinityChange = 10;
      } else {
        reply = `"잔업과 야근이 일상이라 삶의 여유가 없습니다. 노동자 처우 개선을 바랄 뿐입니다."`;
        affinityChange = -4;
      }
    }
  } else if (type === 'listen') {
    if (selectedCitizen.politicalStance === '진보파') {
      reply = `"대통령님께서 직접 들어주시니 기쁩니다. 더 건강하고 복지가 튼튼한 복지국가를 만들어주세요!"`;
      affinityChange = 8;
    } else {
      reply = `"제 이야기를 귀담아 주셔서 감사합니다. 자유 경쟁과 튼튼한 안보, 재정 건전성을 유지해주시길 믿습니다."`;
      affinityChange = 8;
    }
    // 대통령 경청에 의한 전체 지지율 보너스 효과
    Sim.approvalRating = Math.min(100, Sim.approvalRating + 1.5);
  }

  // Apply affinity change
  selectedCitizen.affinity = Math.max(0, Math.min(100, selectedCitizen.affinity + affinityChange));
  updateNpcAffinityUI();

  // Display reply
  dialogueText.textContent = reply;

  // Recalculate global approval rating based on citizen average affinity
  let totalAff = 0;
  let count = 0;
  Sim.citizens.forEach(c => {
    if (typeof c.affinity !== 'undefined') {
      totalAff += c.affinity;
      count++;
    }
  });
  if (count > 0) {
    const avg = totalAff / count;
    // Blend current approval with average affinity (45/55 blend)
    Sim.approvalRating = Sim.approvalRating * 0.45 + avg * 0.55;
  }

  updateHUD();
  updateDashboardData();

  // Change option buttons to only exit
  const box = document.getElementById('npc-options-box');
  if (box) {
    box.innerHTML = '';
    const exitBtn = document.createElement('button');
    exitBtn.className = 'npc-option-btn';
    exitBtn.style.borderColor = 'var(--green)';
    exitBtn.innerHTML = `<span>🚪 의견을 경청했습니다. 대화 마무리</span> <span>➔</span>`;
    exitBtn.onclick = () => { playClick(); closeNpcDialog(); };
    box.appendChild(exitBtn);
  }
}

// Click to Raycast and interact with NPC
c.addEventListener('click', e => {
  if (dlgOpen || isDashboardOpen || document.getElementById('lock-screen').style.display !== 'none' || P.isInterior) return;

  // Set raycaster
  raycaster.setFromCamera(locked ? new THREE.Vector2(0, 0) : mouse, camera);
  
  const meshesOnly = citizenMeshes.map(cm => cm.mesh);
  const intersects = raycaster.intersectObjects(meshesOnly);

  if (intersects.length > 0 && intersects[0].distance < 12) {
    const hitMesh = intersects[0].object;
    const cm = citizenMeshes.find(x => x.mesh === hitMesh);
    const citizen = Sim.citizens.find(c => c.id === cm.citizenId);
    if (citizen) {
      openNpcDialog(citizen);
    }
  }
});

// ══════════════════════════════════════════════════════
//   💼 플레이어 직업 시스템
// ══════════════════════════════════════════════════════
const PLAYER_JOBS = [
  { id: 'pj1', name: '편의점 알바', category: '서비스', salary: 1800000, energy: -10, tier: '인턴', promoDays: 15, nextId: 'pj2' },
  { id: 'pj2', name: '카페 바리스타', category: '서비스', salary: 2400000, energy: -12, tier: '주니어', promoDays: 20, nextId: 'pj3' },
  { id: 'pj3', name: '레스토랑 매니저', category: '서비스', salary: 3800000, energy: -15, tier: '시니어', promoDays: 30, nextId: null },
  { id: 'pj4', name: 'IT 스타트업 개발자', category: 'IT/AI', salary: 4200000, energy: -15, tier: '주니어', promoDays: 20, nextId: 'pj5' },
  { id: 'pj5', name: 'AI 수석 엔지니어', category: 'IT/AI', salary: 8500000, energy: -20, tier: '시니어', promoDays: 30, nextId: 'pj6' },
  { id: 'pj6', name: 'CTO (최고기술책임자)', category: 'IT/AI', salary: 18000000, energy: -25, tier: '임원', promoDays: null, nextId: null },
  { id: 'pj7', name: '주니어 의사', category: '메디컬', salary: 5500000, energy: -20, tier: '주니어', promoDays: 25, nextId: 'pj8' },
  { id: 'pj8', name: '전문의 (외과)', category: '메디컬', salary: 12000000, energy: -25, tier: '시니어', promoDays: 35, nextId: null },
  { id: 'pj9', name: '금융 애널리스트', category: '금융', salary: 5000000, energy: -15, tier: '주니어', promoDays: 20, nextId: 'pj10' },
  { id: 'pj10', name: '투자 펀드 매니저', category: '금융', salary: 15000000, energy: -20, tier: '시니어', promoDays: 30, nextId: null },
];

const playerJob = {
  current: null,   // PLAYER_JOBS의 id
  tenureDays: 0,   // 재직일수
  promoPct: 0,     // 승진 진행도 (0~100)
  totalEarned: 0,  // 누적 수령액
};

function openJobModal() {
  initAudio();
  renderJobModal();
  document.getElementById('job-modal').style.display = 'block';
}

function closeJobModal() {
  document.getElementById('job-modal').style.display = 'none';
  setTimeout(() => { if (!isDashboardOpen) c.requestPointerLock(); }, 200);
}

function renderJobModal() {
  const job = PLAYER_JOBS.find(j => j.id === playerJob.current);

  document.getElementById('job-current-name').textContent = job ? job.name : '없음 (실직자)';
  document.getElementById('job-current-salary').textContent = job ? `₦${job.salary.toLocaleString()}` : '₦0';
  document.getElementById('job-tenure-days').textContent = `${playerJob.tenureDays}일`;
  document.getElementById('job-current-tier').textContent = job ? job.tier : '-';

  const promoRow = document.getElementById('job-promotion-row');
  if (job && job.nextId) {
    promoRow.style.display = 'block';
    document.getElementById('job-promo-bar').style.width = playerJob.promoPct + '%';
    document.getElementById('job-promo-pct').textContent = Math.round(playerJob.promoPct) + '%';
  } else {
    promoRow.style.display = 'none';
  }

  // 직업 버튼 라벨 갱신
  document.getElementById('job-btn-label').textContent = job ? `${job.name} (월 ₦${(job.salary/10000).toFixed(0)}만)` : '직업 센터';

  // 채용 공고 렌더링
  const list = document.getElementById('job-listings');
  list.innerHTML = '';
  const categories = [...new Set(PLAYER_JOBS.map(j => j.category))];

  categories.forEach(cat => {
    const catJobs = PLAYER_JOBS.filter(j => j.category === cat && j.tier === '인턴' || (PLAYER_JOBS.filter(j2 => j2.category === cat && j2.tier === '인턴').length === 0 && PLAYER_JOBS.filter(j2 => j2.category === cat)[0]?.id === j.id));
    const baseJob = PLAYER_JOBS.find(j => j.category === cat && (j.tier === '인턴' || j.tier === '주니어'));
    if (!baseJob) return;
    const isCurrentCat = job && job.category === cat;
    const div = document.createElement('div');
    div.style.cssText = 'background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.15);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;';
    div.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:13px;">${baseJob.name} <span style="color:var(--text-dim);font-size:11px;">(${cat})</span></div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:3px;">시작급 월 ₦${baseJob.salary.toLocaleString()} · 에너지 ${baseJob.energy}/근무</div>
      </div>
      <button class="form-btn login-btn" style="font-size:11px;padding:5px 12px;${isCurrentCat ? 'opacity:0.4;cursor:not-allowed;' : ''}"
        onclick="${isCurrentCat ? '' : `playerHireJob('${baseJob.id}')`}">${isCurrentCat ? '재직 중' : '입사 지원'}</button>
    `;
    list.appendChild(div);
  });
}

function playerHireJob(jobId) {
  playClick();
  playerJob.current = jobId;
  playerJob.tenureDays = 0;
  playerJob.promoPct = 0;
  const job = PLAYER_JOBS.find(j => j.id === jobId);
  showNotice(`✅ ${job.name} 입사 완료! 월급 ₦${job.salary.toLocaleString()}`);
  addEventLog('💼 취업', `${job.name} 입사 완료. 월 ₦${job.salary.toLocaleString()}`);
  renderJobModal();
}

function playerQuitJob() {
  if (!playerJob.current) { showNotice('⚠️ 현재 직업이 없습니다.'); return; }
  const job = PLAYER_JOBS.find(j => j.id === playerJob.current);
  playClick();
  playerJob.current = null;
  playerJob.tenureDays = 0;
  playerJob.promoPct = 0;
  showNotice(`🚪 ${job.name} 사직서 제출 완료`);
  addEventLog('🚪 사직', `${job.name} 퇴사`);
  renderJobModal();
}

function playerWorkShift() {
  if (!playerJob.current) { showNotice('⚠️ 직업이 없습니다. 먼저 취업하세요!'); return; }
  const job = PLAYER_JOBS.find(j => j.id === playerJob.current);
  if (P.energy < Math.abs(job.energy)) { showNotice('⚡ 에너지 부족! 먼저 쉬거나 음식을 드세요.'); return; }

  const shiftPay = Math.round(job.salary / 30);
  P.energy = cap(P.energy + job.energy);
  P.money += shiftPay;
  playerJob.tenureDays++;
  playerJob.totalEarned += shiftPay;
  playCoin();

  // 승진 처리
  if (job.nextId && job.promoDays) {
    playerJob.promoPct += (100 / job.promoDays);
    if (playerJob.promoPct >= 100) {
      playerJob.promoPct = 0;
      playerJob.current = job.nextId;
      const nextJob = PLAYER_JOBS.find(j => j.id === job.nextId);
      showNotice(`🎉 승진! ${nextJob.name}으로 승진되었습니다! 월급 ₦${nextJob.salary.toLocaleString()}`);
      addEventLog('🎉 승진', `${job.name} → ${nextJob.name}`);
      addNews(`🎉 대통령이 ${nextJob.name}으로 승진!`);
    } else {
      showNotice(`⏱️ 근무 완료! ₦${shiftPay.toLocaleString()} 수령 (승진까지 ${Math.round(100 - playerJob.promoPct)}%)`);
    }
  } else {
    showNotice(`⏱️ 근무 완료! ₦${shiftPay.toLocaleString()} 수령`);
  }

  updateHUD();
  renderJobModal();
}

// 날짜 변경 시 직업 재직일 갱신 (render 루프의 자정 이벤트와 연동)
function tickPlayerJob() {
  if (!playerJob.current) return;
  // 월급은 매 30 재직일마다 자동 추가 지급
  if (playerJob.tenureDays > 0 && playerJob.tenureDays % 30 === 0) {
    const job = PLAYER_JOBS.find(j => j.id === playerJob.current);
    P.money += job.salary;
    playCoin();
    addNews(`💰 월급 ₦${job.salary.toLocaleString()} 자동 입금 (${job.name})`);
  }
}

// ══════════════════════════════════════════════════════
//   🏦 국채 발행 시스템
// ══════════════════════════════════════════════════════

function updateBondUI() {
  const debtEl = document.getElementById('bd-debt');
  const interestEl = document.getElementById('bd-interest');
  const ratioEl = document.getElementById('bd-ratio');
  if (!debtEl) return;

  const debt = Sim.nationalDebt;
  const monthlyInterest = Math.round(debt * (Sim.interestRate / 100) / 12);
  const ratio = ((debt / Math.max(1, Sim.gdp)) * 100).toFixed(1);

  debtEl.textContent = `₦${debt.toLocaleString()}`;
  interestEl.textContent = `₦${monthlyInterest.toLocaleString()}`;
  ratioEl.textContent = `${ratio}%`;
  ratioEl.style.color = parseFloat(ratio) > 60 ? '#ff4560' : parseFloat(ratio) > 30 ? '#ffb030' : '#00e676';
}

window.issueBond = function() {
  initAudio();
  const sel = document.getElementById('bond-amount-select');
  if (!sel) return;
  const amount = parseInt(sel.value);
  const premiumMap = { 100000000000: 1, 500000000000: 1.5, 1000000000000: 2 };
  const premium = premiumMap[amount] || 1;
  const effectiveRate = Sim.interestRate + premium;

  if (Sim.nationalDebt > Sim.gdp * 0.8) {
    showNotice('⛔ 국가 부채가 GDP의 80%를 초과해 신용 등급 하락으로 국채 발행이 불가합니다!');
    return;
  }

  Sim.treasury += amount;
  Sim.nationalDebt += amount;
  playCoin();
  showNotice(`📈 국채 ₦${(amount/100000000).toFixed(0)}억 발행 완료. 이자율 ${effectiveRate.toFixed(1)}%`);
  addEventLog('🏦 국채 발행', `₦${(amount/100000000).toFixed(0)}억 발행. 이자율 ${effectiveRate.toFixed(1)}%`);
  addNews(`🏦 정부, 국채 ₦${(amount/100000000).toFixed(0)}억 발행 — 국고 확충`);
  updateBondUI();
  updateDashboardData();
};

window.repayBond = function() {
  initAudio();
  if (Sim.nationalDebt <= 0) { showNotice('✅ 상환할 국채가 없습니다!'); return; }
  const repayAmt = Math.round(Sim.treasury * 0.1);
  if (repayAmt <= 0 || Sim.treasury < repayAmt) { showNotice('⚠️ 국고가 부족합니다!'); return; }
  Sim.treasury -= repayAmt;
  Sim.nationalDebt = Math.max(0, Sim.nationalDebt - repayAmt);
  playCoin();
  showNotice(`💸 국채 ₦${repayAmt.toLocaleString()} 상환 완료`);
  addEventLog('💸 국채 상환', `₦${repayAmt.toLocaleString()} 상환`);
  updateBondUI();
  updateDashboardData();
};

// 매 틱 국채 이자 국고에서 자동 차감 (Sim.tick 종료 후 호출)
const _origTick = Sim.tick.bind(Sim);
Sim.tick = function() {
  _origTick();
  // 국채 월 이자 차감
  if (this.nationalDebt > 0) {
    const interest = Math.round(this.nationalDebt * (this.interestRate / 100) / 12);
    this.treasury = Math.max(0, this.treasury - interest);
    if (interest > 0 && this.tickCount % 5 === 0) {
      if (window.addNews) addNews(`💸 국채 이자 ₦${interest.toLocaleString()} 자동 차감`);
    }
  }
  updateBondUI();
  updatePlayerJobDayTick();
};

let _lastJobDay = 0;
function updatePlayerJobDayTick() {
  if (dayN !== _lastJobDay) {
    _lastJobDay = dayN;
    if (playerJob.current) {
      playerJob.tenureDays++;
      tickPlayerJob();
    }
  }
}

// ══════════════════════════════════════════════════════
//   🚨 재난 이벤트 시스템
// ══════════════════════════════════════════════════════

const DISASTERS = [
  {
    id: 'dis_quake',
    icon: '🏚️',
    title: '대지진 발생!',
    desc: '리히터 7.2 규모의 강진이 네오폴리스 남부를 강타했습니다. 다수의 건물이 붕괴하고 시민 사상자가 발생했습니다.',
    impact: '국민 건강 -15 · 행복도 -12 · GDP -5% · 지지율 -8',
    apply: () => {
      Sim.popHealth = Math.max(10, Sim.popHealth - 15);
      Sim.popHappiness = Math.max(5, Sim.popHappiness - 12);
      Sim.gdp = Math.round(Sim.gdp * 0.95);
      Sim.approvalRating = Math.max(5, Sim.approvalRating - 8);
    },
    options: [
      {
        label: '🚁 긴급 구조대 파견 (₦3억 지출)',
        cost: 300000000,
        effect() {
          Sim.treasury -= 300000000;
          Sim.popHealth = Math.min(100, Sim.popHealth + 8);
          Sim.popHappiness = Math.min(100, Sim.popHappiness + 6);
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 10);
          showNotice('🚁 구조대 파견 완료. 국민 신뢰 회복!');
          addEventLog('🏚️ 지진 대응', '긴급 구조대 파견 — ₦3억 집행, 지지율 +10');
        }
      },
      {
        label: '🏥 의료 지원에만 집중 (₦1억 지출)',
        cost: 100000000,
        effect() {
          Sim.treasury -= 100000000;
          Sim.popHealth = Math.min(100, Sim.popHealth + 12);
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 3);
          showNotice('🏥 의료 지원 집중. 건강 회복!');
          addEventLog('🏚️ 지진 대응', '의료 지원 집중 — ₦1억 집행');
        }
      },
      {
        label: '📢 국민 자력 대피 권고 (예산 없음)',
        cost: 0,
        effect() {
          Sim.popHappiness = Math.max(0, Sim.popHappiness - 5);
          Sim.approvalRating = Math.max(5, Sim.approvalRating - 12);
          showNotice('📢 국민 불만 폭증... 지지율 급락!');
          addEventLog('🏚️ 지진 대응', '자력 대피 권고 — 지지율 -12');
        }
      }
    ]
  },
  {
    id: 'dis_epidemic',
    icon: '🦠',
    title: '바이러스 대유행!',
    desc: '신종 바이러스 "네오-X"가 네오폴리스 전역으로 빠르게 확산되고 있습니다. WHO가 긴급 공중보건 위기를 선언했습니다.',
    impact: '국민 건강 -20 · 행복도 -10 · 실업률 +2% · 지지율 -5',
    apply: () => {
      Sim.popHealth = Math.max(10, Sim.popHealth - 20);
      Sim.popHappiness = Math.max(5, Sim.popHappiness - 10);
      Sim.unemploymentRate = Math.min(30, Sim.unemploymentRate + 2);
      Sim.approvalRating = Math.max(5, Sim.approvalRating - 5);
    },
    options: [
      {
        label: '💉 대규모 백신 프로그램 (₦5억 지출)',
        cost: 500000000,
        effect() {
          Sim.treasury -= 500000000;
          Sim.popHealth = Math.min(100, Sim.popHealth + 20);
          Sim.popHappiness = Math.min(100, Sim.popHappiness + 8);
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 15);
          showNotice('💉 백신 프로그램 성공! 전염병 종식.');
          addEventLog('🦠 전염병 대응', '대규모 백신 프로그램 — ₦5억 집행, 지지율 +15');
        }
      },
      {
        label: '🔒 부분 봉쇄령 발동 (₦2억 지출)',
        cost: 200000000,
        effect() {
          Sim.treasury -= 200000000;
          Sim.popHealth = Math.min(100, Sim.popHealth + 10);
          Sim.gdp = Math.round(Sim.gdp * 0.97);
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 5);
          showNotice('🔒 봉쇄령으로 전파 속도 감소. 경제 위축.');
          addEventLog('🦠 전염병 대응', '부분 봉쇄령 — ₦2억 집행, GDP -3%');
        }
      },
      {
        label: '🙅 집단면역 자연 전략 (예산 없음)',
        cost: 0,
        effect() {
          Sim.popHealth = Math.max(0, Sim.popHealth - 10);
          Sim.approvalRating = Math.max(5, Sim.approvalRating - 20);
          showNotice('🙅 집단면역 실패... 국민 사망자 급증!');
          addEventLog('🦠 전염병 대응', '집단면역 전략 — 지지율 -20, 건강 -10');
        }
      }
    ]
  },
  {
    id: 'dis_fire',
    icon: '🔥',
    title: '테크노밸리 대화재!',
    desc: '테크노 밸리 IT 산업단지에서 대형 화재가 발생했습니다. 수십 개의 기업과 데이터 센터가 피해를 입고 있습니다.',
    impact: '기술지수 -20 · GDP -3% · 실업률 +1.5% · 지지율 -6',
    apply: () => {
      Sim.techLevel = Math.max(0, Sim.techLevel - 20);
      Sim.gdp = Math.round(Sim.gdp * 0.97);
      Sim.unemploymentRate = Math.min(30, Sim.unemploymentRate + 1.5);
      Sim.approvalRating = Math.max(5, Sim.approvalRating - 6);
    },
    options: [
      {
        label: '🚒 소방 특수대 + 드론 진압 (₦2억 지출)',
        cost: 200000000,
        effect() {
          Sim.treasury -= 200000000;
          Sim.techLevel += 10;
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 12);
          showNotice('🚒 드론 진압 성공! 피해 최소화.');
          addEventLog('🔥 화재 대응', '소방 특수대 파견 — ₦2억 집행, 지지율 +12');
        }
      },
      {
        label: '🏗️ 긴급 재건 예산 편성 (₦4억 지출)',
        cost: 400000000,
        effect() {
          Sim.treasury -= 400000000;
          Sim.techLevel += 25;
          Sim.gdp = Math.round(Sim.gdp * 1.03);
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 8);
          showNotice('🏗️ 재건 예산 집행! 기술지수 회복.');
          addEventLog('🔥 화재 대응', '긴급 재건 — ₦4억 집행, 기술지수 +25');
        }
      },
      {
        label: '📋 보험 처리 위임 (예산 없음)',
        cost: 0,
        effect() {
          Sim.approvalRating = Math.max(5, Sim.approvalRating - 8);
          showNotice('📋 기업들의 불만 폭주! 지지율 하락.');
          addEventLog('🔥 화재 대응', '보험 처리 위임 — 지지율 -8');
        }
      }
    ]
  },
  {
    id: 'dis_financial',
    icon: '📉',
    title: '금융 시장 대폭락!',
    desc: '외부 충격으로 NPX 주가지수가 단 하루 만에 28% 폭락했습니다. 가계 자산 손실과 기업 연쇄 부도 우려가 커지고 있습니다.',
    impact: '주가 -30% · GDP -6% · 지지율 -10 · 국민 행복 -8',
    apply: () => {
      Sim.stocks.forEach(s => { s.price = Math.round(s.price * 0.7); });
      Sim.gdp = Math.round(Sim.gdp * 0.94);
      Sim.approvalRating = Math.max(5, Sim.approvalRating - 10);
      Sim.popHappiness = Math.max(5, Sim.popHappiness - 8);
    },
    options: [
      {
        label: '🏦 시장 안정화 기금 투입 (₦10억 지출)',
        cost: 1000000000,
        effect() {
          if (Sim.treasury < 1000000000) { showNotice('⚠️ 국고 부족!'); return; }
          Sim.treasury -= 1000000000;
          Sim.stocks.forEach(s => { s.price = Math.round(s.price * 1.25); });
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 15);
          showNotice('🏦 시장 안정 기금 투입! 주가 반등.');
          addEventLog('📉 금융위기 대응', '시장 안정 기금 ₦10억 투입, 주가 반등');
        }
      },
      {
        label: '📉 기준금리 긴급 인하 (금리 -1%)',
        cost: 0,
        effect() {
          Sim.interestRate = Math.max(0.1, Sim.interestRate - 1);
          Sim.stocks.forEach(s => { s.price = Math.round(s.price * 1.12); });
          Sim.inflation += 0.8;
          Sim.approvalRating = Math.min(95, Sim.approvalRating + 8);
          showNotice('📉 금리 인하 단행! 증시 소폭 반등. 인플레 압력 ↑');
          addEventLog('📉 금융위기 대응', '기준금리 긴급 인하, 주가 소폭 반등');
        }
      },
      {
        label: '🚫 시장 자율 조정 방치',
        cost: 0,
        effect() {
          Sim.gdp = Math.round(Sim.gdp * 0.97);
          Sim.approvalRating = Math.max(5, Sim.approvalRating - 15);
          showNotice('🚫 방치 결정... 주가 추가 폭락, 지지율 급락!');
          addEventLog('📉 금융위기 대응', '방치 — GDP 추가 하락, 지지율 -15');
        }
      }
    ]
  }
];

let _lastDisasterTick = -1;
let _pendingDisaster = null;
const _disasterCooldowns = {};

const _disasterQueue = []; // 대기 중인 재난들

function checkDisasterEvent() {
  if (Sim.tickCount === _lastDisasterTick) return;
  _lastDisasterTick = Sim.tickCount;
  if (Math.random() > 0.12) return; // 틱당 12% 확률

  const available = DISASTERS.filter(d => {
    const lastFired = _disasterCooldowns[d.id] || -999;
    return Sim.tickCount - lastFired > 20;
  });
  if (available.length === 0) return;

  const dis = available[Math.floor(Math.random() * available.length)];
  _disasterCooldowns[dis.id] = Sim.tickCount;

  // 재난 효과 즉시 적용
  dis.apply();
  addNews(`🚨 긴급: ${dis.title} 대통령 긴급 대응 요청!`);
  addEventLog(`🚨 ${dis.title}`, dis.desc.substring(0, 50) + '...');

  // 즉시 팝업 대신 HUD 배너로 알리고 큐에 추가
  _disasterQueue.push(dis);
  showDisasterBanner(dis);
}

function showDisasterBanner(dis) {
  // 기존 배너 제거
  const old = document.getElementById('disaster-banner');
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = 'disaster-banner';
  banner.style.cssText = `
    position:fixed; top:70px; left:50%; transform:translateX(-50%);
    background:linear-gradient(135deg,rgba(255,20,50,0.15),rgba(0,0,0,0.85));
    border:1px solid rgba(255,69,96,0.6);
    border-radius:12px; padding:12px 20px; z-index:500;
    display:flex; align-items:center; gap:14px;
    font-size:13px; color:#fff;
    box-shadow:0 0 30px rgba(255,69,96,0.35);
    animation:disasterSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events:auto;
  `;
  banner.innerHTML = `
    <span style="font-size:26px;">${dis.icon}</span>
    <div>
      <div style="font-weight:700;color:#ff4560;font-size:14px;">${dis.title}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:11px;margin-top:2px;">ESC → 대통령 긴급 대응</div>
    </div>
    <div style="margin-left:auto;background:rgba(255,69,96,0.2);border:1px solid rgba(255,69,96,0.4);border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;"
      onclick="document.exitPointerLock(); showNextDisasterModal();">지금 대응 ➔</div>
  `;
  document.body.appendChild(banner);

  // 10초 후 자동 제거
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
}

function showNextDisasterModal() {
  if (_disasterQueue.length === 0) return;
  _pendingDisaster = _disasterQueue.shift();
  const banner = document.getElementById('disaster-banner');
  if (banner) banner.remove();
  openDisasterModal(_pendingDisaster);
}

function openDisasterModal(dis) {
  const modal = document.getElementById('disaster-modal');
  document.getElementById('disaster-icon').textContent = dis.icon;
  document.getElementById('disaster-title').textContent = dis.title;
  document.getElementById('disaster-desc').textContent = dis.desc;
  document.getElementById('disaster-impact').innerHTML = `<span style="color:#ff4560;">⚠️ 즉각 발생한 피해:</span><br>${dis.impact}`;

  const optBox = document.getElementById('disaster-options');
  optBox.innerHTML = '';
  dis.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'form-btn login-btn';
    btn.style.cssText = 'width:100%;text-align:left;font-size:12px;padding:10px 14px;';
    const costTxt = opt.cost > 0 ? ` — 비용 ₦${(opt.cost/100000000).toFixed(0)}억` : '';
    btn.innerHTML = `${opt.label}<span style="color:var(--text-dim);">${costTxt}</span>`;
    btn.onclick = () => {
      if (opt.cost > 0 && Sim.treasury < opt.cost) {
        showNotice('⚠️ 국고가 부족합니다!');
        return;
      }
      initAudio();
      playClick();
      opt.effect();
      _pendingDisaster = null;
      modal.style.display = 'none';
      updateDashboardData();
      updateHUD();
      // 모달 닫힌 후 자동으로 포인터 잠금 복귀
      setTimeout(() => { if (!isDashboardOpen) c.requestPointerLock(); }, 200);
    };
    optBox.appendChild(btn);
  });

  modal.style.display = 'block';
}

// 재난 체크를 시뮬레이션 틱에 연결 (bond+job 래핑 위에 추가)
const _simTickBase = Sim.tick;
Sim.tick = function() {
  _simTickBase.call(this);
  checkDisasterEvent();
};


// ════════════════════════════════════════════════════════
//   관리자 시스템 — ree1203 전용
// ════════════════════════════════════════════════════════

function isAdmin() { return currentUsername === ADMIN_ID; }

function adminLog(msg, type) {
  type = type || 'info';
  if (!isAdmin()) return;
  var ts = new Date().toLocaleTimeString('ko-KR');
  adminState.logs.unshift({ ts: ts, msg: msg, type: type });
  if (adminState.logs.length > 200) adminState.logs.pop();
  renderAdminLogs();
}

function renderAdminLogs() {
  var c = document.getElementById('admin-log-container');
  if (!c) return;
  if (adminState.logs.length === 0) {
    c.innerHTML = '<div style="color:var(--text-dim);">로그 없음</div>';
    return;
  }
  c.innerHTML = adminState.logs.map(function(l) {
    return '<div class="admin-log-entry ' + l.type + '">[' + l.ts + '] ' + l.msg + '</div>';
  }).join('');
}

function updateAdminModeStatus() {
  var active = [];
  if (adminState.godMode)      active.push('🛡️ 무적');
  if (adminState.invisible)    active.push('👻 투명');
  if (adminState.flyMode)      active.push('🦅 비행');
  if (adminState.serverLocked) active.push('🔒 서버잠금');
  var el = document.getElementById('admin-mode-status');
  if (el) el.textContent = active.length ? active.join('  |  ') : '활성 모드 없음';
  document.body.classList.toggle('admin-fly-active', adminState.flyMode);
  document.body.classList.toggle('admin-god-active', adminState.godMode);
}

function initAdminPanel() {
  var btn = document.getElementById('admin-toggle-btn');
  if (btn) btn.style.display = 'block';
  adminLog('관리자 세션 시작: ' + ADMIN_ID, 'ok');

  fetch(DB_URL + 'admin/server_locked.json')
    .then(function(r) { return r.json(); })
    .then(function(v) {
      if (v === true) {
        adminState.serverLocked = true;
        var cb = document.getElementById('toggle-serverlock');
        if (cb) cb.checked = true;
        updateAdminModeStatus();
      }
    }).catch(function() {});

  adminLogInterval = setInterval(adminCheckNotice, 5000);
  adminPlayerInterval = setInterval(adminRefreshPlayerList, 3000);
  adminLog('관리자 기능 활성화 완료', 'ok');
}

function toggleAdminPanel() {
  if (!isAdmin()) return;
  adminPanelOpen = !adminPanelOpen;
  var panel = document.getElementById('admin-panel');
  if (panel) panel.style.display = adminPanelOpen ? 'flex' : 'none';
  if (adminPanelOpen) {
    adminRefreshPlayerList();
    renderAdminLogs();
    switchAdminTab('modes');
  }
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var content = document.getElementById('admin-tab-' + tab);
  if (content) content.classList.add('active');
  var tabNames = ['modes', 'players', 'server', 'logs'];
  var idx = tabNames.indexOf(tab);
  var btns = document.querySelectorAll('.admin-tab-btn');
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'players') adminRefreshPlayerList();
  if (tab === 'logs') renderAdminLogs();
}

function adminToggle(feature, val) {
  if (!isAdmin()) return;
  switch (feature) {
    case 'godmode':
      adminState.godMode = val;
      adminLog('무적 모드 ' + (val ? '활성화' : '비활성화'), val ? 'ok' : 'info');
      if (val) { P.health = 100; P.happy = 100; P.hunger = 100; P.energy = 100; updateHUD(); }
      break;
    case 'invisible':
      adminState.invisible = val;
      adminLog('투명 모드 ' + (val ? '활성화' : '비활성화'), val ? 'ok' : 'info');
      if (!val) broadcastPlayerPosition();
      break;
    case 'fly':
      adminState.flyMode = val;
      adminState.flyY = val ? Math.max(P.h || 0, 2) : 0;
      adminLog('자유 비행 ' + (val ? '활성화 (Q↓ E↑)' : '비활성화'), val ? 'ok' : 'info');
      if (!val) { P.h = 0; P.vh = 0; }
      break;
    case 'serverlock':
      adminState.serverLocked = val;
      fetch(DB_URL + 'admin/server_locked.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(val)
      }).then(function() {
        adminLog('서버 잠금 ' + (val ? '설정' : '해제') + ' — 신규 로그인 ' + (val ? '차단' : '허용'), val ? 'warn' : 'ok');
      }).catch(function() { adminLog('서버 잠금 Firebase 저장 실패', 'error'); });
      break;
    case 'autosanction':
      adminState.autoSanction = val;
      adminLog('자동 제재 ' + (val ? '활성화' : '비활성화'), val ? 'warn' : 'info');
      break;
  }
  updateAdminModeStatus();
}

function adminTeleport() {
  if (!isAdmin()) return;
  var x = parseFloat(document.getElementById('admin-tp-x').value);
  var y = parseFloat(document.getElementById('admin-tp-y').value);
  if (isNaN(x) || isNaN(y)) { showNotice('❌ 올바른 좌표를 입력하세요.'); return; }
  var cx = Math.max(0.5, Math.min(MW - 0.5, x));
  var cy = Math.max(0.5, Math.min(MH - 0.5, y));
  P.x = cx; P.y = cy;
  if (playerGroup) playerGroup.position.set(P.x, P.h || 0, P.y);
  adminLog('순간이동 → (' + cx.toFixed(1) + ', ' + cy.toFixed(1) + ')', 'ok');
  showNotice('🌀 순간이동 완료: (' + cx.toFixed(1) + ', ' + cy.toFixed(1) + ')');
}

function adminTeleportToPlayer(uname) {
  if (!isAdmin()) return;
  var pl = otherPlayers[uname];
  if (!pl) { showNotice('❌ 플레이어를 찾을 수 없습니다.'); return; }
  P.x = pl.x + 1.5; P.y = pl.y + 1.5;
  if (playerGroup) playerGroup.position.set(P.x, P.h || 0, P.y);
  adminLog(uname + ' 위치로 순간이동 → (' + P.x.toFixed(1) + ', ' + P.y.toFixed(1) + ')', 'ok');
  showNotice('🌀 ' + uname + ' 위치로 이동');
}

function adminRefreshPlayerList() {
  if (!isAdmin()) return;
  var container = document.getElementById('admin-player-list');
  if (!container) return;
  var players = Object.entries(otherPlayers);
  if (players.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:8px;">온라인 플레이어 없음</div>';
    return;
  }
  container.innerHTML = players.map(function(entry) {
    var uname = entry[0];
    var info = entry[1];
    var px = (info.x || 0).toFixed(1);
    var py = (info.y || 0).toFixed(1);
    return '<div class="admin-player-card">' +
      '<div><div class="admin-player-name">👤 ' + uname + '</div>' +
      '<div class="admin-player-pos">X:' + px + ' Y:' + py + '</div></div>' +
      '<div class="admin-player-actions">' +
      '<button class="admin-btn admin-btn-cyan" style="padding:3px 7px;font-size:10px;" onclick="adminTeleportToPlayer(\'' + uname + '\')">이동</button>' +
      '<button class="admin-btn admin-btn-cyan" style="padding:3px 7px;font-size:10px;" onclick="adminStartSpectateTarget(\'' + uname + '\')">관전</button>' +
      '</div></div>';
  }).join('');

  players.forEach(function(entry) {
    var uname = entry[0];
    var info = entry[1];
    if (!adminState.playerPositions[uname]) adminState.playerPositions[uname] = [];
    adminState.playerPositions[uname].push({ x: info.x, y: info.y, t: Date.now() });
    if (adminState.playerPositions[uname].length > 20) adminState.playerPositions[uname].shift();
  });
}

function adminStartSpectate() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-spectate-input').value.trim();
  if (!uname) return;
  adminStartSpectateTarget(uname);
}

function adminStartSpectateTarget(uname) {
  if (!isAdmin()) return;
  if (!otherPlayers[uname]) { showNotice('❌ ' + uname + ' 은(는) 오프라인입니다.'); return; }
  adminState.spectateTarget = uname;
  var el = document.getElementById('admin-spectate-status');
  if (el) el.textContent = '📷 관전 중: ' + uname;
  adminLog('관전 시작: ' + uname, 'info');
  showNotice('👁️ ' + uname + ' 관전 시작');
}

function adminStopSpectate() {
  if (!isAdmin()) return;
  var prev = adminState.spectateTarget;
  adminState.spectateTarget = null;
  var el = document.getElementById('admin-spectate-status');
  if (el) el.textContent = '관전 중 아님';
  if (prev) { adminLog('관전 종료: ' + prev, 'info'); showNotice('👁️ 관전 종료'); }
}

async function adminSendNotice() {
  if (!isAdmin()) return;
  var msg = document.getElementById('admin-notice-input').value.trim();
  if (!msg) { showNotice('❌ 공지 내용을 입력하세요.'); return; }
  var payload = { msg: msg, from: ADMIN_ID, t: Date.now() };
  try {
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    adminLog('전체 공지 전송: "' + msg + '"', 'ok');
    showNotice('📢 [전체 공지] ' + msg);
    document.getElementById('admin-notice-input').value = '';
  } catch (e) {
    adminLog('전체 공지 전송 실패: ' + e.message, 'error');
  }
}

async function adminSendChat() {
  if (!isAdmin()) return;
  var msg = document.getElementById('admin-chat-input').value.trim();
  if (!msg) return;
  var payload = { msg: msg, from: '[관리자] ' + ADMIN_ID, t: Date.now() };
  try {
    await fetch(DB_URL + 'admin/global_chat.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    adminLog('채팅 전송: "' + msg + '"', 'ok');
    showNotice('💬 [관리자] ' + msg);
    document.getElementById('admin-chat-input').value = '';
  } catch (e) {
    adminLog('채팅 전송 실패', 'error');
  }
}

var _lastNoticeT = 0;
async function adminCheckNotice() {
  try {
    var res = await fetch(DB_URL + 'admin/global_notice.json');
    if (res.ok) {
      var data = await res.json();
      if (data && data.t && data.t > _lastNoticeT) {
        _lastNoticeT = data.t;
        if (data.from !== currentUsername) showNotice('📢 [전체 공지] ' + data.msg);
      }
    }
    var res2 = await fetch(DB_URL + 'admin/global_chat.json');
    if (res2.ok) {
      var chat = await res2.json();
      if (chat && chat.t && chat.t > _lastNoticeT) {
        _lastNoticeT = chat.t;
        if (chat.from && chat.from.indexOf(currentUsername) === -1) showNotice('💬 ' + chat.from + ': ' + chat.msg);
      }
    }
    if (currentUsername !== ADMIN_ID) {
      var lockRes = await fetch(DB_URL + 'admin/server_locked.json');
      if (lockRes.ok) {
        var locked = await lockRes.json();
        if (locked === true) showNotice('🔒 관리자가 서버를 잠금했습니다. 잠시 후 재접속해 주세요.');
      }
    }
  } catch (e) {}
}

async function adminRestart() {
  if (!isAdmin()) return;
  if (!confirm('서버 관리 데이터(공지/채팅/잠금)를 초기화하시겠습니까?')) return;
  try {
    await fetch(DB_URL + 'admin.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_locked: false, global_notice: null, global_chat: null })
    });
    adminState.serverLocked = false;
    var cb = document.getElementById('toggle-serverlock');
    if (cb) cb.checked = false;
    updateAdminModeStatus();
    adminLog('서버 관리 데이터 초기화 완료', 'ok');
    showNotice('🔄 서버 상태 초기화 완료');
  } catch (e) {
    adminLog('서버 초기화 실패: ' + e.message, 'error');
  }
}

function adminRefreshLogs() { if (isAdmin()) renderAdminLogs(); }
function adminClearLogs() {
  if (!isAdmin()) return;
  adminState.logs = [];
  renderAdminLogs();
  adminLog('로그 초기화됨', 'info');
}

function adminHackDetect() {
  if (!isAdmin()) return;
  adminLog('── 핵 탐지 스캔 시작 ──', 'info');
  var found = 0;
  var MAX_SPEED = 15;
  Object.entries(adminState.playerPositions).forEach(function(entry) {
    var uname = entry[0];
    var positions = entry[1];
    if (positions.length < 2) return;
    for (var i = 1; i < positions.length; i++) {
      var a = positions[i - 1];
      var b = positions[i];
      var dt = (b.t - a.t) / 1000;
      if (dt <= 0) continue;
      var dist = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
      var speed = dist / dt;
      if (speed > MAX_SPEED) {
        found++;
        adminLog('⚠️ 의심 플레이어: ' + uname + ' — 속도 ' + speed.toFixed(1) + ' 타일/초 (임계: ' + MAX_SPEED + ')', 'warn');
        if (adminState.autoSanction) adminSanctionPlayer(uname, '속도핵 의심');
      }
    }
  });
  if (found === 0) {
    adminLog('스캔 완료: 의심 활동 없음 ✅', 'ok');
    showNotice('✅ 핵 탐지 완료 — 의심 플레이어 없음');
  } else {
    showNotice('⚠️ 핵 탐지: ' + found + '건 의심 활동 발견');
  }
}

async function adminSanctionPlayer(uname, reason) {
  if (!isAdmin()) return;
  try {
    var res = await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json');
    var userData = await res.json();
    if (!userData) { adminLog('제재 실패: ' + uname + ' 계정 없음', 'error'); return; }
    userData.banned = true;
    userData.banReason = reason;
    userData.bannedAt = Date.now();
    userData.bannedBy = ADMIN_ID;
    await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    adminLog('제재 완료: ' + uname + ' — 사유: ' + reason, 'warn');
    showNotice('🚫 ' + uname + ' 제재 처리됨');
  } catch (e) {
    adminLog('제재 실패 (' + uname + '): ' + e.message, 'error');
  }
}

// 서버 잠금 체크 — 로그인 전처리
(function patchLoginForAdmin() {
  var loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  loginBtn.addEventListener('click', async function(e) {
    var uname = document.getElementById('username').value.trim();
    if (uname === ADMIN_ID) return;
    try {
      var lockRes = await fetch(DB_URL + 'admin/server_locked.json');
      if (lockRes.ok) {
        var locked = await lockRes.json();
        if (locked === true) {
          e.stopImmediatePropagation();
          var statusEl = document.getElementById('login-status');
          if (statusEl) {
            statusEl.textContent = '🔒 서버가 잠금 상태입니다. 나중에 다시 시도해 주세요.';
            statusEl.className = 'status-msg error';
          }
        }
      }
    } catch (_) {}
  }, true);
})();



// ════════════════════════════════════════════════════════
//   관리자 통제 시스템 — 계엄령 / 병력 / 감옥 / CCTV
// ════════════════════════════════════════════════════════

// 통제 상태
var controlState = {
  martialLaw: false,
  curfew: false,
  emergency: false,
  police: 0,
  military: 0,
  wantedList: [],
  prisonList: [],
};

// ── 탭 이름 목록 업데이트 (control 추가) ──
var _origSwitchAdminTab = switchAdminTab;
switchAdminTab = function(tab) {
  document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var content = document.getElementById('admin-tab-' + tab);
  if (content) content.classList.add('active');
  var tabNames = ['modes', 'players', 'control', 'server', 'logs'];
  var idx = tabNames.indexOf(tab);
  var btns = document.querySelectorAll('.admin-tab-btn');
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'players') adminRefreshPlayerList();
  if (tab === 'logs') renderAdminLogs();
  if (tab === 'control') adminRefreshControlUI();
};

// ── 통제 UI 갱신 ──
function adminRefreshControlUI() {
  document.getElementById('toggle-martial-law').checked = controlState.martialLaw;
  document.getElementById('toggle-curfew').checked = controlState.curfew;
  document.getElementById('toggle-emergency').checked = controlState.emergency;
  renderDeployStatus();
  renderPrisonList();
}

function renderDeployStatus() {
  var el = document.getElementById('admin-deploy-status');
  if (!el) return;
  var parts = [];
  if (controlState.police > 0)   parts.push('🚔 경찰 ' + controlState.police + '부대');
  if (controlState.military > 0) parts.push('🪖 군대 ' + controlState.military + '부대');
  el.textContent = parts.length ? parts.join('  |  ') : '배치된 병력 없음';
}

function renderPrisonList() {
  var el = document.getElementById('admin-prison-list');
  if (!el) return;
  if (controlState.prisonList.length === 0) { el.textContent = '수감자 없음'; return; }
  el.innerHTML = controlState.prisonList.map(function(p) {
    return '<span style="color:#ff4560;">🔒 ' + p + '</span>';
  }).join(' &nbsp;|&nbsp; ');
}

// ── 국가 비상 선포 토글 ──
async function adminControlToggle(feature, val) {
  if (!isAdmin()) return;
  controlState[feature] = val;

  var labels = { martialLaw: '계엄령', curfew: '통행금지', emergency: '비상사태' };
  var icons  = { martialLaw: '⚔️', curfew: '🌙', emergency: '🆘' };
  var label = labels[feature] || feature;
  var icon  = icons[feature]  || '🚨';

  var noticeMsg = val
    ? icon + ' [전국 ' + label + ' 선포] 관리자 명령에 의해 ' + label + '이 발동되었습니다.'
    : icon + ' [' + label + ' 해제] ' + label + '이 해제되었습니다.';

  // Firebase에 상태 저장
  try {
    await fetch(DB_URL + 'admin/control/' + feature + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: val, t: Date.now(), by: ADMIN_ID })
    });
    adminLog((val ? '선포' : '해제') + ': ' + label, val ? 'warn' : 'info');
  } catch (e) {
    adminLog(label + ' Firebase 저장 실패', 'error');
  }

  // 전체 공지 전송
  try {
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: noticeMsg, from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {}

  showNotice(noticeMsg);
  adminUpdateControlStatus();
}

// ── 병력 배치 ──
async function adminDeploy(type) {
  if (!isAdmin()) return;
  if (type === 'police')   controlState.police++;
  if (type === 'military') controlState.military++;

  var label = type === 'police' ? '🚔 경찰' : '🪖 군대';
  var count = type === 'police' ? controlState.police : controlState.military;
  var msg = label + ' ' + count + '부대가 배치되었습니다.';

  try {
    await fetch(DB_URL + 'admin/control/deploy.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ police: controlState.police, military: controlState.military, t: Date.now(), by: ADMIN_ID })
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: msg, from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {}

  renderDeployStatus();
  adminLog('배치: ' + label + ' (총 ' + count + '부대)', 'warn');
  showNotice(msg);
}

async function adminRecallAll() {
  if (!isAdmin()) return;
  controlState.police = 0;
  controlState.military = 0;

  try {
    await fetch(DB_URL + 'admin/control/deploy.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ police: 0, military: 0, t: Date.now(), by: ADMIN_ID })
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: '↩️ 전체 병력이 철수하였습니다.', from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {}

  renderDeployStatus();
  adminLog('전체 병력 철수 완료', 'info');
  showNotice('↩️ 전체 병력 철수 완료');
}

// ── 수배 ──
async function adminWanted() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-wanted-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  var msg = '🔍 [수배령] ' + uname + ' 이(가) 전국 수배 대상으로 지정되었습니다.';
  try {
    await fetch(DB_URL + 'admin/control/wanted/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: Date.now(), by: ADMIN_ID })
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: msg, from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {}

  if (!controlState.wantedList.includes(uname)) controlState.wantedList.push(uname);
  document.getElementById('admin-wanted-input').value = '';
  adminLog('수배 등록: ' + uname, 'warn');
  showNotice(msg);
}

// ── 감옥 수감 / 석방 ──
async function adminPrisonSend() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-prison-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  try {
    var res = await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json');
    if (!res.ok) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }
    var userData = await res.json();
    if (!userData) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }

    userData.imprisoned = true;
    userData.imprisonedAt = Date.now();
    userData.imprisonedBy = ADMIN_ID;
    // 감옥 좌표로 강제 이동 (맵 외곽 안전 지점)
    userData.x = 1.5;
    userData.y = 1.5;

    await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: '🔒 [수감] ' + uname + ' 이(가) 감옥에 수감되었습니다.', from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {
    adminLog('수감 실패 (' + uname + '): ' + e.message, 'error');
    return;
  }

  if (!controlState.prisonList.includes(uname)) controlState.prisonList.push(uname);
  document.getElementById('admin-prison-input').value = '';
  renderPrisonList();
  adminLog('수감: ' + uname, 'warn');
  showNotice('🔒 ' + uname + ' 수감 완료');
}

async function adminPrisonFree() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-prison-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  try {
    var res = await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json');
    if (!res.ok) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }
    var userData = await res.json();
    if (!userData) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }

    userData.imprisoned = false;
    userData.releasedAt = Date.now();
    userData.releasedBy = ADMIN_ID;
    userData.x = 32.5;
    userData.y = 32.5;

    await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: '🔓 [석방] ' + uname + ' 이(가) 석방되었습니다.', from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {
    adminLog('석방 실패 (' + uname + '): ' + e.message, 'error');
    return;
  }

  var idx = controlState.prisonList.indexOf(uname);
  if (idx !== -1) controlState.prisonList.splice(idx, 1);
  document.getElementById('admin-prison-input').value = '';
  renderPrisonList();
  adminLog('석방: ' + uname, 'ok');
  showNotice('🔓 ' + uname + ' 석방 완료');
}

// ── CCTV 확인 ──
async function adminCCTV() {
  if (!isAdmin()) return;
  adminLog('── CCTV 전체 조회 시작 ──', 'info');
  switchAdminTab('logs');

  try {
    var res = await fetch(DB_URL + 'online_players.json');
    if (!res.ok) { adminLog('CCTV: Firebase 연결 실패', 'error'); return; }
    var data = await res.json();
    if (!data) { adminLog('CCTV: 현재 온라인 플레이어 없음', 'info'); return; }

    var now = Date.now();
    var entries = Object.entries(data);
    adminLog('CCTV 조회 — 온라인 ' + entries.length + '명', 'info');
    entries.forEach(function(entry) {
      var uname = entry[0];
      var info = entry[1];
      var age = Math.round((now - (info.t || now)) / 1000);
      var isSuspect = controlState.wantedList.includes(uname) || controlState.prisonList.includes(uname);
      var flag = isSuspect ? ' ⚠️[수배/수감]' : '';
      adminLog(
        '📹 ' + uname + flag +
        ' | 위치: (' + (info.x || 0).toFixed(1) + ', ' + (info.y || 0).toFixed(1) + ')' +
        ' | ' + age + '초 전 갱신',
        isSuspect ? 'warn' : 'info'
      );
    });
    showNotice('📹 CCTV 조회 완료 — ' + entries.length + '명 확인');
  } catch (e) {
    adminLog('CCTV 조회 실패: ' + e.message, 'error');
  }
}

// ── 긴급 방송 ──
async function adminEmergencyBroadcast() {
  if (!isAdmin()) return;
  var msg = document.getElementById('admin-broadcast-input').value.trim();
  if (!msg) { showNotice('❌ 방송 내용을 입력하세요.'); return; }

  var fullMsg = '📻 [긴급 방송] ' + msg;
  try {
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: fullMsg, from: ADMIN_ID, t: Date.now() })
    });
  } catch (e) {
    adminLog('긴급 방송 전송 실패', 'error');
    return;
  }

  document.getElementById('admin-broadcast-input').value = '';
  adminLog('긴급 방송: "' + msg + '"', 'warn');
  showNotice(fullMsg);
}

// ── 통제 상태 HUD 표시 갱신 (기존 updateAdminModeStatus 확장) ──
function adminUpdateControlStatus() {
  var active = [];
  if (controlState.martialLaw) active.push('⚔️ 계엄령');
  if (controlState.curfew)     active.push('🌙 통행금지');
  if (controlState.emergency)  active.push('🆘 비상사태');
  if (controlState.police > 0)   active.push('🚔 경찰' + controlState.police);
  if (controlState.military > 0) active.push('🪖 군대' + controlState.military);

  // 기존 모드 상태도 포함
  if (adminState.godMode)    active.push('🛡️ 무적');
  if (adminState.invisible)  active.push('👻 투명');
  if (adminState.flyMode)    active.push('🦅 비행');

  var el = document.getElementById('admin-mode-status');
  if (el) el.textContent = active.length ? active.join('  |  ') : '활성 모드 없음';
  document.body.classList.toggle('admin-fly-active', adminState.flyMode);
  document.body.classList.toggle('admin-god-active', adminState.godMode || controlState.martialLaw || controlState.emergency);
}

// initAdminPanel에 통제 상태 Firebase 동기화 추가
var _origInitAdminPanel = initAdminPanel;
initAdminPanel = function() {
  _origInitAdminPanel();
  // 통제 상태 불러오기
  fetch(DB_URL + 'admin/control.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data) return;
      if (data.martialLaw && data.martialLaw.active) controlState.martialLaw = true;
      if (data.curfew && data.curfew.active)         controlState.curfew     = true;
      if (data.emergency && data.emergency.active)   controlState.emergency  = true;
      if (data.deploy) {
        controlState.police   = data.deploy.police   || 0;
        controlState.military = data.deploy.military || 0;
      }
      // 수배 목록
      if (data.wanted) {
        controlState.wantedList = Object.keys(data.wanted);
      }
      adminLog('통제 상태 동기화 완료', 'ok');
    }).catch(function() {});

  // 수감자 목록 불러오기 (users에서 imprisoned:true 조회)
  fetch(DB_URL + 'users.json')
    .then(function(r) { return r.json(); })
    .then(function(users) {
      if (!users) return;
      Object.entries(users).forEach(function(entry) {
        if (entry[1] && entry[1].imprisoned) controlState.prisonList.push(entry[0]);
      });
      if (controlState.prisonList.length) adminLog('수감자 ' + controlState.prisonList.length + '명 확인', 'warn');
    }).catch(function() {});
};

// 일반 플레이어 — 수감 상태 및 계엄령 체크 (로그인 후 폴링)
var _controlPollInterval = null;
var _origStartMultiplayer = startMultiplayer;
startMultiplayer = function() {
  _origStartMultiplayer();
  if (_controlPollInterval) clearInterval(_controlPollInterval);
  _controlPollInterval = setInterval(async function() {
    try {
      var res = await fetch(DB_URL + 'admin/control.json');
      if (!res.ok) return;
      var data = await res.json();
      if (!data) return;

      // 계엄령 / 비상사태 HUD 경고
      if (data.martialLaw && data.martialLaw.active && currentUsername !== ADMIN_ID) {
        var el = document.getElementById('dist-name');
        if (el) el.style.color = '#ff4560';
      }

      // 수감 상태 — 강제 이동
      if (currentUsername && currentUsername !== ADMIN_ID) {
        var uRes = await fetch(DB_URL + 'users/' + encodeURIComponent(currentUsername) + '.json');
        if (uRes.ok) {
          var uData = await uRes.json();
          if (uData && uData.imprisoned) {
            P.x = 1.5; P.y = 1.5;
            if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
            showNotice('🔒 당신은 현재 수감 중입니다.');
          }
        }
      }
    } catch (e) {}
  }, 8000);
};



// ════════════════════════════════════════════════════════
//   관리자 국민 관리 시스템
// ════════════════════════════════════════════════════════

// 탭 이름 목록에 citizens 추가 (switchAdminTab 재정의)
var _origSwitchAdminTab2 = switchAdminTab;
switchAdminTab = function(tab) {
  document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var content = document.getElementById('admin-tab-' + tab);
  if (content) content.classList.add('active');
  var tabNames = ['modes', 'players', 'citizens', 'control', 'server', 'logs'];
  var idx = tabNames.indexOf(tab);
  var btns = document.querySelectorAll('.admin-tab-btn');
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'players')  adminRefreshPlayerList();
  if (tab === 'logs')     renderAdminLogs();
  if (tab === 'control')  adminRefreshControlUI();
  if (tab === 'citizens') adminCitizenSearch();
};

// ── 유저 데이터 로드 헬퍼 ──
async function adminLoadUser(uname) {
  var res = await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json');
  if (!res.ok) return null;
  var data = await res.json();
  return data;
}

async function adminSaveUser(uname, data) {
  await fetch(DB_URL + 'users/' + encodeURIComponent(uname) + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// ── 검색창 대상 유저명 가져오기 ──
function adminGetTargetUser() {
  var val = document.getElementById('admin-citizen-search').value.trim();
  if (!val) { showNotice('❌ 유저명을 먼저 검색하세요.'); return null; }
  return val;
}

// ── 국민 검색 ──
async function adminCitizenSearch() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-citizen-search').value.trim();
  var el = document.getElementById('admin-citizen-result');
  if (!uname) { if (el) el.textContent = '유저명을 검색하세요.'; return; }

  if (el) el.textContent = '조회 중...';
  try {
    var data = await adminLoadUser(uname);
    if (!data) {
      if (el) el.innerHTML = '<span style="color:#ff4560;">존재하지 않는 유저입니다.</span>';
      return;
    }

    var badges = [];
    if (data.citizenship)  badges.push('<span style="color:#00e5ff;">🪪 시민권</span>');
    if (data.vip)          badges.push('<span style="color:#ffb030;">⭐ VIP</span>');
    if (data.blacklisted)  badges.push('<span style="color:#ff4560;">🖤 블랙리스트</span>');
    if (data.blocked)      badges.push('<span style="color:#ff4560;">🔇 차단됨</span>');
    if (data.deported)     badges.push('<span style="color:#ff4560;">🚫 추방됨</span>');
    if (data.imprisoned)   badges.push('<span style="color:#ff4560;">🔒 수감 중</span>');
    if (data.warnCount)    badges.push('<span style="color:#ffb030;">⚠️ 경고 ' + data.warnCount + '회</span>');

    if (el) el.innerHTML =
      '<strong style="color:#00e5ff;">' + uname + '</strong>' +
      (badges.length ? '&nbsp;&nbsp;' + badges.join('&nbsp;') : '&nbsp;&nbsp;<span style="color:#00e676;">정상</span>') +
      '<br><span style="color:var(--text-dim);font-size:10px;">💰 ' + (data.money || 0).toLocaleString() +
      ' ₦&nbsp;|&nbsp;❤️ ' + (data.health || 0) +
      '&nbsp;|&nbsp;📍 (' + (data.x || 0).toFixed(1) + ', ' + (data.y || 0).toFixed(1) + ')</span>';
    adminLog('국민 조회: ' + uname, 'info');
  } catch (e) {
    if (el) el.innerHTML = '<span style="color:#ff4560;">조회 실패: ' + e.message + '</span>';
  }
}

// ── 국민 추가 ──
async function adminAddCitizen() {
  if (!isAdmin()) return;
  var uid = document.getElementById('admin-add-id').value.trim();
  var pw  = document.getElementById('admin-add-pw').value.trim();
  if (!uid || !pw) { showNotice('❌ 아이디와 비밀번호를 모두 입력하세요.'); return; }

  var usernameRegex = /^[a-zA-Z0-9가-힣_]{2,15}$/;
  if (!usernameRegex.test(uid)) { showNotice('❌ 아이디는 2~15자 한글/영문/숫자/_만 가능합니다.'); return; }

  try {
    var existing = await adminLoadUser(uid);
    if (existing) { showNotice('❌ 이미 존재하는 아이디입니다: ' + uid); return; }

    var newUser = {
      password: pw, x: 32.5, y: 32.5, angle: -1.5708,
      health: 100, happy: 75, hunger: 80, energy: 100, money: 500000,
      knowledge: 0, diploma: '고등학교 졸업',
      citizenship: false, vip: false, blacklisted: false, blocked: false,
      createdBy: ADMIN_ID, createdAt: Date.now(),
      portfolio: { NEO:0, LHM:0, HYH:0, HAN:0, SEC:0, HWA:0, PLI:0, LGU:0, COD:0, WOO:0, TEN:0 }
    };
    await adminSaveUser(uid, newUser);
    document.getElementById('admin-add-id').value = '';
    document.getElementById('admin-add-pw').value = '';
    adminLog('국민 추가: ' + uid, 'ok');
    showNotice('✅ 국민 추가 완료: ' + uid);
  } catch (e) {
    adminLog('국민 추가 실패: ' + e.message, 'error');
  }
}

// ── 국민 상태 / 권한 액션 ──
async function adminCitizenAction(action) {
  if (!isAdmin()) return;
  var uname = adminGetTargetUser();
  if (!uname) return;

  var actionMap = {
    deport:          { field: 'deported',    val: true,  label: '추방',       icon: '🚫', color: 'warn' },
    block:           { field: 'blocked',     val: true,  label: '차단',       icon: '🔇', color: 'warn' },
    unblock:         { field: 'blocked',     val: false, label: '차단 해제',  icon: '✅', color: 'ok'   },
    warn:            { field: 'warnInc',     val: true,  label: '경고',       icon: '⚠️', color: 'warn' },
    citizen_grant:   { field: 'citizenship', val: true,  label: '시민권 지급',icon: '🪪', color: 'ok'   },
    citizen_revoke:  { field: 'citizenship', val: false, label: '시민권 박탈',icon: '❌', color: 'warn' },
    vip:             { field: 'vip',         val: true,  label: 'VIP 지정',   icon: '⭐', color: 'ok'   },
    blacklist:       { field: 'blacklisted', val: true,  label: '블랙리스트', icon: '🖤', color: 'warn' },
  };

  var cfg = actionMap[action];
  if (!cfg) return;

  try {
    var data = await adminLoadUser(uname);
    if (!data) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }

    if (cfg.field === 'warnInc') {
      data.warnCount = (data.warnCount || 0) + 1;
      data.lastWarnAt = Date.now();
      data.lastWarnBy = ADMIN_ID;
    } else {
      data[cfg.field] = cfg.val;
    }

    // 추방 시 위치 초기화 + 잔고 몰수
    if (action === 'deport') {
      data.x = -999; data.y = -999;
      data.money = 0;
      data.deportedAt = Date.now();
      data.deportedBy = ADMIN_ID;
    }

    await adminSaveUser(uname, data);

    // 전체 공지
    var noticeMsg = cfg.icon + ' [관리자] ' + uname + ' — ' + cfg.label + ' 처리되었습니다.';
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: noticeMsg, from: ADMIN_ID, t: Date.now() })
    });

    adminLog(cfg.label + ': ' + uname, cfg.color);
    showNotice(cfg.icon + ' ' + uname + ' ' + cfg.label + ' 완료');
    adminCitizenSearch(); // 결과 갱신
  } catch (e) {
    adminLog(cfg.label + ' 실패 (' + uname + '): ' + e.message, 'error');
  }
}

// ── 온라인 국민 확인 ──
async function adminOnlineCitizens() {
  if (!isAdmin()) return;
  var el = document.getElementById('admin-citizen-status');
  if (el) el.textContent = '조회 중...';
  try {
    var res = await fetch(DB_URL + 'online_players.json');
    if (!res.ok) throw new Error('연결 실패');
    var data = await res.json();
    if (!data || Object.keys(data).length === 0) {
      if (el) el.textContent = '현재 온라인 국민 없음';
      adminLog('온라인 국민 확인: 0명', 'info');
      return;
    }

    var now = Date.now();
    var lines = [];
    Object.entries(data).forEach(function(entry) {
      var uname = entry[0];
      var info  = entry[1];
      var age   = Math.round((now - (info.t || now)) / 1000);
      if (age > 30) return; // 30초 초과는 오프라인 취급
      lines.push('🟢 ' + uname + ' (' + (info.x||0).toFixed(1) + ', ' + (info.y||0).toFixed(1) + ') — ' + age + '초 전');
    });

    if (el) el.innerHTML = lines.length
      ? lines.map(function(l) { return '<div>' + l + '</div>'; }).join('')
      : '현재 온라인 국민 없음';

    adminLog('온라인 국민 확인: ' + lines.length + '명', 'ok');
    showNotice('🌐 온라인 국민: ' + lines.length + '명');
  } catch (e) {
    if (el) el.textContent = '조회 실패: ' + e.message;
    adminLog('온라인 국민 조회 실패', 'error');
  }
}

// ── 국민 활동 기록 보기 ──
async function adminCitizenActivityLog() {
  if (!isAdmin()) return;
  var uname = adminGetTargetUser();
  if (!uname) return;

  switchAdminTab('logs');
  adminLog('── ' + uname + ' 활동 기록 조회 ──', 'info');

  try {
    var data = await adminLoadUser(uname);
    if (!data) { adminLog(uname + ': 존재하지 않는 유저', 'error'); return; }

    // 기록 가능한 필드 출력
    var fields = [
      { key: 'createdAt',   label: '계정 생성',     fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'createdBy',   label: '생성자',         fmt: function(v) { return v; } },
      { key: 'lastWarnAt',  label: '마지막 경고',    fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'warnCount',   label: '경고 횟수',      fmt: function(v) { return v + '회'; } },
      { key: 'bannedAt',    label: '밴 일시',        fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'banReason',   label: '밴 사유',        fmt: function(v) { return v; } },
      { key: 'deportedAt',  label: '추방 일시',      fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'imprisonedAt',label: '수감 일시',      fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'releasedAt',  label: '석방 일시',      fmt: function(v) { return new Date(v).toLocaleString('ko-KR'); } },
      { key: 'citizenship', label: '시민권',         fmt: function(v) { return v ? '있음' : '없음'; } },
      { key: 'vip',         label: 'VIP',            fmt: function(v) { return v ? '지정됨' : '없음'; } },
      { key: 'blacklisted', label: '블랙리스트',     fmt: function(v) { return v ? '등록됨' : '없음'; } },
      { key: 'blocked',     label: '차단 상태',      fmt: function(v) { return v ? '차단 중' : '정상'; } },
      { key: 'deported',    label: '추방 상태',      fmt: function(v) { return v ? '추방됨' : '정상'; } },
      { key: 'imprisoned',  label: '수감 상태',      fmt: function(v) { return v ? '수감 중' : '정상'; } },
      { key: 'money',       label: '잔고',           fmt: function(v) { return v.toLocaleString() + ' ₦'; } },
      { key: 'health',      label: '건강',           fmt: function(v) { return v; } },
      { key: 'x',           label: '마지막 위치 X',  fmt: function(v) { return v.toFixed(2); } },
      { key: 'y',           label: '마지막 위치 Y',  fmt: function(v) { return v.toFixed(2); } },
    ];

    var found = false;
    fields.forEach(function(f) {
      if (data[f.key] !== undefined && data[f.key] !== null) {
        var type = 'info';
        if (f.key.indexOf('warn') !== -1 || f.key.indexOf('ban') !== -1 ||
            f.key.indexOf('deport') !== -1 || f.key === 'blacklisted' ||
            f.key === 'blocked' || f.key === 'imprisoned') type = 'warn';
        if (f.key === 'citizenship' && data[f.key]) type = 'ok';
        if (f.key === 'vip' && data[f.key]) type = 'ok';
        adminLog('[' + uname + '] ' + f.label + ': ' + f.fmt(data[f.key]), type);
        found = true;
      }
    });

    if (!found) adminLog('[' + uname + '] 기록 없음', 'info');
    showNotice('📋 ' + uname + ' 활동 기록 조회 완료');
  } catch (e) {
    adminLog('활동 기록 조회 실패: ' + e.message, 'error');
  }
}

// 차단/추방된 플레이어 로그인 차단 (loginBtn 전처리 확장)
(function patchLoginForCitizen() {
  var loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  loginBtn.addEventListener('click', async function(e) {
    var uname = document.getElementById('username').value.trim();
    if (uname === ADMIN_ID) return;
    try {
      var data = await adminLoadUser(uname);
      if (!data) return;
      if (data.blocked) {
        e.stopImmediatePropagation();
        var s = document.getElementById('login-status');
        if (s) { s.textContent = '🔇 계정이 차단되었습니다. 관리자에게 문의하세요.'; s.className = 'status-msg error'; }
      } else if (data.deported) {
        e.stopImmediatePropagation();
        var s2 = document.getElementById('login-status');
        if (s2) { s2.textContent = '🚫 추방된 계정입니다. 재입국이 불가능합니다.'; s2.className = 'status-msg error'; }
      }
    } catch (_) {}
  }, true);
})();


// ════════════════════════════════════════════════════════
//   관리자 이벤트 시스템 — 보물찾기 / 불꽃축제 / 골드 이벤트
// ════════════════════════════════════════════════════════

// ── switchAdminTab 최종 정의 (모든 탭 포함) ──
switchAdminTab = function(tab) {
  document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var content = document.getElementById('admin-tab-' + tab);
  if (content) content.classList.add('active');
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
    if (btn.getAttribute('onclick') === "switchAdminTab('" + tab + "')") btn.classList.add('active');
  });
  if (tab === 'players')  adminRefreshPlayerList();
  if (tab === 'logs')     renderAdminLogs();
  if (tab === 'control')  adminRefreshControlUI();
  if (tab === 'citizens') adminCitizenSearch();
};

// ────────────────────────────────────────────────────────
//  이벤트 상태
// ────────────────────────────────────────────────────────
var EVT = {
  // 보물
  treasure: {
    mesh: null,
    glowMesh: null,
    active: false,
    x: 0, y: 0,
    reward: 50000,
    id: '',
  },
  // 불꽃
  fireworks: {
    active: false,
    until: 0,
    type: 'rainbow',
    rockets: [],    // { mesh, vx, vy, vz, life, exploded }
    particles: [],  // { mesh, vx, vy, vz, life }
    spawnTimer: 0,
    rafId: null,
    lastT: 0,
  },
  // 골드
  gold: {
    active: false,
    until: 0,
    amount: 5000,
    coins: [],      // { mesh, vy, collected }
    spawnTimer: 0,
  },
};

var EVT_POLL = null; // Firebase 폴링 interval

var FW_COLORS = {
  rainbow: [0xff0000, 0xff7700, 0xffff00, 0x00ff44, 0x00c8ff, 0xaa44ff, 0xff00cc],
  gold:    [0xffb030, 0xffd700, 0xffe88a, 0xffec8b],
  blue:    [0x00c8ff, 0x0055ff, 0x00ffff, 0x88aaff],
  red:     [0xff4560, 0xff0000, 0xff6666, 0xff2244],
  sakura:  [0xffb7c5, 0xff88aa, 0xffc8d8, 0xff5599, 0xffffff],
};

// ────────────────────────────────────────────────────────
//  보물 찾기
// ────────────────────────────────────────────────────────
function adminTreasurePlace() {
  if (!isAdmin()) return;
  var tx = parseFloat(document.getElementById('ev-treasure-x').value);
  var ty = parseFloat(document.getElementById('ev-treasure-y').value);
  var reward = parseInt(document.getElementById('ev-treasure-reward').value) || 50000;
  if (isNaN(tx) || isNaN(ty)) {
    // 좌표 미입력 시 현재 위치 + 랜덤 오프셋
    tx = Math.round(P.x + (Math.random() * 20 - 10));
    ty = Math.round(P.y + (Math.random() * 20 - 10));
  }
  tx = Math.max(1, Math.min(62, tx));
  ty = Math.max(1, Math.min(62, ty));

  var id = 'T' + Date.now();
  EVT.treasure.x = tx; EVT.treasure.y = ty;
  EVT.treasure.reward = reward; EVT.treasure.id = id;

  // Firebase에 저장
  fetch(DB_URL + 'admin/events/treasure.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: tx, y: ty, reward: reward, id: id, active: true, by: ADMIN_ID, t: Date.now() })
  }).catch(function() {});

  _placeTreasureMesh(tx, ty);

  var msg = '🏴‍☠️ [보물 찾기] 보물이 숨겨졌습니다! 지도 어딘가에서 찾아보세요! 보상: ₦' + reward.toLocaleString();
  fetch(DB_URL + 'admin/global_notice.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg: msg, from: ADMIN_ID, t: Date.now() })
  }).catch(function() {});

  document.getElementById('ev-treasure-status').textContent = '📍 (' + tx + ', ' + ty + ') — ₦' + reward.toLocaleString();
  adminLog('보물 숨김: (' + tx + ', ' + ty + ') 보상 ₦' + reward.toLocaleString(), 'ok');
  showNotice(msg);
}

function _placeTreasureMesh(tx, ty) {
  _removeTreasureMesh();
  if (typeof scene === 'undefined') return;

  // 빛나는 구 (보물 본체)
  var geo  = new THREE.SphereGeometry(0.35, 12, 12);
  var mat  = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(tx + 0.5, 0.5, ty + 0.5);
  scene.add(mesh);
  EVT.treasure.mesh = mesh;

  // 글로우 후광
  var geo2  = new THREE.SphereGeometry(0.55, 12, 12);
  var mat2  = new THREE.MeshBasicMaterial({ color: 0xffec8b, transparent: true, opacity: 0.35, depthWrite: false });
  var glow  = new THREE.Mesh(geo2, mat2);
  glow.position.copy(mesh.position);
  scene.add(glow);
  EVT.treasure.glowMesh = glow;

  EVT.treasure.active = true;
}

function _removeTreasureMesh() {
  if (EVT.treasure.mesh && typeof scene !== 'undefined') {
    scene.remove(EVT.treasure.mesh);
    EVT.treasure.mesh = null;
  }
  if (EVT.treasure.glowMesh && typeof scene !== 'undefined') {
    scene.remove(EVT.treasure.glowMesh);
    EVT.treasure.glowMesh = null;
  }
}

function adminTreasureRemove() {
  if (!isAdmin()) return;
  _removeTreasureMesh();
  EVT.treasure.active = false;
  fetch(DB_URL + 'admin/events/treasure.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false })
  }).catch(function() {});
  document.getElementById('ev-treasure-status').textContent = '보물 없음';
  adminLog('보물 회수', 'info');
  showNotice('🏴‍☠️ 보물이 회수되었습니다.');
}

// 보물 근접 감지 (플레이어용)
function _checkTreasureProximity() {
  if (!EVT.treasure.active || !EVT.treasure.mesh) return;
  var dx = P.x - EVT.treasure.x - 0.5;
  var dz = P.y - EVT.treasure.y - 0.5;
  if (Math.sqrt(dx*dx + dz*dz) < 1.8) {
    var reward = EVT.treasure.reward;
    P.money += reward;
    updateHUD();
    _removeTreasureMesh();
    EVT.treasure.active = false;

    // Firebase에서 제거
    fetch(DB_URL + 'admin/events/treasure.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false })
    }).catch(function() {});

    // 발견 공지
    var msg = '🏴‍☠️ [보물 발견!] ' + (currentUsername || '게스트') + ' 님이 보물을 찾았습니다! (₦' + reward.toLocaleString() + ')';
    fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: msg, from: 'SYSTEM', t: Date.now() })
    }).catch(function() {});

    showNotice('🏆 보물 발견! ₦' + reward.toLocaleString() + ' 획득!');
    if (isAdmin()) {
      document.getElementById('ev-treasure-status').textContent = '발견됨 — ' + (currentUsername || '게스트');
      adminLog('보물 발견됨: ' + (currentUsername || '게스트'), 'ok');
    }
  }
}

// 보물 애니메이션 (글로우 펄스)
function _animateTreasure(ts) {
  if (!EVT.treasure.mesh) return;
  EVT.treasure.mesh.position.y = 0.5 + Math.sin(ts * 0.002) * 0.12;
  EVT.treasure.mesh.rotation.y = ts * 0.001;
  if (EVT.treasure.glowMesh) {
    EVT.treasure.glowMesh.position.y = EVT.treasure.mesh.position.y;
    EVT.treasure.glowMesh.material.opacity = 0.2 + Math.sin(ts * 0.003) * 0.15;
  }
}

// ────────────────────────────────────────────────────────
//  불꽃 축제
// ────────────────────────────────────────────────────────
function adminFireworksStart() {
  if (!isAdmin()) return;
  var type = document.getElementById('ev-fw-type').value;
  var dur  = parseInt(document.getElementById('ev-fw-duration').value) || 30;
  var until = Date.now() + dur * 1000;

  EVT.fireworks.type  = type;
  EVT.fireworks.until = until;
  EVT.fireworks.active = true;

  fetch(DB_URL + 'admin/events/fireworks.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true, type: type, until: until, by: ADMIN_ID })
  }).catch(function() {});

  var label = { rainbow:'🌈 무지개', gold:'🥇 황금', blue:'💙 파란', red:'❤️ 빨간', sakura:'🌸 벚꽃' }[type] || type;
  var msg = '🎆 [불꽃 축제] ' + label + ' 불꽃이 ' + dur + '초간 하늘을 물들입니다!';
  fetch(DB_URL + 'admin/global_notice.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg: msg, from: ADMIN_ID, t: Date.now() })
  }).catch(function() {});

  document.getElementById('ev-fw-status').textContent = label + ' — ' + dur + '초';
  adminLog('불꽃 축제 시작: ' + label + ' / ' + dur + '초', 'ok');
  showNotice(msg);
  _startFireworksLoop();
}

function adminFireworksStop() {
  if (!isAdmin()) return;
  EVT.fireworks.active = false;
  EVT.fireworks.until  = 0;
  _cleanFireworks();
  fetch(DB_URL + 'admin/events/fireworks.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false })
  }).catch(function() {});
  document.getElementById('ev-fw-status').textContent = '불꽃 없음';
  adminLog('불꽃 축제 중지', 'info');
  showNotice('🎆 불꽃 축제가 종료되었습니다.');
}

function _cleanFireworks() {
  if (typeof scene === 'undefined') return;
  EVT.fireworks.rockets.forEach(function(r) { scene.remove(r.mesh); r.mesh.geometry.dispose(); });
  EVT.fireworks.particles.forEach(function(p) { scene.remove(p.mesh); p.mesh.geometry.dispose(); });
  EVT.fireworks.rockets = [];
  EVT.fireworks.particles = [];
}

function _spawnRocket() {
  if (typeof scene === 'undefined') return;
  var palette = FW_COLORS[EVT.fireworks.type] || FW_COLORS.rainbow;
  var color = palette[Math.floor(Math.random() * palette.length)];
  var geo = new THREE.SphereGeometry(0.08, 5, 5);
  var mat = new THREE.MeshBasicMaterial({ color: color });
  var mesh = new THREE.Mesh(geo, mat);

  var rx = P.x + (Math.random() * 24 - 12);
  var rz = P.y + (Math.random() * 24 - 12);
  mesh.position.set(rx, 0.5, rz);
  scene.add(mesh);

  EVT.fireworks.rockets.push({
    mesh: mesh,
    color: color,
    palette: palette,
    vy: 6 + Math.random() * 4,
    vx: (Math.random() - 0.5) * 0.5,
    vz: (Math.random() - 0.5) * 0.5,
    life: 1.0,
    exploded: false,
  });
}

function _explodeRocket(rocket) {
  if (typeof scene === 'undefined') return;
  scene.remove(rocket.mesh);
  var ex = rocket.mesh.position.x;
  var ey = rocket.mesh.position.y;
  var ez = rocket.mesh.position.z;
  var count = 28 + Math.floor(Math.random() * 18);
  for (var i = 0; i < count; i++) {
    var c = rocket.palette[Math.floor(Math.random() * rocket.palette.length)];
    var geo = new THREE.SphereGeometry(0.055, 4, 4);
    var mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1.0 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ex, ey, ez);
    var theta = Math.random() * Math.PI * 2;
    var phi   = Math.random() * Math.PI;
    var spd   = 1.5 + Math.random() * 2.5;
    scene.add(mesh);
    EVT.fireworks.particles.push({
      mesh: mesh,
      vx: Math.sin(phi) * Math.cos(theta) * spd,
      vy: Math.cos(phi) * spd * 0.6 + 0.4,
      vz: Math.sin(phi) * Math.sin(theta) * spd,
      life: 1.0,
    });
  }
}

function _startFireworksLoop() {
  if (EVT.fireworks.rafId) cancelAnimationFrame(EVT.fireworks.rafId);
  EVT.fireworks.lastT = performance.now();

  function loop(now) {
    var dt = Math.min((now - EVT.fireworks.lastT) / 1000, 0.05);
    EVT.fireworks.lastT = now;

    if (!EVT.fireworks.active || Date.now() > EVT.fireworks.until) {
      if (isAdmin()) {
        adminFireworksStop();
      } else {
        EVT.fireworks.active = false;
        _cleanFireworks();
      }
      return;
    }

    // 로켓 스폰
    EVT.fireworks.spawnTimer -= dt;
    if (EVT.fireworks.spawnTimer <= 0) {
      _spawnRocket();
      EVT.fireworks.spawnTimer = 0.35 + Math.random() * 0.45;
    }

    // 로켓 업데이트
    for (var i = EVT.fireworks.rockets.length - 1; i >= 0; i--) {
      var r = EVT.fireworks.rockets[i];
      r.mesh.position.x += r.vx * dt;
      r.mesh.position.y += r.vy * dt;
      r.mesh.position.z += r.vz * dt;
      r.vy -= 1.5 * dt;
      r.life -= dt * 0.9;
      if (r.vy <= 0 || r.life <= 0) {
        _explodeRocket(r);
        EVT.fireworks.rockets.splice(i, 1);
      }
    }

    // 파티클 업데이트
    for (var j = EVT.fireworks.particles.length - 1; j >= 0; j--) {
      var p = EVT.fireworks.particles[j];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 3.5 * dt;
      p.life -= dt * 0.75;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        if (scene) scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        EVT.fireworks.particles.splice(j, 1);
      }
    }

    EVT.fireworks.rafId = requestAnimationFrame(loop);
  }
  EVT.fireworks.rafId = requestAnimationFrame(loop);
}

// ────────────────────────────────────────────────────────
//  골드 이벤트
// ────────────────────────────────────────────────────────
function adminGoldStart() {
  if (!isAdmin()) return;
  var amount = parseInt(document.getElementById('ev-gold-amount').value) || 5000;
  var dur    = parseInt(document.getElementById('ev-gold-duration').value) || 20;
  var until  = Date.now() + dur * 1000;

  EVT.gold.amount = amount;
  EVT.gold.until  = until;
  EVT.gold.active = true;

  fetch(DB_URL + 'admin/events/gold.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true, amount: amount, until: until, by: ADMIN_ID })
  }).catch(function() {});

  var msg = '💰 [골드 이벤트] ' + dur + '초간 하늘에서 골드(₦' + amount.toLocaleString() + ')가 쏟아집니다!';
  fetch(DB_URL + 'admin/global_notice.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg: msg, from: ADMIN_ID, t: Date.now() })
  }).catch(function() {});

  document.getElementById('ev-gold-status').textContent = '₦' + amount.toLocaleString() + '/개 — ' + dur + '초';
  adminLog('골드 이벤트 시작: ₦' + amount.toLocaleString() + ' / ' + dur + '초', 'ok');
  showNotice(msg);
  _startGoldLoop();
}

function adminGoldStop() {
  if (!isAdmin()) return;
  EVT.gold.active = false;
  _cleanGold();
  fetch(DB_URL + 'admin/events/gold.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false })
  }).catch(function() {});
  document.getElementById('ev-gold-status').textContent = '골드 이벤트 없음';
  adminLog('골드 이벤트 중지', 'info');
  showNotice('💰 골드 이벤트가 종료되었습니다.');
}

function _cleanGold() {
  if (typeof scene === 'undefined') return;
  EVT.gold.coins.forEach(function(c) { scene.remove(c.mesh); c.mesh.geometry.dispose(); });
  EVT.gold.coins = [];
}

function _spawnGoldCoin() {
  if (typeof scene === 'undefined') return;
  var geo = new THREE.SphereGeometry(0.22, 8, 8);
  var mat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  var mesh = new THREE.Mesh(geo, mat);
  var rx = P.x + (Math.random() * 18 - 9);
  var rz = P.y + (Math.random() * 18 - 9);
  mesh.position.set(rx, 10 + Math.random() * 5, rz);
  scene.add(mesh);
  EVT.gold.coins.push({ mesh: mesh, vy: 0, collected: false });
}

function _startGoldLoop() {
  var lastT = performance.now();
  function loop(now) {
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;

    if (!EVT.gold.active || Date.now() > EVT.gold.until) {
      if (isAdmin()) adminGoldStop();
      else { EVT.gold.active = false; _cleanGold(); }
      return;
    }

    // 코인 스폰
    EVT.gold.spawnTimer -= dt;
    if (EVT.gold.spawnTimer <= 0) {
      _spawnGoldCoin();
      EVT.gold.spawnTimer = 0.25 + Math.random() * 0.35;
    }

    // 코인 낙하 + 수집 판정
    for (var i = EVT.gold.coins.length - 1; i >= 0; i--) {
      var c = EVT.gold.coins[i];
      if (c.collected) { scene.remove(c.mesh); EVT.gold.coins.splice(i, 1); continue; }

      c.vy -= 9 * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.rotation.y += dt * 3;

      // 바닥 도달 시 정지
      if (c.mesh.position.y <= 0.3) {
        c.mesh.position.y = 0.3;
        c.vy = 0;
      }

      // 플레이어 근접 수집
      var dx = P.x - c.mesh.position.x;
      var dz = P.y - c.mesh.position.z;
      if (Math.sqrt(dx*dx + dz*dz) < 1.4) {
        c.collected = true;
        P.money += EVT.gold.amount;
        updateHUD();
        showNotice('💰 +₦' + EVT.gold.amount.toLocaleString() + ' 획득!');
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ────────────────────────────────────────────────────────
//  Firebase 이벤트 폴링 (일반 플레이어도 이벤트 동기화)
// ────────────────────────────────────────────────────────
var _evtLastFW   = 0;
var _evtLastGold = 0;
var _evtLastTreasure = '';

function _startEventPoll() {
  if (EVT_POLL) clearInterval(EVT_POLL);
  EVT_POLL = setInterval(async function() {
    try {
      var res = await fetch(DB_URL + 'admin/events.json');
      if (!res.ok) return;
      var data = await res.json();
      if (!data) return;

      // 불꽃 동기화 (관리자가 아닌 플레이어)
      if (data.fireworks && data.fireworks.active && !isAdmin()) {
        if (data.fireworks.until > Date.now() && !EVT.fireworks.active) {
          EVT.fireworks.type  = data.fireworks.type || 'rainbow';
          EVT.fireworks.until = data.fireworks.until;
          EVT.fireworks.active = true;
          _startFireworksLoop();
        }
      } else if (data.fireworks && !data.fireworks.active && EVT.fireworks.active && !isAdmin()) {
        EVT.fireworks.active = false;
        _cleanFireworks();
      }

      // 골드 동기화 (관리자가 아닌 플레이어)
      if (data.gold && data.gold.active && !isAdmin()) {
        if (data.gold.until > Date.now() && !EVT.gold.active) {
          EVT.gold.amount = data.gold.amount || 5000;
          EVT.gold.until  = data.gold.until;
          EVT.gold.active = true;
          _startGoldLoop();
        }
      } else if (data.gold && !data.gold.active && EVT.gold.active && !isAdmin()) {
        EVT.gold.active = false;
        _cleanGold();
      }

      // 보물 동기화
      if (data.treasure && data.treasure.active) {
        if (data.treasure.id !== _evtLastTreasure) {
          _evtLastTreasure = data.treasure.id;
          EVT.treasure.x = data.treasure.x;
          EVT.treasure.y = data.treasure.y;
          EVT.treasure.reward = data.treasure.reward;
          EVT.treasure.id = data.treasure.id;
          _placeTreasureMesh(data.treasure.x, data.treasure.y);
        }
      } else if (data.treasure && !data.treasure.active && EVT.treasure.active) {
        _removeTreasureMesh();
        EVT.treasure.active = false;
      }
    } catch (e) {}
  }, 4000);
}

// ── 보물·애니메이션 업데이트를 기존 게임 RAF 루프에 연결 ──
// 별도 RAF 루프로 보물 애니메이션 + 근접 감지 처리
(function _evtAnimLoop() {
  function loop(now) {
    _animateTreasure(now);
    _checkTreasureProximity();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

// startMultiplayer 이후에 이벤트 폴링 시작 (기존 래퍼 체인 끝에 연결)
var _origStartMultiplayer2 = startMultiplayer;
startMultiplayer = function() {
  _origStartMultiplayer2();
  _startEventPoll();
};



// ════════════════════════════════════════════════════════
//   관리자 신규 기능 — 순간이동모드 / 변장 / 소환 / 고정
//                    자금 / 기기차단 / 투표 / 메모장
// ════════════════════════════════════════════════════════

// ── 상태 ──
var newAdminState = {
  tpMode:     false,
  disguise:   false,
  disguiseName: '',
  frozenPlayers: {},   // { uname: true }
  deviceBans: {},      // { fingerprint: uname }
  memoSaveTimer: null,
  vote: null,          // 현재 진행 중 투표 객체
  myVoteChoice: null,
  voteTimerInterval: null,
  votePollInterval: null,
};

// ── 기기 핑거프린트 생성 (IP 대용) ──
function getDeviceFingerprint() {
  var raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ].join('|');
  var hash = 0;
  for (var i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return 'fp_' + Math.abs(hash).toString(16);
}
var MY_DEVICE_FP = getDeviceFingerprint();

// ────────────────────────────────────────────────────────
//  순간이동 모드 (미니맵 클릭)
// ────────────────────────────────────────────────────────
(function setupTpMode() {
  var mm = document.getElementById('minimap');
  if (!mm) return;
  mm.addEventListener('click', function(e) {
    if (!adminState.tpMode || !isAdmin()) return;
    var rect = mm.getBoundingClientRect();
    var px = (e.clientX - rect.left) / rect.width;
    var py = (e.clientY - rect.top)  / rect.height;
    var wx = px * MW;
    var wy = py * MH;
    wx = Math.max(0.5, Math.min(MW - 0.5, wx));
    wy = Math.max(0.5, Math.min(MH - 0.5, wy));
    P.x = wx; P.y = wy;
    if (playerGroup) playerGroup.position.set(P.x, P.h || 0, P.y);
    adminLog('순간이동 모드: (' + wx.toFixed(1) + ', ' + wy.toFixed(1) + ')', 'ok');
    showNotice('🌀 (' + wx.toFixed(1) + ', ' + wy.toFixed(1) + ') 로 순간이동');
  });
})();

// ── adminToggle 확장 (tpMode, disguise) ──
var _origAdminToggle = adminToggle;
adminToggle = function(feature, val) {
  if (feature === 'tpmode') {
    adminState.tpMode = val;
    adminLog('순간이동 모드 ' + (val ? '활성화 — 미니맵을 클릭하세요' : '비활성화'), val ? 'ok' : 'info');
    showNotice(val ? '🌀 순간이동 모드 ON — 미니맵 클릭으로 이동' : '🌀 순간이동 모드 OFF');
    updateAdminModeStatus();
    return;
  }
  if (feature === 'disguise') {
    newAdminState.disguise = val;
    var row = document.getElementById('admin-disguise-row');
    if (row) row.style.display = val ? 'block' : 'none';
    if (!val) {
      newAdminState.disguiseName = '';
      adminLog('변장 모드 해제', 'info');
      showNotice('🎭 변장 해제');
    } else {
      adminLog('변장 모드 활성화 — 이름을 입력하세요', 'ok');
      showNotice('🎭 변장 모드 ON');
    }
    updateAdminModeStatus();
    return;
  }
  _origAdminToggle(feature, val);
};

// ── updateAdminModeStatus 확장 ──
var _origUpdateModeStatus = updateAdminModeStatus;
updateAdminModeStatus = function() {
  _origUpdateModeStatus();
  // 추가 모드 배지
  var el = document.getElementById('admin-mode-status');
  if (!el) return;
  var extra = [];
  if (adminState.tpMode)         extra.push('🌀 순간이동');
  if (newAdminState.disguise)    extra.push('🎭 변장:' + (newAdminState.disguiseName || '?'));
  if (extra.length) {
    el.textContent = (el.textContent === '활성 모드 없음' ? '' : el.textContent + '  |  ') + extra.join('  |  ');
  }
};

// ── 변장 모드 적용 ──
function adminApplyDisguise() {
  if (!isAdmin()) return;
  var name = document.getElementById('admin-disguise-name').value.trim();
  if (!name) { showNotice('❌ 위장할 유저명을 입력하세요.'); return; }
  newAdminState.disguiseName = name;
  adminLog('변장: ' + name + ' 으로 위장', 'ok');
  showNotice('🎭 ' + name + ' 으로 변장 완료');
  updateAdminModeStatus();
}

// broadcastPlayerPosition 패치 — 변장 시 다른 이름으로 송출
var _origBroadcast = broadcastPlayerPosition;
broadcastPlayerPosition = function() {
  if (newAdminState.disguise && newAdminState.disguiseName && isAdmin()) {
    // 변장 이름으로 브로드캐스트
    if (!currentUsername || !isCloudConnected) return;
    var payload = { x: P.x, y: P.y, angle: P.angle, t: Date.now(), disguised: true };
    fetch(DB_URL + 'online_players/' + encodeURIComponent(newAdminState.disguiseName) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function() {});
    return;
  }
  _origBroadcast();
};

// ────────────────────────────────────────────────────────
//  플레이어 소환
// ────────────────────────────────────────────────────────
async function adminSummonPlayer() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-summon-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }
  if (!otherPlayers[uname]) { showNotice('❌ ' + uname + ' 은(는) 현재 오프라인입니다.'); return; }

  try {
    await fetch(DB_URL + 'admin/summon/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: P.x, y: P.y, t: Date.now(), by: ADMIN_ID })
    });
    var el = document.getElementById('admin-summon-status');
    if (el) el.textContent = '✅ ' + uname + ' 소환 완료';
    adminLog('플레이어 소환: ' + uname + ' → (' + P.x.toFixed(1) + ', ' + P.y.toFixed(1) + ')', 'ok');
    showNotice('🧲 ' + uname + ' 소환 완료');
  } catch (e) {
    adminLog('소환 실패: ' + e.message, 'error');
  }
}

// ────────────────────────────────────────────────────────
//  플레이어 고정
// ────────────────────────────────────────────────────────
async function adminFreezePlayer() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-freeze-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  try {
    await fetch(DB_URL + 'admin/freeze/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frozen: true, t: Date.now(), by: ADMIN_ID })
    });
    newAdminState.frozenPlayers[uname] = true;
    _renderFreezeStatus();
    adminLog('플레이어 고정: ' + uname, 'warn');
    showNotice('🫙 ' + uname + ' 이동 고정됨');
  } catch (e) {
    adminLog('고정 실패: ' + e.message, 'error');
  }
}

async function adminUnfreezePlayer() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-freeze-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  try {
    await fetch(DB_URL + 'admin/freeze/' + encodeURIComponent(uname) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frozen: false, t: Date.now() })
    });
    delete newAdminState.frozenPlayers[uname];
    _renderFreezeStatus();
    adminLog('플레이어 고정 해제: ' + uname, 'ok');
    showNotice('🔓 ' + uname + ' 이동 해제됨');
  } catch (e) {
    adminLog('고정 해제 실패: ' + e.message, 'error');
  }
}

function _renderFreezeStatus() {
  var el = document.getElementById('admin-freeze-status');
  if (!el) return;
  var list = Object.keys(newAdminState.frozenPlayers);
  el.textContent = list.length ? '🫙 고정 중: ' + list.join(', ') : '고정된 플레이어 없음';
}

// 일반 플레이어 — 소환 / 고정 / 투표 폴링
var _newAdminPollInterval = null;
var _origStartMultiplayer3 = startMultiplayer;
startMultiplayer = function() {
  _origStartMultiplayer3();
  if (_newAdminPollInterval) clearInterval(_newAdminPollInterval);
  _newAdminPollInterval = setInterval(_newAdminPoll, 3000);
};

async function _newAdminPoll() {
  try {
    // 소환 감지
    if (currentUsername && currentUsername !== ADMIN_ID) {
      var sr = await fetch(DB_URL + 'admin/summon/' + encodeURIComponent(currentUsername) + '.json');
      if (sr.ok) {
        var sd = await sr.json();
        if (sd && sd.t && (Date.now() - sd.t) < 10000) {
          P.x = sd.x + 1; P.y = sd.y + 1;
          if (playerGroup) playerGroup.position.set(P.x, 0, P.y);
          showNotice('🧲 관리자가 소환했습니다!');
          // 소환 명령 삭제
          await fetch(DB_URL + 'admin/summon/' + encodeURIComponent(currentUsername) + '.json', { method: 'DELETE' });
        }
      }
    }

    // 고정 감지
    if (currentUsername && currentUsername !== ADMIN_ID) {
      var fr = await fetch(DB_URL + 'admin/freeze/' + encodeURIComponent(currentUsername) + '.json');
      if (fr.ok) {
        var fd = await fr.json();
        if (fd && fd.frozen) {
          // 이동 키 강제 초기화
          Object.keys(K).forEach(function(k) { K[k] = false; });
          showNotice('🫙 관리자에 의해 이동이 제한되었습니다.');
        }
      }
    }

    // 기기 차단 감지
    var bdr = await fetch(DB_URL + 'admin/device_bans/' + MY_DEVICE_FP + '.json');
    if (bdr.ok) {
      var bdd = await bdr.json();
      if (bdd && bdd.banned) {
        showNotice('🚫 이 기기는 접근이 차단되었습니다.');
        // 강제 이동 불가
        Object.keys(K).forEach(function(k) { K[k] = false; });
      }
    }

    // 투표 폴링
    _pollVote();
  } catch (e) {}
}

// ────────────────────────────────────────────────────────
//  자금 지급 / 압수
// ────────────────────────────────────────────────────────
async function adminMoneyAction(action) {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-citizen-search').value.trim();
  if (!uname) { showNotice('❌ 국민 탭 검색란에서 대상을 먼저 검색하세요.'); return; }
  var amount = parseInt(document.getElementById('admin-money-amount').value) || 0;
  if (amount <= 0) { showNotice('❌ 금액을 입력하세요.'); return; }

  try {
    var data = await adminLoadUser(uname);
    if (!data) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }

    var before = data.money || 0;
    if (action === 'give') {
      data.money = before + amount;
    } else {
      data.money = Math.max(0, before - amount);
    }
    await adminSaveUser(uname, data);

    var label = action === 'give' ? '지급' : '압수';
    var icon  = action === 'give' ? '💰' : '💸';
    adminLog(label + ': ' + uname + ' ₦' + amount.toLocaleString() + ' (' + before.toLocaleString() + ' → ' + data.money.toLocaleString() + ')', 'ok');
    showNotice(icon + ' ' + uname + ' 에게 ₦' + amount.toLocaleString() + ' ' + label + ' 완료');
    adminCitizenSearch();

    // 현재 접속 중이면 실시간 반영 메시지
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg: icon + ' [관리자] ' + uname + ' 님의 자금이 ' + label + '되었습니다. (₦' + data.money.toLocaleString() + ')',
        from: ADMIN_ID, t: Date.now()
      })
    });
  } catch (e) {
    adminLog('자금 ' + (action==='give'?'지급':'압수') + ' 실패: ' + e.message, 'error');
  }
}

// ────────────────────────────────────────────────────────
//  기기 차단
// ────────────────────────────────────────────────────────
async function adminBanDevice() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-ip-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  // 해당 유저의 기기 핑거프린트 조회
  try {
    var data = await adminLoadUser(uname);
    if (!data) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }
    var fp = data.deviceFP || ('user_' + uname);

    await fetch(DB_URL + 'admin/device_bans/' + fp + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: true, uname: uname, by: ADMIN_ID, t: Date.now() })
    });

    newAdminState.deviceBans[fp] = uname;
    _renderDeviceBanList();
    adminLog('기기 차단: ' + uname + ' (fp: ' + fp + ')', 'warn');
    showNotice('🌐 ' + uname + ' 기기 차단 완료');
  } catch (e) {
    adminLog('기기 차단 실패: ' + e.message, 'error');
  }
}

async function adminUnbanDevice() {
  if (!isAdmin()) return;
  var uname = document.getElementById('admin-ip-input').value.trim();
  if (!uname) { showNotice('❌ 유저명을 입력하세요.'); return; }

  try {
    var data = await adminLoadUser(uname);
    if (!data) { showNotice('❌ 존재하지 않는 유저입니다.'); return; }
    var fp = data.deviceFP || ('user_' + uname);

    await fetch(DB_URL + 'admin/device_bans/' + fp + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: false })
    });

    delete newAdminState.deviceBans[fp];
    _renderDeviceBanList();
    adminLog('기기 차단 해제: ' + uname, 'ok');
    showNotice('✅ ' + uname + ' 기기 차단 해제');
  } catch (e) {
    adminLog('해제 실패: ' + e.message, 'error');
  }
}

function _renderDeviceBanList() {
  var el = document.getElementById('admin-ip-list');
  if (!el) return;
  var list = Object.values(newAdminState.deviceBans);
  el.textContent = list.length ? '🚫 차단: ' + list.join(', ') : '차단된 기기 없음';
}

// 로그인 시 기기 핑거프린트 저장
var _origLoginBtn = document.getElementById('loginBtn');
if (_origLoginBtn) {
  _origLoginBtn.addEventListener('click', async function() {
    var uname = document.getElementById('username').value.trim();
    if (!uname) return;
    // 잠시 후 저장 (로그인 성공 후)
    setTimeout(async function() {
      if (currentUsername === uname) {
        try {
          var data = await adminLoadUser(uname);
          if (data && !data.deviceFP) {
            data.deviceFP = MY_DEVICE_FP;
            await adminSaveUser(uname, data);
          }
        } catch (e) {}
      }
    }, 3000);
  });
}

// ────────────────────────────────────────────────────────
//  긴급 투표
// ────────────────────────────────────────────────────────
async function adminStartVote() {
  if (!isAdmin()) return;
  var question = document.getElementById('admin-vote-question').value.trim();
  var opt1     = document.getElementById('admin-vote-opt1').value.trim();
  var opt2     = document.getElementById('admin-vote-opt2').value.trim();
  var duration = parseInt(document.getElementById('admin-vote-duration').value) || 60;

  if (!question || !opt1 || !opt2) { showNotice('❌ 질문과 선택지 2개를 모두 입력하세요.'); return; }

  var voteData = {
    active: true,
    question: question,
    options: [opt1, opt2],
    votes: { '0': 0, '1': 0 },
    until: Date.now() + duration * 1000,
    by: ADMIN_ID,
    t: Date.now()
  };

  try {
    await fetch(DB_URL + 'admin/vote.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voteData)
    });
    await fetch(DB_URL + 'admin/global_notice.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: '🗳️ [긴급 투표] ' + question, from: ADMIN_ID, t: Date.now() })
    });
    adminLog('긴급 투표 시작: "' + question + '"', 'ok');
    showNotice('🗳️ 긴급 투표 시작!');
    _showVotePopup(voteData);
  } catch (e) {
    adminLog('투표 시작 실패: ' + e.message, 'error');
  }
}

async function adminEndVote() {
  if (!isAdmin()) return;
  try {
    var res = await fetch(DB_URL + 'admin/vote.json');
    var voteData = await res.json();
    if (voteData) {
      voteData.active = false;
      await fetch(DB_URL + 'admin/vote.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData)
      });
    }
    _hideVotePopup();
    adminLog('투표 강제 종료', 'info');
    showNotice('🗳️ 투표가 종료되었습니다.');
  } catch (e) {}
}

function _showVotePopup(voteData) {
  var popup = document.getElementById('vote-popup');
  if (!popup) return;
  newAdminState.vote = voteData;
  newAdminState.myVoteChoice = null;

  document.getElementById('vote-question-text').textContent = voteData.question;

  var optContainer = document.getElementById('vote-options');
  optContainer.innerHTML = voteData.options.map(function(opt, i) {
    return '<button onclick="adminCastVote(' + i + ')" class="admin-btn admin-btn-cyan" style="width:100%;text-align:left;padding:8px 12px;font-size:13px;">' + opt + '</button>';
  }).join('');

  popup.style.display = 'block';
  _updateVoteTimer(voteData);
}

function _hideVotePopup() {
  var popup = document.getElementById('vote-popup');
  if (popup) popup.style.display = 'none';
  if (newAdminState.voteTimerInterval) clearInterval(newAdminState.voteTimerInterval);
  newAdminState.vote = null;
}

function _updateVoteTimer(voteData) {
  if (newAdminState.voteTimerInterval) clearInterval(newAdminState.voteTimerInterval);
  newAdminState.voteTimerInterval = setInterval(function() {
    var left = Math.max(0, Math.ceil((voteData.until - Date.now()) / 1000));
    var el = document.getElementById('vote-timer');
    if (el) el.textContent = left + '초';
    if (left <= 0) {
      _hideVotePopup();
      showNotice('🗳️ 투표가 종료되었습니다.');
    }
  }, 1000);
}

async function adminCastVote(optIdx) {
  if (newAdminState.myVoteChoice !== null) {
    showNotice('이미 투표하셨습니다.'); return;
  }
  newAdminState.myVoteChoice = optIdx;

  // 버튼 비활성화
  var btns = document.querySelectorAll('#vote-options button');
  btns.forEach(function(b) { b.disabled = true; });
  btns[optIdx].style.background = 'rgba(0,229,255,0.3)';
  btns[optIdx].style.borderColor = '#00e5ff';

  try {
    var res = await fetch(DB_URL + 'admin/vote.json');
    var data = await res.json();
    if (!data || !data.active) { showNotice('투표가 이미 종료되었습니다.'); return; }
    data.votes = data.votes || { '0': 0, '1': 0 };
    data.votes[String(optIdx)] = (data.votes[String(optIdx)] || 0) + 1;
    await fetch(DB_URL + 'admin/vote.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    showNotice('✅ 투표 완료: ' + data.options[optIdx]);
  } catch (e) {}
}

async function _pollVote() {
  try {
    var res = await fetch(DB_URL + 'admin/vote.json');
    if (!res.ok) return;
    var data = await res.json();

    if (data && data.active && Date.now() < data.until) {
      // 투표가 활성화됐고 팝업이 아직 없으면 표시
      if (!newAdminState.vote) _showVotePopup(data);

      // 결과 업데이트
      var counts = document.getElementById('vote-counts');
      if (counts && data.options) {
        counts.innerHTML = data.options.map(function(opt, i) {
          return opt + ': <strong>' + (data.votes && data.votes[String(i)] || 0) + '표</strong>';
        }).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
      }

      // 관리자 패널 결과 표시
      if (isAdmin()) {
        var vr = document.getElementById('admin-vote-result');
        if (vr) {
          vr.innerHTML = (data.options || []).map(function(opt, i) {
            return opt + ': <strong>' + (data.votes && data.votes[String(i)] || 0) + '표</strong>';
          }).join(' | ');
        }
      }
    } else if ((!data || !data.active) && newAdminState.vote) {
      _hideVotePopup();
    }
  } catch (e) {}
}

// ────────────────────────────────────────────────────────
//  메모장
// ────────────────────────────────────────────────────────
function adminMemoAutoSave() {
  if (!isAdmin()) return;
  if (newAdminState.memoSaveTimer) clearTimeout(newAdminState.memoSaveTimer);
  var el = document.getElementById('admin-memo-status');
  if (el) el.textContent = '입력 중...';
  newAdminState.memoSaveTimer = setTimeout(function() {
    _adminMemoSave();
  }, 1200);
}

async function _adminMemoSave() {
  var text = document.getElementById('admin-memo-input').value;
  try {
    await fetch(DB_URL + 'admin/memo.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, savedAt: Date.now() })
    });
    var el = document.getElementById('admin-memo-status');
    if (el) el.textContent = '✅ ' + new Date().toLocaleTimeString('ko-KR') + ' 저장됨';
  } catch (e) {
    var el = document.getElementById('admin-memo-status');
    if (el) el.textContent = '❌ 저장 실패';
  }
}

async function adminMemoLoad() {
  if (!isAdmin()) return;
  try {
    var res = await fetch(DB_URL + 'admin/memo.json');
    if (!res.ok) { showNotice('❌ 메모 불러오기 실패'); return; }
    var data = await res.json();
    if (!data || !data.text) { showNotice('저장된 메모가 없습니다.'); return; }
    document.getElementById('admin-memo-input').value = data.text;
    var el = document.getElementById('admin-memo-status');
    if (el) el.textContent = '📂 불러옴 — ' + new Date(data.savedAt).toLocaleString('ko-KR');
    showNotice('📂 메모 불러오기 완료');
  } catch (e) {
    adminLog('메모 불러오기 실패: ' + e.message, 'error');
  }
}

async function adminMemoClear() {
  if (!isAdmin()) return;
  if (!confirm('메모를 삭제하시겠습니까?')) return;
  document.getElementById('admin-memo-input').value = '';
  try {
    await fetch(DB_URL + 'admin/memo.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '', savedAt: Date.now() })
    });
    var el = document.getElementById('admin-memo-status');
    if (el) el.textContent = '🗑️ 삭제됨';
    showNotice('🗑️ 메모 삭제 완료');
  } catch (e) {}
}

// initAdminPanel 확장 — 기기 차단 목록 + 메모 불러오기
var _origInitAdmin2 = initAdminPanel;
initAdminPanel = function() {
  // 버튼 먼저 노출 (안전망)
  var _btn = document.getElementById('admin-toggle-btn');
  if (_btn) _btn.style.display = 'block';
  try { _origInitAdmin2(); } catch (e) { console.warn('[Admin] initAdminPanel chain 오류:', e); }
  // 비동기 초기화 — 딜레이 후 실행하여 로그인 흐름과 분리
  setTimeout(function() {
    // 기기 차단 목록 불러오기
    fetch(DB_URL + 'admin/device_bans.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data) return;
        Object.entries(data).forEach(function(entry) {
          if (entry[1] && entry[1].banned) newAdminState.deviceBans[entry[0]] = entry[1].uname || entry[0];
        });
        _renderDeviceBanList();
      }).catch(function() {});
    // 메모 불러오기 (서버 탭 열 때도 호출되므로 여기서는 조용히)
    fetch(DB_URL + 'admin/memo.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.text) return;
        var inp = document.getElementById('admin-memo-input');
        if (inp) inp.value = data.text;
        var st = document.getElementById('admin-memo-status');
        if (st) st.textContent = '📂 자동 복원됨';
      }).catch(function() {});
  }, 300);
};



// ════════════════════════════════════════════
//  📱 모바일 터치 컨트롤
// ════════════════════════════════════════════

function checkIsMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 1024 && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)));
}

var isMobile = checkIsMobile();
var mCtrl = document.getElementById('m-controls');

if (isMobile) {
  document.body.classList.add('is-mobile-device');
  if (mCtrl) mCtrl.style.display = 'none'; // 로그인 전에는 숨김, 게임 시작 후 표시
} else {
  document.body.classList.remove('is-mobile-device');
  if (mCtrl) mCtrl.style.display = 'none';
}

window.addEventListener('resize', function() {
  var mobileNow = checkIsMobile();
  var ctrl = document.getElementById('m-controls');
  var lockHidden = document.getElementById('lock-screen')?.style.display === 'none';
  if (mobileNow) {
    document.body.classList.add('is-mobile-device');
    // 게임 시작 후(lock-screen 숨겨진 후)에만 컨트롤 표시
    if (ctrl) ctrl.style.display = lockHidden ? 'block' : 'none';
  } else {
    document.body.classList.remove('is-mobile-device');
    if (ctrl) ctrl.style.display = 'none';
  }
});

if (isMobile) {

  // ── 포인터락 요청 비활성화 (모바일 미지원) ──
  var _origRequestPointerLock = HTMLElement.prototype.requestPointerLock;
  HTMLElement.prototype.requestPointerLock = function() {
    try { _origRequestPointerLock.call(this); } catch(e) {}
  };

  // ── 스크롤/핀치줌 방지 (스크롤 가능한 패널 제외) ──
  var scrollableSelectors = [
    '#admin-panel', '#dashboard', '.db-body', '.db-tabs',
    '.modal-panel', '#inventory-panel', '#job-modal',
    '.table-wrapper', '.scroll-card', '.event-logs',
    '#npc-dialog-modal', '#study-modal', '#disaster-modal',
    '.admin-tab-content'
  ];
  document.addEventListener('touchmove', function(e) {
    if (!e.target.closest) return;
    for (var i = 0; i < scrollableSelectors.length; i++) {
      if (e.target.closest(scrollableSelectors[i])) return;
    }
    e.preventDefault();
  }, { passive: false });

  // ════════════════════
  //  조이스틱
  // ════════════════════
  var joyBase  = document.getElementById('m-joy-base');
  var joyKnob  = document.getElementById('m-joy-knob');
  var JOY_R    = 40; // 최대 이동 반경(px)
  var joyTouchId = null;
  var joyOriginX = 0, joyOriginY = 0;

  function joyReset() {
    joyTouchId = null;
    K['w'] = K['s'] = K['a'] = K['d'] = false;
    if (joyKnob) joyKnob.style.transform = 'translate(-50%,-50%)';
  }

  if (joyBase) {
    joyBase.addEventListener('touchstart', function(e) {
      e.preventDefault();
      if (joyTouchId !== null) return;
      var t = e.changedTouches[0];
      joyTouchId  = t.identifier;
      var r = joyBase.getBoundingClientRect();
      joyOriginX  = r.left + r.width  / 2;
      joyOriginY  = r.top  + r.height / 2;
    }, { passive: false });

    joyBase.addEventListener('touchmove', function(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== joyTouchId) continue;
        var dx = t.clientX - joyOriginX;
        var dy = t.clientY - joyOriginY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var angle = Math.atan2(dy, dx);
        var clamp = Math.min(dist, JOY_R);
        var kx = clamp * Math.cos(angle);
        var ky = clamp * Math.sin(angle);
        if (joyKnob) joyKnob.style.transform = 'translate(calc(-50% + ' + kx + 'px), calc(-50% + ' + ky + 'px))';

        // 방향 → K 키
        var th = JOY_R * 0.35;
        K['w'] = dy < -th;
        K['s'] = dy >  th;
        K['a'] = dx < -th;
        K['d'] = dx >  th;
        break;
      }
    }, { passive: false });

    joyBase.addEventListener('touchend', function(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) { joyReset(); break; }
      }
    }, { passive: false });

    joyBase.addEventListener('touchcancel', joyReset, { passive: false });
  }

  // ════════════════════
  //  카메라 터치 (기존 isDragging 충돌 방지)
  //  — 조이스틱이 아닌 캔버스 터치는 카메라 회전
  // ════════════════════
  var camTouchId = null;
  var camPrevX   = 0;
  var camSensitivity = 0.006;

  var c2 = document.getElementById('c') || document.querySelector('canvas');
  if (c2) {
    c2.addEventListener('touchstart', function(e) {
      isDragging = false; // 기존 핸들러의 회전 방지
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (camTouchId === null) {
          camTouchId = t.identifier;
          camPrevX   = t.clientX;
          camPrevY   = t.clientY;
          break;
        }
      }
    }, { passive: true });

    var camPrevY = 0;
    c2.addEventListener('touchmove', function(e) {
      isDragging = false; // 기존 핸들러 차단
      if (camTouchId === null || dlgOpen) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === camTouchId) {
          var dx = t.clientX - camPrevX;
          var dy = t.clientY - camPrevY;
          camPrevX = t.clientX;
          camPrevY = t.clientY;
          cameraYaw -= dx * camSensitivity;
          P.angle = cameraYaw;
          cameraPitch -= dy * camSensitivity * 0.6;
          cameraPitch = Math.max(-0.4, Math.min(0.8, cameraPitch));
          break;
        }
      }
    }, { passive: true });

    c2.addEventListener('touchend', function(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === camTouchId) {
          camTouchId = null;
          break;
        }
      }
    }, { passive: true });
  }

  // ════════════════════
  //  액션 버튼
  // ════════════════════
  function mbtnOn(id, keyOrFn) {
    var btn = document.getElementById(id);
    if (!btn) return;
    if (typeof keyOrFn === 'string') {
      btn.addEventListener('touchstart', function(e) { e.preventDefault(); K[keyOrFn] = true; }, { passive: false });
      btn.addEventListener('touchend',   function(e) { e.preventDefault(); K[keyOrFn] = false; }, { passive: false });
    } else {
      btn.addEventListener('touchstart', function(e) { e.preventDefault(); keyOrFn(); }, { passive: false });
    }
  }

  // 점프 (스페이스)
  mbtnOn('m-btn-jump', ' ');

  // 상호작용 (E)
  mbtnOn('m-btn-e', function() { interact(); });

  // 미니맵 토글
  mbtnOn('m-btn-map', function() {
    var mm = document.getElementById('minimap-container');
    if (mm) mm.style.display = mm.style.display === 'none' ? '' : 'none';
  });

  // 대시보드 토글
  mbtnOn('m-btn-dash', function() {
    if (typeof toggleDashboard === 'function') toggleDashboard();
  });

  // ── 게임 시작 시 컨트롤 표시 ──
  var _origStartMultiplayer4 = startMultiplayer;
  startMultiplayer = function() {
    _origStartMultiplayer4();
    if (mCtrl) mCtrl.style.display = 'block';
  };
}



// ════════════════════════════════════════════
//  📱 가로 모드 (Landscape) 지원
// ════════════════════════════════════════════

(function() {
  if (!isMobile) return;

  var rotateHint = document.getElementById('rotate-hint');

  // ── 방향 변경 시 처리 ──
  function onOrientationChange() {
    var isLandscape = window.innerWidth > window.innerHeight;

    // Three.js 렌더러 리사이즈 (약간 딜레이 — 브라우저 리플로우 대기)
    setTimeout(function() {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }

      // 조이스틱 원점 리셋 (화면 크기 바뀌었으므로)
      joyReset();

      // 힌트 오버레이 — 세로 + 게임 중일 때만 표시
      if (rotateHint) {
        var gameActive = document.body.classList.contains('game-active');
        if (!isLandscape && gameActive) {
          rotateHint.style.display = 'flex';
        } else {
          rotateHint.style.display = 'none';
        }
      }
    }, 150);
  }

  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('resize', onOrientationChange);

  // ── 게임 시작 시 body에 클래스 추가 (힌트 표시 조건) ──
  var _origStartMultiplayer5 = startMultiplayer;
  startMultiplayer = function() {
    _origStartMultiplayer5();
    document.body.classList.add('game-active');
    // 게임 시작 직후 가로 아니면 힌트 표시
    if (window.innerWidth <= window.innerHeight && rotateHint) {
      rotateHint.style.display = 'flex';
    }
  };

  // ── 초기 화면 방향 적용 ──
  onOrientationChange();
})();

// ════════════════════════════════════════════════
//  화면 방향 자동 전환: 로그인=세로(포트레이트), 게임=가로(랜드스케이프)
// ════════════════════════════════════════════════
(function() {
  if (!isMobile) return;
  if (!screen.orientation || !screen.orientation.lock) return;

  // ① 페이지 로드 시 → 세로(로그인 화면)
  screen.orientation.lock('portrait').catch(function() {});

  // ② 게임 시작 시 → 가로로 전환
  var _origStartMultiplayer6 = startMultiplayer;
  startMultiplayer = function() {
    _origStartMultiplayer6();
    screen.orientation.lock('landscape').then(function() {
      // 잠금 성공 → OS가 자동으로 가로로 회전하므로 힌트 불필요
      var hint = document.getElementById('rotate-hint');
      if (hint) hint.style.display = 'none';
    }).catch(function() {
      // 잠금 실패(권한/풀스크린 조건 미충족) → 현재 세로면 힌트 표시
      var hint = document.getElementById('rotate-hint');
      if (hint && window.innerWidth <= window.innerHeight) {
        hint.style.display = 'flex';
      }
    });
  };
})();


// ════════════════════════════════════════════════════════
//   🌤️ 환경/시간 조작 & 🚗 3D 탈것/경호원 스폰 (ree1203 전용)
// ════════════════════════════════════════════════════════

function adminSetTimePreset(preset) {
  if (preset === 'dawn')  gMin = 300;
  if (preset === 'noon')  gMin = 720;
  if (preset === 'dusk')  gMin = 1080;
  if (preset === 'night') gMin = 0;
  var hrs = strPad(Math.floor(gMin / 60), 2);
  var mins = strPad(Math.floor(gMin % 60), 2);
  adminLogAction("시간 조작: " + hrs + ":" + mins + " (" + preset + ")");
  updateAdminEnvStatus();
}

function adminSetTimeSpeed(spd) {
  adminState.timeSpeed = spd;
  adminLogAction("시간 배속 설정: " + spd + "x");
  updateAdminEnvStatus();
}

function adminSetWeather(w) {
  weatherState = w;
  weatherDuration = 999999;
  adminLogAction("날씨 변경: " + w);
  updateAdminEnvStatus();
}

function updateAdminEnvStatus() {
  var el = document.getElementById('admin-env-status');
  if (!el) return;
  var hrs = strPad(Math.floor(gMin / 60), 2);
  var mins = strPad(Math.floor(gMin % 60), 2);
  var spd = adminState.timeSpeed || 1;
  var wName = weatherLabels[weatherState] || weatherState;
  el.textContent = "현재 시간: " + hrs + ":" + mins + " | 배속: " + spd + "x | 날씨: " + wName;
}

// ── 3D 탈것 스폰 ──
var adminSpawnedVehicles = [];

function adminSpawnVehicle(type) {
  if (!scene) return;
  var px = P.x + Math.sin(P.angle) * 4;
  var py = P.y - Math.cos(P.angle) * 4;
  var grp = new THREE.Group();

  if (type === 'chopper') {
    // 🚁 대통령 전용 헬기 (동체 + 회전 로터 + 하단 서치라이트)
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x071126, metalness: 0.85, roughness: 0.2 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.9), bodyMat);
    body.castShadow = true;
    grp.add(body);

    var glassMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7, roughness: 0.1 });
    var glass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.85), glassMat);
    glass.position.set(0.7, 0.15, 0);
    grp.add(glass);

    var tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.25), bodyMat);
    tail.position.set(-1.6, 0.2, 0);
    grp.add(tail);

    var mainRotor = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    mainRotor.position.set(0, 0.65, 0);
    grp.add(mainRotor);
    grp.userData.rotor = mainRotor;

    var sLight = new THREE.PointLight(0x00e5ff, 2.5, 14);
    sLight.position.set(0, -0.4, 0);
    grp.add(sLight);

    grp.position.set(px, 1.4, py);
    grp.userData.type = 'chopper';
    adminLogAction("🚁 대통령 전용 헬기 스폰 완료");
  } else if (type === 'hypercar') {
    // 🏎️ 네오 하이퍼카 (네온 휠 + 후면 스포일러 + 듀얼 헤드라이트)
    var carMat = new THREE.MeshStandardMaterial({ color: 0x120826, metalness: 0.95, roughness: 0.1 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.48, 1.1), carMat);
    body.castShadow = true;
    grp.add(body);

    var spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 1.0), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
    spoiler.position.set(-1.1, 0.3, 0);
    grp.add(spoiler);

    var wheelMat = new THREE.MeshBasicMaterial({ color: 0x00c8ff });
    [[-0.7, 0.55], [-0.7, -0.55], [0.7, 0.55], [0.7, -0.55]].forEach(function(pos) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(pos[0], -0.15, pos[1]);
      grp.add(w);
    });

    var hLight = new THREE.PointLight(0x00e5ff, 2, 12);
    hLight.position.set(1.2, 0, 0);
    grp.add(hLight);

    grp.position.set(px, 0.35, py);
    grp.userData.type = 'hypercar';
    adminLogAction("🏎️ 네오 하이퍼카 스폰 완료");
  } else if (type === 'policecar') {
    // 🚔 고속 경찰차 (적/청 점멸 경광등)
    var pMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d, metalness: 0.8, roughness: 0.2 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.0), pMat);
    body.castShadow = true;
    grp.add(body);

    var sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.35), new THREE.MeshBasicMaterial({ color: 0xff0044 }));
    sirenR.position.set(0, 0.4, 0.2);
    grp.add(sirenR);
    var sirenB = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.35), new THREE.MeshBasicMaterial({ color: 0x0066ff }));
    sirenB.position.set(0, 0.4, -0.2);
    grp.add(sirenB);
    grp.userData.sirenR = sirenR;
    grp.userData.sirenB = sirenB;

    grp.position.set(px, 0.4, py);
    grp.userData.type = 'policecar';
    adminLogAction("🚔 고속 경찰차 스폰 완료");
  }

  grp.rotation.y = P.angle;
  scene.add(grp);
  adminSpawnedVehicles.push(grp);
  updateAdminSpawnStatus();
}

function adminClearVehicles() {
  adminSpawnedVehicles.forEach(function(v) {
    if (scene) scene.remove(v);
  });
  adminSpawnedVehicles = [];
  adminLogAction("스폰된 탈것 전체 회수 완료");
  updateAdminSpawnStatus();
}

// ── 경호원 소환 ──
var adminGuards = [];

function adminSpawnGuards(count) {
  adminDismissGuards();

  for (var i = 0; i < count; i++) {
    var gGroup = new THREE.Group();

    // 정장 몸통
    var suitMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.3 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.3), suitMat);
    body.position.y = 0.85;
    body.castShadow = true;
    gGroup.add(body);

    // 머리 & 선글라스
    var headMat = new THREE.MeshStandardMaterial({ color: 0xf5c999, roughness: 0.6 });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), headMat);
    head.position.y = 1.45;
    gGroup.add(head);

    var glasses = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    glasses.position.set(0.12, 1.47, 0);
    gGroup.add(glasses);

    var angleOffset = (i / count) * Math.PI * 2;
    gGroup.position.set(P.x + Math.cos(angleOffset) * 1.8, 0, P.y + Math.sin(angleOffset) * 1.8);
    gGroup.userData = { offsetAngle: angleOffset, dist: 1.8 };

    scene.add(gGroup);
    adminGuards.push(gGroup);
  }

  adminLogAction("대통령 밀착 경호대 " + count + "명 소환 완료");
  updateAdminSpawnStatus();
}

function adminDismissGuards() {
  adminGuards.forEach(function(g) {
    if (scene) scene.remove(g);
  });
  adminGuards = [];
  adminLogAction("경호대 해산 완료");
  updateAdminSpawnStatus();
}

function updateAdminSpawnStatus() {
  var el = document.getElementById('admin-spawn-status');
  if (!el) return;
  var vCount = adminSpawnedVehicles.length;
  var gCount = adminGuards.length;
  el.textContent = "스폰된 탈것: " + vCount + "대 | 경호원: " + gCount + "명 소환 중";
}

function updateAdminEntities(dt) {
  // 스폰 탈것 애니메이션
  adminSpawnedVehicles.forEach(function(v) {
    if (v.userData.type === 'chopper' && v.userData.rotor) {
      v.userData.rotor.rotation.y += dt * 28;
    }
    if (v.userData.type === 'policecar' && v.userData.sirenR && v.userData.sirenB) {
      var blink = Math.sin(performance.now() * 0.012) > 0;
      v.userData.sirenR.visible = blink;
      v.userData.sirenB.visible = !blink;
    }
  });

  // 경호원 추종 및 밀착 대형
  if (adminGuards.length > 0) {
    var pMoved = Math.abs(P.vx) > 0.01 || Math.abs(P.vy) > 0.01;
    adminGuards.forEach(function(g, idx) {
      var tx = P.x + Math.cos(P.angle + g.userData.offsetAngle) * g.userData.dist;
      var tz = P.y + Math.sin(P.angle + g.userData.offsetAngle) * g.userData.dist;

      g.position.x += (tx - g.position.x) * dt * 6;
      g.position.z += (tz - g.position.z) * dt * 6;

      if (pMoved) {
        g.rotation.y = P.angle;
      } else {
        g.rotation.y = P.angle + Math.sin(performance.now() * 0.002 + idx) * 0.4;
      }
    });
  }
}

// ════════════════════════════════════════════════════════
//  🏛️ 교도소 시스템 — Prison System
// ════════════════════════════════════════════════════════

var PRISON_CX = 2.0;   // 교도소 중심 X (game coord)
var PRISON_CZ = 2.0;   // 교도소 중심 Z (game Y)
var PRISON_RADIUS = 2.4; // 수감자 이동 허용 반경

var prisonState = { imprisoned: false };

// ── 교도소 3D 건물 생성 ──
function buildPrison() {
  if (!scene) return;

  var cx = PRISON_CX, cz = PRISON_CZ;
  var W = 5, D = 5, H = 4.5;

  var wallMat = new THREE.MeshStandardMaterial({ color: 0x3d3d4d, roughness: 0.88, metalness: 0.06 });
  var roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.9 });
  var barMat  = new THREE.MeshStandardMaterial({ color: 0x7a8a9a, roughness: 0.2, metalness: 0.9 });
  var signMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: new THREE.Color(0xff2222),
    emissiveIntensity: 1.2
  });
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2a, roughness: 1.0 });

  function addBox(w, h, d, mat, px, py, pz) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // 바닥
  addBox(W + 0.3, 0.12, D + 0.3, floorMat, cx, 0.06, cz);

  // 벽 3면 (북/동/서) — 남쪽은 철창
  addBox(W, H, 0.22, wallMat, cx, H / 2, cz - D / 2);         // 북벽
  addBox(0.22, H, D, wallMat, cx - W / 2, H / 2, cz);          // 서벽
  addBox(0.22, H, D, wallMat, cx + W / 2, H / 2, cz);          // 동벽

  // 지붕
  addBox(W + 0.22, 0.22, D + 0.22, roofMat, cx, H + 0.11, cz);

  // ── 철창 (남쪽) ──
  var barGeo = new THREE.CylinderGeometry(0.055, 0.055, H, 7);
  for (var bi = -2.2; bi <= 2.25; bi += 0.44) {
    var bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(cx + bi, H / 2, cz + D / 2);
    bar.castShadow = true;
    scene.add(bar);
  }
  // 가로 철창 (3줄)
  [0.7, 1.9, 3.3].forEach(function(y) {
    addBox(W, 0.07, 0.07, barMat, cx, y, cz + D / 2);
  });
  // 문기둥 (양쪽)
  addBox(0.22, H, 0.7, wallMat, cx - W / 2 + 0.11, H / 2, cz + D / 2);
  addBox(0.22, H, 0.7, wallMat, cx + W / 2 - 0.11, H / 2, cz + D / 2);

  // ── 지붕 위 교도소 간판 (붉은 박스) ──
  addBox(3.2, 0.45, 0.14, signMat, cx, H + 0.55, cz - D / 2 + 0.08);

  // ── 내부 붉은 조명 ──
  var innerLight = new THREE.PointLight(0xff3322, 1.1, 8, 2);
  innerLight.position.set(cx, H * 0.65, cz - 0.5);
  scene.add(innerLight);

  // ── 외부 경고등 (점멸) ──
  var warnLight = new THREE.PointLight(0xff0000, 0, 6, 1);
  warnLight.position.set(cx, H + 1.0, cz + D / 2 + 0.5);
  scene.add(warnLight);
  setInterval(function() {
    warnLight.intensity = warnLight.intensity > 0.5 ? 0 : 1.4;
  }, 700);
}

// scene 준비 완료 후 교도소 건물 생성
var _prisonBuildCheck = setInterval(function() {
  if (typeof scene !== 'undefined' && scene && scene.children && scene.children.length > 5) {
    clearInterval(_prisonBuildCheck);
    buildPrison();
  }
}, 800);

// ── 수감 상태 폴링 (3초마다) ──
setInterval(async function() {
  if (!currentUsername || !isCloudConnected) return;
  try {
    var r = await fetch(DB_URL + 'users/' + encodeURIComponent(currentUsername) + '.json');
    if (!r.ok) return;
    var d = await r.json();
    var wasImprisoned = prisonState.imprisoned;
    prisonState.imprisoned = !!(d && d.imprisoned);

    if (prisonState.imprisoned && !wasImprisoned) {
      // 방금 수감 → 교도소로 강제 이동
      P.x = PRISON_CX; P.y = PRISON_CZ;
      if (typeof playerGroup !== 'undefined' && playerGroup) {
        playerGroup.position.set(P.x, 0, P.y);
      }
      showNotice('⛓️ 관리자에 의해 교도소에 수감되었습니다!');
    } else if (!prisonState.imprisoned && wasImprisoned) {
      // 석방
      showNotice('🔓 교도소에서 석방되었습니다! 자유롭게 이동하세요.');
    }

    var hud = document.getElementById('prison-hud');
    if (hud) hud.style.display = prisonState.imprisoned ? 'flex' : 'none';
  } catch (e) {}
}, 3000);

// ── 수감자 이동 제한 (150ms마다 위치 클램프) ──
setInterval(function() {
  if (!prisonState.imprisoned) return;
  if (typeof P === 'undefined' || typeof playerGroup === 'undefined') return;

  var dx = P.x - PRISON_CX;
  var dz = P.y - PRISON_CZ;
  var dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > PRISON_RADIUS) {
    var r = PRISON_RADIUS / dist;
    P.x = PRISON_CX + dx * r;
    P.y = PRISON_CZ + dz * r;
    if (playerGroup) playerGroup.position.set(P.x, P.h || 0, P.y);
  }
}, 150);

// ════════════════════════════════════════════════════════
//  👁️ 관전 모드 (Spectator Mode) — 향상된 기능
// ════════════════════════════════════════════════════════
(function() {
  if (typeof isAdmin !== 'function') return;

  // ── ① broadcastPlayerPosition 패치: 관전 중이면 spectator 플래그 포함 송출 ──
  var _origBroadcastSpec = broadcastPlayerPosition;
  broadcastPlayerPosition = function() {
    // 관전 중인 관리자 → 자기 위치를 spectator:true 로 전송 (다른 플레이어가 렌더링 제외)
    if (adminState.spectateTarget && isAdmin() && currentUsername && isCloudConnected) {
      fetch(DB_URL + 'online_players/' + encodeURIComponent(currentUsername) + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: P.x, y: P.y, angle: P.angle, t: Date.now(), spectator: true })
      }).catch(function() {});
      return;
    }
    _origBroadcastSpec();
  };

  // ── ② 관전 HUD 오버레이 생성 ──
  var spHud = document.createElement('div');
  spHud.id = 'spectator-hud';
  Object.assign(spHud.style, {
    display: 'none',
    position: 'fixed',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.72)',
    border: '1.5px solid rgba(0,229,255,0.55)',
    borderRadius: '40px',
    padding: '8px 22px',
    color: '#fff',
    fontSize: '13px',
    pointerEvents: 'none',
    zIndex: '6000',
    backdropFilter: 'blur(6px)',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(spHud);

  function updateSpHud() {
    var tgt = adminState.spectateTarget;
    if (!tgt) { spHud.style.display = 'none'; return; }
    spHud.style.display = 'block';
    spHud.innerHTML = '👁️ &nbsp;<strong style="color:#00e5ff;">' + tgt + '</strong>&nbsp; 관전 중 &nbsp;·&nbsp; <span style="color:rgba(255,255,255,0.5);font-size:11px;">플레이어 탭 → 중지</span>';
  }

  // ── ③ adminStartSpectateTarget / adminStopSpectate 래핑 ──
  var _origStartSpec = adminStartSpectateTarget;
  adminStartSpectateTarget = function(uname) {
    _origStartSpec(uname);
    // 관전 시작 직후 자신의 플레이어 모델 숨기기 (로컬)
    if (typeof playerGroup !== 'undefined' && playerGroup) {
      playerGroup.visible = false;
    }
    updateSpHud();
  };

  var _origStopSpec = adminStopSpectate;
  adminStopSpectate = function() {
    _origStopSpec();
    // 관전 종료 → 자신의 모델 다시 표시
    if (typeof playerGroup !== 'undefined' && playerGroup) {
      playerGroup.visible = true;
    }
    // 위치 재브로드캐스트 (spectator 플래그 제거)
    setTimeout(broadcastPlayerPosition, 200);
    updateSpHud();
  };

  // ── ④ 플레이어 목록 "관전" 버튼 클릭 시 관전 모드 자동 활성 ──
  // adminRefreshPlayerList 이미 관전 버튼 포함 — 추가 작업 불필요
})();

// ════════════════════════════════════════════════════════
//   🛡️ 부관리자 시스템 — hsy 전용
// ════════════════════════════════════════════════════════

var hsyPanelOpen = false;
var hsySelectedTarget = null;
var hsySpectateTarget = null;
var hsyLogs = [];

function isHsy() { return currentUsername === 'hsy'; }

function initHsyPanel() {
  var btn = document.getElementById('hsy-toggle-btn');
  if (btn) btn.style.display = 'block';
  hsyAddLog('부관리자 세션 시작: hsy', 'ok');
}

function toggleHsyPanel() {
  if (!isHsy()) return;
  hsyPanelOpen = !hsyPanelOpen;
  var panel = document.getElementById('hsy-panel');
  if (panel) panel.style.display = hsyPanelOpen ? 'block' : 'none';
  if (hsyPanelOpen) renderHsyLogs();
}

function hsyAddLog(msg, type) {
  var now = new Date();
  var ts = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
  var color = type === 'ok' ? '#6ee7b7' : type === 'warn' ? '#fcd34d' : type === 'err' ? '#fca5a5' : '#a78bfa';
  hsyLogs.unshift({ ts, msg, color });
  if (hsyLogs.length > 50) hsyLogs.pop();
  renderHsyLogs();
}

function renderHsyLogs() {
  var box = document.getElementById('hsy-log-box');
  if (!box) return;
  if (hsyLogs.length === 0) { box.textContent = '로그 없음'; return; }
  box.innerHTML = hsyLogs.map(function(l) {
    return '<span style="color:#555;">[' + l.ts + ']</span> <span style="color:' + l.color + ';">' + l.msg + '</span>';
  }).join('<br>');
}

function hsyClearLogs() {
  hsyLogs = [];
  renderHsyLogs();
}

function hsySearchPlayer() {
  var q = (document.getElementById('hsy-search-input').value || '').trim();
  if (!q) return;
  var result = document.getElementById('hsy-search-result');

  // 온라인 플레이어에서 찾기
  fetch(DB_URL + 'online_players.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[q]) {
        hsySelectedTarget = q;
        document.getElementById('hsy-target-name').textContent = q;
        document.getElementById('hsy-target-name2').textContent = q;
        result.style.color = '#6ee7b7';
        result.textContent = '✅ 온라인: ' + q + ' (x:' + Math.round(data[q].x) + ', y:' + Math.round(data[q].y) + ')';
        hsyAddLog('플레이어 검색: ' + q + ' (온라인)', 'ok');
      } else {
        // DB에서 찾기
        return fetch(DB_URL + 'users/' + encodeURIComponent(q) + '.json')
          .then(function(r) { return r.json(); })
          .then(function(u) {
            if (u && u.money !== undefined) {
              hsySelectedTarget = q;
              document.getElementById('hsy-target-name').textContent = q;
              document.getElementById('hsy-target-name2').textContent = q;
              result.style.color = '#fcd34d';
              result.textContent = '🔴 오프라인: ' + q + ' (잔액: ₦' + (u.money||0).toLocaleString() + ')';
              hsyAddLog('플레이어 검색: ' + q + ' (오프라인)', 'warn');
            } else {
              result.style.color = '#fca5a5';
              result.textContent = '❌ 플레이어를 찾을 수 없습니다.';
              hsyAddLog('플레이어 검색 실패: ' + q, 'err');
            }
          });
      }
    })
    .catch(function() {
      result.style.color = '#fca5a5';
      result.textContent = '❌ 검색 오류';
    });
}

function hsyToggleGodMode(on) {
  if (!isHsy()) return;
  var slider = document.getElementById('hsy-god-slider');
  if (slider) slider.style.background = on ? '#7c3aed' : '#2d1b4e';
  // 자신에게만 적용
  if (on) {
    adminState.godMode = true;
    showNotice('👑 [hsy] 무적 모드 활성화');
    hsyAddLog('무적 모드 ON', 'ok');
  } else {
    adminState.godMode = false;
    showNotice('무적 모드 해제');
    hsyAddLog('무적 모드 OFF', 'warn');
  }
}

function hsyGiveMoney() {
  if (!isHsy()) return;
  var target = hsySelectedTarget;
  var amount = parseInt(document.getElementById('hsy-money-amount').value) || 0;
  if (!target) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  if (amount <= 0) { showNotice('❌ 금액을 입력하세요.'); return; }

  fetch(DB_URL + 'users/' + encodeURIComponent(target) + '.json')
    .then(function(r) { return r.json(); })
    .then(function(u) {
      if (!u) { showNotice('❌ 대상 없음'); return; }
      var newMoney = (u.money || 0) + amount;
      return fetch(DB_URL + 'users/' + encodeURIComponent(target) + '/money.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newMoney)
      });
    })
    .then(function() {
      showNotice('💰 ' + target + '에게 ₦' + amount.toLocaleString() + ' 지급 완료');
      hsyAddLog('돈 지급: ' + target + ' +₦' + amount.toLocaleString(), 'ok');
    })
    .catch(function() { showNotice('❌ 지급 실패'); });
}

function hsyTakeMoney() {
  if (!isHsy()) return;
  var target = hsySelectedTarget;
  var amount = parseInt(document.getElementById('hsy-money-amount').value) || 0;
  if (!target) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  if (target === 'ree1203') { showNotice('🚫 최고 관리자(ree1203)에게는 제재를 가할 수 없습니다.'); hsyAddLog('차단됨: ree1203 돈 회수 시도', 'err'); return; }
  if (amount <= 0) { showNotice('❌ 금액을 입력하세요.'); return; }

  fetch(DB_URL + 'users/' + encodeURIComponent(target) + '.json')
    .then(function(r) { return r.json(); })
    .then(function(u) {
      if (!u) { showNotice('❌ 대상 없음'); return; }
      var newMoney = Math.max(0, (u.money || 0) - amount);
      return fetch(DB_URL + 'users/' + encodeURIComponent(target) + '/money.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newMoney)
      });
    })
    .then(function() {
      showNotice('💸 ' + target + '에서 ₦' + amount.toLocaleString() + ' 회수 완료');
      hsyAddLog('돈 회수: ' + target + ' -₦' + amount.toLocaleString(), 'warn');
    })
    .catch(function() { showNotice('❌ 회수 실패'); });
}

function hsyGiveReward() {
  if (!isHsy()) return;
  var target = hsySelectedTarget;
  if (!target) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  var sel = document.getElementById('hsy-reward-type');
  var amount = sel.value === 'custom'
    ? parseInt(prompt('지급할 보상 금액(₦):') || '0')
    : parseInt(sel.value);
  if (!amount || amount <= 0) return;

  fetch(DB_URL + 'users/' + encodeURIComponent(target) + '.json')
    .then(function(r) { return r.json(); })
    .then(function(u) {
      if (!u) { showNotice('❌ 대상 없음'); return; }
      var newMoney = (u.money || 0) + amount;
      return fetch(DB_URL + 'users/' + encodeURIComponent(target) + '/money.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newMoney)
      });
    })
    .then(function() {
      showNotice('🎁 ' + target + '에게 보상 ₦' + amount.toLocaleString() + ' 지급!');
      hsyAddLog('보상 지급: ' + target + ' ₦' + amount.toLocaleString(), 'ok');
      // 수신자에게 공지 브로드캐스트
      fetch(DB_URL + 'notices/' + encodeURIComponent(target) + '.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ msg: '🎁 부관리자(hsy)가 보상 ₦' + amount.toLocaleString() + '을 지급했습니다!', t: Date.now() })
      }).catch(function(){});
    })
    .catch(function() { showNotice('❌ 보상 지급 실패'); });
}

function hsySuspendOneDay() {
  if (!isHsy()) return;
  var target = hsySelectedTarget;
  if (!target) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  if (target === 'ree1203') { showNotice('🚫 최고 관리자(ree1203)에게는 제재를 가할 수 없습니다.'); hsyAddLog('차단됨: ree1203 정지 시도', 'err'); return; }
  if (!confirm(target + '을(를) 1일 정지 처리하시겠습니까?')) return;

  var until = Date.now() + 86400000; // 24시간
  fetch(DB_URL + 'bans/' + encodeURIComponent(target) + '.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ until: until, reason: '부관리자(hsy) 1일 정지', by: 'hsy' })
  })
  .then(function() {
    showNotice('⏸️ ' + target + ' 1일 정지 처리 완료');
    hsyAddLog('1일 정지: ' + target, 'warn');
  })
  .catch(function() { showNotice('❌ 정지 처리 실패'); });
}

function hsyChatBan() {
  if (!isHsy()) return;
  var target = hsySelectedTarget;
  if (!target) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  if (target === 'ree1203') { showNotice('🚫 최고 관리자(ree1203)에게는 제재를 가할 수 없습니다.'); hsyAddLog('차단됨: ree1203 채팅 금지 시도', 'err'); return; }
  if (!confirm(target + '의 채팅을 금지하시겠습니까?')) return;

  fetch(DB_URL + 'chatbans/' + encodeURIComponent(target) + '.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ banned: true, by: 'hsy', t: Date.now() })
  })
  .then(function() {
    showNotice('🔇 ' + target + ' 채팅 금지 완료');
    hsyAddLog('채팅 금지: ' + target, 'warn');
  })
  .catch(function() { showNotice('❌ 채팅 금지 실패'); });
}

// ── hsy 관전 기능 ──
function hsyStartSpectate(uname) {
  if (!isHsy()) return;
  if (!uname) uname = hsySelectedTarget;
  if (!uname) { showNotice('❌ 먼저 플레이어를 검색하세요.'); return; }
  if (!otherPlayers[uname]) { showNotice('❌ ' + uname + '은(는) 오프라인입니다.'); hsyAddLog('관전 실패 (오프라인): ' + uname, 'err'); return; }
  hsySpectateTarget = uname;
  if (typeof playerGroup !== 'undefined' && playerGroup) playerGroup.visible = false;
  var ss = document.getElementById('hsy-spectate-status');
  if (ss) ss.textContent = '📷 관전 중: ' + uname;
  hsyUpdateSpHud();
  setTimeout(broadcastPlayerPosition, 100);
  hsyAddLog('관전 시작: ' + uname, 'ok');
  showNotice('👁️ ' + uname + ' 관전 시작');
}

function hsyStopSpectate() {
  if (!isHsy()) return;
  var prev = hsySpectateTarget;
  hsySpectateTarget = null;
  if (typeof playerGroup !== 'undefined' && playerGroup) playerGroup.visible = true;
  var ss = document.getElementById('hsy-spectate-status');
  if (ss) ss.textContent = '관전 중 아님';
  hsyUpdateSpHud();
  setTimeout(broadcastPlayerPosition, 200);
  if (prev) { hsyAddLog('관전 종료: ' + prev, 'info'); showNotice('👁️ 관전 종료'); }
}

// hsy 관전 HUD 오버레이 & broadcastPlayerPosition 패치
(function() {
  // ① 관전 HUD 생성
  var hsySpHud = document.createElement('div');
  hsySpHud.id = 'hsy-spectator-hud';
  Object.assign(hsySpHud.style, {
    display: 'none',
    position: 'fixed',
    bottom: '56px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.72)',
    border: '1.5px solid rgba(192,132,252,0.6)',
    borderRadius: '40px',
    padding: '8px 22px',
    color: '#fff',
    fontSize: '13px',
    pointerEvents: 'none',
    zIndex: '6000',
    backdropFilter: 'blur(6px)',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(hsySpHud);

  window.hsyUpdateSpHud = function() {
    if (!hsySpectateTarget) { hsySpHud.style.display = 'none'; return; }
    hsySpHud.style.display = 'block';
    hsySpHud.innerHTML = '👁️ &nbsp;<strong style="color:#c084fc;">' + hsySpectateTarget + '</strong>&nbsp; 관전 중 &nbsp;·&nbsp; <span style="color:rgba(255,255,255,0.5);font-size:11px;">부관리자 패널 → 관전 중지</span>';
  };

  // ② broadcastPlayerPosition 패치: hsy 관전 중이면 spectator 플래그 포함 송출
  var _origHsyBroadcast = broadcastPlayerPosition;
  broadcastPlayerPosition = function() {
    if (hsySpectateTarget && isHsy() && currentUsername && isCloudConnected) {
      fetch(DB_URL + 'online_players/' + encodeURIComponent(currentUsername) + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: P.x, y: P.y, angle: P.angle, t: Date.now(), spectator: true })
      }).catch(function() {});
      return;
    }
    _origHsyBroadcast();
  };
})();


// ════════════════════════════════════════════════════════
//   👑 Owner 시스템 — ree1203 최고 관리자 전용
// ════════════════════════════════════════════════════════

// switchAdminTab에 'owner' 탭 추가
(function() {
  var _prev = switchAdminTab;
  switchAdminTab = function(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.admin-tab-btn').forEach(function(el) { el.classList.remove('active'); });
    var content = document.getElementById('admin-tab-' + tab);
    if (content) content.classList.add('active');
    document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
      if (btn.textContent.includes('Owner') && tab === 'owner') btn.classList.add('active');
    });
    if (tab === 'players') adminRefreshPlayerList();
    if (tab === 'logs') renderAdminLogs();
    if (tab === 'owner') ownerOnOpen();
  };
})();

function ownerOnOpen() {
  ownerLoadAdminActivity();
  ownerLoadStats();
  ownerLoadAIList();
  ownerLoadLoginLog();
  ownerLoadRanks();
  ownerLoadCurrentVersion();
  ownerUpdateFPS();
  ownerLoadZones();
}

function switchOwnerTab(tab) {
  document.querySelectorAll('.owner-sub-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.owner-sub-btn').forEach(function(btn) { btn.classList.remove('active'); });
  var el = document.getElementById('owner-tab-' + tab);
  if (el) el.classList.add('active');
  var btns = document.querySelectorAll('#owner-subtab-btns .owner-sub-btn');
  var map = ['perms','server','data','world','system','economy','ai','analytics','security','dev'];
  var idx = map.indexOf(tab);
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'analytics') ownerUpdateFPS();
}

function ownerLog(msg, type) {
  adminLog('[Owner] ' + msg, type || 'ok');
}

// ── 권한 관리 ──
var ROLE_LABELS = { owner: 'Owner', senior: '수석관리자', admin: '관리자', moderator: '운영자' };
var ROLE_ORDER = ['moderator','admin','senior','owner'];

function ownerLoadAdminList() {
  fetch(DB_URL + 'admin_roles.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-admin-list');
      if (!el) return;
      if (!data) { el.textContent = '등록된 관리자 없음'; return; }
      el.innerHTML = Object.entries(data).map(function(e) {
        return '<div style="display:flex;justify-content:space-between;padding:2px 0;">'
          + '<span>' + e[0] + '</span>'
          + '<span style="color:#c084fc;">' + (ROLE_LABELS[e[1].role] || e[1].role) + '</span>'
          + '</div>';
      }).join('');
    }).catch(function() {});
}

function ownerGrantAdmin() {
  if (!isAdmin()) return;
  var user = (document.getElementById('owner-new-admin').value || '').trim();
  var role = document.getElementById('owner-new-role').value;
  if (!user) { showNotice('유저명을 입력하세요.'); return; }
  fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ role: role, grantedBy: 'ree1203', grantedAt: Date.now() })
  }).then(function() {
    showNotice('관리자 생성: ' + user + ' (' + (ROLE_LABELS[role]||role) + ')');
    ownerLog('관리자 생성: ' + user + ' ' + role, 'ok');
    ownerLoadAdminList();
    ownerRecordActivity('관리자 생성: ' + user + ' -> ' + role);
  }).catch(function() { showNotice('권한 부여 실패'); });
}

function ownerRevokeAdmin() {
  if (!isAdmin()) return;
  var user = (document.getElementById('owner-new-admin').value || '').trim();
  if (!user) { showNotice('유저명을 입력하세요.'); return; }
  if (!confirm(user + '의 관리자 권한을 삭제하시겠습니까?')) return;
  fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '.json', { method: 'DELETE' })
    .then(function() {
      showNotice(user + ' 관리자 권한 삭제 완료');
      ownerLog('관리자 삭제: ' + user, 'warn');
      ownerLoadAdminList();
      ownerRecordActivity('관리자 삭제: ' + user);
    }).catch(function() { showNotice('삭제 실패'); });
}

function ownerPromote() {
  if (!isAdmin()) return;
  var user = (document.getElementById('owner-promote-user').value || '').trim();
  if (!user) { showNotice('유저명을 입력하세요.'); return; }
  fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '.json')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var cur = d ? d.role : 'moderator';
      var idx = ROLE_ORDER.indexOf(cur);
      var next = ROLE_ORDER[Math.min(idx + 1, ROLE_ORDER.length - 2)];
      return fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '/role.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(next)
      }).then(function() {
        showNotice(user + ' 승급: ' + (ROLE_LABELS[next]||next));
        ownerLog('승급: ' + user + ' -> ' + next, 'ok');
        ownerLoadAdminList();
        ownerRecordActivity('승급: ' + user + ' -> ' + next);
      });
    }).catch(function() { showNotice('승급 실패'); });
}

function ownerDemote() {
  if (!isAdmin()) return;
  var user = (document.getElementById('owner-promote-user').value || '').trim();
  if (!user) { showNotice('유저명을 입력하세요.'); return; }
  fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '.json')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var cur = d ? d.role : 'admin';
      var idx = ROLE_ORDER.indexOf(cur);
      var prev = ROLE_ORDER[Math.max(idx - 1, 0)];
      return fetch(DB_URL + 'admin_roles/' + encodeURIComponent(user) + '/role.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(prev)
      }).then(function() {
        showNotice(user + ' 강등: ' + (ROLE_LABELS[prev]||prev));
        ownerLog('강등: ' + user + ' -> ' + prev, 'warn');
        ownerLoadAdminList();
        ownerRecordActivity('강등: ' + user + ' -> ' + prev);
      });
    }).catch(function() { showNotice('강등 실패'); });
}

function ownerRecordActivity(msg) {
  fetch(DB_URL + 'admin_activity.json', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ msg: msg, by: 'ree1203', t: Date.now() })
  }).catch(function() {});
}

function ownerLoadAdminActivity() {
  ownerLoadAdminList();
  fetch(DB_URL + 'admin_activity.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-admin-activity');
      if (!el) return;
      if (!data) { el.textContent = '기록 없음'; return; }
      var entries = Object.values(data).sort(function(a,b){ return b.t - a.t; }).slice(0,30);
      el.innerHTML = entries.map(function(e) {
        var d = new Date(e.t);
        var ts = (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        return '<div><span style="color:#555;">[' + ts + '] ' + (e.by||'?') + '</span> ' + (e.msg||'') + '</div>';
      }).join('');
    }).catch(function() {});
}

// ── 서버 제어 ──
function ownerServerAction(action) {
  if (!isAdmin()) return;
  var labels = { start:'시작', stop:'종료', restart:'재시작', emergency:'긴급 종료', lock:'잠금', test:'테스트 서버' };
  if ((action === 'emergency' || action === 'stop') && !confirm('서버 ' + (labels[action]||action) + '을 실행하시겠습니까?')) return;
  fetch(DB_URL + 'server_control.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action: action, by: 'ree1203', t: Date.now() })
  }).then(function() {
    showNotice('서버 ' + (labels[action]||action) + ' 명령 전송 완료');
    ownerLog('서버: ' + action, action === 'emergency' ? 'err' : 'warn');
    ownerRecordActivity('서버 제어: ' + action);
    var statusEl = document.getElementById('owner-server-status');
    if (statusEl) {
      if (action === 'start') { statusEl.textContent = '● 온라인'; statusEl.style.color = '#6ee7b7'; }
      else if (action === 'stop' || action === 'emergency') { statusEl.textContent = '● 오프라인'; statusEl.style.color = '#fca5a5'; }
      else if (action === 'restart') { statusEl.textContent = '● 재시작 중...'; statusEl.style.color = '#fcd34d'; }
      else if (action === 'lock') { statusEl.textContent = '● 잠금'; statusEl.style.color = '#fcd34d'; }
    }
    if (action === 'lock') adminState.serverLocked = true;
  }).catch(function() { showNotice('서버 명령 실패'); });
}

function ownerServerSave() {
  if (!isAdmin()) return;
  showNotice('전체 저장 중...');
  fetch(DB_URL + 'server_control.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action: 'save_all', by: 'ree1203', t: Date.now() })
  }).then(function() {
    showNotice('전체 서버 저장 완료');
    ownerLog('전체 저장', 'ok');
    ownerRecordActivity('전체 저장');
  });
}

function ownerForceAnnounce() {
  fetch(DB_URL + 'server_control.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action: 'force_announce', by: 'ree1203', t: Date.now() })
  }).then(function() { showNotice('공지 강제 표시 명령 전송'); });
}

function ownerSendAnnounce() {
  var txt = (document.getElementById('owner-announce-text').value || '').trim();
  if (!txt) return;
  fetch(DB_URL + 'global_notice.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ msg: '[Owner] ' + txt, t: Date.now(), by: 'ree1203' })
  }).then(function() {
    showNotice('공지 발송: ' + txt);
    ownerLog('공지: ' + txt, 'ok');
    document.getElementById('owner-announce-text').value = '';
    ownerRecordActivity('공지: ' + txt);
  });
}

function ownerStartEvent() {
  const title  = (document.getElementById('owner-event-title')?.value  || '').trim();
  const desc   = (document.getElementById('owner-event-desc')?.value   || '').trim();
  const reward = parseInt(document.getElementById('owner-event-reward')?.value) || 0;
  const dur    = parseInt(document.getElementById('owner-event-duration')?.value) || 300;
  if (!title) { showNotice('⚠️ 이벤트 제목을 입력하세요.'); return; }
  if (typeof startEvent === 'function') startEvent(title, desc, reward, dur, 'ree1203');
  document.getElementById('owner-event-title').value  = '';
  document.getElementById('owner-event-desc').value   = '';
  document.getElementById('owner-event-reward').value = '';
}

// ── 데이터 관리 ──
function ownerBackupAll() {
  if (!isAdmin()) return;
  showNotice('전체 백업 중...');
  fetch(DB_URL + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'backup_' + new Date().toISOString().replace(/[:.]/g,'_') + '.json';
      a.click();
      URL.revokeObjectURL(url);
      var el = document.getElementById('owner-backup-status');
      if (el) el.textContent = '백업 완료: ' + new Date().toLocaleString();
      ownerLog('전체 백업 완료', 'ok');
      ownerRecordActivity('전체 백업');
    }).catch(function() { showNotice('백업 실패'); });
}

function ownerRestoreAll() {
  if (!isAdmin() || !confirm('전체 데이터를 복원합니까? 현재 데이터를 덮어씁니다.')) return;
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        fetch(DB_URL + '.json', {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
        }).then(function() {
          showNotice('전체 데이터 복원 완료');
          ownerLog('전체 복원', 'ok');
          ownerRecordActivity('전체 복원');
        });
      } catch(err) { showNotice('파일 오류'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function ownerExportData() {
  fetch(DB_URL + 'users.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'users_export_' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showNotice('사용자 데이터 내보내기 완료');
      ownerLog('데이터 내보내기', 'ok');
    });
}

function ownerImportData() {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!confirm('데이터를 가져옵니까?')) return;
        fetch(DB_URL + 'users.json', {
          method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
        }).then(function() { showNotice('데이터 가져오기 완료'); ownerLog('데이터 가져오기', 'ok'); });
      } catch(err) { showNotice('파일 오류'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function ownerRestorePlayer() {
  var user = (document.getElementById('owner-data-user').value || '').trim();
  if (!user) { showNotice('유저명을 입력하세요.'); return; }
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var userData = data.users && data.users[user];
        if (!userData) { showNotice('백업에서 ' + user + ' 데이터 없음'); return; }
        fetch(DB_URL + 'users/' + encodeURIComponent(user) + '.json', {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(userData)
        }).then(function() {
          showNotice(user + ' 데이터 복원 완료');
          ownerLog('플레이어 복원: ' + user, 'ok');
          ownerRecordActivity('복원: ' + user);
        });
      } catch(err) { showNotice('파일 오류'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function ownerSetLogPeriod() {
  var val = document.getElementById('owner-log-period').value;
  fetch(DB_URL + 'server_settings/log_period_days.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(parseInt(val))
  }).then(function() {
    showNotice('로그 보관 기간: ' + (val === '0' ? '무제한' : val + '일'));
    ownerLog('로그 보관: ' + val + '일', 'ok');
  });
}

// ── 월드 관리 ──
function ownerMapAction(action) {
  if (!isAdmin()) return;
  var labels = { create:'새 맵 생성', delete:'맵 삭제', reset:'맵 초기화', lock:'월드 잠금' };
  if ((action === 'delete' || action === 'reset') && !confirm(labels[action] + '을 실행하시겠습니까?')) return;
  fetch(DB_URL + 'world_control.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action: action, by: 'ree1203', t: Date.now() })
  }).then(function() {
    showNotice(labels[action] + ' 완료');
    ownerLog('월드: ' + action, 'ok');
    ownerRecordActivity('월드: ' + action);
  });
}

function ownerSetSpawn() {
  var x = parseFloat(document.getElementById('owner-spawn-x').value);
  var y = parseFloat(document.getElementById('owner-spawn-y').value);
  if (isNaN(x) || isNaN(y)) { showNotice('좌표를 입력하세요.'); return; }
  fetch(DB_URL + 'server_settings/spawn.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ x: x, y: y })
  }).then(function() {
    showNotice('스폰 위치: (' + x + ', ' + y + ')');
    ownerLog('스폰 설정: (' + x + ', ' + y + ')', 'ok');
    ownerRecordActivity('스폰 변경: (' + x + ',' + y + ')');
  });
}

function ownerSetZone(type) {
  var name = (document.getElementById('owner-zone-name').value || '').trim();
  if (!name) { showNotice('구역명을 입력하세요.'); return; }
  var zone = { name: name, type: type, x: Math.round(P.x), y: Math.round(P.y), by: 'ree1203', t: Date.now() };
  fetch(DB_URL + 'zones/' + encodeURIComponent(name) + '.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(zone)
  }).then(function() {
    showNotice((type==='safe'?'안전':'위험') + ' 구역 설정: ' + name);
    ownerLog('구역: ' + name + ' (' + type + ')', 'ok');
    ownerLoadZones();
    ownerRecordActivity('구역 설정: ' + name + ' ' + type);
  });
}

function ownerLoadZones() {
  fetch(DB_URL + 'zones.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-zone-list');
      if (!el) return;
      if (!data) { el.textContent = '구역 없음'; return; }
      el.innerHTML = Object.values(data).map(function(z) {
        return '<span style="color:' + (z.type==='safe'?'#6ee7b7':'#fca5a5') + ';margin-right:8px;">'
          + (z.type==='safe'?'🛡️':'☠️') + ' ' + z.name + '</span>';
      }).join('');
    }).catch(function() {});
}

// ── 시스템 관리 ──
function ownerToggleMaintenance(on) {
  fetch(DB_URL + 'server_settings/maintenance.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(on)
  }).then(function() {
    showNotice(on ? '유지보수 모드 ON' : '유지보수 모드 해제');
    ownerLog('유지보수: ' + (on?'ON':'OFF'), on?'warn':'ok');
    ownerRecordActivity('유지보수: ' + (on?'ON':'OFF'));
  });
}

function ownerToggleNotices(on) {
  fetch(DB_URL + 'server_settings/notices_enabled.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(on)
  }).then(function() { showNotice('공지 시스템: ' + (on?'ON':'OFF')); });
}

function ownerSetAutosave() {
  var sec = parseInt(document.getElementById('owner-autosave-interval').value);
  if (typeof autoSaveInterval !== 'undefined' && autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(function() { if (typeof saveUser==='function') saveUser(currentUsername, currentPassword); }, sec * 1000);
  fetch(DB_URL + 'server_settings/autosave_interval.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(sec)
  }).then(function() {
    showNotice('자동 저장 주기: ' + sec + '초');
    ownerLog('자동 저장: ' + sec + '초', 'ok');
  });
}

function ownerSetAutobackup() {
  var sec = parseInt(document.getElementById('owner-autobackup-interval').value);
  fetch(DB_URL + 'server_settings/autobackup_interval.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(sec)
  }).then(function() {
    showNotice(sec === 0 ? '자동 백업 사용 안 함' : '자동 백업: ' + (sec/3600) + '시간');
    ownerLog('자동 백업: ' + sec + '초', 'ok');
  });
}

function ownerSetVersion() {
  var v = (document.getElementById('owner-version-input').value || '').trim();
  if (!v) return;
  fetch(DB_URL + 'server_settings/version.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(v)
  }).then(function() {
    showNotice('게임 버전: ' + v);
    ownerLog('버전: ' + v, 'ok');
    ownerLoadCurrentVersion();
    ownerRecordActivity('버전 변경: ' + v);
  });
}

function ownerLoadCurrentVersion() {
  fetch(DB_URL + 'server_settings/version.json')
    .then(function(r) { return r.json(); })
    .then(function(v) {
      var el = document.getElementById('owner-current-version');
      if (el) el.textContent = '현재 버전: ' + (v || '미설정');
    }).catch(function() {});
}

// ── 경제 관리 ──
function ownerResetEconomy() {
  if (!isAdmin() || !confirm('전체 경제를 초기화합니까?') || !confirm('정말로 실행하시겠습니까?')) return;
  fetch(DB_URL + 'users.json')
    .then(function(r) { return r.json(); })
    .then(function(users) {
      if (!users) return;
      var patch = {};
      Object.keys(users).forEach(function(u) {
        patch[u] = Object.assign({}, users[u], { money: 550000 });
      });
      return fetch(DB_URL + 'users.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(patch)
      });
    }).then(function() {
      showNotice('전체 경제 초기화 완료 (초기 자산: 550,000)');
      ownerLog('전체 경제 초기화', 'warn');
      ownerRecordActivity('전체 경제 초기화');
      var el = document.getElementById('owner-economy-status');
      if (el) el.textContent = '완료: ' + new Date().toLocaleString();
    }).catch(function() { showNotice('초기화 실패'); });
}

function ownerAdjustBudget(sign) {
  var amount = parseInt(document.getElementById('owner-budget-amount').value) || 0;
  if (!amount) { showNotice('금액을 입력하세요.'); return; }
  fetch(DB_URL + 'simulation/treasury.json')
    .then(function(r) { return r.json(); })
    .then(function(cur) {
      var newVal = (cur || 0) + sign * amount;
      return fetch(DB_URL + 'simulation/treasury.json', {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(newVal)
      });
    }).then(function() {
      showNotice((sign>0?'+':'-') + ' 국고: ' + amount.toLocaleString());
      ownerLog('국고 조정: ' + (sign*amount), 'ok');
      ownerRecordActivity('국고: ' + (sign*amount));
    });
}

function ownerSetCurrency() {
  var name = (document.getElementById('owner-currency-name').value || '').trim();
  if (!name) return;
  fetch(DB_URL + 'server_settings/currency.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(name)
  }).then(function() { showNotice('화폐 설정: ' + name); ownerLog('화폐: ' + name, 'ok'); });
}

function ownerSetDefaultTax() {
  var inc = parseInt(document.getElementById('owner-tax-income').value) || 15;
  var corp = parseInt(document.getElementById('owner-tax-corp').value) || 10;
  fetch(DB_URL + 'server_settings/default_tax.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ income: inc, corp: corp })
  }).then(function() {
    showNotice('세금 기본값 — 소득세: ' + inc + '%, 법인세: ' + corp + '%');
    ownerLog('세금: 소득' + inc + '% 법인' + corp + '%', 'ok');
  });
}

// ── AI 관리 ──
function ownerLoadAIList() {
  fetch(DB_URL + 'ai_nations.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-ai-list');
      if (!el) return;
      if (!data) { el.textContent = 'AI 국가 없음'; return; }
      el.innerHTML = Object.entries(data).map(function(e) {
        return '<div style="display:flex;justify-content:space-between;">'
          + '<span>' + e[1].name + '</span>'
          + '<span style="color:#a78bfa;">' + (e[1].difficulty||'normal') + '</span></div>';
      }).join('');
    }).catch(function() {});
}

function ownerCreateAI() {
  var name = (document.getElementById('owner-ai-name').value || '').trim();
  if (!name) { showNotice('AI 국가명을 입력하세요.'); return; }
  var diff = document.getElementById('owner-ai-diff').value;
  var agg = document.getElementById('owner-ai-aggression').value;
  var ai = { name: name, difficulty: diff, aggression: parseInt(agg), gdp: 1000000000, createdAt: Date.now() };
  fetch(DB_URL + 'ai_nations/' + encodeURIComponent(name) + '.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(ai)
  }).then(function() {
    showNotice('AI 국가 생성: ' + name);
    ownerLog('AI 생성: ' + name, 'ok');
    ownerLoadAIList();
    ownerRecordActivity('AI 생성: ' + name);
  });
}

function ownerDeleteAI() {
  var name = (document.getElementById('owner-ai-name').value || '').trim();
  if (!name || !confirm(name + ' AI 국가를 삭제하시겠습니까?')) return;
  fetch(DB_URL + 'ai_nations/' + encodeURIComponent(name) + '.json', { method: 'DELETE' })
    .then(function() {
      showNotice('AI 국가 삭제: ' + name);
      ownerLog('AI 삭제: ' + name, 'warn');
      ownerLoadAIList();
    });
}

function ownerResetAI() {
  if (!confirm('모든 AI 국가를 리셋하시겠습니까?')) return;
  fetch(DB_URL + 'ai_nations.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data) return;
      return Promise.all(Object.keys(data).map(function(k) {
        return fetch(DB_URL + 'ai_nations/' + k + '/gdp.json', {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(1000000000)
        });
      }));
    }).then(function() {
      showNotice('모든 AI 국가 리셋 완료');
      ownerLog('AI 전체 리셋', 'warn');
      ownerLoadAIList();
    });
}

// ── 분석 ──
function ownerLoadStats() {
  fetch(DB_URL + 'online_players.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-stats-box');
      if (!el) return;
      var now = Date.now();
      var players = data ? Object.entries(data).filter(function(e) { return now - (e[1].t||0) < 15000; }) : [];
      el.innerHTML = '온라인: <b style="color:#6ee7b7;">' + players.length + '명</b><br>'
        + '플레이어: ' + (players.map(function(e){ return e[0]; }).join(', ') || '없음')
        + '<br>갱신: ' + new Date().toLocaleTimeString();
    }).catch(function() {});
}

var ownerLastFrame = 0;
function ownerUpdateFPS() {
  var el = document.getElementById('owner-fps');
  var objEl = document.getElementById('owner-obj-count');
  var now = performance.now();
  if (ownerLastFrame > 0 && el) {
    var fps = Math.round(1000 / Math.max(1, now - ownerLastFrame));
    el.textContent = fps;
    el.style.color = fps >= 50 ? '#6ee7b7' : fps >= 30 ? '#fcd34d' : '#fca5a5';
  }
  ownerLastFrame = now;
  if (objEl && typeof renderer !== 'undefined' && renderer && renderer.info.render) {
    objEl.textContent = (renderer.info.render.triangles||0).toLocaleString() + ' tri';
  }
}

function ownerLoadRanks() {
  fetch(DB_URL + 'users.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-rank-box');
      if (!el || !data) return;
      var sorted = Object.entries(data)
        .map(function(e) { return { name: e[0], money: e[1].money||0 }; })
        .sort(function(a,b) { return b.money - a.money; }).slice(0,10);
      el.innerHTML = sorted.map(function(p,i) {
        return '<div><span style="color:#7c3aed;">' + (i+1) + '위</span> '
          + p.name + ' <span style="color:#6ee7b7;">₦' + p.money.toLocaleString() + '</span></div>';
      }).join('');
    }).catch(function() {});
}

// ── 보안 ──
function ownerLoadLoginLog() {
  fetch(DB_URL + 'login_log.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('owner-login-log');
      if (!el) return;
      if (!data) { el.textContent = '로그인 기록 없음'; return; }
      var entries = Object.values(data).sort(function(a,b){ return b.t-a.t; }).slice(0,20);
      el.innerHTML = entries.map(function(e) {
        var d = new Date(e.t);
        return '<div><span style="color:#555;">' + d.toLocaleString() + '</span> <b>' + (e.user||'?') + '</b></div>';
      }).join('');
    }).catch(function() {});
}

function ownerToggleAutoBan(on) {
  fetch(DB_URL + 'server_settings/auto_ban.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(on)
  }).then(function() {
    showNotice(on ? '자동 차단 ON' : '자동 차단 OFF');
    ownerLog('자동 차단: ' + (on?'ON':'OFF'), on?'warn':'ok');
  });
}

function ownerSetSecurityLevel() {
  var level = document.getElementById('owner-security-level').value;
  fetch(DB_URL + 'server_settings/security_level.json', {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(level)
  }).then(function() {
    showNotice('보안 등급: ' + level);
    ownerLog('보안 등급: ' + level, 'ok');
    ownerRecordActivity('보안 등급: ' + level);
  });
}

function ownerCheckIP() {
  var user = (document.getElementById('owner-ip-user').value || '').trim();
  var el = document.getElementById('owner-ip-result');
  if (!user || !el) return;
  fetch(DB_URL + 'login_log.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data) { el.textContent = '기록 없음'; return; }
      var logs = Object.values(data).filter(function(e) { return e.user === user; });
      if (!logs.length) { el.textContent = user + ' 로그인 기록 없음'; return; }
      var last = logs.sort(function(a,b){return b.t-a.t;})[0];
      el.textContent = user + ' 마지막 접속: ' + new Date(last.t).toLocaleString();
    }).catch(function() {});
}

// ── 개발자 기능 ──
function ownerToggleDebug(on) {
  if (typeof renderer !== 'undefined' && renderer) renderer.info.autoReset = !on;
  showNotice(on ? '디버그 모드 ON' : '디버그 모드 OFF');
  ownerLog('디버그: ' + (on?'ON':'OFF'), 'ok');
}

function ownerRunCmd() {
  var cmd = (document.getElementById('owner-cmd-input').value || '').trim();
  var result = document.getElementById('owner-cmd-result');
  if (!cmd || !result) return;
  try {
    var ret = (function() { return eval(cmd); })();
    var out = typeof ret === 'object' ? JSON.stringify(ret, null, 2) : String(ret);
    result.textContent = '> ' + out;
    result.style.color = '#6ee7b7';
    ownerLog('CMD: ' + cmd.slice(0,40), 'ok');
  } catch(e) {
    result.textContent = 'ERR: ' + e.message;
    result.style.color = '#fca5a5';
  }
}

function ownerReadDB() {
  var path = (document.getElementById('owner-db-path').value || '').trim();
  var el = document.getElementById('owner-db-result');
  if (!path || !el) return;
  el.textContent = '불러오는 중...';
  fetch(DB_URL + path.replace(/^\/+/, '') + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      el.textContent = JSON.stringify(data, null, 2);
      el.style.color = '#93c5fd';
    }).catch(function(e) {
      el.textContent = 'ERR: ' + e.message;
      el.style.color = '#fca5a5';
    });
}

function ownerOpenDevConsole() {
  showNotice('F12 키로 브라우저 개발자 콘솔을 여세요.');
  console.log('%c[Owner Dev]', 'color:#c084fc;font-size:16px;font-weight:bold;');
  console.log('scene:', typeof scene !== 'undefined' ? scene : 'N/A');
  console.log('P:', typeof P !== 'undefined' ? P : 'N/A');
  console.log('DB_URL:', typeof DB_URL !== 'undefined' ? DB_URL : 'N/A');
}

function ownerCreateTestItem() {
  var types = ['에너지 드링크','피자','커피','약','스마트폰'];
  var item = types[Math.floor(Math.random() * types.length)];
  if (typeof P !== 'undefined' && P) {
    if (!Array.isArray(P.inventory)) P.inventory = [];
    P.inventory.push({ name: item, type: 'consumable', effect: { energy: 20, health: 10 }, qty: 1 });
    showNotice('테스트 아이템 생성: ' + item);
    ownerLog('테스트 아이템: ' + item, 'ok');
  }
}

// FPS 주기 갱신
setInterval(function() {
  var tab = document.getElementById('admin-tab-owner');
  if (tab && tab.classList.contains('active')) ownerUpdateFPS();
}, 500);



// ─────────────────────────────────────────────
// ree1203 전용 무기 시스템
// ─────────────────────────────────────────────
(function(){

const WEAPONS = [
  { id: 0, name: '소드',   key: '1', color: 0x00ffcc, slotCls: 'ws-active-0', cooldown: 0.8 },
  { id: 1, name: '플건',   key: '2', color: 0xbf00ff, slotCls: 'ws-active-1', cooldown: 1.2 },
  { id: 2, name: '방사기', key: '3', color: 0xff5500, slotCls: 'ws-active-2', cooldown: 0.15 },
];

let weaponGroups = [];    // Three.js groups attached to rightArmGroup
let activeWeapon = -1;    // 현재 장착 인덱스 (-1=없음)
let cooldownTimer = 0;    // 현재 무기 쿨타임 잔여
let swingPhase = 0;       // 소드 스윙 애니메이션 [0~1]
let isSwinging = false;
let projectiles = [];     // { mesh, vx, vy, vz, life }
let fireParticles = [];   // { mesh, vx, vy, vz, life, maxLife }
let weaponInitialized = false;
let swordLight, gunLight, flameLight;

function buildSword(THREE) {
  const g = new THREE.Group();

  // 손잡이
  const handleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.45, 8);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.6 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, 0, 0);
  g.add(handle);

  // 가드 (크로스)
  const guardGeo = new THREE.BoxGeometry(0.5, 0.055, 0.055);
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.15 });
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.set(0, 0.25, 0);
  g.add(guard);

  // 블레이드 (에너지 코어)
  const bladeGeo = new THREE.BoxGeometry(0.07, 1.1, 0.04);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.2,
    transparent: true, opacity: 0.92
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0.85, 0);
  g.add(blade);

  // 블레이드 외곽 글로우
  const glowGeo = new THREE.BoxGeometry(0.14, 1.12, 0.07);
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.25, side: THREE.DoubleSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(blade.position);
  g.add(glow);

  // 조명
  swordLight = new THREE.PointLight(0x00ffcc, 1.8, 3.5);
  swordLight.position.set(0, 1.2, 0);
  g.add(swordLight);

  // 전체 방향: 오른손 위쪽으로
  g.rotation.z = -0.2;
  g.position.set(0.1, 0.35, 0.3);
  return g;
}

function buildGun(THREE) {
  const g = new THREE.Group();

  // 총몸
  const bodyGeo = new THREE.BoxGeometry(0.12, 0.22, 0.55);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  g.add(body);

  // 배럴
  const barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.6, 8);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.95, roughness: 0.1 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, 0.55);
  g.add(barrel);

  // 에너지 셀 (보라)
  const cellGeo = new THREE.BoxGeometry(0.07, 0.32, 0.09);
  const cellMat = new THREE.MeshStandardMaterial({
    color: 0xbf00ff, emissive: 0xbf00ff, emissiveIntensity: 2.0,
    transparent: true, opacity: 0.85
  });
  const cell = new THREE.Mesh(cellGeo, cellMat);
  cell.position.set(0.065, 0, 0.05);
  g.add(cell);

  // 스코프
  const scopeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6);
  const scopeMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
  const scope = new THREE.Mesh(scopeGeo, scopeMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.13, 0.1);
  g.add(scope);

  // 조준등
  gunLight = new THREE.PointLight(0xbf00ff, 1.4, 2.8);
  gunLight.position.set(0, 0.04, 0.88);
  g.add(gunLight);

  g.position.set(0.05, 0.05, 0.55);
  g.rotation.x = 0.08;
  return g;
}

function buildFlamethrower(THREE) {
  const g = new THREE.Group();

  // 연료 탱크
  const tankGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.55, 10);
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.4 });
  const tank = new THREE.Mesh(tankGeo, tankMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0, -0.05);
  g.add(tank);

  // 노즐 배럴
  const nozzleGeo = new THREE.CylinderGeometry(0.075, 0.04, 0.55, 8);
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
  const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0, 0.35);
  g.add(nozzle);

  // 연결 파이프
  const pipeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6);
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.6 });
  const pipe = new THREE.Mesh(pipeGeo, pipeMat);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.1, -0.08, 0.14);
  g.add(pipe);

  // 경고 스트라이프
  const stripeGeo = new THREE.CylinderGeometry(0.112, 0.112, 0.06, 10);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.5 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(stripeGeo, stripeMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(0, 0, -0.18 + i * 0.18);
    g.add(s);
  }

  // 불꽃 조명
  flameLight = new THREE.PointLight(0xff5500, 0, 4.0);
  flameLight.position.set(0, 0, 0.9);
  g.add(flameLight);

  g.position.set(0.05, 0, 0.5);
  g.rotation.x = 0.06;
  return g;
}

function initWeaponSystem() {
  if (weaponInitialized) return;
  weaponInitialized = true;

  const THREE = window.THREE;
  if (!THREE || !rightArmGroup) { console.warn('[Weapon] rightArmGroup 없음'); return; }

  // 3개 무기 그룹 생성 후 숨김
  weaponGroups[0] = buildSword(THREE);
  weaponGroups[1] = buildGun(THREE);
  weaponGroups[2] = buildFlamethrower(THREE);
  weaponGroups.forEach(wg => { wg.visible = false; rightArmGroup.add(wg); });

  // HUD 표시
  const hud = document.getElementById('weapon-hud');
  if (hud) { hud.style.display = 'flex'; }
  const cross = document.getElementById('weapon-crosshair');
  if (cross) { cross.style.display = 'block'; }

  // 키 입력 핸들러
  document.addEventListener('keydown', function(e) {
    if (currentUsername !== 'ree1203') return;
    if (e.key === '1') { equipWeapon(0); return; }
    if (e.key === '2') { equipWeapon(1); return; }
    if (e.key === '3') { equipWeapon(2); return; }
    if (e.key === 'f' || e.key === 'F') { attackWeapon(); return; }
    if (e.key === 'q' || e.key === 'Q') { equipWeapon(-1); return; } // 해제
  });

  // 마우스 클릭 공격
  document.addEventListener('mousedown', function(e) {
    if (currentUsername !== 'ree1203') return;
    if (e.button === 0 && activeWeapon >= 0) attackWeapon();
  });

  console.log('[Weapon] ree1203 무기 시스템 초기화 완료');
}

function equipWeapon(idx) {
  if (currentUsername !== 'ree1203') return;
  // 이전 무기 숨김
  if (activeWeapon >= 0 && weaponGroups[activeWeapon]) weaponGroups[activeWeapon].visible = false;

  // 슬롯 UI 갱신
  WEAPONS.forEach((w, i) => {
    const slot = document.getElementById('ws-' + i);
    if (slot) { slot.classList.remove('ws-active-0', 'ws-active-1', 'ws-active-2'); }
  });

  if (idx < 0 || idx === activeWeapon) {
    activeWeapon = -1;
    return;
  }
  activeWeapon = idx;
  if (weaponGroups[idx]) weaponGroups[idx].visible = true;
  const slot = document.getElementById('ws-' + idx);
  if (slot) slot.classList.add(WEAPONS[idx].slotCls);
}

function attackWeapon() {
  if (currentUsername !== 'ree1203') return;
  if (activeWeapon < 0) return;
  if (cooldownTimer > 0) return;

  const w = WEAPONS[activeWeapon];
  cooldownTimer = w.cooldown;

  if (activeWeapon === 0) swordSwing();
  else if (activeWeapon === 1) gunShoot();
  else if (activeWeapon === 2) flameShoot();

  // 쿨타임 UI 시작
  const cdEl = document.getElementById('wcd-' + activeWeapon);
  if (cdEl) { cdEl.style.transform = 'scaleY(1)'; }
}

function swordSwing() {
  isSwinging = true;
  swingPhase = 0;
}

function gunShoot() {
  const THREE = window.THREE;
  if (!THREE || !scene) return;
  const dirX = Math.sin(cameraYaw);
  const dirZ = Math.cos(cameraYaw);

  const geoP = new THREE.SphereGeometry(0.055, 6, 6);
  const matP = new THREE.MeshStandardMaterial({
    color: 0xbf00ff, emissive: 0xbf00ff, emissiveIntensity: 3.0,
    transparent: true, opacity: 0.95
  });
  const proj = new THREE.Mesh(geoP, matP);
  proj.position.set(P.x + dirX * 0.8, 1.2, P.y + dirZ * 0.8);
  scene.add(proj);
  projectiles.push({ mesh: proj, vx: dirX * 14, vy: 0, vz: dirZ * 14, life: 2.5 });

  // 발사 섬광
  const flash = new THREE.PointLight(0xbf00ff, 4, 3);
  flash.position.copy(proj.position);
  scene.add(flash);
  setTimeout(() => { scene.remove(flash); }, 100);
}

function flameShoot() {
  const THREE = window.THREE;
  if (!THREE || !scene) return;
  const dirX = Math.sin(cameraYaw);
  const dirZ = Math.cos(cameraYaw);

  // 여러 파티클 스폰
  for (let i = 0; i < 6; i++) {
    const s = 0.04 + Math.random() * 0.06;
    const geo = new THREE.SphereGeometry(s, 5, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: i < 3 ? 0xff5500 : 0xff9900,
      emissive: i < 3 ? 0xff2200 : 0xff6600,
      emissiveIntensity: 2.5,
      transparent: true, opacity: 0.9
    });
    const fp = new THREE.Mesh(geo, mat);
    const spread = (Math.random() - 0.5) * 0.25;
    fp.position.set(
      P.x + dirX * 0.8 + spread * dirZ,
      1.1 + Math.random() * 0.3,
      P.y + dirZ * 0.8 + spread * dirX
    );
    scene.add(fp);
    const spd = 5 + Math.random() * 4;
    fireParticles.push({
      mesh: fp, mat,
      vx: dirX * spd + (Math.random() - 0.5) * 2,
      vy: 1 + Math.random() * 2,
      vz: dirZ * spd + (Math.random() - 0.5) * 2,
      life: 0.4 + Math.random() * 0.35,
      maxLife: 0.75
    });
  }
}

function updateWeapons(ts, dt) {
  if (currentUsername !== 'ree1203') return;
  const THREE = window.THREE;
  if (!THREE) return;

  // 쿨타임
  if (cooldownTimer > 0) {
    cooldownTimer = Math.max(0, cooldownTimer - dt);
    const w = WEAPONS[activeWeapon >= 0 ? activeWeapon : 0];
    const ratio = activeWeapon >= 0 ? (cooldownTimer / w.cooldown) : 0;
    const cdEl = document.getElementById('wcd-' + (activeWeapon >= 0 ? activeWeapon : 0));
    if (cdEl) cdEl.style.transform = `scaleY(${ratio})`;
  }

  // 소드 스윙 애니메이션
  if (isSwinging && weaponGroups[0]) {
    swingPhase = Math.min(1, swingPhase + dt * 3.5);
    const angle = Math.sin(swingPhase * Math.PI) * 1.4;
    weaponGroups[0].rotation.x = -angle;
    if (swingPhase >= 1) {
      isSwinging = false;
      weaponGroups[0].rotation.x = 0;
    }
  }

  // 소드 빛 깜빡임
  if (swordLight && activeWeapon === 0) {
    swordLight.intensity = 1.5 + Math.sin(ts * 8) * 0.3;
  }
  // 총 빛 깜빡임
  if (gunLight && activeWeapon === 1) {
    gunLight.intensity = 1.2 + Math.sin(ts * 6) * 0.2;
  }

  // 발사체 이동
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.y += dt * 10;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      projectiles.splice(i, 1);
    }
  }

  // 화염 파티클
  let flameActive = false;
  for (let i = fireParticles.length - 1; i >= 0; i--) {
    const fp = fireParticles[i];
    fp.life -= dt;
    fp.mesh.position.x += fp.vx * dt;
    fp.mesh.position.y += fp.vy * dt;
    fp.mesh.position.z += fp.vz * dt;
    fp.vy -= 1.5 * dt; // 중력
    const ratio = fp.life / fp.maxLife;
    fp.mat.opacity = ratio * 0.9;
    fp.mesh.scale.setScalar(0.5 + ratio * 0.5);
    if (fp.life <= 0) {
      scene.remove(fp.mesh);
      fp.mesh.geometry.dispose();
      fireParticles.splice(i, 1);
    } else {
      flameActive = true;
    }
  }
  // 화염방사기 빛
  if (flameLight) {
    flameLight.intensity = flameActive ? (1.5 + Math.random() * 2) : 0;
  }
}

// 전역 노출
window.initWeaponSystem = initWeaponSystem;
window.equipWeapon = equipWeapon;
window.attackWeapon = attackWeapon;
window.updateWeapons = updateWeapons;

})();


// ─────────────────────────────────────────────
// R&H Corporation 회사 시스템 (ree1203 + hsy 전용)
// ─────────────────────────────────────────────
(function(){

const CO_MEMBERS = ['ree1203', 'hsy'];
const CO_CEO = 'ree1203';
const CO_PATH = 'company/';

let coPanelOpen = false;
let coCurrentTab = 'home';
let coChatInterval = null;
let coLastChatTs = 0;

function isCoMember() {
  return CO_MEMBERS.includes(currentUsername);
}

function initCompanyPanel() {
  if (!isCoMember()) return;

  // 버튼 표시
  const btn = document.getElementById('company-toggle-btn');
  if (btn) btn.style.display = '';

  // 배지 설정
  const badge = document.getElementById('company-my-badge');
  if (badge) {
    if (currentUsername === CO_CEO) {
      badge.textContent = '👑 대표이사';
      badge.style.cssText += 'background:#92400e;color:#fbbf24;';
    } else {
      badge.textContent = '💼 부장';
      badge.style.cssText += 'background:#1e1b4b;color:#c084fc;';
    }
  }

  // CEO 전용 UI 표시
  if (currentUsername === CO_CEO) {
    const ceoEls = document.querySelectorAll('#co-task-ceo-controls,#co-finance-ceo,#co-notice-ceo');
    ceoEls.forEach(el => { if(el) el.style.display = ''; });
  }

  // 채팅 실시간 갱신 시작
  coChatInterval = setInterval(fetchCoChat, 4000);
  window.coChatInterval = coChatInterval;

  // 온라인 상태 주기 업데이트
  setInterval(updateCoOnlineStatus, 10000);
  updateCoOnlineStatus();

  // 홈 데이터 로드
  loadCoHome();
  loadCoTasks();
  loadCoNotices();
  loadCoFinanceLog();
}

function toggleCompanyPanel() {
  if (!isCoMember()) return;
  coPanelOpen = !coPanelOpen;
  const panel = document.getElementById('company-panel');
  if (!panel) return;
  panel.style.display = coPanelOpen ? 'block' : 'none';
  if (coPanelOpen) {
    switchCoTab(coCurrentTab);
    loadCoHome();
    fetchCoChat();
    loadCoTasks();
  }
}
window.toggleCompanyPanel = toggleCompanyPanel;

function switchCoTab(tab) {
  coCurrentTab = tab;
  document.querySelectorAll('.co-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.co-content').forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });
  const target = document.getElementById('co-tab-' + tab);
  if (target) {
    target.style.display = tab === 'chat' ? 'flex' : 'block';
    target.classList.add('active');
  }
  if (tab === 'chat') { fetchCoChat(); setTimeout(() => scrollCoChat(), 100); }
  if (tab === 'task') loadCoTasks();
  if (tab === 'finance') { loadCoFunds(); loadCoFinanceLog(); }
  if (tab === 'notice') loadCoNotices();
}
window.switchCoTab = switchCoTab;

// ─── 온라인 상태 ───
async function updateCoOnlineStatus() {
  if (!isCoMember()) return;
  try {
    // 내 온라인 마크
    await fetch(`${DB_URL}${CO_PATH}online/${currentUsername}.json`, {
      method: 'PUT',
      body: JSON.stringify(Date.now())
    });
    // 멤버 상태 읽기
    const res = await fetch(`${DB_URL}${CO_PATH}online.json`);
    const data = res.ok ? await res.json() : {};
    const now = Date.now();
    CO_MEMBERS.forEach(m => {
      const dot = document.getElementById('co-status-' + m);
      if (!dot) return;
      const ts = data && data[m];
      const online = ts && (now - ts) < 30000;
      dot.style.background = online ? '#22c55e' : '#374151';
      dot.title = online ? '온라인' : '오프라인';
    });
  } catch(e) {}
}

// ─── 홈 ───
async function loadCoHome() {
  loadCoFunds();
  loadCoActivityLog();
  loadCoTaskCount();
}

async function loadCoFunds() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}funds.json`);
    const v = res.ok ? await res.json() : 0;
    const funds = v || 0;
    const el1 = document.getElementById('co-funds');
    const el2 = document.getElementById('co-funds-big');
    if (el1) el1.textContent = '₩' + funds.toLocaleString();
    if (el2) el2.textContent = '₩' + funds.toLocaleString();
  } catch(e) {}
}

async function loadCoActivityLog() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}activity.json?orderBy="ts"&limitToLast=10`);
    const data = res.ok ? await res.json() : null;
    const el = document.getElementById('co-activity-log');
    if (!el) return;
    if (!data) { el.textContent = '활동 없음'; return; }
    const items = Object.values(data).sort((a,b) => b.ts - a.ts);
    el.innerHTML = items.map(item => {
      const d = new Date(item.ts);
      const t = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      return `<div style="padding:3px 0;border-bottom:1px solid #1e2d40;"><span style="color:#475569;">[${t}]</span> <span style="color:#93c5fd;">${_escapeHtml(item.user)}</span> <span style="color:#64748b;">${_escapeHtml(item.msg)}</span></div>`;
    }).join('');
  } catch(e) {}
}

async function loadCoTaskCount() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}tasks.json`);
    const data = res.ok ? await res.json() : null;
    const el = document.getElementById('co-task-count');
    if (!el) return;
    if (!data) { el.textContent = '0건'; return; }
    const items = Object.values(data);
    const active = items.filter(t => !t.done).length;
    el.textContent = active + '건';
  } catch(e) {}
}

async function coLogActivity(msg) {
  try {
    await fetch(`${DB_URL}${CO_PATH}activity.json`, {
      method: 'POST',
      body: JSON.stringify({ user: currentUsername, msg, ts: Date.now() })
    });
  } catch(e) {}
}

// ─── 채팅 ───
async function fetchCoChat() {
  if (!isCoMember()) return;
  try {
    const url = coLastChatTs > 0
      ? `${DB_URL}${CO_PATH}chat.json?orderBy="ts"&startAt=${coLastChatTs+1}&limitToLast=30`
      : `${DB_URL}${CO_PATH}chat.json?orderBy="ts"&limitToLast=30`;
    const res = await fetch(url);
    const data = res.ok ? await res.json() : null;
    if (!data) return;
    const msgs = Object.values(data).sort((a,b) => a.ts - b.ts);
    if (!msgs.length) return;
    const container = document.getElementById('co-chat-messages');
    if (!container) return;
    msgs.forEach(m => {
      const isMine = m.u === currentUsername;
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = isMine ? 'flex-end' : 'flex-start';
      const senderColor = m.u === CO_CEO ? '#fbbf24' : '#c084fc';
      wrap.innerHTML = `
        <div class="co-chat-sender" style="color:${senderColor};margin-${isMine?'right':'left'}:4px;">${_escapeHtml(m.u)}</div>
        <div class="co-chat-bubble ${isMine?'mine':'theirs'}">${_escapeHtml(m.msg)}</div>
      `;
      container.appendChild(wrap);
      coLastChatTs = Math.max(coLastChatTs, m.ts);
    });
    scrollCoChat();
  } catch(e) {}
}

async function sendCoChat() {
  if (!isCoMember()) return;
  const input = document.getElementById('co-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  try {
    await fetch(`${DB_URL}${CO_PATH}chat.json`, {
      method: 'POST',
      body: JSON.stringify({ u: currentUsername, msg, ts: Date.now() })
    });
    fetchCoChat();
  } catch(e) {}
}
window.sendCoChat = sendCoChat;

function scrollCoChat() {
  const el = document.getElementById('co-chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

// ─── 업무 ───
async function coAssignTask() {
  if (currentUsername !== CO_CEO) return;
  const input = document.getElementById('co-task-input');
  const priEl = document.getElementById('co-task-priority');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const priority = priEl ? priEl.value : 'normal';
  try {
    await fetch(`${DB_URL}${CO_PATH}tasks.json`, {
      method: 'POST',
      body: JSON.stringify({ content, priority, done: false, ts: Date.now(), by: currentUsername })
    });
    coLogActivity(`업무 지시: "${content}"`);
    loadCoTasks();
    loadCoHome();
  } catch(e) {}
}
window.coAssignTask = coAssignTask;

async function coCompleteTask(key, el) {
  try {
    await fetch(`${DB_URL}${CO_PATH}tasks/${key}.json`, {
      method: 'PATCH',
      body: JSON.stringify({ done: true, completedBy: currentUsername, completedAt: Date.now() })
    });
    coLogActivity('업무 완료');
    if (el) el.closest('.co-task-item').classList.add('done');
    loadCoTasks();
    loadCoHome();
  } catch(e) {}
}
window.coCompleteTask = coCompleteTask;

async function coDeleteTask(key) {
  if (currentUsername !== CO_CEO) return;
  await fetch(`${DB_URL}${CO_PATH}tasks/${key}.json`, { method: 'DELETE' });
  loadCoTasks();
  loadCoHome();
}
window.coDeleteTask = coDeleteTask;

async function loadCoTasks() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}tasks.json`);
    const data = res.ok ? await res.json() : null;
    const el = document.getElementById('co-task-list');
    if (!el) return;
    if (!data) { el.innerHTML = '<div style="color:#475569;font-size:12px;text-align:center;padding:20px;">진행 중인 업무 없음</div>'; return; }
    const items = Object.entries(data).sort((a,b) => b[1].ts - a[1].ts);
    const priColors = { urgent: '#ef4444', high: '#f97316', normal: '#3b82f6' };
    const priLabels = { urgent: '긴급', high: '높음', normal: '보통' };
    el.innerHTML = items.map(([key, task]) => {
      const color = priColors[task.priority] || '#3b82f6';
      const label = priLabels[task.priority] || '보통';
      const doneStyle = task.done ? 'opacity:0.45;text-decoration:line-through;' : '';
      const completeBtn = !task.done
        ? `<button onclick="coCompleteTask('${key}',this)" style="background:#16a34a;border:none;border-radius:6px;color:#fff;padding:4px 8px;font-size:10px;cursor:pointer;margin-left:auto;">완료</button>`
        : `<span style="font-size:10px;color:#22c55e;">✓ 완료</span>`;
      const deleteBtn = currentUsername === CO_CEO
        ? `<button onclick="coDeleteTask('${key}')" style="background:#7f1d1d;border:none;border-radius:6px;color:#fca5a5;padding:4px 6px;font-size:10px;cursor:pointer;">🗑</button>`
        : '';
      return `
        <div class="co-task-item ${task.done?'done':''}">
          <div class="co-task-priority-dot" style="background:${color};" title="${label}"></div>
          <div style="flex:1;${doneStyle}">
            <div style="font-size:12px;color:#cce4ff;">${_escapeHtml(task.content)}</div>
            <div style="font-size:10px;color:#475569;margin-top:2px;">지시자: ${_escapeHtml(task.by||'?')} · <span style="color:${color};">${label}</span></div>
          </div>
          ${completeBtn}
          ${deleteBtn}
        </div>
      `;
    }).join('');
  } catch(e) {}
}

// ─── 재무 ───
async function coDeposit() {
  if (currentUsername !== CO_CEO) return;
  const input = document.getElementById('co-deposit-amount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) return;
  input.value = '';
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}funds.json`);
    const cur = (res.ok ? await res.json() : 0) || 0;
    await fetch(`${DB_URL}${CO_PATH}funds.json`, { method: 'PUT', body: JSON.stringify(cur + amount) });
    await fetch(`${DB_URL}${CO_PATH}finance_log.json`, {
      method: 'POST',
      body: JSON.stringify({ type: '입금', amount, user: currentUsername, ts: Date.now() })
    });
    coLogActivity(`회사 자금 입금 ₩${amount.toLocaleString()}`);
    loadCoFunds();
    loadCoFinanceLog();
    showNotice(`🏢 회사 자금 ₩${amount.toLocaleString()} 입금 완료`);
  } catch(e) {}
}
window.coDeposit = coDeposit;

async function coPaySalary() {
  if (currentUsername !== CO_CEO) return;
  const input = document.getElementById('co-salary-amount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) return;
  input.value = '';
  try {
    // 회사 자금 차감
    const res = await fetch(`${DB_URL}${CO_PATH}funds.json`);
    const cur = (res.ok ? await res.json() : 0) || 0;
    if (cur < amount) { showNotice('⚠️ 회사 자금이 부족합니다.'); return; }
    await fetch(`${DB_URL}${CO_PATH}funds.json`, { method: 'PUT', body: JSON.stringify(cur - amount) });
    // hsy 개인 자금 지급
    const uRes = await fetch(`${DB_URL}users/hsy.json`);
    const uData = uRes.ok ? await uRes.json() : {};
    const hMoney = ((uData && uData.money) || 0) + amount;
    await fetch(`${DB_URL}users/hsy/money.json`, { method: 'PUT', body: JSON.stringify(hMoney) });
    // 로그
    await fetch(`${DB_URL}${CO_PATH}finance_log.json`, {
      method: 'POST',
      body: JSON.stringify({ type: '급여지급', amount, user: 'hsy', ts: Date.now() })
    });
    coLogActivity(`hsy에게 급여 ₩${amount.toLocaleString()} 지급`);
    loadCoFunds();
    loadCoFinanceLog();
    showNotice(`💸 hsy에게 급여 ₩${amount.toLocaleString()} 지급 완료`);
  } catch(e) { showNotice('오류: 급여 지급 실패'); }
}
window.coPaySalary = coPaySalary;

async function loadCoFinanceLog() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}finance_log.json?orderBy="ts"&limitToLast=15`);
    const data = res.ok ? await res.json() : null;
    const el = document.getElementById('co-finance-log');
    if (!el) return;
    if (!data) { el.textContent = '내역 없음'; return; }
    const items = Object.values(data).sort((a,b) => b.ts - a.ts);
    const typeColors = { '입금': '#22c55e', '급여지급': '#f59e0b', '출금': '#ef4444' };
    el.innerHTML = items.map(item => {
      const d = new Date(item.ts);
      const t = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const color = typeColors[item.type] || '#60a5fa';
      return `<div class="co-finance-row"><span style="color:${color};">${_escapeHtml(item.type)}</span><span style="color:#93c5fd;">₩${(item.amount||0).toLocaleString()}</span><span style="color:#475569;">${_escapeHtml(item.user||'')} · ${t}</span></div>`;
    }).join('');
  } catch(e) {}
}

// ─── 공지 ───
async function coPostNotice() {
  if (currentUsername !== CO_CEO) return;
  const input = document.getElementById('co-notice-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await fetch(`${DB_URL}${CO_PATH}notices.json`, {
      method: 'POST',
      body: JSON.stringify({ content, by: currentUsername, ts: Date.now() })
    });
    coLogActivity('공지 등록');
    loadCoNotices();
    showNotice('📢 공지가 등록되었습니다.');
  } catch(e) {}
}
window.coPostNotice = coPostNotice;

async function coDeleteNotice(key) {
  if (currentUsername !== CO_CEO) return;
  await fetch(`${DB_URL}${CO_PATH}notices/${key}.json`, { method: 'DELETE' });
  loadCoNotices();
}
window.coDeleteNotice = coDeleteNotice;

async function loadCoNotices() {
  try {
    const res = await fetch(`${DB_URL}${CO_PATH}notices.json?orderBy="ts"&limitToLast=20`);
    const data = res.ok ? await res.json() : null;
    const el = document.getElementById('co-notice-list');
    if (!el) return;
    if (!data) { el.innerHTML = '<div style="color:#475569;font-size:12px;text-align:center;padding:20px;">공지 없음</div>'; return; }
    const items = Object.entries(data).sort((a,b) => b[1].ts - a[1].ts);
    el.innerHTML = items.map(([key, notice]) => {
      const d = new Date(notice.ts);
      const t = `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const delBtn = currentUsername === CO_CEO
        ? `<button onclick="coDeleteNotice('${key}')" style="background:none;border:none;color:#475569;font-size:12px;cursor:pointer;margin-left:8px;" title="삭제">✕</button>`
        : '';
      return `
        <div class="co-notice-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;">
            <div style="font-size:12px;color:#cce4ff;line-height:1.5;flex:1;">${_escapeHtml(notice.content)}</div>
            ${delBtn}
          </div>
          <div style="font-size:10px;color:#475569;margin-top:6px;">👑 ${_escapeHtml(notice.by||'?')} · ${t}</div>
        </div>
      `;
    }).join('');
  } catch(e) {}
}

// 전역 노출
window.initCompanyPanel = initCompanyPanel;

})();


// ═══════════════════════════════════════════════════
// 추가 기능 묶음: 레벨/XP · 업적 · 랭킹 · 귓속말 · 이모지반응 · 이벤트
// ═══════════════════════════════════════════════════

// ─── 레벨 시스템 ───
const LEVEL_THRESHOLDS = [0,100,250,500,1000,2000,4000,7000,12000,20000,35000];
const LEVEL_TITLES = ['시민','주민','거주자','활동가','명사','유지','원로','전설','영웅','전설의 영웅','나라의 기둥'];
let myLevel = 1, myXP = 0, myXPGoal = 100;

function getLevelInfo(xp) {
  let lv = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lv = i + 1; else break;
  }
  lv = Math.min(lv, LEVEL_THRESHOLDS.length);
  const cur = LEVEL_THRESHOLDS[lv - 1];
  const next = LEVEL_THRESHOLDS[lv] || LEVEL_THRESHOLDS[lv - 1] + 99999;
  return { lv, title: LEVEL_TITLES[lv - 1] || LEVEL_TITLES[LEVEL_TITLES.length - 1], cur, next, pct: Math.min(100, ((xp - cur) / (next - cur)) * 100) };
}

async function addXP(amount, reason) {
  if (!currentUsername) return;
  try {
    const res = await fetch(`${DB_URL}users/${currentUsername}/xp.json`);
    const cur = (res.ok ? await res.json() : 0) || 0;
    const newXP = cur + amount;
    await fetch(`${DB_URL}users/${currentUsername}/xp.json`, { method: 'PUT', body: JSON.stringify(newXP) });
    const before = getLevelInfo(cur);
    const after  = getLevelInfo(newXP);
    myXP = newXP;
    updateLevelHUD(after);
    if (after.lv > before.lv) onLevelUp(after);
    checkAchievements();
  } catch(e) {}
}

function updateLevelHUD(info) {
  const hud = document.getElementById('level-hud');
  if (hud) hud.style.display = 'flex';
  const badge = document.getElementById('level-badge');
  const bar   = document.getElementById('level-xp-bar');
  const title = document.getElementById('level-title-text');
  if (badge) badge.textContent = 'Lv.' + info.lv;
  if (bar)   bar.style.width   = info.pct + '%';
  if (title) title.textContent = info.title;
  myLevel = info.lv;
}

function onLevelUp(info) {
  showNotice(`🎉 레벨 업! Lv.${info.lv} ${info.title} 달성!`);
  fetch(`${DB_URL}users/${currentUsername}/level.json`, { method:'PUT', body: JSON.stringify(info.lv) });
}

async function loadMyXP() {
  if (!currentUsername) return;
  try {
    const res = await fetch(`${DB_URL}users/${currentUsername}/xp.json`);
    const xp = (res.ok ? await res.json() : 0) || 0;
    myXP = xp;
    updateLevelHUD(getLevelInfo(xp));
    const rankBtn = document.getElementById('ranking-btn');
    if (rankBtn) rankBtn.style.display = '';
    const dmBtn = document.getElementById('dm-notify-btn');
    if (dmBtn) dmBtn.style.display = '';
  } catch(e) {}
}

// 로그인 XP + 분 단위 XP
function startXPTicker() {
  addXP(50, 'login');
  setInterval(() => { addXP(1, 'time'); }, 60000);
}

// ─── 업적 시스템 ───
const FEAT_ACHIEVEMENTS = [
  { id:'first_login',    icon:'🌟', name:'첫 발걸음',   desc:'처음 게임에 접속했습니다.', check: ()=>true },
  { id:'chat10',         icon:'💬', name:'수다쟁이',    desc:'채팅 메시지 10개 이상 전송', check: async ()=> await getDBVal(`users/${currentUsername}/chatCount`) >= 10 },
  { id:'millionaire',    icon:'💰', name:'백만장자',    desc:'재산 ₩1,000,000 이상 보유',  check: async ()=> (P.money||0) >= 1000000 },
  { id:'level5',         icon:'⭐', name:'나라의 기둥', desc:'레벨 5 이상 달성',           check: ()=> myLevel >= 5 },
  { id:'level10',        icon:'🏆', name:'전설의 시작', desc:'레벨 10 이상 달성',          check: ()=> myLevel >= 10 },
];

async function getDBVal(path) {
  try { const r = await fetch(`${DB_URL}${path}.json`); return r.ok ? await r.json() : null; } catch(e){ return null; }
}

async function checkAchievements() {
  if (!currentUsername) return;
  const done = await getDBVal(`users/${currentUsername}/achievements`) || {};
  for (const ach of FEAT_ACHIEVEMENTS) {
    if (done[ach.id]) continue;
    let pass = false;
    try { pass = await ach.check(); } catch(e){}
    if (pass) {
      done[ach.id] = Date.now();
      await fetch(`${DB_URL}users/${currentUsername}/achievements.json`, { method:'PUT', body:JSON.stringify(done) });
      showAchievementToast(ach);
      addXP(200, 'achievement');
    }
  }
}

function showAchievementToast(ach) {
  const el = document.getElementById('achievement-toast');
  const t  = document.getElementById('achievement-toast-text');
  const d  = document.getElementById('achievement-toast-desc');
  if (!el) return;
  if (t) t.textContent = ach.icon + ' ' + ach.name;
  if (d) d.textContent = ach.desc;
  el.classList.remove('hide');
  el.classList.add('show');
  el.style.display = 'block';
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => { el.style.display='none'; el.classList.remove('hide'); }, 300);
  }, 3500);
}

// ─── 랭킹 보드 ───
let rankPanelOpen = false;
let currentRankTab = 'money';

function toggleRankingPanel() {
  rankPanelOpen = !rankPanelOpen;
  const el = document.getElementById('ranking-panel');
  if (!el) return;
  el.style.display = rankPanelOpen ? 'block' : 'none';
  if (rankPanelOpen) loadRanking(currentRankTab);
}
window.toggleRankingPanel = toggleRankingPanel;

function switchRankTab(tab) {
  currentRankTab = tab;
  document.querySelectorAll('.rank-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  loadRanking(tab);
}
window.switchRankTab = switchRankTab;

async function loadRanking(tab) {
  const el = document.getElementById('ranking-list');
  if (!el) return;
  el.innerHTML = '<div style="color:#475569;text-align:center;padding:20px;">불러오는 중...</div>';
  try {
    const res = await fetch(`${DB_URL}users.json?shallow=true`);
    const keys = res.ok ? await res.json() : {};
    if (!keys) { el.innerHTML = '<div style="color:#475569;text-align:center;padding:20px;">데이터 없음</div>'; return; }
    const userNames = Object.keys(keys);
    const userData = await Promise.all(userNames.map(async u => {
      const r = await fetch(`${DB_URL}users/${u}.json`);
      const d = r.ok ? await r.json() : {};
      return { name: u, money: d?.money || 0, xp: d?.xp || 0, level: getLevelInfo(d?.xp || 0).lv, title: getLevelInfo(d?.xp || 0).title };
    }));
    const sorted = userData.sort((a,b) => tab === 'money' ? b.money - a.money : b.xp - a.xp).slice(0, 15);
    const medals = ['gold','silver','bronze'];
    el.innerHTML = sorted.map((u, i) => {
      const rankCls = medals[i] || '';
      const isMe = u.name === currentUsername;
      return `
        <div class="rank-row" style="${isMe ? 'background:rgba(99,102,241,0.1);border-radius:8px;' : ''}">
          <div class="rank-num ${rankCls}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
          <div style="flex:1">
            <div style="font-weight:700;color:${isMe?'#818cf8':'#cce4ff'};">${_escapeHtml(u.name)}${isMe?' (나)':''}</div>
            <div style="font-size:10px;color:#475569;">Lv.${u.level} ${u.title}</div>
          </div>
          <div style="font-weight:700;color:#facc15;font-size:13px;">${tab==='money'?'₩'+u.money.toLocaleString():'⭐'+u.xp.toLocaleString()+'XP'}</div>
        </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:#ef4444;text-align:center;padding:20px;">오류 발생</div>'; }
}

// ─── 귓속말(DM) ───
let dmTarget = null;
let dmPollInterval = null;
let dmLastTs = 0;
let dmUnread = 0;

function getDMKey(a, b) { return [a, b].sort().join('__'); }

function openDmWith(username) {
  if (!currentUsername || username === currentUsername) return;
  dmTarget = username;
  dmLastTs = 0;
  dmUnread = 0;
  updateDMNotifyBtn();
  const panel = document.getElementById('dm-panel');
  const nameEl = document.getElementById('dm-target-name');
  const msgs   = document.getElementById('dm-messages');
  if (nameEl) nameEl.textContent = username;
  if (msgs)   msgs.innerHTML = '';
  if (panel)  panel.style.display = 'block';
  fetchDM();
  if (dmPollInterval) clearInterval(dmPollInterval);
  dmPollInterval = setInterval(fetchDM, 3000);
}
window.openDmWith = openDmWith;

function closeDmPanel() {
  const panel = document.getElementById('dm-panel');
  if (panel) panel.style.display = 'none';
  if (dmPollInterval) { clearInterval(dmPollInterval); dmPollInterval = null; }
}
window.closeDmPanel = closeDmPanel;

async function sendDM() {
  if (!currentUsername || !dmTarget) return;
  const input = document.getElementById('dm-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const key = getDMKey(currentUsername, dmTarget);
  await fetch(`${DB_URL}dm/${key}.json`, {
    method: 'POST',
    body: JSON.stringify({ from: currentUsername, to: dmTarget, msg, ts: Date.now() })
  });
  fetchDM();
}
window.sendDM = sendDM;

async function fetchDM() {
  if (!currentUsername || !dmTarget) return;
  const key = getDMKey(currentUsername, dmTarget);
  const url = dmLastTs > 0
    ? `${DB_URL}dm/${key}.json?orderBy="ts"&startAt=${dmLastTs+1}&limitToLast=20`
    : `${DB_URL}dm/${key}.json?orderBy="ts"&limitToLast=30`;
  try {
    const res = await fetch(url);
    const data = res.ok ? await res.json() : null;
    if (!data) return;
    const msgs = Object.values(data).sort((a,b) => a.ts - b.ts);
    if (!msgs.length) return;
    const container = document.getElementById('dm-messages');
    if (!container) return;
    msgs.forEach(m => {
      const isMine = m.from === currentUsername;
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.justifyContent = isMine ? 'flex-end' : 'flex-start';
      el.innerHTML = `<div class="dm-bubble ${isMine?'mine':'theirs'}">${_escapeHtml(m.msg)}</div>`;
      container.appendChild(el);
      dmLastTs = Math.max(dmLastTs, m.ts);
    });
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

// 수신 DM 감지 (30초 주기)
async function pollIncomingDM() {
  if (!currentUsername) return;
  try {
    const res = await fetch(`${DB_URL}dm.json?shallow=true`);
    const keys = res.ok ? await res.json() : {};
    if (!keys) return;
    let newCount = 0;
    for (const key of Object.keys(keys)) {
      if (!key.includes(currentUsername)) continue;
      const other = key.split('__').find(n => n !== currentUsername);
      if (other === dmTarget) continue;
      const r2 = await fetch(`${DB_URL}dm/${key}.json?orderBy="ts"&limitToLast=1`);
      const d = r2.ok ? await r2.json() : null;
      if (!d) continue;
      const last = Object.values(d)[0];
      if (last && last.to === currentUsername && (Date.now() - last.ts) < 60000) newCount++;
    }
    dmUnread += newCount;
    updateDMNotifyBtn();
  } catch(e) {}
}

function openDmNotify() {
  dmUnread = 0;
  updateDMNotifyBtn();
  const panel = document.getElementById('dm-panel');
  if (panel && panel.style.display === 'none') {
    panel.style.display = 'block';
    const nameEl = document.getElementById('dm-target-name');
    if (nameEl) nameEl.textContent = '받은 메시지 확인';
  }
}
window.openDmNotify = openDmNotify;

function updateDMNotifyBtn() {
  const btn = document.getElementById('dm-notify-btn');
  const cnt = document.getElementById('dm-notify-count');
  if (!btn || !cnt) return;
  cnt.textContent = dmUnread;
  btn.style.display = dmUnread > 0 ? '' : 'none';
}

// ─── 이모지 반응 ───
const REACT_EMOJIS = ['👍','❤️','😂','😮','😢','🔥'];

function addReactionUI(msgEl, chatKey) {
  if (!msgEl || !chatKey || !currentUsername) return;
  // 반응 선택 버튼
  const picker = document.createElement('div');
  picker.className = 'react-picker';
  picker.innerHTML = REACT_EMOJIS.map(e =>
    `<span style="font-size:16px;cursor:pointer;padding:2px 3px;" onclick="reactToMsg('${chatKey}','${e}',this)">${e}</span>`
  ).join('');
  // 반응 표시 영역
  const reactArea = document.createElement('div');
  reactArea.className = 'chat-reactions';
  reactArea.id = 'react-' + chatKey;
  msgEl.style.position = 'relative';
  const triggerBtn = document.createElement('span');
  triggerBtn.textContent = '😊';
  triggerBtn.style.cssText = 'font-size:11px;cursor:pointer;opacity:0.4;margin-left:4px;';
  triggerBtn.onclick = (e) => { e.stopPropagation(); picker.style.display = picker.style.display==='flex'?'none':'flex'; };
  msgEl.appendChild(triggerBtn);
  msgEl.appendChild(picker);
  msgEl.appendChild(reactArea);
  loadReactions(chatKey, reactArea);
}

async function reactToMsg(chatKey, emoji, el) {
  if (!currentUsername) return;
  el.closest('.react-picker').style.display = 'none';
  try {
    const path = `chat_reactions/${chatKey}/${emoji}/${currentUsername}`;
    const r = await fetch(`${DB_URL}${path}.json`);
    const existing = r.ok ? await r.json() : null;
    if (existing) {
      await fetch(`${DB_URL}${path}.json`, { method:'DELETE' });
    } else {
      await fetch(`${DB_URL}${path}.json`, { method:'PUT', body:'true' });
    }
    const area = document.getElementById('react-' + chatKey);
    if (area) loadReactions(chatKey, area);
  } catch(e) {}
}
window.reactToMsg = reactToMsg;

async function loadReactions(chatKey, area) {
  if (!area) return;
  try {
    const res = await fetch(`${DB_URL}chat_reactions/${chatKey}.json`);
    const data = res.ok ? await res.json() : null;
    if (!data) { area.innerHTML = ''; return; }
    area.innerHTML = Object.entries(data).map(([emoji, users]) => {
      const count = Object.keys(users).length;
      const iReacted = users[currentUsername] ? 'reacted' : '';
      return `<span class="react-btn ${iReacted}" onclick="reactToMsg('${chatKey}','${emoji}',this)">${emoji} ${count}</span>`;
    }).join('');
  } catch(e) {}
}

// ─── 이벤트 시스템 ───
let eventPollInterval = null;
let currentEventKey = null;

async function startEvent(title, desc, rewardAmount, durationSec, host) {
  if (!currentUsername) return;
  const endsAt = Date.now() + durationSec * 1000;
  const eventData = { title, desc, reward: rewardAmount, host, endsAt, ts: Date.now(), participants: {} };
  await fetch(`${DB_URL}events/active.json`, { method:'PUT', body: JSON.stringify(eventData) });
  showNotice(`🎉 이벤트 "${title}" 시작!`);
  addXP(100, 'event_host');
}

function hsyStartEvent() {
  const title   = (document.getElementById('hsy-event-title')?.value || '').trim();
  const desc    = (document.getElementById('hsy-event-desc')?.value  || '').trim();
  const reward  = parseInt(document.getElementById('hsy-event-reward')?.value) || 0;
  const dur     = parseInt(document.getElementById('hsy-event-duration')?.value) || 300;
  if (!title) { showNotice('⚠️ 이벤트 제목을 입력하세요.'); return; }
  startEvent(title, desc, reward, dur, currentUsername);
  document.getElementById('hsy-event-title').value = '';
  document.getElementById('hsy-event-desc').value  = '';
  document.getElementById('hsy-event-reward').value = '';
}
window.hsyStartEvent = hsyStartEvent;

async function pollEvents() {
  try {
    const res = await fetch(`${DB_URL}events/active.json`);
    const ev  = res.ok ? await res.json() : null;
    if (!ev || !ev.endsAt) { closeEventPopup(); return; }
    if (Date.now() > ev.endsAt) {
      await fetch(`${DB_URL}events/active.json`, { method:'DELETE' });
      closeEventPopup();
      return;
    }
    const alreadyJoined = ev.participants && ev.participants[currentUsername];
    showEventPopup(ev, alreadyJoined);
  } catch(e) {}
}

function showEventPopup(ev, joined) {
  const popup = document.getElementById('event-popup');
  if (!popup) return;
  popup.style.display = 'block';
  const remaining = Math.max(0, Math.floor((ev.endsAt - Date.now()) / 1000));
  const mm = Math.floor(remaining/60).toString().padStart(2,'0');
  const ss = (remaining % 60).toString().padStart(2,'0');
  const titleEl  = document.getElementById('event-popup-title');
  const descEl   = document.getElementById('event-popup-desc');
  const rewardEl = document.getElementById('event-popup-reward');
  const hostEl   = document.getElementById('event-popup-host');
  const timerEl  = document.getElementById('event-popup-timer');
  const joinBtn  = document.getElementById('event-join-btn');
  if (titleEl)  titleEl.textContent  = ev.title || '이벤트';
  if (descEl)   descEl.textContent   = ev.desc  || '';
  if (rewardEl) rewardEl.textContent = '₩' + (ev.reward||0).toLocaleString() + ' 보상';
  if (hostEl)   hostEl.textContent   = ev.host  || '?';
  if (timerEl)  timerEl.textContent  = `${mm}:${ss}`;
  if (joinBtn) {
    joinBtn.textContent = joined ? '✅ 참가 완료' : '참가하기';
    joinBtn.disabled    = !!joined;
    joinBtn.style.opacity = joined ? '0.5' : '1';
  }
}

function closeEventPopup() {
  const popup = document.getElementById('event-popup');
  if (popup) popup.style.display = 'none';
}
window.closeEventPopup = closeEventPopup;

async function joinEvent() {
  if (!currentUsername) return;
  try {
    const res = await fetch(`${DB_URL}events/active.json`);
    const ev  = res.ok ? await res.json() : null;
    if (!ev || !ev.endsAt || Date.now() > ev.endsAt) { showNotice('⚠️ 이벤트가 종료됐습니다.'); closeEventPopup(); return; }
    if (ev.participants && ev.participants[currentUsername]) { showNotice('이미 참가했습니다.'); return; }
    // 보상 지급
    const uRes = await fetch(`${DB_URL}users/${currentUsername}/money.json`);
    const curMoney = (uRes.ok ? await uRes.json() : 0) || 0;
    await fetch(`${DB_URL}users/${currentUsername}/money.json`, { method:'PUT', body: JSON.stringify(curMoney + (ev.reward||0)) });
    await fetch(`${DB_URL}events/active/participants/${currentUsername}.json`, { method:'PUT', body:'true' });
    if (typeof P !== 'undefined') P.money = curMoney + (ev.reward||0);
    addXP(50, 'event_join');
    showNotice(`🎉 이벤트 참가! ₩${(ev.reward||0).toLocaleString()} 지급됐습니다!`);
    pollEvents();
  } catch(e) {}
}
window.joinEvent = joinEvent;

// ─── 채팅 메시지당 XP + 카운트 ───
const _origSendChat = window.sendChat;
window.sendChat = function() {
  if (typeof _origSendChat === 'function') _origSendChat.apply(this, arguments);
  // XP 지급
  addXP(2, 'chat');
  // 채팅 카운트 증가
  fetch(`${DB_URL}users/${currentUsername}/chatCount.json`).then(r => r.json()).then(v => {
    fetch(`${DB_URL}users/${currentUsername}/chatCount.json`, { method:'PUT', body: JSON.stringify((v||0)+1) });
    checkAchievements();
  }).catch(()=>{});
};

// ─── 초기화 ───
function initAllFeatures() {
  loadMyXP();
  startXPTicker();
  checkAchievements();
  // 이벤트 폴링 (30초)
  if (eventPollInterval) clearInterval(eventPollInterval);
  eventPollInterval = setInterval(pollEvents, 30000);
  pollEvents();
  // DM 수신 감지 (30초)
  setInterval(pollIncomingDM, 30000);
}
window.initAllFeatures = initAllFeatures;


// ══════════════════════════════════════════
// 모바일 컨트롤 시스템
// ══════════════════════════════════════════
(function(){

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

function initMobileControls() {
  if (!isTouchDevice) return;

  const mobileDiv = document.getElementById('mobile-controls');
  if (mobileDiv) mobileDiv.style.display = 'block';

  // 공격 버튼은 ree1203만
  if (currentUsername === 'ree1203') {
    const atk = document.getElementById('mobile-attack-btn');
    if (atk) atk.style.display = 'block';
  }

  initJoystick();
  patchTouchCamera();
}
window.initMobileControls = initMobileControls;

// ─── 키 시뮬레이션 ───
window.mobileKeyDown = function(key) {
  K[key] = true;
};
window.mobileKeyUp = function(key) {
  K[key] = false;
};

// ─── 가상 조이스틱 ───
function initJoystick() {
  const zone  = document.getElementById('joystick-zone');
  const outer = document.getElementById('joystick-outer');
  const inner = document.getElementById('joystick-inner');
  if (!zone || !inner) return;

  const R = 65; // 외부 원 반지름 (px)
  const DEAD = 12; // 데드존 (px)
  let active = false;
  let originX = 0, originY = 0;
  let joyTouchId = null;

  function resetInner() {
    inner.style.transform = 'translate(-50%, -50%)';
    inner.style.left = '50%';
    inner.style.top  = '50%';
    K['w'] = K['s'] = K['a'] = K['d'] = K['W'] = K['S'] = K['A'] = K['D'] = false;
  }

  zone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (active) return;
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    active = true;
    const rect = outer.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top  + rect.height / 2;
  }, { passive: false });

  window.addEventListener('touchmove', function(e) {
    if (!active) return;
    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joyTouchId) { t = e.touches[i]; break; }
    }
    if (!t) return;

    let dx = t.clientX - originX;
    let dy = t.clientY - originY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const clamped = Math.min(dist, R);
    const nx = (dx / dist) * clamped;
    const ny = (dy / dist) * clamped;

    // 도트 위치
    inner.style.left = (R + nx) + 'px';
    inner.style.top  = (R + ny) + 'px';
    inner.style.transform = 'translate(-50%, -50%)';

    // 데드존 처리 후 키 시뮬레이션
    K['w'] = K['s'] = K['a'] = K['d'] = K['W'] = K['S'] = K['A'] = K['D'] = false;
    if (dist < DEAD) return;

    const angle = Math.atan2(dy, dx); // -π ~ π
    const deg   = angle * 180 / Math.PI; // -180 ~ 180

    // 8방향 매핑
    if (deg > -157.5 && deg < -22.5) {
      // 위 (-135 ~ -22.5 = 상단)
      K['w'] = K['W'] = true;
    }
    if (deg > 22.5 && deg < 157.5) {
      // 아래
      K['s'] = K['S'] = true;
    }
    if (Math.abs(deg) > 112.5) {
      // 왼쪽
      K['a'] = K['A'] = true;
    }
    if (Math.abs(deg) < 67.5) {
      // 오른쪽
      K['d'] = K['D'] = true;
    }
  }, { passive: true });

  window.addEventListener('touchend', function(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId) {
        active = false;
        joyTouchId = null;
        resetInner();
        break;
      }
    }
  }, { passive: true });

  window.addEventListener('touchcancel', function() {
    active = false;
    joyTouchId = null;
    resetInner();
  }, { passive: true });
}

// ─── 카메라 터치 (오른쪽 영역) — yaw + pitch ───
function patchTouchCamera() {
  const c = document.getElementById('c') || document.querySelector('canvas');
  if (!c) return;

  let camTouchId   = null;
  let camPrevX = 0, camPrevY = 0;
  const JOY_RIGHT_EDGE = 160; // px — 조이스틱 영역 오른쪽 경계

  // 기존 touchstart/touchmove/touchend를 덮어씌움
  c.addEventListener('touchstart', function(e) {
    if (document.getElementById('lock-screen')?.style.display !== 'none') return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX > JOY_RIGHT_EDGE && camTouchId === null) {
        camTouchId = t.identifier;
        camPrevX = t.clientX;
        camPrevY = t.clientY;
        break;
      }
    }
  }, { passive: true });

  c.addEventListener('touchmove', function(e) {
    if (camTouchId === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier !== camTouchId) continue;
      const dx = t.clientX - camPrevX;
      const dy = t.clientY - camPrevY;
      camPrevX = t.clientX;
      camPrevY = t.clientY;

      // 수평 = yaw, 수직 = pitch
      cameraYaw   -= dx * 0.005;
      cameraPitch  = Math.max(-0.5, Math.min(0.8, cameraPitch + dy * 0.004));
      if (typeof P !== 'undefined') P.angle = cameraYaw;
      break;
    }
  }, { passive: true });

  c.addEventListener('touchend', function(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === camTouchId) {
        camTouchId = null;
        break;
      }
    }
  }, { passive: true });

  c.addEventListener('touchcancel', function() {
    camTouchId = null;
  }, { passive: true });
}

// ─── 자동 감지 ───
// 로그인 후 initMobileControls()를 호출하므로 여기서는 대기
// isTouchDevice이면 lock-screen 해제 직후 자동 실행
if (isTouchDevice) {
  // 로그인 전에도 화면 크기 조정
  document.body.classList.add('is-mobile');
  console.log('[Mobile] 터치 기기 감지됨');
}

})();

