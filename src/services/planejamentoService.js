const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Planejamento = require('../models/Planejamento');
const Meta = require('../models/Meta');
const Registro = require('../models/Registro');
const d = require('../utils/dates');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/errors');

const DIAS_UTEIS = [1, 2, 3, 4, 5];
const MAX_DURACAO = { semanal: 52, mensal: 12 };
const round2 = (n) => Math.round(n * 100) / 100;

function assertObjectId(id, campo) {
  if (!mongoose.isValidObjectId(id)) throw badRequest(`${campo} inválido`);
}

/** Semanal: N semanas a partir do início. Mensal: N meses a partir do início. */
function calcularDataFim(periodicidade, dataInicio, duracao) {
  if (periodicidade === 'semanal') return d.addDays(dataInicio, 7 * duracao - 1);
  return d.addDays(d.addMonths(dataInicio, duracao), -1);
}

/**
 * Valida o corpo de criação/replanejamento e devolve os dados normalizados.
 * Regra 3: o usuário informa quantas horas por dia vai dedicar, se o planejamento
 * é semanal ou mensal e (opcionalmente) os dias da semana de estudo e a duração.
 */
async function normalizarEntrada(body, base = {}) {
  const dados = { ...base, ...body };
  const erros = [];

  if (!dados.curso && !dados.disciplina) erros.push('Informe curso ou disciplina');

  let disciplina = null;
  let curso = null;
  if (dados.disciplina) {
    assertObjectId(dados.disciplina, 'disciplina');
    disciplina = await Disciplina.findById(dados.disciplina);
    if (!disciplina) throw notFound('Disciplina não encontrada');
    curso = await Curso.findById(disciplina.curso);
  } else if (dados.curso) {
    assertObjectId(dados.curso, 'curso');
    curso = await Curso.findById(dados.curso);
  }
  if (!curso && erros.length === 0) throw notFound('Curso não encontrado');

  if (!['semanal', 'mensal'].includes(dados.periodicidade)) {
    erros.push("periodicidade deve ser 'semanal' ou 'mensal'");
  }

  const horasPorDia = Number(dados.horasPorDia);
  if (!Number.isFinite(horasPorDia) || horasPorDia <= 0 || horasPorDia > 24) {
    erros.push('horasPorDia deve ser um número maior que zero e no máximo 24');
  }

  const duracao = dados.duracao === undefined || dados.duracao === null || dados.duracao === '' ? 1 : Number(dados.duracao);
  const maxDuracao = MAX_DURACAO[dados.periodicidade] || 52;
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > maxDuracao) {
    erros.push(`duracao deve ser um número inteiro entre 1 e ${maxDuracao} (${dados.periodicidade === 'mensal' ? 'meses' : 'semanas'})`);
  }

  let diasSemana = dados.diasSemana;
  if (diasSemana === undefined || diasSemana === null || (Array.isArray(diasSemana) && diasSemana.length === 0)) {
    diasSemana = DIAS_UTEIS;
  }
  if (!Array.isArray(diasSemana) || diasSemana.some((x) => !Number.isInteger(Number(x)) || Number(x) < 0 || Number(x) > 6)) {
    erros.push('diasSemana deve ser uma lista de números de 0 (domingo) a 6 (sábado)');
    diasSemana = [];
  }
  diasSemana = [...new Set(diasSemana.map(Number))].sort((a, b) => a - b);

  const dataInicio = dados.dataInicio || d.today();
  if (!d.parseDateKey(dataInicio)) erros.push('dataInicio deve estar no formato YYYY-MM-DD');
  if (erros.length) throw badRequest('Dados inválidos', erros);

  const dataFim = calcularDataFim(dados.periodicidade, dataInicio, duracao);

  // Regras de período/validade do curso (regra 2)
  if (curso.validade && curso.validade < d.today()) erros.push(`O curso expirou em ${curso.validade}`);
  if (curso.validade && dataFim > curso.validade) erros.push(`O planejamento terminaria em ${dataFim}, depois da validade do curso (${curso.validade})`);
  if (curso.dataInicio && dataInicio < curso.dataInicio) erros.push(`O planejamento não pode começar antes do início do curso (${curso.dataInicio})`);
  if (curso.dataFim && dataFim > curso.dataFim) erros.push(`O planejamento terminaria em ${dataFim}, depois do fim do curso (${curso.dataFim})`);
  if (erros.length) throw unprocessable('Planejamento inválido', erros);

  return {
    curso: curso._id,
    disciplina: disciplina ? disciplina._id : null,
    periodicidade: dados.periodicidade,
    horasPorDia,
    diasSemana,
    duracao,
    dataInicio,
    dataFim,
    observacao: dados.observacao || '',
  };
}

/** Gera uma meta para cada dia de estudo (dias da semana escolhidos) do intervalo do planejamento. */
function gerarMetas(plano) {
  const segundos = Math.round(plano.horasPorDia * 3600);
  return d
    .eachDay(plano.dataInicio, plano.dataFim)
    .filter((data) => plano.diasSemana.includes(d.dayOfWeek(data)))
    .map((data) => ({ planejamento: plano._id, data, segundosPlanejados: segundos }));
}

async function criar(body) {
  const dados = await normalizarEntrada(body);
  // Só bloqueia se houver um planejamento ativo ainda NÃO concluído para o mesmo alvo
  const ativos = await Planejamento.find({ curso: dados.curso, disciplina: dados.disciplina, status: 'ativo' });
  const conclusao = await situacaoConclusao(ativos.map((p) => p._id));
  const existente = ativos.find((p) => !conclusao.get(String(p._id)));
  if (existente) {
    throw conflict(
      `Já existe um planejamento em andamento (não concluído) para ${dados.disciplina ? 'esta disciplina' : 'este curso'} (${existente._id}). Use "Refazer planejamento" (POST /api/planejamentos/${existente._id}/replanejar) para alterá-lo.`
    );
  }
  const plano = await Planejamento.create(dados);
  const metas = gerarMetas(plano);
  if (metas.length === 0) {
    await plano.deleteOne();
    throw unprocessable('O planejamento não gerou nenhuma meta no período informado. Revise os dias de estudo.');
  }
  await Meta.insertMany(metas);
  return plano;
}

/**
 * Regra 8: refazer um planejamento.
 * O planejamento atual é marcado como "substituido"; o histórico (metas passadas e
 * registros) é mantido e as metas de hoje em diante sem estudo são removidas.
 * Um novo planejamento é criado com os novos parâmetros (o que não for enviado
 * é herdado do anterior; dataInicio padrão = hoje).
 */
async function replanejar(id, body) {
  assertObjectId(id, 'id');
  const antigo = await Planejamento.findById(id);
  if (!antigo) throw notFound('Planejamento não encontrado');
  if (antigo.status !== 'ativo') throw conflict('Somente planejamentos ativos podem ser refeitos');
  if ((await situacaoConclusao([antigo._id])).get(String(antigo._id))) {
    throw unprocessable('Este planejamento já foi concluído (todas as metas cumpridas) e não pode ser refeito. Crie um novo planejamento, se quiser.');
  }

  const base = {
    curso: String(antigo.curso),
    disciplina: antigo.disciplina ? String(antigo.disciplina) : null,
    periodicidade: antigo.periodicidade,
    horasPorDia: antigo.horasPorDia,
    diasSemana: [...antigo.diasSemana],
    duracao: antigo.duracao,
    dataInicio: d.today(),
  };
  const { curso, disciplina, ...permitido } = body; // o alvo não muda no replanejamento
  const dados = await normalizarEntrada(permitido, base);

  // Encerra sessão em andamento do planejamento antigo
  const registroService = require('./registroService');
  const ativo = await Registro.findOne({ planejamento: antigo._id, status: 'em_andamento' });
  if (ativo) await registroService.finalizar(ativo._id);

  const novo = await Planejamento.create({ ...dados, substitui: antigo._id });
  const metas = gerarMetas(novo);
  if (metas.length === 0) {
    await novo.deleteOne();
    throw unprocessable('O novo planejamento não gerou nenhuma meta no período informado.');
  }

  await Meta.deleteMany({
    planejamento: antigo._id,
    data: { $gte: dados.dataInicio },
    concluida: false,
    segundosEstudados: 0,
  });
  antigo.status = 'substituido';
  antigo.substituidoPor = novo._id;
  await antigo.save();
  await Meta.insertMany(metas);
  return { anterior: antigo, novo };
}

/**
 * Um planejamento está concluído quando tem metas e todas foram cumpridas.
 * Retorna um Map id -> true/false para os planejamentos informados.
 */
async function situacaoConclusao(ids) {
  const grupos = await Meta.aggregate([
    { $match: { planejamento: { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: '$planejamento', total: { $sum: 1 }, pendentes: { $sum: { $cond: ['$concluida', 0, 1] } } } },
  ]);
  const mapa = new Map(ids.map((id) => [String(id), false]));
  for (const g of grupos) mapa.set(String(g._id), g.total > 0 && g.pendentes === 0);
  return mapa;
}

/** Acrescenta `concluido` e `podeRefazer` (regra 8) ao JSON de cada planejamento. */
async function comConclusao(planos) {
  const mapa = await situacaoConclusao(planos.map((p) => p._id));
  return planos.map((p) => {
    const concluido = mapa.get(String(p._id)) || false;
    return { ...p.toJSON(), concluido, podeRefazer: p.status === 'ativo' && !concluido };
  });
}

/** Regra 5: acompanhamento do planejado x realizado. */
async function acompanhamento(id) {
  assertObjectId(id, 'id');
  const plano = await Planejamento.findById(id).populate('curso', 'nome').populate('disciplina', 'nome');
  if (!plano) throw notFound('Planejamento não encontrado');
  const registroService = require('./registroService');
  await registroService.finalizarExpirados();

  const metas = await Meta.find({ planejamento: plano._id }).sort({ data: 1 });
  const hoje = d.today();
  const ateHoje = metas.filter((m) => m.data <= hoje);
  const passadas = metas.filter((m) => m.data < hoje);
  const metaHoje = metas.find((m) => m.data === hoje) || null;

  const soma = (arr, campo) => arr.reduce((acc, m) => acc + m[campo], 0);
  const segPlanejadosTotal = soma(metas, 'segundosPlanejados');
  const segEstudadosTotal = soma(metas, 'segundosEstudados');
  const segPlanejadosPassado = soma(passadas, 'segundosPlanejados');
  const segEstudadosPassado = soma(passadas, 'segundosEstudados');
  const pendencias = passadas.filter((m) => !m.concluida);
  const h = (s) => round2(s / 3600);

  let situacao = 'em_dia';
  if (metas.length > 0 && metas.every((m) => m.concluida)) situacao = 'concluido';
  else if (pendencias.length > 0) situacao = 'com_pendencias';
  else if (segEstudadosTotal > segPlanejadosPassado + (metaHoje ? metaHoje.segundosPlanejados : 0)) situacao = 'adiantado';

  const concluido = metas.length > 0 && metas.every((m) => m.concluida);
  return {
    planejamento: { ...plano.toJSON(), concluido, podeRefazer: plano.status === 'ativo' && !concluido },
    resumo: {
      situacao,
      horasPlanejadasTotal: h(segPlanejadosTotal),
      horasEstudadasTotal: h(segEstudadosTotal),
      percentualConcluido: segPlanejadosTotal ? round2((segEstudadosTotal / segPlanejadosTotal) * 100) : 0,
      horasPlanejadasAteOntem: h(segPlanejadosPassado),
      horasEstudadasAteOntem: h(segEstudadosPassado),
      horasPendentes: h(Math.max(0, segPlanejadosPassado - segEstudadosPassado)),
      totalMetas: metas.length,
      metasConcluidas: metas.filter((m) => m.concluida).length,
      metasAtrasadas: pendencias.length,
      metasFuturas: metas.filter((m) => m.data > hoje).length,
      diasDecorridos: ateHoje.length,
    },
    hoje: metaHoje,
    pendencias,
  };
}

module.exports = { criar, replanejar, acompanhamento, gerarMetas, calcularDataFim, assertObjectId, comConclusao };
