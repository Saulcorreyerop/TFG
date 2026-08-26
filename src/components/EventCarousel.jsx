import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toast } from 'primereact/toast'
import { Avatar } from 'primereact/avatar'
import {
  CalendarDays,
  MapPin,
  Plus,
  Heart,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useFavorites } from '../hooks/useFavorites'
import AddEventDialog from './AddEventDialog'
import './EventCarousel.css'

const MotionArticle = motion.article

/*
 * Próximas quedadas.
 *
 * Cambios respecto a la versión anterior:
 *   · Fuera el Carousel de PrimeReact. Ahora es una tira con scroll-snap
 *     nativo: se arrastra con el dedo como se espera en un móvil, no
 *     depende de un componente pesado y las flechas son un extra para
 *     ratón, no el único modo de moverse.
 *   · La foto crece y el texto va encima, no debajo en una caja aparte.
 *   · La fecha se presenta como un taco de día y mes, que se lee de un
 *     vistazo mejor que "14 mar, 10:00" en una línea de texto.
 *   · La sesión llega por props; antes pedía la suya con getSession.
 */

const FOTO_RESERVA =
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80'

/* --- Tarjeta --- */

const TarjetaEvento = ({ evento, session, alAvisar }) => {
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    evento.id,
    session,
  )

  const fecha = new Date(evento.fecha)
  const dia = fecha.getDate()
  const mes = fecha
    .toLocaleDateString('es-ES', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  const hora = fecha.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const guardar = (e) => {
    e.stopPropagation()
    if (!session) {
      alAvisar()
      return
    }
    toggleFavorite(e)
  }

  return (
    <MotionArticle
      className='ev-tarjeta'
      onClick={() => navigate(`/evento/${evento.id}`)}
      role='link'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/evento/${evento.id}`)
      }}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35 }}
    >
      <div className='ev-foto'>
        <img
          src={evento.imagen}
          alt={evento.titulo}
          loading='lazy'
          decoding='async'
        />

        <div className='ev-fecha'>
          <span className='ev-fecha-dia datos'>{dia}</span>
          <span className='ev-fecha-mes'>{mes}</span>
        </div>

        {evento.is_private && (
          <span className='ev-crew'>
            <Lock size={11} /> Crew
          </span>
        )}

        <button
          type='button'
          className={`ev-guardar ${isFavorite ? 'activo' : ''}`}
          onClick={guardar}
          disabled={loading}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Quitar de guardados' : 'Guardar evento'}
        >
          <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className='ev-cuerpo'>
        {evento.tipo && <span className='ev-tipo'>{evento.tipo}</span>}

        <h3 className='ev-titulo'>{evento.titulo}</h3>

        <div className='ev-datos datos'>
          <span className='ev-dato'>
            <CalendarDays size={13} aria-hidden='true' />
            {hora}
          </span>
          {evento.ubicacion && (
            <span className='ev-dato'>
              <MapPin size={13} aria-hidden='true' />
              {evento.ubicacion.split(',')[0].trim()}
            </span>
          )}
        </div>

        <div className='ev-pie'>
          <Avatar
            image={evento.profiles?.avatar_url}
            icon={!evento.profiles?.avatar_url ? 'pi pi-user' : null}
            shape='circle'
            className='ev-avatar'
          />
          <span className='ev-autor'>
            {evento.profiles?.username || 'Piloto'}
          </span>
        </div>
      </div>
    </MotionArticle>
  )
}

/* --- Sección --- */

const EventCarousel = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)
  const tira = useRef(null)
  const [eventos, setEventos] = useState(null)
  const [dialogo, setDialogo] = useState(false)
  /* Se incrementa al crear un evento para que el efecto vuelva a cargar,
     en vez de llamar a la carga desde fuera del efecto. */
  const [refresco, setRefresco] = useState(0)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      let misCrews = []
      if (session?.user?.id) {
        const { data } = await supabase
          .from('crew_members')
          .select('crew_id')
          .eq('user_id', session.user.id)
          .eq('status', 'approved')
        if (data) misCrews = data.map((c) => c.crew_id)
      }

      let consulta = supabase
        .from('events')
        .select(
          'id, titulo, tipo, fecha, ubicacion, image_url, is_private, profiles(username, avatar_url)',
        )
        .gte('fecha', new Date().toISOString())
        .order('fecha', { ascending: true })

      consulta =
        misCrews.length > 0
          ? consulta.or(
              `is_private.is.null,is_private.eq.false,crew_id.in.(${misCrews.join(',')})`,
            )
          : consulta.or('is_private.is.null,is_private.eq.false')

      const { data, error } = await consulta.limit(9)
      if (!activo) return

      if (error) {
        setEventos([])
        return
      }

      setEventos(
        (data || []).map((ev) => ({
          ...ev,
          imagen:
            typeof ev.image_url === 'string' &&
            ev.image_url.trim().startsWith('http')
              ? ev.image_url.trim()
              : FOTO_RESERVA,
        })),
      )
    }

    cargar()
    return () => {
      activo = false
    }
  }, [session, refresco])

  const desplazar = (sentido) => {
    if (!tira.current) return
    const paso = tira.current.clientWidth * 0.8
    tira.current.scrollBy({ left: paso * sentido, behavior: 'smooth' })
  }

  const avisarSinSesion = () =>
    toast.current?.show({
      severity: 'info',
      summary: 'Necesitas una cuenta',
      detail: 'Entra para guardar eventos y que no se te escapen.',
      life: 3000,
    })

  const crear = () => {
    if (!session) {
      navigate('/login', { state: { returnUrl: '/eventos' } })
      return
    }
    setDialogo(true)
  }

  const cargando = eventos === null

  return (
    <section className='eventos'>
      <Toast ref={toast} position='top-center' />

      <div className='eventos-caja'>
        <header className='eventos-cabecera'>
          <div>
            <span className='rotulo'>Calendario</span>
            <h2 className='eventos-titulo'>Próximas quedadas</h2>
          </div>

          <div className='eventos-controles'>
            {!cargando && eventos.length > 1 && (
              <div className='eventos-flechas'>
                <button
                  type='button'
                  onClick={() => desplazar(-1)}
                  aria-label='Anterior'
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type='button'
                  onClick={() => desplazar(1)}
                  aria-label='Siguiente'
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            <button type='button' className='btn-librea' onClick={crear}>
              <Plus size={18} />
              Crear evento
            </button>
          </div>
        </header>

        {cargando && (
          <div className='eventos-tira' aria-hidden='true'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div className='ev-hueco' key={i} />
            ))}
          </div>
        )}

        {!cargando && eventos.length > 0 && (
          <div className='eventos-tira' ref={tira}>
            {eventos.map((ev) => (
              <TarjetaEvento
                key={ev.id}
                evento={ev}
                session={session}
                alAvisar={avisarSinSesion}
              />
            ))}
          </div>
        )}

        {!cargando && eventos.length === 0 && (
          <div className='eventos-vacio'>
            <CalendarDays size={32} aria-hidden='true' />
            <h3>El calendario está vacío</h3>
            <p>
              No hay ninguna quedada programada todavía. Monta la primera y
              aparecerá aquí y en el mapa.
            </p>
            <button type='button' className='btn-librea' onClick={crear}>
              <Plus size={18} />
              Crear la primera
            </button>
          </div>
        )}
      </div>

      <AddEventDialog
        visible={dialogo}
        onHide={() => setDialogo(false)}
        session={session}
        onEventAdded={() => {
          setDialogo(false)
          setRefresco((n) => n + 1)
        }}
      />
    </section>
  )
}

export default EventCarousel
