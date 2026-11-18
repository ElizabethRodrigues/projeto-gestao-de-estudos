const { Schema, model } = require('mongoose');

const planejamentoSchema = new Schema(
  {
    curso: { type: Schema.Types.ObjectId, ref: 'Curso', required: true },
    disciplina: { type: Schema.Types.ObjectId, ref: 'Disciplina', default: null },
    // Regra 3: horas por dia + periodicidade semanal ou mensal
    periodicidade: { type: String, enum: ['semanal', 'mensal'], required: true },
    horasPorDia: { type: Number, required: true, min: 0.01, max: 24 },
    // Dias da semana em que haverá estudo: 0 (domingo) a 6 (sábado)
    diasSemana: { type: [Number], default: [1, 2, 3, 4, 5] },
    // Quantidade de semanas ou meses do planejamento
    duracao: { type: Number, default: 1, min: 1 },
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
