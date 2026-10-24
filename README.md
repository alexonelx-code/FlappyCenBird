# CenGames

Portal de minijuegos de navegador. Al entrar, cada jugador registra un nombre y después elige un juego. **Flappy BirdCen** es el primer minijuego disponible.

## Flujo del jugador

1. Pulsa **Iniciar**.
2. La primera vez, escribe tu nombre o apodo.
3. Elige **Flappy BirdCen** en el selector.
4. La primera vez que abras Flappy BirdCen, elige personaje.
5. Abre **Tabla** para ver los récords guardados, o usa **Menú** para volver a los minijuegos o cambiar de personaje.

El nombre, los récords personales y la tabla se guardan en el almacenamiento local del navegador. Por ahora no hay cuentas ni sincronización entre dispositivos. Una tabla realmente compartida requiere añadir una API y almacenamiento central.

## Ejecutar localmente

Desde la raíz del repositorio, inicia un servidor estático:

    python3 -m http.server 8000

Abre http://localhost:8000/.

## Controles de Flappy BirdCen

- Toca o haz clic en el juego para volar.
- En teclado, usa Espacio, Flecha arriba o W.
- Usa **Tabla** para consultar la clasificación local y **Menú** para volver a elegir juego.
- El récord personal, el personaje y el nombre se conservan en ese navegador.
