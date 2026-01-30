import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'

import './GaragePage.css'

const GaragePage = ({ session }) => {
  const toast = useRef(null)
  const [vehicles, setVehicles] = useState([])
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  // Estado para controlar si estamos editando (ID del coche) o creando (null)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    marca: '',
    modelo: '',
    cv: null,
    anio: null,
    combustible: '',
    descripcion: '',
    image_url: null, // Guardamos la URL actual aquí también
  })
  const [imageFile, setImageFile] = useState(null)

  const fuelOptions = [
    { label: 'Gasolina', value: 'Gasolina' },
    { label: 'Diésel', value: 'Diésel' },
    { label: 'Híbrido', value: 'Híbrido' },
    { label: 'Eléctrico', value: 'Eléctrico' },
  ]

  useEffect(() => {
    if (session) fetchVehicles()
  }, [session])

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setVehicles(data)
  }

  // Abrir diálogo para NUEVO coche
  const openNew = () => {
    setForm({
      marca: '',
      modelo: '',
      cv: null,
      anio: null,
      combustible: '',
      descripcion: '',
      image_url: null,
    })
    setEditingId(null)
    setImageFile(null)
    setShowDialog(true)
  }

  // Abrir diálogo para EDITAR coche
  const openEdit = (car) => {
    setForm({
      marca: car.marca,
      modelo: car.modelo,
      cv: car.cv,
      anio: car.anio,
      combustible: car.combustible,
      descripcion: car.descripcion,
      image_url: car.image_url,
    })
    setEditingId(car.id)
    setImageFile(null)
    setShowDialog(true)
  }

  const handleUpload = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${session.user.id}/${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('vehicle-images')
      .upload(filePath, file)
    if (uploadError) throw uploadError
    const { data } = supabase.storage
      .from('vehicle-images')
      .getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    if (!form.marca || !form.modelo) return
    setLoading(true)
    try {
      let finalImageUrl = form.image_url // Por defecto mantenemos la que había

      // Si el usuario subió una foto nueva, la subimos y actualizamos la URL
      if (imageFile) {
        finalImageUrl = await handleUpload(imageFile)
      }

      if (editingId) {
        // --- MODO EDICIÓN (UPDATE) ---
        const { error } = await supabase
          .from('vehicles')
          .update({
            ...form,
            image_url: finalImageUrl,
          })
          .eq('id', editingId)

        if (error) throw error
        toast.current.show({
          severity: 'info',
          summary: 'Actualizado',
          detail: 'Vehículo modificado correctamente',
        })
      } else {
        // --- MODO CREACIÓN (INSERT) ---
        const { error } = await supabase.from('vehicles').insert({
          user_id: session.user.id,
          ...form,
          image_url: finalImageUrl,
        })

        if (error) throw error
        toast.current.show({
          severity: 'success',
          summary: 'Guardado',
          detail: 'Vehículo añadido al garaje',
        })
      }

      setShowDialog(false)
      fetchVehicles()
    } catch (error) {
      console.error('Error:', error)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar los cambios',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (!error) {
      toast.current.show({
        severity: 'error',
        summary: 'Eliminado',
        detail: 'Vehículo eliminado',
      })
      fetchVehicles()
    }
  }

  const carTemplate = (car) => {
    const header = (
      <div className='garage-image-container'>
        {car.image_url ? (
          <img
            alt={`${car.marca} ${car.modelo}`}
            src={car.image_url}
            className='garage-image'
          />
        ) : (
          <div className='garage-no-image'>
            <i className='pi pi-car text-6xl'></i>
          </div>
        )}
        <div className='garage-badge'>{car.combustible}</div>
      </div>
    )

    return (
      <Card header={header} className='garage-card'>
        <div className='garage-info'>
          <div>
            <h3 className='garage-title'>
              {car.marca} {car.modelo}
            </h3>
            <div className='garage-specs'>
              <i className='pi pi-calendar text-primary'></i>{' '}
              <span>{car.anio}</span>
              <span className='text-300'>|</span>
              <i className='pi pi-bolt text-primary'></i>{' '}
              <span>{car.cv} CV</span>
            </div>
            <div className='garage-divider'></div>
            <p className='garage-desc'>
              {car.descripcion || (
                <span className='font-italic text-400'>Sin descripción.</span>
              )}
            </p>
          </div>

          <div className='garage-actions'>
            {/* Botón Editar */}
            <Button
              icon='pi pi-pencil'
              className='garage-btn edit'
              tooltip='Editar'
              tooltipOptions={{ position: 'top' }}
              onClick={() => openEdit(car)}
            />
            {/* Botón Eliminar */}
            <Button
              icon='pi pi-trash'
              className='garage-btn delete'
              tooltip='Eliminar'
              tooltipOptions={{ position: 'top' }}
              onClick={() => handleDelete(car.id)}
            />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className='p-4 md:p-6 max-w-7xl mx-auto min-h-screen'>
      <Toast ref={toast} />

      <div className='flex flex-column md:flex-row justify-content-between align-items-center mb-6 gap-4'>
        <div>
          <h1 className='text-4xl font-extrabold m-0 text-900 flex align-items-center gap-3'>
            Mi Garaje
          </h1>
          <p className='text-500 mt-2 text-lg'>Tu colección personal</p>
        </div>
        <Button
          label='Añadir Vehículo'
          icon='pi pi-plus'
          severity='help'
          raised
          className='px-4 py-3 border-round-3xl shadow-2'
          onClick={openNew}
        />
      </div>

      {vehicles.length === 0 ? (
        <div className='garage-empty'>
          <div className='bg-purple-50 inline-flex border-circle p-4 mb-4'>
            <i className='pi pi-car text-5xl text-purple-500'></i>
          </div>
          <h2 className='text-2xl font-bold text-800 mb-2'>
            Tu garaje está vacío
          </h2>
          <p className='text-500 mb-4'>
            Empieza a subir tus máquinas para presumir de ellas.
          </p>
          <Button
            label='Añadir coche ahora'
            severity='help'
            onClick={openNew}
          />
        </div>
      ) : (
        <div className='garage-grid'>
          {vehicles.map((car) => (
            <div key={car.id}>{carTemplate(car)}</div>
          ))}
        </div>
      )}

      <Dialog
        header={editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        visible={showDialog}
        style={{ width: '90vw', maxWidth: '500px' }}
        onHide={() => setShowDialog(false)}
        className='p-fluid'
      >
        <div className='flex flex-column gap-4 pt-2'>
          <div className='flex gap-3'>
            <div className='flex-1'>
              <span className='p-float-label'>
                <InputText
                  id='marca'
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
                <label htmlFor='marca'>Marca</label>
              </span>
            </div>
            <div className='flex-1'>
              <span className='p-float-label'>
                <InputText
                  id='modelo'
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                />
                <label htmlFor='modelo'>Modelo</label>
              </span>
            </div>
          </div>
          <div className='flex gap-3'>
            <div className='flex-1'>
              <span className='p-float-label'>
                <InputNumber
                  id='cv'
                  value={form.cv}
                  onValueChange={(e) => setForm({ ...form, cv: e.value })}
                  suffix=' CV'
                />
                <label htmlFor='cv'>Potencia</label>
              </span>
            </div>
            <div className='flex-1'>
              <span className='p-float-label'>
                <InputNumber
                  id='anio'
                  value={form.anio}
                  onValueChange={(e) => setForm({ ...form, anio: e.value })}
                  useGrouping={false}
                />
                <label htmlFor='anio'>Año</label>
              </span>
            </div>
          </div>
          <span className='p-float-label'>
            <Dropdown
              id='fuel'
              value={form.combustible}
              options={fuelOptions}
              onChange={(e) => setForm({ ...form, combustible: e.value })}
            />
            <label htmlFor='fuel'>Combustible</label>
          </span>
          <span className='p-float-label'>
            <InputTextarea
              id='desc'
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              rows={3}
              autoResize
            />
            <label htmlFor='desc'>Modificaciones / Descripción</label>
          </span>
          <div className='surface-100 p-3 border-round border-1 border-300 border-dashed text-center hover:surface-200 transition-colors cursor-pointer relative'>
            <input
              type='file'
              accept='image/*'
              onChange={(e) => setImageFile(e.target.files[0])}
              className='opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer'
            />
            <div className='flex flex-column align-items-center gap-2 pointer-events-none'>
              <i className='pi pi-image text-2xl text-600'></i>
              <span className='text-sm text-700 font-semibold'>
                {imageFile
                  ? imageFile.name
                  : form.image_url
                    ? 'Cambiar foto actual'
                    : 'Subir foto del vehículo'}
              </span>
            </div>
          </div>
          <Button
            label={editingId ? 'Guardar Cambios' : 'Guardar Vehículo'}
            icon='pi pi-check'
            severity='help'
            onClick={handleSubmit}
            loading={loading}
            className='mt-2'
          />
        </div>
      </Dialog>
    </div>
  )
}

export default GaragePage
