/*
 * dashboard.js
 * Lógica frontend del Panel de Control (gestión de proyectos, posts, IA, ajustes).
 * Este archivo interactúa con las siguientes rutas de la API del Worker:
 *  - GET  /api/stats
 *  - GET  /api/projects
 *  - POST /api/projects
 *  - PUT  /api/projects/:id
 *  - DELETE /api/projects/:id
 *  - GET  /api/projects/:id/posts
 *  - POST /api/projects/:id/posts
 *  - POST /api/publish
 *  - POST /api/generate-content
 *
 * Referencias y documentación:
 *  - README: https://github.com/Jorguitouy/Facebook-Autopost-Cloudflare#readme
 *  - Guía de Autorización (Facebook OAuth): GUIA-AUTORIZACION-FACEBOOK.md
 *  - Open Graph guide: OPEN-GRAPH-GUIDE.md
 *
 * Nota de despliegue:
 *  - Asegúrate de que `/dashboard.css` y `/dashboard.js` sean servidos por el Worker/Pages.
 */

// Estado global de la aplicación
let currentProject = null;
let projects = [];
let stats = {};

// Inicializar al cargar la página
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
    });
}

async function init() {
    await refreshAll();
}

// ========================================
// GESTIÓN DE TABS
// ========================================

function showTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Desactivar todos los botones de tab
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar el tab seleccionado
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Activar el botón correspondiente
    event.target.classList.add('active');
    
    // Cargar datos específicos del tab
    if (tabName === 'projects') {
        loadProjects();
    } else if (tabName === 'posts') {
        loadProjectsForSelect();
    } else if (tabName === 'ai') {
        loadProjectsForAI();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

// ========================================
// ACTUALIZACIÓN GENERAL
// ========================================

async function refreshAll() {
    showLoading();
    try {
        await Promise.all([
            loadStats(),
            loadProjects(),
            loadProjectsForSelect(),
            loadProjectsForAI()
        ]);
        showMessage('✅ Datos actualizados', 'success');
    } catch (error) {
        showMessage('❌ Error al actualizar: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// ESTADÍSTICAS
// ========================================

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        stats = await response.json();
        
        document.getElementById('totalProjects').textContent = stats.totalProjects || 0;
        document.getElementById('activeProjects').textContent = stats.activeProjects || 0;
        document.getElementById('totalPosts').textContent = stats.totalPosts || 0;
        document.getElementById('pendingPosts').textContent = stats.pendingPosts || 0;
        document.getElementById('publishedPosts').textContent = stats.publishedPosts || 0;
        document.getElementById('errorPosts').textContent = stats.errorPosts || 0;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// ========================================
// PROYECTOS
// ========================================

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        projects = data.projects || [];
        
        renderProjects();
        renderProjectsSummary();
    } catch (error) {
        console.error('Error al cargar proyectos:', error);
        showMessage('Error al cargar proyectos', 'error');
    }
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No hay proyectos</h3>
                <p>Crea tu primer proyecto para comenzar</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="project-card ${project.active ? 'active' : 'inactive'}" data-id="${project.id}">
            <div class="project-name">${project.name}</div>
            <div class="project-domain">🌐 ${project.domain}</div>
            ${project.description ? `<p class="text-gray text-small">${project.description}</p>` : ''}
            
            <div class="project-stats">
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats?.totalPosts || 0}</div>
                    <div class="project-stat-label">Total</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats?.pendingPosts || 0}</div>
                    <div class="project-stat-label">Pendiente</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats?.publishedPosts || 0}</div>
                    <div class="project-stat-label">Publicado</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.urls?.length || 0}</div>
                    <div class="project-stat-label">URLs</div>
                </div>
            </div>
            
            <div class="project-actions">
                <button class="success" onclick="viewProjectPosts('${project.id}')">📝 Posts</button>
                <button class="primary" onclick="generateAllPosts('${project.id}')" title="Generar contenido con IA para todas las URLs">🤖 IA Auto</button>
                <button onclick="editProject('${project.id}')">✏️ Editar</button>
                <button class="danger" onclick="deleteProject('${project.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderProjectsSummary() {
    const container = document.getElementById('projectsSummary');
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-gray text-center">No hay proyectos creados aún</p>';
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border);">
                    <th style="padding: 12px; text-align: left;">Proyecto</th>
                    <th style="padding: 12px; text-align: center;">Estado</th>
                    <th style="padding: 12px; text-align: center;">Total Posts</th>
                    <th style="padding: 12px; text-align: center;">Pendientes</th>
                    <th style="padding: 12px; text-align: center;">Publicados</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map(project => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px;">
                            <strong>${project.name}</strong><br>
                            <small class="text-gray">${project.domain}</small>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            <span class="post-status ${project.active ? 'published' : 'error'}">
                                ${project.active ? '✓ Activo' : '✗ Inactivo'}
                            </span>
                        </td>
                        <td style="padding: 12px; text-align: center;">${project.stats?.totalPosts || 0}</td>
                        <td style="padding: 12px; text-align: center;">${project.stats?.pendingPosts || 0}</td>
                        <td style="padding: 12px; text-align: center;">${project.stats?.publishedPosts || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function createProject() {
    const name = document.getElementById('projectName').value.trim();
    const domain = document.getElementById('projectDomain').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const urlsText = document.getElementById('projectUrls').value.trim();
    const aiEnabled = document.getElementById('projectAiEnabled').checked;
    const autoPublish = document.getElementById('projectAutoPublish').checked;
    
    if (!name || !domain) {
        showMessage('⚠️ Por favor completa el nombre y dominio', 'error');
        return;
    }
    
    // Procesar URLs (una por línea) - Limpieza exhaustiva
    let urls = [];
    if (urlsText) {
        urls = urlsText
            .split('\n')                           // Dividir por líneas
            .map(url => url.trim())                // Eliminar espacios al inicio/final
            .map(url => url.replace(/\s+/g, ''))   // Eliminar TODOS los espacios en medio
            .filter(url => url.length > 0)         // Eliminar líneas vacías
            .filter(url => url.startsWith('http')); // Solo URLs válidas
        
        if (urls.length === 0) {
            showMessage('⚠️ No se encontraron URLs válidas. Asegúrate de que empiecen con http:// o https://', 'error');
            return;
        }
        
        if (urls.length > 500) {
            showMessage('⚠️ Máximo 500 URLs por proyecto. Tienes ' + urls.length, 'error');
            return;
        }
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                domain,
                description,
                urls,
                aiEnabled,
                autoPublish
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const urlsMsg = urls.length > 0 ? ` con ${urls.length} URLs` : '';
            showMessage(`✅ Proyecto "${name}" creado exitosamente${urlsMsg}`, 'success');
            
            // Limpiar formulario
            document.getElementById('projectName').value = '';
            document.getElementById('projectDomain').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('projectUrls').value = '';
            
            await loadProjects();
            await loadStats();
        } else {
            showMessage('❌ Error al crear proyecto', 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

function editProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    document.getElementById('editProjectId').value = project.id;
    document.getElementById('editProjectName').value = project.name;
    document.getElementById('editProjectDomain').value = project.domain;
    document.getElementById('editProjectDescription').value = project.description || '';
    document.getElementById('editProjectActive').checked = project.active;
    
    // Cargar URLs existentes
    const urlsText = (project.urls || []).join('\n');
    document.getElementById('editProjectUrls').value = urlsText;
    
    document.getElementById('editProjectModal').classList.add('active');
}

function closeEditProjectModal() {
    document.getElementById('editProjectModal').classList.remove('active');
}

async function saveEditProject() {
    const projectId = document.getElementById('editProjectId').value;
    const name = document.getElementById('editProjectName').value.trim();
    const domain = document.getElementById('editProjectDomain').value.trim();
    const description = document.getElementById('editProjectDescription').value.trim();
    const urlsText = document.getElementById('editProjectUrls').value.trim();
    const active = document.getElementById('editProjectActive').checked;
    
    if (!name || !domain) {
        showMessage('⚠️ Por favor completa todos los campos requeridos', 'error');
        return;
    }
    
    // Procesar URLs - Limpieza exhaustiva
    let urls = [];
    if (urlsText) {
        urls = urlsText
            .split('\n')                           // Dividir por líneas
            .map(url => url.trim())                // Eliminar espacios al inicio/final
            .map(url => url.replace(/\s+/g, ''))   // Eliminar TODOS los espacios en medio
            .filter(url => url.length > 0)         // Eliminar líneas vacías
            .filter(url => url.startsWith('http')); // Solo URLs válidas
        
        if (urls.length > 500) {
            showMessage('⚠️ Máximo 500 URLs por proyecto. Tienes ' + urls.length, 'error');
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, domain, description, urls, active })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Proyecto actualizado', 'success');
            closeEditProjectModal();
            await loadProjects();
        } else {
            showMessage('❌ Error al actualizar proyecto', 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function deleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (!confirm(`¿Eliminar el proyecto "${project.name}"?\n\nSe eliminarán todos los posts asociados.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Proyecto eliminado', 'success');
            await loadProjects();
            await loadStats();
        } else {
            showMessage('❌ Error al eliminar proyecto', 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function generateAllPosts(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const urlCount = project.urls?.length || 0;
    const existingPosts = project.stats?.totalPosts || 0;
    const remaining = urlCount - existingPosts;
    
    if (remaining <= 0) {
        alert(`El proyecto "${project.name}" ya tiene posts para todas sus URLs (${urlCount} URLs)`);
        return;
    }
    
    // Verificar conexión con IA antes de procesar
    showMessage('🔍 Verificando conexión con IA...', 'info');
    
    try {
        // Test rápido de conexión
        const testResponse = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                url: 'https://example.com', 
                context: 'Test' 
            })
        });
        
        const testResult = await testResponse.json();
        
        if (!testResult.success) {
            showMessage(`❌ Error de IA: ${testResult.error}\n\nVerifica tu configuración en la pestaña ⚙️ Configuración`, 'error');
            return;
        }
    } catch (error) {
        showMessage(`❌ No se pudo conectar con la API de IA: ${error.message}\n\nVerifica tu configuración`, 'error');
        return;
    }
    
    showMessage('✅ Conexión verificada', 'success');
    
    if (!confirm(`Generar contenido con IA para "${project.name}"?\n\n` +
                 `📊 URLs totales: ${urlCount}\n` +
                 `✅ Ya procesadas: ${existingPosts}\n` +
                 `⏳ Por procesar: ${remaining}\n\n` +
                 `Se procesarán hasta 50 URLs por vez.\n` +
                 `Esto puede tardar varios minutos.`)) {
        return;
    }
    
    try {
        showMessage('🤖 Generando contenido con IA...', 'info');
        
        const response = await fetch(`/api/projects/${projectId}/generate-all-posts`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const message = `✅ Generación completada!\n\n` +
                          `✨ Procesadas: ${result.processed}\n` +
                          `❌ Errores: ${result.errors}\n` +
                          (result.remaining > 0 ? `⏳ Restantes: ${result.remaining}\n\n` +
                           `Ejecuta nuevamente para procesar las restantes.` : '');
            
            showMessage(message.replace(/\n/g, '<br>'), 'success');
            await loadProjects();
            await loadStats();
        } else {
            showMessage('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

// ========================================
// POSTS
// ========================================

function loadProjectsForSelect() {
    const select = document.getElementById('postsProjectSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

async function loadProjectPosts() {
    const projectId = document.getElementById('postsProjectSelect').value;
    const container = document.getElementById('selectedProjectPosts');
    
    if (!projectId) {
        container.innerHTML = '';
        return;
    }
    
    const project = projects.find(p => p.id === projectId);
    currentProject = project;
    
    try {
        const response = await fetch(`/api/projects/${projectId}/posts`);
        const data = await response.json();
        const posts = data.posts || [];
        
        container.innerHTML = `
            <div class="card mt-3">
                <div class="card-header">
                    <h2>➕ Agregar Post a "${project.name}"</h2>
                </div>
                
                <div class="form-group">
                    <label>URL</label>
                    <input type="url" id="postUrl" placeholder="https://${project.domain}/articulo">
                </div>
                
                <div class="form-group">
                    <label>Mensaje</label>
                    <textarea id="postMessage" placeholder="Mensaje para el post..."></textarea>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="addPost('${projectId}')">➕ Agregar Post</button>
                    <button class="outline" onclick="showBulkAddModal('${projectId}')">📦 Agregar en Lote</button>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2>📝 Posts de "${project.name}" (${posts.length})</h2>
                    <button class="success" onclick="publishProjectPost('${projectId}')">▶️ Publicar Siguiente</button>
                </div>
                <div class="posts-list">
                    ${renderPosts(posts, projectId)}
                </div>
            </div>
        `;
    } catch (error) {
        showMessage('Error al cargar posts', 'error');
    }
}

function renderPosts(posts, projectId) {
    if (posts.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>No hay posts</h3>
                <p>Agrega tu primer post o usa el generador de IA</p>
            </div>
        `;
    }
    
    // Barra de acciones para selección múltiple
    const selectionBar = `
        <div class="selection-bar" id="selectionBar" style="display: none; margin-bottom: 15px; padding: 15px; background: var(--card-bg); border-radius: 8px; border: 2px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <span id="selectedCount" style="font-weight: 600; color: var(--primary);">0 seleccionados</span>
                <button class="danger" onclick="deleteSelectedPosts('${projectId}')" style="padding: 8px 16px;">
                    🗑️ Eliminar seleccionados
                </button>
                <button class="secondary" onclick="clearSelection()" style="padding: 8px 16px;">
                    ✖️ Cancelar selección
                </button>
            </div>
        </div>
    `;
    
    // Checkbox para seleccionar todos
    const selectAllCheckbox = `
        <div style="padding: 12px 15px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border);">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none;">
                <input type="checkbox" id="selectAllPosts" onchange="toggleSelectAll()" 
                       style="width: 18px; height: 18px; cursor: pointer;">
                <span style="font-weight: 600;">Seleccionar todos (${posts.length} posts)</span>
            </label>
        </div>
    `;
    
    const postsHtml = posts.map(post => `
        <div class="post-item ${post.status}" data-post-id="${post.id}">
            <div style="display: flex; align-items: start; gap: 12px;">
                <input type="checkbox" class="post-checkbox" data-post-id="${post.id}" 
                       onchange="updateSelection()" 
                       style="width: 18px; height: 18px; margin-top: 4px; cursor: pointer; flex-shrink: 0;">
                <div class="post-content" style="flex: 1;">
                    <div class="post-url">${post.url}</div>
                    <div class="post-message">${post.message}</div>
                    <div class="post-meta">
                        <span class="post-status ${post.status}">${getStatusLabel(post.status)}</span>
                        ${post.aiGenerated ? '<span class="post-status" style="background: rgba(147, 51, 234, 0.1); color: #9333ea;">🤖 IA</span>' : ''}
                        ${post.publishedAt ? `<span class="post-date">📅 ${formatDate(post.publishedAt)}</span>` : ''}
                        ${post.errorAt ? `<span class="post-date" style="color: var(--danger);">❌ ${post.lastError}</span>` : ''}
                    </div>
                </div>
                <div class="post-actions" style="flex-shrink: 0;">
                    ${post.status === 'pending' ? `<button class="success" onclick="publishSpecificPost('${projectId}', '${post.id}')">▶️</button>` : ''}
                    <button class="danger" onclick="deletePost('${projectId}', '${post.id}')">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    return selectionBar + selectAllCheckbox + postsHtml;
}

function getStatusLabel(status) {
    const labels = {
        'pending': '⏳ Pendiente',
        'published': '✅ Publicado',
        'error': '❌ Error'
    };
    return labels[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

async function addPost(projectId) {
    const url = document.getElementById('postUrl').value.trim();
    const message = document.getElementById('postMessage').value.trim();
    
    if (!url || !message) {
        showMessage('⚠️ Completa todos los campos', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, message })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Post agregado', 'success');
            document.getElementById('postUrl').value = '';
            document.getElementById('postMessage').value = '';
            await loadProjectPosts();
            await loadStats();
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

function showBulkAddModal(projectId) {
    const urls = prompt('Pega las URLs (una por línea):');
    if (!urls) return;
    
    const urlList = urls.split('\n').filter(u => u.trim());
    if (urlList.length === 0) return;
    
    const useAI = confirm(`¿Generar contenido automáticamente con IA para ${urlList.length} URLs?\n\n✓ Sí: La IA creará mensajes personalizados\n✗ No: Usaré un mensaje genérico`);
    
    if (useAI) {
        bulkAddWithAI(projectId, urlList);
    } else {
        bulkAddManual(projectId, urlList);
    }
}

async function bulkAddManual(projectId, urls) {
    const message = prompt('Mensaje para todos los posts:');
    if (!message) return;
    
    const posts = urls.map(url => ({ url: url.trim(), message }));
    
    try {
        const response = await fetch(`/api/projects/${projectId}/posts/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts, generateContent: false })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✅ ${result.count} posts agregados`, 'success');
            await loadProjectPosts();
            await loadStats();
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function bulkAddWithAI(projectId, urls) {
    showMessage('🤖 Generando contenido con IA...', 'info');
    
    try {
        const posts = urls.map(url => ({ url: url.trim() }));
        
        const response = await fetch(`/api/projects/${projectId}/posts/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts, generateContent: true })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✅ ${result.count} posts generados con IA y agregados`, 'success');
            await loadProjectPosts();
            await loadStats();
        } else {
            showMessage('❌ Error al generar contenido', 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function deletePost(projectId, postId) {
    if (!confirm('¿Eliminar este post?')) return;
    
    try {
        const response = await fetch(`/api/projects/${projectId}/posts/${postId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Post eliminado', 'success');
            await loadProjectPosts();
            await loadStats();
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

function viewProjectPosts(projectId) {
    document.getElementById('postsProjectSelect').value = projectId;
    showTab('posts');
    // Hacer click en el tab de posts
    document.querySelectorAll('.tab').forEach((tab, index) => {
        if (index === 2) { // Posts tab es el tercero
            tab.click();
        }
    });
    loadProjectPosts();
}

// ========================================
// PUBLICACIÓN
// ========================================

async function publishNow() {
    if (!confirm('¿Publicar el siguiente post pendiente ahora?')) return;
    
    try {
        const response = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✅ Post publicado en "${result.project}"`, 'success');
            await refreshAll();
        } else {
            showMessage('❌ ' + (result.error || result.message), 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function publishProjectPost(projectId) {
    if (!confirm('¿Publicar el siguiente post pendiente de este proyecto?')) return;
    
    try {
        const response = await fetch(`/api/projects/${projectId}/publish`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Post publicado', 'success');
            await loadProjectPosts();
            await loadStats();
        } else {
            showMessage('❌ ' + (result.error || result.message), 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function publishSpecificPost(projectId, postId) {
    if (!confirm('¿Publicar este post ahora?')) return;
    
    try {
        const response = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, postId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Post publicado', 'success');
            await loadProjectPosts();
            await loadStats();
        } else {
            showMessage('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

// ========================================
// GENERACIÓN DE CONTENIDO CON IA
// ========================================

function loadProjectsForAI() {
    const selects = [
        document.getElementById('aiProjectSelect'),
        document.getElementById('aiBulkProjectSelect')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    });
}

async function testAIConnection() {
    const statusDiv = document.getElementById('aiConnectionStatus');
    
    showMessage('🔍 Probando conexión con IA...', 'info');
    statusDiv.style.display = 'block';
    statusDiv.className = 'message info';
    statusDiv.innerHTML = '<span>🔄</span><div><strong>Probando conexión...</strong><br>Esto puede tardar unos segundos</div>';
    
    try {
        // Usar una URL de prueba simple
        const testUrl = 'https://www.example.com';
        
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                url: testUrl, 
                context: 'Test de conexión de API' 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Obtener configuración para mostrar detalles
            const configResponse = await fetch('/api/settings');
            const configData = await configResponse.json();
            
            const provider = configData.settings?.aiProvider || 'No configurado';
            const model = configData.settings?.aiModel || 'No configurado';
            
            statusDiv.className = 'message success';
            statusDiv.innerHTML = `
                <span>✅</span>
                <div>
                    <strong>Conexión exitosa!</strong><br>
                    <small>
                        • Proveedor: <strong>${provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google Gemini' : provider}</strong><br>
                        • Modelo: <strong>${model}</strong><br>
                        • Estado: Listo para generar contenido
                    </small>
                </div>
            `;
            showMessage('✅ API de IA funcionando correctamente', 'success');
        } else {
            statusDiv.className = 'message error';
            statusDiv.innerHTML = `
                <span>❌</span>
                <div>
                    <strong>Error de conexión</strong><br>
                    <small>${result.error || 'Error desconocido'}</small><br><br>
                    <strong>Soluciones:</strong><br>
                    • Ve a <strong>⚙️ Configuración</strong><br>
                    • Verifica tu <strong>API Key</strong><br>
                    • Asegúrate de que el proveedor esté seleccionado
                </div>
            `;
            showMessage('❌ ' + (result.error || 'Error al conectar con la API de IA'), 'error');
        }
    } catch (error) {
        statusDiv.className = 'message error';
        statusDiv.innerHTML = `
            <span>❌</span>
            <div>
                <strong>Error al probar conexión</strong><br>
                <small>${error.message}</small><br><br>
                <strong>Posibles causas:</strong><br>
                • API Key no configurada<br>
                • API Key inválida<br>
                • Límite de requests excedido<br>
                • Problema de red
            </div>
        `;
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function generateContent() {
    const projectId = document.getElementById('aiProjectSelect').value;
    const url = document.getElementById('aiUrl').value.trim();
    const context = document.getElementById('aiContext').value.trim();
    
    if (!url) {
        showMessage('⚠️ Ingresa una URL', 'error');
        return;
    }
    
    showMessage('🤖 Generando contenido con IA...', 'info');
    
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, context })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('aiGeneratedTitle').value = result.content.title;
            document.getElementById('aiGeneratedMessage').value = result.content.message;
            document.getElementById('aiResult').style.display = 'block';
            showMessage('✅ Contenido generado exitosamente', 'success');
        } else {
            showMessage('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function saveGeneratedPost() {
    const projectId = document.getElementById('aiProjectSelect').value;
    const url = document.getElementById('aiUrl').value.trim();
    const title = document.getElementById('aiGeneratedTitle').value;
    const message = document.getElementById('aiGeneratedMessage').value;
    
    if (!projectId) {
        showMessage('⚠️ Selecciona un proyecto', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, message, title, aiGenerated: true })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Post guardado', 'success');
            
            // Limpiar formulario
            document.getElementById('aiUrl').value = '';
            document.getElementById('aiContext').value = '';
            document.getElementById('aiResult').style.display = 'none';
            
            await loadStats();
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

async function generateBulkContent() {
    const projectId = document.getElementById('aiBulkProjectSelect').value;
    const urlsText = document.getElementById('aiBulkUrls').value.trim();
    
    if (!projectId) {
        showMessage('⚠️ Selecciona un proyecto', 'error');
        return;
    }
    
    if (!urlsText) {
        showMessage('⚠️ Ingresa al menos una URL', 'error');
        return;
    }
    
    const urls = urlsText.split('\n').filter(u => u.trim()).map(u => u.trim());
    
    if (!confirm(`¿Generar contenido con IA para ${urls.length} URLs?\n\nEsto puede tomar varios minutos.`)) {
        return;
    }
    
    document.getElementById('bulkProgress').style.display = 'block';
    document.getElementById('bulkProgressText').textContent = `0/${urls.length}`;
    
    try {
        const posts = urls.map(url => ({ url }));
        
        const response = await fetch(`/api/projects/${projectId}/posts/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts, generateContent: true })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✅ ${result.count} posts generados y guardados`, 'success');
            document.getElementById('aiBulkUrls').value = '';
            await loadStats();
        } else {
            showMessage('❌ Error al generar contenido', 'error');
        }
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        document.getElementById('bulkProgress').style.display = 'none';
    }
}

// ========================================
// UTILIDADES
// ========================================

function showMessage(text, type = 'info') {
    const msg = document.getElementById('message');
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    msg.innerHTML = `<span>${icons[type] || ''}</span><span>${text}</span>`;
    msg.className = 'message ' + type;
    
    setTimeout(() => {
        msg.className = 'message';
    }, 5000);
}

function showLoading() {
    // Implementar si es necesario
}

function hideLoading() {
    // Implementar si es necesario
}

// ========================================
// CONFIGURACIÓN
// ========================================

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        if (data.success) {
            const settings = data.settings;
            
            // Proveedor de IA
            document.getElementById('aiProvider').value = settings.aiProvider || 'openai';
            
            // Actualizar opciones de modelo y seleccionar el modelo actual
            updateModelOptions();
            if (settings.aiModel) {
                document.getElementById('aiModel').value = settings.aiModel;
            }
            
            // Estado de API Key de IA
            if (settings.aiApiKeyConfigured) {
                document.getElementById('aiApiKeyStatus').textContent = `✓ Configurada: ${settings.aiApiKeyPreview}`;
                document.getElementById('aiApiKeyStatus').style.color = 'var(--success)';
            } else {
                document.getElementById('aiApiKeyStatus').textContent = '✗ No configurada';
                document.getElementById('aiApiKeyStatus').style.color = 'var(--danger)';
            }
            
            // Facebook Page ID
            if (settings.fbPageId) {
                document.getElementById('fbPageId').value = settings.fbPageId;
                document.getElementById('fbPageIdStatus').textContent = '✓ Configurado';
                document.getElementById('fbPageIdStatus').style.color = 'var(--success)';
            }
            
            // Estado de Facebook Token
            if (settings.fbPageAccessTokenConfigured) {
                document.getElementById('fbPageAccessTokenStatus').textContent = `✓ Configurado: ${settings.fbPageAccessTokenPreview}`;
                document.getElementById('fbPageAccessTokenStatus').style.color = 'var(--success)';
            } else {
                document.getElementById('fbPageAccessTokenStatus').textContent = '✗ No configurado';
                document.getElementById('fbPageAccessTokenStatus').style.color = 'var(--danger)';
            }
            
            // Actualizar info del proveedor
            updateAIProviderInfo();
            
            showMessage('✅ Configuración cargada', 'success');
        }
    } catch (error) {
        showMessage('❌ Error al cargar configuración: ' + error.message, 'error');
    }
}

async function saveSettings() {
    const adminKey = document.getElementById('adminKey').value.trim();
    
    if (!adminKey) {
        showMessage('⚠️ Debes ingresar la clave de administrador', 'error');
        return;
    }
    
    const settings = {
        aiProvider: document.getElementById('aiProvider').value,
        aiModel: document.getElementById('aiModel').value,
        aiApiKey: document.getElementById('aiApiKey').value.trim() || undefined,
        fbPageId: document.getElementById('fbPageId').value.trim() || undefined,
        fbPageAccessToken: document.getElementById('fbPageAccessToken').value.trim() || undefined
    };
    
    // Validar que al menos un campo tenga valor
    if (!settings.aiApiKey && !settings.fbPageId && !settings.fbPageAccessToken) {
        showMessage('⚠️ Debes completar al menos un campo para guardar', 'error');
        return;
    }
    
    if (!confirm('¿Guardar la configuración? Esto sobrescribirá los valores actuales.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': adminKey
            },
            body: JSON.stringify(settings)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Configuración guardada exitosamente', 'success');
            
            // Limpiar campos sensibles
            document.getElementById('adminKey').value = '';
            document.getElementById('aiApiKey').value = '';
            document.getElementById('fbPageAccessToken').value = '';
            
            // Recargar configuración
            await loadSettings();
        } else {
            showMessage('❌ ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('❌ Error al guardar: ' + error.message, 'error');
    }
}

function resetSettingsForm() {
    document.getElementById('adminKey').value = '';
    document.getElementById('aiProvider').value = 'openai';
    document.getElementById('aiApiKey').value = '';
    document.getElementById('fbPageId').value = '';
    document.getElementById('fbPageAccessToken').value = '';
    
    loadSettings();
}

function updateModelOptions() {
    const provider = document.getElementById('aiProvider').value;
    const modelSelect = document.getElementById('aiModel');
    
    // Limpiar opciones actuales
    modelSelect.innerHTML = '';
    
    if (provider === 'openai') {
        const models = [
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Rápido y económico)', cost: '~$0.002/1K tokens' },
            { value: 'gpt-4', label: 'GPT-4 (Más preciso)', cost: '~$0.03/1K tokens' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Equilibrado)', cost: '~$0.01/1K tokens' },
            { value: 'gpt-4o', label: 'GPT-4o (Más reciente)', cost: '~$0.005/1K tokens' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Más económico)', cost: '~$0.00015/1K tokens' }
        ];
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = `${model.label} - ${model.cost}`;
            modelSelect.appendChild(option);
        });
    } else if (provider === 'gemini') {
        const models = [
            { value: 'models/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado)', features: 'Rápido y eficiente' },
            { value: 'models/gemini-2.5-pro', label: 'Gemini 2.5 Pro', features: 'Máxima calidad' },
            { value: 'models/gemini-2.0-flash', label: 'Gemini 2.0 Flash', features: 'Estable y rápido' },
            { value: 'models/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental', features: 'Últimas características' },
            { value: 'models/gemini-flash-latest', label: 'Gemini Flash Latest', features: 'Siempre actualizado' }
        ];
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = `${model.label} - ${model.features}`;
            modelSelect.appendChild(option);
        });
    }
    
    updateAIProviderInfo();
}

function updateAIProviderInfo() {
    const provider = document.getElementById('aiProvider').value;
    const infoDiv = document.getElementById('aiProviderInfo');
    const infoText = document.getElementById('aiProviderInfoText');
    
    if (provider === 'openai') {
        infoText.innerHTML = `
            <strong>OpenAI (GPT)</strong><br>
            Obtén tu API Key en: <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a><br>
            <strong>💰 Costo variable:</strong> Desde $0.00015/1K tokens (GPT-4o Mini) hasta $0.03/1K tokens (GPT-4)<br>
            <strong>⚡ Recomendado:</strong> GPT-4o Mini para mejor relación calidad/precio
        `;
    } else if (provider === 'gemini') {
        infoText.innerHTML = `
            <strong>Google Gemini ✨ GRATIS</strong><br>
            Obtén tu API Key en: <a href="https://makersuite.google.com/app/apikey" target="_blank">makersuite.google.com/app/apikey</a><br>
            <strong>🎉 Completamente gratis:</strong> Hasta 60 req/min (Gemini Pro) o 15 req/min (Gemini 1.5 Flash)<br>
            <strong>⚡ Recomendado:</strong> Gemini 1.5 Flash para mejor velocidad
        `;
    }
    
    infoDiv.style.display = 'flex';
}

// ========== PROBAR CONFIGURACIÓN DE IA ==========

async function testCurrentAIConfig() {
    const provider = document.getElementById('aiProvider').value;
    const model = document.getElementById('aiModel').value;
    const apiKey = document.getElementById('aiApiKey').value;
    const resultDiv = document.getElementById('aiTestResult');
    
    // Validaciones
    if (!apiKey) {
        resultDiv.className = 'message error';
        resultDiv.innerHTML = '<span>❌</span><div>Por favor ingresa la API Key antes de probar</div>';
        resultDiv.style.display = 'flex';
        return;
    }
    
    if (!model) {
        resultDiv.className = 'message error';
        resultDiv.innerHTML = '<span>❌</span><div>Por favor selecciona un modelo antes de probar</div>';
        resultDiv.style.display = 'flex';
        return;
    }
    
    // Mostrar mensaje de carga
    resultDiv.className = 'message info';
    resultDiv.innerHTML = '<span>⏳</span><div>Probando conexión con ' + provider + ' (' + model + ')...</div>';
    resultDiv.style.display = 'flex';
    
    try {
        let response;
        
        if (provider === 'openai') {
            // Probar OpenAI
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: 'Di solo: OK' }
                    ],
                    max_tokens: 10
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || 'Error al conectar con OpenAI');
            }
            
            const content = data.choices?.[0]?.message?.content || '';
            resultDiv.className = 'message success';
            resultDiv.innerHTML = `
                <span>✅</span>
                <div>
                    <strong>Conexión exitosa con OpenAI</strong><br>
                    Modelo: ${model}<br>
                    Respuesta: "${content.substring(0, 50)}"
                </div>
            `;
            
        } else if (provider === 'gemini') {
            // Probar Gemini
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
            
            response = await fetch(apiUrl, {
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
                throw new Error(data.error?.message || 'Error al conectar con Gemini');
            }
            
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resultDiv.className = 'message success';
            resultDiv.innerHTML = `
                <span>✅</span>
                <div>
                    <strong>Conexión exitosa con Gemini</strong><br>
                    Modelo: ${model}<br>
                    Respuesta: "${content.substring(0, 50)}"
                </div>
            `;
        }
        
    } catch (error) {
        resultDiv.className = 'message error';
        resultDiv.innerHTML = `
            <span>❌</span>
            <div>
                <strong>Error al probar la API</strong><br>
                ${error.message}<br>
                <small>Verifica que la API Key y el modelo sean correctos</small>
            </div>
        `;
    }
    
    resultDiv.style.display = 'flex';
}

// Event listener para cambio de proveedor
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const aiProviderSelect = document.getElementById('aiProvider');
        if (aiProviderSelect) {
            // Inicializar opciones de modelo al cargar
            updateModelOptions();
        }
    });
}

// ========== FUNCIONES DE SELECCIÓN MÚLTIPLE ==========

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllPosts');
    const checkboxes = document.querySelectorAll('.post-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateSelection();
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.post-checkbox');
    const checkedBoxes = document.querySelectorAll('.post-checkbox:checked');
    const selectAllCheckbox = document.getElementById('selectAllPosts');
    const selectionBar = document.getElementById('selectionBar');
    const selectedCount = document.getElementById('selectedCount');
    
    // Actualizar contador
    if (selectedCount) {
        selectedCount.textContent = `${checkedBoxes.length} seleccionado${checkedBoxes.length !== 1 ? 's' : ''}`;
    }
    
    // Mostrar/ocultar barra de selección
    if (selectionBar) {
        selectionBar.style.display = checkedBoxes.length > 0 ? 'block' : 'none';
    }
    
    // Actualizar estado del checkbox "seleccionar todos"
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
        selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
    }
}

function clearSelection() {
    const checkboxes = document.querySelectorAll('.post-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllPosts');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    
    updateSelection();
}

async function deleteSelectedPosts(projectId) {
    const checkedBoxes = document.querySelectorAll('.post-checkbox:checked');
    const postIds = Array.from(checkedBoxes).map(cb => cb.dataset.postId);
    
    if (postIds.length === 0) {
        showMessage('⚠️ No hay posts seleccionados', 'error');
        return;
    }
    
    const confirmMsg = `¿Eliminar ${postIds.length} post${postIds.length !== 1 ? 's' : ''} seleccionado${postIds.length !== 1 ? 's' : ''}?`;
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        let successCount = 0;
        let errorCount = 0;
        
        // Eliminar posts uno por uno
        for (const postId of postIds) {
            try {
                const response = await fetch(`/api/projects/${projectId}/posts/${postId}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
                console.error(`Error eliminando post ${postId}:`, error);
            }
        }
        
        // Mostrar resultado
        if (errorCount === 0) {
            showMessage(`✅ ${successCount} post${successCount !== 1 ? 's' : ''} eliminado${successCount !== 1 ? 's' : ''}`, 'success');
        } else {
            showMessage(`⚠️ ${successCount} eliminados, ${errorCount} errores`, 'error');
        }
        
        // Recargar lista
        await loadProjectPosts();
        await loadStats();
        clearSelection();
        
    } catch (error) {
        showMessage('❌ Error eliminando posts: ' + error.message, 'error');
    }
}

