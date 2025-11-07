# 🔐 Sistema de Recuperación de Contraseña

Guía completa del sistema de recuperación de contraseña por email usando Resend.

## 🎯 Características

✅ **Recuperación por email** con enlace seguro  
✅ **Tokens únicos** con expiración de 1 hora  
✅ **Integración con Resend** para envío de emails  
✅ **Configuración desde el panel** (Mi Cuenta)  
✅ **Validación de contraseñas** (8+ caracteres, mayúsculas, minúsculas, números)  
✅ **Uso único de tokens** (se eliminan al usarse)  

---

## 📧 Configurar Resend

### 1. Crear Cuenta en Resend

1. Ve a https://resend.com
2. Crea una cuenta gratuita
3. Verifica tu email

### 2. Verificar Dominio

1. Ve a https://resend.com/domains
2. Click en "Add Domain"
3. Ingresa tu dominio (ej: `tudominio.com`)
4. Agrega los registros DNS que te proporcionan:
   - **TXT**: `resend._domainkey.tudominio.com`
   - **CNAME** o **MX**: para recepción
5. Espera verificación (puede tomar hasta 48h, usualmente minutos)

### 3. Obtener API Key

1. Ve a https://resend.com/api-keys
2. Click en "Create API Key"
3. Nombre: `Facebook Auto Publisher`
4. Permisos: `Sending access`
5. **Copia la API Key** (comienza con `re_`)
   - ⚠️ Solo se muestra una vez
   - Ejemplo: `re_123abc456def789ghi`

---

## ⚙️ Configurar en el Panel

### 1. Acceder a Mi Cuenta

1. Inicia sesión en tu dashboard
2. Click en **"👤 Mi Cuenta"** (botón en el header superior derecho)

### 2. Configurar Email

En la sección **"📧 Configuración de Email (Resend)"**:

1. **API Key de Resend**:
   - Pega tu API Key (ej: `re_123abc456def789ghi`)
   - Se guardará de forma segura y no se mostrará nuevamente

2. **Email Remitente**:
   - Ingresa un email de tu dominio verificado
   - Ejemplo: `noreply@tudominio.com`
   - Debe ser del mismo dominio verificado en Resend

3. Click en **"Guardar Configuración de Email"**

✅ Verás mensaje: "Configuración guardada exitosamente"

---

## 👤 Agregar Email a Usuarios

Para que los usuarios puedan recuperar contraseña, deben tener email configurado:

### Opción 1: Manual (PowerShell)

```powershell
# 1. Obtener usuarios actuales
$users = wrangler kv key get auth_users --namespace-id=821ab7da6c7b45b098c0470c9abe20ab --remote | ConvertFrom-Json

# 2. Ver usuarios actuales
$users.users | Select-Object username, name, email

# 3. Agregar email al usuario admin (ejemplo)
$users.users[0].email = "admin@tudominio.com"

# 4. Guardar cambios
$usersJson = $users | ConvertTo-Json -Depth 10 -Compress
wrangler kv key put auth_users $usersJson --namespace-id=821ab7da6c7b45b098c0470c9abe20ab --remote
```

### Opción 2: Al Crear Usuario

Modifica `scripts/create-user.js` para incluir email:

```javascript
// Agregar después de la línea del rol:
const email = prompt('Email del usuario: ');

// En el objeto user:
const user = {
  username,
  passwordHash,
  name,
  role,
  email,  // <-- Agregar esta línea
  createdAt: new Date().toISOString()
};
```

---

## 🔄 Flujo de Recuperación

### Usuario Sin Acceso

1. **Ir a Login**:
   - Accede a `/login`

2. **Click en "¿Olvidaste tu contraseña?"**:
   - Te redirige a `/forgot-password`

3. **Ingresar Usuario**:
   - Escribe tu nombre de usuario
   - Click en "Enviar Email de Recuperación"

4. **Revisar Email**:
   - Recibirás un email en minutos
   - Asunto: "Recuperación de Contraseña - Facebook Auto Publisher"

5. **Click en Botón o Enlace**:
   - El enlace tiene formato: `https://tu-worker.workers.dev/reset-password?token=uuid`
   - **Válido por 1 hora**

6. **Establecer Nueva Contraseña**:
   - Ingresa nueva contraseña (cumpliendo requisitos)
   - Confirma la contraseña
   - Click en "Restablecer Contraseña"

7. **Iniciar Sesión**:
   - Serás redirigido a `/login`
   - Usa tu nueva contraseña

---

## 📨 Contenido del Email

El usuario recibirá un email HTML profesional:

```
🔐 Recuperación de Contraseña

Hola [username],

Recibimos una solicitud para restablecer tu contraseña.

Haz clic en el siguiente botón para crear una nueva contraseña:

[Restablecer Contraseña]  <-- Botón azul

O copia y pega este enlace en tu navegador:
https://tu-worker.workers.dev/reset-password?token=abc-123-def

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, ignora este email.

---
Este es un email automático, por favor no respondas.
```

---

## 🔒 Seguridad

### Tokens de Recuperación

- **UUID v4** aleatorios únicos
- **Expiración**: 1 hora (3600 segundos)
- **Uso único**: se elimina automáticamente al usarse
- **Almacenamiento**: Cloudflare KV con TTL automático

### Protección Contra Enumeración

- **Respuesta genérica** si el usuario no existe
- Mensaje siempre: "Si el usuario existe y tiene email configurado, recibirás un email"
- No se revela si el usuario existe o no

### Requisitos de Contraseña

- ✅ Mínimo 8 caracteres
- ✅ Al menos 1 letra mayúscula (A-Z)
- ✅ Al menos 1 letra minúscula (a-z)
- ✅ Al menos 1 número (0-9)

La interfaz valida en tiempo real:
- ✅ Verde = requisito cumplido
- ⚪ Gris = requisito pendiente

---

## 🛠️ Estructura en KV

### Email Config (`email_config`)

```json
{
  "resendApiKey": "re_abc123...",
  "fromEmail": "noreply@tudominio.com",
  "updatedAt": "2025-11-07T12:00:00.000Z",
  "updatedBy": "admin"
}
```

### Usuario con Email (`auth_users`)

```json
{
  "users": [
    {
      "username": "admin",
      "passwordHash": "abc123...",
      "name": "Administrador",
      "role": "admin",
      "email": "admin@tudominio.com",
      "createdAt": "2025-11-07T...",
      "updatedAt": "2025-11-07T..."
    }
  ]
}
```

### Token de Recuperación (`reset:{token}`)

```json
{
  "username": "admin",
  "createdAt": "2025-11-07T12:00:00.000Z",
  "expiresAt": 1699392000000
}
```

Key: `reset:550e8400-e29b-41d4-a716-446655440000`  
TTL: 3600 segundos (se auto-elimina)

---

## 🔍 Troubleshooting

### "Error al enviar email"

**Causas posibles**:
- ❌ API Key no configurada
- ❌ API Key inválida
- ❌ Dominio no verificado en Resend
- ❌ Email remitente no usa dominio verificado

**Soluciones**:
1. Ve a "Mi Cuenta" → "Configuración de Email"
2. Verifica que la API Key esté configurada
3. Verifica que el email remitente use tu dominio verificado
4. Revisa logs en Cloudflare Workers Dashboard

### "Token inválido o expirado"

**Causas**:
- ⏰ El enlace tiene más de 1 hora
- 🔒 El token ya fue usado
- ❌ El token no existe

**Solución**:
- Solicita un nuevo enlace desde `/forgot-password`

### "Usuario no recibe email"

**Causas**:
- 📧 Usuario no tiene email configurado en KV
- 🗑️ Email en spam/promociones
- ⏱️ Demora en entrega (usualmente < 1 minuto)

**Soluciones**:
1. Verifica que el usuario tenga campo `email` en KV
2. Revisa carpeta de spam
3. Espera 2-3 minutos
4. Revisa logs de Cloudflare Workers

### "Email remitente no verificado"

**Error en Resend**:
```
Domain not verified
```

**Solución**:
1. Ve a https://resend.com/domains
2. Verifica que tu dominio esté verificado (✅)
3. Si no, verifica los registros DNS
4. Usa `nslookup` o `dig` para confirmar propagación

---

## 📊 APIs Utilizadas

### Solicitar Recuperación

```http
POST /api/auth/request-reset
Content-Type: application/json

{
  "username": "admin"
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "Email de recuperación enviado exitosamente"
}
```

**Usuario No Existe** (respuesta genérica por seguridad):
```json
{
  "success": true,
  "message": "Si el usuario existe y tiene email configurado, recibirás un email de recuperación"
}
```

### Restablecer Contraseña

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "NuevaContraseña123"
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "Contraseña restablecida exitosamente"
}
```

**Token Inválido**:
```json
{
  "success": false,
  "error": "Token inválido o expirado"
}
```

---

## 🎨 Páginas

### `/forgot-password`
- Diseño limpio con degradado azul-verde
- Formulario simple (solo username)
- Info sobre proceso de recuperación
- Enlace de regreso a login

### `/reset-password`
- Validación automática de token
- Requisitos de contraseña visibles
- Indicadores visuales (✅) en tiempo real
- Confirmación de contraseña
- Botones de mostrar/ocultar contraseña

### `/account`
- Sección de configuración de email
- Toggle para mostrar/ocultar API Key
- Validación de email format
- Link directo a Resend
- Sección de cambio de contraseña

---

## ✅ Checklist de Configuración

- [ ] Cuenta en Resend creada
- [ ] Dominio verificado en Resend
- [ ] API Key obtenida
- [ ] API Key configurada en "Mi Cuenta"
- [ ] Email remitente configurado
- [ ] Usuario(s) con campo `email` en KV
- [ ] Prueba de recuperación realizada
- [ ] Email recibido correctamente

---

## 🚀 Ejemplo Completo

```powershell
# 1. Configurar email de usuario admin
$users = wrangler kv key get auth_users --namespace-id=821ab7da6c7b45b098c0470c9abe20ab --remote | ConvertFrom-Json
$users.users[0].email = "admin@tudominio.com"
$usersJson = $users | ConvertTo-Json -Depth 10 -Compress
wrangler kv key put auth_users $usersJson --namespace-id=821ab7da6c7b45b098c0470c9abe20ab --remote

# 2. Ir a dashboard y configurar Resend
# - Login → Mi Cuenta
# - API Key: re_abc123...
# - Email: noreply@tudominio.com
# - Guardar

# 3. Probar recuperación
# - Logout
# - Login → ¿Olvidaste tu contraseña?
# - Usuario: admin
# - Revisar email
# - Click en enlace
# - Nueva contraseña
# - Login con nueva contraseña
```

---

**✨ Sistema de recuperación completo y listo para producción**
