-- =====================================================================
-- BLOQUE 15 — Provincia de cada evento
--
-- QUÉ ARREGLA
--
--   Las páginas de zona se construían con la cadena `ubicacion` tal como
--   la devuelve Nominatim, y eso da granularidad mezclada:
--
--     "Zafra, Badajoz"                  ciudad, provincia
--     "Cáceres, Extremadura"            ciudad, comunidad autónoma
--     "Casar de Cáceres, Extremadura"   pueblo, comunidad autónoma
--
--   Resultado: una página por municipio, con direcciones ilegibles como
--   /eventos/Casar%20de%20C%C3%A1ceres%2C%20Extremadura, y el contenido
--   partido en migajas de un evento cada una.
--
--   Nadie busca "quedadas coches Casar de Cáceres". Busca "quedadas
--   coches Cáceres". Con la provincia, los eventos se juntan donde la
--   gente los busca: Madrid pasa de dos páginas sueltas a una con tres
--   eventos, y Cáceres de dos a una con dos.
--
--   `ubicacion` se queda como está: es lo que se enseña en la ficha, y
--   ahí sí interesa el pueblo exacto. La provincia es para agrupar.
--
-- ES SEGURO: añade una columna opcional y la rellena. No borra nada ni
-- cambia ningún dato existente.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

alter table public.events add column if not exists provincia text;

comment on column public.events.provincia is
  'Slug de la provincia española (caceres, a-coruna, madrid...). Agrupa los eventos para /eventos/:provincia. La lista canónica está en src/utils/provincias.js';

-- --- Relleno de lo que ya hay ----------------------------------------
-- Sacado de traducir las coordenadas de cada evento con Nominatim, el
-- mismo servicio que usa la web, y pasarlo por la lista de las 50
-- provincias.

update public.events set provincia = 'caceres'    where id = 37 and provincia is null;
update public.events set provincia = 'a-coruna'   where id = 44 and provincia is null;
update public.events set provincia = 'madrid'     where id = 45 and provincia is null;
update public.events set provincia = 'cadiz'      where id = 46 and provincia is null;
update public.events set provincia = 'madrid'     where id = 47 and provincia is null;
update public.events set provincia = 'madrid'     where id = 48 and provincia is null;
update public.events set provincia = 'caceres'    where id = 49 and provincia is null;
update public.events set provincia = 'valladolid' where id = 50 and provincia is null;
update public.events set provincia = 'badajoz'    where id = 51 and provincia is null;

-- --- Índice ----------------------------------------------------------
-- La página de zona pide siempre provincia + no terminado, ordenado por
-- fecha. Este índice cubre justo esa consulta.
create index if not exists idx_events_provincia_fecha
  on public.events (provincia, fecha_hasta);

-- --- Comprobación ----------------------------------------------------
select jsonb_build_object(
  'eventos_con_provincia', (select count(*) from public.events where provincia is not null),
  'eventos_sin_provincia', (select count(*) from public.events where provincia is null),
  'paginas_de_zona', (
    select jsonb_object_agg(provincia, n)
    from (
      select provincia, count(*) as n
      from public.events
      where provincia is not null
      group by provincia
      order by provincia
    ) t
  ),
  'antes_habia_paginas', (
    select count(distinct ubicacion) from public.events where ubicacion is not null
  ),
  'indice', (
    select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'idx_events_provincia_fecha'
  )
) as resultado;
