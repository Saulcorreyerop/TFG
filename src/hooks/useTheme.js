import { useContext } from 'react'
import { ThemeContext } from './theme-context'

/*
 * Acceso al tema actual y al conmutador.
 *
 *   const { theme, toggleTheme } = useTheme()
 *   theme -> 'oscuro' | 'claro'
 *
 * Vive separado de ThemeContext.jsx porque un archivo que exporta
 * componentes y funciones a la vez rompe la recarga en caliente de Vite.
 */
export const useTheme = () => {
  const contexto = useContext(ThemeContext)
  if (!contexto) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider')
  }
  return contexto
}
