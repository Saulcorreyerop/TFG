import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Radio, Send, ArrowDown, Lock, MessageSquare } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useBloqueo } from '../hooks/useModeracion'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import BotonDenunciar from '../components/BotonDenunciar'
import './GlobalChatPage.css'

/*
 * Chat global.
 *
 * Se abandona el formato de burbujas alineadas a izquierda y derecha. Ese
 * idioma viene de la mensajería uno a uno y aquí estorba: en un canal
 * público con mucha gente, media pantalla se queda vacía y cuesta seguir
 * quién habla. Se pasa a un registro de canal, con todo alineado a la
 * izquierda y el autor a la cabeza, que es lo que usan las herramientas
 * pensadas para grupos.
 *
 * Lo que gana:
 *   · Mensajes seguidos de la misma persona se agrupan y no repiten
 *     avatar ni nombre.
 *   · Separadores de día.
 *   · Los propios se marcan con un filo de librea, no con un color de
 *     fondo distinto.
 *   · Botón de bajar cuando estás leyendo hacia atrás, en vez de saltar
 *     al final cada vez que llega algo.
 *
 * Arreglado de paso: los mensajes propios enviados desde otro dispositivo
 * no aparecían nunca, porque el escuchador descartaba todo lo que llevara
 * tu user_id. Ahora se descartan duplicados de verdad, comparando id.
 */

const MAX = 1000
const CERCA_DEL_FINAL = 120

const mismoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const etiquetaDia = (fecha) => {
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)

  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, ayer)) return 'Ayer'

  return fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
  })
}

const hora = (fecha) =>
  fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

const GlobalChatPage = ({ session }) => {
  const navigate = useNavigate()

  const [mensajes, setMensajes] = useState(null)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [alFinal, setAlFinal] = useState(true)
  const [sinLeer, setSinLeer] = useState(0)

  const registro = useRef(null)
  const campo = useRef(null)

  const { filtrar } = useBloqueo(session)

  const miId = session?.user?.id
  const miNombre = session?.user?.user_metadata?.username

  /* --- Carga y tiempo real --- */

  useEffect(() => {
    if (!session) return
    let activo = true

    const cargar = async () => {
      const { data, error } = await supabase
        .from('global_messages')
        .select('id, user_id, mensaje, created_at, profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!activo) return

      if (error) {
        console.error('No se han podido cargar los mensajes:', error)
        setMensajes([])
        return
      }

      // Se piden los últimos 100 en orden inverso y se les da la vuelta:
      // así el límite recorta lo viejo, no lo nuevo.
      setMensajes((data || []).reverse())
    }

    cargar()

    const canal = supabase
      .channel('chat_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        async (payload) => {
          const { data: perfil } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .maybeSingle()

          if (!activo) return

          setMensajes((previos) => {
            const lista = previos || []
            // Ya está: o es el mismo id, o es el optimista propio que
            // todavía no ha recibido su id definitivo.
            if (lista.some((m) => m.id === payload.new.id)) return lista
            if (
              payload.new.user_id === miId &&
              lista.some(
                (m) => m.pendiente && m.mensaje === payload.new.mensaje,
              )
            ) {
              return lista.map((m) =>
                m.pendiente && m.mensaje === payload.new.mensaje
                  ? { ...payload.new, profiles: perfil, pendiente: false }
                  : m,
              )
            }
            return [...lista, { ...payload.new, profiles: perfil }]
          })
        },
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [session, miId])

  /* --- Desplazamiento ---
     Solo baja solo si ya estabas abajo. Si estás leyendo hacia atrás, se
     respeta tu posición y aparece un aviso de mensajes nuevos. */

  const bajar = useCallback((suave = true) => {
    const el = registro.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' })
    setSinLeer(0)
  }, [])

  useEffect(() => {
    if (!mensajes) return
    if (alFinal) bajar(false)
    else setSinLeer((n) => n + 1)
    // Solo cuando llegan mensajes nuevos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes?.length])

  const alDesplazar = () => {
    const el = registro.current
    if (!el) return
    const abajo =
      el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL
    setAlFinal(abajo)
    if (abajo) setSinLeer(0)
  }

  /* --- Envío --- */

  const enviar = async (e) => {
    e.preventDefault()
    const limpio = texto.trim().slice(0, MAX)
    if (!limpio || !session || enviando) return

    const provisional = {
      id: `tmp-${Date.now()}`,
      pendiente: true,
      user_id: miId,
      mensaje: limpio,
      created_at: new Date().toISOString(),
      profiles: {
        username: miNombre || 'Tú',
        avatar_url: session.user.user_metadata?.avatar_url || null,
      },
    }

    setTexto('')
    setAviso(null)
    setEnviando(true)
    setAlFinal(true)
    setMensajes((prev) => [...(prev || []), provisional])

    const { data, error } = await supabase
      .from('global_messages')
      .insert({ user_id: miId, mensaje: limpio })
      .select('id, user_id, mensaje, created_at')
      .single()

    setEnviando(false)

    if (error) {
      // Fuera el provisional: si no, el autor cree que ha escrito algo
      // que en realidad no ha llegado a nadie.
      setMensajes((prev) => prev.filter((m) => m.id !== provisional.id))
      setTexto(limpio)
      campo.current?.focus()

      // P0001 lo lanza el limitador de ritmo de la base de datos
      setAviso(
        error.code === 'P0001'
          ? 'Vas muy rápido. Espera unos segundos antes de volver a escribir.'
          : 'No se ha podido enviar. Inténtalo otra vez.',
      )
      return
    }

    setMensajes((prev) =>
      prev.map((m) =>
        m.id === provisional.id
          ? { ...m, id: data.id, created_at: data.created_at, pendiente: false }
          : m,
      ),
    )
  }

  /* --- Sin sesión --- */

  if (!session) {
    return (
      <>
        <SEO
          title='Chat Global'
          description='Habla en directo con toda la comunidad de CarMeet.'
          url={window.location.href}
        />
        <PageTransition>
          <div className='chat-cerrado'>
            <div className='chat-cerrado-caja'>
              <Lock size={28} aria-hidden='true' />
              <h1>Canal cerrado</h1>
              <p>
                El chat global es solo para gente registrada. Entra y únete a
                la conversación.
              </p>
              <button
                type='button'
                className='btn-librea'
                onClick={() =>
                  navigate('/login', { state: { returnUrl: '/chat-global' } })
                }
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </PageTransition>
      </>
    )
  }

  /* --- Registro --- */

  const visibles = filtrar(mensajes || [])
  const cargando = mensajes === null

  const filas = []
  let diaAnterior = null
  let autorAnterior = null
  let horaAnterior = null

  for (const m of visibles) {
    const fecha = new Date(m.created_at)

    if (!diaAnterior || !mismoDia(fecha, diaAnterior)) {
      filas.push({ tipo: 'dia', clave: `d-${m.id}`, etiqueta: etiquetaDia(fecha) })
      diaAnterior = fecha
      autorAnterior = null
    }

    // Se agrupan los seguidos del mismo autor dentro de cinco minutos
    const seguido =
      autorAnterior === m.user_id &&
      horaAnterior &&
      fecha - horaAnterior < 5 * 60 * 1000

    filas.push({ tipo: 'msg', clave: m.id, m, fecha, seguido })
    autorAnterior = m.user_id
    horaAnterior = fecha
  }

  const restantes = MAX - texto.length

  return (
    <>
      <SEO
        title='Chat Global'
        description='Habla en directo con toda la comunidad de CarMeet.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='chat'>
          <header className='chat-cabecera'>
            <div className='chat-identidad'>
              <span className='chat-directo'>
                <Radio size={13} aria-hidden='true' />
                En directo
              </span>
              <h1 className='chat-titulo'>Canal abierto</h1>
            </div>
            <span className='chat-aforo datos'>
              {visibles.length}
              <span className='chat-aforo-etiqueta'>mensajes</span>
            </span>
          </header>

          <div
            className='chat-registro'
            ref={registro}
            onScroll={alDesplazar}
            role='log'
            aria-live='polite'
            aria-label='Mensajes del canal'
          >
            {cargando && (
              <div className='chat-cargando' aria-hidden='true'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className='chat-hueco' key={i} />
                ))}
              </div>
            )}

            {!cargando && visibles.length === 0 && (
              <div className='chat-vacio'>
                <MessageSquare size={30} aria-hidden='true' />
                <h2>El canal está en silencio</h2>
                <p>Rompe el hielo. Escribe lo primero que se te ocurra.</p>
              </div>
            )}

            {filas.map((f) =>
              f.tipo === 'dia' ? (
                <div className='chat-dia' key={f.clave}>
                  <span>{f.etiqueta}</span>
                </div>
              ) : (
                <article
                  key={f.clave}
                  className={[
                    'chat-msg',
                    f.m.user_id === miId ? 'propio' : '',
                    f.seguido ? 'seguido' : '',
                    f.m.pendiente ? 'pendiente' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className='chat-hueco-avatar'>
                    {!f.seguido && (
                      <Avatar
                        image={f.m.profiles?.avatar_url}
                        icon={!f.m.profiles?.avatar_url ? 'pi pi-user' : null}
                        shape='circle'
                        className='chat-avatar'
                      />
                    )}
                    {f.seguido && (
                      <time className='chat-hora-lateral datos' dateTime={f.m.created_at}>
                        {hora(f.fecha)}
                      </time>
                    )}
                  </div>

                  <div className='chat-cuerpo'>
                    {!f.seguido && (
                      <div className='chat-meta'>
                        <button
                          type='button'
                          className='chat-autor'
                          onClick={() =>
                            f.m.profiles?.username &&
                            navigate(`/usuario/${f.m.profiles.username}`)
                          }
                        >
                          {f.m.profiles?.username || 'Piloto'}
                        </button>
                        <time className='chat-hora datos' dateTime={f.m.created_at}>
                          {hora(f.fecha)}
                        </time>
                        {f.m.user_id !== miId && (
                          <BotonDenunciar
                            tipo='mensaje_global'
                            id={f.m.id}
                            autorId={f.m.user_id}
                            autor={f.m.profiles?.username || 'este piloto'}
                            session={session}
                            compacto
                          />
                        )}
                      </div>
                    )}
                    <p className='chat-texto'>{f.m.mensaje}</p>
                  </div>
                </article>
              ),
            )}
          </div>

          {!alFinal && (
            <button
              type='button'
              className='chat-bajar'
              onClick={() => bajar()}
              aria-label='Ir al último mensaje'
            >
              <ArrowDown size={16} />
              {sinLeer > 0
                ? `${sinLeer} ${sinLeer === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`
                : 'Ir al final'}
            </button>
          )}

          {aviso && (
            <p className='chat-aviso' role='alert'>
              {aviso}
            </p>
          )}

          <form className='chat-redactor' onSubmit={enviar}>
            <label className='sr-solo' htmlFor='chat-texto'>
              Escribe un mensaje
            </label>
            <input
              id='chat-texto'
              ref={campo}
              className='chat-campo'
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
              maxLength={MAX}
              placeholder='Escribe algo para todo el canal…'
              autoComplete='off'
            />

            {/* El contador solo aparece cuando de verdad importa */}
            {restantes <= 120 && (
              <span
                className={`chat-restantes datos ${restantes <= 20 ? 'apurado' : ''}`}
              >
                {restantes}
              </span>
            )}

            <button
              type='submit'
              className='chat-enviar'
              disabled={!texto.trim() || enviando}
              aria-label='Enviar mensaje'
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </PageTransition>
    </>
  )
}

export default GlobalChatPage
