# Puesta en marcha — Simulador Fotovoltaico A.S.T. (Fase 1)

Pasos manuales que solo Gerson puede hacer (crean recursos en su cuenta de Google / GitHub).
Usar la cuenta `arrietasolucionestecnologicas@gmail.com` (misma cuenta que el resto de A.S.T.,
ver memoria `reference_ast_infrastructure`).

## 🔑 Infraestructura real (ya creada)

- **Repo GitHub** (privado): https://github.com/arrietasolucionestecnologicas-oss/simulador-fotovoltaico
- **Apps Script — scriptId**: `1Ou8ruvRx1Go-Fanhx-gaSDjTkREEqxFEkxA-bT23BWbny__C8k6cWEr6`
  (editor: https://script.google.com/d/1Ou8ruvRx1Go-Fanhx-gaSDjTkREEqxFEkxA-bT23BWbny__C8k6cWEr6/edit)
- **Web App desplegado**: `https://script.google.com/macros/s/AKfycbzoQEhDRLY8xohAVBq4FMNn8DzB37f_euWCRI1K-mNDCqijFCM3Ip6YFVd5c4l_6fPQ_A/exec`
  — ⚠️ público (`ANYONE_ANONYMOUS`), protegido solo por `API_KEY`.
- **Google Sheet (SHEET_ID)**: `17qnDFvwMNruT0ClTl_4Y6-uCxPrKDNsjo2W3WFuhuLs`
- **API_KEY**: `804d3433-e8b4-4135-9040-efac68ebcea2` (ya está en `www/app.js`, usado fuera de localhost)
- Perfil clasp: `ast` (cuenta `arrietasolucionestecnologicas@gmail.com`)

## ✅ Lo que ya está hecho

- [x] Motor de cálculo completo: dimensionamiento (consumo o demanda máxima), verificación de
      string, BOM, diagrama unifilar, financiero, chequeo regulatorio AGPE.
- [x] Frontend tipo dashboard (sidebar + secciones) con la línea visual de A.S.T.
- [x] Servidor de desarrollo local (`node dev-server.js`) para probar todo sin depender de Google.
- [x] Datos de muestra de catálogo/zonas para probar (`dev-data/`) — **no son precios reales**.
- [x] Repo creado en GitHub (privado) con el código subido.
- [x] Proyecto de Apps Script creado y código desplegado.
- [x] Google Sheet creado, hojas `Catalogo`/`ParametrosZona`/`Cotizaciones` inicializadas
      (`ParametrosZona` con Barranquilla precargada).
- [x] `SHEET_ID` y `API_KEY` configurados en Propiedades del script y en `www/app.js`.
- [x] Backend desplegado como Web App y probado en vivo (`getZonas`/`getCatalogo` responden).

## ⬜ Lo que falta

- [ ] **Llenar el catálogo con equipos y precios reales** — la hoja `Catalogo` está vacía
      (sin esto, `calcular` responde "El catálogo no tiene paneles o inversores activos
      configurados"). Ver sección 4 abajo para las columnas exactas.
- [ ] **Crear la plantilla de propuesta en Google Docs** y configurar `DOC_TEMPLATE_ID`
      (y opcionalmente `PDF_FOLDER_ID`) — sin esto, "Generar propuesta PDF" falla.
- [ ] **Publicar el frontend en GitHub Pages** — ⚠️ contenido público; avisar antes.
- [ ] Ajustar la tarifa real de energía en `ParametrosZona` (hoy tiene un valor de ejemplo,
      $950/kWh) y agregar otras ciudades si se cotiza fuera de Barranquilla.

Detalle de cada paso abajo.

## 1-3. Sheet, proyecto Apps Script y Propiedades del script — ✅ hecho

Ver la sección "Infraestructura real" arriba para los IDs. `configurarProyectoInicial()` (en
`Code.gs`) hizo todo esto de una vez: creó el Sheet, generó el `API_KEY`, los guardó como
Propiedades del script y llamó a `inicializarHojas()`. No hace falta repetirlo — si algún día se
necesita un Sheet/deploy nuevo desde cero (otro entorno, por ejemplo), el mismo patrón sirve:
`clasp -u ast create --type standalone` → push → ejecutar `configurarProyectoInicial` una vez
desde el editor.

## 4. Llenar el catálogo con equipos reales — ⬜ pendiente

Las hojas `Catalogo`, `ParametrosZona` y `Cotizaciones` ya existen (creadas por
`inicializarHojas()`), pero `Catalogo` está vacía. Llenar manualmente la hoja `Catalogo` con equipos reales. Tipos de fila que reconoce el
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

## 5. Crear la plantilla de propuesta en Google Docs — ⬜ pendiente

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

Copiar el ID del Doc y ponerlo en `DOC_TEMPLATE_ID` (Propiedades del script del proyecto ya
creado — ver "Infraestructura real" arriba).

## 6. Backend desplegado como Web App — ✅ hecho

Ver la URL real en "Infraestructura real" arriba. Si se necesita repushear código nuevo:

```bash
clasp -u ast push
clasp -u ast deploy --deploymentId AKfycbzoQEhDRLY8xohAVBq4FMNn8DzB37f_euWCRI1K-mNDCqijFCM3Ip6YFVd5c4l_6fPQ_A --description "descripcion del cambio"
```

`push` solo actualiza el código fuente — sin el `deploy --deploymentId` el cambio no llega a la
URL pública en producción (mismo comportamiento que `A-S-T app`, ver memoria
`reference_ast_infrastructure`).

## 7. Publicar el frontend (GitHub Pages) — ⬜ pendiente

El repo ya existe (privado): https://github.com/arrietasolucionestecnologicas-oss/simulador-fotovoltaico.
Falta: activar GitHub Pages sirviendo `www/` como raíz. **Esto hace el repo/contenido público —
confirmar antes de activarlo** (GitHub Pages en un repo privado requiere plan de pago; la
alternativa es hacer el repo público, lo cual expone `API_KEY` en el código fuente — no es grave
porque de todas formas viaja al navegador del cliente, pero es una decisión a confirmar contigo).

## 8. Datos que hay que mantener actualizados (sección 7 del spec)

- Catálogo de paneles/inversores/baterías y precios → hoja `Catalogo`.
- HSP y tarifa de energía por ciudad → hoja `ParametrosZona`.
- Vigencia de la Resolución CREG 174 y referencias RETIE/Ley 1715 → `chequeoRegulatorio_()` en
  `Code.gs`.
