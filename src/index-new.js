/**
 * Sistema de Auto-publicación en Facebook con Multi-Proyecto y IA
 * Publica URLs de tus sitios web en tu fanpage de Facebook automáticamente
 * Con generación de contenido mediante IA
 */

// Importar archivos del dashboard
import dashboardHTML from './dashboard.html';
import dashboardCSS from './dashboard.css';
import dashboardJS from './dashboard.js';
import loginHTML from './login.html';
import accountHTML from './account.html';
import forgotPasswordHTML from './forgot-password.html';
import resetPasswordHTML from './reset-password.html';

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

// Importar handlers de autenticación de Facebook
import {
  getFacebookLoginUrl,
  handleFacebookCallback,
  handlePageSelection,
  handleDisconnectPage
} from './facebook-auth.js';

// Importar handlers de autenticación del sistema
import {
  requireAuth,
  handleLogin,
  handleLogout,
  handleGetCurrentUser,
  handleChangePassword,
  handleRequestPasswordReset,
  handleResetPassword,
  handleSaveEmailConfig,
  handleGetEmailConfig
} from './auth.js';

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
      // ========== AUTENTICACIÓN ==========
      // Página de login
      if (url.pathname === '/login') {
        return new Response(getLoginHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // API de login
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(request, env, corsHeaders);
      }

      // API de logout
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        return handleLogout(request, env, corsHeaders);
      }

      // API para obtener usuario actual
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return handleGetCurrentUser(request, env, corsHeaders);
      }

      // API para obtener usuario actual (alias)
      if (url.pathname === '/api/auth/current-user' && request.method === 'GET') {
        return handleGetCurrentUser(request, env, corsHeaders);
      }

      // API para cambiar contraseña
      if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
        return handleChangePassword(request, env, corsHeaders);
      }

      // Página de recuperación de contraseña
      if (url.pathname === '/forgot-password') {
        return new Response(getForgotPasswordHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // API para solicitar recuperación de contraseña
      if (url.pathname === '/api/auth/request-reset' && request.method === 'POST') {
        return handleRequestPasswordReset(request, env, corsHeaders);
      }

      // Página de restablecer contraseña
      if (url.pathname === '/reset-password') {
        return new Response(getResetPasswordHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // API para restablecer contraseña
      if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
        return handleResetPassword(request, env, corsHeaders);
      }

      // ========== RUTAS PROTEGIDAS ==========
      // Verificar autenticación para todas las rutas del dashboard y APIs (excepto OAuth de Facebook)
      const isProtectedRoute = 
        url.pathname === '/' || 
        url.pathname === '/dashboard' ||
        url.pathname === '/account' ||
        url.pathname === '/dashboard.css' ||
        url.pathname === '/dashboard.js' ||
        url.pathname.startsWith('/api/projects') ||
        url.pathname.startsWith('/api/stats') ||
        url.pathname.startsWith('/api/settings') ||
        url.pathname.startsWith('/api/generate') ||
        url.pathname.startsWith('/api/publish') ||
        url.pathname.startsWith('/api/test');

      if (isProtectedRoute) {
        const user = await requireAuth(request, env);
        
        if (!user) {
          // No autenticado - redirigir a login
          if (url.pathname.startsWith('/api/')) {
            // Para rutas API, devolver 401
            return new Response(JSON.stringify({ 
              error: 'No autenticado. Por favor inicia sesión.' 
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // Para páginas HTML, redirigir a login
            return Response.redirect(`${url.origin}/login`, 302);
          }
        }
      }

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

      // Página de gestión de cuenta
      if (url.pathname === '/account') {
        return new Response(getAccountHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // ========== CONFIGURACIÓN DE EMAIL ==========
      if (url.pathname === '/api/settings/email' && request.method === 'GET') {
        return handleGetEmailConfig(request, env, corsHeaders);
      }

      if (url.pathname === '/api/settings/email' && request.method === 'POST') {
        return handleSaveEmailConfig(request, env, corsHeaders);
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

      // ========== AUTENTICACIÓN DE FACEBOOK ==========
      // Iniciar flujo OAuth de Facebook
      if (url.pathname === '/api/auth/facebook/login' && request.method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        if (!projectId) {
          return new Response(JSON.stringify({ error: 'projectId requerido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const redirectUri = `${url.origin}/auth/facebook/callback`;
        const loginUrl = getFacebookLoginUrl(env, projectId, redirectUri);
        return Response.redirect(loginUrl, 302);
      }

      // Callback de Facebook OAuth
      if (url.pathname === '/auth/facebook/callback' && request.method === 'GET') {
        return handleFacebookCallback(request, env, corsHeaders);
      }

      // Seleccionar página después de OAuth
      if (url.pathname === '/api/auth/facebook/select-page' && request.method === 'POST') {
        return handlePageSelection(request, env, corsHeaders);
      }

      // Desconectar fanpage de un proyecto
      if (url.pathname.match(/^\/api\/projects\/[^/]+\/disconnect-facebook$/) && request.method === 'POST') {
        return handleDisconnectPage(request, env, corsHeaders);
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
    aiPrompt: data.aiPrompt || '', // Prompt personalizado para la IA
    // Credenciales de Facebook específicas del proyecto
    fbPageId: data.fbPageId || null,
    fbPageAccessToken: data.fbPageAccessToken || null,
    fbPageName: data.fbPageName || null,
    fbConnected: !!(data.fbPageId && data.fbPageAccessToken), // Estado de conexión
    active: true,
    createdAt: new Date().toISOString(),
    settings: {
      aiEnabled: data.aiEnabled !== undefined ? data.aiEnabled : true,
      autoPublish: data.autoPublish !== undefined ? data.autoPublish : true
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
  
  const updatedProject = {
    ...projects.projects[projectIndex],
    ...data,
    id: projectId, // Preservar el ID
    updatedAt: new Date().toISOString()
  };
  
  // Actualizar estado de conexión si se modifican credenciales FB
  if (data.fbPageId !== undefined || data.fbPageAccessToken !== undefined) {
    updatedProject.fbConnected = !!(updatedProject.fbPageId && updatedProject.fbPageAccessToken);
  }
  
  projects.projects[projectIndex] = updatedProject;
  
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

function getLoginHTML() {
  return loginHTML;
}

function getAccountHTML() {
  return accountHTML;
}

function getForgotPasswordHTML() {
  return forgotPasswordHTML;
}

function getResetPasswordHTML() {
  return resetPasswordHTML;
}
