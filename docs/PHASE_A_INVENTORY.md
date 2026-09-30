# Fase A — Paso 1: Inventario de `Code.gs`

Inventario completo de `backend-appscript/clone-real/Code.gs` (813 líneas, commit `2f5aca8`) antes
de cualquier cambio de Fase A. Ningún archivo fue modificado para producir este documento.

## Constantes de ingeniería

| Constante | Valor | Dominio | Fuente citada en el código |
|---|---|---|---|
| `LIMITE_AGPE_KWP` | 1000 | regulatory | Resolución CREG 174 de 2021 (comentario línea 20) |
| `MARGEN_PERDIDAS` | 1.25 | energy | "pérdidas de inversor, cableado y temperatura" (sin norma citada) |
| `FACTOR_SEGURIDAD_ISC` | 1.25 | electrical | "NEC 690.8 / RETIE" (comentario línea 23) |
| `COSTO_MANO_OBRA_PORC` | 0.15 | commercial | sin fuente — heurística de negocio |
| `AC_VOLTAJE` | 220 | electrical | "supuesto: red monofásica 220V" (hardcodeado, sin variar por proyecto) |
| `METROS_DC_BASE` | 15 | electrical | heurística de campo, sin fuente |
| `METROS_DC_POR_PANEL` | 2 | electrical | heurística de campo, sin fuente |
| `METROS_AC_BASE` | 20 | electrical | heurística de campo, sin fuente |
| `AUTONOMIA_BATERIA_DIAS` | 1 | electrical | sin fuente |
| `DOD_BATERIA` | 0.8 | electrical | sin fuente |
| `EFICIENCIA_BATERIA` | 0.95 | electrical | sin fuente |
| `ENCABEZADOS_CATALOGO` | array de 20 columnas | infrastructure | esquema del Sheet |
| `PROPS` | `PropertiesService.getScriptProperties()` | infrastructure | — |

## Funciones — inventario completo

Formato: **nombre** (dominio) — entradas → salidas · llama a · efectos secundarios

### HTTP / infraestructura

- **`doGet(e)`** (infrastructure) — `e` (no usado) → JSON `{success, service, status}` · sin llamadas · sin efectos secundarios.
- **`doPost(e)`** (infrastructure) — `e.postData.contents` (JSON `{action, auth, payload}`) → respuesta JSON · llama a `getConfig_`, `respond_`, y despacha a `calcularSistema` / `leerCatalogo_` / `leerZonas_` / `guardarItemCatalogo_` / `eliminarItemCatalogo_` / `guardarZona_` / `eliminarZona_` / `generarPropuesta` según `action` · valida `API_KEY`.
- **`respond_(obj)`** (infrastructure) — objeto → `ContentService` JSON output · sin efectos secundarios.
- **`getConfig_()`** (infrastructure) — ninguna → `{SHEET_ID, DOC_TEMPLATE_ID, PDF_FOLDER_ID, API_KEY}` · lee `PropertiesService`.

### Motor de cálculo (mezcla energy + electrical + regulatory + commercial en una sola función)

- **`calcularSistema(datos)`** (energy + electrical + regulatory + commercial, todo junto) —
  `{consumoMensualKWh?, demandaMaximaKW?, ciudad, tipoCliente, sistemaHibrido?, panelId?, inversorId?}`
  → objeto `resultado` completo (potencia, panel, inversor, verificación de string, BOM,
  financiero, regulatorio, diagrama SVG) · llama a `obtenerZona_`, `leerCatalogo_`,
  `verificarString_`, `armarBOM_`, `calcularFinanciero_`, `chequeoRegulatorio_`,
  `generarDiagramaUnifilarSVG_` · **esta es la función que más domina se mezclan**: decide
  método de dimensionamiento (energy), filtra por rango de potencia del inversor (electrical),
  verifica compatibilidad AGPE (regulatory) y elige la combinación más barata (commercial), todo
  en el mismo cuerpo de función sin fronteras.

- **`verificarString_(panel, inversor, temperaturaMinima, numPanelesTotal)`** (electrical) —
  objeto panel, objeto inversor, número, número → `{compatible, motivo, vocCorregidoV,
  panelesPorString, numeroStrings, stringsPorMppt, maxStringsPorMppt, fusibleRecomendadoA}` ·
  sin llamadas a otras funciones · sin efectos secundarios · **selecciona `nSerie` como el máximo
  posible**, no enumera candidatos (ver GAP-ANALYSIS.md punto 4).

### BOM (commercial, con algo de electrical mezclado en la selección de cable/protección por corriente)

- **`armarBOM_(catalogo, ctx)`** (commercial + electrical) — catálogo completo, contexto
  `{numPaneles, panel, inversor, verificacionString, sistemaHibrido, consumoDiarioKWh}` →
  `{items, advertencias, subtotalPanelesInversor, subtotalMateriales, totalMateriales}` · sin
  llamadas externas · sin efectos secundarios (trabaja sobre el catálogo ya leído) · contiene 3
  funciones internas: `porTipo`, `masBarato`, `compatiblePorCorriente`, `agregar`.

### Diagrama unifilar (reporting)

- **`generarDiagramaUnifilarSVG_(resultado)`** (reporting) — objeto `resultado` → string SVG ·
  llama a `escapeXml_` · sin efectos secundarios · construye desde el resultado real, no texto
  independiente (ya conforme, ver GAP-ANALYSIS.md punto 22).
- **`escapeXml_(s)`** (reporting) — string → string escapado.

### Financiero (commercial)

- **`calcularFinanciero_(totalMateriales, ahorroBaseKWh, tarifaEnergiaCOP)`** (commercial) —
  3 números → `{subtotalMateriales, inversionEstimada, ahorroMensual, ahorroAnual, paybackMeses,
  paybackAnos, retorno25Anos}` · sin llamadas · sin efectos secundarios.

### Regulatorio (regulatory)

- **`chequeoRegulatorio_(potenciaAjustadaKwp)`** (regulatory) — número →
  `{dentroDeAGPE, limiteAGPEKwp, referenciaResolucion, notaRETIE, notaLey1715}` · strings
  estáticos, sin versión/fecha/artículo (ver GAP-ANALYSIS.md punto 16).

### Acceso a datos — catálogo y zonas (infrastructure, con algo de electrical en el mapeo de campos)

- **`abrirSheet_()`** (infrastructure) — ninguna → objeto Spreadsheet · llama a `getConfig_` ·
  **efecto secundario**: abre el Google Sheet (`SpreadsheetApp.openById`).
- **`leerCatalogo_()`** (infrastructure) — ninguna → array de objetos equipo · llama a
  `abrirSheet_` · **efecto secundario**: lee el Sheet (`getDataRange().getValues()`).
- **`leerZonas_()`** (infrastructure) — ninguna → array de objetos zona · llama a `abrirSheet_` ·
  **efecto secundario**: lee el Sheet.
- **`obtenerZona_(ciudad)`** (energy) — string → objeto zona (con fallback a Barranquilla) ·
  llama a `leerZonas_`.
- **`encontrarFilaPorValor_(sh, columna, valor)`** (infrastructure) — sheet, número, valor →
  número de fila o -1 · **efecto secundario**: lee el Sheet.
- **`asegurarEncabezadosCatalogo_(sh)`** (infrastructure) — sheet → array de encabezados ·
  **efecto secundario**: puede escribir la fila de encabezados si faltan columnas y no hay datos.
- **`guardarItemCatalogo_(item)`** (infrastructure, CRUD) — objeto equipo → `{id}` · llama a
  `abrirSheet_`, `asegurarEncabezadosCatalogo_`, `encontrarFilaPorValor_` · **efecto secundario**:
  escribe/actualiza una fila en el Sheet.
- **`eliminarItemCatalogo_(id)`** (infrastructure, CRUD) — string → `{eliminado}` · llama a
  `abrirSheet_`, `encontrarFilaPorValor_` · **efecto secundario**: borra una fila del Sheet.
- **`guardarZona_(zona)`** (infrastructure, CRUD) — objeto zona → `{ciudad}` · **efecto
  secundario**: escribe/actualiza fila en `ParametrosZona`.
- **`eliminarZona_(ciudad)`** (infrastructure, CRUD) — string → `{eliminado}` · **efecto
  secundario**: borra fila de `ParametrosZona`.

### Generador de propuesta (reporting + commercial, con dependencias fuertes de Google Docs/Drive)

- **`generarPropuesta(datos)`** (reporting) — mismo shape que `calcularSistema` → `{resultado,
  pdfUrl}` · llama a `calcularSistema`, `getConfig_`, `insertarTablaEnMarcador_`,
  `construirTablaDiagrama_`, `construirTablaBOM_`, `registrarCotizacion_` · **efectos
  secundarios**: crea copia de Google Doc, escribe en el documento, exporta PDF, crea archivo en
  Drive, borra la copia intermedia.
- **`insertarTablaEnMarcador_(body, marcador, filas)`** (reporting) — body de Doc, string, array
  → nada · **efecto secundario**: modifica el documento de Google Docs.
- **`construirTablaDiagrama_(resultado)`** (reporting) — resultado → array de filas de tabla.
- **`construirTablaBOM_(bom)`** (reporting) — bom → array de filas de tabla.
- **`registrarCotizacion_(datos, resultado, pdfUrl)`** (infrastructure) — → nada · **efecto
  secundario**: escribe fila en hoja `Cotizaciones`.

### Utilidades (infrastructure)

- **`round0_`, `round1_`, `round2_`** — redondeo numérico, puras.
- **`escapeRegex_(s)`** — escape de regex, pura.
- **`formatearCOP_(n)`** — formato de moneda, pura.

### Setup / administración (infrastructure, ejecución manual única)

- **`inicializarHojas()`** — crea las 3 hojas con encabezados si no existen · **efecto
  secundario**: `insertSheet`, `appendRow`.
- **`crearHojaSiNoExiste_(ss, nombre, encabezados)`** — helper de lo anterior.
- **`configurarProyectoInicial()`** — crea el Sheet completo + API_KEY la primera vez · **efecto
  secundario**: `SpreadsheetApp.create`, `PropertiesService.setProperty`.
- **`cargarCatalogoDemo_()`** — siembra catálogo de ejemplo si está vacío · **efecto
  secundario**: `appendRow` × 19.

## Mapa de dominios (conceptual, sin mover código todavía)

| Dominio | Funciones que le pertenecen hoy | Estado |
|---|---|---|
| **energy** | parte de `calcularSistema` (elección de método, `potenciaAjustadaKwp`), `obtenerZona_` | mezclado dentro de `calcularSistema`, no aislado |
| **electrical** | `verificarString_`, parte de `armarBOM_` (selección de cable/protección por corriente) | el más cercano a estar aislado (`verificarString_` es pura) |
| **regulatory** | `chequeoRegulatorio_`, parte de `calcularSistema` (tope AGPE) | parcialmente aislado, pero sin versión/fuente estructurada |
| **commercial** | `armarBOM_`, `calcularFinanciero_`, parte de `calcularSistema` (orden por precio) | parcialmente aislado |
| **reporting** | `generarDiagramaUnifilarSVG_`, `escapeXml_`, `generarPropuesta`, `insertarTablaEnMarcador_`, `construirTablaDiagrama_`, `construirTablaBOM_` | aislado por función, pero acoplado a Google Docs/Drive directamente (sin capa intermedia) |
| **infrastructure** | `doGet`, `doPost`, `respond_`, `getConfig_`, `abrirSheet_`, `leerCatalogo_`, `leerZonas_`, `encontrarFilaPorValor_`, `asegurarEncabezadosCatalogo_`, CRUD de catálogo/zonas, `registrarCotizacion_`, utilidades, setup | bien delimitado ya — es la parte más "de infraestructura pura" del archivo |

**Decisión de esta fase**: no mover físicamente ninguna función a archivos separados todavía. El
riesgo de una transcripción manual de 813 líneas sin red de pruebas (que es justo lo que esta
fase está construyendo) es mayor que el beneficio de la separación física inmediata. La
separación física de archivos por dominio queda para una fase posterior, una vez que los Golden
Cases (Paso 7) puedan detectar cualquier error introducido al mover código. Esta es una decisión
de ingeniería explícita, no un incumplimiento silencioso del Paso 3 — ver razón completa en el
reporte de entrega al final de esta fase.

## Dependencias externas (Google Apps Script)

- `PropertiesService` (Script Properties: `SHEET_ID`, `DOC_TEMPLATE_ID`, `PDF_FOLDER_ID`, `API_KEY`)
- `SpreadsheetApp` (lectura/escritura del Sheet: `Catalogo`, `ParametrosZona`, `Cotizaciones`)
- `DriveApp` (copiar plantilla, crear PDF, borrar copia intermedia)
- `DocumentApp` (llenar la plantilla de propuesta)
- `Utilities` (`formatDate`, `getUuid`)
- `ContentService` (respuesta HTTP)

## Entradas/salidas del sistema (contrato HTTP)

`doPost` recibe siempre `{action, auth, payload}` y despacha a una de 8 acciones: `calcular`,
`getCatalogo`, `getZonas`, `guardarCatalogo`, `eliminarCatalogo`, `guardarZona`, `eliminarZona`,
`generarPropuesta`. Todas devuelven `{success, data}` o `{success: false, error}`.
