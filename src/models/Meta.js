const { Schema, model } = require('mongoose');
const { today } = require('../utils/dates');

// Uma meta é a quantidade de estudo planejada para um dia específico de um planejamento.
const metaSchema = new Schema(
  {
    planejamento: { type: Schema.Types.ObjectId, ref: 'Planejamento', required: true, index: true },
    data: { type: String, required: true, index: true }, // YYYY-MM-DD
    segundosPlanejados: { type: Number, required: true, min: 0 },
    segundosEstudados: { type: Number, default: 0, min: 0 },
    concluida: { type: Boolean, default: false },
    concluidaEm: { type: Date, default: null },
    // Regra 6: conclusão informada depois da data da meta
    conclusaoRetroativa: { type: Boolean, default: false },
    observacao: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

const toHours = (s) => Math.round((s / 3600) * 100) / 100;

metaSchema.virtual('horasPlanejadas').get(function () {
  return toHours(this.segundosPlanejados);
});
metaSchema.virtual('horasEstudadas').get(function () {
  return toHours(this.segundosEstudados);
});
metaSchema.virtual('segundosRestantes').get(function () {
  return Math.max(0, this.segundosPlanejados - this.segundosEstudados);
});

// futura | em_andamento (hoje) | atrasada (passou e não foi concluída) | concluida | concluida_retroativamente
metaSchema.virtual('situacao').get(function () {
  if (this.concluida) return this.conclusaoRetroativa ? 'concluida_retroativamente' : 'concluida';
  const hoje = today();
  if (this.data > hoje) return 'futura';
  if (this.data === hoje) return 'hoje';
  return 'atrasada';
});

metaSchema.set('toJSON', { virtuals: true, transform: (_, ret) => { delete ret.id; return ret; } });

module.exports = model('Meta', metaSchema);
