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
let currentUsername = "";
let currentPassword = "";
let isCloudConnected = false;
let autoSaveInterval = null;
let viewMode = 'third';
let rainIntensity = 0.0;
let weatherState = 'CLEAR'; // CLEAR, CLOUDY, RAINY, FOGGY
let weatherDuration = 480;  // remaining game-minutes in current state
let cloudiness = 0.0;
let fogIntensity = 0.0;

async function fetchUser(username) {
  try {
    const res = await fetch(`${DB_URL}users/${encodeURIComponent(username)}.json`);
    if (res.status === 401) {
      throw new Error("PERMISSION_DENIED");
    }
    if (!res.ok) {
      throw new Error("HTTP_ERROR_" + res.status);
    }
    return await res.json();
  } catch (err) {
    console.error("Firebase fetch error:", err);
    throw err;
  }
}

async function saveUser(username, password) {
  if (!username) return;
  const cloudDot = document.getElementById('cloudDot');
  const cloudText = document.getElementById('cloudText');
  
  if (cloudDot) {
    cloudDot.className = 'cloud-dot saving';
    cloudText.textContent = '클라우드 저장 중...';
  }

  const payload = {
    password: password,
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
  ['username', 'password', 'loginBtn', 'registerBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

// ── LOGIN BUTTON EVENT LISTENER ──
document.getElementById('loginBtn').addEventListener('click', async () => {
  const uInput = document.getElementById('username').value.trim();
  const pInput = document.getElementById('password').value.trim();
  
  if (!uInput || !pInput) {
    setLoginStatus("아이디와 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }
  
  // Supports Korean characters (Hangul), English, numbers, and underscores (2-15 characters)
  const usernameRegex = /^[a-zA-Z0-9가-힣_]{2,15}$/;
  if (!usernameRegex.test(uInput)) {
    setLoginStatus("아이디는 2~15자의 한글, 영문, 숫자, _만 가능합니다.", "error");
    return;
  }

  setLoginStatus("데이터베이스 연결 중...", "");
  disableLoginInputs(true);

  try {
    const userData = await fetchUser(uInput);
    
    if (!userData) {
      setLoginStatus("존재하지 않는 아이디입니다.", "error");
      disableLoginInputs(false);
      return;
    }

    if (userData.password !== pInput) {
      setLoginStatus("비밀번호가 일치하지 않습니다.", "error");
      disableLoginInputs(false);
      return;
    }

    // Success login
    currentUsername = uInput;
    currentPassword = pInput;
    isCloudConnected = true;

    // Load progress
    P.x = userData.x !== undefined ? userData.x : 32.5;
    P.y = userData.y !== undefined ? userData.y : 32.5;
    P.angle = userData.angle !== undefined ? userData.angle : -Math.PI / 2;
    P.health = userData.health !== undefined ? userData.health : 100;
    P.happy = userData.happy !== undefined ? userData.happy : 75;
    P.hunger = userData.hunger !== undefined ? userData.hunger : 80;
    P.energy = userData.energy !== undefined ? userData.energy : 100;
    P.money = userData.money !== undefined ? userData.money : 500000;
    gMin = userData.gMin !== undefined ? userData.gMin : 480;
    dayN = userData.dayN !== undefined ? userData.dayN : 1;
    P.portfolio = userData.portfolio || { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };

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
    c.requestPointerLock();
    
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

    showNotice(`🏙️ 환영합니다, ${currentUsername}님! 저장 데이터가 로드되었습니다.`);
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
  setLoginStatus("현재 회원가입이 비활성화되어 있습니다. 지정된 계정으로 로그인해 주세요.", "error");
  return;
  
  const uInput = document.getElementById('username').value.trim();
  const pInput = document.getElementById('password').value.trim();
  
  if (!uInput || !pInput) {
    setLoginStatus("아이디와 비밀번호를 모두 입력해 주세요.", "error");
    return;
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
  if (!usernameRegex.test(uInput)) {
    setLoginStatus("아이디는 3~15자의 영문, 숫자, _만 가능합니다.", "error");
    return;
  }
  
  if (pInput.length < 4) {
    setLoginStatus("비밀번호는 최소 4자 이상이어야 합니다.", "error");
    return;
  }

  setLoginStatus("아이디 중복 검사 중...", "");
  disableLoginInputs(true);

  const userData = await fetchUser(uInput);
  
  if (userData) {
    setLoginStatus("이미 존재하는 아이디입니다.", "error");
    disableLoginInputs(false);
    return;
  }

  setLoginStatus("프로필 생성 중...", "success");

  // Success register, create new account with default starting stats
  currentUsername = uInput;
  currentPassword = pInput;
  isCloudConnected = true;

  // Initialize defaults
  P.x = 32.5;
  P.y = 32.5;
  P.angle = -Math.PI / 2;
  P.health = 100;
  P.happy = 75;
  P.hunger = 80;
  P.energy = 100;
  P.money = 500000;
  P.portfolio = { NEO: 0, LHM: 0, HYH: 0, HAN: 0, SEC: 0, HWA: 0, PLI: 0, LGU: 0, COD: 0, WOO: 0, TEN: 0 };
  gMin = 480;
  dayN = 1;

  Sim.init();

  cameraYaw = P.angle;

  if (playerGroup) {
    playerGroup.position.set(P.x, 0, P.y);
  }

  updateHUD();

  // Save to Firebase immediately
  await saveUser(currentUsername, currentPassword);

  // Start game
  document.getElementById('lock-screen').style.display = 'none';
  c.requestPointerLock();
  
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    Sim.tick();
    updateDashboardData();
  }, 10000);

  // Start auto-save loop
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    saveUser(currentUsername, currentPassword);
  }, 15000);

  showNotice(`🏙️ 회원가입 완료! 환영합니다, ${currentUsername}님!`);
});

window.startGuest = function startGuest() {
  currentUsername = '게스트';
  currentPassword = '';
  isCloudConnected = false;

  P.x = 32.5; P.y = 32.5; P.angle = -Math.PI / 2;
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
  if (cloudDot) { cloudDot.className = 'cloud-dot'; cloudText.textContent = '게스트 모드'; }

  document.getElementById('lock-screen').style.display = 'none';

  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => { Sim.tick(); updateDashboardData(); }, 10000);

  showNotice('🎮 게스트 모드로 시작합니다! (저장 없음)');
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

// Touch Drag-to-Rotate (mobile)
c.addEventListener('touchstart', e => {
  if (document.getElementById('lock-screen').style.display !== 'none') return;
  if (e.touches.length === 1) {
    isDragging = true;
    prevMouseX = e.touches[0].clientX;
    prevMouseY = e.touches[0].clientY;
  }
}, { passive: true });

c.addEventListener('touchmove', e => {
  if (isDragging && !dlgOpen && e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - prevMouseX;
    prevMouseX = e.touches[0].clientX;
    prevMouseY = e.touches[0].clientY;

    cameraYaw -= deltaX * 0.006;
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
  else if (e.key === 'Escape' && locked) document.exitPointerLock();
  if (e.key === 'e' || e.key === 'E') interact();
  
  if (e.key === 'Tab') {
    e.preventDefault();
    toggleDashboard(!isDashboardOpen);
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
  const pad = 0.16;
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

let citizenMeshes = [];
let tsGlobal = 0;
let mouseScreenX = 0;
let mouseScreenY = 0;
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

  // Create 3D wandering citizens
  init3DCitizens();
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
  if (!dlgOpen) {
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

  // ── Camera position tracking (1st / 3rd Person / Bird View Toggle) ──
  if (camera) {
    if (viewMode === 'third') {
      if (playerGroup) playerGroup.visible = true;
      const camDist = 4.2;
      let camX = P.x - Math.sin(cameraYaw) * Math.cos(cameraPitch) * camDist;
      let camY = 0.8 + Math.sin(cameraPitch) * camDist;
      let camZ = P.y - Math.cos(cameraYaw) * Math.cos(cameraPitch) * camDist;
      
      camY = Math.max(0.18, camY);
      
      camera.position.set(camX, camY, camZ);
      camera.lookAt(new THREE.Vector3(P.x, 0.75, P.y));
    } else if (viewMode === 'first') {
      if (playerGroup) playerGroup.visible = false;
      camera.position.set(P.x, 1.25, P.y);
      const targetX = P.x + Math.sin(cameraYaw) * Math.cos(cameraPitch);
      const targetY = 1.25 + Math.sin(cameraPitch);
      const targetZ = P.y + Math.cos(cameraYaw) * Math.cos(cameraPitch);
      camera.lookAt(new THREE.Vector3(targetX, targetY, targetZ));
    } else if (viewMode === 'bird') {
      if (playerGroup) playerGroup.visible = true;
      camera.position.set(P.x, 24, P.y + 12);
      camera.lookAt(new THREE.Vector3(P.x, 0, P.y));
    }
  }

  // ─ Stars follow player center to feel infinite ─
  if (starGroup && playerGroup) {
    starGroup.position.copy(playerGroup.position);
  }

  // ─ Game time progression ─
  gMin += dt * 6;
  if (gMin >= 1440) { gMin -= 1440; dayN++; P.hunger = Math.max(0, P.hunger - 10); }

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

  // Stars & moon appear at night
  if (starGroup) {
    const starOpacity = Math.max(0, (1 - smoothDay * 3) * (1 - fogIntensity * 0.7));
    starGroup.material.opacity = Math.min(0.92, starOpacity);
  }

  // Building neon glow: much brighter at night, dimmer in daylight
  const nightGlow = 1 - smoothDay;
  for (let key in bldMaterials) {
    bldMaterials[key].emissiveIntensity = 0.12 + nightGlow * 1.4;
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
  P.hunger = Math.max(0, P.hunger - dt * 0.22);
  P.energy = Math.max(0, P.energy - dt * 0.12);
  if (P.hunger < 15) P.health = Math.max(0, P.health - dt * 0.35);
  if (P.energy < 10) P.happy  = Math.max(0, P.happy  - dt * 0.22);

  updateHUD();

  // Update wandering citizens in 3D
  update3DCitizens(dt);

  // Raycast for Citizen Hover Tooltip
  updateCitizenTooltip();

  // WebGL Render pass
  renderer.render(scene, camera);
  requestAnimationFrame(render);
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
  
  Sim.houses.forEach(h => {
    const card = document.createElement('div');
    card.className = 'db-card re-card';
    card.innerHTML = `
      <div class="re-title">🏠 ${h.name}</div>
      <div class="re-specs">
        면적: ${h.size}㎡<br>
        방 ${h.rooms}개 / 욕실 ${h.baths}개<br>
        수도/광랜: ${h.net}<br>
        관리비: ₦${h.maintenanceFee.toLocaleString()}/월<br>
        전기/수도: ${h.elec}kWh / ${h.water}t
      </div>
      <div class="re-price">
        매매: ₦${h.price.toLocaleString()}<br>
        월세: ₦${h.rent.toLocaleString()}/월
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

    citizenMeshes.push({
      mesh: mesh,
      citizenId: citizen.id,
      tx: spawnTile.x,
      ty: spawnTile.y,
      targetX: spawnTile.x,
      targetY: spawnTile.y,
      speed: 0.8 + Math.random() * 0.6
    });
  }
}

function update3DCitizens(dt) {
  tsGlobal += dt * 1000;
  
  citizenMeshes.forEach(cm => {
    const pos = cm.mesh.position;
    const targetWorldX = cm.targetX + 0.5;
    const targetWorldZ = cm.targetY + 0.5;

    const dx = targetWorldX - pos.x;
    const dz = targetWorldZ - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.03) {
      cm.tx = cm.targetX;
      cm.ty = cm.targetY;
      
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
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
  { name: '북부역', x: 32, y: 18 },
  { name: '동부역', x: 42, y: 32 },
  { name: '서부역', x: 22, y: 32 }
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
