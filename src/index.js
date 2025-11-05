/**
 * Sistema de Auto-publicación en Facebook
 * Publica URLs de tus sitios web en tu fanpage de Facebook automáticamente
 */

export default {
  /**
   * Handler para Cron Triggers - Se ejecuta en los horarios configurados
   */
  async scheduled(event, env, ctx) {
    console.log('Cron trigger ejecutado:', new Date().toISOString());
    
    try {
      await publishNextPost(env);
    } catch (error) {
      console.error('Error en scheduled job:', error);
    }
  },

  /**
   * Handler HTTP - Para gestión manual y configuración
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Rutas disponibles
      if (url.pathname === '/') {
        return new Response(getDashboardHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      if (url.pathname === '/api/posts' && request.method === 'GET') {
        return handleGetPosts(env, corsHeaders);
      }

      if (url.pathname === '/api/posts' && request.method === 'POST') {
        return handleAddPost(request, env, corsHeaders);
      }

      if (url.pathname === '/api/posts/bulk' && request.method === 'POST') {
        return handleBulkAddPosts(request, env, corsHeaders);
      }

      if (url.pathname === '/api/publish' && request.method === 'POST') {
        return handleManualPublish(env, corsHeaders);
      }

      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return handleGetStats(env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/posts/') && request.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        return handleDeletePost(id, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Publica el siguiente post pendiente en Facebook
 */
async function publishNextPost(env) {
  // Obtener todos los posts pendientes
  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  const pendingPosts = postsData.posts.filter(p => p.status === 'pending');

  if (pendingPosts.length === 0) {
    console.log('No hay posts pendientes para publicar');
    return { success: false, message: 'No hay posts pendientes' };
  }

  // Seleccionar el siguiente post (round-robin)
  const nextPost = pendingPosts[0];

  // Publicar en Facebook
  const fbResponse = await publishToFacebook(nextPost, env);

  if (fbResponse.success) {
    // Actualizar el estado del post
    nextPost.status = 'published';
    nextPost.publishedAt = new Date().toISOString();
    nextPost.facebookPostId = fbResponse.postId;
    
    await env.FB_PUBLISHER_KV.put('posts', JSON.stringify(postsData));

    // Guardar estadísticas
    await updateStats(env, 'published');

    console.log('Post publicado exitosamente:', nextPost.id);
    return { success: true, post: nextPost };
  } else {
    // Marcar como error
    nextPost.status = 'error';
    nextPost.lastError = fbResponse.error;
    nextPost.errorAt = new Date().toISOString();
    
    await env.FB_PUBLISHER_KV.put('posts', JSON.stringify(postsData));
    await updateStats(env, 'error');

    console.error('Error al publicar post:', fbResponse.error);
    return { success: false, error: fbResponse.error };
  }
}

/**
 * Publica un post en Facebook usando la Graph API
 */
async function publishToFacebook(post, env) {
  const pageAccessToken = env.FB_PAGE_ACCESS_TOKEN;
  const pageId = env.FB_PAGE_ID;
  const apiVersion = env.FACEBOOK_API_VERSION || 'v18.0';

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Credenciales de Facebook no configuradas' };
  }

  const apiUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/feed`;

  // Preparar el mensaje con la URL
  const message = `${post.message}\n\n${post.url}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        link: post.url,
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();

    if (response.ok && data.id) {
      return { success: true, postId: data.id };
    } else {
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Actualizar estadísticas
 */
async function updateStats(env, action) {
  const stats = await env.FB_PUBLISHER_KV.get('stats', { type: 'json' }) || {
    totalPublished: 0,
    totalErrors: 0,
    lastPublish: null,
  };

  if (action === 'published') {
    stats.totalPublished++;
    stats.lastPublish = new Date().toISOString();
  } else if (action === 'error') {
    stats.totalErrors++;
  }

  await env.FB_PUBLISHER_KV.put('stats', JSON.stringify(stats));
}

/**
 * Handlers de API
 */
async function handleGetPosts(env, corsHeaders) {
  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  return new Response(JSON.stringify(postsData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleAddPost(request, env, corsHeaders) {
  const post = await request.json();
  
  const newPost = {
    id: generateId(),
    url: post.url,
    message: post.message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  postsData.posts.push(newPost);
  
  await env.FB_PUBLISHER_KV.put('posts', JSON.stringify(postsData));

  return new Response(JSON.stringify({ success: true, post: newPost }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleBulkAddPosts(request, env, corsHeaders) {
  const { posts } = await request.json();
  
  const newPosts = posts.map(post => ({
    id: generateId(),
    url: post.url,
    message: post.message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));

  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  postsData.posts.push(...newPosts);
  
  await env.FB_PUBLISHER_KV.put('posts', JSON.stringify(postsData));

  return new Response(JSON.stringify({ success: true, count: newPosts.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleManualPublish(env, corsHeaders) {
  const result = await publishNextPost(env);
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGetStats(env, corsHeaders) {
  const stats = await env.FB_PUBLISHER_KV.get('stats', { type: 'json' }) || {
    totalPublished: 0,
    totalErrors: 0,
    lastPublish: null,
  };

  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  stats.totalPosts = postsData.posts.length;
  stats.pendingPosts = postsData.posts.filter(p => p.status === 'pending').length;

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleDeletePost(id, env, corsHeaders) {
  const postsData = await env.FB_PUBLISHER_KV.get('posts', { type: 'json' }) || { posts: [] };
  postsData.posts = postsData.posts.filter(p => p.id !== id);
  
  await env.FB_PUBLISHER_KV.put('posts', JSON.stringify(postsData));

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Utilidades
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Dashboard HTML
 */
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto-Publisher Facebook</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f0f2f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #1877f2; margin-bottom: 30px; }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
        .stat-card .value { font-size: 32px; font-weight: bold; color: #1877f2; }
        .section { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            margin-bottom: 20px; 
        }
        .section h2 { margin-bottom: 20px; color: #333; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #666; font-weight: 500; }
        .form-group input, .form-group textarea { 
            width: 100%; 
            padding: 10px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            font-size: 14px; 
        }
        .form-group textarea { min-height: 80px; resize: vertical; }
        button { 
            background: #1877f2; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: 600; 
        }
        button:hover { background: #166fe5; }
        button.secondary { background: #42b72a; }
        button.secondary:hover { background: #36a420; }
        button.danger { background: #dc3545; }
        button.danger:hover { background: #c82333; }
        .posts-list { margin-top: 20px; }
        .post-item { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 4px; 
            display: flex; 
            justify-content: space-between; 
            align-items: start; 
        }
        .post-item.published { border-left: 4px solid #42b72a; }
        .post-item.pending { border-left: 4px solid #ffa500; }
        .post-item.error { border-left: 4px solid #dc3545; }
        .post-content { flex: 1; }
        .post-url { color: #1877f2; font-weight: 500; margin-bottom: 5px; }
        .post-message { color: #666; font-size: 14px; margin-bottom: 5px; }
        .post-status { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: 600; 
        }
        .post-status.published { background: #d4edda; color: #155724; }
        .post-status.pending { background: #fff3cd; color: #856404; }
        .post-status.error { background: #f8d7da; color: #721c24; }
        .post-actions { display: flex; gap: 10px; }
        .message { 
            padding: 12px; 
            border-radius: 4px; 
            margin-bottom: 15px; 
            display: none; 
        }
        .message.success { background: #d4edda; color: #155724; display: block; }
        .message.error { background: #f8d7da; color: #721c24; display: block; }
        .bulk-format { 
            background: #f8f9fa; 
            padding: 10px; 
            border-radius: 4px; 
            font-family: monospace; 
            font-size: 12px; 
            margin-top: 10px; 
            color: #666; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📘 Auto-Publisher para Facebook</h1>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total Posts</h3>
                <div class="value" id="totalPosts">0</div>
            </div>
            <div class="stat-card">
                <h3>Pendientes</h3>
                <div class="value" id="pendingPosts">0</div>
            </div>
            <div class="stat-card">
                <h3>Publicados</h3>
                <div class="value" id="publishedPosts">0</div>
            </div>
            <div class="stat-card">
                <h3>Errores</h3>
                <div class="value" id="errorPosts">0</div>
            </div>
        </div>

        <div class="section">
            <h2>➕ Agregar Post Individual</h2>
            <div id="message" class="message"></div>
            <div class="form-group">
                <label>URL del sitio</label>
                <input type="url" id="postUrl" placeholder="https://tusitio.com/pagina">
            </div>
            <div class="form-group">
                <label>Mensaje personalizado</label>
                <textarea id="postMessage" placeholder="¡Mira este increíble contenido! 🚀"></textarea>
            </div>
            <button onclick="addPost()">Agregar Post</button>
            <button class="secondary" onclick="publishNow()">Publicar Ahora</button>
        </div>

        <div class="section">
            <h2>📦 Agregar Posts en Lote</h2>
            <div class="form-group">
                <label>Posts en formato JSON</label>
                <textarea id="bulkPosts" rows="10" placeholder='[
  {"url": "https://sitio1.com", "message": "Mensaje 1"},
  {"url": "https://sitio2.com", "message": "Mensaje 2"}
]'></textarea>
            </div>
            <div class="bulk-format">
                Formato: Array de objetos JSON con propiedades "url" y "message"
            </div>
            <button onclick="addBulkPosts()">Agregar Posts en Lote</button>
        </div>

        <div class="section">
            <h2>📋 Lista de Posts</h2>
            <div id="postsList" class="posts-list"></div>
        </div>
    </div>

    <script>
        // Cargar datos al inicio
        loadStats();
        loadPosts();

        async function loadStats() {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            document.getElementById('totalPosts').textContent = stats.totalPosts || 0;
            document.getElementById('pendingPosts').textContent = stats.pendingPosts || 0;
            document.getElementById('publishedPosts').textContent = stats.totalPublished || 0;
            document.getElementById('errorPosts').textContent = stats.totalErrors || 0;
        }

        async function loadPosts() {
            const response = await fetch('/api/posts');
            const data = await response.json();
            const postsHtml = data.posts.map(post => \`
                <div class="post-item \${post.status}">
                    <div class="post-content">
                        <div class="post-url">\${post.url}</div>
                        <div class="post-message">\${post.message}</div>
                        <span class="post-status \${post.status}">\${post.status.toUpperCase()}</span>
                        \${post.publishedAt ? \`<small> - Publicado: \${new Date(post.publishedAt).toLocaleString('es')}</small>\` : ''}
                        \${post.errorAt ? \`<small> - Error: \${post.lastError}</small>\` : ''}
                    </div>
                    <div class="post-actions">
                        <button class="danger" onclick="deletePost('\${post.id}')">Eliminar</button>
                    </div>
                </div>
            \`).join('');
            document.getElementById('postsList').innerHTML = postsHtml || '<p>No hay posts aún</p>';
        }

        async function addPost() {
            const url = document.getElementById('postUrl').value;
            const message = document.getElementById('postMessage').value;

            if (!url || !message) {
                showMessage('Por favor completa todos los campos', 'error');
                return;
            }

            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, message })
            });

            if (response.ok) {
                showMessage('Post agregado exitosamente', 'success');
                document.getElementById('postUrl').value = '';
                document.getElementById('postMessage').value = '';
                loadStats();
                loadPosts();
            } else {
                showMessage('Error al agregar post', 'error');
            }
        }

        async function addBulkPosts() {
            try {
                const posts = JSON.parse(document.getElementById('bulkPosts').value);
                
                const response = await fetch('/api/posts/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ posts })
                });

                if (response.ok) {
                    const result = await response.json();
                    showMessage(\`\${result.count} posts agregados exitosamente\`, 'success');
                    document.getElementById('bulkPosts').value = '';
                    loadStats();
                    loadPosts();
                } else {
                    showMessage('Error al agregar posts', 'error');
                }
            } catch (e) {
                showMessage('Error en el formato JSON', 'error');
            }
        }

        async function publishNow() {
            if (!confirm('¿Publicar el siguiente post pendiente ahora?')) return;

            const response = await fetch('/api/publish', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                showMessage('Post publicado exitosamente', 'success');
                loadStats();
                loadPosts();
            } else {
                showMessage('Error: ' + (result.error || result.message), 'error');
            }
        }

        async function deletePost(id) {
            if (!confirm('¿Eliminar este post?')) return;

            const response = await fetch(\`/api/posts/\${id}\`, { method: 'DELETE' });
            
            if (response.ok) {
                showMessage('Post eliminado', 'success');
                loadStats();
                loadPosts();
            } else {
                showMessage('Error al eliminar post', 'error');
            }
        }

        function showMessage(text, type) {
            const msg = document.getElementById('message');
            msg.textContent = text;
            msg.className = 'message ' + type;
            setTimeout(() => msg.className = 'message', 3000);
        }
    </script>
</body>
</html>`;
}
