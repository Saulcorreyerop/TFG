import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Menubar } from 'primereact/menubar'
import { Button } from 'primereact/button'

// import logoSrc from '../assets/logo.png'; // Descomentar cuando tengas el logo final

const Header = () => {
  const navigate = useNavigate()

  const items = [
    {
      label: 'Mapa',
      icon: 'pi pi-map-marker',
      command: () => navigate('/mapa'), // Navegación a la nueva página
    },
    {
      label: 'Eventos',
      icon: 'pi pi-calendar',
      items: [
        { label: 'Próximos', icon: 'pi pi-angle-right' },
        { label: 'Finalizados', icon: 'pi pi-history' },
      ],
    },
    {
      label: 'Garaje',
      icon: 'pi pi-car',
      command: () => navigate('/'), // Por ahora lleva al inicio
    },
  ]

  const start = (
    <div
      className='flex align-items-center mr-2 cursor-pointer'
      onClick={() => navigate('/')}
    >
      {/* <img alt="logo" src={logoSrc} height="40" className="mr-2"></img> */}
      <h2 className='text-xl font-bold text-white m-0'>
        CarMeet<span style={{ color: 'var(--blue-500)' }}>ESP</span>
      </h2>
    </div>
  )

  const end = (
    <div className='flex align-items-center gap-2'>
      <Button
        label='Login'
        icon='pi pi-user'
        className='p-button-text p-button-sm text-white'
      />
      <Button label='Registro' severity='info' size='small' />
    </div>
  )

  return (
    <div className='card sticky top-0 z-5 shadow-4'>
      <Menubar
        model={items}
        start={start}
        end={end}
        style={{
          borderRadius: 0,
          border: 'none',
          background: 'rgba(26, 26, 46, 0.95)',
        }}
      />
    </div>
  )
}

export default Header
