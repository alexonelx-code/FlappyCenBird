# Ruta del juego de peleas local

El juego será una experiencia local de una persona contra la CPU. Cada equipo escoge tres peleadores distintos de un roster de diez y ordena su entrada; se permiten personajes espejo entre equipos. La partida termina al eliminar al equipo contrario. El premio será de 5 Cent por partida completa y 2 adicionales por victoria; un empate completo paga 5 y abandonar paga 0.

La simulación se mantiene independiente de la pantalla de Flappy. El arte se integrará después de validar las reglas con figuras provisionales. La dirección visual prevista es arena neo-retro de 16 bits y una interfaz moderna inspirada en iOS.

El documento maestro de diseño está en [`output/pdf/plan-maestro-juego-de-peleas-cengames.pdf`](../output/pdf/plan-maestro-juego-de-peleas-cengames.pdf); esta hoja sirve para seguir las fases de implementación.

## Fases y dependencias

| Fase | Alcance | Criterio de salida | Estado |
| --- | --- | --- | --- |
| 1. Motor de duelo | Simulación pura a 60 ticks por segundo; movimiento, salto, agacharse, defensa, golpes, hitboxes, daño, stun, retroceso y reloj. No depende de DOM, Canvas ni sprites. Los cuerpos no bloquean el movimiento: se pueden cruzar y se orientan hacia el rival. | La misma secuencia de entradas y configuración produce el mismo estado; ataques respetan startup/active/recovery, impactan una vez y el duelo resuelve KO, timeout o muerte súbita. | Base del motor implementada; todavía no está conectada a una pantalla. |
| 2. Equipos 3 contra 3 | Selector de tres personajes sin duplicados dentro del equipo, orden de entrada, reservas, sustituciones y vida persistente del superviviente. | Barrida, turnos mixtos, doble KO, timeout y fin de equipo producen un resultado único y reproducible. |
| 3. CPU base y dificultad | Controlador de acciones legales con Muy fácil, Normal y Difícil. | Los niveles se distinguen por reacción y decisión; ninguno modifica vida, daño ni información disponible. |
| 4. Aprendizaje local | Política Q-learning compacta, entrenada primero mediante simulaciones y ajustada por perfil tras partidas completas. | La CPU adapta preferencias dentro de límites de dificultad, conserva una política base, se puede reiniciar y funciona sin red. |
| 5. Integración del portal y economía | Lobby, pantalla de pelea, pausa, teclado/touch, perfil, estadísticas y pago único por matchId. | La partida se puede iniciar, pausar, abandonar y completar desde el portal; Cent y estadísticas no se duplican al reintentar un guardado. |
| 6. Pareja de arte | Contrato de atlas, anclas, clips e hitboxes; adaptar una pareja de sprites como piloto. | Las animaciones conservan el ancla de pies y los hitboxes se pueden inspeccionar sin depender del dibujo. |
| 7. Roster completo | Adaptar los diez peleadores, definir arquetipos y balancear enfrentamientos. | Todos comparten el contrato de datos y cada matchup se puede probar con la misma semilla. |
| 8. Pulido y publicación | Audio, efectos, cache offline, accesibilidad, rendimiento, README y QA desktop/móvil. | El juego abre sin API, funciona tras cargar la cache y limpia teclado/touch, pausa y ciclo de animación al salir. |

## Reglas base ya decididas

- Un peleador activo por equipo; el banco permanece fuera del combate.
- Cada duelo inicia con reloj de 40 segundos. Un KO elimina al derrotado; entra el siguiente con vida completa. El superviviente conserva vida y enfriamiento del especial, pero vuelve a estado neutral.
- A tiempo, gana el peleador con mayor porcentaje de vida; si empatan, hay hasta cinco segundos de muerte súbita. El primer ataque que toca al rival decide, aunque lo bloquee. Sin contacto o con intercambio simultáneo, ambos quedan eliminados.
- Hay hasta cinco duelos. El límite teórico es 3:49 de combate y transiciones, más intro y resultado; el objetivo normal es una partida de dos a tres minutos.
- Recargar o cerrar durante un combate cuenta como abandono. Una partida terminada guarda el resultado y su recibo de Cent con el mismo ID idempotente antes de mostrar el resultado.
- El motor usa tiempo fijo y datos configurables. El renderer nunca decide colisiones, daño, reloj o ganador.

## Fase 1: API del prototipo

El código vive en `src/js/fighter/`. `config.js` guarda los valores de simulación provisionales; `engine.js` expone `createDuel(options)` y `stepDuel(state, inputs)`. Cada llamada a `stepDuel` avanza exactamente un tick de 1/60 de segundo y devuelve un estado nuevo junto con los eventos de ese tick. Las entradas `left` y `right` aceptan `moveX` entre -1 y 1, `jump`, `crouch`, `block` y un pulso de `attack` (`light` o `heavy`). El resultado distingue KO, timeout, doble KO, golpe de muerte súbita, intercambio simultáneo y empate sin contacto.

Esta fase no añade una pantalla al portal ni modifica Flappy. El selector de equipos, CPU, roster definitivo, gráficos, audio y pago de Cent pertenecen a fases posteriores.
