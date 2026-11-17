# Domicilios y cobertura de DogSpot

El registro y la edición de perfil solicitan distrito y urbanización/barrio/sector. El domicilio de cada servicio se confirma antes de elegir cuidador y pagar. Incluye dirección, referencia opcional, coordenadas y fecha de confirmación. La ubicación guardada es una copia independiente de la del perfil.

La confirmación de reserva, la pantalla del servicio, el seguimiento y el resumen muestran el punto guardado con enlaces para verlo o llegar usando Google Maps. El usuario puede copiar la dirección y el enlace para compartirlos con el cuidador elegido. La aplicación no envía mensajes externos automáticamente ni implementa seguimiento de un cuidador en movimiento.

## Validación de cobertura

Se atiende en la provincia de Trujillo salvo El Porvenir. La selección del distrito y el punto del mapa se validan por separado. Un punto de El Porvenir se rechaza incluso si el cliente presenta otro distrito. Se admiten los doce distritos en la cartografía y once en el selector de atención, incluido Alto Trujillo.

La cartografía es una instantánea de los límites administrativos publicados por OpenStreetMap, obtenida a través de Nominatim el 17/11/2026. Es una referencia operativa de cobertura, no una delimitación legal ni catastral. Las relaciones OSM originales quedan identificadas en cada feature de `dogspot-coverage-data.mjs`. Consultas a Nominatim realizadas una sola vez, en serie y espaciadas; la app publicada no usa ese servidor para autocompletar o geocodificar domicilios.

Fuentes y licencias:

- OpenStreetMap contributors: https://www.openstreetmap.org/copyright — ODbL 1.0. La atribución permanece visible en el mapa.
- Leaflet 1.9.4: https://leafletjs.com/reference-1.9.4.html — distribución local en `vendor/leaflet`, con licencia original incluida.
- Teselas estándar OSM: https://operations.osmfoundation.org/policies/tiles/ — HTTPS, atribución y caché normal del navegador; sin precarga masiva.
- Enlaces de Google Maps: https://developers.google.com/maps/documentation/urls/get-started — coordenadas guardadas, sin clave API.

## Persistencia e integración

La app conserva sus mecanismos existentes de almacenamiento. El distrito y sector se incluyen en el perfil enviado a Sheets. El domicilio del servicio se incorpora al payload de la reserva y también a sus notas para conservarlo en el esquema existente. No se modificaron el Apps Script desplegado, sus permisos o columnas.

La vista de cuidado puede consultar la dirección de la reserva seleccionada en el mismo estado de la aplicación. El inicio de sesión y el chat siguen siendo locales al navegador; este cambio no crea un servidor autenticado de sincronización entre el teléfono del dueño y el del cuidador. La entrega a otro dispositivo se puede realizar copiando el enlace desde la reserva. La ubicación precisa nunca se escribe en el repositorio público.

## Mantenimiento

`python maintenance/apply-location.py` aplica puntos de integración acotados al build publicado anterior, comprueba que cada reemplazo sea único y genera un nuevo nombre de bundle con hash. `node --test maintenance/test-location.mjs` verifica cobertura, exclusión, snapshots, enlaces y el payload privado. Los tests existentes siguen verificando la protección de contraseña, la recuperación de datos y el seguimiento inicial.
