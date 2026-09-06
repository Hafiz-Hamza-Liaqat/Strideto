[CmdletBinding()]
param(
  [string[]]$JobId = @(),
  [switch]$DryRun,
  [switch]$SelfTest,
  [string]$ApiBase = 'https://api.strideto.com/api',
  [string]$LogPath = 'qa-artifacts/strideto-production-activation-result-2026-09-06.json'
)

$ErrorActionPreference = 'Stop'
$ApiBase = $ApiBase.TrimEnd('/')

function Normalize-ActivationState {
  param([object]$Job)
  return [pscustomobject]@{
    status = [string]$Job.status
    approvalStatus = [string]$Job.approvalStatus
    launchEligible = ($Job.launchEligible -eq $true)
  }
}

function Test-ActivationReady {
  param([object]$Job)
  $state = Normalize-ActivationState $Job
  $issues = New-Object System.Collections.Generic.List[string]
  if ($state.status -ne 'draft') { $issues.Add("status must be draft (found '$($state.status)')") }
  if ($state.approvalStatus -ne 'pending') { $issues.Add("approvalStatus must be pending (found '$($state.approvalStatus)')") }
  if ($state.launchEligible) { $issues.Add('launchEligible must be false') }
  foreach ($field in @('sourceUrl', 'applicationLink')) {
    $value = [string]$Job.$field
    $uri = $null
    if (-not $value -or -not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('http', 'https')) {
      $issues.Add("$field must be an HTTP(S) URL")
    }
  }
  return [pscustomobject]@{ Ready = ($issues.Count -eq 0); Issues = @($issues) }
}

function Invoke-ActivationSelfTest {
  $ready = [pscustomobject]@{ status = 'draft'; approvalStatus = 'pending'; launchEligible = $false; sourceUrl = 'https://example.com/source'; applicationLink = 'https://example.com/app' }
  $notReady = [pscustomobject]@{ status = 'active'; approvalStatus = 'approved'; launchEligible = $true; sourceUrl = 'https://example.com/source'; applicationLink = 'https://example.com/app' }
  if (-not (Test-ActivationReady $ready).Ready) { throw 'Activation self-test expected a ready draft.' }
  if ((Test-ActivationReady $notReady).Ready) { throw 'Activation self-test expected an active job to be rejected.' }
  Write-Host 'Activation state-guard self-test: PASS'
}

if ($SelfTest) {
  Invoke-ActivationSelfTest
  return
}

if ($JobId.Count -lt 1) { throw 'Explicit -JobId values are required; implicit all-draft activation is not supported.' }
if ($JobId.Count -gt 20) { throw 'Activation batches are limited to 20 explicit job IDs.' }
$JobId = @($JobId | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($JobId.Count -lt 1) { throw 'At least one non-empty job ID is required.' }
if (@($JobId | Sort-Object -Unique).Count -ne $JobId.Count) { throw 'Duplicate job IDs were supplied.' }
foreach ($id in $JobId) {
  if ($id -notmatch '^[a-fA-F0-9]{24}$') { throw "Invalid Mongo job ID: $id" }
}

function Get-ErrorBody {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)
  try {
    $response = $ErrorRecord.Exception.Response
    if ($response) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
  } catch { }
  return [string]$ErrorRecord.Exception.Message
}

function Invoke-ActivationApi {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [ValidateSet('GET', 'POST')] [string]$Method = 'GET',
    [hashtable]$Headers = @{},
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
  )
  try {
    $response = Invoke-WebRequest -Uri "$ApiBase$Path" -Method $Method -Headers $Headers -WebSession $WebSession -UseBasicParsing
    $body = [string]$response.Content
    $parsed = if ([string]::IsNullOrWhiteSpace($body)) { $null } else { $body | ConvertFrom-Json }
    return [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Body = $parsed }
  } catch {
    $status = 0
    try { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } } catch { }
    throw "API $Method $Path failed with HTTP ${status}: $(Get-ErrorBody $_)"
  }
}

$email = Read-Host 'Production admin email'
$password = Read-Host 'Production admin password' -AsSecureString
$credential = New-Object System.Net.NetworkCredential('', $password)
$passwordText = $credential.Password
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{ Accept = 'application/json'; Origin = 'https://www.strideto.com'; Referer = 'https://www.strideto.com/' }
$results = New-Object System.Collections.Generic.List[object]

try {
  $login = Invoke-ActivationApi -Path '/auth/login' -Method POST -Headers $headers -WebSession $session
  $token = [string]$login.Body.accessToken
  if (-not $token) { throw 'Login response did not contain an access token.' }
  $headers.Authorization = "Bearer $token"

  $jobs = New-Object System.Collections.Generic.List[object]
  foreach ($id in $JobId) {
    $response = Invoke-ActivationApi -Path "/admin/jobs/$id" -Headers $headers -WebSession $session
    $job = if ($response.Body.job) { $response.Body.job } else { $response.Body }
    $check = Test-ActivationReady $job
    $jobs.Add([pscustomobject]@{ Id = $id; Job = $job; Check = $check })
    Write-Host "[$id] $([string]$job.title) | ready=$($check.Ready)"
  }

  $notReady = @($jobs | Where-Object { -not $_.Check.Ready })
  if ($notReady.Count -gt 0) {
    foreach ($row in $notReady) { Write-Host "NOT READY [$($row.Id)]: $($row.Check.Issues -join '; ')" }
    if ($DryRun) { Write-Host "DryRun: $($notReady.Count) not ready; activations=0"; return }
    throw 'Activation stopped before any write because one or more jobs were not ready.'
  }

  Write-Host "Activation candidates: $($jobs.Count)"
  Write-Host 'Target state: active / approved / launchEligible=true'
  if ($DryRun) { Write-Host 'DryRun: all candidates ready; activations=0'; return }
  if ((Read-Host 'Type ACTIVATE to continue') -cne 'ACTIVATE') { throw 'Activation aborted: confirmation was not ACTIVATE.' }

  foreach ($row in $jobs) {
    $response = Invoke-ActivationApi -Path "/admin/jobs/$($row.Id)/approve" -Method POST -Headers $headers -WebSession $session
    $readBackResponse = Invoke-ActivationApi -Path "/admin/jobs/$($row.Id)" -Headers $headers -WebSession $session
    $saved = if ($readBackResponse.Body.job) { $readBackResponse.Body.job } else { $readBackResponse.Body }
    $state = Normalize-ActivationState $saved
    if ($state.status -ne 'active' -or $state.approvalStatus -ne 'approved' -or -not $state.launchEligible) {
      throw "Critical activation validation failed for $($row.Id)."
    }
    $results.Add([pscustomobject]@{ jobId = $row.Id; title = [string]$saved.title; result = 'activated'; validation = 'passed'; timestamp = (Get-Date).ToUniversalTime().ToString('o') })
    $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding utf8
  }
  Write-Host "Activation complete. Result log: $LogPath"
} finally {
  $passwordText = $null
  $credential = $null
  $token = $null
}
