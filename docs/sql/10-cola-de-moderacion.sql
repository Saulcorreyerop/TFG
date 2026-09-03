-- =====================================================================
-- BLOQUE 10 — Dejar la cola de moderación lista para el panel
--
-- QUÉ ARREGLA
--
--   Desde el bloque 6, los usuarios pueden denunciar contenido. Nadie
--   lo ve. Las denuncias entran en `reports` y ahí se quedan: el panel
--   de administración no tiene ni pestaña. Moderación que no se lee es
--   peor que no tenerla, porque el usuario cree que ha servido de algo.
--
--   Este bloque prepara la base para la pestaña nueva:
--
--   1. Fija los tres estados posibles de una denuncia. Ahora mismo la
--      restricción admite lo que se pusiera en el bloque 6, y el panel
--      necesita saber con certeza qué valores puede escribir.
--   2. Da permiso a los administradores para cambiar ese estado.
--   3. Índice para que la cola no haga un recorrido completo de la tabla.
--
-- ES SEGURO: todo el bloque es una transacción y no borra ninguna
-- denuncia. Lo único que toca de los datos es normalizar estados raros
-- a 'pendiente'.
--
-- Se puede ejecutar cuando quieras, antes o después del merge. La
-- pestaña del panel aparecerá cuando despliegues el código.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

do $$
declare
  v_con text;
  v_raros int;
begin
  ------------------------------------------------------------------
  -- 1. Normalizar lo que haya
  ------------------------------------------------------------------
  update public.reports
  set estado = 'pendiente'
  where estado is null
     or estado not in ('pendiente', 'resuelta', 'descartada');

  get diagnostics v_raros = row_count;
  raise notice 'Denuncias normalizadas a pendiente: %', v_raros;

  ------------------------------------------------------------------
  -- 2. Rehacer la restricción con los tres estados que usa el panel
  ------------------------------------------------------------------
  for v_con in
    select con.conname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'reports'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%estado%'
  loop
    execute format('alter table public.reports drop constraint %I', v_con);
    raise notice 'Restriccion vieja eliminada: %', v_con;
  end loop;

  alter table public.reports
    add constraint reports_estado_valido
    check (estado in ('pendiente', 'resuelta', 'descartada'));

  alter table public.reports
    alter column estado set default 'pendiente';

  raise notice 'Estados fijados: pendiente, resuelta, descartada';
end $$;

-- --- 3. Los administradores pueden resolver ---------------------------
-- Leer ya podían desde el bloque 6. Escribir no, así que el panel no
-- habría podido marcar nada como resuelto.
drop policy if exists "reports_admin_actualizar" on public.reports;

create policy "reports_admin_actualizar"
  on public.reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- --- 4. Índice para la cola ------------------------------------------
-- La pestaña abre siempre por 'pendiente' y ordena por fecha.
create index if not exists idx_reports_estado_fecha
  on public.reports (estado, created_at desc);

-- --- Comprobación ----------------------------------------------------
select jsonb_build_object(
  'restriccion', (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'reports' and con.conname = 'reports_estado_valido'
  ),
  'politicas_reports', (
    select jsonb_agg(jsonb_build_object('nombre', policyname, 'accion', cmd)
                     order by policyname)
    from pg_policies
    where schemaname = 'public' and tablename = 'reports'
  ),
  'indice', (
    select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'idx_reports_estado_fecha'
  ),
  'denuncias_por_estado', (
    select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
    from (select estado, count(*) as n from public.reports group by estado) t
  ),
  'columnas_de_la_vista', (
    select string_agg(column_name, ', ' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cola_moderacion'
  )
) as resultado;
