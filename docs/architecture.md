# Arquitetura - Fase 1

## Problema escolhido

Fas e estudantes veem termos e decisoes da Formula 1 durante uma corrida, mas nem sempre entendem a regra por tras do evento.

Exemplos de perguntas:

- "O que e track limits?"
- "Por que um piloto recebeu 5 segundos?"
- "Qual a diferenca entre safety car e virtual safety car?"
- "O que e undercut?"

## Escopo desta fase

Esta fase implementa somente a arquitetura distribuida. O objetivo e mostrar componentes separados, comunicacao REST e fluxo de dados.

Nao fazem parte desta fase:

- RAG real.
- Busca vetorial.
- Modelo generativo externo.
- MCP.
- Invocacao real da RapidAPI como ferramenta.

## Componentes

- **Front Web**: interface em chat para o usuario.
- **Gateway Service, porta 3000**: entrada publica do sistema.
- **Orchestrator Service, porta 3001**: coordena os demais servicos.
- **Knowledge Base Service, porta 3002**: consulta base local simples de conceitos F1.
- **External API Service, porta 3003**: representa a API externa prevista na arquitetura.
- **Explanation Service, porta 3004**: compoe uma resposta textual com template.

## Fluxo de dados

1. Usuario envia pergunta no Front.
2. Front envia `POST /api/ask` para o Gateway Service.
3. Gateway repassa para o Orchestrator Service.
4. Orquestrador classifica a intencao da pergunta.
5. Orquestrador chama o Knowledge Base Service.
6. Orquestrador consulta o status do External API Service.
7. Orquestrador chama o Explanation Service.
8. Gateway devolve a resposta ao Front.

## Tecnologias utilizadas

- JavaScript.
- Node.js.
- Vue 3 no front-end.
- REST via HTTP nativo do Node.
- Fetch nativo do Node.
- Microservicos locais em portas separadas.

## Diagrama

Veja `docs/architecture.mmd`.
