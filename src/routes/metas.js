const { Router } = require('express');
const service = require('../services/metaService');
const registroService = require('../services/registroService');

const router = Router();

// Lista metas (ex.: ?situacao=concluida para metas concluídas, ?situacao=atrasada para pendências)
router.get('/', async (req, res) => {
  await registroService.finalizarExpirados();
  res.json(await service.listar(req.query));
});

// Regra 6: concluir meta de dia passado não informada na data certa
router.patch('/:id/concluir', async (req, res) => {
  res.json(await service.concluirRetroativamente(req.params.id, req.body || {}));
});

module.exports = router;
