# Estado de la base de datos

Bitácora del trabajo sobre Supabase. Se actualiza cada vez que se toca algo
en el proyecto `stryumcmeavlvjaamcaw`.

**Última revisión:** 2026-09-04

---

## Resumen

| Área | Estado |
|---|---|
| RLS en tablas | ✅ Activo en las 15 tablas |
| Políticas de escritura en Storage | ✅ Los 4 buckets comprueban propietario (bloque 9) |
| Índices | ✅ 16 añadidos |
| Funciones `SECURITY DEFINER` | ✅ Las 3 que quedan, con `search_path` (bloque 5) |
| Email en `profiles` | ❌ Falta el bloque 8, que va después del merge a `main` |
| Clave de OneSignal | ✅ Rotada, en variables de Netlify |
| Chat de crew | ✅ Solo miembros aprobados (bloque 7) |

---

## Hecho

### Storage — cerrado el agujero grave

Las políticas del bucket `vehicles` solo comprobaban el nombre del bucket:

```
DELETE  using  (bucket_id = 'vehicles')
UPDATE  using  (bucket_id = 'vehicles')
```

Cualquier usuario registrado podía borrar o sobrescribir las fotos de todos
los demás, directamente contra la API. Sustituidas por comprobación de
propietario mediante la primera carpeta de la ruta, que es el patrón que ya
se usaba bien en el bucket `crews`:

```sql
(storage.foldername(name))[1] = auth.uid()::text
```

También:

- Políticas del bucket `vehicle-images` eliminadas (duplicado sin usar).
- Límite de 5 MB y lista de MIME (`webp`, `jpeg`, `png`) en los cuatro
  buckets en uso. Antes no había ninguno: se podía subir un SVG con
  JavaScript dentro y quedaba servido desde el dominio de Supabase.

### Índices — 16 nuevos

PostgreSQL no indexa las claves foráneas automáticamente. Faltaban en
`events` (fecha, user_id, crew_id), `event_comments`, `event_images`,
`event_attendees`, `favorites`, `vehicles`, `vehicle_images`,
`vehicle_likes`, `follows`, `notifications`, `crew_messages`,
`global_messages` y `crews`.

Pesa más de lo normal aquí porque la política `events_select_visibilidad`
hace una subconsulta a `crew_members` que se evalúa fila a fila.

### Funciones

- `delete_user_as_admin` — comprueba `is_admin` por dentro antes de nada.
  Añadidos `search_path`, la prohibición de que un admin se borre a sí
  mismo, y el borrado del resto del rastro del usuario (comentarios,
  asistencias, favoritos, seguimientos, likes y mensajes), que antes se
  quedaba huérfano.
- `guard_is_admin` — revierte en silencio los intentos de auto-ascenso.
  Extendido a `INSERT` con el trigger `trg_guard_is_admin_insert`; antes
  solo vigilaba `UPDATE`.

### Moderación — bloque 6 ejecutado

- Tabla `reports` (denuncias) con una columna por tipo de contenido y
  borrado en cascada; RLS: cada uno ve las suyas, los admin todas.
- Tabla `blocks` (bloqueos entre usuarios) con trigger que deja de seguir
  en ambos sentidos al bloquear.
- Límite de ritmo en los dos chats: 8 mensajes por minuto y usuario, por
  trigger (`trg_ritmo_global`, `trg_ritmo_crew`). Longitud máxima 1000.
- Políticas de borrado por moderación en comentarios y mensajes.
- Vista `cola_moderacion` con `security_invoker`.

### Chat de crew — bloque 7 ejecutado

`crew_messages` era legible y escribible por cualquier usuario con sesión
(`SELECT using true`). Ahora leer y escribir exige ser miembro con
`status = 'approved'` de esa crew. Comprobado: 4 políticas, ninguna con
`true`. Realtime respeta RLS.

### Bloque 5 ejecutado — `send_onesignal_notification` borrada

No la usaba ningún trigger ni ninguna otra función, así que el script la
eliminó. Con ella se va la última copia de la clave vieja de OneSignal
que quedaba escrita dentro de la base de datos.

### Bloque 9 ejecutado — `event-images` cerrado

Las cuatro políticas del bucket comprueban ya el propietario por
carpeta. Comprobado en la salida: `alguna_sin_comprobar_dueno: false`,
límite de 5 MB.

**Cuidado con el orden.** Esto se ejecutó antes del merge a `main`, así
que carmeet.es está sirviendo todavía el código que sube a ruta plana
(`${Date.now()}.jpg`) y la política lo rechaza. Subir la foto de un
evento nuevo falla en producción hasta que se despliegue el código nuevo.
El despliegue de `desarrollo` no tiene el problema.

### OneSignal

La clave REST estaba escrita en texto plano dentro del cuerpo de
`send_onesignal_notification`. **Rotada** y guardada solo en las variables
de entorno de Netlify.

---

## Pendiente

Los tres bloques de abajo están **en este orden a propósito**. Cada uno
necesita que el código esté desplegado antes, o rompe algo en producción.

### Orden de ejecución

| Paso | Qué | Estado |
|---|---|---|
| 1 | Desplegar la rama `desarrollo` | ✅ |
| 2 | `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en Netlify | ✅ |
| 3 | Bloque 5: limpiar `send_onesignal_notification` | ✅ |
| 4 | Bloque 9: cerrar el bucket `event-images` | ✅ |
| 5 | **Merge a `main`** | ⬅️ aquí estamos |
| 6 | Bloque 8: sacar el email de `profiles` | pendiente |

### Email en `profiles` — bloque 8, va después del merge

Confirmado en vivo: `GET /rest/v1/profiles?select=email` devuelve el
correo de todos los registrados, sin sesión. Bajo RGPD es una brecha
notificable.

`netlify/functions/loginUsuario.js` ya resuelve la entrada por nombre de
usuario en el servidor, y las variables de entorno están puestas. Pero
eso solo vale para el código desplegado: mientras carmeet.es sirva la
versión vieja, es el navegador quien lee `profiles.email`. **Por eso el
bloque 8 va después del merge a `main`, no antes.**

**No sirve una función RPC** que devuelva el correo dado el usuario: los
nombres de usuario son públicos, están en /comunidad, así que se pasaría
de "descárgalos todos de golpe" a "descárgalos de uno en uno".

El script se transforma solo: coge la definición real de
`handle_new_user`, le quita el correo, comprueba que el resultado ya no
lo menciona, y solo entonces lo aplica. Si no reconoce el cuerpo, aborta
sin tocar nada.

Falló en el primer intento por un error mío: `raise notice '...:%%'` con
un argumento. En RAISE, `%%` es un porcentaje literal, no un hueco, así
que sobraba el argumento y Postgres abortaba la compilación entera.
Corregido.

### Borrar el bucket `vehicle-images`

Sin políticas ya es inerte, pero sigue existiendo. Se borra desde el
panel: *Storage → vehicle-images → Delete bucket*. Supabase no permite
hacerlo por SQL (`protect_delete()`).

### Archivos huérfanos al borrar una cuenta

`delete_user_as_admin` limpia las tablas pero no los archivos del
usuario en Storage: su avatar y las fotos de sus coches se quedan en los
buckets. Para el derecho de supresión del RGPD hay que limpiarlos, y eso
se hace desde la Storage API, no desde SQL.

### Miniaturas: no están disponibles en este plan

Supabase puede redimensionar al vuelo cambiando `/object/public/` por
`/render/image/public/`. Sería lo suyo para las tarjetas, que hoy
descargan la imagen de 1920 píxeles para pintarla a 300. Comprobado
contra el proyecto:

```
403 {"error":"FeatureNotEnabled","message":"feature not enabled for this tenant"}
```

Es de plan de pago. La vía gratis es generar la miniatura en el
navegador al subir y guardar dos archivos.

### Sin copias de seguridad

El plan gratuito no tiene recuperación a un punto en el tiempo. Un
volcado semanal a un bucket es barato y evita un mal día.

---

## Esquema

15 tablas en `public`:

```
profiles          id uuid, username, email, avatar_url, bio, is_admin,
                  instagram, twitter, tiktok, youtube
events            id bigint, titulo, tipo, fecha, lat, lng, user_id,
                  description, image_url, tags[], ubicacion, crew_id,
                  is_private
vehicles          id uuid, user_id, marca, modelo, cv, anio, combustible,
                  descripcion, image_url
crews             id bigint, name, description, profile_image_url,
                  banner_image_url, created_by
crew_members      crew_id, user_id, role, status
crew_messages     crew_id, user_id, mensaje
global_messages   user_id, mensaje
event_attendees   event_id, user_id
event_comments    event_id, user_id, content
event_images      event_id, image_url
vehicle_images    vehicle_id, image_url
vehicle_likes     user_id, vehicle_id
favorites         user_id, event_id
follows           follower_id, following_id
notifications     user_id, actor_id, tipo, leida, evento_id, crew_id
```

**Realtime activo:** `global_messages`, `crew_messages`.

**Buckets:** `avatars`, `crews`, `vehicles`, `event-images` (todos
públicos). `vehicle-images` pendiente de borrar.

**Formato de rutas en Storage:**

| Bucket | Ruta | Propiedad comprobable |
|---|---|---|
| `vehicles` | `{user_id}/main-{ts}.webp` | ✅ por carpeta |
| `crews` | `{user_id}/{prefijo}-{ts}.webp` | ✅ por carpeta |
| `avatars` | `{user_id}-{ts}.webp` | ⚠️ plana, se usa `owner` |
| `event-images` | `{ts}.{ext}` | ❌ plana, sin propietario |

---

## Cómo trabajamos esto

Los scripts van numerados y se ejecutan en el *SQL Editor* de Supabase.
Dos cosas que hemos aprendido por las malas:

1. **El editor ejecuta todo el bloque como una transacción.** Si una
   sentencia falla, no se aplica nada. Conviene ejecutar y comprobar.
2. **Solo muestra el resultado de la última consulta.** Para ver varios
   resultados a la vez hay que envolverlos en un único `jsonb_build_object`,
   o ejecutarlos por separado.
