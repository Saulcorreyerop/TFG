-- =====================================================================
-- BLOQUE 13 — Borrar la cuenta `admin` y dejar a `saul` como único
--             administrador
--
-- POR QUÉ NO SE PODÍA
--
--   El bloque 11 arregló todas las claves foráneas menos una, y lo dijo:
--
--     SIN TOCAR: crews_created_by_fkey (crews.created_by no admite nulo)
--
--   `admin` fundó la crew «560 CAR CREW». Como la columna no admite
--   nulo, PostgreSQL no puede quedarse la crew sin fundador, y como no
--   tenía regla de borrado, tampoco se lleva la crew por delante. Así
--   que la cuenta era imborrable.
--
-- QUÉ HACE ESTE BLOQUE
--
--   1. Hace `crews.created_by` admitir nulo y le pone ON DELETE SET
--      NULL. Es el arreglo general: a partir de ahora, borrar a una
--      persona nunca podrá llevarse por delante una crew con gente
--      dentro.
--
--   2. Traspasa a `saul` las crews fundadas por `admin`, y lo deja como
--      administrador de esas crews. Se hace ANTES de borrar para que la
--      crew no se quede sin nadie que pueda gestionarla: «560 CAR CREW»
--      es la única que existe y tiene una solicitud pendiente de un
--      usuario real.
--
--      Si además quieres que la crew desaparezca, bórrala después desde
--      el panel. Un clic. Al revés no hay vuelta atrás, por eso el
--      script no la borra por su cuenta.
--
--   3. Borra la cuenta `admin` de `auth.users`. Con las reglas del
--      bloque 11 ya puestas, eso se lleva en cascada su perfil, sus 5
--      eventos, sus 5 comentarios, sus 4 asistencias, su mensaje del
--      chat global, su pertenencia a la crew y sus notificaciones.
--
--   4. Comprueba que solo queda un administrador.
--
-- LO QUE NO HACE
--
--   No borra los archivos de Storage de esa cuenta. Su avatar sigue en
--   el bucket `avatars`. Es el punto que ya estaba anotado como
--   pendiente en docs/estado-base-de-datos.md; se limpia a mano desde
--   Storage buscando el id de la cuenta, que el script imprime.
--
-- ES SEGURO en el sentido de que es una transacción: si algo falla, no
-- se aplica nada. Pero BORRA UNA CUENTA DE VERDAD y eso no se deshace.
-- Léelo antes de ejecutarlo.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

create temp table if not exists _paso13 (n serial, mensaje text) on commit drop;
truncate _paso13;

do $$
declare
  v_admin   uuid;
  v_saul    uuid;
  v_avatar  text;
  v_crews   int;
  v_n       int;
begin
  select id, avatar_url into v_admin, v_avatar
  from public.profiles where username = 'admin';

  select id into v_saul
  from public.profiles where username = 'saul';

  if v_admin is null then
    insert into _paso13 (mensaje) values ('La cuenta admin ya no existe. Nada que hacer.');
    return;
  end if;

  if v_saul is null then
    raise exception using message =
      'ABORTADO: no encuentro la cuenta saul, y sin ella no hay a quien traspasar la crew.';
  end if;

  insert into _paso13 (mensaje)
  values ('Cuenta a borrar: admin (' || v_admin || ')');

  if v_avatar is not null then
    insert into _paso13 (mensaje)
    values ('OJO, esto queda huerfano en Storage y hay que borrarlo a mano: ' || v_avatar);
  end if;

  ------------------------------------------------------------------
  -- 1. La columna que bloqueaba
  --
  -- El destino de la clave no se da por supuesto: unas apuntan a
  -- public.profiles y otras a auth.users. Se lee el que tenga y se
  -- vuelve a crear igual, solo añadiéndole la regla de borrado.
  ------------------------------------------------------------------
  declare
    v_nombre  text;
    v_destino text;
    v_col     text;
  begin
    select con.conname, con.confrelid::regclass::text, af.attname
      into v_nombre, v_destino, v_col
    from pg_constraint con
    join pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    join pg_attribute af
      on af.attrelid = con.confrelid and af.attnum = con.confkey[1]
    where con.contype = 'f'
      and con.conrelid = 'public.crews'::regclass
      and a.attname = 'created_by';

    if v_nombre is null then
      raise exception using message =
        'ABORTADO: no encuentro la clave foranea de crews.created_by.';
    end if;

    alter table public.crews alter column created_by drop not null;

    execute format('alter table public.crews drop constraint %I', v_nombre);
    execute format(
      'alter table public.crews add constraint %I foreign key (created_by) '
      || 'references %s(%I) on delete set null',
      v_nombre, v_destino, v_col
    );

    insert into _paso13 (mensaje)
    values ('crews.created_by -> ' || v_destino
            || ': ahora admite nulo y tiene ON DELETE SET NULL.');
  end;

  ------------------------------------------------------------------
  -- 2. Traspasar a saul las crews fundadas por admin
  --
  -- Se guardan los ids ANTES de cambiar nada, para no tocar por error
  -- crews que ya fueran de saul.
  ------------------------------------------------------------------
  declare
    v_ids bigint[];
  begin
    select array_agg(id) into v_ids
    from public.crews where created_by = v_admin;

    v_crews := coalesce(array_length(v_ids, 1), 0);

    if v_crews > 0 then
      update public.crews set created_by = v_saul where id = any(v_ids);

      -- Que saul sea miembro aprobado y administrador de esas crews
      update public.crew_members
      set role = 'admin', status = 'approved'
      where user_id = v_saul and crew_id = any(v_ids);

      insert into public.crew_members (crew_id, user_id, role, status)
      select c, v_saul, 'admin', 'approved'
      from unnest(v_ids) as c
      where not exists (
        select 1 from public.crew_members m
        where m.crew_id = c and m.user_id = v_saul
      );

      insert into _paso13 (mensaje)
      values ('Crews traspasadas a saul: ' || v_crews
              || ' (y queda como administrador de ellas).');
    end if;
  end;

  ------------------------------------------------------------------
  -- 3. Borrar la cuenta
  ------------------------------------------------------------------
  select count(*) into v_n from public.events where user_id = v_admin;
  insert into _paso13 (mensaje) values ('Se borran en cascada ' || v_n || ' eventos suyos.');

  delete from auth.users where id = v_admin;

  insert into _paso13 (mensaje) values ('Cuenta admin BORRADA.');
end $$;

-- --- Resultado -------------------------------------------------------
select
  (select string_agg(mensaje, chr(10) order by n) from _paso13)
    as lo_que_ha_pasado,
  (select string_agg(username, ', ' order by username)
   from public.profiles where is_admin = true)
    as administradores,
  (select count(*) from public.profiles) as usuarios,
  (select count(*) from public.events)   as eventos,
  (select count(*) from public.crews)    as crews,
  (select count(*)
   from pg_constraint con
   where con.contype = 'f'
     and con.connamespace = 'public'::regnamespace
     and con.confdeltype not in ('c', 'n'))
    as claves_que_siguen_bloqueando;
