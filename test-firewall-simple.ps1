# Test de Firewall - Deteccion de Bloqueos
Write-Host ""
Write-Host "PRUEBA DE FIREWALL - Cloudflare WAF" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Gray

# Test 1
Write-Host ""
Write-Host "TEST 1: Generar contenido (medir tiempo)" -ForegroundColor Yellow
$body1 = @{projectId='mhmdg1guso15k5ivqc';url='https://calefon.uy/tres-cruces';context='Test'} | ConvertTo-Json -Compress
$start1 = Get-Date
try {
    $response1 = Invoke-RestMethod -Uri 'https://facebook-auto-publisher.jorgeferreirauy.workers.dev/api/generate-content' -Method POST -Headers @{'Content-Type'='application/json';'x-admin-key'='Leg3nd123'} -Body $body1 -ErrorAction Stop
    $elapsed1 = (Get-Date) - $start1
    $tiempo1 = [math]::Round($elapsed1.TotalSeconds, 2)
    Write-Host "EXITO - Tiempo: $tiempo1 segundos" -ForegroundColor Green
    if ($tiempo1 -lt 3) {
        Write-Host "   RAPIDO - Sin firewall delay" -ForegroundColor Green
    } elseif ($tiempo1 -lt 5) {
        Write-Host "   NORMAL - Posible JS Challenge" -ForegroundColor Yellow
    } else {
        Write-Host "   LENTO - Firewall bloqueando" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2
Write-Host ""
Write-Host "TEST 2: 3 URLs consecutivas" -ForegroundColor Yellow
$urls = @('https://calefon.uy/ariston','https://calefon.uy/fagor','https://calefon.uy/hyundai')
$tiempos = @()
$exitosos = 0

foreach ($testUrl in $urls) {
    Write-Host "   Probando: $testUrl" -ForegroundColor Gray -NoNewline
    $bodyTest = @{projectId='mhmdg1guso15k5ivqc';url=$testUrl;context='Test'} | ConvertTo-Json -Compress
    $startTest = Get-Date
    try {
        $responseTest = Invoke-RestMethod -Uri 'https://facebook-auto-publisher.jorgeferreirauy.workers.dev/api/generate-content' -Method POST -Headers @{'Content-Type'='application/json';'x-admin-key'='Leg3nd123'} -Body $bodyTest -ErrorAction Stop -TimeoutSec 15
        $elapsedTest = (Get-Date) - $startTest
        $tiempoTest = [math]::Round($elapsedTest.TotalSeconds, 2)
        $tiempos += $tiempoTest
        $exitosos++
        Write-Host " OK ${tiempoTest}s" -ForegroundColor Green
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 500
}

# Resumen
Write-Host ""
Write-Host "============================================================" -ForegroundColor Gray
Write-Host "RESUMEN:" -ForegroundColor Cyan

if ($tiempos.Count -gt 0) {
    $promedio = ($tiempos | Measure-Object -Average).Average
    Write-Host ""
    Write-Host "   Exitosos: $exitosos / $($urls.Count)" -ForegroundColor White
    Write-Host "   Promedio: $([math]::Round($promedio, 2))s" -ForegroundColor White
    Write-Host ""
    if ($promedio -lt 3) {
        Write-Host "   EXCELENTE - Sin delays de firewall" -ForegroundColor Green
    } elseif ($promedio -lt 5) {
        Write-Host "   ACEPTABLE - Posible JS Challenge (1-2s)" -ForegroundColor Yellow
    } else {
        Write-Host "   PROBLEMA - Firewall bloqueando" -ForegroundColor Red
    }
} else {
    Write-Host "   TODOS LOS TESTS FALLARON" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Gray
Write-Host ""
