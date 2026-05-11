export class ResponseComposer {
  compose({ question, intent, knowledgeResults, externalStatus }) {
    const main = knowledgeResults[0]?.doc;
    const related = knowledgeResults.slice(1).map((item) => item.doc.title);

    const answer = [
      `Pergunta: ${question}`,
      "",
      main
        ? `${main.title}: ${main.text}`
        : "Ainda nao ha um item local suficiente para responder essa pergunta.",
      related.length ? `Conceitos relacionados: ${related.join(", ")}.` : "",
      "",
      "Observacao da Fase 1: esta resposta demonstra apenas a arquitetura distribuida e usa uma base local simples. As proximas fases adicionam recuperacao avancada, modelo generativo externo e protocolo de ferramentas.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      intent: intent.label,
      answer,
      composer: "phase1-template-composer",
      externalStatus,
    };
  }
}
