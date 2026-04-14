import { describe, it, expect } from 'vitest'
import { createStorageService, STORAGE_KEYS } from './storageService.js'
import { createMockStorage, createQuotaExceededStorage } from '../../test/mockStorage.js'

describe('createStorageService', () => {
  describe('get', () => {
    it('returns null when key does not exist', () => {
      const svc = createStorageService(createMockStorage())
      expect(svc.get('missing')).toBeNull()
    })

    it('parses JSON values', () => {
      const storage = createMockStorage({ myKey: JSON.stringify({ foo: 'bar' }) })
      const svc = createStorageService(storage)
      expect(svc.get('myKey')).toEqual({ foo: 'bar' })
    })

    it('parses array values', () => {
      const storage = createMockStorage({ arr: JSON.stringify([1, 2, 3]) })
      const svc = createStorageService(storage)
      expect(svc.get('arr')).toEqual([1, 2, 3])
    })

    it('returns null for corrupted JSON', () => {
      const storage = createMockStorage({ bad: 'not-valid-json{' })
      const svc = createStorageService(storage)
      expect(svc.get('bad')).toBeNull()
    })

    it('returns null when storage is null', () => {
      const svc = createStorageService(null)
      expect(svc.get('anything')).toBeNull()
    })
  })

  describe('set', () => {
    it('serializes values to JSON', () => {
      const storage = createMockStorage()
      const svc = createStorageService(storage)
      svc.set('myKey', { foo: 'bar' })
      expect(JSON.parse(storage.getItem('myKey'))).toEqual({ foo: 'bar' })
    })

    it('overwrites existing values', () => {
      const storage = createMockStorage({ myKey: JSON.stringify('old') })
      const svc = createStorageService(storage)
      svc.set('myKey', 'new')
      expect(svc.get('myKey')).toBe('new')
    })

    it('silently handles quota exceeded errors', () => {
      const svc = createStorageService(createQuotaExceededStorage())
      expect(() => svc.set('key', 'value')).not.toThrow()
    })

    it('does nothing when storage is null', () => {
      const svc = createStorageService(null)
      expect(() => svc.set('key', 'value')).not.toThrow()
    })
  })

  describe('remove', () => {
    it('removes an existing key', () => {
      const storage = createMockStorage({ toRemove: '"value"' })
      const svc = createStorageService(storage)
      svc.remove('toRemove')
      expect(svc.get('toRemove')).toBeNull()
    })

    it('does not throw when removing a non-existent key', () => {
      const svc = createStorageService(createMockStorage())
      expect(() => svc.remove('ghost')).not.toThrow()
    })

    it('does nothing when storage is null', () => {
      const svc = createStorageService(null)
      expect(() => svc.remove('key')).not.toThrow()
    })
  })

  describe('clearAll', () => {
    it('removes all known storage keys', () => {
      const initial = Object.fromEntries(
        Object.values(STORAGE_KEYS).map(k => [k, JSON.stringify('data')])
      )
      const storage = createMockStorage(initial)
      const svc = createStorageService(storage)
      svc.clearAll()
      for (const key of Object.values(STORAGE_KEYS)) {
        expect(svc.get(key)).toBeNull()
      }
    })

    it('does not remove unrelated keys', () => {
      const storage = createMockStorage({
        ...Object.fromEntries(Object.values(STORAGE_KEYS).map(k => [k, '"data"'])),
        unrelated_key: '"keep me"'
      })
      const svc = createStorageService(storage)
      svc.clearAll()
      expect(storage.getItem('unrelated_key')).toBe('"keep me"')
    })

    it('does nothing when storage is null', () => {
      const svc = createStorageService(null)
      expect(() => svc.clearAll()).not.toThrow()
    })
  })

  describe('keys', () => {
    it('exposes STORAGE_KEYS', () => {
      const svc = createStorageService(createMockStorage())
      expect(svc.keys).toBe(STORAGE_KEYS)
    })
  })
})

describe('STORAGE_KEYS', () => {
  it('defines all expected keys', () => {
    expect(STORAGE_KEYS.FAVORITES).toBeDefined()
    expect(STORAGE_KEYS.STREAMING_PREFS).toBeDefined()
    expect(STORAGE_KEYS.STREAMING_CACHE).toBeDefined()
    expect(STORAGE_KEYS.TRIAL_NOTES).toBeDefined()
    expect(STORAGE_KEYS.ONBOARDING_COMPLETE).toBeDefined()
  })
})
