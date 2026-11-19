import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../database/database.constants';
import {
  CreatePacienteTeaDto,
  ResponsavelLegalDto,
} from '../dto/create-paciente-tea.dto';
import { UpdatePacienteTeaDto } from '../dto/update-pacientes-tea.dto';
import {
  CATEGORIAS_COM_RESPONSAVEL,
  CategoriaEtaria,
  Terapia,
} from '../enum/pacientes-tea.enum';
import { TipoPaciente } from '../../lista-espera/enum/lista-espera.enum';
import { ListaEsperaService } from '../../lista-espera/service/lista-espera.service';

// Lista fixa de campos aceitos em cada tabela
const CAMPOS_PACIENTE = [
  'categoria',
  'nomeCompleto',
  'dataNascimento',
  'rgOuCertidao',
  'cpf',
  'genero',
  'frequentaEscola',
  'nomeInstituicao',
  'aguardaDiagnostico',
  'parecerEspecialista',
  'parecerQuais',
  'laudoMedico',
  'nivelSuporte',
  'outrosDiagnosticos',
  'realizaTerapias',
  'terapias',
  'terapiaOutros',
  'medicacoes',
  'alergias',
  'ciptea',
  'bpc',
  'numeroCartaoSus',
  'observacoes',
  'responsavelTriagemId',
] as const;

const CAMPOS_FAMILIARES = [
  'estadoCivil',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'estado',
  'contato',
  'email',
  'nomeConjuge',
  'possuiFilhos',
  'qtdMeninas',
  'qtdMeninos',
  'numPessoasCasa',
  'rendaFamiliar',
  'recebeBolsaFamilia',
  'recebeOutroBeneficio',
] as const;

const FAIXAS_ETARIAS: Record<CategoriaEtaria, { min: number; max: number }> = {
  [CategoriaEtaria.CRIANCA]: { min: 0, max: 11 },
  [CategoriaEtaria.ADOLESCENTE]: { min: 12, max: 17 },
  [CategoriaEtaria.ADULTO]: { min: 18, max: 59 },
  [CategoriaEtaria.IDOSO]: { min: 60, max: 150 },
};

type Campos = Record<string, any>;

const apenasDigitos = (texto: string) => texto.replace(/\D/g, '');
const paraSnake = (texto: string) =>
  texto.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

const paraCamel = (texto: string) =>
  texto.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());

// snake_case (banco) -> camelCase (regras de negócio), só no primeiro nível
function camelizar(origem?: Campos | null): Campos {
  return Object.fromEntries(
    Object.entries(origem ?? {}).map(([chave, valor]) => [
      paraCamel(chave),
      valor,
    ]),
  );
}

// O pg devolve arrays de enum como texto ("{a,b}"): transforma em lista de verdade
function paraLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.startsWith('{')) {
    return valor.slice(1, -1).split(',').filter(Boolean);
  }
  return [];
}

// Devolve o cadastro com `terapias` como lista (o pg entrega arrays de enum como texto)
function formatarPaciente<T extends Campos>(linha: T): T {
  if (linha.terapias === null || linha.terapias === undefined) return linha;
  return { ...linha, terapias: paraLista(linha.terapias) };
}

function calcularIdade(dataNascimento: string): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < mes ||
    (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

// Aceita texto "AAAA-MM-DD" ou Date e devolve "AAAA-MM-DD"
const comoData = (valor: unknown): string | undefined =>
  valor instanceof Date
    ? valor.toISOString().slice(0, 10)
    : typeof valor === 'string'
      ? valor.slice(0, 10)
      : undefined;

// Copia só os campos permitidos que foram realmente enviados
function selecionar(origem: any, permitidos: readonly string[]): Campos {
  const resultado: Campos = {};
  for (const campo of permitidos) {
    if (origem?.[campo] !== undefined) resultado[campo] = origem[campo];
  }
  return resultado;
}

function montarInsert(tabela: string, campos: Campos) {
  const chaves = Object.keys(campos);
  const colunas = chaves.map(paraSnake).join(', ');
  const marcadores = chaves.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql: `INSERT INTO ${tabela} (${colunas}) VALUES (${marcadores}) RETURNING *`,
    valores: Object.values(campos),
  };
}

function montarUpdate(
  tabela: string,
  campos: Campos,
  colunaFiltro: string,
  valorFiltro: string,
) {
  const chaves = Object.keys(campos);
  const sets = chaves.map((chave, i) => `${paraSnake(chave)} = $${i + 1}`);
  sets.push('updated_at = now()');
  return {
    sql: `UPDATE ${tabela} SET ${sets.join(', ')} WHERE ${colunaFiltro} = $${chaves.length + 1} RETURNING *`,
    valores: [...Object.values(campos), valorFiltro],
  };
}

@Injectable()
export class PacientesTeaService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly listaEsperaService: ListaEsperaService,
  ) {}

  // ---------- CREATE ----------
  async create(dto: CreatePacienteTeaDto) {
    this.validarDatas(dto.dataNascimento, dto.responsavelLegal?.dataNascimento);
    this.validarCategoriaComIdade(dto.categoria, dto.dataNascimento);
    this.validarFilhos(dto.dadosFamiliares);
    await this.garantirTriagemValida(dto.responsavelTriagemId);
    await this.garantirCpfDisponivel(apenasDigitos(dto.cpf));

    const campos = this.normalizarPaciente(selecionar(dto, CAMPOS_PACIENTE));
    const familiares = this.normalizarFamiliares(
      selecionar(dto.dadosFamiliares, CAMPOS_FAMILIARES),
    );
    const responsavel = this.camposResponsavel(
      dto.categoria,
      dto.responsavelLegal,
    );

    // As duas tabelas são gravadas juntas: ou grava tudo, ou não grava nada
    return this.executarEmTransacao(async (client) => {
      const inserirPaciente = montarInsert('pacientes_tea', campos);
      const paciente = await client.query(
        inserirPaciente.sql,
        inserirPaciente.valores,
      );

      const inserirFamiliares = montarInsert('dados_familiares', {
        pacienteId: paciente.rows[0].id,
        ...familiares,
        ...responsavel,
      });
      const dadosFamiliares = await client.query(
        inserirFamiliares.sql,
        inserirFamiliares.valores,
      );

      await this.listaEsperaService.registrarNoCadastro(
        { tipo: TipoPaciente.TEA, id: paciente.rows[0].id },
        client,
      );

      return formatarPaciente({
        ...paciente.rows[0],
        dados_familiares: dadosFamiliares.rows[0],
      });
    });
  }

  // ---------- LISTAR (com filtros) ----------
  async findAll(filtros?: {
    cpf?: string;
    nome?: string;
    numeroCadastro?: number;
    categoria?: CategoriaEtaria;
  }) {
    const condicoes: string[] = ['ativo = true'];
    const valores: any[] = [];

    if (filtros?.cpf) {
      valores.push(apenasDigitos(filtros.cpf));
      condicoes.push(`cpf = $${valores.length}`);
    }
    if (filtros?.nome) {
      valores.push(`%${filtros.nome}%`);
      condicoes.push(`nome_completo ILIKE $${valores.length}`);
    }
    if (filtros?.numeroCadastro !== undefined) {
      valores.push(filtros.numeroCadastro);
      condicoes.push(`numero_cadastro = $${valores.length}`);
    }
    if (filtros?.categoria) {
      valores.push(filtros.categoria);
      condicoes.push(`categoria = $${valores.length}`);
    }

    // Na listagem devolvemos só o resumo dos dados, sem os campos detalhados de familiares e responsavel
    const resultado = await this.pool.query(
      `SELECT id, numero_cadastro, data_cadastro, categoria, nome_completo, data_nascimento,
              cpf, genero, nivel_suporte, laudo_medico, aguarda_diagnostico, responsavel_triagem_id
       FROM pacientes_tea
       WHERE ${condicoes.join(' AND ')}
       ORDER BY nome_completo`,
      valores,
    );
    return resultado.rows;
  }

  // ---------- BUSCAR UM ----------
  async findOne(id: string) {
    const resultado = await this.pool.query(
      `SELECT p.*, row_to_json(d) AS dados_familiares
       FROM pacientes_tea p
       LEFT JOIN dados_familiares d ON d.paciente_id = p.id
       WHERE p.id = $1 AND p.ativo = true`,
      [id],
    );
    if (resultado.rows.length === 0) {
      throw new NotFoundException('Cadastro não encontrado');
    }
    return formatarPaciente(resultado.rows[0]);
  }

  // ---------- ATUALIZAR ----------
  async update(id: string, dto: UpdatePacienteTeaDto) {
    const atual = await this.findOne(id);

    this.validarDatas(dto.dataNascimento, dto.responsavelLegal?.dataNascimento);
    if (dto.categoria !== undefined || dto.dataNascimento !== undefined) {
      this.validarCategoriaComIdade(
        dto.categoria ?? atual.categoria,
        dto.dataNascimento ?? comoData(atual.data_nascimento),
      );
    }
    if (dto.cpf) await this.garantirCpfDisponivel(apenasDigitos(dto.cpf), id);
    if (dto.responsavelTriagemId)
      await this.garantirTriagemValida(dto.responsavelTriagemId);

    const campos = this.normalizarPaciente(selecionar(dto, CAMPOS_PACIENTE));
    const categoriaFinal: CategoriaEtaria = dto.categoria ?? atual.categoria;
    const responsavel =
      dto.categoria !== undefined || dto.responsavelLegal !== undefined
        ? this.camposResponsavel(categoriaFinal, dto.responsavelLegal)
        : {};
    const familiares = {
      ...this.normalizarFamiliares(
        selecionar(dto.dadosFamiliares, CAMPOS_FAMILIARES),
      ),
      ...responsavel,
    };

    if (
      Object.keys(campos).length === 0 &&
      Object.keys(familiares).length === 0
    ) {
      return atual; // nada para atualizar
    }
    // Valida as regras "se X, então Y" no cadastro como ele ficará depois da atualização
    // (dados atuais + mudanças), e não apenas no que veio na requisição
    this.validarRegrasCondicionais({ ...camelizar(atual), ...campos });
    this.validarFilhos({ ...camelizar(atual.dados_familiares), ...familiares });

    await this.executarEmTransacao(async (client) => {
      if (Object.keys(campos).length > 0) {
        const upd = montarUpdate('pacientes_tea', campos, 'id', id);
        await client.query(upd.sql, upd.valores);
      }
      if (Object.keys(familiares).length > 0) {
        const upd = montarUpdate(
          'dados_familiares',
          familiares,
          'paciente_id',
          id,
        );
        await client.query(upd.sql, upd.valores);
      }
    });

    return this.findOne(id);
  }

  // ---------- REMOVER  ----------
  async remove(id: string) {
    await this.findOne(id);
    await this.pool.query(
      `UPDATE pacientes_tea SET ativo = false, updated_at = now() WHERE id = $1`,
      [id],
    );
    return { message: 'Cadastro removido com sucesso' };
  }

  // ---------- Regras de negócio e auxiliares ----------
  private validarDatas(...datas: (string | undefined)[]) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (datas.some((data) => data && data > hoje)) {
      throw new BadRequestException('Data de nascimento não pode ser futura');
    }
  }

  // A categoria informada precisa bater com a idade calculada a partir da data de nascimento
  private validarCategoriaComIdade(
    categoria?: CategoriaEtaria,
    dataNascimento?: string,
  ) {
    if (!categoria || !dataNascimento) return;

    const idade = calcularIdade(dataNascimento);
    const { min, max } = FAIXAS_ETARIAS[categoria];

    if (idade < min || idade > max) {
      throw new BadRequestException(
        `A categoria "${categoria}" não corresponde à idade informada (${idade} anos). ` +
          'Faixas: criança 0 a 11, adolescente 12 a 17, adulto 18 a 59, idoso 60 ou mais.',
      );
    }
  }

  // Se possui filhos, precisa informar quantos (meninas e/ou meninos)
  private validarFilhos(dados?: {
    possuiFilhos?: boolean;
    qtdMeninas?: number;
    qtdMeninos?: number;
  }) {
    if (
      dados?.possuiFilhos === true &&
      (dados.qtdMeninas ?? 0) + (dados.qtdMeninos ?? 0) <= 0
    ) {
      throw new BadRequestException(
        'Informe a quantidade de filhos (meninas e/ou meninos)',
      );
    }
  }

  // RN6: o vínculo precisa apontar para um profissional existente e ativo
  private async garantirTriagemValida(profissionalId: string) {
    const resultado = await this.pool.query(
      `SELECT id FROM profissionais WHERE id = $1 AND ativo = true`,
      [profissionalId],
    );
    if (resultado.rows.length === 0) {
      throw new BadRequestException(
        'Profissional responsável pela triagem não encontrado ou inativo',
      );
    }
  }

  // RN1: identificador único (CPF)
  private async garantirCpfDisponivel(cpf: string, ignorarId?: string) {
    const resultado = await this.pool.query(
      `SELECT id FROM pacientes_tea
       WHERE cpf = $1 AND ativo = true AND ($2::uuid IS NULL OR id != $2::uuid)`,
      [cpf, ignorarId ?? null],
    );
    if (resultado.rows.length > 0) {
      throw new ConflictException('Já existe um cadastro com este CPF');
    }
  }

  // Campos condicionais que deixam de valer são limpos, para não ficar dado "fantasma"
  private normalizarPaciente(campos: Campos): Campos {
    if (campos.cpf) campos.cpf = apenasDigitos(campos.cpf);
    if (campos.frequentaEscola === false) campos.nomeInstituicao = null;
    if (campos.parecerEspecialista === false) campos.parecerQuais = null;
    if (campos.realizaTerapias === false) {
      campos.terapias = null;
      campos.terapiaOutros = null;
    } else if (
      Array.isArray(campos.terapias) &&
      !campos.terapias.includes(Terapia.OUTROS)
    ) {
      campos.terapiaOutros = null;
    }
    return campos;
  }

  private normalizarFamiliares(campos: Campos): Campos {
    if (campos.possuiFilhos === false) {
      campos.qtdMeninas = null;
      campos.qtdMeninos = null;
    } else if (campos.possuiFilhos === true) {
      campos.qtdMeninas ??= 0;
      campos.qtdMeninos ??= 0;
    }
    return campos;
  }

  // Regras "se X, então Y" aplicadas ao cadastro inteiro (usadas na atualização)
  private validarRegrasCondicionais(cadastro: Campos) {
    if (
      cadastro.frequentaEscola === true &&
      !cadastro.nomeInstituicao?.trim()
    ) {
      throw new BadRequestException(
        'Informe o nome da instituição quando a pessoa frequenta escola',
      );
    }
    if (
      cadastro.parecerEspecialista === true &&
      !cadastro.parecerQuais?.trim()
    ) {
      throw new BadRequestException(
        'Informe quais pareceres de especialista foram emitidos',
      );
    }
    const terapias = paraLista(cadastro.terapias);
    if (cadastro.realizaTerapias === true && terapias.length === 0) {
      throw new BadRequestException(
        'Informe ao menos uma terapia quando realiza terapias',
      );
    }
    if (terapias.includes(Terapia.OUTROS) && !cadastro.terapiaOutros?.trim()) {
      throw new BadRequestException('Descreva a terapia "outros"');
    }
  }

  // Responsável legal só existe para criança/adolescente; para adulto/idoso os campos ficam nulos
  private camposResponsavel(
    categoria: CategoriaEtaria,
    responsavel?: ResponsavelLegalDto,
  ): Campos {
    if (!CATEGORIAS_COM_RESPONSAVEL.includes(categoria)) {
      return {
        responsavelNome: null,
        responsavelRg: null,
        responsavelCpf: null,
        responsavelDataNascimento: null,
      };
    }
    if (!responsavel) return {};
    return {
      responsavelNome: responsavel.nome,
      responsavelRg: responsavel.rg,
      responsavelCpf: apenasDigitos(responsavel.cpf),
      responsavelDataNascimento: responsavel.dataNascimento,
    };
  }

  private async executarEmTransacao<T>(
    operacao: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await operacao(client);
      await client.query('COMMIT');
      return resultado;
    } catch (erro: any) {
      await client.query('ROLLBACK');
      // 23505 = violação de unicidade no banco (ex.: dois cadastros com o mesmo CPF ao mesmo tempo)
      if (erro?.code === '23505') {
        throw new ConflictException('Já existe um cadastro com este CPF');
      }
      throw erro;
    } finally {
      client.release();
    }
  }
}
