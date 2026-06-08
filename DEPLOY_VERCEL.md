# Instrucciones de Despliegue en Vercel

Este proyecto ha sido optimizado y configurado para desplegarse fácilmente en Vercel, incluyendo soporte total para PWA (Progressive Web App) y configuraciones de caché en producción.

## Pasos para desplegar:

### Opción 1: A través de GitHub (Recomendado)
1. Sube este proyecto a un repositorio en tu cuenta de GitHub.
2. Inicia sesión en [Vercel](https://vercel.com).
3. Haz clic en **Add New...** > **Project**.
4. Importa el repositorio de GitHub donde subiste el proyecto.
5. Vercel detectará automáticamente que es un proyecto de Vite.
6. En la sección **Build and Output Settings**, Vercel utilizará los comandos existentes (`npm run build`).
7. Haz clic en **Deploy**. 

### Opción 2: Usando Vercel CLI
Si prefieres usar la línea de comandos de Vercel desde tu máquina virtual local:
1. Asegúrate de tener Vercel CLI instalado: `npm i -g vercel`
2. Posiciónate en la raíz del proyecto.
3. Ejecuta el comando de despliegue:
   ```bash
   vercel
   ```
4. Sigue las instrucciones interactivas del CLI (puedes usar las opciones por defecto).
5. Para desplegar directamente en producción, usa:
   ```bash
   vercel --prod
   ```

## Notas Importantes sobre el Backend en Vercel:
- **Base de Datos:** El proyecto ha sido migrado exitosamente a **Neon Postgres**, eliminando la limitación del entorno "read-only" de Vercel (donde no se podía guardar en un archivo local). Tu base de datos es ahora relacional, escalable y persistente.
- **Variables de Entorno:**
  Para que la aplicación lea e interactúe con la base de datos de Neon en Vercel, **debes configurar la variable de entorno `DATABASE_URL`** en el panel de control del proyecto en Vercel (Vercel > Project Settings > Environment Variables).
- El archivo `vercel.json` se encarga de rutear de manera inteligente:
  - Todo el tráfico de activos (assets) tiene caché agresivo para que cargue ultra rápido.
  - El Service Worker (`sw.js`) y el manifiesto (`manifest.webmanifest`) tienen directivas de cero caché para siempre detectar actualizaciones y permitir a la recarga de nuevas versiones PWA.
  - El ruteo SPA evitará errores 404 al recargar si se utiliza React Router (aunque aquí es una SPA en 1 URL, las reglas base lo cubren).
  - Todo tráfico a `/api/*` se ejecutará de forma segura a través de los Serverless Functions apuntando a tu backend (`server.ts`).
- La PWA permite instalar la aplicación "AlmarGOOOL" en Android, iOS (a través de Safari -"Add to Home Screen") y de escritorio (Chrome/Edge/Safari), brindando una experiencia offline básica, carga relámpago e interacciones parecidas a una app puramente nativa.
