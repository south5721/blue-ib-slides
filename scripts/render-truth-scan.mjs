#!/usr/bin/env node
/**
 * render-truth-scan.mjs — 渲染真值闸：用交付目标原生渲染器渲染导出件 pptx，
 * 比对「声明几何（pptx XML）」与「渲染真值（PDF 文本坐标）」，检出溢出/碰撞/越界/脚注区侵入。
 *
 * 渲染链（按可用性降级，LibreOffice 禁用——AGENTS.md 铁律）：
 *   1. Microsoft PowerPoint（AppleScript 导出 PDF，PowerPoint 原生排版）
 *   2. qlmanage -t（QuickLook，仅首页缩略图——标记 LIMITED，不算真值闸通过）
 *   都没有 → BLOCKED（exit 3），不许用 Rust 渲染（kimi-slides screenshot）顶替验收
 *
 * PHP 文本坐标：pdftotext -bbox（PDF 页 = 1440×810pt = deck 坐标系）
 * PNG 目视件：pdftoppm -png -r 96（agent 逐页签核用）
 *
 * 用法: node render-truth-scan.mjs <file.pptx> [--pages <spec>] [--out <dir>] [--json] [--render-only]
 * 退出码: 有 error 级命中 → 1；全过或仅 warn → 0；用法错/环境 BLOCKED → 2/3
 *
 * 检测规则（渲染真值 vs 声明几何）：
 *   rendered_overflow      渲染词底边 > 声明文本框底 +3pt（词与框 x 重叠 >30%）→ error
 *   rendered_collision     两文本框的渲染词包围盒相交 >30% 较小者 → error
 *   panel_breach           panel 内文本的渲染词越出 panel 声明边界 +3pt → error
 *   footnote_intrusion     非 chrome 渲染词底边压进脚注区（顶 +2）→ warn
 *   rendered_tight         渲染底与下一元素顶间隙 <4pt（零 slack 预警）→ warn，**默认关闭**，
 *                          --strict 时才出（2026-09-24 盘点：每本 50–260 条全裁决为噪声，纯裁决成本源）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, copyFileSync, rmSync, statSync } from 'node:fs'
import { join, basename, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const pptx = args.find((a) => !a.startsWith('-') && a.endsWith('.pptx'))
const pagesIdx = args.indexOf('--pages')
const PAGES_SPEC = pagesIdx >= 0 ? args[pagesIdx + 1] : null
const outIdx = args.indexOf('--out')
const OUT_DIR = outIdx >= 0 ? args[outIdx + 1] : null
const JSON_MODE = args.includes('--json')
const RENDER_ONLY = args.includes('--render-only')
const STRICT = args.includes('--strict')  // 开启 rendered_tight（零 slack 预警）——默认关闭（2026-09-24 盘点：每本 50–260 条全裁决为噪声，纯裁决成本源）
const rendererIdx = args.indexOf('--renderer')
const RENDERER = rendererIdx >= 0 ? args[rendererIdx + 1] : 'auto'  // auto|powerpoint|cdp|rust

if (!pptx || !existsSync(pptx)) {
  console.error('usage: node render-truth-scan.mjs <file.pptx> [--renderer auto|powerpoint|cdp|rust] [--pages <spec>] [--out <dir>] [--json] [--render-only] [--strict]')
  process.exit(2)
}
if (!['auto', 'powerpoint', 'cdp', 'rust'].includes(RENDERER)) {
  console.error(`--renderer 只收 auto|powerpoint|cdp|rust（收到 "${RENDERER}"）`)
  process.exit(2)
}
const PPTX = resolve(pptx)

// ——— 工具 ———
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 300000, ...opts })
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') }
}
const has = (cmd) => sh('which', [cmd]).code === 0

// ——— 渲染器探测（都按「轻」做，不为探测启动任何 app）———
// L1 powerpoint：路径存在性（不启动）；RENDER_TRUTH_NO_PPT=1 模拟无 PowerPoint（测试 L3 降级用）
const detectPowerPoint = () => !process.env.RENDER_TRUTH_NO_PPT && existsSync('/Applications/Microsoft PowerPoint.app/Contents/MacOS/Microsoft PowerPoint')
// L2 cdp（Kimi 在线编辑器产品渲染，走 webbridge daemon）：daemon 3s 内可达
const detectCdp = () => {
  try {
    const r = spawnSync('curl', ['-s', '-m', '3', '-X', 'POST', 'http://127.0.0.1:10086/command', '-d', '{"action":"list_tabs","args":{},"session":"render-truth-probe"}'], { encoding: 'utf8', timeout: 5000 })
    return (r.stdout ?? '').includes('"ok":true')
  } catch { return false }
}
// L3 rust：kimi-slides 在 PATH，或两个安装目录（~/.kimi-slides-rs/bin / ~/.kimi-work/bin，不依赖 PATH 变量）
const findKimiSlides = () => {
  if (has('kimi-slides')) return 'kimi-slides'
  for (const p of [join(homedir(), '.kimi-slides-rs', 'bin', 'kimi-slides'), join(homedir(), '.kimi-work', 'bin', 'kimi-slides')]) {
    if (existsSync(p)) return p
  }
  return null
}
const detectRust = () => findKimiSlides() !== null

// ——— 锁文件串行化（多 agent 并发互踩 -609/active presentation 错配 的现场修复固化）———
// 拿到锁才跑 PowerPoint 导出；拿不到就等（2s 轮询，超时 10 分钟报错）。进程退出自动释放。
const LOCK = join(tmpdir(), 'render-truth.lock')
function acquireLock() {
  const deadline = Date.now() + 600000
  for (;;) {
    try {
      const fd = spawnSync('bash', ['-c', `set -o noclobber && echo $$ > "${LOCK}"`], { encoding: 'utf8' })
      if (fd.status === 0) { process.on('exit', () => { try { rmSync(LOCK, { force: true }) } catch {} }); return }
    } catch {}
    if (Date.now() > deadline) {
      console.error('render-truth: 锁等待超时（10 分钟）——另一个 render-truth 进程可能卡住，手动删 ' + LOCK)
      process.exit(3)
    }
    spawnSync('sleep', ['2'])
  }
}

// ——— Step 1: 渲染链（L1 powerpoint → L2 cdp → L3 rust+estimation，失败自动降级并写明原因，禁止静默降级）———
const WORK = OUT_DIR ? resolve(OUT_DIR) : mkdtempSync(join(tmpdir(), 'render-truth-'))
mkdirSync(WORK, { recursive: true })
const renderLog = []
let pdfPath = null
let renderMode = null

// L1: PowerPoint（本机有才走；沙盒按文件夹记授权 → 固定中转目录 PPT_IO / 容器内 Documents）
function renderL1() {
  sh('xattr', ['-d', 'com.apple.quarantine', PPTX])  // 扫描前自动 xattr -d quarantine（不存在则忽略）
  acquireLock()
  const PPT_IO = process.env.RENDER_TRUTH_PPT_IO
    || join(homedir(), 'Library', 'Application Support', 'render-truth', 'powerpoint-io')
  mkdirSync(PPT_IO, { recursive: true })
  // 清掉异常退出留下的 >1 天残件（含 PowerPoint 的 ~$ 锁文件）
  for (const f of readdirSync(PPT_IO)) {
    const p = join(PPT_IO, f)
    try { if (Date.now() - statSync(p).mtimeMs > 86400000) rmSync(p, { recursive: true, force: true }) } catch {}
  }
  const runId = `${process.pid}-${Date.now()}`
  const pptIn = join(PPT_IO, `${runId}-${basename(PPTX)}`)
  // PDF 默认写进 PowerPoint 容器内 Documents；可用 RENDER_TRUTH_PDF_DIR 指定受控输出目录。
  const PPT_DOCS = join(homedir(), 'Library', 'Containers', 'com.microsoft.Powerpoint', 'Data', 'Documents')
  const outDir = process.env.RENDER_TRUTH_PDF_DIR
    ? resolve(process.env.RENDER_TRUTH_PDF_DIR)
    : (existsSync(PPT_DOCS) ? PPT_DOCS : PPT_IO)
  mkdirSync(outDir, { recursive: true })
  const pptOut = join(outDir, `render-truth-${runId}.pdf`)
  copyFileSync(PPTX, pptIn)
  const pdfOut = join(WORK, 'render.pdf')
  const scpt = join(WORK, 'export-pdf.scpt')
  const scptBody = `on run argv
  set inPath to item 1 of argv
  set outPath to item 2 of argv
  with timeout of 600 seconds
    tell application "Microsoft PowerPoint"
      activate
      open (POSIX file inPath)
      repeat with i from 1 to 20
        if (count presentations) > 0 then exit repeat
        delay 1
      end repeat
      if (count presentations) is 0 then error "presentation not loaded"
      delay 1
      set thePres to active presentation
      save thePres in (POSIX file outPath) as save as PDF
      close thePres saving no
      return "OK"
    end tell
  end timeout
end run
`
  // 安全边界：只关闭本脚本打开的测试稿；绝不 kill/quit PowerPoint，避免误伤用户文档。
  // 导出失败时明确降级，由调用方处理模态授权或改用其他渲染器。
  const exported = (r) => r.code === 0 && existsSync(pptOut) && r.out.includes('OK')
  writeFileSync(scpt, scptBody)
  const r = sh('osascript', [scpt, pptIn, pptOut])
  const ok = exported(r)
  if (ok) copyFileSync(pptOut, pdfOut)
  rmSync(pptIn, { force: true })
  rmSync(pptOut, { force: true })
  if (!ok) {
    renderLog.push(`L1 powerpoint 导出失败（未终止或退出 PowerPoint）：${r.out.trim().slice(0, 500)}`)
    return null
  }
  return pdfOut
}

// L3 的估算层：geometry-scan 保守估算（naturalRef 因子已标定）+ spcPts 已锁行高。
// 优先跑 deck 源目录（pptd）的 geometry-scan；找不到则只出 Rust PNG + 提示。
function runEstimation(slideDir) {
  const out = []
  // 找 deck 源目录：pptx 同目录的 deck/ 或 presentation.pptd
  const candidates = [
    join(PPTX.replace(/\.pptx$/i, ''), 'deck'),
    join(PPTX.replace(/\.pptx$/i, ''), '..', 'deck'),
    join(process.cwd(), 'deck'),
  ]
  const deckDir = candidates.find((d) => existsSync(join(d, 'presentation.pptd')))
  if (!deckDir) {
    out.push('  估算层：未找到 deck 源目录（presentation.pptd），仅 Rust PNG 供目视；保守估算跳过')
    return out
  }
  const geoScript = join(dirname(fileURLToPath(import.meta.url)), 'geometry-scan.mjs')
  if (!existsSync(geoScript)) {
    out.push('  估算层：geometry-scan.mjs 未随本仓移植（minimal adding 范围外），仅 Rust PNG 供目视；保守估算跳过')
    return out
  }
  out.push(`  估算层：geometry-scan on ${deckDir}（naturalRef 因子已标定 + spcPts 已锁行高）`)
  try {
    const geo = sh('node', [geoScript, deckDir])
    const hits = geo.out.trim().split('\n').filter((l) => l.trim())
    out.push(...hits.slice(0, 12).map((l) => '  ' + l))
    if (hits.length > 12) out.push(`  …（共 ${hits.length} 条估算命中，详见 geometry-scan 输出）`)
  } catch (e) {
    out.push(`  估算层 geometry-scan 失败: ${e.message}`)
  }
  return out
}

// L2: CDP（Kimi 在线编辑器产品渲染，走 webbridge daemon 打开在线编辑器逐页截图）。
// Timebox 30 分钟：能通就上，不通记「待验证」直接到 L3，不许卡住。
function renderL2() {
  renderLog.push('L2 cdp：待验证（Kimi 在线编辑器渲染流尚未打通——deck 已在服务端但编辑器 URL/上传流未就绪，本轮标记待验证后降 L3）')
  return null
}

// L3: rust + estimation（无 Office 无 CDP 的环境——kimi-slides screenshot 逐页 PNG + geometry-scan 保守估算
// + spcPts 已锁行高。不是真值，是加固估算，必须显著标注 TRUTH_LEVEL=ESTIMATED）。
function renderL3() {
  const kslides = findKimiSlides()
  if (!kslides) return null
  const outPng = join(WORK, 'rust-shots')
  mkdirSync(outPng, { recursive: true })
  const r = sh(kslides, ['screenshot', PPTX, '--scale', '1', '-o', outPng])
  // kimi-slides screenshot 把 PNG 落在 <out>/pages/ 子目录
  const pngDir = existsSync(join(outPng, 'pages')) ? join(outPng, 'pages') : outPng
  const pngs = readdirSync(pngDir).filter((f) => f.endsWith('.png')).sort()
  if (!pngs.length) return null
  renderLog.push(`L3 rust：kimi-slides screenshot 出 ${pngs.length} 页 PNG（Rust 重渲器，非交付目标原生渲染）`)
  return { kind: 'rust', outDir: pngDir, pages: pngs.length }
}

// ——— 渲染编排（2026-09-24 用户定：rust 渲染 = 常规交付验收（与真值对齐，快、无锁、可并发）；
// PowerPoint（L1）降级为可选深检——仅在 ① showcase 终验 ② 用户/验收方报疑难页 ③ rust 渲染与估算出现分歧
// 三种情形补跑。锁文件只在 powerpoint 路径启用（rust 无单通道问题））———
const DEEP = process.env.RENDER_TRUTH_DEEP === '1' || args.includes('--deep')
let renderLevel = null

if (RENDERER === 'powerpoint' || DEEP) {
  renderLog.push(`渲染编排：${DEEP ? '深检触发（--deep/RENDER_TRUTH_DEEP）' : '--renderer powerpoint 显式指定'}，走 L1 powerpoint（Office 真值深检）`)
  pdfPath = renderL1()
  if (pdfPath) { renderMode = 'powerpoint'; renderLevel = 'powerpoint' }
  else renderLog.push('L1 powerpoint 导出失败，降级 rust（product 级）')
}

if (!pdfPath && RENDERER === 'cdp') {
  renderLog.push('渲染编排：--renderer cdp 显式指定，试 L2 cdp（Kimi 在线编辑器渲染）')
  pdfPath = renderL2()
  if (pdfPath) { renderMode = 'cdp'; renderLevel = 'cdp' }
  else renderLog.push('L2 cdp 未就绪（待验证），降级 rust（product 级）')
}

if (!pdfPath && (RENDERER === 'auto' || RENDERER === 'rust' || RENDERER === 'powerpoint' || RENDERER === 'cdp')) {
  const l3 = renderL3()
  if (l3) {
    renderMode = 'rust'
    renderLevel = 'product'
    renderLog.push('渲染编排：走 rust 渲染（常规交付验收，与真值对齐；快、无锁、可并发）')
    // rust 的「渲染真值」= Rust 重渲 PNG + 估算几何（geometry-scan on deck dir 若有，否则仅 PNG + 提示）
    const rustShots = l3.outDir
    const slideDir = join(WORK, '_pptx')
    if (!existsSync(slideDir)) sh('unzip', ['-o', '-q', PPTX, '-d', slideDir])
    const est = runEstimation(slideDir)
    renderLog.push(...est)
    // 输出（先打渲染链与估算层，再打 RENDER_LEVEL 标注）
    for (const l of renderLog) console.log(`  · ${l}`)
    console.log(`\nRENDER_LEVEL=product（rust 渲染，常规交付级；与真值对齐，无 Office 依赖）`)
    console.log(`  Rust 渲染 PNG: ${rustShots}（${l3.pages} 页，agent 须逐页目视签核）`)
    console.log(`  深检（PowerPoint 真值）仅在 ① showcase 终验 ② 用户/验收方报疑难页 ③ rust 渲染与估算分歧 时补跑：node render-truth-scan.mjs <pptx> --renderer powerpoint`)
    if (JSON_MODE) console.log(JSON.stringify({ mode: 'rust', render_level: 'product', workdir: rustShots, pages: l3.pages, log: renderLog }, null, 1))
    process.exit(0)
  }
}

// 1b. RENDER_MISMATCH 归属核验（agent 实战：多 agent 并发时 PowerPoint 曾把上一个 deck 的 presentation 导给下一个）
// 导出 PDF 后自动核验：PDF 页数 == pptx 页数，且首页文本含 deck 特征词（pptx 第一页标题前 2 个词）。
// 不符 → RENDER_MISMATCH 退出非零（不许拿错配的 PDF 当真值扫）。
if (pdfPath) {
  const pdfInfo = sh('pdfinfo', [pdfPath]).out
  const pdfPages = +(pdfInfo.match(/Pages:\s*(\d+)/)?.[1] ?? 0)
  const slideDir0 = join(WORK, '_pptx')
  if (!existsSync(slideDir0)) sh('unzip', ['-o', '-q', PPTX, '-d', slideDir0])
  const pptxPages = readdirSync(join(slideDir0, 'ppt/slides')).filter((f) => /^slide\d+\.xml$/.test(f)).length
  let mismatch = null
  if (pdfPages !== pptxPages) mismatch = `PDF 页数 ${pdfPages} ≠ pptx 页数 ${pptxPages}`
  if (!mismatch) {
    const firstSlide = readFileSync(join(slideDir0, 'ppt/slides/slide1.xml'), 'utf8')
    const sigWords = [...firstSlide.matchAll(/<a:t>([^<]{2,20})<\/a:t>/g)].map((m) => m[1]).filter((t) => t.trim()).slice(0, 2)
    const pdfText = sh('pdftotext', ['-f', '1', '-l', '1', pdfPath, '-']).out
    if (sigWords.length && !sigWords.every((w) => pdfText.includes(w.replace(/&amp;/g, '&')))) {
      mismatch = `PDF 首页文本不含 deck 特征词（${sigWords.join('/')}）`
    }
  }
  if (mismatch) {
    console.error(`RENDER_MISMATCH: ${mismatch}——导出的 PDF 不属于这个 pptx（并发互踩或 PowerPoint 错配）。退出非零。`)
    process.exit(4)
  }
  renderLog.push(`RENDER_MISMATCH 核验通过（PDF ${pdfPages} 页 == pptx ${pptxPages} 页，首页特征词匹配）`)
}

// 1c. qlmanage 降级（仅首页，标记 LIMITED）
if (!pdfPath && has('qlmanage')) {
  const r = sh('qlmanage', ['-t', '-s', '1920', '-o', WORK, PPTX])
  const thumb = join(WORK, basename(PPTX) + '.png')
  if (existsSync(thumb)) {
    renderMode = 'quicklook-limited'
    renderLog.push('⚠️ 无 PowerPoint，QuickLook 仅出首页缩略图——渲染真值闸 LIMITED（只验首页，不算全量通过）')
  }
}
if (!pdfPath && renderMode !== 'quicklook-limited') {
  console.error('BLOCKED: 无可用原生渲染器（无 Microsoft PowerPoint，qlmanage 不可用）——不许用 Rust 渲染顶替验收（AGENTS.md 铁律）')
  process.exit(3)
}

// 1c. PDF → PNG（目视件）+ bbox（文本坐标）
let bboxHtml = null
let pngPages = []
if (pdfPath) {
  const pngPrefix = join(WORK, 'page')
  sh('pdftoppm', ['-png', '-r', '96', pdfPath, pngPrefix])
  pngPages = readdirSync(WORK).filter((f) => /^page-\d+\.png$/.test(f)).sort()
  const bboxOut = join(WORK, 'render-bbox.html')
  sh('pdftotext', ['-bbox', pdfPath, bboxOut])
  if (existsSync(bboxOut)) bboxHtml = readFileSync(bboxOut, 'utf8')
  renderLog.push(`pdftoppm 出 ${pngPages.length} 页 PNG（96dpi）；pdftotext -bbox ${bboxHtml ? '成功' : '失败'}`)
}

if (RENDER_ONLY) {
  console.log(JSON.stringify({ mode: renderMode, workdir: WORK, pages: pngPages.length, log: renderLog }, null, 1))
  process.exit(0)
}

// ——— Step 2: 声明几何（pptx XML）———
const slideDir = join(WORK, '_pptx')
sh('unzip', ['-o', '-q', PPTX, '-d', slideDir])
const slideFiles = readdirSync(join(slideDir, 'ppt/slides')).filter((f) => /^slide\d+\.xml$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
const EMU_PER_PT = 12700 // 1pt = 12700 EMU（1440×810 deck 坐标系下 1pt=1px）

function parseSlide(src) {
  const sps = [...src.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((m) => m[1])
  const frames = []
  for (const sp of sps) {
    const xm = sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/?>(?:<a:ext cx="(\d+)" cy="(\d+)"\/>)?/)
      ?? sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)
    if (!xm) continue
    const [x, y, cx, cy] = [+xm[1], +xm[2], +xm[3], +xm[4]].map((v) => v / EMU_PER_PT)
    const texts = [...sp.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])
    const text = texts.join('')
    // 填充色（识别 panel bg：有 solidFill 的大矩形）
    const fillM = sp.match(/<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"/)
    const fill = fillM ? '#' + fillM[1].toUpperCase() : null
    // 字号（首个 rPr sz）
    const szM = sp.match(/sz="(\d+)"/)
    const fontSize = szM ? +szM[1] / 100 : null
    frames.push({ x, y, w: cx, h: cy, text, fill, fontSize })
  }
  return frames
}
const slideFrames = slideFiles.map((f) => parseSlide(readFileSync(join(slideDir, 'ppt/slides', f), 'utf8')))

// ——— Step 3: 渲染真值（PDF bbox）———
const pageWords = new Map()
if (bboxHtml) {
  let cur = 0
  for (const line of bboxHtml.split('\n')) {
    if (/<page width=/.test(line)) { cur++; pageWords.set(cur, []); continue }
    const m = line.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/)
    if (m && cur) pageWords.get(cur).push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: m[5] })
  }
}

// ——— Step 4: 检测 ———
const issues = []
function report(sev, page, check, msg) { issues.push({ sev, page, check, msg }) }

// 页码过滤
const wantPages = (() => {
  if (!PAGES_SPEC) return null
  const s = new Set()
  for (const tok of PAGES_SPEC.split(',').map((t) => t.trim()).filter(Boolean)) {
    const range = tok.match(/^(?:page-)?(\d+)\s*-\s*(?:page-)?(\d+)$/)
    if (range) { const [a, b] = [+range[1], +range[2]].sort((x, y) => x - y); for (let n = a; n <= b; n++) s.add(n); continue }
    const one = tok.match(/^(?:page-)?(\d+)(?:\.page)?$/)
    if (one) s.add(+one[1])
  }
  return s
})()

const T_OVERFLOW = 3   // 渲染溢出容差 pt
const T_COLLISION = 0.3 // 渲染碰撞面积比
const FOOTNOTE_TOP_DEFAULT = 724

const nSlides = slideFrames.length
for (let pi = 0; pi < nSlides; pi++) {
  const pageNo = pi + 1
  if (wantPages && !wantPages.has(pageNo)) continue
  const frames = slideFrames[pi]
  const words = pageWords.get(pageNo) ?? []
  const textFrames = frames.filter((f) => f.text.trim())
  const containers = frames.filter((f) => f.fill && !f.text.trim() && f.w * f.h >= 20000 && f.w <= 900)

  // 每个文本框的渲染范围（按**文本子串归属**计算——⚠️ 不能按中心点归属：
  // 密集堆叠的相邻帧会让溢出文本的词被错归到下一帧，把「自己的行高」误判成「与别人的重叠」
  // （ASR p5 实测：bullet 的下一行溢进下一条的声明 y 域，中心点归属把 2pt 真重叠算成 18pt）。
  // 归属规则（两级）：
  //   ① 强匹配：帧的声明框**包含**词中心且声明文本**包含**词文本 → 归该帧（多帧命中取框心 y 距离最近者）
  //   ② 溢出兜底：声明文本包含词文本、且词中心距帧 y 域 ≤30pt（溢出文本会落到邻域）→ 归框心最近帧
  //   都不满足（图表轴标签/装饰词，如「2026E」被误归到含「2026E 起」的脚注）→ 不归任何帧
  const norm = (s) => String(s ?? '').replace(/[\s　]+/g, '').replace(/&amp;/g, '&')
  const frameTexts = textFrames.map((f) => norm(f.text))
  const wordsOfFrame = new Map() // frame -> [words]
  for (const w of words) {
    const wt = norm(w.t)
    if (!wt) continue
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2
    let best = null
    // ① 强匹配：框包含词中心 + 文本包含词
    for (let fi = 0; fi < textFrames.length; fi++) {
      const f = textFrames[fi]
      if (!frameTexts[fi].includes(wt)) continue
      if (cx < f.x - 2 || cx > f.x + f.w + 2 || cy < f.y - 2 || cy > f.y + f.h + 2) continue
      const dy = Math.abs((f.y + f.h / 2) - cy)
      if (!best || dy < best.dy) best = { f, dy }
    }
    // ② 溢出兜底：文本包含词 + **词 cx 在帧 x 域内（同列）** + 词中心距框 y 域 ≤30pt
    // ⚠️ 必须要求 x 包含（同列）：通用词（CAGR/SoC/2026E）在多列文本里都出现，
    // 只按 y 距离会把左列的词归到中列（ASR p5「CAGR」x=213 被归到 x=541 的帧，extent 顶被抬到 340）
    if (!best) {
      for (let fi = 0; fi < textFrames.length; fi++) {
        const f = textFrames[fi]
        if (!frameTexts[fi].includes(wt)) continue
        if (cx < f.x - 8 || cx > f.x + f.w + 8) continue
        const dyBox = cy < f.y ? f.y - cy : cy > f.y + f.h ? cy - (f.y + f.h) : 0
        if (dyBox > 30) continue
        const dy = Math.abs((f.y + f.h / 2) - cy)
        if (!best || dy < best.dy) best = { f, dy }
      }
    }
    if (best) {
      if (!wordsOfFrame.has(best.f)) wordsOfFrame.set(best.f, [])
      wordsOfFrame.get(best.f).push(w)
    }
  }
  const extentOf = (f) => {
    const inside = wordsOfFrame.get(f) ?? []
    if (!inside.length) return null
    return { bot: Math.max(...inside.map((w) => w.y1)), top: Math.min(...inside.map((w) => w.y0)), right: Math.max(...inside.map((w) => w.x1)), words: inside }
  }

  // a. rendered_overflow（三级）：
  //   error  实际重叠：渲染底 > 目标渲染顶 +1pt——文本已压进别人字形区
  //   warn   临界：渲染底与目标渲染顶间隙 <4pt——零 slack，换更宽度量渲染器必溢（hai p13 实测 1–2pt 族）
  //   warn   落空白：越出声明框 >8pt 但没撞任何元素——渲染噪声
  const extents = new Map()
  for (const f of textFrames) extents.set(f, extentOf(f))
  const renderedTopOf = (f) => extents.get(f)?.top ?? f.y
  for (const f of textFrames) {
    const ext = extents.get(f)
    if (!ext) continue
    const overB = ext.bot - (f.y + f.h)
    if (overB <= T_OVERFLOW) continue
    // 落点：渲染底边与另一元素（非自身、非声明框已相交者）渲染顶的关系
    let hit = null
    for (const o of frames) {
      if (o === f) continue
      const xOv = Math.min(f.x + f.w, o.x + o.w) - Math.max(f.x, o.x)
      if (xOv <= 0) continue
      const declaredOv = Math.min(f.y + f.h, o.y + o.h) - Math.max(f.y, o.y)
      if (declaredOv > 0) continue
      const oTop = o.text.trim() ? renderedTopOf(o) : o.y
      if (o.y > f.y + 2 && ext.bot > oTop - 4) { hit = { o, oTop }; break }
    }
    if (hit && ext.bot > hit.oTop + 1) {
      report('error', `page-${pageNo}`, 'rendered_overflow',
        `「${f.text.slice(0, 30)}」渲染底 ${ext.bot.toFixed(0)} 压进「${hit.o.text.slice(0, 18) || hit.o.fill || '元素'}」字形区（其渲染顶 ${hit.oTop.toFixed(0)}，重叠 ${(ext.bot - hit.oTop).toFixed(1)}pt）——PowerPoint 真值`)
    } else if (hit && STRICT) {
      // rendered_tight 默认关闭（2026-09-24 盘点：每本 50–260 条全裁决为噪声，纯裁决成本源）；--strict 时才出
      report('warn', `page-${pageNo}`, 'rendered_tight',
        `「${f.text.slice(0, 30)}」渲染底 ${ext.bot.toFixed(0)} 与「${hit.o.text.slice(0, 18) || hit.o.fill || '元素'}」（渲染顶 ${hit.oTop.toFixed(0)}）间隙 ${(hit.oTop - ext.bot).toFixed(1)}pt <4——零 slack，更宽度量渲染器必溢`)
    } else if (overB > 8) {
      report('warn', `page-${pageNo}`, 'rendered_overflow',
        `「${f.text.slice(0, 30)}」渲染底 ${ext.bot.toFixed(0)} 越出声明框底 ${(f.y + f.h).toFixed(0)}（${overB.toFixed(1)}pt，落进空白）——渲染噪声，目视复核`)
    }
  }

  // b. rendered_collision：两文本框渲染包围盒相交 >30% 较小者
  for (let i = 0; i < textFrames.length; i++) {
    for (let j = i + 1; j < textFrames.length; j++) {
      const ea = extents.get(textFrames[i]), eb = extents.get(textFrames[j])
      if (!ea || !eb) continue
      const fa = textFrames[i], fb = textFrames[j]
      // 渲染包围盒（用声明框与渲染范围的并集）
      const ba = { x0: Math.min(fa.x, ea.words.reduce((m, w) => Math.min(m, w.x0), Infinity)), y0: Math.min(fa.y, ea.top), x1: Math.max(fa.x + fa.w, ea.right), y1: Math.max(fa.y + fa.h, ea.bot) }
      const bb = { x0: Math.min(fb.x, eb.words.reduce((m, w) => Math.min(m, w.x0), Infinity)), y0: Math.min(fb.y, eb.top), x1: Math.max(fb.x + fb.w, eb.right), y1: Math.max(fb.y + fb.h, eb.bot) }
      const ox = Math.max(0, Math.min(ba.x1, bb.x1) - Math.max(ba.x0, bb.x0))
      const oy = Math.max(0, Math.min(ba.y1, bb.y1) - Math.max(ba.y0, bb.y0))
      if (ox * oy === 0) continue
      const smaller = Math.min((ba.x1 - ba.x0) * (ba.y1 - ba.y0), (bb.x1 - bb.x0) * (bb.y1 - bb.y0))
      if (smaller > 0 && (ox * oy) / smaller > T_COLLISION) {
        report('error', `page-${pageNo}`, 'rendered_collision',
          `「${fa.text.slice(0, 18)}」×「${fb.text.slice(0, 18)}」渲染包围盒相交 ${Math.round((ox * oy) / smaller * 100)}%——PowerPoint 真值：两文本压叠`)
      }
    }
  }

  // c. panel_breach：panel 内文本的渲染词越出 panel 边界 +3pt
  for (const c of containers) {
    const innerTexts = textFrames.filter((f) => f.x >= c.x - 2 && f.y >= c.y - 2 && f.x + f.w <= c.x + c.w + 2 && f.y + f.h <= c.y + c.h + 2)
    for (const f of innerTexts) {
      const ext = extents.get(f)
      if (!ext) continue
      const overB = ext.bot - (c.y + c.h)
      const overR = ext.right - (c.x + c.w)
      if (overB > T_OVERFLOW || overR > T_OVERFLOW) {
        report('error', `page-${pageNo}`, 'panel_breach',
          `「${f.text.slice(0, 24)}」渲染${overB > T_OVERFLOW ? `底越出 panel 底 ${overB.toFixed(1)}pt` : `右越出 panel 右 ${overR.toFixed(1)}pt`}——PowerPoint 真值：文本溢出面板边界`)
      }
    }
  }

  // d. footnote_intrusion：非 chrome 渲染词底边压进脚注区
  // 脚注区顶 = 全宽脚注文本框的顶（含编号脚注模式），缺省 724
  const footFrame = textFrames.find((f) => /^\s*1[.、]/.test(f.text) && f.y > 600) ?? null
  const footTop = footFrame ? footFrame.y : FOOTNOTE_TOP_DEFAULT
  for (const f of textFrames) {
    if (f === footFrame) continue
    const ext = extents.get(f)
    if (!ext || f.x >= 1000) continue
    if (ext.bot > footTop + 2 && f.y < footTop) {
      report('warn', `page-${pageNo}`, 'footnote_intrusion',
        `「${f.text.slice(0, 24)}」渲染底 ${ext.bot.toFixed(0)} 压进脚注区（顶 ${footTop.toFixed(0)}）`)
    }
  }
}

// ——— Step 5: 输出 ———
const nErr = issues.filter((i) => i.sev === 'error').length
const nWarn = issues.filter((i) => i.sev === 'warn').length
if (JSON_MODE) {
  console.log(JSON.stringify({ mode: renderMode, render_level: renderLevel, workdir: WORK, slides: nSlides, errors: nErr, warnings: nWarn, issues, log: renderLog }, null, 1))
} else {
  for (const l of renderLog) console.log(`  · ${l}`)
  for (const i of issues) console.log(`${i.sev === 'error' ? 'ERROR' : 'warn '}  ${i.page}  [${i.check}] ${i.msg}`)
  console.log(`\n${nSlides} slides scanned (renderer: ${renderMode}, RENDER_LEVEL=${renderLevel ?? renderMode}): ${nErr} error(s), ${nWarn} warning(s)`)
  if (renderMode === 'quicklook-limited') console.log('  ⚠️ LIMITED：QuickLook 只验了首页，不算全量通过')
  if (OUT_DIR || pngPages.length) console.log(`  渲染 PNG: ${WORK}（agent 须逐页目视签核——这是交付硬闸，不是抽查）`)
}
process.exit(nErr > 0 ? 1 : 0)
