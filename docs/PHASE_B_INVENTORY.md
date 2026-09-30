# Fase B — Motor Eléctrico Correcto

Estado: **conectado al camino en vivo** (`calcularSistema()` → `doPost` → producción, desplegado
como @6). `enumerarCandidatosString_` reemplazó a `verificarString_` (legacy) como el código que
decide qué se cotiza. La integración sigue la semántica exacta autorizada en
"AUTORIZACIÓN CONDICIONADA — FASE B" (ver sección "DECISIÓN ADOPTADA" más abajo) — no la regla
`status !== FAIL` que se propuso primero y fue rechazada explícitamente.

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

## CONTRADICCIÓN ENCONTRADA

La primera propuesta de integración (registrada en la versión anterior de este documento) usaba
`status !== FAIL` como único criterio de selección — es decir, trataba `PASS` y `REQUIRES_REVIEW`
como equivalentes para decidir qué combinación cotizar. El usuario la rechazó explícitamente
("AUTORIZACIÓN CONDICIONADA — FASE B"):

> "NO USAR ESTA REGLA COMO REGLA DE CUMPLIMIENTO — No implementar como regla global:
> `status !== FAIL` si eso significa que `PASS`, `WARNING`, `REQUIRES_REVIEW` y `UNKNOWN` son
> equivalentes para seleccionar o declarar una configuración como técnicamente conforme. Los
> estados conservan significado diferente."

La objeción es correcta: colapsar los cuatro estados en un booleano (`seleccionable` /
`no seleccionable`) tira exactamente la información que Fase B existe para producir. Un candidato
`REQUIRES_REVIEW` no es "casi tan bueno" como uno `PASS` — es un candidato que nadie verificó del
todo, y presentarlo con la misma confianza que uno validado es el mismo problema que Fase B vino
a corregir (elegir el máximo posible sin declarar qué se garantiza).

## DECISIÓN ADOPTADA

Implementada tal como la especificó el usuario, en `elegirMejorCandidato_` (ElectricalEngine.gs)
y en la selección final de `calcularSistema` (Code.gs):

1. **`FAIL` excluye por completo.** Un candidato `FAIL` nunca es seleccionable, en ningún nivel.
2. **`PASS` se prefiere siempre sobre `REQUIRES_REVIEW`.** Si existe al menos un candidato `PASS`
   para una combinación panel+inversor, se elige entre los `PASS` (nunca entre los
   `REQUIRES_REVIEW`, aunque estos sean más baratos). Lo mismo aplica entre combinaciones
   panel+inversor distintas: la selección final primero filtra por `PASS` a nivel de todo el
   catálogo, y solo si no hay ningún `PASS` en absoluto se elige entre los `REQUIRES_REVIEW`.
3. **`REQUIRES_REVIEW` puede seleccionarse, pero nunca se presenta como validado.** El resultado
   completo lleva `estadoConfiguracion: 'VALIDADA' | 'PROVISIONAL'` y
   `mensajeEstadoConfiguracion`. Si la combinación elegida es `REQUIRES_REVIEW`, el mensaje es
   literalmente `'CONFIGURACIÓN PROVISIONAL / REQUIERE REVISIÓN TÉCNICA'` — nunca
   `'CONFIGURACIÓN VALIDADA'`.
4. **`UNKNOWN` nunca se convierte en `PASS` silencioso.** Esto ya lo garantizaba
   `enumerarCandidatosString_` desde que se escribió (cualquier `UNKNOWN` sube el estado general
   del candidato a `REQUIRES_REVIEW`) — la integración no lo toca ni lo relaja.
5. **Dentro del mismo nivel de estado**, se prefiere el candidato con más paneles por string
   (menos strings en paralelo → BOM más barato) — mismo criterio económico que el legacy
   `nSerie = Math.min(nSerieMax, numPanelesTotal)`. Esto es una elección de configuración física
   entre candidatos igualmente válidos/revisables, no una reclasificación de estados.

`resultado.auditoria` expone los 8 chequeos del candidato elegido como `AuditEntry`
(`engineVersion: 'electrical-fase-b'`), y `resultado.verificacionString.checks` los deja también
disponibles ahí para quien consuma solo ese objeto (BOM, diagrama).

## COMPORTAMIENTO DEL CATÁLOGO REAL

Probado en vivo contra el catálogo de producción (Web App @6, `action: 'calcular'`,
`{consumoMensualKWh: 350, ciudad: 'Barranquilla'}`):

```json
{
  "fueraDeAlcanceAGPE": false,
  "potenciaAjustadaKwp": 2.54,
  "numPanelesEstimado": null,
  "error": "Ningún inversor del catálogo es compatible con el string resultante para esta potencia. Revisa el catálogo o ajusta manualmente."
}
```

El catálogo real de producción hoy **solo tiene el panel ZNShine ZXNR-BD132-650 y los 5
inversores Livoltek de Energitel SAS** (no tiene el panel/inversor demo Jinko+Growatt que usan
los Golden Cases A). Ese es exactamente el hallazgo de incompatibilidad genuina documentado antes
de que empezara Fase B: el Isc del panel (16.34 A) excede la corriente máxima por MPPT de los 5
inversores (14-16 A) — `MPPT_INPUT_CURRENT` da `FAIL` real para las 5 combinaciones, no por falta
de dato. El motor nuevo reproduce el mismo resultado que el legacy para este catálogo — **no es
una regresión de la integración, es la misma incompatibilidad real ya conocida.**

Con el catálogo DEMO (`tests/fixtures/`, panel Jinko P1 + inversor Growatt I1 — el par que usan
los Golden Cases A y que simula la combinación que hoy se cotiza a clientes con equipos
genéricos): el motor SÍ encuentra una configuración seleccionable, pero en `REQUIRES_REVIEW`
(ver siguiente sección) — nunca en `FAIL`.

## TRATAMIENTO DE REQUIRES_REVIEW

Para el catálogo demo (representativo de cualquier combinación que no tenga los campos nuevos de
Fase B completos — que es TODO el catálogo real hoy, incluso Energitel), la combinación elegida
queda en `estadoConfiguracion: 'PROVISIONAL'` porque estos chequeos no se pueden verificar con los
datos actuales:

| Chequeo | Estado | Motivo |
|---|---|---|
| `STRING_VMP_HOT` | `UNKNOWN` | Falta `coefTempVmp` del panel (ningún panel del catálogo real lo tiene — ver tabla de datos térmicos). |
| `MPPT_VOLTAGE_MIN` | `REQUIRES_REVIEW` | Depende de `STRING_VMP_HOT`; se evalúa con Vmp_STC como referencia (sin corrección por temperatura caliente), marcado explícitamente como pendiente de revisión manual. |
| `MPPT_SHORT_CIRCUIT_CURRENT` | `UNKNOWN` | Falta `corrienteMaxCortocircuitoMPPT` del inversor (solo los 5 Livoltek reales lo tienen cargado; el inversor demo Growatt I1 no). |
| `STRING_CONFIGURATION` | `UNKNOWN` | Falta `numeroMaxStrings` del inversor — campo nuevo, no cargado en ningún equipo todavía. |
| `MPPT_DISTRIBUTION` | `REQUIRES_REVIEW` (cuando aplica) | Los strings no se reparten en partes iguales entre los MPPT — política del proyecto (CASE-B06), no un dato faltante. |

Esto es la "REGLA DE NO ASUMIR" funcionando exactamente como se diseñó: el sistema **nunca**
inventa que verificó algo que no verificó. La consecuencia de producto es real y se declara sin
maquillarla: **con los datos cargados hoy, ninguna cotización del catálogo real puede llegar a
`estadoConfiguracion: 'VALIDADA'`** — todas quedan `PROVISIONAL` (cuando hay candidato) o sin
combinación (cuando hay incompatibilidad genuina, como Energitel). Cerrar esto requiere seguir
cargando `numeroMaxStrings`, `potenciaACMax` y `coefTempVmp` de fichas técnicas reales — trabajo
de datos, no un ajuste al criterio de aceptación.

## DATOS TÉRMICOS DOCUMENTADOS (PARTE 5)

Todos los valores siguientes están cargados en el Sheet de producción (verificado por
lectura después de escribir, no solo por la respuesta `success:true` del API — ver la sesión
de trabajo que encontró y corrigió el bug de migración de encabezados, sección RIESGOS).

### Inversores — `tensionArranque` / `corrienteMaxCortocircuitoMPPT`

| Fabricante | Modelo exacto | Campo | Valor | Unidad | Fuente | Documento | Fecha de verificación | Observación |
|---|---|---|---|---|---|---|---|---|
| Livoltek | GT1-6KD2 | TensionArranque | 90 | V | Datasheet oficial Livoltek | Ficha técnica GT1 Series (descargada sesión Energitel) | 2026-09-30 | — |
| Livoltek | GT1-6KD2 | CorrienteMaxCortocircuitoMPPT | 20 | A | Datasheet oficial Livoltek | Ficha técnica GT1 Series | 2026-09-30 | Distinto de `CorrienteMaxPorMPPT` (16 A, rated) — confirmado como campo genuinamente separado (CASE-B04). |
| Livoltek | GT1-3K3S1 | TensionArranque | 70 | V | Datasheet oficial Livoltek | Ficha técnica GT1 Series | 2026-09-30 | — |
| Livoltek | GT1-3K3S1 | CorrienteMaxCortocircuitoMPPT | 20 | A | Datasheet oficial Livoltek | Ficha técnica GT1 Series | 2026-09-30 | — |
| Livoltek | GT1-10KT2 | TensionArranque | 90 | V | Datasheet oficial Livoltek | Ficha técnica GT1 Series | 2026-09-30 | — |
| Livoltek | GT1-10KT2 | CorrienteMaxCortocircuitoMPPT | 20 | A | Datasheet oficial Livoltek | Ficha técnica GT1 Series | 2026-09-30 | — |
| Livoltek | Hyper-3000 | TensionArranque | `NO DISPONIBLE` | V | Datasheet oficial Livoltek | Ficha técnica Hyper Series | 2026-09-30 | El fabricante no publica tensión de arranque para esta serie — dejado `undefined` (no inventado, `leerNumeroOpcional_`). CASE-B07 congela este comportamiento. |
| Livoltek | Hyper-3000 | CorrienteMaxCortocircuitoMPPT | 17.5 | A | Datasheet oficial Livoltek | Ficha técnica Hyper Series | 2026-09-30 | — |
| Livoltek | Hyper-5000(A)-R31009 | TensionArranque | `NO DISPONIBLE` | V | Datasheet oficial Livoltek | Ficha técnica Hyper Series | 2026-09-30 | Igual que Hyper-3000 — no publicado por el fabricante. |
| Livoltek | Hyper-5000(A)-R31009 | CorrienteMaxCortocircuitoMPPT | 17.5 | A | Datasheet oficial Livoltek | Ficha técnica Hyper Series | 2026-09-30 | — |

### Panel — `coefTempVmp`

| Fabricante | Modelo exacto | Campo | Valor | Observación |
|---|---|---|---|---|
| ZNShine Solar | ZXNR-BD132-650 | CoefTempVmp | `NO DISPONIBLE` | Investigado específicamente (búsqueda dirigida al datasheet oficial). El fabricante publica coeficientes de temperatura de Pmax, Voc e Isc, pero **no** un coeficiente de temperatura de Vmp independiente — convención común en fichas técnicas de paneles (no es una omisión del proyecto). Dejado `undefined`, nunca aproximado a partir de Voc. |

### Zona — `temperaturaMaxima`

| Ciudad | Campo | Valor | Unidad | Fuente | Documento/estación | Fecha de verificación | Observación |
|---|---|---|---|---|---|---|---|
| Barranquilla | TemperaturaMaxima | 31.7 | °C | WeatherSpark (reconstrucción climática, 95% de peso en la estación) | Estación Ernesto Cortissoz International Airport (SKBQ) | 2026-09-30 | Promedio de la máxima diaria del mes más caluroso (mayo), 89°F. El valor extremo "rara vez por encima de" es 93°F/33.9°C — se usó el promedio (más representativo de diseño típico), no el extremo, siguiendo el mismo criterio que `temperaturaMinima` ya cargada (22°C, valor de diseño, no el extremo histórico). |

**Pendiente de cargar** (necesario para cerrar la mayoría de los `REQUIRES_REVIEW`/`UNKNOWN`
restantes, no bloqueante para esta fase): `numeroMaxStrings` y `potenciaACMax` de los 5 inversores
Livoltek (datos que sí existen en las fichas técnicas ya descargadas pero no se transcribieron
todavía), y `coefTempVmp` de algún panel alternativo que sí lo publique (si se agrega uno al
catálogo).

## RESULTADOS ANTES/DESPUÉS DE LA INTEGRACIÓN

**Los 7 Golden Cases A pasan sin modificar ningún valor de `expectedLegacyOutput`.** No es que no
haya cambiado nada — es que el comparador (`tests/compare.js`) solo recorre las claves presentes
en `expectedLegacyOutput`, y los campos nuevos (`estadoConfiguracion`, `mensajeEstadoConfiguracion`,
`auditoria`, `verificacionString.status`, `verificacionString.checks`) se agregan sin tocar
ninguno de los campos ya congelados. Verificado explícitamente (no asumido) que los valores
numéricos/objeto ya congelados siguen siendo IDÉNTICOS byte a byte porque:

- El panel+inversor+`numPaneles` elegidos no cambian: el filtro de rango de potencia (±30%) sigue
  igual, y dentro de cada combinación el candidato de mayor `panelesPorString` (el que antes
  elegía el legacy como único resultado posible) sigue siendo el elegido, porque ningún chequeo
  nuevo depende de qué tan largo es el string — todos los `UNKNOWN`/`REQUIRES_REVIEW` de los
  casos demo son por CAMPO faltante (`coefTempVmp`, `numeroMaxStrings`, etc.), no por el tamaño
  del string, así que TODOS los candidatos de una misma combinación panel+inversor caen en el
  mismo nivel de estado y se preserva el desempate por tamaño.
- `vocCorregidoV`, `fusibleRecomendadoA`, `maxStringsPorMppt`, `panelesPorString`, `numeroStrings`,
  `stringsPorMppt` se calculan con las MISMAS fórmulas que el legacy (`calcularVocFrio_` y
  `calcularCorrienteDiseno_` son, literalmente, las mismas expresiones de `verificarString_`
  reexpuestas con trazabilidad — ver sección INGENIERÍA).
- `opcionesCompatibles` no cambió en ningún caso: las mismas combinaciones panel+inversor que
  antes se consideraban `compatible: true` hoy tienen al menos un candidato no-`FAIL` (`PASS` o
  `REQUIRES_REVIEW`), así que siguen contando.

**Campo nuevo observado en los 7 casos**: `estadoConfiguracion: 'PROVISIONAL'` en los 6 casos que
antes producían una cotización (CASE-002 a CASE-007) — consecuencia esperada y ya explicada en
"TRATAMIENTO DE REQUIRES_REVIEW", no un defecto. CASE-001 no tiene `estadoConfiguracion` (sigue
devolviendo el mismo objeto de error, sin combinación).

No hubo ningún caso con CAUSA/JUSTIFICACIÓN de cambio de valor porque, literalmente, ningún valor
ya congelado cambió — solo se agregó información nueva.

## GOLDEN CASES

`npm test` (`node tests/run.js && node tests/run-b.js`): **15/15 PASS** después de conectar el
motor (7 Fase A + 8 Fase B), sin modificar ningún `expectedLegacyOutput`/`expectedOutput`
existente. Verificado en el entorno local (`gas-sandbox.js`) y contra la Web App real desplegada
en producción (@6) con el catálogo real, por separado.

## RIESGOS PENDIENTES

1. **Con los datos cargados hoy, el catálogo real nunca puede llegar a `estadoConfiguracion:
   'VALIDADA'`** — ver "TRATAMIENTO DE REQUIRES_REVIEW". Esto es correcto por diseño, pero tiene
   impacto de producto real: cada propuesta que se genere hoy debe mostrarse como provisional en
   el PDF/frontend, y el frontend (`www/`) todavía no distingue `VALIDADA` de `PROVISIONAL` en la
   UI — pendiente (ver SIGUIENTE FASE).
2. **El catálogo real de producción hoy solo tiene equipos Energitel (genuinamente incompatibles
   entre sí)** — "Calcular sistema" no puede generar NINGUNA propuesta contra el catálogo real
   hasta que se agregue al menos un panel/inversor compatible (ej. el par demo Jinko+Growatt, si
   se decide usarlo como catálogo real, o equipos nuevos). Esto es anterior a Fase B, no causado
   por ella, pero Fase B lo hace más visible porque ahora el chequeo de corriente por MPPT
   (`MPPT_INPUT_CURRENT`) se declara explícitamente `FAIL` con su fórmula y límite, en vez de un
   mensaje genérico.
3. `numeroMaxStrings` y `potenciaACMax` de los 5 inversores Livoltek siguen sin cargar (sí existen
   en las fichas técnicas ya descargadas) — ver "DATOS TÉRMICOS DOCUMENTADOS", pendiente.
4. `AC_VOLTAJE` sigue hardcodeado en 220V (Code.gs) — fuera de alcance de Fase B a propósito
   (PARTE 3, regla "no mezclar fases").
5. El frontend (`www/index.html`, `www/app.js`) todavía no muestra `estadoConfiguracion`,
   `mensajeEstadoConfiguracion` ni el detalle por chequeo de `auditoria`/`verificacionString.checks`
   — el backend ya los expone, pero un usuario de la app hoy no los ve.

## CRITERIO PARA DECLARAR FASE B = PASS

Se declara **Fase B = PASS** porque, verificado uno por uno:

- [x] El motor eléctrico nuevo (Voc frío, Vmp caliente, corrientes separadas, enumerador de
  candidatos) está construido, documentado y probado con Golden Cases B01-B08 independientes.
- [x] `calcularSistema()`/`doPost` usan el motor nuevo en producción (@6) — no es código muerto.
- [x] La semántica de selección es la exacta autorizada (FAIL excluye; PASS preferido sobre
  REQUIRES_REVIEW; REQUIRES_REVIEW nunca se presenta como validado; UNKNOWN nunca es PASS
  silencioso) — implementada y verificada, no la versión `status !== FAIL` rechazada.
- [x] Los 15 Golden Cases (A+B) pasan sin modificar ningún valor previamente congelado.
- [x] El catálogo real se probó explícitamente contra producción y su resultado (incompatibilidad
  genuina para Energitel, `PROVISIONAL` para el catálogo demo) está documentado y explicado, no
  oculto.
- [x] Los datos térmicos reales disponibles (5 inversores, zona Barranquilla) están cargados en
  producción Y documentados con tabla de trazabilidad completa; los que genuinamente no existen
  (`coefTempVmp` de ZNShine, `TensionArranque` de la serie Hyper) están marcados `NO DISPONIBLE`,
  no inventados.
- [x] Los riesgos pendientes (frontend sin actualizar, `numeroMaxStrings`/`potenciaACMax` sin
  cargar, catálogo real sin equipos compatibles entre sí) están listados explícitamente como
  trabajo de fases siguientes, no escondidos ni presentados como resueltos.

Fase B = PASS **no** significa que el catálogo real hoy produzca cotizaciones validadas — significa
que el motor que decide eso está correctamente construido, conectado y honesto sobre lo que sabe
y lo que no. Cerrar el gap de datos (`numeroMaxStrings`, `potenciaACMax`, más paneles con
`coefTempVmp` publicado) y actualizar el frontend para mostrar `PROVISIONAL` claramente son tareas
de seguimiento, no condiciones para este PASS.

## SIGUIENTE FASE (solo documentado, no implementado)

1. Frontend (`www/index.html`, `www/app.js`): mostrar `estadoConfiguracion` /
   `mensajeEstadoConfiguracion` como un banner visible (no un badge discreto) en el resumen de la
   propuesta, y exponer `auditoria`/`verificacionString.checks` en una sección "Detalle técnico"
   por chequeo (no colapsado a un solo booleano).
2. Cargar `numeroMaxStrings` y `potenciaACMax` de los 5 inversores Livoltek (ya hay fichas
   técnicas descargadas) para cerrar dos de los cinco `UNKNOWN`/`REQUIRES_REVIEW` recurrentes.
3. Decidir si el catálogo real de producción necesita un panel/inversor genuinamente compatible
   (hoy solo tiene los equipos Energitel, incompatibles entre sí) — sin eso, "Calcular sistema"
   no puede devolver ninguna propuesta contra el catálogo real.
4. Fase C (caída de tensión real, AC trifásico, DPS DC/AC, puesta a tierra real) sigue sin
   tocarse, como corresponde.
