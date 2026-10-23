# Flappy Cen Pro — Amigos al vuelo

Un juego arcade de navegador hecho para retar a la pandilla. Funciona en teléfonos y computadoras, se puede instalar como aplicación web y guarda el récord, el nombre y el silencio en cada dispositivo.

## Controles

- Toca o haz clic en el juego para volar.
- En teclado, usa Espacio, Flecha arriba o W.
- Usa los botones de la pantalla para elegir apodo y personaje, silenciar, repetir o compartir el resultado.
- El récord y el nombre se guardan localmente en ese navegador.

## Ejecutar localmente

Desde la raíz del repositorio, inicia un servidor estático:

    py -m http.server 8000

Abre http://localhost:8000/. El juego también funciona sin conexión después de su primera visita desde un servidor seguro.

## Publicar con Azure Static Web Apps

1. Sube este repositorio a GitHub si todavía no está allí y publica los cambios en la rama que vas a usar.
2. En el portal de Azure, crea un recurso **Static Web App** y elige el plan **Free** para empezar.
3. Selecciona **GitHub**, autoriza Azure y elige este repositorio y su rama principal.
4. En los detalles de compilación selecciona **Custom**. Usa la raíz del repositorio como ubicación de la aplicación (`/`) y deja vacías las ubicaciones de API y salida; este juego no necesita compilación ni backend.
5. Crea el recurso y espera a que termine la primera publicación. Azure mostrará una URL HTTPS bajo `azurestaticapps.net`; envíala por el chat de tus amigos.

Azure crea un flujo de publicación conectado a la rama. Al subir cambios futuros a esa rama, el sitio se vuelve a publicar automáticamente.

## Puntuaciones entre amigos

El récord actual es personal y vive en el navegador. El botón **Compartir reto** envía el resultado y el enlace del juego, pero todavía no existe una tabla común entre teléfonos. Para guardar una clasificación compartida se necesita añadir una API y almacenamiento.
