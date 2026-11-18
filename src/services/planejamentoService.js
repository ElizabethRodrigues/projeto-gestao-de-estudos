const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Planejamento = require('../models/Planejamento');
const Meta = require('../models/Meta');
const Registro = require('../models/Registro');
const d = require('../utils/dates');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/errors');

const MAX_DIAS = 366;
const DIAS_UTEIS = [1, 2, 3, 4, 5];
const round2 = (n) => Math.round(n * 100) / 100;

function assertObjectId(id, campo) {
  if (!mongoose.isValidObjectId(id)) throw badRequest(`${campo} inválido`);
}

function dataFimPadrao(periodicidade, dataInicio) {
  if (periodicidade === 'diario') return d.addDays(dataInicio, 29);
  if (periodicidade === 'semanal') return d.addDays(dataInicio, 27);
  return d.addDays(d.addMonths(dataInicio, 3), -1);
}

/**
 * Valida o corpo de criação/replanejamento e devolve os dados normalizados.
 * Regra 3: horas por período + periodicidade + distribuição das horas por dia.
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

  if (!['diario', 'semanal', 'mensal'].includes(dados.periodicidade)) {
    erros.push("periodicidade deve ser 'diario', 'semanal' ou 'mensal'");
  }
  const horas = Number(dados.horasPorPeriodo);
  if (!Number.isFinite(horas) || horas <= 0) erros.push('horasPorPeriodo deve ser um número maior que zero');
  if (dados.periodicidade === 'diario' && horas > 24) erros.push('No planejamento diário, horasPorPeriodo não pode passar de 24');

  const dataInicio = dados.dataInicio || d.today();
  if (!d.parseDateKey(dataInicio)) erros.push('dataInicio deve estar no formato YYYY-MM-DD');
  if (dados.dataFim && !d.parseDateKey(dados.dataFim)) erros.push('dataFim deve estar no formato YYYY-MM-DD');
  if (erros.length) throw badRequest('Dados inválidos', erros);

  let dataFim = dados.dataFim || dataFimPadrao(dados.periodicidade, dataInicio);
  if (!dados.dataFim && curso.dataFim && curso.dataFim >= dataInicio && curso.dataFim < dataFim) {
    dataFim = curso.dataFim;
  }

  if (dataFim < dataInicio) erros.push('dataFim não pode ser anterior a dataInicio');
  if (d.daysBetween(dataInicio, dataFim) + 1 > MAX_DIAS) erros.push(`O planejamento pode ter no máximo ${MAX_DIAS} dias`);

  // Regras de período/validade do curso (regra 2)
  if (curso.validade && curso.validade < d.today()) erros.push(`O curso expirou em ${curso.validade}`);
  if (curso.validade && dataFim > curso.validade) erros.push(`O planejamento não pode terminar depois da validade do curso (${curso.validade})`);
  if (curso.dataInicio && dataInicio < curso.dataInicio) erros.push(`O planejamento não pode começar antes do início do curso (${curso.dataInicio})`);
  if (curso.dataFim && dataFim > curso.dataFim) erros.push(`O planejamento não pode terminar depois do fim do curso (${curso.dataFim})`);

  const distribuicao = normalizarDistribuicao(dados.periodicidade, horas, dados.distribuicao, erros);
  if (erros.length) throw unprocessable('Planejamento inválido', erros);

  return {
    curso: curso._id,
    disciplina: disciplina ? disciplina._id : null,
    periodicidade: dados.periodicidade,
    horasPorPeriodo: horas,
    distribuicao,
    dataInicio,
    dataFim,
    observacao: dados.observacao || '',
  };
}

function normalizarDistribuicao(periodicidade, horas, distribuicao, erros) {
  if (periodicidade === 'diario') return [];
  const [min, max, nome] = periodicidade === 'semanal' ? [0, 6, 'dia da semana (0-6)'] : [1, 31, 'dia do mês (1-31)'];

  if (distribuicao == null || (Array.isArray(distribuicao) && distribuicao.length === 0)) {
    // Sem distribuição: semanal divide igualmente de segunda a sexta;
    // mensal divide igualmente entre os dias úteis de cada mês (calculado na geração).
    if (periodicidade === 'semanal') {
      return DIAS_UTEIS.map((dia) => ({ dia, horas: round2(horas / DIAS_UTEIS.length) }));
    }
    return [];
  }

  if (!Array.isArray(distribuicao)) {
    erros.push('distribuicao deve ser uma lista de { dia, horas }');
    return [];
  }

  const vistos = new Set();
  const lista = [];
  for (const item of distribuicao) {
    const dia = Number(item && item.dia);
    const h = Number(item && item.horas);
    if (!Number.isInteger(dia) || dia < min || dia > max) {
      erros.push(`distribuicao.dia inválido (${item && item.dia}); esperado ${nome}`);
      continue;
    }
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      erros.push(`distribuicao.horas inválido para o dia ${dia}; esperado entre 0 e 24`);
      continue;
    }
    if (vistos.has(dia)) {
      erros.push(`distribuicao.dia ${dia} repetido`);
      continue;
    }
    vistos.add(dia);
    if (h > 0) lista.push({ dia, horas: h });
  }
  const soma = round2(lista.reduce((acc, i) => acc + i.horas, 0));
  if (Math.abs(soma - horas) > 0.01) {
    erros.push(`A soma da distribuição (${soma}h) deve ser igual a horasPorPeriodo (${horas}h)`);
  }
  return lista.sort((a, b) => a.dia - b.dia);
}

/** Gera as metas diárias (dia + horas planejadas) do intervalo do planejamento. */
function gerarMetas(plano, aPartirDe) {
  const inicio = aPartirDe && aPartirDe > plano.dataInicio ? aPartirDe : plano.dataInicio;
  if (inicio > plano.dataFim) return [];
  const dias = d.eachDay(inicio, plano.dataFim);
  const porDia = new Map(plano.distribuicao.map((i) => [i.dia, i.horas]));
  const metas = [];

  for (const data of dias) {
    let horas = 0;
    if (plano.periodicidade === 'diario') {
      horas = plano.horasPorPeriodo;
    } else if (plano.periodicidade === 'semanal') {
      horas = porDia.get(d.dayOfWeek(data)) || 0;
    } else if (porDia.size > 0) {
      // mensal com distribuição: dias inexistentes no mês (ex. 31/02) vão para o último dia do mês
      const diaMes = d.dayOfMonth(data);
      const ultimoDia = new Date(d.parseDateKey(data).getFullYear(), d.parseDateKey(data).getMonth() + 1, 0).getDate();
      horas = porDia.get(diaMes) || 0;
      if (diaMes === ultimoDia) {
        for (const [dia, h] of porDia) if (dia > ultimoDia) horas += h;
      }
    } else {
      // mensal sem distribuição: divide igualmente entre os dias úteis do mês
      const dow = d.dayOfWeek(data);
      if (DIAS_UTEIS.includes(dow)) {
        const ref = d.parseDateKey(data);
        const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
        let uteis = 0;
        for (let i = 1; i <= ultimoDia; i++) {
          if (DIAS_UTEIS.includes(new Date(ref.getFullYear(), ref.getMonth(), i).getDay())) uteis++;
        }
        horas = plano.horasPorPeriodo / uteis;
      }
    }
    const segundos = Math.round(horas * 3600);
    if (segundos > 0) metas.push({ planejamento: plano._id, data, segundosPlanejados: segundos });
  }
  return metas;
}

async function criar(body) {
  const dados = await normalizarEntrada(body);
  const existente = await Planejamento.findOne({
    curso: dados.curso,
    disciplina: dados.disciplina,
    status: 'ativo',
  });
  if (existente) {
    throw conflict(
      `Já existe um planejamento ativo para este ${dados.disciplina ? 'disciplina' : 'curso'} (${existente._id}). Use POST /api/planejamentos/${existente._id}/replanejar para refazê-lo.`
    );
  }
  const plano = await Planejamento.create(dados);
  const metas = gerarMetas(plano);
  if (metas.length === 0) {
    await plano.deleteOne();
    throw unprocessable('O planejamento não gerou nenhuma meta no período informado. Revise a distribuição e as datas.');
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

  const base = {
    curso: String(antigo.curso),
    disciplina: antigo.disciplina ? String(antigo.disciplina) : null,
    periodicidade: antigo.periodicidade,
    horasPorPeriodo: antigo.horasPorPeriodo,
    distribuicao: body.periodicidade && body.periodicidade !== antigo.periodicidade ? undefined : antigo.distribuicao.map((i) => ({ dia: i.dia, horas: i.horas })),
    dataInicio: d.today(),
    dataFim: undefined,
  };
  // Se o usuário mudar horas/periodicidade sem informar distribuição, a distribuição antiga não vale mais
  if ((body.horasPorPeriodo !== undefined || body.periodicidade !== undefined) && body.distribuicao === undefined) {
    base.distribuicao = undefined;
  }
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
  if (pendencias.length > 0) situacao = 'com_pendencias';
  else if (segEstudadosTotal > segPlanejadosPassado + (metaHoje ? metaHoje.segundosPlanejados : 0)) situacao = 'adiantado';

  return {
    planejamento: plano,
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

module.exports = { criar, replanejar, acompanhamento, gerarMetas, assertObjectId };
