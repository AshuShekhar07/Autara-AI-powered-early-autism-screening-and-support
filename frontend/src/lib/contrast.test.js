import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Guards the accessibility fixes (docs/DECISIONS.md D-063): colour tokens used for text must keep WCAG AA contrast.
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('colour contrast of text tokens (WCAG AA = 4.5:1)', () => {
  it('muted text is readable on the white and tinted card backgrounds', () => {
    for (const bg of ['#ffffff', '#eef2ed', '#f5f7f3']) expect(contrast(token('ink-muted'), bg)).toBeGreaterThanOrEqual(4.5)
  })
  it('primary button text (white) is readable on the button colours', () => {
    expect(contrast('#ffffff', token('gold-strong'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', token('gold-strong-hover'))).toBeGreaterThanOrEqual(4.5)
  })
})
