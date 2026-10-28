// text-geom.mjs — 文本宽度/折行纯计算模型（零依赖、零渲染）
// 与 chart-geom.mjs 同范式：不限制能写什么，只让参数在**写页之前**可算。
// 模型来源：Arial 精确 em 宽表（qa.mjs 原实现，title_render_lines 与 text_width_estimate 共用）
//   宽度 = Σ cw(ch)×fs + ls×(len−1)，bold ×1.03，Georgia ×1.03
//   行数 = 估算宽 / 框宽 × 1.15（词界折行损耗系数）
//   CJK 1.0em ｜ 数字 0.556em ｜ sup 占位 '￿' 0.65em ｜ 未知字符 0.55em 兜底
// 判据阈值与 qa.mjs 两道闸保持一致：宽度容差 1.04；行数 >1.95 error、>1.75 warn
//
// 收口状态：qa.mjs 已改为 `import { charWidth, estimateWidth } from './text-geom.mjs'`
// （qa.mjs:32），本模块是 em 宽表与系数的唯一来源，本地副本已删。
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ——— Arial 精确 em 宽表 ———
export const ARIAL_W = {
  A: .667, B: .667, C: .722, D: .722, E: .667, F: .611, G: .778, H: .722, I: .278, J: .5, K: .667, L: .556, M: .833, N: .722, O: .778, P: .667, Q: .778, R: .722, S: .667, T: .611, U: .722, V: .667, W: .944, X: .667, Y: .667, Z: .611,
  a: .501, b: .556, c: .444, d: .556, e: .501, f: .278, g: .556, h: .556, i: .222, j: .222, k: .5, l: .222, m: .833, n: .556, o: .556, p: .556, q: .556, r: .333, s: .389, t: .278, u: .556, v: .5, w: .722, x: .5, y: .5, z: .444,
  ' ': .278, '.': .278, ',': .278, ':': .278, ';': .278, "'": .191, '’': .191, '-': .333, '–': .556, '—': 1, '(': .333, ')': .333, '%': .889, '$': .556, '+': .584, '&': .667, '/': .278, '·': .278, '=': .584, '!': .333, '?': .556, '#': .556, '@': 1.015, '_': .556, '×': .584, '−': .584, '›': .556, '"': .355, '|': .26,
}

export const WRAP_LOSS = 1.15   // 词界折行损耗系数
export const WIDTH_TOL = 1.04   // 宽度容差：est ≤ 框宽×1.04 视为不溢出
export const LINES_ERROR = 1.95 // 行数硬上限（超两行）
export const LINES_WARN = 1.75  // 行数预警

// 单字符宽（em）
export function charWidth(ch) {
  if (ch === '￿') return 0.65 // sup 占位（上标小字）
  if (/[⺀-鿿豈-﫿＀-￯]/.test(ch)) return 1.0
  if (/[0-9]/.test(ch)) return 0.556
  return ARIAL_W[ch] ?? 0.55
}

// 文本估算宽（px）。与 qa.mjs estTextWidth 逐系数一致。
export function estimateWidth(raw, fs, { georgia = false, bold = false, ls = 0 } = {}) {
  let est = 0
  for (const ch of String(raw)) est += charWidth(ch) * fs
  est += ls * Math.max(0, String(raw).length - 1)
  if (bold) est *= 1.03
  if (georgia) est *= 1.03
  return est
}

// 估算渲染行数（含词界折行损耗）
export function estimateLines(raw, boxWidth, fs, opts = {}) {
  const w = Number(boxWidth) || 1
  return (estimateWidth(raw, fs, opts) / w) * WRAP_LOSS
}

// 写页前的一次性判定：给文案 + 框宽 + 字号，回答「放得下吗 / 会排几行」
// 返回 { width, boxWidth, lines, overflow, verdict, hint }
//   verdict: 'ok' | 'warn' | 'error'，与 qa.mjs 两道闸同判据
//   singleLine=true 对应 wrap:false 单行文本（text_width_estimate 口径，看是否超框）
//   singleLine=false 对应多行文本（title_render_lines 口径，看行数）
export function fits(raw, boxWidth, fs, { singleLine = false, ...opts } = {}) {
  const width = estimateWidth(raw, fs, opts)
  const bw = Number(boxWidth) || 1
  const lines = (width / bw) * WRAP_LOSS
  if (singleLine) {
    const overflow = width > bw * WIDTH_TOL
    return {
      width: Math.round(width), boxWidth: bw, lines: +lines.toFixed(2), overflow,
      verdict: overflow ? 'error' : 'ok',
      hint: overflow
        ? `超框 ${Math.round(width - bw)}px——缩短文案、加宽框，或改 wrap:true`
        : '放得下',
    }
  }
  const verdict = lines > LINES_ERROR ? 'error' : lines > LINES_WARN ? 'warn' : 'ok'
  return {
    width: Math.round(width), boxWidth: bw, lines: +lines.toFixed(2), overflow: lines > LINES_ERROR,
    verdict,
    hint: verdict === 'error' ? `估算 ${lines.toFixed(1)} 行，超两行上限——缩短标题`
      : verdict === 'warn' ? `估算 ${lines.toFixed(1)} 行，逼近两行上限——截图确认`
      : `估算 ${lines.toFixed(1)} 行`,
  }
}

// 反解：给定框宽与字号，单行最多能放多少个字符（按文案自身平均字宽，非通用均值）
export function maxChars(raw, boxWidth, fs, opts = {}) {
  const s = String(raw)
  if (!s) return 0
  const per = estimateWidth(s, fs, opts) / s.length
  return Math.max(0, Math.floor((Number(boxWidth) || 0) * WIDTH_TOL / per))
}

// ——— CLI ———
// node scripts/text-geom.mjs --text "…" --width 585 --size 16 [--font Georgia] [--bold] [--ls 2.16] [--single] [--json]
//
// ⚠️ 入口判断必须走 realpath 比较（2026-09-16 实测定案）：原写法 `import.meta.url === file://${argv[1]}`
//    在**路径含符号链接时不成立** —— `$SKILL_DIR` 就是指向 skill 源目录
//    的符号链接，而 SKILL.md 写给 agent 的调用路径正是前者。症状是**静默无输出且 exit 0**：
//    没有任何失败信号，agent 以为「算过了」就往下写，两道宽度闸只能等 qa.mjs 事后拦。
//    argv[1] 带空格/相对路径时旧写法同样失效，realpath 一并解掉。
const IS_MAIN = (() => {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? '')
  } catch {
    return false // argv[1] 不存在（被 import 使用）或不可 stat → 非 CLI
  }
})()
if (IS_MAIN) {
  const a = process.argv.slice(2)
  const get = (k, d = null) => {
    const i = a.indexOf(k)
    return i >= 0 && a[i + 1] != null && !a[i + 1].startsWith('--') ? a[i + 1] : d
  }
  const has = (k) => a.includes(k)
  const text = get('--text')
  if (!text) {
    console.log(`用法: node scripts/text-geom.mjs --text "文案" --width <px> --size <px> [选项]

选项:
  --font Georgia   标题/大数字角色（×1.03）；默认 Arial
  --bold           粗体（×1.03）
  --ls <px>        字距（kicker 类用，如 2.16）
  --single         wrap:false 单行文本，判是否超框（默认判折行行数）
  --json           输出 JSON

示例:
  node scripts/text-geom.mjs --text "Revenue grew 23% in FY26" --width 585 --size 16
  node scripts/text-geom.mjs --text "AI capex re-rates the group" --width 1312 --size 28 --font Georgia --bold
  node scripts/text-geom.mjs --text "\$4,510M" --width 120 --size 14 --single`)
    process.exit(1)
  }
  const fs_ = Number(get('--size', 16))
  const bw = Number(get('--width', 1312))
  const opts = { georgia: /georgia/i.test(get('--font', '')), bold: has('--bold'), ls: Number(get('--ls', 0)) }
  const r = fits(text, bw, fs_, { singleLine: has('--single'), ...opts })
  if (has('--json')) console.log(JSON.stringify(r))
  else {
    const mark = r.verdict === 'ok' ? '✓' : r.verdict === 'warn' ? '⚠' : '✗'
    console.log(`${mark} 估算宽 ${r.width}px / 框宽 ${r.boxWidth}px｜${r.lines} 行｜${r.hint}`)
    if (r.verdict !== 'ok' && has('--single')) {
      console.log(`  单行上限约 ${maxChars(text, bw, fs_, opts)} 字符（按本文案字宽）`)
    }
  }
}
