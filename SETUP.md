# Puesta en marcha — Simulador Fotovoltaico A.S.T. (Fase 1)

Pasos manuales que solo Gerson puede hacer (crean recursos en su cuenta de Google / GitHub).
Usar la cuenta `arrietasolucionestecnologicas@gmail.com` (misma cuenta que el resto de A.S.T.,
ver memoria `reference_ast_infrastructure`).

## ✅ Lo que ya está hecho (código, corre en local)

- [x] Motor de cálculo completo: dimensionamiento (consumo o demanda máxima), verificación de
      string, BOM, diagrama unifilar, financiero, chequeo regulatorio AGPE.
- [x] Frontend tipo dashboard (sidebar + secciones) con la línea visual de A.S.T.
- [x] Servidor de desarrollo local (`node dev-server.js`) para probar todo sin depender de Google.
- [x] Datos de muestra de catálogo/zonas para probar (`dev-data/`) — **no son precios reales**.

## ⬜ Lo que falta — nada de esto está desplegado todavía

- [ ] **1. Crear el Google Sheet** (base de datos real).
- [ ] **2. Crear el proyecto de Apps Script** y subir el backend (`clasp`).
- [ ] **3. Configurar Propiedades del script** (`SHEET_ID`, `DOC_TEMPLATE_ID`, `PDF_FOLDER_ID`, `API_KEY`).
- [ ] **4. Inicializar las hojas** (`inicializarHojas()`) y **llenar el catálogo con equipos y precios reales** (ahora mismo son datos de muestra inventados).
- [ ] **5. Crear la plantilla de propuesta en Google Docs** con los marcadores `{{...}}`.
- [ ] **6. Desplegar el backend como Web App** — ⚠️ esto lo deja público (protegido solo por `API_KEY`); avisar antes.
- [ ] **7. Publicar el frontend en GitHub Pages** — ⚠️ contenido público; avisar antes.
- [ ] **8. Pegar la URL del Web App real y el `API_KEY`** en `www/app.js` (hoy tiene placeholders `PENDIENTE_DEPLOY_URL` / `PENDIENTE_API_KEY`, usados solo fuera de localhost).

Detalle de cada paso abajo.

## 1. Crear el Google Sheet (base de datos)

1. Crear un Google Sheet nuevo, nombrarlo p. ej. "A.S.T. — Simulador Fotovoltaico DB".
2. Copiar su ID (el string entre `/d/` y `/edit` en la URL).

## 2. Crear el proyecto de Apps Script y subir el backend

Desde `backend-appscript/clone-real/`:

```bash
clasp -u ast login   # si el perfil "ast" no existe aún
clasp -u ast create --type standalone --title "A.S.T. Simulador Fotovoltaico API"
clasp -u ast push
```

Esto genera un `scriptId` nuevo — guárdalo (mismo patrón que A.S.T. Admin).

## 3. Configurar Propiedades del script

En el editor de Apps Script (Configuración del proyecto → Propiedades del script), o por `clasp`,
crear:

- `SHEET_ID`: el ID del Sheet del paso 1.
- `DOC_TEMPLATE_ID`: el ID de la plantilla de Google Docs (paso 5).
- `PDF_FOLDER_ID`: (opcional) carpeta de Drive donde guardar los PDFs generados.
- `API_KEY`: una clave cualquiera que definas (ej. un UUID) — debe coincidir con `API_KEY` en
  `www/app.js`.

## 4. Inicializar las hojas del catálogo

En el editor de Apps Script, ejecutar una vez la función `inicializarHojas()` (menú Ejecutar).
Crea las hojas `Catalogo`, `ParametrosZona` (con Barranquilla precargada: HSP 5.75, T mínima 22°C,
tarifa $950/kWh — ajustar el precio real) y `Cotizaciones`.

Luego llenar manualmente la hoja `Catalogo` con equipos reales. Tipos de fila que reconoce el
motor (columna `Tipo`): `Panel`, `Inversor`, `Bateria`, `Estructura`, `CableDC`, `CableAC`,
`ProteccionDC`, `ProteccionAC`, `DPS`, `ConectorMC4`, `PuestaATierra`, `Medidor`. Ver
`dev-data/catalogo.json` para un ejemplo completo de cada tipo (datos de muestra, no reales).

Columnas de ficha técnica que hay que sacar del datasheet de cada equipo:
- Panel: `Voc_STC`, `Vmp_STC`, `Isc_STC`, `CoefTempVoc`, `PotenciaW`, `Precio`.
- Inversor: `PotenciaW` (AC nominal), `VoltajeMaxEntradaDC`, `MPPTMinV`, `MPPTMaxV`,
  `CorrienteMaxPorMPPT`, `NumeroMPPT`, `Precio`.
- Bateria: `CapacidadKWh`, `Precio`.
- CableDC / CableAC: `CorrienteA` (ampacidad del calibre), `Precio` (por metro).
- ProteccionDC / ProteccionAC: `CorrienteA` (corriente nominal del breaker/fusible), `Precio`.
- Estructura / DPS / ConectorMC4 / PuestaATierra / Medidor: solo `Precio` (por unidad, kit o par
  según corresponda).

El motor selecciona automáticamente, entre las filas activas de cada tipo, la opción más barata
que cumpla la corriente requerida (cables/protecciones) — ver `armarBOM_` en `Code.gs`. Los
metrajes de cable (`METROS_DC_BASE`, `METROS_DC_POR_PANEL`, `METROS_AC_BASE`) son una heurística
de campo, no un cálculo de planos — ajustar esas constantes si en la práctica quedan muy lejos
de los metrajes reales que instala A.S.T.

## 5. Crear la plantilla de propuesta en Google Docs

Crear un Google Doc con el diseño/marca de A.S.T. y estos marcadores de texto literal en donde
corresponda (Code.gs los reemplaza con `body.replaceText`):

```
{{FECHA}}  {{CLIENTE}}  {{DIRECCION}}  {{CIUDAD}}  {{METODO_DIMENSIONAMIENTO}}
{{POTENCIA_KWP}}  {{NUM_PANELES}}
{{PANEL_MARCA_MODELO}}  {{INVERSOR_MARCA_MODELO}}
{{PANELES_POR_STRING}}  {{NUMERO_STRINGS}}
{{INVERSION_ESTIMADA}}  {{AHORRO_MENSUAL}}  {{PAYBACK_ANOS}}  {{RETORNO_25_ANOS}}
{{NOTA_RETIE}}  {{NOTA_LEY_1715}}  {{REFERENCIA_RESOLUCION}}
```

Además, dejar **dos párrafos propios** (cada uno solo con ese texto, en su propia línea) donde
deban ir las tablas generadas dinámicamente — Apps Script borra el párrafo y lo reemplaza por una
tabla real de Google Docs:

```
{{DIAGRAMA_UNIFILAR_TABLA}}
{{BOM_TABLA}}
```

**Nota sobre el diagrama unifilar:** el gráfico vectorial (SVG) se muestra en la web app —
Apps Script no tiene forma nativa confiable de insertar SVG en un Doc sin un servicio externo de
conversión. En el PDF, `{{DIAGRAMA_UNIFILAR_TABLA}}` se reemplaza por una tabla con la misma
cadena de elementos (paneles → protección DC → inversor → protección AC → DPS → medidor → red).
Si más adelante quieres el gráfico embebido en el PDF, es una mejora de Fase 3.

Copiar el ID del Doc y ponerlo en `DOC_TEMPLATE_ID` (paso 3).

## 6. Publicar el backend como Web App

```bash
clasp -u ast deploy --description "v1 - motor de calculo + propuesta PDF"
```

Copiar la URL `.../exec` resultante en `API_URL` (`www/app.js`).

**Este paso publica el endpoint como accesible por cualquiera con la URL** (`ANYONE_ANONYMOUS`,
protegido solo por `API_KEY`). Avisar antes de ejecutarlo si se hace desde una sesión de Claude.

## 7. Publicar el frontend (GitHub Pages)

Crear el repo (ej. `arrietasolucionestecnologicas-oss/simulador-fotovoltaico`), subir `www/` como
raíz, y activar GitHub Pages. **Publicar en GitHub es contenido público — confirmar antes.**

## 8. Datos que hay que mantener actualizados (sección 7 del spec)

- Catálogo de paneles/inversores/baterías y precios → hoja `Catalogo`.
- HSP y tarifa de energía por ciudad → hoja `ParametrosZona`.
- Vigencia de la Resolución CREG 174 y referencias RETIE/Ley 1715 → `chequeoRegulatorio_()` en
  `Code.gs`.
