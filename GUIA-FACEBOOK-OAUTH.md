# 📘 Configuración de Facebook OAuth

Esta guía te ayudará a configurar la autenticación de Facebook para conectar fanpages al sistema.

## 🔧 Paso 1: Crear una App de Facebook

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Click en **"My Apps"** → **"Create App"**
3. Selecciona **"Business"** como tipo de app
4. Completa los datos:
   - **App Name:** `Auto Publisher - [Tu Nombre]`
   - **App Contact Email:** Tu email
5. Click **"Create App"**

---

## 📋 Paso 2: Configurar la App

### 2.1 Obtener App ID y App Secret

1. En el dashboard de tu app, ve a **Settings** → **Basic**
2. Copia los valores:
   - **App ID:** (número de 15-16 dígitos)
   - **App Secret:** Click en "Show" para verlo

### 2.2 Agregar el Producto "Facebook Login"

1. En el menú lateral, click en **"Add Product"**
2. Busca **"Facebook Login"** y click en **"Set Up"**
3. Selecciona **"Web"** como plataforma

### 2.3 Configurar Valid OAuth Redirect URIs

1. Ve a **Facebook Login** → **Settings**
2. En **"Valid OAuth Redirect URIs"** agrega:
   ```
   https://facebook-auto-publisher.jorgeferreirauy.workers.dev/auth/facebook/callback
   ```
   *(Reemplaza con tu dominio real del Worker)*

3. **Guarda los cambios**

---

## 🔑 Paso 3: Configurar Variables de Entorno en Cloudflare

### Opción A: Desde el Dashboard de Cloudflare

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona tu Worker: **facebook-auto-publisher**
3. Ve a **Settings** → **Variables and Secrets**
4. Agrega estas variables:

| Variable | Valor | Tipo |
|----------|-------|------|
| `FACEBOOK_APP_ID` | Tu App ID (ej: 1234567890123456) | Plain text |
| `FACEBOOK_APP_SECRET` | Tu App Secret | Secret (encrypted) |

5. Click **"Save and Deploy"**

### Opción B: Usando Wrangler CLI

```bash
# Configurar App ID (texto plano)
npx wrangler secret put FACEBOOK_APP_ID

# Configurar App Secret (secreto cifrado)
npx wrangler secret put FACEBOOK_APP_SECRET
```

Cuando te lo pida, pega el valor correspondiente.

---

## ✅ Paso 4: Configurar Permisos

### 4.1 Agregar Permisos de Páginas

1. En el dashboard de tu app, ve a **App Review** → **Permissions and Features**
2. Busca y solicita estos permisos:

| Permiso | Descripción | Requerido |
|---------|-------------|-----------|
| `pages_show_list` | Ver lista de páginas | ✅ Sí |
| `pages_read_engagement` | Leer información de páginas | ✅ Sí |
| `pages_manage_posts` | Publicar en páginas | ✅ Sí |
| `pages_manage_engagement` | Gestionar interacciones | ✅ Sí |

### 4.2 Modo de Desarrollo vs. Producción

**Modo Desarrollo (Testing):**
- Tu app está en "Development Mode"
- Solo tú (como administrador) puedes usarla
- Suficiente para probar y usar personalmente

**Modo Producción (Si quieres que otros la usen):**
1. Ve a **App Review** → **Requests**
2. Click en **"Request [Permission Name]"** para cada permiso
3. Completa el formulario explicando el uso
4. Espera aprobación de Facebook (puede tomar días)

> **Nota:** Para uso personal, el modo de desarrollo es suficiente.

---

## 🧪 Paso 5: Probar la Integración

### 5.1 Desplegar los Cambios

```bash
cd C:\auto-facebook-publisher
npx wrangler deploy
```

### 5.2 Probar la Conexión

1. Abre el dashboard: https://facebook-auto-publisher.jorgeferreirauy.workers.dev/dashboard
2. Edita un proyecto existente
3. En la sección **"📘 Conexión con Facebook"**, click en **"📘 Conectar Fanpage"**
4. Autoriza la app en Facebook
5. Selecciona la fanpage que deseas conectar
6. Verifica que aparezca: **"✅ Conectado - [Nombre de tu página]"**

---

## 🔍 Verificar Configuración

### Comprobar Variables de Entorno

```powershell
# Ver variables configuradas (no muestra valores secretos)
npx wrangler secret list
```

Deberías ver:
```
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
```

### Logs de Depuración

```powershell
# Ver logs en tiempo real
npx wrangler tail
```

Luego intenta conectar una fanpage y observa los logs.

---

## 🚨 Troubleshooting

### Error: "Invalid OAuth redirect URI"

**Solución:**
1. Ve a tu app de Facebook → Facebook Login → Settings
2. Verifica que la URL de callback sea **exactamente**:
   ```
   https://TU_WORKER_URL/auth/facebook/callback
   ```
3. Sin barra final `/` al final
4. Con `https://` (no `http://`)

### Error: "App Not Setup"

**Solución:**
1. Asegúrate de haber agregado el producto "Facebook Login"
2. Completa la configuración básica de la app

### Error: "Access token missing"

**Solución:**
1. Verifica que `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET` estén configurados
2. Redespliega: `npx wrangler deploy`

### No aparecen páginas para seleccionar

**Solución:**
1. Asegúrate de ser **administrador** de al menos una fanpage
2. Si no tienes una, créala en: https://facebook.com/pages/create

---

## 📱 Cómo Crear una Fanpage

Si no tienes una fanpage:

1. Ve a https://facebook.com/pages/create
2. Selecciona **"Business or Brand"**
3. Completa:
   - **Page name:** Nombre de tu negocio
   - **Category:** Categoría relevante
   - **Description:** Descripción breve
4. Click **"Create Page"**
5. Vuelve al dashboard y conecta la página

---

## 🎯 Resultado Final

Una vez configurado correctamente:

✅ Puedes conectar fanpages a tus proyectos  
✅ El sistema publicará automáticamente según tu programación  
✅ Los tokens de acceso se renuevan automáticamente  
✅ Cada proyecto puede tener su propia fanpage  

---

## 📚 Recursos Adicionales

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/overview)
- [Pages API](https://developers.facebook.com/docs/pages)
- [App Review Process](https://developers.facebook.com/docs/app-review)

---

## 🔐 Seguridad

- ✅ El `App Secret` se almacena cifrado en Cloudflare
- ✅ Los tokens de página son de larga duración (60 días)
- ✅ El sistema renueva tokens automáticamente
- ✅ Solo los administradores de páginas pueden conectarlas

---

**¿Problemas? Revisa los logs con:**
```bash
npx wrangler tail
```

**Y abre un issue en GitHub si necesitas ayuda adicional.**
