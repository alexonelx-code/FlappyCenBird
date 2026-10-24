# CenGames

CenGames es un proyecto personal de ocio para jugar entre amigos. No es un producto comercial ni un servicio de producción: puede cambiar, tener errores o perder datos, y no ofrece cuentas seguras, soporte ni recuperación de progreso. No hay pagos reales. **Cent** es una moneda virtual sin valor fuera del juego.

## Qué incluye

- Un portal web adaptable a teléfonos y computadoras, hecho con HTML, CSS y JavaScript sin dependencias externas.
- Flappy BirdCen, dibujado en Canvas, con controles táctiles y de teclado, récord, tabla, sonido, cinco personajes gratuitos y velocidad progresiva con tramos aleatorios que se estabiliza cerca de los 50 puntos.
- Cen Fighters, un juego local contra la computadora con equipos de tres, roster provisional de diez, tres dificultades, sprites humanos de pixel art arcade y cinco escenarios inspirados en el campus: biblioteca, acceso nocturno, jardín, fachada y monumento costero. Los fondos rotan entre combates y se adaptan a la arena horizontal o vertical; el HUD queda integrado en el juego, con cuatro ataques Z/X/C/V, controles táctiles tipo mando, aprendizaje Q-learning guardado por perfil, sonidos retro, efectos de impacto y pausa accesible.
- Un perfil por nombre en cada navegador, con récords, estadísticas, saldo común de Cent y avatar seleccionado.
- Una tienda de 15 avatares: los primeros cinco son gratis, los siguientes cinco cuestan 40 Cent cada uno y los últimos cinco cuestan 60 Cent cada uno.
- Una tienda de Flappy BirdCen con cinco pájaros disponibles y cinco diseños reservados en beta, además de cinco fondos: Costa dorada y Aurora polar gratis; Órbita (60 Cent), Último sol (80 Cent) y Neón urbano (100 Cent).
- Modos claro y oscuro, guardados en el navegador.
- Una API Python opcional con SQLite para desarrollo local.

Cada punto de Flappy suma 1 Cent al terminar. Cen Fighters otorga 5 Cent por completar un combate y 2 Cent adicionales por ganar; un empate completo paga 5 Cent y abandonar no paga. El perfil registra estadísticas y evita volver a acreditar un mismo ID de partida. La API local limita una partida de Flappy a 10,000 puntos. Las compras validan saldo, propiedad y disponibilidad antes de modificar el perfil.

## Prototipo del juego de peleas

El motor vive en `src/js/fighter/`, separado de la simulación de Flappy. Ya incluye la pantalla de selección y combate, equipos de tres con reservas y sustituciones, tres dificultades de CPU, una política Q-learning local y recompensas idempotentes. Tiene diez personajes provisionales con arquetipos, colores y atributos propios, arte humano en pixel art y cinco fondos originales basados en la biblioteca, el acceso nocturno, el jardín, la fachada de UNICARIBE y el monumento costero. El fondo cambia en cada combate del torneo 3 contra 3, conserva la estética de arcade de 16 bits y llena la arena adaptable. El HUD de vida y reservas queda sobre la arena. En computadoras usa flechas, J y Z/X/C/V; en teléfonos coloca los cuatro botones de ataque a la izquierda y un stick analógico a la derecha, sobre el escenario y adaptable a pantalla vertical y horizontal. El contrato de atlas y el renderer aceptan sprites animados futuros. Los nombres, sprites y el balance final se pueden cambiar cuando llegue el arte. La ruta de desarrollo y las reglas están en [`docs/fighter-game-roadmap.md`](docs/fighter-game-roadmap.md); el juego seguirá siendo local y contra la computadora.

## Guardado y límites

El sitio publicado es estático y usa la capa gratuita de Azure Static Web Apps. No necesita una base de datos en la nube ni servicios de pago.

En el sitio publicado, el perfil, los Cent, la tienda, las estadísticas, los récords, los recibos de combates y la política aprendida de la CPU se guardan en el almacenamiento del navegador. Los perfiles no se sincronizan entre amigos, navegadores o dispositivos; borrar los datos del sitio puede borrar el progreso y el aprendizaje. Elegir el mismo nombre en otro dispositivo crea un perfil separado allí.

El service worker guarda los archivos estáticos del portal y del juego de pelea para volver a abrirlos sin conexión después de la primera carga completa, en un navegador que admita service workers. Al incorporar los sprites finales, agrégalos a su lista de precarga en `service-worker.js`.

La API SQLite solo funciona en desarrollo local y escucha en `127.0.0.1`. Registra perfiles, partidas de Flappy y resultados/recompensas de Cen Fighters con SQLite. Su archivo `data/cengames.sqlite3` está excluido de Git. No se publica con Azure y no sincroniza los perfiles de los visitantes del sitio. Los nombres son apodos locales, no hay autenticación por contraseña ni protección contra trampas; no uses información privada.

## Desarrollo local

Se necesita Python 3.10 o posterior. No hay dependencias de Python externas ni instalación de paquetes.

1. Desde la carpeta del repositorio, sirve el sitio:

   ```bash
   python3 -m http.server 8000
   ```

2. En otra terminal, inicia la API opcional:

   ```bash
   python3 -m api.local_server
   ```

3. Abre [http://localhost:8000](http://localhost:8000).

Sin iniciar la API, el sitio sigue funcionando con almacenamiento del navegador. La API local escucha en `127.0.0.1:8001`; CORS permite leer sus respuestas desde los orígenes de desarrollo locales indicados en el servidor.

Para limpiar la base local, detén la API y borra `data/cengames.sqlite3` junto con sus archivos `-wal` y `-shm`, si existen. Para limpiar el perfil del navegador, borra los datos del sitio desde el navegador.

## Validación

Ejecuta las pruebas de la economía y API con la biblioteca estándar de Python:

```bash
python3 -m unittest discover -s tests -v
```

Comprueba la sintaxis de los módulos de navegador:

```bash
for file in src/js/*.js; do node --check "$file"; done
```

Incluye también los módulos nuevos del motor de peleas:

```bash
for file in src/js/fighter/*.js; do node --check "$file"; done
```

Valida el motor, los efectos de audio de pelea, la política reproducible de CPU, el roster y el renderer con Node.js:

```bash
node --test tests/*.test.cjs
```

Valida la curva de velocidad sin instalar dependencias:

```bash
node --test tests/game-pace.test.cjs
```

## Estructura

```text
index.html                  Portal, pantallas y diálogos
src/css/game.css            Estilos y diseño adaptable
src/js/audio.js             Sonido y preferencia de silencio
src/js/economy.js           Perfil, saldo, tienda y guardado de navegador/API
src/js/store-ui.js          Catálogo y acciones de compra/equipamiento
src/js/theme.js             Preferencia global de tema
src/js/ui.js                Navegación, perfil, selector y diálogos
src/js/game-config.js       Dimensiones, ritmo y perfiles de colisión
src/js/game-pace.js         Tramos de velocidad aleatorios y suavizados
src/js/game.js              Estado, controles, física y bucle de animación
src/js/game-scene.js        Paisaje, tuberías y efectos Canvas
src/js/game-character.js    Dibujo y animación de personajes
src/js/game-overlay.js      Marcador, instrucciones y resultado de partida
src/js/fighter/config.js    Parámetros provisionales del combate
src/js/fighter/engine.js    Simulación pura de un duelo, independiente de la interfaz
src/js/fighter/random.js    Semillas y números pseudoaleatorios reproducibles
src/js/fighter/team-match.js Equipos 3 contra 3, reservas, transiciones y resultado
src/js/fighter/cpu.js       Controlador heurístico base para tres dificultades
src/js/fighter/learning.js  Q-learning por perfil y simulaciones deterministas de entrenamiento
src/js/fighter/roster.js    Diez personajes provisionales y sus arquetipos/atributos
src/js/fighter/sprite-contract.js Esquema validado de atlas, clips, anclas y hitboxes
src/js/fighter/renderer.js  Arena Canvas, fondos de combate y sprites
src/js/fighter/game.js      Selección, controles, HUD, pausas y flujo del combate
docs/fighter-game-roadmap.md Fases y decisiones del juego de peleas
api/economy.py              Reglas de economía y persistencia SQLite
api/http_api.py             Rutas locales de perfil, partidas, peleas, tabla y tienda
api/local_server.py         Servidor Python local para desarrollo
tests/                      Pruebas de economía y rutas API
assets/                     Avatares, ilustraciones, iconos y fondos pixel art de Cen Fighters
service-worker.js           Caché sin conexión de archivos estáticos
.github/workflows/          Publicación en Azure Static Web Apps
.github/dependabot.yml       Actualizaciones de GitHub Actions
```

El juego sigue usando JavaScript simple porque el portal es estático, no tiene dependencias y necesita poco proceso de compilación. No hace falta migrarlo a Next.js para este alcance. Si se incorporan más juegos, conviene extraer módulos reutilizables de perfil, economía y navegación antes de añadir un framework.

## Pendientes de diseño

La hitbox del personaje Cen todavía difiere de la de los pájaros ilustrados. Se debe ajustar cuando estén listos los nuevos modelos y se puedan definir zonas de colisión que correspondan a cada ilustración. La API y la economía no dependen de ese trabajo visual.
