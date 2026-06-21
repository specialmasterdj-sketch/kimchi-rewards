// KIMCHI MART REWARDS — health check widget
// 2026-05-14: silent signup failures (5/12~14 lost 14+ members) prompted this.
// Drop this <script> into any admin page; it injects a status banner at the
// top of <body> and runs a write + recent-activity check every 5 minutes.
//
// Usage: <script src="./rewards-health.js?v=1"></script>
//
// Checks:
//   1) RTDB write capability — PUT a test row to /rewards/_healthcheck/ping
//      (rules require auth!=null, so this catches the 401-class bug that
//      took down signups for 3 days).
//   2) Recent signup activity — fetch /rewards/customers and verify at
//      least one new pinHash row in the last 48h. Stale = warning, not
//      red (could just be a slow day).

(function(){
  const FB_API_KEY = 'AIzaSyBwL0Wa1Q8aFhZp5hsn9gTw5aZwXUdAVy4';
  const FB_DB = 'https://kimchi-mart-order-default-rtdb.firebaseio.com';
  const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // 5 분마다 재확인
  const STALE_HOURS = 48;                     // 48 시간 가입 0 건이면 노란불

  let __tokenCache = null;
  async function getToken(){
    // 🔧 2026-06-21 익명 가입(accounts:signUp) → 전용 잠금계정 로그인으로 교체. kimchi-mart-order
    //   익명 인증을 끄면서 익명 토큰이 400으로 막혀 상태배너가 빨갛게 뜸. 익명은 계속 끈 채,
    //   rewards 데이터(auth!=null)만 접근하는 전용 계정으로 발급(admin-new-members/pos-import 와 동일).
    if (__tokenCache && __tokenCache.expires > Date.now() + 60000) return __tokenCache.token;
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:"rewards-reader@kimchimart.com", password:"s4ueo8eJNJ900k2M7uaI4Jt2", returnSecureToken:true})
    });
    if (!r.ok) throw new Error('Token fetch HTTP ' + r.status);
    const d = await r.json();
    __tokenCache = { token: d.idToken, expires: Date.now() + (parseInt(d.expiresIn,10)||3600)*1000 };
    return d.idToken;
  }

  function injectBanner(){
    if (document.getElementById('rewardsHealthBanner')) return;
    const b = document.createElement('div');
    b.id = 'rewardsHealthBanner';
    b.style.cssText = 'position:sticky;top:0;left:0;right:0;z-index:9999;padding:10px 14px;font-family:"Segoe UI","Malgun Gothic",Arial,sans-serif;font-size:.9em;font-weight:700;color:#fff;background:#6b7280;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:2px solid rgba(0,0,0,.1);transition:background .3s';
    b.innerHTML = '<span id="hbIcon">⏳</span><span id="hbText" style="flex:1">시스템 상태 확인 중…</span><span id="hbTime" style="opacity:.85;font-weight:500;font-size:.84em">—</span>';
    b.title = '클릭하여 재확인';
    b.addEventListener('click', () => runCheck(true));
    document.body.insertBefore(b, document.body.firstChild);
  }

  function paint(state, msg, detail){
    const b = document.getElementById('rewardsHealthBanner');
    if (!b) return;
    const palette = {
      ok:    { bg:'#16a34a', icon:'🟢' },
      stale: { bg:'#f59e0b', icon:'🟡' },
      down:  { bg:'#dc2626', icon:'🔴' },
      busy:  { bg:'#6b7280', icon:'⏳' },
    }[state] || { bg:'#6b7280', icon:'⏳' };
    b.style.background = palette.bg;
    document.getElementById('hbIcon').textContent = palette.icon;
    document.getElementById('hbText').textContent = msg + (detail ? ' — ' + detail : '');
    const now = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit', hour12:false });
    document.getElementById('hbTime').textContent = '확인: ' + now;
  }

  async function runCheck(manual){
    if (manual) paint('busy', '재확인 중…');
    try {
      // (1) WRITE TEST — 가입 흐름이 RTDB 에 쓸 수 있나?
      const tok = await getToken();
      const pingTs = Date.now();
      const writeR = await fetch(
        `${FB_DB}/rewards/_healthcheck/ping.json?auth=${encodeURIComponent(tok)}`,
        { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ts: pingTs, agent: 'admin-health-widget' }) }
      );
      if (!writeR.ok) {
        const errBody = await writeR.text().catch(()=>'');
        paint('down', '🚨 RTDB 쓰기 실패 — 가입이 지금 작동 안 합니다!',
              `HTTP ${writeR.status} (${errBody.slice(0,80)})`);
        try { console.error('[rewards-health] write failed', writeR.status, errBody); } catch(_){}
        return;
      }

      // (2) RECENT SIGNUP — 최근 48h 신규 가입 있나? (Vela 동기화는 무관, 진짜 앱 가입자만)
      const custR = await fetch(`${FB_DB}/rewards/customers.json?auth=${encodeURIComponent(tok)}`);
      if (!custR.ok) {
        paint('down', 'RTDB 읽기 실패', `HTTP ${custR.status}`);
        return;
      }
      const data = await custR.json() || {};
      const cutoff = Date.now() - STALE_HOURS * 3600 * 1000;
      let recentSignups = 0;
      let lastSignupTs = 0;
      for (const v of Object.values(data)) {
        if (!v || !v.pinHash) continue;
        if (v.joinedAt && v.joinedAt > lastSignupTs) lastSignupTs = v.joinedAt;
        if (v.joinedAt && v.joinedAt >= cutoff) recentSignups++;
      }
      const lastDateStr = lastSignupTs
        ? new Date(lastSignupTs).toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
        : '없음';

      if (recentSignups === 0) {
        paint('stale',
              `⚠️ 최근 ${STALE_HOURS}시간 신규 가입 0건 (마지막: ${lastDateStr})`,
              '쓰기는 정상. 직원이 가입 안내했는데도 0이면 클라이언트 캐시 의심');
      } else {
        paint('ok',
              `정상 — 가입 시스템 작동 중 (최근 ${STALE_HOURS}h ${recentSignups}건 가입)`,
              `마지막 가입: ${lastDateStr}`);
      }
    } catch(e){
      paint('down', '체크 실패 — 네트워크/Firebase 오류', String(e.message || e).slice(0,80));
      try { console.error('[rewards-health]', e); } catch(_){}
    }
  }

  function start(){
    injectBanner();
    runCheck(false);
    setInterval(() => runCheck(false), CHECK_INTERVAL_MS);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
