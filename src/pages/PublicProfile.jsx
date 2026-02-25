import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { TabView, TabPanel } from 'primereact/tabview'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import PageTransition from '../components/PageTransition'
import { Share2, UserPlus, UserCheck } from 'lucide-react'

const PublicProfile = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const toast = useRef(null)

  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [createdEvents, setCreatedEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados de Seguidores
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true)
      try {
        // 1. Perfil
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (profileError) throw profileError
        setProfile(profileData)

        // 2. Vehículos
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId)
        if (vehicleData) setVehicles(vehicleData)

        // 3. Eventos Creados por él
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .order('fecha', { ascending: false })
        if (eventsData) setCreatedEvents(eventsData)

        // 4. Estadísticas de Seguidores
        const { count: f1 } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId)
        const { count: f2 } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId)
        setFollowersCount(f1 || 0)
        setFollowingCount(f2 || 0)

        // 5. ¿Lo sigo yo?
        if (session?.user?.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', session.user.id)
            .eq('following_id', userId)
            .single()
          setIsFollowing(!!followData)
        }
      } catch (error) {
        console.error('Error cargando perfil:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) fetchPublicData()
  }, [userId, session])

  const handleFollowToggle = async () => {
    if (!session?.user?.id) {
      toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para seguir usuarios',
      })
      return navigate('/login')
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        // Dejar de seguir
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('following_id', userId)
        setFollowersCount((prev) => prev - 1)
        setIsFollowing(false)
      } else {
        // Seguir
        await supabase
          .from('follows')
          .insert({ follower_id: session.user.id, following_id: userId })
        setFollowersCount((prev) => prev + 1)
        setIsFollowing(true)

        // Disparar Notificación a la campana
        await supabase.from('notifications').insert({
          user_id: userId, // El que recibe el aviso
          actor_id: session.user.id, // Tú, que le has seguido
          tipo: 'nuevo_seguidor',
        })
      }
    } catch (error) {
      console.error('Error en seguimiento:', error)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleShare = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator
        .share({ title: `Garaje de ${profile?.username}`, url })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.current.show({
        severity: 'success',
        summary: 'Copiado',
        detail: 'Enlace copiado al portapapeles.',
        life: 2000,
      })
    }
  }

  if (loading)
    return (
      <div className='flex justify-content-center p-8'>
        <ProgressSpinner />
      </div>
    )
  if (!profile)
    return (
      <div className='text-center p-8 text-2xl font-bold text-500'>
        Usuario no encontrado
      </div>
    )

  const isMyOwnProfile = session?.user?.id === userId

  // Plantilla para tarjetas de evento
  const eventTemplate = (event) => (
    <div key={event.id} className='col-12 md:col-6 p-2'>
      <Card
        title={<h4 className='m-0 text-lg line-clamp-1'>{event.titulo}</h4>}
        className='shadow-1 hover:shadow-3 transition-all cursor-pointer h-full border-1 border-100'
        onClick={() => navigate(`/evento/${event.id}`)}
      >
        <div className='flex flex-column gap-2'>
          <div className='flex align-items-center gap-2 text-sm text-500'>
            <i className='pi pi-calendar text-blue-500'></i>
            <span>{new Date(event.fecha).toLocaleDateString()}</span>
          </div>
          <div className='flex align-items-center gap-2 text-sm text-500'>
            <i className='pi pi-map-marker text-red-500'></i>
            <span className='line-clamp-1'>{event.ubicacion || 'En mapa'}</span>
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <PageTransition>
      <div className='max-w-6xl mx-auto p-4 md:p-6 min-h-screen'>
        <Toast ref={toast} />

        <div className='flex justify-content-between align-items-center mb-4'>
          <Button
            label='Volver'
            icon='pi pi-arrow-left'
            text
            className='font-bold text-700'
            onClick={() => navigate(-1)}
          />
          <Button
            icon={<Share2 size={18} />}
            rounded
            text
            className='bg-white shadow-1'
            onClick={handleShare}
          />
        </div>

        {/* CABECERA PÚBLICA */}
        <div className='bg-white shadow-2 border-round-3xl p-5 md:p-6 mb-5 flex flex-column md:flex-row align-items-center gap-5'>
          <Avatar
            icon='pi pi-user'
            size='xlarge'
            shape='circle'
            className='bg-blue-50 text-blue-600 w-8rem h-8rem text-5xl shadow-2 border-2 border-white'
            image={profile.avatar_url}
          />

          <div className='text-center md:text-left flex-1'>
            <h1 className='text-3xl font-black m-0 text-900'>
              {profile.username || 'Usuario'}
            </h1>
            <p className='text-500 mt-1 font-medium'>Miembro de CarMeet ESP</p>

            {!isMyOwnProfile && (
              <div className='mt-3'>
                <Button
                  label={isFollowing ? 'Siguiendo' : 'Seguir'}
                  icon={
                    isFollowing ? (
                      <UserCheck size={18} className='mr-2' />
                    ) : (
                      <UserPlus size={18} className='mr-2' />
                    )
                  }
                  className={`border-round-xl font-bold px-4 ${isFollowing ? 'p-button-outlined p-button-secondary' : ''}`}
                  onClick={handleFollowToggle}
                  loading={followLoading}
                />
              </div>
            )}
          </div>

          {/* ESTADÍSTICAS */}
          <div className='flex gap-4 md:gap-5 text-center border-top-1 md:border-top-none md:border-left-1 border-200 pt-4 md:pt-0 md:pl-5 w-full md:w-auto justify-content-center'>
            <div>
              <div className='text-2xl font-black text-900'>
                {vehicles.length}
              </div>
              <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                Coches
              </div>
            </div>
            <div>
              <div className='text-2xl font-black text-900'>
                {followersCount}
              </div>
              <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                Seguidores
              </div>
            </div>
            <div>
              <div className='text-2xl font-black text-900'>
                {followingCount}
              </div>
              <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                Seguidos
              </div>
            </div>
          </div>
        </div>

        {/* TABS DE CONTENIDO PÚBLICO */}
        <div className='bg-white shadow-2 border-round-3xl overflow-hidden'>
          <TabView className='custom-tabview p-3'>
            <TabPanel header='Garaje' leftIcon='pi pi-car mr-2'>
              {vehicles.length === 0 ? (
                <div className='text-center p-6 bg-gray-50 border-round-2xl mt-3 text-500 font-medium'>
                  Este usuario aún no ha subido vehículos.
                </div>
              ) : (
                <div className='grid pt-3'>
                  {vehicles.map((v) => (
                    <div key={v.id} className='col-12 sm:col-6 md:col-4 p-2'>
                      <Card
                        header={
                          <div className='h-12rem w-full bg-gray-100 overflow-hidden relative'>
                            {v.image_url ? (
                              <img
                                src={v.image_url}
                                className='w-full h-full object-cover'
                                alt='coche'
                              />
                            ) : (
                              <div className='flex h-full align-items-center justify-content-center'>
                                <i className='pi pi-car text-3xl text-300'></i>
                              </div>
                            )}
                            <Tag
                              value={v.combustible}
                              className='absolute top-0 right-0 m-2 bg-black-alpha-60 backdrop-blur-sm'
                            />
                          </div>
                        }
                        className='shadow-1 border-round-2xl overflow-hidden border-1 border-100 h-full'
                      >
                        <div className='font-black text-xl mb-1 text-900 line-clamp-1'>
                          {v.marca} {v.modelo}
                        </div>
                        <div className='text-500 text-sm font-bold mb-2'>
                          {v.anio} • {v.cv} CV
                        </div>
                        {v.descripcion && (
                          <p className='text-600 text-sm line-clamp-2 mt-2 m-0'>
                            {v.descripcion}
                          </p>
                        )}
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabPanel>

            <TabPanel header='Eventos Organizados' leftIcon='pi pi-flag mr-2'>
              {createdEvents.length === 0 ? (
                <div className='text-center p-6 bg-gray-50 border-round-2xl mt-3 text-500 font-medium'>
                  Este usuario no ha organizado eventos.
                </div>
              ) : (
                <div className='grid pt-3'>
                  {createdEvents.map(eventTemplate)}
                </div>
              )}
            </TabPanel>
          </TabView>
        </div>
      </div>
    </PageTransition>
  )
}

export default PublicProfile
