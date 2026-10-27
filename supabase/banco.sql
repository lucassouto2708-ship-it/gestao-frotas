-- =====================================================================
--  GESTÃO DE FROTAS - BANCO DE DADOS
--
--  COMO USAR:
--    1. No Supabase, abra "SQL Editor" > "New query"
--    2. Copie TODO este arquivo, cole e clique em "Run"
--    3. Deve aparecer "Success. No rows returned"
--
--  Pode rodar de novo quantas vezes quiser: não apaga nenhum dado.
--  A PRIMEIRA conta criada no app vira ADM automaticamente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. USUÁRIOS (admin / comum)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text,
  role text not null default 'comum' check (role in ('admin', 'comum')),
  created_at timestamptz not null default now()
);

-- Cria o perfil quando alguém se cadastra. Se ainda não existe ADM, vira ADM.
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
    case when exists (select 1 from public.profiles where role = 'admin') then 'comum' else 'admin' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
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

-- Atualização de bancos criados antes destas colunas existirem
alter table public.vehicles add column if not exists data_ultima_troca_oleo date;
alter table public.vehicles add column if not exists data_ultima_revisao date;

-- No cadastro, o km atual parte do km inicial. A última troca de óleo / revisão
-- pode ser informada; se não for, conta a partir do km inicial.
create or replace function public.vehicles_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.placa := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));
  new.km_atual := new.km_inicial;
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
  dianteiro_esquerdo numeric(4, 1) not null check (dianteiro_esquerdo between 0 and 20),
  dianteiro_direito numeric(4, 1) not null check (dianteiro_direito between 0 and 20),
  traseiro_esquerdo numeric(4, 1) not null check (traseiro_esquerdo between 0 and 20),
  traseiro_direito numeric(4, 1) not null check (traseiro_direito between 0 and 20),
  foto_de text,
  foto_dd text,
  foto_te text,
  foto_td text,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 6. PERMISSÕES (quem pode ver e alterar o quê)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.maintenances enable row level security;
alter table public.tire_measurements enable row level security;

-- Usuários: cada um vê o seu; ADM vê e altera todos
drop policy if exists "perfil proprio ou admin" on public.profiles;
create policy "perfil proprio ou admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "admin altera perfis" on public.profiles;
create policy "admin altera perfis" on public.profiles
  for update using (public.is_admin());

-- Carros: todos os logados listam e cadastram; só ADM altera ou exclui
drop policy if exists "logado lista veiculos" on public.vehicles;
create policy "logado lista veiculos" on public.vehicles
  for select to authenticated using (true);
drop policy if exists "logado cadastra veiculo" on public.vehicles;
create policy "logado cadastra veiculo" on public.vehicles
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "admin altera veiculo" on public.vehicles;
create policy "admin altera veiculo" on public.vehicles
  for update using (public.is_admin());
drop policy if exists "admin exclui veiculo" on public.vehicles;
create policy "admin exclui veiculo" on public.vehicles
  for delete using (public.is_admin());

-- Viagens: usuário comum vê e finaliza as próprias; ADM vê todas
drop policy if exists "viagens proprias ou admin" on public.trips;
create policy "viagens proprias ou admin" on public.trips
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "inicia viagem propria" on public.trips;
create policy "inicia viagem propria" on public.trips
  for insert to authenticated with check (user_id = auth.uid() and status = 'em_andamento');
drop policy if exists "finaliza viagem propria" on public.trips;
create policy "finaliza viagem propria" on public.trips
  for update using ((user_id = auth.uid() and status = 'em_andamento') or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin exclui viagem" on public.trips;
create policy "admin exclui viagem" on public.trips
  for delete using (public.is_admin());
-- Ao finalizar, só os campos de fim podem ser preenchidos
revoke update on public.trips from authenticated;
grant update (km_fim, foto_fim, finalizada_em, status) on public.trips to authenticated;

-- Manutenções: todos veem e registram; só ADM exclui
drop policy if exists "logado ve manutencoes" on public.maintenances;
create policy "logado ve manutencoes" on public.maintenances
  for select to authenticated using (true);
drop policy if exists "admin registra manutencao" on public.maintenances;
drop policy if exists "logado registra manutencao" on public.maintenances;
create policy "logado registra manutencao" on public.maintenances
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admin exclui manutencao" on public.maintenances;
create policy "admin exclui manutencao" on public.maintenances
  for delete using (public.is_admin());

-- Pneus: usuário vê as próprias medições; ADM vê todas
drop policy if exists "medicoes proprias ou admin" on public.tire_measurements;
create policy "medicoes proprias ou admin" on public.tire_measurements
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "registra medicao propria" on public.tire_measurements;
create policy "registra medicao propria" on public.tire_measurements
  for insert to authenticated with check (user_id = auth.uid());


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

drop policy if exists "ve fotos proprias ou admin" on storage.objects;
create policy "ve fotos proprias ou admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


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
