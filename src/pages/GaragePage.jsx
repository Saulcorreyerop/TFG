import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { SelectButton } from 'primereact/selectbutton'
import { Toast } from 'primereact/toast'
import { Galleria } from 'primereact/galleria'
import PageTransition from '../components/PageTransition'
import imageCompression from 'browser-image-compression'

import './GaragePage.css'

import SEO from '../components/SEO'

const GaragePage = ({ session }) => {
  const toast = useRef(null)
  const [vehicles, setVehicles] = useState([])
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  const [vehicleType, setVehicleType] = useState('car')
  const [makes, setMakes] = useState([])
  const [models, setModels] = useState([])
  const [loadingAPI, setLoadingAPI] = useState(false)

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

  // --- ESTADOS PARA LA GALERÍA MÚLTIPLE ---
  const [extraImageFiles, setExtraImageFiles] = useState([])
  const [existingExtraImages, setExistingExtraImages] = useState([])
  const [galleryImages, setGalleryImages] = useState(null)

  const fuelOptions = [
    { label: 'Gasolina', value: 'Gasolina' },
    { label: 'Diésel', value: 'Diésel' },
    { label: 'Híbrido', value: 'Híbrido' },
    { label: 'Eléctrico', value: 'Eléctrico' },
  ]

  const typeOptions = [
    { label: 'Coche', value: 'passenger car' },
    { label: 'Moto', value: 'motorcycle' },
  ]

  useEffect(() => {
    if (session) fetchVehicles()
  }, [session])

  useEffect(() => {
    if (showDialog) fetchMakes(vehicleType)
  }, [vehicleType, showDialog])

  useEffect(() => {
    if (form.marca && showDialog) {
      fetchModels(form.marca, vehicleType)
    } else {
      setModels([])
    }
  }, [form.marca, vehicleType, showDialog])

  const fetchMakes = async (type) => {
    setLoadingAPI(true)
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${type}?format=json`,
      )
      const data = await response.json()
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
    if (!makes.find((m) => m.value.toLowerCase() === make.toLowerCase())) return
    setLoadingAPI(true)
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/vehicleType/${type}?format=json`,
      )
      const data = await response.json()
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

  const fetchVehicles = async () => {
    // AHORA TAMBIÉN PEDIMOS vehicle_images
    const { data } = await supabase
      .from('vehicles')
      .select('*, vehicle_images(*)')
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
    setVehicleType('passenger car')
    setEditingId(null)
    setImageFile(null)
    setExtraImageFiles([])
    setExistingExtraImages([])
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
    setVehicleType('passenger car')
    setEditingId(car.id)
    setImageFile(null)
    setExtraImageFiles([])
    setExistingExtraImages(car.vehicle_images || [])
    setShowDialog(true)
  }

  // --- LÓGICA DE SUBIDA DE IMÁGENES ---
  const handleUploadSingleFile = async (file, isMain = true, index = 0) => {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8,
    }
    const compressedFile = await imageCompression(file, options)
    const fileName = isMain
      ? `${session.user.id}/main-${Date.now()}.webp`
      : `${session.user.id}/gallery-${Date.now()}-${index}.webp`

    const { error: uploadError } = await supabase.storage
      .from('vehicles')
      .upload(fileName, compressedFile, { contentType: 'image/webp' })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('vehicles').getPublicUrl(fileName)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    if (!form.marca || !form.modelo) {
      toast.current.show({
        severity: 'warn',
        summary: 'Aviso',
        detail: 'La marca y el modelo son obligatorios.',
      })
      return
    }

    setLoading(true)
    try {
      let finalImageUrl = form.image_url

      // 1. Subir imagen principal
      if (imageFile) {
        toast.current.show({
          severity: 'info',
          summary: 'Optimizando',
          detail: 'Subiendo imagen principal...',
          life: 2000,
        })
        finalImageUrl = await handleUploadSingleFile(imageFile, true)
      }

      const vehicleData = { ...form, image_url: finalImageUrl }
      let currentVehicleId = editingId

      // 2. Guardar datos del vehículo (Insert o Update blindado)
      if (editingId) {
        const { error: updateError } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingId)
        if (updateError) throw updateError
      } else {
        // Le quitamos el .single() que a veces da fallos de RLS y sacamos el ID del array
        const { data: newVehicle, error: insertError } = await supabase
          .from('vehicles')
          .insert({ user_id: session.user.id, ...vehicleData })
          .select()
        if (insertError) throw insertError
        if (newVehicle && newVehicle.length > 0) {
          currentVehicleId = newVehicle[0].id
        } else {
          throw new Error(
            'El vehículo se guardó pero no se pudo obtener su ID para la galería.',
          )
        }
      }

      // 3. Subir las imágenes extra de la galería
      if (extraImageFiles.length > 0 && currentVehicleId) {
        toast.current.show({
          severity: 'info',
          summary: 'Galería',
          detail: 'Subiendo fotos adicionales...',
          life: 2000,
        })
        for (let i = 0; i < extraImageFiles.length; i++) {
          const url = await handleUploadSingleFile(extraImageFiles[i], false, i)
          const { error: extraImgError } = await supabase
            .from('vehicle_images')
            .insert({ vehicle_id: currentVehicleId, image_url: url })
          if (extraImgError)
            console.error('Fallo subiendo extra:', extraImgError)
        }
      }

      toast.current.show({
        severity: 'success',
        summary: 'Guardado',
        detail: 'Vehículo guardado correctamente',
      })
      setShowDialog(false)
      fetchVehicles()
    } catch (error) {
      console.error('Error detallado:', error)
      // Si falla, ahora mostrará el error exacto de Supabase en rojo
      toast.current.show({
        severity: 'error',
        summary: 'Error al guardar',
        detail: error.message || 'Error desconocido',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (!error) {
      toast.current.show({
        severity: 'success',
        summary: 'Eliminado',
        detail: 'Vehículo eliminado',
      })
      fetchVehicles()
    }
  }

  // --- LÓGICA DE MANEJO DE PREVISUALIZACIONES DE GALERÍA ---
  const handleExtraImagesChange = (e) => {
    const files = Array.from(e.target.files)
    setExtraImageFiles((prev) => [...prev, ...files])
  }

  const removeExtraFile = (index) => {
    setExtraImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeExistingImage = async (imgId) => {
    try {
      await supabase.from('vehicle_images').delete().eq('id', imgId)
      setExistingExtraImages((prev) => prev.filter((img) => img.id !== imgId))
      toast.current.show({
        severity: 'success',
        summary: 'Borrada',
        detail: 'Foto eliminada',
        life: 1500,
      })
      fetchVehicles()
    } catch (err) {
      console.error(err)
    }
  }

  // --- VISOR DE GALERÍA (GALLERIA) ---
  const openGalleryViewer = (car) => {
    const images = []
    if (car.image_url)
      images.push({
        itemImageSrc: car.image_url,
        thumbnailImageSrc: car.image_url,
        alt: 'Principal',
      })
    if (car.vehicle_images && car.vehicle_images.length > 0) {
      car.vehicle_images.forEach((img) => {
        images.push({
          itemImageSrc: img.image_url,
          thumbnailImageSrc: img.image_url,
          alt: 'Detalle',
        })
      })
    }
    if (images.length > 0) setGalleryImages(images)
  }

  const galleryItemTemplate = (item) => {
    return (
      <img
        src={item.itemImageSrc}
        alt={item.alt}
        style={{
          width: '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    )
  }

  const galleryThumbnailTemplate = (item) => {
    return (
      <img
        src={item.thumbnailImageSrc}
        alt={item.alt}
        style={{
          width: '100%',
          height: '80px',
          objectFit: 'cover',
          display: 'block',
          borderRadius: '4px',
        }}
      />
    )
  }

  // --- PLANTILLA DE LA TARJETA DEL COCHE ---
  const carTemplate = (car) => {
    const totalImages =
      (car.image_url ? 1 : 0) +
      (car.vehicle_images ? car.vehicle_images.length : 0)

    const header = (
      <div
        className='garage-image-container cursor-pointer'
        onClick={() => openGalleryViewer(car)}
      >
        {car.image_url ? (
          <img alt={car.marca} src={car.image_url} className='garage-image' />
        ) : (
          <div className='garage-no-image'>
            <i className='pi pi-car text-6xl'></i>
          </div>
        )}
        <div className='garage-badge'>{car.combustible}</div>

        {/* INDICADOR DE FOTOS */}
        {totalImages > 1 && (
          <div className='gallery-indicator-badge'>
            <i className='pi pi-images'></i> 1/{totalImages}
          </div>
        )}
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
    <>
      <SEO
        title='Mi Garaje'
        description='Gestiona tus vehículos, añade especificaciones y guarda el historial de modificaciones de tus coches en CarMeet ESP.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='p-4 md:p-6 max-w-7xl mx-auto min-h-screen'>
          <Toast ref={toast} />

          {/* VISOR DE GALERÍA PANTALLA COMPLETA */}
          <Dialog
            visible={!!galleryImages}
            onHide={() => setGalleryImages(null)}
            header='Galería del Vehículo'
            style={{ width: '90vw', maxWidth: '800px' }}
            dismissableMask
          >
            {galleryImages && (
              <Galleria
                value={galleryImages}
                numVisible={5}
                circular
                autoPlay
                transitionInterval={3000}
                item={galleryItemTemplate}
                thumbnail={galleryThumbnailTemplate}
                style={{ maxWidth: '100%' }}
              />
            )}
          </Dialog>

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
              <p className='text-center text-500'>No hay vehículos.</p>
            </div>
          ) : (
            <div className='garage-grid'>
              {vehicles.map((car) => (
                <div key={car.id}>{carTemplate(car)}</div>
              ))}
            </div>
          )}

          {/* DIALOG DE CREAR / EDITAR */}
          <Dialog
            header={editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
            visible={showDialog}
            style={{ width: '90vw', maxWidth: '600px' }}
            onHide={() => setShowDialog(false)}
            className='p-fluid'
          >
            <div className='flex flex-column gap-4 pt-2'>
              <div className='flex justify-content-center'>
                <SelectButton
                  value={vehicleType}
                  onChange={(e) => {
                    if (e.value) {
                      setVehicleType(e.value)
                      setForm({ ...form, marca: '', modelo: '' })
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
                <div className='flex-1'>
                  <span className='p-float-label'>
                    <Dropdown
                      id='marca'
                      value={form.marca}
                      onChange={(e) => {
                        setForm({ ...form, marca: e.value, modelo: '' })
                      }}
                      options={makes}
                      filter
                      editable
                      placeholder='Selecciona o escribe'
                      disabled={loadingAPI}
                    />
                    <label htmlFor='marca'>Marca</label>
                  </span>
                </div>
                <div className='flex-1'>
                  <span className='p-float-label'>
                    <Dropdown
                      id='modelo'
                      value={form.modelo}
                      onChange={(e) => setForm({ ...form, modelo: e.value })}
                      options={models}
                      filter
                      editable
                      placeholder='Selecciona o escribe'
                      disabled={!form.marca || loadingAPI}
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

              {/* --- SECCIÓN DE FOTOS --- */}
              <div className='border-top-1 border-300 pt-4 mt-2'>
                <h3 className='text-xl font-bold text-800 m-0 mb-3'>
                  Imágenes del Vehículo
                </h3>

                {/* Foto Principal */}
                <div className='surface-100 p-3 border-round border-1 border-300 border-dashed text-center hover:surface-200 transition-colors cursor-pointer relative mb-4'>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={(e) => setImageFile(e.target.files[0])}
                    className='opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer z-2'
                  />
                  <div className='flex flex-column align-items-center gap-2 pointer-events-none'>
                    <i className='pi pi-camera text-2xl text-600'></i>
                    <span className='text-sm text-700 font-semibold'>
                      {imageFile
                        ? imageFile.name
                        : form.image_url
                          ? 'Cambiar foto principal'
                          : 'Subir Foto principal (Portada)'}
                    </span>
                  </div>
                </div>

                {/* Galería Adicional */}
                <div className='bg-gray-50 border-round-xl p-3 border-1 border-200'>
                  <div className='gallery-upload-zone'>
                    <input
                      type='file'
                      accept='image/*'
                      multiple
                      onChange={handleExtraImagesChange}
                      className='opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer z-2'
                    />
                    <div className='flex flex-column align-items-center gap-1 pointer-events-none'>
                      <i className='pi pi-images text-xl text-blue-500'></i>
                      <span className='text-sm font-bold text-700'>
                        Añadir fotos a la galería
                      </span>
                      <span className='text-xs text-500'>
                        Selecciona varias imágenes a la vez
                      </span>
                    </div>
                  </div>

                  {/* Previsualización de imágenes (Existentes y Nuevas) */}
                  {(existingExtraImages.length > 0 ||
                    extraImageFiles.length > 0) && (
                    <div className='gallery-preview-grid'>
                      {/* Fotos ya guardadas en DB */}
                      {existingExtraImages.map((img) => (
                        <div key={img.id} className='gallery-preview-item'>
                          <img src={img.image_url} alt='Extra guardada' />
                          <button
                            type='button'
                            className='remove-preview-btn'
                            onClick={() => removeExistingImage(img.id)}
                          >
                            <i className='pi pi-times'></i>
                          </button>
                        </div>
                      ))}

                      {/* Fotos nuevas pendientes de subir */}
                      {extraImageFiles.map((file, idx) => (
                        <div key={idx} className='gallery-preview-item'>
                          <img
                            src={URL.createObjectURL(file)}
                            alt='Nueva preview'
                          />
                          <button
                            type='button'
                            className='remove-preview-btn'
                            onClick={() => removeExtraFile(idx)}
                          >
                            <i className='pi pi-times'></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                label={editingId ? 'Guardar Cambios' : 'Guardar Vehículo'}
                icon='pi pi-check'
                severity='help'
                onClick={handleSubmit}
                loading={loading}
                className='mt-4 py-3 font-bold text-lg border-round-xl shadow-2'
              />
            </div>
          </Dialog>
        </div>
      </PageTransition>
    </>
  )
}

export default GaragePage
