#!/usr/bin/env node
// Daily health check — runs via GitHub Actions cron.
// 2026-05-14: signup silently broke 5/12~5/14 (auth!=null rule + no token).
// This catches it on the next morning instead of after 3 days of lost members.
//
// Checks:
//   1) RTDB anonymous-token write to /rewards/_healthcheck/ping
//   2) Recent signup activity (last 24h pinHash count)
//
// On red status: posts an alert into the 'managers' chat room so the
// app-lab folks see it the same morning.

const FB_API_KEY = process.env.FB_API_KEY || 'AIzaSyBwL0Wa1Q8aFhZp5hsn9gTw5aZwXUdAVy4';
const FB_DB     = 'https://kimchi-mart-order-default-rtdb.firebaseio.com';
const ALERT_ROOM = 'kimchi_mart_app_lab';   // 김치마트 앱 랩 (관리자용)

async function token() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_API_KEY}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({returnSecureToken:true})
  });
  if (!r.ok) throw new Error('Token HTTP ' + r.status);
  return (await r.json()).idToken;
}

async function postChat(tok, text) {
  const ts = Date.now();
  const msgId = 'm' + ts + Math.floor(Math.random()*900);
  const msg = {
    sender: 'AUTO 헬스 모니터',
    senderBranch: 'SYSTEM',
    senderRole: 'AUTO',
    isManager: true,
    color: '#dc2626',
    text, ts,
    photos: [], files: []
  };
  await fetch(`${FB_DB}/chat/messages/${ALERT_ROOM}/${msgId}.json?auth=${encodeURIComponent(tok)}`, {
    method:'PUT', headers:{'Content-Type':'application/json; charset=utf-8'},
    body: Buffer.from(JSON.stringify(msg), 'utf8')
  });
  await fetch(`${FB_DB}/chat/rooms/${ALERT_ROOM}.json?auth=${encodeURIComponent(tok)}`, {
    method:'PATCH', headers:{'Content-Type':'application/json; charset=utf-8'},
    body: Buffer.from(JSON.stringify({ lastMsg: text.split('\n')[0], lastTs: ts, lastSender: 'AUTO 헬스 모니터' }), 'utf8')
  });
}

async function main() {
  let tok;
  try { tok = await token(); }
  catch(e) { console.error('❌ Token fetch failed:', e.message); process.exit(1); }
  console.log('✓ Token OK');

  // (1) WRITE TEST
  let writeOk = false, writeErr = '';
  try {
    const w = await fetch(`${FB_DB}/rewards/_healthcheck/ping.json?auth=${encodeURIComponent(tok)}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ts: Date.now(), agent: 'github-actions-cron' })
    });
    writeOk = w.ok;
    if (!w.ok) writeErr = `HTTP ${w.status} ${(await w.text()).slice(0,120)}`;
  } catch(e) { writeErr = e.message; }
  console.log(`✓ Write test: ${writeOk ? 'OK' : 'FAIL — ' + writeErr}`);

  // (2) RECENT SIGNUPS (last 24h)
  const cr = await fetch(`${FB_DB}/rewards/customers.json?auth=${encodeURIComponent(tok)}`);
  const data = (await cr.json()) || {};
  const cutoff24 = Date.now() - 24*3600*1000;
  let recent24 = 0, lastSignupTs = 0, totalPinHash = 0;
  for (const v of Object.values(data)) {
    if (!v || !v.pinHash) continue;
    totalPinHash++;
    if (v.joinedAt && v.joinedAt > lastSignupTs) lastSignupTs = v.joinedAt;
    if (v.joinedAt && v.joinedAt >= cutoff24) recent24++;
  }
  const lastDate = lastSignupTs ? new Date(lastSignupTs).toLocaleString('en-US', { timeZone:'America/New_York' }) : '없음';

  console.log(`✓ Total pinHash members: ${totalPinHash}`);
  console.log(`✓ Recent 24h signups: ${recent24}`);
  console.log(`✓ Last signup: ${lastDate}`);

  // (3) DECIDE STATUS + ALERT
  let status, msg;
  if (!writeOk) {
    status = 'red';
    msg = `🚨 김치마트 멤버십 가입 시스템 *작동 불가* (${new Date().toLocaleString('en-US', { timeZone:'America/New_York' })} ET)\n\n` +
          `RTDB 쓰기 실패: ${writeErr}\n\n` +
          `→ 지금 가입을 시도하는 손님은 모두 실패합니다. 즉시 점검 필요.\n` +
          `→ Firebase Console rules / app.js auth-fetch 점검`;
  } else if (recent24 === 0) {
    const hoursAgo = lastSignupTs ? Math.floor((Date.now() - lastSignupTs) / 3600000) : 999;
    status = 'yellow';
    msg = `⚠️ 김치마트 멤버십 — 최근 24시간 신규 가입 *0건* (${new Date().toLocaleString('en-US', { timeZone:'America/New_York' })} ET)\n\n` +
          `RTDB 쓰기는 정상. 가입 화면은 작동.\n` +
          `마지막 가입: ${lastDate} (${hoursAgo}시간 전)\n` +
          `총 앱 가입 회원: ${totalPinHash}명\n\n` +
          `→ 단순히 가입이 없었던 것일 수도, 클라이언트 캐시 문제일 수도. 매장 직원에게 확인 부탁.`;
  } else {
    status = 'green';
    msg = `🟢 김치마트 멤버십 정상 작동 (${new Date().toLocaleString('en-US', { timeZone:'America/New_York' })} ET)\n` +
          `최근 24시간 신규 가입: ${recent24}건 · 총 ${totalPinHash}명 · 마지막 가입: ${lastDate}`;
  }

  console.log(`\n[STATUS] ${status.toUpperCase()}`);
  console.log(msg);

  // 🚨 빨간/노란불일 때만 chat 알림 — 매일 초록불 메시지로 채팅 도배 안 되도록.
  // (전무님이 매일 아침 보고 싶으면 ALWAYS_POST 환경변수 true 로 강제 발송 가능)
  if (status !== 'green' || process.env.ALWAYS_POST === 'true') {
    try {
      await postChat(tok, msg);
      console.log('✓ Chat alert posted');
    } catch(e) {
      console.error('✗ Chat post failed:', e.message);
    }
  } else {
    console.log('— Green status, skipping chat post (cleaner managers room).');
  }

  if (status === 'red') process.exit(2);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
