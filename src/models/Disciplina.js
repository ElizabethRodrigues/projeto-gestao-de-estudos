const { Schema, model } = require('mongoose');

const disciplinaSchema = new Schema(
  {
    nome: { type: String, required: [true, 'nome é obrigatório'], trim: true },
    descricao: { type: String, trim: true, default: '' },
    cargaHoraria: { type: Number, min: [0, 'cargaHoraria não pode ser negativa'], default: null },
    // Regra 1: um curso possui várias disciplinas
    curso: { type: Schema.Types.ObjectId, ref: 'Curso', required: [true, 'curso é obrigatório'] },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

module.exports = model('Disciplina', disciplinaSchema);
