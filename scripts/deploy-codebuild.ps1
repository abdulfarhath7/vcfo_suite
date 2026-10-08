<#
.SYNOPSIS
  Build the production image in AWS CodeBuild and push it to ECR.

.DESCRIPTION
  The normal deploy is `docker build` + `docker push` from a workstation
  (infra/README.md). That needs a working Docker daemon, which needs hardware
  virtualisation — not available on every machine. This does the identical
  build inside AWS instead:

      source (zip) -> S3 -> CodeBuild (docker build) -> ECR :latest -> App Runner

  App Runner has auto_deployments_enabled on the `latest` tag (infra/app.tf),
  so the push is the deploy. No Terraform apply is needed for a code change.

  Idempotent: creates the bucket, role and project on first run, reuses them
  afterwards. Re-run it for every subsequent deploy.

.PARAMETER Profile
  AWS CLI profile. Default 'vcfo'.

.PARAMETER NoWait
  Start the build and return immediately instead of streaming to completion.

.EXAMPLE
  pwsh scripts/deploy-codebuild.ps1
#>
[CmdletBinding()]
param(
  [string]$Profile = 'vcfo',
  [string]$Region  = 'ap-south-1',
  [string]$Project = 'vcfo-suite',
  [switch]$NoWait
)

$ErrorActionPreference = 'Stop'

$AwsExe = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
if (-not (Test-Path $AwsExe)) {
  $cmd = Get-Command aws -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "AWS CLI not found. Install it: winget install Amazon.AWSCLI" }
  $AwsExe = $cmd.Source
}

function Aws {
  $out = & $AwsExe @args 2>&1
  $code = $LASTEXITCODE
  return [pscustomobject]@{ Ok = ($code -eq 0); Out = ($out -join "`n"); Code = $code }
}
function AwsOrThrow {
  $r = Aws @args
  if (-not $r.Ok) { throw "aws $($args -join ' ')`n$($r.Out)" }
  return $r.Out
}
function Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }

# The repo root is this script's parent's parent.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {

  # ── 0. Identity ───────────────────────────────────────────────────────────
  Step "Checking credentials (profile: $Profile)"
  $idJson = AwsOrThrow sts get-caller-identity --profile $Profile --output json
  $id = $idJson | ConvertFrom-Json
  $AccountId = $id.Account
  Write-Host "   account $AccountId as $($id.Arn)"

  $Registry   = "$AccountId.dkr.ecr.$Region.amazonaws.com"
  $Bucket     = "$Project-codebuild-src-$AccountId"
  $RoleName   = "$Project-codebuild-role"
  $PolicyName = "$Project-codebuild-policy"
  $BuildName  = "$Project-image-build"
  $SrcKey     = 'source.zip'

  # ── 1. ECR repository ─────────────────────────────────────────────────────
  Step "ECR repository '$Project'"
  $r = Aws ecr describe-repositories --repository-names $Project --region $Region --profile $Profile --output json
  if ($r.Ok) { Write-Host "   exists" }
  else {
    AwsOrThrow ecr create-repository --repository-name $Project --region $Region --profile $Profile --output json | Out-Null
    Write-Host "   created"
  }

  # ── 2. Source bucket ──────────────────────────────────────────────────────
  Step "S3 source bucket '$Bucket'"
  $r = Aws s3api head-bucket --bucket $Bucket --region $Region --profile $Profile
  if ($r.Ok) { Write-Host "   exists" }
  else {
    AwsOrThrow s3api create-bucket --bucket $Bucket --region $Region --profile $Profile `
      --create-bucket-configuration "LocationConstraint=$Region" | Out-Null
    AwsOrThrow s3api put-public-access-block --bucket $Bucket --profile $Profile `
      --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" | Out-Null
    AwsOrThrow s3api put-bucket-encryption --bucket $Bucket --profile $Profile `
      --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}' | Out-Null
    Write-Host "   created (private, encrypted)"
  }

  # ── 3. IAM role ───────────────────────────────────────────────────────────
  Step "IAM role '$RoleName'"
  $trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  $trustFile = Join-Path ([IO.Path]::GetTempPath()) 'vcfo-cb-trust.json'
  [IO.File]::WriteAllText($trustFile, $trust)

  $r = Aws iam get-role --role-name $RoleName --profile $Profile --output json
  if ($r.Ok) { Write-Host "   exists" }
  else {
    AwsOrThrow iam create-role --role-name $RoleName --profile $Profile `
      --assume-role-policy-document "file://$trustFile" `
      --description "Builds the $Project container image and pushes it to ECR" --output json | Out-Null
    Write-Host "   created"
  }

  # Least privilege: push to this one repo, read this one bucket, write logs.
  $policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "EcrAuth",  "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    { "Sid": "EcrPush",  "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage"],
      "Resource": "arn:aws:ecr:${Region}:${AccountId}:repository/${Project}" },
    { "Sid": "ReadSource", "Effect": "Allow",
      "Action": ["s3:GetObject","s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::${Bucket}/*" },
    { "Sid": "Logs", "Effect": "Allow",
      "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${Region}:${AccountId}:log-group:/aws/codebuild/${BuildName}*" }
  ]
}
"@
  $policyFile = Join-Path ([IO.Path]::GetTempPath()) 'vcfo-cb-policy.json'
  [IO.File]::WriteAllText($policyFile, $policy)
  AwsOrThrow iam put-role-policy --role-name $RoleName --policy-name $PolicyName `
    --policy-document "file://$policyFile" --profile $Profile | Out-Null
  Write-Host "   inline policy applied"
  $RoleArn = "arn:aws:iam::${AccountId}:role/${RoleName}"

  # ── 4. Package source ─────────────────────────────────────────────────────
  Step "Packaging source"
  $zip = Join-Path ([IO.Path]::GetTempPath()) "$Project-src.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }

  # Excludes matter twice over: node_modules/.next would make the upload huge,
  # and .env.local holds live secrets that must never reach S3. (.dockerignore
  # keeps them out of the IMAGE; this keeps them out of the ARCHIVE.)
  $exclude = @(
    'node_modules','.next','.git','.env.local','.env.production',
    'tsconfig.tsbuildinfo','.claude','playwright-report','test-results',
    'coverage','.turbo','.playwright-mcp'
  )
  $tarArgs = @('-a','-c','-f',$zip)
  foreach ($e in $exclude) { $tarArgs += "--exclude=$e" }
  $tarArgs += '.'
  & tar.exe @tarArgs
  if ($LASTEXITCODE -ne 0) { throw "tar failed packaging the source" }

  $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
  Write-Host "   $zip  ($mb MB)"
  if ($mb -gt 200) { Write-Warning "Archive is large ($mb MB) — check the exclude list." }

  Step "Uploading to s3://$Bucket/$SrcKey"
  AwsOrThrow s3 cp $zip "s3://$Bucket/$SrcKey" --region $Region --profile $Profile | Out-Null
  Write-Host "   uploaded"

  # ── 5. CodeBuild project ──────────────────────────────────────────────────
  Step "CodeBuild project '$BuildName'"
  $envJson = @"
{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_MEDIUM",
  "privilegedMode": true,
  "environmentVariables": [
    { "name": "ACCOUNT_ID", "value": "$AccountId" }
  ]
}
"@
  $srcJson = @"
{ "type": "S3", "location": "$Bucket/$SrcKey", "buildspec": "buildspec.yml" }
"@
  $envFile = Join-Path ([IO.Path]::GetTempPath()) 'vcfo-cb-env.json'
  $srcFile = Join-Path ([IO.Path]::GetTempPath()) 'vcfo-cb-src.json'
  [IO.File]::WriteAllText($envFile, $envJson)
  [IO.File]::WriteAllText($srcFile, $srcJson)

  $r = Aws codebuild batch-get-projects --names $BuildName --region $Region --profile $Profile --output json
  $exists = $r.Ok -and (($r.Out | ConvertFrom-Json).projects.Count -gt 0)
  $verb = if ($exists) { 'update-project' } else { 'create-project' }
  AwsOrThrow codebuild $verb --name $BuildName --region $Region --profile $Profile `
    --source "file://$srcFile" --environment "file://$envFile" `
    --service-role $RoleArn --artifacts '{\"type\":\"NO_ARTIFACTS\"}' `
    --timeout-in-minutes 40 --output json | Out-Null
  Write-Host "   $(if ($exists) { 'updated' } else { 'created' })"

  # IAM is eventually consistent; a brand-new role can fail the first start.
  if (-not $exists) { Write-Host "   waiting 15s for the new role to propagate"; Start-Sleep -Seconds 15 }

  # ── 6. Build ──────────────────────────────────────────────────────────────
  Step "Starting build"
  $start = AwsOrThrow codebuild start-build --project-name $BuildName --region $Region --profile $Profile --output json
  $BuildId = ($start | ConvertFrom-Json).build.id
  Write-Host "   $BuildId"
  Write-Host "   console: https://$Region.console.aws.amazon.com/codesuite/codebuild/$AccountId/projects/$BuildName/build/$([uri]::EscapeDataString($BuildId))"

  if ($NoWait) { Write-Host "`nStarted. Re-run with no -NoWait to follow it." -ForegroundColor Yellow; return }

  Step "Waiting for the build (first run is slow — npm ci + next build)"
  $last = ''
  while ($true) {
    Start-Sleep -Seconds 15
    $bJson = AwsOrThrow codebuild batch-get-builds --ids $BuildId --region $Region --profile $Profile --output json
    $b = ($bJson | ConvertFrom-Json).builds[0]
    if ($b.currentPhase -ne $last) { Write-Host "   phase: $($b.currentPhase)"; $last = $b.currentPhase }
    if ($b.buildStatus -ne 'IN_PROGRESS') {
      Write-Host "`n   result: $($b.buildStatus)" -ForegroundColor $(if ($b.buildStatus -eq 'SUCCEEDED') { 'Green' } else { 'Red' })
      if ($b.buildStatus -ne 'SUCCEEDED') {
        Write-Host "   logs: $($b.logs.deepLink)"
        foreach ($p in $b.phases) {
          if ($p.phaseStatus -and $p.phaseStatus -ne 'SUCCEEDED') {
            Write-Host "   FAILED PHASE $($p.phaseType): $($p.phaseStatus)" -ForegroundColor Red
            foreach ($c in $p.contexts) { Write-Host "     $($c.message)" -ForegroundColor Red }
          }
        }
        throw "CodeBuild did not succeed."
      }
      break
    }
  }

  # ── 7. App Runner ─────────────────────────────────────────────────────────
  Step "App Runner"
  $svcJson = AwsOrThrow apprunner list-services --region $Region --profile $Profile --output json
  $svc = ($svcJson | ConvertFrom-Json).ServiceSummaryList | Where-Object { $_.ServiceName -eq $Project }
  if (-not $svc) {
    Write-Warning "No App Runner service named '$Project'. The image is in ECR; deploy it however the service is wired."
  } else {
    Write-Host "   $($svc.ServiceName) is $($svc.Status) at https://$($svc.ServiceUrl)"
    Write-Host "   auto_deployments is on for :latest — the push above triggers a rollout."
    Write-Host "   watch it:  aws apprunner list-operations --service-arn $($svc.ServiceArn) --region $Region --profile $Profile"
  }

  Write-Host "`nDone. Image pushed to $Registry/${Project}:latest" -ForegroundColor Green

} finally {
  Pop-Location
}
