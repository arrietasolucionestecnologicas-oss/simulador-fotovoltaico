# Simulador Fotovoltaico A.S.T.

Software que, a partir del consumo (o la demanda máxima del recibo) de un cliente, calcula cuántos
paneles solares necesita, qué inversor y equipos le corresponden, y genera una propuesta técnica
comercial completa (memoria de cálculo + BOM + diagrama unifilar + financiero) en PDF. Cubre
sistemas de autogeneración a pequeña escala (AGPE, Resolución CREG 174/2021, hasta 1 MW en el SDL).
Spec completa: `simulador-fotovoltaico-instrucciones (1).md` (en Downloads del usuario — hay una
v1 sin el sufijo "(1)" ya superada, no usarla como referencia).

Proyecto de Gerson (A.S.T. — Arrieta Soluciones Tecnológicas), distinto de los demás proyectos en
`APLICACIONES AUTOMATIZADAS BASES DE DATOS/` — no confundir con `App Senerpot`,
`Generador de oferta Senerpot`, `APP GESTION PRUEBAS MICHAEL`, `A-S-T app`, etc.

## Arquitectura (costo cero)

- **Frontend**: `www/` — HTML/CSS/JS estático, línea visual A.S.T. (fondo oscuro `#0a0a0a`,
  panel `#141414`, acento cian `#00e5ff`, tipografía Segoe UI) para publicar en GitHub Pages.
  Layout tipo dashboard de software real (sidebar de navegación + secciones separadas: Nuevo
  cálculo / Resumen / Diagrama unifilar / Materiales), no un formulario largo de una sola
  columna — en pantallas angostas el sidebar se convierte en barra de pestañas horizontal.
- **Backend**: `backend-appscript/clone-real/` — Google Apps Script (`doGet`/`doPost`), motor de
  cálculo + generación de PDF. El frontend llama por POST con `{action, auth: API_KEY, payload}`
  (mismo patrón que `A-S-T app`).
- **Base de datos**: Google Sheets — hojas `Catalogo` (paneles/inversores/baterías),
  `ParametrosZona` (HSP y tarifa por ciudad) y `Cotizaciones` (registro de cada propuesta
  generada).
- **Generación de propuesta**: plantilla en Google Docs con marcadores `{{...}}`, Apps Script la
  copia, reemplaza y exporta a PDF.

**Infraestructura real ya creada**: repo GitHub (privado), proyecto de Apps Script, Google Sheet
y Web App desplegado y probado en vivo — ver IDs y URLs en [SETUP.md](SETUP.md#-infraestructura-real-ya-creada).
Pendiente: llenar el catálogo con equipos/precios reales (la hoja existe pero está vacía),
crear la plantilla de Google Docs (`DOC_TEMPLATE_ID` sin configurar — "Generar propuesta PDF"
todavía falla), y decidir cuándo publicar el frontend en GitHub Pages (repo privado hoy).

## Estado por fase

- **Fase 1 (en curso — código completo, probado en local, sin desplegar)**: motor de cálculo
  (dimensionamiento por consumo o por cargabilidad/demanda máxima del recibo + verificación
  técnica de string), lista de materiales completa (BOM: estructura, cableado DC/AC, protecciones,
  DPS, MC4, puesta a tierra, medidor bidireccional, banco de baterías si es híbrido), diagrama
  unifilar (SVG en la web app), módulo financiero (sobre el BOM completo, no solo panel+inversor)
  y chequeo regulatorio AGPE, sin Google Solar API.
- **Fase 2 (pendiente)**: integración de Google Solar API (Building Insights) para detección de
  techo — requiere activar facturación en Google Cloud (gratis hasta 10.000 consultas/mes, pero
  exige tarjeta registrada).
- **Fase 3 (pendiente)**: más marcas de inversor en el catálogo, comparación de escenarios
  (con batería vs. sin batería, o distintas marcas de panel) en la misma propuesta; evaluar si
  vale la pena embeber el diagrama unifilar gráfico (no solo tabular) dentro del PDF.

## Motor de cálculo — notas clave

- Dos vías de dimensionamiento (sección 4 de la spec): por consumo mensual (kWh, vía HSP de la
  zona) o por demanda máxima del recibo/maxímetro (kW, directo × 1,25) — esta segunda es más
  precisa para clientes comerciales/industriales y no depende del HSP.
- Margen por pérdidas: potencia ajustada = potencia bruta × 1,25.
- Tope AGPE: si la potencia ajustada supera 1.000 kWp, se marca `fueraDeAlcanceAGPE` en vez de
  dimensionar (`Code.gs` → `calcularSistema`).
- Verificación de string (`verificarString_`): Voc corregido por temperatura mínima local, ventana
  MPPT, corriente máxima por MPPT con factor de seguridad 1,25× (RETIE/NEC 690.8). También filtra
  inversores cuya potencia AC esté fuera de ±30% de la potencia del sistema (si no, un inversor
  mal dimensionado podría "colar" solo por calzar en la ventana MPPT).
- BOM (`armarBOM_`): arma la lista completa a partir del catálogo, eligiendo automáticamente la
  opción más barata que cumpla la corriente requerida (cables/protecciones). Los metrajes de cable
  son una heurística de campo (constantes al inicio de `Code.gs`), no un cálculo de planos —
  ajustar si en la práctica A.S.T. instala metrajes muy distintos.
- El motor elige automáticamente, entre las combinaciones panel+inversor compatibles del
  catálogo, la de menor inversión total (equipos + BOM + mano de obra) — a menos que el frontend
  pase `panelId`/`inversorId` explícitos.
- Financiero: inversión = (equipos + BOM completo) × 1,15 (mano de obra); payback y retorno a 25
  años son cálculo simple (sin degradación de paneles ni inflación de tarifa) — suficiente para
  Fase 1, revisar si se necesita más precisión en Fase 3.
- Diagrama unifilar (`generarDiagramaUnifilarSVG_`): SVG simplificado (un string representativo,
  con "×N" si hay varios en paralelo) — ayuda visual rápida, no es un plano eléctrico certificable.
  En el PDF de Google Docs se representa como tabla (`{{DIAGRAMA_UNIFILAR_TABLA}}`), no como
  gráfico — ver nota en `SETUP.md` sobre por qué (Apps Script no soporta insertar SVG de forma
  nativa).

## Convenciones a seguir (heredadas de otros proyectos A.S.T. de Gerson)

- Cuenta Google correcta: `arrietasolucionestecnologicas@gmail.com`. Usar perfil clasp nombrado
  `ast` (`clasp -u ast ...`), no el perfil default (compartido con otros proyectos y con cuentas
  equivocadas — ver memoria `reference_ast_infrastructure`).
- `clasp push`/`deploy` con `--description` con espacios falla desde Bash en Windows
  (bug de comillas con npx.cmd) — usar PowerShell para esos comandos.
- Confirmar con Gerson antes de: desplegar el Web App (queda público, protegido solo por
  `API_KEY`), publicar el repo/GitHub Pages, o crear el Google Sheet/Doc si se automatiza vía
  API en vez de manualmente.
