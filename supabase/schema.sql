-- =========================================================================
-- Asistencia AM2 — esquema completo de Supabase
-- Pegar entero en el SQL editor de tu proyecto (supabase.com) y ejecutar.
-- Se puede correr una sola vez sobre un proyecto nuevo.
-- =========================================================================

create extension if not exists "pgcrypto";

-- Por defecto Supabase evalúa now()/current_date en UTC. Los horarios de
-- clase se piensan y se ingresan en hora de Argentina, así que las funciones
-- que comparan "ahora" contra hora_inicio/hora_fin (sesion_activa, alumno_stats)
-- necesitan que la base misma evalúe "ahora" en esa zona horaria.
alter database postgres set timezone = 'America/Argentina/Buenos_Aires';

-- =========================================================================
-- Tablas
-- =========================================================================

-- Un registro por docente. Se completa solo cuando creás el usuario en
-- Authentication -> Users (ver trigger handle_new_user más abajo).
create table profesores (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text,
  mostrar_horarios boolean not null default false,
  duracion_codigo_segundos int not null default 60 check (duracion_codigo_segundos between 10 and 600),
  porcentaje_requerido int not null default 75 check (porcentaje_requerido between 1 and 100),
  nota_aprobacion numeric(4,2) not null default 4 check (nota_aprobacion between 1 and 10),
  -- Fechas de parciales en el home de los alumnos (ver fechas_parciales):
  -- si se muestran y desde cuántos días antes de cada una.
  mostrar_parciales boolean not null default false,
  dias_aviso_parciales int not null default 7 check (dias_aviso_parciales between 0 and 365),
  created_at timestamptz not null default now()
);

create table comisiones (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (profesor_id, nombre)
);

create table alumnos (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  legajo text not null,
  nombre text not null,
  apellido text not null,
  comision_id uuid references comisiones (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profesor_id, legajo)
);

create table clases (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  nombre text not null,
  -- PDF del TP en el bucket "tps" de Storage (ruta dentro del bucket). Los
  -- alumnos lo pueden descargar desde el home mientras la clase está en curso.
  pdf_path text,
  created_at timestamptz not null default now(),
  unique (profesor_id, nombre)
);

-- Una fila por cada horario puntual en que se da una clase. Una misma sesión
-- puede ser compartida por varias comisiones a la vez (clase conjunta) a
-- través de sesion_comisiones más abajo.
-- Ej: "TP12" tiene una sesión el martes (2S1 + 2Q1 juntas) y otra el jueves (2S2 sola).
create table sesiones (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  clase_id uuid not null references clases (id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

-- Qué comisiones participan de cada sesión (many-to-many).
create table sesion_comisiones (
  sesion_id uuid not null references sesiones (id) on delete cascade,
  comision_id uuid not null references comisiones (id) on delete cascade,
  primary key (sesion_id, comision_id)
);

-- Horario semanal fijo de cursada (independiente de las sesiones puntuales
-- del calendario). Solo se usa para mostrarle al alumno, opcionalmente,
-- dónde y cuándo son las clases (ver profesores.mostrar_horarios).
create table horarios (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  dia_semana int not null check (dia_semana between 1 and 7), -- 1 = lunes .. 7 = domingo
  hora_inicio time not null,
  hora_fin time not null,
  aula text,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

-- Qué comisiones dan ese horario (many-to-many): una clase conjunta de dos
-- comisiones se carga una sola vez y marca las dos, igual que sesion_comisiones.
create table horario_comisiones (
  horario_id uuid not null references horarios (id) on delete cascade,
  comision_id uuid not null references comisiones (id) on delete cascade,
  primary key (horario_id, comision_id)
);

create table codigos (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  sesion_id uuid not null references sesiones (id) on delete cascade,
  codigo text not null,
  creado_at timestamptz not null default now(),
  expira_at timestamptz not null default (now() + interval '60 seconds')
);

create table asistencias (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  alumno_id uuid not null references alumnos (id) on delete cascade,
  sesion_id uuid not null references sesiones (id) on delete cascade,
  clase_id uuid not null references clases (id) on delete cascade,
  metodo text not null check (metodo in ('codigo', 'manual')),
  creado_at timestamptz not null default now(),
  creado_por uuid references profesores (id),
  -- Identificador al azar que el navegador del alumno genera y guarda (ver
  -- src/lib/dispositivo.ts). Si en una misma sesión hay presentes de alumnos
  -- distintos con el mismo valor, probablemente uno cargó el del otro.
  dispositivo_id text,
  unique (alumno_id, clase_id)
);

-- Notas de los dos parciales y las dos recuperaciones. Una fila por alumno
-- (no por comisión ni por sesión: los parciales son del curso, no de una
-- clase puntual). Si desaprueba un solo parcial, la recuperación 1 recupera
-- ese; si vuelve a desaprobar, la recuperación 2 recupera el mismo. Si
-- desaprueba los dos, ambas recuperaciones son el integral (ver
-- src/lib/notas.ts, tipoRecuperatorio/calcularEstadoNotas: no hace falta
-- guardar cuál es cuál, se deduce de las notas de los parciales).
-- parcial_N_ausente / recuperatorio_N_ausente: el alumno no rindió esa
-- instancia (distinto de no haberla cargado todavía: null). Un ausente
-- cuenta como desaprobado a todos los efectos (recupera igual que si
-- hubiera rendido y desaprobado, ver src/lib/notas.ts), pero se muestra
-- como "A" en vez de una nota.
create table notas_parciales (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  alumno_id uuid not null references alumnos (id) on delete cascade,
  parcial_1 numeric(4,2) check (parcial_1 is null or parcial_1 between 0 and 10),
  parcial_1_ausente boolean not null default false,
  parcial_2 numeric(4,2) check (parcial_2 is null or parcial_2 between 0 and 10),
  parcial_2_ausente boolean not null default false,
  recuperatorio_1 numeric(4,2) check (recuperatorio_1 is null or recuperatorio_1 between 0 and 10),
  recuperatorio_1_ausente boolean not null default false,
  recuperatorio_2 numeric(4,2) check (recuperatorio_2 is null or recuperatorio_2 between 0 and 10),
  recuperatorio_2_ausente boolean not null default false,
  actualizado_at timestamptz not null default now(),
  unique (alumno_id),
  check (not (parcial_1_ausente and parcial_1 is not null)),
  check (not (parcial_2_ausente and parcial_2 is not null)),
  check (not (recuperatorio_1_ausente and recuperatorio_1 is not null)),
  check (not (recuperatorio_2_ausente and recuperatorio_2 is not null))
);

-- Fechas de evaluaciones (parciales, recuperaciones o lo que el profesor
-- cargue), una sola para todas las comisiones. Se les muestran a los alumnos
-- en el home desde profesores.dias_aviso_parciales días antes hasta el mismo
-- día, si profesores.mostrar_parciales está activo (ver proximos_parciales).
create table fechas_parciales (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  nombre text not null,
  fecha date not null,
  hora time,
  aula text,
  created_at timestamptz not null default now()
);

create index idx_alumnos_comision on alumnos (comision_id);
create index idx_sesiones_fecha on sesiones (fecha);
create index idx_sesiones_clase on sesiones (clase_id);
create index idx_sesion_comisiones_comision on sesion_comisiones (comision_id);
create index idx_horarios_profesor on horarios (profesor_id);
create index idx_horario_comisiones_comision on horario_comisiones (comision_id);
create index idx_codigos_sesion_expira on codigos (sesion_id, expira_at);
create index idx_asistencias_alumno on asistencias (alumno_id);
create index idx_asistencias_sesion on asistencias (sesion_id);
create index idx_notas_parciales_alumno on notas_parciales (alumno_id);
create index idx_fechas_parciales_profesor on fechas_parciales (profesor_id, fecha);

-- =========================================================================
-- Alta automática de "profesor" cuando creás el usuario en Supabase Auth
-- =========================================================================

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profesores (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================================
-- Vista de asistencia por alumno (usada por el docente y por el propio alumno)
-- security_invoker = true: respeta la RLS del usuario que consulta, no la del
-- dueño de la vista.
-- =========================================================================

create view vista_asistencia_alumno
with (security_invoker = true) as
select
  a.id as alumno_id,
  a.profesor_id,
  a.legajo,
  a.nombre,
  a.apellido,
  a.comision_id,
  co.nombre as comision_nombre,
  coalesce(tc.total_clases, 0) as total_clases,
  coalesce(pr.presentes, 0) as presentes,
  case
    when coalesce(tc.total_clases, 0) = 0 then 0
    else round(100.0 * coalesce(pr.presentes, 0) / tc.total_clases, 1)
  end as porcentaje,
  case
    when coalesce(tc.total_clases, 0) = 0 then true
    else (100.0 * coalesce(pr.presentes, 0) / tc.total_clases) >= p.porcentaje_requerido
  end as cumple_minimo
from alumnos a
join profesores p on p.id = a.profesor_id
left join comisiones co on co.id = a.comision_id
left join lateral (
  -- Total de TPs que le cuentan al alumno hasta hoy: los que se dieron en
  -- SU comisión, más los que haya asistido en otra (un alumno puede ir a la
  -- sesión de otra comisión y ese TP le cuenta igual). Un TP dado solo en
  -- otra comisión al que no fue NO le cuenta: si en su comisión no hubo
  -- clase (paro, feriado) no es inasistencia aunque otra comisión sí la tuvo.
  -- Se cuenta clase_id distinto para no duplicar un TP con varias sesiones.
  -- Una sesión sólo cuenta como "dada" si el profesor generó un código para
  -- ella o si hay alguna asistencia cargada (manual o por código).
  -- Alumnos sin comisión asignada: se usan las sesiones de todas.
  select count(distinct t.clase_id) as total_clases
  from (
    select s.clase_id
    from sesiones s
    join sesion_comisiones sc on sc.sesion_id = s.id
    where s.profesor_id = a.profesor_id
      and s.fecha <= current_date
      and (a.comision_id is null or sc.comision_id = a.comision_id)
      and (
        exists (select 1 from codigos c where c.sesion_id = s.id)
        or exists (select 1 from asistencias asi2 where asi2.sesion_id = s.id)
      )
    union
    select asi3.clase_id
    from asistencias asi3
    where asi3.alumno_id = a.id
  ) t
) tc on true
left join lateral (
  select count(*) as presentes
  from asistencias asi
  where asi.alumno_id = a.id
) pr on true;

grant select on vista_asistencia_alumno to authenticated;

-- =========================================================================
-- Row Level Security: cada docente ve y edita únicamente sus propios datos.
-- El flujo público (alumnos, sin login) NO tiene políticas directas: solo
-- puede pasar por las funciones RPC de más abajo (security definer).
-- =========================================================================

alter table profesores enable row level security;
alter table comisiones enable row level security;
alter table alumnos enable row level security;
alter table clases enable row level security;
alter table sesiones enable row level security;
alter table sesion_comisiones enable row level security;
alter table horarios enable row level security;
alter table fechas_parciales enable row level security;
alter table horario_comisiones enable row level security;
alter table codigos enable row level security;
alter table asistencias enable row level security;
alter table notas_parciales enable row level security;

create policy "profesor lee su propio perfil"
  on profesores for select
  using (id = auth.uid());

create policy "profesor actualiza su propio perfil"
  on profesores for update
  using (id = auth.uid());

create policy "profesor administra sus comisiones"
  on comisiones for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus alumnos"
  on alumnos for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus clases"
  on clases for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus sesiones"
  on sesiones for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus sesion_comisiones"
  on sesion_comisiones for all
  using (exists (select 1 from sesiones s where s.id = sesion_id and s.profesor_id = auth.uid()))
  with check (exists (select 1 from sesiones s where s.id = sesion_id and s.profesor_id = auth.uid()));

create policy "profesor administra sus horarios"
  on horarios for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus horario_comisiones"
  on horario_comisiones for all
  using (exists (select 1 from horarios h where h.id = horario_id and h.profesor_id = auth.uid()))
  with check (exists (select 1 from horarios h where h.id = horario_id and h.profesor_id = auth.uid()));

create policy "profesor administra sus codigos"
  on codigos for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus asistencias"
  on asistencias for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus notas_parciales"
  on notas_parciales for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor administra sus fechas_parciales"
  on fechas_parciales for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

-- =========================================================================
-- Funciones públicas (RPC) para el flujo del alumno, sin login.
-- SECURITY DEFINER: corren con permisos elevados y son las únicas puertas
-- de entrada que tiene el rol anónimo hacia estos datos.
-- =========================================================================

-- Sesiones cuyo horario incluye el momento actual (hoy), con si tienen o no
-- un código vigente. Nunca devuelve el código en sí.
create function sesion_activa()
returns table (
  sesion_id uuid,
  clase_nombre text,
  clase_pdf_path text,
  comision_nombre text,
  hora_inicio time,
  hora_fin time,
  codigo_activo boolean,
  expira_at timestamptz,
  duracion_codigo_segundos int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    cl.nombre,
    cl.pdf_path,
    string_agg(co.nombre, ', ' order by co.nombre),
    s.hora_inicio,
    s.hora_fin,
    exists (
      select 1 from codigos c
      where c.sesion_id = s.id and c.expira_at > now()
    ) as codigo_activo,
    (
      select c.expira_at from codigos c
      where c.sesion_id = s.id and c.expira_at > now()
      order by c.expira_at desc
      limit 1
    ) as expira_at,
    p.duracion_codigo_segundos
  from sesiones s
  join clases cl on cl.id = s.clase_id
  join profesores p on p.id = s.profesor_id
  join sesion_comisiones sc on sc.sesion_id = s.id
  join comisiones co on co.id = sc.comision_id
  where s.fecha = current_date
    and now()::time between s.hora_inicio and s.hora_fin
  group by s.id, cl.nombre, cl.pdf_path, s.hora_inicio, s.hora_fin, p.duracion_codigo_segundos
  order by s.hora_inicio;
$$;

grant execute on function sesion_activa() to anon, authenticated;

-- Horario semanal de los profesores que optaron por mostrarlo (ver
-- profesores.mostrar_horarios). Es la única forma en que el rol anónimo
-- puede leer la tabla "horarios".
create function horarios_publicos()
returns table (
  comision_nombre text,
  dia_semana int,
  hora_inicio time,
  hora_fin time,
  aula text,
  concurrencia int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    string_agg(co.nombre, ', ' order by co.nombre),
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.aula,
    max(conc.nivel)
  from horarios h
  join profesores p on p.id = h.profesor_id
  join horario_comisiones hc on hc.horario_id = h.id
  join comisiones co on co.id = hc.comision_id
  left join lateral (
    -- Qué tan llena suele estar la clase (1 a 5 personitas): promedio de
    -- presentes de las últimas 3 clases dadas en ese horario (mismo día de la
    -- semana, misma hora y alguna comisión en común). No cuenta paros/feriados
    -- (sesiones sin código ni asistencias) ni la clase de hoy si no terminó.
    -- Solo se expone el nivel, no la cantidad exacta.
    select
      case
        when avg(u.presentes) is null then null
        when avg(u.presentes) < 15 then 1
        when avg(u.presentes) < 30 then 2
        when avg(u.presentes) < 45 then 3
        when avg(u.presentes) < 60 then 4
        else 5
      end as nivel
    from (
      select (select count(*) from asistencias a where a.sesion_id = s.id) as presentes
      from sesiones s
      where s.profesor_id = h.profesor_id
        and extract(isodow from s.fecha) = h.dia_semana
        and s.hora_inicio = h.hora_inicio
        and (s.fecha < current_date or (s.fecha = current_date and s.hora_fin < localtime))
        and exists (
          select 1 from sesion_comisiones sc
          join horario_comisiones hc2 on hc2.comision_id = sc.comision_id
          where sc.sesion_id = s.id and hc2.horario_id = h.id
        )
        and (
          exists (select 1 from codigos c where c.sesion_id = s.id)
          or exists (select 1 from asistencias a2 where a2.sesion_id = s.id)
        )
      order by s.fecha desc
      limit 3
    ) u
  ) conc on true
  where p.mostrar_horarios = true
  group by h.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.aula
  order by h.dia_semana, h.hora_inicio;
$$;

grant execute on function horarios_publicos() to anon, authenticated;

-- Parciales/recuperaciones que están dentro de la ventana de aviso de su
-- profesor (desde dias_aviso_parciales días antes hasta el mismo día), de
-- los profesores que optaron por mostrarlos (profesores.mostrar_parciales).
create function proximos_parciales()
returns table (
  id uuid,
  nombre text,
  fecha date,
  hora time,
  aula text
)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.nombre, f.fecha, f.hora, f.aula
  from fechas_parciales f
  join profesores p on p.id = f.profesor_id
  where p.mostrar_parciales = true
    and f.fecha >= current_date
    and f.fecha <= current_date + p.dias_aviso_parciales
  order by f.fecha, f.hora;
$$;

grant execute on function proximos_parciales() to anon, authenticated;

-- Alumnos cuyo legajo empieza con lo tipeado, con sus estadísticas, scopeado
-- al profesor dueño de la sesión activa ahora mismo (evita exponer datos
-- fuera de horario de clase). El alumno elige el suyo tocando su nombre.
create function buscar_alumnos(p_query text)
returns table (
  alumno_id uuid,
  legajo text,
  nombre text,
  apellido text,
  comision_nombre text,
  presentes int,
  total_clases int,
  porcentaje numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profesor_id uuid;
begin
  select s.profesor_id into v_profesor_id
  from sesiones s
  where s.fecha = current_date
    and now()::time between s.hora_inicio and s.hora_fin
  limit 1;

  if v_profesor_id is null then
    return;
  end if;

  return query
    select v.alumno_id, v.legajo, v.nombre, v.apellido, v.comision_nombre, v.presentes::int, v.total_clases::int, v.porcentaje
    from vista_asistencia_alumno v
    join alumnos al on al.id = v.alumno_id
    where al.profesor_id = v_profesor_id
      and al.legajo ilike trim(p_query) || '%'
    order by al.legajo
    limit 8;
end;
$$;

grant execute on function buscar_alumnos(text) to anon, authenticated;

-- Registra la asistencia validando el código de 60s. Es la única forma en
-- que el rol anónimo puede escribir en "asistencias".
create function registrar_asistencia(p_legajo text, p_codigo text, p_dispositivo text default null)
returns table (
  ok boolean,
  mensaje text,
  nombre text,
  apellido text,
  presentes int,
  total_clases int,
  porcentaje numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo record;
  v_alumno record;
  v_stats record;
begin
  select c.id, c.sesion_id, c.profesor_id, s.clase_id
  into v_codigo
  from codigos c
  join sesiones s on s.id = c.sesion_id
  where upper(trim(c.codigo)) = upper(trim(p_codigo))
    and c.expira_at > now()
  order by c.creado_at desc
  limit 1;

  if not found then
    return query select false, 'Código inválido o expirado.', null::text, null::text, null::int, null::int, null::numeric;
    return;
  end if;

  select al.id, al.nombre, al.apellido into v_alumno
  from alumnos al
  where al.profesor_id = v_codigo.profesor_id
    and lower(al.legajo) = lower(trim(p_legajo));

  if not found then
    return query select false, 'No encontramos ese legajo.', null::text, null::text, null::int, null::int, null::numeric;
    return;
  end if;

  if exists (
    select 1 from asistencias
    where alumno_id = v_alumno.id and clase_id = v_codigo.clase_id
  ) then
    return query select false, 'Ya habías registrado tu asistencia a esta clase.', v_alumno.nombre, v_alumno.apellido, null::int, null::int, null::numeric;
    return;
  end if;

  insert into asistencias (profesor_id, alumno_id, sesion_id, clase_id, metodo, dispositivo_id)
  values (v_codigo.profesor_id, v_alumno.id, v_codigo.sesion_id, v_codigo.clase_id, 'codigo',
          left(nullif(trim(p_dispositivo), ''), 100));

  select va.presentes::int, va.total_clases::int, va.porcentaje into v_stats
  from vista_asistencia_alumno va
  where va.alumno_id = v_alumno.id;

  return query
    select true, '¡Asistencia registrada!', v_alumno.nombre, v_alumno.apellido,
           v_stats.presentes, v_stats.total_clases, v_stats.porcentaje;
end;
$$;

grant execute on function registrar_asistencia(text, text, text) to anon, authenticated;

-- Historial de asistencia de un alumno por legajo exacto (no autocompleta ni
-- lista por prefijo como buscar_alumnos: solo devuelve datos a quien ya
-- conoce su propio legajo completo, y funciona en cualquier momento, no solo
-- durante una clase en curso). Puede haber más de un resultado si el mismo
-- legajo existe en distintos profesores.
create function mis_asistencias(p_legajo text)
returns table (
  alumno_id uuid,
  legajo text,
  nombre text,
  apellido text,
  comision_nombre text,
  presentes int,
  total_clases int,
  porcentaje numeric,
  clases jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.alumno_id,
    v.legajo,
    v.nombre,
    v.apellido,
    v.comision_nombre,
    v.presentes::int,
    v.total_clases::int,
    v.porcentaje,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'clase_nombre', cl.nombre,
            'fecha', s.fecha,
            'hora_inicio', s.hora_inicio,
            'hora_fin', s.hora_fin,
            'metodo', a.metodo
          )
          order by s.fecha, s.hora_inicio
        )
        from asistencias a
        join sesiones s on s.id = a.sesion_id
        join clases cl on cl.id = a.clase_id
        where a.alumno_id = v.alumno_id
      ),
      '[]'::jsonb
    ) as clases
  from vista_asistencia_alumno v
  join alumnos al on al.id = v.alumno_id
  where lower(al.legajo) = lower(trim(p_legajo))
  order by v.apellido, v.nombre;
$$;

grant execute on function mis_asistencias(text) to anon, authenticated;

-- =========================================================================
-- Storage: PDFs de los TPs (clases.pdf_path). Bucket público para que los
-- alumnos (sin login) puedan descargarlos; cada profesor solo puede subir y
-- borrar archivos dentro de su carpeta (<profesor_id>/...).
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tps', 'tps', true, 20971520, array['application/pdf']);

create policy "profesor sube PDFs de TPs a su carpeta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tps' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profesor ve sus PDFs de TPs"
  on storage.objects for select to authenticated
  using (bucket_id = 'tps' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profesor borra sus PDFs de TPs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tps' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Notificaciones para el docente (campanita + push al celular)
-- =========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Una fila por aviso. "clave" evita duplicados del mismo evento (por ejemplo
-- el cron que revisa cada 30 segundos si empezó una clase).
create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  tipo text not null check (tipo in ('clase_inicio', 'clase_fin', 'codigo_inicio', 'codigo_fin', 'mismo_celular', 'prueba')),
  titulo text not null,
  mensaje text not null,
  sesion_id uuid references sesiones (id) on delete set null,
  clave text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profesor_id, clave)
);

create index idx_notificaciones_profesor_fecha on notificaciones (profesor_id, created_at desc);
create index idx_codigos_expira on codigos (expira_at);

-- Celulares/navegadores del docente suscriptos a notificaciones push.
create table push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table notificaciones enable row level security;
alter table push_suscripciones enable row level security;

-- Las notificaciones solo las crean las funciones de abajo (security definer):
-- el docente puede leerlas, marcarlas como leídas y borrarlas.
create policy "profesor lee sus notificaciones"
  on notificaciones for select
  using (profesor_id = auth.uid());

create policy "profesor marca sus notificaciones"
  on notificaciones for update
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

create policy "profesor borra sus notificaciones"
  on notificaciones for delete
  using (profesor_id = auth.uid());

create policy "profesor administra sus suscripciones push"
  on push_suscripciones for all
  using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

-- Para que la campanita se actualice en vivo (Supabase Realtime respeta la RLS).
alter publication supabase_realtime add table notificaciones;

create function crear_notificacion(
  p_profesor_id uuid,
  p_tipo text,
  p_titulo text,
  p_mensaje text,
  p_sesion_id uuid,
  p_clave text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notificaciones (profesor_id, tipo, titulo, mensaje, sesion_id, clave)
  values (p_profesor_id, p_tipo, p_titulo, p_mensaje, p_sesion_id, p_clave)
  on conflict (profesor_id, clave) do nothing;
$$;

-- "TP19 · 2S1, 2Q1": nombre corto de la clase + comisiones de la sesión.
create function descripcion_sesion(p_sesion_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select
    case when position(':' in cl.nombre) > 0 then trim(split_part(cl.nombre, ':', 1)) else cl.nombre end
    || coalesce(' · ' || (
      select string_agg(co.nombre, ', ' order by co.nombre)
      from sesion_comisiones sc
      join comisiones co on co.id = sc.comision_id
      where sc.sesion_id = s.id
    ), '')
  from sesiones s
  join clases cl on cl.id = s.clase_id
  where s.id = p_sesion_id;
$$;

-- Empezó el contador: se dispara al generar un código.
create function notificar_codigo_generado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nunca romper la generación del código por un problema con el aviso.
  begin
    perform crear_notificacion(
      new.profesor_id,
      'codigo_inicio',
      'Empezó el contador',
      'Código ' || new.codigo || ' para ' || coalesce(descripcion_sesion(new.sesion_id), 'la clase')
        || '. Dura ' || extract(epoch from (new.expira_at - new.creado_at))::int || ' segundos.',
      new.sesion_id,
      'codigo_inicio:' || new.id
    );
  exception when others then
    raise warning 'notificar_codigo_generado: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trg_notificar_codigo_generado
  after insert on codigos
  for each row execute function notificar_codigo_generado();

-- Un mismo celular dio presente a dos alumnos distintos en la misma sesión.
-- "Quién ingresó" = el primer alumno que dio presente desde ese celular en
-- la sesión (probablemente el dueño); "a quién" = el alumno nuevo.
create function notificar_mismo_celular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primero record;
  v_nuevo record;
begin
  if new.dispositivo_id is null then
    return new;
  end if;

  begin
    select al.nombre, al.apellido, al.legajo into v_primero
    from asistencias a
    join alumnos al on al.id = a.alumno_id
    where a.sesion_id = new.sesion_id
      and a.dispositivo_id = new.dispositivo_id
      and a.alumno_id <> new.alumno_id
      and a.id <> new.id
    order by a.creado_at
    limit 1;

    if found then
      select al.nombre, al.apellido, al.legajo into v_nuevo
      from alumnos al
      where al.id = new.alumno_id;

      perform crear_notificacion(
        new.profesor_id,
        'mismo_celular',
        'Presente desde el mismo celular',
        'Desde el celular de ' || v_primero.apellido || ', ' || v_primero.nombre || ' (legajo ' || v_primero.legajo
          || ') también se dio presente a ' || v_nuevo.apellido || ', ' || v_nuevo.nombre || ' (legajo ' || v_nuevo.legajo
          || ') en ' || coalesce(descripcion_sesion(new.sesion_id), 'la clase') || '.',
        new.sesion_id,
        'mismo_celular:' || new.id
      );
    end if;
  exception when others then
    -- Nunca romper el registro del presente por un problema con el aviso.
    raise warning 'notificar_mismo_celular: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trg_notificar_mismo_celular
  after insert on asistencias
  for each row execute function notificar_mismo_celular();

-- Eventos que dependen de la hora (empezó/terminó la clase, terminó el
-- contador). Lo corre pg_cron cada 30 segundos; la "clave" de cada aviso
-- evita repetirlo. Solo mira hacia atrás un rato para no avisar cosas viejas.
create function notificaciones_programadas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hoy date := v_ahora::date;
  v_hora time := v_ahora::time;
  r record;
begin
  -- Empezó la clase
  for r in
    select s.id, s.profesor_id, s.hora_inicio, s.hora_fin
    from sesiones s
    where s.fecha = v_hoy
      and v_hora >= s.hora_inicio
      and v_hora < s.hora_fin
  loop
    perform crear_notificacion(
      r.profesor_id,
      'clase_inicio',
      'Empezó la clase',
      coalesce(descripcion_sesion(r.id), 'Clase') || ' · ' || to_char(r.hora_inicio, 'HH24:MI') || ' a ' || to_char(r.hora_fin, 'HH24:MI') || '.',
      r.id,
      'clase_inicio:' || r.id
    );
  end loop;

  -- Terminó la clase (hasta 30 minutos después, para no avisar clases viejas)
  for r in
    select s.id, s.profesor_id,
      (select count(*) from asistencias a where a.sesion_id = s.id) as presentes
    from sesiones s
    where s.fecha = v_hoy
      and v_hora >= s.hora_fin
      and v_hora < s.hora_fin + interval '30 minutes'
  loop
    perform crear_notificacion(
      r.profesor_id,
      'clase_fin',
      'Terminó la clase',
      coalesce(descripcion_sesion(r.id), 'Clase') || '. Presentes: ' || r.presentes || '.',
      r.id,
      'clase_fin:' || r.id
    );
  end loop;

  -- Terminó el contador (códigos vencidos en los últimos 30 minutos)
  for r in
    select c.id, c.profesor_id, c.sesion_id, c.codigo,
      (select count(*) from asistencias a
        where a.sesion_id = c.sesion_id and a.metodo = 'codigo'
          and a.creado_at between c.creado_at and c.expira_at) as con_codigo,
      (select count(*) from asistencias a where a.sesion_id = c.sesion_id) as total
    from codigos c
    where c.expira_at <= now()
      and c.expira_at > now() - interval '30 minutes'
  loop
    perform crear_notificacion(
      r.profesor_id,
      'codigo_fin',
      'Terminó el contador',
      coalesce(descripcion_sesion(r.sesion_id), 'Clase') || ' · código ' || r.codigo || ': '
        || r.con_codigo || ' presentes con este código, ' || r.total || ' en total en la clase.',
      r.sesion_id,
      'codigo_fin:' || r.id
    );
  end loop;
end;
$$;

select cron.schedule('notificaciones-programadas', '30 seconds', 'select public.notificaciones_programadas()');

-- Push: cada notificación nueva se manda a la Edge Function
-- "push-notificaciones", que la reenvía a los celulares suscriptos. El secreto
-- compartido vive en Vault (push_webhook_secret).
create function enviar_push_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secreto text;
begin
  begin
    select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook_secret';
    if v_secreto is not null then
      perform net.http_post(
        url := 'https://pnrhgujjnxyuznawjyaf.supabase.co/functions/v1/push-notificaciones',
        body := jsonb_build_object('notificacion_id', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secreto)
      );
    end if;
  exception when others then
    raise warning 'enviar_push_notificacion: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trg_enviar_push_notificacion
  after insert on notificaciones
  for each row execute function enviar_push_notificacion();

-- Botón "Enviar notificación de prueba" de Configuración.
create function notificacion_de_prueba()
returns void
language sql
security definer
set search_path = public
as $$
  select crear_notificacion(
    auth.uid(),
    'prueba',
    'Notificación de prueba',
    'Si ves esto, las notificaciones funcionan.',
    null,
    'prueba:' || gen_random_uuid()
  );
$$;

revoke execute on function crear_notificacion(uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function notificaciones_programadas() from public, anon, authenticated;
revoke execute on function descripcion_sesion(uuid) from public, anon, authenticated;
revoke execute on function notificacion_de_prueba() from public, anon;
grant execute on function notificacion_de_prueba() to authenticated;
