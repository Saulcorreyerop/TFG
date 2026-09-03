import imageCompression from 'browser-image-compression'
import { supabase } from '../supabaseClient'

/*
 * Subida de imágenes a Storage.
 *
 * POR QUÉ EXISTE
 *
 * Las fotos de evento se subían con dos rutas distintas y las dos
 * estaban mal:
 *
 *   AddEventDialog     `${Date.now()}.jpg`
 *   EventDetailPage    `${event.id}/${Math.random()}.jpg`
 *
 * Tres problemas. Primero, sin carpeta de usuario no hay forma de que
 * una política de Storage compruebe quién es el dueño del archivo, así
 * que el bucket `event-images` es el único que sigue abierto: cualquiera
 * con sesión puede sobrescribir o borrar las fotos de los eventos de los
 * demás. Segundo, dos personas que suban en el mismo milisegundo se
 * pisan el archivo, y `Math.random()` colisiona más de lo que parece.
 * Tercero, se subía el original tal cual: una foto de móvil son entre 4
 * y 12 MB, y luego se sirve entera en una tarjeta de 300 píxeles.
 *
 * Con la ruta `${user_id}/${uuid}.webp` se puede aplicar la misma
 * política que ya tienen `vehicles` y `crews`:
 *
 *   (storage.foldername(name))[1] = auth.uid()::text
 */

const OPCIONES = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.8,
}

/* 5 MB es el tope que tienen puestos los buckets. Se comprueba antes de
   comprimir para no tragarse un archivo de 80 MB en memoria. */
const MAX_ENTRADA = 25 * 1024 * 1024

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/*
 * Comprime a webp y sube a `bucket` bajo la carpeta del usuario.
 * Devuelve la URL pública.
 *
 * Lanza excepción si algo falla, para que quien llama pueda enseñar el
 * aviso que corresponda. Antes se devolvía null en silencio y el evento
 * se guardaba sin foto sin que el usuario se enterara.
 */
export const subirImagen = async (archivo, { bucket, userId, prefijo = '' }) => {
  if (!archivo) throw new Error('No hay archivo')
  if (!userId) throw new Error('Hace falta una sesión para subir imágenes')

  if (archivo.size > MAX_ENTRADA) {
    throw new Error('La imagen es demasiado grande. El máximo son 25 MB.')
  }
  if (archivo.type && !TIPOS.includes(archivo.type)) {
    throw new Error('Formato no admitido. Usa JPG, PNG o WEBP.')
  }

  const comprimido = await imageCompression(archivo, OPCIONES)

  /* crypto.randomUUID en vez de Date.now() o Math.random(): no colisiona
     aunque suban diez personas a la vez. */
  const nombre = `${userId}/${prefijo}${crypto.randomUUID()}.webp`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(nombre, comprimido, { contentType: 'image/webp' })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(nombre)
  return data.publicUrl
}

/*
 * NOTA SOBRE MINIATURAS
 *
 * Supabase puede redimensionar al vuelo cambiando /object/public/ por
 * /render/image/public/ y añadiendo ?width=. Sería lo ideal para las
 * tarjetas, que hoy descargan la imagen de 1920 píxeles para pintarla a
 * 300. Está comprobado contra el proyecto y NO sirve:
 *
 *   403 {"error":"FeatureNotEnabled","message":"feature not enabled for
 *   this tenant"}
 *
 * La transformación de imágenes es de plan de pago. Si algún día se
 * contrata, se añade aquí un helper y se usa en las tarjetas. Mientras
 * tanto, la vía gratis es generar la miniatura en el navegador al subir
 * y guardar dos archivos. Anotado en docs/estado-base-de-datos.md.
 */
