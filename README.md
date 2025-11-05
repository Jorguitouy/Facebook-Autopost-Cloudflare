# 📘 Auto-Publisher para Facebook

Sistema automatizado para publicar URLs de tus sitios web en tu fanpage de Facebook con mensajes personalizados y en horarios específicos, usando Cloudflare Workers.

## 🌟 Características

- ✅ Publicación automática en horarios programados
- ✅ Mensajes personalizados para cada URL
- ✅ Dashboard web para gestión de posts
- ✅ Publicación manual cuando lo necesites
- ✅ Estadísticas de publicaciones
- ✅ Sin servidor que mantener (serverless)
- ✅ Gratis hasta 100,000 peticiones/día con Cloudflare

## 🚀 Instalación Rápida

### 1. Clonar e Instalar

```powershell
cd C:\auto-facebook-publisher
npm install
```

### 2. Configurar Cloudflare

```powershell
# Autenticar
npx wrangler login

# Crear KV namespace para almacenar datos
npx wrangler kv:namespace create FB_PUBLISHER_KV
```

Copia el ID que te devuelve y actualiza `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FB_PUBLISHER_KV"
id = "tu_id_aqui"  # Reemplaza con el ID obtenido
```

### 3. Obtener Credenciales de Facebook

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Crea una app o selecciona una existente
3. Ve a **Herramientas > Graph API Explorer**
4. Selecciona tu app y tu página
5. Agrega permisos: `pages_manage_posts`, `pages_read_engagement`
6. Genera un token de acceso de página
7. Obtén el ID de tu página (Configuración > Información de la página)

### 4. Configurar Secretos

```powershell
# Configurar el token de acceso
npx wrangler secret put FB_PAGE_ACCESS_TOKEN
# Pega tu token cuando te lo pida

# Configurar el ID de la página
npx wrangler secret put FB_PAGE_ID
# Pega el ID de tu página cuando te lo pida
```

### 5. Desplegar

```powershell
npm run deploy
```

¡Listo! Tu worker estará disponible en una URL como:
`https://facebook-auto-publisher.tu-cuenta.workers.dev`

## 📖 Uso

### Dashboard Web

Accede a la URL de tu worker para ver el dashboard donde puedes:

- ✏️ Agregar posts individuales
- 📦 Agregar múltiples posts en lote
- 👁️ Ver todos los posts (pendientes, publicados, errores)
- 🚀 Publicar manualmente
- 📊 Ver estadísticas

### Agregar Posts Individualmente

Usa el formulario en el dashboard o la API:

```javascript
POST /api/posts
{
  "url": "https://tusitio.com/articulo",
  "message": "¡Mira este increíble artículo! 🚀"
}
```

### Agregar Posts en Lote

Puedes agregar todas tus 200 URLs de una vez:

```javascript
POST /api/posts/bulk
{
  "posts": [
    {
      "url": "https://sitio1.com/pagina1",
      "message": "Descubre contenido increíble 🎯"
    },
    {
      "url": "https://sitio2.com/pagina2",
      "message": "No te pierdas esto 🔥"
    },
    // ... hasta 200 URLs
  ]
}
```

### Ejemplo de Script para Agregar URLs

Crea un archivo `urls.json` con tus URLs:

```json
[
  {"url": "https://sitio1.com/url1", "message": "Mensaje 1"},
  {"url": "https://sitio1.com/url2", "message": "Mensaje 2"},
  {"url": "https://sitio2.com/url1", "message": "Mensaje 3"}
]
```

Luego puedes copiar y pegar directamente en el campo de texto del dashboard.

## ⏰ Configurar Horarios de Publicación

Edita `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 9 * * *",   # 9:00 AM UTC todos los días
  "0 14 * * *",  # 2:00 PM UTC todos los días
  "0 19 * * *",  # 7:00 PM UTC todos los días
]
```

**Importante:** Los horarios están en UTC. Ajusta según tu zona horaria:
- España (CET/CEST): UTC +1/+2
- México (CST): UTC -6
- Argentina (ART): UTC -3

### Ejemplos de Cron:

```
"0 8 * * *"     -> Cada día a las 8:00 AM
"0 */4 * * *"   -> Cada 4 horas
"0 9 * * 1-5"   -> Lunes a viernes a las 9:00 AM
"30 14 * * *"   -> Cada día a las 2:30 PM
"0 9,14,19 * * *" -> A las 9 AM, 2 PM y 7 PM
```

## 📊 API Endpoints

- `GET /` - Dashboard web
- `GET /api/posts` - Listar todos los posts
- `POST /api/posts` - Agregar un post
- `POST /api/posts/bulk` - Agregar múltiples posts
- `POST /api/publish` - Publicar manualmente
- `GET /api/stats` - Ver estadísticas
- `DELETE /api/posts/:id` - Eliminar un post

## 🔍 Monitoreo

Ver logs en tiempo real:

```powershell
npx wrangler tail
```

## 💰 Costos

Cloudflare Workers tiene un plan gratuito muy generoso:

- ✅ 100,000 peticiones/día GRATIS
- ✅ 1GB de almacenamiento KV GRATIS
- ✅ Sin tarjeta de crédito requerida

Con 3 publicaciones al día, estarías muy por debajo del límite gratuito.

## 🔐 Seguridad

- Los tokens se almacenan como secretos cifrados en Cloudflare
- No se guardan credenciales en el código
- CORS configurado para tu dominio
- API protegida

## 🛠️ Desarrollo Local

```powershell
npm run dev
```

Esto inicia un servidor local en `http://localhost:8787`

## 🐛 Troubleshooting

### "Error: FB_PAGE_ACCESS_TOKEN no configurado"
→ Ejecuta: `npx wrangler secret put FB_PAGE_ACCESS_TOKEN`

### "Error al publicar: Invalid OAuth token"
→ Tu token de Facebook expiró. Genera uno nuevo desde Graph API Explorer.

### "No hay posts pendientes"
→ Agrega posts desde el dashboard o la API.

### Los posts no se publican automáticamente
→ Verifica que los cron triggers estén configurados en `wrangler.toml` y desplegados.

## 📝 Notas Importantes

1. **Token de Facebook:** Los tokens de página generados desde Graph API Explorer suelen expirar. Para producción, considera obtener un token de larga duración.

2. **Límites de Facebook:** La API de Facebook tiene límites de tasa. Con 3 publicaciones al día no deberías tener problemas.

3. **Formato de URLs:** Asegúrate de que tus URLs sean accesibles públicamente para que Facebook pueda generar previsualizaciones.

4. **Mensajes:** Personaliza cada mensaje para que sea relevante al contenido y evitar que Facebook lo detecte como spam.

## 🎯 Flujo de Trabajo Recomendado

1. Despliega el worker
2. Agrega todas tus 200 URLs en lote
3. El sistema publicará automáticamente según el cron configurado
4. Monitorea el dashboard para ver el progreso
5. Agrega más URLs cuando lo necesites

## 📚 Recursos

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api/)
- [Cron Expression Generator](https://crontab.guru/)

## 🤝 Contribuciones

Este es tu sistema personal, pero si quieres mejorarlo:

1. Agregar filtros por sitio web
2. Implementar variaciones aleatorias de mensajes
3. Agregar soporte para imágenes
4. Integrar con otros servicios (Twitter, LinkedIn, etc.)

## 📄 Licencia

MIT - Úsalo libremente para tus proyectos.

---

¿Preguntas? Revisa los logs con `npx wrangler tail` o consulta la documentación de Cloudflare y Facebook.
