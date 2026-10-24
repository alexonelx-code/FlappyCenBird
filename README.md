# CenGames

**CenGames es un proyecto personal de ocio para jugar entre amigos.** No es un producto comercial ni un servicio profesional o de producción. Se desarrolla por diversión y puede cambiar, tener errores o perder datos; no ofrece cuentas, soporte, disponibilidad ni recuperación de progreso.

No hay pagos reales. **Cent** es una moneda virtual sin valor fuera del juego: cada punto anotado en Flappy BirdCen suma 1 Cent. Los Cent sirven para probar las opciones de personalización.

## Qué incluye

- Una portada sencilla para entrar, poner un nombre o apodo y elegir un minijuego.
- Flappy BirdCen, un juego de navegador dibujado con Canvas, compatible con teléfono y computadora.
- Cinco personajes gratuitos para Flappy BirdCen: Cen, Canario, Laguna, Mango y Nube.
- Una tabla con los mejores récords, el perfil del jugador y sus estadísticas.
- Una billetera común de Cent dentro del perfil.
- Cinco avatares gratuitos y cinco avatares que se pueden desbloquear con Cent.
- La tienda está organizada en dos secciones principales: Avatares y Flappy BirdCen. Dentro de Flappy BirdCen se eligen pájaros o fondos; esos fondos cambian el escenario y las tuberías de ese minijuego.
- Tema claro y oscuro para CenGames y las pantallas de sus minijuegos, guardado en el navegador.
- Cinco fondos jugables para Flappy BirdCen: Costa dorada y Aurora polar son gratis; Órbita, Último sol y Neón urbano se desbloquean con Cent. Cada fondo cambia el cielo, el paisaje, el suelo y el diseño de las tuberías.
- Una sección de tienda para futuros pájaros. Está en beta y sus cinco espacios quedan reservados hasta agregar los diseños.
- Un modo con API Python y base SQLite para jugar y guardar perfiles en la computadora de desarrollo.

## Cómo se gana y se usa Cent

Cada punto de una partida de Flappy BirdCen otorga 1 Cent al terminarla. La API local evita volver a sumar la misma partida si se repite una solicitud. El saldo se descuenta en el momento de comprar un avatar.

Los precios actuales de los cinco avatares de tienda son 40, 55, 70, 85 y 100 Cent. Los fondos Órbita, Último sol y Neón urbano cuestan 60, 80 y 100 Cent. Los pájaros que se agregarán después no se pueden comprar todavía: sus diseños están en beta.

## Guardado y modo gratis

El sitio publicado es estático y está pensado para la capa gratuita de Azure Static Web Apps. **No se crea ni se necesita una base de datos en la nube, una cuenta de Azure de pago ni otro servicio que genere cargos.**

En la versión publicada, el nombre, la billetera, los avatares, personajes, récords y estadísticas se conservan en el almacenamiento del navegador. La tabla es de ese navegador; los datos no se sincronizan entre amigos, navegadores ni dispositivos. Si se borra el almacenamiento del navegador, también se puede borrar el progreso.

La API Python con SQLite es para desarrollo local. La base queda en `data/cengames.sqlite3`, que está excluida de Git. En desarrollo, la API permite usar un mismo almacenamiento local entre los perfiles de esa computadora. No se sube esa base a Azure ni se comparte por internet.

## Ejecutar en la computadora

Necesitas Python 3.10 o posterior. No hay dependencias de Python externas.

1. En una terminal, desde esta carpeta, sirve la web:

   ```bash
   python3 -m http.server 8000
   ```

2. En otra terminal, inicia la API local:

   ```bash
   python3 -m api.local_server
   ```

3. Abre [http://localhost:8000](http://localhost:8000).

Si no inicias la API, el juego sigue funcionando y guarda el progreso en el navegador. La API solo escucha en `127.0.0.1:8001` y acepta solicitudes desde el sitio local.

Para borrar la base de desarrollo, detén la API y elimina `data/cengames.sqlite3`. Para limpiar el modo de navegador, borra los datos del sitio desde la configuración del navegador.

## Controles

- Toca o haz clic en el juego para jugar y aletear.
- Usa **Espacio**, **Flecha arriba** o **W** en el teclado.
- El botón del trofeo abre la tabla general.
- El botón de menú permite cambiar de personaje, abrir la tienda, controlar el sonido o volver a los minijuegos.

## Proyecto y estructura

```text
index.html                  Pantallas y diálogos
src/css/game.css            Diseño adaptable
src/js/audio.js             Sonido y preferencia de silencio
src/js/theme.js             Preferencia global de tema claro u oscuro
src/js/economy.js           Moneda Cent, tienda de avatares y fondos, guardado del navegador/API
src/js/ui.js                Navegación, perfil, selector y diálogos
src/js/game.js              Física y dibujo de Flappy BirdCen en Canvas
api/economy.py              Reglas y persistencia SQLite de perfiles, partidas y fondos
api/http_api.py             Rutas de perfil, partida, tabla y tiendas
api/local_server.py         Servidor Python local para la API
assets/                     Iconos, avatares y recursos del juego
.github/dependabot.yml      Actualización periódica de GitHub Actions
```

El frente se mantiene en HTML, CSS y JavaScript simple. Para este portal de ocio no hace falta Next.js: no hay renderizado en servidor ni navegación compleja. TypeScript puede ayudar más adelante si crecen los minijuegos y los modelos de economía; la migración se puede hacer poco a poco sin reescribir ahora el motor Canvas.

## Publicación

El workflow de GitHub Actions publica los archivos estáticos al cambiar la rama `main`. No publica la API Python ni una base de datos, para mantener la publicación dentro del modo gratuito. El progreso de la página publicada se queda en el navegador que juega.

## Mantenimiento

Dependabot revisa semanalmente las acciones de GitHub usadas por el workflow y propone actualizaciones. El proyecto evita dependencias externas para que el desarrollo local sea ligero.
