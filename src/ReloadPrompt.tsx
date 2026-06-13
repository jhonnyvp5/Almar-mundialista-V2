/// <reference types="vite-plugin-pwa/client" />
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
      if (r) {
        // Verificar actualizaciones en segundo plano cada 15 segundos
        setInterval(() => {
          r.update().catch(err => console.error('Error checking for SW update:', err));
        }, 15000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      console.log('Nueva actualización detectada. Recargando automáticamente...');
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
