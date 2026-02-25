import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import PageTransition from '../components/PageTransition'
import imageCompression from 'browser-image-compression'
import {
  Users,
  UserCheck,
  Shield,
  Search,
  Car,
  Plus,
  Image as ImageIcon,
} from 'lucide-react'

const CommunityPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useRef(null)

  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'explorar')

  const [allUsers, setAllUsers] = useState([])
  const [followingUsers, setFollowingUsers] = useState([])
  const [crews, setCrews] = useState([])

  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Estados para crear Crew
  const [showCreateCrew, setShowCreateCrew] = useState(false)
  const [creatingCrew, setCreatingCrew] = useState(false)
  const [newCrew, setNewCrew] = useState({ name: '', description: '' })
  const [crewProfileImg, setCrewProfileImg] = useState(null)
  const [crewBannerImg, setCrewBannerImg] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      fetchData(session)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async (currentSession) => {
    setLoading(true)

    // 1. Usuarios
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*, vehicles(image_url)')
    if (profilesData) {
      const filteredProfiles = currentSession
        ? profilesData.filter((p) => p.id !== currentSession.user.id)
        : profilesData
      setAllUsers(filteredProfiles)
    }

    // 2. Siguiendo
    if (currentSession) {
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentSession.user.id)
      if (followsData) {
        const followingIds = followsData.map((f) => f.following_id)
        setFollowingUsers(
          profilesData?.filter((p) => followingIds.includes(p.id)) || [],
        )
      }
    }

    // 3. Crews
    const { data: crewsData } = await supabase
      .from('crews')
      .select('*, crew_members(id)')
    if (crewsData) setCrews(crewsData)

    setLoading(false)
  }

  // --- LÓGICA CREAR CREW ---
  const handleUploadCrewImage = async (file, pathPrefix) => {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/webp',
    }
    const compressedFile = await imageCompression(file, options)
    const filePath = `${session.user.id}/${pathPrefix}-${Date.now()}.webp`
    const { error } = await supabase.storage
      .from('crews')
      .upload(filePath, compressedFile)
    if (error) throw error
    const { data } = supabase.storage.from('crews').getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleCreateCrew = async () => {
    if (!newCrew.name.trim())
      return toast.current.show({
        severity: 'warn',
        summary: 'Falta nombre',
        detail: 'La crew necesita un nombre.',
      })
    setCreatingCrew(true)
    try {
      let profileUrl = null
      let bannerUrl = null

      if (crewProfileImg)
        profileUrl = await handleUploadCrewImage(crewProfileImg, 'profile')
      if (crewBannerImg)
        bannerUrl = await handleUploadCrewImage(crewBannerImg, 'banner')

      const { data: createdCrewData, error: crewError } = await supabase
        .from('crews')
        .insert({
          name: newCrew.name,
          description: newCrew.description,
          profile_image_url: profileUrl,
          banner_image_url: bannerUrl,
          created_by: session.user.id,
        })
        .select()
        .single()

      if (crewError) throw crewError

      await supabase.from('crew_members').insert({
        crew_id: createdCrewData.id,
        user_id: session.user.id,
        role: 'admin',
        status: 'approved',
      })

      toast.current.show({
        severity: 'success',
        summary: 'Crew Creada',
        detail: '¡Tu club ya es oficial!',
      })
      setShowCreateCrew(false)
      setNewCrew({ name: '', description: '' })
      setCrewProfileImg(null)
      setCrewBannerImg(null)
      fetchData(session)
    } catch (error) {
      console.error(error)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'El nombre ya existe o hubo un fallo.',
      })
    } finally {
      setCreatingCrew(false)
    }
  }

  // --- FILTROS ---
  const getDisplayedUsers = () => {
    const sourceList = activeTab === 'explorar' ? allUsers : followingUsers
    if (!searchTerm) return sourceList
    return sourceList.filter((user) =>
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }
  const displayedUsers = getDisplayedUsers()
  const displayedCrews = crews.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // --- COMPONENTES VISUALES ---
  const renderUserCard = (user) => {
    const coverImage = user.vehicles?.find((v) => v.image_url)?.image_url
    return (
      <div key={user.id} className='col-12 sm:col-6 md:col-4 lg:col-3 p-2'>
        <div
          className='bg-white shadow-2 hover:shadow-4 transition-all cursor-pointer h-full flex flex-column relative overflow-hidden'
          style={{ borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}
          onClick={() => navigate(`/usuario/${user.username || user.id}`)}
        >
          {/* Banner */}
          <div
            className='w-full bg-gray-200 relative'
            style={{ height: '120px' }}
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt='Cover'
                className='w-full h-full'
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className='w-full h-full bg-blue-100 flex align-items-center justify-content-center'>
                <Car className='text-blue-300' size={40} />
              </div>
            )}
          </div>

          {/* Cuerpo y Avatar */}
          <div className='px-4 pb-4 flex flex-column align-items-center flex-1 relative bg-white'>
            {/* Avatar Solapado */}
            <div
              className='bg-white border-circle flex justify-content-center align-items-center shadow-1'
              style={{
                width: '80px',
                height: '80px',
                marginTop: '-40px',
                padding: '4px',
              }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className='w-full h-full border-circle'
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className='w-full h-full border-circle bg-gray-100 flex align-items-center justify-content-center'>
                  <Users size={32} className='text-400' />
                </div>
              )}
            </div>

            <h3 className='m-0 mt-3 mb-1 text-xl text-900 font-bold line-clamp-1 text-center w-full'>
              {user.username || 'Usuario'}
            </h3>

            <div className='mt-2 mb-4'>
              {user.vehicles?.length > 0 ? (
                <Tag
                  className='bg-blue-50 text-blue-700 font-bold px-3 py-2'
                  style={{ borderRadius: '1rem' }}
                >
                  <i className='pi pi-car text-xs mr-2'></i>
                  {user.vehicles.length} Vehículos
                </Tag>
              ) : (
                <Tag
                  className='bg-gray-100 text-600 font-bold px-3 py-2'
                  style={{ borderRadius: '1rem' }}
                >
                  Nuevo Miembro
                </Tag>
              )}
            </div>

            <Button
              label='Ver Perfil'
              outlined
              className='w-full mt-auto font-bold border-gray-300 text-700 hover:bg-gray-50'
              style={{ borderRadius: '0.75rem' }}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderCrewCard = (crew) => {
    return (
      <div key={crew.id} className='col-12 sm:col-6 md:col-4 p-2'>
        <div
          className='bg-white shadow-2 hover:shadow-4 transition-all cursor-pointer h-full flex flex-column relative overflow-hidden'
          style={{ borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}
        >
          {/* Banner */}
          <div
            className='w-full bg-gray-800 relative'
            style={{ height: '140px' }}
          >
            {crew.banner_image_url && (
              <img
                src={crew.banner_image_url}
                alt='Banner'
                className='w-full h-full opacity-80'
                style={{ objectFit: 'cover' }}
              />
            )}
          </div>

          {/* Cuerpo y Avatar */}
          <div className='px-4 pb-4 flex flex-column align-items-center flex-1 relative bg-white'>
            {/* Logo Solapado con borde cuadrado redondeado */}
            <div
              className='bg-white flex justify-content-center align-items-center shadow-1'
              style={{
                width: '90px',
                height: '90px',
                marginTop: '-45px',
                padding: '4px',
                borderRadius: '1rem',
              }}
            >
              {crew.profile_image_url ? (
                <img
                  src={crew.profile_image_url}
                  alt={crew.name}
                  className='w-full h-full'
                  style={{ objectFit: 'cover', borderRadius: '0.75rem' }}
                />
              ) : (
                <div
                  className='w-full h-full bg-gray-100 flex align-items-center justify-content-center'
                  style={{ borderRadius: '0.75rem' }}
                >
                  <Shield size={36} className='text-400' />
                </div>
              )}
            </div>

            <h3 className='m-0 mt-3 mb-1 text-2xl text-900 font-black line-clamp-1 text-center w-full'>
              {crew.name}
            </h3>
            <p className='text-500 text-sm font-bold mt-0 mb-3 flex align-items-center gap-2'>
              <Users size={16} /> {crew.crew_members?.length || 0} Miembros
            </p>
            <p className='text-600 text-sm line-clamp-2 text-center mb-4 font-medium px-2'>
              {crew.description || 'Sin descripción disponible.'}
            </p>

            <button
              className='w-full mt-auto font-bold border-none p-2 text-white cursor-pointer'
              style={{ borderRadius: '0.5rem', backgroundColor: '#2563eb' }}
              onClick={(e) => {
                e.stopPropagation() // Evita conflictos
                navigate(`/crew/${crew.name}`) // Redirige usando el nombre de la crew
              }}
            >
              Ver Crew
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className='min-h-screen bg-gray-50 p-4 md:p-6 pb-8'>
        <Toast ref={toast} />
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-5'>
            <h1 className='text-4xl md:text-5xl font-black text-900 m-0 mb-2'>
              Comunidad
            </h1>
            <p className='text-600 text-lg m-0 font-medium'>
              Descubre usuarios y únete a los mejores clubes.
            </p>
          </div>

          {/* NAVEGACIÓN ESTILO PÍLDORA CENTRAL */}
          <div className='flex justify-content-center mb-6'>
            <div
              className='bg-white p-1 shadow-1 flex flex-wrap'
              style={{ borderRadius: '2rem', border: '1px solid #e2e8f0' }}
            >
              <button
                className={`flex align-items-center gap-2 px-5 py-3 border-none font-bold text-md cursor-pointer transition-all ${activeTab === 'explorar' ? 'bg-gray-900 text-blacks shadow-2' : 'bg-transparent text-600 hover:text-900 hover:bg-gray-50'}`}
                style={{ borderRadius: '1.75rem' }}
                onClick={() => setActiveTab('explorar')}
              >
                <Users size={18} /> Explorar
              </button>

              <button
                className={`flex align-items-center gap-2 px-5 py-3 border-none font-bold text-md cursor-pointer transition-all ${activeTab === 'siguiendo' ? 'bg-blue-600 text-black shadow-2' : 'bg-transparent text-600 hover:text-900 hover:bg-gray-50'}`}
                style={{ borderRadius: '1.75rem' }}
                onClick={() => {
                  if (!session)
                    return toast.current.show({
                      severity: 'warn',
                      summary: 'Aviso',
                      detail: 'Inicia sesión para ver a quién sigues',
                    })
                  setActiveTab('siguiendo')
                }}
              >
                <UserCheck size={18} /> Siguiendo
              </button>

              <button
                className={`flex align-items-center gap-2 px-5 py-3 border-none font-bold text-md cursor-pointer transition-all ${activeTab === 'crews' ? 'bg-blue-600 text-black shadow-2' : 'bg-transparent text-600 hover:text-900 hover:bg-gray-50'}`}
                style={{ borderRadius: '1.75rem' }}
                onClick={() => setActiveTab('crews')}
              >
                <Shield size={18} /> Crews
              </button>
            </div>
          </div>

          {/* BUSCADOR Y BOTÓN CREAR CREW */}
          <div className='flex flex-column md:flex-row justify-content-center align-items-center gap-3 mb-6'>
            <div className='relative w-full md:w-6 lg:w-5'>
              <Search
                className='absolute left-0 top-50 transform -translate-y-50 ml-4 text-400'
                size={20}
              />
              <InputText
                placeholder={
                  activeTab === 'crews'
                    ? 'Buscar club por nombre...'
                    : 'Buscar usuario...'
                }
                className='w-full bg-white border-none shadow-1 font-medium text-lg text-900'
                style={{ padding: '1rem 1rem 1rem 3rem', borderRadius: '2rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {activeTab === 'crews' && session && (
              <Button
                label='Crear Crew'
                icon={<Plus size={20} className='mr-2' />}
                className='bg-black border-none hover:bg-black shadow-2 font-bold w-full md:w-auto'
                style={{ padding: '1rem 1.5rem', borderRadius: '2rem' }}
                onClick={() => setShowCreateCrew(true)}
              />
            )}
          </div>

          {/* CONTENIDO PRINCIPAL */}
          {loading ? (
            <div className='flex justify-content-center py-8'>
              <ProgressSpinner />
            </div>
          ) : (
            <div className='grid m-0'>
              {activeTab === 'crews' ? (
                displayedCrews.length > 0 ? (
                  displayedCrews.map(renderCrewCard)
                ) : (
                  <div className='col-12 text-center py-8'>
                    <Shield size={64} className='text-300 mb-4 mx-auto' />
                    <h3 className='text-2xl font-bold text-900 m-0 mb-2'>
                      No hay Crews disponibles
                    </h3>
                    <p className='text-600 text-lg'>
                      Sé el primero en fundar un club en tu zona.
                    </p>
                  </div>
                )
              ) : displayedUsers.length > 0 ? (
                displayedUsers.map(renderUserCard)
              ) : (
                <div className='col-12 text-center py-8'>
                  <Users size={64} className='text-300 mb-4 mx-auto' />
                  <h3 className='text-2xl font-bold text-900 m-0 mb-2'>
                    No hay resultados
                  </h3>
                  <p className='text-600 text-lg'>Prueba con otra búsqueda.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL CREAR CREW (Diseño Realista) */}
        <Dialog
          header={
            <span className='text-2xl font-black text-900'>
              Fundar Nueva Crew
            </span>
          }
          visible={showCreateCrew}
          onHide={() => setShowCreateCrew(false)}
          style={{ width: '90vw', maxWidth: '500px' }}
          className='border-round-3xl shadow-8'
          contentClassName='pb-4 pt-2 px-4 md:px-5'
          headerClassName='px-4 md:px-5 pt-4 pb-2 border-none'
        >
          <div className='flex flex-column pt-3'>
            <p className='text-600 mb-4 mt-0 text-sm'>
              Sube las imágenes haciendo clic en los recuadros correspondientes.
            </p>

            {/* PREVIEW INTERACTIVA */}
            <div
              className='w-full bg-white border-1 border-gray-200 mb-5 relative'
              style={{ borderRadius: '1rem', height: '180px' }}
            >
              {/* Contenedor Banner */}
              <div
                className='w-full bg-gray-100 relative cursor-pointer hover:opacity-80 transition-opacity flex align-items-center justify-content-center overflow-hidden'
                style={{ height: '120px', borderRadius: '1rem 1rem 0 0' }}
              >
                {crewBannerImg ? (
                  <img
                    src={URL.createObjectURL(crewBannerImg)}
                    className='w-full h-full'
                    style={{ objectFit: 'cover' }}
                    alt='Banner'
                  />
                ) : (
                  <div className='flex flex-column align-items-center text-500 font-bold text-sm'>
                    <ImageIcon size={24} className='mb-1' /> Banner Fondo
                  </div>
                )}
                <input
                  type='file'
                  accept='image/*'
                  className='absolute inset-0 opacity-0 cursor-pointer w-full h-full'
                  onChange={(e) => setCrewBannerImg(e.target.files[0])}
                />
              </div>

              {/* Contenedor Logo (Solapado) */}
              <div
                className='absolute bg-white shadow-2 flex align-items-center justify-content-center cursor-pointer hover:bg-gray-50 transition-colors z-2 overflow-hidden'
                style={{
                  width: '80px',
                  height: '80px',
                  left: '24px',
                  bottom: '20px',
                  borderRadius: '0.75rem',
                  padding: '4px',
                }}
              >
                <div
                  className='w-full h-full bg-gray-100 flex align-items-center justify-content-center text-500 relative'
                  style={{ borderRadius: '0.5rem' }}
                >
                  {crewProfileImg ? (
                    <img
                      src={URL.createObjectURL(crewProfileImg)}
                      className='w-full h-full absolute top-0 left-0'
                      style={{ objectFit: 'cover', borderRadius: '0.5rem' }}
                      alt='Logo'
                    />
                  ) : (
                    <div className='flex flex-column align-items-center text-xs font-bold'>
                      <Plus size={20} /> Logo
                    </div>
                  )}
                  <input
                    type='file'
                    accept='image/*'
                    className='absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10'
                    onChange={(e) => setCrewProfileImg(e.target.files[0])}
                  />
                </div>
              </div>
            </div>

            {/* FORMULARIO TEXTO */}
            <div className='flex flex-column gap-4'>
              <span className='p-float-label'>
                <InputText
                  id='crewName'
                  value={newCrew.name}
                  onChange={(e) =>
                    setNewCrew({ ...newCrew, name: e.target.value })
                  }
                  className='w-full font-bold text-lg'
                  style={{ borderRadius: '1rem', padding: '1rem' }}
                />
                <label htmlFor='crewName'>Nombre de la Crew *</label>
              </span>

              <span className='p-float-label'>
                <InputTextarea
                  id='crewDesc'
                  value={newCrew.description}
                  onChange={(e) =>
                    setNewCrew({ ...newCrew, description: e.target.value })
                  }
                  rows={3}
                  className='w-full text-md'
                  style={{ borderRadius: '1rem', padding: '1rem' }}
                  autoResize
                />
                <label htmlFor='crewDesc'>
                  Descripción de la crew (Opcional)
                </label>
              </span>

              <Button
                label='Crear Crew'
                className='w-full py-3 mt-2 font-bold text-lg bg-black border-none shadow-2 hover:bg-black'
                style={{ borderRadius: '1rem' }}
                onClick={handleCreateCrew}
                loading={creatingCrew}
              />
            </div>
          </div>
        </Dialog>
      </div>
    </PageTransition>
  )
}

export default CommunityPage
