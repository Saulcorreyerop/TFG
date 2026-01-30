import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export const useFavorites = (eventId, session) => {
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Definimos la función DENTRO del efecto para evitar errores de dependencias y hoisting
    const checkFavorite = async () => {
      if (!session || !eventId) return

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)
        .maybeSingle()

      if (data) setIsFavorite(true)
    }

    checkFavorite()
  }, [eventId, session]) // Ahora las dependencias son correctas

  const toggleFavorite = async (e) => {
    if (e) e.stopPropagation() // Evita abrir la tarjeta si pulsas el corazón

    if (!session) {
      // Puedes cambiar esto por un Toast si prefieres
      alert('Inicia sesión para guardar favoritos')
      return
    }

    setLoading(true)

    if (isFavorite) {
      // BORRAR
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)

      if (!error) setIsFavorite(false)
    } else {
      // AÑADIR
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: session.user.id, event_id: eventId })

      if (!error) setIsFavorite(true)
    }
    setLoading(false)
  }

  return { isFavorite, toggleFavorite, loading }
}
