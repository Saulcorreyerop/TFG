import React, { useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

const Hero = () => {
  const [visible, setVisible] = useState(false)

  const navigate = useNavigate()

  return (
    <main
      className='hero-bg flex flex-column align-items-center justify-content-center text-center relative'
      style={{ minHeight: '85vh' }}
    >
      {/* Añadimos padding-x (px-4) para que no toque los bordes en móvil */}
      <div
        className='hero-content z-1 p-4 w-full'
        style={{ maxWidth: '900px' }}
      >
        <h1
          className='text-5xl md:text-6xl font-bold mb-3 text-white'
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
        >
          LA CARRETERA TE LLAMA
        </h1>

        {/* CAMBIO COLOR TEXTO: Ahora es text-white con sombra suave */}
        <p
          className='text-xl text-white mb-6 line-height-3 font-medium'
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </p>

        {/* CAMBIO BOTONES: flex-column en móvil, flex-row en desktop */}
        <div className='flex flex-column md:flex-row justify-content-center gap-3 w-full md:w-auto'>
          <Button
            label='Ver Mapa en Vivo'
            icon='pi pi-map'
            size='large'
            /* Usamos onClick y navigate en lugar de Link */
            onClick={() => navigate('/mapa')}
            /* Tus clases originales se mantendrán perfectas */
            className='p-button-raised p-button-text bg-white text-blue-600 border-white hover:bg-blue-50 w-full md:w-auto'
          />

          <Button
            label='Unirse a la Comunidad'
            icon='pi pi-users'
            size='large'
            outlined
            /* w-full en móvil, w-auto en PC */
            className='text-white border-white hover:bg-white-alpha-10 w-full md:w-auto'
            onClick={() => setVisible(true)}
          />
        </div>
      </div>

      <Dialog
        header='Únete a CarMeet ESP'
        visible={visible}
        style={{ width: '90vw', maxWidth: '400px' }}
        onHide={() => setVisible(false)}
      >
        <div className='flex flex-column gap-3'>
          <p className='m-0'>
            Introduce tu correo para recibir alertas de eventos cercanos.
          </p>
          <span className='p-input-icon-left'>
            <i className='pi pi-envelope' />
            <InputText placeholder='tu@email.com' className='w-full' />
          </span>
          <Button
            label='Continuar'
            icon='pi pi-arrow-right'
            autoFocus
            onClick={() => setVisible(false)}
          />
        </div>
      </Dialog>
    </main>
  )
}

export default Hero
