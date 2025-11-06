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
