// KIMCHI MART REWARDS — shared client logic
// - i18n (5 languages: en, es, ru, zh, ko — English first)
// - Firebase Realtime Database REST (kimchi-mart-order project)
// - Phone+PIN auth (PIN hashed SHA-256 + salt, never stored plain)
// - Tier calculation (rolling 30-day spend)
// - Page guards / shared header / tab bar / lang bar

(function(){
  // ============== Firebase ==============
  window.FB_DB = 'https://kimchi-mart-order-default-rtdb.firebaseio.com';

  // Branches (mirrors the rest of the suite)
  window.BRANCHES = [
    { id: 'MIAMI',     name: 'Miami',     code: 'FL342' },
    { id: 'AVENTURA',  name: 'Aventura',  code: 'FL343' },
    { id: 'DORAL',     name: 'Doral',     code: 'FL344' },
    { id: 'HOLLYWOOD', name: 'Hollywood', code: 'FL345' },
    { id: 'PEMBROKE',  name: 'Pembroke',  code: 'FL346' },
    { id: 'KENDALL',   name: 'Kendall',   code: 'FL347' }
  ];

  // ============== i18n ==============
  const I18N = {
    appName:        { en:'KIMCHI MART REWARDS', es:'KIMCHI MART REWARDS', ru:'KIMCHI MART REWARDS', zh:'KIMCHI MART 会员', ko:'KIMCHI MART 멤버십' },
    tagline:        { en:'Your points. Your perks.', es:'Tus puntos. Tus premios.', ru:'Ваши баллы. Ваши бонусы.', zh:'您的积分 您的福利', ko:'내 포인트, 내 혜택' },

    // Login
    welcome:        { en:'Welcome back', es:'Bienvenido', ru:'Добро пожаловать', zh:'欢迎回来', ko:'환영합니다' },
    welcomeNew:     { en:'Join in 30 seconds', es:'Únete en 30 segundos', ru:'Регистрация за 30 секунд', zh:'30秒注册', ko:'30초 가입' },
    signIn:         { en:'Sign in', es:'Iniciar sesión', ru:'Войти', zh:'登录', ko:'로그인' },
    signUp:         { en:'Sign up', es:'Registrarse', ru:'Регистрация', zh:'注册', ko:'가입' },
    phone:          { en:'Phone number', es:'Número de teléfono', ru:'Телефон', zh:'手机号', ko:'전화번호' },
    phoneHint:      { en:'10-digit US number', es:'Número de 10 dígitos', ru:'10-значный номер США', zh:'10位美国号码', ko:'10자리 미국번호' },
    pin:            { en:'4-digit PIN', es:'PIN de 4 dígitos', ru:'PIN из 4 цифр', zh:'4位密码', ko:'4자리 PIN' },
    pinSet:         { en:'Set 4-digit PIN', es:'Crea un PIN de 4 dígitos', ru:'Задайте 4-значный PIN', zh:'设置4位密码', ko:'PIN 설정' },
    pinConfirm:     { en:'Confirm PIN', es:'Confirma PIN', ru:'Подтвердите PIN', zh:'确认密码', ko:'PIN 확인' },
    name:           { en:'Your name', es:'Tu nombre', ru:'Ваше имя', zh:'姓名', ko:'이름' },
    birthMonth:     { en:'Birth month', es:'Mes de nacimiento', ru:'Месяц рождения', zh:'出生月份', ko:'생일 (월)' },
    birthMonthHint: { en:'Get a bonus on your birthday month', es:'Bono en tu mes de cumpleaños', ru:'Бонус в месяц вашего дня рождения', zh:'生日月份获赠红利', ko:'생일달 보너스 받기' },
    branch:         { en:'Home store', es:'Tienda principal', ru:'Магазин', zh:'常用门店', ko:'주 이용 매장' },
    referralOpt:    { en:'Referral code (optional)', es:'Código de referido (opcional)', ru:'Реферальный код (необяз.)', zh:'推荐码（选填）', ko:'추천 코드 (선택)' },
    continue:       { en:'Continue', es:'Continuar', ru:'Продолжить', zh:'继续', ko:'계속' },
    create:         { en:'Create account', es:'Crear cuenta', ru:'Создать аккаунт', zh:'创建账户', ko:'가입하기' },
    or:             { en:'or', es:'o', ru:'или', zh:'或', ko:'또는' },
    months: {
      en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
      ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      zh: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
      ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
    },

    // Errors / messages
    errInvalidPhone: { en:'Enter a valid 10-digit US number.', es:'Ingresa un número válido de 10 dígitos.', ru:'Введите действительный 10-значный номер.', zh:'请输入有效的10位号码', ko:'유효한 10자리 번호를 입력하세요.' },
    errPin:          { en:'PIN must be 4 digits.', es:'El PIN debe tener 4 dígitos.', ru:'PIN должен быть 4 цифры.', zh:'密码必须为4位数字', ko:'PIN은 4자리 숫자입니다.' },
    errPinMismatch:  { en:'PINs do not match.', es:'Los PIN no coinciden.', ru:'PIN-коды не совпадают.', zh:'两次密码不一致', ko:'PIN이 일치하지 않습니다.' },
    errWrongPin:     { en:'Wrong PIN. Try again.', es:'PIN incorrecto. Intenta de nuevo.', ru:'Неверный PIN. Попробуйте ещё раз.', zh:'密码错误，请重试', ko:'PIN이 올바르지 않습니다.' },
    errExists:       { en:'An account with this phone already exists. Try sign in.', es:'Ya existe una cuenta con este teléfono. Inicia sesión.', ru:'Аккаунт с этим номером уже существует.', zh:'该号码已注册，请登录', ko:'이미 가입된 번호입니다. 로그인해주세요.' },
    errNotFound:     { en:'No account found. Try sign up.', es:'No se encontró cuenta. Regístrate.', ru:'Аккаунт не найден. Зарегистрируйтесь.', zh:'未找到账户，请注册', ko:'가입된 계정이 없습니다.' },
    errReferral:     { en:'Referral code not found.', es:'Código no válido.', ru:'Реферальный код не найден.', zh:'推荐码无效', ko:'추천 코드를 찾을 수 없습니다.' },

    // Home
    yourBarcode:    { en:'YOUR REWARDS CODE', es:'TU CÓDIGO DE PUNTOS', ru:'ВАШ КОД БАЛЛОВ', zh:'您的积分码', ko:'내 회원 바코드' },
    scanAtCheckout: { en:'Show this at checkout to earn & redeem', es:'Muestra esto al pagar para ganar y canjear', ru:'Покажите на кассе, чтобы накопить и потратить', zh:'结账时出示以累积或兑换', ko:'계산 시 직원에게 보여주세요' },
    pointsBalance:  { en:'Points balance', es:'Saldo de puntos', ru:'Баланс баллов', zh:'积分余额', ko:'포인트 잔액' },
    pointsUnit:     { en:'pts', es:'pts', ru:'б.', zh:'分', ko:'P' },

    tierBronze:     { en:'Bronze', es:'Bronce', ru:'Бронза', zh:'青铜', ko:'Bronze' },
    tierSilver:     { en:'Silver', es:'Plata', ru:'Серебро', zh:'白银', ko:'Silver' },
    tierGold:       { en:'Gold', es:'Oro', ru:'Золото', zh:'黄金', ko:'Gold' },
    tierDiamond:    { en:'Diamond', es:'Diamante', ru:'Бриллиант', zh:'钻石', ko:'Diamond' },
    tierMember:     { en:'member', es:'miembro', ru:'участник', zh:'会员', ko:'회원' },
    tierMaxed:      { en:'Top tier — thank you!', es:'¡Nivel máximo — gracias!', ru:'Высший уровень — спасибо!', zh:'最高等级 感谢您', ko:'최고 등급 — 감사합니다!' },
    tierProgress:   { en:'Spend ${amt} more to reach {next}', es:'Gasta ${amt} más para {next}', ru:'Потратьте ещё ${amt} до {next}', zh:'再消费 ${amt} 即可达到 {next}', ko:'${amt} 더 쓰면 {next} 달성!' },

    // Quick actions
    qaDeals:        { en:'Member deals', es:'Ofertas de miembros', ru:'Скидки участникам', zh:'会员特价', ko:'멤버 특가' },
    qaDealsDesc:    { en:'App-only weekly specials', es:'Ofertas semanales solo en la app', ru:'Эксклюзивные акции в приложении', zh:'仅限App的每周特价', ko:'앱 전용 주간 특가' },
    qaRefer:        { en:'Refer a friend', es:'Invita a un amigo', ru:'Пригласить друга', zh:'推荐好友', ko:'친구 추천' },
    qaReferDesc:    { en:'Both get 500 pts', es:'Ambos ganan 500 pts', ru:'Оба получают 500 баллов', zh:'双方各得500积分', ko:'둘 다 500P 받기' },
    qaSubscribe:    { en:'Subscribe', es:'Suscríbete', ru:'Подписка', zh:'订阅', ko:'구독' },
    qaSubscribeDesc:{ en:'Banchan & meal kits', es:'Banchan y kits de comida', ru:'Панчан и наборы еды', zh:'小菜及餐食套餐', ko:'반찬·밀키트 정기' },
    qaHistory:      { en:'Activity', es:'Actividad', ru:'Активность', zh:'记录', ko:'적립 내역' },
    qaHistoryDesc:  { en:'Points earned & redeemed', es:'Puntos ganados y canjeados', ru:'Накопленные и списанные баллы', zh:'获取与兑换记录', ko:'적립·사용 내역' },

    // Tabs
    tabHome:        { en:'Home', es:'Inicio', ru:'Главная', zh:'首页', ko:'홈' },
    tabDeals:       { en:'Deals', es:'Ofertas', ru:'Акции', zh:'特价', ko:'특가' },
    tabRefer:       { en:'Refer', es:'Invitar', ru:'Друзья', zh:'推荐', ko:'추천' },
    tabHistory:     { en:'History', es:'Historial', ru:'История', zh:'记录', ko:'내역' },
    tabAccount:     { en:'Account', es:'Cuenta', ru:'Аккаунт', zh:'账户', ko:'계정' },

    // Notice
    noticeBirthdayTi: { en:'🎂 Birthday bonus inside!', es:'🎂 ¡Bono de cumpleaños activo!', ru:'🎂 Подарок на день рождения!', zh:'🎂 生日红利已上线！', ko:'🎂 생일 보너스 도착!' },
    noticeBirthdaySub:{ en:'Tap to claim your $10 reward', es:'Toca para reclamar tu recompensa de $10', ru:'Получите бонус $10', zh:'领取$10奖励', ko:'$10 쿠폰 받기' },

    logout:         { en:'Sign out', es:'Cerrar sesión', ru:'Выйти', zh:'退出登录', ko:'로그아웃' },

    // Deals page
    dealsTitle:     { en:'Member deals', es:'Ofertas de miembros', ru:'Скидки для участников', zh:'会员特价', ko:'멤버 특가' },
    dealsSub:       { en:'App-exclusive prices, updated weekly.', es:'Precios exclusivos en la app, semanales.', ru:'Эксклюзивные цены, обновляются еженедельно.', zh:'每周更新的会员专享价', ko:'매주 업데이트되는 앱 전용 특가' },
    dealsAppOnly:   { en:'APP-ONLY THIS WEEK', es:'SOLO EN LA APP — ESTA SEMANA', ru:'ТОЛЬКО В ПРИЛОЖЕНИИ — НА ЭТОЙ НЕДЕЛЕ', zh:'本周App专享', ko:'이번 주 앱 전용' },
    dealsExpiring:  { en:'Quick-pick — 3× points', es:'Llévalo rápido — 3× puntos', ru:'Поспеши — 3× баллов', zh:'限时抢购 — 3倍积分', ko:'임박 특가 — 포인트 3배' },
    dealsExpSub:    { en:'Save big on items closing in. Earn triple points.', es:'Aprovecha y gana puntos triples.', ru:'Скидки + тройные баллы.', zh:'临期特价，积分三倍', ko:'유통기한 임박 — 적립 3배' },
    dealsClaim:     { en:'Save', es:'Guardar', ru:'Сохранить', zh:'保存', ko:'담기' },
    dealsClaimed:   { en:'Saved ✓', es:'Guardado ✓', ru:'Сохранено ✓', zh:'已保存 ✓', ko:'담음 ✓' },
    dealsNone:      { en:'No deals available right now. Check back soon!', es:'No hay ofertas ahora. ¡Vuelve pronto!', ru:'Нет акций. Загляните позже!', zh:'暂无特价 请稍后再查看', ko:'현재 진행 중인 특가가 없습니다.' },
    dealsValidUntil:{ en:'Valid until {date}', es:'Válido hasta {date}', ru:'Действует до {date}', zh:'有效期至 {date}', ko:'~ {date} 까지' },

    // Refer page
    referTitle:     { en:'Refer a friend', es:'Invita a un amigo', ru:'Пригласи друга', zh:'推荐好友', ko:'친구 추천' },
    referReward:    { en:'You both get 500 pts when they make their first purchase.', es:'Ambos ganan 500 pts en su primera compra.', ru:'Оба получите 500 баллов за первую покупку друга.', zh:'好友首次消费时，双方各得500积分', ko:'친구 첫 구매 시 둘 다 500P 적립' },
    referCode:      { en:'YOUR CODE', es:'TU CÓDIGO', ru:'ВАШ КОД', zh:'您的推荐码', ko:'내 추천 코드' },
    referShare:     { en:'Share', es:'Compartir', ru:'Поделиться', zh:'分享', ko:'공유하기' },
    referCopy:      { en:'Copy', es:'Copiar', ru:'Копировать', zh:'复制', ko:'복사' },
    referCopied:    { en:'Copied!', es:'¡Copiado!', ru:'Скопировано!', zh:'已复制!', ko:'복사됨!' },
    referSms:       { en:'Text', es:'SMS', ru:'СМС', zh:'短信', ko:'문자' },
    referWa:        { en:'WhatsApp', es:'WhatsApp', ru:'WhatsApp', zh:'WhatsApp', ko:'WhatsApp' },
    referEmail:     { en:'Email', es:'Email', ru:'Email', zh:'邮件', ko:'이메일' },
    referMessage:   { en:'Join KIMCHI MART Rewards! Use my code {code} and we both get 500 points. Sign up:', es:'¡Únete a KIMCHI MART Rewards! Usa mi código {code} y ambos ganamos 500 puntos. Regístrate:', ru:'Присоединяйся к KIMCHI MART Rewards! Используй мой код {code} — оба получим 500 баллов. Регистрация:', zh:'加入 KIMCHI MART 会员！使用我的推荐码 {code}，双方各得500积分。注册：', ko:'KIMCHI MART 멤버십 가입하세요! 추천코드 {code} 입력하면 둘 다 500P! 가입:' },
    referStats:     { en:'Friends joined', es:'Amigos unidos', ru:'Друзей привлечено', zh:'已邀请好友', ko:'추천 가입한 친구' },
    referEarned:    { en:'Points earned from referrals', es:'Puntos por referidos', ru:'Баллов за рефералов', zh:'推荐获得积分', ko:'추천으로 받은 포인트' },

    // History page
    historyTitle:   { en:'Activity', es:'Actividad', ru:'Активность', zh:'积分记录', ko:'적립 / 사용 내역' },
    historyEmpty:   { en:'No activity yet. Make your first purchase to start earning!', es:'Sin actividad aún. ¡Haz tu primera compra para empezar a ganar!', ru:'Пока нет активности. Сделайте первую покупку!', zh:'尚无记录 首次购物即可累积积分', ko:'적립 내역이 없습니다. 첫 구매 후 자동 적립됩니다.' },
    historyEarn:    { en:'Earned', es:'Ganado', ru:'Накоплено', zh:'累积', ko:'적립' },
    historyRedeem:  { en:'Redeemed', es:'Canjeado', ru:'Списано', zh:'兑换', ko:'사용' },
    historyBirthday:{ en:'Birthday bonus', es:'Bono de cumpleaños', ru:'Бонус ко дню рождения', zh:'生日红利', ko:'생일 보너스' },
    historyReferral:{ en:'Referral bonus', es:'Bono por referido', ru:'Реферальный бонус', zh:'推荐奖励', ko:'추천 보너스' },
    historyJoin:    { en:'Welcome bonus', es:'Bono de bienvenida', ru:'Бонус за регистрацию', zh:'新人奖励', ko:'가입 보너스' },

    // Account page
    accountTitle:   { en:'My account', es:'Mi cuenta', ru:'Мой аккаунт', zh:'我的账户', ko:'내 계정' },
    accountProfile: { en:'Profile', es:'Perfil', ru:'Профиль', zh:'个人资料', ko:'프로필' },
    accountTier:    { en:'Tier progress', es:'Progreso de nivel', ru:'Прогресс уровня', zh:'等级进度', ko:'등급 진행도' },
    accountSettings:{ en:'Settings', es:'Ajustes', ru:'Настройки', zh:'设置', ko:'설정' },
    accountLang:    { en:'Language', es:'Idioma', ru:'Язык', zh:'语言', ko:'언어' },
    accountStore:   { en:'Home store', es:'Tienda principal', ru:'Магазин', zh:'常用门店', ko:'주 이용 매장' },
    accountSpent30: { en:'Spent (30 days)', es:'Gastado (30 días)', ru:'Потрачено (30 дней)', zh:'30天消费', ko:'30일 누적' },
    accountSpentLT: { en:'Lifetime spend', es:'Total acumulado', ru:'Всего потрачено', zh:'累计消费', ko:'평생 누적' },
    accountJoined:  { en:'Member since', es:'Miembro desde', ru:'Участник с', zh:'加入时间', ko:'가입일' },
    accountTierAll: { en:'All tiers', es:'Todos los niveles', ru:'Все уровни', zh:'所有等级', ko:'전체 등급' }
  };

  const LANGS = ['en','es','ru','zh','ko'];

  function getLang(){
    let v = localStorage.getItem('rewards.lang');
    if (LANGS.includes(v)) return v;
    // detect
    const nav = (navigator.language || 'en').slice(0,2).toLowerCase();
    if (LANGS.includes(nav)) return nav;
    return 'en';
  }
  function setLang(l){
    if (!LANGS.includes(l)) return;
    localStorage.setItem('rewards.lang', l);
    window.dispatchEvent(new CustomEvent('rewards-lang-changed', { detail: { lang: l } }));
  }
  function t(key, vars) {
    const v = I18N[key];
    if (!v) return key;
    let s = v[getLang()] || v.en || key;
    if (vars) for (const k in vars) s = s.split('${'+k+'}').join(vars[k]).split('{'+k+'}').join(vars[k]);
    return s;
  }
  function tArr(key) {
    const v = I18N[key];
    if (!v) return [];
    return v[getLang()] || v.en || [];
  }

  // ============== Phone helpers ==============
  function digitsOnly(s){ return String(s||'').replace(/\D/g,''); }
  function normPhone(raw){
    const d = digitsOnly(raw);
    if (d.length === 10) return '+1' + d;
    if (d.length === 11 && d[0] === '1') return '+' + d;
    return null;
  }
  function fmtPhone(e164){
    const d = digitsOnly(e164);
    if (d.length === 11 && d[0] === '1') {
      return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
    }
    return e164 || '';
  }
  function phoneKey(e164){ return e164.replace(/[^\d]/g,''); }  // RTDB-safe key (digits only, e.g. '13055551234')

  // ============== PIN hashing ==============
  async function hashPin(pin, e164){
    const txt = e164 + ':' + pin + ':kimchi-rewards-v1';
    const buf = new TextEncoder().encode(txt);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // ============== Auth state ==============
  function getMe(){
    try { return JSON.parse(localStorage.getItem('rewards.me') || 'null'); } catch(e){ return null; }
  }
  function setMe(me){
    if (me) localStorage.setItem('rewards.me', JSON.stringify(me));
    else localStorage.removeItem('rewards.me');
    window.dispatchEvent(new Event('rewards-me-changed'));
  }
  function logout(){ setMe(null); location.href = './login.html'; }
  function requireAuth(){
    const me = getMe();
    if (!me || !me.phone) {
      const here = (location.pathname.split('/').pop() || 'index.html');
      location.href = './login.html?returnTo=' + encodeURIComponent(here);
      return null;
    }
    return me;
  }

  // ============== Customer CRUD (RTDB REST) ==============
  async function fetchCustomer(e164){
    try {
      const r = await fetch(`${FB_DB}/rewards/customers/${phoneKey(e164)}.json?cache=${Date.now()}`, { cache:'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch(e){ return null; }
  }
  async function saveCustomer(e164, data){
    const r = await fetch(`${FB_DB}/rewards/customers/${phoneKey(e164)}.json`, {
      method:'PATCH',
      body: JSON.stringify(data)
    });
    return r.ok;
  }
  async function setCustomer(e164, data){
    const r = await fetch(`${FB_DB}/rewards/customers/${phoneKey(e164)}.json`, {
      method:'PUT',
      body: JSON.stringify(data)
    });
    return r.ok;
  }
  async function fetchByReferral(code){
    try {
      const r = await fetch(`${FB_DB}/rewards/referral_codes/${code}.json`);
      if (!r.ok) return null;
      return await r.json();  // returns phoneKey string
    } catch(e){ return null; }
  }
  async function setReferralCode(code, e164){
    const r = await fetch(`${FB_DB}/rewards/referral_codes/${code}.json`, {
      method:'PUT',
      body: JSON.stringify(phoneKey(e164))
    });
    return r.ok;
  }
  function genReferralCode(){
    // 6-char alnum, avoid ambiguous (0/O, 1/I, etc.)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  // ============== Tier ==============
  function calcTier(spent30d){
    spent30d = Number(spent30d) || 0;
    if (spent30d >= 600) return { key:'diamond', name: t('tierDiamond'), emoji:'💎', next:null, cur:spent30d, threshold:600 };
    if (spent30d >= 300) return { key:'gold', name: t('tierGold'), emoji:'🏆', next:600, nextName:t('tierDiamond'), cur:spent30d, threshold:300 };
    if (spent30d >= 100) return { key:'silver', name: t('tierSilver'), emoji:'🥈', next:300, nextName:t('tierGold'), cur:spent30d, threshold:100 };
    return { key:'bronze', name: t('tierBronze'), emoji:'🥉', next:100, nextName:t('tierSilver'), cur:spent30d, threshold:0 };
  }

  // ============== Header / Tab bar render ==============
  function renderHeader(target, opts){
    opts = opts || {};
    const me = getMe();
    target.innerHTML = `
      <a class="brand" href="./index.html">
        <span class="km-k">K</span>
        <span class="km-name">KIMCHI</span>
      </a>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="lang-bar" id="langBar"></div>
        ${me ? `<button class="icon-btn danger" id="btnLogout" aria-label="${t('logout')}" title="${t('logout')}">⏻</button>` : ''}
      </div>
    `;
    renderLangBar(target.querySelector('#langBar'));
    const lo = target.querySelector('#btnLogout');
    if (lo) lo.addEventListener('click', () => { if (confirm(t('logout') + '?')) logout(); });
  }

  function renderLangBar(target){
    if (!target) return;
    const cur = getLang();
    target.innerHTML = LANGS.map(L =>
      `<button data-l="${L}" class="${cur===L?'active':''}">${L.toUpperCase()}</button>`
    ).join('');
    target.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => { setLang(b.dataset.l); location.reload(); });
    });
  }

  function renderTabBar(target, current){
    target.innerHTML = `
      <a href="./index.html"   class="${current==='home'?'active':''}"><span class="ic">🏠</span><span>${t('tabHome')}</span></a>
      <a href="./deals.html"   class="${current==='deals'?'active':''}"><span class="ic">🎁</span><span>${t('tabDeals')}</span></a>
      <a href="./refer.html"   class="${current==='refer'?'active':''}"><span class="ic">👥</span><span>${t('tabRefer')}</span></a>
      <a href="./history.html" class="${current==='history'?'active':''}"><span class="ic">📋</span><span>${t('tabHistory')}</span></a>
      <a href="./account.html" class="${current==='account'?'active':''}"><span class="ic">👤</span><span>${t('tabAccount')}</span></a>
    `;
  }

  // ============== Service worker registration ==============
  function registerSW(){
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  // ============== Export ==============
  window.KMR = {
    // i18n
    t, tArr, getLang, setLang, LANGS, I18N,
    // phone
    digitsOnly, normPhone, fmtPhone, phoneKey,
    // auth
    hashPin, getMe, setMe, logout, requireAuth,
    // RTDB
    fetchCustomer, saveCustomer, setCustomer,
    fetchByReferral, setReferralCode, genReferralCode,
    // tier
    calcTier,
    // UI
    renderHeader, renderTabBar, renderLangBar,
    // pwa
    registerSW
  };
})();
