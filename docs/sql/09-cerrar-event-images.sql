-- =====================================================================
-- BLOQUE 09 — Cerrar el bucket `event-images`
--
-- QUÉ ARREGLA
--
--   Es el último bucket cuyas políticas de escritura no comprueban de
--   quién es el archivo. Hoy, cualquier usuario con sesión puede borrar
--   o sobrescribir la foto de portada del evento de otro.
--
--   No se pudo arreglar en el bloque 1 porque el código subía a una ruta
--   plana (`1769171156865.jpg`), y sin carpeta de usuario no hay nada
--   que comprobar. Eso ya está cambiado: ahora sube a
--   `${user_id}/${uuid}.webp`, igual que `vehicles` y `crews`.
--
-- ⚠️  ANTES DE EJECUTAR ESTO:
--
--   Despliega la rama con el commit de la subida de fotos de evento.
--   Si ejecutas esto antes, subir la foto de un evento nuevo empieza a
--   fallar con "new row violates row-level security policy".
--
-- SOBRE LAS FOTOS QUE YA HAY
--
--   Las que están en la raíz del bucket siguen viéndose: leer es
--   público. Lo que pasa es que nadie podrá borrarlas ni sustituirlas
--   desde la web, porque no tienen carpeta de dueño. Son pocas y de
--   pruebas. Si quieres limpiarlas: Storage → event-images → seleccionar
--   → Delete, desde el panel.
--
-- Ejecuta TODO el bloque de una vez en el SQL Editor.
-- =====================================================================

-- --- Fuera las políticas viejas del bucket ---------------------------
do $$
declare
  v_pol record;
  v_quitadas int := 0;
begin
  for v_pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and qual || ' ' || coalesce(with_check, '') like '%event-images%'
  loop
    execute format('drop policy if exists %I on storage.objects', v_pol.policyname);
    v_quitadas := v_quitadas + 1;
  end loop;
  raise notice 'Politicas viejas eliminadas: %', v_quitadas;
end $$;

-- --- Lectura: pública, como el resto de buckets de imágenes ----------
create policy "event_images_leer"
  on storage.objects for select
  to public
  using (bucket_id = 'event-images');

-- --- Subir: solo a tu propia carpeta ---------------------------------
create policy "event_images_subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- Sustituir: solo lo tuyo ----------------------------------------
create policy "event_images_actualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- Borrar: solo lo tuyo -------------------------------------------
create policy "event_images_borrar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- Límites del bucket, por si no los tuviera ----------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'event-images';

-- --- Comprobación ----------------------------------------------------
select jsonb_build_object(
  'politicas', (
    select jsonb_agg(jsonb_build_object('nombre', policyname, 'accion', cmd)
                     order by policyname)
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'event_images%'
  ),
  'alguna_sin_comprobar_dueno', (
    select count(*) > 0
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'event_images%'
      and cmd <> 'SELECT'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%foldername%'
  ),
  'limite_mb', (
    select round(file_size_limit / 1048576.0, 1)
    from storage.buckets where id = 'event-images'
  )
) as resultado;
