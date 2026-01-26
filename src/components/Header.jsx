import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Menubar } from 'primereact/menubar'
import { Button } from 'primereact/button'
import { Avatar } from 'primereact/avatar'

const Header = ({ session }) => {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/')
    } catch (error) {
      console.error('Error cerrando sesión:', error.message)
    }
  }

  // --- CORRECCIÓN: Lógica para obtener el nombre de usuario ---
  // 1. Busca en los metadatos (donde lo guardamos al registrar)
  // 2. Si no hay, usa el email cortado
  // 3. Si falla todo, pone 'Usuario'
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
    { label: 'Eventos', icon: 'pi pi-calendar' },
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
    /* --- USUARIO LOGUEADO --- */
    <div className='flex align-items-center gap-2 md:gap-3'>
      <div className='flex align-items-center gap-2'>
        <span className='font-bold text-sm hidden md:block text-700'>
          {displayName} {/* <--- AQUI MOSTRAMOS EL NOMBRE REAL */}
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
        onClick={handleLogout}
        className='p-button-rounded p-button-text p-button-sm'
      />
    </div>
  ) : (
    /* --- USUARIO NO LOGUEADO --- */
    <div className='flex align-items-center gap-2'>
      {/* VISTA MÓVIL: Solo icono de usuario (redondo y simple) */}
      <Button
        icon='pi pi-user'
        rounded
        text
        severity='secondary'
        aria-label='User'
        className='md:hidden'
        onClick={() => navigate('/login')}
      />

      {/* VISTA ESCRITORIO: Botones completos (Ocultos en móvil) */}
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
