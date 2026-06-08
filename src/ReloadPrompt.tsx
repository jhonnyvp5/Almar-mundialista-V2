/// <reference types="vite-plugin-pwa/client" />
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-amber-400 font-bold text-sm">Actualización disponible</h4>
          <p className="text-slate-300 text-xs">Hay una nueva versión de la aplicación. Actualiza para ver los cambios.</p>
        </div>
        <button 
          onClick={() => setNeedRefresh(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Actualizar ahora
      </button>
    </div>
  );
}
