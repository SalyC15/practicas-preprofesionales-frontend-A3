export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  factor: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  factor: 2,
}

let currentConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG }

export function getRetryConfig(): RetryConfig {
  return currentConfig
}

export function setRetryConfig(overrides: Partial<RetryConfig>): void {
  currentConfig = { ...currentConfig, ...overrides }
}

export function resetRetryConfig(): void {
  currentConfig = { ...DEFAULT_RETRY_CONFIG }
}

/**
 * Calcula el delay de reintento exponencial con tope.
 * Para attempt = 1 (primer reintento): initialDelayMs * factor^0 = initialDelayMs.
 * Para attempt = 2: initialDelayMs * factor^1.
 * Capped en maxDelayMs.
 */
export function calculateBackoffDelay(
  attempts: number,
  config: RetryConfig = getRetryConfig(),
): number {
  if (attempts <= 0) return 0
  const exponent = Math.max(0, attempts - 1)
  const delay = config.initialDelayMs * Math.pow(config.factor, exponent)
  return Math.min(delay, config.maxDelayMs)
}
