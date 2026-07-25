// ==========================================================
//   네오이현 (Neo-LeeHyeon) 국가 운영 시뮬레이션 엔진
//   simulation.js
// ==========================================================

const Sim = {
  // ── 거시경제 변수 (Macroeconomics) ──
  gdp: 52000000000,        // GDP (₦)
  inflation: 1.8,          // 인플레이션율 (%)
  interestRate: 2.5,       // 기준금리 (%)
  unemploymentRate: 3.5,   // 실업률 (%)
  exchangeRate: 1.0,       // 환율 (1네오 = 1달러 기준)
  nationalDebt: 1200000000,// 국가 부채 (₦)
  treasury: 5000000000,    // 국고 잔고 (₦)
  taxRateIncome: 15,       // 소득세율 (%)
  taxRateCorporate: 10,    // 법인세율 (%)
  taxRateProperty: 1,      // 토지보유세율 (%)

  // ── 20대 행정 부처 예산 배분율 (%) (합계 100%) ──
  budgetAllocation: {
    welfare: 15,     // 복지
    education: 12,   // 교육
    health: 12,      // 의료
    military: 10,    // 군사
    police: 6,       // 경찰
    fire: 4,         // 소방
    environment: 5,  // 환경
    energy: 6,       // 에너지
    agriculture: 4,  // 농업
    space: 3,        // 우주개발
    research: 6,     // 연구(R&D)
    transport: 5,    // 교통
    urbanDev: 6,     // 도시개발
    diplomacy: 3,    // 외교
    industry: 3      // 산업 지원
  },

  // ── 국가 현황 지표 ──
  popHappiness: 82.5,      // 국민 평균 행복도 (%)
  popHealth: 88.0,         // 국민 평균 건강도 (%)
  popCrimeRate: 1.5,       // 범죄율 (%)
  pollution: 15.0,         // 환경 오염도 (%)
  techLevel: 100.0,        // 기술 수준 (R&D 누적)
  spaceProgress: 0.0,      // 우주개발 진척도 (%)
  energyGridRatio: 100.0,  // 에너지 충족률 (%)
  foodSelfRatio: 98.0,     // 식량 자급률 (%)

  // ── 데이터베이스 (Lists) ──
  citizens: [],
  jobs: [],
  houses: [],
  cars: [],
  companies: [],
  shops: [],
  foods: [],
  stocks: [],
  events: [],
  activeEvents: [],
  logs: [],

  // ── 신규 시스템 ──
  approvalRating: 65,   // 지지율 (0-100)
  tickCount: 0,         // 틱 카운터
  diplomacy: {          // 외교 시스템
    countries: [
      { name: '한마국',       relation: 65, trade: 1200, status: '우호' },
      { name: '파이썬공화국', relation: 50, trade: 800,  status: '중립' },
      { name: '알파왕국',     relation: 30, trade: 400,  status: '긴장' },
      { name: '코딩제국',     relation: 75, trade: 1500, status: '우호' },
      { name: '네오연방',     relation: 45, trade: 600,  status: '중립' }
    ]
  },
  petitions: [],        // 국민 청원 목록
  history: { gdp: [], happiness: [], treasury: [] }, // 지표 히스토리

  // ── 시간 관리 ──
  month: 1,
  year: 2026,

  // ── 초기화 실행 ──
  init() {
    console.log("네오이현 시뮬레이션 엔진 초기화 시작...");
    this.citizens = [];
    this.jobs = [];
    this.houses = [];
    this.cars = [];
    this.companies = [];
    this.shops = [];
    this.foods = [];
    this.stocks = [];
    this.activeEvents = [];
    this.logs = [];

    // 신규 시스템 초기화
    this.approvalRating = 65;
    this.tickCount = 0;
    this.diplomacy = {
      countries: [
        { name: '한마국',       relation: 65, trade: 1200, status: '우호' },
        { name: '파이썬공화국', relation: 50, trade: 800,  status: '중립' },
        { name: '알파왕국',     relation: 30, trade: 400,  status: '긴장' },
        { name: '코딩제국',     relation: 75, trade: 1500, status: '우호' },
        { name: '네오연방',     relation: 45, trade: 600,  status: '중립' }
      ]
    };
    this.petitions = [];
    this.history = { gdp: [], happiness: [], treasury: [] };

    this.buildJobs();
    this.buildHouses();
    this.buildCars();
    this.buildFoods();
    this.buildShops();
    this.buildCompanies();
    this.buildStocks();
    this.buildCitizens(1000); // 1,000명의 액티브 주민 생성
    this.buildEventPool();
    console.log("시뮬레이션 초기 데이터 로드 완료!");
  },

  // ── 1. 300개 직업 절차적 생성 ──
  buildJobs() {
    const categories = [
      { name: "IT/AI", stressBase: 45, happyBase: 65, popular: 85, edu: ["전문대", "대학교", "대학원"] },
      { name: "항공우주", stressBase: 60, happyBase: 70, popular: 90, edu: ["대학교", "대학원"] },
      { name: "메디컬", stressBase: 65, happyBase: 75, popular: 92, edu: ["대학원"] },
      { name: "금융/경제", stressBase: 50, happyBase: 60, popular: 80, edu: ["대학교", "대학원"] },
      { name: "교육/연구", stressBase: 35, happyBase: 68, popular: 75, edu: ["대학교", "대학원"] },
      { name: "미디어/예술", stressBase: 40, happyBase: 70, popular: 88, edu: ["고등학교", "전문대", "대학교"] },
      { name: "법조/행정", stressBase: 55, happyBase: 65, popular: 82, edu: ["대학원"] },
      { name: "군사/치안", stressBase: 50, happyBase: 62, popular: 70, edu: ["고등학교", "대학교"] },
      { name: "에너지/자원", stressBase: 40, happyBase: 58, popular: 65, edu: ["고등학교", "전문대", "대학교"] },
      { name: "건설/교통", stressBase: 42, happyBase: 55, popular: 60, edu: ["고등학교", "전문대"] },
      { name: "제조/나노", stressBase: 45, happyBase: 58, popular: 62, edu: ["고등학교", "전문대"] },
      { name: "서비스/유통", stressBase: 30, happyBase: 60, popular: 50, edu: ["고등학교", "전문대"] },
      { name: "뷰티/코스메틱", stressBase: 30, happyBase: 68, popular: 75, edu: ["고등학교", "전문대", "대학교"] },
      { name: "수직농업/푸드", stressBase: 25, happyBase: 65, popular: 58, edu: ["고등학교", "전문대"] },
      { name: "스포츠/엔터", stressBase: 45, happyBase: 70, popular: 90, edu: ["고등학교", "전문대", "대학교"] }
    ];

    const fields = ["연구원", "엔지니어", "전문가", "분석가", "관리자", "크리에이터", "컨설턴트", "감독관"];
    const tiers = [
      { name: "인턴", salaryMul: 1.0, hours: 40, prob: 0.15 },
      { name: "주니어", salaryMul: 1.6, hours: 40, prob: 0.08 },
      { name: "시니어", salaryMul: 2.8, hours: 38, prob: 0.04 },
      { name: "리드", salaryMul: 4.2, hours: 35, prob: 0.02 },
      { name: "치프/이사", salaryMul: 7.5, hours: 32, prob: 0.005 }
    ];

    let id = 1;
    categories.forEach(cat => {
      fields.forEach(field => {
        tiers.forEach(tier => {
          const jobName = `${cat.name} ${field} (${tier.name})`;
          const basePay = 1800000;
          const randomFactor = 0.9 + Math.random() * 0.2;
          const avgSalary = Math.round(basePay * tier.salaryMul * randomFactor);

          this.jobs.push({
            id: id++,
            name: jobName,
            category: cat.name,
            avgSalary: avgSalary,
            hours: tier.hours,
            requiredEdu: cat.edu[Math.floor(Math.random() * cat.edu.length)],
            tier: tier.name,
            unemploymentRisk: tier.prob,
            stress: Math.round(cat.stressBase * (0.8 + (5 - tier.hours) * 0.05)),
            happiness: Math.round(cat.happyBase * (0.9 + Math.random() * 0.2)),
            popularity: cat.popular
          });
        });
      });
    });
  },

  // ── 2. 주택 등급별 속성 설계 ──
  buildHouses() {
    const types = [
      { name: "원룸", price: 150000000, rent: 150000, size: 25, rooms: 1, baths: 1, parking: 0.2, elec: 80, water: 10, net: "100Mbps", satisfaction: 45 },
      { name: "오피스텔", price: 280000000, rent: 450000, size: 45, rooms: 1, baths: 1, parking: 0.8, elec: 120, water: 15, net: "500Mbps", satisfaction: 60 },
      { name: "소형 아파트", price: 450000000, rent: 800000, size: 72, rooms: 2, baths: 1, parking: 1.0, elec: 200, water: 25, net: "1Gbps", satisfaction: 70 },
      { name: "대형 아파트", price: 900000000, rent: 1800000, size: 115, rooms: 3, baths: 2, parking: 1.8, elec: 350, water: 40, net: "1Gbps", satisfaction: 82 },
      { name: "단독주택", price: 1200000000, rent: 2500000, size: 140, rooms: 4, baths: 2, parking: 2.0, elec: 400, water: 50, net: "500Mbps", satisfaction: 80 },
      { name: "전원주택", price: 1500000000, rent: 3200000, size: 180, rooms: 4, baths: 3, parking: 3.0, elec: 450, water: 55, net: "100Mbps", satisfaction: 88 },
      { name: "고급 빌라", price: 800000000, rent: 1600000, size: 95, rooms: 3, baths: 2, parking: 1.2, elec: 280, water: 30, net: "1Gbps", satisfaction: 75 },
      { name: "펜트하우스", price: 3500000000, rent: 8000000, size: 240, rooms: 5, baths: 4, parking: 4.0, elec: 600, water: 70, net: "10Gbps", satisfaction: 95 },
      { name: "저택", price: 5000000000, rent: 12000000, size: 380, rooms: 6, baths: 5, parking: 5.0, elec: 800, water: 90, net: "1Gbps", satisfaction: 96 },
      { name: "초호화 저택", price: 10000000000, rent: 25000000, size: 600, rooms: 8, baths: 7, parking: 8.0, elec: 1200, water: 130, net: "10Gbps", satisfaction: 99 },
      { name: "미래형 스마트 돔", price: 4200000000, rent: 9500000, size: 160, rooms: 4, baths: 3, parking: 2.0, elec: 0, water: 20, net: "홀로그램", satisfaction: 97 },
      { name: "친환경 에코 하우스", price: 2100000000, rent: 4800000, size: 110, rooms: 3, baths: 2, parking: 1.5, elec: 30, water: 8, net: "1Gbps", satisfaction: 90 }
    ];

    let id = 1;
    types.forEach(t => {
      this.houses.push({
        id: id++,
        ...t,
        maintenanceFee: Math.round(t.price * 0.0005)
      });
    });
  },

  // ── 3. 300종 자동차 설계 ──
  buildCars() {
    const brands = ["이현모터스", "네오드라이브", "한화에어로", "삼전오토", "코딩테크", "우리모빌리티", "기가모터스", "하이퍼루프", "에코카", "퓨처웨이브"];
    const segments = [
      { name: "경차", priceMul: 0.5, speed: 140, fuel: 18, maintenance: 80000, insurance: 50000, pop: 45 },
      { name: "소형 세단", priceMul: 0.8, speed: 170, fuel: 15, maintenance: 120000, insurance: 80000, pop: 60 },
      { name: "중형 SUV", priceMul: 1.5, speed: 190, fuel: 11, maintenance: 180000, insurance: 120000, pop: 78 },
      { name: "대형 프리미엄", priceMul: 3.2, speed: 230, fuel: 8, maintenance: 350000, insurance: 250000, pop: 88 },
      { name: "친환경 하이브리드", priceMul: 1.8, speed: 180, fuel: 22, maintenance: 100000, insurance: 100000, pop: 80 },
      { name: "자율주행 전기차", priceMul: 2.5, speed: 200, fuel: 35, maintenance: 80000, insurance: 140000, pop: 92 },
      { name: "핵융합 스포츠카", priceMul: 15.0, speed: 380, fuel: 999, maintenance: 800000, insurance: 1500000, pop: 98 },
      { name: "미래형 호버카", priceMul: 22.0, speed: 450, fuel: 999, maintenance: 1200000, insurance: 2500000, pop: 99 }
    ];

    const modelSuffix = ["S", "EV", "Hybrid", "Prime", "Cruiser", "Interceptor", "Neo", "Custom", "X", "Zero"];

    let id = 1;
    brands.forEach(b => {
      segments.forEach(s => {
        modelSuffix.forEach(suff => {
          const carName = `${b} ${s.name} ${suff}`;
          const basePrice = 30000000;
          const randomFactor = 0.85 + Math.random() * 0.3;
          const price = Math.round(basePrice * s.priceMul * randomFactor);

          this.cars.push({
            id: id++,
            brand: b,
            name: carName,
            price: price,
            maxSpeed: Math.round(s.speed * (0.9 + Math.random() * 0.2)),
            fuelEfficiency: Math.round(s.fuel * (0.9 + Math.random() * 0.2)),
            monthlyCost: Math.round(s.maintenance * randomFactor),
            insurance: Math.round(s.insurance * randomFactor),
            popularity: Math.min(100, Math.round(s.pop * (0.8 + Math.random() * 0.4)))
          });
        });
      });
    });
  },

  // ── 4. 300종 음식 설계 ──
  buildFoods() {
    const categories = [
      { name: "스낵/편의점", price: 3000, cal: 350, full: 20, happy: 8, health: -2 },
      { name: "패스트푸드", price: 9000, cal: 850, full: 50, happy: 22, health: -6 },
      { name: "전통 한식", price: 14000, cal: 550, full: 70, happy: 15, health: 8 },
      { name: "아시안 푸드", price: 16000, cal: 600, full: 65, happy: 18, health: 4 },
      { name: "웨스턴 다이닝", price: 28000, cal: 750, full: 72, happy: 25, health: 1 },
      { name: "헬스/친환경 샐러드", price: 12000, cal: 250, full: 40, happy: 10, health: 15 },
      { name: "디저트/카페", price: 7000, cal: 400, full: 15, happy: 28, health: -4 },
      { name: "고급 레스토랑 코스", price: 180000, cal: 900, full: 90, happy: 45, health: 8 }
    ];

    const foodNames = {
      "스낵/편의점": ["네오 김밥", "에너지 삼각김밥", "컵라면 테크", "디지털 젤리", "프로틴 바"],
      "패스트푸드": ["스마트 패티 버거", "나노 감자튀김", "일렉트릭 치킨윙", "기가 피자 슬라이스"],
      "전통 한식": ["반도체 된장찌개", "초전도 비빔밥", "네오 불고기 정식", "이현 삼계탕"],
      "아시안 푸드": ["하이퍼 딤섬", "양자 쌀국수", "로보틱 탄탄면", "초밥 세트 v1"],
      "웨스턴 다이닝": ["나노 비프 스테이크", "트러플 까르보나라", "어니언 수프 스마트", "라자냐 하이퍼"],
      "헬스/친환경 샐러드": ["유기농 새싹 샐러드", "아보카도 나노 볼", "수직농장 연어 샐러드", "비건 닭가슴살 랩"],
      "디저트/카페": ["아메리카노 ₦", "네오 초코 카스텔라", "말차 홀로그램 프라페", "마카롱 기가"],
      "고급 레스토랑 코스": ["네오이현 프레스티지 디너", "캐비어&골드 플레이트", "한우 최상위 시그니처"]
    };

    let id = 1;
    categories.forEach(cat => {
      const names = foodNames[cat.name] || ["기본 영양바"];
      for (let i = 0; i < 40; i++) {
        const baseName = names[i % names.length];
        const cookingStyle = ["스페셜", "골드", "클래식", "시그니처", "프리미엄", "로컬", "더블", "미니", "메가", "디럭스"][i % 10];
        const finalName = `${cookingStyle} ${baseName}`;
        const randomFactor = 0.8 + Math.random() * 0.4;

        this.foods.push({
          id: id++,
          name: finalName,
          category: cat.name,
          price: Math.round(cat.price * randomFactor),
          calories: Math.round(cat.cal * randomFactor),
          fullness: Math.min(100, Math.round(cat.full * randomFactor)),
          happyGain: Math.min(50, Math.round(cat.happy * randomFactor)),
          healthImpact: Math.round(cat.health * (0.8 + Math.random() * 0.4))
        });
      }
    });
  },

  // ── 5. 500개 상점 배치 ──
  buildShops() {
    const shopTypes = [
      { type: "편의점", items: ["스낵/편의점", "디저트/카페"], popularity: 60 },
      { type: "카페", items: ["디저트/카페"], popularity: 75 },
      { type: "식당", items: ["전통 한식", "아시안 푸드", "웨스턴 다이닝", "패스트푸드"], popularity: 80 },
      { type: "샐러드 바", items: ["헬스/친환경 샐러드"], popularity: 65 },
      { type: "백화점 푸드코트", items: ["고급 레스토랑 코스", "웨스턴 다이닝"], popularity: 90 }
    ];

    const areaNames = ["세종 지구", "금융 센터역", "테크 밸리", "올드 타운", "리버사이드", "에코 시티", "에어로 가", "블루 애비뉴"];

    let id = 1;
    for (let i = 0; i < 500; i++) {
      const typeObj = shopTypes[i % shopTypes.length];
      const area = areaNames[i % areaNames.length];
      const shopName = `${area} ${typeObj.type} [${i + 1}호점]`;

      this.shops.push({
        id: id++,
        name: shopName,
        type: typeObj.type,
        sellCategories: typeObj.items,
        popularity: Math.min(100, Math.round(typeObj.popularity * (0.8 + Math.random() * 0.4))),
        x: Math.floor(5 + Math.random() * 54),
        y: Math.floor(5 + Math.random() * 54)
      });
    }
  },

  // ── 6. 회사 시스템 설계 ──
  buildCompanies() {
    const compTypes = [
      { name: "편의점", count: 12, sizeMin: 2, sizeMax: 6, rev: 35000000, margin: 0.15, sector: "서비스/유통" },
      { name: "카페", count: 15, sizeMin: 2, sizeMax: 8, rev: 28000000, margin: 0.22, sector: "서비스/유통" },
      { name: "마트", count: 8, sizeMin: 10, sizeMax: 30, rev: 180000000, margin: 0.08, sector: "서비스/유통" },
      { name: "백화점", count: 3, sizeMin: 80, sizeMax: 250, rev: 1200000000, margin: 0.12, sector: "서비스/유통" },
      { name: "종합병원", count: 4, sizeMin: 50, sizeMax: 150, rev: 800000000, margin: 0.05, sector: "메디컬" },
      { name: "시중은행", count: 5, sizeMin: 20, sizeMax: 80, rev: 1500000000, margin: 0.25, sector: "금융/경제" },
      { name: "보험사", count: 4, sizeMin: 30, sizeMax: 120, rev: 1100000000, margin: 0.20, sector: "금융/경제" },
      { name: "IT 솔루션", count: 14, sizeMin: 15, sizeMax: 100, rev: 600000000, margin: 0.35, sector: "IT/AI" },
      { name: "게임 스튜디오", count: 10, sizeMin: 8, sizeMax: 70, rev: 450000000, margin: 0.40, sector: "미디어/예술" },
      { name: "자동차 기업", count: 2, sizeMin: 200, sizeMax: 1500, rev: 4500000000, margin: 0.07, sector: "제조/나노" },
      { name: "네오항공", count: 2, sizeMin: 100, sizeMax: 800, rev: 3800000000, margin: 0.05, sector: "항공우주" },
      { name: "프랜차이즈", count: 20, sizeMin: 3, sizeMax: 12, rev: 45000000, margin: 0.18, sector: "수직농업/푸드" }
    ];

    const prefixes = ["네오", "이현", "하이퍼", "코딩", "글로벌", "원", "시너지", "스마트", "미래", "기가"];
    const suffixes = ["라인", "systems", "네트워크", "partners", "다이내믹스", "friends", "메디케어", "캐피탈", "co"];

    let id = 1;
    compTypes.forEach(ct => {
      for (let i = 0; i < ct.count; i++) {
        const pref = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suff = suffixes[Math.floor(Math.random() * suffixes.length)];
        const compName = `${pref}${ct.name} ${suff}`;

        const maxCapacity = Math.floor(ct.sizeMax * 1.5);
        const treasury = Math.round(ct.rev * 3); // 초기 현금 보유고

        this.companies.push({
          id: id++,
          name: compName,
          sector: ct.sector,
          employeeIds: [], // 채워질 아이디들
          maxCapacity: maxCapacity,
          monthlyRevenue: 0,
          monthlyNetProfit: 0,
          baseRev: ct.rev,
          margin: ct.margin,
          avgSalary: 0,
          satisfaction: Math.round(60 + Math.random() * 30),
          treasury: treasury,
          isBankrupt: false
        });
      }
    });
  },

  // ── 7. 주식시장 설계 (11개 종목) ──
  buildStocks() {
    const stockNames = [
      { code: "NEO", name: "1네오주식", price: 85000, type: "지주/공공", beta: 0.8 },
      { code: "LHM", name: "2이주식", price: 142000, type: "자동차/에너지", beta: 1.2 },
      { code: "HYH", name: "3현주식", price: 54000, type: "건설/하이퍼루프", beta: 1.4 },
      { code: "HAN", name: "4하나주식", price: 43000, type: "금융/보험", beta: 0.9 },
      { code: "SEC", name: "5삼전주식", price: 78000, type: "반도체/전자", beta: 1.1 },
      { code: "HWA", name: "6한화주식", price: 112000, type: "우주/방산", beta: 1.5 },
      { code: "PLI", name: "7플리주식", price: 21000, type: "IT 플랫폼", beta: 1.3 },
      { code: "LGU", name: "8U+주식", price: 12500, type: "5G 통신망", beta: 0.7 },
      { code: "COD", name: "9코딩주식", price: 295000, type: "AI 소프트웨어", beta: 1.8 },
      { code: "WOO", name: "10우리주식", price: 15500, type: "상업은행", beta: 0.85 },
      { code: "TEN", name: "11 10주식", price: 3200, type: "스타트업 벤처스", beta: 2.2 }
    ];

    stockNames.forEach((s, idx) => {
      this.stocks.push({
        code: s.code,
        name: s.name,
        price: s.price,
        type: s.type,
        beta: s.beta,
        prevPrice: s.price,
        companyId: idx + 1, // 가상 컴퍼니 맵핑
        history: Array.from({ length: 15 }, () => s.price * (0.95 + Math.random() * 0.1))
      });
    });
  },

  // ── 8. 1,000명 국민 풀 생성 (가계-기업 실고용) ──
  buildCitizens(count) {
    const firstNames = ["이현", "민준", "서연", "도윤", "예준", "지우", "주원", "하은", "지아", "은우", "현우", "지민", "유진", "성현", "수빈", "태희", "채원", "시우"];
    const lastNames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송"];

    for (let i = 0; i < count; i++) {
      const citizen = {
        id: i + 1,
        name: lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)],
        gender: Math.random() > 0.5 ? "남성" : "여성",
        age: Math.floor(1 + Math.random() * 72),
        education: "고등학교",
        job: null,
        companyId: null,
        salary: 0,
        assets: 10000000 + Math.floor(Math.random() * 20000000),
        bankBalance: 300000 + Math.floor(Math.random() * 4000000),
        home: null,
        car: null,
        mortgageDebt: 0,
        mortgagePayment: 0,
        health: Math.round(75 + Math.random() * 25),
        happiness: Math.round(60 + Math.random() * 35),
        stress: Math.round(15 + Math.random() * 40),
        isMarried: false,
        spouseId: null,
        childrenIds: [],
        spendingPropensity: 0.3 + Math.random() * 0.5,
        taxPaid: 0,
        criminalRecord: [],
        prisonTime: 0 // 수감 개월 수 (0이면 정상인)
      };

      // 학력 설정
      if (citizen.age > 24) {
        const rand = Math.random();
        if (rand < 0.15) citizen.education = "고등학교";
        else if (rand < 0.35) citizen.education = "전문대";
        else if (rand < 0.85) citizen.education = "대학교";
        else citizen.education = "대학원";

        // 구인 구직 체결
        const matchJobs = this.jobs.filter(j => j.requiredEdu === citizen.education);
        if (matchJobs.length > 0 && Math.random() < 0.88) {
          const selectedJob = matchJobs[Math.floor(Math.random() * matchJobs.length)];
          // 해당 직군에 맞는 회사 탐색 후 고용
          const comps = this.companies.filter(c => c.sector === selectedJob.category && c.employeeIds.length < c.maxCapacity);
          if (comps.length > 0) {
            const comp = comps[Math.floor(Math.random() * comps.length)];
            citizen.job = selectedJob.name;
            citizen.salary = selectedJob.avgSalary;
            citizen.companyId = comp.id;
            comp.employeeIds.push(citizen.id);
          }
        }
      } else if (citizen.age > 19) {
        citizen.education = "대학교";
      } else if (citizen.age > 16) {
        citizen.education = "고등학교";
      } else if (citizen.age > 13) {
        citizen.education = "중학교";
      } else if (citizen.age > 6) {
        citizen.education = "초등학교";
      } else {
        citizen.education = "미취학";
      }

      // 초기 차량 소유
      if (citizen.age > 22 && citizen.salary > 3000000 && Math.random() < 0.6) {
        citizen.car = this.cars[Math.floor(Math.random() * 20)];
      }

      // 초기 주택 소유
      if (citizen.age > 23) {
        if (citizen.bankBalance > 2000000) {
          citizen.home = this.houses[Math.floor(Math.random() * Math.min(this.houses.length, 3))];
        } else {
          citizen.home = this.houses[0];
        }
      }

      this.citizens.push(citizen);
    }
  },

  // ── 9. 이벤트 풀 설계 ──
  buildEventPool() {
    this.events = [
      {
        id: "EVT_001",
        title: "상온 초전도체 상용화 성공!",
        desc: "네오이현 에너지 연구소에서 상온 초전도체를 송전 선로 및 하이퍼루프에 상용화하는 데 성공했습니다! 에너지 그리드 효율과 산업 성장률이 폭등합니다.",
        trigger: () => this.techLevel > 130 && Math.random() < 0.2,
        options: [
          { text: "국가 기간망에 즉시 적용 (₦5억 예산 소모)", effect: () => { this.treasury -= 500000000; this.techLevel += 20; this.gdp *= 1.08; this.popHappiness += 5; } },
          { text: "기술 특허를 민간에 매각 (국고 확보)", effect: () => { this.treasury += 800000000; this.gdp *= 1.05; } }
        ]
      },
      {
        id: "EVT_002",
        title: "중앙 은행 긴급 금리 인상 권고",
        desc: "인플레이션 압력이 심화됨에 따라 금융위원회가 기준 금리를 1.5% 인상할 것을 강력히 권고합니다. 금리 인상 시 물가는 잡히지만 주식 및 부동산 시장이 위축될 수 있습니다.",
        trigger: () => this.inflation > 4.5,
        options: [
          { text: "금리 1.5% 인상 수용", effect: () => { this.interestRate += 1.5; this.inflation = Math.max(0.5, this.inflation - 2.0); this.gdp *= 0.98; this.stocks.forEach(s => s.price *= 0.90); } },
          { text: "금리 동결 및 시장 자율화 조치", effect: () => { this.inflation += 1.0; this.popHappiness += 2; this.stocks.forEach(s => s.price *= 1.05); } }
        ]
      },
      {
        id: "EVT_003",
        title: "기후 대변동: 하이퍼 태풍 상륙 예고",
        desc: "수도권을 관통하는 초강력 하이퍼 태풍이 북상 중입니다. 피해 방지를 위해 대규모 재난 안전 예산을 긴급 편성해야 합니다.",
        trigger: () => Math.random() < 0.05,
        options: [
          { text: "재난 대비 예산 ₦2억 긴급 투입 (피해 최소화)", effect: () => { this.treasury -= 200000000; this.popHappiness += 4; } },
          { text: "예산 지원 보류 및 현장 대피령 발령", effect: () => { this.treasury -= 50000000; this.popHealth -= 6; this.popHappiness -= 8; this.gdp *= 0.97; } }
        ]
      }
    ];
  },

  // ── 10. 시뮬레이션 매월 틱 루프 (Monthly Simulation Tick) ──
  tick() {
    this.month++;
    if (this.month > 12) {
      this.month = 1;
      this.year++;
      
      // 연단위 주민 나이 1살 증가 및 사망 시뮬레이션
      this.updateDeathsAndInheritance();
      
      // 연령별 학력 승급 처리
      this.citizens.forEach(c => {
        if (c.age === 7) c.education = "초등학교";
        else if (c.age === 14) c.education = "중학교";
        else if (c.age === 17) c.education = "고등학교";
        else if (c.age === 20) c.education = "대학교";
      });

      // 결혼 매칭 & 자녀 출산
      this.updateMarriagesAndBirths();
    }

    // 1. 기업 시스템 업데이트 (매출, 적자 해고, 구인 구직 매칭)
    this.updateCompanies();

    // 2. 모기지론 상환 및 전기세/수도세 고지서 청구
    this.updateMortgagesAndUtilities();

    // 3. 치안, 사건사고 및 교도소 수감 틱
    this.updateCrimesAndPrisons();

    // ── 거시경제 지표 시뮬레이션 공식 ──
    const activeWorkers = this.citizens.filter(c => c.job !== null && c.prisonTime === 0).length;
    const totalPotentialWorkers = this.citizens.filter(c => c.age >= 20 && c.age <= 65).length;
    this.unemploymentRate = Math.round(((totalPotentialWorkers - activeWorkers) / Math.max(1, totalPotentialWorkers)) * 100 * 10) / 10;
    if (this.unemploymentRate < 0.5) this.unemploymentRate = 0.5;

    // GDP 구성 요소 합산
    const privateConsumption = this.citizens.reduce((acc, c) => acc + (c.salary * c.spendingPropensity), 0) * 12;
    const corpInvestment = this.companies.reduce((acc, comp) => acc + (comp.monthlyRevenue * (1 - this.taxRateCorporate / 100)), 0) * 12;
    const govSpending = (this.treasury * (this.budgetAllocation.industry + this.budgetAllocation.research) / 100);
    
    // 무역 수출(X) 및 수입(M)
    const techExportBonus = this.techLevel * 20000000;
    const exports = Math.round((corpInvestment * 0.4) + techExportBonus);
    const imports = Math.round(privateConsumption * 0.25 - (this.budgetAllocation.agriculture * 50000000));
    
    this.gdp = Math.round(privateConsumption + corpInvestment + govSpending + (exports - imports));
    if (this.gdp < 100000000) this.gdp = 100000000;

    // 인플레이션 & 환율 연쇄 반응
    const moneySupplyFac = (this.interestRate < 2.0) ? 1.04 : 0.98;
    this.inflation = Math.round((this.inflation * moneySupplyFac + (this.gdp > 60000000000 ? 0.15 : -0.08)) * 10) / 10;
    if (this.inflation < 0.1) this.inflation = 0.1;

    // 환율: 경상수지 흑자 시 환율 강세 (환율 하락), 기준금리가 높을수록 환율 하락
    const tradeBalance = exports - imports;
    const exchangeFac = (tradeBalance > 0 ? 0.97 : 1.02) - (this.interestRate * 0.01);
    this.exchangeRate = Math.round(this.exchangeRate * exchangeFac * 100) / 100;
    if (this.exchangeRate < 0.5) this.exchangeRate = 0.5;
    if (this.exchangeRate > 2.0) this.exchangeRate = 2.0;

    // 소득세 징수 (국민 잔고 공제)
    let totalTaxCollected = 0;
    this.citizens.forEach(c => {
      if (c.salary > 0 && c.prisonTime === 0) {
        const tax = Math.round(c.salary * (this.taxRateIncome / 100));
        c.bankBalance = Math.max(0, c.bankBalance - tax);
        c.taxPaid += tax;
        totalTaxCollected += tax;
      }
    });

    // 법인세 징수
    this.companies.forEach(comp => {
      if (!comp.isBankrupt && comp.monthlyNetProfit > 0) {
        const tax = Math.round(comp.monthlyNetProfit * (this.taxRateCorporate / 100));
        comp.monthlyNetProfit -= tax;
        comp.treasury -= tax;
        totalTaxCollected += tax;
      }
    });

    this.treasury += totalTaxCollected;

    // 정부 부처 예산 지출 효과 반영
    const totalBudget = this.treasury * 0.08;
    this.treasury -= totalBudget;

    const getBudget = (key) => totalBudget * (this.budgetAllocation[key] / 100);

    // 복지 예산 수급
    const welfareB = getBudget("welfare");
    this.citizens.forEach(c => {
      if (c.bankBalance < 150000 && c.prisonTime === 0) {
        c.bankBalance += Math.round(welfareB / 280);
        c.happiness = Math.min(100, c.happiness + 2);
      }
    });

    const healthB = getBudget("health");
    this.popHealth = Math.min(100, Math.round(75 + (healthB / 60000000) * 15));

    const policeB = getBudget("police");
    this.popCrimeRate = Math.max(0.1, Math.round((5.0 - (policeB / 40000000) * 3.8) * 10) / 10);

    const envB = getBudget("environment");
    this.pollution = Math.max(5.0, Math.round((45.0 - (envB / 25000000) * 32)));

    const rdB = getBudget("research");
    this.techLevel += (rdB / 60000000) * 1.6;

    // 11대 기업 주식 가격 연계 (P/E 비율 및 회사 순익 실시간 계산)
    this.stocks.forEach(s => {
      s.prevPrice = s.price;
      const comp = this.companies.find(c => c.id === s.companyId);
      if (comp && !comp.isBankrupt) {
        // 기업 자산 가치 및 순이익 비례 주가 공식
        const annualProfit = comp.monthlyNetProfit * 12;
        const peRatio = 12 + (this.interestRate < 2.0 ? 3 : -1);
        const impliedVal = (comp.treasury + annualProfit * peRatio) / 100000; // 가상 주식 발행수 100,000 기준
        
        const randomWalk = (Math.random() - 0.495) * 0.06;
        s.price = Math.round(Math.max(500, impliedVal * (1 + randomWalk)));
      } else {
        // 파산 시 주가 휴지조각화
        s.price = Math.round(s.price * 0.5);
        if (s.price < 50) s.price = 10;
      }
      s.history.push(s.price);
      if (s.history.length > 20) s.history.shift();
    });

    // 랜덤 이벤트 트리거 체크
    this.events.forEach(evt => {
      if (evt.trigger()) {
        if (!this.activeEvents.some(ae => ae.id === evt.id)) {
          this.activeEvents.push(evt);
          if (window.onSimulationEvent) {
            window.onSimulationEvent(evt);
          }
        }
      }
    });

    // 국민 스트레스 반영
    this.citizens.forEach(c => {
      if (c.prisonTime === 0) {
        if (c.job) {
          c.stress = Math.min(100, Math.max(0, c.stress + (this.taxRateIncome > 25 ? 1.5 : -0.5)));
        } else if (c.age >= 20 && c.age <= 65) {
          c.stress = Math.min(100, c.stress + 3);
          c.happiness = Math.max(0, c.happiness - 2);
        }
      }
    });

    // ── 지지율 업데이트 ──
    this.tickCount++;
    const happyFac = (this.popHappiness - 50) / 50;
    const econFac = Math.min(1, (this.gdp / 60000000000) - 0.5);
    const crimeFac = -this.popCrimeRate / 5;
    this.approvalRating = Math.max(5, Math.min(95,
      this.approvalRating + happyFac * 0.8 + econFac * 0.5 + crimeFac * 0.3
    ));

    // ── 외교 관계도 틱 업데이트 ──
    this.diplomacy.countries.forEach(c => {
      c.relation += (Math.random() - 0.52) * 1.5;
      c.relation = Math.max(0, Math.min(100, c.relation));
      if      (c.relation >= 70) c.status = '우호';
      else if (c.relation >= 40) c.status = '중립';
      else if (c.relation >= 20) c.status = '긴장';
      else                       c.status = '갈등';
      if (c.relation <= 5 && window.addNews) {
        window.addNews(`⚠️ ${c.name}와 외교 위기 발생! 즉각 대응 필요`);
      }
    });

    // ── 국민 청원 생성 (매 10틱) ──
    const PETITION_POOL = [
      { text:'도로 보수 요청',       cost:50000000,  effects:{ happiness:3 } },
      { text:'공원 확장 요청',       cost:100000000, effects:{ happiness:5, pollution:-2 } },
      { text:'야간 조명 설치',       cost:30000000,  effects:{ crimeRate:-0.3 } },
      { text:'무상급식 확대',        cost:80000000,  effects:{ health:4, happiness:3 } },
      { text:'교통 카드 할인',       cost:40000000,  effects:{ happiness:4 } },
      { text:'소음 규제 강화',       cost:20000000,  effects:{ happiness:2 } },
      { text:'IT 인프라 투자',       cost:200000000, effects:{ tech:15 } },
      { text:'노인 복지관 건립',     cost:120000000, effects:{ happiness:6 } },
      { text:'청년 창업 지원금',     cost:150000000, effects:{ unemploymentRate:-0.5 } },
      { text:'스마트 쓰레기통 설치', cost:60000000,  effects:{ pollution:-3 } }
    ];
    if (this.tickCount % 10 === 0 && this.petitions.length < 5) {
      const pool = PETITION_POOL.filter(p => !this.petitions.some(ex => ex.text === p.text));
      if (pool.length > 0) {
        const petition = { ...pool[Math.floor(Math.random() * pool.length)], id: Date.now() + Math.random() };
        this.petitions.push(petition);
        if (window.addNews)      window.addNews(`📋 새 청원: "${petition.text}" 접수됨`);
        if (window.renderPetitions) window.renderPetitions();
      }
    }

    // ── 통계 히스토리 저장 ──
    this.history.gdp.push(this.gdp);
    this.history.happiness.push(this.popHappiness);
    this.history.treasury.push(this.treasury);
    if (this.history.gdp.length > 20) {
      this.history.gdp.shift();
      this.history.happiness.shift();
      this.history.treasury.shift();
    }

    // ── 뉴스 자동 생성 ──
    if (window.addNews && this.tickCount % 3 === 0) {
      const newsItems = [
        `📈 GDP ₦${(this.gdp/1000000000).toFixed(1)}조 기록`,
        `🎈 현재 물가상승률 ${this.inflation}%`,
        `👔 실업률 ${this.unemploymentRate}% — 취업 시장 동향`,
        `🏦 국고 잔고 ₦${(this.treasury/1000000000).toFixed(1)}조`,
        `😊 국민 행복도 ${Math.round(this.popHappiness)}% 기록`,
        `🌿 환경 오염도 ${Math.round(this.pollution)}% — ${this.pollution < 20 ? '양호' : '주의 필요'}`,
        `📊 지지율 ${Math.round(this.approvalRating)}% — 국민 여론 동향`
      ];
      window.addNews(newsItems[Math.floor(Math.random() * newsItems.length)]);
    }
  },

  // ── 11. 가계-기업 간 실제 고용 및 적자 해고/채용 루프 ──
  updateCompanies() {
    this.companies.forEach(comp => {
      if (comp.isBankrupt) return;

      // 1. 직원 급여 지급 (Payroll) 및 탈세 징수
      let payroll = 0;
      comp.employeeIds.forEach(empId => {
        const citizen = this.citizens.find(c => c.id === empId);
        if (citizen && citizen.prisonTime === 0) {
          payroll += citizen.salary;
          citizen.bankBalance += citizen.salary; // 수입 가입
        }
      });

      // 2. 매출액 산출 (직원 생산성, 기술 지수 및 예산 가중치 적용)
      const baseRev = comp.baseRev;
      const techBonus = this.techLevel / 120;
      const employeeRatio = comp.employeeIds.length / comp.maxCapacity;
      const monthlyRevenue = Math.round(baseRev * (1 + techBonus) * (0.6 + employeeRatio * 0.6) * (0.85 + Math.random() * 0.3));
      
      // 순이익
      const operatingCost = Math.round(monthlyRevenue * 0.3); // 고정 운영비 30%
      const profit = monthlyRevenue - payroll - operatingCost;

      comp.monthlyRevenue = monthlyRevenue;
      comp.monthlyNetProfit = profit;
      comp.treasury += profit;

      // 평균급여 갱신
      comp.avgSalary = comp.employeeIds.length > 0 ? Math.round(payroll / comp.employeeIds.length) : 0;

      // 적자 지속 시 해고 알고리즘
      if (comp.treasury < 0) {
        if (comp.employeeIds.length > 1) {
          // 30% 확률로 1명 해고
          if (Math.random() < 0.3) {
            const fireIdx = Math.floor(Math.random() * comp.employeeIds.length);
            const firedId = comp.employeeIds.splice(fireIdx, 1)[0];
            const firedCitizen = this.citizens.find(c => c.id === firedId);
            if (firedCitizen) {
              firedCitizen.job = null;
              firedCitizen.companyId = null;
              firedCitizen.salary = 0;
              firedCitizen.happiness = Math.max(0, firedCitizen.happiness - 35);
              firedCitizen.stress = Math.min(100, firedCitizen.stress + 25);
            }
          }
        } else {
          // 최종 파산 선언
          comp.isBankrupt = true;
          comp.employeeIds.forEach(empId => {
            const c = this.citizens.find(x => x.id === empId);
            if (c) {
              c.job = null;
              c.companyId = null;
              c.salary = 0;
            }
          });
          comp.employeeIds = [];
        }
      }

      // 흑자 유지 시 구직인력 신규 채용
      if (comp.treasury > comp.baseRev && comp.employeeIds.length < comp.maxCapacity && Math.random() < 0.25) {
        // 실업자 풀 탐색
        const unemployed = this.citizens.filter(c => c.age >= 20 && c.age < 60 && c.job === null && c.prisonTime === 0);
        if (unemployed.length > 0) {
          // 학력 필터 매칭
          const hireCandidate = unemployed[Math.floor(Math.random() * unemployed.length)];
          const matchJobs = this.jobs.filter(j => j.category === comp.sector);
          if (matchJobs.length > 0) {
            const selectedJob = matchJobs[0];
            hireCandidate.job = selectedJob.name;
            hireCandidate.salary = selectedJob.avgSalary;
            hireCandidate.companyId = comp.id;
            comp.employeeIds.push(hireCandidate.id);
            comp.treasury -= selectedJob.avgSalary; // 보너스 사이닝 보전
          }
        }
      }
    });
  },

  // ── 12. 결혼 적령기 에이전트 간 매칭 및 자녀 출산 ──
  updateMarriagesAndBirths() {
    // 1. 결혼 적합성 매칭
    const singles = this.citizens.filter(c => c.age >= 22 && c.age <= 40 && !c.isMarried && c.prisonTime === 0);
    const males = singles.filter(c => c.gender === "남성");
    const females = singles.filter(c => c.gender === "여성");

    males.forEach(male => {
      if (Math.random() < 0.15) { // 연간 결혼 트라이 확률
        const female = females.find(f => !f.isMarried && Math.abs(f.age - male.age) <= 5);
        if (female) {
          // 승낙 계수 (행복도 및 자산 비례)
          const combinedCapital = male.bankBalance + female.bankBalance;
          if (combinedCapital > 10000000) {
            male.isMarried = true;
            female.isMarried = true;
            male.spouseId = female.id;
            female.spouseId = male.id;

            // 재산 병합
            const totalCash = combinedCapital;
            male.bankBalance = Math.round(totalCash / 2);
            female.bankBalance = Math.round(totalCash / 2);

            // 주택 병합 (한 집으로 합치고 나머진 처분)
            if (male.home && female.home) {
              male.bankBalance += Math.round(female.home.price * 0.85); // 기존 주택 매각
              female.home = male.home;
            } else if (female.home) {
              male.home = female.home;
            }
          }
        }
      }
    });

    // 2. 부부 출산 (임신 확률)
    const marriedWives = this.citizens.filter(c => c.gender === "여성" && c.isMarried && c.age >= 22 && c.age <= 40 && c.prisonTime === 0);
    marriedWives.forEach(wife => {
      const husband = this.citizens.find(c => c.id === wife.spouseId);
      if (husband && wife.childrenIds.length < 3 && Math.random() < 0.08) {
        // 출산 성공
        const nameList = ["라희", "도아", "은찬", "우림", "태오", "서하", "시율", "하랑", "정우", "로은"];
        const id = Math.max(...this.citizens.map(c => c.id)) + 1;
        
        const baby = {
          id: id,
          name: wife.name.charAt(0) + nameList[Math.floor(Math.random() * nameList.length)],
          gender: Math.random() > 0.5 ? "남성" : "여성",
          age: 0,
          education: "미취학",
          job: null,
          companyId: null,
          salary: 0,
          assets: 0,
          bankBalance: 50000,
          home: wife.home,
          car: null,
          mortgageDebt: 0,
          mortgagePayment: 0,
          health: 100,
          happiness: 95,
          stress: 0,
          isMarried: false,
          spouseId: null,
          childrenIds: [],
          spendingPropensity: 0.3 + Math.random() * 0.4,
          taxPaid: 0,
          criminalRecord: [],
          prisonTime: 0
        };

        this.citizens.push(baby);
        wife.childrenIds.push(baby.id);
        if (husband) husband.childrenIds.push(baby.id);
      }
    });
  },

  // ── 13. 모기지 분할 원리금 및 가구 유틸세 청구 ──
  updateMortgagesAndUtilities() {
    this.citizens.forEach(c => {
      if (c.prisonTime > 0) return;

      // 1. 신규 대출 및 내집마련 (자산이 어느정도 있고 집이 없거나 원룸 거주 시)
      if (c.age >= 26 && (!c.home || c.home.name === "원룸") && c.bankBalance > 60000000) {
        // 아파트 구매 의사결정
        const apt = this.houses.find(h => h.name === "소형 아파트");
        if (apt) {
          const downPayment = Math.round(apt.price * 0.2); // 20% 다운페이
          const loanAmt = apt.price - downPayment;
          
          c.bankBalance -= downPayment;
          c.home = apt;
          c.mortgageDebt = loanAmt;

          // 원리금 균등상환액 계산 (20년 = 240개월 상환)
          // 월이자율 r = 기준금리 + 은행 가산금리(2%) 적용
          const r = ((this.interestRate + 2.0) / 100) / 12;
          const n = 240;
          const monthlyPayment = Math.round(loanAmt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
          c.mortgagePayment = monthlyPayment;
        }
      }

      // 2. 모기지 원리금 월 상환
      if (c.mortgageDebt > 0) {
        const pay = Math.min(c.bankBalance, c.mortgagePayment);
        c.bankBalance -= pay;
        c.mortgageDebt = Math.max(0, c.mortgageDebt - Math.round(pay * 0.85)); // 원금 차감 반영
        if (c.mortgageDebt === 0) c.mortgagePayment = 0;
      }

      // 3. 전기세/수도세 고지서 납부 (주택 규모 비례)
      if (c.home) {
        const utilCost = Math.round((c.home.elec * 200) + (c.home.water * 1500)); // 에너지 단가 기준 계산
        c.bankBalance = Math.max(0, c.bankBalance - utilCost);
      }
    });
  },

  // ── 14. 파산/우울자 범죄 시도, 치안 징치 및 수감 ──
  updateCrimesAndPrisons() {
    this.citizens.forEach(c => {
      // 1. 수감 해제 대조
      if (c.prisonTime > 0) {
        c.prisonTime--;
        c.health = Math.max(50, c.health - 1);
        c.stress = Math.min(100, c.stress + 2);
        c.happiness = Math.max(10, c.happiness - 3);

        // 정부 감옥 유지 비용 청구
        this.treasury -= 800000; // 월 수감 유지비 80만 네오
        return;
      }

      // 2. 범죄 유발률 계산
      const isBankrupt = c.bankBalance <= 0;
      const isDepressed = c.happiness < 20;

      if (isBankrupt || isDepressed) {
        // 범죄 시도 확률 (월 0.8%)
        if (Math.random() < 0.008) {
          // 경찰 검거 확률 (치안 예산 비례)
          const policeBudgetFac = (this.budgetAllocation.police / 6); // 기준 예산 6% 대비
          const arrestProb = 0.45 * policeBudgetFac;

          if (Math.random() < arrestProb) {
            // 체포 완료 ➔ 법원 재판 연동 ➔ 수감
            c.criminalRecord.push(`기소일: ${this.year}년 ${this.month}월 (절도 및 사기 혐의)`);
            c.prisonTime = 6; // 6개월 수감 형량
            c.job = null;
            c.companyId = null;
            c.salary = 0;
            c.happiness = Math.max(5, c.happiness - 50);

            // 벌금 징수
            const fine = 2000000;
            c.bankBalance = Math.max(0, c.bankBalance - fine);
            this.treasury += fine;
          } else {
            // 범죄 성공 ➔ 가상 국고/민간 털이 (₦3,000,000 불법 획득)
            c.bankBalance += 3000000;
            this.treasury = Math.max(0, this.treasury - 3000000);
          }
        }
      }
    });
  },

  // ── 15. 사망 시 자산 상속 및 상속세 공제 ──
  updateDeathsAndInheritance() {
    const deads = [];
    this.citizens.forEach(c => {
      // 78세 이상 또는 노령 쇠약 사망 트리거
      const ageTrigger = c.age > 78 && Math.random() < (c.age - 78) * 0.12;
      const healthZero = c.health <= 0;

      if (ageTrigger || healthZero) {
        deads.push(c);
      }
    });

    deads.forEach(d => {
      // 1. 유산 정리
      const estate = d.bankBalance;
      
      // 2. 상속 대상 물색 (배우자 우선, 자녀 후순위)
      let heir = null;
      if (d.isMarried && d.spouseId) {
        heir = this.citizens.find(x => x.id === d.spouseId);
      } else if (d.childrenIds.length > 0) {
        heir = this.citizens.find(x => x.id === d.childrenIds[0]);
      }

      if (heir && estate > 0) {
        // 상속세 공제 (세율 20% 공제 후 인계)
        const inheritanceTax = Math.round(estate * 0.2);
        const netEstate = estate - inheritanceTax;
        
        heir.bankBalance += netEstate;
        this.treasury += inheritanceTax; // 세금 환수

        // 주택 승계
        if (d.home && (!heir.home || heir.home.name === "원룸")) {
          heir.home = d.home;
        }
      } else if (estate > 0) {
        // 연고자가 없으면 100% 국고 귀속
        this.treasury += estate;
      }

      // 3. 기업 직원명부에서 사망한 주민 제거
      if (d.companyId) {
        const comp = this.companies.find(co => co.id === d.companyId);
        if (comp) {
          comp.employeeIds = comp.employeeIds.filter(id => id !== d.id);
        }
      }

      // 사망 주민 제거
      this.citizens = this.citizens.filter(c => c.id !== d.id);
    });
  }
};

window.Sim = Sim;
