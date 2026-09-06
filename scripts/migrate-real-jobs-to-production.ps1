[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$FindProbe,
  [int]$PrepareBatch = 0,
  [string]$BatchFile = '',
  [string[]]$ExcludeExternalId = @(),
  [string]$ApiBase = 'https://api.strideto.com/api',
  [string]$BackupPath = 'qa-artifacts/strideto-production-migration-backup-2026-09-05.json',
  [string]$LogPath = 'qa-artifacts/strideto-production-migration-result-2026-09-05.json',
  [int]$WriteIntervalSeconds = 3,
  [string]$TestExternalId = '',
  [switch]$ValidateBatchOnly,
  [switch]$SelfTest,
  [string]$EligiblePath = 'qa-artifacts/strideto-production-migration-eligible-2026-09-05.json',
  [string]$ExclusionPath = 'qa-artifacts/strideto-production-migration-exclusions-2026-09-05.json'
)

$ErrorActionPreference = 'Stop'
$ApiBase = $ApiBase.TrimEnd('/')

if ($PrepareBatch -ne 0 -and $PrepareBatch -ne 10) {
  throw 'STRIDETO production batches are limited to exactly 10 jobs.'
}

function Get-ApiErrorBody {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)
  try {
    $response = $ErrorRecord.Exception.Response
    if ($response -and $response.GetResponseStream()) {
      $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
      try {
        $text = $reader.ReadToEnd()
        if ($text.Length -gt 2000) { return $text.Substring(0, 2000) }
        return $text
      } finally { $reader.Dispose() }
    }
  } catch { }
  $message = [string]$ErrorRecord.Exception.Message
  if ($message.Length -gt 2000) { return $message.Substring(0, 2000) }
  return $message
}

function Convert-ApiResponseBody {
  param([object]$Response)
  $content = [string]$Response.Content
  if ([string]::IsNullOrWhiteSpace($content)) { return $null }

  $contentType = ''
  try { $contentType = [string]$Response.Headers['Content-Type'] } catch { }
  $trimmed = $content.TrimStart()
  $looksJson = ($contentType -match 'json') -or $trimmed.StartsWith('{') -or $trimmed.StartsWith('[')
  if ($looksJson) {
    try { return ($content | ConvertFrom-Json) } catch { return $content }
  }
  return $content
}

function Test-JsonContentType {
  param([object]$Response)
  try { return ([string]$Response.Headers['Content-Type'] -match 'json') } catch { return $false }
}

function Read-JsonUtf8 {
  param([Parameter(Mandatory)] [string]$Path)
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.Encoding]::UTF8)
  return ($text | ConvertFrom-Json)
}

function Get-RecordCollection {
  param([object]$Data)
  if ($null -eq $Data) { return @() }
  if ($Data -is [System.Array]) {
    return @($Data | Where-Object { $null -ne $_ })
  }
  foreach ($propertyName in @('jobs', 'candidates', 'items', 'records')) {
    $property = $Data.PSObject.Properties[$propertyName]
    if ($property) {
      if ($null -eq $property.Value) { return @() }
      return @($property.Value | Where-Object { $null -ne $_ })
    }
  }
  return @($Data)
}

function Get-NextBatchArtifactNumber {
  param([string]$Directory = 'qa-artifacts')
  $highest = 0
  $files = @(Get-ChildItem -LiteralPath $Directory -Filter 'production-batch-*.json' -File -ErrorAction SilentlyContinue)
  foreach ($file in $files) {
    if ($file.Name -match '^production-batch-(\d+)\.json$') {
      $number = [int]$Matches[1]
      if ($number -gt $highest) { $highest = $number }
    }
  }
  $next = $highest + 1
  do {
    $suffix = ('{0:D3}' -f $next)
    $batchPath = Join-Path $Directory "production-batch-$suffix.json"
    $reportPath = Join-Path $Directory "production-batch-$suffix-report.json"
    if ((Test-Path -LiteralPath $batchPath) -or (Test-Path -LiteralPath $reportPath)) { $next++ } else { return [pscustomobject]@{ Number = $next; BatchPath = $batchPath; ReportPath = $reportPath } }
  } while ($true)
}

function Get-RetryAfterSeconds {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)
  try {
    $value = $ErrorRecord.Exception.Response.Headers['Retry-After']
    $seconds = 0
    if ([int]::TryParse([string]$value, [ref]$seconds) -and $seconds -gt 0) {
      return $seconds
    }
  } catch { }
  return 60
}

function Get-ApiRequestId {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)
  try {
    $headers = $ErrorRecord.Exception.Response.Headers
    foreach ($name in @('X-Request-Id', 'Request-Id', 'X-Correlation-Id')) {
      $value = [string]$headers[$name]
      if ($value) { return $value }
    }
  } catch { }
  return $null
}

function Invoke-ProductionApi {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [ValidateSet('GET', 'POST')] [string]$Method = 'GET',
    [object]$Body,
    [hashtable]$Headers = @{},
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession,
    [switch]$AllowUnauthorized
  )

  $uri = "$ApiBase$Path"
  $requestHeaders = @{} + $Headers
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      $params = @{
        Uri = $uri
        Method = $Method
        Headers = $requestHeaders
        WebSession = $WebSession
        UseBasicParsing = $true
      }
      if ($null -ne $Body) {
        $params.ContentType = 'application/json; charset=utf-8'
        $json = ($Body | ConvertTo-Json -Depth 30 -Compress)
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
      }
      $response = Invoke-WebRequest @params
      $parsed = Convert-ApiResponseBody $response
      return [pscustomobject]@{
        StatusCode = [int]$response.StatusCode
        ContentType = [string]$response.Headers['Content-Type']
        IsJson = (Test-JsonContentType $response) -or ($parsed -isnot [string] -and $null -ne $parsed)
        Body = $parsed
        Raw = [string]$response.Content
      }
    } catch {
      $statusCode = 0
      $requestId = Get-ApiRequestId $_
      try {
        if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
      } catch { $statusCode = 0 }
      if ($statusCode -eq 429 -and $attempt -lt 5) {
        $delay = Get-RetryAfterSeconds $_
        Write-Host "Rate limited for $Path; waiting $delay seconds before retry $($attempt + 1)/5."
        Start-Sleep -Seconds $delay
        continue
      }
      if ($AllowUnauthorized -and ($statusCode -eq 401 -or $statusCode -eq 403)) {
        return [pscustomobject]@{ StatusCode = $statusCode; ContentType = ''; IsJson = $false; Body = $null; Raw = (Get-ApiErrorBody $_) }
      }
      $requestSuffix = if ($requestId) { " requestId=$requestId" } else { '' }
      throw "API $Method $Path failed with HTTP ${statusCode}$requestSuffix`: $(Get-ApiErrorBody $_)"
    }
  }
  throw "API $Method $Path exhausted retries."
}

function Get-PropertyValue {
  param([object]$Object, [string]$Name)
  $property = $Object.PSObject.Properties[$Name]
  if ($property) { return $property.Value }
  return $null
}

function Normalize-Value {
  param([object]$Value)
  if ($null -eq $Value) { return '' }
  return ([string]$Value).Trim().ToLowerInvariant()
}

function Normalize-DuplicateText {
  param([object]$Value)
  if ($null -eq $Value) { return '' }
  $text = ([string]$Value).Normalize([System.Text.NormalizationForm]::FormKC).ToLowerInvariant()
  $text = $text -replace '[\u2010-\u2015\u2212]', '-'
  $text = $text -replace '[\u2018\u2019\u201A\u201B\u2032`]', "'"
  $text = $text -replace '[\u201C\u201D\u201E\u201F\u2033]', '"'
  $text = $text -replace '[\u00A0\t\r\n]+', ' '
  $text = $text -replace '\s*-\s*', ' '
  $text = $text -replace "'", ''
  $text = $text -replace '[\.,;:!?\(\)\[\]\{\}/"'']+', ' '
  return (($text -replace '\s+', ' ').Trim())
}

function Normalize-DuplicateSlug {
  param([object]$Value)
  $text = Normalize-DuplicateText $Value
  return (($text -replace '[^a-z0-9]+', '-') -replace '(^-|-$)', '')
}

function Get-DuplicateLocationKey {
  param([object]$Job)
  $city = Normalize-DuplicateText (Get-PropertyValue $Job 'city')
  if ($city) { return $city }
  $location = Normalize-DuplicateText (Get-PropertyValue $Job 'location')
  if ($location -match '^([^,]+)') { return $Matches[1].Trim() }
  return $location
}

function Normalize-EmploymentType {
  param([object]$Value)
  $normalized = (Normalize-Value $Value) -replace '[ _]', '-'
  switch ($normalized) {
    'full-time' { return 'full-time' }
    'part-time' { return 'part-time' }
    'contract' { return 'contract' }
    'internship' { return 'internship' }
    default { return $null }
  }
}

function Test-EqualField {
  param([object]$Expected, [object]$Actual, [string]$Field)
  if ($Field -eq 'type') {
    return (Normalize-EmploymentType $Expected) -eq (Normalize-EmploymentType $Actual)
  }
  if ($Field -in @('responsibilities', 'requirements', 'skillsRequired')) {
    $expectedItems = @($Expected) | ForEach-Object { ([string]$_).Replace("`r`n", "`n").Replace("`r", "`n").Trim() } | Where-Object { $_ }
    $actualItems = @($Actual) | ForEach-Object { ([string]$_).Replace("`r`n", "`n").Replace("`r", "`n").Trim() } | Where-Object { $_ }
    if ($Field -eq 'skillsRequired') {
      $expectedItems = @($expectedItems | ForEach-Object { $_.ToLowerInvariant() })
      $actualItems = @($actualItems | ForEach-Object { $_.ToLowerInvariant() })
    }
    return (@($expectedItems) -join "`n") -eq (@($actualItems) -join "`n")
  }
  return (Normalize-Value $Expected) -eq (Normalize-Value $Actual)
}

function Get-DuplicateReason {
  param([object]$Candidate, [object[]]$Existing)
  $externalId = Get-PropertyValue $Candidate 'externalId'
  $sourceUrl = Get-PropertyValue $Candidate 'sourceUrl'
  $applicationLink = Get-PropertyValue $Candidate 'applicationLink'
  $slug = Get-PropertyValue $Candidate 'slug'
  $company = Normalize-DuplicateText (Get-PropertyValue $Candidate 'company')
  $title = Normalize-DuplicateText (Get-PropertyValue $Candidate 'title')
  $location = Get-DuplicateLocationKey $Candidate
  foreach ($job in $Existing) {
    if ($externalId -and (Normalize-Value (Get-PropertyValue $job 'externalId')) -eq (Normalize-Value $externalId)) { return 'externalId' }
    if ($sourceUrl -and (Normalize-Value (Get-PropertyValue $job 'sourceUrl')) -eq (Normalize-Value $sourceUrl)) { return 'sourceUrl' }
    if ($applicationLink -and (Normalize-Value (Get-PropertyValue $job 'applicationLink')) -eq (Normalize-Value $applicationLink)) { return 'applicationLink' }
    if ($slug -and (Normalize-DuplicateSlug (Get-PropertyValue $job 'slug')) -eq (Normalize-DuplicateSlug $slug)) { return 'slug' }
    if ($company -and $title -and $location -eq (Get-DuplicateLocationKey $job) -and $company -eq (Normalize-DuplicateText (Get-PropertyValue $job 'company')) -and $title -eq (Normalize-DuplicateText (Get-PropertyValue $job 'title'))) { return 'company-title-location' }
  }
  return $null
}

function Invoke-DuplicateNormalizationSelfTest {
  $cases = @(
    [pscustomobject]@{ Name = 'repeated spaces'; Left = 'Senior Software Engineer'; Right = 'Senior  Software Engineer'; ShouldMatch = $true },
    [pscustomobject]@{ Name = 'dash variant'; Left = 'Manager - Operations'; Right = ('Manager ' + [char]0x2013 + ' Operations'); ShouldMatch = $true },
    [pscustomobject]@{ Name = 'quote variant'; Left = "Director's Office"; Right = ('Director' + [char]0x2019 + 's Office'); ShouldMatch = $true },
    [pscustomobject]@{ Name = 'distinct title'; Left = 'Senior Software Engineer'; Right = 'Senior Software Engineering Manager'; ShouldMatch = $false },
    [pscustomobject]@{ Name = 'distinct city'; Left = 'Dubai'; Right = 'Doha'; ShouldMatch = $false }
  )
  foreach ($case in $cases) {
    $matches = (Normalize-DuplicateText $case.Left) -eq (Normalize-DuplicateText $case.Right)
    if ($matches -ne $case.ShouldMatch) { throw "Duplicate normalization self-test failed: $($case.Name)." }
  }
  Write-Host 'Duplicate normalization self-test: PASS'
}

if ($SelfTest) {
  Invoke-DuplicateNormalizationSelfTest
  return
}

function Build-MigrationPayload {
  param([object]$Candidate)
  $payload = [ordered]@{}
  $supportedFields = @(
    'title','company','organization','location','countryCode','region','province','city',
    'category','jobFamily','specialization','type','jobType','educationRequirement',
    'experience','applyType','applicationLink','description','requirements',
    'salaryRange','salaryCurrency','openingsCount','benefits','locationEligibility',
    'skillsRequired','applicationInstructions','applyEmail','sourceUrl','sourceWebsite',
    'externalId','deadline','logoUrl','isFeatured','urgent','gallery','seoTitle',
    'metaDescription'
  )
  foreach ($field in $supportedFields) {
    $value = Get-PropertyValue $Candidate $field
    $include = $null -ne $value
    if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) { $include = $false }
    if ($value -is [System.Array] -and $value.Count -eq 0) { $include = $false }
    if ($include) { $payload[$field] = $value }
  }
  $employmentType = Normalize-EmploymentType (Get-PropertyValue $Candidate 'type')
  if ($employmentType) { $payload.type = $employmentType } else { $payload.Remove('type') }
  $candidateWorkMode = Normalize-Value (Get-PropertyValue $Candidate 'workMode')
  $canonicalWorkMode = $null
  switch ($candidateWorkMode) {
    'remote' { $canonicalWorkMode = 'remote' }
    'hybrid' { $canonicalWorkMode = 'hybrid' }
    'on-site' { $canonicalWorkMode = 'on_site' }
    'onsite' { $canonicalWorkMode = 'on_site' }
    'on_site' { $canonicalWorkMode = 'on_site' }
  }
  if ($canonicalWorkMode) { $payload.workMode = $canonicalWorkMode }
  else {
    $payload.Remove('workMode')
    $payload.Remove('remote')
    $payload.Remove('hybrid')
  }
  $payload.status = 'draft'
  $payload.approvalStatus = 'pending'
  $payload.launchEligible = $false
  return [pscustomobject]$payload
}

function Test-MigrationCandidate {
  param([object]$Candidate)
  $issues = [System.Collections.Generic.List[string]]::new()
  $payload = Build-MigrationPayload $Candidate
  if ([string]::IsNullOrWhiteSpace([string](Get-PropertyValue $payload 'title'))) { $issues.Add('title is required') }
  if ([string]::IsNullOrWhiteSpace([string](Get-PropertyValue $payload 'company'))) { $issues.Add('company is required') }
  $rawType = Get-PropertyValue $Candidate 'type'
  $employmentType = Normalize-EmploymentType $rawType
  if ($null -eq $employmentType) { $issues.Add('type is missing or unsupported') }
  if (@('Government','Private','Internship') -notcontains [string](Get-PropertyValue $payload 'jobType')) { $issues.Add('jobType is unsupported') }
  $mode = Get-PropertyValue $payload 'workMode'
  if ($null -ne $mode -and @('remote','hybrid','on_site') -notcontains [string]$mode) { $issues.Add('workMode is unsupported') }
  $countryCode = [string](Get-PropertyValue $payload 'countryCode')
  if ($countryCode -and $countryCode -notmatch '^[A-Za-z]{2}$') { $issues.Add('countryCode is not two letters') }
  foreach ($field in @('applicationLink','sourceUrl')) {
    $value = [string](Get-PropertyValue $payload $field)
    $uri = $null
    if (-not $value -or -not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('http','https')) { $issues.Add("$field is not an HTTP(S) URL") }
  }
  foreach ($field in @('requirements','responsibilities','skillsRequired','benefits','gallery')) {
    $value = Get-PropertyValue $payload $field
    # parseStringArray/normalizeJobSkills intentionally accept a single
    # string as well as an array; mirror that API contract locally.
    if ($null -ne $value -and $value -isnot [string] -and -not ($value -is [System.Array])) { $issues.Add("$field must be a string or array") }
    if ($null -ne $value -and $value -is [System.Array]) { foreach ($item in @($value)) { if ($item -isnot [string]) { $issues.Add("$field contains a non-string item"); break } } }
  }
  return [pscustomobject]@{ Payload = $payload; Issues = @($issues) }
}

function Test-MojibakeValue {
  param([object]$Value)
  if ($Value -is [string]) {
    return $Value.IndexOf([char]0x00E2) -ge 0 -or $Value.IndexOf([char]0x00C3) -ge 0 -or $Value.IndexOf([char]0x00C2) -ge 0
  }
  if ($Value -is [System.Array]) {
    foreach ($item in $Value) { if (Test-MojibakeValue $item) { return $true } }
  }
  return $false
}

function Test-MojibakeRecord {
  param([object]$Record)
  foreach ($property in $Record.PSObject.Properties) {
    if (Test-MojibakeValue $property.Value) { return $true }
  }
  return $false
}

function Get-AllProductionJobs {
  param([Microsoft.PowerShell.Commands.WebRequestSession]$WebSession, [hashtable]$Headers)
  $all = [System.Collections.Generic.List[object]]::new()
  $page = 1
  do {
    $result = Invoke-ProductionApi -Path "/admin/jobs?limit=100&page=$page" -WebSession $WebSession -Headers $Headers
    $rows = @($result.Body.data)
    foreach ($row in $rows) { $all.Add($row) }
    $totalPages = [int](Get-PropertyValue $result.Body.pagination 'totalPages')
    if ($totalPages -lt 1) { $totalPages = if ($rows.Count -gt 0) { $page } else { 0 } }
    $page++
  } while ($page -le $totalPages)
  return @($all)
}

if (-not (Test-Path -LiteralPath $BackupPath)) { throw "Backup file not found: $BackupPath" }
$backup = Read-JsonUtf8 -Path $BackupPath
$candidates = @($backup.jobs)
if ($candidates.Count -ne 257) { throw "Expected exactly 257 migration candidates; found $($candidates.Count)." }

$excludedIds = @('6a9bb7192c780e81b32b10c2', '6a9bbab02c780e81b32b157f')
if (@($candidates | Where-Object { $excludedIds -contains [string](Get-PropertyValue $_ '_id') }).Count -gt 0) {
  throw 'Backup contains an excluded closed/rejected job.'
}

$preflightFailures = [System.Collections.Generic.List[object]]::new()
$candidateIndex = 0
foreach ($candidate in $candidates) {
  $candidateIndex++
  $preflight = Test-MigrationCandidate $candidate
  if ($preflight.Issues.Count -gt 0) {
    $preflightFailures.Add([pscustomobject]@{
      index = $candidateIndex
      sourceCampaignId = [string](Get-PropertyValue $candidate '_id')
      title = [string](Get-PropertyValue $candidate 'title')
      company = [string](Get-PropertyValue $candidate 'company')
      issues = ($preflight.Issues -join '; ')
    })
  }
}
Write-Host "Local preflight: $($candidates.Count - $preflightFailures.Count) valid, $($preflightFailures.Count) invalid."
$eligibleCandidates = @($candidates | Where-Object {
  $check = Test-MigrationCandidate $_
  $check.Issues.Count -eq 0 -and -not (Test-MojibakeRecord $_)
})
$mojibakeRemediation = @($candidates | ForEach-Object {
  $candidate = $_
  $affectedFields = @($candidate.PSObject.Properties | Where-Object { Test-MojibakeValue $_.Value } | ForEach-Object { $_.Name })
  if ($affectedFields.Count -gt 0) {
    [pscustomobject]@{
      title = [string](Get-PropertyValue $candidate 'title')
      company = [string](Get-PropertyValue $candidate 'company')
      externalId = [string](Get-PropertyValue $candidate 'externalId')
      sourceUrl = [string](Get-PropertyValue $candidate 'sourceUrl')
      affectedFields = $affectedFields
      reason = 'Rehydrate from authoritative source; do not blind-replace characters.'
    }
  }
})
$exclusions = @($preflightFailures | ForEach-Object {
  [pscustomobject]@{
    index = $_.index
    sourceCampaignId = $_.sourceCampaignId
    title = $_.title
    company = $_.company
    externalId = [string](Get-PropertyValue ($candidates[$_.index - 1]) 'externalId')
    sourceUrl = [string](Get-PropertyValue ($candidates[$_.index - 1]) 'sourceUrl')
    reason = $_.issues
  }
})
$eligiblePayloads = @($eligibleCandidates | ForEach-Object { Build-MigrationPayload $_ })
$eligiblePayloads | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $EligiblePath -Encoding utf8
$exclusions | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ExclusionPath -Encoding utf8
if ($mojibakeRemediation.Count -gt 0) {
  $mojibakeRemediation | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath 'qa-artifacts/strideto-production-migration-mojibake-remediation-2026-09-05.json' -Encoding utf8
} else {
  '[]' | Set-Content -LiteralPath 'qa-artifacts/strideto-production-migration-mojibake-remediation-2026-09-05.json' -Encoding utf8
}
if ($preflightFailures.Count -gt 0) {
  if (-not $BatchFile) {
    $preflightFailures | ForEach-Object { Write-Host "INVALID [$($_.index)] $($_.title) | $($_.company) | $($_.issues)" }
  }
}
Write-Host "Eligible migration set: $($eligibleCandidates.Count) records ($EligiblePath)."
Write-Host "Exclusion report: $($exclusions.Count) records ($ExclusionPath)."

if ($eligibleCandidates.Count -ne ($candidates.Count - $preflightFailures.Count)) {
  throw 'Eligible set differs from preflight-valid set; refusing production access.'
}
$candidates = @($eligibleCandidates)
if (@($candidates | Where-Object { $preflight = Test-MigrationCandidate $_; $preflight.Issues.Count -gt 0 }).Count -gt 0) {
  throw 'Authoritative bulk candidate set contains an invalid record; refusing production access.'
}
Write-Host "Authoritative bulk candidate set: $($candidates.Count) records."

if ($BatchFile) {
  if (-not (Test-Path -LiteralPath $BatchFile)) { throw "Batch file not found: $BatchFile" }
  $batchData = Read-JsonUtf8 -Path $BatchFile
  $batchCandidates = @(Get-RecordCollection $batchData)
  Write-Host "Batch file type: $($batchData.GetType().FullName)"
  Write-Host "Batch record count: $($batchCandidates.Count)"
  if ($batchCandidates.Count -gt 0) {
    Write-Host "First candidate externalId: $([string](Get-PropertyValue $batchCandidates[0] 'externalId'))"
  }
  if ($batchCandidates.Count -lt 1 -or $batchCandidates.Count -gt 10) { throw "Batch file must contain between 1 and 10 candidates; found $($batchCandidates.Count)." }

  $eligibleExternalIds = @($eligibleCandidates | ForEach-Object { [string](Get-PropertyValue $_ 'externalId') })
  $outsideEligibleSet = [System.Collections.Generic.List[object]]::new()
  $batchFailures = [System.Collections.Generic.List[object]]::new()
  for ($batchIndex = 0; $batchIndex -lt $batchCandidates.Count; $batchIndex++) {
    $candidate = $batchCandidates[$batchIndex]
    if ($null -eq $candidate) {
      $batchFailures.Add([pscustomobject]@{ index = $batchIndex + 1; title = ''; company = ''; issues = 'record is null' })
      continue
    }
    $externalId = [string](Get-PropertyValue $candidate 'externalId')
    if (-not $externalId -or $eligibleExternalIds -notcontains $externalId) {
      $outsideEligibleSet.Add([pscustomobject]@{ index = $batchIndex + 1; externalId = $externalId })
    }
    $check = Test-MigrationCandidate $candidate
    if ($check.Issues.Count -gt 0) {
      $batchFailures.Add([pscustomobject]@{
        index = $batchIndex + 1
        title = [string](Get-PropertyValue $candidate 'title')
        company = [string](Get-PropertyValue $candidate 'company')
        issues = ($check.Issues -join '; ')
      })
    }
  }
  if ($outsideEligibleSet.Count -gt 0) { throw "Batch contains records outside the eligible migration set: $($outsideEligibleSet[0].externalId)" }
  if ($batchFailures.Count -gt 0) { throw "Batch preflight failed: $($batchFailures[0].title) | $($batchFailures[0].issues)" }
  $candidates = $batchCandidates
  Write-Host "Batch candidates: $($candidates.Count)"
  Write-Host 'Batch preflight valid: 10'
  Write-Host 'Batch preflight invalid: 0'
  if ($ValidateBatchOnly) {
    Write-Host 'Local batch validation complete. Production authentication/writes: 0'
    return
  }
}

if ($TestExternalId) {
  $selected = @($eligibleCandidates | Where-Object { [string](Get-PropertyValue $_ 'externalId') -eq $TestExternalId })
  if ($selected.Count -eq 0) {
    $selected = @($candidates | Where-Object { [string](Get-PropertyValue $_ 'externalId') -eq $TestExternalId })
  }
  if ($selected.Count -ne 1) { throw "TestExternalId '$TestExternalId' did not resolve to exactly one candidate." }
  $candidates = $selected
  Write-Host "Single-candidate mode: externalId=$TestExternalId. No other candidate can be written."
}

$email = Read-Host 'Production admin email'
$password = Read-Host 'Production admin password' -AsSecureString
$credential = [System.Net.NetworkCredential]::new('', $password)
$passwordText = $credential.Password
$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$headers = @{
  Accept = 'application/json'
  Origin = 'https://www.strideto.com'
  Referer = 'https://www.strideto.com/'
}

try {
  $unauthenticatedProbe = Invoke-ProductionApi -Path '/admin/jobs?limit=1&page=1' -WebSession ([Microsoft.PowerShell.Commands.WebRequestSession]::new()) -Headers $headers -AllowUnauthorized
  if ($unauthenticatedProbe.StatusCode -ne 401) {
    if ($unauthenticatedProbe.StatusCode -eq 200 -and -not $unauthenticatedProbe.IsJson) {
      throw "Unauthenticated admin probe returned HTTP 200 with non-JSON content ($($unauthenticatedProbe.ContentType)); refusing to treat an HTML/SPA fallback as API access."
    }
    throw "Unauthenticated admin probe returned HTTP $($unauthenticatedProbe.StatusCode), expected 401."
  }
  $login = Invoke-ProductionApi -Path '/auth/login' -Method POST -Body @{ email = $email; password = $passwordText } -WebSession $session -Headers $headers
  $accessToken = Get-PropertyValue $login.Body 'accessToken'
  if (-not $accessToken) { throw 'Login response did not contain an access token.' }
  $headers.Authorization = "Bearer $accessToken"
  $adminProbe = Invoke-ProductionApi -Path '/admin/jobs?limit=1&page=1' -WebSession $session -Headers $headers
  if ($adminProbe.StatusCode -ne 200) { throw "Authenticated admin probe returned HTTP $($adminProbe.StatusCode)." }

  $existing = Get-AllProductionJobs -WebSession $session -Headers $headers

  if ($PrepareBatch -gt 0) {
    $failedUaeId = 'f9fc6940-17a8-466e-a0bd-51e9e571ef8f'
    $selected = [System.Collections.Generic.List[object]]::new()
    $report = [System.Collections.Generic.List[object]]::new()
    foreach ($candidate in $eligibleCandidates) {
      if ($selected.Count -ge $PrepareBatch) { break }
      $externalId = [string](Get-PropertyValue $candidate 'externalId')
      if ($externalId -eq $failedUaeId) { continue }
      $reason = Get-DuplicateReason -Candidate $candidate -Existing $existing
      if ($reason) { continue }
      $selected.Add($candidate)
      $report.Add([pscustomobject]@{
        title = $candidate.title; company = $candidate.company; externalId = $externalId
        duplicateCheck = 'not-duplicate'; sourceUrl = $candidate.sourceUrl; type = $candidate.type
        jobType = $candidate.jobType; workMode = $candidate.workMode
        targetStatus = 'draft'; targetApprovalStatus = 'pending'; targetLaunchEligible = $false
      })
    }
    if ($selected.Count -lt 1) { throw 'No safe non-duplicate candidates remain for a final batch.' }
    $batchArtifact = Get-NextBatchArtifactNumber
    @($selected | ForEach-Object { Build-MigrationPayload $_ }) | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $batchArtifact.BatchPath -Encoding utf8
    @($report) | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $batchArtifact.ReportPath -Encoding utf8
    $batchKind = if ($selected.Count -lt $PrepareBatch) { 'final partial batch' } else { 'batch' }
    Write-Host "Prepared ${batchKind}: $($selected.Count) records. Batch number: $($batchArtifact.Number). Production writes: 0"
    Write-Host "Batch artifact: $($batchArtifact.BatchPath)"
    Write-Host "Batch report: $($batchArtifact.ReportPath)"
    return
  }

  if ($FindProbe) {
    $checked = 0
    $duplicates = 0
    $excluded = 0
    foreach ($candidate in $eligibleCandidates) {
      $checked++
      if ($ExcludeExternalId -contains [string](Get-PropertyValue $candidate 'externalId')) {
        $excluded++
        continue
      }
      $reason = Get-DuplicateReason -Candidate $candidate -Existing $existing
      if ($reason) {
        $duplicates++
        continue
      }
      Write-Host "FIRST NON-DUPLICATE PROBE"
      Write-Host "Checked: $checked"
      Write-Host "Duplicates encountered: $duplicates"
      Write-Host "Excluded: $excluded"
      Write-Host "Title: $($candidate.title)"
      Write-Host "Company: $($candidate.company)"
      Write-Host "External ID: $([string](Get-PropertyValue $candidate 'externalId'))"
      Write-Host "Country code: $([string](Get-PropertyValue $candidate 'countryCode'))"
      Write-Host "Production duplicate: NO"
      Write-Host 'Production writes: 0'
      return
    }
    Write-Host "No non-duplicate candidate found after checking $checked eligible records."
    Write-Host "Duplicates encountered: $duplicates"
    Write-Host "Excluded: $excluded"
    Write-Host 'Production writes: 0'
    return
  }

  $duplicateCount = 0
  $planned = [System.Collections.Generic.List[object]]::new()
  foreach ($candidate in $candidates) {
    $reason = Get-DuplicateReason -Candidate $candidate -Existing $existing
    if ($reason) {
      $duplicateCount++
    } else {
      $planned.Add($candidate)
    }
  }

  $results = [System.Collections.Generic.List[object]]::new()
  foreach ($candidate in $candidates) {
    $reason = Get-DuplicateReason -Candidate $candidate -Existing $existing
    if ($reason) {
      $results.Add([pscustomobject]@{ sourceCampaignId = [string](Get-PropertyValue $candidate '_id'); productionJobId = $null; title = $candidate.title; company = $candidate.company; result = 'duplicate-skipped'; duplicateReason = $reason; validation = 'not-applicable'; timestamp = (Get-Date).ToUniversalTime().ToString('o') })
    }
  }

  Write-Host "PRODUCTION MIGRATION"
  Write-Host "Candidates: $($candidates.Count)"
  Write-Host "Duplicates: $duplicateCount"
  Write-Host "Ready to insert: $($planned.Count)"
  Write-Host 'Target state: draft / pending / launchEligible=false'

  if ($DryRun) {
    if ($BatchFile) { Write-Host 'Batch DryRun: zero production writes performed.' }
    else { Write-Host 'DRY RUN: zero production writes performed.' }
    return
  }

  $confirmation = Read-Host 'Type MIGRATE to continue'
  if ($confirmation -cne 'MIGRATE') { throw 'Migration aborted: confirmation was not MIGRATE.' }

  $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding utf8
  foreach ($candidate in $planned) {
    $duplicateReason = Get-DuplicateReason -Candidate $candidate -Existing $existing
    if ($duplicateReason) {
      $results.Add([pscustomobject]@{ sourceCampaignId = [string](Get-PropertyValue $candidate '_id'); productionJobId = $null; title = $candidate.title; company = $candidate.company; result = 'duplicate-skipped'; duplicateReason = $duplicateReason; validation = 'not-applicable'; timestamp = (Get-Date).ToUniversalTime().ToString('o') })
      continue
    }

    $candidatePosition = [array]::IndexOf($candidates, $candidate) + 1
    Write-Host "Migrating [$candidatePosition/$($candidates.Count)]: $($candidate.title) | $($candidate.company) | $([string](Get-PropertyValue $candidate 'externalId'))"
    $payload = Build-MigrationPayload $candidate

    $createdResponse = Invoke-ProductionApi -Path '/admin/jobs' -Method POST -Body $payload -WebSession $session -Headers $headers
    $created = if ($createdResponse.Body.job) { $createdResponse.Body.job } else { $createdResponse.Body }
    $productionId = [string](Get-PropertyValue $created '_id')
    if (-not $productionId) { throw "Create response did not contain an ID for $($candidate.title)." }
    $savedResponse = Invoke-ProductionApi -Path "/admin/jobs/$productionId" -WebSession $session -Headers $headers
    $saved = $savedResponse.Body.job
    if (-not $saved) { $saved = $savedResponse.Body }

    $fields = if ($BatchFile) {
      @('title','company','country','countryCode','region','city','sourceUrl','applicationLink','externalId','status','approvalStatus','launchEligible')
    } else {
      @('title','company','country','countryCode','region','city','workMode','description','responsibilities','requirements','skillsRequired','sourceUrl','applicationLink','externalId','slug','seoTitle','metaDescription','type','jobType','status','approvalStatus','launchEligible')
    }
    $mismatches = @($fields | Where-Object { -not (Test-EqualField (Get-PropertyValue $candidate $_) (Get-PropertyValue $saved $_) $_) })
    if ($mismatches.Count -gt 0) {
      throw "Round-trip validation failed for $($candidate.title) [$productionId]: $($mismatches -join ', ')"
    }
    $existing += $saved
    $results.Add([pscustomobject]@{ sourceCampaignId = [string](Get-PropertyValue $candidate '_id'); productionJobId = $productionId; title = $candidate.title; company = $candidate.company; result = 'inserted'; duplicateReason = $null; validation = 'passed'; timestamp = (Get-Date).ToUniversalTime().ToString('o') })
    $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding utf8
    Start-Sleep -Seconds ([Math]::Max(1, $WriteIntervalSeconds))
  }
  $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding utf8
  Write-Host "Migration complete. Result log: $LogPath"
} finally {
  $passwordText = $null
  $credential = $null
  $accessToken = $null
  $headers.Authorization = $null
}
