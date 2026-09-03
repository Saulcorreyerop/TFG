-- =====================================================================
-- BLOQUE 08 — Sacar el correo de la tabla `profiles`
--
-- QUÉ ARREGLA
--
--   `profiles` es de lectura pública, y tiene una columna `email`. Ahora
--   mismo, sin cuenta ni nada, cualquiera puede pedir esto:
--
--     GET /rest/v1/profiles?select=email
--
--   y descargarse el correo de todos los usuarios. Bajo el RGPD es una
--   brecha notificable. El correo seguirá existiendo en `auth.users`,
--   que es donde tiene que estar y sí está protegida.
--
-- ⚠️  ESTO VA DESPUÉS DE HACER MERGE A `main`. NO ANTES.
--
--   Las variables de entorno ya están puestas en Netlify, pero eso solo
--   sirve para el código que esté desplegado. Mientras carmeet.es siga
--   sirviendo la versión vieja, es el navegador quien resuelve el
--   usuario leyendo `profiles.email`. Si borras la columna antes del
--   merge, entrar con NOMBRE DE USUARIO deja de funcionar en el sitio
--   real. Entrar con el correo seguiría funcionando siempre.
--
--   El despliegue de la rama `desarrollo` sí lleva el código nuevo, así
--   que allí no se nota. Es producción la que se queda atrás.
--
-- ES SEGURO: todo el bloque es una transacción. Si algo no cuadra,
-- aborta y no cambia nada.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

do $$
declare
  v_def      text;
  v_nuevo    text;
  v_otras    text;
  v_vistas   text;
begin
  ------------------------------------------------------------------
  -- 1. ¿Sigue existiendo la columna?
  ------------------------------------------------------------------
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'email'
  ) then
    raise notice 'La columna profiles.email ya no existe. Nada que hacer.';
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
    raise exception
      'Estas funciones tambien tocan profiles.email: %. Pasamelas antes de seguir.',
      v_otras;
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
    raise exception 'Estas vistas dependen de profiles.email: %', v_vistas;
  end if;

  ------------------------------------------------------------------
  -- 4. Quitar el correo de handle_new_user
  --
  -- No se reescribe la función a mano porque no sabemos qué más hace.
  -- Se coge su definición real, se le quitan las dos apariciones del
  -- correo, y solo se aplica si el resultado ya no menciona ninguno.
  -- Si el cuerpo no es el esperado, esto aborta sin tocar nada.
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user';

  if v_def is null then
    raise exception 'No existe public.handle_new_user';
  end if;

  /* Un solo % : es el hueco donde entra el argumento. Estaba escrito
     %%, que en RAISE significa "un signo de porcentaje literal", asi que
     no habia hueco para el argumento y Postgres abortaba la compilacion
     entera con "too many parameters specified for RAISE". */
  raise notice 'Definicion actual de handle_new_user:%', chr(10) || v_def;

  -- Primero new.email, que contiene la palabra email dentro
  v_nuevo := regexp_replace(v_def, '\s*\ynew\.email\y\s*,', '', 'gi');
  v_nuevo := regexp_replace(v_nuevo, ',\s*\ynew\.email\y\s*', '', 'gi');
  -- Después el nombre de columna suelto
  v_nuevo := regexp_replace(v_nuevo, '\s*\yemail\y\s*,', '', 'gi');
  v_nuevo := regexp_replace(v_nuevo, ',\s*\yemail\y\s*', '', 'gi');

  if v_nuevo ~* '\yemail\y' then
    raise exception
      'No he sabido quitar el correo de handle_new_user. Copiame la definicion que aparece arriba en Notices.';
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
  raise notice 'handle_new_user actualizada.';

  ------------------------------------------------------------------
  -- 5. Fuera la columna
  ------------------------------------------------------------------
  alter table public.profiles drop column email;
  raise notice 'Columna profiles.email eliminada.';
end $$;

-- Comprobación final: esto es lo único que verás en la tabla de resultados.
select jsonb_build_object(
  'columna_email_sigue',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'email'
    ),
  'handle_new_user_menciona_email',
    coalesce((
      select p.prosrc ~* '\yemail\y'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user'
    ), false),
  'handle_new_user_con_search_path',
    coalesce((
      select p.proconfig::text like '%search_path%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user'
    ), false),
  'columnas_de_profiles',
    (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles')
) as resultado;
