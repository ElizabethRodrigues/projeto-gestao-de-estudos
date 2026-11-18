const Curso = require('./models/Curso');
const Disciplina = require('./models/Disciplina');
const Planejamento = require('./models/Planejamento');
const Meta = require('./models/Meta');
const { gerarMetas } = require('./services/planejamentoService');
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
    nome: 'Desenvolvimento Web Full Stack',
    descricao: 'Formação completa em desenvolvimento web com JavaScript, Node.js e MongoDB.',
    dataInicio: d.addDays(hoje, -30),
    dataFim: d.addDays(hoje, 90),
    validade: d.addDays(hoje, 365),
  });

  const [js, node] = await Disciplina.insertMany([
    {
      nome: 'Lógica de Programação com JavaScript',
      descricao: 'Variáveis, estruturas de controle, funções, arrays e objetos.',
      cargaHoraria: 40,
      curso: curso._id,
    },
    {
      nome: 'Desenvolvimento de APIs com Node.js',
      descricao: 'Express, rotas, middlewares, REST e documentação com Swagger.',
      cargaHoraria: 60,
      curso: curso._id,
    },
    {
      nome: 'Banco de Dados NoSQL com MongoDB',
      descricao: 'Modelagem de documentos, consultas, índices e Mongoose.',
      cargaHoraria: 30,
      curso: curso._id,
    },
  ]);

  // 1) Planejamento CONCLUÍDO: diário, 1h/dia, de hoje-20 a hoje-14, todas as metas cumpridas
  await criarComHistorico(
    {
      curso: curso._id,
      disciplina: js._id,
      periodicidade: 'diario',
      horasPorPeriodo: 1,
      dataInicio: d.addDays(hoje, -20),
      dataFim: d.addDays(hoje, -14),
      observacao: 'Dados de teste: planejamento concluído (todas as metas cumpridas).',
    },
    () => 1 // 100% das horas planejadas em todos os dias
  );

  // 2) Planejamento ATRASADO: diário, 1h/dia, de hoje-6 a ontem, com metas não cumpridas
  const historicoAtrasado = {
    [d.addDays(hoje, -6)]: 1, // concluída
    [d.addDays(hoje, -5)]: 1, // concluída
    [d.addDays(hoje, -4)]: 0.5, // parcial (pendente)
    [d.addDays(hoje, -3)]: 0, // não informada (pendente)
    [d.addDays(hoje, -2)]: 1, // concluída
    [d.addDays(hoje, -1)]: 0, // não informada (pendente)
  };
  await criarComHistorico(
    {
      curso: curso._id,
      disciplina: node._id,
      periodicidade: 'diario',
      horasPorPeriodo: 1,
      dataInicio: d.addDays(hoje, -6),
      dataFim: d.addDays(hoje, -1),
      observacao: 'Dados de teste: planejamento atrasado (metas pendentes em dias anteriores).',
    },
    (data) => historicoAtrasado[data] || 0
  );

  console.log('[seed] 1 curso, 3 disciplinas e 2 planejamentos de teste (1 concluído e 1 atrasado) criados');
}

/** Cria o planejamento, gera suas metas e aplica o percentual estudado de cada dia. */
async function criarComHistorico(dados, fracaoEstudada) {
  const plano = await Planejamento.create(dados);
  const metas = gerarMetas(plano).map((meta) => {
    const segundos = Math.round(meta.segundosPlanejados * fracaoEstudada(meta.data));
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
