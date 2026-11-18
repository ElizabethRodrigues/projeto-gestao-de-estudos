const { Router } = require('express');
const mongoose = require('mongoose');
const Registro = require('../models/Registro');
const service = require('../services/registroService');
const { badRequest, notFound } = require('../utils/errors');

const router = Router();

const popular = (q) =>
  q.populate({
    path: 'planejamento',
    select: 'curso disciplina periodicidade',
    populate: [{ path: 'curso', select: 'nome' }, { path: 'disciplina', select: 'nome' }],
  });

router.get('/', async (req, res) => {
  await service.finalizarExpirados();
  const filtro = {};
  if (req.query.planejamento) {
    if (!mongoose.isValidObjectId(req.query.planejamento)) throw badRequest('planejamento inválido');
    filtro.planejamento = req.query.planejamento;
  }
  if (req.query.status) filtro.status = req.query.status;
  const registros = await popular(Registro.find(filtro).sort({ inicio: -1 }));
  res.json(registros.map(service.comTempoAtual));
});

// Sessão em andamento (ou null)
router.get('/ativo', async (req, res) => {
  await service.finalizarExpirados();
  const registro = await popular(Registro.findOne({ status: 'em_andamento' }));
  res.json(registro ? service.comTempoAtual(registro) : null);
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw badRequest('id inválido');
  await service.finalizarExpirados();
  const registro = await popular(Registro.findById(req.params.id));
  if (!registro) throw notFound('Registro não encontrado');
  res.json(service.comTempoAtual(registro));
});

// Regra 4: iniciar registro de estudo
router.post('/iniciar', async (req, res) => {
  const { planejamento } = req.body || {};
  if (!planejamento) throw badRequest('Dados inválidos', ['planejamento é obrigatório']);
  const registro = await service.iniciar(planejamento);
  res.status(201).json(service.comTempoAtual(await popular(Registro.findById(registro._id))));
});

router.post('/:id/finalizar', async (req, res) => {
  const registro = await service.finalizar(req.params.id);
  res.json(service.comTempoAtual(await popular(Registro.findById(registro._id))));
});

module.exports = router;
