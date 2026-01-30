import React from 'react'

const Footer = () => {
  return (
    <footer
      className='surface-900 text-center p-4 w-full border-top-1 border-gray-800'
      style={{ marginTop: 'auto' }}
    >
      <div className='font-medium text-gray-300'>
        &copy; {new Date().getFullYear()} CarMeet ESP | Proyecto Final de Ciclo
        DAW
      </div>
      <div className='mt-2 text-sm text-gray-500'>
        Desarrollado por <b>Saúl Correyero Pañero</b>
      </div>

      <div>
        <small>
          Pagina en fase de desarrollo.
          <br />
          Todos los derechos reservados.
        </small>
      </div>
    </footer>
  )
}

export default Footer
