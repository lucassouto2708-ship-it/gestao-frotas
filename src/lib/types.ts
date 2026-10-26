export type Role = "admin" | "comum";

export type Profile = {
  id: string;
  nome: string;
  email: string | null;
  role: Role;
  created_at: string;
};

export type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  km_inicial: number;
  km_atual: number;
  foto_km_inicial: string | null;
  intervalo_oleo: number;
  intervalo_revisao: number;
  km_ultima_troca_oleo: number;
  km_ultima_revisao: number;
  created_by: string | null;
  created_at: string;
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
};

export type Maintenance = {
  id: string;
  vehicle_id: string;
  tipo: "oleo" | "revisao";
  km: number;
  observacao: string;
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
