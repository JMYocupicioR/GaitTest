# GAIT · MVP analizador de marcha

Aplicación web (React + TypeScript + Vite) que guía la captura de un video de marcha, permite anotar eventos clave y genera un informe inmediato con métricas básicas, checklist clínico y exportación en PDF/JSON. Está pensada para ejecutarse como PWA en móviles y desplegarse en Netlify.

## Características principales

- Flujo guiado lateral-only: introducción, calibración, captura, anotación, resultados e informe.
- Grabación en el navegador con control de calidad (fps, duración, encuadre) y repetición rápida.
- Cálculo local de velocidad, cadencia, longitud de paso y asimetría usando eventos de talón.
- Heurísticas clínicas mínimas (antálgico, parkinsoniano, estepaje, etc.) basadas en métricas + checklist observacional.
- Informe responsive con semáforo de riesgo, descarga en PDF y exportación estructurada JSON.
- PWA lista para Netlify (service worker, manifest, iconos 192/512).

## Puesta en marcha

```bash
npm install
npm run dev
```

- `npm run dev`: abre Vite en modo desarrollo.
- `npm run build`: compila la app y genera el service worker.
- `npm run lint`: ejecuta ESLint con TypeScript.

## Estructura relevante

- `src/state/sessionStore.ts`: estado global y lógica para métricas/heurísticas.
- `src/screens/`: pantallas del flujo principal (captura, eventos, resultados, informe).
- `src/lib/`: utilidades para métricas, patrones clínicos, calidad, PDF y schema JSON.
- `src/hooks/useMediaRecorder.ts`: wrapper para controlar la cámara y el MediaRecorder.

## Próximos pasos sugeridos

1. Integrar pose estimation (MediaPipe/TensorFlow.js) para detección automática de eventos.
2. Añadir gestión de usuarios/sesiones y sincronización opcional.
3. Ajustar umbrales con datos piloto reales y ampliar la librería de patrones.
4. Internacionalización (ES/EN) y accesibilidad exhaustiva para el flujo móvil.

## Despliegue

El proyecto está optimizado para Netlify: basta con apuntar el build command a `npm run build` y el directorio de publicación a `dist/`. Añade variables de entorno o headers según tus políticas de privacidad cuando empieces a compartir informes.
