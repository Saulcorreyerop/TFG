import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Avatar } from 'primereact/avatar'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { useNavigate } from 'react-router-dom'
import { Tag } from 'primereact/tag'
import PageTransition from '../components/PageTransition'

const CommunityPage = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCommunity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCommunity = async () => {
    setLoading(true)
    // Obtenemos perfiles y sus vehículos (solo necesitamos la imagen para el fondo)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, vehicles(image_url)')

    if (!error && data) {
      setUsers(data)
    }
    setLoading(false)
  }

  // Filtrar usuarios por nombre
  const filteredUsers = users.filter((user) =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const userCardTemplate = (user) => {
    // Buscamos si tiene algún coche con foto para usarla de portada
    const coverImage = user.vehicles?.find((v) => v.image_url)?.image_url

    const header = (
      <div className='relative h-10rem w-full overflow-hidden surface-200'>
        {coverImage ? (
          <img
            src={coverImage}
            alt='Cover'
            className='w-full h-full object-cover opacity-80'
          />
        ) : (
          // Fondo genérico si no tiene coches con foto
          <div className='w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 flex align-items-center justify-content-center'>
            <i className='pi pi-car text-white text-5xl opacity-30'></i>
          </div>
        )}
        {/* Overlay oscuro para que se vea el avatar */}
        <div className='absolute top-0 left-0 w-full h-full bg-black-alpha-20'></div>
      </div>
    )

    return (
      <div key={user.id} className='col-12 md:col-6 lg:col-3 p-3'>
        <Card
          header={header}
          className='shadow-2 border-round-xl overflow-hidden cursor-pointer hover:shadow-5 transition-all h-full pt-0'
          onClick={() => navigate(`/usuario/${user.id}`)}
        >
          <div className='flex flex-column align-items-center -mt-6 relative z-1'>
            <Avatar
              image={user.avatar_url}
              icon={!user.avatar_url && 'pi pi-user'}
              size='xlarge'
              shape='circle'
              className='border-3 border-white shadow-2 bg-white text-gray-700 w-6rem h-6rem text-3xl'
            />
            <h3 className='mt-3 mb-1 text-900 font-bold'>
              {user.username || 'Usuario'}
            </h3>

            {/* Contador de vehículos */}
            <div className='mt-2'>
              {user.vehicles?.length > 0 ? (
                <Tag
                  severity='info'
                  value={`${user.vehicles.length} Vehículos`}
                  rounded
                  icon='pi pi-car'
                />
              ) : (
                <Tag
                  severity='warning'
                  value='Nuevo Miembro'
                  rounded
                  icon='pi pi-user'
                />
              )}
            </div>

            <Button
              label='Ver Perfil'
              className='mt-4 w-full'
              outlined
              size='small'
            />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className='min-h-screen surface-ground p-4 md:p-6'>
        <div className='text-center mb-6'>
          <h1 className='text-4xl font-extrabold text-900 mb-2'>Comunidad</h1>
          <p className='text-600 text-lg'>
            Encuentra a otros apasionados del motor
          </p>
        </div>

        {/* Buscador */}
        <div className='flex justify-content-center mb-6'>
          <span className='p-input-icon-left w-full md:w-30rem'>
            <i className='pi pi-search pl-3' />
            <InputText
              placeholder='Buscar usuario...'
              className='w-full border-round-3xl p-3 pl-6 shadow-1'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
        </div>

        {loading ? (
          <div className='flex justify-content-center mt-5'>
            <ProgressSpinner />
          </div>
        ) : (
          <div className='grid'>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => userCardTemplate(user))
            ) : (
              <div className='col-12 text-center text-600 mt-5'>
                No se encontraron usuarios.
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default CommunityPage
