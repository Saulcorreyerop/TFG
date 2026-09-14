import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents } from 'react-leaflet'
import { Button } from 'primereact/button'
import { Undo2, Trash2, Route } from 'lucide-react'
import { longitudDe, enKm } from '../utils/ruta'
import './DibujarRuta.css'

/*
 * Dibujar el trazado de una ruta sobre el mapa.
 *
 * Una ruta o un tramo no es un punto: es un recorrido. Enseñarlo con un
 * único marcador es como anunciar una carretera con una chincheta. Aquí
 * el organizador va marcando el camino y se guarda la línea entera.
 *
 * Los puntos se guardan como pares [lat, lng] porque es lo que espera
 * Leaflet, que es quien los pinta. GeoJSON usa el orden contrario,
 * [lng, lat], y esa inversión es la fuente clásica de rutas dibujadas
 * en mitad del mar.
 */

const Capturador = ({ onPunto }) => {
  useMapEvents({
    click(e) {
      onPunto([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

const DibujarRuta = ({ puntos = [], onCambio, centro }) => {
  const distancia = useMemo(() => longitudDe(puntos), [puntos])

  const anadir = (p) => onCambio([...puntos, p])
  const deshacer = () => onCambio(puntos.slice(0, -1))
  const limpiar = () => onCambio([])

  const centroMapa = puntos.length
    ? puntos[0]
    : centro && centro[0]
      ? centro
      : [40.4168, -3.7038]

  return (
    <div className='ruta'>
      <div className='ruta-mapa'>
        <MapContainer
          center={centroMapa}
          zoom={puntos.length ? 13 : 6}
          minZoom={5}
          maxZoom={18}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            attribution='&copy; OpenStreetMap'
            maxZoom={18}
          />
          <Capturador onPunto={anadir} />

          {puntos.length > 1 && (
            <Polyline
              positions={puntos}
              pathOptions={{ color: '#D02A24', weight: 5, opacity: 0.9 }}
            />
          )}

          {/* El primero y el último se distinguen: salida y meta. Los de
              en medio solo marcan por dónde pasa. */}
          {puntos.map((p, i) => (
            <CircleMarker
              key={`${p[0]}-${p[1]}-${i}`}
              center={p}
              radius={i === 0 || i === puntos.length - 1 ? 8 : 5}
              pathOptions={{
                color: '#0E0E10',
                weight: 2,
                fillColor:
                  i === 0 ? '#2FBF6E' : i === puntos.length - 1 ? '#D02A24' : '#F4F4F3',
                fillOpacity: 1,
              }}
            />
          ))}
        </MapContainer>
      </div>

      <div className='ruta-barra'>
        <div className='ruta-datos'>
          <Route size={18} aria-hidden='true' />
          <span className='datos'>
            {puntos.length} {puntos.length === 1 ? 'punto' : 'puntos'}
          </span>
          {distancia > 0 && (
            <span className='ruta-distancia datos'>{enKm(distancia)}</span>
          )}
        </div>

        <div className='ruta-botones'>
          <Button
            type='button'
            icon={<Undo2 size={16} />}
            label='Deshacer'
            text
            disabled={!puntos.length}
            onClick={deshacer}
          />
          <Button
            type='button'
            icon={<Trash2 size={16} />}
            label='Borrar'
            text
            severity='danger'
            disabled={!puntos.length}
            onClick={limpiar}
          />
        </div>
      </div>

      <p className='ruta-ayuda'>
        Pincha en el mapa para ir marcando el recorrido. El primer punto
        es la salida y el último la meta.
      </p>
    </div>
  )
}

export default DibujarRuta
