import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Menubar } from 'primereact/menubar'
import { Button } from 'primereact/button'
import { Avatar } from 'primereact/avatar'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'

const Header = ({ session }) => {
  const navigate = useNavigate()

  const handleLogoutConfirmation = () => {
    confirmDialog({
      message: '¿Estás seguro de que quieres cerrar sesión?',
      header: 'Cerrar Sesión',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          navigate('/')
        } catch (error) {
          console.error('Error cerrando sesión:', error.message)
        }
      },
    })
  }

  const displayName =
    session?.user?.user_metadata?.username ||
    session?.user?.email?.split('@')[0] ||
    'Usuario'

  const items = [
    {
      label: 'Mapa',
      icon: 'pi pi-map-marker',
      command: () => navigate('/mapa'),
    },
    {
      label: 'Eventos',
      icon: 'pi pi-calendar',
      command: () => navigate('/eventos'),
    },
    { label: 'Garaje', icon: 'pi pi-car', command: () => navigate('/') },
  ]

  const start = (
    <div
      className='flex align-items-center mr-2 cursor-pointer'
      onClick={() => navigate('/')}
    >
      <h2 className='text-xl font-bold text-900 m-0'>
        CarMeet<span style={{ color: 'var(--blue-500)' }}>ESP</span>
      </h2>
    </div>
  )

  const end = session ? (
    <div className='flex align-items-center gap-2 md:gap-3'>
      <div className='flex align-items-center gap-2'>
        <span className='font-bold text-sm hidden md:block text-700'>
          {displayName}
        </span>
        <Avatar
          icon='pi pi-user'
          shape='circle'
          style={{ backgroundColor: '#2196F3', color: '#ffffff' }}
        />
      </div>
      <Button
        icon='pi pi-power-off'
        severity='danger'
        onClick={handleLogoutConfirmation}
        className='p-button-rounded p-button-text p-button-sm'
      />
    </div>
  ) : (
    <div className='flex align-items-center gap-2'>
      <Button
        icon='pi pi-user'
        rounded
        text
        severity='secondary'
        aria-label='User'
        className='md:hidden'
        onClick={() => navigate('/login')}
      />
      <div className='hidden md:flex gap-2'>
        <Button
          label='Entrar'
          icon='pi pi-user'
          className='p-button-text text-700 p-button-sm'
          onClick={() => navigate('/login')}
        />
        <Button
          label='Registro'
          severity='info'
          size='small'
          onClick={() => navigate('/login')}
        />
      </div>
    </div>
  )

  return (
    <div className='sticky top-0 z-5 shadow-1'>
      {/* AÑADIDO: draggable={false} bloquea el movimiento */}
      <ConfirmDialog draggable={false} />

      <Menubar
        model={items}
        start={start}
        end={end}
        style={{ border: 'none', background: 'rgba(255, 255, 255, 0.95)' }}
      />
    </div>
  )
}

export default Header
