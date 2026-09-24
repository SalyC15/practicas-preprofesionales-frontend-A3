import { afterEach, describe, expect, it, vi } from 'vitest'
import { withSyncLock } from './syncLock'

const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')

afterEach(() => {
  if (originalLocksDescriptor) {
    Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
  } else {
    Reflect.deleteProperty(navigator, 'locks')
  }
})

describe('withSyncLock', () => {
  it('serializes sync operations using the browser lock manager', async () => {
    let queue = Promise.resolve()
    let active = 0
    let maxActive = 0

    const request = vi.fn((_name, _options, callback) => {
      const operation = queue.then(async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        try {
          return await callback({} as Lock)
        } finally {
          active -= 1
        }
      })
      queue = operation.then(() => undefined, () => undefined)
      return operation
    })
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const operation = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await Promise.all([withSyncLock(operation), withSyncLock(operation)])

    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledWith('practicas-offline-sync', { mode: 'exclusive' }, expect.any(Function))
    expect(operation).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it('runs normally when the browser does not provide the lock manager', async () => {
    Reflect.deleteProperty(navigator, 'locks')
    const operation = vi.fn().mockResolvedValue('done')

    await expect(withSyncLock(operation)).resolves.toBe('done')
    expect(operation).toHaveBeenCalledOnce()
  })
})
