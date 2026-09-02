/*
 * Genera los iconos del sitio a partir de public/logo.png.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Por qué existe: el logo original es un PNG de 2048x2048 y 6,5 MB que
 * estaba puesto como favicon. Cada visita a cualquier página descargaba
 * casi 7 MB para pintar un icono de 32 píxeles en la pestaña. Además
 * arrastra un chunk caBX de 317 KB con metadatos de Canva.
 *
 * Se hace con Node a pelo, sin dependencias, porque no merece la pena
 * añadir sharp al proyecto para algo que se ejecuta cuando cambia el
 * logo, o sea casi nunca.
 *
 * Trabaja solo con PNG RGBA de 8 bits sin entrelazar, que es lo que es el
 * logo. Si algún día se cambia por otro formato, avisa en vez de generar
 * basura en silencio.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
/*
 * El original es logo-original.png, no logo.png: el logo tal cual se
 * exportó NO tiene transparencia. Es 100% opaco y lleva el tablero de
 * cuadros gris y blanco de Canva pintado dentro de los píxeles, lo que
 * además explica su peso: un tablero fino comprime pésimamente.
 *
 * Aquí se reconstruye la transparencia a partir de la luminosidad, que
 * funciona porque la marca es una forma plana oscura sobre un fondo
 * claro.
 */
const ORIGEN = join(RAIZ, 'assets-fuente', 'logo-original.png')

/* Color real de la marca, medido en el centro del original */
const TINTA = [42, 45, 50]
/* Fondo de los iconos de aplicación: el asfalto del sistema Librea */
const ASFALTO = [14, 14, 16]

/* Qué se genera. `cuadrado` rellena hasta un lienzo cuadrado, que es lo
   que piden los iconos de aplicación; el logo del pie conserva su forma. */
const SALIDAS = [
  /* Iconos de aplicación: marca en blanco sobre asfalto opaco. Con fondo
     transparente desaparecerían en las pestañas de tema oscuro. */
  { archivo: 'favicon-32.png', lado: 32, cuadrado: true, margen: 0.1, fondo: ASFALTO },
  { archivo: 'apple-touch-icon.png', lado: 180, cuadrado: true, margen: 0.18, fondo: ASFALTO },
  { archivo: 'icon-192.png', lado: 192, cuadrado: true, margen: 0.18, fondo: ASFALTO },
  { archivo: 'icon-512.png', lado: 512, cuadrado: true, margen: 0.18, fondo: ASFALTO },
  /* Logo del pie: marca sobre transparencia, con su color real. En tema
     oscuro se invierte por CSS. */
  { archivo: 'logo.png', ancho: 480, cuadrado: false },
]

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

const leerPng = (ruta) => {
  const b = readFileSync(ruta)

  const firma = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!firma.every((v, i) => b[i] === v)) {
    throw new Error('El archivo no es un PNG')
  }

  const ancho = b.readUInt32BE(16)
  const alto = b.readUInt32BE(20)
  const bits = b[24]
  const tipoColor = b[25]
  const entrelazado = b[28]

  if (bits !== 8 || tipoColor !== 6 || entrelazado !== 0) {
    throw new Error(
      `Solo se admite PNG RGBA de 8 bits sin entrelazar. ` +
        `Este es bits=${bits} tipo=${tipoColor} entrelazado=${entrelazado}.`,
    )
  }

  // Juntar todos los IDAT: el PNG los parte en trozos
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

/* Deshace los filtros por línea que aplica el formato PNG */
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
        case 0: resultado = valor; break
        case 1: resultado = valor + a; break
        case 2: resultado = valor + b; break
        case 3: resultado = valor + ((a + b) >> 1); break
        case 4: resultado = valor + paeth(a, b, c); break
        default: throw new Error(`Filtro PNG desconocido: ${filtro}`)
      }
      salida[destino + x] = resultado & 0xff
    }
  }

  return salida
}

/* ---------- Reconstrucción de la transparencia ----------
 *
 * La marca es oscura (luminosidad ~45) y el tablero de fondo es claro
 * (220 y 254). Se convierte la luminosidad en canal alfa con una rampa,
 * de modo que ambos tonos del tablero quedan totalmente transparentes y
 * los bordes suavizados de la marca conservan su antialiasing.
 */

const CLARO = 200 // por encima de esto, fondo
const OSCURO = 60 // por debajo de esto, marca

const reconstruirAlfa = ({ ancho, alto, pixeles }) => {
  const salida = Buffer.alloc(ancho * alto * 4)

  for (let i = 0; i < ancho * alto; i++) {
    const j = i * 4
    const lum =
      0.2126 * pixeles[j] + 0.7152 * pixeles[j + 1] + 0.0722 * pixeles[j + 2]

    const alfa = Math.max(0, Math.min(1, (CLARO - lum) / (CLARO - OSCURO)))

    // Color plano: así los bordes no arrastran gris del tablero
    salida[j] = TINTA[0]
    salida[j + 1] = TINTA[1]
    salida[j + 2] = TINTA[2]
    salida[j + 3] = Math.round(alfa * 255)
  }

  return { ancho, alto, pixeles: salida }
}

/* Compone sobre un fondo opaco y pinta la marca en blanco */
const sobreFondo = ({ ancho, alto, pixeles }, fondo) => {
  const salida = Buffer.alloc(ancho * alto * 4)

  for (let i = 0; i < ancho * alto; i++) {
    const j = i * 4
    const a = pixeles[j + 3] / 255
    salida[j] = Math.round(255 * a + fondo[0] * (1 - a))
    salida[j + 1] = Math.round(255 * a + fondo[1] * (1 - a))
    salida[j + 2] = Math.round(255 * a + fondo[2] * (1 - a))
    salida[j + 3] = 255
  }

  return { ancho, alto, pixeles: salida }
}

/* ---------- Recorte del margen transparente ---------- */

const recortar = ({ ancho, alto, pixeles }) => {
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1

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

/* ---------- Reescalado ----------
 * Media por cajas con alfa premultiplicado. Sin premultiplicar, los
 * píxeles transparentes (que suelen ser negros) tiñen los bordes y el
 * logo sale con un halo oscuro.
 */

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

      let r = 0, g = 0, b = 0, a = 0, n = 0

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

/* Centra la imagen en un lienzo cuadrado transparente */
const cuadrar = ({ ancho, alto, pixeles }, lado) => {
  const salida = Buffer.alloc(lado * lado * 4)
  const x0 = Math.floor((lado - ancho) / 2)
  const y0 = Math.floor((lado - alto) / 2)

  for (let y = 0; y < alto; y++) {
    pixeles.copy(
      salida,
      ((y + y0) * lado + x0) * 4,
      y * ancho * 4,
      (y + 1) * ancho * 4,
    )
  }

  return { ancho: lado, alto: lado, pixeles: salida }
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
  ihdr[8] = 8   // bits por canal
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0  // compresión
  ihdr[11] = 0  // filtro
  ihdr[12] = 0  // sin entrelazar

  // Filtro 0 en todas las líneas: para dibujos planos comprime igual de
  // bien que filtros más listos y el código queda claro.
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

/* ---------- Principal ---------- */

const kb = (n) => (n / 1024).toFixed(1) + ' KB'

const original = leerPng(ORIGEN)
const conAlfa = reconstruirAlfa(original)
const recortado = recortar(conAlfa)

console.log(
  `Origen:   ${original.ancho}x${original.alto}  ${kb(readFileSync(ORIGEN).length)}`,
)
console.log(
  `Recortado: ${recortado.ancho}x${recortado.alto}  (fuera el margen transparente)\n`,
)

mkdirSync(join(RAIZ, 'public'), { recursive: true })

for (const { archivo, lado, ancho, cuadrado, margen, fondo } of SALIDAS) {
  let imagen

  if (cuadrado) {
    const util = Math.round(lado * (1 - margen * 2))
    const escala = Math.min(util / recortado.ancho, util / recortado.alto)
    imagen = cuadrar(
      escalar(
        recortado,
        Math.max(1, Math.round(recortado.ancho * escala)),
        Math.max(1, Math.round(recortado.alto * escala)),
      ),
      lado,
    )
  } else {
    const escala = ancho / recortado.ancho
    imagen = escalar(recortado, ancho, Math.max(1, Math.round(recortado.alto * escala)))
  }

  if (fondo) imagen = sobreFondo(imagen, fondo)

  const destino = join(RAIZ, 'public', archivo)
  escribirPng(imagen, destino)
  console.log(
    `  ${archivo.padEnd(24)} ${String(imagen.ancho).padStart(4)}x${String(imagen.alto).padEnd(4)}  ${kb(readFileSync(destino).length)}`,
  )
}
