import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreatePacienteTeaDto } from '../dto/create-paciente-tea.dto';

describe('CreatePacienteTeaDto', () => {
  const dtoValido = {
    categoria: 'crianca',
    nomeCompleto: 'Paciente Teste',
    dataNascimento: '2018-05-10',
    rgOuCertidao: '1234567',
    cpf: '11144477735',
    genero: 'masculino',
    frequentaEscola: false,
    aguardaDiagnostico: false,
    parecerEspecialista: false,
    laudoMedico: true,
    nivelSuporte: 2,
    realizaTerapias: false,
    ciptea: false,
    bpc: false,
    responsavelTriagemId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    responsavelLegal: {
      nome: 'Responsável Teste',
      rg: '7654321',
      cpf: '52998224725',
      dataNascimento: '1985-03-20',
    },
    dadosFamiliares: {
      estadoCivil: 'casado',
      endereco: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'Araripina',
      estado: 'PE',
      contato: '87999999999',
      possuiFilhos: false,
      numPessoasCasa: 4,
    },
  };

  const validar = (dados: object) => validate(plainToInstance(CreatePacienteTeaDto, dados));
  const temErro = (erros: ValidationError[], propriedade: string) =>
    erros.some((erro) => erro.property === propriedade);

  it('aceita um cadastro de criança completo', async () => {
    expect(await validar(dtoValido)).toHaveLength(0);
  });

  it('aceita adulto sem responsável legal', async () => {
    const erros = await validar({ ...dtoValido, categoria: 'adulto', responsavelLegal: undefined });
    expect(erros).toHaveLength(0);
  });

  it.each([
    ['categoria inválida', { categoria: 'jovem' }, 'categoria'],
    ['CPF inválido', { cpf: '12345678900' }, 'cpf'],
    ['gênero inválido', { genero: 'x' }, 'genero'],
    ['data de nascimento em formato errado', { dataNascimento: '10/05/2018' }, 'dataNascimento'],
    ['data de nascimento inexistente', { dataNascimento: '2018-02-30' }, 'dataNascimento'],
    ['nível de suporte 4', { nivelSuporte: 4 }, 'nivelSuporte'],
    ['nível de suporte 0', { nivelSuporte: 0 }, 'nivelSuporte'],
    ['cartão do SUS com 14 dígitos', { numeroCartaoSus: '12345678901234' }, 'numeroCartaoSus'],
    ['nome vazio', { nomeCompleto: '' }, 'nomeCompleto'],
    ['frequentaEscola que não é booleano', { frequentaEscola: 'sim' }, 'frequentaEscola'],
    ['id de triagem que não é UUID', { responsavelTriagemId: '123' }, 'responsavelTriagemId'],
  ])('rejeita %s', async (_descricao, alteracao, propriedade) => {
    const erros = await validar({ ...dtoValido, ...alteracao });
    expect(temErro(erros, propriedade)).toBe(true);
  });

  describe('campos condicionais', () => {
    it('exige nomeInstituicao quando frequentaEscola é true', async () => {
      const erros = await validar({ ...dtoValido, frequentaEscola: true });
      expect(temErro(erros, 'nomeInstituicao')).toBe(true);
    });

    it('exige parecerQuais quando parecerEspecialista é true', async () => {
      const erros = await validar({ ...dtoValido, parecerEspecialista: true });
      expect(temErro(erros, 'parecerQuais')).toBe(true);
    });

    it('exige ao menos uma terapia quando realizaTerapias é true', async () => {
      const erros = await validar({ ...dtoValido, realizaTerapias: true, terapias: [] });
      expect(temErro(erros, 'terapias')).toBe(true);
    });

    it('rejeita terapia fora da lista', async () => {
      const erros = await validar({ ...dtoValido, realizaTerapias: true, terapias: ['reiki'] });
      expect(temErro(erros, 'terapias')).toBe(true);
    });

    it('exige terapiaOutros quando a terapia "outros" é marcada', async () => {
      const erros = await validar({ ...dtoValido, realizaTerapias: true, terapias: ['outros'] });
      expect(temErro(erros, 'terapiaOutros')).toBe(true);
    });

    it('aceita terapias válidas sem "outros"', async () => {
      const erros = await validar({
        ...dtoValido,
        realizaTerapias: true,
        terapias: ['fisioterapia', 'terapia_ocupacional'],
      });
      expect(erros).toHaveLength(0);
    });
  });

  describe('responsável legal e dados familiares', () => {
    it('exige responsável legal para criança', async () => {
      const erros = await validar({ ...dtoValido, responsavelLegal: undefined });
      expect(temErro(erros, 'responsavelLegal')).toBe(true);
    });

    it('exige responsável legal para adolescente', async () => {
      const erros = await validar({ ...dtoValido, categoria: 'adolescente', responsavelLegal: undefined });
      expect(temErro(erros, 'responsavelLegal')).toBe(true);
    });

    it('rejeita responsável legal com CPF inválido', async () => {
      const erros = await validar({
        ...dtoValido,
        responsavelLegal: { ...dtoValido.responsavelLegal, cpf: '00000000000' },
      });
      expect(temErro(erros, 'responsavelLegal')).toBe(true);
    });

    it('exige dadosFamiliares', async () => {
      const erros = await validar({ ...dtoValido, dadosFamiliares: undefined });
      expect(temErro(erros, 'dadosFamiliares')).toBe(true);
    });

    it('rejeita UF que não seja a sigla de 2 letras maiúsculas', async () => {
      const erros = await validar({
        ...dtoValido,
        dadosFamiliares: { ...dtoValido.dadosFamiliares, estado: 'Pernambuco' },
      });
      expect(temErro(erros, 'dadosFamiliares')).toBe(true);
    });

    it('rejeita e-mail mal formatado nos dados familiares', async () => {
      const erros = await validar({
        ...dtoValido,
        dadosFamiliares: { ...dtoValido.dadosFamiliares, email: 'nao-e-email' },
      });
      expect(temErro(erros, 'dadosFamiliares')).toBe(true);
    });
  });
});