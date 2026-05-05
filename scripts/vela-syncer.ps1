# =============================================================
# KIMCHI MART — Vela Customer Syncer
# Run hourly via Windows Task Scheduler. Reads the latest Vela
# CustomerList CSV from $WatchFolder, normalizes phone + Excel
# armor, and PATCHes 5–60K customers to Firebase RTDB in chunks.
#
# Setup (once per store PC):
# 1. Save this file as C:\KimchiSync\vela-syncer.ps1
# 2. Edit $WatchFolder to point at where staff exports go
#    (default: the Downloads folder of the current user)
# 3. Open Task Scheduler → Create Basic Task →
#    - Name: "KIMCHI Vela Sync"
#    - Trigger: Daily, repeat every 1 hour for a duration of 1 day
#    - Action: powershell.exe
#      Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\KimchiSync\vela-syncer.ps1"
# 4. Run once manually to verify the first import.
#
# Logs go to $LogFile and to the host so you can `Get-Content -Wait`.
# =============================================================

$WatchFolder = Join-Path $env:USERPROFILE "Downloads"
$FilePattern = "CustomerList*.csv"
$FbDb        = "https://kimchi-mart-order-default-rtdb.firebaseio.com"
$BatchSize   = 500
$StateFile   = Join-Path $PSScriptRoot ".vela-syncer-state.json"
$LogFile     = Join-Path $PSScriptRoot "vela-syncer.log"

function Write-Log($msg, $color = 'Gray') {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $LogFile -Value $line
  Write-Host $line -ForegroundColor $color
}

function Get-State {
  if (Test-Path $StateFile) {
    try { return Get-Content $StateFile -Raw | ConvertFrom-Json } catch {}
  }
  return [PSCustomObject]@{ lastFile = ''; lastModified = 0; lastRunOk = $false }
}

function Save-State($state) {
  $state | ConvertTo-Json | Set-Content -Path $StateFile -Encoding utf8
}

function Strip-Armor($v) {
  if ($null -eq $v) { return '' }
  $s = "$v".Trim()
  $s = $s -replace '^="?', '' -replace '"$', ''
  return $s.Trim()
}

function Norm-Phone($raw) {
  if (-not $raw) { return $null }
  $d = ($raw -replace '\D','')
  if ($d.Length -eq 10) { return "+1$d" }
  if ($d.Length -eq 11 -and $d.StartsWith('1')) { return "+$d" }
  return $null
}

function Phone-Key($e164) { return ($e164 -replace '[^\d]','') }

# ---------- Main ----------
Write-Log "==== Vela syncer start ====" 'Cyan'

if (-not (Test-Path $WatchFolder)) {
  Write-Log "Watch folder not found: $WatchFolder" 'Red'
  exit 1
}

# Pick the most recent CSV that matches the pattern
$candidate = Get-ChildItem -Path $WatchFolder -Filter $FilePattern -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First 1

if (-not $candidate) {
  Write-Log "No file matching '$FilePattern' in $WatchFolder — nothing to do." 'Yellow'
  exit 0
}

$state = Get-State
if ($state.lastFile -eq $candidate.FullName -and $state.lastModified -eq $candidate.LastWriteTime.Ticks -and $state.lastRunOk) {
  Write-Log ("File unchanged since last successful sync ({0}). Skipping." -f $candidate.Name) 'Gray'
  exit 0
}

Write-Log ("Processing: {0} ({1:N0} bytes)" -f $candidate.Name, $candidate.Length) 'Cyan'

# Parse CSV
try {
  $rows = Import-Csv -Path $candidate.FullName
} catch {
  Write-Log "CSV parse failed: $_" 'Red'
  exit 1
}
Write-Log ("Loaded {0:N0} rows" -f $rows.Count)

if ($rows.Count -eq 0) { exit 0 }

# Detect columns (case-insensitive substring match)
$headers = $rows[0].PSObject.Properties.Name
function Find-Column($hints) {
  foreach ($h in $hints) {
    foreach ($col in $headers) {
      if ($col.ToLower().Contains($h.ToLower())) { return $col }
    }
  }
  return $null
}
$colPhone     = Find-Column @('phone mobile','phone','mobile')
$colName      = Find-Column @('firstname','first name','name')
$colPoints    = Find-Column @('point lifetime is wrong dont match','point')  # plain POINT
# Force POINT (current balance) to win:
$colPoints    = ($headers | Where-Object { $_ -ieq 'POINT' }) | Select-Object -First 1
if (-not $colPoints) { $colPoints = Find-Column @('point') }
$colLifetime  = Find-Column @('point lifetime','lifetime')
$colLastVisit = Find-Column @('last visited','last visit')
$colBirth     = Find-Column @('birthday','birth date','birthdate','dob')
$colGroup     = Find-Column @('group')

if (-not $colPhone -or -not $colPoints) {
  Write-Log "Required columns missing (phone or POINT). Headers: $($headers -join ', ')" 'Red'
  exit 1
}
Write-Log "Mapping: phone=$colPhone, name=$colName, points=$colPoints, lifetime=$colLifetime, group=$colGroup"

# Membership derive (mirror app.js deriveMembershipFromVela)
$nowMs    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$trialEnd = $nowMs + (365 * 86400000)
$threshold = 1000   # AUTO_TRIAL_POINTS_THRESHOLD

function Derive-Membership($vGroup, $lifetime) {
  $g = "$vGroup".ToUpper().Trim()
  if ($g -in 'MEMBERS','MEMBER','K1') {
    return @{ plan='k1'; grantType='paid'; activatedAt=$nowMs; expiresAt=$null }
  }
  if ($g -in 'BUSINESS OWNER','BUSINESS','K2','WHOLESALE') {
    return @{ plan='k2'; grantType='paid'; activatedAt=$nowMs; expiresAt=$null }
  }
  if ([double]$lifetime -ge $threshold) {
    return @{ plan='k1'; grantType='auto-trial'; activatedAt=$nowMs; expiresAt=$trialEnd }
  }
  return $null
}

# Build batch updates
$batch = @{}
$valid = 0; $skip = 0; $sent = 0; $failed = 0
$startTs = Get-Date

function Send-Batch {
  param($body)
  try {
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    Invoke-RestMethod -Method Patch -Uri "$FbDb/rewards/customers.json" -Body $json -ContentType 'application/json' -TimeoutSec 60 | Out-Null
    return $true
  } catch {
    Write-Log "PATCH failed: $_" 'Red'
    return $false
  }
}

foreach ($r in $rows) {
  $phone = Norm-Phone (Strip-Armor $r.$colPhone)
  if (-not $phone) { $skip++; continue }
  $valid++

  $key = Phone-Key $phone
  $points    = [int]([math]::Round([double](Strip-Armor $r.$colPoints)))
  $lifetime  = [double](Strip-Armor $r.$colLifetime)
  $name      = (Strip-Armor $r.$colName)
  if (-not $name) { $name = 'Member' }
  $velaGroup = Strip-Armor $r.$colGroup
  $mem       = Derive-Membership $velaGroup $lifetime

  $batch["$key/phone"]               = $phone
  $batch["$key/name"]                = $name
  $batch["$key/points"]              = $points
  $batch["$key/totalSpent_lifetime"] = $lifetime
  $batch["$key/velaGroup"]           = $velaGroup
  $batch["$key/membership"]          = $mem
  $batch["$key/importedAt"]          = $nowMs

  if ($colLastVisit -and $r.$colLastVisit) {
    $lvStr = Strip-Armor $r.$colLastVisit
    if ($lvStr -and $lvStr -notmatch '^0+\W0+') {
      try {
        $lv = ([DateTimeOffset]([DateTime]::Parse($lvStr))).ToUnixTimeMilliseconds()
        $batch["$key/lastVisit"] = $lv
      } catch {}
    }
  }

  if ($batch.Count -ge ($BatchSize * 6)) {
    if (Send-Batch $batch) { $sent += $BatchSize } else { $failed += $BatchSize }
    $batch = @{}
    if (($valid % 5000) -eq 0) {
      Write-Log ("  …{0:N0} processed" -f $valid)
    }
  }
}
if ($batch.Count -gt 0) {
  if (Send-Batch $batch) { $sent += [math]::Min($BatchSize, $valid - $sent) } else { $failed += 1 }
}

$elapsed = ((Get-Date) - $startTs).TotalSeconds
Write-Log ("Done: {0:N0} valid · {1:N0} skipped · in {2:N1}s" -f $valid, $skip, $elapsed) 'Green'

$state.lastFile     = $candidate.FullName
$state.lastModified = $candidate.LastWriteTime.Ticks
$state.lastRunOk    = ($failed -eq 0)
Save-State $state

Write-Log "==== Vela syncer end ====" 'Cyan'
