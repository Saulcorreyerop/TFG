import React, { useState, useEffect } from 'react'
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
import { InputTextarea } from 'primereact/inputtextarea' // <--- IMPORTANTE
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Card } from 'primereact/card'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function LocationMarker({ setPosicion, setDialogVisible, session }) {
  useMapEvents({
    click(e) {
      if (!session) {
        alert('🔒 Debes iniciar sesión para añadir un evento.')
        return
      }
      setPosicion(e.latlng)
      setDialogVisible(true)
    },
  })
  return null
}

const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)

  // Estado actualizado con los nuevos campos
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
    descripcion: '', // Nuevo campo
    imagen: null, // Nuevo campo (archivo)
  })

  const [posicionTemp, setPosicionTemp] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchEventos = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*')
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

  // Función para subir la imagen al Storage
  const uploadImage = async (file) => {
    try {
      // 1. Crear nombre único: fecha + nombre_archivo (limpiando espacios)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // 2. Subir a Supabase Storage (bucket 'event-images')
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // 3. Obtener la URL pública
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error subiendo imagen:', error)
      alert('Error al subir la imagen')
      return null
    }
  }

  const guardarEvento = async () => {
    if (!nuevoEvento.titulo || !nuevoEvento.fecha || !nuevoEvento.tipo)
      return alert('Rellena los campos obligatorios (Título, Tipo, Fecha)')

    setLoading(true)
    let imageUrl = null

    // Si hay imagen seleccionada, la subimos primero
    if (nuevoEvento.imagen) {
      imageUrl = await uploadImage(nuevoEvento.imagen)
      if (!imageUrl) {
        setLoading(false)
        return // Paramos si falló la subida
      }
    }

    // Insertamos en base de datos
    const { error } = await supabase.from('events').insert([
      {
        titulo: nuevoEvento.titulo,
        tipo: nuevoEvento.tipo,
        fecha: nuevoEvento.fecha,
        description: nuevoEvento.descripcion, // Guardamos descripción
        image_url: imageUrl, // Guardamos URL de la foto
        lat: posicionTemp.lat,
        lng: posicionTemp.lng,
        user_id: session.user.id,
      },
    ])

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setDialogVisible(false)
      // Reiniciamos el formulario
      setNuevoEvento({
        titulo: '',
        tipo: '',
        fecha: null,
        descripcion: '',
        imagen: null,
      })
      fetchEventos()
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

  // Manejador para el input de archivo
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
      {/* ... (Header y Card superior igual que antes) ... */}
      <div className='p-3 md:p-5 flex-grow-1 flex flex-column gap-3 max-w-7xl mx-auto w-full h-full'>
        {/* ... Código del Card de Bienvenida (igual que tenías) ... */}
        <Card className='shadow-2 border-round-xl surface-card p-0 flex-none'>
          <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between gap-3'>
            <div className='flex flex-column gap-1'>
              <h1 className='text-3xl font-extrabold m-0 text-900 tracking-tight'>
                Mapa en Vivo
              </h1>

              <div className='text-600 m-0 text-base'>
                {session ? (
                  /* Usamos un div contenedor en lugar de fragmento para manejar el espaciado */
                  <div className='flex flex-column gap-3 mt-2'>
                    {/* Título de la instrucción con icono */}
                    <div className='flex align-items-center gap-2 text-900 font-semibold text-lg'>
                      <i className='pi pi-map-marker text-blue-600 text-xl' />
                      <span>Añadir nuevo evento</span>
                    </div>

                    {/* Texto descriptivo más legible */}
                    <p className='m-0 line-height-3 text-700'>
                      Navega por el mapa, haz zoom en la zona exacta y
                      <span className='font-bold text-900'>
                        {' '}
                        haz click sobre el lugar{' '}
                      </span>
                      donde comenzará el evento para crearlo.
                    </p>

                    {/* Nota informativa con estilo de "alerta" suave */}
                    <div className='surface-100 p-3 border-round-md flex align-items-start gap-2 text-sm text-600'>
                      <i className='pi pi-info-circle mt-1 text-blue-500' />
                      <span>
                        <strong>Nota:</strong> Una vez que la fecha y hora del
                        evento hayan pasado, este dejará de mostrarse
                        automáticamente en el mapa.
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Mensaje para no logueados */
                  <div className='flex align-items-center gap-2 mt-2 text-orange-600 surface-50 p-2 border-round'>
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

        {/* Mapa */}
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
                    {/* Mostrar imagen en miniatura en el popup si existe */}
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
                      {ev.fecha.toLocaleDateString()} -{' '}
                      {ev.fecha.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            <LocationMarker
              setPosicion={setPosicionTemp}
              setDialogVisible={setDialogVisible}
              session={session}
            />
          </MapContainer>
        </div>
      </div>

      {/* DIÁLOGO DE NUEVO EVENTO ACTUALIZADO */}
      <Dialog
        header='Nuevo Evento'
        visible={dialogVisible}
        className='w-11 md:w-30rem'
        onHide={() => setDialogVisible(false)}
      >
        <div className='flex flex-column gap-4 pt-2'>
          {/* Título */}
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

          {/* Tipo */}
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

          {/* Fecha */}
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
              hourFormat='24'
              className='w-full'
            />
          </div>

          {/* IMAGEN DEL CARTEL */}
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

          {/* DESCRIPCIÓN */}
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
