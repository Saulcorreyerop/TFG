# Estado de la base de datos

Bitácora del trabajo sobre Supabase. Se actualiza cada vez que se toca algo
en el proyecto `stryumcmeavlvjaamcaw`.

**Última revisión:** 2026-09-03 (segunda vuelta)

---

## Resumen

| Área | Estado |
|---|---|
| RLS en tablas | ✅ Activo en las 15 tablas |
| Políticas de escritura en Storage | ⚠️ Código listo, falta ejecutar el bloque 9 |
| Índices | ✅ 16 añadidos |
| Funciones `SECURITY DEFINER` | ⚠️ 3 de 4 con `search_path` fijado |
| Email en `profiles` | ⚠️ Código listo, falta ejecutar el bloque 8 |
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

### OneSignal

La clave REST estaba escrita en texto plano dentro del cuerpo de
`send_onesignal_notification`. **Rotada** y guardada solo en las variables
de entorno de Netlify.

---

## Pendiente

Los tres bloques de abajo están **en este orden a propósito**. Cada uno
necesita que el código esté desplegado antes, o rompe algo en producción.

### Orden de ejecución

| Paso | Qué | Dónde |
|---|---|---|
| 1 | Desplegar la rama `desarrollo` | Netlify |
| 2 | Añadir `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` | Netlify |
| 3 | Bloque 5: limpiar `send_onesignal_notification` | SQL Editor |
| 4 | Bloque 8: sacar el email de `profiles` | SQL Editor |
| 5 | Bloque 9: cerrar el bucket `event-images` | SQL Editor |

### 1. `send_onesignal_notification` — bloque 5 sin ejecutar

Sigue en `pg_proc` sin `search_path`, y guarda la clave vieja de
OneSignal en su propia definición. Con la clave rotada ya no es
explotable, pero hay que limpiarlo. El script comprueba si algún trigger
u otra función la usa: si no, la borra; si sí, aborta y lo dice.

### 2. Email en `profiles` — bloque 8

Confirmado en vivo: `GET /rest/v1/profiles?select=email` devuelve el
correo de todos los registrados, sin sesión. Bajo RGPD es una brecha
notificable.

Ya no hace falta la columna. `netlify/functions/loginUsuario.js`
resuelve la entrada por nombre de usuario en el servidor y solo devuelve
los tokens de sesión. Mientras falten las variables de entorno responde
501 y el navegador usa el camino antiguo, así que se puede desplegar sin
romper nada.

**No sirve una función RPC** que devuelva el correo dado el usuario: los
nombres de usuario son públicos, están en /comunidad, así que se pasaría
de "descárgalos todos de golpe" a "descárgalos de uno en uno".

El bloque 8 se transforma solo: coge la definición real de
`handle_new_user`, le quita el correo, comprueba que el resultado ya no
lo menciona, y solo entonces lo aplica. Si no reconoce el cuerpo, aborta
sin tocar nada.

### 3. Bucket `event-images` — bloque 9

Último bucket con las políticas de escritura abiertas. El código ya sube
a `${user_id}/${uuid}.webp`, así que la política de propietario por
carpeta ya se puede aplicar.

Las fotos que ya están en la raíz seguirán viéndose, pero nadie podrá
borrarlas desde la web. Son de pruebas: se limpian desde el panel.

### 4. Borrar el bucket `vehicle-images`

Sin políticas ya es inerte, pero sigue existiendo. Se borra desde el
panel: *Storage → vehicle-images → Delete bucket*. Supabase no permite
hacerlo por SQL (`protect_delete()`).

### 5. Archivos huérfanos al borrar una cuenta

`delete_user_as_admin` limpia las tablas pero no los archivos del
usuario en Storage: su avatar y las fotos de sus coches se quedan en los
buckets. Para el derecho de supresión del RGPD hay que limpiarlos, y eso
se hace desde la Storage API, no desde SQL.

### 6. Miniaturas: no están disponibles en este plan

Supabase puede redimensionar al vuelo cambiando `/object/public/` por
`/render/image/public/`. Sería lo suyo para las tarjetas, que hoy
descargan la imagen de 1920 píxeles para pintarla a 300. Comprobado
contra el proyecto:

```
403 {"error":"FeatureNotEnabled","message":"feature not enabled for this tenant"}
```

Es de plan de pago. La vía gratis es generar la miniatura en el
navegador al subir y guardar dos archivos.

### 7. Sin copias de seguridad

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
