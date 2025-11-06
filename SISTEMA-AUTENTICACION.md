# 🔐 Sistema de Autenticación - Panel de Control

## ✅ Implementado

El panel de control ahora está protegido con un sistema de autenticación completo:
- Login con usuario y contraseña
- Sesiones seguras con cookies HTTP-only
- Contraseñas hasheadas con SHA-256
- Expiración automática de sesiones (24 horas)
- Protección de todas las rutas del dashboard y APIs

---

## 🚀 Inicio Rápido (Primera Configuración)

### **Opción 1: Script Automático (Recomendado)**

```powershell
# Ejecutar script de gestión de usuarios
.\scripts\manage-users.ps1

# Selecciona: 1. Crear primer usuario
# Ingresa tu usuario y contraseña
```

### **Opción 2: Manual**

```powershell
# 1. Crear script temporal
$username = "admin"
$password = "tu_contrasena_segura"
$passwordHash = (echo -n $password | openssl dgst -sha256)

# 2. Crear usuario en KV
wrangler kv:key put --binding=FB_PUBLISHER_KV auth_users '{"users":[{"username":"admin","passwordHash":"HASH_AQUI","name":"Administrador","role":"admin","createdAt":"2025-11-06T..."}]}'
```

---

## 📋 Estructura del Sistema

### **Archivos Creados:**

```
src/
├── auth.js          # Módulo de autenticación
├── login.html       # Página de login
└── index-new.js     # Actualizado con rutas protegidas

scripts/
├── create-user.js   # Script Node.js para crear usuarios
└── manage-users.ps1 # Script PowerShell interactivo
```

### **Datos en Cloudflare KV:**

```javascript
// Clave: "auth_users"
{
  "users": [
    {
      "username": "admin",
      "passwordHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
      "name": "Administrador",
      "role": "admin",
      "createdAt": "2025-11-06T...",
      "lastLogin": "2025-11-06T..."
    }
  ]
}

// Clave: "session:TOKEN_UUID"
{
  "token": "uuid-token-here",
  "username": "admin",
  "name": "Administrador",
  "role": "admin",
  "createdAt": "2025-11-06T...",
  "expiresAt": 1730990400000
}
```

---

## 🔒 Cómo Funciona

### **1. Flujo de Login**

```
Usuario → /login
  ↓
Ingresa credenciales
  ↓
POST /api/auth/login
  ↓
Verifica usuario en KV
  ↓
Hash de contraseña (SHA-256)
  ↓
Compara hashes
  ↓
Crea sesión UUID
  ↓
Guarda en KV con TTL 24h
  ↓
Cookie HTTP-only segura
  ↓
Redirige a /dashboard
```

### **2. Verificación de Sesión**

```
Request → /dashboard
  ↓
Middleware requireAuth()
  ↓
Lee cookie session_token
  ↓
Busca sesión en KV
  ↓
¿Sesión válida y no expirada?
  ├─ SÍ → Continúa al dashboard
  └─ NO → Redirige a /login
```

### **3. Logout**

```
Usuario → Click "Cerrar Sesión"
  ↓
POST /api/auth/logout
  ↓
Elimina sesión de KV
  ↓
Elimina cookie
  ↓
Redirige a /login
```

---

## 🛠️ Gestión de Usuarios

### **Crear Primer Usuario**

```powershell
# Opción A: Script interactivo
.\scripts\manage-users.ps1
# → Opción 1

# Opción B: Script Node.js
node scripts/create-user.js
```

### **Listar Usuarios Existentes**

```powershell
# Con script
.\scripts\manage-users.ps1
# → Opción 2

# Manual
wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users
```

### **Agregar Nuevo Usuario**

```powershell
# Con script
.\scripts\manage-users.ps1
# → Opción 3
```

### **Cambiar Contraseña**

```powershell
# 1. Listar usuarios actuales
wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users > users.json

# 2. Generar nuevo hash
$newPassword = "nueva_contrasena"
$newHash = [System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes($newPassword)
  )
).Replace("-", "").ToLower()

# 3. Editar users.json manualmente
# Reemplazar passwordHash del usuario

# 4. Actualizar en KV
wrangler kv:key put --binding=FB_PUBLISHER_KV auth_users (Get-Content users.json -Raw)
```

---

## 🔐 Seguridad

### **Características de Seguridad:**

✅ **Contraseñas Hasheadas**
- SHA-256 (no reversible)
- Nunca se almacenan en texto plano

✅ **Cookies Seguras**
- HTTP-only (no accesibles desde JavaScript)
- Secure (solo HTTPS)
- SameSite=Strict (protección CSRF)

✅ **Sesiones con Expiración**
- TTL de 24 horas en KV
- Verificación en cada request
- Logout elimina sesión inmediatamente

✅ **Protección de Rutas**
- Todas las rutas del dashboard requieren auth
- Todas las APIs requieren auth
- Rutas públicas: solo /login y /api/auth/login

### **Mejores Prácticas:**

1. **Usa contraseñas fuertes**
   - Mínimo 12 caracteres
   - Mayúsculas, minúsculas, números y símbolos
   - No reutilices contraseñas

2. **Limita el acceso**
   - Crea usuarios solo cuando sea necesario
   - Usa roles apropiados (admin/editor)

3. **Monitorea accesos**
   - Revisa campo `lastLogin` de usuarios
   - Elimina usuarios inactivos

4. **Actualiza contraseñas**
   - Cambia contraseñas periódicamente
   - Si sospechas compromiso, cámbiala inmediatamente

---

## 📱 Uso del Sistema

### **Acceder al Panel**

```
1. Abre: https://tu-worker.workers.dev
2. Redirige automáticamente a /login
3. Ingresa usuario y contraseña
4. Click "Iniciar Sesión"
5. Accedes al dashboard
```

### **Cerrar Sesión**

```
Dashboard → Botón "Cerrar Sesión" (esquina superior derecha)
```

### **Sesión Expirada**

Si la sesión expira (24 horas):
- Automáticamente redirige a /login
- Necesitas volver a autenticarte

---

## 🚨 Troubleshooting

### **Problema: "Usuario o contraseña incorrectos"**

**Solución:**
1. Verifica que el usuario exista:
   ```powershell
   wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users
   ```

2. Si no existe, créalo:
   ```powershell
   .\scripts\manage-users.ps1
   ```

### **Problema: "No puedo acceder después de login"**

**Solución:**
1. Verifica que las cookies estén habilitadas en tu navegador
2. Asegúrate de usar HTTPS (no HTTP)
3. Revisa la consola del navegador para errores

### **Problema: "Olvidé mi contraseña"**

**Solución:**
No hay recuperación automática. Debes:
1. Crear un nuevo usuario con privilegios admin
2. O actualizar el hash de contraseña manualmente en KV

### **Problema: "No hay usuarios configurados"**

**Solución:**
```powershell
# Crear primer usuario
.\scripts\manage-users.ps1
# → Opción 1
```

---

## 🔄 Migración (Si ya tenías el sistema desplegado)

### **Paso 1: Crear primer usuario**

```powershell
.\scripts\manage-users.ps1
```

### **Paso 2: Desplegar nueva versión**

```powershell
wrangler deploy
```

### **Paso 3: Acceder**

```
https://tu-worker.workers.dev → /login
```

---

## 📊 Monitoreo

### **Ver sesiones activas**

```powershell
# Listar todas las claves que empiezan con "session:"
wrangler kv:key list --binding=FB_PUBLISHER_KV --prefix="session:"
```

### **Forzar logout de todas las sesiones**

```powershell
# Obtener lista de sesiones
$sessions = wrangler kv:key list --binding=FB_PUBLISHER_KV --prefix="session:" | ConvertFrom-Json

# Eliminar cada sesión
foreach ($session in $sessions.result) {
    wrangler kv:key delete --binding=FB_PUBLISHER_KV $session.name
}
```

---

## 🎯 Ejemplo Completo

### **Configuración Inicial (Primera Vez)**

```powershell
# 1. Crear primer usuario
.\scripts\manage-users.ps1
# Opción 1
# Usuario: admin
# Contraseña: MiPasswordSeguro123!
# Nombre: Administrador Principal

# 2. Desplegar
wrangler deploy

# 3. Acceder
# Abrir: https://facebook-auto-publisher.jorgeferreirauy.workers.dev
# Login con: admin / MiPasswordSeguro123!

# ✅ ¡Listo! Acceso protegido
```

### **Agregar Usuario Adicional**

```powershell
# 1. Ejecutar script
.\scripts\manage-users.ps1

# 2. Opción 3 - Agregar nuevo usuario
# Usuario: editor1
# Contraseña: EditorPass456!
# Nombre: Editor de Contenido
# Rol: editor

# ✅ Usuario creado
```

---

## 🔗 Rutas del Sistema

### **Públicas (No requieren auth):**
- `GET /login` - Página de login
- `POST /api/auth/login` - Procesar login
- `GET /auth/facebook/callback` - OAuth Facebook (necesario)

### **Protegidas (Requieren auth):**
- `GET /` - Redirige a dashboard
- `GET /dashboard` - Panel principal
- `GET /dashboard.css` - Estilos
- `GET /dashboard.js` - Scripts
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual
- `ALL /api/projects/*` - Gestión de proyectos
- `ALL /api/stats` - Estadísticas
- `ALL /api/settings` - Configuración
- `ALL /api/generate*` - Generación con IA
- `ALL /api/publish` - Publicación

---

## 💡 Notas Importantes

1. **Primera vez**: Debes crear un usuario antes de poder acceder
2. **Sin usuarios**: El panel no será accesible hasta que crees uno
3. **HTTPS**: Las cookies solo funcionan en HTTPS (Workers de Cloudflare usa HTTPS por defecto)
4. **Cookies**: El navegador debe aceptar cookies
5. **Expiración**: Las sesiones expiran después de 24 horas
6. **Multi-ventana**: Puedes tener múltiples pestañas abiertas con la misma sesión

---

## 🎉 ¡Sistema de Autenticación Implementado!

Tu panel de control ahora está protegido y solo usuarios autorizados pueden acceder.

**Próximos pasos:**
1. Crear tu primer usuario
2. Acceder al panel con tus credenciales
3. Gestionar proyectos de forma segura

---

**¿Preguntas?** Revisa la sección de Troubleshooting o crea un issue en GitHub.
