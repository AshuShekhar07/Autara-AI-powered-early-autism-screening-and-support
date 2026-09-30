// The brief: "No text anywhere in the UI, prompts, reports or seed data presents a diagnosis or an autism level."
// This scans user-facing sources for the banned diagnostic phrasing. (The AI service's own banned-phrase list and
// the prompts that *forbid* these phrases are exempt — they have to mention them — and are covered by pytest.)
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../..')
const BANNED = [
  /\b(?:has|have|had)\s+(?:an?\s+)?(?:autism|asd|autism spectrum disorder)\b/i,
  /\b(?:is|are|was|were)\s+(?:an?\s+)?autistic\b/i,
  /\bdiagnos(?:ed|is)\s+(?:of|with|as)\b/i,
  /\blevel\s*[123]\s*(?:autism|asd|support|severity)\b/i,
  /\b(?:autism|asd)\s+level\s*[123]\b/i,
  /\bconfirms?\s+(?:that\s+)?(?:asd|autism)\b/i,
  /\b(?:mild|moderate|severe)\s+(?:autism|asd)\b/i,
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.venv', 'storage', '__pycache__', '.git', 'coverage'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const isTest = (f) => /\.test\.jsx?$|\/tests?\//.test(f)
const targets = [
  ...walk(path.join(ROOT, 'frontend/src')).filter((f) => /\.(jsx?|css|html)$/.test(f) && !isTest(f)),
  ...walk(path.join(ROOT, 'backend')).filter((f) => f.endsWith('.js') && !isTest(f)),
  path.join(ROOT, 'frontend/index.html'),
  path.join(ROOT, 'readme.md'),
  ...walk(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')),
].filter((f) => fs.existsSync(f))

it('scans a meaningful number of files', () => { expect(targets.length).toBeGreaterThan(80) })

it.each(targets.map((f) => [path.relative(ROOT, f), f]))('%s has no diagnostic wording', (_rel, file) => {
  const text = fs.readFileSync(file, 'utf8')
  const hits = BANNED.map((re) => re.exec(text)).filter(Boolean).map((m) => m[0])
  expect(hits).toEqual([])
})
