const { Schema, model } = require('mongoose');

const distribuicaoSchema = new Schema(
  {
    // semanal: 0 (domingo) a 6 (sábado) | mensal: 1 a 31 (dia do mês)
    dia: { type: Number, required: true },
    horas: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const planejamentoSchema = new Schema(
  {
    curso: { type: Schema.Types.ObjectId, ref: 'Curso', required: true },
    disciplina: { type: Schema.Types.ObjectId, ref: 'Disciplina', default: null },
    periodicidade: { type: String, enum: ['diario', 'semanal', 'mensal'], required: true },
    horasPorPeriodo: { type: Number, required: true, min: 0.01 },
    distribuicao: { type: [distribuicaoSchema], default: [] },
    dataInicio: { type: String, required: true },
    dataFim: { type: String, required: true },
    status: { type: String, enum: ['ativo', 'substituido'], default: 'ativo' },
    substitui: { type: Schema.Types.ObjectId, ref: 'Planejamento', default: null },
    substituidoPor: { type: Schema.Types.ObjectId, ref: 'Planejamento', default: null },
    observacao: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

planejamentoSchema.virtual('alvo').get(function () {
  return this.disciplina ? 'disciplina' : 'curso';
});

planejamentoSchema.set('toJSON', { virtuals: true, transform: (_, ret) => { delete ret.id; return ret; } });

module.exports = model('Planejamento', planejamentoSchema);
