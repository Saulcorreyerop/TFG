import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { Flag, Ban } from 'lucide-react'
import { useDenuncia, useBloqueo, MOTIVOS } from '../hooks/useModeracion'
import './BotonDenunciar.css'

/*
 * Botón de denuncia, reutilizable en eventos, comentarios, mensajes,
 * perfiles y vehículos.
 *
 * Incluye también el bloqueo cuando se le pasa el autor, porque son las
 * dos caras de lo mismo: denunciar es para que lo mire un moderador,
 * bloquear es para no volver a verlo tú, y no depende de nadie.
 *
 * Props:
 *   tipo     'evento' | 'comentario' | 'mensaje_global' | 'mensaje_crew'
 *            | 'perfil' | 'vehiculo'
 *   id       identificador del contenido
 *   autorId  opcional; si se pasa, se ofrece bloquear a esa persona
 *   autor    nombre para el texto del bloqueo
 *   compacto solo el icono, sin etiqueta
 */

const BotonDenunciar = ({
  tipo,
  id,
  autorId = null,
  autor = 'este usuario',
  session,
  compacto = false,
  onBloqueado,
}) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const { denunciar, enviando } = useDenuncia(session)
  const { bloqueados, bloquear } = useBloqueo(session)

  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('spam')
  const [detalle, setDetalle] = useState('')

  const esPropio = autorId && session?.user?.id === autorId
  const yaBloqueado = autorId && bloqueados.has(autorId)

  // No tiene sentido denunciarse a uno mismo
  if (esPropio) return null

  const abrir = () => {
    if (!session) {
      navigate('/login', { state: { returnUrl: window.location.pathname } })
      return
    }
    setMotivo('spam')
    setDetalle('')
    setAbierto(true)
  }

  const enviar = async (e) => {
    e.preventDefault()
    const resultado = await denunciar({ tipo, id, motivo, detalle })

    toast.current?.show({
      severity: resultado.ok ? 'success' : 'error',
      summary: resultado.ok ? 'Recibido' : 'No se ha podido enviar',
      detail: resultado.mensaje,
      life: 4000,
    })

    if (resultado.ok) setAbierto(false)
  }

  const hacerBloqueo = async () => {
    const hecho = await bloquear(autorId)
    toast.current?.show({
      severity: hecho ? 'success' : 'error',
      summary: hecho ? 'Usuario bloqueado' : 'No se ha podido bloquear',
      detail: hecho
        ? `Ya no verás contenido de ${autor}. Puedes deshacerlo desde tu perfil.`
        : 'Inténtalo de nuevo en un momento.',
      life: 4000,
    })
    if (hecho) {
      setAbierto(false)
      onBloqueado?.(autorId)
    }
  }

  return (
    <>
      <Toast ref={toast} position='top-center' />

      <button
        type='button'
        className={`btn-denunciar ${compacto ? 'compacto' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          abrir()
        }}
        aria-label='Denunciar contenido'
        title='Denunciar'
      >
        <Flag size={compacto ? 14 : 16} />
        {!compacto && <span>Denunciar</span>}
      </button>

      <Dialog
        visible={abierto}
        onHide={() => setAbierto(false)}
        header='Denunciar contenido'
        className='dialogo-denuncia'
        dismissableMask
        draggable={false}
        style={{ width: 'min(26rem, 92vw)' }}
      >
        <form onSubmit={enviar} className='denuncia-form'>
          <p className='denuncia-intro'>
            Cuéntanos qué pasa. Lo revisa una persona, y no se le dice a
            nadie quién ha denunciado.
          </p>

          <fieldset className='denuncia-motivos'>
            <legend className='rotulo'>Motivo</legend>
            {MOTIVOS.map((m) => (
              <label key={m.valor} className='denuncia-motivo'>
                <input
                  type='radio'
                  name='motivo'
                  value={m.valor}
                  checked={motivo === m.valor}
                  onChange={(e) => setMotivo(e.target.value)}
                />
                <span>{m.etiqueta}</span>
              </label>
            ))}
          </fieldset>

          <label className='denuncia-detalle'>
            <span className='rotulo'>Detalles (opcional)</span>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder='Algo que ayude a entender el problema'
            />
            <span className='denuncia-contador datos'>{detalle.length}/500</span>
          </label>

          <div className='denuncia-acciones'>
            <button
              type='button'
              className='denuncia-cancelar'
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </button>
            <button type='submit' className='btn-librea' disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar denuncia'}
            </button>
          </div>

          {autorId && !yaBloqueado && (
            <div className='denuncia-bloqueo'>
              <p>
                ¿Prefieres no volver a ver nada de <strong>{autor}</strong>?
              </p>
              <button
                type='button'
                className='denuncia-bloquear'
                onClick={hacerBloqueo}
              >
                <Ban size={15} />
                Bloquear a {autor}
              </button>
            </div>
          )}
        </form>
      </Dialog>
    </>
  )
}

export default BotonDenunciar
