import { Injectable, Logger } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequestOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  content: string;
  usedFallback: boolean;
}

export interface EmbeddingResponse {
  embedding: number[];
  usedFallback: boolean;
}

/**
 * Shared LLM client with token budgeting, context trimming, and graceful fallbacks.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly endpoint = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
  private readonly apiKey = process.env.LLM_API_KEY || '';
  private readonly model = process.env.LLM_MODEL || 'gpt-4o-mini';
  private readonly embeddingModel = process.env.LLM_EMBEDDING_MODEL || 'text-embedding-3-small';
  private readonly maxContextTokens = Number(process.env.LLM_MAX_CONTEXT_TOKENS) || 6000;
  private readonly timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 30000;

  // Simple circuit breaker state
  private failures = 0;
  private circuitOpenUntil = 0;
  private readonly failureThreshold = 3;
  private readonly circuitResetMs = 60000;

  /**
   * Estimate token count (~4 chars per token for English text).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Trim conversation history to fit within token budget.
   * Keeps system message + most recent messages that fit.
   */
  trimToTokenBudget(messages: ChatMessage[], maxTokens?: number): ChatMessage[] {
    const budget = maxTokens ?? this.maxContextTokens;
    const system = messages.find((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');

    let usedTokens = system ? this.estimateTokens(system.content) : 0;
    const kept: ChatMessage[] = [];

    // Keep messages from most recent, working backwards
    for (let i = rest.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(rest[i].content);
      if (usedTokens + msgTokens > budget) break;
      usedTokens += msgTokens;
      kept.unshift(rest[i]);
    }

    return system ? [system, ...kept] : kept;
  }

  /**
   * Call the LLM with automatic context trimming and fallback handling.
   */
  async chat(options: LlmRequestOptions, fallbackContent: string): Promise<LlmResponse> {
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker open, returning fallback');
      return { content: fallbackContent, usedFallback: true };
    }

    const trimmed = this.trimToTokenBudget(options.messages);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: trimmed,
          max_tokens: options.maxTokens ?? 1024,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.recordFailure();
        this.logger.warn(`LLM API returned ${response.status}`);
        return { content: fallbackContent, usedFallback: true };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        this.recordFailure();
        return { content: fallbackContent, usedFallback: true };
      }

      this.recordSuccess();
      return { content, usedFallback: false };
    } catch (err) {
      this.recordFailure();
      this.logger.warn(`LLM API call failed: ${(err as Error).message}`);
      return { content: fallbackContent, usedFallback: true };
    }
  }

  private isCircuitOpen(): boolean {
    return this.failures >= this.failureThreshold && Date.now() < this.circuitOpenUntil;
  }

  private recordFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitResetMs;
      this.logger.warn(`Circuit breaker opened for ${this.circuitResetMs}ms`);
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
  }

  private get embeddingsEndpoint(): string {
    // Derive embeddings endpoint from chat endpoint
    // e.g. https://api.openai.com/v1/chat/completions → https://api.openai.com/v1/embeddings
    const base = this.endpoint.replace(/\/chat\/completions$/, '');
    return `${base}/embeddings`;
  }

  /**
   * Generate an embedding vector for a given text input.
   */
  async embed(input: string): Promise<EmbeddingResponse> {
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker open, returning fallback embedding');
      return { embedding: [], usedFallback: true };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.embeddingsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.recordFailure();
        this.logger.warn(`Embedding API returned ${response.status}`);
        return { embedding: [], usedFallback: true };
      }

      const data = await response.json() as { data?: Array<{ embedding: number[] }> };
      const embedding = data.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        this.recordFailure();
        return { embedding: [], usedFallback: true };
      }

      this.recordSuccess();
      return { embedding, usedFallback: false };
    } catch (err) {
      this.recordFailure();
      this.logger.warn(`Embedding API call failed: ${(err as Error).message}`);
      return { embedding: [], usedFallback: true };
    }
  }
}
