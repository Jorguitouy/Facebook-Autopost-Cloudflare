# Script para probar la API de Gemini
# API Key: AIzaSyD0zMwW58ZhQgEFSM9HWxcC1xea8mJkKA4

$apiKey = "AIzaSyD0zMwW58ZhQgEFSM9HWxcC1xea8mJkKA4"
$model = "gemini-1.5-flash"

Write-Host "🔍 Probando conexión con Google Gemini..." -ForegroundColor Cyan
Write-Host "   Modelo: $model" -ForegroundColor Gray
Write-Host ""

$url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$apiKey"

$body = @{
    contents = @(
        @{
            parts = @(
                @{
                    text = "Eres un experto en marketing de redes sociales. Genera un post atractivo para Facebook sobre el siguiente contenido: 'Tutorial de programación en JavaScript'. Incluye emojis y hashtags relevantes. Máximo 200 caracteres."
                }
            )
        }
    )
    generationConfig = @{
        temperature = 0.8
        maxOutputTokens = 300
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    
    if ($response.candidates) {
        $content = $response.candidates[0].content.parts[0].text
        
        Write-Host "✅ Conexión exitosa!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Contenido generado:" -ForegroundColor Yellow
        Write-Host $content -ForegroundColor White
        Write-Host ""
        Write-Host "✨ La API de Gemini está funcionando correctamente" -ForegroundColor Green
        Write-Host "   Puedes usar esta configuración en el panel web." -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️  Respuesta inesperada de la API" -ForegroundColor Yellow
        Write-Host ($response | ConvertTo-Json -Depth 5)
    }
}
catch {
    Write-Host "❌ Error al conectar con Gemini" -ForegroundColor Red
    Write-Host ""
    Write-Host "Detalles del error:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Respuesta de la API:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    Write-Host "• API Key inválida o expirada" -ForegroundColor Gray
    Write-Host "• Límite de requests excedido (15 req/min)" -ForegroundColor Gray
    Write-Host "• Modelo no disponible" -ForegroundColor Gray
    Write-Host "• Problema de red" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
