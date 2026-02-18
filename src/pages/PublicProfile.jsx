import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom' // useParams para leer la URL
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { TabView, TabPanel } from 'primereact/tabview'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import PageTransition from '../components/PageTransition'

const PublicProfile = () => {
  const { userId } = useParams() // Obtenemos el ID de la URL
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true)
      try {
        // 1. Obtener datos del usuario
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (profileError) throw profileError
        setProfile(profileData)

        // 2. Obtener sus vehículos
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId)

        if (vehicleData) setVehicles(vehicleData)
      } catch (error) {
        console.error('Error cargando perfil:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) fetchPublicData()
  }, [userId])

  if (loading)
    return (
      <div className='flex justify-content-center p-6'>
        <ProgressSpinner />
      </div>
    )

  if (!profile)
    return <div className='text-center p-6'>Usuario no encontrado</div>

  return (
    <PageTransition>
      <div className='max-w-4xl mx-auto p-4 md:p-6 min-h-screen'>
        <Button
          label='Volver'
          icon='pi pi-arrow-left'
          text
          onClick={() => navigate(-1)}
          className='mb-3'
        />

        {/* Cabecera Pública */}
        <div className='bg-white shadow-2 border-round-2xl p-6 mb-4 flex flex-column md:flex-row align-items-center gap-5'>
          <Avatar
            icon='pi pi-user'
            size='xlarge'
            shape='circle'
            className='bg-blue-100 text-blue-600 w-8rem h-8rem text-5xl shadow-2'
            image={profile.avatar_url}
          />
          <div className='text-center md:text-left flex-1'>
            <h1 className='text-3xl font-bold m-0 text-900'>
              {profile.username || 'Usuario'}
            </h1>
            <p className='text-500 mt-1'>Miembro de la comunidad</p>
          </div>

          {/* Stats */}
          <div className='text-center border-left-1 border-200 pl-5 hidden md:block'>
            <div className='text-2xl font-bold text-blue-600'>
              {vehicles.length}
            </div>
            <div className='text-xs font-semibold text-500 uppercase'>
              Vehículos
            </div>
          </div>
        </div>

        {/* Garaje Público */}
        <h2 className='text-2xl font-bold text-900 mb-3 ml-2'>
          Garaje de {profile.username}
        </h2>

        {vehicles.length === 0 ? (
          <p className='text-500 ml-2'>
            Este usuario aún no ha subido vehículos.
          </p>
        ) : (
          <div className='grid'>
            {vehicles.map((v) => (
              <div key={v.id} className='col-12 md:col-6 lg:col-4 p-2'>
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
                        className='absolute top-0 right-0 m-2'
                      />
                    </div>
                  }
                  className='shadow-1 border-round-xl overflow-hidden'
                >
                  <div className='font-bold text-xl mb-1'>
                    {v.marca} {v.modelo}
                  </div>
                  <div className='text-500 text-sm mb-2'>
                    {v.anio} • {v.cv} CV
                  </div>
                  <p className='text-600 text-sm line-clamp-2'>
                    {v.descripcion}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default PublicProfile
