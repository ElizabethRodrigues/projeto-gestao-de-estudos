const Curso = require('./models/Curso');
const Disciplina = require('./models/Disciplina');
const Planejamento = require('./models/Planejamento');
const Meta = require('./models/Meta');
const { gerarMetas, calcularDataFim } = require('./services/planejamentoService');
const d = require('./utils/dates');

/**
 * Dados de teste carregados a cada inicialização (o banco é em memória).
 * As datas são relativas ao dia em que o servidor é iniciado.
 *
 * Os dois planejamentos de teste ficam inteiramente no passado: as metas são
 * geradas a partir do planejamento e nenhuma meta é criada para hoje ou para o futuro.
 */
async function seed() {
  const hoje = d.today();

  const curso = await Curso.create({
    nome: 'Desenvolvimento Web',
    descricao: 'Fundamentos para construir sites e aplicações para a Web.',
    dataInicio: d.addDays(hoje, -30),
    dataFim: d.addDays(hoje, 90),
    validade: d.addDays(hoje, 365),
  });

  const [introducao, logica] = await Disciplina.insertMany([
    {
      nome: 'Introdução ao Desenvolvimento Web',
      descricao: 'Como a Web funciona: navegadores, servidores, HTTP e o papel do front-end e do back-end.',
      curso: curso._id,
    },
    {
      nome: 'Lógica de Programação',
      descricao: 'Algoritmos, variáveis, condicionais, laços e funções.',
      curso: curso._id,
    },
    {
      nome: 'HTML5 e Semântica Web',
      descricao: 'Estrutura de páginas com HTML5, tags semânticas e acessibilidade.',
      curso: curso._id,
    },
  ]);

  // 1) Planejamento CONCLUÍDO: semanal, 1h/dia de segunda a sexta, há 3 semanas; todas as metas cumpridas
  await criarComHistorico(
    {
      curso: curso._id,
      disciplina: introducao._id,
      periodicidade: 'semanal',
      horasPorDia: 1,
      diasSemana: [1, 2, 3, 4, 5],
      duracao: 1,
      dataInicio: d.addDays(hoje, -21),
      observacao: 'Dados de teste: planejamento concluído (todas as metas cumpridas).',
    },
    () => 1
  );

  // 2) Planejamento ATRASADO: semanal, 1,5h/dia de segunda a sexta, nos últimos 7 dias (até ontem)
  const historicoAtrasado = [1, 1, 0.5, 0, 0]; // 2 concluídas, 1 parcial e 2 não informadas
  await criarComHistorico(
    {
      curso: curso._id,
      disciplina: logica._id,
      periodicidade: 'semanal',
      horasPorDia: 1.5,
      diasSemana: [1, 2, 3, 4, 5],
      duracao: 1,
      dataInicio: d.addDays(hoje, -7),
      observacao: 'Dados de teste: planejamento atrasado (metas pendentes em dias anteriores).',
    },
    (_, i) => historicoAtrasado[i] ?? 0
  );

  console.log('[seed] 1 curso, 3 disciplinas e 2 planejamentos de teste (1 concluído e 1 atrasado) criados');
}

/** Cria o planejamento, gera suas metas e aplica o percentual estudado de cada dia. */
async function criarComHistorico(dados, fracaoEstudada) {
  const plano = await Planejamento.create({
    ...dados,
    dataFim: calcularDataFim(dados.periodicidade, dados.dataInicio, dados.duracao),
  });
  const metas = gerarMetas(plano).map((meta, i) => {
    const segundos = Math.round(meta.segundosPlanejados * fracaoEstudada(meta.data, i));
    const concluida = segundos >= meta.segundosPlanejados;
    return {
      ...meta,
      segundosEstudados: segundos,
      concluida,
      concluidaEm: concluida ? d.parseDateKey(meta.data) : null,
    };
  });
  await Meta.insertMany(metas);
  return plano;
}

module.exports = seed;
