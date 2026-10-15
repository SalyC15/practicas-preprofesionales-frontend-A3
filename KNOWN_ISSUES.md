# Problemas conocidos

Lo que sabemos que está mal y no alcanzamos a arreglar antes de entregar esto.

Si encuentras algo que no está acá, agrégalo. Casi seguro hay más. No tuvimos tiempo de
auditar todo el repo, solo de anotar lo que nos mordió mientras construíamos.

## D-06 · [RESUELTO] La validación de horas estaba en tres lados

Resuelto en frontend (`src/lib/hour-log-validation.ts`) y backend (`src/hour-log/hour-log.validation.ts`).

Historial de copias y divergencia previa:
1. `src/hour-log/dto/create-hour-log.dto.ts` (backend): `@Min(0.5) @Max(12)` (límite de 12 horas).
2. `src/hour-log/hour-log.service.ts` (backend): `dto.hours <= 0 || dto.hours > 10` (límite de 10 horas).
3. `src/components/HourLogForm.tsx` (frontend): `validateHours` (antes duplicada como `validateHoursOnSubmit` y `validateHoursLive`), cortaba en 8 horas (`hoursValue > 8`).

Estado actual:
- Se unificó la regla a un solo lugar por repositorio (`src/lib/hour-log-validation.ts` en frontend).
- Ambos repositorios coinciden en los valores: mínimo 0.5 h, máximo 10 h, formato HH:mm (`^([01]\d|2[0-3]):[0-5]\d$`).
- Los límites son configurables (`VITE_MIN_HOUR_LOG_HOURS`, `VITE_MAX_HOUR_LOG_HOURS`, `resolveHourLogBounds`).
- Los mensajes de error quedaron unificados idénticos al backend:
  - "las horas deben estar entre 0.5 y 10"
  - "la hora de inicio debe ser anterior a la de fin"
  - "las horas deben tener el formato HH:mm"
- Duplicación interna eliminada.


## D-08 · El indicador de sync miente por una ventana corta

`src/offline/sync/status.ts`, `src/offline/sync/scheduler.ts`.

Cuando termina un push, `runSync` llama `setStatus({ syncing: false, lastSyncAt: ... })`.
En ese momento el indicador ya se pinta como sincronizado. El contador de `pending` se
recalcula aparte, en un `await db.outbox.count()` una línea después. Entre esas dos
llamadas hay una vuelta al event loop en la que el estado en memoria dice "ya terminé" con
un contador de pendientes que todavía no se actualizó. Es una ventana de milisegundos, no
la vas a notar mirando la pantalla, pero si escribes un test que aserte sobre el orden de
los estados del indicador, la vas a agarrar. No nos alcanzó a arreglar. Hay que juntar
ambos `setStatus` en uno solo, o calcular `pending` antes de marcar `syncing: false`.

## D-09 · `HourLogForm.tsx` hace de todo

`src/components/HourLogForm.tsx`, 348 líneas.

Estado del formulario, las dos copias de la validación de horas (ver D-06), formateo de la
fecha en español para la confirmación, cálculo de la duración a partir de inicio y fin, la
escritura a `db.hourLogs` y el `enqueue()` al outbox, todo en el mismo componente.
Funciona, pero cualquier cambio, hasta uno chico como agregar un campo, obliga a leerlo
entero para saber qué más se puede romper. Debería partirse en un hook de formulario, los
helpers puros que ya casi están separados (`formatDateForConfirmation`,
`computeDurationLabel`) y un hook de persistencia aparte. No llegamos.

## D-10 · Los hooks que tocan Dexie no tienen tests

`src/offline/hooks/`: `useHourLogs.ts`, `usePlacement.ts`, `useSyncStatus.ts`. La
excepción es `useOnline.ts`, que sí tiene spec.

No supimos testear hooks que tocan IndexedDB y lo dejamos así. Todos usan `useLiveQuery` de
`dexie-react-hooks` contra la base real de Dexie; en otras partes del repo probamos con
`fake-indexeddb` (mira `offline/db.spec.ts` como referencia) y no debería ser muy distinto
hacerlo acá, pero nunca nos sentamos a escribirlos. Si vas a tocar cómo se leen las horas o
la plaza del estudiante desde la UI, vas a ciegas. No hay red de seguridad que te avise si
rompiste algo.
