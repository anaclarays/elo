export enum TipoPaciente {
  BENEFICIARIO = 'beneficiario',
  TEA = 'tea',
}

export enum MotivoSaida {
  AGENDAMENTO = 'agendamento',
  MANUAL = 'manual',
}

export interface PacienteRef {
  tipo: TipoPaciente;
  id: number | string;
}
