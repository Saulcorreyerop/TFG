import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { TabView, TabPanel } from 'primereact/tabview'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { Card } from 'primereact/card' // Necesario para las tarjetas de eventos
import { Tag } from 'primereact/tag' // Para los tags de los eventos

const ProfilePage = ({ session }) => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [myVehicles, setMyVehicles] = useState([])
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    const getProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
    }

    const getVehicles = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('id, marca, modelo, image_url')
        .eq('user_id', session.user.id)
      if (data) setMyVehicles(data)
    }

    const getFavorites = async () => {
      // Obtenemos los eventos a través de la tabla favoritos
      // Supabase entiende la relación "events" si la FK está bien hecha
      const { data, error } = await supabase
        .from('favorites')
        .select(
          `
          event_id,
          events (
            *
          )
        `,
        )
        .eq('user_id', session.user.id)

      if (!error && data) {
        // Limpiamos la data para tener un array de eventos limpio
        const formattedEvents = data
          .map((item) => item.events)
          .filter((ev) => ev !== null)
        setFavorites(formattedEvents)
      }
    }

    if (session) {
      getProfile()
      getVehicles()
      getFavorites()
    }
  }, [session])

  if (!session)
    return (
      <div className='p-5 text-center'>Inicia sesión para ver tu perfil</div>
    )

  // Plantilla simple para tarjeta de evento favorito
  const eventTemplate = (event) => {
    // Ajusta estos campos según cómo se llamen en tu tabla 'events' (titulo, fecha, etc.)
    return (
      <div key={event.id} className='col-12 md:col-6 lg:col-4 p-2'>
        <Card
          title={<h4 className='m-0 text-lg'>{event.titulo}</h4>}
          className='shadow-1 hover:shadow-3 transition-all cursor-pointer h-full'
          onClick={() => navigate('/eventos')} // O a la página de detalle del evento
        >
          <div className='flex flex-column gap-2'>
            <div className='flex align-items-center gap-2 text-sm text-500'>
              <i className='pi pi-calendar'></i>
              <span>{new Date(event.fecha).toLocaleDateString()}</span>
            </div>
            <div className='flex align-items-center gap-2 text-sm text-500'>
              <i className='pi pi-map-marker'></i>
              <span>{event.ubicacion}</span>
            </div>
            <Tag value={event.tipo} severity='info' className='w-min mt-2' />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className='max-w-4xl mx-auto p-4 md:p-6'>
      {/* Cabecera del Perfil */}
      <div className='bg-white shadow-2 border-round-2xl p-6 mb-4 flex flex-column md:flex-row align-items-center gap-5'>
        <Avatar
          icon='pi pi-user'
          size='xlarge'
          shape='circle'
          className='bg-indigo-100 text-indigo-600 w-8rem h-8rem text-5xl'
          image={profile?.avatar_url}
        />
        <div className='text-center md:text-left flex-1'>
          <h1 className='text-3xl font-bold m-0 text-900'>
            {profile?.username || 'Usuario'}
          </h1>
          <p className='text-500 mt-1'>{session.user.email}</p>
          <div className='flex gap-2 justify-content-center md:justify-content-start mt-3'>
            <Button
              label='Editar Perfil'
              icon='pi pi-pencil'
              size='small'
              outlined
              severity='secondary'
            />
            <Button
              label='Cerrar Sesión'
              icon='pi pi-power-off'
              size='small'
              severity='danger'
              onClick={() => supabase.auth.signOut()}
            />
          </div>
        </div>

        {/* Stats Rápidos */}
        <div className='flex gap-4 text-center border-top-1 md:border-top-none md:border-left-1 border-200 pt-3 md:pt-0 md:pl-5'>
          <div>
            <div className='text-2xl font-bold text-purple-600'>
              {myVehicles.length}
            </div>
            <div className='text-xs font-semibold text-500 uppercase'>
              Vehículos
            </div>
          </div>
          <div>
            <div className='text-2xl font-bold text-purple-600'>
              {favorites.length}
            </div>
            <div className='text-xs font-semibold text-500 uppercase'>
              Eventos Fav
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas de Contenido */}
      <div className='card'>
        <TabView className='custom-tabview'>
          <TabPanel header='Mis Vehículos' leftIcon='pi pi-car mr-2'>
            <div className='flex flex-wrap gap-3'>
              {myVehicles.length === 0 && (
                <p className='text-500'>Aún no has añadido vehículos.</p>
              )}

              {myVehicles.map((v) => (
                <div
                  key={v.id}
                  className='surface-card shadow-1 border-round p-2 w-10rem cursor-pointer hover:shadow-3 transition-all'
                  onClick={() => navigate('/garaje')}
                >
                  <div className='h-6rem w-full bg-gray-100 border-round overflow-hidden mb-2'>
                    {v.image_url ? (
                      <img
                        src={v.image_url}
                        className='w-full h-full object-cover'
                        alt='coche'
                      />
                    ) : (
                      <div className='flex h-full align-items-center justify-content-center'>
                        <i className='pi pi-image text-300'></i>
                      </div>
                    )}
                  </div>
                  <div className='font-bold text-sm text-center text-900'>
                    {v.marca} {v.modelo}
                  </div>
                </div>
              ))}

              <div
                className='border-2 border-dashed border-300 border-round p-2 w-10rem flex flex-column align-items-center justify-content-center cursor-pointer hover:bg-gray-50 transition-all text-500 hover:text-purple-600'
                onClick={() => navigate('/garaje')}
              >
                <i className='pi pi-plus-circle text-2xl mb-1'></i>
                <span className='font-bold text-sm'>Añadir</span>
              </div>
            </div>
          </TabPanel>

          {/* AQUI ESTÁ LA NUEVA PESTAÑA DE FAVORITOS */}
          <TabPanel header='Eventos Favoritos' leftIcon='pi pi-heart mr-2'>
            {favorites.length === 0 ? (
              <div className='text-center p-5'>
                <i className='pi pi-heart text-4xl text-300 mb-3'></i>
                <p className='text-500'>Aún no tienes eventos favoritos.</p>
                <Button
                  label='Explorar Eventos'
                  text
                  onClick={() => navigate('/mapa')}
                />
              </div>
            ) : (
              <div className='grid'>
                {favorites.map((favEvent) => eventTemplate(favEvent))}
              </div>
            )}
          </TabPanel>
        </TabView>
      </div>
    </div>
  )
}

export default ProfilePage
