#!/usr/bin/env node

/**
 * Script para crear/actualizar usuarios del sistema de autenticación
 * Uso: node scripts/create-user.js
 */

const readline = require('readline');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('\n🔐 Configurar Usuario del Sistema\n');
  console.log('Este script te ayudará a crear o actualizar un usuario para acceder al panel de control.\n');

  const username = await question('👤 Nombre de usuario: ');
  if (!username) {
    console.error('❌ El nombre de usuario es requerido');
    process.exit(1);
  }

  const password = await question('🔑 Contraseña: ');
  if (!password || password.length < 6) {
    console.error('❌ La contraseña debe tener al menos 6 caracteres');
    process.exit(1);
  }

  const name = await question(`📝 Nombre completo (Enter para usar "${username}"): `) || username;
  const role = await question('👔 Rol (admin/editor, Enter para "admin"): ') || 'admin';

  rl.close();

  console.log('\n⏳ Procesando...\n');

  // Hash de la contraseña
  const passwordHash = await hashPassword(password);

  const userData = {
    username,
    passwordHash,
    name,
    role,
    createdAt: new Date().toISOString()
  };

  console.log('📋 Datos del usuario:');
  console.log(`   Usuario: ${username}`);
  console.log(`   Nombre: ${name}`);
  console.log(`   Rol: ${role}`);
  console.log(`   Hash: ${passwordHash.substring(0, 16)}...`);
  console.log('');

  // Generar comando para actualizar KV
  const updateCommand = `
wrangler kv:key put --binding=FB_PUBLISHER_KV auth_users '{"users":[${JSON.stringify(userData)}]}' --preview false
  `.trim();

  console.log('📝 Para crear/actualizar el usuario, ejecuta:');
  console.log('');
  console.log('─────────────────────────────────────────────');
  console.log(updateCommand);
  console.log('─────────────────────────────────────────────');
  console.log('');
  console.log('💡 Nota: Si ya tienes usuarios, necesitarás:');
  console.log('   1. Obtener los usuarios actuales: wrangler kv:key get --binding=FB_PUBLISHER_KV auth_users');
  console.log('   2. Agregar el nuevo usuario al array');
  console.log('   3. Actualizar con el comando de arriba');
  console.log('');
  console.log('✨ O puedes usar el script interactivo: node scripts/manage-users.js');
  console.log('');
}

main().catch(console.error);
