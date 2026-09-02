import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import './LightboxFotos.css'

/*
 * Visor de fotos a pantalla completa.
 *
 * Sustituye al Dialog + Galleria de PrimeReact que había en el garaje y
 * en los dos perfiles. Motivos:
 *
 *   · El de PrimeReact metía una cabecera blanca y una tira de miniaturas
 *     con fondo negro fijo (rgba(0,0,0,0.9) escrito a fuego en el tema),
 *     así que en tema claro salía una franja negra sin venir a cuento.
 *   · La foto quedaba encajada en un diálogo de 800px cuando lo que se
 *     quiere al pulsar sobre un coche es verlo grande.
 *   · Ahorra el chunk de Galleria, que son 32 KB.
 *
 * Teclado: flechas para moverse, Esc para salir. Se bloquea el scroll del
 * fondo mientras está abierto y se devuelve el foco al cerrar, que es lo
 * que se espera de una capa modal.
 */

const LightboxFotos = ({ fotos, titulo, subtitulo, inicial = 0, onCerrar }) => {
  const [indice, setIndice] = useState(inicial)
  const [cargando, setCargando] = useState(true)
  const contenedor = useRef(null)
  const focoPrevio = useRef(null)

  const total = fotos?.length || 0

  const ir = useCallback(
    (paso) => {
      if (total < 2) return
      setCargando(true)
      setIndice((i) => (i + paso + total) % total)
    },
    [total],
  )

  /* Teclado */
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [ir, onCerrar])

  /* Bloquear el fondo y devolver el foco al cerrar */
  useEffect(() => {
    focoPrevio.current = document.activeElement
    const desbordeAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    contenedor.current?.focus()

    return () => {
      document.body.style.overflow = desbordeAnterior
      focoPrevio.current?.focus?.()
    }
  }, [])

  /* Precarga de la siguiente: al pulsar la flecha ya está en caché */
  useEffect(() => {
    if (total < 2) return
    const siguiente = new Image()
    siguiente.src = fotos[(indice + 1) % total]
  }, [indice, fotos, total])

  if (!fotos || total === 0) return null

  return createPortal(
    <div
      className='visor'
      role='dialog'
      aria-modal='true'
      aria-label={titulo ? `Fotos de ${titulo}` : 'Galería de fotos'}
      ref={contenedor}
      tabIndex={-1}
    >
      {/* Pulsar fuera cierra */}
      <button
        type='button'
        className='visor-fondo'
        onClick={onCerrar}
        aria-label='Cerrar galería'
        tabIndex={-1}
      />

      <header className='visor-cabecera'>
        <div className='visor-identidad'>
          {titulo && <h2 className='visor-titulo'>{titulo}</h2>}
          {subtitulo && <span className='visor-subtitulo'>{subtitulo}</span>}
        </div>

        <div className='visor-controles'>
          <span className='visor-contador datos'>
            {String(indice + 1).padStart(2, '0')}
            <span className='visor-barra'>/</span>
            {String(total).padStart(2, '0')}
          </span>
          <button
            type='button'
            className='visor-cerrar'
            onClick={onCerrar}
            aria-label='Cerrar'
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className='visor-escena'>
        {total > 1 && (
          <button
            type='button'
            className='visor-flecha izquierda'
            onClick={() => ir(-1)}
            aria-label='Foto anterior'
          >
            <ChevronLeft size={26} />
          </button>
        )}

        <figure className='visor-marco'>
          {cargando && <span className='visor-cargando' aria-hidden='true' />}
          <img
            key={fotos[indice]}
            src={fotos[indice]}
            alt={`${titulo || 'Foto'} — ${indice + 1} de ${total}`}
            onLoad={() => setCargando(false)}
            decoding='async'
          />
        </figure>

        {total > 1 && (
          <button
            type='button'
            className='visor-flecha derecha'
            onClick={() => ir(1)}
            aria-label='Foto siguiente'
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {total > 1 && (
        <nav className='visor-tira' aria-label='Miniaturas'>
          {fotos.map((foto, i) => (
            <button
              key={foto}
              type='button'
              className={`visor-miniatura ${i === indice ? 'activa' : ''}`}
              onClick={() => {
                setCargando(true)
                setIndice(i)
              }}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === indice}
            >
              <img src={foto} alt='' loading='lazy' decoding='async' />
            </button>
          ))}
        </nav>
      )}
    </div>,
    document.body,
  )
}

export default LightboxFotos
