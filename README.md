# 📚 Gestão de Estudos

API REST + site Web para planejar e acompanhar estudos.

## O que é esta aplicação

Uma plataforma de gestão de estudos com 5 funcionalidades:

1. **Cadastro de curso**: nome, descrição e, opcionalmente, período (início/fim) e validade.
2. **Cadastro de disciplina**: cada disciplina pertence a um curso.
3. **Planejamento de estudo**: quantas horas dedicar a um curso ou disciplina, com periodicidade diária, semanal ou mensal e distribuição das horas pelos dias. O sistema gera uma **meta diária** para cada dia com estudo.
4. **Registro de horas estudadas**: cronômetro que conta o tempo na meta do dia até o usuário finalizar ou até atingir o limite diário (aí a sessão é finalizada automaticamente).
5. **Metas concluídas**: acompanhamento do planejado x realizado, lista de metas concluídas e de pendências, conclusão retroativa de metas e replanejamento.

**Tecnologias:** Node.js, Express 5, Mongoose, [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) (MongoDB em memória), Swagger UI (`swagger-ui-express`) e um frontend em HTML/CSS/JavaScript puro, servido pelo próprio Express.

## Como instalar

Pré-requisitos: **Node.js 18 ou superior** e npm.

```bash
git clone https://github.com/<seu-usuario>/projeto-gestao-de-estudos.git
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
| Documentação Swagger (renderizada) | http://localhost:3000/api-docs |
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
| Desenvolvimento Web Full Stack | hoje − 10 dias | hoje + 80 dias | hoje + 365 dias |

**Disciplinas (3)**, todas do curso acima:

| Disciplina | Carga horária |
| --- | --- |
| Lógica de Programação com JavaScript | 40h |
| Desenvolvimento de APIs com Node.js | 60h |
| Banco de Dados NoSQL com MongoDB | 30h |

**Planejamentos**, para demonstrar as regras:

| Disciplina | Planejamento | Para que serve |
| --- | --- | --- |
| Lógica de Programação com JavaScript | Diário, 1h/dia, de hoje − 5 a hoje + 24 | Tem histórico: 3 metas concluídas, 1 parcial (0,5h) e 1 não informada. Aparece **com pendências** e permite testar a conclusão retroativa. |
| Desenvolvimento de APIs com Node.js | Semanal, 6h/semana (seg, qua e sex com 2h cada), 4 semanas | Exemplo de distribuição semanal. |
| Banco de Dados NoSQL com MongoDB | Diário, 0,05h (3 minutos) por dia, 7 dias | Permite ver o **encerramento automático** do registro ao atingir o limite diário em poucos minutos. |

## Regras de negócio

1. **Um curso possui várias disciplinas.** Toda disciplina pertence a um curso (`curso` obrigatório). Excluir um curso exclui suas disciplinas.
2. **Período e validade do curso são opcionais.** `dataInicio`, `dataFim` e `validade` podem ser omitidos. Quando informados:
   - `dataFim` não pode ser anterior a `dataInicio`;
   - o planejamento precisa caber no período do curso e terminar até a validade;
   - não é possível planejar um curso com validade vencida.
3. **Planejamento de horas.** O usuário informa o alvo (curso inteiro ou uma disciplina), `horasPorPeriodo`, a `periodicidade` e a `distribuicao` das horas pelos dias:
   - **diário**: as horas valem para todos os dias (máx. 24h/dia);
   - **semanal**: `distribuicao[].dia` é o dia da semana (0 = domingo … 6 = sábado). Sem distribuição, as horas são divididas igualmente de segunda a sexta;
   - **mensal**: `distribuicao[].dia` é o dia do mês (1–31; um dia que não existe no mês, como 31/02, vai para o último dia). Sem distribuição, as horas são divididas entre os dias úteis de cada mês;
   - a soma da distribuição deve ser igual a `horasPorPeriodo`;
   - sem `dataFim`, o padrão é 30 dias (diário), 4 semanas (semanal) ou 3 meses (mensal), limitado ao fim do curso; um planejamento tem no máximo 366 dias;
   - só pode haver **um planejamento ativo** por curso/disciplina (para mudar, use o replanejamento);
   - cada dia com horas vira uma **meta** (`data`, horas planejadas, horas estudadas).
4. **Registro de estudo.** Ao iniciar, o tempo passa a contar na meta de hoje do planejamento até:
   - o usuário **finalizar**, ou
   - o tempo atingir o **limite diário** (horas planejadas − horas já estudadas no dia). Aí o registro é **finalizado automaticamente** (`finalizado_automaticamente`).

   Só existe um registro em andamento por vez; não dá para iniciar se não houver meta hoje ou se o limite do dia já foi atingido. A meta é concluída quando as horas estudadas atingem as planejadas.
5. **Acompanhamento.** Para cada planejamento, o sistema compara o planejado com o realizado e indica a situação:
   - `com_pendencias`: há metas de dias anteriores não concluídas;
   - `em_dia`: nenhuma pendência;
   - `adiantado`: estudou mais do que o planejado até hoje.

   Também mostra percentual concluído, horas pendentes e a lista de metas atrasadas.
6. **Conclusão retroativa.** Uma meta de um dia que **já passou** e não foi concluída pode ser marcada como concluída (`PATCH /api/metas/{id}/concluir`), informando opcionalmente as horas estudadas (padrão: as planejadas) e uma observação. Ela fica com situação `concluida_retroativamente`. Metas de hoje ou futuras não podem ser concluídas assim: para elas use o registro de estudo.
7. **Replanejamento.** `POST /api/planejamentos/{id}/replanejar` cria um novo planejamento para o mesmo alvo:
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
