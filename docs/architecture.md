# Arquitetura - Fase 2

## Problema escolhido

Fas e estudantes veem termos e decisoes da Formula 1 durante uma corrida, mas nem sempre entendem a regra por tras do evento.

## Escopo desta fase

Esta fase implementa:
- **RAG (Retrieval-Augmented Generation)**: base de conhecimento com documentos reais de regulamentos FIA e busca vetorial por embeddings.
- **MCP (Model Context Protocol)**: integracao com ferramentas externas (RapidAPI F1) via protocolo MCP.
- **LLM (Large Language Model)**: uso do Groq API (llama3-70b) para gerar respostas contextualizadas.

## Componentes

- **Front Web**: interface em chat para o usuario.
- **Gateway Service, porta 3000**: entrada publica do sistema.
- **Orchestrator Service, porta 3001**: coordena RAG, MCP e LLM.
- **Knowledge Base Service, porta 3002**: RAG com documentos reais + embeddings + busca vetorial.
- **External API Service, porta 3003**: MCP Server com ferramentas RapidAPI F1.
- **Explanation Service, porta 3004**: LLM (Groq) que compoe respostas com contexto RAG e dados MCP.

## Fluxo de dados

1. Usuario envia pergunta no Front.
2. Front envia `POST /api/ask` para o Gateway Service.
3. Gateway repassa para o Orchestrator Service.
4. Orquestrador classifica a intencao da pergunta.
5. Orquestrador chama o Knowledge Base Service (RAG - busca vetorial por embeddings).
6. Se a intencao exigir dados ao vivo (classificacao, clima, etc.), o Orquestrador usa o MCP Client para invocar ferramentas no External API Service.
7. Orquestrador chama o Explanation Service com todo o contexto.
8. Explanation Service usa LLM (Groq) para gerar a resposta final.
9. Gateway devolve a resposta ao Front.

## Tecnologias utilizadas

- JavaScript / Node.js >= 20.
- Vue 3 no front-end.
- REST via HTTP nativo do Node.
- `@xenova/transformers` para embeddings locais (all-MiniLM-L6-v2).
- `@modelcontextprotocol/sdk` para MCP.
- Groq API (OpenAI-compatible) para LLM.

## Diagrama

Veja `docs/architecture.mmd`.
