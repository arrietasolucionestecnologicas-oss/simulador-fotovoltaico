# Diagnóstico — Code.gs actual vs. [ENGINEERING.md](ENGINEERING.md)

Hecho 2026-09-30, sin modificar código (paso 1 del "PROCESO DE TRABAJO DEL AGENTE" del prompt
maestro: leer arquitectura, leer código, identificar supuestos y riesgos, crear plan, no tocar
código todavía). Fuente: `backend-appscript/clone-real/Code.gs` completo, 813 líneas, estado al
commit `efb878d`.

Leyenda: ✅ Conforme · 🟡 Parcial · 🔴 No conforme / no existe

---

## 1. Separación de dominios

🔴 **No existe.** Todo — energía, eléctrico, normativo, comercial — vive en un único archivo
(`Code.gs`) sin fronteras de módulo. `calcularSistema()` (línea 96) llama directo a
`verificarString_` (eléctrico), `armarBOM_` (comercial) y `chequeoRegulatorio_` (normativo) en la
misma función, sin una interfaz entre dominios. El motor comercial sí respeta implícitamente "no
modificar una decisión técnica" (el BOM solo se arma para combinaciones ya aprobadas por
`verificarString_`), pero no porque exista una frontera formal — es casualidad del orden del código.

## 2. Modelo de datos central (Project Model)

🔴 **No existe.** Los datos viajan en objetos ad-hoc (`datos`, `resultado`) que crecen orgánicamente
cada vez que se agrega un campo. No hay un objeto `project` único con la forma prescrita
(`client, location, electricalService, loadProfile, solarResource, roof, module, inverter,
battery, topology, strings, dcDesign, acDesign, protection, grounding, energySimulation,
economics, regulatory, bom, documents, audit`).

## 3. Motor de dimensionamiento

🔴 **Conflicto directo con el prompt maestro.** Línea 110-112:

```js
metodoUsado = 'cargabilidad';
potenciaBrutaKwp = demandaMaximaKW;
potenciaAjustadaKwp = demandaMaximaKW * MARGEN_PERDIDAS;  // × 1.25
```

Esto es exactamente lo que el prompt maestro prohíbe ("NO utilizar demanda máxima × 1.25 como
sustituto del dimensionamiento energético FV"). **Pero también es exactamente lo que pedía la spec
funcional original** (sección 4.2: "si el usuario tiene demanda máxima, se usa directo... es más
preciso que estimar a partir del consumo promedio"). Es una contradicción real entre dos
documentos de referencia del proyecto, no un bug — **necesita una decisión tuya** (ver sección
"Decisiones pendientes" al final).

El "método energético" (consumo ÷ HSP × 1.25, sección 4.1) existe pero es la versión más simple
posible: no hay orientación, inclinación, azimut, ni POA — el campo `roof`/`orientación` no existe
en ningún lado del modelo. El "método preliminar" (HSP + PR configurable) existe a medias: hay HSP
por ciudad, pero el "1.25" es una constante única que mezcla pérdidas de inversor + cableado +
temperatura en un solo número, no un PR (performance ratio) real y ajustable. El "método por
perfil" (carga horaria) no existe.

## 4. Motor de strings

🔴 **No conforme.** Línea 234: `const nSerie = Math.min(nSerieMax, numPanelesTotal);` — esto es
literalmente "nSerie = máximo posible", justo el antipatrón que el prompt maestro nombra
explícitamente. No se enumeran configuraciones candidatas, no se comparan alternativas (ej. más
strings con menos paneles en serie), no hay noción de "strings equilibrados" ni de "número máximo
de strings" del fabricante (ese campo no existe en el catálogo).

También falta la mitad térmica del cálculo: **solo se corrige Voc en frío** (línea 220); nunca se
calcula Vmp en caliente, que es necesario para verificar que el string no caiga por debajo de la
ventana MPPT en los días más calurosos. El prompt maestro lo pide explícitamente ("Voc máximo en
condición fría. Vmp mínimo en condición caliente. Nunca utilizar únicamente valores STC para
validar todo el string") y hoy sí se usa Vmp STC sin corrección (línea 223-224).

## 5. Modelo del inversor

🟡 **Cubre ~40% de los campos pedidos.** Existe: potencia (ambigua — un solo campo `potenciaW`
para nominal, sin máxima), tensión DC máxima, ventana MPPT, corriente máxima por MPPT, número de
MPPT, precio, ficha técnica, proveedor.

Falta: tensión de arranque (existe como campo separado en los datasheets reales que usé la sesión
pasada — ej. GT1-S1 tiene "Voltaje mínimo 70V" y "Voltaje de arranque 90V" como dos cosas
distintas; el catálogo solo tiene una), **corriente máxima de cortocircuito admisible separada de
la corriente máxima de entrada** (el prompt maestro lo marca en rojo explícitamente: "No confundir
corriente máxima de entrada con corriente máxima de cortocircuito admisible" — es justo la
ambigüedad que tuve que resolver a mano la sesión pasada al cargar los inversores Livoltek,
eligiendo "Max PV Current" sobre "Max Short Circuit Current" sin que el sistema me obligara a
hacerlo de forma explícita), número máximo de strings, fases, factor de potencia, potencia
aparente, eficiencia, rango de temperatura, IP, anti-islanding, certificaciones, fecha de
verificación del dato.

## 6. Modelo del módulo

🟡 **Cubre lo esencial STC, falta lo térmico completo.** Existe: potencia, Voc/Vmp/Isc STC,
coeficiente de Voc. Falta: **Imp** (el prompt maestro separa explícitamente Isc de Imp — hoy el
catálogo no tiene Imp en absoluto), coeficiente de Vmp/Pmax (necesario para el Vmp-caliente de la
sección 4), temperatura máx/mín de operación, tecnología, dimensiones, peso, certificaciones,
fecha de verificación.

## 7. Diseño DC

🟡 **Dimensionamiento de protección sí; cálculo eléctrico real, no.** Se calcula el fusible
recomendado (Isc × 1.25) y se elige cable por ampacidad nominal (`CorrienteA >= corriente
requerida`, línea 279). No hay cálculo de caída de tensión, no hay corrección de ampacidad por
temperatura/agrupamiento, los metrajes son una heurística fija documentada como tal
(`METROS_DC_BASE + numPaneles × 2`, línea 303) — nunca fue pensada como definitiva, está anotada
en el propio código como aproximación de campo.

## 8. Diseño AC

🔴 **No conforme — violación explícita.** Línea 25:
`const AC_VOLTAJE = 220; // supuesto: red monofásica 220V`. El prompt maestro lo prohíbe
literalmente: "No utilizar voltaje AC global hardcodeado." No hay modelado de fases, frecuencia,
ni sistema de puesta a tierra por proyecto — todo el sistema asume monofásico 220V sin importar
qué inversor o cliente sea.

## 9. Cableado

🔴 Mismo diagnóstico que Diseño DC: metrajes heurísticos, sin caída de tensión, documentado como
tal en comentarios del propio código (no es un descubrimiento nuevo, ya estaba anotado).

## 10. Protecciones

🟡 Cada ítem del BOM tiene categoría/marca/modelo/cantidad/precio, pero no hay campo de
"fundamento técnico" ni se registra curva/polos/capacidad de interrupción en el catálogo — esos
datos ni siquiera tienen columna hoy.

## 11. DPS

🔴 Un solo tipo genérico `DPS` con precio (línea 312) — no separa DC de AC, no registra
Uc/Up/In/Imax. Ninguno de esos campos existe en el esquema del catálogo.

## 12. Puesta a tierra

🔴 **Violación literal, casi palabra por palabra.** Línea 316:
`agregar('Puesta a tierra', masBarato(porTipo('PuestaATierra')), 1, 'kit')`. El prompt maestro da
como ejemplo exacto de lo que NO hacer: *"No representar puesta a tierra únicamente como: '1
kit'."* Hoy es exactamente eso.

## 13. Baterías

🟡 **Calcula capacidad, pero no verifica compatibilidad de tensión con el inversor — y esto ya
causó un caso real.** Líneas 320-331: sí calcula energía diaria, autonomía, DoD y eficiencia para
dimensionar el banco, y elige la batería de mayor capacidad activa. Pero **nunca compara el rango
de voltaje de la batería contra el rango de entrada de batería del inversor**. La sesión pasada
detecté a mano que la batería de alto voltaje (102,4V) de la cotización de Energitel NO es
compatible con los inversores Hyper (rango 40-60V) — el sistema no lo habría detectado solo, tuve
que revisarlo yo mismo y marcarla `Activo: false` manualmente. Es la prueba concreta de que este
gap es real, no teórico.

## 14. Motor energético (HSP→POA→temperatura→módulo→DC→inversor→AC, generación mensual/anual, PR)

🔴 **No existe.** El sistema hoy solo hace dimensionamiento inverso (de consumo a potencia
necesaria), nunca una simulación hacia adelante de cuánto genera un sistema dado. No hay POA,
temperatura de módulo, DC yield, AC yield, clipping, PR, ni degradación.

## 15. Sombras

🔴 No existe ningún campo ni arquitectura preparada para esto. Aceptable diferir, pero hoy no hay
ni siquiera un placeholder `UNKNOWN`.

## 16. Motor normativo versionado

🔴 **Violación literal.** Línea 426: `notaRETIE: 'La instalación debe cumplir el Reglamento
Técnico de Instalaciones Eléctricas (RETIE) vigente.'` — es textualmente el ejemplo que el prompt
maestro prohíbe ("Nunca escribir 'RETIE vigente' como única referencia"). No hay versión, fecha,
artículo/numeral, ni evidencia por requisito — son 3 strings estáticos (líneas 425-427).

## 17. Estados normativos (PASS/FAIL/WARNING/REQUIRES_REVIEW/NOT_APPLICABLE/UNKNOWN)

🔴 Solo existen booleanos (`compatible`, `dentroDeAGPE`). Ningún estado intermedio.

## 18. Matriz de cumplimiento

🔴 No existe como estructura exportable.

## 19. Optimización multi-candidato

🟡 **Lo mejor alineado del código actual, pero incompleto.** `calcularSistema` sí genera todas las
combinaciones panel×inversor compatibles, filtra las inválidas ANTES de optimizar por precio, y
solo entonces ordena por costo (línea 189) — ese orden ("primero filtrar, después optimizar
económicamente, nunca al revés") ya se respeta. Lo que falta: no varía configuraciones de string
(ver punto 4), y no expone los candidatos descartados — solo devuelve el ganador más
`opcionesCompatibles: combinaciones.length` como número, sin el detalle de cada candidato.

## 20. Función de costo

🟡 Solo payback simple y retorno lineal a 25 años (ya estaba documentado como simplificación de
Fase 1 en `CLAUDE.md`). Sin NPV, IRR, LCOE, degradación ni inflación de tarifa.

## 21. BOM después del diseño eléctrico

✅ Ya conforme: `armarBOM_` solo se llama sobre combinaciones que ya pasaron `verificarString_`
(línea 157-159).

## 22. Unifilar generado desde el cálculo, no como texto independiente

✅ Ya conforme: `generarDiagramaUnifilarSVG_` construye el SVG a partir del objeto `resultado` real
(línea 353), no de texto hardcodeado. Es una simplificación deliberada (un string representativo,
no la topología completa con cada string individual) — ya documentada como tal.

## 23. Auditoría por cálculo

🔴 No existe ningún rastro de auditoría (input/fórmula/resultado/límite/fuente/timestamp/versión
del motor) en ningún cálculo. Es, junto con la separación de dominios, el gap más grande.

## 24. Seguridad

🔴 **Violación activa y ya desplegada, hecha esta misma sesión con tu aprobación explícita pero
bajo un estándar distinto al que acabas de definir.** El `API_KEY` real está escrito en texto
plano en `www/app.js` (línea 7), que está en un repositorio **público** de GitHub, publicado en
GitHub Pages. El prompt maestro lo prohíbe literalmente: *"Nunca poner secretos reales en:
frontend; GitHub Pages; JavaScript público; documentación pública. Rotar cualquier credencial que
haya sido expuesta."* Esto ya pasó — la clave ya está expuesta y ya fue vista/indexada
potencialmente. No hay roles (ADMIN/ENGINEER/SALES/VIEWER); cualquiera con la URL puede agregar,
editar o borrar cualquier equipo del catálogo. **Necesita una decisión tuya** (ver abajo).

## 25. Testing obligatorio / Golden Cases

🔴 No existe ningún test automatizado en el repo. Cero casos de los 17 Golden Cases mínimos que
pide el prompt maestro.

## 26. Regla de regresión

🔴 Consecuencia directa del punto anterior — no hay nada contra qué comparar.

---

# Resumen ejecutivo

De 26 áreas evaluadas: **2 conformes, 8 parciales, 16 no conformes o inexistentes.** El código
actual es fiel a la spec funcional original (Fase 1: cotizador rápido con verificación técnica
básica) y ya demostró su valor real (detectó el panel/inversor incompatible de Energitel). Pero
como motor de ingeniería auditable al nivel que describe el prompt maestro, es un punto de
partida, no una base que solo necesite ajustes — la separación de dominios, el modelo de datos
central y la capa de auditoría no existen en absoluto, y son la base de la que depende casi todo
lo demás.

---

# Decisiones que necesito de ti antes de la Fase A

## 1. El conflicto "demanda × 1.25"

La spec funcional original pide este método (4.2, para comercial/industrial). El prompt maestro
lo prohíbe como sustituto del dimensionamiento energético. Opciones:

- **(a)** Mantenerlo como método "preliminar/rápido" explícitamente marcado como
  `REQUIRES_REVIEW` en vez de un resultado final aprobado, y agregar el método energético completo
  como el único que puede producir un diseño `PASS`.
- **(b)** Eliminarlo por completo y exigir siempre el método energético (más lento de implementar,
  pero sin ambigüedad).
- **(c)** Otra combinación que prefieras.

## 2. El `API_KEY` expuesto en el repo público

- **(a)** Rotar la clave ya mismo y mover la autenticación a algo que no viva en JS público
  (ej. un proxy ligero, o aceptar que para este caso de uso interno no hay secreto real posible del
  lado del cliente y documentar el riesgo aceptado explícitamente en vez de dejarlo implícito).
  Dado lo que se conversó al hacer el repo público — la clave nunca fue pensada como secreto real,
  es solo un filtro anti-abuso — puede que la decisión correcta sea *documentar* el riesgo aceptado
  en vez de rediseñar la autenticación. Pero ahora que existe un estándar que lo prohíbe
  explícitamente, prefiero que la decisión quede explícita y tuya, no mía.
- **(b)** Implementar roles básicos ahora (Fase temprana) en vez de dejarlo para el final.

## 3. Ritmo de las fases

El plan de abajo son semanas de trabajo real, no una sesión. ¿Avanzamos fase por fase con tu
revisión entre cada una (como pide el propio prompt maestro), dejando el MVP actual operativo
mientras tanto? ¿O hay una fase específica por la que prefieres empezar ya?

---

# Plan de fases propuesto

**Fase A — Fundaciones (sin cambiar ningún resultado de cálculo actual)**
Project Model central; reestructurar `Code.gs` en módulos por dominio (energía/eléctrico/
normativo/comercial) conservando las fórmulas actuales intactas; capa de auditoría básica
(`{check, result, calculated, limit, unit, formula, source, engineVersion}`); framework de testing
+ primeros Golden Cases capturando el comportamiento ACTUAL como red de seguridad antes de tocar
ninguna fórmula.

**Fase B — Motor eléctrico correcto**
Agregar Imp y coeficiente de Vmp al modelo de módulo; agregar tensión de arranque y corriente de
cortocircuito admisible (separada de corriente de entrada) al modelo de inversor; calcular Vmp en
caliente; enumerar configuraciones candidatas de string en vez de nSerieMax fijo; estados
PASS/FAIL/WARNING/REQUIRES_REVIEW/UNKNOWN en vez de booleanos.

**Fase C — Diseño DC/AC real**
Caída de tensión real (no heurística de metros); diseño AC configurable por proyecto (fases/
tensión/frecuencia) quitando `AC_VOLTAJE` hardcodeado; DPS DC/AC separados con Uc/Up/In/Imax;
puesta a tierra como conjunto real de conductores; verificación explícita de compatibilidad de
tensión batería↔inversor (el gap que ya causó un caso real).

**Fase D — Motor normativo versionado**
Registro de reglas con norma/resolución/versión/fecha/artículo/fuente/evidencia; matriz de
cumplimiento exportable.

**Fase E — Motor energético real**
Resuelve la decisión #1 de arriba; pipeline HSP→POA→temperatura→módulo→DC→inversor→AC; generación
mensual/anual, PR, kWh/kWp.

**Fase F — Optimización multi-candidato + función de costo ampliada** (NPV/IRR/LCOE, exponer
candidatos descartados, no solo el ganador).

**Fase G — Seguridad y roles** (resuelve la decisión #2 de arriba).

**Fase H — Sombras + Fase 2 original (Google Solar API)**, ya prevista en `CLAUDE.md`.

No he tocado `Code.gs` en este diagnóstico — sigue funcionando exactamente igual que antes de leer
el prompt maestro. Esperando tu decisión sobre las 3 preguntas de arriba para arrancar la Fase A.
