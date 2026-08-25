import React, { useState, useEffect } from 'react'
import { ThemeContext } from './theme-context'

/*
 * Tema de la aplicación.
 *
 * Hace tres cosas al cambiar:
 *   1. Marca data-tema en <html>, que es de donde cuelgan los tokens
 *      de tokens.css.
 *   2. Sustituye el href del <link id="tema-primereact"> del index.html
 *      para que los componentes de PrimeReact cambien también.
 *   3. Guarda la preferencia y actualiza el color de la barra del
 *      navegador en móvil.
 *
 * El valor inicial lo aplica un script en index.html antes de pintar, así
 * que aquí solo leemos lo que ya está puesto y evitamos el parpaseo.
 *
 * El hook useTheme vive en su propio archivo (useTheme.js) para que este
 * solo exporte componentes: es lo que pide la recarga en caliente de Vite.
 */


const TEMAS = {
  oscuro: { hoja: '/themes/lara-dark-blue/theme.css', barra: '#0E0E10' },
  claro: { hoja: '/themes/lara-light-blue/theme.css', barra: '#F2F2F0' },
}

const leerTemaInicial = () => {
  if (typeof document === 'undefined') return 'oscuro'
  return document.documentElement.getAttribute('data-tema') || 'oscuro'
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(leerTemaInicial)

  useEffect(() => {
    const config = TEMAS[theme] || TEMAS.oscuro

    document.documentElement.setAttribute('data-tema', theme)

    const hoja = document.getElementById('tema-primereact')
    if (hoja && hoja.getAttribute('href') !== config.hoja) {
      hoja.setAttribute('href', config.hoja)
    }

    const barra = document.querySelector('meta[name="theme-color"]')
    if (barra) barra.setAttribute('content', config.barra)

    try {
      localStorage.setItem('tema', theme)
    } catch {
      // Navegación privada o almacenamiento bloqueado: el tema sigue
      // funcionando en esta sesión, solo no se recuerda.
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((previo) => (previo === 'oscuro' ? 'claro' : 'oscuro'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
