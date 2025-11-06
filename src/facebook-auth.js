/**
 * Manejo de autenticación OAuth de Facebook
 * Permite a los usuarios conectar sus fanpages y otorgar permisos
 */

/**
 * Genera la URL de OAuth de Facebook para iniciar el flujo de autenticación
 */
export function getFacebookLoginUrl(env, projectId, redirectUri) {
  const appId = env.FACEBOOK_APP_ID;
  const permissions = [
    'pages_show_list',           // Ver lista de páginas
    'pages_read_engagement',     // Leer información de la página
    'pages_manage_posts',        // Publicar en la página
    'pages_manage_engagement'    // Gestionar interacciones
  ].join(',');

  const state = JSON.stringify({ projectId, timestamp: Date.now() });
  
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state: state,
    scope: permissions,
    response_type: 'code'
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Maneja el callback de Facebook OAuth
 * Intercambia el code por un access token
 */
export async function handleFacebookCallback(request, env, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Si hubo un error en la autorización
  if (error) {
    return new Response(getErrorHTML(error, url.searchParams.get('error_description')), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (!code) {
    return new Response(getErrorHTML('missing_code', 'No se recibió el código de autorización'), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  try {
    // Parsear el state para obtener el projectId
    const stateData = JSON.parse(state);
    const projectId = stateData.projectId;

    // Intercambiar code por access token
    const appId = env.FACEBOOK_APP_ID;
    const appSecret = env.FACEBOOK_APP_SECRET;
    const redirectUri = `${url.origin}/auth/facebook/callback`;

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${appSecret}&` +
      `code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Error al obtener access token');
    }

    const accessToken = tokenData.access_token;

    // Obtener información del usuario
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
    );
    const userData = await userResponse.json();

    // Obtener las páginas del usuario
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return new Response(getNoPagesHTML(), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Guardar tokens temporalmente para que el usuario seleccione la página
    const tempKey = `temp_auth_${projectId}_${Date.now()}`;
    await env.FB_PUBLISHER_KV.put(tempKey, JSON.stringify({
      userId: userData.id,
      userName: userData.name,
      userToken: accessToken,
      pages: pagesData.data,
      projectId: projectId,
      timestamp: Date.now()
    }), { expirationTtl: 600 }); // Expira en 10 minutos

    // Mostrar página de selección de fanpage
    return new Response(getPageSelectionHTML(pagesData.data, tempKey, projectId), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('Error en Facebook callback:', error);
    return new Response(getErrorHTML('callback_error', error.message), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Guarda la página seleccionada y sus tokens
 */
export async function handlePageSelection(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { tempKey, pageId, projectId } = data;

    // Recuperar datos temporales
    const tempDataStr = await env.FB_PUBLISHER_KV.get(tempKey);
    if (!tempDataStr) {
      throw new Error('Sesión expirada. Por favor, autoriza nuevamente.');
    }

    const tempData = JSON.parse(tempDataStr);
    
    // Encontrar la página seleccionada
    const selectedPage = tempData.pages.find(p => p.id === pageId);
    if (!selectedPage) {
      throw new Error('Página no encontrada');
    }

    // Obtener el token de larga duración para la página
    const longLivedToken = await getLongLivedPageToken(
      selectedPage.access_token,
      env.FACEBOOK_APP_ID,
      env.FACEBOOK_APP_SECRET
    );

    // Actualizar el proyecto con la información de la página
    const projectKey = `project_${projectId}`;
    const projectStr = await env.FB_PUBLISHER_KV.get(projectKey);
    if (!projectStr) {
      throw new Error('Proyecto no encontrado');
    }

    const project = JSON.parse(projectStr);
    project.facebook = {
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageAccessToken: longLivedToken,
      userId: tempData.userId,
      userName: tempData.userName,
      connectedAt: new Date().toISOString()
    };

    // Guardar proyecto actualizado
    await env.FB_PUBLISHER_KV.put(projectKey, JSON.stringify(project));

    // Limpiar datos temporales
    await env.FB_PUBLISHER_KV.delete(tempKey);

    return new Response(JSON.stringify({
      success: true,
      page: {
        id: selectedPage.id,
        name: selectedPage.name
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error al guardar página:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene un token de larga duración para la página
 */
async function getLongLivedPageToken(shortToken, appId, appSecret) {
  try {
    // Primero, obtener un token de usuario de larga duración
    const userTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${appId}&` +
      `client_secret=${appSecret}&` +
      `fb_exchange_token=${shortToken}`;

    const userTokenResponse = await fetch(userTokenUrl);
    const userTokenData = await userTokenResponse.json();

    if (userTokenData.error) {
      throw new Error(userTokenData.error.message);
    }

    // Luego, obtener el token de página con el token de usuario de larga duración
    const pageTokenUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userTokenData.access_token}`;
    const pageTokenResponse = await fetch(pageTokenUrl);
    const pageTokenData = await pageTokenResponse.json();

    if (pageTokenData.data && pageTokenData.data.length > 0) {
      // El primer token de página es de larga duración
      return pageTokenData.data[0].access_token;
    }

    // Si no se pudo obtener, devolver el original
    return shortToken;

  } catch (error) {
    console.error('Error obteniendo token de larga duración:', error);
    // Si falla, devolver el token original
    return shortToken;
  }
}

/**
 * Desconecta una fanpage de un proyecto
 */
export async function handleDisconnectPage(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const projectId = url.pathname.split('/')[3];

    const projectKey = `project_${projectId}`;
    const projectStr = await env.FB_PUBLISHER_KV.get(projectKey);
    
    if (!projectStr) {
      throw new Error('Proyecto no encontrado');
    }

    const project = JSON.parse(projectStr);
    delete project.facebook;

    await env.FB_PUBLISHER_KV.put(projectKey, JSON.stringify(project));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ========== HTML TEMPLATES ==========

function getErrorHTML(errorType, errorDescription) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error de Autorización</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #e74c3c;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .error-code {
            color: #95a5a6;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .error-message {
            color: #34495e;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
        }
        .button:hover {
            background: #764ba2;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">⚠️</div>
        <h1>Error de Autorización</h1>
        <div class="error-code">${errorType}</div>
        <div class="error-message">
            ${errorDescription || 'Ocurrió un error durante el proceso de autorización.'}
        </div>
        <a href="/dashboard" class="button">Volver al Dashboard</a>
    </div>
</body>
</html>
  `;
}

function getNoPagesHTML() {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sin Páginas</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #f39c12;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .message {
            color: #34495e;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            margin: 5px;
        }
        .button:hover {
            background: #764ba2;
            transform: translateY(-2px);
        }
        .button-secondary {
            background: #95a5a6;
        }
        .button-secondary:hover {
            background: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📄</div>
        <h1>No se encontraron páginas</h1>
        <div class="message">
            Tu cuenta de Facebook no tiene páginas asociadas. Para usar este sistema, necesitas ser administrador de al menos una fanpage.
            <br><br>
            <strong>¿Cómo crear una fanpage?</strong><br>
            1. Ve a facebook.com/pages/create<br>
            2. Crea tu página de negocio<br>
            3. Vuelve aquí para conectarla
        </div>
        <a href="https://facebook.com/pages/create" target="_blank" class="button">Crear Fanpage</a>
        <a href="/dashboard" class="button button-secondary">Volver al Dashboard</a>
    </div>
</body>
</html>
  `;
}

function getPageSelectionHTML(pages, tempKey, projectId) {
  const pagesHTML = pages.map(page => `
    <div class="page-item" onclick="selectPage('${page.id}')">
      <div class="page-icon">📄</div>
      <div class="page-info">
        <div class="page-name">${page.name}</div>
        <div class="page-id">ID: ${page.id}</div>
      </div>
      <div class="page-check" id="check-${page.id}">✓</div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seleccionar Fanpage</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
            text-align: center;
        }
        .subtitle {
            color: #95a5a6;
            text-align: center;
            margin-bottom: 30px;
        }
        .pages-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 30px;
            max-height: 400px;
            overflow-y: auto;
        }
        .page-item {
            display: flex;
            align-items: center;
            padding: 20px;
            border: 2px solid #ecf0f1;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .page-item:hover {
            border-color: #667eea;
            background: #f8f9fa;
            transform: translateX(5px);
        }
        .page-item.selected {
            border-color: #667eea;
            background: #eff3ff;
        }
        .page-icon {
            font-size: 40px;
            margin-right: 15px;
        }
        .page-info {
            flex: 1;
        }
        .page-name {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        .page-id {
            font-size: 12px;
            color: #95a5a6;
        }
        .page-check {
            font-size: 24px;
            color: #667eea;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .page-item.selected .page-check {
            opacity: 1;
        }
        .button {
            width: 100%;
            padding: 15px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .button:hover {
            background: #764ba2;
            transform: translateY(-2px);
        }
        .button:disabled {
            background: #95a5a6;
            cursor: not-allowed;
            transform: none;
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
            color: #667eea;
        }
        .loading.active {
            display: block;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Selecciona tu Fanpage</h1>
        <div class="subtitle">Elige la página donde quieres publicar automáticamente</div>
        
        <div class="pages-list">
            ${pagesHTML}
        </div>

        <button id="connectBtn" class="button" onclick="connectPage()" disabled>
            Conectar Página Seleccionada
        </button>

        <div class="loading" id="loading">
            <div class="spinner"></div>
            <div>Conectando página...</div>
        </div>
    </div>

    <script>
        let selectedPageId = null;
        const tempKey = '${tempKey}';
        const projectId = '${projectId}';

        function selectPage(pageId) {
            // Remover selección anterior
            document.querySelectorAll('.page-item').forEach(item => {
                item.classList.remove('selected');
            });

            // Seleccionar nueva página
            event.currentTarget.classList.add('selected');
            selectedPageId = pageId;

            // Habilitar botón
            document.getElementById('connectBtn').disabled = false;
        }

        async function connectPage() {
            if (!selectedPageId) return;

            const button = document.getElementById('connectBtn');
            const loading = document.getElementById('loading');

            button.disabled = true;
            loading.classList.add('active');

            try {
                const response = await fetch('/api/auth/facebook/select-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tempKey: tempKey,
                        pageId: selectedPageId,
                        projectId: projectId
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Redirigir al dashboard con mensaje de éxito
                    window.location.href = '/dashboard?connected=' + encodeURIComponent(data.page.name);
                } else {
                    alert('Error: ' + data.error);
                    button.disabled = false;
                    loading.classList.remove('active');
                }

            } catch (error) {
                alert('Error de conexión: ' + error.message);
                button.disabled = false;
                loading.classList.remove('active');
            }
        }
    </script>
</body>
</html>
  `;
}
