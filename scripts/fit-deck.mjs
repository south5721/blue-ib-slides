#!/usr/bin/env node
/**
 * fit-deck.mjs — v3 自适应排版引擎（内容感知字阶 + 版面拉伸）
 *
 * 思想来源：ppt-master 的 body_size 内容量定档与模块溢出纪律（5% warn / 超即修），
 * 落到本体系的 .pptd 数据模型与字阶白名单上，做成写页后、QA 前的一道机械工序。
 *
 * 它只做两类「不用动脑子」的调整，把判断题留给 geometry-decision.md：
 *
 *   ① 字阶自适应（--fix）：
 *      - 溢出 → 沿字阶白名单逐级下调，到「角色地板」为止；内联 font-size 按比例联动（就近吸档）。
 *        任何页面密度都执行（溢出是事故，不是风格）。
 *      - 欠填 → 沿字阶白名单上调，但**只发生在呼吸页**（PLAN.md 节奏=呼吸，或元素 <55 个），
 *        收敛到目标填充率即停（幂等：重复跑结果不变），到「角色天花板」为止；
 *        且同族元素（id 去尾数字后同前缀、≥3 个同档）要么一起调要么都不调——
 *        这就是「少而大」的机械化：密集页保持 14/16 的密集字阶，呼吸页才把空区变成字重。
 *
 *   ② 版面拉伸（--stretch，只作用于 pageType: content 的呼吸页）：
 *      内容底缘 B < 0.87×735 时，以内容顶缘 A 为锚等比拉开纵向间距（k ≤ 1.6），
 *      只动 y 坐标不动高度——即「空位先拉伸后填充禁塞字」的机械化。
 *      chrome-*、满幅背景、y≥740 的底栏件不参与；徽章-卡片悬贴关系随动保距。
 *
 * 用法:
 *   node fit-deck.mjs <deckDir>                  # 干跑：只报告会改什么（改前必看）
 *   node fit-deck.mjs <deckDir> --fix            # 落盘字阶调整
 *   node fit-deck.mjs <deckDir> --fix --stretch  # 连版面拉伸一起落盘
 *   node fit-deck.mjs <deckDir> --pages 3,7-9    # 只处理指定页（写页子 agent 自检用）
 * 退出码: 仍有「到地板还溢出」的元素 → 1；其余 → 0；用法错 → 2
 *
 * ⚠️ 写回方式是按 elementId 块做外科式行编辑（不动注释与键序），
 *    但请在 fit 之前先过 kimi-slides check（结构坏了请先修结构）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import yaml from './js-yaml.mjs'
import { estimateWidth } from './text-geom.mjs'
import { estTextHeight, effFont, stripHtml } from './text-metrics.mjs'

// ——— 字阶与角色表（单一来源；reference/auto-fit.md §1 是给人看的同一份）———
const FONT_SCALE = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44]
const ROLES = {
  title: { floor: 32, ceil: 32, grow: false },
  pageno: { floor: 10, ceil: 10, grow: false },
  banner: { floor: 16, ceil: 20, grow: false },
  bignum: { floor: 24, ceil: 44, grow: true },
  label: { floor: 11, ceil: 18, grow: true },
  body: { floor: 14, ceil: 18, grow: true },
}
function roleOf(el, fs, styleName) {
  const id = String(el.elementId ?? '')
  if (id === 'chrome-title' || styleName === 'pageTitle') return 'title'
  if (id === 'chrome-pageno' || styleName === 'pageno') return 'pageno'
  if (/banner/i.test(id)) return 'banner'
  if (fs >= 24 || /kpi|bignum|stat[-_]?num|hero/i.test(id)) return 'bignum'
  if (/badge|chip|label|tag|pill/i.test(id)) return 'label'
  return 'body'
}
const stepDown = (fs) => [...FONT_SCALE].reverse().find((s) => s < fs) ?? null
const stepUp = (fs) => FONT_SCALE.find((s) => s > fs) ?? null
const snap = (v) => FONT_SCALE.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), FONT_SCALE[0])

// 阈值（与 qa.mjs 同族口径；容差略松于闸，避免 fit 完立刻被闸拦）
const W_TOL = 1.04        // 单行宽容差（同 text_width_estimate）
const H_OVER = 0.96       // 折行文本高 > 框高×0.96 = 溢出
const H_UNDER = 0.45      // 折行文本高 < 框高×0.45 = 欠填
const W_UNDER = 0.45      // 单行宽 < 框宽×0.45 = 欠填
const GROW_TO_H = 0.62    // 折行上调目标填充率（幂等锚点：到位即停，重复跑不再变）
const GROW_TO_W = 0.55    // 单行上调目标填充率（同上）
const ZONE_BOTTOM = 735   // 内容区底缘（底栏件之上）
const STRETCH_TRIG = 0.87 // 内容底缘 < ZONE_BOTTOM×0.87 才拉
const STRETCH_MAX = 1.6   // 间距放大上限

// ——— CLI ———
const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('-'))
if (!dir || !existsSync(join(dir, 'presentation.pptd'))) {
  console.error('usage: node fit-deck.mjs <pptdDir> [--fix] [--stretch] [--pages 3,7-9] [--tone IC|路演] [--json]')
  process.exit(2)
}
const FIX = args.includes('--fix')
const STRETCH = args.includes('--stretch')
const JSON_OUT = args.includes('--json')
const toneIdx = args.indexOf('--tone')
const TONE = toneIdx >= 0 ? args[toneIdx + 1] : 'IC'
function parsePages(spec) {
  if (!spec) return null
  const out = new Set()
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(?:page-)?(\d+)(?:-(?:page-)?(\d+))?$/)
    if (!m) continue
    const a = +m[1], b = +(m[2] ?? m[1])
    for (let i = a; i <= b; i++) out.add(`page-${i}`)
  }
  return out
}
const pIdx = args.indexOf('--pages')
const PAGES = pIdx >= 0 ? parsePages(args[pIdx + 1]) : null

const pres = yaml.load(readFileSync(join(dir, 'presentation.pptd'), 'utf8'))
const styles = pres?.theme?.textStyles ?? {}

// ——— 页面节奏（grow/stretch 只在呼吸页执行；与 qa.mjs page_rhythm_* 同口径）———
function loadRhythms() {
  const p = join(dir, 'PLAN.md')
  if (!existsSync(p)) return new Map()
  const RH_MAP = { anchor: 'anchor', dense: 'dense', breathing: 'breathing', '锚点': 'anchor', '密集': 'dense', '呼吸': 'breathing' }
  const rhythms = new Map()
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*\|\s*(\d+)\s*\|(.+)\|\s*$/)
    if (!m) continue
    const hit = m[2].split('|').map((s) => s.trim()).find((c) => RH_MAP[c.toLowerCase()])
    if (hit) rhythms.set(`page-${Number(m[1])}`, RH_MAP[hit.toLowerCase()])
  }
  return rhythms
}
const RHYTHMS = loadRhythms()
// 呼吸判定：PLAN 声明优先；缺省按元素数带宽（<55 = 呼吸，与 page_rhythm_mismatch 同口径）
function isBreathing(pageId, elCount) {
  const r = RHYTHMS.get(pageId)
  if (r) return r === 'breathing'
  return elCount < 55
}
// 同族分组：tl-node-txt-0 / bg-btxt-10 → 去尾数字归族；≥3 个同档成员的族要么整族调要么不动
const familyOf = (id) => String(id).replace(/[-_ ]?\d+$/, '')

// ——— 测量一个文本元素：返回 {kind:'w'|'h', fill, overflow, fs, role} ———
function measure(el) {
  const { fs, ff, bold, wrap } = effFont(el, styles)
  const ls = el.content?.letterSpacing ?? 0
  const role = roleOf(el, fs, el.content?.style ? String(el.content.style).slice(1) : '')
  const text = String(el.content?.text ?? '')
  if (!stripHtml(text).trim()) return null
  const [, , bw, bh] = el.bounds
  if (!wrap) {
    // 单行：量宽（wrap:false 文本框宽即语义宽）
    const plain = stripHtml(text).replace(/\s+/g, ' ').trim()
    const est = estimateWidth(plain, fs, { georgia: /georgia/i.test(String(ff)), bold, ls })
    return { kind: 'w', fill: est / Math.max(bw, 1), overflow: est > bw * W_TOL, est, fs, role, bold }
  }
  const { h } = estTextHeight(el, styles)
  return { kind: 'h', fill: h / Math.max(bh, 1), overflow: h > bh * H_OVER, est: h, fs, role, bold }
}

// 字号从 oldFs 变 newFs 时，内联 font-size 联动表（就近吸档，地板 10，天花板 = 新基准字号——
// 上调时内联大字号若按比例放大可能反超探测口径，锁顶防回流）
function inlineMap(text, oldFs, newFs) {
  const r = newFs / oldFs
  const map = new Map()
  for (const m of String(text).matchAll(/font-size:\s*([\d.]+)px/g)) {
    const n = Number(m[1])
    if (!map.has(n)) map.set(n, Math.min(newFs, Math.max(10, snap(n * r))))
  }
  return map
}

// ——— 主循环 ———
const pageFiles = readdirSync(join(dir, 'pages')).filter((f) => f.endsWith('.page')).sort()
const allChanges = []
const hardOverflow = []
for (const pf of pageFiles) {
  const pageId = pf.replace('.page', '')
  if (PAGES && !PAGES.has(pageId)) continue
  const path = join(dir, 'pages', pf)
  const raw = readFileSync(path, 'utf8')
  const doc = yaml.load(raw)
  const els = doc?.elements ?? []
  const pageType = doc?.pageType ?? 'content'
  const changes = [] // {id, field, from, to} / {id, field:'inline', map}
  const elCount = els.filter((e) => e && (e.elementType === 'text' || e.elementType === 'shape')).length
  const breathing = isBreathing(pageId, elCount)

  // ① 字阶自适应：先量出每个文本元素的目标档
  const wanted = new Map() // el -> {from, to, role, fill}
  for (const el of els) {
    if (el?.elementType !== 'text' || !Array.isArray(el.bounds)) continue
    const mm = measure(el)
    if (!mm) continue
    const R = ROLES[mm.role]
    if (mm.overflow) {
      // 缩：逐级下调直到不溢出或到地板（任何密度页都执行）
      let cur = mm.fs
      while (true) {
        const nxt = stepDown(cur)
        if (nxt == null || nxt < R.floor) break
        cur = nxt
        const probe = { ...el, content: { ...el.content, fontSize: cur, style: undefined } }
        if (!measure(probe).overflow) break
      }
      if (cur !== mm.fs) {
        const probe = { ...el, content: { ...el.content, fontSize: cur, style: undefined } }
        if (measure(probe).overflow) hardOverflow.push({ pageId, id: el.elementId, role: mm.role, fs: cur, fill: +measure(probe).fill.toFixed(2) })
        wanted.set(el, { from: mm.fs, to: cur, role: mm.role, fill: mm.fill })
      } else {
        hardOverflow.push({ pageId, id: el.elementId, role: mm.role, fs: mm.fs, fill: +mm.fill.toFixed(2) })
      }
    } else if (breathing && R.grow) {
      // 增：仅呼吸页；收敛到目标填充率即停（幂等——重复跑结果不变）
      const underfilled =
        (mm.kind === 'h' && mm.fill < H_UNDER) ||
        (mm.kind === 'w' && mm.fill < W_UNDER && el.bounds[3] >= mm.fs * 1.8)
      if (underfilled) {
        let cur = mm.fs
        const targetFill = mm.kind === 'h' ? GROW_TO_H : GROW_TO_W
        // 探测时剥掉内联 font-size：写回时内联会被锁顶到目标档（inlineMap cap），
        // 剥除后的探测 = 写回后的真实上限，防止「按旧内联小字号估能放、写回后溢出」
        const stripped = String(el.content?.text ?? '').replace(/font-size:\s*[\d.]+px/g, '')
        while (true) {
          const nxt = stepUp(cur)
          if (nxt == null || nxt > R.ceil) break
          const probe = { ...el, content: { ...el.content, text: stripped, fontSize: nxt, style: undefined } }
          const pm = measure(probe)
          if (pm.overflow || pm.fill > 0.92) break
          cur = nxt
          if (pm.fill >= targetFill) break
        }
        if (cur !== mm.fs) wanted.set(el, { from: mm.fs, to: cur, role: mm.role, fill: mm.fill })
      }
    }
  }

  // 同族一致闸：族（≥3 个成员）里上调名单不齐 → 整族撤调（表格行/芯片行最怕参差不齐）
  const fams = new Map()
  for (const el of els) {
    if (el?.elementType !== 'text') continue
    const fam = familyOf(el.elementId ?? '')
    if (!fams.has(fam)) fams.set(fam, [])
    fams.get(fam).push(el)
  }
  for (const members of fams.values()) {
    if (members.length < 3) continue
    const growees = members.filter((e) => wanted.has(e) && wanted.get(e).to > wanted.get(e).from)
    // 族内当前同档（同 from）的成员必须全部在列；只覆盖一部分 = 撤掉整族
    const peers = members.filter((e) => {
      const w = wanted.get(e)
      const fs = w ? w.from : (e.content?.fontSize ?? null)
      return growees.length && fs === wanted.get(growees[0]).from
    })
    if (!growees.length) continue
    if (growees.length < peers.length) {
      for (const e of growees) wanted.delete(e)
    } else {
      // 全员在列但目标档不齐 → 向最低档看齐（peer_font_consistency：同族必须同档收束）
      const t = Math.min(...growees.map((e) => wanted.get(e).to))
      for (const e of growees) wanted.get(e).to = t
    }
  }
  for (const [el, w] of wanted) {
    changes.push({ id: el.elementId, field: 'fontSize', from: w.from, to: w.to, role: w.role, fill: +w.fill.toFixed(2) })
    const im = inlineMap(el.content?.text ?? '', w.from, w.to)
    for (const [o, n] of im) if (o !== n) changes.push({ id: el.elementId, field: 'inline', from: o, to: n })
  }

  // ② 版面拉伸（只 content 呼吸页；锚=内容顶缘，拉开纵向间距）
  if (pageType === 'content' && breathing) {
    const stretchable = els.filter((e) => {
      if (!Array.isArray(e?.bounds)) return false
      const id = String(e.elementId ?? '')
      if (id.startsWith('chrome-')) return false
      const [x, y, w, h] = e.bounds
      if (w >= 1200 && h >= 400) return false // 满幅背景
      if (y >= 740) return false              // 底栏件
      return true
    })
    if (stretchable.length >= 3) {
      const A = Math.min(...stretchable.map((e) => e.bounds[1]))
      const B = Math.max(...stretchable.map((e) => e.bounds[1] + e.bounds[3]))
      if (B < ZONE_BOTTOM * STRETCH_TRIG && B > A + 40) {
        const k = Math.min((ZONE_BOTTOM - A) / (B - A), STRETCH_MAX)
        if (k >= 1.03) {
          for (const e of stretchable) {
            const ny = Math.round((A + (e.bounds[1] - A) * k) * 10) / 10
            changes.push({ id: e.elementId, field: 'y', from: e.bounds[1], to: ny, k: +k.toFixed(3) })
          }
        }
      }
    }
  }

  if (!changes.length) continue
  const stretchChanges = changes.filter((c) => c.field === 'y')
  const fontChanges = changes.filter((c) => c.field !== 'y')
  // A dry run must never write, including when --stretch is present.
  // Omitting --stretch must not suppress valid --fix font changes.
  if (!FIX) { allChanges.push({ pageId, pending: changes }); continue }
  const apply = changes.filter((c) => (c.field === 'y' ? STRETCH : true))
  if (!apply.length) continue

  // ——— 外科式写回：按 elementId 块替换 ———
  const lines = raw.split('\n')
  const blockStart = new Map() // id -> [start, end)
  let cur = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{2,}- elementId:\s*(\S+)/)
    if (m) { if (cur) blockStart.get(cur)[1] = i; cur = m[1]; blockStart.set(cur, [i, lines.length]) }
  }
  const byId = new Map()
  for (const c of apply) {
    if (!byId.has(c.id)) byId.set(c.id, [])
    byId.get(c.id).push(c)
  }
  let touched = 0
  // Inserting inherited fontSize keys shifts line offsets. Edit bottom-up.
  const orderedChanges=[...byId].sort((a,b)=>(blockStart.get(b[0])?.[0]??0)-(blockStart.get(a[0])?.[0]??0))
  for (const [id, cs] of orderedChanges) {
    const rng = blockStart.get(id)
    if (!rng) continue
    for (let i = rng[0]; i < rng[1]; i++) {
      for (const c of cs) {
        if (c.field === 'y') {
          lines[i] = lines[i].replace(/bounds:\s*\[([^\]]+)\]/, (m0, g) => {
            const parts = g.split(',').map((s) => s.trim())
            if (Number(parts[1]) !== c.from && Math.abs(Number(parts[1]) - c.from) > 0.05) return m0
            parts[1] = String(c.to)
            return `bounds: [${parts.join(', ')}]`
          })
        } else if (c.field === 'fontSize') {
          if (new RegExp(`^\\s+fontSize:\\s*${c.from}\\s*$`).test(lines[i])) {
            lines[i] = lines[i].replace(/fontSize:\s*[\d.]+/, `fontSize: ${c.to}`)
            touched++
            c._done = true
          }
        } else if (c.field === 'inline') {
          const re = new RegExp(`font-size:\\s*${c.from}px`, 'g')
          if (re.test(lines[i])) { lines[i] = lines[i].replace(re, `font-size:${c.to}px`); c._done = true }
        }
      }
    }
    // 元素原来没有显式 fontSize（继承 style）→ 在 content 段插入
    const fontCh = cs.find((c) => c.field === 'fontSize' && !c._done)
    if (fontCh) {
      for (let i = rng[0]; i < rng[1]; i++) {
        if (/^\s{6}(align|style|wrap):/.test(lines[i])) {
          const indent = lines[i].match(/^\s+/)[0]
          lines.splice(i + 1, 0, `${indent}fontSize: ${fontCh.to}`)
          fontCh._done = true
          touched++
          rng[1]++
          break
        }
      }
    }
  }
  writeFileSync(path, lines.join('\n'))
  allChanges.push({ pageId, applied: apply, written: touched })
}

// ——— 报告 ———
if (JSON_OUT) {
  console.log(JSON.stringify({ tone: TONE, fix: FIX, stretch: STRETCH, changes: allChanges, hardOverflow }, null, 1))
} else {
  if (!allChanges.length && !hardOverflow.length) console.log('fit-deck: 全部元素字阶与版面填充率达标，无需调整')
  for (const c of allChanges) {
    const list = c.applied ?? c.pending
    const fonts = list.filter((x) => x.field === 'fontSize')
    const ys = list.filter((x) => x.field === 'y')
    const inl = list.filter((x) => x.field === 'inline').length
    const tag = c.applied ? '已改' : '将改'
    if (fonts.length) console.log(`${c.pageId}: ${tag}字号 ${fonts.map((f) => `${f.id} ${f.from}→${f.to}(${f.role},填充${Math.round(f.fill * 100)}%)`).join('；')}${inl ? `；内联联动 ${inl} 处` : ''}`)
    if (ys.length) console.log(`${c.pageId}: ${tag}版面拉伸 ${ys.length} 个元素（k=${ys[0].k}，内容底缘拉至 ${ZONE_BOTTOM}px 一线）`)
  }
  if (hardOverflow.length) {
    console.log('\n✗ 到角色地板仍溢出（字阶救不了，走 geometry-decision.md 决策序：瘦身文本→调行高→扩框→减元素）:')
    for (const h of hardOverflow) console.log(`  ${h.pageId} ${h.id} [${h.role} ${h.fs}pt, 填充 ${Math.round(h.fill * 100)}%]`)
  }
  if (!FIX && allChanges.some((c) => c.pending)) console.log('\n（干跑模式：加 --fix 落盘字阶，加 --stretch 落盘版面拉伸）')
}
process.exit(hardOverflow.length ? 1 : 0)
