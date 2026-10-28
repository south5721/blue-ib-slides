#!/usr/bin/env node
/**
 * optimize-media.mjs <deckDir> — 把 deck 里的位图统一成幻灯片分辨率 JPG（尽量小）。
 *
 * 背景：导出链上传 STORE zip（不压缩），服务端上传硬顶 ≈1MB；
 * 封面/照片级 PNG（1.4–3MB）直接打爆。规则（2026-09-21 用户定）：
 *   插入 PPT 的位图一律转 1440×810 JPG——封面类全幅图居中裁切到精确 1440×810，
 *   其余按最长边 1440 等比缩；SVG 不动（矢量天然小）。
 * 引用同步改写：pages/*.page 与 presentation.pptd 里的 .png → .jpg。
 * 幂等：已是 ≤1440×810 且 ≤450KB 的 jpg 跳过。
 * 工具链（2026-09-28 跨平台修复）：sips（macOS 自带）→ ImageMagick（magick/convert）→
 *   都没有时 exit 3 显式跳过（不崩溃、不静默；调用方据此区分「未执行」与「已跑过仍超限」）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const deckDir = process.argv[2]
if (!deckDir || !existsSync(join(deckDir, 'presentation.pptd'))) {
  console.error('usage: node optimize-media.mjs <deckDir> [--dry]')
  process.exit(2)
}
const DRY = process.argv.includes('--dry')
const MAX_W = 1440, MAX_H = 810, QUALITY = 82, SKIP_BYTES = 450 * 1024

// ---------------------------------------------------------------- 位图工具探测（sips → magick → convert → 无）
const TOOL = (() => {
  if (!spawnSync('sips', ['-h'], { encoding: 'utf8' }).error) return 'sips'
  if (!spawnSync('magick', ['-version'], { encoding: 'utf8' }).error) return 'magick'
  if (!spawnSync('convert', ['-version'], { encoding: 'utf8' }).error) return 'convert'
  return null
})()

function dims(f) {
  if (TOOL === 'sips') {
    const r = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f], { encoding: 'utf8' })
    if (r.error || !r.stdout) return null
    const w = Number(r.stdout.match(/pixelWidth:\s*(\d+)/)?.[1])
    const h = Number(r.stdout.match(/pixelHeight:\s*(\d+)/)?.[1])
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null
  }
  const idBin = TOOL === 'magick' ? ['magick', ['identify']] : TOOL === 'convert' ? ['identify', []] : null
  if (!idBin) return null
  const r = spawnSync(idBin[0], [...idBin[1], '-format', '%w %h', f], { encoding: 'utf8' })
  if (r.error || !r.stdout) return null
  const m = r.stdout.trim().match(/^(\d+)\s+(\d+)/)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null
}

// 执行单张转换；返回 { ok, err? }。cmd 语义与 sips 版保持一致：
// 封面类全幅图 → 精确 1440×810 居中裁切 JPG；其余 → 最长边 1440 等比 JPG。
function convertOne(abs, outAbs, d, isCover) {
  let cmd, args
  if (TOOL === 'sips') {
    const jobs = []
    if (isCover) {
      jobs.push(['--resampleHeightWidthMax', String(Math.max(MAX_W, Math.ceil(MAX_W * (d.h / d.w)))), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), abs, '--out', outAbs])
      jobs.push(['-c', String(MAX_H), String(MAX_W), outAbs, '--out', outAbs])
    } else {
      jobs.push(['--resampleHeightWidthMax', String(MAX_W), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), abs, '--out', outAbs])
    }
    for (const j of jobs) {
      const r = spawnSync('sips', j, { encoding: 'utf8' })
      if (r.error || r.status !== 0) return { ok: false, err: (r.stderr || String(r.error || '')).trim() }
    }
    return { ok: true }
  }
  const base = TOOL === 'magick' ? ['magick', 'convert'] : ['convert']
  const imArgs = isCover
    ? [abs, '-resize', `${MAX_W}x${MAX_H}^`, '-gravity', 'center', '-extent', `${MAX_W}x${MAX_H}`, '-quality', String(QUALITY), outAbs]
    : [abs, '-resize', `${MAX_W}x${MAX_H}>`, '-quality', String(QUALITY), outAbs]
  const r = spawnSync(base[0], [...base.slice(1), ...imArgs], { encoding: 'utf8' })
  if (r.error || r.status !== 0) return { ok: false, err: (r.stderr || String(r.error || '')).trim() }
  return { ok: true }
}

// ---------------------------------------------------------------- 收集引用位图的文本/媒体文件
function* walkText(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      if (['shots', 'snapshots', 'briefing', 'compare'].includes(name)) continue
      yield* walkText(abs)
    } else if (/\.(page|pptd)$/.test(name)) yield abs
  }
}
function* walkMedia(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) yield* walkMedia(abs)
    else if (/\.(png|jpe?g)$/i.test(name)) yield abs
  }
}

const mediaDir = join(deckDir, 'media')
if (!existsSync(mediaDir)) { console.log('no media/ — nothing to do'); process.exit(0) }

if (!TOOL) {
  console.error('optimize-media: 无可用位图工具（sips/magick/convert 均缺失，当前环境非 macOS 且无 ImageMagick）——跳过位图优化，deck 未改动')
  process.exit(3)
}

// 检测图片是否带有效 alpha 通道（RGBA 资产：白字形 icon / 点阵装饰 / 圆环弧光）。
// 这类资产转 JPG 会丢 alpha（白字形变白底不可见）、放大会糊——一律跳过转换（2026-10-19 图标资产被误转案）。
function hasAlpha(f) {
  if (TOOL === 'sips') {
    const r = spawnSync('sips', ['-g', 'hasAlpha', f], { encoding: 'utf8' })
    return !r.error && /hasAlpha:\s*(yes|1)/i.test(r.stdout || '')
  }
  const idBin = TOOL === 'magick' ? ['magick', ['identify']] : TOOL === 'convert' ? ['identify', []] : null
  if (!idBin) return false
  const r = spawnSync(idBin[0], [...idBin[1], '-format', '%A', f], { encoding: 'utf8' })
  return !r.error && /true|yes/i.test((r.stdout || '').trim())
}

const renames = new Map() // 原相对路径 → 新相对路径（引用改写用）
let nConv = 0, nSkip = 0, savedBytes = 0, nFail = 0
for (const abs of walkMedia(mediaDir)) {
  const rel = abs.slice(deckDir.length + 1).split('/').join('/')
  const size = statSync(abs).size
  const d = dims(abs)
  const isCover = /cover/i.test(basename(abs))
  const ext = extname(abs).toLowerCase()
  const alreadyJpg = ext === '.jpg' || ext === '.jpeg'
  if (alreadyJpg && size <= SKIP_BYTES && d && d.w <= MAX_W && d.h <= MAX_H) { nSkip++; continue }
  if (!d) { console.log(`  skip（读不到尺寸）: ${rel}`); nSkip++; continue }
  if (!alreadyJpg && hasAlpha(abs)) { nSkip++; continue }   // RGBA 资产不动（白字形/点阵/弧光）

  const outAbs = abs.replace(/\.(png|jpe?g)$/i, '.jpg')
  const outRel = outAbs.slice(deckDir.length + 1).split('/').join('/')
  const needCover = isCover && (d.w !== MAX_W || d.h !== MAX_H)
  const needPlain = !isCover && (d.w > MAX_W || d.h > MAX_H || !alreadyJpg)
  if (!needCover && !needPlain) { nSkip++; continue }
  if (DRY) { console.log(`  [dry] ${rel} (${d.w}×${d.h}, ${(size / 1024).toFixed(0)}KB) → ${outRel} [${TOOL}]`); nConv++; continue }
  const c = convertOne(abs, outAbs, d, needCover)
  if (!c.ok) { console.error(`  ✗ ${TOOL} 失败 ${rel}: ${c.err}`); nFail++; continue }
  if (!existsSync(outAbs)) { console.error(`  ✗ 产物缺失 ${outRel}`); nFail++; continue }
  const newSize = statSync(outAbs).size
  savedBytes += Math.max(0, size - newSize)
  if (outAbs !== abs) unlinkSync(abs)
  renames.set(basename(rel), basename(outRel))
  console.log(`  ✓ ${rel} (${d.w}×${d.h}, ${(size / 1024).toFixed(0)}KB) → ${outRel} (${(newSize / 1024).toFixed(0)}KB) [${TOOL}]`)
  nConv++
}

// 引用改写（仅当发生了 .png→.jpg 改名）
if (!DRY && renames.size) {
  for (const tf of walkText(deckDir)) {
    let t = readFileSync(tf, 'utf8'), hit = false
    for (const [from, to] of renames) {
      if (t.includes(from)) { t = t.split(from).join(to); hit = true }
    }
    if (hit) { writeFileSync(tf, t); console.log(`  ref 更新: ${tf.slice(deckDir.length + 1)}`) }
  }
}
console.log(`optimize-media: ${nConv} 转换 / ${nSkip} 跳过 / ${nFail} 失败，省 ${(savedBytes / 1024).toFixed(0)}KB [${TOOL}]${DRY ? '（dry-run 未落盘）' : ''}`)
process.exit(nFail > 0 ? 1 : 0)
