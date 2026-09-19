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
  unique (alumno_id, clase_id)
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
  -- Total de TPs dados por el profesor hasta hoy, sin filtrar por comisión:
  -- un alumno puede ir a la sesión de otra comisión (o a una clase conjunta)
  -- y ese TP le cuenta igual. Se cuenta clase_id distinto para no duplicar
  -- un TP que tiene una sesión por comisión.
  -- Una sesión sólo cuenta como "dada" si el profesor generó un código para
  -- ella o si hay alguna asistencia cargada (manual o por código): si nunca
  -- pasó ninguna de las dos (feriado, paro, clase que no se pudo dar), no
  -- entra en el total de nadie.
  select count(distinct s.clase_id) as total_clases
  from sesiones s
  where s.profesor_id = a.profesor_id
    and s.fecha <= current_date
    and (
      exists (select 1 from codigos c where c.sesion_id = s.id)
      or exists (select 1 from asistencias asi2 where asi2.sesion_id = s.id)
    )
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
alter table horario_comisiones enable row level security;
alter table codigos enable row level security;
alter table asistencias enable row level security;

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
  group by s.id, cl.nombre, s.hora_inicio, s.hora_fin, p.duracion_codigo_segundos
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
  aula text
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
    h.aula
  from horarios h
  join profesores p on p.id = h.profesor_id
  join horario_comisiones hc on hc.horario_id = h.id
  join comisiones co on co.id = hc.comision_id
  where p.mostrar_horarios = true
  group by h.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.aula
  order by h.dia_semana, h.hora_inicio;
$$;

grant execute on function horarios_publicos() to anon, authenticated;

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
create function registrar_asistencia(p_legajo text, p_codigo text)
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

  insert into asistencias (profesor_id, alumno_id, sesion_id, clase_id, metodo)
  values (v_codigo.profesor_id, v_alumno.id, v_codigo.sesion_id, v_codigo.clase_id, 'codigo');

  select va.presentes::int, va.total_clases::int, va.porcentaje into v_stats
  from vista_asistencia_alumno va
  where va.alumno_id = v_alumno.id;

  return query
    select true, '¡Asistencia registrada!', v_alumno.nombre, v_alumno.apellido,
           v_stats.presentes, v_stats.total_clases, v_stats.porcentaje;
end;
$$;

grant execute on function registrar_asistencia(text, text) to anon, authenticated;

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
