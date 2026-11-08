export enum CategoriaEtaria {
  CRIANCA = 'crianca',
  ADOLESCENTE = 'adolescente',
  ADULTO = 'adulto',
  IDOSO = 'idoso',
}

export enum Genero {
  MASCULINO = 'masculino',
  FEMININO = 'feminino',
  OUTROS = 'outros',
}

export enum EstadoCivil {
  SOLTEIRO = 'solteiro',
  CASADO = 'casado',
  UNIAO_ESTAVEL = 'uniao_estavel',
  SEPARADO = 'separado',
  DIVORCIADO = 'divorciado',
  VIUVO = 'viuvo',
}

export enum Terapia {
  PSIQUIATRICO = 'acompanhamento_psiquiatrico',
  NEUROLOGICO = 'acompanhamento_neurologico',
  PSICOLOGICO = 'acompanhamento_psicologico',
  NEUROPEDAGOGICO = 'acompanhamento_neuropedagogico',
  FONOAUDIOLOGICO = 'acompanhamento_fonoaudiologico',
  TERAPIA_OCUPACIONAL = 'terapia_ocupacional',
  FISIOTERAPIA = 'fisioterapia',
  OUTROS = 'outros',
}

// Categorias em que o responsável legal é obrigatório
export const CATEGORIAS_COM_RESPONSAVEL: CategoriaEtaria[] = [
  CategoriaEtaria.CRIANCA,
  CategoriaEtaria.ADOLESCENTE,
];