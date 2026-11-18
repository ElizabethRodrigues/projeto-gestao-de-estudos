/* Gestão de Estudos - frontend (JavaScript puro consumindo a API REST) */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SITUACOES = {
  futura: ['Futura', 'info'],
  hoje: ['Hoje', 'info'],
  atrasada: ['Atrasada', 'bad'],
  concluida: ['Concluída', 'ok'],
  concluida_retroativamente: ['Concluída (retroativa)', 'ok'],
  em_dia: ['Em dia', 'info'],
  adiantado: ['Adiantado', 'ok'],
  com_pendencias: ['Atrasado', 'bad'],
  concluido: ['Concluído', 'ok'],
  em_andamento: ['Em andamento', 'info'],
  finalizado: ['Finalizado', 'ok'],
  finalizado_automaticamente: ['Finalizado (limite diário)', 'warn'],
  ativo: ['Ativo', 'ok'],
  substituido: ['Substituído', 'warn'],
};
const PERIODICIDADE = { semanal: 'Semanal', mensal: 'Mensal' };
const FRASES = [
  'Pequenos passos todos os dias levam a grandes conquistas.',
  'Constância vale mais que intensidade: siga o seu planejamento.',
  'Uma meta por dia. Um dia de cada vez.',
  'O melhor momento para estudar é agora.',
  'Revise, pratique e registre: o progresso aparece.',
];
const icone = (id) => `<svg><use href="#i-${id}"/></svg>`;

// ------------------------------------------------------------ utilidades
async function api(url, opcoes = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = dados?.erro || `Erro ${resp.status}`;
    throw new Error(dados?.detalhes?.length ? `${msg}: ${dados.detalhes.join('; ')}` : msg);
  }
  return dados;
}

let avisoTimer;
function avisar(msg, tipo = 'sucesso') {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = `aviso ${tipo}`;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.add('oculto'), tipo === 'erro' ? 7000 : 3500);
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const selo = (chave) => {
  const [txt, cls] = SITUACOES[chave] || [chave, 'info'];
  return `<span class="selo ${cls}">${esc(txt)}</span>`;
};
const dataBR = (k) => (k ? k.split('-').reverse().join('/') : '—');
const horas = (h) => `${Number(h || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`;
const relogio = (s) => {
  s = Math.max(0, Math.round(s));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};
const nomeAlvo = (p) => (p ? p.disciplina?.nome || `${p.curso?.nome || 'Curso'} (curso inteiro)` : '—');
const nomePlano = (p) => (p ? `${nomeAlvo(p)}${p.disciplina ? ` · ${p.curso?.nome || ''}` : ''}` : '—');
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hojeKey = () => toKey(new Date());
const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const tabela = (el, cabecalho, linhas, vazio) => {
  el.innerHTML = `<thead><tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
    linhas.length ? linhas.join('') : `<tr><td class="vazio" colspan="${cabecalho.length}">${vazio}</td></tr>`
  }</tbody>`;
};
const formDados = (form) => Object.fromEntries(new FormData(form).entries());

// ------------------------------------------------------------ tema claro / escuro
function lerTemaSalvo() {
  try {
    return localStorage.getItem('tema');
  } catch {
    return null;
  }
}
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
  $('#txt-tema').textContent = tema === 'escuro' ? 'Tema claro' : 'Tema escuro';
  $('#btn-tema').setAttribute('aria-label', tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
}
let temaAtual = lerTemaSalvo() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
aplicarTema(temaAtual);
$('#btn-tema').addEventListener('click', () => {
  temaAtual = temaAtual === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(temaAtual);
  try {
    localStorage.setItem('tema', temaAtual);
  } catch {}
});

// ------------------------------------------------------------ navegação lateral
const carregadores = {};
function abrirAba(nome) {
  $$('#menu button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === nome));
  $$('.aba').forEach((s) => s.classList.toggle('oculto', s.id !== `aba-${nome}`));
  history.replaceState(null, '', `#${nome}`);
  $('#lateral').classList.remove('aberta');
  $('#btn-menu').setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0 });
  return (carregadores[nome]?.() || Promise.resolve()).catch((e) => avisar(e.message, 'erro'));
}
$('#menu').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-aba]');
  if (b) abrirAba(b.dataset.aba);
});
window.addEventListener('hashchange', () => {
  const aba = location.hash.slice(1);
  if (carregadores[aba] && $(`#aba-${aba}`).classList.contains('oculto')) abrirAba(aba);
});
$('#btn-menu').addEventListener('click', () => {
  const aberta = $('#lateral').classList.toggle('aberta');
  $('#btn-menu').setAttribute('aria-expanded', String(aberta));
});

// ------------------------------------------------------------ cursos
let cursosCache = [];
async function carregarCursos() {
  cursosCache = await api('/api/cursos');
  tabela(
    $('#tab-cursos'),
    ['Curso', 'Período', 'Validade', 'Disciplinas', ''],
    cursosCache.map(
      (c) => `<tr>
        <td><b>${esc(c.nome)}</b><br><small class="dica">${esc(c.descricao)}</small></td>
        <td>${c.dataInicio || c.dataFim ? `${dataBR(c.dataInicio)} a ${dataBR(c.dataFim)}` : '—'}</td>
        <td>${c.validade ? dataBR(c.validade) : '—'}</td>
        <td>${(c.disciplinas || []).map((d) => esc(d.nome)).join('<br>') || '—'}</td>
        <td class="acoes">
          <button class="mini" data-editar-curso="${c._id}">Editar</button>
          <button class="mini perigo" data-excluir-curso="${c._id}">Excluir</button>
        </td></tr>`
    ),
    'Nenhum curso cadastrado'
  );
}
carregadores.cursos = carregarCursos;

$('#form-curso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { id, ...dados } = formDados(e.target);
  try {
    await api(id ? `/api/cursos/${id}` : '/api/cursos', { method: id ? 'PUT' : 'POST', body: dados });
    avisar(id ? 'Curso atualizado' : 'Curso cadastrado');
    e.target.reset();
    await carregarCursos();
  } catch (err) {
    avisar(err.message, 'erro');
  }
});
$('#form-curso').addEventListener('reset', () => {
  $('#form-curso [name=id]').value = '';
  $('#titulo-form-curso').textContent = 'Novo curso';
});
$('#tab-cursos').addEventListener('click', async (e) => {
  const editar = e.target.dataset.editarCurso;
  const excluir = e.target.dataset.excluirCurso;
  if (editar) {
    const c = cursosCache.find((x) => x._id === editar);
    const f = $('#form-curso');
    for (const campo of ['nome', 'descricao', 'dataInicio', 'dataFim', 'validade']) f[campo].value = c[campo] || '';
    f.id.value = c._id;
    $('#titulo-form-curso').textContent = `Editar curso: ${c.nome}`;
    f.scrollIntoView({ behavior: 'smooth' });
  }
  if (excluir && confirm('Excluir o curso e todas as suas disciplinas?')) {
    try {
      await api(`/api/cursos/${excluir}`, { method: 'DELETE' });
      avisar('Curso excluído');
      await carregarCursos();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  }
});

function opcoesCursos(select) {
  select.innerHTML = cursosCache.map((c) => `<option value="${c._id}">${esc(c.nome)}</option>`).join('');
}

// ------------------------------------------------------------ disciplinas
let disciplinasCache = [];
async function carregarDisciplinas() {
  [cursosCache, disciplinasCache] = await Promise.all([api('/api/cursos'), api('/api/disciplinas')]);
  const sel = $('#sel-disc-curso');
  const atual = sel.value;
  opcoesCursos(sel);
  if (atual) sel.value = atual;
  tabela(
    $('#tab-disciplinas'),
    ['Disciplina', 'Curso', ''],
    disciplinasCache.map(
      (d) => `<tr>
        <td><b>${esc(d.nome)}</b><br><small class="dica">${esc(d.descricao)}</small></td>
        <td>${esc(d.curso?.nome)}</td>
        <td class="acoes">
          <button class="mini" data-editar-disc="${d._id}">Editar</button>
          <button class="mini perigo" data-excluir-disc="${d._id}">Excluir</button>
        </td></tr>`
    ),
    'Nenhuma disciplina cadastrada'
  );
}
carregadores.disciplinas = carregarDisciplinas;

$('#form-disciplina').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { id, ...dados } = formDados(e.target);
  try {
    await api(id ? `/api/disciplinas/${id}` : '/api/disciplinas', { method: id ? 'PUT' : 'POST', body: dados });
    avisar(id ? 'Disciplina atualizada' : 'Disciplina cadastrada');
    const curso = e.target.curso.value;
    e.target.reset();
    e.target.curso.value = curso;
    await carregarDisciplinas();
  } catch (err) {
    avisar(err.message, 'erro');
  }
});
$('#form-disciplina').addEventListener('reset', () => {
  $('#form-disciplina [name=id]').value = '';
  $('#titulo-form-disciplina').textContent = 'Nova disciplina';
});
$('#tab-disciplinas').addEventListener('click', async (e) => {
  const editar = e.target.dataset.editarDisc;
  const excluir = e.target.dataset.excluirDisc;
  if (editar) {
    const d = disciplinasCache.find((x) => x._id === editar);
    const f = $('#form-disciplina');
    f.nome.value = d.nome;
    f.descricao.value = d.descricao || '';
    f.curso.value = d.curso?._id || d.curso;
    f.id.value = d._id;
    $('#titulo-form-disciplina').textContent = `Editar disciplina: ${d.nome}`;
    f.scrollIntoView({ behavior: 'smooth' });
  }
  if (excluir && confirm('Excluir esta disciplina?')) {
    try {
      await api(`/api/disciplinas/${excluir}`, { method: 'DELETE' });
      avisar('Disciplina excluída');
      await carregarDisciplinas();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  }
});

// ------------------------------------------------------------ planejamentos
let planosCache = [];
async function carregarPlanejamentos() {
  [cursosCache, disciplinasCache, planosCache] = await Promise.all([
    api('/api/cursos'),
    api('/api/disciplinas'),
    api('/api/planejamentos'),
  ]);
  const f = $('#form-plano');
  if (!f.replanejarId.value) {
    const sel = $('#sel-plano-curso');
    const atual = sel.value;
    opcoesCursos(sel);
    if (atual) sel.value = atual;
    atualizarDisciplinasPlano();
    if (!f.dataInicio.value) f.dataInicio.value = hojeKey();
  }
  atualizarResumoPlano();
  const mostrarSubst = $('#chk-substituidos').checked;
  const lista = planosCache.filter((p) => mostrarSubst || p.status === 'ativo');
  tabela(
    $('#tab-planos'),
    ['Disciplina / curso', 'Periodicidade', 'Horas e dias', 'Período', 'Status'],
    lista.map(
      (p) => `<tr>
        <td><b>${esc(nomeAlvo(p))}</b>${p.disciplina ? `<br><small class="dica">${esc(p.curso?.nome)}</small>` : ''}${
          p.observacao ? `<br><small class="dica">${esc(p.observacao)}</small>` : ''
        }
          <div class="acoes acoes-linha">
            ${p.status === 'ativo' ? `<button class="mini destaque" data-replanejar="${p._id}">${icone('refazer')} Refazer planejamento</button>` : ''}
            <button class="mini perigo" data-excluir-plano="${p._id}">Excluir</button>
          </div>
        </td>
        <td>${PERIODICIDADE[p.periodicidade] || esc(p.periodicidade)}${
          p.duracao
            ? ` · ${p.duracao} ${p.periodicidade === 'semanal' ? (p.duracao > 1 ? 'semanas' : 'semana') : p.duracao > 1 ? 'meses' : 'mês'}`
            : ''
        }</td>
        <td>${horas(p.horasPorDia)}/dia<br><small class="dica">${(p.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ') || '—'}</small></td>
        <td>${dataBR(p.dataInicio)} a ${dataBR(p.dataFim)}</td>
        <td>${selo(p.status)}</td></tr>`
    ),
    'Nenhum planejamento'
  );
}
carregadores.planejamentos = carregarPlanejamentos;

function atualizarDisciplinasPlano() {
  const curso = $('#sel-plano-curso').value;
  $('#sel-plano-disciplina').innerHTML =
    '<option value="">— Curso inteiro —</option>' +
    disciplinasCache
      .filter((d) => (d.curso?._id || d.curso) === curso)
      .map((d) => `<option value="${d._id}">${esc(d.nome)}</option>`)
      .join('');
}
$('#sel-plano-curso').addEventListener('change', atualizarDisciplinasPlano);

function renderDiasSemana(selecionados = [1, 2, 3, 4, 5]) {
  $('#dias-semana').innerHTML = [1, 2, 3, 4, 5, 6, 0]
    .map(
      (i) => `<label class="chip"><input type="checkbox" value="${i}" ${selecionados.includes(i) ? 'checked' : ''} /><span>${DIAS_SEMANA[i]}</span></label>`
    )
    .join('');
}
renderDiasSemana();
const lerDiasSemana = () => $$('#dias-semana input:checked').map((i) => Number(i.value));

// Mesma regra do servidor: semanal = N semanas; mensal = N meses a partir do início
function calcularFim(periodicidade, inicio, duracao) {
  const d = fromKey(inicio);
  if (periodicidade === 'semanal') d.setDate(d.getDate() + 7 * duracao - 1);
  else {
    d.setMonth(d.getMonth() + duracao);
    d.setDate(d.getDate() - 1);
  }
  return toKey(d);
}
function atualizarResumoPlano() {
  const f = $('#form-plano');
  const per = f.periodicidade.value;
  $('#lbl-duracao').textContent = per === 'semanal' ? 'Duração (semanas)' : 'Duração (meses)';
  f.duracao.max = per === 'semanal' ? 52 : 12;
  const inicio = f.dataInicio.value || hojeKey();
  const duracao = Math.max(1, parseInt(f.duracao.value, 10) || 1);
  const hpd = Number(f.horasPorDia.value) || 0;
  const dias = lerDiasSemana();
  const fim = calcularFim(per, inicio, duracao);
  let qtd = 0;
  for (let d = fromKey(inicio); toKey(d) <= fim; d.setDate(d.getDate() + 1)) if (dias.includes(d.getDay())) qtd++;
  $('#resumo-plano').innerHTML = `${icone('calendario')}
    <span>Termina em <b>${dataBR(fim)}</b></span>
    <span><b>${qtd}</b> dias de estudo</span>
    <span><b>${horas(qtd * hpd)}</b> no total</span>`;
}
$('#form-plano').addEventListener('input', atualizarResumoPlano);
$('#form-plano').addEventListener('change', atualizarResumoPlano);

function sairReplanejamento() {
  const f = $('#form-plano');
  f.reset();
  f.replanejarId.value = '';
  f.dataInicio.value = hojeKey();
  $('#sel-plano-curso').disabled = false;
  $('#sel-plano-disciplina').disabled = false;
  $('#titulo-form-plano').textContent = 'Novo planejamento';
  $('#btn-salvar-plano').textContent = 'Criar planejamento';
  $('#btn-cancelar-replano').classList.add('oculto');
  $('#aviso-replano').classList.add('oculto');
  renderDiasSemana();
  atualizarResumoPlano();
}
$('#btn-cancelar-replano').addEventListener('click', sairReplanejamento);

$('#form-plano').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const corpo = {
    periodicidade: f.periodicidade.value,
    duracao: Number(f.duracao.value),
    horasPorDia: Number(f.horasPorDia.value),
    diasSemana: lerDiasSemana(),
    observacao: f.observacao.value,
  };
  if (!corpo.diasSemana.length) return avisar('Escolha pelo menos um dia de estudo', 'erro');
  if (f.dataInicio.value) corpo.dataInicio = f.dataInicio.value;
  try {
    if (f.replanejarId.value) {
      await api(`/api/planejamentos/${f.replanejarId.value}/replanejar`, { method: 'POST', body: corpo });
      avisar('Planejamento refeito! O anterior foi marcado como substituído.');
      sairReplanejamento();
    } else {
      if (f.disciplina.value) corpo.disciplina = f.disciplina.value;
      else corpo.curso = f.curso.value;
      await api('/api/planejamentos', { method: 'POST', body: corpo });
      avisar('Planejamento criado e metas geradas');
      f.observacao.value = '';
    }
    await carregarPlanejamentos();
  } catch (err) {
    avisar(err.message, 'erro');
  }
});

$('#tab-planos').addEventListener('click', async (e) => {
  const excluir = e.target.closest('[data-excluir-plano]')?.dataset.excluirPlano;
  if (excluir && confirm('Excluir este planejamento, suas metas e registros?')) {
    try {
      await api(`/api/planejamentos/${excluir}`, { method: 'DELETE' });
      avisar('Planejamento excluído');
      await carregarPlanejamentos();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  }
});
$('#chk-substituidos').addEventListener('change', carregarPlanejamentos);

/**
 * Regra 8: refazer um planejamento. Abre o formulário já preenchido com os dados do
 * planejamento escolhido; o usuário ajusta o que quiser e salva. O planejamento antigo
 * fica como "substituído" (com o histórico) e o novo passa a valer a partir do início informado.
 */
async function iniciarReplanejamento(id) {
  // Vindo da tela inicial, abre a aba de planejamentos (que também recarrega a lista)
  if ($('#aba-planejamentos').classList.contains('oculto')) await abrirAba('planejamentos');
  const p = planosCache.find((x) => x._id === id);
  if (!p) return avisar('Planejamento não encontrado', 'erro');
  const f = $('#form-plano');
  f.replanejarId.value = p._id;
  $('#sel-plano-curso').value = p.curso._id;
  atualizarDisciplinasPlano();
  $('#sel-plano-disciplina').value = p.disciplina?._id || '';
  $('#sel-plano-curso').disabled = true;
  $('#sel-plano-disciplina').disabled = true;
  f.periodicidade.value = p.periodicidade;
  f.duracao.value = p.duracao || 1;
  f.horasPorDia.value = p.horasPorDia || 1;
  f.dataInicio.value = hojeKey();
  f.observacao.value = '';
  renderDiasSemana(p.diasSemana?.length ? p.diasSemana : undefined);
  atualizarResumoPlano();
  $('#titulo-form-plano').textContent = `Refazer planejamento: ${nomeAlvo(p)}`;
  $('#aviso-replano').classList.remove('oculto');
  $('#btn-salvar-plano').textContent = 'Salvar planejamento refeito';
  $('#btn-cancelar-replano').classList.remove('oculto');
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.horasPorDia.focus({ preventScroll: true });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-replanejar]');
  if (b) iniciarReplanejamento(b.dataset.replanejar);
});

// ------------------------------------------------------------ início / acompanhamento
function renderHero() {
  const agora = new Date();
  const h = agora.getHours();
  $('#hero-saudacao').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}! Bons estudos.`;
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#hero-data').textContent = data.charAt(0).toUpperCase() + data.slice(1);
  $('#hero-frase').textContent = FRASES[agora.getDate() % FRASES.length];
}

async function carregarPainel() {
  renderHero();
  const itens = await api('/api/acompanhamento');

  const tot = itens.reduce(
    (a, { resumo: r }) => ({
      concluidas: a.concluidas + r.metasConcluidas,
      pend: a.pend + r.metasAtrasadas,
      horas: a.horas + r.horasEstudadasTotal,
    }),
    { concluidas: 0, pend: 0, horas: 0 }
  );
  const kpi = (ic, cor, valor, rotulo) =>
    `<div class="kpi-card"><span class="ic ${cor}">${icone(ic)}</span><div><b>${valor}</b><small>${rotulo}</small></div></div>`;
  $('#kpis-home').innerHTML =
    kpi('calendario', 'roxo', itens.length, 'planejamentos ativos') +
    kpi('check', 'verde', tot.concluidas, 'metas concluídas') +
    kpi('alerta', 'vermelho', tot.pend, 'metas pendentes') +
    kpi('chama', 'amarelo', horas(tot.horas), 'horas estudadas');

  const el = $('#painel-lista');
  if (!itens.length) {
    el.innerHTML = `<div class="cartao vazio-grande">${icone('livro')}<p>Nenhum planejamento ativo ainda.<br>Clique em <b>Adicionar tarefa</b> para planejar seus estudos.</p></div>`;
    return;
  }
  el.innerHTML = itens
    .map(({ planejamento: p, resumo: r, hoje, pendencias }) => {
      const pct = Math.min(100, r.percentualConcluido);
      return `<div class="cartao cartao-plano ${r.situacao}">
        <div class="cab">
          <div><h3>${esc(nomeAlvo(p))}</h3>${p.disciplina ? `<span class="curso">${esc(p.curso?.nome)}</span>` : ''}</div>
          ${selo(r.situacao)}
        </div>
        <small class="dica" style="margin:0">${PERIODICIDADE[p.periodicidade] || esc(p.periodicidade)} · ${horas(p.horasPorDia)}/dia ·${dataBR(p.dataInicio)} a ${dataBR(p.dataFim)}</small>
        <div class="barra" title="${pct}% do planejamento"><span style="width:${pct}%"></span></div>
        <small class="dica" style="margin:0">${horas(r.horasEstudadasTotal)} de ${horas(r.horasPlanejadasTotal)} (${r.percentualConcluido}%)</small>
        <div class="kpis">
          <div class="kpi"><b>${r.metasConcluidas}/${r.totalMetas}</b><small>metas concluídas</small></div>
          <div class="kpi"><b>${r.metasAtrasadas}</b><small>pendências</small></div>
          <div class="kpi"><b>${horas(r.horasPendentes)}</b><small>horas pendentes</small></div>
        </div>
        <div><b>Hoje:</b> ${hoje ? `${horas(hoje.horasEstudadas)} de ${horas(hoje.horasPlanejadas)} ${selo(hoje.situacao)}` : 'sem estudo planejado'}</div>
        ${
          pendencias.length
            ? `<ul class="pend">${pendencias
                .map(
                  (m) => `<li><span>${icone('alerta')}${dataBR(m.data)} · ${horas(m.horasEstudadas)} de ${horas(m.horasPlanejadas)}</span>
                  <button class="mini" data-concluir="${m._id}" data-data="${m.data}" data-horas="${m.horasPlanejadas}">Marcar concluída</button></li>`
                )
                .join('')}</ul>`
            : ''
        }
        <div class="rodape-cartao">
          <button class="mini destaque" data-replanejar="${p._id}">${icone('refazer')} Refazer planejamento</button>
        </div>
      </div>`;
    })
    .join('');
}
carregadores.painel = carregarPainel;

// Botão da tela inicial: abre o formulário de novo planejamento (tarefa de estudo)
$('#btn-adicionar-tarefa').addEventListener('click', async () => {
  await abrirAba('planejamentos');
  if ($('#form-plano').replanejarId.value) sairReplanejamento();
  $('#form-plano').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#sel-plano-curso').focus();
});

// Regra 6: concluir meta passada
let metaParaConcluir = null;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-concluir]');
  if (!b) return;
  metaParaConcluir = b.dataset.concluir;
  $('#dlg-data').textContent = dataBR(b.dataset.data);
  const f = $('#form-concluir');
  f.horasEstudadas.value = b.dataset.horas;
  f.observacao.value = '';
  $('#dlg-concluir').showModal();
});
$('#dlg-concluir').addEventListener('close', async () => {
  if ($('#dlg-concluir').returnValue !== 'ok' || !metaParaConcluir) return;
  const f = $('#form-concluir');
  try {
    await api(`/api/metas/${metaParaConcluir}/concluir`, {
      method: 'PATCH',
      body: { horasEstudadas: f.horasEstudadas.value, observacao: f.observacao.value },
    });
    avisar('Meta concluída');
    const aba = location.hash.slice(1) || 'painel';
    carregadores[aba]?.();
  } catch (err) {
    avisar(err.message, 'erro');
  }
  metaParaConcluir = null;
});

// ------------------------------------------------------------ metas
async function carregarMetas() {
  const situacao = $('#sel-situacao').value;
  const metas = await api(`/api/metas${situacao ? `?situacao=${situacao}` : ''}`);
  tabela(
    $('#tab-metas'),
    ['Data', 'Planejamento', 'Planejado', 'Estudado', 'Situação', ''],
    metas.map(
      (m) => `<tr>
        <td>${dataBR(m.data)}</td>
        <td>${esc(nomePlano(m.planejamento))}${m.observacao ? `<br><small class="dica">${esc(m.observacao)}</small>` : ''}</td>
        <td>${horas(m.horasPlanejadas)}</td>
        <td>${horas(m.horasEstudadas)}</td>
        <td>${selo(m.situacao)}</td>
        <td>${
          m.situacao === 'atrasada' && m.planejamento?.status === 'ativo'
            ? `<button class="mini" data-concluir="${m._id}" data-data="${m.data}" data-horas="${m.horasPlanejadas}">Marcar concluída</button>`
            : ''
        }</td></tr>`
    ),
    'Nenhuma meta encontrada'
  );
}
carregadores.metas = carregarMetas;
$('#sel-situacao').addEventListener('change', () => carregarMetas().catch((e) => avisar(e.message, 'erro')));

// ------------------------------------------------------------ estudar
let ativo = null;
let tick = null;
let ativoRecebidoEm = 0;

async function carregarEstudar() {
  const [planos, registro, registros] = await Promise.all([
    api('/api/planejamentos?status=ativo'),
    api('/api/registros/ativo'),
    api('/api/registros'),
  ]);
  ativo = registro;
  ativoRecebidoEm = Date.now();

  const sel = $('#sel-iniciar');
  const atual = sel.value;
  sel.innerHTML = planos.map((p) => `<option value="${p._id}">${esc(nomePlano(p))}</option>`).join('');
  if (atual && planos.some((p) => p._id === atual)) sel.value = atual;
  await mostrarMetaHoje();

  $('#sessao-nova').classList.toggle('oculto', !!ativo);
  renderSessaoAtiva();

  tabela(
    $('#tab-registros'),
    ['Data', 'Planejamento', 'Início', 'Fim', 'Tempo', 'Status'],
    registros.map(
      (r) => `<tr>
        <td>${dataBR(r.data)}</td>
        <td>${esc(nomePlano(r.planejamento))}</td>
        <td>${new Date(r.inicio).toLocaleTimeString('pt-BR')}</td>
        <td>${r.fim ? new Date(r.fim).toLocaleTimeString('pt-BR') : '—'}</td>
        <td>${relogio(r.segundosDecorridos)}</td>
        <td>${selo(r.status)}</td></tr>`
    ),
    'Nenhum registro de estudo ainda'
  );
}
carregadores.estudar = carregarEstudar;

async function mostrarMetaHoje() {
  const id = $('#sel-iniciar').value;
  const info = $('#info-hoje');
  if (!id) {
    info.textContent = 'Nenhum planejamento ativo. Crie um em Planejamentos.';
    return;
  }
  const metas = await api(`/api/metas?planejamento=${id}&situacao=hoje`);
  const m = metas[0];
  info.innerHTML = m
    ? `Meta de hoje: <b>${horas(m.horasPlanejadas)}</b> · já estudado ${horas(m.horasEstudadas)} · restam <b>${relogio(m.segundosRestantes)}</b>`
    : 'Não há estudo planejado para hoje neste planejamento.';
}
$('#sel-iniciar').addEventListener('change', () => mostrarMetaHoje().catch((e) => avisar(e.message, 'erro')));

function renderSessaoAtiva() {
  const el = $('#sessao-ativa');
  clearInterval(tick);
  if (!ativo) {
    el.classList.add('oculto');
    return;
  }
  el.classList.remove('oculto');
  el.innerHTML = `
    <h2>${icone('livro')} Estudando agora: ${esc(nomePlano(ativo.planejamento))}</h2>
    <div class="relogio" id="relogio">${relogio(ativo.segundosDecorridos)}</div>
    <p class="dica" id="restante"></p>
    <div class="acoes"><button class="primario" id="btn-finalizar">${icone('stop')} Finalizar</button></div>`;
  $('#btn-finalizar').addEventListener('click', finalizarSessao);
  const atualizar = () => {
    const passou = (Date.now() - ativoRecebidoEm) / 1000;
    const restante = ativo.segundosParaLimite - passou;
    $('#relogio').textContent = relogio(ativo.segundosDecorridos + Math.min(passou, ativo.segundosParaLimite));
    $('#restante').textContent = `Limite diário em ${relogio(restante)}. A sessão será finalizada automaticamente.`;
    if (restante <= 0) {
      clearInterval(tick);
      setTimeout(() => {
        avisar('Limite diário atingido: registro finalizado automaticamente.');
        carregarEstudar();
      }, 1200);
    }
  };
  atualizar();
  tick = setInterval(atualizar, 1000);
}

$('#form-iniciar').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/registros/iniciar', { method: 'POST', body: { planejamento: $('#sel-iniciar').value } });
    avisar('Registro de estudo iniciado');
    await carregarEstudar();
  } catch (err) {
    avisar(err.message, 'erro');
  }
});

async function finalizarSessao() {
  try {
    const r = await api(`/api/registros/${ativo._id}/finalizar`, { method: 'POST' });
    avisar(`Registro finalizado: ${relogio(r.segundos)} contabilizados`);
  } catch (err) {
    avisar(err.message, 'erro');
  }
  await carregarEstudar();
}

// ------------------------------------------------------------ início
(async () => {
  try {
    cursosCache = await api('/api/cursos');
    opcoesCursos($('#sel-disc-curso'));
  } catch (err) {
    avisar(err.message, 'erro');
  }
  const aba = location.hash.slice(1);
  abrirAba(carregadores[aba] ? aba : 'painel');
})();
