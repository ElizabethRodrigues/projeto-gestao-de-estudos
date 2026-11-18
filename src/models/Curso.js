const { Schema, model } = require('mongoose');

const dateKey = {
  type: String,
  match: [/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'],
  default: null,
};

const cursoSchema = new Schema(
  {
    nome: { type: String, required: [true, 'nome é obrigatório'], trim: true },
    descricao: { type: String, trim: true, default: '' },
    // Campos opcionais (regra 2)
    dataInicio: dateKey,
    dataFim: dateKey,
    validade: dateKey,
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false }
);

cursoSchema.pre('validate', function () {
  if (this.dataInicio && this.dataFim && this.dataFim < this.dataInicio) {
    this.invalidate('dataFim', 'dataFim não pode ser anterior a dataInicio');
  }
});

cursoSchema.virtual('disciplinas', {
  ref: 'Disciplina',
  localField: '_id',
  foreignField: 'curso',
});

cursoSchema.set('toJSON', { virtuals: true, transform: (_, ret) => { delete ret.id; return ret; } });

module.exports = model('Curso', cursoSchema);
