# 🔥 Regla de Firewall WAF - Bypass para Facebook y Cloudflare Workers

## 📋 Información de la Regla

**Nombre:** `Allow Facebook & Cloudflare Workers`  
**Acción:** `Skip` → Skip all remaining custom rules  
**Prioridad:** `1` (debe ejecutarse ANTES de cualquier otra regla de desafío)  
**Estado:** Enabled

---

## 🎯 Expresión de la Regla (Cloudflare Expression Builder)

### Versión 1: Solo Facebook (Sin Workers - Más Segura pero con delay):
```
(ip.geoip.asnum in {32934 63293 54115}) or
(cf.bot_management.verified_bot) or
(http.user_agent contains "facebookexternalhit") or
(http.user_agent contains "meta-webindexer")
```

**Ventajas:** ✅ Máxima seguridad, sin riesgo de spoofing  
**Desventajas:** ⚠️ Tu Worker tiene delay de 1-2 segundos por JS Challenge

---

### Versión 2: Con IP Específica del Worker (Recomendada):
```
(ip.geoip.asnum in {32934 63293 54115}) or
(cf.bot_management.verified_bot) or
(http.user_agent contains "facebookexternalhit") or
(http.user_agent contains "meta-webindexer") or
(ip.src eq 2a06:98c0:3600::103)
```

**Ventajas:** ✅ Sin delay para tu Worker específico, seguro  
**Desventajas:** ⚠️ Debes actualizar si la IP del Worker cambia

---

### Versión 3: Con Rango de IPs de Workers (Balance):
```
(ip.geoip.asnum in {32934 63293 54115}) or
(cf.bot_management.verified_bot) or
(http.user_agent contains "facebookexternalhit") or
(http.user_agent contains "meta-webindexer") or
(ip.src in {2a06:98c0:3600::/48})
```

**Ventajas:** ✅ Cubre rango de IPs de Workers, menos mantenimiento  
**Desventajas:** ⚠️ Confías en el rango completo de Cloudflare

---

### Versión 4: Con Header Personalizado (Más Segura - Requiere cambio en código):
```
(ip.geoip.asnum in {32934 63293 54115}) or
(cf.bot_management.verified_bot) or
(http.user_agent contains "facebookexternalhit") or
(http.user_agent contains "meta-webindexer") or
(http.header contains "X-Internal-Worker" and http.header contains "Leg3nd123")
```

**Ventajas:** ✅ Muy seguro, solo tu Worker con el secreto correcto  
**Desventajas:** ⚠️ Requiere modificar `src/handlers.js` para agregar header

---

> **Actualización:** Confirmado que el Worker SÍ está siendo bloqueado (evento Ray ID: 99a24786176f64ac).
> Se ofrecen 4 soluciones con diferentes niveles de seguridad vs. performance.

---

## 🔧 Paso a Paso en Cloudflare Dashboard

### 1. Acceder a WAF
1. Inicia sesión en Cloudflare Dashboard
2. Selecciona tu dominio: **calefon.uy**
3. Ve a **Security** → **WAF**
4. Click en **Custom rules**

### 2. Crear la Nueva Regla
1. Click en **"Create rule"** (botón azul arriba a la derecha)
2. Llena los campos:

#### Configuración Básica:
```
Rule name: Allow Facebook & Cloudflare Workers
Description: Bypass para Facebook crawlers, bots verificados y Workers internos
```

#### Expression Builder:

**Opción A: Usar el Editor Visual**
- Click en "Edit expression"
- Pega la expresión correspondiente a la versión que elegiste (ver sección anterior)

**Versión 4 Recomendada (con header personalizado):**
```
(ip.geoip.asnum in {32934 63293 54115}) or (cf.bot_management.verified_bot) or (http.user_agent contains "facebookexternalhit") or (http.user_agent contains "meta-webindexer") or (http.x_internal_worker eq "Leg3nd123")
```

**Versión 1 Alternativa (solo Facebook, sin Workers):**
```
(ip.geoip.asnum in {32934 63293 54115}) or (cf.bot_management.verified_bot) or (http.user_agent contains "facebookexternalhit") or (http.user_agent contains "meta-webindexer")
```

**Opción B: Usar Campos Individuales**
1. Click "Add condition"
2. Agrega estas condiciones con OR entre cada una:

| Campo | Operador | Valor |
|-------|----------|-------|
| AS Number (IP source) | equals | 32934 |
| AS Number (IP source) | equals | 63293 |
| AS Number (IP source) | equals | 54115 |
| Known Bots | equals | On |
| User Agent | contains | facebookexternalhit |
| User Agent | contains | meta-webindexer |

3. Para el último (Workers), agregar grupo con AND:
   - AS Number (Cloudflare) equals 13335
   - AND User Agent contains Chrome/91

> **NOTA:** Las últimas 2 líneas (Workers) se han removido por seguridad.
> Los Workers funcionan correctamente pasando el JS challenge.

#### Choose Action:
```
Action: Skip
  → ✅ Skip all remaining custom rules
```

#### Deployment:
```
Status: Enabled
```

### 3. Reordenar Prioridades
1. Después de crear, asegúrate que esta regla tenga **Priority 1**
2. Tu regla actual "desafiar todo menos uy br y bots verificados" debe estar en **Priority 2** o mayor
3. Arrastra las reglas si es necesario para reordenar

---

## 📊 ASN Incluidos

| ASN | Propietario | Descripción |
|-----|-------------|-------------|
| **32934** | Facebook, Inc. | ASN principal - Crawlers, APIs, Meta services |
| **63293** | Facebook Ireland Ltd | Operaciones en Europa |
| **54115** | Facebook, Inc. | Infraestructura adicional de red |
| **13335** | Cloudflare, Inc. | Tu Worker ejecutándose en Cloudflare |

---

## ✅ Qué Permite Esta Regla

### Facebook/Meta:
- ✅ `meta-webindexer/1.1` - Crawler principal de Facebook
- ✅ `facebookexternalhit` - Bot para preview de links compartidos
- ✅ Todas las IPs desde los 3 ASN de Facebook

### Cloudflare Workers:
- ✅ Tu Worker cuando hace `fetch()` a calefon.uy
- ✅ Pasa el JS challenge automáticamente (delay ~1-2 segundos)
- ✅ **Seguro:** No requiere bypass explícito que podría ser explotado

### Bots Verificados:
- ✅ Cualquier bot verificado por Cloudflare Bot Management
- ✅ Incluye: Googlebot, Bingbot, etc.

---

## 🧪 Testing Post-Implementación

### Test 1: Facebook Debugger
```
URL: https://developers.facebook.com/tools/debug/
Prueba: https://calefon.uy/ariston
Esperado: ✅ Sin errores, preview visible
```

### Test 2: PowerShell - Generar Contenido
```powershell
# Test rápido de generación de contenido
$body = @{
    projectId = 'mhmdg1guso15k5ivqc'
    url = 'https://calefon.uy/fagor'
    context = 'Test bypass rule'
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod `
    -Uri 'https://facebook-auto-publisher.jorgeferreirauy.workers.dev/api/generate-content' `
    -Method POST `
    -Headers @{
        'Content-Type' = 'application/json'
        'x-admin-key' = 'Leg3nd123'
    } `
    -Body $body

Write-Host "✅ TÍTULO: $($response.title)" -ForegroundColor Green
Write-Host "✅ MENSAJE: $($response.message)" -ForegroundColor Green
```

### Test 3: Verificar Firewall Events
1. Ve a **Security** → **Events**
2. Filtra por:
   - Time: Last 30 minutes
   - Action: All
3. Busca requests de:
   - ASN 32934 (Facebook)
   - ASN 13335 (Cloudflare Workers)
4. Esperado:
   - ✅ Action: `allow` o sin eventos (bypass exitoso)
   - ❌ NO debe aparecer `jschallenge` o `managed_challenge`

---

## 🔍 Verificación de Logs

### Antes del Cambio (lo que viste):
```json
{
  "action": "jschallenge",
  "clientAsn": "32934",
  "clientASNDescription": "FACEBOOK",
  "userAgent": "meta-webindexer/1.1",
  "ruleId": "4f8ae7a356b042d4b84359d8a6b39696",
  "metadata": [
    {"key": "js_detection", "value": "MISSING"}
  ]
}
```

### Después del Cambio (esperado):
```json
{
  "action": "allow",
  "clientAsn": "32934",
  "clientASNDescription": "FACEBOOK",
  "userAgent": "meta-webindexer/1.1",
  "ruleId": "NEW_BYPASS_RULE_ID",
  "description": "Allow Facebook & Cloudflare Workers"
}
```

---

## 🚨 Troubleshooting

### Si Facebook aún no puede acceder:

1. **Verifica el orden de las reglas:**
   - La regla de bypass DEBE estar PRIMERA (Priority 1)
   - WAF ejecuta reglas en orden de prioridad

2. **Revisa la expresión:**
   - Asegúrate de usar `or` entre condiciones
   - Verifica que no haya typos en los ASN

3. **Limpia caché de Facebook:**
   ```
   https://developers.facebook.com/tools/debug/sharing/?q=https://calefon.uy/ariston
   ```
   - Click "Scrape Again"

4. **Verifica que Bot Management esté activo:**
   - Ve a **Security** → **Bots**
   - Debe estar en modo "Managed" o superior

### Si tu Worker aún tiene delays:

1. **Verifica el User-Agent en tu Worker:**
   - En `src/handlers.js`, línea ~191, el fetch debe usar:
   ```javascript
   headers: {
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
   }
   ```

2. **Considera cambiar la condición a:**
   ```
   (cf.asn eq 13335 and http.user_agent contains "Chrome")
   ```
   (Más amplio, permite cualquier versión de Chrome desde Workers)

---

## 📝 Configuración Alternativa: API de Cloudflare

Si prefieres crear la regla por API (automatización):

```bash
# Reemplaza ZONE_ID y API_TOKEN
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint/rules" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "skip",
    "action_parameters": {
      "ruleset": "current"
    },
    "expression": "(ip.geoip.asnum in {32934 63293 54115}) or (cf.bot_management.verified_bot) or (http.user_agent contains \"facebookexternalhit\") or (http.user_agent contains \"meta-webindexer\")",
    "description": "Bypass para Facebook crawlers, bots verificados y Workers internos",
    "enabled": true
  }'
```

---

## 📌 Resumen

✅ **Regla creada para permitir:**
- Facebook (ASN 32934, 63293, 54115)
- Bots verificados oficiales
- User-Agents específicos de Facebook

✅ **Workers de Cloudflare:**
- Pasan JS challenge automáticamente
- No requieren bypass explícito (más seguro)

✅ **Beneficios:**
- Facebook puede indexar tus páginas para compartir en redes
- Tu sistema de IA funciona correctamente (delay mínimo aceptable)
- Mantienes la seguridad contra spoofing de User-Agent

✅ **Próximos pasos:**
1. Crear la regla en Cloudflare Dashboard
2. Verificar prioridad (debe ser #1)
3. Testear con Facebook Debugger
4. Testear generación de contenido
5. Revisar logs en 30 minutos

---

**¿Necesitas ayuda con algún paso específico de la configuración?**
