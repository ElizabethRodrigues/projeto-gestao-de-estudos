const Curso = require('./models/Curso');
const Disciplina = require('./models/Disciplina');
const Planejamento = require('./models/Planejamento');
const Meta = require('./models/Meta');
const { gerarMetas } = require('./services/planejamentoService');
const d = require('./utils/dates');

/**
 * Dados de teste carregados a cada inicialização (o banco é em memória).
 * As datas são relativas ao dia em que o servidor é iniciado.
 */
async function seed() {
  const hoje = d.today();

  const curso = await Curso.create({
    nome: 'Desenvolvimento Web Full Stack',
    descricao: 'Formação completa em desenvolvimento web com JavaScript, Node.js e MongoDB.',
    dataInicio: d.addDays(hoje, -10),
    dataFim: d.addDays(hoje, 80),
    validade: d.addDays(hoje, 365),
  });

  const [js, node, mongo] = await Disciplina.insertMany([
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

  // Planejamento diário de JavaScript iniciado há 5 dias, com histórico de estudo
  const planoJs = await Planejamento.create({
    curso: curso._id,
    disciplina: js._id,
    periodicidade: 'diario',
    horasPorPeriodo: 1,
    dataInicio: d.addDays(hoje, -5),
    dataFim: d.addDays(hoje, 24),
    observacao: 'Dados de teste: possui metas concluídas e pendências em dias anteriores.',
  });
  const metasJs = gerarMetas(planoJs);
  const historico = {
    [d.addDays(hoje, -5)]: 3600, // concluída
    [d.addDays(hoje, -4)]: 3600, // concluída
    [d.addDays(hoje, -3)]: 1800, // parcial (pendente)
    [d.addDays(hoje, -2)]: 0, // não informada (pendente)
    [d.addDays(hoje, -1)]: 3600, // concluída
  };
  for (const meta of metasJs) {
    const seg = historico[meta.data];
    if (seg) {
      meta.segundosEstudados = seg;
      if (seg >= meta.segundosPlanejados) {
        meta.concluida = true;
        meta.concluidaEm = d.parseDateKey(meta.data);
      }
    }
  }
  await Meta.insertMany(metasJs);

  // Planejamento semanal de Node.js: 6h por semana (seg, qua e sex com 2h cada)
  const planoNode = await Planejamento.create({
    curso: curso._id,
    disciplina: node._id,
    periodicidade: 'semanal',
    horasPorPeriodo: 6,
    distribuicao: [
      { dia: 1, horas: 2 },
      { dia: 3, horas: 2 },
      { dia: 5, horas: 2 },
    ],
    dataInicio: hoje,
    dataFim: d.addDays(hoje, 27),
  });
  await Meta.insertMany(gerarMetas(planoNode));

  // Planejamento diário curto (3 minutos/dia) para demonstrar o encerramento automático
  const planoMongo = await Planejamento.create({
    curso: curso._id,
    disciplina: mongo._id,
    periodicidade: 'diario',
    horasPorPeriodo: 0.05,
    dataInicio: hoje,
    dataFim: d.addDays(hoje, 6),
    observacao: 'Dados de teste: 3 minutos por dia para demonstrar o encerramento automático do registro.',
  });
  await Meta.insertMany(gerarMetas(planoMongo));

  console.log(`[seed] 1 curso, 3 disciplinas e 3 planejamentos de teste criados`);
}

module.exports = seed;
