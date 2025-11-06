/**
 * Handlers adicionales para posts, generación de contenido y publicación
 */

// ========================================
// POSTS POR PROYECTO
// ========================================

export async function handleAddProjectPost(projectId, request, env, corsHeaders) {
  const data = await request.json();
  
  const newPost = {
    id: generateId(),
    url: data.url,
    message: data.message,
    title: data.title || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    aiGenerated: data.aiGenerated || false
  };

  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  projectPosts.posts.push(newPost);
  
  await env.FB_PUBLISHER_KV.put(`project:${projectId}:posts`, JSON.stringify(projectPosts));
  await updateProjectStats(projectId, env, 'add');

  return new Response(JSON.stringify({ success: true, post: newPost }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function handleBulkAddProjectPosts(projectId, request, env, corsHeaders) {
  const { posts, generateContent } = await request.json();
  
  let newPosts = [];
  
  // Verificar si hay API key configurada para generación de contenido (SOLO desde KV)
  const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
  
  if (generateContent && aiApiKey) {
    // Generar contenido con IA para cada URL
    for (const post of posts) {
      const content = await generateContentFromURL(post.url, post.context || '', env);
      newPosts.push({
        id: generateId(),
        url: post.url,
        message: content.message,
        title: content.title,
        status: 'pending',
        createdAt: new Date().toISOString(),
        aiGenerated: true
      });
    }
  } else {
    // Agregar posts sin generación de IA
    newPosts = posts.map(post => ({
      id: generateId(),
      url: post.url,
      message: post.message,
      title: post.title || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      aiGenerated: false
    }));
  }

  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  projectPosts.posts.push(...newPosts);
  
  await env.FB_PUBLISHER_KV.put(`project:${projectId}:posts`, JSON.stringify(projectPosts));
  
  // Actualizar estadísticas
  for (let i = 0; i < newPosts.length; i++) {
    await updateProjectStats(projectId, env, 'add');
  }

  return new Response(JSON.stringify({ success: true, count: newPosts.length, posts: newPosts }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function handleDeleteProjectPost(projectId, postId, env, corsHeaders) {
  console.log(`Eliminando post: projectId=${projectId}, postId=${postId}`);
  
  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  console.log(`Posts antes de eliminar: ${projectPosts.posts.length}`);
  
  const initialLength = projectPosts.posts.length;
  projectPosts.posts = projectPosts.posts.filter(p => p.id !== postId);
  
  console.log(`Posts después de eliminar: ${projectPosts.posts.length}, Eliminados: ${initialLength - projectPosts.posts.length}`);
  
  await env.FB_PUBLISHER_KV.put(`project:${projectId}:posts`, JSON.stringify(projectPosts));

  return new Response(JSON.stringify({ 
    success: true,
    deleted: initialLength - projectPosts.posts.length > 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ========================================
// GENERACIÓN DE CONTENIDO CON IA
// ========================================

export async function handleGenerateContent(request, env, corsHeaders) {
  const { url, context, template } = await request.json();
  
  // Verificar si hay API key configurada (SOLO desde KV/Panel Web)
  const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
  if (!aiApiKey) {
    return new Response(JSON.stringify({ 
      error: 'API Key de IA no configurada. Por favor configúrala desde el Panel Web (Tab Configuración).' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const content = await generateContentFromURL(url, context, env, template);
    
    return new Response(JSON.stringify({ 
      success: true, 
      content 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function handleGenerateBulkContent(request, env, corsHeaders) {
  const { urls, context, template } = await request.json();
  
  // Verificar si hay API key configurada (SOLO desde KV/Panel Web)
  const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
  if (!aiApiKey) {
    return new Response(JSON.stringify({ 
      error: 'API Key de IA no configurada. Por favor configúrala desde el Panel Web (Tab Configuración).' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const results = [];
  
  for (const url of urls) {
    try {
      const content = await generateContentFromURL(url, context, env, template);
      results.push({
        url,
        success: true,
        content
      });
    } catch (error) {
      results.push({
        url,
        success: false,
        error: error.message
      });
    }
    
    // Pequeña pausa para no sobrecargar la API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return new Response(JSON.stringify({ 
    success: true, 
    results 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Genera contenido usando IA (OpenAI o Gemini) basándose en la URL
 */
async function generateContentFromURL(url, context = '', env, template = '') {
  console.log(`[generateContentFromURL] Iniciando generación para: ${url}`);
  
  // Obtener configuración de IA SOLO desde KV (Panel Web)
  const aiProvider = await env.FB_PUBLISHER_KV.get('AI_PROVIDER') || 'openai';
  const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
  
  console.log(`[generateContentFromURL] Provider: ${aiProvider}, API Key existe: ${!!aiApiKey}`);
  
  if (!aiApiKey) {
    throw new Error('API Key de IA no configurada. Por favor configúrala desde el Panel Web (Tab Configuración).');
  }
  
  // Obtener contenido de la URL
  let pageContent = '';
  let pageTitle = '';
  let pageDescription = '';
  
  try {
    console.log(`[generateContentFromURL] Obteniendo contenido de: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`[generateContentFromURL] Error HTTP: ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`[generateContentFromURL] HTML obtenido, tamaño: ${html.length} caracteres`);
    
    // Extraer título
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    pageTitle = titleMatch ? titleMatch[1].trim() : '';
    
    // Extraer meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    pageDescription = descMatch ? descMatch[1].trim() : '';
    
    // Extraer Open Graph
    if (!pageTitle) {
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
      pageTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';
    }
    
    if (!pageDescription) {
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
      pageDescription = ogDescMatch ? ogDescMatch[1].trim() : '';
    }
    
    // Extraer primeros párrafos de contenido
    const contentMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
    const firstParagraph = contentMatch ? contentMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    
    console.log(`[generateContentFromURL] Título: ${pageTitle}`);
    console.log(`[generateContentFromURL] Descripción: ${pageDescription}`);
    
    pageContent = `URL: ${url}
Título: ${pageTitle || 'Sin título'}
Descripción: ${pageDescription || 'Sin descripción'}
${firstParagraph ? `Contenido: ${firstParagraph.substring(0, 300)}...` : ''}`;
    
  } catch (error) {
    console.log(`[generateContentFromURL] Error obteniendo contenido: ${error.message}`);
    // Usar solo la URL si no se puede obtener el contenido
    pageContent = `URL: ${url}
Título: ${url.split('/').pop() || 'Artículo'}
Descripción: Contenido de ${url.split('//')[1]?.split('/')[0] || 'nuestro sitio web'}`;
  }

  // Crear el prompt
  const systemPrompt = template || `Eres un experto en marketing de redes sociales. 
Tu tarea es crear publicaciones atractivas y engagement para Facebook basándote en el contenido de una página web.
El mensaje debe ser corto (máximo 200 caracteres), atractivo, usar emojis relevantes, y motivar a hacer clic.`;

  const userPrompt = `Crea un post para Facebook basado en esta página web:

${pageContent}

${context ? `Contexto adicional: ${context}` : ''}

Responde SOLO con un objeto JSON con este formato:
{
  "title": "Título corto y atractivo",
  "message": "Mensaje para el post (máximo 200 caracteres, con emojis)"
}`;

  console.log(`[generateContentFromURL] Llamando a ${aiProvider}...`);

  // Llamar al proveedor correspondiente
  if (aiProvider === 'gemini') {
    return await generateWithGemini(systemPrompt, userPrompt, aiApiKey, env);
  } else {
    return await generateWithOpenAI(systemPrompt, userPrompt, aiApiKey, env);
  }
}

/**
 * Genera contenido usando OpenAI
 */
async function generateWithOpenAI(systemPrompt, userPrompt, apiKey, env) {
  try {
    // Obtener modelo SOLO desde KV (Panel Web)
    const model = await env.FB_PUBLISHER_KV.get('AI_MODEL') || 'gpt-3.5-turbo';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error en la API de OpenAI');
    }

    const content = data.choices[0].message.content;
    
    // Intentar parsear el JSON de la respuesta
    try {
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || '',
        message: parsed.message || content
      };
    } catch (e) {
      // Si no es JSON válido, usar el contenido directamente
      return {
        title: '',
        message: content.substring(0, 200)
      };
    }
  } catch (error) {
    console.error('Error generando contenido con OpenAI:', error);
    throw error;
  }
}

/**
 * Genera contenido usando Google Gemini
 */
async function generateWithGemini(systemPrompt, userPrompt, apiKey, env) {
  try {
    // Obtener modelo SOLO desde KV (Panel Web) - Sin fallback a variables de entorno
    const model = await env.FB_PUBLISHER_KV.get('AI_MODEL') || 'models/gemini-2.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
    
    console.log(`[generateWithGemini] Modelo: ${model}`);
    console.log(`[generateWithGemini] URL: ${apiUrl.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    // Gemini usa un formato diferente: combinar system y user prompt
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        }
      })
    });

    const data = await response.json();
    
    console.log(`[generateWithGemini] Response status: ${response.status}`);
    console.log(`[generateWithGemini] Response data:`, JSON.stringify(data).substring(0, 200));
    
    if (!response.ok) {
      console.error(`[generateWithGemini] Error API:`, data);
      throw new Error(data.error?.message || JSON.stringify(data.error || data));
    }

    // Extraer el contenido de la respuesta de Gemini
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`[generateWithGemini] Contenido generado: ${content.substring(0, 100)}...`);
    
    if (!content) {
      throw new Error('Respuesta vacía de Gemini');
    }
    
    // Intentar parsear el JSON de la respuesta
    try {
      // Limpiar posibles marcadores de código
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      console.log(`[generateWithGemini] JSON parseado correctamente`);
      return {
        title: parsed.title || '',
        message: parsed.message || content
      };
    } catch (e) {
      console.log(`[generateWithGemini] No es JSON válido, usando contenido directo`);
      // Si no es JSON válido, usar el contenido directamente
      return {
        title: '',
        message: content.substring(0, 200)
      };
    }
  } catch (error) {
    console.error('[generateWithGemini] Error:', error.message);
    throw error;
  }
}

// ========================================
// PUBLICACIÓN
// ========================================

export async function handlePublishProjectPost(projectId, env, corsHeaders) {
  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  const pendingPosts = projectPosts.posts.filter(p => p.status === 'pending');

  if (pendingPosts.length === 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'No hay posts pendientes en este proyecto' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const nextPost = pendingPosts[0];
  const result = await publishPostToFacebook(projectId, nextPost, env);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function handleManualPublish(request, env, corsHeaders) {
  const { projectId, postId } = await request.json();
  
  if (projectId && postId) {
    // Publicar un post específico
    const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
    const post = projectPosts.posts.find(p => p.id === postId);
    
    if (!post) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Post no encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await publishPostToFacebook(projectId, post, env);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Publicar el siguiente post pendiente de cualquier proyecto
    const result = await publishNextPost(env);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ========================================
// ESTADÍSTICAS
// ========================================

export async function handleGetStats(env, corsHeaders) {
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  
  let totalStats = {
    totalProjects: projects.projects.length,
    activeProjects: projects.projects.filter(p => p.active).length,
    totalPosts: 0,
    publishedPosts: 0,
    pendingPosts: 0,
    errorPosts: 0,
    lastPublish: null
  };
  
  for (const project of projects.projects) {
    const stats = await env.FB_PUBLISHER_KV.get(`project:${project.id}:stats`, { type: 'json' });
    if (stats) {
      totalStats.totalPosts += stats.totalPosts || 0;
      totalStats.publishedPosts += stats.publishedPosts || 0;
      totalStats.pendingPosts += stats.pendingPosts || 0;
      totalStats.errorPosts += stats.errorPosts || 0;
      
      if (stats.lastPublish && (!totalStats.lastPublish || stats.lastPublish > totalStats.lastPublish)) {
        totalStats.lastPublish = stats.lastPublish;
      }
    }
  }

  return new Response(JSON.stringify(totalStats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function handleGetProjectStats(projectId, env, corsHeaders) {
  const stats = await env.FB_PUBLISHER_KV.get(`project:${projectId}:stats`, { type: 'json' }) || {
    totalPosts: 0,
    publishedPosts: 0,
    pendingPosts: 0,
    errorPosts: 0,
    lastPublish: null
  };

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ========================================
// UTILIDADES
// ========================================

export async function updateProjectStats(projectId, env, action) {
  const stats = await env.FB_PUBLISHER_KV.get(`project:${projectId}:stats`, { type: 'json' }) || {
    totalPosts: 0,
    publishedPosts: 0,
    pendingPosts: 0,
    errorPosts: 0,
    lastPublish: null
  };

  if (action === 'add') {
    stats.totalPosts++;
    stats.pendingPosts++;
  } else if (action === 'published') {
    stats.publishedPosts++;
    stats.pendingPosts = Math.max(0, stats.pendingPosts - 1);
    stats.lastPublish = new Date().toISOString();
  } else if (action === 'error') {
    stats.errorPosts++;
    stats.pendingPosts = Math.max(0, stats.pendingPosts - 1);
  }

  await env.FB_PUBLISHER_KV.put(`project:${projectId}:stats`, JSON.stringify(stats));
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Publica un post en Facebook usando la Graph API
 * Facebook extraerá automáticamente Open Graph tags de la URL
 */
export async function publishToFacebook(post, env) {
  // Intentar obtener credenciales de KV primero, luego env
  const pageAccessToken = await env.FB_PUBLISHER_KV.get('FB_PAGE_ACCESS_TOKEN') || env.FB_PAGE_ACCESS_TOKEN;
  const pageId = await env.FB_PUBLISHER_KV.get('FB_PAGE_ID') || env.FB_PAGE_ID;
  const apiVersion = env.FACEBOOK_API_VERSION || 'v18.0';

  if (!pageAccessToken || !pageId) {
    return { success: false, error: 'Credenciales de Facebook no configuradas' };
  }

  const apiUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/feed`;

  try {
    // Facebook extraerá automáticamente:
    // - og:title (título)
    // - og:description (descripción)
    // - og:image (imagen destacada)
    // - og:url (URL canónica)
    // desde los meta tags de la página
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: post.message,           // Tu mensaje personalizado
        link: post.url,                  // Facebook procesará esta URL
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
 * Publica un post específico de un proyecto en Facebook
 */
export async function publishPostToFacebook(projectId, post, env) {
  // Obtener configuración del proyecto
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  const project = projects.projects.find(p => p.id === projectId);
  
  if (!project) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  // Publicar en Facebook
  const fbResponse = await publishToFacebook(post, env);

  // Actualizar el post
  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  const postIndex = projectPosts.posts.findIndex(p => p.id === post.id);
  
  if (postIndex !== -1) {
    if (fbResponse.success) {
      projectPosts.posts[postIndex].status = 'published';
      projectPosts.posts[postIndex].publishedAt = new Date().toISOString();
      projectPosts.posts[postIndex].facebookPostId = fbResponse.postId;
      
      await updateProjectStats(projectId, env, 'published');
      console.log(`Post publicado: ${post.id} del proyecto ${projectId}`);
    } else {
      projectPosts.posts[postIndex].status = 'error';
      projectPosts.posts[postIndex].lastError = fbResponse.error;
      projectPosts.posts[postIndex].errorAt = new Date().toISOString();
      
      await updateProjectStats(projectId, env, 'error');
      console.error(`Error al publicar: ${fbResponse.error}`);
    }
    
    await env.FB_PUBLISHER_KV.put(`project:${projectId}:posts`, JSON.stringify(projectPosts));
  }

  return fbResponse.success ? 
    { success: true, post: projectPosts.posts[postIndex], project: project.name } :
    { success: false, error: fbResponse.error };
}

/**
 * Publica el siguiente post pendiente en Facebook (de todos los proyectos)
 */
export async function publishNextPost(env) {
  // Obtener todos los proyectos
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  
  // Buscar posts pendientes en todos los proyectos activos
  for (const project of projects.projects) {
    if (!project.active) continue;
    
    const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${project.id}:posts`, { type: 'json' }) || { posts: [] };
    const pendingPosts = projectPosts.posts.filter(p => p.status === 'pending');
    
    if (pendingPosts.length > 0) {
      const nextPost = pendingPosts[0];
      const result = await publishPostToFacebook(project.id, nextPost, env);
      return result;
    }
  }

  console.log('No hay posts pendientes para publicar');
  return { success: false, message: 'No hay posts pendientes en ningún proyecto' };
}

// ========================================
// CONFIGURACIÓN (SETTINGS)
// ========================================

/**
 * GET /api/settings - Obtener configuración actual
 */
export async function handleGetSettings(env, corsHeaders) {
  try {
    // Obtener configuración SOLO desde KV (Panel Web)
    const aiProvider = await env.FB_PUBLISHER_KV.get('AI_PROVIDER') || 'openai';
    const aiModel = await env.FB_PUBLISHER_KV.get('AI_MODEL');
    const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
    const fbPageId = await env.FB_PUBLISHER_KV.get('FB_PAGE_ID');
    const fbPageAccessToken = await env.FB_PUBLISHER_KV.get('FB_PAGE_ACCESS_TOKEN');
    
    // Determinar modelo por defecto según proveedor si no está configurado
    let defaultModel = 'gpt-3.5-turbo';
    if (aiProvider === 'gemini') {
      defaultModel = 'models/gemini-2.5-flash';
    } else if (aiProvider === 'openai') {
      defaultModel = 'gpt-3.5-turbo';
    }
    
    // Ofuscar las keys para seguridad (mostrar solo primeros/últimos caracteres)
    const ofuscate = (str) => {
      if (!str) return '';
      if (str.length < 10) return '***';
      return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
    };
    
    return new Response(JSON.stringify({
      success: true,
      settings: {
        aiProvider,
        aiModel: aiModel || defaultModel,
        aiApiKeyConfigured: !!aiApiKey,
        aiApiKeyPreview: ofuscate(aiApiKey),
        fbPageId,
        fbPageIdConfigured: !!fbPageId,
        fbPageAccessTokenConfigured: !!fbPageAccessToken,
        fbPageAccessTokenPreview: ofuscate(fbPageAccessToken)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/settings - Guardar configuración (requiere autenticación)
 */
export async function handleSaveSettings(request, env, corsHeaders) {
  try {
    // Verificar autenticación con admin key
    const adminKey = request.headers.get('x-admin-key');
    const expectedAdminKey = env.ADMIN_KEY;
    
    if (!expectedAdminKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ADMIN_KEY no configurada en el servidor. Configúrala como secret de Wrangler.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (adminKey !== expectedAdminKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Clave de administrador inválida' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener datos del body
    const data = await request.json();
    
    // Guardar configuración en KV
    if (data.aiProvider) {
      await env.FB_PUBLISHER_KV.put('AI_PROVIDER', data.aiProvider);
    }
    
    if (data.aiModel) {
      await env.FB_PUBLISHER_KV.put('AI_MODEL', data.aiModel);
    }
    
    if (data.aiApiKey) {
      await env.FB_PUBLISHER_KV.put('AI_API_KEY', data.aiApiKey);
    }
    
    if (data.fbPageId) {
      await env.FB_PUBLISHER_KV.put('FB_PAGE_ID', data.fbPageId);
    }
    
    if (data.fbPageAccessToken) {
      await env.FB_PUBLISHER_KV.put('FB_PAGE_ACCESS_TOKEN', data.fbPageAccessToken);
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Configuración guardada exitosamente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/test-ai - Probar configuración de IA
 */
export async function handleTestAI(request, env, corsHeaders) {
  try {
    const { provider, model, apiKey } = await request.json();
    
    if (!provider || !model || !apiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Faltan parámetros: provider, model y apiKey son requeridos' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Probar la API según el proveedor
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Di solo: OK' }],
          max_tokens: 10
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al conectar con OpenAI');
      }
      
      const content = data.choices?.[0]?.message?.content || '';
      
      return new Response(JSON.stringify({ 
        success: true,
        provider: 'OpenAI',
        model: model,
        response: content.substring(0, 50)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else if (provider === 'gemini') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Di solo: OK'
            }]
          }]
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || JSON.stringify(data));
      }
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return new Response(JSON.stringify({ 
        success: true,
        provider: 'Gemini',
        model: model,
        response: content.substring(0, 50)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Proveedor no soportado: ' + provider 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/projects/:id/generate-all-posts
 * Genera contenido con IA para TODAS las URLs del proyecto que aún no tienen posts
 */
export async function handleGenerateAllProjectPosts(projectId, env, corsHeaders) {
  try {
    console.log(`[handleGenerateAllProjectPosts] Iniciando para proyecto: ${projectId}`);
    
    // Verificar si hay API key configurada (SOLO desde KV/Panel Web)
    const aiApiKey = await env.FB_PUBLISHER_KV.get('AI_API_KEY');
    console.log(`[handleGenerateAllProjectPosts] API Key existe: ${!!aiApiKey}`);
    
    if (!aiApiKey) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'API Key de IA no configurada. Por favor configúrala desde el Panel Web (Tab Configuración).' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Obtener el proyecto
    const projectsData = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
    const project = projectsData.projects.find(p => p.id === projectId);
    
    console.log(`[handleGenerateAllProjectPosts] Proyecto encontrado: ${!!project}`);
    
    if (!project) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Proyecto no encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Obtener posts existentes
    const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
    const existingUrls = new Set(projectPosts.posts.map(p => p.url));
    
    console.log(`[handleGenerateAllProjectPosts] Posts existentes: ${existingUrls.size}`);
    console.log(`[handleGenerateAllProjectPosts] URLs del proyecto: ${project.urls?.length || 0}`);
    
    // Obtener URLs del proyecto que aún no tienen posts
    const urlsToProcess = (project.urls || []).filter(url => !existingUrls.has(url));
    
    console.log(`[handleGenerateAllProjectPosts] URLs a procesar: ${urlsToProcess.length}`);
    
    if (urlsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Todas las URLs ya tienen posts generados',
        processed: 0,
        skipped: project.urls?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Procesar en lotes de 50 URLs para evitar timeouts
    const BATCH_SIZE = 50;
    const urlBatch = urlsToProcess.slice(0, BATCH_SIZE);
    const newPosts = [];
    const errors = [];

    console.log(`[handleGenerateAllProjectPosts] Procesando lote de ${urlBatch.length} URLs`);

    for (const url of urlBatch) {
      try {
        console.log(`[handleGenerateAllProjectPosts] Procesando URL: ${url}`);
        const content = await generateContentFromURL(url, `Contenido del sitio ${project.name}`, env);
        console.log(`[handleGenerateAllProjectPosts] Contenido generado para ${url}`);
        
        newPosts.push({
          id: generateId(),
          url: url,
          message: content.message,
          title: content.title || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          aiGenerated: true
        });
      } catch (error) {
        console.error(`[handleGenerateAllProjectPosts] Error en URL ${url}:`, error.message);
        errors.push({
          url: url,
          error: error.message
        });
      }
    }

    console.log(`[handleGenerateAllProjectPosts] Posts generados: ${newPosts.length}, Errores: ${errors.length}`);

    // Guardar los nuevos posts
    if (newPosts.length > 0) {
      projectPosts.posts.push(...newPosts);
      await env.FB_PUBLISHER_KV.put(`project:${projectId}:posts`, JSON.stringify(projectPosts));
      
      console.log(`[handleGenerateAllProjectPosts] Posts guardados en KV`);
      
      // Actualizar estadísticas
      for (let i = 0; i < newPosts.length; i++) {
        await updateProjectStats(projectId, env, 'add');
      }
      
      console.log(`[handleGenerateAllProjectPosts] Estadísticas actualizadas`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: newPosts.length,
      errors: errors.length,
      remaining: urlsToProcess.length - BATCH_SIZE > 0 ? urlsToProcess.length - BATCH_SIZE : 0,
      totalUrls: project.urls?.length || 0,
      errorDetails: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[handleGenerateAllProjectPosts] Error general:', error.message);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
