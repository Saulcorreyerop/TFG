import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, MapPin, ArrowRight, CalendarPlus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import './ZonaProvincias.css'

const MotionButton = motion.button

/*
 * Selector de provincia.
 *
 * Sustituye a la antigua sección de cuatro tarjetas decorativas, que
 * ocupaba una pantalla entera sin hacer nada. Esto responde a la primera
 * pregunta que se hace quien entra: "¿hay algo cerca de mí?".
 *
 * Las provincias no están escritas a mano: se sacan de los eventos futuros
 * reales, así que la lista se mantiene sola y nunca ofrece una zona vacía.
 *
 * La columna ubicacion se guarda como "Ciudad, Provincia" (AddEventDialog),
 * así que agrupamos por el último segmento y caemos al primero si no hay
 * coma. EventsPage filtra por coincidencia normalizada, de modo que el
 * slug de la URL encaja igual si la zona es ciudad o provincia.
 */

const quitarTildes = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const aSlug = (t) =>
  quitarTildes(t)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const ZonaProvincias = () => {
  const navigate = useNavigate()
  const [ubicaciones, setUbicaciones] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('ubicacion')
        .gte('fecha', new Date().toISOString())
        .not('ubicacion', 'is', null)

      if (!activo) return
      setUbicaciones(error ? [] : data.map((e) => e.ubicacion))
    }

    cargar()
    return () => {
      activo = false
    }
  }, [])

  const zonas = useMemo(() => {
    if (!ubicaciones) return null

    const cuenta = new Map()
    for (const u of ubicaciones) {
      if (!u) continue
      const partes = u.split(',').map((p) => p.trim()).filter(Boolean)
      const zona = partes.length > 1 ? partes[partes.length - 1] : partes[0]
      if (!zona) continue
      const clave = quitarTildes(zona)
      const previo = cuenta.get(clave)
      cuenta.set(clave, { nombre: previo?.nombre || zona, total: (previo?.total || 0) + 1 })
    }

    return [...cuenta.values()].sort((a, b) => b.total - a.total)
  }, [ubicaciones])

  const buscar = (e) => {
    e.preventDefault()
    const limpio = busqueda.trim()
    navigate(limpio ? `/eventos/${aSlug(limpio)}` : '/eventos')
  }

  const cargando = zonas === null

  return (
    <section className='zonas'>
      <div className='zonas-caja'>
        <header className='zonas-cabecera'>
          <div>
            <span className='rotulo'>Encuentra tu zona</span>
            <h2 className='zonas-titulo'>¿Dónde ruedas?</h2>
          </div>

          <form className='zonas-buscador' onSubmit={buscar} role='search'>
            <label className='sr-solo' htmlFor='buscar-zona'>
              Buscar por provincia o ciudad
            </label>
            <Search size={18} className='zonas-lupa' aria-hidden='true' />
            <input
              id='buscar-zona'
              type='search'
              className='zonas-input'
              placeholder='Madrid, Valencia, Sevilla…'
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button type='submit' className='zonas-ir' aria-label='Buscar eventos'>
              <ArrowRight size={18} />
            </button>
          </form>
        </header>

        {cargando && (
          <div className='zonas-rejilla' aria-hidden='true'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className='zona-hueco' key={i} />
            ))}
          </div>
        )}

        {!cargando && zonas.length > 0 && (
          <>
            <div className='zonas-rejilla'>
              {zonas.slice(0, 11).map((z, i) => (
                <MotionButton
                  key={z.nombre}
                  type='button'
                  className='zona'
                  onClick={() => navigate(`/eventos/${aSlug(z.nombre)}`)}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
                >
                  <span className='zona-total datos'>{z.total}</span>
                  <span className='zona-nombre'>{z.nombre}</span>
                  <span className='zona-pie'>
                    {z.total === 1 ? 'evento' : 'eventos'}
                  </span>
                  <MapPin size={16} className='zona-pin' aria-hidden='true' />
                </MotionButton>
              ))}

              <button
                type='button'
                className='zona zona-todas'
                onClick={() => navigate('/eventos')}
              >
                <span className='zona-nombre'>Ver todas</span>
                <ArrowRight size={20} className='zona-flecha' aria-hidden='true' />
              </button>
            </div>

            <p className='zonas-nota'>
              {zonas.length === 1
                ? 'Hay eventos en 1 zona ahora mismo.'
                : `Hay eventos en ${zonas.length} zonas ahora mismo.`}{' '}
              ¿No está la tuya?{' '}
              <button
                type='button'
                className='zonas-enlace'
                onClick={() => navigate('/eventos')}
              >
                Monta el primero
              </button>
              .
            </p>
          </>
        )}

        {!cargando && zonas.length === 0 && (
          <div className='zonas-vacio'>
            <CalendarPlus size={32} className='zonas-vacio-icono' aria-hidden='true' />
            <h3 className='zonas-vacio-titulo'>Aún no hay nada en el calendario</h3>
            <p className='zonas-vacio-texto'>
              Sé el primero en montar una quedada. En cuanto haya eventos,
              aquí aparecerán las zonas con más movimiento.
            </p>
            <button
              type='button'
              className='btn-librea'
              onClick={() => navigate('/eventos')}
            >
              Crear el primer evento
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default ZonaProvincias
