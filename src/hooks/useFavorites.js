import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export const useFavorites = (eventId, session) => {
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(false)

  // Comprobar estado inicial
  useEffect(() => {
    let mounted = true

    const checkFavorite = async () => {
      if (!session || !eventId) return

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)
        .maybeSingle()

      if (mounted && data) {
        setIsFavorite(true)
      }
    }

    checkFavorite()
    return () => {
      mounted = false
    }
  }, [eventId, session])

  const toggleFavorite = async (e) => {
    if (e) e.stopPropagation()

    if (!session) {
      // Aquí podrías disparar un toast global o alerta
      return
    }

    setLoading(true)

    try {
      if (isFavorite) {
        // --- QUITAR LIKE ---
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('event_id', eventId)

        if (error) throw error
        setIsFavorite(false)
      } else {
        // --- DAR LIKE ---
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: session.user.id, event_id: eventId })

        if (error) {
          // Si el error es 409 (Conflict), significa que YA existía.
          // Así que forzamos el estado a TRUE y hacemos como que no pasó nada.
          if (error.code === '23505' || error.status === 409) {
            setIsFavorite(true)
          } else {
            throw error
          }
        } else {
          setIsFavorite(true)
        }
      }
    } catch (error) {
      console.error('Error al cambiar favorito:', error)
    } finally {
      setLoading(false)
    }
  }

  return { isFavorite, toggleFavorite, loading }
}
