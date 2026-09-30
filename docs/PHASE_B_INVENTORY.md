# Fase B — Motor Eléctrico Correcto

Estado: código nuevo construido, probado y auditado, **sin conectar todavía al camino en vivo**
(`calcularSistema()` / `doPost`). Hay una decisión de producto pendiente de autorización antes
de ese último paso — ver "PROBLEMA / IMPACTO / OPCIONES / RECOMENDACIÓN" al final.

## CAMBIOS

**Archivos modificados** (Code.gs, con verificación de regresión después de cada cambio):
- `leerCatalogo_()` — 24 campos nuevos, todos opcionales y aditivos (PARTE 1 y 2). Ninguno de
  los 20 campos existentes cambió de comportamiento.
- `leerZonas_()` — 1 campo nuevo (`temperaturaMaxima`), opcional y aditivo.
- `ENCABEZADOS_CATALOGO` / `guardarItemCatalogo_()` — extendidos para poder persistir los campos
  nuevos desde la pantalla "Catálogo" de la app cuando existan (no migra el Sheet de producción
  existente — ver PARTE 10 abajo).

**Archivos creados**:
- `backend-appscript/clone-real/ElectricalEngine.gs` — el motor nuevo completo (PARTES 3-5).
- `tests/golden-cases-b.js`, `tests/run-b.js` — Golden Cases B01-B08.
- `tests/compare.js` — lógica de diff extraída de `tests/run.js` para no duplicarla en `run-b.js`.
- `package.json` — `npm test` corre Golden Cases A + B juntos.

**Verificado en cada paso** (no solo al final): `node tests/run.js` después de cada edición a
`Code.gs`, `clasp push` real contra Apps Script, y una llamada real al Web App en producción
antes/después — sin cambios.

## MODELO

**Módulo — campos nuevos** (todos `undefined` si la columna no existe, nunca inventados):
`imp`, `coefTempVmp`, `coefTempIsc`, `temperaturaMinOperacion`, `temperaturaMaxOperacion`,
`tecnologia`, `dimensiones`, `peso`, `certificaciones`, `fechaVerificacion`.

**Inversor — campos nuevos**:
`corrienteMaxEntradaMPPT` (alias explícito del campo legacy `corrienteMaxPorMppt` — mismo dato,
nombre sin ambigüedad), `corrienteMaxCortocircuitoMPPT` (**genuinamente nuevo**, distinto del
anterior — PARTE 2), `potenciaACMax`, `tensionArranque`, `entradasPorMPPT`, `numeroMaxStrings`,
`tensionAC`, `frecuencia`, `fases`, `factorPotencia`, `potenciaAparente`, `eficiencia`,
`temperaturaOperacion`, `gradoIP`, `antiIslanding`.

**Zona — campo nuevo**: `temperaturaMaxima` (necesaria para Vmp en caliente).

## INGENIERÍA

- **Voc frío**: `Voc(T) = Voc_STC * (1 + coefTempVoc/100 * (tMin - 25))` — misma fórmula legacy,
  reexpuesta con trazabilidad (`calcularVocFrio_`).
- **Vmp caliente** (nuevo): `Vmp(T) = Vmp_STC * (1 + coefTempVmp/100 * (tMax - 25))`
  (`calcularVmpCaliente_`) — nunca usa `Vmp_STC × numeroModulos` como sustituto.
- **Corriente de diseño**: `Isc_STC * FACTOR_SEGURIDAD_ISC` (1.25×, NEC 690.8/RETIE) — misma
  fórmula legacy.
- **Corriente de entrada MPPT**: `corrienteDiseno * stringsPorMppt <= corrienteMaxEntradaMPPT`.
- **Corriente de cortocircuito MPPT** (nuevo, distinto): `Isc_STC * stringsPorMppt <= corrienteMaxCortocircuitoMPPT`.
- **Potencia DC**: `Pdc = numPaneles * potenciaW_panel`, verificado contra `potenciaACMax * 1.3`
  (ratio DC/AC) cuando existe; si no, se conserva el heurístico legacy ±30% como referencia.
- **Enumeración de candidatos** (`enumerarCandidatosString_`): recorre TODO
  `panelesPorString` desde `minSeriePorMppt` hasta `min(maxSeriePorVoltaje, maxSeriePorMppt,
  numPanelesTotal)`, evaluando cada uno con las 8 verificaciones de abajo — ya no salta directo
  al máximo.

## ESTADOS

Todas las funciones de verificación nuevas (`verificarVocFrioString_`, `verificarVmpCalienteString_`,
`verificarVentanaMpptMin_`, `verificarVentanaMpptMax_`, `verificarCorrienteEntradaMppt_`,
`verificarCorrienteCortocircuitoMppt_`, `verificarConfiguracionStrings_`,
`verificarDistribucionMppt_`, `verificarPotenciaDC_`, `verificarPotenciaAC_`) devuelven
`{status: STATUS.*, ...}` en vez de un booleano. El estado general de cada candidato en
`enumerarCandidatosString_` se calcula así: cualquier `FAIL` → `FAIL`; si no, cualquier
`REQUIRES_REVIEW` o `UNKNOWN` → `REQUIRES_REVIEW` (un dato desconocido nunca se convierte en
`PASS` silencioso); si todo lo demás es `PASS` → `PASS`.

## AUDITORÍA

Los 10 checks pedidos en PARTE 7 ya existen como funciones independientes que devuelven forma de
AuditEntry (`check`, `status`, `calculated`, `limit`, `formula`, `source`, `motivo`):
`STRING_VOC_COLD`, `STRING_VMP_HOT`, `MPPT_VOLTAGE_MIN`, `MPPT_VOLTAGE_MAX`,
`MPPT_INPUT_CURRENT`, `MPPT_SHORT_CIRCUIT_CURRENT`, `DC_POWER`, `AC_POWER`,
`STRING_CONFIGURATION`, `MPPT_DISTRIBUTION`. `engineVersion`/`timestamp` se agregan en el punto
de integración con `Audit.gs` (pendiente hasta que se conecten al camino en vivo — ver decisión
abajo). Fuentes usadas: `NEC 690.7` (Voc frío), `NEC 690.8 / RETIE` (corriente de diseño/entrada),
`LEGACY_UNDOCUMENTED` donde el proyecto no cita una norma (Vmp caliente, ventanas MPPT,
distribución, potencia — ninguna fórmula se inventó una fuente que no existe en el proyecto).

## TESTS

**Golden Cases A** (sin cambios, 7/7 PASS): CASE-001 (incompatible), CASE-002 (compatible,
consumo), CASE-003 (cargabilidad), CASE-004 (consumo, mayor escala), CASE-005 (batería),
CASE-006 (BOM), CASE-007 (unifilar).

**Golden Cases B** (nuevos, 8/8 PASS): CASE-B01 (Voc frío FAIL), CASE-B02 (Vmp caliente FAIL),
CASE-B03 (corriente entrada FAIL), CASE-B04 (entrada PASS ≠ cortocircuito FAIL, prueba que son
restricciones distintas), CASE-B05 (6 candidatos enumerados, no solo 1), CASE-B06 (distribución
desbalanceada → REQUIRES_REVIEW), CASE-B07 (dato faltante → `undefined`, no inventado),
CASE-B08 (con todos los datos nuevos poblados → PASS limpio).

`npm test` (o `node tests/run.js && node tests/run-b.js`): **15/15 PASS.**

## REGRESIONES

**Ninguna.** `calcularSistema()` no llama a ningún código nuevo — los 7 resultados de Fase A son
byte-idénticos antes y después (verificado con el mismo `tests/run.js`, sin tocar sus
`expectedLegacyOutput`). La tabla ANTES/DESPUÉS/CAUSA/JUSTIFICACIÓN que pide la PARTE 9 está
vacía porque no hubo ningún cambio de resultado que explicar.

## RIESGOS

1. **El catálogo real no tiene ninguno de los campos nuevos** — `coefTempVmp`,
   `temperaturaMaxima`, `corrienteMaxCortocircuitoMPPT`, `tensionArranque`, `potenciaACMax`,
   `numeroMaxStrings`, etc. están vacíos en los 9 equipos reales de Energitel cargados. Esto es
   exactamente lo que produce el problema de la sección siguiente.
2. El motor nuevo no está conectado a `doPost` — si alguien intenta usar `enumerarCandidatosString_`
   fuera de las pruebas, hoy solo es accesible corriendo funciones sueltas desde el editor o vía
   los tests, no desde la app.
3. `AC_VOLTAJE` sigue hardcodeado en 220V (Code.gs) — fuera de alcance de Fase B a propósito
   (PARTE 3, regla "no mezclar fases").

## SIGUIENTE FASE (solo documentado, no implementado)

Una vez resuelta la decisión de abajo: conectar `enumerarCandidatosString_` como reemplazo de
`verificarString_` dentro de `calcularSistema`, wireando `Audit.gs` para que cada llamada
persista las AuditEntry (hoy solo se devuelven, no se guardan en ningún lado). Fase C (caída de
tensión real, AC trifásico, DPS DC/AC, puesta a tierra real) sigue sin tocarse, como corresponde.

---

## PROBLEMA / IMPACTO / OPCIONES / RECOMENDACIÓN

### PROBLEMA

El motor nuevo, corriendo con el catálogo REAL (los 9 equipos de Energitel SAS cargados la
sesión pasada), nunca puede producir un candidato en estado `PASS` puro. Ejemplo medido, no
hipotético — panel Jinko P1 + inversor Growatt I1 (la combinación que el motor legacy ya usa hoy
para cotizar clientes reales), 7 paneles, Barranquilla:

```
node -e "... enumerarCandidatosString_(panel, inversor, 22, undefined, 7) ..."

6 candidatos encontrados — TODOS en REQUIRES_REVIEW o FAIL, ninguno en PASS.
```

La causa: `STRING_VMP_HOT` siempre es `UNKNOWN` (falta `coefTempVmp` del panel y
`temperaturaMaxima` de la zona — ninguno de los dos existe en ningún dato real hoy), y un
`UNKNOWN` en cualquier chequeo degrada el estado general del candidato a `REQUIRES_REVIEW` —
exactamente como pide ENGINEERING.md ("No convertir un dato desconocido en PASS").

### IMPACTO

Si `enumerarCandidatosString_` reemplaza a `verificarString_` dentro de `calcularSistema` HOY,
y la selección de la combinación ganadora exige `status === PASS`: **"Calcular sistema" deja de
encontrar una combinación compatible para absolutamente cualquier cliente**, incluyendo los que
hoy funcionan y se están cotizando. Eso rompe el MVP — viola la Regla Absoluta #1 de esta misma
Fase B.

### OPCIONES

**(a) Conectar el motor exigiendo solo `status !== FAIL`** (aceptar `PASS` y `REQUIRES_REVIEW`
como seleccionables, mostrando claramente en la propuesta cuáles chequeos quedaron sin verificar
por falta de dato). El MVP sigue funcionando exactamente igual que hoy para clientes reales, y
además gana trazabilidad honesta de qué NO se pudo verificar. Es justo lo que ya hace
`verificarString_` hoy (decide con los datos que tiene), solo que ahora explícito y auditado en
vez de implícito.

**(b) No conectar el motor todavía** — dejarlo como capa de validación adicional/informativa
(ej. una pestaña nueva "Auditoría técnica" en la app que muestre el detalle candidato por
candidato), sin que decida qué combinación se selecciona. `calcularSistema` sigue usando
`verificarString_` (legacy) para elegir, y el motor nuevo solo informa en paralelo.

**(c) Exigir `status === PASS` estricto, pero primero cargar los datos térmicos reales** (Voc/Vmp
en caliente y frío) de las fichas técnicas de los 9 equipos ya cargados — dato que SÍ existe en
los datasheets oficiales (ya los descargué la sesión pasada para Voc/Isc; Vmp con coeficiente de
temperatura probablemente también está ahí, no lo revisé todavía) — y la temperatura máxima de
diseño de Barranquilla (dato climático público). Esto resolvería el `UNKNOWN` con datos reales en
vez de relajar el criterio de aceptación.

### RECOMENDACIÓN TÉCNICA

**(a) para conectar ahora + (c) como tarea de seguimiento.** Conectar con `status !== FAIL` como
criterio de selección no es "bajar el estándar" — es la misma honestidad que pide
ENGINEERING.md: seleccionar sobre lo que SÍ se puede verificar, marcar explícitamente lo que no,
y no fingir que no verificar Vmp-caliente es lo mismo que haberlo verificado. Es estrictamente
mejor que el estado actual (donde ese chequeo no existe ni se menciona). Paralelamente, cargar
`coefTempVmp` de los datasheets Livoltek/ZNShine (ya descargados) y la temperatura máxima de
Barranquilla cerraría la mayoría de los `REQUIRES_REVIEW` con datos reales, no con un criterio
más permisivo.

**Esperando tu autorización antes de tocar `calcularSistema`/`doPost`** — esa es la línea que
cambia comportamiento de producto y por eso no la crucé sin decisión tuya.
