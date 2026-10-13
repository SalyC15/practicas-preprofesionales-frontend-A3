# Manual Verification Checklist: Session Expiration & Offline Sync Isolation

This checklist specifies the manual multi-tab and multi-browser verification procedures for session expiration (E3-03), token rotation/revocation, and Dexie offline synchronization isolation.

> [!IMPORTANT]
> Automated tests use fake clocks (`vi.useFakeTimers()`) and in-memory IndexedDB (`fake-indexeddb`). While unit tests prove state invariants, real definition-of-done across browser engines requires verifying Web Locks, native IndexedDB persistence, and cross-tab `StorageEvent` propagation with a live backend.

---

## Environment Setup

| Requirement | Specification |
|-------------|---------------|
| Browser 1 | Mozilla Firefox (Profile 1: e.g. Student Account) |
| Browser 2 | Google Chrome / Chromium / Firefox Private Window (Profile 2: e.g. Tutor / Second Student) |
| Tabs | 2 active tabs open per browser profile pointed to the app URL |
| Backend | Running API backend with HttpOnly cookie support (`rt_sessionId_gN`) |

---

## Verification Scenarios

### 1. Cross-Tab Explicit Renewal & Stale Access Rejection

**Objective**: Verify that explicit renewal in Tab A rotates credentials and that stale access tokens cannot be reused.

- [ ] **Step 1**: In Browser 1, open **Tab 1** and **Tab 2** logged in as Student A.
- [ ] **Step 2**: Open DevTools Network tab in Tab 1; observe active Bearer token `AT_1`.
- [ ] **Step 3**: In Tab 1, click **"Renovar sesión"**.
- [ ] **Step 4**: Verify Tab 1 receives rotated token `AT_2` and updated expiration timestamp.
- [ ] **Step 5**: Switch to Tab 2 without reloading: verify Tab 2 adopts the new session or synchronizes state via storage snapshot.
- [ ] **Step 6**: From DevTools console, replay an API request using the captured old `AT_1`:
  - Expected: Request rejected with `401 Unauthorized` by the backend. Tab 1/2 remains active on `AT_2`.

---

### 2. Multi-Tab Logout & In-Flight Sync Teardown

**Objective**: Verify that logging out in one tab immediately tears down credentials, aborts in-flight network sync, and wipes local IndexedDB.

- [ ] **Step 1**: In Browser 1, Tab 1, disconnect network (DevTools "Offline" or throttle to "Slow 3G").
- [ ] **Step 2**: Create an hour log offline (status: `queued` in Dexie outbox).
- [ ] **Step 3**: Re-enable network so `pushOutbox` / `pullChanges` begins syncing.
- [ ] **Step 4**: While sync is in-flight, click **"Salir"** in Tab 2.
- [ ] **Step 5**: Observe Tab 1 immediately:
  - Tab 1 detects storage tombstone (`StorageEvent` / revision change).
  - Tab 1 redirects to `/login` with message: *"La sesión se cerró en otra pestaña. Volvé a iniciar sesión."*
  - In-flight sync network requests are aborted via `AbortController`.
  - Stale sync results or catch retry bookkeeping are dropped.
- [ ] **Step 6**: Check DevTools > Application/Storage > IndexedDB (`practicas`):
  - Tables `hourLogs`, `placements`, `documents`, `evaluations`, `outbox`, and `meta` (key: `checkpoint`) are completely cleared.
  - Sync indicator status shows 0 pending.

---

### 3. Account Switch Isolation

**Objective**: Ensure that a subsequent user logging into the same browser instance starts with a completely clean database and no stale checkpoint.

- [ ] **Step 1**: Complete logout in Browser 1.
- [ ] **Step 2**: Log in as Student B on Tab 1.
- [ ] **Step 3**: Check DevTools IndexedDB:
  - Table `meta` has no `checkpoint` from Student A.
  - Table `outbox` has 0 items.
  - Table `hourLogs` has 0 items from Student A.
- [ ] **Step 4**: Inspect the first `/sync/pull` network request made by Student B:
  - Verify query parameters do **not** include `since=...` from Student A.
  - Newly pulled data belongs strictly to Student B.

---

### 4. Clock Discrepancies & Expiration (Without Mutating Host OS Clock)

**Objective**: Verify session expiration UI and teardown under clock shifts without altering system time.

- [ ] **Step 1**: Log in to Browser 1.
- [ ] **Step 2**: In DevTools Console, inspect session expiration:
  ```js
  JSON.parse(localStorage.getItem('auth_session')).expiresAt
  ```
- [ ] **Step 3**: Simulate time advancement without OS clock modification by either:
  - Using Chrome DevTools / Firefox extension for time virtualization (e.g. `Time Shift` or modifying token with a short TTL test token), or
  - Waiting for session window expiration (configured test token or 15m idle).
- [ ] **Step 4**: When expiration threshold is reached:
  - Topbar shows expiry notification or redirects to `/login`.
  - Login page displays: *"Tu sesión expiró. Volvé a iniciar sesión para continuar."*
  - IndexedDB data is purged before new credentials can be entered.

---

## Status of Automated vs. Manual Testing

| Verification Level | Status | Notes |
|--------------------|--------|-------|
| Frontend Unit & Integration (Vitest / JSDOM) | **101 / 101 Passing** (26 files) | Script oficial: `pnpm run test` (`vitest run`). Comando histórico observado: `NODE_OPTIONS=--no-experimental-webstorage pnpm with current exec vitest run src/auth src/api ...` ejecutado bajo Node `v26.9.0` y pnpm `12.4.1` (gestor declarado: `pnpm@11.21.0`). La bandera `NODE_OPTIONS=--no-experimental-webstorage` es requerida en Node 26 para evitar colisiones con el Web Storage nativo experimental de jsdom. |
| Typecheck (`tsc --noEmit`) | **Passing** | 0 TypeScript errors (`pnpm run typecheck`). |
| Production Build (`vite build`) | **Passing** | Bundle de producción y Service Worker PWA generados exitosamente (`pnpm run build`). |
| Live HTTP Backend Integration | **23 / 23 Passing** | Aserciones directas contra API backend y PostgreSQL local (`localhost:5432/practicas`). |
| Dev Browser Acceptance (Chromium & Firefox) | **68 / 68 Passing** | Pruebas de aceptación preliminares en navegadores duales en modo desarrollo. |
| Production PWA Acceptance (`acceptance-runner-prod.mjs`) | **90 / 90 Passing** (45 Chromium, 45 Firefox) | Desglose: **68 aserciones core de sesión + 22 aserciones PWA/SW** (exit code 0, 0 fallos, 0 omitidos). Timestamp: `2026-10-05T23:50:39.502Z`. Reporte local: `.yura-ci/e3-03-browser/acceptance-report-prod-pwa.json` (17,107 bytes, SHA-256: `0a008571fa724a460ea22c7ff4ba4280f668d7ead011d6432a155af61157e63c`). |
| Real Dual-Browser & Live Deployment Check | **Manual Checklist** | El checklist manual superior permanece como referencia operativa para pruebas exploratorias de usuario y despliegues staging con perfiles humanos independientes. |

---

## Completed Observed Automation Boundary (Production PWA)

La verificación automatizada sobre el bundle de producción PWA ejecutó 90 aserciones independientes (45 en Chromium 153.0.8010.12 y 45 en Firefox 155.0), compuestas por 68 aserciones de sesión y ciclo de vida más 22 aserciones específicas de Service Worker / PWA:

1. **Service Worker y Caché Inmutable**:
   - Service Worker nativo activado y controlando múltiples pestañas concurrentes.
   - Servido desde bundle estático de producción sin scripts de HMR (Vite dev).
   - Precache inmutable en `CacheStorage` con 36 fuentes tipográficas y assets estáticos; cero peticiones de API o credenciales cacheadas.
2. **Resiliencia Offline y Shell de Autenticación**:
   - Recarga nativa offline tanto en sesión activa como posterior a logout.
   - En offline tras logout: shell de login renderizado correctamente, purga completa de los 6 almacenes de IndexedDB (`hourLogs`, `placements`, `documents`, `evaluations`, `outbox`, `meta`), checkpoint limpiado, credenciales (`access_token`, `user`) removidas.
   - **Tombstone de Cierre de Sesión**: Se preserva intencionalmente en `localStorage` el marcador anónimo `auth_session` con `{ signedOut: true, revision: <UUID>, message: ... }` para cercar peticiones desfasadas y sincronizar pestañas sin retener credenciales.
3. **Cercado y Coordinación de Sesión (`SessionFence`)**:
   - El mecanismo `SessionFence` (`generation`, `signal`, `storageSnapshot`) es un **epoch/revisión local** del coordinador del frontend para cancelar peticiones obsoletas y abortar sync en vuelo; **no corresponde** a la columna `generation` de la base de datos ni al JWT.
4. **Rotación, Revocación y Límites de Tiempo**:
   - Rotación estricta de tokens: acceso con token revocado rechazado con `401 Unauthorized`, nuevo token emitido y aceptado.
   - Logout cross-tab nativo mediante eventos `storage` (`StorageEvent`).
   - Expiración de cliente adelantada y expiración en servidor ante retraso de reloj de cliente verificada con espera física real de 62.1s (Chromium) y 62.2s (Firefox) bajo configuración de prueba con TTL de 60s (override temporal de test, no el default de 900s de producción).
5. **Cierre de Entorno y Base de Datos**:
   - Verificación final de PostgreSQL local con 80 sesiones totales, 80 revocadas, 0 activas. Snapshots de líneas de base históricas de 51 y 70 sesiones preservados intactos sin mutaciones destructivas en tablas de negocio.
   - Procesos de prueba detenidos limpiamente (SIGTERM a API PID 603112; puertos 3001 y 5173 liberados).

### Límites de Verificación y Trazabilidad Local
- **Diferenciación de Soporte y Alcance**:
  - *Prompt de instalación en Firefox para escritorio*: **No soportado** por el motor de Mozilla en versiones de escritorio. No constituye defecto de la aplicación.
  - *Instalación a nivel de sistema operativo y actualización de versión de SW*: **No verificadas / fuera de alcance** en esta batería local (se verificó la primera activación y el shell offline; el ciclo de actualización de versiones y empaquetado de OS corresponden a pruebas posteriores del equipo).
- **Trazabilidad del Reporte**: El reporte de aceptación `acceptance-report-prod-pwa.json` (17,107 bytes, digest SHA-256 `0a008571fa724a460ea22c7ff4ba4280f668d7ead011d6432a155af61157e63c`, fechado `2026-10-05T23:50:39.502Z`) se mantiene localmente bajo `.yura-ci/` para trazabilidad de evidencia. Dicha carpeta (~1.1 GB de binarios de navegadores y perfiles temporales) está ignorada en Git y no constituye un artefacto publicado ni un comando de CI reproducible en un clon limpio sin la instalación previa del arnés de pruebas. La matriz en markdown y el hash proporcionan la trazabilidad portable requerida.
