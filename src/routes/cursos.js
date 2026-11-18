const { Router } = require('express');
const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Planejamento = require('../models/Planejamento');
const { badRequest, notFound, conflict } = require('../utils/errors');

const router = Router();
const CAMPOS = ['nome', 'descricao', 'dataInicio', 'dataFim', 'validade'];

const pick = (body) =>
  Object.fromEntries(
    CAMPOS.filter((c) => body[c] !== undefined).map((c) => [c, body[c] === '' ? null : body[c]])
  );

async function buscar(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('id inválido');
  const curso = await Curso.findById(id).populate('disciplinas');
  if (!curso) throw notFound('Curso não encontrado');
  return curso;
}

router.get('/', async (req, res) => {
  const cursos = await Curso.find().sort({ nome: 1 }).populate('disciplinas');
  res.json(cursos);
});

router.get('/:id', async (req, res) => {
  res.json(await buscar(req.params.id));
});

router.post('/', async (req, res) => {
  const curso = await Curso.create(pick(req.body || {}));
  await curso.populate('disciplinas');
  res.status(201).json(curso);
});

router.put('/:id', async (req, res) => {
  const curso = await buscar(req.params.id);
  curso.set(pick(req.body || {}));
  await curso.save();
  res.json(curso);
});

router.delete('/:id', async (req, res) => {
  const curso = await buscar(req.params.id);
  const planos = await Planejamento.countDocuments({ curso: curso._id, status: 'ativo' });
  if (planos > 0) throw conflict('Não é possível excluir um curso com planejamento ativo');
  await Disciplina.deleteMany({ curso: curso._id });
  await curso.deleteOne();
  res.status(204).end();
});

module.exports = router;
