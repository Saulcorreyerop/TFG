import React, { useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'

const Hero = () => {
  const [visible, setVisible] = useState(false)

  return (
    <main
      className='hero-bg flex flex-column align-items-center justify-content-center text-center relative'
      style={{ minHeight: '85vh' }}
    >
      <div className='hero-content z-1 p-4' style={{ maxWidth: '900px' }}>
        <h1 className='text-6xl font-bold mb-3 text-white'>
          LA CARRETERA TE LLAMA
        </h1>
        <p className='text-xl text-gray-200 mb-5 line-height-3'>
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </p>
        <div className='flex justify-content-center gap-3'>
          <Button
            label='Ver Mapa en Vivo'
            icon='pi pi-map'
            size='large'
            severity='danger'
            raised
          />
          <Button
            label='Unirse a la Comunidad'
            icon='pi pi-users'
            size='large'
            outlined
            className='text-white border-white hover:bg-white hover:text-gray-900'
            onClick={() => setVisible(true)}
          />
        </div>
      </div>

      {/* Modal de Registro Rápido */}
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
