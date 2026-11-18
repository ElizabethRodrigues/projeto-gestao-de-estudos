const { Schema, model } = require('mongoose');

const disciplinaSchema = new Schema(
  {
    nome: { type: String, required: [true, 'O nome da disciplina é obrigatório'], trim: true },
    descricao: { type: String, trim: true, default: '' },
    // As horas de estudo são definidas no planejamento (regra 3), não no cadastro da disciplina.
    // Regra 1: um curso possui várias disciplinas
    curso: { type: Schema.Types.ObjectId, ref: 'Curso', required: [true, 'curso é obrigatório'] },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

module.exports = model('Disciplina', disciplinaSchema);
