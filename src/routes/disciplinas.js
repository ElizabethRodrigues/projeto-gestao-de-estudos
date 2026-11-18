const { Router } = require('express');
const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Planejamento = require('../models/Planejamento');
const { badRequest, notFound, conflict } = require('../utils/errors');

const router = Router();
const CAMPOS = ['nome', 'descricao', 'curso'];

const pick = (body) =>
  Object.fromEntries(
    CAMPOS.filter((c) => body[c] !== undefined).map((c) => [c, body[c] === '' ? null : body[c]])
  );

async function validarCurso(cursoId) {
  if (cursoId === undefined) return;
  if (!mongoose.isValidObjectId(cursoId)) throw badRequest('curso inválido');
  if (!(await Curso.exists({ _id: cursoId }))) throw notFound('Curso não encontrado');
}

async function buscar(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('id inválido');
  const disciplina = await Disciplina.findById(id).populate('curso', 'nome');
  if (!disciplina) throw notFound('Disciplina não encontrada');
  return disciplina;
}

router.get('/', async (req, res) => {
  const filtro = {};
  if (req.query.curso) {
    if (!mongoose.isValidObjectId(req.query.curso)) throw badRequest('curso inválido');
    filtro.curso = req.query.curso;
  }
  res.json(await Disciplina.find(filtro).sort({ nome: 1 }).populate('curso', 'nome'));
});

router.get('/:id', async (req, res) => {
  res.json(await buscar(req.params.id));
});

router.post('/', async (req, res) => {
  const dados = pick(req.body || {});
  if (!dados.curso) throw badRequest('Dados inválidos', ['curso é obrigatório']);
  await validarCurso(dados.curso);
  const disciplina = await Disciplina.create(dados);
  await disciplina.populate('curso', 'nome');
  res.status(201).json(disciplina);
});

router.put('/:id', async (req, res) => {
  const disciplina = await buscar(req.params.id);
  const dados = pick(req.body || {});
  await validarCurso(dados.curso);
  disciplina.set(dados);
  await disciplina.save();
  await disciplina.populate('curso', 'nome');
  res.json(disciplina);
});

router.delete('/:id', async (req, res) => {
  const disciplina = await buscar(req.params.id);
  const planos = await Planejamento.countDocuments({ disciplina: disciplina._id, status: 'ativo' });
  if (planos > 0) throw conflict('Não é possível excluir uma disciplina com planejamento ativo');
  await disciplina.deleteOne();
  res.status(204).end();
});

module.exports = router;
