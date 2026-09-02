# Estado de la base de datos

Bitácora del trabajo sobre Supabase. Se actualiza cada vez que se toca algo
en el proyecto `stryumcmeavlvjaamcaw`.

**Última revisión:** 2026-09-02

---

## Resumen

| Área | Estado |
|---|---|
| RLS en tablas | ✅ Activo en las 15 tablas |
| Políticas de escritura en Storage | ✅ 7 de 8 comprueban propietario |
| Índices | ✅ 16 añadidos |
| Funciones `SECURITY DEFINER` | ⚠️ 3 de 4 con `search_path` fijado |
| Email en `profiles` | ❌ Legible por anónimos |
| Clave de OneSignal | ✅ Rotada, en variables de Netlify |

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

### OneSignal

La clave REST estaba escrita en texto plano dentro del cuerpo de
`send_onesignal_notification`. **Rotada** y guardada solo en las variables
de entorno de Netlify.

---

## Pendiente

### 1. `send_onesignal_notification` — bloque 5 sin ejecutar

Sigue apareciendo en `pg_proc` sin `search_path`, y guarda la clave vieja
en su definición. Con la clave rotada ya no es explotable, pero hay que
limpiarlo.

El script comprueba solo si algún trigger la usa: si no, la borra; si sí,
avisa para recrearla leyendo de Vault.

### 2. Email en `profiles` — el que queda de verdad

```
profiles  SELECT  roles: public  using: true
profiles  columnas: id, username, email, ...
```

Lectura anónima sobre una tabla que contiene `email`. Cualquiera puede
volcar el correo de todos los usuarios con una llamada a la API REST. Bajo
RGPD es una brecha notificable.

Viene de `handle_new_user`, que copia el email al crear el perfil:

```sql
insert into public.profiles (id, email, username)
values (new.id, new.email, new.raw_user_meta_data ->> 'username');
```

Y lo consume `AuthPage`, que resuelve el login por nombre de usuario
leyendo `profiles.email` desde el navegador.

**Plan:** función RPC `SECURITY DEFINER` que reciba el nombre de usuario y
devuelva solo el email al motor de login → cambiar `AuthPage` para usarla →
quitar `email` de `handle_new_user` → eliminar la columna.

La base está casi vacía (unos 10 perfiles de prueba), así que el cambio de
esquema es gratis ahora y caro dentro de seis meses.

### 3. Bucket `event-images` — necesita cambio de código primero

Su política de subida sigue sin comprobar propietario, y no se puede
arreglar igual que las demás porque el código sube a ruta plana:

```js
// AddEventDialog.jsx
const fileName = `${Date.now()}.${fileExt}`
```

Tres problemas: sin carpeta de usuario no hay forma de comprobar propiedad,
dos usuarios que suban en el mismo milisegundo se pisan el archivo, y
conserva la extensión original.

**Plan:** pasar a `${session.user.id}/${crypto.randomUUID()}.webp`,
desplegar, y luego aplicar las políticas de propietario.

### 4. Borrar el bucket `vehicle-images`

Sin políticas ya es inerte, pero sigue existiendo. Se borra desde el panel:
*Storage → vehicle-images → Delete bucket*. Supabase no permite hacerlo por
SQL (`protect_delete()`).

### 5. Archivos huérfanos al borrar una cuenta

`delete_user_as_admin` limpia las tablas pero no los archivos del usuario
en Storage: su avatar y las fotos de sus coches se quedan en los buckets.
Para el derecho de supresión del RGPD hay que limpiarlos, y eso se hace
desde la Storage API, no desde SQL.

### 6. Chat sin límite de envío

`global_messages` y `crew_messages` no tienen límite por usuario y minuto
ni longitud máxima. Mientras la web es privada da igual; el día que se
publique, un chat global abierto es el primer sitio donde aparecen los
problemas.

**Plan:** trigger que rechace más de N mensajes por minuto y usuario, y una
restricción `check` sobre la longitud del mensaje.

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
