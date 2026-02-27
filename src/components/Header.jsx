import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button } from 'primereact/button'
import { Avatar } from 'primereact/avatar'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { OverlayPanel } from 'primereact/overlaypanel'
import { Badge } from 'primereact/badge'
import { Sidebar } from 'primereact/sidebar'
import {
  MapPin,
  CalendarDays,
  Car,
  Users,
  Mail,
  Bell,
  LogOut,
  Menu,
  ShieldAlert,
} from 'lucide-react'

const timeAgo = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'Hace un momento'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days} días`
  return date.toLocaleDateString()
}

// LÓGICA DE TEXTOS DE NOTIFICACIONES (¡AQUÍ ESTÁ EL ARREGLO!)
const getNotificationText = (tipo) => {
  if (tipo === 'comentario') return ' ha comentado en '
  if (tipo === 'nuevo_evento') return ' ha publicado un nuevo evento: '
  if (tipo === 'nuevo_seguidor') return ' ha empezado a seguirte.'
  if (tipo === 'solicitud_crew') return ' quiere unirse a tu Crew: '
  if (tipo === 'crew_aceptada') return ' te ha aceptado en la Crew: '
  if (tipo === 'nuevo_like_vehiculo')
    return ' le ha dado me gusta a tu coche 🔥' // <-- LA MAGIA
  return ' va a asistir a '
}

const Header = ({ session }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const op = useRef(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [userProfile, setUserProfile] = useState(null)

  const navItems = [
    {
      label: 'Mapa',
      path: '/mapa',
      icon: <MapPin size={20} />,
      color: '#059669',
      bgHover: '#d1fae5',
    },
    {
      label: 'Eventos',
      path: '/eventos',
      icon: <CalendarDays size={20} />,
      color: '#2563eb',
      bgHover: '#dbeafe',
    },
    {
      label: 'Garaje',
      path: '/garaje',
      icon: <Car size={20} />,
      color: '#9333ea',
      bgHover: '#f3e8ff',
    },
    {
      label: 'Comunidad',
      path: '/comunidad',
      icon: <Users size={20} />,
      color: '#ea580c',
      bgHover: '#ffedd5',
    },
    {
      label: 'Contacto',
      path: '/contacto',
      icon: <Mail size={20} />,
      color: '#db2777',
      bgHover: '#fce7f3',
    },
  ]

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, is_admin')
        .eq('id', session.user.id)
        .single()
      if (data) setUserProfile(data)
    }
    fetchProfile()
  }, [session])

  const fetchNotifications = async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('notifications')
      .select(
        `
        id, created_at, tipo, leida, evento_id, crew_id,
        profiles!notifications_actor_id_fkey (username, avatar_url),
        events (titulo),
        crews (name)
      `,
      )
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error cargando notificaciones de Supabase:', error.message)
      return
    }

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.leida).length)
    }
  }

  useEffect(() => {
    fetchNotifications()
    if (session) {
      const channel = supabase
        .channel('realtime_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => fetchNotifications(),
        )
        .subscribe()
      return () => supabase.removeChannel(channel)
    }
    // eslint-disable-next-line
  }, [session])

  const handleOpenNotifications = async (e) => {
    op.current.toggle(e)
    if (unreadCount > 0) {
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })))
      await supabase
        .from('notifications')
        .update({ leida: true })
        .eq('user_id', session.user.id)
        .eq('leida', false)
    }
  }

  const handleNotificationClick = (notif) => {
    op.current.hide()
    if (
      notif.tipo === 'nuevo_seguidor' ||
      notif.tipo === 'nuevo_like_vehiculo'
    ) {
      navigate(`/usuario/${notif.profiles?.username}`)
    } else if (
      notif.tipo === 'solicitud_crew' ||
      notif.tipo === 'crew_aceptada'
    ) {
      navigate(`/crew/${notif.crews?.name}`)
    } else if (notif.evento_id) {
      navigate(`/evento/${notif.evento_id}`)
    }
  }

  const handleLogoutConfirmation = () => {
    confirmDialog({
      message: '¿Estás seguro de que quieres cerrar sesión?',
      header: 'Cerrar Sesión',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger border-round-xl',
      rejectClassName: 'p-button-text p-button-secondary border-round-xl',
      accept: async () => {
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
        } catch (error) {
          console.warn('Aviso al cerrar sesión:', error.message)
        } finally {
          navigate('/')
          window.location.reload()
        }
      },
    })
  }

  const displayName =
    userProfile?.username ||
    session?.user?.user_metadata?.username ||
    session?.user?.email?.split('@')[0] ||
    'Usuario'
  const displayAvatar =
    userProfile?.avatar_url || session?.user?.user_metadata?.avatar_url

  return (
    <>
      <ConfirmDialog
        draggable={false}
        style={{ width: '90vw', maxWidth: '400px' }}
      />

      <header
        className='w-full shadow-1 border-bottom-1 border-gray-200'
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className='max-w-8xl mx-auto px-3 md:px-5'>
          <div className='flex align-items-center justify-content-between h-5rem w-full'>
            <div
              className='flex align-items-center cursor-pointer hover:opacity-80 transition-opacity'
              onClick={() => navigate('/')}
            >
              <h2 className='text-2xl md:text-3xl font-black text-900 m-0 tracking-tight'>
                CarMeet<span className='text-flag-esp'>ESP</span>
              </h2>
            </div>

            <nav className='hidden lg:flex align-items-center gap-2'>
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <div
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className='flex align-items-center gap-2 px-3 py-2 border-round-2xl cursor-pointer transition-all duration-200 font-bold'
                    style={{
                      color: item.color,
                      backgroundColor: isActive ? item.bgHover : 'transparent',
                      border: isActive
                        ? `1px solid ${item.color}`
                        : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        e.currentTarget.style.backgroundColor = item.bgHover
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </nav>

            <div className='flex align-items-center gap-2 md:gap-3'>
              {session ? (
                <>
                  <div className='relative flex align-items-center'>
                    <Button
                      type='button'
                      icon={
                        <Bell
                          size={22}
                          className={
                            unreadCount > 0 ? 'text-blue-600' : 'text-600'
                          }
                        />
                      }
                      className={`p-button-rounded p-button-text p-0 w-3rem h-3rem transition-colors ${
                        unreadCount > 0
                          ? 'bg-blue-50 hover:bg-blue-100'
                          : 'hover:surface-200'
                      }`}
                      onClick={handleOpenNotifications}
                    />
                    {unreadCount > 0 && (
                      <Badge
                        value={unreadCount}
                        severity='danger'
                        className='absolute top-0 right-0 transform translate-x-30 -translate-y-10 scale-90 shadow-1'
                      />
                    )}
                  </div>

                  <div className='hidden md:flex align-items-center gap-2 pl-3 border-left-1 border-300'>
                    <div
                      className='flex align-items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 pr-3 border-round-3xl transition-colors'
                      onClick={() => navigate('/perfil')}
                    >
                      <Avatar
                        image={displayAvatar}
                        icon={!displayAvatar ? 'pi pi-user' : null}
                        shape='circle'
                        className='bg-blue-100 text-blue-600 border-1 border-blue-200 shadow-1'
                      />
                      <span className='font-bold text-sm text-800'>
                        {displayName}
                      </span>
                    </div>
                    <Button
                      icon={<LogOut size={18} />}
                      rounded
                      text
                      severity='danger'
                      className='w-2rem h-2rem hover:bg-red-50 p-0'
                      onClick={handleLogoutConfirmation}
                      tooltip='Salir'
                      tooltipOptions={{ position: 'bottom' }}
                    />
                    {userProfile?.is_admin && (
                      <Button
                        icon={<ShieldAlert size={18} />}
                        rounded
                        text
                        severity='warning'
                        className='w-2rem h-2rem hover:bg-yellow-50 p-0 mr-1'
                        onClick={() => navigate('/admin')}
                        tooltip='Panel Admin'
                        tooltipOptions={{ position: 'bottom' }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className='hidden md:flex align-items-center gap-3'>
                  <Button
                    label='Entrar'
                    text
                    className='font-bold text-700 hover:bg-gray-100 border-round-xl px-4'
                    onClick={() =>
                      navigate('/login', { state: { activeIndex: 0 } })
                    }
                  />
                  <Button
                    label='Únete'
                    className='font-bold border-round-xl px-4 shadow-2 transition-all'
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                    }}
                    onClick={() =>
                      navigate('/login', { state: { activeIndex: 1 } })
                    }
                  />
                </div>
              )}

              <Button
                icon={<Menu size={24} className='text-800' />}
                className='lg:hidden w-3rem h-3rem bg-white shadow-1 border-1 border-200 border-round-xl ml-2 text-700 hover:bg-gray-50 p-button-text'
                onClick={() => setMobileMenuOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      <OverlayPanel
        ref={op}
        className='shadow-6 border-round-2xl overflow-hidden border-none'
        style={{ width: '380px', padding: 0 }}
      >
        <div className='bg-white border-bottom-1 border-100 p-4 flex justify-content-between align-items-center'>
          <h3 className='m-0 text-lg font-black text-900 flex align-items-center gap-2'>
            Notificaciones
          </h3>
          {unreadCount > 0 && (
            <Badge value={`${unreadCount} nuevas`} severity='info' />
          )}
        </div>
        <div className='max-h-25rem overflow-y-auto bg-gray-50'>
          {notifications.length === 0 ? (
            <div className='p-5 text-center flex flex-column align-items-center gap-3'>
              <div className='bg-gray-200 border-circle p-3 text-500'>
                <Bell size={30} />
              </div>
              <span className='text-600 font-medium'>
                No tienes notificaciones nuevas.
              </span>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-bottom-1 border-200 flex gap-3 cursor-pointer transition-colors ${!notif.leida ? 'bg-white hover:bg-blue-50' : 'bg-transparent hover:bg-gray-100'}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <Avatar
                  image={notif.profiles?.avatar_url}
                  icon={!notif.profiles?.avatar_url ? 'pi pi-user' : null}
                  shape='circle'
                  size='large'
                  className='flex-shrink-0 shadow-1'
                />
                <div className='flex-1'>
                  <p className='m-0 text-sm text-700 line-height-2'>
                    <span className='font-bold text-900'>
                      {notif.profiles?.username || 'Alguien'}
                    </span>

                    {/* TEXTO FORMATEADO SEGÚN TIPO */}
                    {getNotificationText(notif.tipo)}

                    {/* EVENTOS */}
                    {!notif.tipo.includes('seguidor') &&
                      !notif.tipo.includes('crew') &&
                      !notif.tipo.includes('vehiculo') &&
                      notif.events?.titulo && (
                        <span className='font-bold text-blue-600'>
                          {notif.events?.titulo}
                        </span>
                      )}

                    {/* CREWS */}
                    {(notif.tipo === 'solicitud_crew' ||
                      notif.tipo === 'crew_aceptada') &&
                      notif.crews?.name && (
                        <span className='font-bold text-blue-600'>
                          {notif.crews?.name}
                        </span>
                      )}
                  </p>
                  <span className='text-xs text-500 font-bold mt-2 flex align-items-center gap-1'>
                    <i className='pi pi-clock text-xs'></i>{' '}
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
                {!notif.leida && (
                  <div className='flex align-items-center justify-content-center'>
                    <div className='w-1rem h-1rem bg-blue-500 border-circle shadow-1'></div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </OverlayPanel>

      <Sidebar
        visible={mobileMenuOpen}
        position='right'
        onHide={() => setMobileMenuOpen(false)}
        className='w-full md:w-20rem p-0'
      >
        <div className='flex flex-column h-full bg-white'>
          <div className='p-3 border-bottom-1 border-100 bg-gray-50'>
            <div className='flex justify-content-between align-items-center mb-3'>
              <h2 className='text-xl font-black text-900 m-0'>Menú</h2>
            </div>

            {session ? (
              <div
                className='flex align-items-center gap-3 bg-white p-2 border-round-xl shadow-1 border-1 border-200 cursor-pointer hover:border-blue-300 transition-colors'
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/perfil')
                }}
              >
                <Avatar
                  image={displayAvatar}
                  icon={!displayAvatar ? 'pi pi-user' : null}
                  shape='circle'
                  size='large'
                  className='bg-blue-100 text-blue-600 border-1 border-blue-200'
                />
                <div>
                  <div className='font-bold text-900 text-md'>
                    {displayName}
                  </div>
                  <div className='text-xs text-blue-600 font-bold mt-1'>
                    Ver mi perfil <i className='pi pi-arrow-right text-xs'></i>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                label='Iniciar Sesión'
                className='w-full font-bold border-round-xl shadow-2 py-2'
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                }}
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/login', { state: { activeIndex: 0 } })
                }}
              />
            )}
          </div>

          <div className='flex-1 overflow-y-auto p-3 flex flex-column gap-1'>
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <div
                  key={item.label}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(item.path)
                  }}
                  className='flex align-items-center gap-3 p-2 border-round-lg text-md transition-all font-bold cursor-pointer'
                  style={{
                    color: item.color,
                    backgroundColor: isActive ? item.bgHover : 'transparent',
                    border: isActive
                      ? `1px solid ${item.color}`
                      : '1px solid transparent',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>

          {session && (
            <div className='p-3 border-top-1 border-100 bg-gray-50 flex flex-column'>
              {userProfile?.is_admin && (
                <Button
                  label='Panel de Moderación'
                  icon={<ShieldAlert size={18} className='mr-2' />}
                  severity='warning'
                  text
                  className='w-full font-bold border-round-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-2 p-button-text mb-2'
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/admin')
                  }}
                />
              )}

              <Button
                label='Cerrar Sesión'
                icon={<LogOut size={18} className='mr-2' />}
                severity='danger'
                text
                className='w-full font-bold border-round-xl bg-red-50 hover:bg-red-100 text-red-600 py-2 p-button-text'
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogoutConfirmation()
                }}
              />
            </div>
          )}
        </div>
      </Sidebar>
    </>
  )
}

export default Header
