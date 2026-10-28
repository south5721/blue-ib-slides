#!/usr/bin/env node
/**
 * text-metrics.mjs — 文本度量单源库（行数/行高估算的唯一来源）
 *
 * 被 geometry-scan.mjs require（唯一实现地）；同时是 agent 生成页面时的预检 CLI：
 *   node scripts/text-metrics.mjs --check "文本" --width <px> --size <px> [--cjk] [--georgia] [--bold]
 *   → 输出估算行数与渲染高（与闸门同因子，消灭「生成器与闸门估算不一致」）
 *
 * 估算因子（2026-09-23 hai 24p 实测标定，详见 reference/geometry-decision.md §4）：
 *   折行 = ceil(est宽 / (框宽 × K))，K = CJK 1.06 / 拉丁 1.10
 *   行高 = 声明行高 × naturalRef（楷体 1.21 / Georgia 1.16 / Arial 1.15，按 fontFamily 是否含 CJK 字体定）
 *   首行 ×1.2（字形框），后续行 × lhEff
 */
import { estimateWidth } from './text-geom.mjs'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CJK_RE = /[⺀-鿿豈-﫿＀-￯]/

export function stripHtml(t) {
  return String(t ?? '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

export function effFont(el, styles = {}) {
  const st = el.content?.style ? styles[String(el.content.style).slice(1)] : null
  return {
    fs: el.content?.fontSize ?? st?.fontSize ?? 14,
    ff: String(el.content?.fontFamily ?? st?.fontFamily ?? ''),
    bold: el.content?.bold ?? st?.bold ?? false,
    lh: el.content?.lineHeight ?? st?.lineHeight ?? null,
    wrap: el.content?.wrap !== false,
  }
}

// 按 <p> 拆段；段字号取段内 span font-size 最大者（panel 条目 16px 判断句 + 14px 论证的混合块）
export function parasOf(el, baseFs) {
  const raw = String(el.content?.text ?? '')
  // 先把完整 <p ...> 开标签换成换行符（属性不能漏进待测文本），再按段切。
  // ⚠️ 分隔符必须是 \n 不能是空格——空格会把每个单词都切成一段（28px 标题变 22 段假溢出）
  const chunks = raw.replace(/<p[^>]*>/gi, '\n').split('\n').filter((c) => stripHtml(c).trim())
  const out = []
  for (const c of chunks) {
    const sizes = [...c.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
    out.push({ text: stripHtml(c).trim(), fs: sizes.length ? Math.max(...sizes) : baseFs, bold: /<b>|<strong>/.test(c) })
  }
  return out
}

// 折行估算：行数 = ceil(est / (框宽 × K))，K = CJK 1.06 / 拉丁 1.10
// K 同时吸收 em 宽表对英文 ~5–10% 的系统性偏胖与词界折行损失
export function estLines(text, boxW, fs, { georgia = false, bold = false, cjk = false } = {}) {
  const ew = estimateWidth(text, fs, { georgia, bold })
  return Math.max(1, Math.ceil(ew / (boxW * (cjk ? 1.06 : 1.10))))
}

// 文本渲染高估算：首行 ×1.2（字形框），后续行 ×lhEff（声明 × naturalRef）
export function estTextHeight(el, styles = {}) {
  const { fs, ff, bold, lh, wrap } = effFont(el, styles)
  const boxW = Math.max(el.bounds?.[2] ?? 1, 1)
  const paras = parasOf(el, fs)
  if (!paras.length) return { h: 0, lines: 0, fs }
  const hasCjkFont = /楷体|程荣光刻楷|KaiTi|STKaiti/i.test(ff)
  let h = 0, totalLines = 0
  for (const p of paras) {
    const cjk = CJK_RE.test(p.text)
    const lines = wrap ? estLines(p.text, boxW, p.fs, { georgia: /georgia/i.test(ff), bold: bold || p.bold, cjk }) : 1
    const naturalRef = hasCjkFont ? 1.21 : (/georgia/i.test(ff) ? 1.16 : 1.15)
    const declared = lh ?? (hasCjkFont ? 1.2 : 1.15)
    const lhEff = declared * naturalRef
    h += p.fs * 1.2 + (lines - 1) * p.fs * lhEff
    totalLines += lines
  }
  const margins = [...String(el.content?.text ?? '').matchAll(/margin-top:\s*([\d.]+)px/g)].reduce((a, m) => a + Number(m[1]), 0)
  return { h: h + margins, lines: totalLines, fs }
}

// ——— 预检 CLI：agent 生成页面时估算单行/行数（与闸门同因子）———
const IS_MAIN = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? '') } catch { return false }
})()
if (IS_MAIN) {
  const a = process.argv.slice(2)
  const get = (k, d = null) => {
    const i = a.indexOf(k)
    return i >= 0 && a[i + 1] != null && !a[i + 1].startsWith('--') ? a[i + 1] : d
  }
  const has = (k) => a.includes(k)
  const text = get('--check')
  if (!text) {
    console.log(`用法: node scripts/text-metrics.mjs --check "文本" --width <px> --size <px> [选项]

选项:
  --width <px>     框宽（必填）
  --size <px>      字号（默认 16）
  --cjk            文本含 CJK（折行触发 K=1.06；默认拉丁 1.10）
  --georgia        Georgia 角色（×1.03）
  --bold           粗体（×1.03）
  --line-height <f> 声明行高（默认 1.25；行高 = 声明 × naturalRef）
  --json           输出 JSON

输出: 估算行数、估算渲染高（px）、是否单行放得下（--single 时）。
示例:
  node scripts/text-metrics.mjs --check "收入份额 47%、时长份额 71.5%" --width 219 --size 16 --cjk
  node scripts/text-metrics.mjs --check "Revenue grew 23% in FY26" --width 585 --size 16`)
    process.exit(1)
  }
  const boxW = Number(get('--width', 0))
  if (!boxW) { console.error('--width 必填（框宽 px）'); process.exit(2) }
  const fs_ = Number(get('--size', 16))
  const cjk = has('--cjk') || CJK_RE.test(text)
  const georgia = has('--georgia')
  const bold = has('--bold')
  const lh = Number(get('--line-height', 1.25))
  const naturalRef = cjk ? 1.21 : (georgia ? 1.16 : 1.15)
  const lines = estLines(text, boxW, fs_, { georgia, bold, cjk })
  const h = fs_ * 1.2 + (lines - 1) * fs_ * lh * naturalRef
  const single = lines === 1
  const verdict = single ? 'ok' : lines <= 2 ? 'warn' : 'error'
  const out = {
    text: text.slice(0, 40), boxW, fs: fs_, cjk, lines, estHeight: Math.round(h * 10) / 10,
    single, verdict,
    hint: single ? '单行放得下' : `估算 ${lines} 行 ≈${Math.round(h)}px（行高 ${lh}×${naturalRef}=${(lh * naturalRef).toFixed(2)}em）`,
  }
  if (has('--json')) console.log(JSON.stringify(out))
  else {
    const mark = verdict === 'ok' ? '✓' : verdict === 'warn' ? '⚠' : '✗'
    console.log(`${mark} 估算 ${lines} 行 ≈${Math.round(h)}px / 框宽 ${boxW}px（${cjk ? 'CJK' : '拉丁'} ${fs_}px）｜${out.hint}`)
  }
  process.exit(verdict === 'error' ? 1 : 0)
}
