import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { AutoComplete } from 'primereact/autocomplete'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import {
  MapPin,
  CalendarPlus,
  Type,
  ImagePlus,
  FileText,
  Send,
  Map as MapIcon,
  Tag as TagIcon,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// COMPONENTE ACTUALIZADO PARA DEVOLVER LAS COORDENADAS AL PADRE
function LocationSelector({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng)
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
  const [suggestions, setSuggestions] = useState([])
  const fileInputRef = useRef(null)

  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
    descripcion: '',
    imagen: null,
    lat: null,
    lng: null,
    direccion: '',
    ubicacion: '', // AÑADIDO: Para guardar el texto en la BD
  })

  useEffect(() => {
    if (initialLat && initialLng) {
      setNuevoEvento((prev) => ({ ...prev, lat: initialLat, lng: initialLng }))
    }
  }, [initialLat, initialLng, visible])

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const searchAddress = async (event) => {
    const query = event.query
    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query,
        )}&countrycodes=es,pt,ad,fr&limit=5`,
      )
      const data = await response.json()
      const formattedSuggestions = data.map((item) => ({
        label: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }))
      setSuggestions(formattedSuggestions)
    } catch (error) {
      console.error('Error buscando sugerencias:', error)
    }
  }

  // CUANDO EL USUARIO ELIGE UNA DIRECCIÓN DEL BUSCADOR
  const onAddressSelect = (e) => {
    const selected = e.value
    // Recortamos el texto largo a algo más limpio (Ej: "Madrid, España")
    const shortUbicacion = selected.label.split(',').slice(0, 2).join(',')

    setNuevoEvento({
      ...nuevoEvento,
      direccion: selected.label,
      ubicacion: shortUbicacion, // Guardamos la ciudad
      lat: selected.lat,
      lng: selected.lng,
    })
    toast.current.show({
      severity: 'success',
      summary: 'Ubicación Fijada',
      detail: shortUbicacion,
      life: 2000,
    })
  }

  // NUEVO: REVERSE GEOCODING CUANDO EL USUARIO PINCHA EN EL MAPA
  const handleLocationSelect = async (latlng) => {
    setShowMapModal(false)
    setNuevoEvento((prev) => ({ ...prev, lat: latlng.lat, lng: latlng.lng }))

    toast.current.show({
      severity: 'info',
      summary: 'Analizando ubicación...',
      detail: 'Traduciendo coordenadas...',
      life: 1500,
    })

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1`,
      )
      const data = await response.json()

      // Intentamos sacar la ciudad o pueblo, y la provincia
      const address = data.address || {}
      const city =
        address.city || address.town || address.village || address.county || ''
      const state = address.state || ''

      const ubicacionFormat = city ? `${city}, ${state}` : data.display_name

      setNuevoEvento((prev) => ({
        ...prev,
        direccion: data.display_name,
        ubicacion: ubicacionFormat,
      }))

      toast.current.show({
        severity: 'success',
        summary: 'Ubicación detectada',
        detail: ubicacionFormat,
        life: 3000,
      })
    } catch (error) {
      console.error(error)
      // Si falla, guardamos al menos un genérico para que no crashee
      setNuevoEvento((prev) => ({
        ...prev,
        ubicacion: 'Ubicación seleccionada en mapa',
      }))
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
    if (!session)
      return toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Sesión no válida.',
      })
    if (
      !nuevoEvento.titulo ||
      !nuevoEvento.fecha ||
      !nuevoEvento.tipo ||
      !nuevoEvento.lat
    ) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Rellena título, fecha, tipo y selecciona una ubicación.',
      })
    }

    setLoading(true)
    let imageUrl = null

    if (nuevoEvento.imagen) {
      imageUrl = await uploadImage(nuevoEvento.imagen)
      if (!imageUrl) {
        setLoading(false)
        return toast.current.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Fallo al subir la imagen.',
        })
      }
    }

    const finalTipo =
      typeof nuevoEvento.tipo === 'object'
        ? nuevoEvento.tipo.value
        : nuevoEvento.tipo

    // MODIFICACIÓN: Añadimos .select() al final para que Supabase nos devuelva el ID del evento recién creado
    const { data: newEventData, error } = await supabase
      .from('events')
      .insert([
        {
          titulo: nuevoEvento.titulo,
          tipo: finalTipo,
          fecha: nuevoEvento.fecha,
          description: nuevoEvento.descripcion,
          image_url: imageUrl,
          lat: nuevoEvento.lat,
          lng: nuevoEvento.lng,
          user_id: session.user.id,
        },
      ])
      .select()

    if (error) {
      setLoading(false)
      return toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    }

    // --- LÓGICA DE AVISO GLOBAL (NUEVO EVENTO) ---
    if (newEventData && newEventData.length > 0) {
      const newEventId = newEventData[0].id

      // Buscamos a todos los usuarios registrados (menos al creador)
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', session.user.id)

      if (allUsers && allUsers.length > 0) {
        // Preparamos una notificación para cada usuario de la plataforma
        const globalNotifications = allUsers.map((user) => ({
          user_id: user.id, // El receptor
          actor_id: session.user.id, // El creador del evento
          tipo: 'nuevo_evento',
          evento_id: newEventId,
        }))

        // Insertamos todas las notificaciones en bloque
        await supabase.from('notifications').insert(globalNotifications)
      }
    }
    // ---------------------------------------------

    setLoading(false)
    toast.current.show({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Evento publicado y comunidad notificada.',
    })

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
    if (onEventAdded) onEventAdded()
    onHide()
  }

  return (
    <>
      <Toast ref={toast} />
      <style>
        {`
          .premium-dialog .p-dialog-header {
            border-bottom: none;
            padding: 2rem 2rem 1rem 2rem;
            border-radius: 32px 32px 0 0;
          }
          .premium-dialog .p-dialog-content {
            padding: 0 2rem 2rem 2rem;
            border-radius: 0 0 32px 32px;
          }
          .premium-input {
            border: 2px solid transparent !important;
            background-color: #f1f5f9 !important;
            border-radius: 20px !important;
            padding: 1rem 1.25rem !important;
            font-size: 1rem !important;
            font-weight: 600 !important;
            color: #1e293b !important;
            transition: all 0.3s ease !important;
            box-shadow: none !important;
          }
          .premium-input:hover {
            background-color: #e2e8f0 !important;
          }
          .premium-input:focus, .p-inputwrapper-focus > .premium-input {
            background-color: #ffffff !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1) !important;
          }
          .premium-label {
            font-size: 0.85rem;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .premium-dropzone {
            background-color: #f8fafc;
            border: 2px dashed #cbd5e1;
            border-radius: 24px;
            padding: 3rem 2rem;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .premium-dropzone:hover {
            background-color: #eff6ff;
            border-color: #93c5fd;
            transform: translateY(-2px);
          }
          .premium-btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%) !important;
            border: none !important;
            border-radius: 100px !important;
            padding: 1rem 2rem !important;
            font-weight: 800 !important;
            letter-spacing: 0.5px !important;
            box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4) !important;
            transition: all 0.3s ease !important;
          }
          .premium-btn-primary:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 25px -5px rgba(59, 130, 246, 0.5) !important;
          }
          .p-dropdown-panel .p-dropdown-items .p-dropdown-item {
            font-weight: 600;
            border-radius: 12px;
            margin: 4px;
          }
          .p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item {
            font-weight: 600;
            border-radius: 12px;
            margin: 4px;
          }
        `}
      </style>

      <Dialog
        header={
          <div className='flex align-items-center gap-4'>
            <div
              className='flex align-items-center justify-content-center border-circle shadow-4'
              style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                color: 'white',
              }}
            >
              <CalendarPlus size={30} />
            </div>
            <div>
              <h2 className='font-black text-3xl text-900 m-0 tracking-tight'>
                Publicar Evento
              </h2>
              <p className='text-500 font-medium m-0 mt-1'>
                Comparte tu KDD o ruta con la comunidad.
              </p>
            </div>
          </div>
        }
        visible={visible}
        draggable={false}
        className='w-11 md:w-8 lg:w-6 premium-dialog shadow-8'
        style={{ borderRadius: '32px' }}
        onHide={onHide}
        breakpoints={{ '960px': '85vw', '641px': '100vw' }}
      >
        <div className='flex flex-column gap-5 mt-4'>
          <div className='field m-0'>
            <label className='premium-label'>
              <Type size={18} className='text-blue-500' /> Título del Evento *
            </label>
            <InputText
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full premium-input'
              placeholder='Ej: Gran KDD Racing Madrid'
            />
          </div>

          <div className='grid m-0 gap-4 md:gap-0'>
            <div className='col-12 md:col-6 md:pr-3 p-0 field m-0'>
              <label className='premium-label'>
                <TagIcon size={18} className='text-purple-500' /> Categoría *
              </label>
              <Dropdown
                value={nuevoEvento.tipo}
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, tipo: e.value })
                }
                options={tiposEvento}
                optionLabel='label'
                className='w-full premium-input p-0 flex align-items-center'
                placeholder='Selecciona la disciplina'
              />
            </div>

            <div className='col-12 md:col-6 md:pl-3 p-0 field m-0'>
              <label className='premium-label'>
                <CalendarPlus size={18} className='text-emerald-500' /> Fecha y
                Hora *
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
                inputClassName='premium-input w-full'
                placeholder='Selecciona el inicio'
              />
            </div>
          </div>

          <div className='field m-0 surface-50 p-4 md:p-5 border-round-3xl border-1 border-gray-100 relative overflow-hidden'>
            <div
              className='absolute top-0 right-0 p-4 opacity-10'
              style={{ pointerEvents: 'none' }}
            >
              <MapPin size={120} />
            </div>
            <label className='text-900 font-black mb-4 flex align-items-center gap-3 text-xl relative z-1'>
              <div className='bg-blue-100 text-blue-600 p-2 border-circle flex align-items-center justify-content-center'>
                <MapPin size={22} />
              </div>
              Ubicación del Evento *
            </label>

            <div className='mb-4 w-full relative z-1'>
              <AutoComplete
                value={nuevoEvento.direccion}
                suggestions={suggestions}
                completeMethod={searchAddress}
                field='label'
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, direccion: e.value })
                }
                onSelect={onAddressSelect}
                placeholder='Escribe la calle, circuito, pueblo...'
                className='w-full'
                inputClassName='w-full premium-input bg-white border-none shadow-1'
                panelClassName='shadow-4 border-round-2xl mt-2'
                delay={500}
              />
            </div>

            <div className='flex align-items-center gap-3 mb-4 relative z-1'>
              <div className='flex-1 border-top-1 border-300'></div>
              <span className='text-400 font-bold text-xs uppercase tracking-widest'>
                O UBICA MANUALMENTE
              </span>
              <div className='flex-1 border-top-1 border-300'></div>
            </div>

            <Button
              label='Abrir Mapa Interactivo'
              icon={<MapIcon size={20} className='mr-2' />}
              className='w-full mb-4 border-round-2xl font-bold bg-white text-800 border-none shadow-1 hover:shadow-2 hover:text-blue-600 transition-all p-3 relative z-1'
              onClick={() => setShowMapModal(true)}
            />

            <div className='grid m-0 gap-3 relative z-1'>
              <div className='col p-0 bg-white border-round-xl shadow-1 p-3'>
                <div className='text-xs font-bold text-400 tracking-widest uppercase mb-1'>
                  Latitud
                </div>
                <div className='font-mono text-800 font-bold text-lg'>
                  {nuevoEvento.lat ? nuevoEvento.lat.toFixed(6) : '---'}
                </div>
              </div>
              <div className='col p-0 bg-white border-round-xl shadow-1 p-3'>
                <div className='text-xs font-bold text-400 tracking-widest uppercase mb-1'>
                  Longitud
                </div>
                <div className='font-mono text-800 font-bold text-lg'>
                  {nuevoEvento.lng ? nuevoEvento.lng.toFixed(6) : '---'}
                </div>
              </div>
            </div>

            {/* Opcional: mostrar la ubicación traducida debajo para confirmar */}
            {nuevoEvento.ubicacion && (
              <div className='mt-3 text-sm font-bold text-blue-600'>
                <i className='pi pi-check-circle mr-2'></i>
                Ciudad guardada: {nuevoEvento.ubicacion}
              </div>
            )}
          </div>

          <div className='field m-0'>
            <label className='premium-label'>
              <ImagePlus size={18} className='text-pink-500' /> Cartel / Imagen
              (Opcional)
            </label>
            <div
              className='premium-dropzone'
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type='file'
                accept='image/*'
                ref={fileInputRef}
                onChange={(e) =>
                  e.target.files[0] &&
                  setNuevoEvento({
                    ...nuevoEvento,
                    imagen: e.target.files[0],
                  })
                }
                style={{ display: 'none' }}
              />
              {nuevoEvento.imagen ? (
                <div className='flex flex-column align-items-center'>
                  <div className='bg-green-100 text-green-600 border-circle p-3 mb-3 shadow-2'>
                    <i className='pi pi-check text-2xl font-bold'></i>
                  </div>
                  <span className='text-lg text-900 font-black mb-1'>
                    {nuevoEvento.imagen.name}
                  </span>
                  <span className='text-blue-500 font-bold mt-2 hover:underline'>
                    Cambiar imagen
                  </span>
                </div>
              ) : (
                <div className='flex flex-column align-items-center'>
                  <div className='bg-white text-blue-500 border-circle p-4 mb-4 shadow-2'>
                    <ImagePlus size={40} />
                  </div>
                  <span className='text-xl text-900 font-black mb-2'>
                    Sube el cartel oficial
                  </span>
                  <span className='text-sm text-500 font-medium'>
                    Haz clic aquí. Recomendado: JPG o PNG (Max. 5MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className='field m-0 mb-2'>
            <label className='premium-label'>
              <FileText size={18} className='text-orange-500' /> Descripción
            </label>
            <InputTextarea
              rows={5}
              value={nuevoEvento.descripcion}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })
              }
              className='w-full premium-input line-height-3'
              placeholder='Detalla el planning, normativas, horarios específicos, requisitos para asistir...'
            />
          </div>

          <div className='flex align-items-center justify-content-between pt-4 mt-2'>
            <Button
              label='Cancelar'
              text
              onClick={onHide}
              className='text-500 hover:text-700 hover:surface-100 font-bold px-4 border-round-3xl transition-colors'
            />
            <Button
              label='Publicar Evento'
              icon={<Send size={20} className='mr-2' />}
              onClick={handleSave}
              loading={loading}
              className='premium-btn-primary text-lg'
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        header={
          <span className='font-black text-2xl'>
            Pincha en la ubicación exacta
          </span>
        }
        visible={showMapModal}
        draggable={false}
        style={{ width: '90vw', maxWidth: '800px' }}
        onHide={() => setShowMapModal(false)}
        contentClassName='p-0'
        className='border-round-3xl overflow-hidden shadow-8'
        headerClassName='border-none p-4 pb-3'
      >
        <div style={{ height: '500px', width: '100%' }}>
          <MapContainer
            center={
              nuevoEvento.lat
                ? [nuevoEvento.lat, nuevoEvento.lng]
                : [40.4168, -3.7038]
            }
            zoom={nuevoEvento.lat ? 15 : 5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
            <LocationSelector onLocationSelect={handleLocationSelect} />
            {nuevoEvento.lat && (
              <Marker position={[nuevoEvento.lat, nuevoEvento.lng]} />
            )}
          </MapContainer>
        </div>
      </Dialog>
    </>
  )
}

export default AddEventDialog
