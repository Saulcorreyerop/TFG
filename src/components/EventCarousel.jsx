import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Carousel } from 'primereact/carousel'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'

// Importaciones para el Mapa
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
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

function LocationSelector({ setPosicion, cerrarMapa }) {
  useMapEvents({
    click(e) {
      setPosicion(e.latlng)
      cerrarMapa()
    },
  })
  return null
}

const EventCarousel = () => {
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useRef(null)

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

  const fetchEvents = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('fecha', now)
      .order('fecha', { ascending: true })
      .limit(9)

    if (!error && data) {
      const eventsWithImages = data.map((ev) => ({
        ...ev,
        date: new Date(ev.fecha).toLocaleDateString(),
        location: 'España',
        image: ev.image_url
          ? ev.image_url
          : `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=600&q=80&random=${ev.id}`,
        status: 'CONFIRMADO',
      }))
      setEvents(eventsWithImages)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  // --- NUEVA FUNCIÓN: VALIDAR SESIÓN ANTES DE ABRIR ---
  const handleOpenModal = async () => {
    // Verificamos si hay usuario logueado
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      // Si no hay sesión, mostramos aviso y NO abrimos el modal
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso restringido',
        detail: 'Debes iniciar sesión para publicar un evento.',
        life: 3000,
      })
      return
    }

    // Si hay sesión, abrimos el formulario
    setShowModal(true)
  }

  // --- LÓGICA DE GEOCODING ---
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
          summary: 'Ubicación Encontrada',
          detail: 'Coordenadas actualizadas.',
        })
      } else {
        toast.current.show({
          severity: 'warn',
          summary: 'No encontrada',
          detail: 'Intenta ser más específico.',
        })
      }
    } catch (error) {
      console.error(error)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Fallo al buscar dirección.',
      })
    } finally {
      setLoading(false)
    }
  }

  // --- SUBIDA DE IMAGEN ---
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
      console.error('Error subiendo imagen:', error)
      return null
    }
  }

  // --- GUARDAR EVENTO ---
  const handleSave = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Doble comprobación de seguridad
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
        summary: 'Error al guardar',
        detail: error.message,
      })
    } else {
      setShowModal(false)
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
      toast.current.show({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Evento publicado correctamente.',
      })
      fetchEvents()
    }
  }

  const responsiveOptions = [
    { breakpoint: '1199px', numVisible: 3, numScroll: 1 },
    { breakpoint: '991px', numVisible: 2, numScroll: 1 },
    { breakpoint: '767px', numVisible: 1, numScroll: 1 },
  ]

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const eventTemplate = (event) => {
    return (
      <div className='border-1 surface-border border-round m-2 text-center py-5 px-3 bg-white shadow-1 h-full flex flex-column'>
        <div className='mb-3 relative'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full border-round shadow-2'
            style={{ height: '200px', objectFit: 'cover' }}
          />
          <Tag
            value={event.status}
            severity='success'
            className='absolute'
            style={{ left: '5px', top: '5px' }}
          />
        </div>
        <div className='flex-grow-1 flex flex-column justify-content-between'>
          <div>
            <h4 className='mb-1 text-900 font-bold'>{event.titulo}</h4>
            <span className='text-blue-600 font-bold text-sm block mb-2'>
              {event.tipo}
            </span>
            {event.description && (
              <p
                className='text-600 text-sm mb-3 line-clamp-2'
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  height: '2.5em',
                }}
              >
                {event.description}
              </p>
            )}
            <h6 className='mt-0 mb-3 text-600 font-medium'>
              <i className='pi pi-calendar mr-1'></i>
              {event.date}
            </h6>
          </div>
          <div className='mt-2 flex gap-2 justify-content-center'>
            <Button
              icon='pi pi-search'
              className='p-button-rounded p-button-text'
              tooltip='Ver Detalles'
            />
            <Button
              icon='pi pi-heart'
              className='p-button-rounded p-button-outlined p-button-danger'
              tooltip='Me gusta'
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className='py-6 surface-ground relative'>
      <Toast ref={toast} />
      <h3 className='text-center text-900 text-3xl mb-4 font-bold'>
        Próximos Eventos
      </h3>

      <div className='flex justify-content-center mb-4'>
        {/* BOTÓN PROTEGIDO: Llama a handleOpenModal en vez de setShowModal directo */}
        <Button
          label='Agregar Evento'
          icon='pi pi-plus'
          className='p-button-rounded p-button-primary shadow-2'
          tooltip='Publicar un nuevo evento'
          onClick={handleOpenModal}
        />
      </div>

      <div className='card'>
        {events.length > 0 ? (
          <Carousel
            value={events}
            numVisible={3}
            numScroll={1}
            responsiveOptions={responsiveOptions}
            itemTemplate={eventTemplate}
            circular
            autoplayInterval={3000}
          />
        ) : (
          <div className='text-center py-5'>
            <i className='pi pi-calendar-times text-4xl text-gray-400 mb-3'></i>
            <p className='text-600'>No hay eventos próximos programados.</p>
          </div>
        )}
      </div>

      {/* --- MODAL FORMULARIO --- */}
      <Dialog
        header='Publicar Nuevo Evento'
        visible={showModal}
        className='w-11 md:w-30rem'
        onHide={() => setShowModal(false)}
      >
        <div className='flex flex-column gap-4 pt-2'>
          <div className='field'>
            <label className='block text-900 font-medium mb-2'>Título</label>
            <InputText
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full'
              placeholder='Nombre del evento'
            />
          </div>
          <div className='field'>
            <label className='block text-900 font-medium mb-2'>Tipo</label>
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
              Fecha y Hora
            </label>
            <Calendar
              value={nuevoEvento.fecha}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, fecha: e.value })
              }
              showTime
              hourFormat='24'
              className='w-full'
            />
          </div>

          <div className='field surface-100 p-3 border-round'>
            <label className='block text-900 font-bold mb-2'>
              <i className='pi pi-map-marker mr-2 text-blue-600'></i>Ubicación
            </label>
            <div className='p-inputgroup mb-2'>
              <InputText
                placeholder='Ej: Calle Gran Vía 1, Madrid'
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
                {nuevoEvento.imagen ? 'Imagen Lista' : 'Subir Foto'}
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
            <Button
              label='Cancelar'
              icon='pi pi-times'
              text
              onClick={() => setShowModal(false)}
            />
            <Button
              label='Publicar'
              icon='pi pi-check'
              onClick={handleSave}
              loading={loading}
            />
          </div>
        </div>
      </Dialog>

      {/* --- MODAL MAPA --- */}
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
          Haz click en el mapa para confirmar la posición.
        </p>
      </Dialog>
    </section>
  )
}

export default EventCarousel
