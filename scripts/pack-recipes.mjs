#!/usr/bin/env node
/**
 * pack-recipes.mjs — 按构件 ID 打包 canonical 配方，给写页子 agent 当 briefing 附件。
 *
 * 用法: node pack-recipes.mjs --out <文件路径> <ID...> [--tokens] [--qa] [--quiet]
 *   例: node pack-recipes.mjs --out ~/deck/briefing/recipes-sec2.md C01 C08 R3 L04
 *
 * 为什么存在：SKILL.md 第 3 步的 briefing 第 ③ 段要给「选中构件的 canonical 配方」。
 * 子 agent 自己去 Read reference 会整读——components.md 22KB + charts.md 41KB 一次 63KB，
 * 而它真正要的通常只有两三节。本脚本按 ID 抽节、把「恒取」的通用节**全局去重**后打成一个包，
 * briefing 里只给路径。实测 C01+R3 从 63KB 降到 25KB（省 60%），打的 ID 越多省得越多。
 *
 * 选件依据不在本脚本里：**走 `reference/manifest.json` 的 `semantics`**（唯一选件基准）。
 * 本脚本只负责「ID 定了之后把正文取出来」，ID 与 ref 文件的对应关系也直接读 manifest，
 * 不另造一份表——多一份表就多一处会漂。
 *
 * 退出码: 0 成功；2 用法错 / ID 不认识（**不静默出空包**）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(SKILL, 'reference', 'manifest.json'), 'utf8'))
const ENTRIES = new Map(manifest.entries.map((e) => [e.id.toUpperCase(), e]))

// ——— 各 reference 文件的「恒取节」：对任一 ID 都成立，漏了会写出方言错误/反模式 ———
// 与各文件头部「🔖 取节索引」里那两条 sed 同源；打多个 ID 时只收一次，这是主要节省来源。
// 恒取节必须与对应 reference 文件实际存在的 `## 节名` 对齐——文件加/删节后这里同步改，否则直接报错退出。
const ALWAYS = {
  'reference/components.md': ['通用纪律', '反模式'],
  'reference/charts.md': ['通用纪律', '渲染器差异纪律'],
  'reference/layouts.md': ['chrome 变体纪律'],
  'reference/diagrams.md': ['1. 三级路由总表'],
}
// 本体系的 C04–C07 是结构/装饰构件（时间轴/KPI 带/奖章盘/光泽环），图表本体不随构件自动展开——
// 真数据图直接显式传 R1–R5（charts.md 只有 R1–R5，无 R6）。
const CHART_BODY = {}

// ——— 标题索引：按 heading 层级切节，节 = 本标题行 → 下一个同级或更高级标题行 ———
// 比文件头那几条 sed 稳（sed 的收尾 pattern 是手写的字符类，加一节就可能切错），结果等价。
function sections(relPath) {
  const text = readFileSync(join(SKILL, relPath), 'utf8')
  const lines = text.split('\n')
  const heads = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) inFence = !inFence
    if (inFence) continue                                  // 代码块里的 # 不是标题
    const m = lines[i].match(/^(#{2,4})\s+(.*)$/)
    if (m) heads.push({ line: i, level: m[1].length, title: m[2].trim() })
  }
  return heads.map((h, idx) => {
    let end = lines.length
    for (let j = idx + 1; j < heads.length; j++) {
      if (heads[j].level <= h.level) { end = heads[j].line; break }
    }
    return { ...h, body: lines.slice(h.line, end).join('\n').replace(/\s+$/, '') }
  })
}

// ID → 该 ref 文件里的标题匹配器。三个文件的标题写法各不相同，逐个对齐实际形态：
//   layouts.md    `## L04 — …`  / `### P1 — …`
//   components.md `## C01 — …`  / ICONS 是两节 `## Icons …`
//   charts.md     `## R1. …`    / R2b 是 R2 下的 `### R2b. …`
function matcherFor(id) {
  const up = id.toUpperCase()
  if (up === 'ICONS') return (t) => /^Icons\b/.test(t)
  if (/^R\d/.test(up)) return (t) => new RegExp(`^${up}\\.`, 'i').test(t)
  if (/^P\d/.test(up)) return (t) => new RegExp(`^${up}\\s*[—-]`, 'i').test(t)
  return (t) => new RegExp(`^${up}\\s*[—-]`, 'i').test(t)   // L / C
}

// ——— 参数 ———
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const valOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
const OUT = valOf('--out')
const WANT_TOKENS = flag('--tokens')
const WANT_QA = flag('--qa')
const QUIET = flag('--quiet')
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out')

const usage = `用法: node pack-recipes.mjs --out <文件路径> <ID...> [--tokens] [--qa]

  --out <path>   产物落盘路径（briefing 里给这个路径，别把正文贴进 prompt）
  --tokens       附 design-tokens 的「颜色」与「字阶」两节
  --qa           附这些构件关联的 qa 规则行（从 qa-gate.md 检查项表里抽）
  --quiet        只打印产物路径

合法 ID（来自 reference/manifest.json）:
  ${['layout', 'pattern', 'component', 'element', 'chart-recipe', 'chrome', 'diagram']
    .map((k) => `${k}: ${manifest.entries.filter((e) => e.kind === k).map((e) => e.id).join(' ')}`)
    .join('\n  ')}`

if (!OUT || ids.length === 0) { console.error(usage); process.exit(2) }
const unknown = ids.filter((id) => !ENTRIES.has(id.toUpperCase()))
if (unknown.length) {
  console.error(`不认识的 ID: ${unknown.join(', ')}\n\n${usage}`)
  process.exit(2)   // 静默出个空包比报错危险得多——agent 会拿着空配方开写
}

// ——— 展开：显式 ID + C04–C07 的图表本体 ———
const resolved = []
const seen = new Set()
const addId = (id, why) => {
  const up = id.toUpperCase()
  if (seen.has(up)) return
  seen.add(up)
  resolved.push({ id: up, entry: ENTRIES.get(up), why })
}
for (const id of ids) {
  addId(id, null)
  const body = CHART_BODY[id.toUpperCase()]
  if (body) addId(body, `${id.toUpperCase()} 的图表本体`)
}

// ——— 抽节 ———
const secCache = new Map()
const getSections = (ref) => {
  if (!secCache.has(ref)) secCache.set(ref, sections(ref))
  return secCache.get(ref)
}

const chunks = []          // { ref, title, body }
const emitted = new Set()  // `${ref}#${title}` 去重
const push = (ref, sec) => {
  const key = `${ref}#${sec.title}`
  if (emitted.has(key)) return
  emitted.add(key)
  chunks.push({ ref, title: sec.title, body: sec.body })
}

const missSection = []
const refsTouched = new Set()
for (const { id, entry } of resolved) {
  const ref = entry.ref
  if (!ref) continue
  if (!ref.endsWith('.md')) {          // CHROME → assets/chrome-L04.page，整文件照抄
    chunks.push({ ref, title: `${id}（整文件照抄）`, body: '```yaml\n' + readFileSync(join(SKILL, ref), 'utf8').trimEnd() + '\n```' })
    continue
  }
  refsTouched.add(ref)
  const match = matcherFor(id)
  const hit = getSections(ref).filter((s) => match(s.title))
  if (!hit.length) { missSection.push(`${id} → ${ref}`); continue }
  for (const s of hit) push(ref, s)
}
// 恒取节放在各自文件的目标节**之前**排版（下面 sort），但要先收进来
for (const ref of refsTouched) {
  for (const t of ALWAYS[ref] ?? []) {
    const hits = getSections(ref).filter((x) => x.title.startsWith(t))   // 前缀可命中多节（Icons 有两节）
    if (!hits.length) { console.error(`✗ ${ref} 找不到恒取节「${t}」——恒取表与正文漂了`); process.exit(2) }
    for (const s of hits) push(ref, s)
  }
}
if (WANT_TOKENS) {
  const ref = 'reference/design-tokens.md'
  for (const t of ['颜色', '字阶']) {
    const s = getSections(ref).find((x) => x.title.startsWith(t))
    if (s) push(ref, s)
  }
}
if (missSection.length) {
  console.error(`✗ 这些 ID 在 manifest 里有登记，但对应文件里找不到章节（manifest 与正文漂了）:\n  ${missSection.join('\n  ')}`)
  process.exit(2)
}

// 排版：恒取节（通用纪律）排在本文件其它节之前——先读纪律再读配方
const ALWAYS_TITLES = new Set(Object.values(ALWAYS).flat())
const isAlways = (t) => [...ALWAYS_TITLES].some((a) => t.startsWith(a))
chunks.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0) || (isAlways(b.title) - isAlways(a.title)))

// ——— qa 规则行（可选）———
let qaBlock = ''
if (WANT_QA) {
  const rules = [...new Set(resolved.flatMap(({ entry }) => entry.qa_rules ?? []))].sort()
  const gate = readFileSync(join(SKILL, 'reference', 'qa-gate.md'), 'utf8').split('\n')
  const rows = rules.map((r) => gate.find((l) => l.startsWith(`| ${r} `))).filter(Boolean)
  const notFound = rules.filter((r) => !gate.some((l) => l.startsWith(`| ${r} `)))
  qaBlock = [
    '',
    '## 这些构件会被哪些闸检查',
    '',
    '写完先自己跑：`node $SKILL_DIR/scripts/qa.mjs <deckDir> --pages <你负责的页>`',
    '',
    '| 规则 | 内容 | 来源缺陷类 |',
    '|---|---|---|',
    ...rows,
    ...(notFound.length ? ['', `> 另有 ${notFound.join(' / ')} 未在 qa-gate.md 表中找到行，去文件里 grep。`] : []),
  ].join('\n')
}

// ——— 产出 ———
const header = [
  `# 配方包 — ${resolved.map((r) => r.id).join(' / ')}`,
  '',
  `> \`pack-recipes.mjs\` 生成，${new Date().toISOString().slice(0, 10)}。**这一份就是你需要的全部配方，不要再去整读 reference。**`,
  '> 缺东西时按 ID 单取：各 reference 文件头部有「🔖 取节索引」，照那条 sed 取你要的那一节。',
  '',
  '收录：',
  ...resolved.map((r) => `- **${r.id}** — ${r.entry.name ?? ''}${r.why ? `（${r.why}）` : ''}${r.entry.example ? ` ｜ 样例 \`${r.entry.example}\`` : ''}`),
  '',
  '通用纪律（对任一构件都成立，已收录一次，勿跳过）：',
  ...[...refsTouched].flatMap((ref) => (ALWAYS[ref] ?? []).map((t) => `- \`${ref}\` § ${t}`)),
  '',
  '---',
].join('\n')

const body = chunks.map((c) => `\n<!-- 取自 ${c.ref} -->\n\n${c.body}`).join('\n')
const out = `${header}\n${body}\n${qaBlock}\n`

mkdirSync(dirname(resolve(OUT)), { recursive: true })
writeFileSync(resolve(OUT), out)

if (QUIET) { console.log(resolve(OUT)); process.exit(0) }
const full = [...refsTouched].reduce((n, ref) => n + readFileSync(join(SKILL, ref), 'utf8').length, 0)
const saved = full > 0 ? Math.round((1 - out.length / full) * 100) : 0
console.log(`✓ ${resolve(OUT)}`)
console.log(`  ${chunks.length} 节 / ${out.length.toLocaleString()} 字符`)
console.log(`  对照整读 ${[...refsTouched].map((r) => r.replace('reference/', '')).join(' + ')} 的 ${full.toLocaleString()} 字符 —— 省 ${saved}%`)
if (!existsSync(resolve(OUT))) { console.error('✗ 写盘后文件不存在'); process.exit(2) }
