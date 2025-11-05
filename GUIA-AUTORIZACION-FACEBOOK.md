# 🔐 Guía Completa de Autorización de Facebook

## 🎯 Lo que Necesitas Entender

Para que tu sistema pueda publicar automáticamente en Facebook, necesitas:

1. **Una App de Facebook** (contenedor de permisos)
2. **Autorización de tu Fanpage** (permiso para publicar)
3. **Token de Acceso** (credencial para la API)

## 🔄 Proceso Completo de Autorización

```
┌────────────────────────────────────────────────────────────┐
│  PASO 1: Crear App en Facebook                             │
├────────────────────────────────────────────────────────────┤
│  Tu app → Solicita permisos                                │
│                                                            │
│  PASO 2: Autorizar tu Fanpage                              │
├────────────────────────────────────────────────────────────┤
│  Tú (admin de la página) → Autorizas la app                │
│                                                            │
│  PASO 3: Obtener Token de Acceso                           │
├────────────────────────────────────────────────────────────┤
│  Facebook → Te da un token                                 │
│                                                            │
│  PASO 4: Configurar en Cloudflare                          │
├────────────────────────────────────────────────────────────┤
│  npx wrangler secret put FB_PAGE_ACCESS_TOKEN              │
│                                                            │
│  PASO 5: ¡Tu sistema puede publicar!                       │
└────────────────────────────────────────────────────────────┘
```

## 📋 Proceso Detallado Paso a Paso

### PASO 1: Crear una App de Facebook

**1.1 Ir a Facebook Developers**

```
URL: https://developers.facebook.com/
```

**1.2 Crear una App**

```
1. Click en "My Apps" (arriba derecha)
2. Click en "Create App"
3. Seleccionar tipo: "Business" o "Consumer"
4. Llenar el formulario:
   - App Name: "Mi Sistema Auto-Publisher"
   - App Contact Email: tu@email.com
   - Business Account: [opcional]
5. Click "Create App"
```

**Resultado:** Ya tienes una App ID

```
┌─────────────────────────────────────┐
│  ✓ App creada                       │
│  App ID: 123456789012345            │
│  App Secret: [generado]             │
└─────────────────────────────────────┘
```

### PASO 2: Configurar Permisos de la App

**2.1 Agregar el Producto "Facebook Login"**

```
1. En el dashboard de tu app
2. Sidebar izquierdo → "Add Product"
3. Buscar "Facebook Login"
4. Click "Set Up"
```

**2.2 Configurar Settings de Facebook Login**

```
1. Sidebar → Facebook Login → Settings
2. Valid OAuth Redirect URIs:
   - https://developers.facebook.com/tools/explorer/callback
   (esto es para testing)
3. Click "Save Changes"
```

### PASO 3: Obtener Token de Acceso

Este es el paso CRÍTICO donde autorizas tu fanpage.

**3.1 Usar Graph API Explorer**

```
URL: https://developers.facebook.com/tools/explorer/
```

**3.2 Configurar el Explorer**

```
┌─────────────────────────────────────────────────────────┐
│  Graph API Explorer                                     │
├─────────────────────────────────────────────────────────┤
│  1. "Facebook App" → Selecciona tu app                  │
│  2. "User or Page" → Selecciona tu fanpage              │
│  3. Click en "Generate Access Token"                    │
└─────────────────────────────────────────────────────────┘
```

**3.3 Autorizar Permisos (AQUÍ AUTORIZAS)**

Cuando hagas click en "Generate Access Token", verás:

```
┌─────────────────────────────────────────────────────────┐
│  [Tu App] wants to access your Facebook account         │
├─────────────────────────────────────────────────────────┤
│  This will allow [Tu App] to:                           │
│                                                         │
│  ☐ pages_show_list                                      │
│     View your Page information                          │
│                                                         │
│  ☐ pages_manage_posts                                   │
│     Create, edit and delete posts on your Page         │
│                                                         │
│  ☐ pages_read_engagement                                │
│     Read engagement data on your Page                   │
│                                                         │
│  [Cancel]  [Continue as Your Name] ←── AUTORIZAR       │
└─────────────────────────────────────────────────────────┘
```

**IMPORTANTE:** Aquí es donde TÚ autorizas a tu app a publicar en tu página.

**3.4 Seleccionar Permisos Necesarios**

En el Graph API Explorer, click en "Permissions":

```
Permisos necesarios (marca estos):
✓ pages_show_list
✓ pages_manage_posts
✓ pages_read_engagement
✓ pages_read_user_content (opcional)
```

**3.5 Generar el Token**

```
1. Click "Generate Access Token"
2. Facebook mostrará diálogo de autorización
3. Click "Continue as [Tu Nombre]"
4. Selecciona tu fanpage
5. Click "Next" y "Done"
```

**Resultado:** Verás un token en el campo "Access Token"

```
┌─────────────────────────────────────────────────────────┐
│  Access Token:                                          │
│  EAABsbCS1iHgBO7ZC9qxMEWmx2cBZCCNVGb...  [muy largo]    │
│  [Copy]                                                 │
└─────────────────────────────────────────────────────────┘
```

### PASO 4: Obtener Token de Larga Duración

El token generado expira en 1 hora. Necesitas uno de larga duración.

**4.1 Usar Access Token Debugger**

```
URL: https://developers.facebook.com/tools/debug/accesstoken/
```

```
1. Pega tu token en el campo
2. Click "Debug"
3. Verás información del token:
   - Type: User Access Token
   - Expires: [fecha cercana]
   - Valid: Yes
```

**4.2 Extender el Token**

```
1. En el mismo debugger
2. Click "Extend Access Token"
3. Facebook generará un token de 60 días
4. Copia el nuevo token
```

**4.3 Obtener Token de Página (NO expira)**

Este es el secreto: necesitas el token DE LA PÁGINA, no de usuario.

```
Opción A - Manual con API Call:
GET https://graph.facebook.com/v18.0/me/accounts?access_token=TU_TOKEN_EXTENDIDO
```

```
Opción B - Con Graph API Explorer:
1. Usa el token extendido
2. En el campo de query escribe: me/accounts
3. Click "Submit"
4. Verás lista de tus páginas:
   {
     "data": [
       {
         "access_token": "EAABsbCS1iHgBO...",  ← TOKEN DE PÁGINA
         "category": "Personal Blog",
         "name": "Mi Fanpage",
         "id": "123456789012345",
         "tasks": ["MANAGE", "CREATE_CONTENT"]
       }
     ]
   }
```

**IMPORTANTE:** El `access_token` dentro de `data[0]` es el TOKEN DE PÁGINA que necesitas. Este NO EXPIRA mientras tu app esté activa.

### PASO 5: Verificar el Token de Página

```
URL: https://developers.facebook.com/tools/debug/accesstoken/
```

```
1. Pega el token de página
2. Click "Debug"
3. Verifica:
   ✓ Type: Page Access Token
   ✓ Expires: Never
   ✓ Valid: Yes
   ✓ Scopes: pages_manage_posts, pages_read_engagement
```

### PASO 6: Obtener el Page ID

```
Opción A - Desde tu fanpage:
1. Ve a tu fanpage en Facebook
2. Click en "About"
3. Busca "Page ID" o scroll hasta abajo
4. Copia el número

Opción B - Desde Graph API Explorer:
1. Query: me?fields=id,name (con tu token de página)
2. Verás: { "id": "123456789012345", "name": "Mi Fanpage" }
```

### PASO 7: Configurar en Cloudflare

Ahora sí, configura tus secretos:

```powershell
# 1. Token de acceso de la página (el que NO expira)
npx wrangler secret put FB_PAGE_ACCESS_TOKEN
# Pega el token cuando te lo pida

# 2. ID de tu fanpage
npx wrangler secret put FB_PAGE_ID
# Pega el ID cuando te lo pida
```

**Verificar:**

```powershell
npx wrangler secret list
```

Deberías ver:
```
Secret Name              
FB_PAGE_ACCESS_TOKEN     
FB_PAGE_ID               
OPENAI_API_KEY          
```

### PASO 8: ¡Probar!

```powershell
# Desplegar
npm run deploy

# Ver logs
npx wrangler tail

# Hacer una prueba manual desde el panel
# https://tu-worker.workers.dev
```

## 🔑 Tipos de Tokens (IMPORTANTE)

```
┌────────────────────────────────────────────────────────┐
│  TIPO                 DURACIÓN      USO                │
├────────────────────────────────────────────────────────┤
│  User Token (corto)   1 hora        Testing            │
│  User Token (largo)   60 días       Desarrollo         │
│  Page Token           Sin límite    PRODUCCIÓN ✓       │
│  App Token            Sin límite    Backend            │
└────────────────────────────────────────────────────────┘
```

**TÚ NECESITAS:** Page Access Token (nunca expira)

## 🎯 Resumen del Flujo de Autorización

```
TÚ (Admin de la Página)
    ↓
Creas App en Facebook Developers
    ↓
Autorizas tu App a acceder a tu Fanpage
    ↓
Facebook te da un Token de Usuario (1 hora)
    ↓
Extiendes el Token (60 días)
    ↓
Intercambias por Token de Página (nunca expira)
    ↓
Configuras el Token en Cloudflare
    ↓
Tu Sistema puede publicar automáticamente ✓
```

## 🔐 Diagrama de Autorización

```
┌──────────────────────────────────────────────────────────┐
│  ACTOR                    ACCIÓN                         │
├──────────────────────────────────────────────────────────┤
│  TÚ                       Creas App de Facebook          │
│    ↓                                                      │
│  APP DE FACEBOOK          Solicita permisos              │
│    ↓                                                      │
│  TÚ                       Autorizas permisos             │
│    ↓                      [Click "Continue"]             │
│  FACEBOOK                 Genera token                   │
│    ↓                                                      │
│  TÚ                       Copias token                   │
│    ↓                                                      │
│  CLOUDFLARE WORKER        Usa token para publicar        │
│    ↓                                                      │
│  FACEBOOK API             Verifica token                 │
│    ↓                                                      │
│  TU FANPAGE               Post publicado ✓               │
└──────────────────────────────────────────────────────────┘
```

## 🛡️ Seguridad del Token

### ¿Dónde se almacena el token?

```
❌ NUNCA en el código
❌ NUNCA en git
❌ NUNCA en archivos de texto

✓ En Cloudflare Secrets (encriptado)
✓ Solo tu worker puede accederlo
✓ No es visible públicamente
```

### ¿Cómo funciona Wrangler Secrets?

```powershell
# Cuando ejecutas:
npx wrangler secret put FB_PAGE_ACCESS_TOKEN

# Cloudflare:
1. Encripta el valor
2. Lo almacena en su bóveda segura
3. Solo tu worker puede leerlo
4. Se inyecta como variable de entorno
```

### En tu código:

```javascript
// src/handlers.js
export async function publishToFacebook(post, env) {
  const pageAccessToken = env.FB_PAGE_ACCESS_TOKEN;  // ← Cloudflare lo inyecta
  // ...
}
```

## 🔄 Renovación del Token

### Token de Página (el que usas):

```
✓ NO EXPIRA mientras:
  - Tu app esté activa
  - No cambies la contraseña de Facebook
  - No revoques permisos manualmente
```

### Si el token deja de funcionar:

```
1. Ve a Facebook Developers
2. Graph API Explorer
3. Genera nuevo token
4. Repite pasos 3-7
5. Actualiza el secret:
   npx wrangler secret put FB_PAGE_ACCESS_TOKEN
```

## 🆘 Troubleshooting de Autorización

### Error: "Invalid OAuth access token"

**Causa:** Token expirado o incorrecto

**Solución:**
```
1. Ve a: https://developers.facebook.com/tools/debug/accesstoken/
2. Pega tu token
3. Si dice "Error validating access token"
   → Genera un nuevo token (pasos 3-7)
```

### Error: "Insufficient permissions"

**Causa:** Faltan permisos

**Solución:**
```
1. Graph API Explorer
2. Permissions → Marca:
   ✓ pages_manage_posts
   ✓ pages_read_engagement
3. Generate Access Token de nuevo
```

### Error: "Page request limit reached"

**Causa:** Demasiadas solicitudes

**Solución:**
```
1. Espera 1 hora
2. Revisa tus cron triggers (no más de 1 por hora recomendado)
3. Contacta a Facebook si es persistente
```

### Token funciona en Graph Explorer pero no en tu Worker

**Causa:** Usando token de usuario en lugar de página

**Solución:**
```
1. Obtén el Page Access Token específicamente
2. Query: me/accounts con tu user token
3. Usa el access_token que viene en la respuesta
```

## 📝 Checklist Completo

```
□ Crear app en Facebook Developers
□ Configurar Facebook Login
□ Agregar Valid OAuth Redirect URIs
□ Ir a Graph API Explorer
□ Seleccionar tu app
□ Seleccionar permisos necesarios:
  □ pages_show_list
  □ pages_manage_posts
  □ pages_read_engagement
□ Generate Access Token
□ Autorizar la app (click "Continue")
□ Extender el token a 60 días
□ Obtener Page Access Token (me/accounts)
□ Verificar que sea Page Token (no expira)
□ Copiar Page ID
□ Configurar FB_PAGE_ACCESS_TOKEN en Cloudflare
□ Configurar FB_PAGE_ID en Cloudflare
□ Desplegar worker
□ Probar publicación manual
□ Verificar publicación automática
```

## 🎓 Video Tutorial Recomendado

Si prefieres video, busca en YouTube:
- "Facebook Graph API Page Access Token"
- "How to get Facebook Page Token never expires"
- "Facebook API OAuth tutorial"

## 📚 Links Importantes

```
Facebook Developers:
https://developers.facebook.com/

Create App:
https://developers.facebook.com/apps/create/

Graph API Explorer:
https://developers.facebook.com/tools/explorer/

Access Token Debugger:
https://developers.facebook.com/tools/debug/accesstoken/

Documentación Graph API:
https://developers.facebook.com/docs/graph-api/

Permisos de Página:
https://developers.facebook.com/docs/permissions/reference/pages_manage_posts
```

## 🎯 Resultado Final

Una vez completado, tu sistema:

```
✓ Tiene autorización permanente para publicar
✓ El token NO expira
✓ Publica automáticamente 3x/día
✓ Publica manualmente cuando quieras
✓ Todo seguro con Cloudflare Secrets
✓ Sin intervención manual necesaria
```

## 💡 Tips Finales

1. **Guarda tu App ID y App Secret** en un lugar seguro
2. **Documenta tus tokens** (pero nunca en git)
3. **Prueba primero con publicación manual** antes de automatizar
4. **Monitorea los logs** las primeras semanas
5. **Ten un backup** del token de página

---

**¿Necesitas ayuda específica con algún paso?** Puedo guiarte pantalla por pantalla. 🔐
