-- =====================================================================
-- BLOQUE 16 — Borrar mensajes de los chats
--
-- QUÉ ARREGLA
--
--   En el chat global y en el de las crews no se puede borrar nada desde
--   la propia web. Lo único que ofrece cada mensaje es denunciarlo.
--
--   Para un administrador eso significa que, si alguien suelta algo
--   ofensivo, depende de que OTRA persona lo denuncie para que aparezca
--   en la cola de moderación y poder quitarlo. Mientras tanto, o entra
--   al editor SQL o el mensaje se queda ahí. En un chat público abierto
--   eso no vale.
--
--   Y un usuario normal no puede ni retirar lo que ha escrito él, que es
--   lo primero que espera cualquiera y lo que evita la mitad de las
--   denuncias: la gente se equivoca, se arrepiente y lo quita.
--
--   El bloque 6 dejó políticas de borrado por moderación, pero no consta
--   cuáles ni sobre qué tablas. Este script mira lo que hay, informa, y
--   añade solo lo que falte.
--
-- SE BORRA DE VERDAD
--
--   Es un DELETE, no una marca de "eliminado". El texto desaparece de la
--   base. Con una marca, la fila seguiría ahí y cualquiera podría leer
--   el mensaje llamando a la API aunque la web no lo pintara: borrado
--   de mentira.
--
-- ES SEGURO: no borra ningún mensaje. Solo crea políticas.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

create temp table if not exists _paso16 (n serial, mensaje text) on commit drop;
truncate _paso16;

do $$
declare
  t         text;
  v_previas text;
begin
  foreach t in array array['global_messages', 'crew_messages']
  loop
    select string_agg(policyname, ', ' order by policyname) into v_previas
    from pg_policies
    where schemaname = 'public' and tablename = t and cmd = 'DELETE';

    insert into _paso16 (mensaje)
    values (t || ' — politicas de borrado que ya habia: ' || coalesce(v_previas, 'ninguna'));

    ------------------------------------------------------------------
    -- 1. Cada uno puede borrar lo suyo
    ------------------------------------------------------------------
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_borrar_propio', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_borrar_propio', t
    );

    ------------------------------------------------------------------
    -- 2. Un administrador puede borrar cualquiera
    --
    -- Se recrea aunque ya existiera algo parecido: así queda una sola
    -- política con un nombre predecible, en vez de dos que hacen lo
    -- mismo y nadie sabe cuál manda.
    ------------------------------------------------------------------
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_borrar_admin', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ('
      || 'exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))',
      t || '_borrar_admin', t
    );

    insert into _paso16 (mensaje)
    values (t || ' — anadidas: borrar lo propio y borrar siendo admin');
  end loop;
end $$;

-- --- Para que el borrado llegue en vivo a los demas ------------------
-- Realtime solo manda los DELETE si la tabla publica la fila completa.
-- Sin esto, quien tuviera el chat abierto seguiria viendo el mensaje
-- hasta recargar.
alter table public.global_messages replica identity full;
alter table public.crew_messages   replica identity full;

-- --- Comprobación ----------------------------------------------------
select
  (select string_agg(mensaje, chr(10) order by n) from _paso16) as lo_que_ha_pasado,
  (select jsonb_object_agg(tablename, politicas)
   from (
     select tablename, jsonb_agg(policyname order by policyname) as politicas
     from pg_policies
     where schemaname = 'public'
       and tablename in ('global_messages', 'crew_messages')
       and cmd = 'DELETE'
     group by tablename
   ) t) as politicas_de_borrado,
  (select count(*) from public.global_messages) as mensajes_en_el_chat_global;
