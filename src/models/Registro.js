const { Schema, model } = require('mongoose');

// Registro de uma sessão de estudo (regra 4).
const registroSchema = new Schema(
  {
    planejamento: { type: Schema.Types.ObjectId, ref: 'Planejamento', required: true, index: true },
    meta: { type: Schema.Types.ObjectId, ref: 'Meta', required: true },
    data: { type: String, required: true },
    inicio: { type: Date, required: true },
    fim: { type: Date, default: null },
    // Momento em que o limite diário é atingido e a sessão é encerrada automaticamente
    limiteEm: { type: Date, required: true },
    segundos: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['em_andamento', 'finalizado', 'finalizado_automaticamente'],
      default: 'em_andamento',
    },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

registroSchema.virtual('minutos').get(function () {
  return Math.round((this.segundos / 60) * 100) / 100;
});

registroSchema.set('toJSON', { virtuals: true, transform: (_, ret) => { delete ret.id; return ret; } });

module.exports = model('Registro', registroSchema);
