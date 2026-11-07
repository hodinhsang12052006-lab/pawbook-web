<#
.SYNOPSIS
  Build the signed PawNail Android release bundle (AAB) for Google Play.

.DESCRIPTION
  For the OWNER's machine. Run from anywhere:

      powershell -ExecutionPolicy Bypass -File scripts\android\build-release.ps1

  What it does:
    1. Checks android\app\google-services.json exists, is for package com.bitpawos.app and
       is NOT tracked by git (the repo is public).
    2. Runs "npx cap sync android" so android\app\src\main\assets\capacitor.plugins.json is
       fresh (a stale list that still names removed plugins makes Capacitor load NO plugins,
       and push notifications would report "unsupported"). Skip with -SkipSync.
    3. Signing: if android\keystore.properties exists Gradle uses it as before. Otherwise asks
       for the keystore password (hidden input) and passes keystore file / alias / passwords
       to Gradle ONLY through environment variables of this PowerShell process
       (PAWNAIL_KEYSTORE_FILE, PAWNAIL_KEYSTORE_PASSWORD, PAWNAIL_KEY_ALIAS,
       PAWNAIL_KEY_PASSWORD), removed again when the script ends. Nothing is written to disk.
    4. Uses a JDK 21 (Gradle toolchain / Android Studio JBR / JAVA_HOME) and the
       "Unable to establish loopback connection" workaround (-Djdk.net.unixdomain.tmpdir).
    5. Runs gradlew :app:bundleRelease without a lingering daemon, then prints the AAB path,
       size and the signing certificate fingerprints (compare SHA-1 with Play Console >
       Test and release > App integrity > Upload key certificate).

.PARAMETER Keystore
  Path of the upload keystore (.keystore / .jks). Default: storeFile from
  android\keystore.properties.example (relative to android\app), else the only keystore
  found in C:\buildtools\release_keystore, else you are asked.

.PARAMETER KeyAlias
  Key alias. Default: keyAlias from android\keystore.properties.example ("pawos").

.PARAMETER SeparateKeyPassword
  Ask for a key password different from the keystore password.

.PARAMETER SkipSync
  Do not run "npx cap sync android".
#>
[CmdletBinding()]
param(
    [string]$Keystore = "",
    [string]$KeyAlias = "",
    [switch]$SeparateKeyPassword,
    [switch]$SkipSync
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$AndroidDir = Join-Path $RepoRoot "android"
$AppDir = Join-Path $AndroidDir "app"
$PackageName = "com.bitpawos.app"
$LoopbackTmp = "C:/buildtools/jtmp"
$EnvNames = @("PAWNAIL_KEYSTORE_FILE", "PAWNAIL_KEYSTORE_PASSWORD", "PAWNAIL_KEY_ALIAS", "PAWNAIL_KEY_PASSWORD")

function Fail([string]$msg) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

function Read-PropertiesValue([string]$file, [string]$key) {
    if (-not (Test-Path $file)) { return "" }
    foreach ($line in Get-Content -LiteralPath $file) {
        $t = $line.Trim()
        if ($t.StartsWith("#") -or -not $t.Contains("=")) { continue }
        $i = $t.IndexOf("=")
        if ($t.Substring(0, $i).Trim() -eq $key) { return $t.Substring($i + 1).Trim() }
    }
    return ""
}

function Get-JavaMajor([string]$javaHome) {
    $release = Join-Path $javaHome "release"
    if (-not (Test-Path $release)) { return 0 }
    $m = Select-String -LiteralPath $release -Pattern 'JAVA_VERSION="(\d+)' | Select-Object -First 1
    if ($m) { return [int]$m.Matches[0].Groups[1].Value }
    return 0
}

function Find-Jdk21 {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
    $gradleJdks = Join-Path $env:USERPROFILE ".gradle\jdks"
    if (Test-Path $gradleJdks) {
        $candidates += (Get-ChildItem -LiteralPath $gradleJdks -Directory | Where-Object { $_.Name -match "21" } | ForEach-Object { $_.FullName })
    }
    $candidates += "C:\Program Files\Android\Android Studio\jbr"
    foreach ($root in @("C:\Program Files\Eclipse Adoptium", "C:\Program Files\Java", "C:\Program Files\Microsoft")) {
        if (Test-Path $root) {
            $candidates += (Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -match "21" } | ForEach-Object { $_.FullName })
        }
    }
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "bin\java.exe")) -and ((Get-JavaMajor $c) -eq 21)) { return $c }
    }
    return $null
}

function SecureToPlain([System.Security.SecureString]$s) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host "PawNail Android release build" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

# --- 1. Firebase config -------------------------------------------------------------------
$gsj = Join-Path $AppDir "google-services.json"
if (-not (Test-Path $gsj)) {
    Fail "android\app\google-services.json is missing. Firebase Console > Project settings > Your apps > Android app '$PackageName' > download google-services.json into android\app\ (never commit it)."
}
try { $json = Get-Content -LiteralPath $gsj -Raw | ConvertFrom-Json } catch { Fail "android\app\google-services.json is not valid JSON." }
$packages = @($json.client | ForEach-Object { $_.client_info.android_client_info.package_name })
if (-not ($packages -contains $PackageName)) {
    Fail "google-services.json is for '$($packages -join ', ')', not '$PackageName'. Download the file of the Android app registered as $PackageName."
}
Push-Location $RepoRoot
try {
    # Prints the path only when the file is tracked; never writes to stderr.
    $tracked = [bool](& git ls-files -- "android/app/google-services.json")
} catch { $tracked = $false } finally { Pop-Location }
if ($tracked) {
    Fail "android/app/google-services.json is tracked by git and the repo is PUBLIC. Run: git rm --cached android/app/google-services.json  then commit, before building."
}
Write-Host "OK  google-services.json for $PackageName (gitignored)" -ForegroundColor Green

# --- 2. Capacitor sync ----------------------------------------------------------------------
if (-not $SkipSync) {
    Write-Host "Running npx cap sync android ..."
    Push-Location $RepoRoot
    try {
        & npx cap sync android
        if ($LASTEXITCODE -ne 0) { Fail "npx cap sync android failed." }
    } finally { Pop-Location }
}
$pluginsJson = Join-Path $AppDir "src\main\assets\capacitor.plugins.json"
if (-not (Test-Path $pluginsJson)) { Fail "capacitor.plugins.json missing: run npx cap sync android." }
$plugins = Get-Content -LiteralPath $pluginsJson -Raw
if ($plugins -notmatch "@capacitor/push-notifications") { Fail "capacitor.plugins.json does not list @capacitor/push-notifications: run npx cap sync android." }
foreach ($stale in @("@capacitor/camera", "@capacitor/geolocation")) {
    if ($plugins -match [regex]::Escape($stale)) { Fail "capacitor.plugins.json still lists $stale (removed plugin, Capacitor would load NO plugins): run npx cap sync android." }
}
Write-Host "OK  capacitor.plugins.json" -ForegroundColor Green

$gradleFile = Get-Content -LiteralPath (Join-Path $AppDir "build.gradle") -Raw
$vc = [regex]::Match($gradleFile, "versionCode\s+(\d+)").Groups[1].Value
$vn = [regex]::Match($gradleFile, 'versionName\s+"([^"]+)"').Groups[1].Value
Write-Host "Version: versionCode $vc, versionName $vn (must be higher than every bundle already uploaded to Play)"

# --- 3. JDK 21 + SDK ------------------------------------------------------------------------
$jdk = Find-Jdk21
if (-not $jdk) { Fail "No JDK 21 found. Install Temurin 21 or open the project once in Android Studio (its JBR is JDK 21)." }
Write-Host "OK  JDK 21: $jdk" -ForegroundColor Green

$saved = @{
    JAVA_HOME = $env:JAVA_HOME
    JAVA_TOOL_OPTIONS = $env:JAVA_TOOL_OPTIONS
    GRADLE_OPTS = $env:GRADLE_OPTS
    ANDROID_HOME = $env:ANDROID_HOME
}

$aab = Join-Path $AppDir "build\outputs\bundle\release\app-release.aab"
$exitCode = 1
try {
    $env:JAVA_HOME = $jdk
    New-Item -ItemType Directory -Force -Path $LoopbackTmp | Out-Null
    $loop = "-Djdk.net.unixdomain.tmpdir=$LoopbackTmp"
    if ($env:JAVA_TOOL_OPTIONS) { $env:JAVA_TOOL_OPTIONS = "$($env:JAVA_TOOL_OPTIONS) $loop" } else { $env:JAVA_TOOL_OPTIONS = $loop }
    if ($env:GRADLE_OPTS) { $env:GRADLE_OPTS = "$($env:GRADLE_OPTS) $loop" } else { $env:GRADLE_OPTS = $loop }
    if (-not $env:ANDROID_HOME -and -not (Test-Path (Join-Path $AndroidDir "local.properties")) -and (Test-Path "C:\AndroidSdk")) {
        $env:ANDROID_HOME = "C:\AndroidSdk"
    }

    # --- 4. Signing ---------------------------------------------------------------------------
    $propsFile = Join-Path $AndroidDir "keystore.properties"
    $example = Join-Path $AndroidDir "keystore.properties.example"
    if (Test-Path $propsFile) {
        Write-Host "OK  signing with android\keystore.properties" -ForegroundColor Green
    } else {
        if (-not $Keystore) { $Keystore = $env:PAWNAIL_KEYSTORE_FILE }
        if (-not $Keystore) {
            $fromExample = Read-PropertiesValue $example "storeFile"
            if ($fromExample) {
                $p = Join-Path $AppDir $fromExample
                if (Test-Path $p) { $Keystore = $p }
            }
        }
        if (-not $Keystore -and (Test-Path "C:\buildtools\release_keystore")) {
            $found = @(Get-ChildItem -LiteralPath "C:\buildtools\release_keystore" -File | Where-Object { $_.Extension -in @(".keystore", ".jks") })
            if ($found.Count -eq 1) { $Keystore = $found[0].FullName }
        }
        if (-not $Keystore) { $Keystore = Read-Host "Path of the upload keystore (.keystore / .jks)" }
        $Keystore = $Keystore.Trim('"')
        if (-not (Test-Path -LiteralPath $Keystore)) { Fail "Keystore not found: $Keystore" }
        $Keystore = (Resolve-Path -LiteralPath $Keystore).Path

        if (-not $KeyAlias) { $KeyAlias = Read-PropertiesValue $example "keyAlias" }
        if (-not $KeyAlias) { $KeyAlias = Read-Host "Key alias" }
        Write-Host "Keystore: $Keystore"
        Write-Host "Key alias: $KeyAlias"

        $storePass = SecureToPlain (Read-Host "Keystore password" -AsSecureString)
        if (-not $storePass) { Fail "Empty keystore password." }
        if ($SeparateKeyPassword) { $keyPass = SecureToPlain (Read-Host "Key password" -AsSecureString) } else { $keyPass = $storePass }

        # Only this process (and the Gradle child it starts) sees these; removed in finally.
        [Environment]::SetEnvironmentVariable("PAWNAIL_KEYSTORE_FILE", $Keystore, "Process")
        [Environment]::SetEnvironmentVariable("PAWNAIL_KEY_ALIAS", $KeyAlias, "Process")
        [Environment]::SetEnvironmentVariable("PAWNAIL_KEYSTORE_PASSWORD", $storePass, "Process")
        [Environment]::SetEnvironmentVariable("PAWNAIL_KEY_PASSWORD", $keyPass, "Process")
        $storePass = $null
        $keyPass = $null
    }

    # --- 5. Build ---------------------------------------------------------------------------
    Push-Location $AndroidDir
    try {
        & .\gradlew.bat --stop | Out-Null
        if (Test-Path $aab) { Remove-Item -LiteralPath $aab -Force }
        # --no-daemon: no Gradle process keeps the signing variables after the build.
        & .\gradlew.bat :app:bundleRelease --no-daemon --console=plain
        $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    foreach ($n in $EnvNames) { [Environment]::SetEnvironmentVariable($n, $null, "Process") }
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], "Process") }
    [GC]::Collect()
}

if ($exitCode -ne 0) { Fail "gradlew bundleRelease failed (exit $exitCode). Scroll up for the Gradle error." }
if (-not (Test-Path $aab)) { Fail "Build finished but $aab is missing." }

$size = (Get-Item -LiteralPath $aab).Length
Write-Host ""
Write-Host ("AAB: {0}" -f $aab) -ForegroundColor Green
Write-Host ("Size: {0:N1} MB ({1:N0} bytes)" -f ($size / 1MB), $size)
$keytool = Join-Path $jdk "bin\keytool.exe"
if (Test-Path $keytool) {
    Write-Host "Signing certificate (SHA-1 must match Play Console > App integrity > Upload key certificate):"
    & $keytool -printcert -jarfile $aab | Select-String -Pattern "Owner:|SHA1:|SHA256:|Not a signed" | ForEach-Object { Write-Host ("  " + $_.Line.Trim()) }
}
Write-Host "Upload: Play Console > Test and release > Closed testing > Create new release > upload this .aab"
