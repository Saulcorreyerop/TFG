import React, { useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { useNavigate } from 'react-router-dom'

const Hero = () => {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  return (
    <main
      className='hero-bg flex flex-column align-items-center justify-content-center text-center relative'
      style={{ minHeight: '85vh' }}
    >
      <div className='hero-content z-1 p-4' style={{ maxWidth: '900px' }}>
        {/* Texto Blanco Puro y Sombra suave para resaltar sobre la imagen */}
        <h1
          className='text-6xl font-bold mb-3 text-white'
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
        >
          LA CARRETERA TE LLAMA
        </h1>

        {/* Descripción en gris muy claro (casi blanco) para que se lea perfecto */}
        <p className='text-xl text-100 mb-6 line-height-3 font-medium'>
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </p>

        <div className='flex justify-content-center gap-3'>
          {/* Botón Principal: Ahora es Blanco (más limpio) */}
          <Button
            label='Ver Mapa en Vivo'
            icon='pi pi-map'
            size='large'
            className='p-button-raised p-button-text bg-white text-blue-600 border-white hover:bg-blue-50'
            onClick={() => navigate('/mapa')}
          />

          {/* Botón Secundario: Transparente con borde blanco */}
          <Button
            label='Unirse a la Comunidad'
            icon='pi pi-users'
            size='large'
            outlined
            className='text-white border-white hover:bg-white-alpha-10'
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
