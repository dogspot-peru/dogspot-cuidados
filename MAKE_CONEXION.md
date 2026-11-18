# Activar Make en DogSpot

El código de GitHub ya prepara los tres avisos. El webhook se guarda en Google, en una propiedad privada del proyecto, y no se publica en GitHub.

La conexión usará la implementación de Apps Script que DogSpot ya emplea para sus registros. La web mantiene el mismo enlace.

## 1. Añadir el puente al proyecto existente

1. Abre el **mismo proyecto Apps Script que ya usa DogSpot** para Google Sheets. Conserva su código y su implementación actual.
2. Busca la función existente `doGet`. Cambia únicamente su nombre a `dogspotSheetsDoGet`. Por ejemplo, `function doGet(e) {` pasa a `function dogspotSheetsDoGet(e) {`. Conserva todos sus parámetros y todo su contenido.
3. Añade un archivo de código llamado **DogSpotMake** y pega el contenido completo de [integration/DogSpotMake.gs](integration/DogSpotMake.gs). Este archivo incorpora el nuevo `doGet`, que sigue atendiendo los registros anteriores y añade la conexión de correo.
4. Guarda el proyecto.

## 2. Guardar el webhook en Google

En **Configuración del proyecto → Propiedades de la secuencia de comandos**, añade:

| Propiedad | Valor |
|---|---|
| `DOGSPOT_MAKE_WEBHOOK_URL` | El webhook completo de tu escenario de Make, el que comienza con `https://hook.us2.make.com/`. |

Guarda las propiedades. No pegues esa dirección en el código del repositorio.

Si el proyecto es independiente y no está vinculado a la hoja de cálculo, añade también `DOGSPOT_AUTOMATION_SPREADSHEET_ID` con el identificador de la hoja que contiene **Automatizaciones**. En un proyecto vinculado a esa hoja, se detecta automáticamente.

Solo si configuraste autenticación con clave en el webhook de Make, guarda también esa clave en `DOGSPOT_MAKE_API_KEY`. No es necesario añadirla si tu webhook no utiliza esa autenticación.

## 3. Autorizar y actualizar la implementación

1. Selecciona y ejecuta `dogspotMakeVerifySetup` en Apps Script. Autoriza los permisos de Google que requiere tu proyecto. La función solo comprueba la configuración; no envía un correo.
2. En el registro de ejecución deben aparecer `webhookConfigured: true` y `automationSheetFound: true`.
3. Ve a **Implementar → Gestionar implementaciones**.
4. Edita la implementación que ya usa DogSpot, selecciona **Nueva versión** y pulsa **Implementar**. Mantén la misma URL `/exec` y su configuración de acceso existente.
5. Abre [la comprobación de DogSpot](https://dogspot-peru.github.io/dogspot-cuidados/conexion-make.html) y pulsa **Comprobar conexión**. Debe indicar **Puente de Make preparado**.

## 4. Activar y probar Make

1. En el escenario **DogSpot - Bienvenida, reserva y finalización**, activa la programación **Immediately as data arrives**.
2. Deja el escenario **Integration HTTP** desactivado; se utilizó para las pruebas manuales.
3. Recarga DogSpot y crea un registro nuevo con un correo que puedas revisar.
4. Verifica que se ejecuten Webhook → Data store → Bienvenida → Gmail → Sheets → Webhook response.
5. Deben aparecer el correo de bienvenida y una fila en **Automatizaciones**. La app indicará **Correo enviado mediante Make** solo cuando reciba una confirmación de envío del mismo evento.
6. Contrata una reserva desde esa cuenta y comprueba el correo de reserva. Al marcar el servicio como finalizado, comprueba el aviso de finalización. La cuenta de exploración no envía correos a clientes.

## Identificadores y reintentos

| Acción | Tipo recibido por Make | Identificador |
|---|---|---|
| Registro | `welcome` | `welcome:` seguido del identificador del cliente |
| Reserva confirmada | `booking` | `booking:` seguido del identificador de la reserva |
| Servicio finalizado | `completion` | `completion:` seguido del identificador de la reserva |

Cada reintento conserva el mismo identificador. Mantén **Overwrite an existing record = No** en Data store.

`Accepted` significa que Make recibió el aviso o lo dejó en cola; no confirma el correo. En ese caso la app conserva el estado pendiente. **Verificar envío** busca una fila del mismo evento en **Automatizaciones**, con destinatario correcto, estado `sent` e identificador de Gmail. Si existe, confirma el envío sin volver a llamar al webhook.

El error `Duplicate key` de `completion:PRUEBA-002` corresponde al identificador de la prueba manual ya registrado. No borres ese registro ni generes otro identificador para reenviar a ciegas. Primero revisa su historial en Make, Gmail y Automatizaciones.

Antes de que el puente esté instalado y configurado, los avisos nuevos conservan la ruta de EmailJS. Desde el momento en que el puente acepta un aviso, ese aviso usa exclusivamente Make, incluso si su respuesta se demora. Así se evita enviar el mismo correo por ambos proveedores.

La conexión de correo no cambia el acceso local de la app ni sincroniza perfiles o conversaciones entre dispositivos. Las fotos, contraseñas, datos de salud y coordenadas no forman parte del aviso enviado a Make.

Referencias de implementación: [Webhooks de Make](https://apps.make.com/gateway), [comunicación de Apps Script](https://developers.google.com/apps-script/guides/html/communication), [propiedades privadas del proyecto](https://developers.google.com/apps-script/guides/properties).
