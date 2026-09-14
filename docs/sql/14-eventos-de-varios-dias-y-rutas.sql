-- =====================================================================
-- BLOQUE 14 — Eventos de varios días y rutas con su trazado
--
-- QUÉ AÑADE
--
--   1. `fecha_fin`. Hasta ahora un evento era un instante, y eso deja
--      fuera justo los eventos grandes: un gran premio, el EMF de Jerez
--      del 7 y 8 de noviembre, un fin de semana de EuroCrew. Se
--      publicaban como si duraran un rato del viernes.
--
--      Es opcional: un evento de una tarde sigue sin tenerla.
--
--   2. `fecha_hasta`, columna generada. Vale `fecha_fin` y, si no hay,
--      `fecha`. Existe para responder a una sola pregunta, que es la que
--      hace la agenda cien veces al día: ¿este evento ya ha pasado? Sin
--      ella habría que escribir un coalesce en cada consulta, y desde la
--      API REST eso no se puede filtrar ni indexar bien.
--
--      Un evento de dos días tiene que seguir saliendo como próximo
--      durante el primero. Antes, con solo `fecha`, desaparecía de la
--      agenda a la hora de empezar.
--
--   3. `ruta`. El trazado de las rutas y tramos, para poder pintarlo
--      sobre el mapa en vez de enseñar un único punto. Se guarda así:
--
--        { "puntos": [[lat, lng], ...], "distancia": 24300 }
--
--      La distancia va en metros. Se eligen pares [lat, lng] y no
--      GeoJSON porque es exactamente lo que espera Leaflet, que es quien
--      lo pinta: sin conversiones por medio hay menos sitios donde
--      equivocarse de orden y acabar dibujando la ruta en el mar.
--
-- ES SEGURO: solo añade columnas, todas opcionales. Nada de lo que hay
-- cambia y ningún evento existente se ve afectado.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

alter table public.events add column if not exists fecha_fin timestamptz;

alter table public.events add column if not exists ruta jsonb;

-- La columna generada solo se puede crear si no existe ya
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name = 'fecha_hasta'
  ) then
    alter table public.events
      add column fecha_hasta timestamptz
      generated always as (coalesce(fecha_fin, fecha)) stored;
  end if;
end $$;

-- Que la fecha de fin no pueda ser anterior a la de inicio. Sin esto, un
-- error al escribirla deja un evento que ya nació caducado.
alter table public.events drop constraint if exists events_fecha_fin_coherente;
alter table public.events
  add constraint events_fecha_fin_coherente
  check (fecha_fin is null or fecha_fin >= fecha);

-- La agenda ordena por fecha y filtra por fecha_hasta
create index if not exists idx_events_fecha_hasta on public.events (fecha_hasta);

-- --- Comprobación ----------------------------------------------------
select jsonb_build_object(
  'columnas_nuevas', (
    select jsonb_object_agg(column_name,
             jsonb_build_object('tipo', data_type,
                                'generada', is_generated))
    from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name in ('fecha_fin', 'fecha_hasta', 'ruta')
  ),
  'restriccion', (
    select pg_get_constraintdef(oid)
    from pg_constraint where conname = 'events_fecha_fin_coherente'
  ),
  'indice', (
    select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'idx_events_fecha_hasta'
  ),
  'eventos_totales', (select count(*) from public.events),
  'proximos_ahora', (
    select count(*) from public.events where fecha_hasta >= now()
  )
) as resultado;
