import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Arreglo iconos Leaflet (necesario cada vez que usamos mapas)
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// Mini componente para clicks en el mapa interno
function LocationSelector({ setPosicion, cerrarMapa }) {
  useMapEvents({
    click(e) {
      setPosicion(e.latlng)
      cerrarMapa()
    },
  })
  return null
}

const AddEventDialog = ({
  visible,
  onHide,
  onEventAdded,
  session,
  initialLat = null,
  initialLng = null,
}) => {
  const toast = useRef(null)
  const [loading, setLoading] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)

  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
    descripcion: '',
    imagen: null,
    lat: null,
    lng: null,
    direccion: '',
  })

  // Si nos pasan coordenadas desde fuera (ej: click en MapPage), actualizamos el estado
  useEffect(() => {
    if (initialLat && initialLng) {
      setNuevoEvento((prev) => ({ ...prev, lat: initialLat, lng: initialLng }))
    }
  }, [initialLat, initialLng, visible]) // Se ejecuta cuando abrimos el diálogo o cambian las props

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const buscarDireccion = async () => {
    if (!nuevoEvento.direccion) return
    try {
      setLoading(true)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nuevoEvento.direccion)}`,
      )
      const data = await response.json()
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        setNuevoEvento((prev) => ({ ...prev, lat: lat, lng: lon }))
        toast.current.show({
          severity: 'success',
          summary: 'Encontrado',
          detail: 'Ubicación actualizada.',
        })
      } else {
        toast.current.show({
          severity: 'warn',
          summary: 'No encontrada',
          detail: 'Intenta ser más específico.',
        })
      }
      // En AddEventDialog.jsx, dentro de la función buscarDireccion:
    } catch (error) {
      console.error(error) // <--- AÑADE ESTA LÍNEA (así usas la variable y te sirve para depurar)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Fallo al buscar dirección.',
      })
    } finally {
      setLoading(false)
    }
  }

  const uploadImage = async (file) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error(error)
      return null
    }
  }

  const handleSave = async () => {
    if (!session) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Sesión no válida.',
      })
      return
    }
    if (
      !nuevoEvento.titulo ||
      !nuevoEvento.fecha ||
      !nuevoEvento.tipo ||
      !nuevoEvento.lat
    ) {
      toast.current.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Rellena título, fecha, tipo y ubicación.',
      })
      return
    }

    setLoading(true)
    let imageUrl = null

    if (nuevoEvento.imagen) {
      imageUrl = await uploadImage(nuevoEvento.imagen)
      if (!imageUrl) {
        setLoading(false)
        toast.current.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Fallo al subir imagen.',
        })
        return
      }
    }

    const { error } = await supabase.from('events').insert([
      {
        titulo: nuevoEvento.titulo,
        tipo: nuevoEvento.tipo,
        fecha: nuevoEvento.fecha,
        description: nuevoEvento.descripcion,
        image_url: imageUrl,
        lat: nuevoEvento.lat,
        lng: nuevoEvento.lng,
        user_id: session.user.id,
      },
    ])

    setLoading(false)

    if (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    } else {
      toast.current.show({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Evento publicado.',
      })

      // Limpiamos formulario
      setNuevoEvento({
        titulo: '',
        tipo: '',
        fecha: null,
        descripcion: '',
        imagen: null,
        lat: null,
        lng: null,
        direccion: '',
      })

      // Avisamos al padre que recargue y cerramos
      if (onEventAdded) onEventAdded()
      onHide()
    }
  }

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header='Publicar Nuevo Evento'
        visible={visible}
        className='w-11 md:w-30rem'
        onHide={onHide}
        maximizable
      >
        <div className='flex flex-column gap-4 pt-2'>
          <div className='field'>
            <label className='block text-900 font-medium mb-2'>Título *</label>
            <InputText
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full'
              placeholder='Ej: KDD Norte'
            />
          </div>

          <div className='field'>
            <label className='block text-900 font-medium mb-2'>Tipo *</label>
            <Dropdown
              value={nuevoEvento.tipo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, tipo: e.value })
              }
              options={tiposEvento}
              optionLabel='label'
              className='w-full'
              placeholder='Selecciona tipo'
            />
          </div>

          <div className='field'>
            <label className='block text-900 font-medium mb-2'>
              Fecha y Hora *
            </label>
            <Calendar
              value={nuevoEvento.fecha}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, fecha: e.value })
              }
              showTime
              locale='es'
              dateFormat='dd/mm/yy'
              hourFormat='24'
              className='w-full'
            />
          </div>

          {/* SECCIÓN UBICACIÓN */}
          <div className='field surface-100 p-3 border-round'>
            <label className='block text-900 font-bold mb-2'>
              <i className='pi pi-map-marker mr-2 text-blue-600'></i>Ubicación *
            </label>
            <div className='p-inputgroup mb-2'>
              <InputText
                placeholder='Escribe dirección...'
                value={nuevoEvento.direccion}
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, direccion: e.target.value })
                }
              />
              <Button
                icon='pi pi-search'
                severity='secondary'
                onClick={buscarDireccion}
                loading={loading && !nuevoEvento.lat}
                tooltip='Buscar coordenadas'
              />
            </div>

            <Button
              label='Seleccionar en Mapa'
              icon='pi pi-map'
              outlined
              className='w-full mb-3'
              onClick={() => setShowMapModal(true)}
            />

            <div className='flex gap-2'>
              <div className='flex-1'>
                <label className='text-xs'>Latitud</label>
                <InputText
                  value={nuevoEvento.lat || ''}
                  readOnly
                  className='w-full p-inputtext-sm surface-50'
                  placeholder='Lat'
                />
              </div>
              <div className='flex-1'>
                <label className='text-xs'>Longitud</label>
                <InputText
                  value={nuevoEvento.lng || ''}
                  readOnly
                  className='w-full p-inputtext-sm surface-50'
                  placeholder='Lng'
                />
              </div>
            </div>
          </div>

          <div className='field'>
            <label className='block text-900 font-medium mb-2'>
              Imagen (Opcional)
            </label>
            <div className='flex align-items-center gap-3'>
              <label className='p-button p-button-outlined p-button-secondary cursor-pointer'>
                <i className='pi pi-image mr-2'></i>{' '}
                {nuevoEvento.imagen ? 'Imagen Lista' : 'Subir Foto'}{' '}
                <input
                  type='file'
                  accept='image/*'
                  onChange={(e) =>
                    e.target.files[0] &&
                    setNuevoEvento({
                      ...nuevoEvento,
                      imagen: e.target.files[0],
                    })
                  }
                  style={{ display: 'none' }}
                />
              </label>
              {nuevoEvento.imagen && (
                <span className='text-sm text-green-600 font-bold'>
                  <i className='pi pi-check mr-1'></i>
                  {nuevoEvento.imagen.name}
                </span>
              )}
            </div>
          </div>

          <div className='field'>
            <label className='block text-900 font-medium mb-2'>
              Descripción
            </label>
            <InputTextarea
              rows={3}
              value={nuevoEvento.descripcion}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })
              }
              className='w-full'
            />
          </div>

          <div className='flex gap-2 justify-content-end'>
            <Button label='Cancelar' icon='pi pi-times' text onClick={onHide} />
            <Button
              label='Publicar'
              icon='pi pi-check'
              onClick={handleSave}
              loading={loading}
            />
          </div>
        </div>
      </Dialog>

      {/* SUB-MODAL: MAPA PARA SELECCIONAR */}
      <Dialog
        header='Elige la ubicación'
        visible={showMapModal}
        style={{ width: '90vw', maxWidth: '600px' }}
        onHide={() => setShowMapModal(false)}
      >
        <div style={{ height: '400px', width: '100%' }}>
          <MapContainer
            center={[40.4168, -3.7038]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
            <LocationSelector
              setPosicion={(pos) =>
                setNuevoEvento({ ...nuevoEvento, lat: pos.lat, lng: pos.lng })
              }
              cerrarMapa={() => setShowMapModal(false)}
            />
            {nuevoEvento.lat && (
              <Marker position={[nuevoEvento.lat, nuevoEvento.lng]} />
            )}
          </MapContainer>
        </div>
        <p className='text-center text-sm text-600 mt-2'>
          Haz click para confirmar posición.
        </p>
      </Dialog>
    </>
  )
}

export default AddEventDialog
