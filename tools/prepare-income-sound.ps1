param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [Parameter(Mandatory = $true)]
  [string]$Output,
  [double]$DurationSeconds = 1.75
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object Name -eq 'AsTask'
$operationMethod = $asTaskMethods | Where-Object {
  $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
$progressMethod = $asTaskMethods | Where-Object {
  $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1'
} | Select-Object -First 1

function Wait-AsyncOperation($Operation, [Type]$ResultType) {
  $task = $operationMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

function Wait-AsyncProgressAction($Operation, [Type]$ProgressType) {
  $task = $progressMethod.MakeGenericMethod($ProgressType).Invoke($null, @($Operation))
  $task.Wait()
}

$sourcePath = [IO.Path]::GetFullPath($Source)
$outputPath = [IO.Path]::GetFullPath($Output)
$outputDirectory = [IO.Path]::GetDirectoryName($outputPath)
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$temporaryWav = Join-Path ([IO.Path]::GetTempPath()) ("finance-income-{0}.wav" -f [Guid]::NewGuid().ToString('N'))

try {
  $sourceFile = Wait-AsyncOperation ([Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]::GetFileFromPathAsync($sourcePath)) ([Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime])
  $temporaryFolder = Wait-AsyncOperation ([Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]::GetFolderFromPathAsync([IO.Path]::GetDirectoryName($temporaryWav))) ([Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime])
  $temporaryFile = Wait-AsyncOperation ($temporaryFolder.CreateFileAsync([IO.Path]::GetFileName($temporaryWav), [Windows.Storage.CreationCollisionOption, Windows.Storage, ContentType = WindowsRuntime]::ReplaceExisting)) ([Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime])

  $profile = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality, Windows.Media, ContentType = WindowsRuntime]::High)
  $transcoder = New-Object 'Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType=WindowsRuntime'
  $prepared = Wait-AsyncOperation ($transcoder.PrepareFileTranscodeAsync($sourceFile, $temporaryFile, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult, Windows.Media, ContentType = WindowsRuntime])
  if (-not $prepared.CanTranscode) { throw "Windows Media Transcoder failed: $($prepared.FailureReason)" }
  Wait-AsyncProgressAction ($prepared.TranscodeAsync()) ([double])

  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  & node (Join-Path $scriptRoot 'trim-income-sound.mjs') $temporaryWav $outputPath $DurationSeconds
  if ($LASTEXITCODE -ne 0) { throw "WAV post-processing failed with exit code $LASTEXITCODE" }
}
finally {
  Remove-Item -LiteralPath $temporaryWav -Force -ErrorAction SilentlyContinue
}
