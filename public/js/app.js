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
  em_dia: ['Em dia', 'ok'],
  adiantado: ['Adiantado', 'ok'],
  com_pendencias: ['Com pendências', 'bad'],
  em_andamento: ['Em andamento', 'info'],
  finalizado: ['Finalizado', 'ok'],
  finalizado_automaticamente: ['Finalizado (limite diário)', 'warn'],
  ativo: ['Ativo', 'ok'],
  substituido: ['Substituído', 'warn'],
};
const PERIODICIDADE = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

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
const nomePlano = (p) =>
  p ? `${p.disciplina?.nome || p.curso?.nome || 'Curso'}${p.disciplina ? ` · ${p.curso?.nome || ''}` : ' (curso inteiro)'}` : '—';
const hojeKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const tabela = (el, cabecalho, linhas, vazio) => {
  el.innerHTML = `<thead><tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
    linhas.length ? linhas.join('') : `<tr><td class="vazio" colspan="${cabecalho.length}">${vazio}</td></tr>`
  }</tbody>`;
};
const formDados = (form) => Object.fromEntries(new FormData(form).entries());

// ------------------------------------------------------------ navegação
const carregadores = {};
function abrirAba(nome) {
  $$('#menu button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === nome));
  $$('.aba').forEach((s) => s.classList.toggle('oculto', s.id !== `aba-${nome}`));
  history.replaceState(null, '', `#${nome}`);
  carregadores[nome]?.().catch((e) => avisar(e.message, 'erro'));
}
$('#menu').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-aba]');
  if (b) abrirAba(b.dataset.aba);
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
        <td>${c.disciplinas.map((d) => esc(d.nome)).join('<br>') || '—'}</td>
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

function opcoesCursos(select, { vazio } = {}) {
  select.innerHTML =
    (vazio ? `<option value="">${vazio}</option>` : '') +
    cursosCache.map((c) => `<option value="${c._id}">${esc(c.nome)}</option>`).join('');
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
    ['Disciplina', 'Curso', 'Carga horária', ''],
    disciplinasCache.map(
      (d) => `<tr>
        <td><b>${esc(d.nome)}</b><br><small class="dica">${esc(d.descricao)}</small></td>
        <td>${esc(d.curso?.nome)}</td>
        <td>${d.cargaHoraria != null ? horas(d.cargaHoraria) : '—'}</td>
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
    f.cargaHoraria.value = d.cargaHoraria ?? '';
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
  if (!$('#form-plano').replanejarId.value) {
    const sel = $('#sel-plano-curso');
    const atual = sel.value;
    opcoesCursos(sel);
    if (atual) sel.value = atual;
    atualizarDisciplinasPlano();
  }
  renderDistribuicao();
  const mostrarSubst = $('#chk-substituidos').checked;
  const lista = planosCache.filter((p) => mostrarSubst || p.status === 'ativo');
  tabela(
    $('#tab-planos'),
    ['Alvo', 'Periodicidade', 'Distribuição', 'Período', 'Status', ''],
    lista.map(
      (p) => `<tr>
        <td><b>${esc(nomePlano(p))}</b>${p.observacao ? `<br><small class="dica">${esc(p.observacao)}</small>` : ''}</td>
        <td>${PERIODICIDADE[p.periodicidade]} · ${horas(p.horasPorPeriodo)}${p.periodicidade === 'diario' ? '/dia' : p.periodicidade === 'semanal' ? '/semana' : '/mês'}</td>
        <td>${descreverDistribuicao(p)}</td>
        <td>${dataBR(p.dataInicio)} a ${dataBR(p.dataFim)}</td>
        <td>${selo(p.status)}</td>
        <td class="acoes">
          ${p.status === 'ativo' ? `<button class="mini" data-replanejar="${p._id}">Refazer</button>` : ''}
          <button class="mini perigo" data-excluir-plano="${p._id}">Excluir</button>
        </td></tr>`
    ),
    'Nenhum planejamento'
  );
}
carregadores.planejamentos = carregarPlanejamentos;

function descreverDistribuicao(p) {
  if (p.periodicidade === 'diario') return `${horas(p.horasPorPeriodo)} todos os dias`;
  if (!p.distribuicao.length) return 'Dividido entre os dias úteis';
  return p.distribuicao
    .map((d) => `${p.periodicidade === 'semanal' ? DIAS_SEMANA[d.dia] : `Dia ${d.dia}`}: ${horas(d.horas)}`)
    .join(', ');
}

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

function renderDistribuicao(valores = {}) {
  const per = $('#sel-periodicidade').value;
  $('#lbl-horas').textContent = { diario: 'Horas por dia', semanal: 'Horas por semana', mensal: 'Horas por mês' }[per];
  const fs = $('#distribuicao');
  fs.classList.toggle('oculto', per === 'diario');
  const campos = $('#dist-campos');
  if (per === 'semanal') {
    campos.innerHTML = DIAS_SEMANA.map(
      (nome, i) => `<label>${nome}<input type="number" min="0" max="24" step="0.25" data-dia="${i}" value="${valores[i] ?? ''}" /></label>`
    ).join('');
    $('#dist-dica').textContent = 'Deixe em branco para dividir igualmente de segunda a sexta.';
  } else if (per === 'mensal') {
    campos.innerHTML = Array.from({ length: 31 }, (_, i) => i + 1)
      .map((d) => `<label>Dia ${d}<input type="number" min="0" max="24" step="0.25" data-dia="${d}" value="${valores[d] ?? ''}" /></label>`)
      .join('');
    $('#dist-dica').textContent = 'Deixe em branco para dividir igualmente entre os dias úteis de cada mês.';
  } else {
    campos.innerHTML = '';
  }
  atualizarSoma();
}
function lerDistribuicao() {
  return $$('#dist-campos input')
    .filter((i) => Number(i.value) > 0)
    .map((i) => ({ dia: Number(i.dataset.dia), horas: Number(i.value) }));
}
function atualizarSoma() {
  const soma = lerDistribuicao().reduce((a, d) => a + d.horas, 0);
  const alvo = Number($('#form-plano').horasPorPeriodo.value || 0);
  $('#soma-dist').textContent = soma ? `— distribuído ${horas(soma)} de ${horas(alvo)}` : '';
  $('#soma-dist').style.color = soma && Math.abs(soma - alvo) > 0.01 ? 'var(--bad)' : '';
}
$('#sel-periodicidade').addEventListener('change', () => renderDistribuicao());
$('#dist-campos').addEventListener('input', atualizarSoma);
$('#form-plano').horasPorPeriodo.addEventListener('input', atualizarSoma);

function sairReplanejamento() {
  const f = $('#form-plano');
  f.reset();
  f.replanejarId.value = '';
  $('#sel-plano-curso').disabled = false;
  $('#sel-plano-disciplina').disabled = false;
  $('#titulo-form-plano').textContent = 'Novo planejamento';
  $('#btn-salvar-plano').textContent = 'Criar planejamento';
  $('#btn-cancelar-replano').classList.add('oculto');
  renderDistribuicao();
}
$('#btn-cancelar-replano').addEventListener('click', sairReplanejamento);

$('#form-plano').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const corpo = {
    periodicidade: f.periodicidade.value,
    horasPorPeriodo: Number(f.horasPorPeriodo.value),
    distribuicao: f.periodicidade.value === 'diario' ? [] : lerDistribuicao(),
    observacao: f.observacao.value,
  };
  if (f.dataInicio.value) corpo.dataInicio = f.dataInicio.value;
  if (f.dataFim.value) corpo.dataFim = f.dataFim.value;
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
  const replanejar = e.target.dataset.replanejar;
  const excluir = e.target.dataset.excluirPlano;
  if (replanejar) {
    const p = planosCache.find((x) => x._id === replanejar);
    const f = $('#form-plano');
    f.replanejarId.value = p._id;
    $('#sel-plano-curso').value = p.curso._id;
    atualizarDisciplinasPlano();
    $('#sel-plano-disciplina').value = p.disciplina?._id || '';
    $('#sel-plano-curso').disabled = true;
    $('#sel-plano-disciplina').disabled = true;
    f.periodicidade.value = p.periodicidade;
    f.horasPorPeriodo.value = p.horasPorPeriodo;
    f.dataInicio.value = hojeKey();
    f.dataFim.value = '';
    f.observacao.value = p.observacao || '';
    renderDistribuicao(Object.fromEntries(p.distribuicao.map((d) => [d.dia, d.horas])));
    $('#titulo-form-plano').textContent = `Refazer planejamento: ${nomePlano(p)}`;
    $('#btn-salvar-plano').textContent = 'Salvar novo planejamento';
    $('#btn-cancelar-replano').classList.remove('oculto');
    f.scrollIntoView({ behavior: 'smooth' });
  }
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

// ------------------------------------------------------------ acompanhamento
async function carregarPainel() {
  const itens = await api('/api/acompanhamento');
  const el = $('#painel-lista');
  if (!itens.length) {
    el.innerHTML = '<div class="cartao">Nenhum planejamento ativo. Crie um na aba <b>Planejamentos</b>.</div>';
    return;
  }
  el.innerHTML = itens
    .map(({ planejamento: p, resumo: r, hoje, pendencias }) => {
      const pct = Math.min(100, r.percentualConcluido);
      return `<div class="cartao">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
          <h2 style="margin:0">${esc(nomePlano(p))}</h2>${selo(r.situacao)}
        </div>
        <small class="dica">${PERIODICIDADE[p.periodicidade]} · ${dataBR(p.dataInicio)} a ${dataBR(p.dataFim)}</small>
        <div class="barra" title="${pct}% do planejamento"><span style="width:${pct}%"></span></div>
        <small class="dica">${horas(r.horasEstudadasTotal)} de ${horas(r.horasPlanejadasTotal)} (${r.percentualConcluido}%)</small>
        <div class="kpis">
          <div class="kpi"><b>${r.metasConcluidas}/${r.totalMetas}</b><small>metas concluídas</small></div>
          <div class="kpi"><b>${r.metasAtrasadas}</b><small>pendências</small></div>
          <div class="kpi"><b>${horas(r.horasPendentes)}</b><small>horas pendentes</small></div>
        </div>
        <div><b>Hoje:</b> ${
          hoje ? `${horas(hoje.horasEstudadas)} de ${horas(hoje.horasPlanejadas)} ${selo(hoje.situacao)}` : 'sem estudo planejado'
        }</div>
        ${
          pendencias.length
            ? `<ul class="pend">${pendencias
                .map(
                  (m) => `<li><span>${dataBR(m.data)} · ${horas(m.horasEstudadas)} de ${horas(m.horasPlanejadas)}</span>
                  <button class="mini" data-concluir="${m._id}" data-data="${m.data}" data-horas="${m.horasPlanejadas}">Marcar concluída</button></li>`
                )
                .join('')}</ul>`
            : ''
        }
      </div>`;
    })
    .join('');
}
carregadores.painel = carregarPainel;

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
    info.textContent = 'Nenhum planejamento ativo.';
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
    <h2>Estudando agora: ${esc(nomePlano(ativo.planejamento))}</h2>
    <div class="relogio" id="relogio">${relogio(ativo.segundosDecorridos)}</div>
    <p class="dica" id="restante"></p>
    <button class="primario" id="btn-finalizar">■ Finalizar</button>`;
  $('#btn-finalizar').addEventListener('click', finalizarSessao);
  const atualizar = () => {
    const passou = (Date.now() - ativoRecebidoEm) / 1000;
    const restante = ativo.segundosParaLimite - passou;
    $('#relogio').textContent = relogio(ativo.segundosDecorridos + Math.min(passou, ativo.segundosParaLimite));
    $('#restante').textContent = `Limite diário em ${relogio(restante)} — a sessão será finalizada automaticamente.`;
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
    await carregarEstudar();
  } catch (err) {
    avisar(err.message, 'erro');
    await carregarEstudar();
  }
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
