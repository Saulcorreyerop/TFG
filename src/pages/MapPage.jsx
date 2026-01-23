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
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
  })
  const [posicionTemp, setPosicionTemp] = useState(null)
  const [loading, setLoading] = useState(false)

  // --- CORRECCIÓN: Definimos la función ANTES de usarla en useEffect ---
  const fetchEventos = async () => {
    const { data, error } = await supabase.from('events').select('*')
    if (error) {
      console.error('Error cargando eventos:', error)
    } else {
      const eventosFormateados = data.map((ev) => ({
        ...ev,
        fecha: new Date(ev.fecha), // Convertir texto a fecha real
      }))
      setEventos(eventosFormateados)
    }
  }

  // --- 1. CARGAR EVENTOS DE SUPABASE ---
  // Ahora sí podemos llamarla porque ya existe arriba
  useEffect(() => {
    fetchEventos()
  }, [])

  // --- 2. GUARDAR EVENTO EN SUPABASE ---
  const guardarEvento = async () => {
    if (!nuevoEvento.titulo || !nuevoEvento.fecha)
      return alert('Rellena todos los campos')

    setLoading(true)
    const { error } = await supabase.from('events').insert([
      {
        titulo: nuevoEvento.titulo,
        tipo: nuevoEvento.tipo,
        fecha: nuevoEvento.fecha,
        lat: posicionTemp.lat,
        lng: posicionTemp.lng,
        user_id: session.user.id, // Vinculamos evento al usuario
      },
    ])

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setDialogVisible(false)
      setNuevoEvento({ titulo: '', tipo: '', fecha: null })
      fetchEventos() // Recargar mapa para ver el nuevo evento
    }
    setLoading(false)
  }

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
  ]

  const centerSpain = [40.4637, -3.7492]
  const spainBounds = [
    [27.0, -19.0],
    [44.0, 5.0],
  ]

  return (
    <div className='flex flex-column min-h-screen surface-ground'>
      <div className='p-3 md:p-5 flex-grow-1 flex flex-column gap-3 max-w-7xl mx-auto w-full h-full'>
        <Card className='shadow-2 border-round-xl surface-card p-0 flex-none'>
          <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between gap-3'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold m-0 mb-2 text-900'>
                Mapa en Vivo
              </h1>
              <p className='text-600 m-0 text-sm md:text-base'>
                {session
                  ? 'Haz clic en el mapa para añadir tu evento.'
                  : 'Inicia sesión para poder publicar eventos.'}
              </p>
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

        <div
          className='flex-grow-1 w-full border-round-xl overflow-hidden shadow-4 border-1 surface-border relative'
          style={{ minHeight: '500px' }}
        >
          <MapContainer
            center={centerSpain}
            zoom={6}
            minZoom={5}
            maxBounds={spainBounds}
            maxBoundsViscosity={1.0}
            style={{
              height: '100%',
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {eventos.map((ev) => (
              <Marker key={ev.id} position={[ev.lat, ev.lng]}>
                <Popup>
                  <div className='text-center'>
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

      <Dialog
        header='Nuevo Evento'
        visible={dialogVisible}
        className='w-11 md:w-30rem'
        onHide={() => setDialogVisible(false)}
      >
        <div className='flex flex-column gap-4 pt-2'>
          <div className='field'>
            <label htmlFor='titulo' className='block text-900 font-medium mb-2'>
              Nombre del Evento
            </label>
            <InputText
              id='titulo'
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full'
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
