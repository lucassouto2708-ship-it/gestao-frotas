-- =====================================================================
--  GESTÃO DE FROTAS - BANCO DE DADOS
--
--  COMO USAR:
--    1. No Supabase, abra "SQL Editor" > "New query"
--    2. Copie TODO este arquivo, cole e clique em "Run"
--    3. Deve aparecer "Success. No rows returned"
--
--  Pode rodar de novo quantas vezes quiser: não apaga nenhum dado.
--  A PRIMEIRA conta criada no app vira ADM (dono da plataforma) automaticamente.
--  Cada cliente (empresa ou município) é uma ORGANIZAÇÃO: os dados de uma
--  organização nunca aparecem para outra. Níveis de acesso:
--    admin     = você: vê e gerencia todas as organizações
--    gestor    = controla a frota da própria organização
--    motorista = só inicia e finaliza viagens dos carros vinculados a ele
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ORGANIZAÇÕES E USUÁRIOS (admin / gestor / motorista)
-- ---------------------------------------------------------------------
-- Cada cliente (empresa ou município) é uma organização
create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  tipo text not null default 'empresa' check (tipo in ('empresa', 'municipio')),
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  criada_por uuid
);
create unique index if not exists organizacoes_nome_idx on public.organizacoes (lower(btrim(nome)));

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text,
  role text not null default 'motorista',
  created_at timestamptz not null default now()
);

-- Atualização de bancos criados antes dos níveis gestor/motorista e das organizações
alter table public.profiles add column if not exists organizacao_id uuid references public.organizacoes (id);
alter table public.profiles add column if not exists ativo boolean not null default true;
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'motorista' where role = 'comum';
alter table public.profiles alter column role set default 'motorista';
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'gestor', 'motorista'));
create index if not exists profiles_org_idx on public.profiles (organizacao_id);

-- Cria o perfil quando alguém se cadastra. A primeira conta vira ADM; as demais ficam sem
-- organização até aceitarem um convite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    case when exists (select 1 from public.profiles where role = 'admin') then 'motorista' else 'admin' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ADM = dono da plataforma (vê todas as organizações)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and ativo);
$$;

-- Organização do usuário, mesmo que esteja suspensa (para mostrar o aviso na tela)
create or replace function public.organizacao_do_usuario()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select organizacao_id from public.profiles where id = auth.uid();
$$;

-- Organização com acesso liberado: nula se o usuário estiver desativado ou a organização suspensa
create or replace function public.minha_org()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select p.organizacao_id
  from public.profiles p join public.organizacoes o on o.id = p.organizacao_id
  where p.id = auth.uid() and p.ativo and o.ativa;
$$;

-- Gestor com acesso liberado
create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p join public.organizacoes o on o.id = p.organizacao_id
    where p.id = auth.uid() and p.role = 'gestor' and p.ativo and o.ativa
  );
$$;

-- Esta pessoa pertence à mesma organização do usuário logado?
create or replace function public.usuario_na_minha_org(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and organizacao_id is not null and organizacao_id = public.minha_org()
  );
$$;


-- ---------------------------------------------------------------------
-- 2. CARROS
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  modelo text not null default '',
  km_inicial integer not null check (km_inicial >= 0),
  km_atual integer not null check (km_atual >= 0),
  foto_km_inicial text,
  intervalo_oleo integer not null default 10000 check (intervalo_oleo > 0),
  intervalo_revisao integer not null default 20000 check (intervalo_revisao > 0),
  km_ultima_troca_oleo integer not null,
  km_ultima_revisao integer not null,
  data_ultima_troca_oleo date,
  data_ultima_revisao date,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Parâmetros padrão de cada organização (uma linha por organização), definidos pelo gestor ou ADM.
-- (Bancos antigos tinham uma linha única: ela é convertida na seção 5c.)
create table if not exists public.configuracoes (
  organizacao_id uuid primary key references public.organizacoes (id) on delete cascade,
  intervalo_oleo integer not null default 10000 check (intervalo_oleo > 0),
  intervalo_revisao integer not null default 20000 check (intervalo_revisao > 0),
  atualizado_por uuid references public.profiles (id),
  atualizado_em timestamptz
);

create or replace function public.configuracoes_before_update()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_por := auth.uid();
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists configuracoes_before_update on public.configuracoes;
create trigger configuracoes_before_update
  before update on public.configuracoes
  for each row execute function public.configuracoes_before_update();

-- Atualização de bancos criados antes destas colunas existirem
alter table public.vehicles add column if not exists data_ultima_troca_oleo date;
alter table public.vehicles add column if not exists data_ultima_revisao date;

-- No cadastro, o km atual parte do km inicial. A última troca de óleo / revisão
-- pode ser informada; se não for, conta a partir do km inicial.
create or replace function public.vehicles_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  io integer;
  ir integer;
begin
  new.placa := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));
  new.km_atual := new.km_inicial;
  -- Organização do veículo: a do gestor que cadastra (o ADM informa a organização)
  if new.organizacao_id is null then new.organizacao_id := public.minha_org(); end if;
  if new.organizacao_id is null then raise exception 'Informe a organização do veículo.'; end if;
  -- Intervalos de manutenção: o padrão da organização
  select c.intervalo_oleo, c.intervalo_revisao into io, ir from public.configuracoes c where c.organizacao_id = new.organizacao_id;
  new.intervalo_oleo := coalesce(io, 10000);
  new.intervalo_revisao := coalesce(ir, 20000);
  -- Sem data informada não há registro no histórico: conta a partir do km inicial
  if new.data_ultima_troca_oleo is null then new.km_ultima_troca_oleo := new.km_inicial; end if;
  if new.data_ultima_revisao is null then new.km_ultima_revisao := new.km_inicial; end if;
  new.km_ultima_troca_oleo := coalesce(new.km_ultima_troca_oleo, new.km_inicial);
  new.km_ultima_revisao := coalesce(new.km_ultima_revisao, new.km_inicial);
  if new.km_ultima_troca_oleo > new.km_inicial or new.km_ultima_revisao > new.km_inicial then
    raise exception 'O km da última troca de óleo/revisão não pode ser maior que o km atual do veículo.';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_before_insert on public.vehicles;
create trigger vehicles_before_insert
  before insert on public.vehicles
  for each row execute function public.vehicles_before_insert();


-- ---------------------------------------------------------------------
-- 3. VIAGENS (foto do mostrador no início e no fim)
-- ---------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) default auth.uid(),
  destino text not null default '',
  km_inicio integer not null check (km_inicio >= 0),
  foto_inicio text not null,
  iniciada_em timestamptz not null default now(),
  km_fim integer,
  foto_fim text,
  finalizada_em timestamptz,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'finalizada')),
  check (km_fim is null or km_fim >= km_inicio),
  check (status = 'em_andamento' or (km_fim is not null and foto_fim is not null and finalizada_em is not null))
);

-- Só pode haver uma viagem em andamento por carro
create unique index if not exists trips_uma_aberta_por_veiculo
  on public.trips (vehicle_id) where status = 'em_andamento';

create index if not exists trips_finalizada_em_idx on public.trips (finalizada_em);

-- Mantém o km atual do carro sempre no maior valor registrado
create or replace function public.trips_atualiza_km()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.vehicles
     set km_atual = greatest(km_atual, coalesce(new.km_fim, new.km_inicio))
   where id = new.vehicle_id;
  return new;
end;
$$;

drop trigger if exists trips_atualiza_km on public.trips;
create trigger trips_atualiza_km
  after insert or update of km_fim on public.trips
  for each row execute function public.trips_atualiza_km();


-- ---------------------------------------------------------------------
-- 3b. RASTREIO GPS DA VIAGEM (distância pelo GPS, cobertura, velocidades e trilha)
-- ---------------------------------------------------------------------
-- O odômetro continua sendo o registro oficial; o GPS serve para conferir e mostrar a rota.
alter table public.trips add column if not exists gps_distancia_m integer;
alter table public.trips add column if not exists gps_cobertura smallint;
alter table public.trips add column if not exists gps_interrupcoes smallint;
alter table public.trips add column if not exists gps_pontos integer;
alter table public.trips add column if not exists vel_max_kmh numeric(5, 1);
alter table public.trips add column if not exists vel_media_kmh numeric(5, 1);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and conname = 'trips_gps_check') then
    alter table public.trips add constraint trips_gps_check check (
      (gps_distancia_m is null or gps_distancia_m between 0 and 5000000)
      and (gps_cobertura is null or gps_cobertura between 0 and 100)
      and (gps_interrupcoes is null or gps_interrupcoes >= 0)
      and (gps_pontos is null or gps_pontos >= 0)
      and (vel_max_kmh is null or vel_max_kmh between 0 and 400)
      and (vel_media_kmh is null or vel_media_kmh between 0 and 400)
    );
  end if;
end $$;

-- A trilha (pontos da rota) fica em tabela própria para as listas de viagens continuarem leves
create table if not exists public.trip_trilhas (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  pontos jsonb not null check (jsonb_typeof(pontos) = 'array' and jsonb_array_length(pontos) <= 1000),
  atualizado_em timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. MANUTENÇÕES (histórico: troca de óleo, revisão, pneus, freios...)
-- ---------------------------------------------------------------------
create table if not exists public.maintenances (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tipo text not null,
  km integer not null check (km >= 0),
  custo numeric(10, 2) check (custo is null or custo >= 0),
  observacao text not null default '',
  user_id uuid references public.profiles (id) default auth.uid(),
  realizada_em date not null default current_date,
  created_at timestamptz not null default now()
);

-- Atualização de bancos criados antes: custo e novos tipos de serviço
alter table public.maintenances add column if not exists custo numeric(10, 2) check (custo is null or custo >= 0);
alter table public.maintenances drop constraint if exists maintenances_tipo_check;
alter table public.maintenances add constraint maintenances_tipo_check
  check (tipo in ('oleo', 'revisao', 'pneus', 'freios', 'bateria', 'outro'));

create index if not exists maintenances_vehicle_idx on public.maintenances (vehicle_id, realizada_em desc);

-- Recalcula a última troca de óleo e a última revisão do carro a partir do histórico
-- (vale para inclusão e exclusão de registros). Sem registro, conta do km inicial.
create or replace function public.recalcular_manutencao(vid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.vehicles v set
    km_ultima_troca_oleo = coalesce(o.km, v.km_inicial),
    data_ultima_troca_oleo = o.realizada_em,
    km_ultima_revisao = coalesce(r.km, v.km_inicial),
    data_ultima_revisao = r.realizada_em
  from (select 1) _
  left join lateral (
    select km, realizada_em from public.maintenances
    where vehicle_id = vid and tipo = 'oleo' order by km desc, realizada_em desc limit 1
  ) o on true
  left join lateral (
    select km, realizada_em from public.maintenances
    where vehicle_id = vid and tipo = 'revisao' order by km desc, realizada_em desc limit 1
  ) r on true
  where v.id = vid;
$$;

create or replace function public.maintenances_atualiza_veiculo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_manutencao(old.vehicle_id);
    return old;
  end if;
  update public.vehicles set km_atual = greatest(km_atual, new.km) where id = new.vehicle_id;
  perform public.recalcular_manutencao(new.vehicle_id);
  return new;
end;
$$;

drop trigger if exists maintenances_atualiza_veiculo on public.maintenances;
create trigger maintenances_atualiza_veiculo
  after insert or update or delete on public.maintenances
  for each row execute function public.maintenances_atualiza_veiculo();

-- Última troca de óleo / revisão informadas no cadastro entram no histórico
create or replace function public.vehicles_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.data_ultima_troca_oleo is not null then
    insert into public.maintenances (vehicle_id, tipo, km, realizada_em, observacao, user_id)
    values (new.id, 'oleo', new.km_ultima_troca_oleo, new.data_ultima_troca_oleo, 'Informado no cadastro do veículo', new.created_by);
  end if;
  if new.data_ultima_revisao is not null then
    insert into public.maintenances (vehicle_id, tipo, km, realizada_em, observacao, user_id)
    values (new.id, 'revisao', new.km_ultima_revisao, new.data_ultima_revisao, 'Informado no cadastro do veículo', new.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_after_insert on public.vehicles;
create trigger vehicles_after_insert
  after insert on public.vehicles
  for each row execute function public.vehicles_after_insert();


-- ---------------------------------------------------------------------
-- 5. PNEUS (profundidade do sulco em mm, medidor TWI)
-- ---------------------------------------------------------------------
create table if not exists public.tire_measurements (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) default auth.uid(),
  dianteiro_esquerdo numeric(4, 2) not null check (dianteiro_esquerdo between 0 and 20),
  dianteiro_direito numeric(4, 2) not null check (dianteiro_direito between 0 and 20),
  traseiro_esquerdo numeric(4, 2) not null check (traseiro_esquerdo between 0 and 20),
  traseiro_direito numeric(4, 2) not null check (traseiro_direito between 0 and 20),
  foto_de text,
  foto_dd text,
  foto_te text,
  foto_td text,
  created_at timestamptz not null default now()
);

-- Atualização: o medidor digital mostra 2 casas decimais (ex.: 1,27 mm)
alter table public.tire_measurements
  alter column dianteiro_esquerdo type numeric(4, 2),
  alter column dianteiro_direito type numeric(4, 2),
  alter column traseiro_esquerdo type numeric(4, 2),
  alter column traseiro_direito type numeric(4, 2);


-- ---------------------------------------------------------------------
-- 5b. VÍNCULO VEÍCULO x USUÁRIO (quem pode usar cada carro)
-- ---------------------------------------------------------------------
-- Na primeira vez: cria a tabela e vincula cada carro a quem o cadastrou e a
-- quem já registrou viagem, medição ou manutenção nele.
do $$
begin
  if to_regclass('public.vehicle_users') is null then
    create table public.vehicle_users (
      vehicle_id uuid not null references public.vehicles (id) on delete cascade,
      user_id uuid not null references public.profiles (id) on delete cascade,
      vinculado_por uuid references public.profiles (id) default auth.uid(),
      vinculado_em timestamptz not null default now(),
      primary key (vehicle_id, user_id)
    );
    insert into public.vehicle_users (vehicle_id, user_id, vinculado_por)
    select distinct vehicle_id, user_id, null::uuid from (
      select id as vehicle_id, created_by as user_id from public.vehicles
      union select vehicle_id, user_id from public.trips
      union select vehicle_id, user_id from public.tire_measurements
      union select vehicle_id, user_id from public.maintenances
    ) t
    where user_id is not null
    on conflict do nothing;
  end if;
end $$;

create index if not exists vehicle_users_user_idx on public.vehicle_users (user_id);

-- Quem fez a última alteração no cadastro do carro (alterações diretas, não as automáticas de km)
alter table public.vehicles add column if not exists atualizado_por uuid references public.profiles (id);
alter table public.vehicles add column if not exists atualizado_em timestamptz;

create or replace function public.vehicles_before_update()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null
     and (new.placa, new.modelo, new.intervalo_oleo, new.intervalo_revisao, new.km_atual)
         is distinct from (old.placa, old.modelo, old.intervalo_oleo, old.intervalo_revisao, old.km_atual) then
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_before_update on public.vehicles;
create trigger vehicles_before_update
  before update on public.vehicles
  for each row execute function public.vehicles_before_update();


-- ---------------------------------------------------------------------
-- 5c. MULTIEMPRESA (cada carro, viagem e registro pertence a uma organização)
-- ---------------------------------------------------------------------
-- Roda UMA vez, na primeira execução depois da atualização: cria a coluna "organizacao_id",
-- cria a organização "Frota própria" (só se já havia dados) e leva para ela tudo o que existia.
do $$
declare
  org uuid;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehicles' and column_name = 'organizacao_id'
  ) then
    alter table public.vehicles add column organizacao_id uuid references public.organizacoes (id);
    alter table public.trips add column organizacao_id uuid references public.organizacoes (id);
    alter table public.maintenances add column organizacao_id uuid references public.organizacoes (id);
    alter table public.tire_measurements add column organizacao_id uuid references public.organizacoes (id);
    alter table public.vehicle_users add column organizacao_id uuid references public.organizacoes (id);

    if exists (select 1 from public.vehicles) or exists (select 1 from public.profiles where role <> 'admin') then
      insert into public.organizacoes (nome, tipo, criada_por)
      values ('Frota própria', 'empresa', (select id from public.profiles where role = 'admin' order by created_at limit 1))
      returning id into org;
      update public.profiles set organizacao_id = org;
      update public.vehicles set organizacao_id = org;
    end if;

    update public.trips x set organizacao_id = v.organizacao_id from public.vehicles v where v.id = x.vehicle_id;
    update public.maintenances x set organizacao_id = v.organizacao_id from public.vehicles v where v.id = x.vehicle_id;
    update public.tire_measurements x set organizacao_id = v.organizacao_id from public.vehicles v where v.id = x.vehicle_id;
    update public.vehicle_users x set organizacao_id = v.organizacao_id from public.vehicles v where v.id = x.vehicle_id;

    alter table public.vehicles alter column organizacao_id set not null;
    alter table public.trips alter column organizacao_id set not null;
    alter table public.maintenances alter column organizacao_id set not null;
    alter table public.tire_measurements alter column organizacao_id set not null;
    alter table public.vehicle_users alter column organizacao_id set not null;
  end if;
end $$;

-- A placa passa a ser única dentro de cada organização (clientes diferentes não se atrapalham)
alter table public.vehicles drop constraint if exists vehicles_placa_key;
create unique index if not exists vehicles_placa_por_org on public.vehicles (organizacao_id, placa);
create index if not exists vehicles_org_idx on public.vehicles (organizacao_id);
create index if not exists trips_org_idx on public.trips (organizacao_id);
create index if not exists maintenances_org_idx on public.maintenances (organizacao_id);
create index if not exists tire_measurements_org_idx on public.tire_measurements (organizacao_id);
create index if not exists vehicle_users_org_idx on public.vehicle_users (organizacao_id);

-- Bancos antigos tinham uma linha única de parâmetros: ela passa a ser da organização inicial
do $$
declare
  org uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'id'
  ) then
    select id into org from public.organizacoes order by criada_em limit 1;
    alter table public.configuracoes add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
    if org is null then
      delete from public.configuracoes;
    else
      update public.configuracoes set organizacao_id = org;
    end if;
    alter table public.configuracoes drop constraint if exists configuracoes_pkey;
    alter table public.configuracoes drop column id;
    alter table public.configuracoes alter column organizacao_id set not null;
    alter table public.configuracoes add primary key (organizacao_id);
  end if;
end $$;

-- Toda organização nova nasce com os parâmetros padrão
create or replace function public.organizacoes_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.configuracoes (organizacao_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists organizacoes_after_insert on public.organizacoes;
create trigger organizacoes_after_insert
  after insert on public.organizacoes
  for each row execute function public.organizacoes_after_insert();

insert into public.configuracoes (organizacao_id) select id from public.organizacoes on conflict do nothing;

-- Viagens, manutenções e medições herdam a organização do veículo (ninguém escolhe)
create or replace function public.herdar_organizacao_do_veiculo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select v.organizacao_id into new.organizacao_id from public.vehicles v where v.id = new.vehicle_id;
  if new.organizacao_id is null then
    raise exception 'Veículo não encontrado.';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_org on public.trips;
create trigger trips_org before insert on public.trips
  for each row execute function public.herdar_organizacao_do_veiculo();
drop trigger if exists maintenances_org on public.maintenances;
create trigger maintenances_org before insert on public.maintenances
  for each row execute function public.herdar_organizacao_do_veiculo();
drop trigger if exists tire_measurements_org on public.tire_measurements;
create trigger tire_measurements_org before insert on public.tire_measurements
  for each row execute function public.herdar_organizacao_do_veiculo();

-- Só dá para vincular ao carro uma pessoa da mesma organização dele
create or replace function public.vehicle_users_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select v.organizacao_id into new.organizacao_id from public.vehicles v where v.id = new.vehicle_id;
  if new.organizacao_id is null then
    raise exception 'Veículo não encontrado.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.organizacao_id = new.organizacao_id) then
    raise exception 'O usuário não pertence à organização deste veículo.';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicle_users_org on public.vehicle_users;
create trigger vehicle_users_org before insert on public.vehicle_users
  for each row execute function public.vehicle_users_before_insert();

-- O usuário logado pode usar este carro? ADM: todos. Gestor: os da organização.
-- Motorista: só os vinculados a ele.
create or replace function public.pode_usar_veiculo(vid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1 from public.vehicles v
        where v.id = vid
          and v.organizacao_id = public.minha_org()
          and (
            public.is_gestor()
            or exists (select 1 from public.vehicle_users l where l.vehicle_id = v.id and l.user_id = auth.uid())
          )
      );
$$;

-- Convites: o gestor (ou o ADM) gera um código; quem se cadastra usa o código para entrar na organização
create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  papel text not null check (papel in ('gestor', 'motorista')),
  criado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_por uuid references public.profiles (id) on delete set null,
  usado_em timestamptz
);
create index if not exists convites_org_idx on public.convites (organizacao_id);

create or replace function public.criar_convite(p_org uuid, p_papel text, p_dias integer default 7)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  novo text;
  tentativas integer := 0;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_papel not in ('gestor', 'motorista') then raise exception 'Papel inválido.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'A validade deve ser de 1 a 60 dias.'; end if;
  if not (public.is_admin() or (public.is_gestor() and p_org = public.minha_org())) then
    raise exception 'Sem permissão para convidar nesta organização.';
  end if;
  if not exists (select 1 from public.organizacoes where id = p_org and ativa) then
    raise exception 'Organização não encontrada ou suspensa.';
  end if;
  loop
    novo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.convites where codigo = novo);
    tentativas := tentativas + 1;
    if tentativas > 5 then raise exception 'Não foi possível gerar o código. Tente de novo.'; end if;
  end loop;
  insert into public.convites (codigo, organizacao_id, papel, expira_em)
  values (novo, p_org, p_papel, now() + make_interval(days => p_dias));
  return novo;
end;
$$;

create or replace function public.aceitar_convite(p_codigo text)
returns table (org_nome text, papel_novo text)
language plpgsql
security definer set search_path = public
as $$
declare
  eu public.profiles;
  c public.convites;
  cod text;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into eu from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Perfil não encontrado.'; end if;
  if not eu.ativo then raise exception 'Seu acesso está desativado.'; end if;
  if eu.role = 'admin' then raise exception 'Contas de administrador não usam convite.'; end if;
  if eu.organizacao_id is not null then raise exception 'Você já pertence a uma organização.'; end if;
  cod := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  select * into c from public.convites where codigo = cod and usado_em is null and expira_em > now() for update;
  if not found then raise exception 'Código inválido, vencido ou já usado.'; end if;
  if not exists (select 1 from public.organizacoes where id = c.organizacao_id and ativa) then
    raise exception 'Esta organização está suspensa.';
  end if;
  update public.profiles set organizacao_id = c.organizacao_id, role = c.papel where id = eu.id;
  update public.convites set usado_por = eu.id, usado_em = now() where id = c.id;
  return query select o.nome, c.papel from public.organizacoes o where o.id = c.organizacao_id;
end;
$$;

-- Gestor: muda o papel (gestor/motorista) e ativa/desativa pessoas da própria organização. ADM: de qualquer uma.
create or replace function public.definir_papel(p_usuario uuid, p_papel text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  alvo public.profiles;
begin
  if p_papel not in ('gestor', 'motorista') then raise exception 'Papel inválido.'; end if;
  select * into alvo from public.profiles where id = p_usuario;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  if alvo.role = 'admin' then raise exception 'Não é possível alterar um administrador.'; end if;
  if p_usuario = auth.uid() then raise exception 'Você não pode alterar o seu próprio acesso.'; end if;
  if alvo.organizacao_id is null then raise exception 'O usuário ainda não pertence a uma organização.'; end if;
  if not (public.is_admin() or (public.is_gestor() and alvo.organizacao_id = public.minha_org())) then
    raise exception 'Sem permissão.';
  end if;
  update public.profiles set role = p_papel where id = p_usuario;
end;
$$;

create or replace function public.definir_ativo(p_usuario uuid, p_ativo boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  alvo public.profiles;
begin
  select * into alvo from public.profiles where id = p_usuario;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  if alvo.role = 'admin' then raise exception 'Não é possível alterar um administrador.'; end if;
  if p_usuario = auth.uid() then raise exception 'Você não pode alterar o seu próprio acesso.'; end if;
  if not (public.is_admin() or (public.is_gestor() and alvo.organizacao_id is not null and alvo.organizacao_id = public.minha_org())) then
    raise exception 'Sem permissão.';
  end if;
  update public.profiles set ativo = p_ativo where id = p_usuario;
end;
$$;

-- ADM: coloca um usuário em uma organização (ou o muda de organização), já com o papel
create or replace function public.atribuir_usuario(p_usuario uuid, p_org uuid, p_papel text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  alvo public.profiles;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode fazer isso.'; end if;
  if p_papel not in ('gestor', 'motorista') then raise exception 'Papel inválido.'; end if;
  select * into alvo from public.profiles where id = p_usuario;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  if alvo.role = 'admin' then raise exception 'Não é possível alterar um administrador.'; end if;
  if not exists (select 1 from public.organizacoes where id = p_org) then raise exception 'Organização não encontrada.'; end if;
  if alvo.organizacao_id is distinct from p_org then
    delete from public.vehicle_users where user_id = p_usuario; -- os vínculos eram de carros da organização anterior
  end if;
  update public.profiles set organizacao_id = p_org, role = p_papel where id = p_usuario;
end;
$$;

-- Estas funções só podem ser chamadas por quem está logado (e cada uma confere o nível de acesso)
revoke all on function public.criar_convite(uuid, text, integer) from public, anon;
revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.definir_papel(uuid, text) from public, anon;
revoke all on function public.definir_ativo(uuid, boolean) from public, anon;
revoke all on function public.atribuir_usuario(uuid, uuid, text) from public, anon;
grant execute on function public.criar_convite(uuid, text, integer) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.definir_papel(uuid, text) to authenticated;
grant execute on function public.definir_ativo(uuid, boolean) to authenticated;
grant execute on function public.atribuir_usuario(uuid, uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. PERMISSÕES (quem pode ver e alterar o quê)
-- ---------------------------------------------------------------------
-- Regra geral: ADM vê tudo; gestor vê e altera tudo da própria organização; motorista só
-- inicia/finaliza viagens dos carros vinculados a ele. Organização suspensa ou usuário
-- desativado ficam sem acesso a nada.
alter table public.organizacoes enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.maintenances enable row level security;
alter table public.tire_measurements enable row level security;
alter table public.vehicle_users enable row level security;
alter table public.configuracoes enable row level security;
alter table public.trip_trilhas enable row level security;
alter table public.convites enable row level security;

-- Organizações: cada um vê a sua; só o ADM cria e altera
drop policy if exists "ve organizacao" on public.organizacoes;
create policy "ve organizacao" on public.organizacoes
  for select using (public.is_admin() or id = public.organizacao_do_usuario());
drop policy if exists "admin cria organizacao" on public.organizacoes;
create policy "admin cria organizacao" on public.organizacoes
  for insert with check (public.is_admin());
drop policy if exists "admin altera organizacao" on public.organizacoes;
create policy "admin altera organizacao" on public.organizacoes
  for update using (public.is_admin()) with check (public.is_admin());

-- Convites: ADM vê todos; gestor vê os da organização. Criar: pela função criar_convite
drop policy if exists "ve convites" on public.convites;
create policy "ve convites" on public.convites
  for select using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
drop policy if exists "revoga convite" on public.convites;
create policy "revoga convite" on public.convites
  for delete using (usado_em is null and (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org())));

-- Parâmetros: da organização; o gestor (e o ADM) altera
drop policy if exists "logado le configuracoes" on public.configuracoes;
drop policy if exists "admin altera configuracoes" on public.configuracoes;
drop policy if exists "le parametros da organizacao" on public.configuracoes;
create policy "le parametros da organizacao" on public.configuracoes
  for select to authenticated using (public.is_admin() or organizacao_id = public.minha_org());
drop policy if exists "altera parametros da organizacao" on public.configuracoes;
create policy "altera parametros da organizacao" on public.configuracoes
  for update to authenticated
  using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()))
  with check (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));

-- Usuários: cada um vê o próprio; gestor vê os da organização; ADM vê todos.
-- Ninguém altera o perfil direto: papel e ativação passam pelas funções (que conferem as regras).
drop policy if exists "perfil proprio ou admin" on public.profiles;
drop policy if exists "admin altera perfis" on public.profiles;
drop policy if exists "ve perfis" on public.profiles;
create policy "ve perfis" on public.profiles
  for select using (id = auth.uid() or public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
revoke update, insert, delete on public.profiles from authenticated, anon;

-- Carros: ADM todos; gestor os da organização (cadastra, altera, exclui); motorista só os vinculados
drop policy if exists "logado lista veiculos" on public.vehicles;
drop policy if exists "logado cadastra veiculo" on public.vehicles;
drop policy if exists "admin altera veiculo" on public.vehicles;
drop policy if exists "admin exclui veiculo" on public.vehicles;
drop policy if exists "ve veiculos" on public.vehicles;
create policy "ve veiculos" on public.vehicles
  for select to authenticated using (
    public.is_admin()
    or (
      organizacao_id = public.minha_org()
      and (public.is_gestor() or exists (select 1 from public.vehicle_users l where l.vehicle_id = vehicles.id and l.user_id = auth.uid()))
    )
  );
drop policy if exists "gestor cadastra veiculo" on public.vehicles;
create policy "gestor cadastra veiculo" on public.vehicles
  for insert to authenticated with check (
    created_by = auth.uid() and (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()))
  );
drop policy if exists "gestor altera veiculo" on public.vehicles;
create policy "gestor altera veiculo" on public.vehicles
  for update to authenticated
  using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()))
  with check (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
drop policy if exists "gestor exclui veiculo" on public.vehicles;
create policy "gestor exclui veiculo" on public.vehicles
  for delete to authenticated using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));

-- Viagens: motorista vê e finaliza as próprias; gestor vê e acompanha todas da organização; ADM todas
drop policy if exists "viagens proprias ou admin" on public.trips;
drop policy if exists "inicia viagem propria" on public.trips;
drop policy if exists "finaliza viagem propria" on public.trips;
drop policy if exists "admin exclui viagem" on public.trips;
drop policy if exists "ve viagens" on public.trips;
create policy "ve viagens" on public.trips
  for select using (
    public.is_admin() or (organizacao_id = public.minha_org() and (user_id = auth.uid() or public.is_gestor()))
  );
drop policy if exists "inicia viagem" on public.trips;
create policy "inicia viagem" on public.trips
  for insert to authenticated with check (
    user_id = auth.uid() and status = 'em_andamento' and public.pode_usar_veiculo(vehicle_id)
  );
drop policy if exists "finaliza viagem" on public.trips;
create policy "finaliza viagem" on public.trips
  for update
  using (
    public.is_admin()
    or (organizacao_id = public.minha_org() and (public.is_gestor() or (user_id = auth.uid() and status = 'em_andamento')))
  )
  with check (
    public.is_admin() or (organizacao_id = public.minha_org() and (public.is_gestor() or user_id = auth.uid()))
  );
drop policy if exists "gestor exclui viagem" on public.trips;
create policy "gestor exclui viagem" on public.trips
  for delete using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
-- Ao finalizar, só os campos de fim podem ser preenchidos
revoke update on public.trips from authenticated;
grant update (km_fim, foto_fim, finalizada_em, status, gps_distancia_m, gps_cobertura, gps_interrupcoes, gps_pontos, vel_max_kmh, vel_media_kmh)
  on public.trips to authenticated;

-- Trilha da viagem: o motorista grava a da própria viagem enquanto ela está em andamento;
-- ele, o gestor da organização e o ADM podem ver. Depois de finalizada, ninguém altera.
drop policy if exists "ve trilha propria ou admin" on public.trip_trilhas;
drop policy if exists "ve trilha" on public.trip_trilhas;
create policy "ve trilha" on public.trip_trilhas
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizacao_id = public.minha_org() and (t.user_id = auth.uid() or public.is_gestor())
    )
  );
drop policy if exists "grava trilha propria" on public.trip_trilhas;
create policy "grava trilha propria" on public.trip_trilhas
  for insert to authenticated with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid() and t.status = 'em_andamento')
  );
drop policy if exists "atualiza trilha propria" on public.trip_trilhas;
create policy "atualiza trilha propria" on public.trip_trilhas
  for update to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid() and t.status = 'em_andamento'))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid() and t.status = 'em_andamento'));

-- Manutenções: só o gestor da organização (e o ADM) vê, registra e exclui
drop policy if exists "logado ve manutencoes" on public.maintenances;
drop policy if exists "admin registra manutencao" on public.maintenances;
drop policy if exists "logado registra manutencao" on public.maintenances;
drop policy if exists "admin exclui manutencao" on public.maintenances;
drop policy if exists "gestor ve manutencoes" on public.maintenances;
create policy "gestor ve manutencoes" on public.maintenances
  for select to authenticated using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
drop policy if exists "gestor registra manutencao" on public.maintenances;
create policy "gestor registra manutencao" on public.maintenances
  for insert to authenticated with check (
    user_id = auth.uid() and (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()))
  );
drop policy if exists "gestor exclui manutencao" on public.maintenances;
create policy "gestor exclui manutencao" on public.maintenances
  for delete using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));

-- Pneus: só o gestor da organização (e o ADM)
drop policy if exists "medicoes proprias ou admin" on public.tire_measurements;
drop policy if exists "registra medicao propria" on public.tire_measurements;
drop policy if exists "gestor ve medicoes" on public.tire_measurements;
create policy "gestor ve medicoes" on public.tire_measurements
  for select using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
drop policy if exists "gestor registra medicao" on public.tire_measurements;
create policy "gestor registra medicao" on public.tire_measurements
  for insert to authenticated with check (
    user_id = auth.uid() and (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()))
  );

-- Vínculos: motorista vê os próprios; gestor vê e altera os da organização; ADM todos
drop policy if exists "ve vinculos" on public.vehicle_users;
create policy "ve vinculos" on public.vehicle_users
  for select to authenticated using (
    public.is_admin() or (organizacao_id = public.minha_org() and (public.is_gestor() or user_id = auth.uid()))
  );
drop policy if exists "admin vincula" on public.vehicle_users;
drop policy if exists "gestor vincula" on public.vehicle_users;
create policy "gestor vincula" on public.vehicle_users
  for insert with check (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));
drop policy if exists "admin desvincula" on public.vehicle_users;
drop policy if exists "gestor desvincula" on public.vehicle_users;
create policy "gestor desvincula" on public.vehicle_users
  for delete using (public.is_admin() or (public.is_gestor() and organizacao_id = public.minha_org()));

-- (função antiga, substituída pelas regras de organização)
drop function if exists public.compartilha_veiculo(uuid);


-- ---------------------------------------------------------------------
-- 7. FOTOS (pasta privada "fotos"; cada usuário grava na própria subpasta)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "envia fotos na propria pasta" on storage.objects;
create policy "envia fotos na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Fotos: cada um vê as próprias; o gestor vê as de quem é da organização dele; o ADM vê todas
drop policy if exists "ve fotos proprias ou admin" on storage.objects;
drop policy if exists "ve fotos" on storage.objects;
create policy "ve fotos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or (public.is_gestor() and public.usuario_na_minha_org(((storage.foldername(name))[1])::uuid))
    )
  );


-- ---------------------------------------------------------------------
-- 8. CONTAS QUE JÁ EXISTIAM (se você criou conta antes de rodar este arquivo)
-- ---------------------------------------------------------------------
insert into public.profiles (id, nome, email)
select id, coalesce(raw_user_meta_data ->> 'nome', ''), email
from auth.users
on conflict (id) do nothing;

-- Se ainda não há ADM, a conta mais antiga vira ADM
update public.profiles set role = 'admin'
where not exists (select 1 from public.profiles where role = 'admin')
  and id = (select u.id from auth.users u join public.profiles p on p.id = u.id order by u.created_at limit 1);


-- ---------------------------------------------------------------------
-- 9. RECÁLCULO (preenche última troca de óleo/revisão a partir do histórico)
-- ---------------------------------------------------------------------
select public.recalcular_manutencao(id) from public.vehicles;
