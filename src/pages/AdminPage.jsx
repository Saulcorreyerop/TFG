import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { confirmDialog } from 'primereact/confirmdialog' // Ya NO importamos el componente, solo la función
import { TabView, TabPanel } from 'primereact/tabview'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ShieldAlert, Trash2, ExternalLink, Shield, UserX } from 'lucide-react'
import PageTransition from '../components/PageTransition'

const AdminPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [vehicles, setVehicles] = useState([])

  // EL useEffect DEFINITIVO Y SIN ERRORES
  useEffect(() => {
    let isMounted = true

    const initializeAdmin = async () => {
      if (!session?.user?.id) {
        navigate('/')
        return
      }

      // 1. Comprobar si es Admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (!profile?.is_admin) {
        navigate('/')
        return
      }

      if (isMounted) setIsAdmin(true)

      // 2. Descargar todos los datos a la vez (Mucho más rápido)
      const [usersRes, eventsRes, vehiclesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*, profiles(username)')
          .order('fecha', { ascending: false }),
        supabase
          .from('vehicles')
          .select('*, profiles(username)')
          .order('created_at', { ascending: false }),
      ])

      if (isMounted) {
        if (usersRes.data) setUsers(usersRes.data)
        if (eventsRes.data) setEvents(eventsRes.data)
        if (vehiclesRes.data) setVehicles(vehiclesRes.data)
        setLoading(false)
      }
    }

    initializeAdmin()

    return () => {
      isMounted = false // Evita errores si cambias de página rápido
    }
  }, [session, navigate])

  // --- FUNCIONES DE BORRADO Y GESTIÓN ---
  const handleDeleteEvent = (id) => {
    confirmDialog({
      message: '¿Estás seguro de que quieres borrar este evento para siempre?',
      header: 'Confirmar Borrado',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        const { error } = await supabase.from('events').delete().eq('id', id)
        if (error) {
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
          })
        } else {
          toast.current.show({
            severity: 'success',
            summary: 'Borrado',
            detail: 'Evento eliminado',
          })
          setEvents((prev) => prev.filter((e) => e.id !== id))
        }
      },
    })
  }

  const handleDeleteVehicle = (id) => {
    confirmDialog({
      message:
        '¿Estás seguro de borrar este vehículo? Se perderán sus fotos y likes.',
      header: 'Confirmar Borrado',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        const { error } = await supabase.from('vehicles').delete().eq('id', id)
        if (error) {
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
          })
        } else {
          toast.current.show({
            severity: 'success',
            summary: 'Borrado',
            detail: 'Vehículo eliminado',
          })
          setVehicles((prev) => prev.filter((v) => v.id !== id))
        }
      },
    })
  }

  const handleToggleAdmin = async (user) => {
    const newAdminStatus = !user.is_admin
    const accion = newAdminStatus
      ? 'ascender a Administrador'
      : 'quitar el rango de Administrador'

    confirmDialog({
      message: `¿Estás seguro de que quieres ${accion} a ${user.username}?`,
      header: 'Gestionar Permisos',
      icon: 'pi pi-shield',
      acceptClassName: newAdminStatus ? 'p-button-success' : 'p-button-warning',
      accept: async () => {
        const { error } = await supabase
          .from('profiles')
          .update({ is_admin: newAdminStatus })
          .eq('id', user.id)
        if (error) {
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
          })
        } else {
          toast.current.show({
            severity: 'success',
            summary: 'Actualizado',
            detail: `Permisos de ${user.username} actualizados`,
          })
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id ? { ...u, is_admin: newAdminStatus } : u,
            ),
          )
        }
      },
    })
  }

  const handleDeleteUser = (user) => {
    confirmDialog({
      message: `¿Borrar el perfil de ${user.username} de la app? Sus coches y eventos desaparecerán.`,
      header: 'Eliminar Usuario',
      icon: 'pi pi-user-minus',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', user.id)
        if (error) {
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
          })
        } else {
          toast.current.show({
            severity: 'success',
            summary: 'Borrado',
            detail: 'Perfil de usuario eliminado',
          })
          setUsers((prev) => prev.filter((u) => u.id !== user.id))
        }
      },
    })
  }

  // --- TEMPLATES PARA LAS TABLAS ---
  const actionEventTemplate = (rowData) => (
    <div className='flex gap-2'>
      <Button
        icon={<ExternalLink size={16} />}
        rounded
        text
        severity='info'
        onClick={() => navigate(`/evento/${rowData.id}`)}
        tooltip='Ver'
      />
      <Button
        icon={<Trash2 size={16} />}
        rounded
        text
        severity='danger'
        onClick={() => handleDeleteEvent(rowData.id)}
        tooltip='Borrar'
      />
    </div>
  )

  const actionVehicleTemplate = (rowData) => (
    <div className='flex gap-2'>
      <Button
        icon={<ExternalLink size={16} />}
        rounded
        text
        severity='info'
        onClick={() => navigate(`/usuario/${rowData.profiles?.username}`)}
        tooltip='Ver Dueño'
      />
      <Button
        icon={<Trash2 size={16} />}
        rounded
        text
        severity='danger'
        onClick={() => handleDeleteVehicle(rowData.id)}
        tooltip='Borrar'
      />
    </div>
  )

  const actionUserTemplate = (rowData) => (
    <div className='flex gap-2'>
      <Button
        icon={<ExternalLink size={16} />}
        rounded
        text
        severity='info'
        onClick={() => navigate(`/usuario/${rowData.username}`)}
        tooltip='Ver Perfil'
      />
      <Button
        icon={<Shield size={16} />}
        rounded
        text
        severity={rowData.is_admin ? 'success' : 'secondary'}
        onClick={() => handleToggleAdmin(rowData)}
        tooltip={rowData.is_admin ? 'Quitar Admin' : 'Hacer Admin'}
      />
      {session.user.id !== rowData.id && (
        <Button
          icon={<UserX size={16} />}
          rounded
          text
          severity='danger'
          onClick={() => handleDeleteUser(rowData)}
          tooltip='Borrar Perfil'
        />
      )}
    </div>
  )

  const imageTemplate = (rowData) =>
    rowData.image_url ? (
      <img
        src={rowData.image_url}
        alt='img'
        style={{
          width: '50px',
          height: '50px',
          objectFit: 'cover',
          borderRadius: '8px',
        }}
      />
    ) : (
      <span>Sin foto</span>
    )

  if (loading)
    return (
      <div className='flex justify-content-center p-8'>
        <ProgressSpinner />
      </div>
    )
  if (!isAdmin) return null

  return (
    <PageTransition>
      <div className='min-h-screen bg-gray-50 p-4 md:p-6'>
        <Toast ref={toast} />
        {/* HEMOS ELIMINADO EL <ConfirmDialog /> de aquí para evitar que salga doble */}

        <div className='max-w-7xl mx-auto'>
          <div className='flex align-items-center gap-3 mb-5 bg-black text-white p-4 border-round-2xl shadow-4'>
            <div className='bg-red-500 p-3 border-circle text-white shadow-2'>
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className='m-0 text-3xl font-black'>Panel de Moderación</h1>
              <p className='m-0 text-gray-400 font-medium'>
                Modo Administrador activado. Ten cuidado con lo que borras.
              </p>
            </div>
          </div>

          <div className='card bg-white p-4 border-round-2xl shadow-2'>
            <TabView>
              <TabPanel header='Eventos' leftIcon='pi pi-calendar mr-2'>
                <DataTable
                  value={events}
                  paginator
                  rows={10}
                  dataKey='id'
                  emptyMessage='No hay eventos.'
                  className='p-datatable-sm'
                >
                  <Column field='titulo' header='Título' sortable></Column>
                  <Column
                    field='profiles.username'
                    header='Organizador'
                    sortable
                  ></Column>
                  <Column field='tipo' header='Categoría' sortable></Column>
                  <Column
                    field='fecha'
                    header='Fecha'
                    body={(r) => new Date(r.fecha).toLocaleDateString()}
                    sortable
                  ></Column>
                  <Column
                    body={actionEventTemplate}
                    header='Acciones'
                    exportable={false}
                    style={{ minWidth: '8rem' }}
                  ></Column>
                </DataTable>
              </TabPanel>

              <TabPanel header='Vehículos' leftIcon='pi pi-car mr-2'>
                <DataTable
                  value={vehicles}
                  paginator
                  rows={10}
                  dataKey='id'
                  emptyMessage='No hay vehículos.'
                  className='p-datatable-sm'
                >
                  <Column body={imageTemplate} header='Foto'></Column>
                  <Column field='marca' header='Marca' sortable></Column>
                  <Column field='modelo' header='Modelo' sortable></Column>
                  <Column
                    field='profiles.username'
                    header='Dueño'
                    sortable
                  ></Column>
                  <Column
                    body={actionVehicleTemplate}
                    header='Acciones'
                    exportable={false}
                    style={{ minWidth: '8rem' }}
                  ></Column>
                </DataTable>
              </TabPanel>

              <TabPanel
                header='Usuarios Registrados'
                leftIcon='pi pi-users mr-2'
              >
                <DataTable
                  value={users}
                  paginator
                  rows={10}
                  dataKey='id'
                  emptyMessage='No hay usuarios.'
                  className='p-datatable-sm'
                >
                  <Column field='username' header='Usuario' sortable></Column>
                  <Column field='email' header='Email' sortable></Column>
                  <Column
                    field='is_admin'
                    header='Rol'
                    body={(r) =>
                      r.is_admin ? (
                        <span className='text-red-500 font-bold'>Admin</span>
                      ) : (
                        'Usuario'
                      )
                    }
                    sortable
                  ></Column>
                  <Column
                    body={actionUserTemplate}
                    header='Acciones'
                    exportable={false}
                    style={{ minWidth: '10rem' }}
                  ></Column>
                </DataTable>
              </TabPanel>
            </TabView>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default AdminPage
