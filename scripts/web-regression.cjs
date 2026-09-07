// Uses the project's existing TypeScript compiler; no test dependencies required.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function load(relative) {
  const filename = path.resolve(__dirname, '..', relative)
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = mod.require.bind(mod)
  mod.require = (id) => id === '../online/presets' ? {} : originalRequire(id)
  mod._compile(compiled, filename)
  return mod.exports
}

async function main() {
  const { buildEmbed } = load('src/web/pages/OnlineEmbedPage.tsx')
  for (const url of ['https://eviliqiyi.com/a', 'https://fakeyoutube.com/watch?v=abc', 'javascript:alert(1)', 'ftp://www.iqiyi.com/a', 'https://user:pass@www.iqiyi.com/a']) {
    assert.equal(buildEmbed(url), null, url)
  }
  assert.equal(buildEmbed('https://www.youtube.com/watch?v=abc').provider, 'youtube')
  assert.equal(new URL(buildEmbed('https://www.bilibili.com/video/BV123abc?p=7').embedUrl).searchParams.get('p'), '7')
  assert.equal(new URL(buildEmbed('https://player.bilibili.com/player.html?bvid=BV123abc&p=3&cid=99').embedUrl).searchParams.get('cid'), '99')
  const { loadPresetSeries } = load('src/web/online/presets.ts')
  const originalFetch = global.fetch
  try {
    global.fetch = async () => ({ ok: true, json: async () => [
      { title: 'Custom', pages: 99, items: [{ title: 'One', url: 'https://www.iqiyi.com/a' }] },
      { title: 'Bili', bvid: 'BV123abc', pages: 3, cids: [11, 'invalid', 33] },
      { title: 'Invalid', bvid: 'BVbad', pages: 0.5 },
    ] })
    const result = await loadPresetSeries()
    assert.equal(result.length, 2)
    assert.equal(result[0].pages, 1)
    assert.deepEqual(result[1].cids, [11, 0, 33])
    let fallback = false
    global.fetch = async () => { throw new Error('offline') }
    assert.ok((await loadPresetSeries(() => { fallback = true })).length)
    assert.equal(fallback, true)
  } finally { global.fetch = originalFetch }
  console.log('PASS: URL boundaries, episode parameters, preset alignment, fallback notification')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
