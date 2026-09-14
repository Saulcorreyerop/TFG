-- =====================================================================
-- BLOQUE 11 — Que se puedan borrar eventos y cuentas
--
-- QUÉ ARREGLA
--
--   Borrar un evento desde el panel falla con esto:
--
--     update or delete on table "events" violates foreign key
--     constraint "notifications_evento_id_fkey" on table "notifications"
--
--   La causa: las claves foráneas se crearon sin decir qué hacer cuando
--   desaparece la fila padre. Por defecto PostgreSQL usa NO ACTION, que
--   significa "no la borres si alguien la está apuntando". Como cada
--   evento genera notificaciones, cualquier evento con una notificación
--   asociada es imborrable. Lo mismo pasará al borrar cuentas.
--
--   Este bloque recorre TODAS las claves foráneas del esquema public y
--   les pone la regla que corresponde:
--
--     tablas dependientes  -> ON DELETE CASCADE
--       (notificaciones, asistencias, comentarios, fotos, favoritos,
--        seguimientos, likes, miembros, mensajes, denuncias, bloqueos)
--       Una notificación sobre un evento que ya no existe no significa
--       nada. Se va con él.
--
--     events.crew_id       -> ON DELETE SET NULL
--       Si se borra una crew, su evento sobrevive; solo deja de estar
--       asociado a ella.
--
--     crews.created_by     -> ON DELETE SET NULL si la columna lo admite
--       Borrar al fundador no puede llevarse por delante una crew con
--       miembros dentro.
--
--   Cualquier otra clave foránea se deja como está y se informa. El
--   script no toca nada que no esté en esa lista.
--
-- ES SEGURO: no borra ni una fila. Solo cambia reglas. Todo es una
-- transacción; si algo falla, no se aplica nada.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

create temp table if not exists _paso11 (n serial, mensaje text) on commit drop;
truncate _paso11;

do $$
declare
  r          record;
  v_regla    text;
  v_nulable  boolean;
  v_cambios  int := 0;
begin
  for r in
    select
      con.conname                as nombre,
      con.conrelid::regclass     as tabla,
      c.relname                  as tabla_txt,
      a.attname                  as columna,
      con.confrelid::regclass    as ref_tabla,
      af.attname                 as ref_columna,
      con.confdeltype            as regla_actual,
      a.attnotnull               as no_admite_nulo,
      array_length(con.conkey, 1) as n_columnas
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    join pg_attribute af
      on af.attrelid = con.confrelid and af.attnum = con.confkey[1]
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
    order by c.relname, con.conname
  loop
    -- Las claves de varias columnas no las toca: aquí no hay ninguna,
    -- pero si algún día la hay, mejor avisar que improvisar.
    if r.n_columnas > 1 then
      insert into _paso11 (mensaje)
      values ('SIN TOCAR (varias columnas): ' || r.nombre);
      continue;
    end if;

    -- 'c' = CASCADE, 'n' = SET NULL. Si ya está bien, no se toca.
    if r.regla_actual in ('c', 'n') then
      continue;
    end if;

    v_regla := null;
    v_nulable := not r.no_admite_nulo;

    if r.tabla_txt in (
      'notifications', 'event_attendees', 'event_comments', 'event_images',
      'favorites', 'vehicle_images', 'vehicle_likes', 'follows',
      'crew_members', 'crew_messages', 'global_messages', 'reports', 'blocks'
    ) then
      v_regla := 'cascade';

    elsif r.tabla_txt = 'events' and r.columna = 'crew_id' then
      v_regla := case when v_nulable then 'set null' else 'cascade' end;

    elsif r.tabla_txt = 'events' and r.columna = 'user_id' then
      v_regla := 'cascade';

    elsif r.tabla_txt = 'vehicles' and r.columna = 'user_id' then
      v_regla := 'cascade';

    elsif r.tabla_txt = 'crews' and r.columna = 'created_by' then
      if v_nulable then
        v_regla := 'set null';
      else
        insert into _paso11 (mensaje)
        values ('SIN TOCAR: ' || r.nombre || ' (crews.created_by no admite nulo; '
                || 'borrar al fundador borraria la crew entera, mejor decidirlo a mano)');
        continue;
      end if;
    end if;

    if v_regla is null then
      insert into _paso11 (mensaje)
      values ('SIN TOCAR (no esta en la politica): ' || r.tabla_txt || '.'
              || r.columna || ' -> ' || r.ref_tabla::text);
      continue;
    end if;

    execute format('alter table %s drop constraint %I', r.tabla, r.nombre);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references %s(%I) on delete %s',
      r.tabla, r.nombre, r.columna, r.ref_tabla, r.ref_columna, v_regla
    );

    v_cambios := v_cambios + 1;
    insert into _paso11 (mensaje)
    values ('ARREGLADA: ' || r.tabla_txt || '.' || r.columna || ' -> '
            || r.ref_tabla::text || '  (on delete ' || v_regla || ')');
  end loop;

  if v_cambios = 0 then
    insert into _paso11 (mensaje)
    values ('No habia nada que arreglar: todas las claves foraneas ya tenian regla.');
  end if;
end $$;

-- --- Resultado -------------------------------------------------------
select
  (select string_agg(mensaje, chr(10) order by n) from _paso11)
    as lo_que_ha_pasado,
  (select count(*)
   from pg_constraint con
   join pg_class c on c.oid = con.conrelid
   where con.contype = 'f'
     and con.connamespace = 'public'::regnamespace
     and con.confdeltype not in ('c', 'n'))
    as claves_que_siguen_bloqueando,
  (select string_agg(c.relname || '.' || a.attname, ', ' order by c.relname)
   from pg_constraint con
   join pg_class c on c.oid = con.conrelid
   join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
   where con.contype = 'f'
     and con.connamespace = 'public'::regnamespace
     and con.confdeltype not in ('c', 'n'))
    as cuales_son;
