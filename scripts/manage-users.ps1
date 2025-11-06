# Script PowerShell para gestionar usuarios del sistema
# Uso: .\scripts\manage-users.ps1

function Show-Menu {
    Clear-Host
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "   🔐 GESTIÓN DE USUARIOS - Panel de Control" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Crear primer usuario (Inicio rápido)" -ForegroundColor Green
    Write-Host "2. Listar usuarios existentes" -ForegroundColor Yellow
    Write-Host "3. Agregar nuevo usuario" -ForegroundColor Green
    Write-Host "4. Eliminar usuario" -ForegroundColor Red
    Write-Host "5. Cambiar contraseña" -ForegroundColor Magenta
    Write-Host "0. Salir" -ForegroundColor Gray
    Write-Host ""
}

function Get-PasswordHash {
    param([string]$Password)
    
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Password)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ''
}

function Create-FirstUser {
    Write-Host ""
    Write-Host "🚀 CREAR PRIMER USUARIO" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    $username = Read-Host "👤 Nombre de usuario"
    if (-not $username) {
        Write-Host "❌ El usuario es requerido" -ForegroundColor Red
        return
    }
    
    $password = Read-Host "🔑 Contraseña" -AsSecureString
    $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
    
    if ($passwordPlain.Length -lt 6) {
        Write-Host "❌ La contraseña debe tener al menos 6 caracteres" -ForegroundColor Red
        return
    }
    
    $name = Read-Host "📝 Nombre completo (Enter para usar '$username')"
    if (-not $name) { $name = $username }
    
    Write-Host ""
    Write-Host "⏳ Creando usuario..." -ForegroundColor Yellow
    
    $passwordHash = Get-PasswordHash -Password $passwordPlain
    
    $userData = @{
        users = @(
            @{
                username = $username
                passwordHash = $passwordHash
                name = $name
                role = "admin"
                createdAt = (Get-Date -Format "o")
            }
        )
    } | ConvertTo-Json -Compress
    
    try {
        wrangler kv:key put --binding=FB_PUBLISHER_KV auth_users $userData --preview false
        Write-Host ""
        Write-Host "✅ Usuario creado exitosamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Detalles:" -ForegroundColor Cyan
        Write-Host "   Usuario: $username" -ForegroundColor White
        Write-Host "   Nombre: $name" -ForegroundColor White
        Write-Host "   Rol: admin" -ForegroundColor White
        Write-Host ""
        Write-Host "🌐 Ya puedes acceder a: https://tu-worker.workers.dev/login" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "❌ Error al crear usuario: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
}

function List-Users {
    Write-Host ""
    Write-Host "👥 USUARIOS EXISTENTES" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $usersJson = wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users --preview false 2>&1
        
        if ($LASTEXITCODE -ne 0 -or $usersJson -match "not found") {
            Write-Host "⚠️  No hay usuarios configurados" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "💡 Usa la opción 1 para crear el primer usuario" -ForegroundColor Cyan
        }
        else {
            $users = ($usersJson | ConvertFrom-Json).users
            
            if ($users.Count -eq 0) {
                Write-Host "⚠️  No hay usuarios configurados" -ForegroundColor Yellow
            }
            else {
                Write-Host "Total: $($users.Count) usuario(s)" -ForegroundColor Green
                Write-Host ""
                
                foreach ($user in $users) {
                    Write-Host "  👤 $($user.username)" -ForegroundColor White
                    Write-Host "     Nombre: $($user.name)" -ForegroundColor Gray
                    Write-Host "     Rol: $($user.role)" -ForegroundColor Gray
                    if ($user.lastLogin) {
                        Write-Host "     Último login: $($user.lastLogin)" -ForegroundColor Gray
                    }
                    Write-Host ""
                }
            }
        }
    }
    catch {
        Write-Host "❌ Error al listar usuarios: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
}

function Add-User {
    Write-Host ""
    Write-Host "➕ AGREGAR NUEVO USUARIO" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $usersJson = wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users --preview false 2>&1
        
        if ($LASTEXITCODE -ne 0 -or $usersJson -match "not found") {
            Write-Host "⚠️  No hay usuarios. Usa la opción 1 primero." -ForegroundColor Yellow
            Read-Host "Presiona Enter para continuar"
            return
        }
        
        $usersData = $usersJson | ConvertFrom-Json
        
        $username = Read-Host "👤 Nombre de usuario"
        if (-not $username) {
            Write-Host "❌ El usuario es requerido" -ForegroundColor Red
            Read-Host "Presiona Enter para continuar"
            return
        }
        
        # Verificar si ya existe
        if ($usersData.users | Where-Object { $_.username -eq $username }) {
            Write-Host "❌ El usuario '$username' ya existe" -ForegroundColor Red
            Read-Host "Presiona Enter para continuar"
            return
        }
        
        $password = Read-Host "🔑 Contraseña" -AsSecureString
        $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
        
        if ($passwordPlain.Length -lt 6) {
            Write-Host "❌ La contraseña debe tener al menos 6 caracteres" -ForegroundColor Red
            Read-Host "Presiona Enter para continuar"
            return
        }
        
        $name = Read-Host "📝 Nombre completo (Enter para usar '$username')"
        if (-not $name) { $name = $username }
        
        $role = Read-Host "👔 Rol (admin/editor, Enter para 'admin')"
        if (-not $role) { $role = "admin" }
        
        Write-Host ""
        Write-Host "⏳ Agregando usuario..." -ForegroundColor Yellow
        
        $passwordHash = Get-PasswordHash -Password $passwordPlain
        
        $newUser = @{
            username = $username
            passwordHash = $passwordHash
            name = $name
            role = $role
            createdAt = (Get-Date -Format "o")
        }
        
        $usersData.users += $newUser
        
        $updatedJson = $usersData | ConvertTo-Json -Compress
        
        wrangler kv:key put --binding=FB_PUBLISHER_KV auth_users $updatedJson --preview false
        
        Write-Host ""
        Write-Host "✅ Usuario agregado exitosamente!" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Read-Host "Presiona Enter para continuar"
}

# Menú principal
do {
    Show-Menu
    $choice = Read-Host "Selecciona una opción"
    
    switch ($choice) {
        "1" { Create-FirstUser }
        "2" { List-Users }
        "3" { Add-User }
        "0" { 
            Write-Host ""
            Write-Host "👋 ¡Hasta luego!" -ForegroundColor Cyan
            Write-Host ""
            break 
        }
        default {
            Write-Host ""
            Write-Host "❌ Opción inválida" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
} while ($choice -ne "0")
