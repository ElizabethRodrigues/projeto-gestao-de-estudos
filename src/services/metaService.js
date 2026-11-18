const mongoose = require('mongoose');
const Meta = require('../models/Meta');
const Planejamento = require('../models/Planejamento');
const d = require('../utils/dates');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/errors');

/**
 * Regra 6: marca como concluída uma meta de um dia que já passou e não foi
 * informada na data certa. Opcionalmente o usuário informa quantas horas estudou
 * (padrão: as horas planejadas).
 */
async function concluirRetroativamente(id, body = {}) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('id inválido');
  const meta = await Meta.findById(id);
  if (!meta) throw notFound('Meta não encontrada');
  if (meta.concluida) throw conflict('Esta meta já está concluída');
  if (meta.data >= d.today()) {
    throw unprocessable('Somente metas de dias anteriores a hoje podem ser concluídas manualmente. Para hoje, use o registro de estudo.');
  }
  const plano = await Planejamento.findById(meta.planejamento);
  if (plano && plano.status !== 'ativo') {
    throw unprocessable('A meta pertence a um planejamento substituído');
  }

  let segundos = meta.segundosPlanejados;
  if (body.horasEstudadas !== undefined && body.horasEstudadas !== null && body.horasEstudadas !== '') {
    const h = Number(body.horasEstudadas);
    if (!Number.isFinite(h) || h <= 0 || h > 24) throw badRequest('horasEstudadas deve ser um número entre 0 e 24');
    segundos = Math.round(h * 3600);
  }

  meta.segundosEstudados = Math.min(meta.segundosPlanejados, Math.max(meta.segundosEstudados, segundos));
  meta.concluida = true;
  meta.conclusaoRetroativa = true;
  meta.concluidaEm = new Date();
  if (body.observacao) meta.observacao = String(body.observacao);
  await meta.save();
  return meta;
}

async function listar(query = {}) {
  const filtro = {};
  if (query.planejamento) {
    if (!mongoose.isValidObjectId(query.planejamento)) throw badRequest('planejamento inválido');
    filtro.planejamento = query.planejamento;
  }
  if (query.de || query.ate) {
    filtro.data = {};
    if (query.de) filtro.data.$gte = query.de;
    if (query.ate) filtro.data.$lte = query.ate;
  }
  const hoje = d.today();
  switch (query.situacao) {
    case undefined:
    case '':
      break;
    case 'concluida':
      filtro.concluida = true;
      break;
    case 'concluida_retroativamente':
      filtro.concluida = true;
      filtro.conclusaoRetroativa = true;
      break;
    case 'atrasada':
      filtro.concluida = false;
      filtro.data = { ...(filtro.data || {}), $lt: hoje };
      break;
    case 'hoje':
      filtro.data = hoje;
      break;
    case 'futura':
      filtro.concluida = false;
      filtro.data = { ...(filtro.data || {}), $gt: hoje };
      break;
    default:
      throw badRequest("situacao deve ser: concluida, concluida_retroativamente, atrasada, hoje ou futura");
  }
  return Meta.find(filtro)
    .sort({ data: query.situacao === 'concluida' ? -1 : 1 })
    .populate({ path: 'planejamento', select: 'curso disciplina periodicidade status', populate: [{ path: 'curso', select: 'nome' }, { path: 'disciplina', select: 'nome' }] });
}

module.exports = { concluirRetroativamente, listar };
