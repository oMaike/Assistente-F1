# Assistente F1 - Sistemas Distribuidos

Entrega atual restrita a **Fase 1: Arquitetura distribuida**.

O projeto demonstra uma arquitetura em JavaScript/Node.js com multiplos componentes se comunicando por REST. Ele usa o tema de Formula 1 para mostrar o fluxo entre front-end, gateway, controle, base de conhecimento local, componente externo planejado e servico de composicao de resposta.

Importante: **RAG, modelo generativo externo e MCP nao estao implementados nesta fase**. Esses itens ficam para as Fases 2 e 3.

## Como rodar

```bash
npm run dev
```

Depois abra:

```text
http://localhost:3000
```

## O que esta implementado na Fase 1

- Front-end em Vue 3 no formato de chat.
- Gateway publico em `localhost:3000`.
- Orquestrador em `localhost:3001`.
- Knowledge Base Service em `localhost:3002`.
- External API Service em `localhost:3003`.
- Explanation Service em `localhost:3004`.
- Comunicacao REST entre os servicos.
- Documentacao e diagrama de arquitetura em `docs/`.

## O que nao esta implementado agora

- RAG real.
- Busca vetorial.
- Modelo generativo externo.
- MCP.
- Invocacao da RapidAPI como ferramenta do modelo.
- Filas/eventos.

## Microservicos

| Servico | Porta | Responsabilidade na Fase 1 |
| --- | ---: | --- |
| Gateway Service | 3000 | Serve o front e recebe `/api/ask`. |
| Orchestrator Service | 3001 | Coordena os componentes distribuidos. |
| Knowledge Base Service | 3002 | Consulta uma base local simples de conceitos F1. |
| External API Service | 3003 | Representa a API externa prevista na arquitetura. |
| Explanation Service | 3004 | Monta uma resposta textual com template. |

## Estrutura

```text
src/
  core/            classificacao, busca local e composicao de resposta
  services/        microservicos Node independentes
  utils/           helpers de HTTP/JSON
public/            interface de chat em Vue
docs/              arquitetura e diagrama
```

## Proximas fases

Fase 2: substituir a base local por RAG real com documentos e mecanismo de recuperacao.

Fase 3: integrar ferramenta externa usando MCP, permitindo que o modelo invoque a ferramenta quando necessario.
