/**
 * Script de configuración inicial
 * Ejecuta: node scripts/setup.js
 */

console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 Configuración del Auto-Publisher para Facebook         ║
╚════════════════════════════════════════════════════════════╝

Para configurar el sistema, sigue estos pasos:

1️⃣  INSTALAR WRANGLER
   npm install

2️⃣  AUTENTICARSE EN CLOUDFLARE
   npx wrangler login

3️⃣  CREAR KV NAMESPACE
   npx wrangler kv:namespace create FB_PUBLISHER_KV
   
   Copia el ID que te devuelve y actualiza wrangler.toml:
   [[kv_namespaces]]
   binding = "FB_PUBLISHER_KV"
   id = "el_id_que_obtuviste"

4️⃣  OBTENER CREDENCIALES DE FACEBOOK

   🔐 PROCESO DE AUTORIZACIÓN (IMPORTANTE)
   
   Este paso requiere que TÚ autorices a tu app a publicar en tu fanpage.
   
   📖 Guía completa paso a paso:
   Ver: GUIA-AUTORIZACION-FACEBOOK.md
   
   Resumen rápido:
   
   A. Ve a https://developers.facebook.com/
   B. Crea una app o usa una existente
   C. Ve a Graph API Explorer: https://developers.facebook.com/tools/explorer/
   D. Selecciona tu app y tu página
   E. Click "Generate Access Token" → Aquí AUTORIZAS tu app
   F. Selecciona permisos: 
      ✓ pages_show_list
      ✓ pages_manage_posts
      ✓ pages_read_engagement
   G. Click "Continue as [Tu Nombre]" → Autorización confirmada
   H. Copia el token
   I. Extiende el token a 60 días (Access Token Debugger)
   J. Obtén el Page Access Token (nunca expira):
      Query en Explorer: me/accounts
      Copia el "access_token" de tu página
   K. Obtén el Page ID desde tu fanpage (About section)

5️⃣  CONFIGURAR SECRETOS EN CLOUDFLARE
   
   npx wrangler secret put FB_PAGE_ACCESS_TOKEN
   (pega el token de acceso cuando te lo pida)
   
   npx wrangler secret put FB_PAGE_ID
   (pega el ID de tu página cuando te lo pida)

6️⃣  DESPLEGAR EL WORKER
   npm run deploy

7️⃣  CONFIGURAR TUS POSTS
   
   Visita la URL de tu worker que te mostrará wrangler después del deploy.
   Por ejemplo: https://facebook-auto-publisher.tu-cuenta.workers.dev

8️⃣  CONFIGURAR HORARIOS (OPCIONAL)
   
   Edita wrangler.toml para ajustar los horarios de publicación:
   
   [triggers]
   crons = [
     "0 9 * * *",   # 9:00 AM
     "0 14 * * *",  # 2:00 PM
     "0 19 * * *"   # 7:00 PM
   ]
   
   Formato: "minuto hora * * *" en UTC
   Ejemplos:
   - "0 8 * * *"     -> Todos los días a las 8:00 AM
   - "30 14 * * *"   -> Todos los días a las 2:30 PM
   - "0 */3 * * *"   -> Cada 3 horas
   - "0 9 * * 1-5"   -> Lunes a viernes a las 9:00 AM

📚 DOCUMENTACIÓN

- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Facebook Graph API: https://developers.facebook.com/docs/graph-api/
- Cron Syntax: https://developers.cloudflare.com/workers/configuration/cron-triggers/

💡 TIPS

- El sistema publica 1 URL por cada cron trigger
- Los posts se publican en orden (round-robin)
- Puedes publicar manualmente desde el dashboard
- Los posts pueden ser agregados en cualquier momento
- Revisa los logs con: npx wrangler tail

🆘 SOPORTE

Si tienes problemas:
1. Verifica que los secretos estén configurados correctamente
2. Revisa que el token de Facebook tenga los permisos necesarios
3. Comprueba los logs con: npx wrangler tail
4. Asegúrate de que el KV namespace esté creado y vinculado

╔════════════════════════════════════════════════════════════╗
║  ¡Listo! Ejecuta los pasos anteriores para comenzar       ║
╚════════════════════════════════════════════════════════════╝
`);
