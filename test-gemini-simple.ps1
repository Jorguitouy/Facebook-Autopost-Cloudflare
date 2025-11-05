Write-Host ""
Write-Host "🔍 Probando API de Gemini..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$apiKey = "AIzaSyD0zMwW58ZhQgEFSM9HWxcC1xea8mJkKA4"
$modelsToTest = @("gemini-pro", "gemini-1.5-flash", "gemini-1.5-pro")

foreach ($model in $modelsToTest) {
    Write-Host ""
    Write-Host "📡 Probando modelo: $model" -ForegroundColor Yellow
    
    $url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$apiKey"
    
    $requestBody = @{
        contents = @(
            @{
                parts = @(
                    @{
                        text = "Responde solo con: OK"
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 5
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $requestBody -ContentType "application/json" -ErrorAction Stop
        
        if ($response.candidates) {
            $content = $response.candidates[0].content.parts[0].text
            Write-Host "   ✅ Funciona: $content" -ForegroundColor Green
            Write-Host "   👉 Usa este modelo en el panel" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
            Write-Host "✨ Configuración correcta:" -ForegroundColor Green
            Write-Host "   Proveedor: Gemini" -ForegroundColor White
            Write-Host "   Modelo: $model" -ForegroundColor White
            Write-Host "   API Key: $($apiKey.Substring(0,20))..." -ForegroundColor White
            Write-Host ""
            exit 0
        }
    }
    catch {
        Write-Host "   ❌ No disponible" -ForegroundColor Red
        $errorMsg = $_.Exception.Message
        if ($_.ErrorDetails) {
            $errorMsg = $_.ErrorDetails.Message
        }
        Write-Host "   Detalles: $errorMsg" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "❌ Ningún modelo funcionó" -ForegroundColor Red
Write-Host "   API Key: $($apiKey.Substring(0,20))..." -ForegroundColor Gray
Write-Host ""
