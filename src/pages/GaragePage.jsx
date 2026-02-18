import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { SelectButton } from 'primereact/selectbutton' // Nuevo componente
import { Toast } from 'primereact/toast'
import PageTransition from '../components/PageTransition'

import './GaragePage.css'

const GaragePage = ({ session }) => {
  const toast = useRef(null)
  const [vehicles, setVehicles] = useState([])
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  // --- ESTADOS PARA LA API DE COCHES ---
  const [vehicleType, setVehicleType] = useState('car') // 'car' o 'motorcycle'
  const [makes, setMakes] = useState([]) // Lista de Marcas
  const [models, setModels] = useState([]) // Lista de Modelos
  const [loadingAPI, setLoadingAPI] = useState(false) // Carga de datos API

  // Estado para editar o crear
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    marca: '',
    modelo: '',
    cv: null,
    anio: null,
    combustible: '',
    descripcion: '',
    image_url: null,
  })
  const [imageFile, setImageFile] = useState(null)

  const fuelOptions = [
    { label: 'Gasolina', value: 'Gasolina' },
    { label: 'Diésel', value: 'Diésel' },
    { label: 'Híbrido', value: 'Híbrido' },
    { label: 'Eléctrico', value: 'Eléctrico' },
  ]

  const typeOptions = [
    { label: 'Coche', value: 'passenger car' }, // Valor que pide la API
    { label: 'Moto', value: 'motorcycle' },
  ]

  // --- EFECTOS ---

  useEffect(() => {
    if (session) fetchVehicles()
  }, [session])

  // 1. Cuando cambia el tipo de vehículo, buscamos las MARCAS
  useEffect(() => {
    if (showDialog) {
      fetchMakes(vehicleType)
    }
  }, [vehicleType, showDialog])

  // 2. Cuando cambia la MARCA seleccionada, buscamos los MODELOS
  useEffect(() => {
    if (form.marca && showDialog) {
      fetchModels(form.marca, vehicleType)
    } else {
      setModels([])
    }
  }, [form.marca, vehicleType, showDialog])

  // --- FUNCIONES API NHTSA ---

  const fetchMakes = async (type) => {
    setLoadingAPI(true)
    try {
      // API Gratuita del gobierno de US (NHTSA)
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${type}?format=json`,
      )
      const data = await response.json()
      // Formateamos para el Dropdown de PrimeReact
      const formattedMakes = data.Results.map((item) => ({
        label: item.MakeName.trim(),
        value: item.MakeName.trim(),
      })).sort((a, b) => a.label.localeCompare(b.label))

      setMakes(formattedMakes)
    } catch (error) {
      console.error('Error fetching makes:', error)
    } finally {
      setLoadingAPI(false)
    }
  }

  const fetchModels = async (make, type) => {
    // Si la marca no está en la lista (es custom), no llamamos a la API
    if (!makes.find((m) => m.value.toLowerCase() === make.toLowerCase())) return

    setLoadingAPI(true)
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/vehicleType/${type}?format=json`,
      )
      const data = await response.json()
      // Filtramos duplicados y formateamos
      const uniqueModels = [
        ...new Set(data.Results.map((item) => item.Model_Name.trim())),
      ]
      const formattedModels = uniqueModels
        .map((model) => ({ label: model, value: model }))
        .sort((a, b) => a.label.localeCompare(b.label))

      setModels(formattedModels)
    } catch (error) {
      console.error('Error fetching models:', error)
    } finally {
      setLoadingAPI(false)
    }
  }

  // --- CRUD DB ---

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setVehicles(data)
  }

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
    setVehicleType('passenger car') // Reset a coche por defecto
    setEditingId(null)
    setImageFile(null)
    setShowDialog(true)
  }

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
    // Intentamos adivinar el tipo para la edición, o lo dejamos en coche por defecto
    // (Idealmente deberías guardar el 'tipo' en la base de datos también)
    setVehicleType('passenger car')
    setEditingId(car.id)
    setImageFile(null)
    setShowDialog(true)
  }

  const handleUpload = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}/${Math.random()}.${fileExt}`
    const filePath = `${fileName}`

    // NOTA: Asegúrate de que tu bucket se llame igual aquí ('vehicle-images' o 'vehicles')
    const { error: uploadError } = await supabase.storage
      .from('vehicles')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('vehicles').getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    if (!form.marca || !form.modelo) return
    setLoading(true)
    try {
      let finalImageUrl = form.image_url

      if (imageFile) {
        finalImageUrl = await handleUpload(imageFile)
      }

      const vehicleData = {
        ...form,
        image_url: finalImageUrl,
        // Si tienes una columna 'tipo' en Supabase, añade: tipo: vehicleType
      }

      if (editingId) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingId)
        if (error) throw error
        toast.current.show({
          severity: 'info',
          summary: 'Actualizado',
          detail: 'Vehículo modificado correctamente',
        })
      } else {
        const { error } = await supabase.from('vehicles').insert({
          user_id: session.user.id,
          ...vehicleData,
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
        detail: 'No se pudo guardar',
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

  // ... (El carTemplate se mantiene igual que tu código original)
  const carTemplate = (car) => {
    const header = (
      <div className='garage-image-container'>
        {car.image_url ? (
          <img alt={car.marca} src={car.image_url} className='garage-image' />
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
            <Button
              icon='pi pi-pencil'
              className='garage-btn edit'
              onClick={() => openEdit(car)}
            />
            <Button
              icon='pi pi-trash'
              className='garage-btn delete'
              onClick={() => handleDelete(car.id)}
            />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <PageTransition>
      <div className='p-4 md:p-6 max-w-7xl mx-auto min-h-screen'>
        <Toast ref={toast} />

        {/* Cabecera */}
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

        {/* Grid de vehículos */}
        {vehicles.length === 0 ? (
          <div className='garage-empty'>
            {/* ... Tu código de empty state ... */}
            <p className='text-center text-500'>No hay vehículos.</p>
          </div>
        ) : (
          <div className='garage-grid'>
            {vehicles.map((car) => (
              <div key={car.id}>{carTemplate(car)}</div>
            ))}
          </div>
        )}

        {/* DIÁLOGO DE EDICIÓN / CREACIÓN */}
        <Dialog
          header={editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
          visible={showDialog}
          style={{ width: '90vw', maxWidth: '500px' }}
          onHide={() => setShowDialog(false)}
          className='p-fluid'
        >
          <div className='flex flex-column gap-4 pt-2'>
            {/* 1. SELECCIÓN DE TIPO (COCHE O MOTO) */}
            <div className='flex justify-content-center'>
              <SelectButton
                value={vehicleType}
                onChange={(e) => {
                  if (e.value) {
                    // Prevenir deselección
                    setVehicleType(e.value)
                    setForm({ ...form, marca: '', modelo: '' }) // Reseteamos marca al cambiar tipo
                  }
                }}
                options={typeOptions}
                className='w-full'
                itemTemplate={(option) => (
                  <div className='font-bold w-full text-center'>
                    {option.label}
                  </div>
                )}
              />
            </div>

            <div className='flex gap-3 flex-column md:flex-row'>
              {/* 2. MARCA (Dropdown con filtro y editable) */}
              <div className='flex-1'>
                <span className='p-float-label'>
                  <Dropdown
                    id='marca'
                    value={form.marca}
                    onChange={(e) => {
                      setForm({ ...form, marca: e.value, modelo: '' }) // Reset modelo al cambiar marca
                    }}
                    options={makes}
                    filter
                    editable // <--- ESTO PERMITE ESCRIBIR SI NO ESTÁ EN LA LISTA
                    placeholder='Selecciona o escribe'
                    disabled={loadingAPI}
                  />
                  <label htmlFor='marca'>Marca</label>
                </span>
              </div>

              {/* 3. MODELO (Dropdown con filtro y editable) */}
              <div className='flex-1'>
                <span className='p-float-label'>
                  <Dropdown
                    id='modelo'
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.value })}
                    options={models}
                    filter
                    editable // <--- ESTO PERMITE ESCRIBIR SI NO ESTÁ EN LA LISTA
                    placeholder='Selecciona o escribe'
                    disabled={!form.marca || loadingAPI}
                  />
                  <label htmlFor='modelo'>Modelo</label>
                </span>
              </div>
            </div>

            {/* Resto del formulario (CV, Año, etc) */}
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

            {/* Subida de Imagen */}
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
    </PageTransition>
  )
}

export default GaragePage
