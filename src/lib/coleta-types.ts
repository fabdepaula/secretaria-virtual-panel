/** Tipos das views de operação da coleta (Tarefa 9). */

export type EntregadorMapa = {
  id: string;
  nome: string;
  status: "disponivel" | "ocupado" | "offline" | string;
  ativo: boolean;
  latitude: number | null;
  longitude: number | null;
  pos_atualizada_em: string | null;
  segundos_desde_posicao: number | null;
  posicao_incerta: boolean;
  coletas_ativas: number;
  capacidade_max: number;
  sem_vaga: boolean;
  geofence_atual_id: number | null;
  geofence_papel: string | null;
  geofence_descricao: string | null;
  geofence_desde: string | null;
  id_dispositivo_gps: string | null;
};

export type PontoMapa = {
  tipo: "clinica" | "laboratorio" | string;
  id: string;
  nome: string;
  unidade: string | null;
  cliente_id: string | null;
  latitude: number;
  longitude: number;
  geo_status: string | null;
  geo_precisao: string | null;
  aceita_coleta: boolean | null;
  endereco_resumo: string | null;
  geofence_id: number | null;
  raio_geofence_m: number | null;
};

export type ColetaFila = {
  id: string;
  protocolo: string | null;
  status: string;
  urgencia: string | null;
  janela_horario: string | null;
  tentativas_atribuicao: number | null;
  clinica_id: string;
  clinica: string;
  endereco_id: string | null;
  unidade: string | null;
  endereco_resumo: string | null;
  coleta_latitude: number | null;
  coleta_longitude: number | null;
  entregador_id: string | null;
  entregador: string | null;
  entregador_status: string | null;
  entregador_latitude: number | null;
  entregador_longitude: number | null;
  entregador_pos_em: string | null;
  criada_em: string | null;
  atribuida_em: string | null;
  aceita_em: string | null;
  coletando_em: string | null;
  coletado_em: string | null;
  desde: string;
  minutos_no_status: number;
  ultimo_evento_em: string | null;
  sla_limite_min: number | null;
  sla_estourado: boolean;
  exige_operador: boolean;
  prioridade: number;
};

export type OperacaoResumo = {
  coletas_abertas: number;
  exigem_operador: number;
  sla_estourado: number;
  solicitadas: number;
  atribuidas: number;
  em_curso: number;
  entregadores_disponiveis: number;
  entregadores_ocupados: number;
  entregadores_offline: number;
  entregadores_posicao_incerta: number;
};

export type MapaResponse = {
  ok: true;
  data: {
    entregadores: EntregadorMapa[];
    pontos: PontoMapa[];
    gerado_em: string;
  };
};

export type FilaResponse = {
  ok: true;
  data: {
    coletas: ColetaFila[];
    resumo: OperacaoResumo;
    gerado_em: string;
  };
};
