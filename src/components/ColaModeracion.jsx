import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { SelectButton } from 'primereact/selectbutton'
import { confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ExternalLink, Trash2, Check, X } from 'lucide-react'
import { MOTIVOS } from '../hooks/useModeracion'
import './ColaModeracion.css'

/*
 * Cola de denuncias del panel de administración.
 *
 * Desde el bloque 6 de SQL los usuarios pueden denunciar contenido, pero
 * las denuncias entraban en la tabla y ahí se quedaban: no había forma
 * de verlas. Moderación que nadie lee es peor que no tenerla, porque el
 * usuario cree que ha servido de algo.
 *
 * Se leen dos sitios a la vez:
 *
 *   cola_moderacion  la vista, que ya trae el texto del contenido
 *                    denunciado y quién lo escribió
 *   reports          la tabla cruda, para saber en qué columna está el
 *                    id y por tanto de qué tabla hay que borrar
 *
 * Se hace así en vez de fiarse del campo `tipo` de la vista porque el
 * borrado tiene que ser exacto: las columnas de `reports` las conozco,
 * el texto de la vista podría cambiar.
 */

/* La tabla de la que hay que borrar, y cómo construir el enlace para ir
   a verlo. El perfil no se borra desde aquí: eso es dar de baja a una
   persona, y para eso está la pestaña de usuarios. */
const TIPOS = {
  evento_id: {
    etiqueta: 'Evento',
    tabla: 'events',
    enlace: (id) => `/evento/${id}`,
  },
  comentario_id: {
    etiqueta: 'Comentario',
    tabla: 'event_comments',
  },
  mensaje_global_id: {
    etiqueta: 'Chat global',
    tabla: 'global_messages',
  },
  mensaje_crew_id: {
    etiqueta: 'Chat de crew',
    tabla: 'crew_messages',
  },
  vehiculo_id: {
    etiqueta: 'Coche',
    tabla: 'vehicles',
  },
  perfil_id: {
    etiqueta: 'Perfil',
    tabla: null,
  },
}

const ESTADOS = [
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Resueltas', value: 'resuelta' },
  { label: 'Descartadas', value: 'descartada' },
]

const etiquetaMotivo = (valor) =>
  MOTIVOS.find((m) => m.valor === valor)?.etiqueta || valor || '—'

const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ColaModeracion = ({ session, toast }) => {
  const [estado, setEstado] = useState('pendiente')
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupada, setOcupada] = useState(null)

  const avisar = useCallback(
    (severity, summary, detail) =>
      toast?.current?.show({ severity, summary, detail, life: 4000 }),
    [toast],
  )

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [vista, crudas] = await Promise.all([
        supabase
          .from('cola_moderacion')
          .select('id, tipo, motivo, detalle, estado, created_at, contenido, autor_id, denunciante')
          .eq('estado', estado)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('reports')
          .select(
            'id, evento_id, comentario_id, mensaje_global_id, mensaje_crew_id, perfil_id, vehiculo_id, reporter_id',
          )
          .eq('estado', estado)
          .limit(200),
      ])

      if (vista.error) throw vista.error
      if (crudas.error) throw crudas.error

      const porId = new Map((crudas.data || []).map((r) => [r.id, r]))

      /* Los nombres se resuelven en una sola consulta en vez de una por
         fila. Con veinte denuncias serían cuarenta viajes. */
      const ids = new Set()
      for (const f of vista.data || []) {
        if (ES_UUID.test(f.autor_id || '')) ids.add(f.autor_id)
        if (ES_UUID.test(f.denunciante || '')) ids.add(f.denunciante)
      }
      for (const r of crudas.data || []) {
        if (ES_UUID.test(r.reporter_id || '')) ids.add(r.reporter_id)
      }

      let nombres = new Map()
      if (ids.size > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', [...ids])
        nombres = new Map((data || []).map((p) => [p.id, p.username]))
      }

      const resolver = (v) =>
        ES_UUID.test(v || '') ? nombres.get(v) || 'Cuenta borrada' : v || '—'

      setFilas(
        (vista.data || []).map((f) => {
          const cruda = porId.get(f.id) || {}
          const columna = Object.keys(TIPOS).find((c) => cruda[c] != null)

          return {
            ...f,
            columna,
            objetivoId: columna ? cruda[columna] : null,
            autorNombre: resolver(f.autor_id),
            denuncianteNombre: resolver(f.denunciante ?? cruda.reporter_id),
          }
        }),
      )
    } catch (error) {
      console.error('Cola de moderación:', error)
      avisar('error', 'No se pudo cargar', error.message)
      setFilas([])
    } finally {
      setCargando(false)
    }
  }, [estado, avisar])

  useEffect(() => {
    cargar()
  }, [cargar])

  /* Cambiar el estado de la denuncia sin tocar el contenido */
  const resolver = async (fila, nuevo) => {
    setOcupada(fila.id)
    const { error } = await supabase
      .from('reports')
      .update({ estado: nuevo, revisado_por: session?.user?.id })
      .eq('id', fila.id)
    setOcupada(null)

    if (error) {
      avisar('error', 'No se pudo guardar', error.message)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== fila.id))
    avisar(
      'success',
      nuevo === 'resuelta' ? 'Marcada como resuelta' : 'Descartada',
      nuevo === 'resuelta'
        ? 'La denuncia sale de la cola.'
        : 'El contenido se queda como está.',
    )
  }

  /* Borrar el contenido denunciado y dar la denuncia por resuelta */
  const borrarContenido = (fila) => {
    const info = TIPOS[fila.columna]
    if (!info?.tabla || !fila.objetivoId) {
      avisar(
        'warn',
        'Aquí no',
        'Un perfil no se borra desde la cola. Usa la pestaña de usuarios.',
      )
      return
    }

    confirmDialog({
      message: `Se borra este ${info.etiqueta.toLowerCase()} para siempre. No se puede deshacer.`,
      header: 'Borrar contenido denunciado',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Borrar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        setOcupada(fila.id)
        const { error } = await supabase
          .from(info.tabla)
          .delete()
          .eq('id', fila.objetivoId)

        if (error) {
          setOcupada(null)
          avisar('error', 'No se pudo borrar', error.message)
          return
        }

        /* Si el contenido cae, la denuncia se va con él por la cascada
           de la clave foránea. Se intenta marcar igualmente por si el
           tipo no tuviera cascada, y se ignora el fallo. */
        await supabase
          .from('reports')
          .update({ estado: 'resuelta', revisado_por: session?.user?.id })
          .eq('id', fila.id)

        setOcupada(null)
        setFilas((prev) => prev.filter((f) => f.id !== fila.id))
        avisar('success', 'Borrado', `${info.etiqueta} eliminado.`)
      },
    })
  }

  const columnaTipo = (fila) => {
    const info = TIPOS[fila.columna]
    return (
      <span className='cmod-tipo rotulo'>{info?.etiqueta || fila.tipo || '—'}</span>
    )
  }

  const columnaContenido = (fila) => (
    <div className='cmod-contenido'>
      <p className='cmod-texto'>{fila.contenido || <em>Sin texto</em>}</p>
      {fila.detalle && <p className='cmod-detalle'>“{fila.detalle}”</p>}
    </div>
  )

  const columnaAcciones = (fila) => {
    const info = TIPOS[fila.columna]
    const bloqueada = ocupada === fila.id

    return (
      <div className='cmod-acciones'>
        {info?.enlace && fila.objetivoId && (
          <Link to={info.enlace(fila.objetivoId)} target='_blank'>
            <Button
              icon={<ExternalLink size={16} />}
              rounded
              text
              tooltip='Abrir'
              tooltipOptions={{ position: 'top' }}
            />
          </Link>
        )}

        {estado === 'pendiente' && (
          <>
            <Button
              icon={<Trash2 size={16} />}
              rounded
              text
              severity='danger'
              disabled={bloqueada || !info?.tabla}
              onClick={() => borrarContenido(fila)}
              tooltip='Borrar el contenido'
              tooltipOptions={{ position: 'top' }}
            />
            <Button
              icon={<Check size={16} />}
              rounded
              text
              severity='success'
              disabled={bloqueada}
              onClick={() => resolver(fila, 'resuelta')}
              tooltip='Marcar resuelta sin borrar'
              tooltipOptions={{ position: 'top' }}
            />
            <Button
              icon={<X size={16} />}
              rounded
              text
              disabled={bloqueada}
              onClick={() => resolver(fila, 'descartada')}
              tooltip='Descartar: no hay nada que hacer'
              tooltipOptions={{ position: 'top' }}
            />
          </>
        )}
      </div>
    )
  }

  const vacio = useMemo(
    () =>
      ({
        pendiente: 'No hay denuncias pendientes. Buena señal.',
        resuelta: 'Todavía no has resuelto ninguna.',
        descartada: 'No has descartado ninguna.',
      })[estado],
    [estado],
  )

  return (
    <div className='cmod'>
      <div className='cmod-barra'>
        <SelectButton
          value={estado}
          onChange={(e) => e.value && setEstado(e.value)}
          options={ESTADOS}
          allowEmpty={false}
        />
        <Button
          label='Actualizar'
          icon='pi pi-refresh'
          text
          onClick={cargar}
          disabled={cargando}
        />
      </div>

      {cargando ? (
        <div className='cmod-cargando'>
          <ProgressSpinner strokeWidth='4' />
        </div>
      ) : (
        <DataTable
          value={filas}
          dataKey='id'
          paginator
          rows={10}
          emptyMessage={vacio}
          className='p-datatable-sm'
        >
          <Column body={columnaTipo} header='Qué' style={{ width: '8rem' }} />
          <Column
            body={(f) => etiquetaMotivo(f.motivo)}
            header='Motivo'
            style={{ width: '11rem' }}
          />
          <Column body={columnaContenido} header='Contenido' />
          <Column
            body={(f) => f.autorNombre}
            header='Autor'
            style={{ width: '9rem' }}
          />
          <Column
            body={(f) => f.denuncianteNombre}
            header='Denuncia'
            style={{ width: '9rem' }}
          />
          <Column
            body={(f) =>
              f.created_at ? FECHA.format(new Date(f.created_at)) : '—'
            }
            header='Cuándo'
            style={{ width: '8rem' }}
          />
          <Column
            body={columnaAcciones}
            header='Acciones'
            style={{ minWidth: '11rem' }}
          />
        </DataTable>
      )}
    </div>
  )
}

export default ColaModeracion
