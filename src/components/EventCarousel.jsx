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
import { addLocale } from 'primereact/api'

// Importaciones para el Mapa
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// --- CONFIGURACIÓN IDIOMA ESPAÑOL ---
addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
})

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
      .select('*, profiles(username)')
      .gte('fecha', now)
      .order('fecha', { ascending: true })
      .limit(9)

    if (!error && data) {
      const eventsWithImages = data.map((ev) => ({
        ...ev,
        date: new Date(ev.fecha).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        location: 'España',
        // Usamos una imagen de alta resolución (w=1200) y calidad (q=90) para evitar pixelado en Unsplash
        image: ev.image_url
          ? ev.image_url
          : `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=90&random=${ev.id}`,
        status: 'CONFIRMADO',
      }))
      setEvents(eventsWithImages)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleOpenModal = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso restringido',
        detail: 'Debes iniciar sesión para publicar.',
        life: 3000,
      })
      return
    }
    setShowModal(true)
  }

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

  const handleSave = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
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

  // --- DISEÑO DE TARJETA CORREGIDO ---
  const eventTemplate = (event) => {
    return (
      // ENVOLTORIO CON PADDING: Esto evita que la sombra se corte por abajo (soluciona el solapamiento)
      <div className='p-3 h-full'>
        <div className='surface-card shadow-2 border-round-xl overflow-hidden hover:shadow-5 transition-all transition-duration-300 h-full flex flex-column'>
          {/* CABECERA DE IMAGEN */}
          <div className='relative h-15rem w-full bg-gray-200'>
            <img
              src={event.image}
              alt={event.titulo}
              // IMPORTANTE: objectFit: 'cover' arregla el estiramiento. w-full h-full llena el contenedor.
              className='w-full h-full'
              style={{ objectFit: 'cover', display: 'block' }}
            />

            {/* Etiquetas sobre la imagen (SIN CONFIRMADO) */}
            <div className='absolute bottom-0 right-0 m-3'>
              <Tag
                value={event.tipo}
                severity='info'
                className='shadow-2'
                icon='pi pi-tag'
              />
            </div>

            <div
              className='absolute bottom-0 left-0 w-full h-3rem'
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.1), transparent)',
              }}
            ></div>
          </div>

          {/* CUERPO DE LA TARJETA */}
          <div className='p-4 flex flex-column justify-content-between flex-grow-1'>
            <div>
              <div className='flex align-items-center gap-2 text-500 text-sm font-semibold mb-2 uppercase tracking-wide'>
                <i className='pi pi-calendar text-blue-500'></i>
                <span>{event.date}</span>
              </div>

              <h4 className='text-xl font-bold text-900 mt-0 mb-2 line-height-3'>
                {event.titulo}
              </h4>

              {event.description && (
                <p
                  className='text-600 text-sm line-height-3 m-0 mb-4 line-clamp-2'
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    height: '3em',
                  }}
                >
                  {event.description}
                </p>
              )}
            </div>

            {/* FOOTER */}
            <div className='pt-3 border-top-1 surface-border flex align-items-center justify-content-between mt-auto'>
              <div className='flex align-items-center gap-2 text-600 text-sm'>
                <div
                  className='border-circle surface-300 flex align-items-center justify-content-center'
                  style={{ width: '24px', height: '24px' }}
                >
                  <i className='pi pi-user text-xs'></i>
                </div>
                <span
                  className='font-medium text-overflow-ellipsis white-space-nowrap overflow-hidden'
                  style={{ maxWidth: '80px' }}
                >
                  {event.profiles?.username || 'Anónimo'}
                </span>
              </div>

              <div className='flex gap-2'>
                <Button
                  icon='pi pi-heart'
                  rounded
                  outlined
                  severity='danger'
                  aria-label='Like'
                  className='w-2rem h-2rem'
                />
                <Button
                  icon='pi pi-arrow-right'
                  rounded
                  aria-label='Ver'
                  className='w-2rem h-2rem'
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className='py-6 surface-ground relative'>
      <Toast ref={toast} />

      <div className='text-center mb-5'>
        <h3 className='text-900 text-3xl font-bold mb-2'>Próximos Eventos</h3>
        <p className='text-600'>
          Descubre las mejores concentraciones cerca de ti
        </p>
      </div>

      <div className='flex justify-content-center mb-5'>
        <Button
          label='Publicar Evento'
          icon='pi pi-plus'
          rounded
          raised
          className='px-4 py-2 font-bold'
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
            autoplayInterval={4000}
            showIndicators={false}
          />
        ) : (
          <div className='text-center py-8 surface-card border-round shadow-1 mx-3'>
            <i className='pi pi-calendar-times text-6xl text-gray-300 mb-4'></i>
            <p className='text-700 text-xl font-medium'>
              No hay eventos próximos.
            </p>
            <p className='text-500'>¡Sé el primero en crear uno!</p>
          </div>
        )}
      </div>

      {/* --- MODALES (IGUAL QUE ANTES) --- */}
      <Dialog
        header='Publicar Nuevo Evento'
        visible={showModal}
        className='w-11 md:w-30rem'
        onHide={() => setShowModal(false)}
        maximizable
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
              locale='es'
              dateFormat='dd/mm/yy'
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
