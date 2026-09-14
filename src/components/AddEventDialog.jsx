import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { subirImagen } from '../utils/subirImagen'
import DibujarRuta from './DibujarRuta'
import { longitudDe, enKm } from '../utils/ruta'
import { sendPushNotification } from '../utils/onesignal'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { AutoComplete } from 'primereact/autocomplete'
import { InputSwitch } from 'primereact/inputswitch'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import {
  MapPin,
  CalendarPlus,
  Type,
  ImagePlus,
  FileText,
  Send,
  Map as MapIcon,
  Tag as TagIcon,
  Shield,
  Route as RouteIcon,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function LocationSelector({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng)
    },
  })
  return null
}

const AddEventDialog = ({
  visible,
  onHide,
  onEventAdded,
  session,
  initialLat = null,
  initialLng = null,
  /* Si llega un evento, el dialogo edita en vez de crear. Se reutiliza
     el mismo formulario a proposito: tiene el mapa, el dibujo de la
     ruta, las dos fechas y la subida de foto. Mantener dos copias de
     esto en sincronia seria una fuente de fallos garantizada. */
  evento = null,
}) => {
  const editando = Boolean(evento)
  const toast = useRef(null)
  const [loading, setLoading] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showRutaModal, setShowRutaModal] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const fileInputRef = useRef(null)

  const [adminCrews, setAdminCrews] = useState([])

  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    tipo: '',
    fecha: null,
    fecha_fin: null,
    ruta: [],
    descripcion: '',
    imagen: null,
    lat: null,
    lng: null,
    direccion: '',
    ubicacion: '',
    is_private: false,
    crew_id: null,
  })

  useEffect(() => {
    if (visible && session) {
      const fetchUserCrews = async () => {
        const { data } = await supabase
          .from('crew_members')
          .select('crew_id, crews(id, name)')
          .eq('user_id', session.user.id)
          .eq('status', 'approved')

        if (data && data.length > 0) {
          const formattedCrews = data.map((d) => d.crews)
          setAdminCrews(formattedCrews)
        } else {
          setAdminCrews([])
        }
      }
      fetchUserCrews()
    }
  }, [visible, session])

  /*
   * Coordenadas que llegan desde el mapa.
   *
   * Esto era un useEffect que llamaba a setNuevoEvento. Cambiar el estado
   * dentro de un efecto por culpa de un cambio de props provoca un
   * segundo render en cadena: React pinta el diálogo con las coordenadas
   * viejas y acto seguido lo vuelve a pintar con las nuevas.
   *
   * El patrón correcto para sincronizar estado con props es hacerlo
   * durante el render, comparando con lo último que se vio. React
   * descarta el render a medias y rehace uno solo, sin parpadeo.
   */
  const [ultimasCoords, setUltimasCoords] = useState(null)
  const coordsActuales = `${initialLat}|${initialLng}|${visible}|${evento?.id ?? ''}`

  if (ultimasCoords !== coordsActuales) {
    setUltimasCoords(coordsActuales)

    if (evento && visible) {
      /* Al abrir en modo edicion se vuelca lo que ya hay. La foto se
         deja a null: solo se sube una nueva si el usuario elige otra,
         y si no, se conserva la que tuviera. */
      setNuevoEvento({
        titulo: evento.titulo || '',
        tipo: evento.tipo || '',
        fecha: evento.fecha ? new Date(evento.fecha) : null,
        fecha_fin: evento.fecha_fin ? new Date(evento.fecha_fin) : null,
        ruta: Array.isArray(evento.ruta?.puntos) ? evento.ruta.puntos : [],
        descripcion: evento.description || '',
        imagen: null,
        lat: evento.lat ?? null,
        lng: evento.lng ?? null,
        direccion: '',
        ubicacion: evento.ubicacion || '',
        is_private: Boolean(evento.is_private),
        crew_id: evento.crew_id ?? null,
      })
    } else if (initialLat && initialLng) {
      setNuevoEvento((prev) => ({ ...prev, lat: initialLat, lng: initialLng }))
    }
  }

  const tiposEvento = [
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const searchAddress = async (event) => {
    const query = event.query
    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query,
        )}&countrycodes=es,pt,ad,fr&limit=5`,
      )
      const data = await response.json()
      const formattedSuggestions = data.map((item) => ({
        label: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }))
      setSuggestions(formattedSuggestions)
    } catch (error) {
      console.error('Error buscando sugerencias:', error)
    }
  }

  const onAddressSelect = (e) => {
    const selected = e.value
    const shortUbicacion = selected.label.split(',').slice(0, 2).join(',')

    setNuevoEvento({
      ...nuevoEvento,
      direccion: selected.label,
      ubicacion: shortUbicacion,
      lat: selected.lat,
      lng: selected.lng,
    })
    toast.current.show({
      severity: 'success',
      summary: 'Ubicación Fijada',
      detail: shortUbicacion,
      life: 2000,
    })
  }

  /*
   * Coordenadas -> nombre del sitio.
   *
   * La ubicación en texto no es un adorno: es lo que agrupa los eventos
   * por provincia en /eventos/:provincia, lo que sale en el título al
   * compartir por WhatsApp, y lo que Google necesita en los datos
   * estructurados para meter la quedada en su carrusel de eventos. Un
   * evento sin ella existe pero no lo encuentra nadie.
   */
  const resolverUbicacion = async (lat, lng) => {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es`,
    )
    const datos = await respuesta.json()
    const dir = datos.address || {}
    const ciudad =
      dir.city || dir.town || dir.village || dir.municipality || dir.county || ''
    const provincia = dir.state || dir.province || ''

    return {
      ubicacion: ciudad
        ? [ciudad, provincia].filter(Boolean).join(', ')
        : datos.display_name || '',
      direccion: datos.display_name || '',
    }
  }

  const handleLocationSelect = async (latlng) => {
    setShowMapModal(false)
    setNuevoEvento((prev) => ({ ...prev, lat: latlng.lat, lng: latlng.lng }))

    toast.current.show({
      severity: 'info',
      summary: 'Analizando ubicación...',
      detail: 'Traduciendo coordenadas...',
      life: 1500,
    })

    try {
      const { ubicacion: ubicacionFormat, direccion } = await resolverUbicacion(
        latlng.lat,
        latlng.lng,
      )

      setNuevoEvento((prev) => ({
        ...prev,
        direccion,
        ubicacion: ubicacionFormat,
      }))

      toast.current.show({
        severity: 'success',
        summary: 'Ubicación detectada',
        detail: ubicacionFormat,
        life: 3000,
      })
    } catch (error) {
      console.error(error)
      setNuevoEvento((prev) => ({
        ...prev,
        ubicacion: 'Ubicación seleccionada en mapa',
      }))
    }
  }

  /* La ruta la decide subirImagen: carpeta del usuario y uuid, para que
     la política de Storage pueda comprobar de quién es cada archivo.
     Antes subía el original sin comprimir a una ruta plana. */
  const uploadImage = async (file) => {
    try {
      return await subirImagen(file, {
        bucket: 'event-images',
        userId: session?.user?.id,
      })
    } catch (error) {
      console.error(error)
      toast.current?.show({
        severity: 'error',
        summary: 'No se pudo subir la imagen',
        detail: error.message,
      })
      return null
    }
  }

  const handleSave = async () => {
    if (!session)
      return toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Sesión no válida.',
      })
    if (
      !nuevoEvento.titulo ||
      !nuevoEvento.fecha ||
      !nuevoEvento.tipo ||
      !nuevoEvento.lat
    ) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Rellena título, fecha, tipo y selecciona una ubicación.',
      })
    }

    setLoading(true)
    let imageUrl = null

    if (nuevoEvento.imagen) {
      imageUrl = await uploadImage(nuevoEvento.imagen)
      if (!imageUrl) {
        setLoading(false)
        return toast.current.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Fallo al subir la imagen.',
        })
      }
    }

    if (
      nuevoEvento.fecha_fin &&
      new Date(nuevoEvento.fecha_fin) < new Date(nuevoEvento.fecha)
    ) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Revisa las fechas',
        detail: 'El evento no puede terminar antes de empezar.',
      })
    }

    const finalTipo =
      typeof nuevoEvento.tipo === 'object'
        ? nuevoEvento.tipo.value
        : nuevoEvento.tipo

    /*
     * Red de seguridad para la ubicación.
     *
     * El insert no la guardaba. Ni siquiera estaba en la lista de
     * columnas, así que TODO evento creado desde aquí se guardaba sin
     * ella, por mucho que el diálogo la hubiera detectado y la enseñara
     * en pantalla. De los quince eventos que había en la base, siete
     * estaban sin ubicación teniendo coordenadas, incluido el primero
     * que publicó un usuario de fuera.
     *
     * Duele porque la ubicación es lo que agrupa los eventos por
     * provincia, lo que sale al compartir por WhatsApp y lo que Google
     * necesita para el carrusel de eventos. Sin ella el evento existe
     * pero no lo encuentra nadie.
     *
     * Además de guardarla, se resuelve aquí si viniera vacía: se puede
     * llegar a este punto con coordenadas y sin texto, por ejemplo
     * abriendo el diálogo desde el mapa, donde las coordenadas llegan
     * puestas y nadie pulsa para elegir sitio.
     */
    let ubicacionFinal = (nuevoEvento.ubicacion || '').trim()

    if (!ubicacionFinal && nuevoEvento.lat && nuevoEvento.lng) {
      try {
        const resuelta = await resolverUbicacion(
          nuevoEvento.lat,
          nuevoEvento.lng,
        )
        ubicacionFinal = resuelta.ubicacion
      } catch (error) {
        /* Si el servicio no responde, se guarda igual: mejor un evento
           sin ubicación que perder lo que ha escrito el usuario. */
        console.warn('No se pudo resolver la ubicación:', error.message)
      }
    }

    const campos = {
      titulo: nuevoEvento.titulo,
      tipo: finalTipo,
      fecha: nuevoEvento.fecha,
      fecha_fin: nuevoEvento.fecha_fin || null,
      /* Solo se guarda si tiene al menos dos puntos: una linea de
         un punto no es un trazado. Se guarda tambien la distancia
         ya calculada para no recalcularla en cada tarjeta. */
      ruta:
        nuevoEvento.ruta && nuevoEvento.ruta.length > 1
          ? {
              puntos: nuevoEvento.ruta,
              distancia: longitudDe(nuevoEvento.ruta),
            }
          : null,
      description: nuevoEvento.descripcion,
      lat: nuevoEvento.lat,
      lng: nuevoEvento.lng,
      ubicacion: ubicacionFinal || null,
      crew_id: nuevoEvento.is_private ? nuevoEvento.crew_id : null,
      is_private: nuevoEvento.is_private,
    }

    /* Editando sin foto nueva: no se toca image_url. Si se enviara null
       se borraria la portada que ya tenia solo por no haber elegido
       otra. */
    if (imageUrl) campos.image_url = imageUrl

    const { data: newEventData, error } = editando
      ? await supabase
          .from('events')
          .update(campos)
          .eq('id', evento.id)
          .select()
      : await supabase
          .from('events')
          .insert([{ ...campos, image_url: imageUrl, user_id: session.user.id }])
          .select()

    if (error) {
      setLoading(false)
      return toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    }

    if (editando) {
      /*
       * Si se ha movido la fecha, hay que avisar a quien ya se apunto.
       * Cambiar el dia de un evento sin decirselo a nadie es la forma
       * mas rapida de que la gente se plante alli cuando no es.
       */
      const fechaVieja = evento.fecha ? new Date(evento.fecha).getTime() : null
      const fechaNueva = nuevoEvento.fecha
        ? new Date(nuevoEvento.fecha).getTime()
        : null

      if (fechaVieja !== fechaNueva) {
        const { data: apuntados } = await supabase
          .from('event_attendees')
          .select('user_id')
          .eq('event_id', evento.id)
          .neq('user_id', session.user.id)

        if (apuntados && apuntados.length > 0) {
          await supabase.from('notifications').insert(
            apuntados.map((a) => ({
              user_id: a.user_id,
              actor_id: session.user.id,
              tipo: 'evento_cambiado',
              evento_id: evento.id,
            })),
          )

          sendPushNotification(
            apuntados.map((a) => a.user_id),
            'Cambio de fecha',
            `${nuevoEvento.titulo} ha cambiado de fecha. Compruebala.`,
            `/evento/${evento.id}`,
          )
        }
      }
    } else if (newEventData && newEventData.length > 0) {
      const newEventId = newEventData[0].id

      if (nuevoEvento.is_private) {
        const { data: crewMembers } = await supabase
          .from('crew_members')
          .select('user_id')
          .eq('crew_id', nuevoEvento.crew_id)
          .eq('status', 'approved')
          .neq('user_id', session.user.id)

        if (crewMembers && crewMembers.length > 0) {
          const privateNotifications = crewMembers.map((m) => ({
            user_id: m.user_id,
            actor_id: session.user.id,
            tipo: 'nuevo_evento',
            evento_id: newEventId,
          }))
          await supabase.from('notifications').insert(privateNotifications)
        }
      } else {
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id')
          .neq('id', session.user.id)

        if (allUsers && allUsers.length > 0) {
          const globalNotifications = allUsers.map((user) => ({
            user_id: user.id,
            actor_id: session.user.id,
            tipo: 'nuevo_evento',
            evento_id: newEventId,
          }))
          await supabase.from('notifications').insert(globalNotifications)
        }
      }
    }

    setLoading(false)
    toast.current.show({
      severity: 'success',
      summary: 'Éxito',
      detail: editando
        ? 'Cambios guardados.'
        : nuevoEvento.is_private
          ? 'Evento privado de Crew creado.'
          : 'Evento publicado para todos.',
    })

    setNuevoEvento({
      titulo: '',
      tipo: '',
      fecha: null,
      fecha_fin: null,
      ruta: [],
      descripcion: '',
      imagen: null,
      lat: null,
      lng: null,
      direccion: '',
      is_private: false,
      crew_id: null,
    })

    if (onEventAdded) onEventAdded()
    onHide()
  }

  return (
    <>
      <Toast ref={toast} />
      <style>
        {`
          .premium-dialog .p-dialog-header {
            border-bottom: none;
            padding: 2rem 2rem 1rem 2rem;
            border-radius: 32px 32px 0 0;
          }
          .premium-dialog .p-dialog-content {
            padding: 0 2rem 2rem 2rem;
            border-radius: 0 0 32px 32px;
          }
          .premium-input {
            border: 2px solid transparent !important;
            background-color: var(--surface-100) !important;
            border-radius: 20px !important;
            padding: 1rem 1.25rem !important;
            font-size: 1rem !important;
            font-weight: 600 !important;
            color: var(--linea) !important;
            transition: all 0.3s ease !important;
            box-shadow: none !important;
          }
          .premium-input:hover {
            background-color: var(--surface-border) !important;
          }
          .premium-input:focus, .p-inputwrapper-focus > .premium-input {
            background-color: var(--surface-card) !important;
            border-color: var(--librea) !important;
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--librea) 10%, transparent) !important;
          }
          .premium-label {
            font-size: 0.85rem;
            font-weight: 800;
            color: var(--texto-medio);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .premium-dropzone {
            background-color: var(--surface-50);
            border: 2px dashed var(--linea-viva);
            border-radius: 24px;
            padding: 3rem 2rem;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .premium-dropzone:hover {
            background-color: var(--librea-baja);
            border-color: var(--librea-baja);
            transform: translateY(-2px);
          }
          .premium-btn-primary {
            background: linear-gradient(135deg, var(--librea) 0%, var(--librea) 100%) !important;
            border: none !important;
            border-radius: 100px !important;
            padding: 1rem 2rem !important;
            font-weight: 800 !important;
            letter-spacing: 0.5px !important;
            box-shadow: 0 10px 20px -5px color-mix(in srgb, var(--librea) 40%, transparent) !important;
            transition: all 0.3s ease !important;
          }
          .premium-btn-primary:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 25px -5px color-mix(in srgb, var(--librea) 50%, transparent) !important;
          }
          .p-dropdown-panel .p-dropdown-items .p-dropdown-item {
            font-weight: 600;
            border-radius: 12px;
            margin: 4px;
          }
          .p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item {
            font-weight: 600;
            border-radius: 12px;
            margin: 4px;
          }
        `}
      </style>

      <Dialog
        header={
          <div className='flex align-items-center gap-4'>
            <div
              className='flex align-items-center justify-content-center border-circle shadow-4'
              style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, var(--librea) 0%, var(--librea) 100%)',
                color: 'white',
              }}
            >
              <CalendarPlus size={30} />
            </div>
            <div>
              <h2 className='font-black text-3xl text-color m-0 tracking-tight'>
                {editando ? 'Editar evento' : 'Publicar Evento'}
              </h2>
              <p className='text-color-secondary font-medium m-0 mt-1'>
                {editando
                  ? 'Si cambias la fecha, avisamos a quien se haya apuntado.'
                  : 'Comparte tu KDD o ruta con la comunidad.'}
              </p>
            </div>
          </div>
        }
        visible={visible}
        draggable={false}
        className='w-11 md:w-8 lg:w-6 premium-dialog shadow-8'
        style={{ borderRadius: 'var(--r)' }}
        onHide={onHide}
        breakpoints={{ '960px': '85vw', '641px': '100vw' }}
      >
        <div className='flex flex-column gap-5 mt-4'>
          <div className='field m-0'>
            <label className='premium-label'>
              <Type size={18} className='text-blue-500' /> Título del Evento *
            </label>
            <InputText
              value={nuevoEvento.titulo}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })
              }
              className='w-full premium-input'
              placeholder='Ej: Gran KDD Racing Madrid'
            />
          </div>

          {adminCrews.length > 0 && (
            <div
              className='field m-0 p-4 border-round-3xl border-1 border-blue-200 relative overflow-hidden'
              style={{
                background: 'linear-gradient(135deg, var(--librea-baja) 0%, var(--librea-baja) 100%)',
              }}
            >
              <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between gap-3 relative z-1'>
                <div className='flex align-items-center gap-3'>
                  <div className='bg-blue-600 text-white p-2 border-circle flex align-items-center justify-content-center shadow-2'>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className='m-0 text-blue-900 font-black text-lg'>
                      Evento Privado de Crew
                    </h4>
                    <p className='m-0 text-blue-700 text-sm font-medium mt-1'>
                      Solo los miembros verán esta KDD
                    </p>
                  </div>
                </div>
                <InputSwitch
                  checked={nuevoEvento.is_private}
                  onChange={(e) => {
                    setNuevoEvento((prev) => ({
                      ...prev,
                      is_private: e.value,
                      crew_id: e.value
                        ? prev.crew_id || adminCrews[0].id
                        : null,
                    }))
                  }}
                />
              </div>

              {nuevoEvento.is_private && adminCrews.length > 1 && (
                <div className='mt-4 relative z-1 border-top-1 border-blue-200 pt-3'>
                  <label className='text-blue-900 font-bold text-sm mb-2 block'>
                    Selecciona el Club organizador
                  </label>
                  <Dropdown
                    value={nuevoEvento.crew_id}
                    options={adminCrews}
                    optionLabel='name'
                    optionValue='id'
                    onChange={(e) =>
                      setNuevoEvento({ ...nuevoEvento, crew_id: e.value })
                    }
                    className='w-full premium-input border-none shadow-1 surface-card'
                  />
                </div>
              )}
            </div>
          )}

          <div className='grid m-0 gap-4 md:gap-0'>
            <div className='col-12 md:col-6 md:pr-3 p-0 field m-0'>
              <label className='premium-label'>
                <TagIcon size={18} className='text-purple-500' /> Categoría *
              </label>
              <Dropdown
                value={nuevoEvento.tipo}
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, tipo: e.value })
                }
                options={tiposEvento}
                optionLabel='label'
                className='w-full premium-input p-0 flex align-items-center'
                placeholder='Selecciona la disciplina'
              />
            </div>

            <div className='col-12 md:col-6 md:pl-3 p-0 field m-0'>
              <label className='premium-label'>
                <CalendarPlus size={18} className='text-emerald-500' /> Fecha y
                Hora *
              </label>
              <Calendar
                value={nuevoEvento.fecha}
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, fecha: e.value })
                }
                showTime
                locale='es'
                dateFormat='dd/mm/yy'
                hourFormat='24'
                className='w-full'
                inputClassName='premium-input w-full'
                placeholder='Selecciona el inicio'
              />
            </div>
          </div>

          {/* Fin del evento.
              Opcional a proposito: la mayoria de quedadas son de una
              tarde y pedir dos fechas para todas seria un estorbo. Pero
              sin esto no se pueden publicar los eventos que mas gente
              mueven: un gran premio, el EMF de Jerez, un fin de semana
              entero. Ademas es lo que Google pide como endDate para
              meter el evento en su carrusel. */}
          <div className='grid m-0 p-0'>
            <div className='col-12 p-0 field m-0'>
              <label className='premium-label'>
                <CalendarPlus size={18} className='text-emerald-500' /> Fin del
                evento
                <span
                  className='ml-2 text-xs font-normal'
                  style={{ color: 'var(--texto-tenue)' }}
                >
                  opcional, solo si dura más de un día
                </span>
              </label>
              <Calendar
                value={nuevoEvento.fecha_fin}
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, fecha_fin: e.value })
                }
                showTime
                locale='es'
                dateFormat='dd/mm/yy'
                hourFormat='24'
                minDate={nuevoEvento.fecha || undefined}
                showButtonBar
                className='w-full'
                inputClassName='premium-input w-full'
                placeholder='Dejalo vacio si es de un solo dia'
              />
            </div>
          </div>

          <div className='field m-0 surface-50 p-4 md:p-5 border-round-3xl border-1 border-gray-100 relative overflow-hidden'>
            <div
              className='absolute top-0 right-0 p-4 opacity-10'
              style={{ pointerEvents: 'none' }}
            >
              <MapPin size={120} />
            </div>
            <label className='text-color font-black mb-4 flex align-items-center gap-3 text-xl relative z-1'>
              <div className='bg-blue-100 text-blue-600 p-2 border-circle flex align-items-center justify-content-center'>
                <MapPin size={22} />
              </div>
              Ubicación del Evento *
            </label>

            <div className='mb-4 w-full relative z-1'>
              <AutoComplete
                value={nuevoEvento.direccion}
                suggestions={suggestions}
                completeMethod={searchAddress}
                field='label'
                onChange={(e) =>
                  setNuevoEvento({ ...nuevoEvento, direccion: e.value })
                }
                onSelect={onAddressSelect}
                placeholder='Escribe la calle, circuito, pueblo...'
                className='w-full'
                inputClassName='w-full premium-input surface-card border-none shadow-1'
                panelClassName='shadow-4 border-round-2xl mt-2'
                delay={500}
              />
            </div>

            <div className='flex align-items-center gap-3 mb-4 relative z-1'>
              <div className='flex-1 border-top-1 surface-border'></div>
              <span className='text-400 font-bold text-xs uppercase tracking-widest'>
                O UBICA MANUALMENTE
              </span>
              <div className='flex-1 border-top-1 surface-border'></div>
            </div>

            <Button
              label='Abrir Mapa Interactivo'
              icon={<MapIcon size={20} className='mr-2' />}
              className='w-full mb-4 border-round-2xl font-bold surface-card text-color border-none shadow-1 hover:shadow-2 hover:text-blue-600 transition-all p-3 relative z-1'
              onClick={() => setShowMapModal(true)}
            />

            {/* El trazado solo se ofrece en rutas y tramos. En una
                exposicion o un trackday el recorrido no significa nada,
                y un boton que no viene a cuento en un formulario ya
                largo solo estorba. */}
            {nuevoEvento.tipo === 'Ruta' && (
              <Button
                label={
                  nuevoEvento.ruta.length > 1
                    ? `Recorrido: ${enKm(longitudDe(nuevoEvento.ruta))} en ${nuevoEvento.ruta.length} puntos`
                    : 'Dibujar el recorrido en el mapa'
                }
                icon={<RouteIcon size={20} className='mr-2' />}
                className='w-full mb-4 border-round-2xl font-bold surface-card text-color border-none shadow-1 hover:shadow-2 transition-all p-3 relative z-1'
                onClick={() => setShowRutaModal(true)}
              />
            )}

            <div className='grid m-0 gap-3 relative z-1'>
              <div className='col p-0 surface-card border-round-xl shadow-1 p-3'>
                <div className='text-xs font-bold text-400 tracking-widest uppercase mb-1'>
                  Latitud
                </div>
                <div className='font-mono text-color font-bold text-lg'>
                  {nuevoEvento.lat ? nuevoEvento.lat.toFixed(6) : '---'}
                </div>
              </div>
              <div className='col p-0 surface-card border-round-xl shadow-1 p-3'>
                <div className='text-xs font-bold text-400 tracking-widest uppercase mb-1'>
                  Longitud
                </div>
                <div className='font-mono text-color font-bold text-lg'>
                  {nuevoEvento.lng ? nuevoEvento.lng.toFixed(6) : '---'}
                </div>
              </div>
            </div>

            {nuevoEvento.ubicacion && (
              <div className='mt-3 text-sm font-bold text-blue-600'>
                <i className='pi pi-check-circle mr-2'></i>
                Ciudad guardada: {nuevoEvento.ubicacion}
              </div>
            )}
          </div>

          <div className='field m-0'>
            <label className='premium-label'>
              <ImagePlus size={18} className='text-pink-500' /> Cartel / Imagen
              (Opcional)
            </label>
            <div
              className='premium-dropzone'
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type='file'
                accept='image/*'
                ref={fileInputRef}
                onChange={(e) =>
                  e.target.files[0] &&
                  setNuevoEvento({
                    ...nuevoEvento,
                    imagen: e.target.files[0],
                  })
                }
                style={{ display: 'none' }}
              />
              {nuevoEvento.imagen ? (
                <div className='flex flex-column align-items-center'>
                  <div className='bg-green-100 text-green-600 border-circle p-3 mb-3 shadow-2'>
                    <i className='pi pi-check text-2xl font-bold'></i>
                  </div>
                  <span className='text-lg text-color font-black mb-1'>
                    {nuevoEvento.imagen.name}
                  </span>
                  <span className='text-blue-500 font-bold mt-2 hover:underline'>
                    Cambiar imagen
                  </span>
                </div>
              ) : (
                <div className='flex flex-column align-items-center'>
                  <div className='surface-card text-blue-500 border-circle p-4 mb-4 shadow-2'>
                    <ImagePlus size={40} />
                  </div>
                  <span className='text-xl text-color font-black mb-2'>
                    Sube el cartel oficial
                  </span>
                  <span className='text-sm text-color-secondary font-medium'>
                    Haz clic aquí. Recomendado: JPG o PNG (Max. 5MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className='field m-0 mb-2'>
            <label className='premium-label'>
              <FileText size={18} className='text-orange-500' /> Descripción
            </label>
            <InputTextarea
              rows={5}
              value={nuevoEvento.descripcion}
              onChange={(e) =>
                setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })
              }
              className='w-full premium-input line-height-3'
              placeholder='Detalla el planning, normativas, horarios específicos, requisitos para asistir...'
            />
          </div>

          <div className='flex align-items-center justify-content-between pt-4 mt-2'>
            <Button
              label='Cancelar'
              text
              onClick={onHide}
              className='text-color-secondary hover:text-color-secondary hover:surface-100 font-bold px-4 border-round-3xl transition-colors'
            />
            <Button
              label={editando ? 'Guardar cambios' : 'Publicar Evento'}
              icon={<Send size={20} className='mr-2' />}
              onClick={handleSave}
              loading={loading}
              className='premium-btn-primary text-lg'
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        header={
          <span className='font-black text-2xl'>
            Pincha en la ubicación exacta
          </span>
        }
        visible={showMapModal}
        draggable={false}
        style={{ width: '90vw', maxWidth: '800px' }}
        onHide={() => setShowMapModal(false)}
        contentClassName='p-0'
        className='border-round-3xl overflow-hidden shadow-8'
        headerClassName='border-none p-4 pb-3'
      >
        <div style={{ height: '500px', width: '100%' }}>
          <MapContainer
            center={
              nuevoEvento.lat
                ? [nuevoEvento.lat, nuevoEvento.lng]
                : [40.4168, -3.7038]
            }
            zoom={nuevoEvento.lat ? 15 : 5}
            minZoom={5}
            maxZoom={18}
            style={{ height: '100%', width: '100%', background: 'var(--surface-100)' }}
          >
            <TileLayer
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              maxZoom={18}
              keepBuffer={8}
              updateWhenZooming={false}
            />
            <LocationSelector onLocationSelect={handleLocationSelect} />
            {nuevoEvento.lat && (
              <Marker position={[nuevoEvento.lat, nuevoEvento.lng]} />
            )}
          </MapContainer>
        </div>
      </Dialog>

      <Dialog
        header={<span className='font-black text-2xl'>Dibuja el recorrido</span>}
        visible={showRutaModal}
        draggable={false}
        style={{ width: '92vw', maxWidth: '900px' }}
        onHide={() => setShowRutaModal(false)}
        contentClassName='p-0'
        className='border-round-3xl overflow-hidden shadow-8'
        headerClassName='border-none p-4 pb-3'
      >
        <DibujarRuta
          puntos={nuevoEvento.ruta}
          onCambio={(puntos) =>
            setNuevoEvento((prev) => ({ ...prev, ruta: puntos }))
          }
          centro={
            nuevoEvento.lat ? [nuevoEvento.lat, nuevoEvento.lng] : undefined
          }
        />
      </Dialog>
    </>
  )
}

export default AddEventDialog
