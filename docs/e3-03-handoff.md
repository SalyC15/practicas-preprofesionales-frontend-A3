# Traspaso Técnico E3-03: Verificación de Sesión, Renovación y Aislamiento Offline (Frontend)

Este documento sintetiza el estado técnico, evidencias de verificación, contratos de cliente, integración con el backend y propuesta de entrega para la funcionalidad de ciclo de vida de sesión y aislamiento offline (E3-03) en el repositorio frontend.

## 1. Resumen Ejecutivo y Procedencia de Criterios
- **Estado de la funcionalidad**: Implementación completa y verificada localmente sin regresiones de comportamiento.
- **Rama actual de trabajo**: `main` (base: `9ec1f92`).
- **Rama de integración destino según política**: `develop` (conforme a `.github/PULL_REQUEST_TEMPLATE.md`).
- **Advertencia crítica sobre el árbol de trabajo**: El repositorio reside actualmente en la rama `main` con cambios sin confirmar. La creación o cambio de rama (ej. hacia una nueva rama de feature) requiere autorización explícita previa del usuario y no debe realizarse mediante checkout de `origin/develop`, rebase ni reset sobre el árbol de trabajo sucio.
- **Procedencia de criterios de aceptación**: Los criterios de aceptación documentados en este traspaso son autónomos y proceden del registro técnico interno (`ProyectoYUNA/odd/tasks/e3-03-session-expiration.md`), el cual reside en la raíz exterior del proyecto fuera de este repositorio Git y se encuentra excluido del control de versiones. Se señala explícitamente que no se ha localizado un issue externo formal independiente con aprobación del cliente o producto; la verificación certifica el cumplimiento frente a los criterios acordados por el equipo técnico.
- **Acciones Git realizadas**: Cero commits, cero cambios en staging, cero modificaciones de ramas. Árbol de trabajo preservado íntegro.

## 2. Mapa de Archivos de la Funcionalidad (Allowlist de Entrega)
Los cambios abarcan 17 archivos exclusivos de autenticación, cliente HTTP, sincronización offline, vistas y documentación:

| Archivo | Estado Git | Líneas (+) | Líneas (-) | Total | Propósito |
|---|---|---|---|---|---|
| `src/api/client.ts` | Modificado | 31 | 12 | 43 | Cliente HTTP con Bearer token, AbortController, credentials: 'include' en `/auth/*` e intercepción 401. |
| `src/api/client.spec.ts` | Modificado | 49 | 3 | 52 | Pruebas de cliente API, cabeceras de autorización y aborto por desautenticación. |
| `src/auth/session.ts` | Sin seguimiento | 322 | 0 | 322 | Coordinador de sesión con Web Locks, renovación exclusiva, tombstone anónimo y eventos `storage`. |
| `src/auth/session.spec.ts` | Sin seguimiento | 223 | 0 | 223 | Pruebas de coordinador de sesión, Web Locks, expiración y sincronización multiventana. |
| `src/auth/AuthContext.tsx` | Modificado | 28 | 42 | 70 | Proveedor React conectado al coordinador de sesión con estado reactivo. |
| `src/auth/AuthContext.spec.tsx` | Modificado | 30 | 24 | 54 | Pruebas de integración de contexto React y propagación de estado de autenticación. |
| `src/components/AppLayout.tsx` | Modificado | 13 | 1 | 14 | Banner de notificación ante proximidad de expiración y acción de renovación explícita. |
| `src/components/AppLayout.spec.tsx` | Sin seguimiento | 25 | 0 | 25 | Pruebas de renderizado de banner de expiración y botón de renovación en topbar. |
| `src/pages/LoginPage.tsx` | Modificado | 2 | 1 | 3 | Mensajes de expiración y logout externo diferenciados de errores de credenciales inválidas. |
| `src/pages/LoginPage.spec.tsx` | Sin seguimiento | 30 | 0 | 30 | Pruebas de renderizado de mensajes de cierre de sesión forzado y expiración en login. |
| `src/offline/sync/pull.ts` | Modificado | 44 | 17 | 61 | Pull de sincronización cercado con `SessionFence` y aborto reactivo ante logout. |
| `src/offline/sync/push.ts` | Modificado | 64 | 32 | 96 | Push de outbox cercado con `SessionFence` y descarte de respuestas desfasadas. |
| `src/offline/sync/scheduler.ts` | Modificado | 21 | 7 | 28 | Planificador de sincronización coordinado con el ciclo de vida de la sesión activa. |
| `src/offline/sync/status.ts` | Modificado | 8 | 0 | 8 | Reseteo de indicadores de estado de sincronización al cerrar sesión. |
| `src/offline/sync/sessionIsolation.spec.ts` | Sin seguimiento | 301 | 0 | 301 | Pruebas de aislamiento de datos entre cuentas, purga de Dexie y cancelación de sincronización. |
| `docs/session-verification.md` | Sin seguimiento | 131 | 0 | 131 | Procedimientos de verificación manual y fronteras de la suite de producción PWA. |
| `docs/e3-03-handoff.md` | Sin seguimiento | 105 | 0 | 105 | Este documento de traspaso y propuesta de entrega. |
| **Total Frontend** | **17 archivos** | **1427** | **139** | **1566** | **Volumen autorado total de la funcionalidad E3-03** |

*Archivos excluidos*: La carpeta `odd/` (contiene `odd/tasks/e3-03-finalization.md`), `.yura-ci/`, `.env*` y archivos temporales.

## 3. Matriz de Criterios Acordados vs. Evidencia Histórica

| Criterio Acordado | Implementación Técnica Verificada | Evidencia Histórica Registrada |
|---|---|---|
| **C1**: Expiración visible y aviso claro de reautenticación | Detección en [`session.ts`](../src/auth/session.ts) de proximidad y vencimiento de token; [`LoginPage.tsx`](../src/pages/LoginPage.tsx) muestra mensaje explícito sin confundirlo con credenciales erróneas. | Suite unitaria Vitest: 101 tests en 26 archivos pasando (exit 0). |
| **C2**: Renovación explícita mediante Web Locks | [`sessionCoordinator.renew()`](../src/auth/session.ts) adquiere bloqueo exclusivo con `navigator.locks`; la pestaña líder renueva sin almacenar secretos en el cliente; las demás sincronizan vía `StorageEvent`. | Pruebas en `session.spec.ts` y `AuthContext.spec.tsx`. Verificado en navegador con rotación estricta de credenciales. |
| **C3**: Logout cross-tab inmediato y propagación multiventana | El cierre de sesión en una pestaña emite tombstone en `localStorage`; las pestañas hermanas detectan el evento `storage`, abortan peticiones y redirigen a `/login`. | Verificado en Chromium y Firefox con comunicación real inter-pestañas. |
| **C4**: Purga total de datos locales (IndexedDB / Dexie) | Se limpian completamente los 6 almacenes de Dexie (`hourLogs`, `placements`, `documents`, `evaluations`, `outbox`, `meta`) al cerrar sesión o cambiar de cuenta. | Verificado en `sessionIsolation.spec.ts` y en el arnés PWA con 0 registros residuales observados tras logout. |
| **C5**: Aislamiento estricto entre cuentas sucesivas | Nuevo usuario inicia con base local limpia y `checkpoint` vacío en `meta`; no envía `since=...` del usuario anterior al sincronizar. | Verificado en arnés PWA y pruebas de integración offline. |
| **C6**: Aborto de sincronización en vuelo (`SessionFence`) | Peticiones de red en curso de pull/push son canceladas inmediatamente mediante `AbortSignal` al desautenticarse; respuestas tardías son descartadas sin escribir en base de datos. | Tests en `sessionIsolation.spec.ts`, `pull.spec.ts` y `push.spec.ts`. |
| **C7**: Verificación en dos motores con desfase de reloj | Pruebas reales en Chromium 153 y Firefox 155 con Service Worker de producción; expiración de cliente adelantada y expiración en servidor ante retraso de reloj con esperas reales de 62.1s y 62.2s. | Suite PWA: 90 aserciones ejecutadas (45 Chromium, 45 Firefox) con exit code 0. Reporte SHA-256: `0a008571fa724a460ea22c7ff4ba4280f668d7ead011d6432a155af61157e63c`. |

## 4. Contratos de Cliente y Mecanismos de Aislamiento

### Almacenamiento Local (`localStorage`)
- **Sesión Activa**: Almacenada bajo `auth_session` conteniendo `{ accessToken, expiresAt, user, revision }`.
- **Tombstone de Cierre de Sesión**: Al ejecutar logout, se eliminan inmediatamente `access_token` y `user`, y se establece intencionalmente en `auth_session`:
  ```json
  { "signedOut": true, "revision": "<UUID>", "message": "La sesión se cerró en otra pestaña..." }
  ```
  Este marcador anónimo permite coordinar pestañas concurrentes mediante eventos `storage` y cercar peticiones tardías sin retener credenciales de usuario.

### Coordinación y Cercado (`SessionFence`)
- `SessionFence` es un **epoch/revisión local** del cliente compuesto por `{ generation, signal: AbortSignal, storageSnapshot, isCurrent() }`.
- **Aclaración Arquitectónica**: Es un mecanismo estrictamente interno del coordinador del frontend para invalidar peticiones de red y ciclos de sincronización obsoletos; **no corresponde** a la columna `generation` de la base de datos backend ni del JWT.

## 5. Parámetros de Integración y Frontera Same-Site

### Variables de Entorno del Frontend
| Variable | Archivo / Uso | Default | Comportamiento |
|---|---|---|---|
| `VITE_API_URL` | [`src/api/client.ts:3`](../src/api/client.ts) | `'http://localhost:3000/api'` | Prefijo base para todas las llamadas API en tiempo de compilación. |

### Transmisión de Credenciales y Frontera Schemeful Same-Site
- **Uso estricto de credenciales**: En [`src/api/client.ts:28`](../src/api/client.ts), la directiva `credentials: 'include'` se aplica específicamente a peticiones dirigidas a rutas que comiencen por `/auth/` (`path.startsWith('/auth/')`).
- **Frontera Schemeful Same-Site**: Las cookies de sesión del backend utilizan `SameSite=Strict`. Esta política opera bajo **schemeful same-site** (mismo esquema y mismo dominio registrable / eTLD+1).
  - Orígenes con diferente puerto pero mismo sitio (como frontend en `http://localhost:5173` y backend en `http://localhost:3001` durante las pruebas) funcionan correctamente con `credentials: 'include'` y cabecera CORS autorizada.
  - No es mandatorio un mismo origen estricto ni un proxy reverso obligatorio para el funcionamiento local o despliegues bajo el mismo eTLD+1; el proxy reverso es una alternativa opcional si frontend y backend operan en sitios distintos.

## 6. Procedimiento Operativo y Límites Observados
1. **Comandos Oficiales del Proyecto (`package.json`)**:
   - `pnpm run test`: Pruebas unitarias con Vitest (`vitest run`).
   - `pnpm run typecheck`: Validación estática de tipos (`tsc --noEmit`).
   - `pnpm run build`: Compilación de producción con PWA (`tsc --noEmit && vite build`).
2. **Entorno de Ejecución Observado en Pruebas**:
   - Node `v26.9.0` y pnpm `12.4.1` (gestor declarado: `pnpm@11.21.0`).
   - Vitest en Node 26 requiere la bandera `NODE_OPTIONS=--no-experimental-webstorage` para evitar colisiones con el soporte nativo experimental de Web Storage en jsdom.
3. **Límites de Verificación del Navegador**:
   - *Prompt de instalación en Firefox Desktop*: **No soportado** por el motor de Mozilla en versiones de escritorio. No constituye defecto de la aplicación.
   - *Instalación OS y actualización de versión de Service Worker*: **No verificadas / fuera de alcance** en esta batería local (se verificó la primera activación y el shell offline; el ciclo de actualización de versiones y empaquetado de OS corresponden a pruebas posteriores del equipo).
4. **Trazabilidad del Reporte de Producción**:
   - Archivo local: `.yura-ci/e3-03-browser/acceptance-report-prod-pwa.json` (17,107 bytes, SHA-256 `0a008571fa724a460ea22c7ff4ba4280f668d7ead011d6432a155af61157e63c`, 90 aserciones exitosas: 68 core + 22 PWA/SW).
   - `.yura-ci/` contiene ~1.1 GB de binarios y perfiles de navegadores temporales ignorados en Git y no constituye un artefacto publicado en CI.

## 7. Propuesta de Entrega y Política de PR (Pendiente de Autorización)
- **Política del Proyecto ([`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md))**:
  - `El PR apunta a develop, no a main`
  - `El PR tiene menos de 400 líneas de diff`
  - `Los tests pasan en local (pnpm test)`
  - `Agregué tests para el comportamiento nuevo`
- **Advertencia de Volumen**: La funcionalidad completa del frontend consta de 17 archivos y 1,566 líneas autoradas (+1,427 / -139). Un PR atómico unitario excede el umbral de 400 líneas.
- **Estrategia de Entrega Propuesta**:
  - **Nivel local**: Se propone un único commit consolidado que reúna comportamiento, pruebas y documentación para no fragmentar suites de pruebas de su código:
    - Mensaje propuesto: `feat(auth): integrate E3-03 session lifecycle and isolation`
    - Rama: Se propone crear una rama dedicada `feat/e3-03-session-expiration` a partir del HEAD actual de `main` preservando el árbol de trabajo intacto (sin checkout de `origin/develop`, rebase ni reset). *Esta acción requiere autorización previa*.
  - **Nivel de PR (Puerta de Política / NOT READY)**: La creación del PR no está lista de forma autónoma. Se debe consultar al equipo/mantenedor sobre una excepción de tamaño para admitir un PR atómico completo de la funcionalidad, o acordar una estrategia de PRs encadenados con planes y estados intermedios verificables aprobados. La autorización de commits locales por el usuario no anula la política de revisión del repositorio.
  - Las referencias locales de `origin/develop` no han sido actualizadas (`fetch`); la comparación final de la base del PR se realizará tras autorización explícita sin forzar ramas sobre árboles sucios.
