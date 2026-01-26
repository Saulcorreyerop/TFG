import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Card } from 'primereact/card'
import { Toast } from 'primereact/toast'
import { useNavigate } from 'react-router-dom'
import { addLocale } from 'primereact/api'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Configuración Español
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

// Componente para capturar clicks en el mapa
function LocationMarker({ setNuevoEvento, setDialogVisible, session, toast }) {
  useMapEvents({
    click(e) {
      if (!session) {
        toast.current.show({
          severity: 'warn',
          summary: 'Acceso',
          detail: 'Inicia sesión para añadir eventos.',
        })
        return
      }
      setNuevoEvento((prev) => ({
        ...prev,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      }))
      setDialogVisible(true)
    },
  })
  return null
}

const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)
  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  // Estado unificado
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

  const fetchEventos = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .gte('fecha', now)

    if (error) {
      console.error('Error cargando eventos:', error)
    } else {
      const eventosFormateados = data.map((ev) => ({
        ...ev,
        fecha: new Date(ev.fecha),
      }))
      setEventos(eventosFormateados)
    }
  }

  useEffect(() => {
    fetchEventos()
  }, [])

  // --- FUNCIÓN: Abrir modal desde el botón ---
  const handleOpenModalButton = () => {
    if (!session) {
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso',
        detail: 'Inicia sesión para añadir eventos.',
      })
      return
    }
    setNuevoEvento((prev) => ({ ...prev, lat: null, lng: null, direccion: '' }))
    setDialogVisible(true)
  }

  // --- LÓGICA GEOCODING ---
  const buscarDireccion = async () => {
    if (!nuevoEvento.direccion) return
    try {
      setLoading(true)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          nuevoEvento.direccion,
        )}`,
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

  const guardarEvento = async () => {
    if (
      !nuevoEvento.titulo ||
      !nuevoEvento.fecha ||
      !nuevoEvento.tipo ||
      !nuevoEvento.lat
    )
      return toast.current.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Título, Tipo, Fecha y Ubicación son obligatorios.',
      })

    setLoading(true)
    let imageUrl = null

    if (nuevoEvento.imagen) {
      imageUrl = await uploadImage(nuevoEvento.imagen)
      if (!imageUrl) {
        setLoading(false)
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

    if (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    } else {
      setDialogVisible(false)
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
      fetchEventos()
      toast.current.show({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Evento publicado.',
      })
    }
    setLoading(false)
  }

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setNuevoEvento({ ...nuevoEvento, imagen: e.target.files[0] })
    }
  }

  const centerSpain = [40.4637, -3.7492]
  const spainBounds = [
    [27.0, -19.0],
    [44.0, 5.0],
  ]

  return (
    <div className='flex flex-column min-h-screen surface-ground'>
      <Toast ref={toast} />
      <div className='p-3 md:p-5 flex-grow-1 flex flex-column gap-3 max-w-7xl mx-auto w-full h-full'>
        {/* CARD DE BIENVENIDA CENTRADA */}
        <Card className='shadow-2 border-round-xl surface-card p-0 flex-none'>
          {/* Usamos flex-column y align-items-center para centrar todo */}
          <div className='flex flex-column align-items-center justify-content-center text-center gap-3'>
            <div
              className='flex flex-column gap-1 w-full'
              style={{ maxWidth: '800px' }}
            >
              <h1 className='text-3xl font-extrabold m-0 text-900 tracking-tight'>
                Mapa en Vivo
              </h1>

              <div className='text-600 m-0 text-base'>
                {session ? (
                  <div className='flex flex-column gap-3 mt-2'>
                    {/* Título de instrucción centrado */}
                    <div className='flex align-items-center justify-content-center gap-2 text-900 font-semibold text-lg'>
                      <i className='pi pi-map-marker text-blue-600 text-xl' />
                      <span>Añadir nuevo evento</span>
                    </div>

                    <p className='m-0 line-height-3 text-700'>
                      Navega por el mapa, haz zoom en la zona exacta y
                      <span className='font-bold text-900'>
                        {' '}
                        haz click sobre el lugar{' '}
                      </span>
                      donde comenzará el evento para crearlo.
                    </p>

                    <div className='surface-100 p-3 border-round-md flex align-items-center justify-content-center gap-2 text-sm text-600 mx-auto w-full md:w-10'>
                      <i className='pi pi-info-circle mt-1 text-blue-500' />
                      <span>
                        <strong>Nota:</strong> Una vez que la fecha y hora del
                        evento hayan pasado, este dejará de mostrarse
                        automáticamente en el mapa.
                      </span>
                    </div>

                    {/* --- BOTÓN AÑADIDO Y CENTRADO --- */}
                    <div className='flex justify-content-center mt-2'>
                      <Button
                        label='Agregar Evento por Dirección'
                        icon='pi pi-plus'
                        className='p-button-primary shadow-2'
                        onClick={handleOpenModalButton}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='flex align-items-center justify-content-center gap-2 mt-2 text-orange-600 surface-50 p-2 border-round mx-auto w-fit'>
                    <i className='pi pi-lock' />
                    <span className='font-medium'>
                      Inicia sesión para poder publicar tus propios eventos.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!session && (
              <Button
                label='Iniciar Sesión'
                icon='pi pi-user'
                severity='warning'
                onClick={() => navigate('/login')}
              />
            )}
          </div>
        </Card>

        {/* MAPA */}
        <div
          className='flex-grow-1 w-full border-round-xl overflow-hidden shadow-4 border-1 surface-border relative'
          style={{ minHeight: '500px' }}
        >
          <MapContainer
            center={centerSpain}
            zoom={6}
            minZoom={5}
            maxBounds={spainBounds}
            style={{ height: '100%', width: '100%', position: 'absolute' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {eventos.map((ev) => (
              <Marker key={ev.id} position={[ev.lat, ev.lng]}>
                <Popup>
                  <div className='text-center' style={{ maxWidth: '200px' }}>
                    {ev.image_url && (
                      <img
                        src={ev.image_url}
                        alt='Evento'
                        className='w-full border-round mb-2'
                        style={{ height: '100px', objectFit: 'cover' }}
                      />
                    )}
                    <h3 className='font-bold text-lg m-0 text-gray-900'>
                      {ev.titulo}
                    </h3>
                    <span className='text-blue-600 font-bold text-sm block my-1'>
                      {ev.tipo}
                    </span>
                    <p className='m-0 text-xs text-gray-600'>
                      {ev.fecha.toLocaleDateString('es-ES')} -{' '}
                      {ev.fecha.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className='text-xs text-500 mt-1'>
                      Por: {ev.profiles?.username || 'Anónimo'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            <LocationMarker
              setNuevoEvento={setNuevoEvento}
              setDialogVisible={setDialogVisible}
              session={session}
              toast={toast}
            />
          </MapContainer>
        </div>
      </div>

      {/* DIÁLOGO CON GEOCODING */}
      <Dialog
        header='Nuevo Evento'
        visible={dialogVisible}
        className='w-11 md:w-30rem'
        onHide={() => setDialogVisible(false)}
      >
        <div className='flex flex-column gap-4 pt-2'>
          <div className='field'>
            <label htmlFor='titulo' className='block text-900 font-medium mb-2'>
              Nombre del Evento *
            </label>
            <InputText
              id='titulo'
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full'
              placeholder='Ej: KDD Norte...'
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

          <div className='field surface-100 p-3 border-round'>
            <label className='block text-900 font-bold mb-2'>
              <i className='pi pi-map-marker mr-2 text-blue-600'></i>Ubicación
            </label>

            <div className='p-inputgroup mb-2'>
              <InputText
                placeholder='Escribe dirección (Ej: Madrid)'
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

            <small className='block mb-2 text-600'>
              O haz click en el mapa de fondo para marcar.
            </small>

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
              Cartel / Foto (Opcional)
            </label>
            <div className='flex align-items-center gap-3'>
              <label className='p-button p-component p-button-outlined p-button-secondary cursor-pointer'>
                <i className='pi pi-image mr-2'></i>
                {nuevoEvento.imagen ? 'Imagen Seleccionada' : 'Subir Imagen'}
                <input
                  type='file'
                  accept='image/*'
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              {nuevoEvento.imagen && (
                <span className='text-sm text-green-600 font-bold'>
                  {nuevoEvento.imagen.name}
                </span>
              )}
            </div>
          </div>

          <div className='field'>
            <label htmlFor='desc' className='block text-900 font-medium mb-2'>
              Descripción
            </label>
            <InputTextarea
              id='desc'
              value={nuevoEvento.descripcion}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })
              }
              rows={3}
              className='w-full'
              placeholder='Detalles, ubicación exacta, normas...'
            />
          </div>

          <div className='flex gap-2 justify-content-end mt-2'>
            <Button
              label='Cancelar'
              icon='pi pi-times'
              onClick={() => setDialogVisible(false)}
              text
            />
            <Button
              label='Publicar'
              icon='pi pi-check'
              onClick={guardarEvento}
              loading={loading}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default MapPage
