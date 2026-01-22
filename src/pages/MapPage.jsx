import React, { useState } from 'react'
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
import Header from '../components/Header'
// Los estilos de leaflet ya están en main.jsx

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

function LocationMarker({ setPosicion, setDialogVisible }) {
  useMapEvents({
    click(e) {
      setPosicion(e.latlng)
      setDialogVisible(true)
    },
  })
  return null
}

const MapPage = () => {
  const [eventos, setEventos] = useState([
    {
      id: 1,
      titulo: 'KDD Stance Madrid',
      lat: 40.4167,
      lng: -3.7032,
      tipo: 'Stance',
      fecha: new Date(),
    },
    {
      id: 2,
      titulo: 'Ruta Costa Brava',
      lat: 41.3851,
      lng: 2.1734,
      tipo: 'Ruta',
      fecha: new Date(),
    },
  ])

  const [dialogVisible, setDialogVisible] = useState(false)
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
  })
  const [posicionTemp, setPosicionTemp] = useState(null)

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
  ]

  // --- CONFIGURACIÓN DE ESPAÑA ---
  const centerSpain = [40.4637, -3.7492] // Centro de la península
  const spainBounds = [
    [27.0, -19.0], // Suroeste (Canarias)
    [44.0, 5.0], // Noreste (Pirineos/Menorca)
  ]

  const guardarEvento = () => {
    if (nuevoEvento.titulo && posicionTemp) {
      const eventoGuardar = {
        id: Date.now(),
        ...nuevoEvento,
        lat: posicionTemp.lat,
        lng: posicionTemp.lng,
      }
      setEventos([...eventos, eventoGuardar])
      setDialogVisible(false)
      setNuevoEvento({ titulo: '', tipo: '', fecha: null })
    }
  }

  return (
    <div className='flex flex-column min-h-screen surface-ground'>
      <Header />

      <div className='p-3 md:p-5 flex-grow-1 flex flex-column gap-3 max-w-7xl mx-auto w-full h-full'>
        {/* Panel superior */}
        <Card className='shadow-2 border-round-xl surface-card p-0 flex-none'>
          <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between gap-3'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold m-0 mb-2 text-white'>
                Mapa en Vivo
              </h1>
              <p className='text-gray-400 m-0 text-sm md:text-base'>
                Haz clic en el mapa para añadir tu evento.
              </p>
            </div>
          </div>
        </Card>

        {/* --- CONTENEDOR DEL MAPA --- */}
        {/* 'relative' es vital para que lo de dentro se posicione respecto a este cuadro */}
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
            // --- EL TRUCO ESTÁ AQUÍ ---
            // position: 'absolute' obliga al mapa a llenar el 100% del padre relative
            style={{
              height: '100%',
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                      {ev.fecha.toLocaleDateString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            <LocationMarker
              setPosicion={setPosicionTemp}
              setDialogVisible={setDialogVisible}
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
              placeholder='Ej: KDD Nocturna'
            />
          </div>
          <div className='field'>
            <label className='block text-900 font-medium mb-2'>
              Tipo de Quedada
            </label>
            <Dropdown
              value={nuevoEvento.tipo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, tipo: e.value })
              }
              options={tiposEvento}
              optionLabel='label'
              placeholder='Selecciona el estilo'
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
              placeholder='¿Cuándo es?'
              className='w-full'
            />
          </div>
          <div className='flex gap-2 justify-content-end mt-2'>
            <Button
              label='Cancelar'
              icon='pi pi-times'
              onClick={() => setDialogVisible(false)}
              className='p-button-text'
            />
            <Button
              label='Publicar'
              icon='pi pi-check'
              onClick={guardarEvento}
              autoFocus
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default MapPage
