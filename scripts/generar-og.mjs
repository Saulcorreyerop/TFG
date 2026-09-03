/*
 * Genera public/og-carmeet.png, la imagen que se ve cuando alguien
 * comparte un enlace de carmeet.es por WhatsApp, Twitter o Telegram.
 *
 *   node scripts/generar-og.mjs
 *
 * 1200x630 es la medida que piden todas las redes. Por debajo de 600 de
 * ancho, WhatsApp la trata como miniatura y la pone a un lado en vez de
 * arriba, que es justo lo que no queremos.
 *
 * Mismo apaño que generar-iconos.mjs: PNG a pelo con Node, sin sharp.
 * El logo original no tiene transparencia (lleva el tablero de Canva
 * pintado dentro), así que se reconstruye el alfa desde la luminosidad.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEN = join(RAIZ, 'assets-fuente', 'logo-original.png')
const DESTINO = join(RAIZ, 'public', 'og-carmeet.png')

const ANCHO = 1200
const ALTO = 630
const ASFALTO = [14, 14, 16] /* --asfalto */
const LIBREA = [217, 46, 39] /* --librea */
const BARRA = 16 /* grosor de la franja inferior */
const MARCA_ANCHO_MAX = 620
const MARCA_ALTO_MAX = 330

/* ---------- CRC32, que el formato PNG exige en cada chunk ---------- */

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ---------- Lectura ---------- */

const desfiltrar = (crudo, ancho, alto) => {
  const bpp = 4
  const porLinea = ancho * bpp
  const salida = Buffer.alloc(alto * porLinea)

  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }

  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (porLinea + 1)]
    const entrada = y * (porLinea + 1) + 1
    const destino = y * porLinea
    const arriba = destino - porLinea

    for (let x = 0; x < porLinea; x++) {
      const valor = crudo[entrada + x]
      const a = x >= bpp ? salida[destino + x - bpp] : 0
      const b = y > 0 ? salida[arriba + x] : 0
      const c = x >= bpp && y > 0 ? salida[arriba + x - bpp] : 0

      let resultado
      switch (filtro) {
        case 0:
          resultado = valor
          break
        case 1:
          resultado = valor + a
          break
        case 2:
          resultado = valor + b
          break
        case 3:
          resultado = valor + ((a + b) >> 1)
          break
        case 4:
          resultado = valor + paeth(a, b, c)
          break
        default:
          throw new Error(`Filtro PNG desconocido: ${filtro}`)
      }
      salida[destino + x] = resultado & 0xff
    }
  }

  return salida
}

const leerPng = (ruta) => {
  const b = readFileSync(ruta)

  const firma = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!firma.every((v, i) => b[i] === v)) throw new Error('El archivo no es un PNG')

  const ancho = b.readUInt32BE(16)
  const alto = b.readUInt32BE(20)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) {
    throw new Error('Solo se admite PNG RGBA de 8 bits sin entrelazar')
  }

  const trozos = []
  let o = 8
  while (o < b.length) {
    const len = b.readUInt32BE(o)
    const tipo = b.toString('ascii', o + 4, o + 8)
    if (tipo === 'IDAT') trozos.push(b.subarray(o + 8, o + 8 + len))
    if (tipo === 'IEND') break
    o += 12 + len
  }

  const crudo = inflateSync(Buffer.concat(trozos))
  return { ancho, alto, pixeles: desfiltrar(crudo, ancho, alto) }
}

/* ---------- Transparencia y recorte ---------- */

const CLARO = 200
const OSCURO = 60

const reconstruirAlfa = ({ ancho, alto, pixeles }) => {
  const salida = Buffer.alloc(ancho * alto * 4)

  for (let i = 0; i < ancho * alto; i++) {
    const j = i * 4
    const lum = 0.2126 * pixeles[j] + 0.7152 * pixeles[j + 1] + 0.0722 * pixeles[j + 2]
    const alfa = Math.max(0, Math.min(1, (CLARO - lum) / (CLARO - OSCURO)))

    /* La marca va en blanco: la tarjeta se ve sobre asfalto */
    salida[j] = 255
    salida[j + 1] = 255
    salida[j + 2] = 255
    salida[j + 3] = Math.round(alfa * 255)
  }

  return { ancho, alto, pixeles: salida }
}

const recortar = ({ ancho, alto, pixeles }) => {
  let x0 = ancho
  let y0 = alto
  let x1 = -1
  let y1 = -1

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (pixeles[(y * ancho + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }

  if (x1 < 0) throw new Error('El logo está completamente transparente')

  const nAncho = x1 - x0 + 1
  const nAlto = y1 - y0 + 1
  const salida = Buffer.alloc(nAncho * nAlto * 4)

  for (let y = 0; y < nAlto; y++) {
    pixeles.copy(
      salida,
      y * nAncho * 4,
      ((y + y0) * ancho + x0) * 4,
      ((y + y0) * ancho + x0 + nAncho) * 4,
    )
  }

  return { ancho: nAncho, alto: nAlto, pixeles: salida }
}

/* Media por cajas con alfa premultiplicado, para que no salga halo */
const escalar = ({ ancho, alto, pixeles }, nAncho, nAlto) => {
  const salida = Buffer.alloc(nAncho * nAlto * 4)
  const escalaX = ancho / nAncho
  const escalaY = alto / nAlto

  for (let y = 0; y < nAlto; y++) {
    const desdeY = Math.floor(y * escalaY)
    const hastaY = Math.max(desdeY + 1, Math.floor((y + 1) * escalaY))

    for (let x = 0; x < nAncho; x++) {
      const desdeX = Math.floor(x * escalaX)
      const hastaX = Math.max(desdeX + 1, Math.floor((x + 1) * escalaX))

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0

      for (let sy = desdeY; sy < hastaY; sy++) {
        for (let sx = desdeX; sx < hastaX; sx++) {
          const i = (sy * ancho + sx) * 4
          const alfa = pixeles[i + 3] / 255
          r += pixeles[i] * alfa
          g += pixeles[i + 1] * alfa
          b += pixeles[i + 2] * alfa
          a += pixeles[i + 3]
          n++
        }
      }

      const alfaMedia = a / n
      const factor = alfaMedia > 0 ? 255 / alfaMedia : 0
      const j = (y * nAncho + x) * 4
      salida[j] = Math.min(255, Math.round((r / n) * factor))
      salida[j + 1] = Math.min(255, Math.round((g / n) * factor))
      salida[j + 2] = Math.min(255, Math.round((b / n) * factor))
      salida[j + 3] = Math.round(alfaMedia)
    }
  }

  return { ancho: nAncho, alto: nAlto, pixeles: salida }
}

/* ---------- Escritura ---------- */

const chunk = (tipo, datos) => {
  const cabecera = Buffer.alloc(8)
  cabecera.writeUInt32BE(datos.length, 0)
  cabecera.write(tipo, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([cabecera.subarray(4), datos])), 0)
  return Buffer.concat([cabecera, datos, crc])
}

const escribirPng = ({ ancho, alto, pixeles }, ruta) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const porLinea = ancho * 4
  const crudo = Buffer.alloc(alto * (porLinea + 1))
  for (let y = 0; y < alto; y++) {
    crudo[y * (porLinea + 1)] = 0
    pixeles.copy(crudo, y * (porLinea + 1) + 1, y * porLinea, (y + 1) * porLinea)
  }

  writeFileSync(
    ruta,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(crudo, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

/* ---------- Composición ---------- */

const marca = (() => {
  const m = recortar(reconstruirAlfa(leerPng(ORIGEN)))
  const factor = Math.min(MARCA_ANCHO_MAX / m.ancho, MARCA_ALTO_MAX / m.alto)
  return escalar(m, Math.round(m.ancho * factor), Math.round(m.alto * factor))
})()

const lienzo = Buffer.alloc(ANCHO * ALTO * 4)

/* Fondo asfalto, con la franja librea abajo */
for (let y = 0; y < ALTO; y++) {
  const color = y >= ALTO - BARRA ? LIBREA : ASFALTO
  for (let x = 0; x < ANCHO; x++) {
    const j = (y * ANCHO + x) * 4
    lienzo[j] = color[0]
    lienzo[j + 1] = color[1]
    lienzo[j + 2] = color[2]
    lienzo[j + 3] = 255
  }
}

/* La marca, centrada sobre el área que queda por encima de la franja */
const x0 = Math.round((ANCHO - marca.ancho) / 2)
const y0 = Math.round((ALTO - BARRA - marca.alto) / 2)

for (let y = 0; y < marca.alto; y++) {
  for (let x = 0; x < marca.ancho; x++) {
    const i = (y * marca.ancho + x) * 4
    const a = marca.pixeles[i + 3] / 255
    if (a === 0) continue
    const j = ((y + y0) * ANCHO + (x + x0)) * 4
    lienzo[j] = Math.round(marca.pixeles[i] * a + lienzo[j] * (1 - a))
    lienzo[j + 1] = Math.round(marca.pixeles[i + 1] * a + lienzo[j + 1] * (1 - a))
    lienzo[j + 2] = Math.round(marca.pixeles[i + 2] * a + lienzo[j + 2] * (1 - a))
  }
}

escribirPng({ ancho: ANCHO, alto: ALTO, pixeles: lienzo }, DESTINO)

console.log(
  `og-carmeet.png  ${ANCHO}x${ALTO}  ` +
    `${(statSync(DESTINO).size / 1024).toFixed(1)} KB  ` +
    `(marca ${marca.ancho}x${marca.alto})`,
)
