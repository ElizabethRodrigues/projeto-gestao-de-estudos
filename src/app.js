const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const { AppError } = require('./utils/errors');
const Planejamento = require('./models/Planejamento');
const planejamentoService = require('./services/planejamentoService');

const SWAGGER_PATH = path.join(__dirname, '..', 'docs', 'swagger.yaml');

function createApp() {
  const app = express();
  app.use(express.json());

  // ---------- API ----------
  app.use('/api/cursos', require('./routes/cursos'));
  app.use('/api/disciplinas', require('./routes/disciplinas'));
  app.use('/api/planejamentos', require('./routes/planejamentos'));
  app.use('/api/registros', require('./routes/registros'));
  app.use('/api/metas', require('./routes/metas'));

  // Regra 5: visão geral do acompanhamento de todos os planejamentos ativos
  app.get('/api/acompanhamento', async (req, res) => {
    const planos = await Planejamento.find({ status: 'ativo' }).sort({ criadoEm: 1 });
    const itens = [];
    for (const p of planos) itens.push(await planejamentoService.acompanhamento(p._id));
    res.json(itens);
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', banco: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' });
  });

  // ---------- Swagger ----------
  // Arquivo YAML bruto
  app.get('/api-docs/swagger.yaml', (req, res) => {
    res.type('application/yaml').send(fs.readFileSync(SWAGGER_PATH, 'utf8'));
  });
  // Documentação renderizada a partir do YAML
  const swaggerDoc = yaml.load(fs.readFileSync(SWAGGER_PATH, 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, { customSiteTitle: 'Gestão de Estudos - API' }));

  // ---------- Site Web ----------
  // "no-cache": o navegador sempre confere se há versão nova do site (evita JS/CSS desatualizado)
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    })
  );

  app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  // ---------- Tratamento de erros ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ erro: err.message, ...(err.details ? { detalhes: err.details } : {}) });
    }
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: Object.values(err.errors).map((e) => e.message) });
    }
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ erro: `Valor inválido para ${err.path}` });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  });

  return app;
}

module.exports = createApp;
