/**
 * Script para generar contenido IA para todas las URLs de todos los proyectos
 * Uso: node scripts/generate-all-content.js
 */

const WORKER_URL = process.env.WORKER_URL || 'https://facebook-auto-publisher.jorgeferreirauy.workers.dev';
const BATCH_SIZE = 10; // Procesar 10 URLs a la vez
const DELAY_BETWEEN_BATCHES = 2000; // 2 segundos entre lotes

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getProjects() {
  console.log(`${colors.cyan}📁 Obteniendo lista de proyectos...${colors.reset}`);
  const response = await fetch(`${WORKER_URL}/api/projects`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error('No se pudieron obtener los proyectos');
  }
  
  return data.projects;
}

async function getProjectPosts(projectId) {
  const response = await fetch(`${WORKER_URL}/api/projects/${projectId}/posts`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`No se pudieron obtener posts del proyecto ${projectId}`);
  }
  
  return data.posts;
}

async function generateContentForURL(url, context = '') {
  const response = await fetch(`${WORKER_URL}/api/generate-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, context })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Error al generar contenido');
  }
  
  return data.content;
}

async function addPostToProject(projectId, url, message) {
  const response = await fetch(`${WORKER_URL}/api/projects/${projectId}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, message })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Error al agregar post');
  }
  
  return data.post;
}

async function processProject(project) {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📦 Procesando: ${project.name}${colors.reset}`);
  console.log(`${colors.blue}   Dominio: ${project.domain}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  // Obtener posts existentes del proyecto
  const existingPosts = await getProjectPosts(project.id);
  const existingUrls = new Set(existingPosts.map(post => post.url));
  
  // Obtener URLs del proyecto (desde project.urls)
  const urls = project.urls || [];
  
  // Filtrar URLs que ya tienen posts
  const urlsToProcess = urls.filter(url => !existingUrls.has(url));
  
  console.log(`   📊 URLs totales: ${urls.length}`);
  console.log(`   ✅ Ya procesadas: ${existingUrls.size}`);
  console.log(`   ⏳ Por procesar: ${urlsToProcess.length}\n`);
  
  if (urlsToProcess.length === 0) {
    console.log(`${colors.green}   ✓ Todas las URLs ya tienen contenido generado${colors.reset}\n`);
    return { processed: 0, errors: 0, skipped: urls.length };
  }
  
  let processed = 0;
  let errors = 0;
  
  // Procesar por lotes
  for (let i = 0; i < urlsToProcess.length; i += BATCH_SIZE) {
    const batch = urlsToProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(urlsToProcess.length / BATCH_SIZE);
    
    console.log(`   ${colors.cyan}🔄 Lote ${batchNum}/${totalBatches} (${batch.length} URLs)${colors.reset}`);
    
    // Procesar el lote en paralelo
    const promises = batch.map(async (url) => {
      try {
        // Generar contenido con IA
        const content = await generateContentForURL(url, `Contenido del sitio ${project.name}`);
        
        // Agregar post al proyecto
        await addPostToProject(project.id, url, content.message);
        
        console.log(`      ${colors.green}✓${colors.reset} ${url.substring(0, 60)}...`);
        return { success: true };
      } catch (error) {
        console.log(`      ${colors.red}✗${colors.reset} ${url.substring(0, 60)}... - ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    
    processed += results.filter(r => r.success).length;
    errors += results.filter(r => !r.success).length;
    
    // Pausa entre lotes
    if (i + BATCH_SIZE < urlsToProcess.length) {
      console.log(`      ${colors.yellow}⏸ Pausa de ${DELAY_BETWEEN_BATCHES/1000}s antes del siguiente lote...${colors.reset}\n`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`\n   ${colors.green}✅ Procesadas: ${processed}${colors.reset}`);
  console.log(`   ${colors.red}❌ Errores: ${errors}${colors.reset}\n`);
  
  return { processed, errors, skipped: existingUrls.size };
}

async function main() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  🤖 Generador Masivo de Contenido IA                  ║${colors.reset}`);
  console.log(`${colors.blue}║  📍 Worker: ${WORKER_URL.substring(0, 30)}... ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  try {
    const startTime = Date.now();
    
    // Obtener todos los proyectos
    const projects = await getProjects();
    console.log(`${colors.green}✓ Encontrados ${projects.length} proyectos${colors.reset}\n`);
    
    const stats = {
      totalProcessed: 0,
      totalErrors: 0,
      totalSkipped: 0
    };
    
    // Procesar cada proyecto
    for (const project of projects) {
      const result = await processProject(project);
      stats.totalProcessed += result.processed;
      stats.totalErrors += result.errors;
      stats.totalSkipped += result.skipped;
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    // Resumen final
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📊 RESUMEN FINAL${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`   ${colors.green}✅ Procesadas: ${stats.totalProcessed}${colors.reset}`);
    console.log(`   ${colors.yellow}⏭  Ya existían: ${stats.totalSkipped}${colors.reset}`);
    console.log(`   ${colors.red}❌ Errores: ${stats.totalErrors}${colors.reset}`);
    console.log(`   ⏱  Tiempo total: ${duration} minutos`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    console.log(`${colors.green}🎉 ¡Proceso completado!${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Error fatal: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Ejecutar
main();
