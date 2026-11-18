const { Router } = require('express');
const mongoose = require('mongoose');
const Planejamento = require('../models/Planejamento');
const Meta = require('../models/Meta');
const Registro = require('../models/Registro');
const service = require('../services/planejamentoService');
const { badRequest, notFound } = require('../utils/errors');

const router = Router();

const popular = (q) => q.populate('curso', 'nome').populate('disciplina', 'nome');

router.get('/', async (req, res) => {
  const filtro = {};
  if (req.query.status) filtro.status = req.query.status;
  for (const campo of ['curso', 'disciplina']) {
    if (req.query[campo]) {
      if (!mongoose.isValidObjectId(req.query[campo])) throw badRequest(`${campo} inválido`);
      filtro[campo] = req.query[campo];
    }
  }
  res.json(await service.comConclusao(await popular(Planejamento.find(filtro).sort({ criadoEm: -1 }))));
});

router.get('/:id', async (req, res) => {
  service.assertObjectId(req.params.id, 'id');
  const plano = await popular(Planejamento.findById(req.params.id));
  if (!plano) throw notFound('Planejamento não encontrado');
  const metas = await Meta.find({ planejamento: plano._id }).sort({ data: 1 });
  const [comSituacao] = await service.comConclusao([plano]);
  res.json({ ...comSituacao, metas });
});

router.post('/', async (req, res) => {
  const plano = await service.criar(req.body || {});
  await popular(Planejamento.findById(plano._id)).then((p) => res.status(201).json(p));
});

// Regra 8: refazer um planejamento
router.post('/:id/replanejar', async (req, res) => {
  const { anterior, novo } = await service.replanejar(req.params.id, req.body || {});
  res.status(201).json({
    anterior: await popular(Planejamento.findById(anterior._id)),
    novo: await popular(Planejamento.findById(novo._id)),
  });
});

// Regra 5: acompanhamento planejado x realizado
router.get('/:id/acompanhamento', async (req, res) => {
  res.json(await service.acompanhamento(req.params.id));
});

router.get('/:id/metas', async (req, res) => {
  service.assertObjectId(req.params.id, 'id');
  res.json(await Meta.find({ planejamento: req.params.id }).sort({ data: 1 }));
});

router.delete('/:id', async (req, res) => {
  service.assertObjectId(req.params.id, 'id');
  const plano = await Planejamento.findById(req.params.id);
  if (!plano) throw notFound('Planejamento não encontrado');
  await Registro.deleteMany({ planejamento: plano._id });
  await Meta.deleteMany({ planejamento: plano._id });
  await plano.deleteOne();
  res.status(204).end();
});

module.exports = router;
