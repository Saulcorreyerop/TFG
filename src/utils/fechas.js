/*
 * Fechas de evento, en un solo sitio.
 *
 * Un evento puede durar un rato o un fin de semana, y escribirlo bien
 * cambia según el caso. No es lo mismo:
 *
 *   sábado, 8 de noviembre, 10:00
 *   7 y 8 de noviembre                (dos días seguidos)
 *   del 7 al 9 de noviembre           (tres o más)
 *   del 30 de octubre al 2 de noviembre   (cambia el mes)
 *   del 28 de diciembre al 2 de enero de 2027   (cambia el año)
 *
 * Estaba repartido por media web con toLocaleDateString a pelo, cada
 * pantalla con el suyo. Aquí se decide una vez.
 */

const ZONA = 'Europe/Madrid'

const fmt = (opciones) => new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, ...opciones })

const DIA_MES = fmt({ day: 'numeric', month: 'long' })
const DIA_MES_ANIO = fmt({ day: 'numeric', month: 'long', year: 'numeric' })
const SOLO_DIA = fmt({ day: 'numeric' })
const COMPLETA = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const COMPLETA_ANIO = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const HORA = fmt({ hour: '2-digit', minute: '2-digit' })
const CORTA = fmt({ day: 'numeric', month: 'short' })

const aFecha = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/* Dos instantes son el mismo día en España, no en UTC: un evento a las
   23:30 del sábado no es del domingo aunque el servidor lo crea. */
const clave = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

export const mismoDia = (a, b) => {
  const x = aFecha(a)
  const y = aFecha(b)
  return !!x && !!y && clave(x) === clave(y)
}

const mismoMes = (a, b) =>
  clave(a).slice(0, 7) === clave(b).slice(0, 7)

const mismoAnio = (a, b) => clave(a).slice(0, 4) === clave(b).slice(0, 4)

const esteAnio = (d) => clave(d).slice(0, 4) === clave(new Date()).slice(0, 4)

/* ¿Cuántos días distintos ocupa? Dos noches seguidas son dos días. */
export const diasQueDura = (inicio, fin) => {
  const a = aFecha(inicio)
  const b = aFecha(fin)
  if (!a) return 0
  if (!b || mismoDia(a, b)) return 1
  const d1 = new Date(`${clave(a)}T00:00:00Z`)
  const d2 = new Date(`${clave(b)}T00:00:00Z`)
  return Math.round((d2 - d1) / 86400000) + 1
}

export const esDeVariosDias = (inicio, fin) => diasQueDura(inicio, fin) > 1

/*
 * El texto largo, para la ficha del evento.
 * `conHora` añade la hora de inicio cuando dura un solo día.
 */
export const rangoLargo = (inicio, fin, { conHora = true } = {}) => {
  const a = aFecha(inicio)
  if (!a) return ''
  const b = aFecha(fin)

  if (!b || mismoDia(a, b)) {
    const base = esteAnio(a) ? COMPLETA.format(a) : COMPLETA_ANIO.format(a)
    return conHora ? `${base}, ${HORA.format(a)}` : base
  }

  /* Mismo mes: "7 y 8 de noviembre", "del 7 al 9 de noviembre" */
  if (mismoMes(a, b)) {
    const cola = esteAnio(a)
      ? DIA_MES.format(b)
      : DIA_MES_ANIO.format(b)
    return diasQueDura(a, b) === 2
      ? `${SOLO_DIA.format(a)} y ${cola}`
      : `del ${SOLO_DIA.format(a)} al ${cola}`
  }

  /* Cambia el mes, o el año */
  const desde = mismoAnio(a, b) ? DIA_MES.format(a) : DIA_MES_ANIO.format(a)
  const hasta = esteAnio(b) && mismoAnio(a, b) ? DIA_MES.format(b) : DIA_MES_ANIO.format(b)
  return `del ${desde} al ${hasta}`
}

/*
 * El texto corto, para tarjetas y listas: "8 nov", "7-8 nov".
 */
export const rangoCorto = (inicio, fin) => {
  const a = aFecha(inicio)
  if (!a) return ''
  const b = aFecha(fin)
  const limpio = (d) => CORTA.format(d).replace(/\./g, '')

  if (!b || mismoDia(a, b)) return limpio(a)
  if (mismoMes(a, b)) return `${SOLO_DIA.format(a)}-${limpio(b)}`
  return `${limpio(a)} - ${limpio(b)}`
}

export const hora = (valor) => {
  const d = aFecha(valor)
  return d ? HORA.format(d) : ''
}

/*
 * Cuándo deja de ser "próximo".
 *
 * Un evento de dos días tiene que seguir apareciendo en la agenda
 * durante el primero. Con solo la fecha de inicio desaparecía a la hora
 * de empezar, que es justo cuando más gente lo busca.
 */
export const yaHaPasado = (evento) => {
  const fin = aFecha(evento?.fecha_hasta || evento?.fecha_fin || evento?.fecha)
  return !!fin && fin.getTime() < Date.now()
}

export const estaEnMarcha = (evento) => {
  const a = aFecha(evento?.fecha)
  const b = aFecha(evento?.fecha_hasta || evento?.fecha_fin)
  if (!a || !b || a.getTime() === b.getTime()) return false
  const ahora = Date.now()
  return ahora >= a.getTime() && ahora <= b.getTime()
}
