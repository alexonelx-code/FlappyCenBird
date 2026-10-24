# CenGames

CenGames es un proyecto personal de ocio para jugar entre amigos. No es un producto comercial ni un servicio de producción: puede cambiar, tener errores o perder datos, y no ofrece cuentas seguras, soporte ni recuperación de progreso. No hay pagos reales. **Cent** es una moneda virtual sin valor fuera del juego.

## Qué incluye

- Un portal web adaptable a teléfonos y computadoras, hecho con HTML, CSS y JavaScript sin dependencias externas.
- Flappy BirdCen, dibujado en Canvas, con controles táctiles y de teclado, récord, tabla, sonido, cinco personajes gratuitos y velocidad progresiva con tramos aleatorios que se estabiliza cerca de los 50 puntos.
- Un perfil por nombre en cada navegador, con récords, estadísticas, saldo común de Cent y avatar seleccionado.
- Una tienda de 15 avatares: los primeros cinco son gratis, los siguientes cinco cuestan 40 Cent cada uno y los últimos cinco cuestan 60 Cent cada uno.
- Una tienda de Flappy BirdCen con cinco pájaros disponibles y cinco diseños reservados en beta, además de cinco fondos: Costa dorada y Aurora polar gratis; Órbita (60 Cent), Último sol (80 Cent) y Neón urbano (100 Cent).
- Modos claro y oscuro, guardados en el navegador.
- Una API Python opcional con SQLite para desarrollo local.

Cada punto de una partida suma 1 Cent al terminar. La API local limita una partida a 10,000 puntos y evita volver a sumar un mismo identificador de partida. Las compras validan saldo, propiedad y disponibilidad antes de modificar el perfil.

## Prototipo del juego de peleas

El motor puro inicial vive en `src/js/fighter/` y todavía no se carga en el portal. Por ahora resuelve un duelo aislado con movimiento, salto, agacharse, defensa, ataques configurables, colisiones, daño y reloj fijo; no incluye selector, equipos, CPU, sprites ni recompensas. La ruta de desarrollo por fases está en [`docs/fighter-game-roadmap.md`](docs/fighter-game-roadmap.md). El juego completo seguirá siendo local y contra la computadora.

## Guardado y límites

El sitio publicado es estático y usa la capa gratuita de Azure Static Web Apps. No necesita una base de datos en la nube ni servicios de pago.

En el sitio publicado, el perfil, los Cent, la tienda, las estadísticas y los récords se guardan en el almacenamiento del navegador. Los perfiles no se sincronizan entre amigos, navegadores o dispositivos; borrar los datos del sitio puede borrar el progreso. Elegir el mismo nombre en otro dispositivo crea un perfil separado allí.

La API SQLite solo funciona en desarrollo local y escucha en `127.0.0.1`. Su archivo `data/cengames.sqlite3` está excluido de Git. No se publica con Azure y no sincroniza los perfiles de los visitantes del sitio. Los nombres son apodos locales, no hay autenticación por contraseña ni protección contra trampas; no uses información privada.

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
docs/fighter-game-roadmap.md Fases y decisiones del juego de peleas
api/economy.py              Reglas de economía y persistencia SQLite
api/http_api.py             Rutas locales de perfil, partidas, tabla y tienda
api/local_server.py         Servidor Python local para desarrollo
tests/                      Pruebas de economía y rutas API
assets/                     Avatares, ilustraciones e iconos del juego
service-worker.js           Caché sin conexión de archivos estáticos
.github/workflows/          Publicación en Azure Static Web Apps
.github/dependabot.yml       Actualizaciones de GitHub Actions
```

El juego sigue usando JavaScript simple porque el portal es estático, no tiene dependencias y necesita poco proceso de compilación. No hace falta migrarlo a Next.js para este alcance. Si se incorporan más juegos, conviene extraer módulos reutilizables de perfil, economía y navegación antes de añadir un framework.

## Pendientes de diseño

La hitbox del personaje Cen todavía difiere de la de los pájaros ilustrados. Se debe ajustar cuando estén listos los nuevos modelos y se puedan definir zonas de colisión que correspondan a cada ilustración. La API y la economía no dependen de ese trabajo visual.
