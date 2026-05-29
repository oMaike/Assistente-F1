import { config } from "../config.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export async function generateChatCompletion({
  messages,
  model = config.llm?.model || "llama3-70b-8192",
  temperature = 0.5,
  maxTokens = 1024,
}) {
  const apiKey = config.llm?.apiKey;
  if (!apiKey) {
    throw new Error("LLM_API_KEY nao configurada. Configure a variavel de ambiente LLM_API_KEY.");
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `LLM respondeu ${response.status}`);
  }

  return {
    content: data.choices[0]?.message?.content || "",
    usage: data.usage,
    model: data.model,
  };
}
