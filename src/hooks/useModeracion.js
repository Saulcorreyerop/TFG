import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

/*
 * Denuncias y bloqueos.
 *
 * La tabla reports tiene una columna por tipo de contenido en vez de un
 * objetivo_id genérico, para conservar la integridad referencial: si se
 * borra un evento, sus denuncias se van con él. Aquí se traduce el tipo
 * que usa la interfaz a la columna que toca.
 */

const COLUMNA = {
  evento: 'evento_id',
  comentario: 'comentario_id',
  mensaje_global: 'mensaje_global_id',
  mensaje_crew: 'mensaje_crew_id',
  perfil: 'perfil_id',
  vehiculo: 'vehiculo_id',
}

export const MOTIVOS = [
  { valor: 'spam', etiqueta: 'Spam o publicidad' },
  { valor: 'ofensivo', etiqueta: 'Ofensivo o de odio' },
  { valor: 'falso', etiqueta: 'Información falsa' },
  { valor: 'peligroso', etiqueta: 'Peligroso o ilegal' },
  { valor: 'otro', etiqueta: 'Otro motivo' },
]

/* --- Denunciar --- */

export const useDenuncia = (session) => {
  const [enviando, setEnviando] = useState(false)

  const denunciar = useCallback(
    async ({ tipo, id, motivo, detalle }) => {
      if (!session?.user?.id) {
        return { ok: false, mensaje: 'Necesitas una cuenta para denunciar.' }
      }

      const columna = COLUMNA[tipo]
      if (!columna) {
        return { ok: false, mensaje: 'Tipo de contenido no válido.' }
      }

      setEnviando(true)
      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        [columna]: id,
        motivo,
        detalle: detalle?.trim() || null,
      })
      setEnviando(false)

      if (error) {
        // 23505 es clave duplicada: ya había denunciado esto mismo
        if (error.code === '23505') {
          return { ok: true, mensaje: 'Ya habías denunciado esto. Lo estamos revisando.' }
        }
        // 23514 es una restriccion check: p. ej. denunciarse a uno mismo
        if (error.code === '23514') {
          return { ok: false, mensaje: 'No puedes denunciar tu propio contenido.' }
        }
        console.error('Error al denunciar:', error)
        return { ok: false, mensaje: 'No se ha podido enviar. Inténtalo de nuevo.' }
      }

      return { ok: true, mensaje: 'Denuncia enviada. Un moderador la revisará.' }
    },
    [session],
  )

  return { denunciar, enviando }
}

/* --- Bloquear --- */

export const useBloqueo = (session) => {
  const [bloqueados, setBloqueados] = useState(new Set())
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      if (!session?.user?.id) {
        if (activo) {
          setBloqueados(new Set())
          setCargando(false)
        }
        return
      }

      const { data } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', session.user.id)

      if (!activo) return
      setBloqueados(new Set((data || []).map((b) => b.blocked_id)))
      setCargando(false)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [session])

  const bloquear = useCallback(
    async (userId) => {
      if (!session?.user?.id || userId === session.user.id) return false

      const { error } = await supabase.from('blocks').insert({
        blocker_id: session.user.id,
        blocked_id: userId,
      })

      if (error && error.code !== '23505') {
        console.error('Error al bloquear:', error)
        return false
      }

      setBloqueados((previo) => new Set(previo).add(userId))
      return true
    },
    [session],
  )

  const desbloquear = useCallback(
    async (userId) => {
      if (!session?.user?.id) return false

      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', session.user.id)
        .eq('blocked_id', userId)

      if (error) {
        console.error('Error al desbloquear:', error)
        return false
      }

      setBloqueados((previo) => {
        const nuevo = new Set(previo)
        nuevo.delete(userId)
        return nuevo
      })
      return true
    },
    [session],
  )

  /*
   * Filtra una lista quitando lo que haya publicado alguien bloqueado.
   * Se hace en el cliente a propósito: el bloqueo es una preferencia
   * personal, no una restricción de acceso, y meterlo en las políticas
   * RLS complicaría cada consulta del proyecto a cambio de nada.
   */
  const filtrar = useCallback(
    (lista, obtenerAutor = (x) => x.user_id) =>
      bloqueados.size === 0
        ? lista
        : lista.filter((x) => !bloqueados.has(obtenerAutor(x))),
    [bloqueados],
  )

  return { bloqueados, bloquear, desbloquear, filtrar, cargando }
}
