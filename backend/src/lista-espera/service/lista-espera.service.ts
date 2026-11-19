import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdicionarListaEsperaDto } from '../dto/adicionar-lista-espera.dto';
import { MotivoSaida, PacienteRef } from '../enum/lista-espera.enum';
import {
  ExecutorSql,
  FiltrosFila,
  ListaEsperaRepository,
} from '../lista-espera.repository';

const MENSAGEM_JA_NA_LISTA = 'O paciente já está na lista de espera';

@Injectable()
export class ListaEsperaService {
  constructor(private readonly repository: ListaEsperaRepository) {}

  // RN28: todo paciente recém-cadastrado entra automaticamente na lista.
  // Recebe o client da transação do cadastro, quando houver, para gravar junto.
  registrarNoCadastro(paciente: PacienteRef, executor?: ExecutorSql) {
    return this.repository.registrar(paciente, executor);
  }

  // RN30: consulta da fila, já ordenada e com a posição de cada paciente
  consultar(filtros?: FiltrosFila) {
    return this.repository.listarFila(filtros);
  }

  // RN29: depois de sair, o paciente só volta à lista se for incluído manualmente.
  // Ele entra no fim da fila (RN34: a ordem é a de chegada).
  async adicionarManualmente(dto: AdicionarListaEsperaDto) {
    const paciente: PacienteRef = {
      tipo: dto.tipoPaciente,
      id: dto.pacienteId,
    };

    if (!(await this.repository.pacienteAtivoExiste(paciente))) {
      throw new NotFoundException('Paciente não encontrado');
    }
    // RN31: um paciente não pode ter dois registros ativos na lista
    if (await this.repository.existeRegistroAtivo(paciente)) {
      throw new ConflictException(MENSAGEM_JA_NA_LISTA);
    }

    try {
      return await this.repository.registrar(paciente);
    } catch (erro: any) {
      // 23505 = o índice único do banco barrou duas inclusões simultâneas
      if (erro?.code === '23505') {
        throw new ConflictException(MENSAGEM_JA_NA_LISTA);
      }
      throw erro;
    }
  }

  // RN33: retirada manual por um profissional logado, com justificativa
  async retirarManualmente(
    id: string,
    justificativa: string,
    profissionalId: string,
  ) {
    const texto = justificativa?.trim();
    if (!texto) {
      throw new BadRequestException('Informe a justificativa da retirada');
    }

    const registro = await this.repository.encerrar(id, MotivoSaida.MANUAL, {
      justificativa: texto,
      retiradoPor: profissionalId,
    });
    if (!registro) {
      throw new NotFoundException(
        'Registro ativo na lista de espera não encontrado',
      );
    }
    return registro;
  }

  // RN29: ao agendar um atendimento, o paciente sai da lista.
  // Não dá erro se ele não estiver na lista (ex.: já tinha outro agendamento).
  retirarPorAgendamento(paciente: PacienteRef, executor?: ExecutorSql) {
    return this.repository.encerrarPorPaciente(
      paciente,
      MotivoSaida.AGENDAMENTO,
      executor,
    );
  }
}
