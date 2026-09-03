-- =====================================================================
-- BLOQUE 08 (v3) — Sacar el correo de la tabla `profiles`
--
-- QUÉ ARREGLA
--
--   `profiles` es de lectura pública, y tiene una columna `email`. Sin
--   cuenta ni sesión, cualquiera puede pedir esto:
--
--     GET /rest/v1/profiles?select=email
--
--   y descargarse el correo de todos los usuarios. Bajo el RGPD es una
--   brecha notificable. El correo seguirá existiendo en `auth.users`,
--   que es donde tiene que estar y sí está protegida.
--
-- POR QUÉ HAY UNA v3
--
--   Las dos versiones anteriores fallaban con
--
--     ERROR: 42601: too many parameters specified for RAISE
--
--   Aquí no queda ni un solo RAISE con cadena de formato. Los mensajes
--   se guardan en una tabla temporal y salen como resultado de la
--   consulta, y los abortos usan la forma RAISE ... USING MESSAGE, que
--   no interpreta el texto. Así el error no puede volver a aparecer.
--
--   De paso se gana algo: el editor de Supabase no enseña los avisos de
--   tipo NOTICE en ningún sitio visible, así que antes te habrías
--   perdido lo que el script tenía que contarte. Ahora sale en la tabla
--   de resultados, que es donde miras.
--
-- ⚠️  ESTO VA DESPUÉS DE HABER DESPLEGADO `main`. Si carmeet.es sirve
--     todavía la versión vieja, entrar con NOMBRE DE USUARIO deja de
--     funcionar. Con el correo funciona siempre.
--
-- ES SEGURO: todo es una transacción. Si algo no cuadra, aborta y no
-- cambia nada.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

create temp table if not exists _paso08 (n serial, mensaje text) on commit drop;
truncate _paso08;

do $$
declare
  v_def     text;
  v_nuevo   text;
  v_otras   text;
  v_vistas  text;
begin
  ------------------------------------------------------------------
  -- 1. ¿Sigue existiendo la columna?
  ------------------------------------------------------------------
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'email'
  ) then
    insert into _paso08 (mensaje)
    values ('La columna profiles.email ya no existe. No habia nada que hacer.');
    return;
  end if;

  ------------------------------------------------------------------
  -- 2. ¿La usa alguna otra función?
  ------------------------------------------------------------------
  select string_agg(p.proname, ', ') into v_otras
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname <> 'handle_new_user'
    and p.prosrc ~* '\yprofiles\y[^;]*\yemail\y';

  if v_otras is not null then
    raise exception using message =
      'ABORTADO. Estas funciones tambien tocan profiles.email: '
      || v_otras || '. Pasamelas antes de seguir.';
  end if;

  ------------------------------------------------------------------
  -- 3. ¿La usa alguna vista?
  ------------------------------------------------------------------
  select string_agg(c.relname, ', ') into v_vistas
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class c on c.oid = r.ev_class
  join pg_class t on t.oid = d.refobjid
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
  where t.relname = 'profiles'
    and a.attname = 'email'
    and c.relkind in ('v', 'm');

  if v_vistas is not null then
    raise exception using message =
      'ABORTADO. Estas vistas dependen de profiles.email: ' || v_vistas;
  end if;

  ------------------------------------------------------------------
  -- 4. Quitar el correo de handle_new_user
  --
  -- No se reescribe la función a mano porque no sabemos todo lo que
  -- hace. Se coge su definición real, se le quitan las apariciones del
  -- correo, y solo se aplica si el resultado ya no menciona ninguno.
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user';

  if v_def is null then
    raise exception using message = 'ABORTADO. No existe public.handle_new_user';
  end if;

  insert into _paso08 (mensaje)
  values ('--- handle_new_user ANTES ---' || chr(10) || v_def);

  -- Primero new.email, que lleva la palabra email dentro
  v_nuevo := regexp_replace(v_def,   '\s*\ynew\.email\y\s*,', '', 'gi');
  v_nuevo := regexp_replace(v_nuevo, ',\s*\ynew\.email\y\s*', '', 'gi');
  -- Después el nombre de columna suelto
  v_nuevo := regexp_replace(v_nuevo, '\s*\yemail\y\s*,', '', 'gi');
  v_nuevo := regexp_replace(v_nuevo, ',\s*\yemail\y\s*', '', 'gi');

  if v_nuevo ~* '\yemail\y' then
    raise exception using message =
      'ABORTADO, y no he tocado nada. No se como quitar el correo de esta '
      || 'funcion sin romperla. Copiame esto tal cual y te la reescribo: '
      || chr(10) || v_def;
  end if;

  -- De paso, fijar el search_path si no lo tenía
  if v_nuevo !~* 'set\s+search_path' then
    v_nuevo := regexp_replace(
      v_nuevo,
      '(LANGUAGE\s+\w+)',
      E'\\1\n SET search_path = public, pg_temp',
      'i'
    );
  end if;

  execute v_nuevo;

  insert into _paso08 (mensaje)
  values ('--- handle_new_user DESPUES ---' || chr(10) || v_nuevo);

  ------------------------------------------------------------------
  -- 5. Fuera la columna
  ------------------------------------------------------------------
  alter table public.profiles drop column email;

  insert into _paso08 (mensaje) values ('Columna profiles.email ELIMINADA.');
end $$;

-- --- Resultado: esto es lo que verás en la tabla de abajo ------------
select
  (select string_agg(mensaje, chr(10) || chr(10) order by n) from _paso08)
    as lo_que_ha_pasado,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'email'
  ) as sigue_la_columna_email,
  coalesce((
    select p.prosrc ~* '\yemail\y'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ), false) as handle_new_user_menciona_email,
  coalesce((
    select p.proconfig::text like '%search_path%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ), false) as handle_new_user_con_search_path,
  (select string_agg(column_name, ', ' order by ordinal_position)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles')
    as columnas_de_profiles;
