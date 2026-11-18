const mongoose = require('mongoose');
const Planejamento = require('../models/Planejamento');
const Meta = require('../models/Meta');
const Registro = require('../models/Registro');
const d = require('../utils/dates');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/errors');

// Timers que encerram automaticamente a sessão ao atingir o limite diário.
const timers = new Map();

function agendarEncerramento(registro) {
  cancelarEncerramento(registro._id);
  const ms = Math.max(0, new Date(registro.limiteEm).getTime() - Date.now());
  const t = setTimeout(() => {
    finalizar(registro._id, { automatico: true }).catch((err) =>
      console.error('[registro] erro ao finalizar automaticamente', err)
    );
  }, ms);
  t.unref?.();
  timers.set(String(registro._id), t);
}

function cancelarEncerramento(id) {
  const t = timers.get(String(id));
  if (t) clearTimeout(t);
  timers.delete(String(id));
}

/**
 * Regra 4: inicia o registro de estudo do dia para um planejamento.
 * O tempo é contabilizado na meta do dia até o usuário finalizar ou até atingir
 * o limite diário planejado (encerramento automático).
 */
async function iniciar(planejamentoId) {
  if (!mongoose.isValidObjectId(planejamentoId)) throw badRequest('planejamento inválido');
  await finalizarExpirados();

  const plano = await Planejamento.findById(planejamentoId);
  if (!plano) throw notFound('Planejamento não encontrado');
  if (plano.status !== 'ativo') throw unprocessable('Este planejamento foi substituído; use o planejamento ativo');

  const emAndamento = await Registro.findOne({ status: 'em_andamento' });
  if (emAndamento) {
    throw conflict(`Já existe um registro de estudo em andamento (${emAndamento._id}). Finalize-o antes de iniciar outro.`);
  }

  const hoje = d.today();
  const meta = await Meta.findOne({ planejamento: plano._id, data: hoje });
  if (!meta) throw unprocessable('Não há estudo planejado para hoje neste planejamento');
  const restante = meta.segundosPlanejados - meta.segundosEstudados;
  if (restante <= 0) throw unprocessable('O limite diário planejado para hoje já foi atingido');

  const inicio = new Date();
  const registro = await Registro.create({
    planejamento: plano._id,
    meta: meta._id,
    data: hoje,
    inicio,
    limiteEm: new Date(inicio.getTime() + restante * 1000),
  });
  agendarEncerramento(registro);
  return registro;
}

async function finalizar(id, { automatico = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('id inválido');
  const registro = await Registro.findById(id);
  if (!registro) throw notFound('Registro não encontrado');
  if (registro.status !== 'em_andamento') {
    if (automatico) return registro;
    throw conflict('Este registro já foi finalizado');
  }
  cancelarEncerramento(registro._id);

  const agora = new Date();
  const atingiuLimite = agora >= registro.limiteEm;
  const fim = atingiuLimite ? registro.limiteEm : agora;
  const segundos = Math.max(0, Math.round((fim - registro.inicio) / 1000));

  // Atualização condicional evita contabilizar duas vezes (timer x requisição)
  const atualizado = await Registro.findOneAndUpdate(
    { _id: registro._id, status: 'em_andamento' },
    { fim, segundos, status: atingiuLimite ? 'finalizado_automaticamente' : 'finalizado' },
    { returnDocument: 'after' }
  );
  if (!atualizado) return Registro.findById(id);

  const meta = await Meta.findById(registro.meta);
  if (meta) {
    meta.segundosEstudados = Math.min(meta.segundosPlanejados, meta.segundosEstudados + segundos);
    if (meta.segundosEstudados >= meta.segundosPlanejados && !meta.concluida) {
      meta.concluida = true;
      meta.concluidaEm = fim;
    }
    await meta.save();
  }
  return atualizado;
}

/** Encerra sessões cujo limite diário já passou (garante consistência mesmo sem timer). */
async function finalizarExpirados() {
  const expirados = await Registro.find({ status: 'em_andamento', limiteEm: { $lte: new Date() } });
  for (const r of expirados) await finalizar(r._id, { automatico: true });
}

/** Retorna o registro com o tempo decorrido calculado em tempo real. */
function comTempoAtual(registro) {
  const json = registro.toJSON();
  if (registro.status === 'em_andamento') {
    const agora = Math.min(Date.now(), registro.limiteEm.getTime());
    json.segundosDecorridos = Math.max(0, Math.round((agora - registro.inicio.getTime()) / 1000));
    json.segundosParaLimite = Math.max(0, Math.round((registro.limiteEm.getTime() - Date.now()) / 1000));
  } else {
    json.segundosDecorridos = registro.segundos;
    json.segundosParaLimite = 0;
  }
  return json;
}

module.exports = { iniciar, finalizar, finalizarExpirados, comTempoAtual };
