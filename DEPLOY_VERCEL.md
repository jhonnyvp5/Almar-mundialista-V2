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
- **Base de Datos:** El proyecto utiliza actualmente un archivo local `data_db.json` para guardar la información. La documentación oficial de Vercel indica que su entorno Serverless es de "solo-lectura" (read-only) y efímero, lo que significa que el archivo se guardará en `/tmp` y **se reiniciará constantemente** si la función decae. Para un ambiente de producción real, te sugerimos migrar a una base de datos real como Firestore, Vercel KV, Supabase o Cloud SQL.
- El archivo `vercel.json` se encarga de rutear de manera inteligente:
  - Todo el tráfico de activos (assets) tiene caché agresivo para que cargue ultra rápido.
  - El ruteo SPA evitará errores 404 al recargar si estás en páginas como `/ranking`.
  - Todo tráfico a `/api/*` se ejecutará de forma segura a través de los Serverless Functions apuntando al Express App (`server.ts`).
- La PWA permite instalar la aplicación en Android, iOS (Add to Home Screen) y escritorio con caché offline usando Service Workers, permitiendo una experiencia nativa.
