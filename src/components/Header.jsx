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
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import './Header.css'

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
  const { theme, toggleTheme } = useTheme()

  const navItems = [
    {
      label: 'Mapa',
      path: '/mapa',
      icon: <MapPin size={20} />,
    },
    {
      label: 'Eventos',
      path: '/eventos',
      icon: <CalendarDays size={20} />,
    },
    {
      label: 'Garaje',
      path: '/garaje',
      icon: <Car size={20} />,
    },
    {
      label: 'Comunidad',
      path: '/comunidad',
      icon: <Users size={20} />,
    },
    {
      label: 'Chat Global',
      path: '/chat-global',
      icon: <i className="pi pi-globe" style={{ fontSize: '20px' }}></i>,
    },
    {
      label: 'Contacto',
      path: '/contacto',
      icon: <Mail size={20} />,
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
        className='cabecera'
      >
        <div className='w-full px-4 md:px-6'>
          <div className='flex align-items-center h-5rem w-full'>
            {/* LOGO - Izquierda */}
            <div
              className='flex-none w-10rem md:w-15rem flex align-items-center cursor-pointer hover:opacity-80 transition-opacity'
              onClick={() => navigate('/')}
            >
              <h2 className='cabecera-logo'>
                CarMeet<span className='esp'>ESP</span>
              </h2>
            </div>

            {/* NAVEGACIÓN - Centro */}
            <nav className='hidden lg:flex flex-grow-1 justify-content-center align-items-center gap-2'>
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <div
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={`nav-enlace ${isActive ? 'activo' : ''}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </nav>

            {/* ACCIONES - Derecha */}
            <div className='flex-none w-auto lg:w-15rem flex justify-content-end align-items-center gap-2 md:gap-3'>
              
              <Button
                type='button'
                icon={theme === 'oscuro' ? <Sun size={20} /> : <Moon size={20} />}
                className='cabecera-icono p-button-text'
                onClick={toggleTheme}
                aria-label="Toggle Theme"
              />

              {session ? (
                <>
                  <div className='relative flex align-items-center'>
                    <Button
                      type='button'
                      icon={
                        <Bell
                          size={22}
                          className={
                            unreadCount > 0 ? 'text-blue-600' : 'text-color-secondary'
                          }
                        />
                      }
                      className={`p-button-rounded p-button-text p-0 w-3rem h-3rem transition-colors ${
                        unreadCount > 0
                          ? 'surface-hover hover:bg-blue-100'
                          : 'hover:surface-200'
                      }`}
                      onClick={handleOpenNotifications}
                    />
                    {unreadCount > 0 && (
                      <Badge
                        value={unreadCount}
                        severity='danger'
                        className='cabecera-badge'
                      />
                    )}
                  </div>

                  <div className='hidden md:flex align-items-center gap-2 pl-3 border-left-1 surface-border'>
                    <div
                      className='cabecera-usuario'
                      onClick={() => navigate('/perfil')}
                    >
                      <Avatar
                        image={displayAvatar}
                        icon={!displayAvatar ? 'pi pi-user' : null}
                        shape='circle'
                        className='cabecera-avatar'
                      />
                      <span className='nombre'>
                        {displayName}
                      </span>
                    </div>
                    <Button
                      icon={<LogOut size={18} />}
                      rounded
                      text
                      severity='danger'
                      className='cabecera-icono peligro p-button-text'
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
                        className='cabecera-icono aviso p-button-text'
                        onClick={() => navigate('/admin')}
                        tooltip='Panel Admin'
                        tooltipOptions={{ position: 'bottom' }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className='hidden md:flex align-items-center gap-2'>
                  <button
                    type='button'
                    className='btn-cabecera plano'
                    onClick={() =>
                      navigate('/login', { state: { activeIndex: 0 } })
                    }
                  >
                    Entrar
                  </button>
                  <button
                    type='button'
                    className='btn-cabecera solido'
                    onClick={() =>
                      navigate('/login', { state: { activeIndex: 1 } })
                    }
                  >
                    Únete
                  </button>
                </div>
              )}

              <Button
                icon={<Menu size={24} className='text-color' />}
                className='cabecera-icono hamburguesa lg:hidden ml-2 p-button-text'
                onClick={() => setMobileMenuOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      <OverlayPanel
        ref={op}
        className='shadow-6 border-round-2xl overflow-hidden border-none surface-card'
        style={{ width: '380px', padding: 0 }}
      >
        <div className='surface-card border-bottom-1 surface-border p-4 flex justify-content-between align-items-center'>
          <h3 className='m-0 text-lg font-black text-color flex align-items-center gap-2'>
            Notificaciones
          </h3>
          {unreadCount > 0 && (
            <Badge value={`${unreadCount} nuevas`} severity='info' />
          )}
        </div>
        <div className='max-h-25rem overflow-y-auto surface-ground'>
          {notifications.length === 0 ? (
            <div className='p-5 text-center flex flex-column align-items-center gap-3'>
              <div className='bg-gray-200 border-circle p-3 text-color-secondary'>
                <Bell size={30} />
              </div>
              <span className='text-color-secondary font-medium'>
                No tienes notificaciones nuevas.
              </span>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-bottom-1 surface-border flex gap-3 cursor-pointer transition-colors ${!notif.leida ? 'surface-card hover:surface-hover' : 'bg-transparent hover:surface-hover'}`}
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
                  <p className='m-0 text-sm text-color-secondary line-height-2'>
                    <span className='font-bold text-color'>
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
                  <span className='text-xs text-color-secondary font-bold mt-2 flex align-items-center gap-1'>
                    <i className='pi pi-clock text-xs'></i>{' '}
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
                {!notif.leida && (
                  <div className='flex align-items-center justify-content-center'>
                    <div className='w-1rem h-1rem surface-hover border-circle shadow-1'></div>
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
        className='menu-lateral w-full md:w-22rem'
      >
        <div className='flex flex-column h-full surface-card'>
          <div className='menu-cabeza'>
            <h2 className='menu-titulo'>Menú</h2>

            {session ? (
              <div
                className='menu-usuario'
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
                  className='cabecera-avatar'
                />
                <div>
                  <div className='nombre'>{displayName}</div>
                  <div className='pie'>
                    Ver mi perfil <i className='pi pi-arrow-right'></i>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type='button'
                className='menu-boton entrar'
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/login', { state: { activeIndex: 0 } })
                }}
              >
                Iniciar sesión
              </button>
            )}
          </div>

          <div className='menu-lista'>
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <div
                  key={item.label}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(item.path)
                  }}
                  className={`menu-enlace ${isActive ? 'activo' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>

          {session && (
            <div className='menu-pie'>
              {userProfile?.is_admin && (
                <button
                  type='button'
                  className='menu-boton aviso'
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/admin')
                  }}
                >
                  <ShieldAlert size={18} />
                  Panel de moderación
                </button>
              )}

              <button
                type='button'
                className='menu-boton peligro'
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogoutConfirmation()
                }}
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </Sidebar>
    </>
  )
}

export default Header
