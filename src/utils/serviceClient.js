export async function postJson(url, payload, { timeoutMs = 7000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await safeJson(response);
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error?.message || `Servico respondeu ${response.status}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getJson(url, { timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    const body = await safeJson(response);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: { ok: false, error: { message: error.message } },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: { message: text } };
  }
}
