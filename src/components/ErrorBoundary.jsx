import React from 'react'

/*
 * Límite de error.
 *
 * Sin esto, un solo fallo de JavaScript en cualquier página deja la
 * pantalla en blanco sin explicación. Con carga diferida pasa más de lo
 * que parece: si un usuario tiene la pestaña abierta cuando despliegas,
 * el import() del trozo antiguo falla porque ese archivo ya no existe, y
 * la aplicación entera se cae.
 *
 * Ese caso concreto se detecta y se ofrece recargar, que es lo que
 * realmente lo arregla.
 *
 * Tiene que ser un componente de clase: React no ofrece equivalente con
 * hooks para capturar errores de renderizado.
 */

const esErrorDeCarga = (error) => {
  const texto = `${error?.name || ''} ${error?.message || ''}`
  return (
    /ChunkLoadError/i.test(texto) ||
    /dynamically imported module/i.test(texto) ||
    /Importing a module script failed/i.test(texto) ||
    /Failed to fetch/i.test(texto)
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Sin servicio de monitorización todavía; al menos queda en consola
    // con el árbol de componentes, que es lo que hace falta para ubicarlo.
    console.error('Error no controlado:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const desactualizado = esErrorDeCarga(error)

    return (
      <div className='fallo'>
        <div className='fallo-caja'>
          <span className='rotulo'>
            {desactualizado ? 'Versión antigua' : 'Algo ha fallado'}
          </span>

          <h1 className='fallo-titulo'>
            {desactualizado ? 'Hay una versión nueva' : 'Se nos ha calado'}
          </h1>

          <p className='fallo-texto'>
            {desactualizado
              ? 'Hemos publicado una actualización mientras tenías CarMeet abierto. Recarga la página y sigues donde estabas.'
              : 'Ha habido un error inesperado en esta pantalla. El resto de la web sigue funcionando.'}
          </p>

          <div className='fallo-acciones'>
            <button
              type='button'
              className='btn-librea'
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>

            {!desactualizado && (
              <button
                type='button'
                className='btn-contorno fallo-secundario'
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Ir al inicio
              </button>
            )}
          </div>

          {import.meta.env.DEV && (
            <pre className='fallo-detalle'>{String(error?.stack || error)}</pre>
          )}
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
