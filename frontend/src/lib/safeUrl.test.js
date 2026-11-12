import { safeHttpUrl } from './safeUrl'

describe('safeHttpUrl', () => {
  it('keeps normal web links', () => {
    expect(safeHttpUrl('https://www.cdc.gov/autism/signs.html')).toBe('https://www.cdc.gov/autism/signs.html')
    expect(safeHttpUrl('http://example.org')).toBe('http://example.org')
  })

  it('blocks script, data and malformed links', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', '//evil.example', 'not a url', '', null, undefined, 42, {}]) {
      expect(safeHttpUrl(bad)).toBeNull()
    }
  })
})
