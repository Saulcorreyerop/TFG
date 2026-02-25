import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import { Tag } from 'primereact/tag'
import PageTransition from '../components/PageTransition'
import {
  Users,
  Shield,
  ArrowLeft,
  Check,
  X,
  UserPlus,
  Calendar,
  Car,
} from 'lucide-react'

const CrewDetailPage = ({ session }) => {
  const { crewName } = useParams()
  const navigate = useNavigate()
  const toast = useRef(null)

  const [crew, setCrew] = useState(null)
  const [members, setMembers] = useState([])
  const [crewVehicles, setCrewVehicles] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [userStatus, setUserStatus] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchCrewData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: crewData, error: crewErr } = await supabase
        .from('crews')
        .select('*')
        .eq('name', decodeURIComponent(crewName))
        .single()

      if (crewErr || !crewData) throw new Error('Crew no encontrada')
      setCrew(crewData)

      const { data: membersData, error: memErr } = await supabase
        .from('crew_members')
        .select('*, profiles(*, vehicles(*))')
        .eq('crew_id', crewData.id)

      if (memErr) throw memErr

      if (membersData) {
        const approved = membersData.filter((m) => m.status === 'approved')
        const pending = membersData.filter((m) => m.status === 'pending')

        setMembers(approved)
        setPendingRequests(pending)

        const allVehicles = approved.flatMap((m) =>
          (m.profiles.vehicles || []).map((v) => ({
            ...v,
            owner: m.profiles.username,
          })),
        )
        setCrewVehicles(allVehicles)

        if (session?.user) {
          const currentUser = membersData.find(
            (m) => m.user_id === session.user.id,
          )
          if (currentUser) {
            setUserStatus(currentUser.status)
            setIsAdmin(currentUser.role === 'admin')
          } else {
            setUserStatus(null)
            setIsAdmin(false)
          }
        }
      }
    } catch (err) {
      console.error('Error cargando la crew:', err.message)
    } finally {
      setLoading(false)
    }
  }, [crewName, session])

  useEffect(() => {
    if (crewName) fetchCrewData()
  }, [crewName, fetchCrewData])

  const handleJoinRequest = async () => {
    if (!session) return navigate('/login')
    try {
      await supabase.from('crew_members').insert({
        crew_id: crew.id,
        user_id: session.user.id,
        status: 'pending',
      })
      toast.current.show({ severity: 'success', summary: 'Solicitud enviada' })
      fetchCrewData()
    } catch (err) {
      console.error(err)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Ya has solicitado unirte.',
      })
    }
  }

  const handleActionRequest = async (requestId, action) => {
    try {
      if (action === 'approve') {
        const { error } = await supabase
          .from('crew_members')
          .update({ status: 'approved' })
          .eq('id', requestId)

        if (error) throw error
        toast.current.show({
          severity: 'success',
          summary: 'Aceptado',
          detail: 'Nuevo miembro en el club',
        })
      } else {
        const { error } = await supabase
          .from('crew_members')
          .delete()
          .eq('id', requestId)

        if (error) throw error
        toast.current.show({
          severity: 'info',
          summary: 'Rechazado',
          detail: 'Petición eliminada',
        })
      }
      // Recargamos los datos sin refrescar la página completa
      fetchCrewData()
    } catch (err) {
      console.error('Error de permisos:', err.message)
      toast.current.show({
        severity: 'error',
        summary: 'Error de permisos',
        detail: 'No tienes permiso para gestionar esta crew',
      })
    }
  }

  if (loading)
    return (
      <div className='flex justify-content-center p-8'>
        <ProgressSpinner />
      </div>
    )
  if (!crew) return <div className='text-center p-8'>Crew no encontrada.</div>

  return (
    <PageTransition>
      <div className='min-h-screen bg-gray-50 pb-8'>
        <Toast ref={toast} />

        {/* BANNER */}
        <div className='relative w-full h-15rem md:h-20rem bg-gray-900 overflow-hidden'>
          {crew.banner_image_url ? (
            <img
              src={crew.banner_image_url}
              className='w-full h-full object-cover opacity-60'
              alt='Banner'
            />
          ) : (
            <div className='w-full h-full bg-gradient-to-r from-blue-700 to-indigo-900' />
          )}
          <div className='absolute top-0 left-0 p-4'>
            <button
              className='w-3rem h-3rem border-circle bg-white shadow-3 flex align-items-center justify-content-center border-none cursor-pointer'
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} className='text-900' />
            </button>
          </div>
        </div>

        {/* INFO PRINCIPAL */}
        <div className='max-w-7xl mx-auto px-4 -mt-6rem relative z-2'>
          <div className='bg-white border-round-3xl shadow-3 p-4 md:p-6 border-1 border-100'>
            <div className='flex flex-column md:flex-row align-items-center gap-5 text-center md:text-left'>
              <div className='bg-white p-2 border-round-2xl shadow-2 -mt-8rem md:mt-0 flex align-items-center justify-content-center overflow-hidden w-10rem h-10rem'>
                {crew.profile_image_url ? (
                  <img
                    src={crew.profile_image_url}
                    className='w-full h-full object-cover border-round-xl'
                    alt='Logo'
                  />
                ) : (
                  <Shield size={60} className='text-400' />
                )}
              </div>

              <div className='flex-1'>
                <div className='flex align-items-center justify-content-center md:justify-content-start gap-3 flex-wrap'>
                  <h1 className='text-4xl font-black text-900 m-0'>
                    {crew.name}
                  </h1>
                  {isAdmin && (
                    <Tag
                      value='Eres Admin'
                      severity='info'
                      className='font-bold px-3 py-1 border-round-lg'
                    />
                  )}
                </div>
                <p className='text-600 text-lg font-medium mt-2 mb-4'>
                  {crew.description || 'Club de aficionados al motor.'}
                </p>

                {!userStatus ? (
                  <button
                    className='px-6 py-3 border-none font-bold text-white border-round-xl cursor-pointer shadow-2'
                    style={{ backgroundColor: '#2563eb' }}
                    onClick={handleJoinRequest}
                  >
                    Solicitar unirme
                  </button>
                ) : userStatus === 'pending' ? (
                  <div className='inline-flex align-items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 border-1 border-yellow-200 border-round-xl font-bold'>
                    <Calendar size={18} /> Solicitud pendiente
                  </div>
                ) : (
                  <div className='flex gap-2 align-items-center text-green-600 font-bold bg-green-50 px-4 py-2 border-round-xl w-max mx-auto md:mx-0'>
                    <Check size={20} /> Miembro oficial
                  </div>
                )}
              </div>

              <div className='flex gap-4 text-center border-left-1 border-100 pl-5 hidden md:flex'>
                <div>
                  <div className='text-3xl font-black text-900'>
                    {members.length}
                  </div>
                  <div className='text-xs font-bold text-500 uppercase'>
                    Miembros
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL ADMIN: PETICIONES PENDIENTES */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className='mt-8 p-5 bg-blue-50 border-round-3xl border-1 border-blue-100'>
                <h3 className='text-blue-900 font-black text-xl mb-4 flex align-items-center gap-3'>
                  <UserPlus size={24} /> Peticiones pendientes (
                  {pendingRequests.length})
                </h3>
                <div className='grid'>
                  {pendingRequests.map((req) => (
                    <div key={req.id} className='col-12 md:col-6 lg:col-4 p-2'>
                      <div className='bg-white p-3 border-round-2xl shadow-1 flex align-items-center justify-content-between border-1 border-blue-200'>
                        <div
                          className='flex align-items-center gap-3 cursor-pointer'
                          onClick={() =>
                            navigate(`/usuario/${req.profiles.username}`)
                          }
                        >
                          <Avatar
                            image={req.profiles.avatar_url}
                            shape='circle'
                            className='border-1 border-200'
                          />
                          <span className='font-bold text-900 hover:text-blue-600 transition-colors'>
                            {req.profiles.username}
                          </span>
                        </div>
                        <div className='flex gap-2'>
                          <button
                            type='button'
                            onClick={() =>
                              handleActionRequest(req.id, 'approve')
                            }
                            className='w-2rem h-2rem border-circle flex align-items-center justify-content-center cursor-pointer shadow-1 border-none transition-transform hover:scale-110 active:scale-95'
                            style={{
                              backgroundColor: '#10b981',
                              color: 'white',
                            }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type='button'
                            onClick={() =>
                              handleActionRequest(req.id, 'reject')
                            }
                            className='w-2rem h-2rem border-circle flex align-items-center justify-content-center cursor-pointer shadow-1 border-none transition-transform hover:scale-110 active:scale-95'
                            style={{
                              backgroundColor: '#ef4444',
                              color: 'white',
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LISTA DE MIEMBROS */}
            <div className='mt-8'>
              <h2 className='text-2xl font-black text-900 mb-5 flex align-items-center gap-3'>
                <Users className='text-blue-600' /> Miembros del Club
              </h2>
              <div className='grid m-0'>
                {members.map((m) => (
                  <div
                    key={m.id}
                    className='col-12 sm:col-6 md:col-4 lg:col-3 p-2'
                  >
                    <div
                      className='bg-white border-1 border-100 p-3 border-round-2xl flex align-items-center gap-3 cursor-pointer hover:shadow-2 transition-all'
                      onClick={() =>
                        navigate(`/usuario/${m.profiles.username}`)
                      }
                    >
                      <Avatar
                        image={m.profiles.avatar_url}
                        shape='circle'
                        size='large'
                        className='shadow-1 flex-shrink-0'
                      />
                      <div className='overflow-hidden'>
                        <div className='font-bold text-900 line-clamp-1'>
                          {m.profiles.username}
                        </div>
                        <div className='text-xs text-500 font-bold uppercase'>
                          {m.role === 'admin' ? 'Fundador' : 'Miembro'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VEHÍCULOS DE LA CREW */}
            <div className='mt-8'>
              <h2 className='text-2xl font-black text-900 mb-5 flex align-items-center gap-3'>
                <Car className='text-blue-600' /> Vehículos de nuestra Crew
              </h2>
              <div className='grid m-0'>
                {crewVehicles.length > 0 ? (
                  crewVehicles.map((v) => (
                    <div
                      key={v.id}
                      className='col-12 sm:col-6 md:col-4 lg:col-3 p-2'
                    >
                      <div className='bg-white border-1 border-100 border-round-2xl overflow-hidden shadow-1 hover:shadow-3 transition-all'>
                        <div className='h-10rem w-full bg-gray-100 relative'>
                          <img
                            src={v.image_url}
                            className='w-full h-full object-cover'
                            alt={v.make}
                          />
                          <div className='absolute bottom-0 right-0 p-2'>
                            <Tag
                              value={v.fuel_type}
                              severity='secondary'
                              className='opacity-90'
                            />
                          </div>
                        </div>
                        <div className='p-3'>
                          <div className='font-black text-900 text-lg uppercase line-clamp-1'>
                            {v.make} {v.model}
                          </div>
                          <div className='text-500 text-sm font-bold'>
                            Propietario: {v.owner}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='col-12 text-center p-5 text-500 font-bold'>
                    Aún no hay vehículos registrados en esta Crew.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default CrewDetailPage
