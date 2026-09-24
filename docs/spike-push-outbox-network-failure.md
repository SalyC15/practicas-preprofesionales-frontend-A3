# Spike: pérdida de operaciones durante `pushOutbox`

## Objetivo

Determinar si un fallo de red durante el envío del outbox puede perder operaciones locales, identificar el orden exacto que lo provoca y delimitar si el problema alcanza a documentos y evaluaciones.

## Evidencia en el repositorio

El caso está cubierto en [push.spec.ts](../src/offline/sync/push.spec.ts), en el test `conserva la operación y registra el error cuando falla la red`.

La red se inyecta sin tiempos ni `sleep` mediante:

```ts
vi.mock('@/api/client', () => ({ api: vi.fn() }))
mockedApi.mockRejectedValue(new Error('sin conexión'))
```

La aserción principal verifica que la operación sigue en `db.outbox` y registra el intento y el error. Después, el mismo test reemplaza el mock por una respuesta exitosa, vuelve a ejecutar `pushOutbox()` y verifica que la operación se reintenta y recién entonces se elimina.

### Resultado de la reproducción histórica

Con la implementación anterior, este test fallaba porque esperaba `db.outbox.count()` igual a `1`, pero obtenía `0`. Esa ejecución demuestra la pérdida causada por el orden de las operaciones. Con el arreglo actual, el test pasa y funciona como prueba de no-regresión.

## Orden que causaba la pérdida

La implementación anterior ejecutaba estas operaciones:

1. Leía las entradas del outbox.
2. Construía el lote `ops` y el mapa de ids locales.
3. Ejecutaba `db.outbox.bulkDelete(...)`.
4. Llamaba a `api('/sync/push', ...)`.
5. La capa de red rechazaba la promesa con `Error('sin conexión')`.
6. La excepción se propagaba, pero la entrada ya no existía en `db.outbox`.

Por eso la siguiente sincronización no tenía nada que reintentar.

La implementación actual invierte la eliminación: primero espera la respuesta del servidor, conserva las entradas ante errores de red y elimina únicamente las que reciben un resultado `applied` con datos de servidor. Los rechazos permanecen en el outbox con `attempts` y `lastError`.

## Alcance por entidad

| Entidad | ¿Usa `pushOutbox`? | Alcance de este bug |
| --- | --- | --- |
| Horas (`hourLog`) | Sí. Es la única entidad permitida por `OutboxEntry` y `enqueue`. | **Sí**, era el caso afectado por la eliminación anticipada. |
| Documentos | No. `DocumentsPage` hace la subida directamente a `/placements/:id/documents` y guarda el resultado local solo después de recibir respuesta. | **No afecta este bug de outbox**. Un fallo de red deja la subida sin completar, pero no hay una operación encolada que `pushOutbox` pueda perder. |
| Evaluaciones | No. `submitEvaluation` hace un `POST /evaluations` directo y está documentado como no sincronizable. | **No afecta este bug de outbox**. Requiere red y no tiene reintento offline mediante outbox. |

## Verificación

- `pnpm vitest run src/offline/sync/push.spec.ts`: 5 tests pasan.
- `pnpm vitest run`: 20 archivos y 63 tests pasan.
- `pnpm typecheck`: pasa.
- `pnpm dup`: continúa reportando clones preexistentes en páginas no relacionadas (`2.42%`, umbral configurado en `0%`).
