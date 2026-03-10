const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
  provider: "cerebras" | "nvidia";
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callCerebras(messages: ChatMessage[], maxTokens = 500): Promise<AIResponse> {
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cerebras error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    provider: "cerebras",
    model: "gpt-oss-120b",
    usage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    } : undefined,
  };
}

async function callNvidia(messages: ChatMessage[], maxTokens = 500): Promise<AIResponse> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    provider: "nvidia",
    model: "meta/llama-3.1-8b-instruct",
    usage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    } : undefined,
  };
}

export async function chatWithAI(messages: ChatMessage[], maxTokens = 500): Promise<AIResponse> {
  // Primary: Cerebras (fastest)
  if (CEREBRAS_API_KEY) {
    try {
      return await callCerebras(messages, maxTokens);
    } catch (e) {
      console.error("Cerebras failed, falling back to NVIDIA:", e);
    }
  }

  // Fallback: NVIDIA
  if (NVIDIA_API_KEY) {
    try {
      return await callNvidia(messages, maxTokens);
    } catch (e) {
      console.error("NVIDIA also failed:", e);
    }
  }

  throw new Error("No AI provider available");
}
