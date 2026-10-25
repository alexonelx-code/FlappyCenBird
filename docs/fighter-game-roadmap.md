# Ruta del juego de peleas local

El juego será una experiencia local de una persona contra la CPU. Cada equipo escoge tres peleadores distintos de un roster de diez y ordena su entrada; se permiten personajes espejo entre equipos. La partida termina al eliminar al equipo contrario. El premio será de 5 Cent por partida completa y 2 adicionales por victoria; un empate completo paga 5 y abandonar paga 0.

La simulación se mantiene independiente de la pantalla de Flappy. El arte se integrará después de validar las reglas con figuras provisionales. La dirección visual prevista es arena neo-retro de 16 bits y una interfaz moderna inspirada en iOS.

El documento maestro de diseño está en [`output/pdf/plan-maestro-juego-de-peleas-cengames.pdf`](../output/pdf/plan-maestro-juego-de-peleas-cengames.pdf); esta hoja sirve para seguir las fases de implementación.

## Fases y dependencias

| Fase | Alcance | Criterio de salida | Estado |
| --- | --- | --- | --- |
| 1. Motor de duelo | Simulación pura a 60 ticks por segundo; movimiento, salto, agacharse, defensa, golpes, hitboxes, daño, stun, retroceso, reloj y separación física para que el arte no se apile. No depende de DOM, Canvas ni sprites. | La misma secuencia de entradas y configuración produce el mismo estado; ataques respetan startup/active/recovery, impactan una vez y el duelo resuelve KO, timeout o muerte súbita. | Motor determinista implementado e integrado al ciclo de combate. |
| 2. Equipos 3 contra 3 | Selector de tres personajes sin duplicados dentro del equipo, orden de entrada, reservas, sustituciones y vida persistente del superviviente. | Barrida, turnos mixtos, doble KO, timeout y fin de equipo producen un resultado único y reproducible. | Reglas e interfaz por pasos implementadas. |
| 3. CPU base y dificultad | Controlador de acciones legales con Muy fácil, Normal y Difícil. | Los niveles se distinguen por reacción y decisión; ninguno modifica vida, daño ni información disponible. | Controlador heurístico implementado; el aprendizaje queda para la fase 4. |
| 4. Aprendizaje local | Política Q-learning compacta, entrenada primero mediante simulaciones y ajustada por perfil tras partidas completas. | La CPU adapta preferencias dentro de límites de dificultad, conserva una política base, se puede reiniciar y funciona sin red. | Implementada |
| 5. Integración del portal y economía | Lobby, pantalla de pelea, pausa, teclado/touch, perfil, estadísticas y pago único por matchId. | La partida se puede iniciar, pausar, abandonar y completar desde el portal; Cent y estadísticas no se duplican al reintentar un guardado. | Implementada |
| 6. Pareja de arte | Contrato de atlas, anclas, clips e hitboxes; renderer listo para reemplazar los placeholders al recibir el arte. | Las animaciones conservan el ancla de pies y los hitboxes se pueden inspeccionar sin depender del dibujo. | Contrato y renderer implementados; primer personaje integrado, faltan los otros nueve |
| 7. Roster completo | Definir diez peleadores, arquetipos, estadísticas y loadouts que el motor pueda validar. | Todos comparten el contrato de datos y cada matchup se puede probar con la misma semilla. | Diez loadouts provisionales implementados; faltan sprites y pruebas de balance con el roster final |
| 8. Pulido y publicación | Audio, efectos, cache offline, accesibilidad, rendimiento, README y QA desktop/móvil. | El juego abre sin API, funciona tras cargar la cache y limpia teclado/touch, pausa y ciclo de animación al salir. | Implementada; falta revisar con sprites finales |

## Reglas base ya decididas

- Un peleador activo por equipo; el banco permanece fuera del combate.
- Los peleadores no atraviesan ni montan sus siluetas: el motor conserva una separación visual por personaje. El ancho visual es independiente de la hurtbox, así que el ajuste no agranda los golpes recibidos.
- La preparación ofrece tres pasos separados: escoger equipo, escoger uno de cinco escenarios y escoger dificultad. El escenario elegido permanece durante los cinco duelos del torneo.
- Cada duelo inicia con reloj de 40 segundos. Un KO elimina al derrotado; entra el siguiente con vida completa. El superviviente conserva vida y vuelve a estado neutral. Cuando existan movimientos especiales, sus enfriamientos también se conservarán; todavía no hay especiales en el prototipo.
- A tiempo, gana el peleador con mayor porcentaje de vida; si empatan, hay hasta cinco segundos de muerte súbita. El primer ataque que toca al rival decide, aunque lo bloquee. Sin contacto o con intercambio simultáneo, ambos quedan eliminados.
- Hay hasta cinco duelos. El límite teórico es 3:49 de combate y transiciones, más intro y resultado; el objetivo normal es una partida de dos a tres minutos.
- Recargar o cerrar durante un combate cuenta como abandono. Una partida terminada guarda el resultado y su recibo de Cent con el mismo ID idempotente antes de mostrar el resultado.
- El motor usa tiempo fijo y datos configurables. El renderer nunca decide colisiones, daño, reloj o ganador.

## Motor y APIs implementadas

Todo el código vive en `src/js/fighter/` y sigue siendo independiente del DOM y del Canvas.

- **Fase 1:** `config.js` guarda valores provisionales; `engine.js` expone `createDuel(options)` y `stepDuel(state, inputs)`. Cada paso avanza un tick de 1/60 s. Las entradas `left` y `right` aceptan `moveX` entre -1 y 1, `jump`, `crouch`, `block` y un pulso de `attack` (`light` o `heavy`). El duelo reporta KO, timeout y variantes de muerte súbita.
- **Fase 2:** `team-match.js` expone `createMatch({ playerTeam, cpuTeam?, roster?, seed?, config? })` y `stepMatch(state, { player, cpu })`. El roster provisional tiene diez IDs; el equipo del jugador debe indicar tres distintos en orden. Si se omite el equipo CPU, se eligen tres personajes y su orden con una semilla reproducible. Se permiten espejos entre bandos porque los IDs de combate se separan por equipo. El perdedor queda eliminado; el superviviente conserva su vida y vuelve a neutral al iniciar el siguiente duelo. Un empate de duelo elimina a ambos. Hay hasta cinco duelos y 60 ticks de transición. No existe todavía un movimiento especial ni un enfriamiento que guardar.
- **Fase 3:** `cpu.js` expone `createController({ difficulty, side?, seed? })` y `stepController(controller, duel)`, que devuelve el controlador actualizado y la entrada de CPU para ese tick. Los IDs `muy-facil`, `normal` y `dificil` aceptan también sus nombres con acentos y alias comunes. La CPU decide cada 24, 12 o 6 ticks (400, 200 o 100 ms a 60 Hz), con defensas y selección de ataque distintas. No modifica atributos ni recibe entradas futuras; usa solo el estado visible del duelo y decisiones pseudoaleatorias reproducibles.

Al iniciar una partida, la pantalla crea el controlador con `seed: match.cpuSeed` para separar su secuencia de la selección del equipo. En cada tick activo usa `CenFighterLearning.stepController(controller, match.duel)` y pasa su respuesta como `cpu` a `CenFighterTeams.stepMatch(match, { player: playerInput, cpu: response.input })`. Durante la transición de equipos no se avanza el duelo ni el controlador.

## Fases 4 y 5 implementadas

- `learning.js` entrena una tabla Q-learning determinista en simulaciones breves del motor. Observa distancia, amenaza, ventaja de vida y estado del peleador; elige acercarse, retirarse, bloquear, golpear ligero/fuerte o saltar. Las tres dificultades cambian reacción y exploración, sin tocar vida, daño ni información visible. El ajuste de una partida se escribe solo al terminarla y se puede borrar por perfil desde el selector.
- El lobby guía al jugador por tres pasos: elegir tres integrantes únicos y su orden de entrada, elegir escenario y elegir dificultad. El roster sigue usando diez IDs temporales mientras se esperan los nombres definitivos.
- `game.js` integra el tick fijo de 60 Hz, Canvas provisional, reloj por duelo, vida del activo, reservas, pausa, abandono, teclado y controles táctiles. A/D o ←/→ mueven; W, Espacio o ↑ saltan; S o ↓ agachan; J/Shift cubren. Cada pulsación de ataque dispara una acción: Z es puño izquierdo rápido, X patada frontal media, C puño derecho fuerte y V el movimiento especial. V tiene más alcance, daño, inicio y recuperación; hoy comparte reglas entre personajes, no consume barra y no se repite al mantener pulsada la tecla. Al llegar el arte se harán animaciones distintivas para cada personaje. La pantalla de combate muestra esta leyenda y los botones táctiles conservan las letras con etiquetas cortas.
- Una partida terminada entrega 5 Cent; la victoria añade 2. El empate paga 5. Abandonar o recargar antes del resultado no registra ni paga una partida. La pantalla manda un ID único y la economía limita repeticiones a 2,000 recibos retenidos por perfil.
- El perfil publicado y el aprendizaje viven en `localStorage`; la API opcional solo en localhost añade resultados en SQLite y migra las bases ya existentes. No hay sincronización entre dispositivos ni ML remoto.

## Fases 6 y 7 implementadas

- `sprite-contract.js` valida atlases locales, tamaño de frame, ancla de pies, clips (quieto, caminar, salto, agacharse, bloquear, puño rápido, patada, puño fuerte, especial, recibir daño, KO, entrada y victoria) y cajas de cuerpo y de los cuatro ataques. Los índices recorren el atlas por filas; el ancla se mide desde la esquina superior izquierda del frame. Las cajas se miden desde el ancla, con `y` negativo hacia arriba; son datos de inspección del arte y el motor conserva sus propios hitboxes de combate.
- `renderer.js` dibuja los clips usando el ancla y la orientación del peleador, con fallback al atlas provisional y a figuras temporales cuando aún no existe una hoja animada. La escala visual usa la altura de pie del sprite; las anclas inferiores del atlas provisional compensan su espacio transparente bajo las botas.
- `roster.js` incluye diez peleadores y paletas; Luis conserva ese nombre indicado por el usuario. El selector muestra `assets/fighters/characters/luis-original.jpg`; durante el combate usa `assets/fighters/characters/fighter-01.png`, una hoja transparente de 6 × 5 cuadros con clips de reposo, caminata, salto, agachado con flexión de piernas, bloqueo, cuatro movimientos, daño, KO, entrada y victoria. La interfaz destaca al peleador, deja visibles los tres puestos y el orden del equipo, y mantiene legibles las diez tarjetas. El renderer limita el arte de Luis al 82 % de la altura de combate, reduce también el atlas temporal de los otros peleadores para que la escala encaje mejor con la arena, y ancla el borde inferior del cuadro en la línea de piso. Los otros nueve aún usan el atlas provisional. Cada peleador tiene un arquetipo y ajustes individuales de vida, velocidad, salto, defensa y movimientos; espejo entre equipos sigue permitido.
- `engine.js`, `team-match.js`, la CPU y el aprendizaje consumen los atributos y movimientos individuales sin alterar las reglas de reloj, reservas o recompensa.
- Las cifras sirven como primer pase de balance, no como valores finales. Para cada foto nueva, se prepara una hoja por personaje con cuerpo y atuendo legibles en pixel art; clips separados de reposo, pasos, salto, agachado, bloqueo, cuatro ataques, daño, entrada, KO y victoria; ancla de pies fija entre poses; y hitboxes contrastadas con la silueta. El agachado debe doblar piernas y bajar torso sin encoger el sprite completo. El V conservará las mismas reglas iniciales, pero tendrá una animación y efecto visual característicos por personaje. Los nombres provisionales y el balance podrán ajustarse al cerrar el arte y revisar matchups reproducibles.

## Fase 8 implementada

- Los sonidos retro usan Web Audio integrado al silencio global; golpes, bloqueos, KO, entrada de reservas y resultado tienen señales distintas. El botón de sonido está disponible durante el combate y no se descarga audio ni se añade una dependencia.
- Los impactos dibujan destellos pixelados y el fondo estático se conserva en un canvas auxiliar para reducir trabajo de dibujo. El HUD solo cambia el DOM cuando cambian reloj, vida, reservas o duelo.
- `prefers-reduced-motion` detiene las animaciones decorativas de Canvas sin cambiar velocidad, colisiones ni reglas del combate.
- Perder el foco o cambiar de pestaña pausa el combate y limpia las entradas retenidas. Escape pausa/reanuda; los diálogos mantienen el foco dentro y la selección/retorno mueve el foco al encabezado o al juego correspondiente.
- El service worker precarga el código y la interfaz de pelea para uso posterior sin conexión después de una carga inicial en un origen compatible. Los sprites futuros deberán agregarse a su lista de cache.
- La verificación cubre flujo de navegador, test de reglas, accesibilidad estructural, carga de recursos y sintaxis; el balance visual y las hurtboxes se revisarán al recibir el arte final.

## Riesgos y decisiones que quedan para fases posteriores

- El aprendizaje es una política tabular local y pequeña, no entrenamiento en la nube. Puede aprender preferencias útiles, pero todavía necesita probarse contra humanos y balancearse; la dificultad seguirá limitando reflejos y exploración.
- La economía local es para el proyecto de ocio. Como los datos se guardan en el navegador, un jugador puede modificarlos; no se usa para dinero real, premios ni cuentas entre dispositivos.
- El primer personaje ya usa su hoja generada a partir de foto; los otros nueve conservan sprites temporales. Al recibir cada foto, fase 6 debe integrar su atlas y comparar visualmente el cuerpo con las hurtboxes; fase 7 debe reemplazar los nombres provisionales si así lo indica el diseño final y probar matchups y valores bajo semillas repetibles.
- Las próximas revisiones deben probar escalado en dispositivos físicos y completar el paquete de sprites. La pantalla de pelea usa Canvas nativo para evitar dependencias y funcionar desde el sitio estático.
