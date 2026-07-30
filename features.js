// ============================================================
//   네오이현 — 신규 기능 6종 (features.js)
//   1. 🏦 은행 & 대출 시스템
//   2. 🎰 카지노 & 복권 미니게임
//   3. 🗳️ 선거 캠페인 강화
//   4. 🌾 자원 거래소
//   5. 🤝 플레이어 간 거래 마켓
//   6. 🏗️ 땅 구매 & 건물 건설
// ============================================================

// ── 유틸 ──
const FEAT_PANELS = ['bank-modal','casino-modal','campaign-panel','resource-panel','market-panel','build-panel'];
function closeAllFeatPanels() {
  FEAT_PANELS.forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
}
function fmt(n) { return '₦' + Math.round(n).toLocaleString(); }
function pct(n) { return Math.round(n) + '%'; }
function clampF(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─────────────────────────────────────────
//  클라우드 저장 (신규 기능 전용)
// ─────────────────────────────────────────
async function saveFeatures() {
  if (!currentUsername || !isCloudConnected) return;
  const payload = {
    bankSavings: P.bankSavings || 0,
    bankLoan:    P.bankLoan    || 0,
    campaignFund:    P.campaignFund    || 0,
    campaignPledges: P.campaignPledges || {},
    resources:   P.resources   || {},
    ownedPlots:  P.ownedPlots  || []
  };
  try {
    await fetch(`${DB_URL}users/${encodeURIComponent(currentUsername)}/features.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function loadFeatures() {
  if (!currentUsername || !isCloudConnected) return;
  try {
    const res  = await fetch(`${DB_URL}users/${encodeURIComponent(currentUsername)}/features.json`);
    const data = await res.json();
    if (!data) return;
    if (data.bankSavings    !== undefined) P.bankSavings    = data.bankSavings;
    if (data.bankLoan       !== undefined) P.bankLoan       = data.bankLoan;
    if (data.campaignFund   !== undefined) P.campaignFund   = data.campaignFund;
    if (data.campaignPledges)              P.campaignPledges = data.campaignPledges;
    if (data.resources)                    P.resources       = data.resources;
    if (Array.isArray(data.ownedPlots))    P.ownedPlots      = data.ownedPlots;
  } catch (e) {}
}

// ─────────────────────────────────────────
//  1. 🏦 은행 & 대출 시스템
// ─────────────────────────────────────────
const Bank = {
  get savingsRate() { return Math.max(0.5, (Sim.interestRate || 2.5) - 1); },
  get loanRate()    { return (Sim.interestRate || 2.5) + 2; },
  maxLoan: 50000000,

  deposit(amount) {
    amount = Math.round(amount);
    if (!amount || amount <= 0) { showNotice('⚠️ 올바른 금액을 입력하세요.'); return; }
    if (P.money < amount) { showNotice('💸 잔액이 부족합니다!'); return; }
    P.money -= amount;
    P.bankSavings = (P.bankSavings || 0) + amount;
    updateHUD(); renderBank(); saveFeatures();
    showNotice(`🏦 ${fmt(amount)} 예금 완료! (연 ${this.savingsRate.toFixed(1)}% 이자)`);
    if (typeof addXP === 'function') addXP(5, 'bank_deposit');
  },

  withdraw(amount) {
    amount = Math.round(amount);
    if (!amount || amount <= 0) { showNotice('⚠️ 올바른 금액을 입력하세요.'); return; }
    if ((P.bankSavings || 0) < amount) { showNotice('💸 예금 잔액이 부족합니다!'); return; }
    P.bankSavings -= amount;
    P.money += amount;
    updateHUD(); renderBank(); saveFeatures();
    showNotice(`🏦 ${fmt(amount)} 출금 완료!`);
  },

  borrow(amount) {
    amount = Math.round(amount);
    if (!amount || amount <= 0) { showNotice('⚠️ 올바른 금액을 입력하세요.'); return; }
    const current = P.bankLoan || 0;
    if (current + amount > this.maxLoan) {
      showNotice(`⚠️ 최대 대출 한도 초과! (잔여한도: ${fmt(this.maxLoan - current)})`); return;
    }
    P.bankLoan = current + amount;
    P.money += amount;
    updateHUD(); renderBank(); saveFeatures();
    showNotice(`💳 ${fmt(amount)} 대출 실행! (연 ${this.loanRate.toFixed(1)}% 이자)`);
    if (typeof addXP === 'function') addXP(5, 'bank_loan');
  },

  repay(amount) {
    amount = Math.round(amount);
    if (!amount || amount <= 0) { showNotice('⚠️ 올바른 금액을 입력하세요.'); return; }
    if (!(P.bankLoan > 0)) { showNotice('📋 상환할 대출이 없습니다.'); return; }
    if (P.money < amount) { showNotice('💸 잔액이 부족합니다!'); return; }
    const repay = Math.min(amount, P.bankLoan);
    P.bankLoan = (P.bankLoan || 0) - repay;
    P.money -= repay;
    updateHUD(); renderBank(); saveFeatures();
    showNotice(`✅ ${fmt(repay)} 대출 상환 완료!`);
  },

  dailySettle() {
    if ((P.bankSavings || 0) > 0) {
      const interest = Math.round(P.bankSavings * (this.savingsRate / 100 / 365));
      P.bankSavings += interest;
      if (interest > 0 && document.getElementById('bank-modal')?.style.display !== 'none') renderBank();
    }
    if ((P.bankLoan || 0) > 0) {
      const interest = Math.round(P.bankLoan * (this.loanRate / 100 / 365));
      if (P.money >= interest) {
        P.money -= interest;
      } else {
        P.money = 0;
        Sim.approvalRating = clampF(Sim.approvalRating - 2, 0, 100);
        showNotice('⚠️ 대출 이자를 내지 못했습니다! 신용불량 경고!');
      }
      updateHUD();
    }
  }
};

function openBank() {
  closeAllFeatPanels();
  document.getElementById('bank-modal').style.display = 'flex';
  renderBank();
  switchBankTab('savings');
}
function closeBank() { document.getElementById('bank-modal').style.display = 'none'; }
function switchBankTab(tab) {
  ['savings','loan'].forEach(t => {
    document.getElementById('bank-tab-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('bank-tabn-' + t).classList.toggle('active', t === tab);
  });
}
function renderBank() {
  const g = id => document.getElementById(id);
  if (!g('bank-savings-val')) return;
  g('bank-savings-val').textContent = fmt(P.bankSavings || 0);
  g('bank-loan-val').textContent    = fmt(P.bankLoan || 0);
  g('bank-savings-rate').textContent = Bank.savingsRate.toFixed(1) + '%';
  g('bank-loan-rate').textContent    = Bank.loanRate.toFixed(1) + '%';
  g('bank-player-cash').textContent  = fmt(P.money);
  g('bank-max-loan').textContent     = fmt(Bank.maxLoan - (P.bankLoan || 0));
  const dailySavingsInterest = Math.round((P.bankSavings || 0) * (Bank.savingsRate / 100 / 365));
  g('bank-daily-interest').textContent = '+' + fmt(dailySavingsInterest) + '/일';
}
function bankDeposit()  { Bank.deposit (parseInt(document.getElementById('bank-deposit-input').value  || '0')); }
function bankWithdraw() { Bank.withdraw(parseInt(document.getElementById('bank-withdraw-input').value || '0')); }
function bankBorrow()   { Bank.borrow  (parseInt(document.getElementById('bank-borrow-input').value   || '0')); }
function bankRepay()    { Bank.repay   (parseInt(document.getElementById('bank-repay-input').value    || '0')); }
window.openBank = openBank; window.closeBank = closeBank;
window.switchBankTab = switchBankTab;
window.bankDeposit = bankDeposit; window.bankWithdraw = bankWithdraw;
window.bankBorrow = bankBorrow;   window.bankRepay = bankRepay;

// ─────────────────────────────────────────
//  2. 🎰 카지노 & 복권 미니게임
// ─────────────────────────────────────────
const Casino = {
  // ── 로또 ──
  ticketPrice: 5000,
  picked: [],

  pickNum(n) {
    const i = this.picked.indexOf(n);
    if (i >= 0) { this.picked.splice(i, 1); }
    else if (this.picked.length < 6) { this.picked.push(n); }
    renderLottoGrid();
  },

  drawLotto() {
    if (this.picked.length < 6) { showNotice('⚠️ 번호 6개를 모두 선택하세요!'); return; }
    if (P.money < this.ticketPrice) { showNotice('💸 티켓 비용(₦5,000) 부족!'); return; }
    P.money -= this.ticketPrice;
    const win = [];
    while (win.length < 6) { const n = Math.floor(Math.random()*45)+1; if (!win.includes(n)) win.push(n); }
    win.sort((a,b)=>a-b);
    const matched = this.picked.filter(n => win.includes(n)).length;
    const prizes = {6:50000000,5:1000000,4:50000,3:5000};
    const prize = prizes[matched] || 0;
    if (prize > 0) { P.money += prize; if (typeof addXP === 'function') addXP(30,'casino'); }
    updateHUD();
    document.getElementById('lotto-result').innerHTML =
      `<div>당첨번호: <b>[${win.join(', ')}]</b></div>` +
      `<div>내 번호:  <b>[${this.picked.join(', ')}]</b></div>` +
      `<div style="margin-top:8px;font-size:15px;color:${prize>0?'#00e676':'#ff4560'}">${matched}개 일치 → ${prize>0?'🎊 '+fmt(prize)+' 당첨!':'😢 꽝'}</div>`;
    this.picked = [];
    renderLottoGrid();
  },

  // ── 슬롯머신 ──
  syms: ['🍒','🍋','⭐','💎','🎰','7️⃣'],
  bet: 10000,
  spinning: false,

  spin() {
    if (this.spinning) return;
    if (P.money < this.bet) { showNotice('💸 베팅 금액이 부족합니다!'); return; }
    P.money -= this.bet; updateHUD(); this.spinning = true;
    const result = [0,1,2].map(() => this.syms[Math.floor(Math.random()*this.syms.length)]);
    [0,1,2].forEach((ri) => {
      let ticks = 0, max = 8 + ri*5;
      const iv = setInterval(() => {
        document.getElementById('slot-r'+ri).textContent = this.syms[Math.floor(Math.random()*this.syms.length)];
        if (++ticks >= max) {
          clearInterval(iv);
          document.getElementById('slot-r'+ri).textContent = result[ri];
          if (ri === 2) { this.spinning = false; this.evalSlot(result); }
        }
      }, 80);
    });
  },

  evalSlot(r) {
    const muls = {'7️⃣':100,'💎':50,'🎰':30,'⭐':20,'🍒':10,'🍋':8};
    let prize = 0;
    if (r[0]===r[1] && r[1]===r[2]) prize = this.bet * (muls[r[0]] || 5);
    else if (r[0]===r[1] || r[1]===r[2]) prize = this.bet * 2;
    if (prize > 0) { P.money += prize; if (typeof addXP === 'function') addXP(20,'casino'); }
    updateHUD();
    document.getElementById('slot-result').innerHTML = prize > 0
      ? `<span style="color:#00e676">🎊 ${r.join('')} → ${fmt(prize)} 당첨!</span>`
      : `<span style="color:#ff4560">😢 ${r.join('')} → 꽝!</span>`;
  },

  // ── 블랙잭 ──
  deck:[], pCards:[], dCards:[], bjBet:0, bjState:'idle',

  newDeck() {
    this.deck=[];
    ['♠','♥','♦','♣'].forEach(s=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'].forEach(v=>this.deck.push({s,v})));
    for (let i=this.deck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]]; }
  },

  cVal(c) { if(['J','Q','K'].includes(c.v)) return 10; if(c.v==='A') return 11; return +c.v; },
  handVal(cards) {
    let v=cards.reduce((s,c)=>s+this.cVal(c),0), a=cards.filter(c=>c.v==='A').length;
    while(v>21&&a--) v-=10; return v;
  },
  cStr(c) { return `<span class="bj-card">${c.v}${c.s}</span>`; },

  startBJ(bet) {
    bet=parseInt(bet)||10000;
    if(P.money<bet){ showNotice('💸 베팅 금액이 부족합니다!'); return; }
    this.bjBet=bet; P.money-=bet; this.newDeck();
    this.pCards=[this.deck.pop(),this.deck.pop()];
    this.dCards=[this.deck.pop(),this.deck.pop()];
    this.bjState='playing'; this.renderBJ(); updateHUD();
  },

  hitBJ() {
    if(this.bjState!=='playing') return;
    this.pCards.push(this.deck.pop());
    if(this.handVal(this.pCards)>21){ this.bjState='done'; this.renderBJ('💥 버스트! 패배.'); showNotice('💥 버스트! ₦'+this.bjBet.toLocaleString()+' 잃었습니다.'); }
    else this.renderBJ();
  },

  standBJ() {
    if(this.bjState!=='playing') return;
    while(this.handVal(this.dCards)<17) this.dCards.push(this.deck.pop());
    this.bjState='done';
    const pv=this.handVal(this.pCards), dv=this.handVal(this.dCards);
    let msg='';
    if(dv>21||pv>dv){ P.money+=this.bjBet*2; msg=`🎊 승리! +${fmt(this.bjBet)} (${pv} vs 딜러 ${dv})`; if(typeof addXP==='function') addXP(15,'casino'); }
    else if(pv===dv){ P.money+=this.bjBet; msg=`🤝 타이! 베팅금 반환 (${pv} vs ${dv})`; }
    else msg=`😢 패배 (${pv} vs 딜러 ${dv})`;
    this.renderBJ(msg); updateHUD(); showNotice(msg.substring(0,60));
  },

  renderBJ(result='') {
    const ph=document.getElementById('bj-player-hand'), dh=document.getElementById('bj-dealer-hand'), res=document.getElementById('bj-result');
    if(!ph) return;
    const pv=this.handVal(this.pCards);
    const dv=this.bjState==='done' ? this.handVal(this.dCards) : '?';
    ph.innerHTML = this.pCards.map(c=>this.cStr(c)).join('')+` <span class="bj-total">(${pv})</span>`;
    dh.innerHTML = this.bjState==='playing'
      ? this.cStr(this.dCards[0])+'<span class="bj-card bj-hidden">?</span>'+' <span class="bj-total">(?)</span>'
      : this.dCards.map(c=>this.cStr(c)).join('')+` <span class="bj-total">(${dv})</span>`;
    if(res) res.innerHTML = result ? `<span style="color:${result.startsWith('🎊')?'#00e676':result.startsWith('🤝')?'#ffb030':'#ff4560'}">${result}</span>` : '';
    const playing = this.bjState==='playing';
    ['bj-hit','bj-stand'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=!playing; });
    const sb=document.getElementById('bj-start'); if(sb) sb.disabled=playing;
  }
};

function openCasino() {
  closeAllFeatPanels();
  document.getElementById('casino-modal').style.display = 'flex';
  switchCasinoTab('lotto');
  renderLottoGrid();
  Casino.renderBJ();
}
function closeCasino() { document.getElementById('casino-modal').style.display = 'none'; }
function switchCasinoTab(tab) {
  ['lotto','slot','bj'].forEach(t => {
    document.getElementById('casino-tab-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('casino-tabn-' + t).classList.toggle('active', t === tab);
  });
}
function renderLottoGrid() {
  const g = document.getElementById('lotto-grid'); if(!g) return;
  g.innerHTML='';
  for(let n=1;n<=45;n++){
    const b=document.createElement('button');
    b.className='lotto-num'+(Casino.picked.includes(n)?' selected':'');
    b.textContent=n; b.onclick=()=>Casino.pickNum(n);
    g.appendChild(b);
  }
  document.getElementById('lotto-pick-count').textContent=Casino.picked.length+'/6';
}
function spinSlot()  { Casino.spin(); }
function bjStart()   { Casino.startBJ(document.getElementById('bj-bet')?.value); }
function bjHit()     { Casino.hitBJ(); }
function bjStand()   { Casino.standBJ(); }
function buyLotto()  { Casino.drawLotto(); }
window.openCasino=openCasino; window.closeCasino=closeCasino; window.switchCasinoTab=switchCasinoTab;
window.renderLottoGrid=renderLottoGrid; window.spinSlot=spinSlot;
window.bjStart=bjStart; window.bjHit=bjHit; window.bjStand=bjStand; window.buyLotto=buyLotto;

// ─────────────────────────────────────────
//  3. 🗳️ 선거 캠페인 강화
// ─────────────────────────────────────────
const Campaign = {
  districts: [
    { id:'sejong', name:'세종 디스트릭트', icon:'🏛️', pop:350000 },
    { id:'techno', name:'테크노 밸리',      icon:'🔬', pop:280000 },
    { id:'eco',    name:'에코 그린존',      icon:'🌿', pop:200000 },
    { id:'old',    name:'올드타운',          icon:'🏺', pop:320000 },
    { id:'neo',    name:'네오 뉴타운',      icon:'🏢', pop:450000 },
  ],
  opponents: [
    { name:'박진현', party:'혁신당',   color:'#3b82f6', base:42 },
    { name:'최영지', party:'보수연대', color:'#ef4444', base:28 },
  ],
  pledges: {
    economy:   { icon:'💰', label:'경제 활성화',  cost:2000000,  effect:{ approval:8,  gdp:0.03 } },
    welfare:   { icon:'❤️', label:'복지 확대',    cost:3000000,  effect:{ approval:10, happiness:10 } },
    security:  { icon:'👮', label:'치안 강화',    cost:1500000,  effect:{ approval:6,  crime:-5 } },
    education: { icon:'🎓', label:'교육 투자',    cost:2500000,  effect:{ approval:7,  tech:20 } },
    green:     { icon:'🌱', label:'환경 정책',    cost:2000000,  effect:{ approval:8,  pollution:-10 } },
  },

  addFund(amount) {
    if(P.money<amount){ showNotice('💸 개인 자금이 부족합니다!'); return; }
    P.money-=amount; P.campaignFund=(P.campaignFund||0)+amount;
    updateHUD(); renderCampaign(); saveFeatures();
    showNotice(`🗳️ 캠페인 자금 ${fmt(amount)} 충당!`);
  },

  setPledge(distId, key) {
    if(!P.campaignPledges) P.campaignPledges={};
    if(P.campaignPledges[distId]===key) { delete P.campaignPledges[distId]; showNotice('📋 공약 취소.'); }
    else { P.campaignPledges[distId]=key; showNotice(`📢 ${this.districts.find(d=>d.id===distId)?.name}에 "${this.pledges[key].label}" 공약!`); }
    saveFeatures(); renderCampaign();
  },

  rally(distId) {
    const cost=500000;
    if((P.campaignFund||0)<cost){ showNotice('⚠️ 캠페인 자금 ₦500,000 부족!'); return; }
    P.campaignFund-=cost;
    const gain=3+Math.floor(Math.random()*6);
    Sim.approvalRating=clampF(Sim.approvalRating+gain,0,100);
    const d=this.districts.find(x=>x.id===distId);
    showNotice(`🎤 ${d?.name} 유세 완료! 지지율 +${gain}%`);
    if(typeof addXP==='function') addXP(30,'campaign');
    saveFeatures(); renderCampaign();
  },

  fulfill(key) {
    const p=this.pledges[key]; if(!p) return;
    if(Sim.treasury<p.cost){ showNotice('⚠️ 국고가 부족합니다!'); return; }
    Sim.treasury-=p.cost;
    if(p.effect.approval) Sim.approvalRating=clampF(Sim.approvalRating+p.effect.approval,0,100);
    if(p.effect.gdp)        Sim.gdp*=(1+p.effect.gdp);
    if(p.effect.happiness)  Sim.popHappiness=clampF(Sim.popHappiness+p.effect.happiness,0,100);
    if(p.effect.crime)      Sim.popCrimeRate=clampF(Sim.popCrimeRate+p.effect.crime,0,100);
    if(p.effect.tech)       Sim.techLevel+=p.effect.tech;
    if(p.effect.pollution)  Sim.pollution=clampF(Sim.pollution+p.effect.pollution,0,100);
    showNotice(`✅ 공약 이행: "${p.icon} ${p.label}" (국고 ${fmt(p.cost)} 지출)`);
    if(typeof addXP==='function') addXP(50,'pledge');
    renderCampaign();
  }
};

function openCampaign()  { closeAllFeatPanels(); document.getElementById('campaign-panel').style.display='block'; renderCampaign(); }
function closeCampaign() { document.getElementById('campaign-panel').style.display='none'; }
function renderCampaign() {
  const g=id=>document.getElementById(id); if(!g('camp-fund')) return;
  g('camp-fund').textContent=fmt(P.campaignFund||0);
  g('camp-approval').textContent=pct(Sim.approvalRating);
  const fill=g('camp-approval-bar'); if(fill) fill.style.width=clampF(Sim.approvalRating,0,100)+'%';

  const distEl=g('camp-districts');
  if(distEl) distEl.innerHTML=Campaign.districts.map(d=>{
    const cur=P.campaignPledges?.[d.id];
    return `<div class="camp-dist-card">
      <div class="camp-dist-head"><span>${d.icon} <b>${d.name}</b></span><span class="dim-text">${(d.pop/10000).toFixed(0)}만 유권자</span></div>
      <div class="camp-dist-pledges">
        ${Object.entries(Campaign.pledges).map(([k,p])=>`
          <button class="camp-badge${cur===k?' active':''}" onclick="Campaign.setPledge('${d.id}','${k}')">${p.icon} ${p.label}</button>
        `).join('')}
      </div>
      <button class="camp-rally-btn" onclick="Campaign.rally('${d.id}')">🎤 유세 (₦500,000)</button>
    </div>`;
  }).join('');

  const pEl=g('camp-pledges');
  if(pEl) pEl.innerHTML=Object.entries(Campaign.pledges).map(([k,p])=>`
    <div class="camp-pledge-row">
      <div><div style="font-weight:700">${p.icon} ${p.label}</div><div class="dim-text" style="font-size:11px">비용 ${fmt(p.cost)} · 지지율 +${p.effect.approval}</div></div>
      <button class="small-confirm-btn" onclick="Campaign.fulfill('${k}')">공약 이행</button>
    </div>
  `).join('');
}
window.openCampaign=openCampaign; window.closeCampaign=closeCampaign;
window.Campaign=Campaign;

// ─────────────────────────────────────────
//  4. 🌾 자원 거래소
// ─────────────────────────────────────────
const Resources = {
  list: [
    { id:'food',     name:'식량',    icon:'🌾', base:5000,   unit:'톤',  prodCost:100000,  prodQty:50  },
    { id:'energy',   name:'에너지',  icon:'⚡', base:8000,   unit:'MWh', prodCost:150000,  prodQty:30  },
    { id:'mineral',  name:'광물',    icon:'⛏️', base:12000,  unit:'톤',  prodCost:200000,  prodQty:20  },
    { id:'techPart', name:'기술부품', icon:'🔧', base:50000,  unit:'개',  prodCost:500000,  prodQty:5   },
  ],

  price(id) {
    const r=this.list.find(x=>x.id===id); if(!r) return 0;
    const gdpFactor=clampF((Sim.gdp||52e9)/52e9, 0.6, 2.0);
    return Math.round(r.base*(0.85+Math.random()*0.3)*gdpFactor);
  },

  buy(id, qty) {
    qty=parseInt(qty)||1;
    const total=this.price(id)*qty;
    if(P.money<total){ showNotice('💸 잔액 부족!'); return; }
    P.money-=total; if(!P.resources) P.resources={};
    P.resources[id]=(P.resources[id]||0)+qty;
    updateHUD(); renderResources(); saveFeatures();
    const r=this.list.find(x=>x.id===id);
    showNotice(`${r.icon} ${r.name} ${qty}${r.unit} 매입 (${fmt(total)})`);
    if(typeof addXP==='function') addXP(5,'resource');
  },

  sell(id, qty) {
    qty=parseInt(qty)||1;
    if(!P.resources||(P.resources[id]||0)<qty){ showNotice('⚠️ 보유량 부족!'); return; }
    const total=this.price(id)*qty;
    P.resources[id]-=qty; P.money+=total;
    updateHUD(); renderResources(); saveFeatures();
    const r=this.list.find(x=>x.id===id);
    showNotice(`${r.icon} ${r.name} ${qty}${r.unit} 매도 (+${fmt(total)})`);
    if(typeof addXP==='function') addXP(5,'resource');
  },

  produce(id) {
    const r=this.list.find(x=>x.id===id); if(!r) return;
    if(P.money<r.prodCost){ showNotice(`💸 생산 비용 ${fmt(r.prodCost)} 부족!`); return; }
    P.money-=r.prodCost; if(!P.resources) P.resources={};
    P.resources[id]=(P.resources[id]||0)+r.prodQty;
    updateHUD(); renderResources(); saveFeatures();
    showNotice(`🏭 ${r.name} ${r.prodQty}${r.unit} 생산 완료!`);
    if(typeof addXP==='function') addXP(10,'resource');
  },

  tradeWithNation(countryIdx, id, qty, isBuy) {
    const c=Sim.diplomacy?.countries?.[countryIdx]; if(!c) return;
    const basePrice = this.list.find(x=>x.id===id)?.base || 5000;
    const dipFactor = 1 - (c.relation - 50) * 0.005;
    const price = Math.round(basePrice * dipFactor * qty);
    if(isBuy){
      if(P.money<price){ showNotice('💸 잔액 부족!'); return; }
      P.money-=price; if(!P.resources) P.resources={};
      P.resources[id]=(P.resources[id]||0)+qty;
      c.trade+=price; c.relation=clampF(c.relation+1,0,100);
      showNotice(`🌐 ${c.name}에서 ${this.list.find(x=>x.id===id).icon} ${qty}${this.list.find(x=>x.id===id).unit} 수입!`);
    } else {
      if(!P.resources||(P.resources[id]||0)<qty){ showNotice('⚠️ 보유량 부족!'); return; }
      P.resources[id]-=qty; P.money+=price;
      c.trade+=price; c.relation=clampF(c.relation+1,0,100);
      showNotice(`🌐 ${c.name}에 ${this.list.find(x=>x.id===id).icon} ${qty}${this.list.find(x=>x.id===id).unit} 수출! +${fmt(price)}`);
    }
    updateHUD(); renderResources(); saveFeatures();
    if(typeof addXP==='function') addXP(8,'resource_trade');
  }
};

function openResources()  { closeAllFeatPanels(); document.getElementById('resource-panel').style.display='block'; renderResources(); }
function closeResources() { document.getElementById('resource-panel').style.display='none'; }
function renderResources() {
  if(!P.resources) P.resources={};
  const c=document.getElementById('res-list'); if(!c) return;
  c.innerHTML=Resources.list.map(r=>{
    const held=P.resources[r.id]||0, price=Resources.price(r.id);
    return `<div class="res-row">
      <div class="res-info"><span style="font-size:22px">${r.icon}</span>
        <div><div style="font-weight:700">${r.name}</div>
          <div class="dim-text" style="font-size:11px">보유 ${held}${r.unit} · 시가 ${fmt(price)}/${r.unit}</div>
        </div>
      </div>
      <div class="res-actions">
        <input id="rq-${r.id}" type="number" value="10" min="1" class="res-qty-input">
        <button class="res-btn buy" onclick="Resources.buy('${r.id}',document.getElementById('rq-${r.id}').value)">매입</button>
        <button class="res-btn sell" onclick="Resources.sell('${r.id}',document.getElementById('rq-${r.id}').value)">매도</button>
        <button class="res-btn prod" onclick="Resources.produce('${r.id}')">🏭 생산 (${fmt(r.prodCost)})</button>
      </div>
    </div>`;
  }).join('');

  const nations=Sim.diplomacy?.countries||[];
  const nc=document.getElementById('res-nations'); if(!nc) return;
  nc.innerHTML=nations.map((c,i)=>`
    <div class="res-nation-row">
      <div>
        <div style="font-weight:700">${c.name}</div>
        <div class="dim-text" style="font-size:11px">관계도 ${c.relation}% · ${c.status}</div>
      </div>
      <select id="rn-item-${i}" class="res-nation-select">
        ${Resources.list.map(r=>`<option value="${r.id}">${r.icon} ${r.name}</option>`).join('')}
      </select>
      <input id="rn-qty-${i}" type="number" value="10" min="1" class="res-qty-input" style="width:55px">
      <button class="res-btn buy" onclick="Resources.tradeWithNation(${i},document.getElementById('rn-item-${i}').value,parseInt(document.getElementById('rn-qty-${i}').value),true)">수입</button>
      <button class="res-btn sell" onclick="Resources.tradeWithNation(${i},document.getElementById('rn-item-${i}').value,parseInt(document.getElementById('rn-qty-${i}').value),false)">수출</button>
    </div>
  `).join('');
}
window.openResources=openResources; window.closeResources=closeResources;
window.Resources=Resources;

// ─────────────────────────────────────────
//  5. 🤝 플레이어 간 거래 마켓
// ─────────────────────────────────────────
const Market = {
  listings: [],

  async fetch() {
    if(!isCloudConnected){ this.listings=[]; renderMarket(); return; }
    try {
      const res=await window.fetch(`${DB_URL}trade_listings.json`);
      const data=await res.json();
      this.listings=data ? Object.entries(data).map(([id,v])=>({id,...v})).filter(l=>l.seller!==currentUsername).sort((a,b)=>b.ts-a.ts) : [];
    } catch(e){ this.listings=[]; }
    renderMarket();
  },

  async list(idx, price) {
    price=parseInt(price);
    if(!price||price<=0){ showNotice('⚠️ 가격을 입력하세요.'); return; }
    const item=P.inventory?.[idx]; if(!item){ showNotice('⚠️ 아이템을 선택하세요.'); return; }
    if(!isCloudConnected){ showNotice('☁️ 온라인 전용 기능입니다.'); return; }
    const listing={seller:currentUsername,itemName:item.name,itemIcon:item.icon||'📦',itemEffect:item.effect||'',price,ts:Date.now()};
    try {
      await window.fetch(`${DB_URL}trade_listings.json`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(listing)});
      P.inventory.splice(idx,1);
      showNotice(`🏪 ${item.icon||'📦'} ${item.name} → ₦${price.toLocaleString()} 등록!`);
      if(typeof addXP==='function') addXP(10,'trade');
      await this.fetch(); renderMarketInventory();
    } catch(e){ showNotice('⚠️ 등록 실패'); }
  },

  async buy(id) {
    const l=this.listings.find(x=>x.id===id); if(!l){ showNotice('⚠️ 상품 없음'); return; }
    if(P.money<l.price){ showNotice('💸 잔액 부족!'); return; }
    if(!isCloudConnected){ showNotice('☁️ 온라인 전용 기능입니다.'); return; }
    try {
      await window.fetch(`${DB_URL}trade_listings/${id}.json`,{method:'DELETE'});
      P.money-=l.price;
      if(!P.inventory) P.inventory=[];
      P.inventory.push({id:'traded_'+Date.now(),name:l.itemName,icon:l.itemIcon,effect:l.itemEffect,apply:()=>{}});
      updateHUD();
      showNotice(`✅ ${l.itemIcon} ${l.itemName} 구매 완료! (${fmt(l.price)})`);
      if(typeof addXP==='function') addXP(15,'trade');
      await this.fetch();
    } catch(e){ showNotice('⚠️ 구매 실패'); }
  }
};

function openMarket()  { closeAllFeatPanels(); document.getElementById('market-panel').style.display='block'; renderMarketInventory(); Market.fetch(); }
function closeMarket() { document.getElementById('market-panel').style.display='none'; }
function switchMarketTab(tab) {
  ['listings','sell'].forEach(t=>{
    document.getElementById('mkt-tab-'+t).style.display=t===tab?'block':'none';
    document.getElementById('mkt-tabn-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='listings') Market.fetch();
  if(tab==='sell') renderMarketInventory();
}
function renderMarket() {
  const c=document.getElementById('mkt-listings'); if(!c) return;
  if(!isCloudConnected){ c.innerHTML='<div class="log-item empty">☁️ 온라인 연결 시에만 이용 가능합니다.</div>'; return; }
  if(!Market.listings.length){ c.innerHTML='<div class="log-item empty">📭 등록된 상품이 없습니다.</div>'; return; }
  c.innerHTML=Market.listings.map(l=>`
    <div class="mkt-row">
      <span style="font-size:20px">${l.itemIcon}</span>
      <div style="flex:1"><div style="font-weight:700">${l.itemName}</div><div class="dim-text" style="font-size:11px">${l.itemEffect} · 판매자: ${l.seller}</div></div>
      <span style="font-weight:700;color:var(--gold)">${fmt(l.price)}</span>
      <button class="res-btn buy" onclick="Market.buy('${l.id}')">구매</button>
    </div>`).join('');
}
function renderMarketInventory() {
  const c=document.getElementById('mkt-inventory'); if(!c) return;
  const items=P.inventory||[];
  if(!items.length){ c.innerHTML='<div class="log-item empty">인벤토리가 비어있습니다.</div>'; return; }
  c.innerHTML=items.map((item,i)=>`
    <div class="mkt-row">
      <span style="font-size:20px">${item.icon||'📦'}</span>
      <div style="flex:1"><div style="font-weight:700">${item.name}</div><div class="dim-text" style="font-size:11px">${item.effect||''}</div></div>
      <input id="mp-${i}" type="number" placeholder="판매가" min="1" class="res-qty-input" style="width:90px">
      <button class="res-btn sell" onclick="Market.list(${i},document.getElementById('mp-${i}').value)">등록</button>
    </div>`).join('');
}
window.openMarket=openMarket; window.closeMarket=closeMarket;
window.switchMarketTab=switchMarketTab;
window.Market=Market;

// ─────────────────────────────────────────
//  6. 🏗️ 땅 구매 & 건물 건설
// ─────────────────────────────────────────
const Build = {
  plots: [
    { id:'p1', name:'세종 1구역',     district:'세종 디스트릭트',  size:'소형 200㎡',   price:500000000,   tier:'S' },
    { id:'p2', name:'테크노 2구역',   district:'테크노 밸리',      size:'중형 500㎡',   price:1200000000,  tier:'M' },
    { id:'p3', name:'에코파크 3구역', district:'에코 그린존',      size:'소형 180㎡',   price:600000000,   tier:'S' },
    { id:'p4', name:'비즈니스 4구역', district:'비즈니스 지구',    size:'대형 1,200㎡', price:3000000000,  tier:'L' },
    { id:'p5', name:'주거 5구역',     district:'주거 단지',        size:'중형 400㎡',   price:900000000,   tier:'M' },
    { id:'p6', name:'미디어 6구역',   district:'미디어&문화',      size:'소형 250㎡',   price:750000000,   tier:'S' },
  ],
  bldTypes: {
    S: [
      { id:'studio', name:'원룸 스튜디오', icon:'🏠', days:3, cost:200000000, income:300000 },
      { id:'cafe',   name:'소형 카페',    icon:'☕', days:2, cost:100000000, income:150000 },
      { id:'office', name:'소형 사무실',  icon:'💼', days:2, cost:150000000, income:200000 },
    ],
    M: [
      { id:'apt',   name:'아파트',        icon:'🏢', days:7,  cost:500000000,  income:800000  },
      { id:'mall',  name:'쇼핑몰',        icon:'🛍️', days:5,  cost:350000000,  income:600000  },
      { id:'hotel', name:'비즈니스 호텔', icon:'🏨', days:6,  cost:450000000,  income:750000  },
    ],
    L: [
      { id:'tower',   name:'오피스 타워',   icon:'🏙️', days:14, cost:2000000000, income:3000000 },
      { id:'resort',  name:'리조트 & 스파', icon:'🏖️', days:10, cost:1500000000, income:2500000 },
      { id:'factory', name:'스마트 팩토리', icon:'🏭', days:12, cost:1800000000, income:2800000 },
    ],
  },

  buyPlot(plotId) {
    const plot=this.plots.find(p=>p.id===plotId);
    if(!plot) return;
    if((P.ownedPlots||[]).some(op=>op.plotId===plotId)){ showNotice('⚠️ 이미 보유 중인 토지입니다!'); return; }
    if(P.money<plot.price){ showNotice(`💸 잔액 부족! (필요: ${fmt(plot.price)})`); return; }
    P.money-=plot.price;
    if(!P.ownedPlots) P.ownedPlots=[];
    P.ownedPlots.push({ plotId, building:null, buildingId:null, daysLeft:0 });
    updateHUD(); saveFeatures(); renderBuild();
    showNotice(`🏗️ ${plot.name} 토지 매입 완료!`);
    if(typeof addXP==='function') addXP(50,'construction');
  },

  startBuild(plotId, bldId) {
    const op=(P.ownedPlots||[]).find(o=>o.plotId===plotId);
    if(!op){ showNotice('⚠️ 토지를 먼저 매입하세요.'); return; }
    if(op.building){ showNotice('⚠️ 이미 건물이 있습니다!'); return; }
    if(op.daysLeft>0){ showNotice('⚠️ 현재 건설 중입니다.'); return; }
    const plot=this.plots.find(p=>p.id===plotId);
    const bld=this.bldTypes[plot.tier].find(b=>b.id===bldId);
    if(!bld) return;
    if(P.money<bld.cost){ showNotice(`💸 건설 비용 ${fmt(bld.cost)} 부족!`); return; }
    P.money-=bld.cost;
    op.buildingId=bldId; op.daysLeft=bld.days;
    updateHUD(); saveFeatures(); renderBuild();
    showNotice(`🔨 ${bld.icon} ${bld.name} 건설 시작! (${bld.days}일 후 완공)`);
    if(typeof addXP==='function') addXP(80,'construction');
  },

  dailyUpdate() {
    if(!P.ownedPlots?.length) return;
    let income=0;
    P.ownedPlots.forEach(op=>{
      if(op.daysLeft>0){
        op.daysLeft--;
        if(op.daysLeft===0){
          const plot=Build.plots.find(p=>p.id===op.plotId);
          const bld=Build.bldTypes[plot?.tier||'S'].find(b=>b.id===op.buildingId);
          if(bld){ op.building=bld; showNotice(`🎊 ${bld.icon} ${bld.name} 완공! 매일 ${fmt(bld.income)} 수입!`); if(typeof addXP==='function') addXP(100,'construction'); }
        }
      } else if(op.building){
        income+=op.building.income;
      }
    });
    if(income>0){ P.money+=income; updateHUD(); }
    saveFeatures();
  }
};

function openBuild()  { closeAllFeatPanels(); document.getElementById('build-panel').style.display='block'; renderBuild(); }
function closeBuild() { document.getElementById('build-panel').style.display='none'; }
function renderBuild() {
  const owned=P.ownedPlots||[];
  const dailyIncome=owned.reduce((s,op)=>s+(op.building?.income||0),0);
  const el=id=>document.getElementById(id);
  if(el('build-owned-count')) el('build-owned-count').textContent=owned.length+'필지';
  if(el('build-daily-income')) el('build-daily-income').textContent=fmt(dailyIncome)+'/일';

  const c=el('build-plots'); if(!c) return;
  c.innerHTML=Build.plots.map(plot=>{
    const op=owned.find(o=>o.plotId===plot.id);
    const bTypes=Build.bldTypes[plot.tier];
    let body='';
    if(!op){
      body=`<button class="res-btn buy" onclick="Build.buyPlot('${plot.id}')">🏗️ 매입 ${fmt(plot.price)}</button>`;
    } else if(op.daysLeft>0){
      const bld=bTypes.find(b=>b.id===op.buildingId);
      body=`<div style="color:var(--gold);font-size:12px">🔨 ${bld?.name||''} 건설 중... (${op.daysLeft}일 남음)</div>`;
    } else if(op.building){
      body=`<div style="color:var(--green);font-size:12px">${op.building.icon} ${op.building.name} 운영 중<br>+${fmt(op.building.income)}/일</div>`;
    } else {
      body=`<div class="dim-text" style="font-size:11px;margin-bottom:6px">건물 유형 선택:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${bTypes.map(b=>`<button class="bld-type-btn" onclick="Build.startBuild('${plot.id}','${b.id}')">
          ${b.icon} ${b.name}<br><span style="font-size:10px;color:var(--gold)">${fmt(b.cost)} · ${b.days}일</span>
        </button>`).join('')}
      </div>`;
    }
    return `<div class="build-plot-card${op?' owned':''}">
      <div class="build-plot-head">
        <div><div style="font-weight:700">🏞️ ${plot.name}</div><div class="dim-text" style="font-size:11px">${plot.district} · ${plot.size}</div></div>
        ${!op?`<span class="dim-text" style="font-size:11px">${fmt(plot.price)}</span>`:'<span style="color:var(--green);font-size:11px">보유 중</span>'}
      </div>
      <div style="margin-top:8px">${body}</div>
    </div>`;
  }).join('');
}
window.openBuild=openBuild; window.closeBuild=closeBuild;
window.Build=Build;

// ─────────────────────────────────────────
//  일별 처리 훅 (dayN 변경 감지)
// ─────────────────────────────────────────
let _prevDayN = -1;
setInterval(() => {
  if (typeof dayN === 'undefined') return;
  if (_prevDayN === -1) { _prevDayN = dayN; return; }
  if (dayN !== _prevDayN) {
    _prevDayN = dayN;
    Bank.dailySettle();
    Build.dailyUpdate();
  }
}, 4000);

// ─────────────────────────────────────────
//  initAllFeatures 훅 — 로그인 후 P 확장 & 데이터 로드
// ─────────────────────────────────────────
const _origInitAll = window.initAllFeatures;
window.initAllFeatures = async function() {
  if (typeof _origInitAll === 'function') _origInitAll.apply(this, arguments);
  if (P.bankSavings    === undefined) P.bankSavings    = 0;
  if (P.bankLoan       === undefined) P.bankLoan       = 0;
  if (P.campaignFund   === undefined) P.campaignFund   = 0;
  if (P.campaignPledges=== undefined) P.campaignPledges= {};
  if (P.resources      === undefined) P.resources      = { food:0, energy:0, mineral:0, techPart:0 };
  if (P.ownedPlots     === undefined) P.ownedPlots     = [];
  await loadFeatures();
  // 자동 저장 (30초)
  setInterval(saveFeatures, 30000);
};

// ─────────────────────────────────────────
//  신규 기능 바 표시 (로그인 후)
// ─────────────────────────────────────────
const _origShowGame = window.showGameUI || function(){};
window.showFeaturesBar = function() {
  const bar = document.getElementById('features-bar');
  if (bar) bar.style.display = 'flex';
};
// 로그인 화면 사라질 때 감지
const _lockObs = new MutationObserver(() => {
  const lock = document.getElementById('lock-screen');
  if (lock && lock.style.display === 'none') {
    window.showFeaturesBar();
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const lock = document.getElementById('lock-screen');
  if (lock) _lockObs.observe(lock, { attributes: true, attributeFilter: ['style'] });
});
