import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  getRetryConfig,
  resetRetryConfig,
  setRetryConfig,
} from './retryConfig'

beforeEach(() => {
  resetRetryConfig()
})

describe('retryConfig', () => {
  it('tiene valores por defecto esperados', () => {
    expect(DEFAULT_RETRY_CONFIG).toEqual({
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30_000,
      factor: 2,
    })
    expect(getRetryConfig()).toEqual(DEFAULT_RETRY_CONFIG)
  })

  it('permite sobrescribir y resetear la configuración', () => {
    setRetryConfig({ maxAttempts: 10, initialDelayMs: 500 })
    expect(getRetryConfig().maxAttempts).toBe(10)
    expect(getRetryConfig().initialDelayMs).toBe(500)

    resetRetryConfig()
    expect(getRetryConfig()).toEqual(DEFAULT_RETRY_CONFIG)
  })

  it('calcula esperas crecientes exponenciales (1s, 2s, 4s, 8s...)', () => {
    expect(calculateBackoffDelay(0)).toBe(0)
    expect(calculateBackoffDelay(1)).toBe(1000) // 1000 * 2^0
    expect(calculateBackoffDelay(2)).toBe(2000) // 1000 * 2^1
    expect(calculateBackoffDelay(3)).toBe(4000) // 1000 * 2^2
    expect(calculateBackoffDelay(4)).toBe(8000) // 1000 * 2^3
    expect(calculateBackoffDelay(5)).toBe(16_000) // 1000 * 2^4
    expect(calculateBackoffDelay(6)).toBe(30_000) // 1000 * 2^5 = 32_000 -> capped at 30_000
  })

  it('respeta un maxDelayMs personalizado como tope', () => {
    const customConfig = {
      maxAttempts: 5,
      initialDelayMs: 500,
      maxDelayMs: 1500,
      factor: 2,
    }
    expect(calculateBackoffDelay(1, customConfig)).toBe(500)
    expect(calculateBackoffDelay(2, customConfig)).toBe(1000)
    expect(calculateBackoffDelay(3, customConfig)).toBe(1500) // 2000 capped at 1500
    expect(calculateBackoffDelay(4, customConfig)).toBe(1500)
  })
})
