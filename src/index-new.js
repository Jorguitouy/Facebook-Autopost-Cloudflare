/**
 * Sistema de Auto-publicación en Facebook con Multi-Proyecto y IA
 * Publica URLs de tus sitios web en tu fanpage de Facebook automáticamente
 * Con generación de contenido mediante IA
 */

// Importar archivos del dashboard
import dashboardHTML from './dashboard.html';
import dashboardCSS from './dashboard.css';
import dashboardJS from './dashboard.js';

// Importar handlers
import {
  handleAddProjectPost,
  handleBulkAddProjectPosts,
  handleDeleteProjectPost,
  handleGenerateContent,
  handleGenerateBulkContent,
  handleGenerateAllProjectPosts,
  handlePublishProjectPost,
  handleManualPublish,
  handleGetStats,
  handleGetProjectStats,
  handleGetSettings,
  handleSaveSettings,
  handleTestAI,
  updateProjectStats,
  generateId,
  publishToFacebook,
  publishPostToFacebook,
  publishNextPost
} from './handlers.js';

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Dashboard principal
      if (url.pathname === '/' || url.pathname === '/dashboard') {
        return new Response(getDashboardHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // CSS del dashboard
      if (url.pathname === '/dashboard.css') {
        return new Response(getDashboardCSS(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/css; charset=utf-8' }
        });
      }

      // JavaScript del dashboard
      if (url.pathname === '/dashboard.js') {
        return new Response(getDashboardJS(), {
          headers: { ...corsHeaders, 'Content-Type': 'application/javascript; charset=utf-8' }
        });
      }

      // ========== PROYECTOS ==========
      if (url.pathname === '/api/projects' && request.method === 'GET') {
        return handleGetProjects(env, corsHeaders);
      }

      if (url.pathname === '/api/projects' && request.method === 'POST') {
        return handleCreateProject(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+$/) && request.method === 'GET') {
        const projectId = url.pathname.split('/').pop();
        return handleGetProject(projectId, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+$/) && request.method === 'PUT') {
        const projectId = url.pathname.split('/').pop();
        return handleUpdateProject(projectId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+$/) && request.method === 'DELETE') {
        const projectId = url.pathname.split('/').pop();
        return handleDeleteProject(projectId, env, corsHeaders);
      }

      // ========== POSTS POR PROYECTO ==========
      if (url.pathname.match(/^\/api\/projects\/[^/]+\/posts$/) && request.method === 'GET') {
        const projectId = url.pathname.split('/')[3];
        return handleGetProjectPosts(projectId, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+\/posts$/) && request.method === 'POST') {
        const projectId = url.pathname.split('/')[3];
        return handleAddProjectPost(projectId, request, env, corsHeaders);
      }

      // IMPORTANTE: Estas rutas específicas deben ir ANTES de las genéricas
      if (url.pathname.match(/^\/api\/projects\/[^/]+\/posts\/bulk$/) && request.method === 'POST') {
        const projectId = url.pathname.split('/')[3];
        return handleBulkAddProjectPosts(projectId, request, env, corsHeaders);
      }
      
      // Generar posts con IA para TODAS las URLs del proyecto
      if (url.pathname.match(/^\/api\/projects\/[^/]+\/generate-all-posts$/) && request.method === 'POST') {
        const projectId = url.pathname.split('/')[3];
        return handleGenerateAllProjectPosts(projectId, env, corsHeaders);
      }

      // Eliminar post individual (debe ir después de /bulk y /generate-all-posts)
      if (url.pathname.match(/^\/api\/projects\/[^/]+\/posts\/[^/]+$/) && request.method === 'DELETE') {
        const parts = url.pathname.split('/');
        const projectId = parts[3];
        const postId = parts[5];
        return handleDeleteProjectPost(projectId, postId, env, corsHeaders);
      }

      // ========== GENERACIÓN DE CONTENIDO CON IA ==========
      if (url.pathname === '/api/generate-content' && request.method === 'POST') {
        return handleGenerateContent(request, env, corsHeaders);
      }

      if (url.pathname === '/api/generate-bulk-content' && request.method === 'POST') {
        return handleGenerateBulkContent(request, env, corsHeaders);
      }

      // ========== PUBLICACIÓN ==========
      if (url.pathname === '/api/publish' && request.method === 'POST') {
        return handleManualPublish(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+\/publish$/) && request.method === 'POST') {
        const projectId = url.pathname.split('/')[3];
        return handlePublishProjectPost(projectId, env, corsHeaders);
      }

      // ========== ESTADÍSTICAS ==========
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return handleGetStats(env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/projects\/[^/]+\/stats$/) && request.method === 'GET') {
        const projectId = url.pathname.split('/')[3];
        return handleGetProjectStats(projectId, env, corsHeaders);
      }

      // ========== CONFIGURACIÓN ==========
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        return handleGetSettings(env, corsHeaders);
      }

      if (url.pathname === '/api/settings' && request.method === 'POST') {
        return handleSaveSettings(request, env, corsHeaders);
      }

      if (url.pathname === '/api/test-ai' && request.method === 'POST') {
        return handleTestAI(request, env, corsHeaders);
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

// ========================================
// HANDLERS DE PROYECTOS
// ========================================

async function handleGetProjects(env, corsHeaders) {
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  
  // Agregar estadísticas a cada proyecto
  for (const project of projects.projects) {
    const stats = await env.FB_PUBLISHER_KV.get(`project:${project.id}:stats`, { type: 'json' }) || {
      totalPosts: 0,
      publishedPosts: 0,
      pendingPosts: 0,
      errorPosts: 0
    };
    project.stats = stats;
  }
  
  return new Response(JSON.stringify(projects), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleCreateProject(request, env, corsHeaders) {
  const data = await request.json();
  
  // Limpiar URLs si existen
  let cleanUrls = [];
  if (data.urls && Array.isArray(data.urls)) {
    cleanUrls = data.urls
      .map(url => (url || '').toString().trim())    // Convertir a string y limpiar
      .map(url => url.replace(/\s+/g, ''))          // Eliminar TODOS los espacios
      .filter(url => url.length > 0)                // Eliminar vacíos
      .filter(url => url.startsWith('http'));       // Solo URLs válidas
  }
  
  const newProject = {
    id: generateId(),
    name: data.name,
    domain: data.domain,
    description: data.description || '',
    urls: cleanUrls, // URLs limpias
    fbPageId: data.fbPageId || env.FB_PAGE_ID,
    active: true,
    createdAt: new Date().toISOString(),
    settings: {
      aiEnabled: data.aiEnabled !== undefined ? data.aiEnabled : true,
      autoPublish: data.autoPublish !== undefined ? data.autoPublish : true,
      postTemplate: data.postTemplate || ''
    }
  };

  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  projects.projects.push(newProject);
  
  await env.FB_PUBLISHER_KV.put('projects', JSON.stringify(projects));
  
  // Inicializar estadísticas del proyecto
  await env.FB_PUBLISHER_KV.put(`project:${newProject.id}:stats`, JSON.stringify({
    totalPosts: 0,
    publishedPosts: 0,
    pendingPosts: 0,
    errorPosts: 0,
    lastPublish: null
  }));
  
  // Inicializar lista de posts
  await env.FB_PUBLISHER_KV.put(`project:${newProject.id}:posts`, JSON.stringify({ posts: [] }));

  return new Response(JSON.stringify({ success: true, project: newProject }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGetProject(projectId, env, corsHeaders) {
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  const project = projects.projects.find(p => p.id === projectId);
  
  if (!project) {
    return new Response(JSON.stringify({ error: 'Proyecto no encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify(project), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleUpdateProject(projectId, request, env, corsHeaders) {
  const data = await request.json();
  
  // Limpiar URLs si vienen en la actualización
  if (data.urls && Array.isArray(data.urls)) {
    data.urls = data.urls
      .map(url => (url || '').toString().trim())    // Convertir a string y limpiar
      .map(url => url.replace(/\s+/g, ''))          // Eliminar TODOS los espacios
      .filter(url => url.length > 0)                // Eliminar vacíos
      .filter(url => url.startsWith('http'));       // Solo URLs válidas
  }
  
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  const projectIndex = projects.projects.findIndex(p => p.id === projectId);
  
  if (projectIndex === -1) {
    return new Response(JSON.stringify({ error: 'Proyecto no encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  projects.projects[projectIndex] = {
    ...projects.projects[projectIndex],
    ...data,
    id: projectId, // Preservar el ID
    updatedAt: new Date().toISOString()
  };
  
  await env.FB_PUBLISHER_KV.put('projects', JSON.stringify(projects));
  
  return new Response(JSON.stringify({ success: true, project: projects.projects[projectIndex] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleDeleteProject(projectId, env, corsHeaders) {
  const projects = await env.FB_PUBLISHER_KV.get('projects', { type: 'json' }) || { projects: [] };
  projects.projects = projects.projects.filter(p => p.id !== projectId);
  
  await env.FB_PUBLISHER_KV.put('projects', JSON.stringify(projects));
  
  // Eliminar datos relacionados
  await env.FB_PUBLISHER_KV.delete(`project:${projectId}:posts`);
  await env.FB_PUBLISHER_KV.delete(`project:${projectId}:stats`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGetProjectPosts(projectId, env, corsHeaders) {
  const projectPosts = await env.FB_PUBLISHER_KV.get(`project:${projectId}:posts`, { type: 'json' }) || { posts: [] };
  return new Response(JSON.stringify(projectPosts), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ========================================
// DASHBOARD ASSETS
// ========================================

function getDashboardHTML() {
  return dashboardHTML;
}

function getDashboardCSS() {
  return dashboardCSS;
}

function getDashboardJS() {
  return dashboardJS;
}

