# Simulador Fotovoltaico A.S.T.

## Qué es

Software para A.S.T. (Arrieta Soluciones Tecnológicas) que, a partir del consumo o la demanda
máxima del recibo de un cliente, calcula automáticamente cuántos paneles solares necesita, qué
inversor y equipos le corresponden, arma la lista de materiales completa, y genera una propuesta
técnica comercial lista para presentar. Nació porque el contador de Gerson pidió cotizar 3 casas.

Cubre sistemas de autogeneración a pequeña escala (AGPE, Resolución CREG 174/2021 — hasta 1 MW
conectado al Sistema de Distribución Local). Fuera de alcance: generación distribuida mayor a
1 MW o AGGE (el software lo detecta y avisa en vez de intentar dimensionarlo).

Spec funcional original: `simulador-fotovoltaico-instrucciones (1).md` (Downloads del usuario —
hay una v1 sin el "(1)" ya superada, no usarla).

Proyecto distinto de los demás en `APLICACIONES AUTOMATIZADAS BASES DE DATOS/` — no confundir con
`App Senerpot`, `Generador de oferta Senerpot`, `APP GESTION PRUEBAS MICHAEL`, `A-S-T app`, etc.

**Estándar de ingeniería (2026-09-30 en adelante)**: [ENGINEERING.md](ENGINEERING.md) — prompt
maestro de Gerson que gobierna todo desarrollo futuro (separación de dominios, modelo de datos
central, auditoría por cálculo, motor normativo versionado, testing obligatorio, etc.). El código
actual descrito abajo es la Fase 1 original, previa a este estándar — ver diagnóstico punto por
punto en [GAP-ANALYSIS.md](GAP-ANALYSIS.md) y el plan de fases (A–H) para cerrar la brecha. Hay 3
decisiones pendientes de Gerson antes de empezar la Fase A (conflicto demanda×1.25 vs. motor
energético, manejo del `API_KEY` expuesto en el repo público, y ritmo de fases) — ver el final de
ese documento.

## Cómo va (estado actual — Fase 1, previa al estándar de ingeniería)

**Todo lo de abajo ya está construido, desplegado y probado en producción — no es un prototipo
local.**

- **App pública en línea**: https://arrietasolucionestecnologicas-oss.github.io/simulador-fotovoltaico/
- **Repo público**: https://github.com/arrietasolucionestecnologicas-oss/simulador-fotovoltaico
  (se publica solo vía GitHub Actions cada vez que cambia `www/`)
- **Backend real**: Google Apps Script + Google Sheet como base de datos — ver IDs exactos en
  [SETUP.md](SETUP.md#-infraestructura-real-ya-creada)

**Lo que la app ya hace hoy:**
1. Formulario de cliente + consumo (o demanda máxima del recibo — más preciso para comercial/industrial)
2. Motor de cálculo: dimensionamiento, verificación técnica de string (Voc/Vmp/Isc, ventana MPPT,
   corriente máxima), selección automática del panel+inversor más económico que sea compatible
3. Lista de materiales completa (BOM): estructura, cableado DC/AC, protecciones, DPS, MC4, puesta
   a tierra, medidor bidireccional, banco de baterías si es híbrido
4. Diagrama unifilar (esquema visual en la app)
5. Módulo financiero: inversión, ahorro, payback, retorno a 25 años
6. Chequeo regulatorio (límite AGPE, notas RETIE/Ley 1715)
7. **Pantalla de administración de catálogo** dentro de la misma app — agregar/editar/eliminar
   equipos, proveedores y precios, y parámetros por ciudad (HSP, tarifa), sin tocar ningún Sheet
   a mano. Esto reemplazó el plan original de editar el Google Sheet directamente.

**Catálogo real cargado** (2026-09-25, desde una cotización real de Energitel SAS — proveedor de
Livoltek y ZNShine Solar): 1 panel (ZNShine 650Wp) + 5 inversores Livoltek + 2 baterías, con ficha
técnica sacada de los datasheets oficiales del fabricante (la cotización comercial no trae Voc/Vmp/
Isc/MPPT, solo precio y modelo). **Hallazgo importante**: el panel de 650Wp cotizado (Isc 16,34A)
no es compatible con ninguno de los inversores Livoltek de esa misma cotización — todos tienen
máximo 14-16A por MPPT, y con el factor de seguridad de 1,25× se necesitan ≥20,4A. Hasta que se
agregue un panel de menor corriente o un inversor de mayor capacidad, "Calcular sistema" va a
fallar con "ningún inversor compatible" para cualquier cliente. Decisión pendiente de Gerson (ver
sección siguiente).

**Lo que todavía NO funciona:**
- **Generar propuesta PDF**: la plantilla de Google Docs no existe todavía (`DOC_TEMPLATE_ID` sin
  configurar). El cálculo y el catálogo sí funcionan de punta a punta; solo falta este último paso.
- **Calcular sistema**: bloqueado hasta resolver la incompatibilidad panel/inversor de arriba.

## A dónde vamos

**Inmediato (para que quede 100% operativo):**
1. Resolver la incompatibilidad panel/inversor del catálogo actual (agregar panel de menor Isc,
   o cotizar un inversor de mayor corriente con Energitel u otro proveedor).
2. Completar el catálogo con más opciones (no depender de un solo panel/inversor).
3. Crear la plantilla de propuesta en Google Docs con los marcadores `{{...}}` (ver checklist en
   [SETUP.md](SETUP.md)) para que "Generar propuesta PDF" funcione.

**Fase 2**: integración de Google Solar API (Building Insights) — a partir de la dirección del
cliente, saber cuántos paneles caben físicamente en el techo y contrastarlo con lo que pide el
consumo. Requiere activar facturación en Google Cloud (gratis hasta 10.000 consultas/mes, pero
exige tarjeta registrada) — por eso quedó para después del MVP funcional.

**Fase 3**: catálogo más completo (más marcas/proveedores por tipo de equipo, ya lo soporta el
motor — solo falta cargar más cotizaciones reales), comparación de varios escenarios en la misma
propuesta (con batería vs. sin batería, distintas marcas), y evaluar si vale la pena embeber el
diagrama unifilar gráfico (hoy es una tabla) dentro del PDF.

**No hay plan de cobrar por esto ni de venderlo a terceros** — es una herramienta interna de A.S.T.
para cotizar más rápido en campo y respaldar el estudio de viabilidad del emprendimiento solar.

## Arquitectura (costo cero)

- **Frontend**: `www/` — HTML/CSS/JS estático, línea visual A.S.T. (fondo oscuro `#0a0a0a`,
  panel `#141414`, acento cian `#00e5ff`, tipografía Segoe UI). Layout tipo dashboard de software
  real (sidebar de navegación + secciones separadas: Nuevo cálculo / Catálogo / Resumen / Diagrama
  unifilar / Materiales) — en pantallas angostas el sidebar se convierte en barra de pestañas
  horizontal. Publicado en GitHub Pages vía GitHub Actions (`.github/workflows/deploy-pages.yml`).
- **Backend**: `backend-appscript/clone-real/Code.gs` — Google Apps Script (`doGet`/`doPost`),
  motor de cálculo + CRUD de catálogo/zonas + generación de PDF. El frontend llama por POST con
  `{action, auth: API_KEY, payload}` (mismo patrón que `A-S-T app`).
- **Base de datos**: Google Sheets — hojas `Catalogo` (paneles/inversores/baterías/estructura/
  cables/protecciones/DPS/MC4/puesta a tierra/medidor, con proveedor y precio), `ParametrosZona`
  (HSP y tarifa por ciudad) y `Cotizaciones` (registro de cada propuesta generada). **El usuario
  nunca edita este Sheet directamente** — todo pasa por la pantalla "Catálogo" de la app.
- **Generación de propuesta**: plantilla en Google Docs con marcadores `{{...}}`, Apps Script la
  copia, reemplaza y exporta a PDF (pendiente crear la plantilla, ver arriba).
- **Desarrollo local**: `dev-server.js` + `dev-data/` — servidor Node que ejecuta el `Code.gs`
  real dentro de un sandbox (no duplica la lógica) para poder probar todo sin depender de Google.
  `node dev-server.js` → http://localhost:8744

## Motor de cálculo — notas clave

- Dos vías de dimensionamiento (sección 4 de la spec): por consumo mensual (kWh, vía HSP de la
  zona) o por demanda máxima del recibo/maxímetro (kW, directo × 1,25) — esta segunda es más
  precisa para clientes comerciales/industriales y no depende del HSP.
- Margen por pérdidas: potencia ajustada = potencia bruta × 1,25.
- Tope AGPE: si la potencia ajustada supera 1.000 kWp, se marca `fueraDeAlcanceAGPE` en vez de
  dimensionar (`Code.gs` → `calcularSistema`).
- Verificación de string (`verificarString_`): Voc corregido por temperatura mínima local, ventana
  MPPT, corriente máxima por MPPT con factor de seguridad 1,25× (RETIE/NEC 690.8). También filtra
  inversores cuya potencia AC esté fuera de ±30% de la potencia del sistema. Esta verificación es
  estricta a propósito — ya detectó un caso real de panel/inversor incompatibles (ver arriba),
  justo el tipo de error que el software debe prevenir antes de cotizarle mal a un cliente.
- BOM (`armarBOM_`): arma la lista completa a partir del catálogo, eligiendo automáticamente la
  opción más barata que cumpla la corriente requerida (cables/protecciones). Los metrajes de cable
  son una heurística de campo (constantes al inicio de `Code.gs`), no un cálculo de planos —
  ajustar si en la práctica A.S.T. instala metrajes muy distintos.
- El motor elige automáticamente, entre las combinaciones panel+inversor compatibles del
  catálogo, la de menor inversión total (equipos + BOM + mano de obra) — a menos que el frontend
  pase `panelId`/`inversorId` explícitos. Con varios proveedores cotizando el mismo tipo de
  equipo, esto ya funciona como comparador automático de precios.
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
  (bug de comillas con npx.cmd) — usar PowerShell para esos comandos. Después de `clasp push`
  hace falta `clasp deploy --deploymentId <id>` para que el cambio llegue a la URL pública en
  producción — push solo no alcanza.
- Gerson no quiere gestión manual de datos vía Sheets/Excel para ningún proyecto — ver memoria
  `feedback_no_gestion_manual_datos`. Por eso existe la pantalla "Catálogo" dentro de la app.
- Confirmar con Gerson antes de: desplegar el Web App (queda público, protegido solo por
  `API_KEY`), cambiar la visibilidad del repo, o publicar cambios grandes en GitHub Pages.
