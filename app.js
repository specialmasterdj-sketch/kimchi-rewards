// KIMCHI MART REWARDS — shared client logic
// - i18n (5 languages: en, es, ru, zh, ko — English first)
// - Firebase Realtime Database REST (kimchi-mart-order project)
// - Phone+PIN auth (PIN hashed SHA-256 + salt, never stored plain)
// - Tier calculation (rolling 30-day spend)
// - Page guards / shared header / tab bar / lang bar

(function(){
  // ============== Firebase ==============
  window.FB_DB = 'https://kimchi-mart-order-default-rtdb.firebaseio.com';

  // Branches — mirrors the rest of the KIMCHI MART suite (chat.html / expiry.html etc.)
  // Public store info verified from KIMCHI MART social media (kimchimartmiami).
  // Open 365 days, 7 days/week — Fresh Asian food at the Best Price in FL.
  window.BRANCHES = [
    { id: 'MIAMI',          name: 'Miami',           address: '15355 S Dixie Hwy, Miami, FL 33157',           phone: '+13059645083' },
    { id: 'PEMBROKE_PINES', name: 'Pembroke Pines',  address: '11230 Pines Blvd, Pembroke Pines, FL 33026',   phone: '+17542174919' },
    { id: 'HOLLYWOOD',      name: 'Hollywood',       address: '2420 N Dixie Hwy, Hollywood, FL 33020',        phone: '+17542107965' },
    { id: 'CORAL_SPRINGS',  name: 'Coral Springs',   address: '2693 N University Dr, Coral Springs, FL 33065', phone: '+19546889437' },
    { id: 'LASOLAS',        name: 'Fort Lauderdale', address: '510 NW 7th Ave, Fort Lauderdale, FL 33311',    phone: '+17542160106', justOpened: true },
    { id: 'WEST_PALM',      name: 'West Palm Beach', address: 'West Palm Beach, FL',                          phone: '', comingSoon: true }
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
    pinHintFirst:   { en:'First time? Leave PIN empty and tap Sign in.', es:'¿Primera vez? Deja el PIN vacío y toca Iniciar sesión.', ru:'Впервые? Оставьте PIN пустым и нажмите Войти.', zh:'首次登录？密码留空，点击登录', ko:'처음이신가요? PIN 비우고 Sign in 누르세요.' },
    heroTagline:    { en:'Fresh Asian food at the Best Price in FL', es:'Comida asiática fresca al mejor precio en FL', ru:'Свежие азиатские продукты по лучшей цене во Флориде', zh:'佛州最优价格的新鲜亚洲食品', ko:'플로리다 최저가 신선한 아시안 식품' },
    heroOpen:       { en:'Open 365 days', es:'Abierto 365 días', ru:'Открыто 365 дней', zh:'全年无休', ko:'연중무휴' },
    brandsLabel:    { en:"Trusted by Korea's top brands", es:'Avalado por las mejores marcas coreanas', ru:'Лучшие корейские бренды', zh:'韩国顶级品牌入驻', ko:'한국 대표 브랜드 입점' },
    pinSet:         { en:'Set 4-digit PIN', es:'Crea un PIN de 4 dígitos', ru:'Задайте 4-значный PIN', zh:'设置4位密码', ko:'PIN 설정' },
    pinConfirm:     { en:'Confirm PIN', es:'Confirma PIN', ru:'Подтвердите PIN', zh:'确认密码', ko:'PIN 확인' },
    name:           { en:'Your name', es:'Tu nombre', ru:'Ваше имя', zh:'姓名', ko:'이름' },
    birthDate:      { en:'Birthday', es:'Cumpleaños', ru:'День рождения', zh:'生日', ko:'생일' },
    birthMonth:     { en:'Month', es:'Mes', ru:'Месяц', zh:'月份', ko:'월' },
    birthDay:       { en:'Day', es:'Día', ru:'День', zh:'日期', ko:'일' },
    birthHint:      { en:'Get triple points + a free gift on your birthday!', es:'¡Puntos triples + regalo gratis en tu cumpleaños!', ru:'Тройные баллы + подарок в день рождения!', zh:'生日当天三倍积分 + 免费礼物！', ko:'생일 당일 포인트 3배 + 무료 선물!' },
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
    welcomeBack:     { en:'Welcome back! Set up your app PIN.', es:'¡Bienvenido de vuelta! Crea tu PIN.', ru:'С возвращением! Создайте PIN для приложения.', zh:'欢迎回来！请设置App密码', ko:'다시 오셨네요! 앱 PIN을 설정해주세요.' },
    welcomeBackSub:  { en:'Your KIMCHI MART points are already saved. Just create a 4-digit PIN to access them.', es:'Tus puntos ya están guardados. Solo crea un PIN de 4 dígitos.', ru:'Ваши баллы уже сохранены. Создайте 4-значный PIN для доступа.', zh:'您的积分已保存，只需设置4位密码即可登录', ko:'포인트는 이미 저장돼 있어요. PIN 4자리만 설정하면 됩니다.' },
    pointsAlready:   { en:'You have {n} points waiting!', es:'¡Tienes {n} puntos esperando!', ru:'У вас {n} баллов!', zh:'您有 {n} 积分待领取！', ko:'{n} 포인트가 기다리고 있어요!' },
    errReferral:     { en:'Referral code not found.', es:'Código no válido.', ru:'Реферальный код не найден.', zh:'推荐码无效', ko:'추천 코드를 찾을 수 없습니다.' },

    // Home
    yourBarcode:    { en:'YOUR REWARDS CODE', es:'TU CÓDIGO DE PUNTOS', ru:'ВАШ КОД БАЛЛОВ', zh:'您的积分码', ko:'내 회원 바코드' },
    scanAtCheckout: { en:'Show this at checkout to earn & redeem', es:'Muestra esto al pagar para ganar y canjear', ru:'Покажите на кассе, чтобы накопить и потратить', zh:'结账时出示以累积或兑换', ko:'계산 시 직원에게 보여주세요' },
    pointsBalance:  { en:'Points balance', es:'Saldo de puntos', ru:'Баланс баллов', zh:'积分余额', ko:'포인트 잔액' },
    pointsUnit:     { en:'pts', es:'pts', ru:'б.', zh:'分', ko:'P' },
    pointsVela:     { en:'Store points', es:'Puntos de tienda', ru:'Баллы магазина', zh:'门店积分', ko:'매장 포인트' },
    pointsBonus:    { en:'App bonus', es:'Bono de la app', ru:'Бонус приложения', zh:'App奖励', ko:'앱 보너스' },
    pointsTotal:    { en:'Total redeemable', es:'Total canjeable', ru:'Всего к обмену', zh:'可用总额', ko:'총 사용 가능' },
    pointsVelaHint: { en:'Earned at checkout · automatic POS discount', es:'Acumulado en caja · descuento automático en POS', ru:'Накапливается на кассе · автоматическая скидка POS', zh:'结账时累积·POS自动折扣', ko:'계산 시 적립 · POS 자동 할인' },
    pointsBonusHint:{ en:'Sign-up · birthday · referral · win-back', es:'Registro · cumpleaños · referido · regreso', ru:'Регистрация · день рождения · реферал · возврат', zh:'注册·生日·推荐·回归', ko:'가입·생일·추천·재방문' },

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
    qaMember:       { en:'K1 / K2 Membership', es:'Membresía K1 / K2', ru:'Членство K1 / K2', zh:'K1 / K2 会员', ko:'K1 / K2 멤버십' },
    qaMemberDesc:   { en:'5% or 10% off every purchase', es:'5% o 10% en cada compra', ru:'5% или 10% на всё', zh:'每次消费立减5%或10%', ko:'매 구매 5% 또는 10% 할인' },
    qaHistory:      { en:'Activity', es:'Actividad', ru:'Активность', zh:'记录', ko:'적립 내역' },
    qaHistoryDesc:  { en:'Points earned & redeemed', es:'Puntos ganados y canjeados', ru:'Накопленные и списанные баллы', zh:'获取与兑换记录', ko:'적립·사용 내역' },

    // Tabs
    tabHome:        { en:'Home', es:'Inicio', ru:'Главная', zh:'首页', ko:'홈' },
    tabDeals:       { en:'Deals', es:'Ofertas', ru:'Акции', zh:'特价', ko:'특가' },
    tabRefer:       { en:'Refer', es:'Invitar', ru:'Друзья', zh:'推荐', ko:'추천' },
    tabHistory:     { en:'History', es:'Historial', ru:'История', zh:'记录', ko:'내역' },
    tabAccount:     { en:'Account', es:'Cuenta', ru:'Аккаунт', zh:'账户', ko:'계정' },

    // Notice
    noticeBirthdayTi: { en:'🎂 Happy Birthday!', es:'🎂 ¡Feliz Cumpleaños!', ru:'🎂 С днём рождения!', zh:'🎂 生日快乐！', ko:'🎂 생일 축하합니다!' },
    noticeBirthdaySub:{ en:'Triple points + $10 gift today only', es:'Triple puntos + regalo de $10 solo hoy', ru:'Тройные баллы + подарок $10 — только сегодня', zh:'今日限定：三倍积分 + $10礼物', ko:'오늘만 포인트 3배 + $10 선물' },
    noticeBirthMonth: { en:'🎁 Your birthday month — extra perks all month', es:'🎁 Mes de tu cumpleaños — beneficios todo el mes', ru:'🎁 Месяц вашего рождения — бонусы весь месяц', zh:'🎁 您的生日月 — 整月专享福利', ko:'🎁 생일달 — 한 달 내내 추가 혜택' },

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
    historyWinback: { en:'Win-back bonus', es:'Bono de regreso', ru:'Бонус за возврат', zh:'回归奖励', ko:'재방문 보너스' },
    historyBonusRedeem:{ en:'Bonus redeemed', es:'Bono canjeado', ru:'Бонус использован', zh:'奖励已兑换', ko:'보너스 사용' },

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
    accountTierAll: { en:'All tiers', es:'Todos los niveles', ru:'Все уровни', zh:'所有等级', ko:'전체 등급' },

    // Paid membership
    membK1Name:     { en:'K1 Member', es:'Miembro K1', ru:'Участник K1', zh:'K1 会员', ko:'K1 회원' },
    membK2Name:     { en:'K2 Business', es:'K2 Empresa', ru:'K2 Бизнес', zh:'K2 商家', ko:'K2 사업자' },
    membDiscount5:  { en:'5% off every purchase', es:'5% de descuento siempre', ru:'5% скидка на всё', zh:'每次消费5%折扣', ko:'전 상품 5% 할인' },
    membDiscount10: { en:'10% off every purchase', es:'10% de descuento siempre', ru:'10% скидка на всё', zh:'每次消费10%折扣', ko:'전 상품 10% 할인' },
    membActive:     { en:'Active', es:'Activo', ru:'Активно', zh:'有效', ko:'활성' },
    membTrial:      { en:'1-YEAR FREE TRIAL', es:'PRUEBA GRATIS 1 AÑO', ru:'БЕСПЛАТНО 1 ГОД', zh:'免费试用1年', ko:'1년 무료 트라이얼' },
    membExpires:    { en:'Expires {date}', es:'Vence {date}', ru:'Истекает {date}', zh:'到期 {date}', ko:'만료: {date}' },
    membExpiringTi: { en:'⚠ Membership expires in {n} days', es:'⚠ Membresía vence en {n} días', ru:'⚠ Членство истекает через {n} дней', zh:'⚠ 会员将在 {n} 天后到期', ko:'⚠ 멤버십 {n}일 후 만료' },
    membExpiringSub:{ en:'Renew for $25 to keep your 5% discount', es:'Renueva por $25 para mantener tu 5% descuento', ru:'Продлите за $25 чтобы сохранить 5% скидку', zh:'续费 $25 即可继续享受 5% 折扣', ko:'$25 결제 시 5% 할인 연장' },
    membRenew:      { en:'Renew at the store', es:'Renueva en la tienda', ru:'Продлить в магазине', zh:'到店续费', ko:'매장에서 연장' },
    membTrialGifted:{ en:'🎉 You earned a FREE K1 trial!', es:'🎉 ¡Ganaste prueba K1 GRATIS!', ru:'🎉 Вы получили БЕСПЛАТНЫЙ K1!', zh:'🎉 您获得了免费K1会员！', ko:'🎉 K1 무료 트라이얼 받으셨어요!' },
    nonMemberPts:   { en:'Earn 1% points on every purchase. Use as cash next time.', es:'Gana 1% en cada compra. Úsalo como efectivo después.', ru:'1% баллов с каждой покупки. Используйте как деньги в следующий раз.', zh:'每次消费返1%积分，下次结账可抵现金', ko:'구매 시 1% 적립, 다음 결제 시 현금처럼 사용' },
    memberNoPoints: { en:'Members get instant discount — no points needed.', es:'Los miembros reciben descuento al instante — sin puntos.', ru:'Участники получают скидку сразу — без баллов.', zh:'会员即时折扣 — 无需积分', ko:'회원은 즉시 할인 — 포인트 적립 없음' },
    pointsAsCash:   { en:'Use as cash next purchase', es:'Usa como efectivo en próxima compra', ru:'Используйте как деньги в следующий раз', zh:'下次消费可抵现金', ko:'다음 구매 시 현금으로 사용' },

    // Tier perks (5 languages)
    perk_pts1pct:       { en:'Earn 1% points on every purchase', es:'Gana 1% de puntos en cada compra', ru:'Накапливайте 1% баллов с каждой покупки', zh:'每次消费1%积分回馈', ko:'매 구매 1% 포인트 적립' },
    perk_birthday200:   { en:'+200 birthday bonus', es:'+200 bono de cumpleaños', ru:'+200 бонусных баллов в день рождения', zh:'生日额外200积分', ko:'생일 보너스 +200P' },
    perk_birthday500:   { en:'+500 birthday bonus', es:'+500 bono de cumpleaños', ru:'+500 бонусных баллов в день рождения', zh:'生日额外500积分', ko:'생일 보너스 +500P' },
    perk_birthday1000:  { en:'+1,000 birthday bonus', es:'+1,000 bono de cumpleaños', ru:'+1 000 бонусных баллов в день рождения', zh:'生日额外1,000积分', ko:'생일 보너스 +1,000P' },
    perk_dealsEarly:    { en:'1-hour early access to expiring deals', es:'Acceso 1 hora antes a ofertas caducas', ru:'Ранний доступ к скидкам — за 1 час', zh:'临期特价提前1小时优先购', ko:'임박 특가 1시간 우선 알림' },
    perk_freeDelivery:  { en:'Free delivery once per month', es:'Entrega gratis una vez al mes', ru:'Бесплатная доставка раз в месяц', zh:'每月一次免费配送', ko:'월 1회 무료 배송' },
    perk_newProducts:   { en:'New product preview before public release', es:'Vista previa de productos nuevos', ru:'Предварительный доступ к новинкам', zh:'新品首发优先体验', ko:'신상품 우선 체험' },

    perksTitle:        { en:'Your tier perks', es:'Tus beneficios', ru:'Ваши преимущества', zh:'您的等级权益', ko:'등급 혜택' },
    perksAllTiers:     { en:'All tier benefits', es:'Beneficios por nivel', ru:'Преимущества всех уровней', zh:'各等级权益对比', ko:'등급별 혜택' },
    perksNextTier:     { en:'Reach {next} to unlock:', es:'Alcanza {next} para desbloquear:', ru:'Достигните {next}, чтобы открыть:', zh:'升至{next}解锁：', ko:'{next} 등급에서 추가 잠금 해제:' },

    // Saved deals
    savedAll:       { en:'All', es:'Todos', ru:'Все', zh:'全部', ko:'전체' },
    savedFilter:    { en:'Saved', es:'Guardados', ru:'Сохранённые', zh:'已保存', ko:'담음' },
    savedNone:      { en:'No saved deals yet. Tap "Save" on any deal to add it here.', es:'Aún no hay ofertas guardadas. Toca "Guardar" para agregarlas.', ru:'Пока нет сохранённых акций. Нажмите «Сохранить» на любой акции.', zh:'尚未保存特价。点击 "保存" 添加', ko:'담은 특가가 없습니다. "담기" 버튼을 눌러 추가하세요.' },
    savedHomeTi:    { en:'You saved {n} deal{s}', es:'Tienes {n} oferta{s} guardada{s}', ru:'У вас {n} сохранённых акций', zh:'已保存 {n} 个特价', ko:'담은 특가 {n}개' },
    savedHomeSub:   { en:'Tap to review before shopping', es:'Tócalo para revisar antes de comprar', ru:'Откройте перед походом в магазин', zh:'购物前查看', ko:'장 보러 가기 전에 확인하세요' },
    savedRemove:    { en:'Remove', es:'Quitar', ru:'Удалить', zh:'移除', ko:'제거' }
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
    // Persist to customer record so admin campaigns can localize messages
    try {
      const me = getMe();
      if (me && me.phone) {
        // Fire-and-forget — don't block UI on the network call
        fetch(`${window.FB_DB}/rewards/customers/${phoneKey(me.phone)}/lang.json`, {
          method: 'PUT',
          body: JSON.stringify(l),
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {});
      }
    } catch(e) {}
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

  // ============== Paid Membership (K1 / K2 / auto-trial) ==============
  // K1 = $25/yr, 5% instant discount
  // K2 = $35/yr, 10% instant discount (restaurants / business owners / wholesale)
  // Auto-trial = free 1-year K1 for high-spend customers (configurable threshold)
  window.MEMBERSHIP_PLANS = {
    none: { discount: 0,    fee: 0,  label: 'None' },
    k1:   { discount: 0.05, fee: 25, label: 'K1' },
    k2:   { discount: 0.10, fee: 35, label: 'K2' }
  };
  // Auto-grant a free 1-year K1 trial when POINT LIFETIME meets this threshold.
  // KIMCHI policy: regular customers earn 1% points (use as cash next time).
  // Members earn NO points but get instant 5%/10% off.
  // Trial gives a regular customer the K1 5%-off perk for free for 1 year.
  //
  // Default 1000 = top 1.2% (~709 customers) — premium loyalty signal.
  // EVENT_MODE_THRESHOLD overrides for promotions (set to e.g. 200 during
  // 'free K1 trial signup week', revert to null when event ends).
  window.AUTO_TRIAL_POINTS_THRESHOLD = 1000;  // POINT LIFETIME ≥ 1000 → free K1 trial
  window.EVENT_MODE_THRESHOLD = null;         // e.g. 200 during a signup promo; null = no event
  window.TRIAL_DAYS = 365;                    // 1 year

  // Map Vela GROUP + POINT LIFETIME → our membership plan
  function deriveMembershipFromVela(velaGroup, pointLifetime){
    const g = String(velaGroup||'').toUpperCase().trim();
    const now = Date.now();
    if (g === 'MEMBERS' || g === 'MEMBER' || g === 'K1') {
      return { plan: 'k1', grantType: 'paid', activatedAt: now, expiresAt: null };
    }
    if (g === 'BUSINESS OWNER' || g === 'BUSINESS' || g === 'K2' || g === 'WHOLESALE') {
      return { plan: 'k2', grantType: 'paid', activatedAt: now, expiresAt: null };
    }
    // Regular / empty → check auto-trial threshold (POINT LIFETIME)
    // EVENT_MODE_THRESHOLD takes priority when set (promotional period)
    const threshold = (typeof EVENT_MODE_THRESHOLD === 'number' && EVENT_MODE_THRESHOLD > 0)
                      ? EVENT_MODE_THRESHOLD
                      : AUTO_TRIAL_POINTS_THRESHOLD;
    if ((+pointLifetime || 0) >= threshold) {
      return {
        plan: 'k1',
        grantType: 'auto-trial',
        activatedAt: now,
        expiresAt: now + TRIAL_DAYS * 86400000
      };
    }
    return { plan: 'none', grantType: null, activatedAt: null, expiresAt: null };
  }

  // Helpers used by UI pages
  function getActiveMembership(c){
    if (!c || !c.membership) return null;
    const m = c.membership;
    if (!m.plan || m.plan === 'none') return null;
    // Trial expired?
    if (m.expiresAt && m.expiresAt < Date.now()) return null;
    return m;
  }
  function membershipDiscountPct(c){
    const m = getActiveMembership(c);
    if (!m) return 0;
    return (MEMBERSHIP_PLANS[m.plan] || {}).discount || 0;
  }
  function daysUntilMembershipExpiry(c){
    const m = getActiveMembership(c);
    if (!m || !m.expiresAt) return null;   // paid (no expiry tracked here)
    return Math.ceil((m.expiresAt - Date.now()) / 86400000);
  }

  // ============== Tier benefits (gamification) ==============
  // Each tier inherits all perks from lower tiers; this lookup returns
  // an ordered list of perk keys for the active tier.
  const TIER_PERKS = {
    bronze:  ['perk_pts1pct', 'perk_birthday1000'],
    silver:  ['perk_pts1pct', 'perk_birthday1000'],
    gold:    ['perk_pts1pct', 'perk_birthday1000', 'perk_dealsEarly'],
    diamond: ['perk_pts1pct', 'perk_birthday1000', 'perk_dealsEarly', 'perk_freeDelivery', 'perk_newProducts']
  };
  function tierPerks(tierKey){ return TIER_PERKS[tierKey] || TIER_PERKS.bronze; }

  // Birthday bonus — flat 1,000 P ($10) for every member regardless of tier
  const BIRTHDAY_BONUS = { bronze: 1000, silver: 1000, gold: 1000, diamond: 1000 };

  // ============== Two-balance model ==============
  // points        = Vela POS balance (mirror of Vela; the hourly sync
  //                 overwrites this — we never touch it ourselves)
  // bonusPoints   = app-only bonuses (sign-up / birthday / referral /
  //                 win-back). Lives ONLY in our DB; staff redeem them
  //                 by giving an equal-dollar discount in Vela and
  //                 using counter.html to subtract from this number.
  // The customer-facing UI shows both, with "Total available" = sum.

  // Idempotent birthday check — gives the bonus once per (year, customer).
  // Safe to call on every page load.
  async function checkBirthdayBonus(customer){
    if (!customer || !customer.birthMonth || !customer.birthDay) return null;
    const today = new Date();
    if (customer.birthMonth !== (today.getMonth() + 1)) return null;
    if (customer.birthDay !== today.getDate()) return null;

    const phoneK = phoneKey(customer.phone);
    const dateKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    try {
      const r = await fetch(`${window.FB_DB}/rewards/birthday_log/${dateKey}/${phoneK}.json?cache=${Date.now()}`, { cache:'no-store' });
      if (r.ok) {
        const existing = await r.json();
        if (existing) return null;
      }
    } catch(e){}

    const tier = calcTier(customer.totalSpent_30d || 0);
    const bonus = BIRTHDAY_BONUS[tier.key] || 0;
    if (bonus <= 0) return null;

    const newBonus = (customer.bonusPoints || 0) + bonus;   // bonus bucket only
    const ts = Date.now();
    try {
      await Promise.all([
        fetch(`${window.FB_DB}/rewards/customers/${phoneK}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ bonusPoints: newBonus }),
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${window.FB_DB}/rewards/birthday_log/${dateKey}/${phoneK}.json`, {
          method: 'PUT',
          body: JSON.stringify({ tier: tier.key, bonus, ts }),
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${window.FB_DB}/rewards/transactions.json`, {
          method: 'POST',
          body: JSON.stringify({ phone: customer.phone, type: 'birthday', bonusPoints: bonus, tier: tier.key, ts }),
          headers: { 'Content-Type': 'application/json' }
        })
      ]);
      return { bonus, newBonus, tier: tier.key };
    } catch(e) {
      console.warn('[birthday] failed', e);
      return null;
    }
  }

  // ============== Tier ==============
  // 30-day spend thresholds — Bronze $0 / Silver $100 / Gold $500 / Diamond $1000
  function calcTier(spent30d){
    spent30d = Number(spent30d) || 0;
    if (spent30d >= 1000) return { key:'diamond', name: t('tierDiamond'), emoji:'💎', next:null,  cur:spent30d, threshold:1000 };
    if (spent30d >= 500)  return { key:'gold',    name: t('tierGold'),    emoji:'🏆', next:1000, nextName:t('tierDiamond'), cur:spent30d, threshold:500 };
    if (spent30d >= 100)  return { key:'silver',  name: t('tierSilver'),  emoji:'🥈', next:500,  nextName:t('tierGold'),    cur:spent30d, threshold:100 };
    return                       { key:'bronze',  name: t('tierBronze'),  emoji:'🥉', next:100,  nextName:t('tierSilver'),  cur:spent30d, threshold:0 };
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
    // Any page that renders the customer header also pings RTDB so we can
    // measure real usage (heartbeat is throttled to once per 24 h).
    if (me) heartbeat();
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

  // ============== Saved deals helpers ==============
  // localStorage map: { dealId: { ts, expiry, name, price, image, dday } }
  function getSavedDeals(){
    try { return JSON.parse(localStorage.getItem('rewards.savedDeals') || '{}'); } catch(e){ return {}; }
  }
  function setSavedDeal(id, data){
    const m = getSavedDeals();
    m[id] = Object.assign({ ts: Date.now() }, data || {});
    localStorage.setItem('rewards.savedDeals', JSON.stringify(m));
  }
  function removeSavedDeal(id){
    const m = getSavedDeals();
    delete m[id];
    localStorage.setItem('rewards.savedDeals', JSON.stringify(m));
  }
  // Purge expired saves: anything with dday < 0 today (deal already passed)
  function pruneSavedDeals(){
    const m = getSavedDeals();
    const today = new Date(); today.setHours(0,0,0,0);
    let changed = false;
    for (const id in m) {
      const v = m[id];
      if (!v) { delete m[id]; changed = true; continue; }
      if (v.expiry) {
        const e = new Date(v.expiry); e.setHours(0,0,0,0);
        if (e < today) { delete m[id]; changed = true; }
      }
    }
    if (changed) localStorage.setItem('rewards.savedDeals', JSON.stringify(m));
    return Object.keys(m).length;
  }
  function countSavedDeals(){
    return pruneSavedDeals();
  }

  // Total redeemable for a customer (Vela + bonus). Used by UI summaries.
  function totalAvailablePoints(c) {
    return (Number(c && c.points) || 0) + (Number(c && c.bonusPoints) || 0);
  }

  // ============== Activity heartbeat ==============
  // Mark the customer as active any time they open the app, but at most
  // once every 24 h so we don't hammer RTDB. Used by admin-stats to
  // compute real DAU / WAU / MAU instead of just sign-up counts.
  function heartbeat() {
    try {
      const me = getMe();
      if (!me || !me.phone) return;
      const lastBeat = parseInt(localStorage.getItem('rewards.lastBeat') || '0', 10);
      const now = Date.now();
      if (now - lastBeat < 23 * 60 * 60 * 1000) return;   // already pinged today
      localStorage.setItem('rewards.lastBeat', String(now));
      const key = phoneKey(me.phone);
      // Fire-and-forget — never block UI
      fetch(window.FB_DB + '/rewards/customers/' + key + '/lastVisit.json', {
        method: 'PUT',
        body: JSON.stringify(now),
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
    } catch(e) {}
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
    calcTier, tierPerks,
    // birthday
    checkBirthdayBonus,
    // membership
    deriveMembershipFromVela, getActiveMembership, membershipDiscountPct, daysUntilMembershipExpiry,
    // saved deals
    getSavedDeals, setSavedDeal, removeSavedDeal, pruneSavedDeals, countSavedDeals,
    // UI
    renderHeader, renderTabBar, renderLangBar,
    // analytics
    heartbeat,
    // pwa
    registerSW
  };
})();
