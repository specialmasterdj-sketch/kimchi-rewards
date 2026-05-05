# =============================================================
# KIMCHI MART — Dormant-customer Win-Back Campaign
# Sends 30 / 60 / 90-day cohort messages + auto-credits bonus points.
# Idempotent per (week, cohort) via /rewards/winback_log.
#
# Setup (once):
# 1. Save this file as C:\KimchiSync\dormant-campaign.ps1
# 2. Open Task Scheduler → Create Basic Task →
#    - Name: "KIMCHI Win-back"
#    - Trigger: Weekly, Monday 8:00 AM (or whatever cadence you prefer)
#    - Action: powershell.exe
#      Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\KimchiSync\dormant-campaign.ps1"
#
# Logs go to dormant-campaign.log next to the script.
# =============================================================

$FbDb    = "https://kimchi-mart-order-default-rtdb.firebaseio.com"
$LogFile = Join-Path $PSScriptRoot "dormant-campaign.log"
$DryRun  = $false   # set $true to count only, no writes

$Campaigns = @{
  '30' = @{
    label='30-59d'; minDays=30; maxDays=59; bonus=100; icon='👋'
    title = @{
      en='We miss you, {name}!'; es='¡Te extrañamos, {name}!'; ru='Мы скучаем, {name}!'; zh='{name}，好久不见！'; ko='{name}님, 그리워요!'
    }
    body = @{
      en="Here's 100 bonus points. Come grab fresh kimchi this week."
      es='Aquí tienes 100 puntos extra. Ven por kimchi fresco esta semana.'
      ru='Вот вам 100 бонусных баллов. Приходите за свежим кимчи на этой неделе.'
      zh='送您100积分，本周来 KIMCHI MART 选购新鲜泡菜吧'
      ko='+100 포인트 적립됐어요. 이번 주 신선한 김치 사러 오세요.'
    }
  }
  '60' = @{
    label='60-89d'; minDays=60; maxDays=89; bonus=200; icon='💚'
    title = @{
      en="{name}, it's been 2 months"; es='{name}, han pasado 2 meses'; ru='{name}, прошло 2 месяца'; zh='{name}，已经2个月没见啦'; ko='{name}님, 2개월이 지났어요'
    }
    body = @{
      en='+200 points just added. Stop by — we have new sales waiting.'
      es='+200 puntos añadidos. Visítanos — hay nuevas ofertas esperando.'
      ru='+200 баллов добавлено. Загляните — у нас новые акции.'
      zh='已为您添加200积分，新一波特价等您来选购'
      ko='+200 포인트 적립. 새 특가가 기다리고 있어요.'
    }
  }
  '90' = @{
    label='90+d'; minDays=90; maxDays=99999; bonus=300; icon='🎁'
    title = @{
      en='Last call — +300 points'; es='Última llamada — +300 puntos'; ru='Последний шанс — +300 баллов'; zh='最后机会 — 送您300积分'; ko='마지막 알림 — +300 포인트'
    }
    body = @{
      en='{name}, your account is still active. 300P added — use them before they expire.'
      es='{name}, tu cuenta sigue activa. 300P añadidos — úsalos antes que caduquen.'
      ru='{name}, ваш аккаунт активен. 300 баллов добавлены — используйте их.'
      zh='{name}，您的账户仍有效，已赠送300积分，请尽快使用'
      ko='{name}님, 계정이 아직 활성 상태예요. 300P 적립 — 만료 전 사용하세요.'
    }
  }
}

function Log($msg, $color='Gray') {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $LogFile -Value $line
  Write-Host $line -ForegroundColor $color
}

# ISO-week key (matches the JS page)
$now = Get-Date
$onejan = [datetime]"$($now.Year)-01-01"
$days = ($now - $onejan).Days + 1 + $onejan.DayOfWeek.value__
$week = [math]::Ceiling($days / 7)
$WeekKey = "{0}-W{1:D2}" -f $now.Year, $week

Log "==== Dormant campaign start ($WeekKey, dryRun=$DryRun) ====" 'Cyan'

# Load all customers
try {
  $all = Invoke-RestMethod -Uri "$FbDb/rewards/customers.json" -TimeoutSec 120
} catch {
  Log "Customer load failed: $_" 'Red'
  exit 1
}
$keys = @($all.PSObject.Properties.Name)
Log ("Loaded {0:N0} customers" -f $keys.Count)

$nowMs = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$cutoffMs = @{
  30 = $nowMs - (30  * 86400000)
  60 = $nowMs - (60  * 86400000)
  90 = $nowMs - (90  * 86400000)
}

foreach ($cohort in @('30','60','90')) {
  $cmp = $Campaigns[$cohort]
  $minMs = $cutoffMs[[int]$cohort]
  $maxMs = if ($cohort -eq '30') { $cutoffMs[60] } elseif ($cohort -eq '60') { $cutoffMs[90] } else { 0 }

  # Already-rewarded members for this (week, cohort)
  try {
    $logResp = Invoke-RestMethod -Uri "$FbDb/rewards/winback_log/$WeekKey/$cohort.json?shallow=true"
    $already = if ($logResp) { @($logResp.PSObject.Properties.Name) } else { @() }
  } catch { $already = @() }
  $alreadySet = @{}
  foreach ($k in $already) { $alreadySet[$k] = $true }

  # Filter recipients
  $recipients = @()
  foreach ($k in $keys) {
    if ($alreadySet[$k]) { continue }
    $c = $all.$k
    if (-not $c.lastVisit) { continue }
    $lv = [long]$c.lastVisit
    if ($lv -le 0) { continue }
    if ($cohort -eq '30' -and $lv -le $minMs -and $lv -ge $maxMs) { $recipients += [PSCustomObject]@{ key=$k; data=$c } }
    elseif ($cohort -eq '60' -and $lv -le $minMs -and $lv -ge $maxMs) { $recipients += [PSCustomObject]@{ key=$k; data=$c } }
    elseif ($cohort -eq '90' -and $lv -le $minMs) { $recipients += [PSCustomObject]@{ key=$k; data=$c } }
  }
  Log ("Cohort {0}: {1:N0} new recipients ({2:N0} already rewarded)" -f $cmp.label, $recipients.Count, $alreadySet.Count) 'Yellow'
  if ($recipients.Count -eq 0) { continue }
  if ($DryRun) {
    Log ("  [DRY RUN] Would send + credit {0:N0}P each = {1:N0}P total" -f $cmp.bonus, ($recipients.Count * $cmp.bonus)) 'Gray'
    continue
  }

  $batchSize = 500
  $sent = 0; $failed = 0
  for ($i = 0; $i -lt $recipients.Count; $i += $batchSize) {
    $slice = $recipients[$i..([math]::Min($i + $batchSize - 1, $recipients.Count - 1))]
    $notif = @{}; $cust = @{}; $logUpd = @{}
    foreach ($r in $slice) {
      $notifId = "wb_${WeekKey}_${cohort}"
      $name = if ($r.data.name) { "$($r.data.name)" } else { 'Member' }
      # Pick the customer's saved language (fallback to en)
      $lang = if ($r.data.lang -and $cmp.title.ContainsKey([string]$r.data.lang)) { [string]$r.data.lang } else { 'en' }
      $title = ($cmp.title[$lang]) -replace '\{name\}', $name
      $body  = ($cmp.body[$lang])  -replace '\{name\}', $name
      $notif["$($r.key)/$notifId"] = @{
        id     = $notifId
        icon   = $cmp.icon
        title  = $title
        body   = $body
        link   = 'deals.html'
        ts     = $nowMs
        target = 'winback'
        cohort = $cohort
        lang   = $lang
      }
      # Win-back credits the BONUS bucket — Vela 'points' is POS-controlled and must not be touched
      $existingBonus = if ($r.data.bonusPoints) { [int]$r.data.bonusPoints } else { 0 }
      $cust["$($r.key)/bonusPoints"] = $existingBonus + $cmp.bonus
      $logUpd["$cohort/$($r.key)"] = $nowMs
    }

    try {
      $r1 = Invoke-RestMethod -Method Patch -Uri "$FbDb/rewards/notifications.json"        -Body ($notif   | ConvertTo-Json -Depth 4 -Compress) -ContentType 'application/json' -TimeoutSec 60
      $r2 = Invoke-RestMethod -Method Patch -Uri "$FbDb/rewards/customers.json"            -Body ($cust    | ConvertTo-Json -Depth 4 -Compress) -ContentType 'application/json' -TimeoutSec 60
      $r3 = Invoke-RestMethod -Method Patch -Uri "$FbDb/rewards/winback_log/$WeekKey.json" -Body ($logUpd  | ConvertTo-Json -Depth 4 -Compress) -ContentType 'application/json' -TimeoutSec 60
      $sent += $slice.Count
    } catch {
      $failed += $slice.Count
      Log "  Batch failed: $_" 'Red'
    }
  }
  Log ("  Cohort {0}: {1:N0} sent · {2:N0} failed · {3:N0}P credited" -f $cmp.label, $sent, $failed, ($sent * $cmp.bonus)) 'Green'
}

Log "==== Dormant campaign end ====" 'Cyan'
