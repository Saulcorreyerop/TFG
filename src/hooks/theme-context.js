import { createContext } from 'react'

/*
 * Objeto de contexto del tema, en su propio archivo.
 *
 * Está separado del proveedor y del hook porque la recarga en caliente de
 * Vite solo funciona si un archivo .jsx exporta componentes y nada más.
 *
 *   theme-context.js  -> el contexto (aquí)
 *   ThemeContext.jsx  -> el proveedor
 *   useTheme.js       -> el hook de consumo
 */
export const ThemeContext = createContext(null)
