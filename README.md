# 📚 Gestão de Estudos

API REST + site Web para planejar e acompanhar estudos.

## O que é esta aplicação

Uma plataforma de gestão de estudos com 5 funcionalidades:

1. **Cadastro de curso**: nome, descrição e, opcionalmente, período (início/fim) e validade.
2. **Cadastro de disciplina**: nome e descrição da disciplina; cada disciplina pertence a um curso.
3. **Planejamento de estudo**: quantas horas por dia dedicar a um curso ou disciplina, se o planejamento é semanal ou mensal e em quais dias da semana. O sistema gera uma **meta diária** para cada dia de estudo.
4. **Registro de horas estudadas**: cronômetro que conta o tempo na meta do dia até o usuário finalizar ou até atingir o limite diário (aí a sessão é finalizada automaticamente).
5. **Metas concluídas**: acompanhamento do planejado x realizado, lista de metas concluídas e de pendências, conclusão retroativa de metas e replanejamento.

**Tecnologias:** Node.js, Express 5, Mongoose, [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) (MongoDB em memória), Swagger UI (`swagger-ui-express`) e um frontend em HTML/CSS/JavaScript puro, servido pelo próprio Express.

**Site:** menu lateral (Início, Estudar, Planejamentos, Metas, Cursos e Disciplinas), tema **claro ou escuro** (botão no rodapé do menu; a escolha fica salva no navegador) e o botão **Adicionar tarefa** na tela inicial, que abre o formulário de novo planejamento de estudo. No celular, o menu vira uma barra no topo com o botão ☰.

## Como instalar

Pré-requisitos: **Node.js 18 ou superior** e npm.

```bash
git clone https://github.com/ElizabethRodrigues/projeto-gestao-de-estudos.git
cd projeto-gestao-de-estudos
npm install
```

> Na primeira execução o `mongodb-memory-server` baixa o binário do MongoDB (~100 MB) e o guarda em cache. As execuções seguintes são rápidas.

## Como executar

```bash
npm start
```

Ou, com recarga automática ao editar arquivos:

```bash
npm run dev
```

A porta padrão é `3000`. Para usar outra, defina a variável `PORT` (ex.: `PORT=8080 npm start`).

> O banco é **em memória**: todos os dados são apagados quando o servidor para, e os dados de teste são recriados a cada inicialização.

## URLs importantes

| O quê | URL |
| --- | --- |
| Site Web | http://localhost:3000 |
| API REST (base) | http://localhost:3000/api |
| Documentação Swagger (renderizada; não tem link no site) | http://localhost:3000/api-docs |
| Arquivo YAML da especificação | http://localhost:3000/api-docs/swagger.yaml |
| Health check | http://localhost:3000/api/health |

### Principais endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET/POST | `/api/cursos` | Lista / cadastra cursos |
| GET/PUT/DELETE | `/api/cursos/{id}` | Consulta / altera / exclui curso |
| GET/POST | `/api/disciplinas` | Lista (filtro `?curso=`) / cadastra disciplinas |
| GET/PUT/DELETE | `/api/disciplinas/{id}` | Consulta / altera / exclui disciplina |
| GET/POST | `/api/planejamentos` | Lista / cria planejamentos |
| GET/DELETE | `/api/planejamentos/{id}` | Consulta (com metas) / exclui planejamento |
| POST | `/api/planejamentos/{id}/replanejar` | Refaz o planejamento |
| GET | `/api/planejamentos/{id}/acompanhamento` | Planejado x realizado de um planejamento |
| GET | `/api/acompanhamento` | Acompanhamento de todos os planejamentos ativos |
| POST | `/api/registros/iniciar` | Inicia o registro de estudo |
| POST | `/api/registros/{id}/finalizar` | Finaliza o registro |
| GET | `/api/registros`, `/api/registros/ativo` | Histórico / sessão em andamento |
| GET | `/api/metas?situacao=concluida` | Metas concluídas (também `atrasada`, `hoje`, `futura`, `concluida_retroativamente`) |
| PATCH | `/api/metas/{id}/concluir` | Conclui uma meta de um dia que já passou |

A especificação completa (corpos, respostas e exemplos) está em [`docs/swagger.yaml`](docs/swagger.yaml).

## Dados de teste incluídos

Carregados automaticamente ao iniciar (`src/seed.js`). As datas são **relativas ao dia em que o servidor sobe**.

**Curso**

| Nome | Início | Fim | Validade |
| --- | --- | --- | --- |
| Desenvolvimento Web | hoje − 30 dias | hoje + 90 dias | hoje + 365 dias |

**Disciplinas (3)**, todas do curso acima:

- Introdução ao Desenvolvimento Web
- Lógica de Programação
- HTML5 e Semântica Web

**Planejamentos (2)**, ambos inteiramente no passado. As metas são geradas a partir do planejamento, e **nenhuma meta é cadastrada para hoje ou para o futuro**:

| Disciplina | Planejamento | Situação |
| --- | --- | --- |
| Introdução ao Desenvolvimento Web | Semanal, 1 semana, 1h/dia de segunda a sexta, de hoje − 21 a hoje − 15 (5 metas) | **Concluído**: todas as metas foram cumpridas. |
| Lógica de Programação | Semanal, 1 semana, 1,5h/dia de segunda a sexta, de hoje − 7 a ontem (5 metas) | **Atrasado**: 2 metas concluídas, 1 parcial (0,75h) e 2 não informadas. Serve para testar a conclusão retroativa. |

A disciplina *HTML5 e Semântica Web* não tem planejamento. Use-a para criar o seu e testar o registro de estudo.

## Regras de negócio

1. **Um curso possui várias disciplinas.** Toda disciplina pertence a um curso (`curso` obrigatório). Excluir um curso exclui suas disciplinas.
2. **Período e validade do curso são opcionais.** `dataInicio`, `dataFim` e `validade` podem ser omitidos. Quando informados:
   - `dataFim` não pode ser anterior a `dataInicio`;
   - o planejamento precisa caber no período do curso e terminar até a validade;
   - não é possível planejar um curso com validade vencida.
3. **Planejamento de horas.** No planejamento de estudo, o usuário informa quantas **horas por dia** vai dedicar ao curso ou à disciplina e se o planejamento é **semanal** ou **mensal**. As horas são definidas aqui, não no cadastro da disciplina.
   - `horasPorDia`: de 0,01 a 24;
   - `periodicidade`: `semanal` ou `mensal`;
   - `duracao`: quantas semanas (1 a 52) ou meses (1 a 12). Padrão: 1;
   - `diasSemana`: em quais dias da semana haverá estudo (0 = domingo … 6 = sábado). Padrão: segunda a sexta;
   - `dataInicio` (padrão: hoje). A data de fim é calculada: início + N semanas ou N meses − 1 dia;
   - só pode haver **um planejamento em andamento (não concluído)** por curso/disciplina (para mudar, use o replanejamento). Depois que um planejamento é concluído, é possível criar um novo para o mesmo curso/disciplina;
   - cada dia de estudo do período vira uma **meta** com as horas por dia planejadas.
4. **Registro de estudo.** Ao iniciar, o tempo passa a contar na meta de hoje do planejamento até:
   - o usuário **finalizar**, ou
   - o tempo atingir o **limite diário** (horas planejadas − horas já estudadas no dia). Aí o registro é **finalizado automaticamente** (`finalizado_automaticamente`).

   Só existe um registro em andamento por vez; não dá para iniciar se não houver meta hoje ou se o limite do dia já foi atingido. A meta é concluída quando as horas estudadas atingem as planejadas.
5. **Acompanhamento.** Para cada planejamento, o sistema compara o planejado com o realizado e indica a situação:
   - `concluido`: todas as metas do planejamento foram cumpridas;
   - `com_pendencias` (atrasado): há metas de dias anteriores não concluídas;
   - `em_dia`: nenhuma pendência;
   - `adiantado`: estudou mais do que o planejado até hoje.

   Também mostra percentual concluído, horas pendentes e a lista de metas atrasadas.
6. **Conclusão retroativa.** Uma meta de um dia que **já passou** e não foi concluída pode ser marcada como concluída (`PATCH /api/metas/{id}/concluir`), informando opcionalmente as horas estudadas (padrão: as planejadas) e uma observação. Ela fica com situação `concluida_retroativamente`. Metas de hoje ou futuras não podem ser concluídas assim: para elas use o registro de estudo.
7. **Replanejamento.** É possível refazer um planejamento **que ainda não foi concluído**. `POST /api/planejamentos/{id}/replanejar` cria um novo planejamento para o mesmo alvo:
   - só vale para planejamentos ativos com pelo menos uma meta não cumprida. Um planejamento concluído (todas as metas cumpridas) retorna `422` e não mostra o botão **Refazer planejamento** no site. O campo `podeRefazer` da API indica se a ação está disponível;
   - no site, o botão fica em cada card da tela inicial e abaixo do nome na aba Planejamentos, e abre o formulário já preenchido;
   - o anterior fica com status `substituido` (com `substituidoPor`), e o novo aponta para ele em `substitui`;
   - o histórico é preservado: metas passadas e registros continuam no planejamento antigo, e só as metas de hoje em diante sem estudo são removidas;
   - campos não enviados são herdados do anterior; `dataInicio` padrão é hoje;
   - um registro em andamento do planejamento antigo é finalizado.

## Estrutura do projeto

```
├── docs/swagger.yaml          # Especificação OpenAPI 3 da API
├── public/                    # Site Web (HTML, CSS e JS puro)
└── src/
    ├── server.js              # Inicialização (banco em memória + seed + HTTP)
    ├── app.js                 # Express: rotas, Swagger, site estático, erros
    ├── db.js                  # mongodb-memory-server + Mongoose
    ├── seed.js                # Dados de teste
    ├── models/                # Curso, Disciplina, Planejamento, Meta, Registro
    ├── routes/                # Rotas REST
    ├── services/              # Regras de negócio
    └── utils/                 # Datas e erros
```
