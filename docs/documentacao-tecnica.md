# Documentação Técnica - Assistente F1

## Visão Geral

O Assistente F1 é um sistema inteligente distribuído em Node.js/JavaScript que responde perguntas sobre Fórmula 1 com apoio de três capacidades centrais:

- **RAG (Retrieval-Augmented Generation)** para consultar uma base documental real antes de responder.
- **MCP (Model Context Protocol)** para integrar ferramentas externas de dados ao vivo.
- **Saga Pattern** para atualizar e manter a base de conhecimento e os caches externos com compensação em caso de falha.

O objetivo do projeto é demonstrar, em um cenário realista, como serviços independentes podem cooperar para entregar respostas úteis, consistentes e auditáveis.

## Problema Resolvido

O sistema atende estudantes e fãs de Fórmula 1 que precisam entender regras, penalidades, procedimentos e eventos de corrida sem depender apenas de interpretação informal. Além disso, quando necessário, o sistema consulta dados externos como classificação, clima e mensagens da Race Control.

O ganho prático é combinar:

- interpretação de documentos oficiais,
- acesso a dados ao vivo,
- e uma interface simples de consulta em formato de chat.

## Arquitetura Distribuída

O projeto é organizado como uma arquitetura distribuída com múltiplos serviços REST independentes:

| Serviço | Porta | Responsabilidade |
| --- | ---: | --- |
| Gateway Service | 3000 | Entrada pública do sistema, serve o front e repassa requisições. |
| Orchestrator Service | 3001 | Coordena o fluxo de consulta, aciona RAG, MCP, LLM e a Saga. |
| Knowledge Base Service | 3002 | Mantém a base documental, faz chunking, indexação e busca vetorial. |
| External API Service | 3003 | Expõe ferramentas MCP e mantém cache snapshot dos dados externos. |
| Explanation Service | 3004 | Gera a resposta final com LLM ou fallback. |

Essa separação existe para isolar responsabilidades, facilitar evolução independente dos componentes e demonstrar distribuição real no trabalho acadêmico.

## Fluxo de Consulta

Quando o usuário faz uma pergunta, o caminho é o seguinte:

1. O Front envia `POST /api/ask` ao Gateway.
2. O Gateway repassa a pergunta para o Orchestrator.
3. O Orchestrator classifica a intenção da pergunta.
4. O Orchestrator consulta o Knowledge Base Service para recuperar os trechos mais relevantes.
5. Se a pergunta exigir dados ao vivo, o Orchestrator invoca ferramentas MCP no External API Service.
6. O Orchestrator envia contexto documental + dados externos para o Explanation Service.
7. O Explanation Service gera a resposta final com LLM ou fallback.
8. O Gateway devolve a resposta ao Front.

Esse fluxo é síncrono e foi pensado para manter baixa latência de resposta ao usuário.

## RAG

O RAG é a base cognitiva do sistema. Ele evita respostas genéricas, pois obriga a consulta a documentos reais antes da geração da resposta.

### Base documental

A base vem de `src/data/f1-documents.json`, contendo trechos sobre:

- track limits,
- DRS,
- Safety Car,
- Virtual Safety Car,
- penalidades,
- parc ferme,
- pneus,
- grid e largada,
- regras de ultrapassagem,
- bandeiras,
- budget cap,
- e outros tópicos de regulamentação.

### Chunking

Antes de indexar, os documentos são quebrados em trechos menores. Isso melhora a recuperação porque:

- reduz ruído em documentos longos,
- aumenta a precisão do trecho recuperado,
- e melhora a chance de o contexto enviado ao LLM conter a informação exata.

### Vetorização e busca

O sistema usa `@xenova/transformers` com o modelo `all-MiniLM-L6-v2` para gerar embeddings locais. O fluxo é:

1. Os chunks são convertidos em embeddings.
2. A pergunta do usuário também é convertida em embedding.
3. A similaridade cosseno é calculada entre a pergunta e os chunks.
4. Os resultados são ranqueados e enriquecidos com regras de relevância textual e termos técnicos de Fórmula 1.

### Persistência e snapshot

O índice vetorial é persistido localmente em snapshot para permitir:

- carregamento rápido após reinício,
- atualização controlada,
- e integração com o fluxo Saga.

### Serviço responsável

- [src/services/knowledgeBaseService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/knowledgeBaseService.js)
- [src/core/knowledgeSearch.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/core/knowledgeSearch.js)
- [src/core/documentChunker.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/core/documentChunker.js)
- [src/core/vectorStore.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/core/vectorStore.js)

## MCP

O projeto integra ferramentas externas usando o conceito de Model Context Protocol.

### O que o MCP faz aqui

O External API Service atua como MCP Server e expõe ferramentas para:

- classificação de pilotos,
- classificação de construtores,
- mensagens da Race Control,
- clima do circuito,
- informações da sessão.

### Como o Orchestrator decide a ferramenta

A seleção é feita por contexto da pergunta. O orquestrador usa intenção + análise textual para decidir quais ferramentas chamar. Isso evita depender apenas de um mapeamento rígido e melhora a cobertura de consultas compostas.

### Fonte dos dados

As ferramentas tentam consultar RapidAPI. Quando o dado ao vivo não está disponível, o sistema usa fallback para snapshot ou para dados de demonstração, mantendo a experiência funcional.

### Serviços e arquivos relevantes

- [src/services/externalApiService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/externalApiService.js)
- [src/mcp/mcpServer.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/mcp/mcpServer.js)
- [src/mcp/mcpClient.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/mcp/mcpClient.js)
- [src/mcp/f1Tools.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/mcp/f1Tools.js)

## Saga Pattern

A Saga foi adicionada para resolver o problema de manutenção distribuída da base e dos caches externos sem comprometer a disponibilidade do sistema.

### Onde a Saga se aplica

Ela não é usada para a consulta do chat. A consulta continua síncrona. A Saga é usada para:

- atualizar o índice vetorial da base de conhecimento,
- atualizar o cache dos dados MCP,
- e garantir rollback se alguma etapa falhar.

### Etapas da Saga

1. O usuário aciona a atualização da base pela interface ou pela API.
2. O Orchestrator inicia o staging do índice vetorial no Knowledge Base Service.
3. O Orchestrator inicia o staging do cache no External API Service.
4. Se os dois preparos forem bem-sucedidos, os snapshots são promovidos para a versão ativa.
5. Se algo falhar, o Orchestrator aciona rollback nos serviços já envolvidos.
6. A última versão válida permanece disponível.

### Compensações

As compensações garantem consistência:

- remoção de snapshot staged parcial,
- restauração da versão anterior do índice,
- restauração do cache anterior,
- preservação da base ativa se o commit falhar.

### Benefício técnico

Esse desenho demonstra um uso real de Saga Pattern porque existe:

- etapa distribuída,
- estado intermediário,
- commit controlado,
- rollback compensatório,
- e preservação de consistência eventual/operacional.

### Serviços e arquivos relevantes

- [src/services/orchestratorService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/orchestratorService.js)
- [src/services/gatewayService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/gatewayService.js)
- [src/services/knowledgeBaseService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/knowledgeBaseService.js)
- [src/services/externalApiService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/externalApiService.js)

## Geração da Resposta

Depois da recuperação documental e da consulta a ferramentas externas, o Explanation Service monta o contexto final e envia ao LLM.

### Comportamento

- Se a API do Groq estiver configurada, a resposta é gerada pelo modelo.
- Se a API não estiver disponível, o sistema usa um fallback textual.
- Em ambos os casos, o usuário recebe uma resposta baseada nos dados recuperados.

### Metadados retornados

As respostas incluem, quando aplicável:

- modelo utilizado,
- fontes RAG,
- ferramentas MCP acionadas,
- tempo de execução,
- fluxo de serviços percorrido.

### Serviço responsável

- [src/services/explanationService.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/src/services/explanationService.js)

## Interface do Usuário

A interface foi construída como um chat em Vue 3.

### Elementos principais

- painel lateral com status do gateway e do MCP,
- botão para executar a Saga de manutenção,
- lista de perguntas rápidas,
- chat central com histórico de mensagens,
- metadados por resposta com fontes, ferramentas e fluxo.

### Arquivos

- [public/index.html](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/public/index.html)
- [public/app.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/public/app.js)
- [public/styles.css](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/public/styles.css)

## Validação

O projeto inclui validação automatizada por smoke test.

### O que o smoke test cobre

- geração de embeddings,
- busca vetorial da base,
- classificação de intenção,
- ferramentas MCP,
- Saga de conhecimento,
- Saga de cache externo.

### Arquivo

- [scripts/smoke-test.js](/home/avelaralencar/Desktop/sd/trabalho/Assistente-F1/scripts/smoke-test.js)

## Conclusão

O Assistente F1 entrega uma arquitetura distribuída completa para apoio à interpretação de regras da Fórmula 1. O RAG garante consulta a documentos reais, o MCP acrescenta dados externos úteis e a Saga resolve a manutenção distribuída da base sem comprometer a operação do sistema.

Essa combinação é o principal valor técnico do projeto e a melhor evidência de aderência aos requisitos do trabalho.