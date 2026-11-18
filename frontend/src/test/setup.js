import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Drafts and the Ask conversation are kept in sessionStorage; every test starts with an empty one.
afterEach(() => { cleanup(); try { window.sessionStorage.clear() } catch { /* ignore */ } })
