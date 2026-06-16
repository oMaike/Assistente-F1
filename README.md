# Assistente F1 - Sistemas Distribuidos

<img src="docs/app-preview.png" alt="Tela do Assistente F1 funcionando" width="900">

**Legenda do print:** a lateral esquerda mostra o estado dos componentes da arquitetura; a area central e o chat usado pelo usuario; o campo inferior envia a pergunta para o Gateway, que encaminha a requisicao para os microservicos.

Entrega atual: **Fase 3: RAG + MCP + LLM + Saga**.

O projeto demonstra uma arquitetura em JavaScript/Node.js com multiplos componentes se comunicando por REST, integrando RAG (busca vetorial com documentos reais), MCP (Model Context Protocol com ferramentas externas), LLM (Groq API) e um fluxo Saga com compensacao para atualizar a base de conhecimento. O tema e Formula 1.

## Material de referencia

- [PDF-base da arquitetura](arq_sistemas_distribuidos.pdf): esboço original usado como referencia.
- [Diagrama da arquitetura](docs/architecture.mmd): diagrama Mermaid da arquitetura Fase 2.
- [Plano de ensino](Plano%20de%20Ensino%20e%20descrção%20Trabalho%202026%201.pdf): descricao completa do trabalho pratico.

## Como rodar

```bash
npm run dev
```

Depois abra:

```text
http://localhost:3000
```

### Configurar LLM (opcional mas recomendado)

Crie um arquivo `.env` na raiz com sua chave Groq:

```bash
LLM_API_KEY=gsk_sua_chave_aqui
```

Sem a chave, o sistema funciona em modo fallback (template sem LLM).

### Configurar RapidAPI (opcional)

Para usar dados ao vivo da Formula 1 via RapidAPI, adicione ao `.env`:

```bash
RAPIDAPI_KEY=sua_chave_rapidapi
RAPIDAPI_HOST=f1-live-pulse.p.rapidapi.com
```

Sem a chave, as ferramentas MCP retornam dados de demonstracao.

## O que esta implementado na Fase 3

- **Front-end em Vue 3** no formato de chat.
- **Gateway publico** em `localhost:3000`.
- **Orchestrator** em `localhost:3001` (coordena RAG, MCP, LLM e Saga).
- **Knowledge Base Service** em `localhost:3002` com RAG real:
  - Documentos reais de regulamentos FIA em `src/data/f1-documents.json`
  - Chunking dos documentos para recuperar trechos mais precisos
  - Embeddings locais com `@xenova/transformers` (all-MiniLM-L6-v2)
  - Busca vetorial por similaridade cosseno
- **External API Service** em `localhost:3003` como MCP Server:
  - Exposicao de ferramentas via Model Context Protocol
  - Ferramentas: classificacao de pilotos, classificacao de construtores, mensagens da Race Control, clima, informacoes da sessao
  - Integracao com RapidAPI F1 (com fallback para cache/snapshot e dados demo)
- **Explanation Service** em `localhost:3004` com LLM:
  - Integracao com Groq API (modelo llama-3.3-70b-versatile)
  - Prompts com contexto RAG e dados MCP
  - Fallback para template se LLM nao estiver configurado
- **Saga de manutencao distribuida**:
  - Orchestrator inicia a atualizacao da base de conhecimento e do cache externo
  - Knowledge Base Service prepara, publica e compensa o indice vetorial
  - External API Service prepara, publica e compensa o cache de dados F1
  - O front exibe o estado da saga e permite acionar a atualizacao da base
- Comunicacao REST entre todos os servicos.
- Documentacao e diagrama de arquitetura em `docs/`.

## O que nao esta implementado agora

- Modelo generativo proprio (usa API externa Groq).
- Fila/eventos assincronos genericos para todo o sistema.

## Saga de manutencao

O sistema usa Saga para a manutencao distribuida da base:

1. O orquestrador recebe o comando de atualizacao.
2. O Knowledge Base Service cria um snapshot staged do indice vetorial.
3. O External API Service cria um snapshot staged do cache de ferramentas.
4. Se os passos de staging funcionarem, o orquestrador publica os snapshots.
5. Se algo falhar, o orquestrador chama rollback e o sistema preserva a ultima versao valida.

Esse fluxo nao substitui a consulta do usuario. Ele existe para manter a base e os caches consistentes sem quebrar a operacao.

## Microservicos

| Servico | Porta | Responsabilidade na Fase 2 |
| --- | ---: | --- |
| Gateway Service | 3000 | Serve o front e recebe `/api/ask` e `/api/saga/reindex`. |
| Orchestrator Service | 3001 | Coordena RAG, MCP, LLM e Saga. |
| Knowledge Base Service | 3002 | RAG: documentos reais + chunking + embeddings + busca vetorial. |
| External API Service | 3003 | MCP Server com ferramentas RapidAPI F1 e cache snapshot da Saga. |
| Explanation Service | 3004 | LLM (Groq) com prompts de RAG + MCP. |

**Legenda dos microservicos:** cada linha da tabela representa um processo Node separado. A separacao existe para demonstrar arquitetura distribuida, mesmo rodando tudo localmente.

## Estrutura

```text
src/
  core/            classificacao, embedder, chunking, busca vetorial, cliente LLM
  data/            documentos reais de regulamentos FIA
  mcp/             servidor MCP, cliente MCP, ferramentas F1 e cache da Saga
  services/        microservicos Node independentes
  utils/           helpers de HTTP/JSON
public/            interface de chat em Vue
docs/              arquitetura e diagrama
```

## Demonstração

Use o botao **Atualizar base** na lateral esquerda para executar a Saga de manutencao. A resposta do chat continua funcionando normalmente para consultas de regras, penalidades, clima e classificacao.
