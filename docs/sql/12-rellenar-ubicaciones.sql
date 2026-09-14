-- =====================================================================
-- BLOQUE 12 — Rellenar la ubicación de los eventos que se guardaron sin ella
--
-- QUÉ ARREGLA
--
--   `AddEventDialog` detectaba la ubicación, la enseñaba en pantalla...
--   y no la guardaba: la columna `ubicacion` no estaba en la lista del
--   insert. Así que todo evento creado desde ahí se quedaba sin ella.
--   Siete de los quince que había, incluido el primero que publicó un
--   usuario de fuera.
--
--   Duele porque la ubicación es la que agrupa los eventos por provincia
--   en /eventos/:provincia, la que sale en el título al compartir por
--   WhatsApp, y la que Google necesita en los datos estructurados para
--   meter una quedada en su carrusel de eventos. Sin ella el evento
--   existe pero no lo encuentra nadie.
--
--   El código ya está arreglado: ahora se guarda, y si llegara vacía se
--   resuelve a partir de las coordenadas antes de insertar.
--
--   Esto es solo el arreglo de lo que ya estaba guardado. Los nombres
--   salen de traducir las coordenadas de cada evento con Nominatim, el
--   mismo servicio que usa la web.
--
-- ES SEGURO: solo escribe en eventos que hoy tienen la ubicación vacía.
-- Si alguno ya la tiene, no se toca.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

update public.events set ubicacion = 'Málaga, Andalucía'
  where id = 34 and (ubicacion is null or ubicacion = '');

update public.events set ubicacion = 'Cáceres, Extremadura'
  where id = 36 and (ubicacion is null or ubicacion = '');

update public.events set ubicacion = 'Casar de Cáceres, Extremadura'
  where id = 37 and (ubicacion is null or ubicacion = '');

update public.events set ubicacion = 'Cáceres, Extremadura'
  where id = 39 and (ubicacion is null or ubicacion = '');

update public.events set ubicacion = 'Cáceres, Extremadura'
  where id = 40 and (ubicacion is null or ubicacion = '');

update public.events set ubicacion = 'Miajadas, Extremadura'
  where id = 43 and (ubicacion is null or ubicacion = '');

-- El de la comunidad: KDD QUEIRUGA RACING, en la costa de A Coruña.
update public.events set ubicacion = 'O Porto do Son, Galicia'
  where id = 44 and (ubicacion is null or ubicacion = '');

-- --- Comprobación ----------------------------------------------------
select
  count(*) filter (where ubicacion is null or ubicacion = '') as siguen_sin_ubicacion,
  count(*) filter (where ubicacion is not null and ubicacion <> '') as con_ubicacion,
  count(*) as total,
  (select string_agg(distinct ubicacion, ' | ' order by ubicacion)
   from public.events
   where ubicacion is not null and ubicacion <> '') as zonas
from public.events;
