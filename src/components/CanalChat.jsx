import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Radio, Send, ArrowDown, MessageSquare } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useBloqueo } from '../hooks/useModeracion'
import BotonDenunciar from './BotonDenunciar'
import './CanalChat.css'

/*
 * Registro de canal. Lo usan el chat global y el chat de cada crew: es
 * el mismo comportamiento con distinta tabla, así que vive en un sitio.
 *
 * Idioma de canal, no de mensajería uno a uno: todo a la izquierda,
 * autor a la cabeza, mensajes seguidos del mismo autor agrupados, y lo
 * propio marcado con un filo de librea en vez de con un color de fondo.
 *
 * Props:
 *   session        sesión de Supabase (obligatoria: sin ella no se monta)
 *   tabla          'global_messages' | 'crew_messages'
 *   crewId         solo para crew_messages
 *   tipoDenuncia   'mensaje_global' | 'mensaje_crew'
 *   titulo         cabecera del canal
 *   estado         texto pequeño junto al indicador de directo
 *
 * Quien decide si el usuario puede estar aquí es la página que lo monta
 * y, sobre todo, las políticas RLS de la tabla. Este componente no
 * comprueba permisos: si la lectura falla, lo dice y no se inventa nada.
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

const CanalChat = ({
  session,
  tabla,
  crewId = null,
  tipoDenuncia,
  titulo = 'Canal',
  estado = 'En directo',
}) => {
  const navigate = useNavigate()

  const [mensajes, setMensajes] = useState(null)
  const [error, setError] = useState(null)
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
    if (!session || !tabla) return
    if (tabla === 'crew_messages' && !crewId) return
    let activo = true

    const cargar = async () => {
      let consulta = supabase
        .from(tabla)
        .select('id, user_id, mensaje, created_at, profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (crewId) consulta = consulta.eq('crew_id', crewId)

      const { data, error: fallo } = await consulta
      if (!activo) return

      if (fallo) {
        console.error('No se han podido cargar los mensajes:', fallo)
        setError('No se ha podido abrir el canal.')
        setMensajes([])
        return
      }

      // Se piden los últimos 100 en orden inverso y se les da la vuelta:
      // así el límite recorta lo viejo, no lo nuevo.
      setMensajes((data || []).reverse())
    }

    cargar()

    const nombreCanal = crewId ? `chat_crew_${crewId}` : `chat_${tabla}`
    const suscripcion = {
      event: 'INSERT',
      schema: 'public',
      table: tabla,
      ...(crewId ? { filter: `crew_id=eq.${crewId}` } : {}),
    }

    const canal = supabase
      .channel(nombreCanal)
      .on('postgres_changes', suscripcion, async (payload) => {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', payload.new.user_id)
          .maybeSingle()

        if (!activo) return

        setMensajes((previos) => {
          const lista = previos || []
          if (lista.some((m) => m.id === payload.new.id)) return lista

          // Es el propio que aún no tenía id definitivo
          if (
            payload.new.user_id === miId &&
            lista.some((m) => m.pendiente && m.mensaje === payload.new.mensaje)
          ) {
            return lista.map((m) =>
              m.pendiente && m.mensaje === payload.new.mensaje
                ? { ...payload.new, profiles: perfil, pendiente: false }
                : m,
            )
          }
          return [...lista, { ...payload.new, profiles: perfil }]
        })
      })
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [session, tabla, crewId, miId])

  /* --- Desplazamiento --- */

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
    const abajo = el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL
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

    const fila = { user_id: miId, mensaje: limpio }
    if (crewId) fila.crew_id = crewId

    const { data, error: fallo } = await supabase
      .from(tabla)
      .insert(fila)
      .select('id, user_id, mensaje, created_at')
      .single()

    setEnviando(false)

    if (fallo) {
      // Fuera el provisional: si no, el autor cree que ha escrito algo
      // que no ha llegado a nadie.
      setMensajes((prev) => prev.filter((m) => m.id !== provisional.id))
      setTexto(limpio)
      campo.current?.focus()

      // P0001: limitador de ritmo. 42501: la política RLS lo ha rechazado.
      setAviso(
        fallo.code === 'P0001'
          ? 'Vas muy rápido. Espera unos segundos antes de volver a escribir.'
          : fallo.code === '42501'
            ? 'No tienes permiso para escribir en este canal.'
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
    <div className='canal'>
      <header className='canal-cabecera'>
        <div className='canal-identidad'>
          <span className='canal-directo'>
            <Radio size={13} aria-hidden='true' />
            {estado}
          </span>
          <h2 className='canal-titulo'>{titulo}</h2>
        </div>
        <span className='canal-aforo datos'>
          {visibles.length}
          <span className='canal-aforo-etiqueta'>mensajes</span>
        </span>
      </header>

      <div
        className='canal-registro'
        ref={registro}
        onScroll={alDesplazar}
        role='log'
        aria-live='polite'
        aria-label={`Mensajes de ${titulo}`}
      >
        {cargando && (
          <div className='canal-cargando' aria-hidden='true'>
            {Array.from({ length: 5 }).map((_, i) => (
              <div className='canal-hueco' key={i} />
            ))}
          </div>
        )}

        {!cargando && error && (
          <div className='canal-vacio'>
            <MessageSquare size={30} aria-hidden='true' />
            <h3>{error}</h3>
            <p>Si crees que deberías poder entrar, recarga la página.</p>
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className='canal-vacio'>
            <MessageSquare size={30} aria-hidden='true' />
            <h3>El canal está en silencio</h3>
            <p>Rompe el hielo. Escribe lo primero que se te ocurra.</p>
          </div>
        )}

        {filas.map((f) =>
          f.tipo === 'dia' ? (
            <div className='canal-dia' key={f.clave}>
              <span>{f.etiqueta}</span>
            </div>
          ) : (
            <article
              key={f.clave}
              className={[
                'canal-msg',
                f.m.user_id === miId ? 'propio' : '',
                f.seguido ? 'seguido' : '',
                f.m.pendiente ? 'pendiente' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className='canal-hueco-avatar'>
                {!f.seguido ? (
                  <Avatar
                    image={f.m.profiles?.avatar_url}
                    icon={!f.m.profiles?.avatar_url ? 'pi pi-user' : null}
                    shape='circle'
                    className='canal-avatar'
                  />
                ) : (
                  <time className='canal-hora-lateral datos' dateTime={f.m.created_at}>
                    {hora(f.fecha)}
                  </time>
                )}
              </div>

              <div className='canal-cuerpo'>
                {!f.seguido && (
                  <div className='canal-meta'>
                    <button
                      type='button'
                      className='canal-autor'
                      onClick={() =>
                        f.m.profiles?.username &&
                        navigate(`/usuario/${f.m.profiles.username}`)
                      }
                    >
                      {f.m.profiles?.username || 'Piloto'}
                    </button>
                    <time className='canal-hora datos' dateTime={f.m.created_at}>
                      {hora(f.fecha)}
                    </time>
                    {f.m.user_id !== miId && !f.m.pendiente && (
                      <BotonDenunciar
                        tipo={tipoDenuncia}
                        id={f.m.id}
                        autorId={f.m.user_id}
                        autor={f.m.profiles?.username || 'este piloto'}
                        session={session}
                        compacto
                      />
                    )}
                  </div>
                )}
                <p className='canal-texto'>{f.m.mensaje}</p>
              </div>
            </article>
          ),
        )}
      </div>

      {!alFinal && (
        <button
          type='button'
          className='canal-bajar'
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
        <p className='canal-aviso' role='alert'>
          {aviso}
        </p>
      )}

      <form className='canal-redactor' onSubmit={enviar}>
        <label className='sr-solo' htmlFor={`canal-texto-${crewId || 'global'}`}>
          Escribe un mensaje
        </label>
        <input
          id={`canal-texto-${crewId || 'global'}`}
          ref={campo}
          className='canal-campo'
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder='Escribe algo para el canal…'
          autoComplete='off'
          disabled={!!error}
        />

        {restantes <= 120 && (
          <span className={`canal-restantes datos ${restantes <= 20 ? 'apurado' : ''}`}>
            {restantes}
          </span>
        )}

        <button
          type='submit'
          className='canal-enviar'
          disabled={!texto.trim() || enviando || !!error}
          aria-label='Enviar mensaje'
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

export default CanalChat
