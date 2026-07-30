// ════════════════════════════════════════════
//  우리들의 날 - 게임 Firebase 연동 스크립트
//  게임 HTML 파일에 아래 스크립트 태그 추가 후
//  이 파일을 불러오세요.
//
//  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
//  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
//  <script src="game-firebase.js"></script>
// ════════════════════════════════════════════

const firebaseConfig = {
  databaseURL: "https://our-nation-22b63-default-rtdb.asia-southeast1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── 현재 로그인한 플레이어 ID (게임에서 설정) ──
// 예: GameDB.myPlayerId = "player_001";
const GameDB = {
  myPlayerId: null,
  playerRef: null,
  commandRef: null,

  // ══════════════════════════════
  //  1. 플레이어 접속 등록
  //     게임 시작 시 호출
  // ══════════════════════════════
  login(playerId, nickname) {
    this.myPlayerId = playerId;
    this.playerRef = db.ref(`players/${playerId}`);

    // 최초 접속이면 기본 데이터 생성, 이미 있으면 접속 정보만 업데이트
    this.playerRef.once('value', snap => {
      if (!snap.exists()) {
        this.playerRef.set({
          nickname: nickname,
          level: 1,
          xp: 0,
          money: 0,
          health: 100,
          speed: 1.0,
          job: '무직',
          team: '없음',
          online: true,
          inventory: {},
          status: {
            isBanned: false,
            isChatBanned: false,
            isVoiceBanned: false,
            warnings: []
          },
          stats: {
            playTime: 0,
            lastSeen: Date.now(),
            ip: '0.0.0.0'
          }
        });
      } else {
        this.playerRef.update({
          online: true,
          'stats/lastSeen': Date.now()
        });
      }
    });

    // 접속 종료 시 자동으로 offline 처리
    this.playerRef.onDisconnect().update({
      online: false,
      'stats/lastSeen': Date.now()
    });

    // 플레이 시간 카운터 (1분마다 +1)
    this._startPlaytimeCounter();

    // 관리자 명령 수신 시작
    this._listenCommands();

    console.log(`[GameDB] 로그인: ${playerId} (${nickname})`);
  },

  // ══════════════════════════════
  //  2. 플레이어 접속 종료
  // ══════════════════════════════
  logout() {
    if (!this.myPlayerId) return;
    this.playerRef.update({ online: false, 'stats/lastSeen': Date.now() });
    if (this._playtimeTimer) clearInterval(this._playtimeTimer);
    if (this.commandRef) this.commandRef.off();
    console.log(`[GameDB] 로그아웃: ${this.myPlayerId}`);
  },

  // ══════════════════════════════
  //  3. 플레이어 데이터 저장
  //     필요한 필드만 업데이트
  // ══════════════════════════════
  save(data) {
    if (!this.playerRef) return;
    this.playerRef.update(data);
  },

  // ══════════════════════════════
  //  4. 플레이어 데이터 실시간 감시
  //     데이터 변경 시 콜백 호출
  // ══════════════════════════════
  onPlayerUpdate(callback) {
    if (!this.playerRef) return;
    this.playerRef.on('value', snap => {
      const data = snap.val();
      if (data) callback(data);
    });
  },

  // ══════════════════════════════
  //  5. 관리자 명령 수신 & 처리
  // ══════════════════════════════
  _listenCommands() {
    // 현재 시각 이후 새로 들어오는 명령만 처리
    const since = Date.now();
    this.commandRef = db.ref('commands').orderByChild('timestamp').startAt(since);

    this.commandRef.on('child_added', snap => {
      const cmd = snap.val();
      if (!cmd) return;
      // 내 플레이어를 대상으로 하는 명령만 처리
      if (cmd.params && cmd.params.playerId && cmd.params.playerId !== this.myPlayerId) return;

      console.log(`[GameDB] 명령 수신: ${cmd.type}`, cmd.params);
      this._handleCommand(cmd.type, cmd.params || {});

      // 명령 실행 완료 표시
      snap.ref.update({ status: 'executed' });
    });
  },

  _handleCommand(type, params) {
    switch (type) {

      // ── 기본 관리 ──
      case 'kick':
        GameEvents.emit('kick', { reason: params.reason });
        break;

      case 'tempBan':
      case 'permBan':
        GameEvents.emit('banned', { reason: params.reason, expiry: params.banExpiry });
        break;

      case 'unban':
        GameEvents.emit('unbanned', {});
        break;

      case 'chatBan':
        GameEvents.emit('chatBanned', {});
        break;

      case 'chatUnban':
        GameEvents.emit('chatUnbanned', {});
        break;

      case 'voiceBan':
        GameEvents.emit('voiceBanned', {});
        break;

      case 'voiceUnban':
        GameEvents.emit('voiceUnbanned', {});
        break;

      case 'warn':
        GameEvents.emit('warned', { reason: params.reason });
        break;

      case 'changeNickname':
      case 'forceNickname':
        GameEvents.emit('nicknameChanged', { nickname: params.nickname });
        break;

      // ── 스탯 관리 ──
      case 'giveMoney':
        GameEvents.emit('moneyChanged', { amount: params.amount, type: 'give' });
        break;

      case 'takeMoney':
        GameEvents.emit('moneyChanged', { amount: params.amount, type: 'take' });
        break;

      case 'giveXP':
        GameEvents.emit('xpChanged', { amount: params.amount, type: 'give' });
        break;

      case 'takeXP':
        GameEvents.emit('xpChanged', { amount: params.amount, type: 'take' });
        break;

      case 'setLevel':
        GameEvents.emit('levelChanged', { level: params.level });
        break;

      case 'setJob':
        GameEvents.emit('jobChanged', { job: params.job });
        break;

      case 'setTeam':
        GameEvents.emit('teamChanged', { team: params.team });
        break;

      case 'setSpeed':
        GameEvents.emit('speedChanged', { speed: params.speed });
        break;

      // ── 인게임 관리 ──
      case 'revive':
        GameEvents.emit('revived', {});
        break;

      case 'healHealth':
        GameEvents.emit('healed', { amount: params.amount });
        break;

      case 'kill':
        GameEvents.emit('killed', { reason: params.reason });
        break;

      case 'giveItem':
        GameEvents.emit('itemGiven', { itemId: params.itemId, qty: params.qty });
        break;

      case 'removeItem':
        GameEvents.emit('itemRemoved', { itemId: params.itemId, qty: params.qty });
        break;

      // ── 날씨/맵 ──
      case 'setWeather':
        GameEvents.emit('weatherChanged', { type: params.type });
        break;

      case 'toggleWeather':
        GameEvents.emit('weatherToggled', { type: params.type, value: params.value });
        break;

      case 'setDaytime':
        GameEvents.emit('daytimeChanged', { isDaytime: params.isDaytime });
        break;

      case 'setTime':
        GameEvents.emit('timeChanged', { time: params.time });
        break;

      case 'resetMap':
        GameEvents.emit('mapReset', {});
        break;

      case 'lockZone':
        GameEvents.emit('zoneLocked', { zone: params.zone });
        break;

      case 'unlockZone':
        GameEvents.emit('zoneUnlocked', { zone: params.zone });
        break;

      case 'spawnBuilding':
        GameEvents.emit('buildingSpawned', { id: params.id, name: params.name, position: params.position });
        break;

      case 'deleteBuildingById':
        GameEvents.emit('buildingDeleted', { id: params.id });
        break;

      case 'spawnObject':
        GameEvents.emit('objectSpawned', { id: params.id, type: params.type, position: params.position });
        break;

      case 'deleteObjectById':
        GameEvents.emit('objectDeleted', { id: params.id });
        break;

      case 'spawnVehicle':
        GameEvents.emit('vehicleSpawned', { id: params.id, type: params.type, position: params.position });
        break;

      case 'deleteVehicleById':
        GameEvents.emit('vehicleDeleted', { id: params.id });
        break;

      default:
        console.warn(`[GameDB] 알 수 없는 명령: ${type}`);
    }
  },

  // ── 플레이 시간 카운터 ──
  _playtimeTimer: null,
  _startPlaytimeCounter() {
    this._playtimeTimer = setInterval(() => {
      if (!this.playerRef) return;
      this.playerRef.child('stats/playTime').transaction(cur => (cur || 0) + 1);
    }, 60000); // 1분마다
  }
};


// ════════════════════════════════════════════
//  이벤트 시스템
//  게임에서 아래처럼 이벤트 리스너 등록:
//  GameEvents.on('kick', (data) => { /* 킥 처리 */ });
// ════════════════════════════════════════════
const GameEvents = {
  _listeners: {},

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  },

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
};


// ════════════════════════════════════════════
//  맵 상태 실시간 감시
//  날씨, 시간, 구역 잠금 등 변경 시 콜백
// ════════════════════════════════════════════
const GameMap = {
  // 맵 전체 상태 감시
  watch(callback) {
    db.ref('map').on('value', snap => {
      const data = snap.val();
      if (data) callback(data);
    });
  },

  // 날씨만 감시
  onWeatherChange(callback) {
    db.ref('map/weather').on('value', snap => callback(snap.val()));
  },

  // 시간만 감시
  onTimeChange(callback) {
    db.ref('map/time').on('value', snap => callback(snap.val()));
  },

  // 구역 상태 감시
  onZoneChange(callback) {
    db.ref('map/zones').on('value', snap => callback(snap.val() || {}));
  },

  // 건물 변경 감시
  onBuildingChange(callback) {
    db.ref('map/buildings').on('value', snap => callback(snap.val() || {}));
  },

  // 차량 변경 감시
  onVehicleChange(callback) {
    db.ref('map/vehicles').on('value', snap => callback(snap.val() || {}));
  }
};


// ════════════════════════════════════════════
//  아이템 DB 읽기
// ════════════════════════════════════════════
const GameItems = {
  // 전체 아이템 목록 가져오기
  getAll(callback) {
    db.ref('items').once('value', snap => callback(snap.val() || {}));
  },

  // 특정 아이템 정보
  get(itemId, callback) {
    db.ref(`items/${itemId}`).once('value', snap => callback(snap.val()));
  },

  // 아이템 변경 감시 (상점 가격, 드롭률 등)
  watch(callback) {
    db.ref('items').on('value', snap => callback(snap.val() || {}));
  }
};
