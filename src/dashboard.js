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
document.addEventListener('DOMContentLoaded', () => {
    init();
});

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
            </div>
            
            <div class="project-actions">
                <button class="success" onclick="viewProjectPosts('${project.id}')">📝 Posts</button>
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
    const aiEnabled = document.getElementById('projectAiEnabled').checked;
    const autoPublish = document.getElementById('projectAutoPublish').checked;
    
    if (!name || !domain) {
        showMessage('⚠️ Por favor completa el nombre y dominio', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                domain,
                description,
                aiEnabled,
                autoPublish
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✅ Proyecto "${name}" creado exitosamente`, 'success');
            
            // Limpiar formulario
            document.getElementById('projectName').value = '';
            document.getElementById('projectDomain').value = '';
            document.getElementById('projectDescription').value = '';
            
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
    const active = document.getElementById('editProjectActive').checked;
    
    if (!name || !domain) {
        showMessage('⚠️ Por favor completa todos los campos requeridos', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, domain, description, active })
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
    
    return posts.map(post => `
        <div class="post-item ${post.status}">
            <div class="post-content">
                <div class="post-url">${post.url}</div>
                <div class="post-message">${post.message}</div>
                <div class="post-meta">
                    <span class="post-status ${post.status}">${getStatusLabel(post.status)}</span>
                    ${post.aiGenerated ? '<span class="post-status" style="background: rgba(147, 51, 234, 0.1); color: #9333ea;">🤖 IA</span>' : ''}
                    ${post.publishedAt ? `<span class="post-date">📅 ${formatDate(post.publishedAt)}</span>` : ''}
                    ${post.errorAt ? `<span class="post-date" style="color: var(--danger);">❌ ${post.lastError}</span>` : ''}
                </div>
            </div>
            <div class="post-actions">
                ${post.status === 'pending' ? `<button class="success" onclick="publishSpecificPost('${projectId}', '${post.id}')">▶️ Publicar</button>` : ''}
                <button class="danger" onclick="deletePost('${projectId}', '${post.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
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

function updateAIProviderInfo() {
    const provider = document.getElementById('aiProvider').value;
    const infoDiv = document.getElementById('aiProviderInfo');
    const infoText = document.getElementById('aiProviderInfoText');
    
    if (provider === 'openai') {
        infoText.innerHTML = `
            <strong>OpenAI (GPT)</strong><br>
            Obtén tu API Key en: <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a><br>
            Modelos: gpt-3.5-turbo, gpt-4 (configurable en wrangler.toml)
        `;
    } else if (provider === 'gemini') {
        infoText.innerHTML = `
            <strong>Google Gemini</strong><br>
            Obtén tu API Key en: <a href="https://makersuite.google.com/app/apikey" target="_blank">makersuite.google.com/app/apikey</a><br>
            Modelo: gemini-pro (configurable en wrangler.toml)
        `;
    }
    
    infoDiv.style.display = 'flex';
}

// Event listener para cambio de proveedor
document.addEventListener('DOMContentLoaded', () => {
    const aiProviderSelect = document.getElementById('aiProvider');
    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', updateAIProviderInfo);
    }
});
