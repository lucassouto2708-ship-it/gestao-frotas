/** admin: dono do sistema (todas as organizações). gestor: administra uma organização. motorista: só viagens. */
export type Role = "admin" | "gestor" | "motorista";

export const ROTULO_PAPEL: Record<Role, string> = { admin: "ADM", gestor: "Gestor", motorista: "Motorista" };

export type Profile = {
  id: string;
  nome: string;
  email: string | null;
  role: Role;
  organizacao_id: string | null;
  ativo: boolean;
  created_at: string;
};

export type Organizacao = {
  id: string;
  nome: string;
  tipo: "empresa" | "municipio";
  ativa: boolean;
  criada_em: string;
  criada_por: string | null;
};

export type Convite = {
  id: string;
  codigo: string;
  organizacao_id: string;
  papel: "gestor" | "motorista";
  criado_por: string | null;
  criado_em: string;
  expira_em: string;
  usado_por: string | null;
  usado_em: string | null;
};

export type Vehicle = {
  id: string;
  organizacao_id: string;
  placa: string;
  modelo: string;
  km_inicial: number;
  km_atual: number;
  foto_km_inicial: string | null;
  intervalo_oleo: number;
  intervalo_revisao: number;
  km_ultima_troca_oleo: number;
  km_ultima_revisao: number;
  data_ultima_troca_oleo: string | null;
  data_ultima_revisao: string | null;
  created_by: string | null;
  created_at: string;
  atualizado_por: string | null;
  atualizado_em: string | null;
};

export type VehicleUser = {
  vehicle_id: string;
  user_id: string;
  vinculado_por: string | null;
  vinculado_em: string;
};

export type Trip = {
  id: string;
  vehicle_id: string;
  user_id: string;
  destino: string;
  km_inicio: number;
  foto_inicio: string;
  iniciada_em: string;
  km_fim: number | null;
  foto_fim: string | null;
  finalizada_em: string | null;
  status: "em_andamento" | "finalizada";
  gps_distancia_m: number | null;
  gps_cobertura: number | null;
  gps_interrupcoes: number | null;
  gps_pontos: number | null;
  vel_max_kmh: number | null;
  vel_media_kmh: number | null;
};

export type TripTrilha = {
  trip_id: string;
  /** [latitude, longitude, segundos desde o início] */
  pontos: [number, number, number][];
};

export type TipoManutencao = "oleo" | "revisao" | "pneus" | "freios" | "bateria" | "outro";

export type Maintenance = {
  id: string;
  vehicle_id: string;
  tipo: TipoManutencao;
  km: number;
  custo: number | null;
  observacao: string;
  user_id: string | null;
  realizada_em: string;
  created_at: string;
};

export type TireMeasurement = {
  id: string;
  vehicle_id: string;
  user_id: string;
  dianteiro_esquerdo: number;
  dianteiro_direito: number;
  traseiro_esquerdo: number;
  traseiro_direito: number;
  foto_de: string | null;
  foto_dd: string | null;
  foto_te: string | null;
  foto_td: string | null;
  created_at: string;
};

export type Configuracoes = {
  intervalo_oleo: number;
  intervalo_revisao: number;
  atualizado_por: string | null;
  atualizado_em: string | null;
};
