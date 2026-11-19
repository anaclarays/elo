// O sistema tem dois cadastros de paciente: crianças/adolescentes (tabela `pacientes`)
// e pessoas com TEA (tabela `pacientes_tea`). A lista de espera atende os dois.
export enum TipoPaciente {
  BENEFICIARIO = 'beneficiario',
  TEA = 'tea',
}

export enum MotivoSaida {
  AGENDAMENTO = 'agendamento',
  MANUAL = 'manual',
}

// Identifica um paciente em qualquer um dos dois cadastros
export interface PacienteRef {
  tipo: TipoPaciente;
  id: number | string;
}
