export function classifyIntent(question) {
  const normalized = normalize(question);

  if (hasAny(normalized, ["standings", "classificacao", "pontos", "campeonato"])) {
    return { type: "standings", label: "classificacao" };
  }

  if (hasAny(normalized, ["chuva", "chover", "chove", "chovendo", "clima", "weather", "temperatura"])) {
    return { type: "weather", label: "clima" };
  }

  if (hasAny(normalized, ["penalidade", "punicao", "penalty", "5 segundos", "10 segundos"])) {
    return { type: "penalty", label: "penalidade" };
  }

  return { type: "rule", label: "conceito/regra" };
}

export function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term));
}
