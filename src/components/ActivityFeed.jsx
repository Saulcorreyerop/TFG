import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Car, CalendarDays } from 'lucide-react'
import { Avatar } from 'primereact/avatar'
import { supabase } from '../supabaseClient'
import './ActivityFeed.css'

const MotionArticle = motion.article

/*
 * Muro en directo: lo último que se ha subido a la comunidad.
 *
 * Cambios respecto a la versión anterior:
 *   · La foto pasa a ser la tarjeta, no un recorte de 180px dentro de una
 *     caja con relleno. El texto va encima, sobre un degradado.
 *   · Se muestra cuándo pasó. Antes se calculaba created_at y no se
 *     llegaba a pintar en ninguna parte.
 *   · Si no hay actividad ya no desaparece la sección entera sin más:
 *     se dice que aún no hay nada, que es información útil para alguien
 *     que acaba de entrar.
 */

const haceCuanto = (fecha) => {
  const seg = Math.floor((Date.now() - fecha.getTime()) / 1000)
  if (seg < 60) return 'ahora'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const hor = Math.floor(min / 60)
  if (hor < 24) return `hace ${hor} h`
  const dia = Math.floor(hor / 24)
  if (dia < 7) return `hace ${dia} d`
  const sem = Math.floor(dia / 7)
  if (sem < 5) return `hace ${sem} sem`
  const mes = Math.floor(dia / 30)
  return `hace ${mes} mes${mes > 1 ? 'es' : ''}`
}

const ActivityFeed = () => {
  const navigate = useNavigate()
  const [actividad, setActividad] = useState(null)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      const [coches, eventos] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, marca, modelo, image_url, created_at, profiles(username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('events')
          .select('id, titulo, image_url, ubicacion, created_at, profiles(username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      if (!activo) return

      const lista = [
        ...(coches.data || []).map((c) => ({
          id: `coche-${c.id}`,
          tipo: 'coche',
          titulo: `${c.marca} ${c.modelo}`,
          detalle: null,
          usuario: c.profiles?.username || null,
          avatar: c.profiles?.avatar_url,
          imagen: c.image_url,
          fecha: new Date(c.created_at),
        })),
        ...(eventos.data || []).map((e) => ({
          id: `evento-${e.id}`,
          tipo: 'evento',
          titulo: e.titulo,
          detalle: e.ubicacion ? e.ubicacion.split(',')[0].trim() : null,
          usuario: e.profiles?.username || null,
          avatar: e.profiles?.avatar_url,
          imagen: e.image_url,
          fecha: new Date(e.created_at),
          eventoId: e.id,
        })),
      ]
        .sort((a, b) => b.fecha - a.fecha)
        .slice(0, 4)

      setActividad(lista)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [])

  const abrir = (item) => {
    if (item.tipo === 'evento') navigate(`/evento/${item.eventoId}`)
    else if (item.usuario) navigate(`/usuario/${item.usuario}`)
  }

  const cargando = actividad === null

  return (
    <section className='muro'>
      <div className='muro-caja'>
        <header className='muro-cabecera'>
          <div>
            <span className='rotulo'>
              <span className='muro-punto' aria-hidden='true' />
              Muro en directo
            </span>
            <h2 className='muro-titulo'>Lo último de la comunidad</h2>
          </div>
        </header>

        {cargando && (
          <div className='muro-rejilla' aria-hidden='true'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className='muro-hueco' key={i} />
            ))}
          </div>
        )}

        {!cargando && actividad.length > 0 && (
          <div className='muro-rejilla'>
            {actividad.map((item, i) => (
              <MotionArticle
                key={item.id}
                className='tarjeta-muro'
                onClick={() => abrir(item)}
                role='link'
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    abrir(item)
                  }
                }}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.3) }}
              >
                <div className='tarjeta-foto'>
                  {item.imagen ? (
                    <img
                      src={item.imagen}
                      alt={item.titulo}
                      loading='lazy'
                      decoding='async'
                    />
                  ) : (
                    <div className='tarjeta-sinfoto'>
                      {item.tipo === 'coche' ? (
                        <Car size={40} aria-hidden='true' />
                      ) : (
                        <CalendarDays size={40} aria-hidden='true' />
                      )}
                    </div>
                  )}

                  <span
                    className={`tarjeta-chapa ${item.tipo === 'evento' ? 'evento' : ''}`}
                  >
                    {item.tipo === 'coche' ? 'Garaje' : 'Evento'}
                  </span>

                  <span className='tarjeta-cuando datos'>
                    {haceCuanto(item.fecha)}
                  </span>
                </div>

                <div className='tarjeta-cuerpo'>
                  <h3 className='tarjeta-titulo'>{item.titulo}</h3>

                  <div className='tarjeta-pie'>
                    <Avatar
                      image={item.avatar}
                      icon={!item.avatar ? 'pi pi-user' : null}
                      shape='circle'
                      className='tarjeta-avatar'
                    />
                    <span className='tarjeta-autor'>
                      {item.usuario || 'Piloto'}
                    </span>
                    {item.detalle && (
                      <>
                        <span className='tarjeta-sep' aria-hidden='true' />
                        <span className='tarjeta-lugar'>{item.detalle}</span>
                      </>
                    )}
                  </div>
                </div>
              </MotionArticle>
            ))}
          </div>
        )}

        {!cargando && actividad.length === 0 && (
          <p className='muro-vacio'>
            Todavía no se ha subido nada. En cuanto alguien añada un coche o
            monte una quedada, aparecerá aquí.
          </p>
        )}
      </div>
    </section>
  )
}

export default ActivityFeed
