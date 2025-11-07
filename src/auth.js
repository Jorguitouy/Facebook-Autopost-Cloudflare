/**
 * Sistema de Autenticación para el Panel de Control
 * Protege el acceso al dashboard y sus APIs
 */

/**
 * Genera un hash SHA-256 de la contraseña
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera un token de sesión aleatorio
 */
function generateSessionToken() {
  return crypto.randomUUID();
}

/**
 * Verifica las credenciales del usuario
 */
async function verifyCredentials(username, password, env) {
  try {
    // Obtener usuarios desde KV
    const usersData = await env.FB_PUBLISHER_KV.get('auth_users', { type: 'json' });
    
    if (!usersData || !usersData.users) {
      console.log('[Auth] No hay usuarios configurados');
      return null;
    }
    
    // Buscar usuario
    const user = usersData.users.find(u => u.username === username);
    
    if (!user) {
      console.log(`[Auth] Usuario no encontrado: ${username}`);
      return null;
    }
    
    // Verificar contraseña hasheada
    const passwordHash = await hashPassword(password);
    
    if (passwordHash !== user.passwordHash) {
      console.log(`[Auth] Contraseña incorrecta para: ${username}`);
      return null;
    }
    
    // Actualizar último login
    user.lastLogin = new Date().toISOString();
    await env.FB_PUBLISHER_KV.put('auth_users', JSON.stringify(usersData));
    
    console.log(`[Auth] Login exitoso: ${username}`);
    return {
      username: user.username,
      name: user.name || username,
      role: user.role || 'admin'
    };
  } catch (error) {
    console.error('[Auth] Error verificando credenciales:', error);
    return null;
  }
}

/**
 * Crea una sesión para el usuario
 */
async function createSession(user, env) {
  const sessionToken = generateSessionToken();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
  
  const session = {
    token: sessionToken,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt
  };
  
  // Guardar sesión en KV con TTL de 24 horas
  await env.FB_PUBLISHER_KV.put(
    `session:${sessionToken}`, 
    JSON.stringify(session),
    { expirationTtl: 86400 } // 24 horas
  );
  
  return sessionToken;
}

/**
 * Verifica si una sesión es válida
 */
async function verifySession(sessionToken, env) {
  if (!sessionToken) {
    return null;
  }
  
  try {
    const sessionData = await env.FB_PUBLISHER_KV.get(`session:${sessionToken}`, { type: 'json' });
    
    if (!sessionData) {
      console.log('[Auth] Sesión no encontrada o expirada');
      return null;
    }
    
    // Verificar si la sesión ha expirado
    if (Date.now() > sessionData.expiresAt) {
      console.log('[Auth] Sesión expirada');
      await env.FB_PUBLISHER_KV.delete(`session:${sessionToken}`);
      return null;
    }
    
    return {
      username: sessionData.username,
      name: sessionData.name,
      role: sessionData.role
    };
  } catch (error) {
    console.error('[Auth] Error verificando sesión:', error);
    return null;
  }
}

/**
 * Elimina una sesión (logout)
 */
async function deleteSession(sessionToken, env) {
  if (!sessionToken) {
    return;
  }
  
  try {
    await env.FB_PUBLISHER_KV.delete(`session:${sessionToken}`);
    console.log('[Auth] Sesión eliminada');
  } catch (error) {
    console.error('[Auth] Error eliminando sesión:', error);
  }
}

/**
 * Obtiene el token de sesión desde las cookies
 */
function getSessionTokenFromCookie(request) {
  const cookieHeader = request.headers.get('Cookie');
  
  if (!cookieHeader) {
    return null;
  }
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session_token='));
  
  if (!sessionCookie) {
    return null;
  }
  
  return sessionCookie.split('=')[1];
}

/**
 * Crea una cookie de sesión
 */
function createSessionCookie(sessionToken, maxAge = 86400) {
  return `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/**
 * Crea una cookie para eliminar la sesión
 */
function deleteSessionCookie() {
  return 'session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

/**
 * Middleware para verificar autenticación
 * Retorna el usuario si está autenticado, null si no
 */
export async function requireAuth(request, env) {
  const sessionToken = getSessionTokenFromCookie(request);
  return await verifySession(sessionToken, env);
}

/**
 * Handler para login (POST /api/auth/login)
 */
export async function handleLogin(request, env, corsHeaders) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuario y contraseña requeridos' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar credenciales
    const user = await verifyCredentials(username, password, env);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuario o contraseña incorrectos' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Crear sesión
    const sessionToken = await createSession(user, env);
    
    return new Response(JSON.stringify({ 
      success: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(sessionToken)
      }
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para logout (POST /api/auth/logout)
 */
export async function handleLogout(request, env, corsHeaders) {
  try {
    const sessionToken = getSessionTokenFromCookie(request);
    
    if (sessionToken) {
      await deleteSession(sessionToken, env);
    }
    
    return new Response(JSON.stringify({ 
      success: true 
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': deleteSessionCookie()
      }
    });
  } catch (error) {
    console.error('[Auth] Error en logout:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para verificar sesión (GET /api/auth/me)
 */
export async function handleGetCurrentUser(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        authenticated: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      authenticated: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error obteniendo usuario:', error);
    return new Response(JSON.stringify({ 
      authenticated: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Función auxiliar para crear/actualizar usuarios
 * Debe ejecutarse manualmente desde Wrangler CLI o un script
 */
export async function createOrUpdateUser(username, password, name, role, env) {
  const passwordHash = await hashPassword(password);
  
  // Obtener usuarios existentes
  const usersData = await env.FB_PUBLISHER_KV.get('auth_users', { type: 'json' }) || { users: [] };
  
  // Buscar si el usuario ya existe
  const existingIndex = usersData.users.findIndex(u => u.username === username);
  
  const user = {
    username,
    passwordHash,
    name: name || username,
    role: role || 'admin',
    createdAt: existingIndex === -1 ? new Date().toISOString() : usersData.users[existingIndex].createdAt,
    updatedAt: new Date().toISOString()
  };
  
  if (existingIndex !== -1) {
    // Actualizar usuario existente
    usersData.users[existingIndex] = user;
  } else {
    // Agregar nuevo usuario
    usersData.users.push(user);
  }
  
  // Guardar en KV
  await env.FB_PUBLISHER_KV.put('auth_users', JSON.stringify(usersData));
  
  return user;
}

/**
 * Cambiar contraseña del usuario autenticado
 */
export async function handleChangePassword(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No autenticado' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { currentPassword, newPassword } = await request.json();
    
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Contraseña actual y nueva requeridas' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar contraseña actual
    const verifiedUser = await verifyCredentials(user.username, currentPassword, env);
    
    if (!verifiedUser) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Contraseña actual incorrecta' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Actualizar contraseña
    const usersData = await env.FB_PUBLISHER_KV.get('auth_users', { type: 'json' });
    const userIndex = usersData.users.findIndex(u => u.username === user.username);
    
    if (userIndex === -1) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuario no encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    usersData.users[userIndex].passwordHash = await hashPassword(newPassword);
    usersData.users[userIndex].updatedAt = new Date().toISOString();
    
    await env.FB_PUBLISHER_KV.put('auth_users', JSON.stringify(usersData));
    
    console.log(`[Auth] Contraseña cambiada: ${user.username}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Contraseña actualizada exitosamente'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error cambiando contraseña:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Genera un token de recuperación de contraseña
 */
function generateResetToken() {
  return crypto.randomUUID();
}

/**
 * Envía email de recuperación usando Resend
 */
async function sendPasswordResetEmail(email, username, resetToken, env) {
  try {
    // Obtener configuración de email
    const emailConfig = await env.FB_PUBLISHER_KV.get('email_config', { type: 'json' });
    
    if (!emailConfig || !emailConfig.resendApiKey) {
      console.error('[Auth] Resend API Key no configurada');
      return { success: false, error: 'Servicio de email no configurado' };
    }
    
    const resetUrl = `${env.WORKER_URL || 'https://facebook-auto-publisher.jorguitouy.workers.dev'}/reset-password?token=${resetToken}`;
    
    const emailData = {
      from: emailConfig.fromEmail || 'noreply@example.com',
      to: email,
      subject: 'Recuperación de Contraseña - Facebook Auto Publisher',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1877f2;">🔐 Recuperación de Contraseña</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #1877f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>Este enlace expirará en 1 hora.</strong></p>
          <p>Si no solicitaste este cambio, ignora este email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e6eb;">
          <p style="color: #666; font-size: 12px;">
            Este es un email automático, por favor no respondas.
          </p>
        </div>
      `
    };
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Auth] Error enviando email:', errorData);
      return { success: false, error: 'Error al enviar email' };
    }
    
    console.log(`[Auth] Email de recuperación enviado a: ${email}`);
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error enviando email:', error);
    return { success: false, error: 'Error al enviar email' };
  }
}

/**
 * Handler para solicitar recuperación de contraseña
 */
export async function handleRequestPasswordReset(request, env, corsHeaders) {
  try {
    const { username } = await request.json();
    
    if (!username) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuario requerido' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener usuario
    const usersData = await env.FB_PUBLISHER_KV.get('auth_users', { type: 'json' });
    const user = usersData?.users?.find(u => u.username === username);
    
    // Por seguridad, siempre respondemos con éxito aunque el usuario no exista
    if (!user || !user.email) {
      console.log(`[Auth] Usuario no encontrado o sin email: ${username}`);
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Si el usuario existe y tiene email configurado, recibirás un email de recuperación'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Generar token
    const resetToken = generateResetToken();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hora
    
    // Guardar token en KV
    await env.FB_PUBLISHER_KV.put(
      `reset:${resetToken}`,
      JSON.stringify({
        username: user.username,
        createdAt: new Date().toISOString(),
        expiresAt
      }),
      { expirationTtl: 3600 } // 1 hora
    );
    
    // Enviar email
    const emailResult = await sendPasswordResetEmail(user.email, user.username, resetToken, env);
    
    if (!emailResult.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: emailResult.error 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Email de recuperación enviado exitosamente'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error en solicitud de recuperación:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para restablecer contraseña con token
 */
export async function handleResetPassword(request, env, corsHeaders) {
  try {
    const { token, newPassword } = await request.json();
    
    if (!token || !newPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Token y nueva contraseña requeridos' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar token
    const resetData = await env.FB_PUBLISHER_KV.get(`reset:${token}`, { type: 'json' });
    
    if (!resetData) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Token inválido o expirado' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar expiración
    if (Date.now() > resetData.expiresAt) {
      await env.FB_PUBLISHER_KV.delete(`reset:${token}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Token expirado' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Actualizar contraseña
    const usersData = await env.FB_PUBLISHER_KV.get('auth_users', { type: 'json' });
    const userIndex = usersData.users.findIndex(u => u.username === resetData.username);
    
    if (userIndex === -1) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuario no encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    usersData.users[userIndex].passwordHash = await hashPassword(newPassword);
    usersData.users[userIndex].updatedAt = new Date().toISOString();
    
    await env.FB_PUBLISHER_KV.put('auth_users', JSON.stringify(usersData));
    
    // Eliminar token usado
    await env.FB_PUBLISHER_KV.delete(`reset:${token}`);
    
    console.log(`[Auth] Contraseña restablecida: ${resetData.username}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Contraseña restablecida exitosamente'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error restableciendo contraseña:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Guardar configuración de email
 */
export async function handleSaveEmailConfig(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env);
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Acceso denegado. Solo administradores.' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { resendApiKey, fromEmail } = await request.json();
    
    if (!fromEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email remitente requerido' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener configuración existente
    const existingConfig = await env.FB_PUBLISHER_KV.get('email_config', { type: 'json' }) || {};
    
    const config = {
      fromEmail,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username
    };
    
    // Solo actualizar API key si se proporcionó una nueva
    if (resendApiKey) {
      config.resendApiKey = resendApiKey;
    } else if (existingConfig.resendApiKey) {
      config.resendApiKey = existingConfig.resendApiKey;
    }
    
    await env.FB_PUBLISHER_KV.put('email_config', JSON.stringify(config));
    
    console.log(`[Auth] Configuración de email actualizada por: ${user.username}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Configuración guardada exitosamente'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error guardando configuración de email:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtener configuración de email (sin exponer API key)
 */
export async function handleGetEmailConfig(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No autenticado' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const config = await env.FB_PUBLISHER_KV.get('email_config', { type: 'json' }) || {};
    
    return new Response(JSON.stringify({ 
      success: true,
      fromEmail: config.fromEmail || '',
      hasApiKey: !!config.resendApiKey
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Auth] Error obteniendo configuración de email:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error en el servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
