-- =====================================================================
-- BLOQUE 05 — Limpiar send_onesignal_notification
--
-- Qué hace:
--   1. Mira si algún trigger o alguna otra función la está usando.
--   2. Si NO la usa nadie  -> la borra.
--   3. Si SÍ la usa alguien -> no borra nada y te lo dice.
--
-- Por qué:
--   Esa función guarda en su propio texto la clave REST vieja de
--   OneSignal (la que ya rotaste, así que no es explotable), y no tiene
--   search_path fijado. Mientras exista, la clave vieja sigue escrita
--   en la base de datos y la función es un vector de escalada.
--
-- Es seguro ejecutarlo: si algo la usa, no toca nada.
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

do $$
declare
  v_usos     int;
  v_detalle  text;
  v_existe   boolean;
begin
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'send_onesignal_notification'
  ) into v_existe;

  if not v_existe then
    raise notice 'RESULTADO: la funcion ya no existe. No hay nada que hacer.';
    return;
  end if;

  -- ¿La menciona el cuerpo de alguna otra función?
  select count(*), coalesce(string_agg(p.proname, ', '), '-')
    into v_usos, v_detalle
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname <> 'send_onesignal_notification'
    and p.prosrc ilike '%send_onesignal_notification%';

  if v_usos > 0 then
    raise notice 'RESULTADO: NO SE BORRA. La usan estas funciones: %', v_detalle;
    raise notice 'Pasame ese nombre y te digo como sustituirla.';
    return;
  end if;

  -- ¿La llama directamente algún trigger?
  select count(*), coalesce(string_agg(t.tgname, ', '), '-')
    into v_usos, v_detalle
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and p.proname = 'send_onesignal_notification';

  if v_usos > 0 then
    raise notice 'RESULTADO: NO SE BORRA. La llaman estos triggers: %', v_detalle;
    return;
  end if;

  drop function if exists public.send_onesignal_notification cascade;
  raise notice 'RESULTADO: BORRADA. No la usaba nadie.';
end $$;

-- Comprobación final. Esto es lo unico que veras en la tabla de resultados.
select
  case
    when count(*) = 0 then 'OK — la funcion ya no existe'
    else 'SIGUE AHI — mira los mensajes de la pestana Messages/Notices'
  end as resultado,
  count(*) as cuantas_quedan
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'send_onesignal_notification';
