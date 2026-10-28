#!/usr/bin/env node
/**
 * blue-ib-slides QA gate — 对 PPTD 目录做机械检查（配合 kimi-slides check 使用）。
 * 改造来源：蓝调版式体系的质量规则与公开回归要求——
 * 以 institutional-slides qa.mjs 为底，按「保留/替换/删除/新增」四张清单落到蓝调投行版式体系。
 *
 * 用法: node qa.mjs <pptdDir> [--warn-only] [--only <rule>] [--pages <spec>]
 * 退出码: 有 error 级问题 → 1；全过或仅 warn → 0；用法错/点名的页不存在 → 2
 *
 * --pages <spec>：只检指定页，供**写页 agent 交付前自检**用（`page-7,page-8` / `7,8` / `7-9` 混写均可）。
 *   子集模式下 deck 级三项（dash_density / not_but_parallel / bg_color_limit）自动跳过。
 *
 * 闸清单（分组与判定细节见 reference/qa-gate.md，每闸一行）:
 *   结构闸：yaml_parse / bounds_check / chrome_complete(title+pageno) / title_align /
 *     chrome_title_position / chrome_pageno_position / style_ref_exists / img_src_exists /
 *     media_image_weight / deck_payload_over_1mb / element_collision / z_order_occlusion /
 *     z_order_cover / placeholder_leftover / svg_no_comments / logo_placeholder_left /
 *     cover_bg_present / page_density / page_sparse / content_underfill(v3)
 *   形态闸：shape_rules(蓝系柔影/同色相渐变/禁 round1-2) / rule_as_rect / row_rhythm /
 *     chart_left_gutter(45.2) / chart_right_gutter / unit_label_align / chart_title_align
 *   字排闸：min_font(10) / font_scale_whitelist / font_family_discipline(Arial+微软雅黑) /
 *     peer_font_consistency / text_width_estimate / text_vfit_overflow(v3) / title_render_lines / title_lines /
 *     title_is_sentence / no_nbsp / text_block_blob / no_native_list
 *   图表闸：series_name_numeric / axis_show_false / chart_gridline / cat_label_length /
 *     xaxis_value_label / pie_max_slices / clustered_bar_limit / stacked_zero_value /
 *     waterfall_closure / waterfall_negative_color / waterfall_no_native_type /
 *     waterfall_cat_label_len / combo_no_bar_ctr_labels / hbar_no_line_series /
 *     doughnut_legend_right / label_contrast / chart_color_semantics / bar_label_redundant /
 *     stacked_toplabel_missing
 *   语义闸：toc_msg_viewpoint / banner_text_viewpoint / dual_accent_limit / dark_text_gold /
 *     palette_closed(渐变 stop 与 $引用展开校验) / text_contrast(WCAG 文本-底对比度)
 *   散文闸：ai_slop / dash_density / not_but_parallel / explainer_preamble / bg_color_limit /
 *     orphan_line(末行孤字)
 *   策划闸（warn 级，planning.md）：plan_contract / page_rhythm_mismatch / page_rhythm_flat /
 *     closing_missing
 *
 * 删除清单（K 体系专有，本体系不携带；含仅被其使用的 helper）:
 *   insight_panel_* / harvey_* / football_* / cagr_* / hero_numeral_max / kpi_strip_frame /
 *   panel_intrusion / panel_gap / divider_no_source / exhibit_title_rule / card_text_left /
 *   section_title_icon / source_* / chrome_source_width / footnote_* / registry_* / toc_rhythm /
 *   branding_tone_mismatch / toplabel_* / empty_circle_icon / no_icon_element / bullet_icon /
 *   zh_template_latin / accent_never_type(橙可作文字色) / GOLDEN 模式与逐页豁免登记 /
 *   geometry-scan 外挂族（v1 不带；v3 已将 text_vfit_overflow / content_underfill 转正收编）
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import yaml from './js-yaml.mjs'
import { charWidth as cw, estimateWidth as estTextWidth } from './text-geom.mjs'
import { estTextHeight } from './text-metrics.mjs'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('-'))
const onlyIdx = args.indexOf('--only')
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null
const pagesIdx = args.indexOf('--pages')
const PAGES_SPEC = pagesIdx >= 0 ? args[pagesIdx + 1] : null
if (!dir || !existsSync(join(dir, 'presentation.pptd'))) {
  console.error('usage: node qa.mjs <pptdDir> [--warn-only] [--only <rule>] [--pages page-3,page-7|3,7|3-7]')
  process.exit(2)
}
if (pagesIdx >= 0 && (!PAGES_SPEC || PAGES_SPEC.startsWith('--'))) {
  console.error('--pages 需要参数，如 --pages page-3,page-7 或 --pages 3-7')
  process.exit(2)
}

const MIN_FONT = 10            // 最小字号 10（仅页码/独立微标签；正文 14、dense 12）
const PAGE_W = 1440
const PAGE_H = 810
const LEFT_MARGIN = 45.2       // L04 展区左缘（模板实测）
const RIGHT_EDGE = 1396.1      // L04 展区右缘（宽 1351）
// 字阶白名单（DECISIONS §2 实测主峰）：presentation textStyles 与页面字面量都查
const FONT_SCALE = new Set([10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44])
// 内容页必备 chrome（其余 chrome-* 可选；隔页/封面 0 chrome）
const CHROME_REQUIRED = ['chrome-title', 'chrome-pageno']
// chrome-title 位置 [45.2, 8.5]±8 / chrome-pageno 位置 [41, 769.5]±10（warn 档窗口）
const TITLE_POS = { x: [37, 53], y: [0, 17] }
const PAGENO_POS = { x: [31, 51], y: [759, 780] }

const pres = yaml.load(readFileSync(join(dir, 'presentation.pptd'), 'utf8'))
// ——— tone 感知（2026-09-13 用户定）：deck 目录 PLAN.md 头部 `tone: 路演|IC`，缺省 IC（存量零变化）——
// 路演空间闸阈值按「少而大」放宽（合法形态 ≠ IC 密度；校准分布见 qa-gate.md 条目）；面积阈两闸不动
const TONE = (() => {
  try {
    const head = readFileSync(join(dir, 'PLAN.md'), 'utf8').slice(0, 600)
    const m = head.match(/^tone:\s*(路演|IC)\s*$/m)
    if (m) return m[1] === '路演' ? 'roadshow' : 'ic'
  } catch {}
  return 'ic'
})()
const styleNames = new Set(Object.keys(pres?.theme?.textStyles ?? {}))
const colorVars = new Map(Object.entries(pres?.theme?.colors ?? {}).map(([k, v]) => [`$${k}`, String(v).toUpperCase()]))
// 调色板封闭（DECISIONS §3.5）：从本 deck presentation.pptd 的 theme.colors 读取展开后集合；
// 渐变 stop、$引用（fillRef 式引用色）全部 resolveColor 展开后校验。theme.colors 为空时闸关闭（无从校验）
const PALETTE = new Set([...colorVars.values()].map((v) => v.slice(0, 7)))
// 双强调制（DECISIONS §1）：单页三色中至多 2 种
const ACCENT_TRIO = new Map([['#FF7829', '$accent'], ['#ED7D31', '$accentDeep'], ['#FFC000', '$accentOnDark']])

const issues = []
function report(sev, page, check, msg) {
  if (ONLY && check !== ONLY) return
  issues.push({ sev, page, check, msg })
}
// 每页元素数台账（page_rhythm_mismatch 与密度闸共用口径；主循环内回填）
const pageElCount = new Map()
// 每页内容底缘台账（content_underfill 闸用；主循环内回填）
const pageContentBottom = new Map()

// ——— 体系级：theme 字阶必须落在白名单（DECISIONS §2；替换 K 体系 even_font_scale 偶数铁律）———
for (const [name, st] of Object.entries(pres?.theme?.textStyles ?? {})) {
  if (st?.fontSize != null && !FONT_SCALE.has(st.fontSize)) {
    report('error', 'presentation', 'font_scale_whitelist', `textStyle ${name} fontSize ${st.fontSize} 不在字阶白名单（10/11/12/14/16/18/20/24/28/32/36/40/44）`)
  }
  checkFontFamily(st?.fontFamily, `textStyle ${name}`, 'presentation')
}

// ——— 体系级：media SVG 不得含 XML 注释（渲染器占位符 bug）———
const mediaDir = join(dir, 'media')
if (existsSync(mediaDir)) {
  for (const f of readdirSync(mediaDir)) {
    if (f.endsWith('.svg') && readFileSync(join(mediaDir, f), 'utf8').includes('<!--')) {
      report('error', 'media', 'svg_no_comments', `${f} 含 XML 注释（会渲成占位符；重新导出或手动剥除）`)
    }
  }
}

function resolveColor(c) {
  if (typeof c !== 'string') return null
  if (c.startsWith('$')) return colorVars.get(c) ?? c
  return c.toUpperCase()
}

// 感知亮度（0–1，Rec.601）：深底判定一律用它（label_contrast / dark_text_gold）
function lumOf(hex) {
  const m = String(hex ?? '').match(/^#?([0-9A-Fa-f]{6})/)
  if (!m) return 1
  const h = m[1]
  return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255
}
// HEX8 的 AA 字节 → [0,1]；HEX6 视为不透明
function alphaOf(c) {
  const m = String(c ?? '').match(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})$/)
  return m ? parseInt(m[1], 16) / 255 : 1
}
// HEX → HSL 色相（0–360）；低饱和（灰/白/黑）返回 null——中性色不参与同色相判定
function hueOf(hex) {
  const m = String(hex ?? '').match(/^#?([0-9A-Fa-f]{6})/)
  if (!m) return null
  const h = m[1]
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d < 0.04) return null
  const l = (mx + mn) / 2
  const s = d / (1 - Math.abs(2 * l - 1) || 1)
  if (s < 0.12) return null
  let hue
  if (mx === r) hue = 60 * (((g - b) / d) % 6)
  else if (mx === g) hue = 60 * ((b - r) / d + 2)
  else hue = 60 * ((r - g) / d + 4)
  return (hue + 360) % 360
}
// 蓝族判定（DECISIONS §3.3：阴影仅蓝系弥散柔影——brand1/brand2/brand3/brand4/navy/gradChipLight 系，色相 200–230°）
function isBlueFamily(hex) {
  const h = hueOf(hex)
  return h != null && h >= 200 && h <= 230
}

// ——— WCAG 相对亮度与对比度（text_contrast 闸；与深底判定用的 Rec.601 lumOf 不同公式，职责不同勿合并）———
function relLum(hex) {
  const m = String(hex ?? '').match(/^#?([0-9A-Fa-f]{6})/)
  if (!m) return null
  const h = m[1]
  const f = (v) => { const c = parseInt(v, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(h.slice(0, 2)) + 0.7152 * f(h.slice(2, 4)) + 0.0722 * f(h.slice(4, 6))
}
function contrastOf(fg, bg) {
  const a = relLum(fg)
  const b = relLum(bg)
  if (a == null || b == null) return null
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// ——— 字体族纪律（DECISIONS §2：全 deck 只有 Arial + 微软雅黑；替换 K 体系 serif_discipline）———
// fontFamily 形态：单名 / "latin, ea" 双值 / {latin, ea} 对象。latin 仅 Arial（大小写不敏感），ea 仅 微软雅黑
function checkFontFamily(ffRaw, where, pageId) {
  if (!ffRaw) return
  let latin = '', ea = ''
  if (typeof ffRaw === 'string') {
    const parts = ffRaw.split(',').map((s) => s.trim()).filter(Boolean)
    latin = parts[0] ?? ''
    ea = parts[1] ?? parts[0] ?? ''
  } else if (typeof ffRaw === 'object') {
    latin = String(ffRaw.latin ?? '')
    ea = String(ffRaw.ea ?? '')
  }
  if (latin && latin.toLowerCase() !== 'arial') {
    report('error', pageId, 'font_family_discipline', `${where} latin 字体「${latin}」非 Arial——本体系只有 Arial + 微软雅黑（Georgia/楷体/宋体/Calibri 一律禁）`)
  }
  if (ea && ea !== '微软雅黑') {
    report('error', pageId, 'font_family_discipline', `${where} ea 字体「${ea}」非 微软雅黑——本体系只有 Arial + 微软雅黑（Georgia/楷体/宋体/Calibri 一律禁）`)
  }
}

// ——— 全槽位颜色遍历（调色板封闭/双强调判定共用）：$引用一律由调用方 resolveColor 展开 ———
// 覆盖：content.color/backgroundColor/gradient stops/shadow、fill(solid+gradient stops)/border/shadow、
// chart series fill(单值/渐变/数组)/lineColor/dataLabels.color/marker.fill/border、富文本 span color
function* allColorRefs(el) {
  const c = el?.content ?? {}
  if (typeof c.color === 'string') yield [c.color, 'text-color']
  if (typeof c.backgroundColor === 'string') yield [c.backgroundColor, 'text-bg']
  if (Array.isArray(c.gradient?.stops)) for (const s of c.gradient.stops) { if (typeof s?.color === 'string') yield [s.color, 'text-gradient-stop'] }
  if (typeof c.shadow?.color === 'string') yield [c.shadow.color, 'text-shadow']
  if (typeof c.text === 'string') {
    for (const m of c.text.matchAll(/color:\s*([^;"]+)/gi)) yield [m[1].trim(), 'span-color']
  }
  const f = el?.fill
  if (typeof f?.color === 'string') yield [f.color, 'fill']
  if (Array.isArray(f?.stops)) for (const s of f.stops) { if (typeof s?.color === 'string') yield [s.color, 'gradient-stop'] }
  if (typeof el?.border?.color === 'string') yield [el.border.color, 'border']
  if (typeof el?.shadow?.color === 'string') yield [el.shadow.color, 'shadow']
  if (el?.elementType === 'chart') {
    const one = function* (v, kind) {
      if (typeof v === 'string') yield [v, kind]
      else if (typeof v?.color === 'string') yield [v.color, kind]
      else if (Array.isArray(v?.stops)) for (const s of v.stops) { if (typeof s?.color === 'string') yield [s.color, kind] }
    }
    for (const s of el.series ?? []) {
      if (Array.isArray(s?.fill)) for (const v of s.fill) yield* one(v, 'series-fill')
      else yield* one(s?.fill, 'series-fill')
      yield* one(s?.lineColor, 'series-line')
      yield* one(s?.areaColor, 'series-area')
      yield* one(s?.marker?.fill, 'series-marker')
      if (typeof s?.dataLabels?.color === 'string') yield [s.dataLabels.color, 'series-label']
      if (typeof s?.border?.color === 'string') yield [s.border.color, 'series-border']
    }
  }
}

// ——— 观点句判据（toc_msg_viewpoint 与 banner_text_viewpoint 共用；与 title_is_sentence 数字口径对齐）———
const VIEWPOINT_NUM = /\d|[〇零一二三四五六七八九十百千万亿两]|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i
const VIEWPOINT_JUDGE = /验证|修复|压缩|折价|溢价|下修|上修|成为|印证|集中|覆盖|等于|对应|指向|决定|超配|低配|增持|减持|守住|而非|更[高低强弱难易]|便宜|关键|高危|触发|\b(is|are|was|were|has|have|had|will|won't|can|cannot|can't|not|worth|overweight|underweight|buy|sell|hold|cheap|expensive|harder|easier|better|worse|driven|proof|evidence|vs|critical|trigger|kill|deliver|delivers|premium|discount)\b/i

// ——— 体系级（likaku 吸收）：C4 全 deck 页面背景 ≤2 种（白 + navy）———
const deckBgs = new Set()
// 去 AI 腔机检累加器（自包含，doctrine 见 reference/prose-humanizer.md；**阈值按幻灯片语料另行标定**，
// 不能直接搬研报的 2.0/千字——黄金件 2.2、canonical examples 3.3，搬过来会把 K 原版和自家配方全打中）
const HUMANIZE = {
  SLOP: /综上所述|值得注意的是|值得一提的是|不难看出|显而易见|众所周知|总的来看|总而言之|引发广泛关注|具有里程碑意义|赋能|抓手/g,
  NOT_BUT: /不是[^。；]{1,16}?而是|不仅[^。；]{1,16}?而(?:且|更)/g,
  DASH_BUDGET: 3.5,        // 个/千字；corpus 标定（qa textOf 口径）：golden-ref 2.15 / demo 2.01 /
  //                         canonical examples 3.19（参照件上限）；生成件 3.38 / 3.78 / 3.98 全在其上。
  //                         研报口径是 2.0——直接搬会打中 K 原版与自家配方样例，故按 slide 语料另定
  NOT_BUT_MAX: 3,          // 处/deck
  MIN_CHARS: 3000,         // 密度判定的最小样本：**每千字**的指标在小样本上不可信——
  //                         3 页测试件 579 字里 3 个破折号就算 5.2/千字。语料最小的真 deck
  //                         （回归件 12 页）也在 1 万字以上，3000 字下限不影响任何交付件
}
let deckDash = 0, deckChars = 0, deckNotBut = 0

const pageFiles = readdirSync(join(dir, 'pages')).filter((f) => f.endsWith('.page')).sort((a, b) => {
  const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10)
  const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10)
  return na - nb
})

function textOf(el) {
  const t = el?.content?.text
  if (typeof t !== 'string') return ''
  return t.replace(/<(?!\/?sup\b)[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
// 位图尺寸读取（零依赖，只读文件头）：PNG IHDR / JPEG SOF0-2
function rasterDims(abs) {
  try {
    const b = readFileSync(abs)
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
    }
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let off = 2
      while (off + 9 < b.length) {
        if (b[off] !== 0xff) { off++; continue }
        const marker = b[off + 1]
        const len = b.readUInt16BE(off + 2)
        if (marker >= 0xc0 && marker <= 0xc2) return { w: b.readUInt16BE(off + 7), h: b.readUInt16BE(off + 5) }
        off += 2 + len
      }
    }
  } catch {}
  return null
}


// ——— --pages 子集过滤（2026-09-16）———
// 写页子 agent 交付前只检自己那几页，主 agent 的全量跑退化成复核。
// ⚠️ 点名的页不存在一律 exit 2，**不许静默跑 0 页报「全过」**——自检的价值全在「它真的检了」。
const CHECK_FILES = (() => {
  if (!PAGES_SPEC) return pageFiles
  const want = new Set()
  for (const tok of PAGES_SPEC.split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = tok.match(/^(?:page-)?(\d+)\s*-\s*(?:page-)?(\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y)
      for (let n = a; n <= b; n++) want.add(`page-${n}.page`)
      continue
    }
    const one = tok.match(/^(?:page-)?(\d+)(?:\.page)?$/)
    if (!one) {
      console.error(`--pages 无法解析 "${tok}"——写 page-7 / 7 / 7-9 这三种形态`)
      process.exit(2)
    }
    want.add(`page-${one[1]}.page`)
  }
  const missing = [...want].filter((f) => !pageFiles.includes(f))
  if (missing.length) {
    console.error(`--pages 点名的页不存在: ${missing.join(', ')}（本 deck 共 ${pageFiles.length} 页）`)
    process.exit(2)
  }
  return pageFiles.filter((f) => want.has(f))
})()
const SUBSET = CHECK_FILES.length !== pageFiles.length

// ——— Arial em 宽表与文本宽估算已抽出到 text-geom.mjs（单一来源：闸与写前预检共用同一套系数）———
//     agent 写页前可直接跑该模块 CLI 预检，不必等本闸拦截；Georgia ×1.03、bold ×1.03 由模块保证


for (const pf of CHECK_FILES) {
  const pageId = pf.replace('.page', '')
  let doc
  try {
    doc = yaml.load(readFileSync(join(dir, 'pages', pf), 'utf8'))
  } catch (e) {
    report('error', pageId, 'yaml_parse', String(e.message).split('\n')[0])
    continue
  }
  const els = Array.isArray(doc?.elements) ? doc.elements : []
  const ids = new Set(els.map((e) => e?.elementId))
  const isContent = (doc?.pageType ?? 'content') === 'content'
  pageElCount.set(pageId, els.length)
  {
    // 内容底缘：排除 chrome-*、满幅背景、页码区（y≥740）；供 content_underfill 闸
    // 只登记内容页——封面/目录/隔页/收尾页的版面形态各自独立，不适用底缘填充率
    if ((doc?.pageType ?? 'content') === 'content') {
      let bot = 0
      for (const e of els) {
        if (!Array.isArray(e?.bounds)) continue
        const id = String(e.elementId ?? '')
        if (id.startsWith('chrome-')) continue
        const [ex, ey, ew, eh] = e.bounds
        if (ew >= 1200 && eh >= 400) continue
        if (ey >= 740) continue
        bot = Math.max(bot, ey + eh)
      }
      pageContentBottom.set(pageId, bot)
    }
  }

  // 内容页（pageType: content 或缺省）必备 chrome-title + chrome-pageno（DECISIONS §4 L04；其余 chrome-* 可选）
  // 隔页/封面/目录用各自 pageType（chapter/cover/table_of_contents），0 chrome，不在此闸范围
  // CONF 保密提示页（speech 固定件，0 chrome）豁免：以 conf-* 元素识别
  const isConf = [...ids].some((id) => typeof id === 'string' && id.startsWith('conf-'))
  if (isContent && !isConf) {
    for (const cid of CHROME_REQUIRED) {
      if (!ids.has(cid)) report('error', pageId, 'chrome_complete', `缺少 ${cid}（L04 内容页必备 chrome-title + chrome-pageno）`)
    }
  }

  // 封面（pageType: cover 或有 cover-* 元素）应有全幅背景 image（L01 背景 cover-bg-arc.jpeg fit fill，warn 档）
  const isCoverPage =
    (doc?.pageType ?? 'content') === 'cover' ||
    [...ids].some((id) => typeof id === 'string' && id.startsWith('cover-'))
  if (isCoverPage) {
    const hasCoverBg = els.some(
      (e) => e?.elementType === 'image' && Array.isArray(e.bounds) && e.bounds[2] * e.bounds[3] >= PAGE_W * PAGE_H * 0.85,
    )
    if (!hasCoverBg) {
      report('warn', pageId, 'cover_bg_present', '封面页无全幅背景 image（L01：assets/media/cover-bg-arc.jpeg，bounds [-72, -40.5, 1584, 891] fit fill）')
    }
  }

  let pageText = ''

  for (const el of els) {
    if (!el || typeof el !== 'object') continue
    const id = el.elementId ?? '?'
    pageText += ' ' + textOf(el)

    // bounds（chrome-banner / chrome-kpi-band 是设计出血件，铁律 9 豁免：banner [-4.3,…,1448.7,…] 横出血、KPI 带通栏）
    const b = el.bounds
    if (Array.isArray(b) && b.length === 4) {
      const [x, y, w, h] = b
      const fullBleed = x <= 0.5 && y <= 0.5 && w >= PAGE_W - 1 && h >= PAGE_H - 1
      const bleedOk = id === 'chrome-banner' || id === 'chrome-banner-text' || id === 'chrome-kpi-band'
      if (!fullBleed && !bleedOk && (x < -1 || y < -1 || x + w > PAGE_W + 1 || y + h > PAGE_H + 1)) {
        report('error', pageId, 'bounds_check', `${id} bounds [${b.join(', ')}] 溢出页面`)
      }
    }

    if (el.elementType === 'text') {
      const fs = el.content?.fontSize
      if (fs != null && !FONT_SCALE.has(fs)) {
        report('error', pageId, 'font_scale_whitelist', `${id} fontSize ${fs} 不在字阶白名单（10/11/12/14/16/18/20/24/28/32/36/40/44）`)
      }
      // 字体族纪律：本体系只有 Arial + 微软雅黑（字面量层；style 层由 presentation 级闸扫）
      checkFontFamily(el.content?.fontFamily, id, pageId)
      // 分条一律字面「· 」或 ellipse 圆点；原生 <ul>/<li> 列表禁用（唯一例外：L02 toc-msg 条目）
      if (!id.startsWith('toc-msg-') && /<\s*(?:ul|ol|li)[\s>]/i.test(String(el.content?.text ?? ''))) {
        report('warn', pageId, 'no_native_list', `${id} 用了原生 <ul>/<li> 列表——本模板分条用字面「· 」或 ellipse 圆点（L02 toc-msg 条目除外）`)
      }
      const styleRef = typeof el.content?.style === 'string' ? el.content.style : null
      if (styleRef) {
        if (!styleNames.has(styleRef.slice(1))) {
          report('error', pageId, 'style_ref_exists', `${id} 引用未定义样式 ${styleRef}`)
        } else if (fs == null) {
          const st = pres.theme.textStyles[styleRef.slice(1)]
          if (st?.fontSize != null && st.fontSize < MIN_FONT) {
            report('error', pageId, 'min_font', `${id} 样式 ${styleRef} fontSize ${st.fontSize} < ${MIN_FONT}`)
          }
        }
      }
      if (fs != null && fs < MIN_FONT) {
        report('error', pageId, 'min_font', `${id} fontSize ${fs} < ${MIN_FONT}`)
      }
      if (id === 'chrome-title') {
        const aligns = Array.isArray(el.content?.align) ? el.content.align : []
        if (!aligns.includes('left') || !aligns.includes('middle')) {
          report('error', pageId, 'title_align', 'chrome-title 未左对齐+垂直居中（align [left, middle]）')
        }
        // 位置闸（warn）：chrome-title bounds 应落 [45.2, 8.5] 附近（窗口 x∈[37,53] 且 y∈[0,17]）
        if (Array.isArray(b) && (b[0] < TITLE_POS.x[0] || b[0] > TITLE_POS.x[1] || b[1] < TITLE_POS.y[0] || b[1] > TITLE_POS.y[1])) {
          report('warn', pageId, 'chrome_title_position', `chrome-title 起点 [${b[0]}, ${b[1]}] 不在标准窗（x∈[${TITLE_POS.x}] 且 y∈[${TITLE_POS.y}]，canonical [45.2, 8.5]）`)
        }
        const t = textOf(el)
        // 中文 deck 汉字数字同属「含数字」语义，与 /\d/ 等价放行；本体系观点句主要由 banner 承担（banner_text_viewpoint），title 档降为 warn
        if (!/\d/.test(t) && !/[〇零一二三四五六七八九十百千万亿两]/.test(t)) report('warn', pageId, 'title_is_sentence', 'action title 不含数字（标题应是带数字和判断的完整句）')
        if (Array.isArray(b) && b[3] > 70.5) report('warn', pageId, 'title_lines', `title 框高 ${b[3]} 超过两行上限 69.5`)
        // 渲染行数估算（回归件 6 页 3 行标题漏网案：框高合规但文字实际排成 3 行，截图目检才抓到）
        {
          const st = el.content?.style ? pres.theme.textStyles[String(el.content.style).slice(1)] : null
          const fs = el.content?.fontSize ?? st?.fontSize ?? 28
          const ff = String(el.content?.fontFamily ?? st?.fontFamily ?? '')
          const bold = el.content?.bold ?? st?.bold ?? false
          const est = estTextWidth(t, fs, { georgia: /georgia/i.test(ff), bold })
          const lines = (est / (Array.isArray(b) ? b[2] : 1312)) * 1.15 // 词界折行损耗系数
          if (lines > 1.95) report('error', pageId, 'title_render_lines', `title 估算渲染 ${lines.toFixed(1)} 行（≈${Math.round(est)}px / 行宽 ${Array.isArray(b) ? b[2] : '?'}px）——超两行，缩短标题`)
          else if (lines > 1.75) report('warn', pageId, 'title_render_lines', `title 估算渲染 ${lines.toFixed(1)} 行——逼近两线上限，截图确认`)
        }
      }
      // chrome-pageno 位置闸（warn）：左下 [41, 769.5]±10（窗口 x∈[31,51] 且 y∈[759,780]）
      if (id === 'chrome-pageno' && Array.isArray(b)) {
        if (b[0] < PAGENO_POS.x[0] || b[0] > PAGENO_POS.x[1] || b[1] < PAGENO_POS.y[0] || b[1] > PAGENO_POS.y[1]) {
          report('warn', pageId, 'chrome_pageno_position', `chrome-pageno 起点 [${b[0]}, ${b[1]}] 不在标准窗（x∈[${PAGENO_POS.x}] 且 y∈[${PAGENO_POS.y}]，canonical [41, 769.5] 左下）`)
        }
      }
      // toc-msg 观点句闸（L02 目录/summary 页 core message；判据沿用 institutional 不变）：
      // 每条必须是含数字或判断的完整句，纯话题/名词罗列 → warn。附录 a 系行
      // （elementId toc-msg-a[a-z]?）与方法论/数据来源文本豁免——附录的职责就是索引。
      if (id.startsWith('toc-msg-') && !/toc-msg-a[a-z]?$/.test(id)) {
        const raw = typeof el.content?.text === 'string' ? el.content.text : ''
        const paras = raw.split(/<\/p>\s*<p[^>]*>|<br\s*\/?>|\n+/)
          .map((s) => s.replace(/<(?!\/?sup\b)[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
        for (const t of paras) {
          if (/方法论|数据来源|methodology|data sources/i.test(t)) continue
          if (!VIEWPOINT_NUM.test(t) && !VIEWPOINT_JUDGE.test(t)) report('warn', pageId, 'toc_msg_viewpoint', `${id} 条目「${t.length > 42 ? t.slice(0, 42) + '…' : t}」是话题罗列不是观点句——core message 每条必须含数字或判断（L02 规则），栏目名归 section 列`)
        }
      }
      // banner 观点句闸（DECISIONS §7 新增）：chrome-banner-text 存在时，其纯文本须含数字或判断词——
      // banner 文案 = 本页核心结论句（铁律 2）。判据与 toc_msg_viewpoint 共用
      if (id === 'chrome-banner-text') {
        const t = textOf(el)
        if (t && !VIEWPOINT_NUM.test(t) && !VIEWPOINT_JUDGE.test(t)) {
          report('warn', pageId, 'banner_text_viewpoint', `chrome-banner-text「${t.length > 42 ? t.slice(0, 42) + '…' : t}」是话题罗列不是观点句——banner 文案 = 本页核心结论句，须含数字或判断（铁律 2）`)
        }
      }
    }
    // 线原生（2026-10-10 用户定「写作形态+QC」）：发丝线一律 elementType: line，warn 级迁移闸——
    // back-catalog 基线高，新建 deck 必须零命中；判据与豁免见 qa-gate.md。
    // （2026-10-13 bullet 原生写法回滚：bullet_literal_char / bullet_shape_marker 两闸已撤）
    if (el.elementType === 'shape' && el.shapeName === 'rect' && Array.isArray(b)) {
      const thin = Math.min(b[2], b[3]), long = Math.max(b[2], b[3])
      if (thin > 0 && thin <= 2 && long / thin >= 40) {
        report('warn', pageId, 'rule_as_rect', `${id} 发丝线用 rect 填充（[${b[2]}×${b[3]}]）——线条一律 elementType: line 原生线元素（points/curve/border；chrome-L04.page 已先行）`)
      }
    }

    if (el.elementType === 'image') {
      const src = el.src
      if (typeof src === 'string' && /logo-placeholder/i.test(src)) {
        report('warn', pageId, 'logo_placeholder_left', `${id} 仍引用 logo 占位符 ${src}——交付前请用户替换真实 logo（或删除 chrome-logo；品牌中立铁律：占位符只是槽位）`)
      }
      if (typeof src === 'string' && !src.startsWith('http') && !existsSync(join(dir, src))) {
        report('error', pageId, 'img_src_exists', `${id} 引用的 ${src} 不存在于 deck 目录`)
      } else if (typeof src === 'string' && !src.startsWith('http')) {
        // 位图体积/尺寸闸（2026-09-21 用户定：插入 PPT 的位图一律 1440×810 JPG 尽量小——
        // 导出链上传 STORE zip 不压缩，服务端 nginx ≈1MB 硬顶）。SVG 矢量豁免。
        if (/\.(png|jpe?g)$/i.test(src)) {
          const abs = join(dir, src)
          const size = statSync(abs).size
          const d = rasterDims(abs)
          if (size > 450 * 1024 || (d && (d.w > 1440 || d.h > 810))) {
            report('error', pageId, 'media_image_weight', `${id} 引用的 ${src} ${(size / 1024).toFixed(0)}KB${d ? ` ${d.w}×${d.h}` : ''}——位图须转 1440×810 JPG（node scripts/optimize-media.mjs <deckDir>；STORE zip 不压缩、服务端 ≈1MB 硬顶）`)
          }
        }
      }
    }


    if (el.elementType === 'chart') {
      const seriesArr = Array.isArray(el.series) ? el.series : []
      const cols = el.data?.cols ?? []
      const rows = el.data?.rows ?? []
      // 图表色彩语义闸（DECISIONS §6 改判据）：brand1=主系列/实际值、accent 橙=估计/预测/强调、
      // chartNeutral 灰=别家/参考、negative 红=负增量。灰在调色板内，palette_closed 不响，
      // 故单查「这个系列该用哪个语义色」。warn 级——「别家的估计」既是估计又是别家，灰有合法用法，
      // 误伤比漏检更危险，交给 agent 逐条裁决。
      {
        const NEUTRAL = resolveColor('$chartNeutral') ?? '#BFBFBF'
        const EST_MARK = /估计|测算|解剖|预测|预估|推算|forecast|estimat|\(E\)/i
        const fillOf = (s) => {
          const v = resolveColor(String(s?.fill ?? s?.itemStyle?.color ?? ''))
          return (v ?? '').slice(0, 7).toUpperCase()
        }
        // ① 系列名自带估计/预测/E 标记却填中性灰 → 应用 $accent 橙
        for (const s of seriesArr) {
          const nm = String(s?.name ?? s?.encode?.y ?? '')
          if (EST_MARK.test(nm) && fillOf(s) === NEUTRAL) {
            report('warn', pageId, 'chart_color_semantics',
              `${id} 系列「${nm}」名字标着估计/预测却填中性灰 ${NEUTRAL}（=别家/参考色）——估计/预测该用 $accent 橙；确属别家数据可忽略`)
          }
        }
        // ② ≥2 个柱系列全部填中性灰 → 主数据应 $brand1（灰是第三/参考系列色，主数据不该整支灰）
        const bars = seriesArr.filter((s) => s?.type === 'bar' && !/^_/.test(String(s?.name ?? '')))
        if (bars.length >= 2 && bars.every((s) => fillOf(s) === NEUTRAL)) {
          report('warn', pageId, 'chart_color_semantics',
            `${id} ${bars.length} 个柱系列全部填中性灰 ${NEUTRAL}——灰是别家/参考系列色，主数据应为 $brand1`)
        }
      }
      // 类目标签过长（无 \n 换行）会被轴自动跳号（仅轴图；饼/环无类目轴，标签走图例不跳号）
      const pieLike = seriesArr.some((s) => ['pie', 'doughnut'].includes(s?.type))
      const catIdx = 0
      if (!pieLike) {
        for (const r of rows) {
          const cat = r?.[catIdx]
          if (typeof cat === 'string' && !cat.includes('\n') && cat.length > 16) {
            report('warn', pageId, 'cat_label_length', `${id} 类目标签 "${cat.slice(0, 20)}…" 超 16 字符无换行（轴会跳号；用 \\n 双行）`)
            break
          }
        }
      }
      // X 轴类目标签数值闸：竖图类目（x）标签任一行含数值即 error——
      // 数值只有两个合法位置：单纯柱 → 柱内 ctr；堆积/瀑布/组合图 → 手摆柱顶标（对齐类目中心）。横图（yAxis 为 category）不检。
      // 单位族含 pp（百分点，与 % 同族；回归件 p22「−1.4pp」案）；符号类含 U+2212 真负号（瀑布负驱动标签常用）。
      // 不带单位/币符的裸带符号小数（如 +0.78）按用户原 spec 不拦——漏检代价 < 误伤（规则文本仍禁止，靠清理与目检）。
      {
        const VALUE_RE = /^[+~−-]?[$¥]?\d+(\.\d+)?\s*(%|pp|亿|万|B|M|x)$/i
        const CURRENCY_RE = /^[$¥]/
        const DATE_RE = /^\d{4}(-\d{2})?E?$/
        const QTR_RE = /^Q\d/i
        const FY_RE = /^FY/i
        if (!pieLike && el.yAxis?.type !== 'category') {
          for (const r of rows) {
            const cat = String(r?.[catIdx] ?? '')
            for (const line of cat.split('\n')) {
              const t = line.trim()
              if (!t) continue
              if (DATE_RE.test(t) || QTR_RE.test(t) || FY_RE.test(t)) continue
              if (VALUE_RE.test(t) || CURRENCY_RE.test(t)) {
                report('error', pageId, 'xaxis_value_label', `${id} 类目标签 "${t}" 含数值（X 轴只留类目名：单纯柱数值进 ctr，堆积/瀑布/组合图手摆柱顶标并对齐类目中心）`)
                break
              }
            }
          }
        }
      }
      // 堆积图 0 值段（应删类目或置 null；0 值会留悬空标签）
      const stacked = seriesArr.some((s) => s?.type === 'bar' && s?.stack)
      if (stacked && seriesArr.some((s) => s?.dataLabels && s.dataLabels.show !== false)) {
        for (const s of seriesArr) {
          if (s?.type !== 'bar' || !s?.stack || s?.name === '_base') continue
          const yi = cols.indexOf(s.encode?.y)
          if (yi < 0) continue
          for (const r of rows) {
            if (r?.[yi] === 0) {
              report('warn', pageId, 'stacked_zero_value', `${id} 系列 ${s.name ?? s.encode?.y} 含 0 值段（0 值类目应删除或置 null）`)
              break
            }
          }
        }
      }
      // 瀑布 proxy 闭合（H1 机械化）：_base 系列存在且为**竖图**（横图是足球场/甘特，非瀑布）时，逐柱校验 running 水位
      const isHorizontal = el.yAxis?.type === 'category'
      const baseSeries = !isHorizontal && seriesArr.find((s) => s?.name === '_base')
      if (baseSeries) {
        const bi = cols.indexOf(baseSeries.encode?.y)
        const visIdx = seriesArr.filter((s) => s !== baseSeries && s?.type === 'bar' && s?.stack).map((s) => cols.indexOf(s.encode?.y))
        let running = 0
        let bad = null
        rows.forEach((r, i) => {
          if (bad) return
          const base = Number(r?.[bi] ?? 0) || 0
          const vis = visIdx.reduce((acc, vi) => acc + (Number(r?.[vi]) || 0), 0)
          if (base === 0) {
            if (i > 0 && Math.abs(vis - running) > 0.01) bad = `row ${i + 1}（锚柱值 ${vis} ≠ running ${running}）`
            running = vis // 锚柱：重置水位
          } else if (Math.abs(base - running) <= 0.01) {
            running = base + vis // 正增量：柱体 [running, running+vis]
          } else if (Math.abs(base + vis - running) <= 0.01) {
            running = base // 负增量：柱体 [running−vis, running]
            // 负增量柱必须红 #C00000（2026-09-21 用户定「负数用红色」）
            for (const vi of visIdx) {
              if (!(Number(r?.[vi]) > 0)) continue
              const s = seriesArr.find((x) => cols.indexOf(x?.encode?.y) === vi)
              const fill = (resolveColor(String(s?.fill ?? '')) ?? '').slice(0, 7).toUpperCase()
              if (fill !== '#C00000') {
                report('error', pageId, 'waterfall_negative_color', `${id} 降柱「${r?.[0]}」（${(base + vis).toFixed(1)}→${base.toFixed(1)}）用了 ${fill || '非红'}——负增量必须拆红色系列 $negative #C00000（正增量 $accent、负增量红）`)
              }
            }
          } else {
            bad = `row ${i + 1}（base ${base} / 可见高 ${vis} 与 running ${running} 不闭合）`
          }
        })
        if (bad) report('error', pageId, 'waterfall_closure', `${id} 瀑布 proxy 水位断裂于 ${bad}`)
      }
      // 轴检查
      const axes = [el.xAxis, el.yAxis].flatMap((a) => (a == null ? [] : Array.isArray(a) ? a : [a]))
      for (const ax of axes) {
        if (ax && typeof ax === 'object') {
          if (ax.gridLine !== false) {
            report('warn', pageId, 'chart_gridline', `${id} 轴未显式 gridLine:false（导出后 polish-pptx.mjs 会兜底）`)
            break
          }
          if (ax.show === false) {
            report('error', pageId, 'axis_show_false', `${id} 轴用了 show:false（导出 delete=1，部分 PowerPoint 会把该轴系列吞掉）——改 {label:false, axisLine:false, gridLine:false} 保活隐藏`)
            break
          }
        }
      }
      // 禁用原生 waterfall 类型（dPt 逐点色在 pptx 渲染链路丢失）→ 手工堆积 proxy
      for (const s of seriesArr) {
        if (s?.type === 'waterfall') {
          report('error', pageId, 'waterfall_no_native_type', `${id} 用了原生 waterfall 类型（dPt 丢色）——改 charts.md R2 手工堆积 proxy`)
        }
      }
      // C4 背景色收集
      // H3 饼/环 ≤6 段；H4 簇状柱 ≤6 类目 ×3 series；H7 段内标签对比度
      const isPie = seriesArr.some((x) => x?.type === 'pie')
      if (isPie && rows.length > 6) {
        report('error', pageId, 'pie_max_slices', `${id} 饼/环 ${rows.length} 段 >6（合 top5+其他）`)
      }
      const barSeries = seriesArr.filter((x) => x?.type === 'bar')
      const clustered = barSeries.some((x) => !x?.stack)
      if (clustered && rows.length > 6) {
        report('warn', pageId, 'clustered_bar_limit', `${id} 簇状柱 ${rows.length} 类目 >6（建议拆页或转堆积）`)
      }
      if (barSeries.length > 3 && clustered) {
        report('warn', pageId, 'clustered_bar_limit', `${id} 簇状柱 ${barSeries.length} series >3`)
      }
      for (const x of barSeries) {
        const lbl = x?.dataLabels
        if (!lbl || lbl.show === false || !lbl.color) continue
        const fillL = lumOf(resolveColor(String(x.fill ?? '')))
        const lc = (resolveColor(String(lbl.color)) ?? '').slice(0, 7).toUpperCase()
        // 深底（感知亮度 <0.45）标签白字、浅底标签 $inkBody 墨字
        if (fillL < 0.45 && lc !== '#FFFFFF') {
          report('warn', pageId, 'label_contrast', `${id} 系列 ${x.name ?? ''} 深底(${x.fill})标签非白（应为 $lt1 #FFFFFF）`)
        }
        if (fillL >= 0.45 && lc === '#FFFFFF') {
          report('warn', pageId, 'label_contrast', `${id} 系列 ${x.name ?? ''} 浅底(${x.fill})标签为白（应为 $inkBody #404040）`)
        }
      }

      // 柱线组合图：柱系列不得带 dataLabels（PowerPoint 吞 ctr 标签）→ 手摆柱顶标（对齐类目中心）
      const types = new Set(seriesArr.map((s) => s?.type))
      if (types.has('bar') && types.has('line')) {
        for (const s of seriesArr) {
          if (s?.type === 'bar' && s?.dataLabels && s.dataLabels.show !== false) {
            report('error', pageId, 'combo_no_bar_ctr_labels', `${id} 组合图柱系列带 dataLabels（PowerPoint 会吞）——改手摆柱顶标（对齐类目中心）；禁止并入类目标签（会触发 xaxis_value_label）`)
          }
        }
      }
    }

    // ——— 形态铁律（DECISIONS §3，替换 K 体系 no_shadow_gradient/design law 7；本体系圆角/同色相渐变/蓝柔影均合法）———
    // ① 阴影：仅蓝系弥散柔影——色 ∈ 蓝族（色相 200–230°，brand1/brand2/brand3/brand4/navy/gradChipLight 系），
    //    alpha ≤15%（HEX8 AA 字节）；黑/灰硬影 error。文字阴影一律 error。
    // ② 渐变：仅同色相明度渐变（stop 两两色相环距 ≤15°，中性色豁免；同色=纯色放行），
    //    方向 0°/45°/90°/270° 放行，radial error。
    // ③ 圆角：roundRect/ellipse/chevron/parallelogram 等放行；round1/round2（及 snipRoundRect 单角圆角）error。
    if (el.elementType === 'text' && el.content?.shadow) {
      report('error', pageId, 'shape_rules', `${id} 文字阴影（禁文字阴影；阴影仅蓝系弥散柔影，用于 shape/image）`)
    }
    if (el.elementType === 'text' && el.content?.gradient) {
      const stops = Array.isArray(el.content.gradient.stops) ? el.content.gradient.stops : []
      const hues = stops.map((s) => hueOf(resolveColor(String(s?.color ?? '')))).filter((h) => h != null)
      if (el.content.gradient.gradientType === 'radial') {
        report('error', pageId, 'shape_rules', `${id} 文字径向渐变（禁径向渐变）`)
      } else if (hues.some((h) => hues.some((h2) => Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)) > 15))) {
        report('error', pageId, 'shape_rules', `${id} 文字渐变跨色相（文字渐变同样仅同色相明度渐变，stop 两两色相环距 ≤15°）`)
      }
    }
    if (el.elementType === 'shape' || el.elementType === 'image' || el.elementType === 'line' || el.elementType === 'chart') {
      const sh = el.shadow
      if (sh) {
        const v = resolveColor(String(sh.color ?? ''))
        const rgb = (v ?? '').slice(0, 7)
        if (!isBlueFamily(rgb)) {
          report('error', pageId, 'shape_rules', `${id} 阴影色 ${sh.color} 非蓝族（阴影仅蓝系弥散柔影：色相 200–230°，如 $brand1/$navy/$gradChipLight；禁黑/灰硬阴影）`)
        } else if (alphaOf(v) > 0.15 + 1e-9) {
          report('error', pageId, 'shape_rules', `${id} 阴影 alpha ${(alphaOf(v) * 100).toFixed(0)}% >15%（蓝系柔影透明度上限 15%，色值写 #RRGGBBAA 的 AA 字节，如 #3865BB26）`)
        }
      }
      if (/^(round1Rect|round2SameRect|round2DiagRect|snipRoundRect)$/.test(String(el.shapeName ?? ''))) {
        report('error', pageId, 'shape_rules', `${id} 用了 ${el.shapeName}（禁 round1/round2 单角/双角异形圆角；圆角合法形态：chip 胶囊 roundRect adj=50000、面板小圆角 adj 4000–16667）`)
      }
      const f = el.fill
      if (f && typeof f === 'object' && f.type === 'gradient') {
        if (f.gradientType === 'radial') {
          report('error', pageId, 'shape_rules', `${id} 径向渐变（禁径向；渐变仅同色相明度线性渐变）`)
        } else {
          const stops = Array.isArray(f.stops) ? f.stops : []
          const hues = stops.map((s) => hueOf(resolveColor(String(s?.color ?? '')))).filter((h) => h != null)
          if (hues.some((h) => hues.some((h2) => Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)) > 15))) {
            report('error', pageId, 'shape_rules', `${id} 渐变跨色相（仅同色相明度渐变：stop 两两色相环距 ≤15°，同色=纯色放行；中性灰白黑豁免）`)
          }
          if (f.angle != null && ![0, 45, 90, 270].includes(((f.angle % 360) + 360) % 360)) {
            report('error', pageId, 'shape_rules', `${id} 渐变方向 ${f.angle}°（放行 0°/45°/90°/270°）`)
          }
        }
      }
    }

    // ——— 调色板封闭（DECISIONS §3.5）：所有槽位颜色（含渐变 stop、$引用/fillRef 式引用、富文本 span 色、
    //     chart series fill/label/marker）展开后必须 ∈ 本 deck theme.colors；未知 $变量 error，游离 hex warn ———
    if (PALETTE.size) {
      for (const [raw, kind] of allColorRefs(el)) {
        if (typeof raw === 'string' && raw.startsWith('$') && !colorVars.has(raw)) {
          report('error', pageId, 'palette_closed', `${el.elementId} 未知色变量 ${raw}（${kind}；theme.colors 未定义）`)
          continue
        }
        const v = resolveColor(raw)
        const hex6 = (v ?? '').startsWith('#') ? v.slice(0, 7).toUpperCase() : null
        if (hex6 && !PALETTE.has(hex6)) report('warn', pageId, 'palette_closed', `${el.elementId} 色值 ${hex6}（${kind}）不在调色板——颜色必须解析到 theme.colors token（写 $名，不写游离 hex）`)
      }
    }
  }



  // ——— 双强调上限（DECISIONS §7 新增，铁律 3）：单页使用 $accent/$accentDeep/$accentOnDark 三色中 >2 种 → warn ———
  {
    const used = new Set()
    for (const el of els) {
      for (const [raw] of allColorRefs(el)) {
        const v = (resolveColor(raw) ?? '').slice(0, 7).toUpperCase()
        if (ACCENT_TRIO.has(v)) used.add(v)
      }
    }
    if (used.size > 2) {
      report('warn', pageId, 'dual_accent_limit', `单页强调色 ${used.size} 种 >2（${[...used].map((v) => ACCENT_TRIO.get(v)).join(' + ')}）——双强调制：浅底恒 $accent 橙、深底大数字/关键词恒 $accentOnDark 黄、$accentDeep 仅标题前缀，单页至多 2 种`)
    }
  }

  // ——— 深底大数字恒黄（DECISIONS §7 新增）：深底元素（感知亮度 <0.45 的填充 shape/页面背景）上
  //     fontSize ≥24 的文本，色非 $accentOnDark/$lt1 → warn ———
  {
    const bgLum = lumOf(resolveColor(String(doc?.background?.color ?? '#FFFFFF')))
    for (const t of els) {
      if (t?.elementType !== 'text' || !Array.isArray(t.bounds)) continue
      const st = t.content?.style ? pres.theme.textStyles[String(t.content.style).slice(1)] : null
      const fs = t.content?.fontSize ?? st?.fontSize ?? 14
      if (fs < 24) continue
      const cx = t.bounds[0] + t.bounds[2] / 2, cy = t.bounds[1] + t.bounds[3] / 2
      let dark = bgLum < 0.45
      if (!dark) {
        for (const s of els) {
          if (s === t) break // 只看 z 序在文本之下的 shape
          if (s?.elementType !== 'shape' || !Array.isArray(s.bounds)) continue
          const [sx, sy, sw, shh] = s.bounds
          if (cx < sx || cx > sx + sw || cy < sy || cy > sy + shh) continue
          const f = s.fill
          if (typeof f?.color === 'string') {
            if (lumOf(resolveColor(f.color)) < 0.45) { dark = true; break }
          } else if (f?.type === 'gradient' && Array.isArray(f.stops) && f.stops.length) {
            const avg = f.stops.reduce((a, g) => a + lumOf(resolveColor(String(g?.color ?? ''))), 0) / f.stops.length
            if (avg < 0.45) { dark = true; break }
          }
        }
      }
      if (!dark) continue
      const tc = (resolveColor(String(t.content?.color ?? st?.color ?? '')) ?? '').slice(0, 7).toUpperCase()
      if (tc && tc !== '#FFC000' && tc !== '#FFFFFF') {
        report('warn', pageId, 'dark_text_gold', `${t.elementId} 深底上 fontSize ${fs} ≥24 的文本色 ${tc} 非 $accentOnDark/$lt1——深底大数字/关键词恒黄（$accentOnDark #FFC000）或白（$lt1），铁律 3`)
      }
    }
  }

  // ——— 数据闸门（机械层；语义层 data registry 口径见 reference/generation.md）———
  if (/\{\{[^}]+\}\}|\b(TBD|TODO|FIXME)\b/.test(pageText)) {
    report('error', pageId, 'placeholder_leftover', '页面残留未填充占位符（{{…}}/TBD/TODO/FIXME）——数据必须填实或删点，禁止带病交付')
  }

  // 编号脚注必须在正文有 <sup>N</sup> 角标锚点（K 出处惯例）
  // C4：收集本页背景
  if (doc?.background?.color) deckBgs.add(String(resolveColor(doc.background.color) ?? doc.background.color).toUpperCase())

  // A1 同 Y 同字体：top 聚类（±2px）≥3 个文本元素的组内 fontSize/fontFamily/bold 必须一致
  {
    // chrome-brand-center 退出同行比对（2026-09-14 用户定品牌行用 Georgia）：它是**字标署名**，
    // 与同排的 source/pageno 刻意不同族——留在组里会让每张 chrome 页都多一条 peer warn（实测 +165 条）。
    // 摘掉它之后，该闸仍然守住真正要守的：source 与 pageno 必须同源、内容行的并排标签必须同源。
    const texts = els.filter((e) => e?.elementType === 'text' && Array.isArray(e.bounds) &&
      String(e.elementId) !== 'chrome-brand-center')
    const groups = new Map()
    for (const e of texts) {
      const y = Math.round(e.bounds[1] / 2)
      if (!groups.has(y)) groups.set(y, [])
      groups.get(y).push(e)
    }
    // 2026-09-16 判定条件修正（误伤闭环，登记见 qa-gate.md §豁免登记）：
    // 原判据只按 y 分组，**同一行但分属不同列**的元素也被算作"同行"——而表格行标签（14px table 角色）
    // 与右侧 insight panel 条目题（16px panelItemTitle 角色）本来就不在一个列里，字阶不同是设计。
    // qa-gate.md 里为此攒了 9 条逐页豁免，全是「列结构/角色差异是设计如此」。
    // 改为：y 组内**再按 x 间距聚类成列**，只在列内查一致性。
    // 阈值 70px 从语料定：76 个命中组在"字体变化那条缝"上的间距分布——
    //   0–20px 32 组（42%，紧邻真同行，必须继续报）｜20–40 17｜40–60 7｜60–80 4｜80–120 8｜≥120 8
    //   已登记豁免实测：demo/page-27（象限标签 ｜ 风险登记行）缝宽 71px → 收窄后停响。
    // ⚠️ 收窄救不了全部 9 条：某内部测试 deck 的 SCALE 图例行缝宽只有 27px，是**真同一行**、
    //    靠角色差异豁免的，仍需保留逐页豁免。不要为清空豁免表把阈值压到 27——那会干掉 42% 的真命中。
    const COL_GAP = 70
    for (const g of groups.values()) {
      if (g.length < 3) continue
      const sig = (e) => {
        const st = e.content?.style ? pres.theme.textStyles[String(e.content.style).slice(1)] : null
        return [
          e.content?.fontSize ?? st?.fontSize ?? 14,
          String(e.content?.fontFamily ?? st?.fontFamily ?? '').split(',')[0].trim().toLowerCase(),
          String(e.content?.bold ?? st?.bold ?? false),
        ].join('|')
      }
      // 按 x 切列：相邻两元素之间净空 ≥COL_GAP 即认为跨列
      const sorted = [...g].sort((a, b) => a.bounds[0] - b.bounds[0])
      const cols = [[sorted[0]]]
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const gap = sorted[i].bounds[0] - (prev.bounds[0] + prev.bounds[2])
        if (gap >= COL_GAP) cols.push([sorted[i]])
        else cols[cols.length - 1].push(sorted[i])
      }
      for (const col of cols) {
        if (col.length < 3) continue // 列内不足 3 个不判（与原闸的 ≥3 门槛一致）
        const core = new Set(col.map((e) => sig(e).split('|').slice(0, 2).join('|')))
        if (core.size > 1) {
          report('warn', pageId, 'peer_font_consistency', `同一行的 ${col.length} 个文本（y≈${col[0].bounds[1]}）字阶或字族不一致：${col.map((e) => e.elementId).join(', ')}`)
        }
      }
    }
  }

  // ——— 页面密度闸（177 页黄金件分布定阈 2026-09-08：median 69 el / 1469 ch，验收上限 202 el / 2802 ch）———
  {
    const elCount = els.length
    if (elCount > 210) {
      report('error', pageId, 'page_density', `元素 ${elCount} 个 >210（黄金件验收上限 202）——拆页，K 不怕页多`)
    } else if (elCount > 150) {
      report('warn', pageId, 'page_density', `元素 ${elCount} 个偏密（全库 p90=108，验收上限 202）`)
    }
    let totalChars = 0
    for (const el of els) totalChars += textOf(el).length
    if (totalChars > 3000) {
      report('error', pageId, 'page_density', `文本 ${totalChars} 字符 >3000（黄金件最密页 2955）——拆页或删文`)
    } else if (totalChars > 2400) {
      report('warn', pageId, 'page_density', `文本 ${totalChars} 字符偏密（全库 p90=2268，黄金件最密 2955）`)
    }
    // ——— 密度下沿闸（2026-09-13 用户案「买方 IC 密度偏低」，同日看图标定两档）———
    // 原闸只有上限、下方无界。下沿**按 tone 取各自标定件的 p25**，不用黄金件分布——
    // 用户 2026-09-13 并排看 20 页全览后定：回归件短 deck 那档是**路演**的理想密度，
    // IC 标定回归件那档是 **IC** 的理想密度（IC 文本中位 ~1100，不是黄金件的 1510）。
    // 元素与文本**同时**低于下沿才报——单图页元素少但信息量在图里，单轴判会误伤。
    // L03 隔页整条豁免：它 pageType 也是 content，但本来就只有 part label + 大标题 + 索引卡，
    // 天生在下沿以下（2026-09-13 实测：IC 标定件里 4 个 sparse 命中全是隔页，100% 误伤）。
    const isDivider = els.some((e) => ['$dividerH', '$dividerNum', '$partLabel'].includes(e?.content?.style)) ||
      els.some((e) => /^div-(spine|title|part-label)$/.test(String(e?.elementId ?? '')))


    if (isContent && !isDivider) {
      // 第二个轴量**短条数**而不是字符数（2026-09-14 用户定：「不允许通过塞字的方式实现密度，
      // 大段文字应该 bullet，应该增加一些元素」）。原先用字符数等于给「把段落写长」发奖——实测密度
      // 标定轮字符中位 623→1130，短条只从 11 增到 14，而 ≥180 字的大块从 2 涨到 13，涨的是长度不是条数。
      // 短条 = 15–90 字的文本元素；golden-ref 中位 16 条/页（p25 12），我们四轮普遍只有 11–14。
      const shortItems = els.filter((e) => e?.elementType === 'text')
        .map((e) => textOf(e)).filter((t) => t.length >= 15 && t.length <= 90).length
      const T = TONE === 'roadshow'
        ? { el: 22, it: 7, medEl: 43, medIt: 11, name: '路演' }
        : { el: 33, it: 10, medEl: 61, medIt: 16, name: 'IC' }
      if (elCount < T.el && shortItems < T.it) {
        report('warn', pageId, 'page_sparse', `元素 ${elCount} <${T.el} 且 短条 ${shortItems} <${T.it}——${T.name} 页密度下沿（目标 ${T.medEl} 元素 / ${T.medIt} 条）；**补的是条数不是字数**：大段拆成 15–90 字的短条（字面「· 」或 ellipse 圆点配对），或补论证层次（分解/对照/敏感性）；禁止把段落写长来达标`)
      }
    }

  // ——— 一坨闸（2026-09-14 用户定「文字不能是一坨，需要 bullet」）———
    // 只拦正文块；脚注/来源/免责/方法论天然长句（golden-ref 里 400+ 字的全是 chrome-footnotes）。
    // 阈值 300 按 corpus 标定：golden-ref 常规内容页仅 3 页命中（406/314/304），附录型另有落点；
    // 180 会打中 golden 13/37 页——那是误伤，K 原版本来就写长段。
    // ⚠️ 分条在本体系里**不是行首 `•`**（golden-ref 42 页 0 个），是「一条一个 text 元素 + bullet 形 shape」。
    for (const el of els) {
      if (!el || typeof el?.content?.text !== 'string') continue
      const id = String(el.elementId ?? '')
      const st = String(el.content.style ?? '')
      if (/footnote|source|disclaim|method|provenance|caption/i.test(id + ' ' + st)) continue
      const len = textOf(el).length
      if (len >= 300) {
        report('warn', pageId, 'text_block_blob',
          `${id} 单块 ${len} 字符 ≥300——拆成多条短文本元素（本模板分条 = 字面「· 」或 ellipse 圆点配对，禁原生 <ul>/<li>）；正文块目标 ≤~165 字`)
      }
    }
  }

  // ——— 单位标签必须叠在它那栏的图题下方、同左缘（2026-09-13 用户圈出，「这个是最重要的」）———
  // canonical 叠法（黄金件 p26 / p23 实测）：**图题 → 单位标签 → 图，三件同一左缘**
  //   p26  chart-title [65,153.5] → unit-label [65,179.9] → chart [63,218,792,437]
  //   p23  lbl-chart-title [65,153.5] → lbl-unit [65,182] → chart [63,178,562,388]
  // 旧闸写死 `x !== 65 → error`，只在「图本来就顶着左边距」时碰巧等价；图一旦缩进（配方 example 误把 football
  // 缩到 265），单位标签仍停在 65 判过，左边就空出一条死列、标签成孤儿。改成**对齐它自己那栏的图题**。
  // 二级轴单位（黄金 p23 `lbl-unit-right` 的「%」贴在图右缘）合法，按右缘豁免。
  {
    const charts = els.filter((o) => o?.elementType === 'chart' && Array.isArray(o.bounds))

    // ——— 图左缘的死列（2026-09-13 用户「这个是最重要的」）———
    // 图缩进到 x=265 而左边 [65,265) 整条空着 = 200px 死列。单独靠 unit_label_align 抓不住：
    // 那条只在「有单位标签且它成了孤儿」时才响，模型一旦不写单位标签（density 轮实测），
    // 死列原样保留而闸全绿。whitespace_hole 也漏——洞宽 200 <它的 300px 最小边阈。故直接判这条带空不空。
    for (const c of charts) {
      const [cx, cy, , ch] = c.bounds
      if (cx <= 100) continue                                    // 已顶到左边距
      const occupied = els.some((o) => {
        if (o === c || !Array.isArray(o.bounds)) return false
        if (/^chrome-/.test(String(o?.elementId ?? ''))) return false   // 页眉页脚横跨全宽，不算占位
        const [ox, oy, ow, oh] = o.bounds
        return ox < cx - 8 && ox + ow > LEFT_MARGIN && oy < cy + ch && oy + oh > cy
      })
      if (!occupied) {
        report('error', pageId, 'chart_left_gutter', `${c.elementId} 左缘 ${cx}，而左边 [${LEFT_MARGIN}, ${cx}) × 图高这一整条是空的——${Math.round(cx - LEFT_MARGIN)}px 死列。图应顶到左边距 ${LEFT_MARGIN}，或把这条带填上内容`)
      }
    }

    // ——— 图右缘的死带（2026-09-22 用户「还是这种奇怪的空格，没有检测吗」）———
    // chart_left_gutter 的镜像：图右缘到下一占位元素 >150px 空带（实案：图 770/760 宽、panel 在 1125，
    // 中间 292–302px 死带 ×7 页）。whitespace_hole 漏——夹缝窄条豁免（touches≥2 且 min 边 <330）。
    for (const c of charts) {
      const [cx, cy, cw, ch] = c.bounds
      const cr = cx + cw
      let nxt = null                                       // 图 y 区间内、图右缘以右的最近占位元素
      for (const o of els) {
        if (o === c || !Array.isArray(o.bounds)) continue
        if (/^chrome-/.test(String(o?.elementId ?? ''))) continue   // 页眉页脚横跨全宽，不算占位
        const [ox, oy, ow, oh] = o.bounds
        if (oy < cy + ch && oy + oh > cy && ox >= cr - 4) {
          if (nxt === null || ox < nxt) nxt = ox
        }
      }
      const gap = (nxt === null ? RIGHT_EDGE : nxt) - cr  // 右侧无元素时量到展区右缘
      if (gap > 150) {
        report('error', pageId, 'chart_right_gutter', `${c.elementId} 右缘 ${Math.round(cr)}，到${nxt === null ? `展区右缘 ${RIGHT_EDGE}` : `下一元素 x=${Math.round(nxt)}`} 之间是 ${Math.round(gap)}px 空带——图应加宽撑满栏宽，或把这条带填上内容`)
      }
    }

    if (charts.length) {
      for (const u of els) {
        const uid = String(u?.elementId ?? '')
        if (!/^(unit-label|lbl-unit|unit-lbl|lbl-billions)/.test(uid) || !Array.isArray(u.bounds)) continue
        const [ux, , uw] = u.bounds
        // 二级轴单位贴图右缘。容差 40 而非 6：标签框宽度随文案变（黄金 p23 的「%」框宽 15.3、
        // 右缘差 0.2 刚好躲过；回归件 p21 的「EPS ($)」框宽 60、右缘超出图 16px 就误报了）。
        // 命名带 right 的也直接豁免——那是显式的二级轴标注。
        if (/-right\b|_right\b|right$/i.test(uid)) continue
        if (charts.some((c) => Math.abs((ux + uw) - (c.bounds[0] + c.bounds[2])) <= 40)) continue
        if (charts.some((c) => Math.abs(ux - (c.bounds[0] + 2)) <= 6)) continue                          // 正常：对齐某张图左缘
        report('error', pageId, 'unit_label_align', `${uid} 左缘 ${ux} 不在本页任何一张图的左缘上（图左缘落在 ${charts.map((c) => c.bounds[0]).join(' / ')}）——单位标签标的是那张图的纵轴，必须贴着它的左缘；差出一截就等于左边空一条死列、标签成孤儿`)
      }
    }
  }

  // ——— 去 AI 腔（prose-humanizer 机检子集，全 WARN 促降不阻断）———
  // 豁免页脚三件套与脚注：那是规定格式，不做文风检查（与 reference/prose-humanizer.md §豁免区同口径）
  for (const el of els) {
    if (el?.elementType !== 'text') continue
    if (/^chrome-(source|brand|pageno|footnotes)/.test(String(el.elementId ?? ''))) continue
    const t = textOf(el)
    if (!t) continue
    deckChars += t.length
    deckDash += (t.match(/——/g) ?? []).length + (t.match(/(?<!—)—(?!—)/g) ?? []).length
    deckNotBut += (t.match(HUMANIZE.NOT_BUT) ?? []).length
    const hits = t.match(HUMANIZE.SLOP)
    if (hits) {
      report('warn', pageId, 'ai_slop', `${el.elementId} 含 AI 套话词「${[...new Set(hits)].join('/')}」——删掉后句子必须仍然成立（prose-humanizer §6）`)
    }
  }

  // ——— 图下文字块禁「读法/解读/说明」开场（2026-09-13 用户定：「不要总是什么读法读法的，直接就是 takeaway」）———
  // 先教人怎么看图、再说结论 = 把判断埋在使用说明后面。第一句就该是结论；图怎么读交给图例和轴。
  for (const el of els) {
    if (el?.elementType !== 'text') continue
    const t = textOf(el)
    const m = t.match(/^(读法|解读|说明|导读|看图|如何看|结构观察|观察|要点|小结|注)\s*[：:]/)
    if (m) {
      report('error', pageId, 'explainer_preamble', `${el.elementId} 以「${m[1]}：」开场——图下文字块直接给 takeaway，第一句就是结论；不要先讲怎么看图（标签去掉，或改写成带判断的短句）`)
    }
  }

  // ——— 行距节奏闸（同列发丝线行组间距手摆不均、剩余空间倒进末带）———
  // 发丝线：shape/rect 高 ≤1.6、填充 $chartNeutral/#CCCCCC/#000000、中心 y∈[145,715]；按 x±3 / w±40 成组，≥3 根才检
  // 首缝豁免（表头缝 ≈33 vs 行距、面板头区）；待检缝 <2 免检
  // 容量驱动整组豁免：待检带内容高参差 >max(12,15%)，或任一带无内容
  // 缺陷签名 = 末缝上偏：末缝 − 中位缝 − max(0, 末带内容高 − 内容中位) > max(12, 15%·中位缝) → warn（v1 降档观察）
  {
    const RULE_FILLS = new Set(['#BFBFBF', '#CCCCCC', '#000000'])
    const med = (arr) => { const s = [...arr].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
    const hairs = els.filter((e) => {
      if (e?.elementType !== 'shape' && e?.elementType !== 'rect') return false
      const b = e?.bounds
      if (!Array.isArray(b) || b.length !== 4 || b[3] > 1.6) return false
      if (!RULE_FILLS.has(resolveColor(e?.fill?.color))) return false
      const cy = b[1] + b[3] / 2
      return cy >= 145 && cy <= 715
    })
    const groups = []
    for (const h of hairs) {
      const [hx, , hw] = h.bounds
      let g = groups.find((g) => Math.abs(g.x - hx) <= 3 && Math.abs(g.w - hw) <= 40)
      if (!g) { g = { x: hx, w: hw, items: [] }; groups.push(g) }
      g.items.push(h)
    }
    for (const g of groups) {
      if (g.items.length < 3) continue
      const ys = g.items.map((h) => h.bounds[1]).sort((a, b) => a - b)
      const gaps = ys.slice(1).map((y, i) => y - ys[i])
      const checked = gaps.slice(1)
      if (checked.length < 2) continue
      const contents = []
      let bandEmpty = false
      for (let i = 1; i + 1 <= ys.length - 1; i++) {
        const y0 = ys[i], y1 = ys[i + 1]
        let cTop = Infinity, cBot = -Infinity
        for (const e of els) {
          const b = e?.bounds
          if (!Array.isArray(b) || b.length !== 4) continue
          if ((e.elementType === 'shape' || e.elementType === 'rect') && b[3] <= 1.6) continue
          if (b[0] + b[2] < g.x + 5 || b[0] > g.x + g.w - 5) continue
          const cy = b[1] + b[3] / 2
          if (cy < y0 || cy >= y1) continue
          if (e.elementType === 'shape' && b[2] * b[3] > g.w * (y1 - y0) * 0.8) continue
          cTop = Math.min(cTop, b[1]); cBot = Math.max(cBot, b[1] + b[3])
        }
        if (cTop === Infinity) { bandEmpty = true; break }
        contents.push(cBot - cTop)
      }
      if (bandEmpty || contents.length < 2) continue
      const cMed = med(contents)
      if (contents.some((c) => Math.abs(c - cMed) > Math.max(12, cMed * 0.15))) continue
      const gMed = med(checked)
      const gTol = Math.max(12, gMed * 0.15)
      const last = checked[checked.length - 1]
      const excess = last - gMed - Math.max(0, contents[contents.length - 1] - cMed)
      if (excess > gTol) {
        const fmt = (v) => Math.round(v * 10) / 10
        report('warn', pageId, 'row_rhythm', `行组 ${g.items[0].elementId}…${g.items[g.items.length - 1].elementId} 发丝线间距 [${gaps.map(fmt).join('/')}] 不均——末缝 ${fmt(last)} 超中位 ${fmt(gMed)} 达 ${fmt(excess)}px（剩余空间倒进末带；同列行组须在栏高内均分，重排分隔线）`)
      }
    }
  }

  // ——— 主展区底缘闸已并入 whitespace_hole（2026-09-24 盘点：与 whitespace_hole 检测维度重叠，
  //     20 次命中相当比例裁决为「呼吸区」保留——底带空洞作为 hole 的一种位置标注在 geometry-scan.mjs 实现）———

  // ——— 图题左对齐闸（图题左对齐图左缘 x=chart.x+2，禁居中；v1 降 warn 观察）———
  // 候选题：16/18px bold 深色文本（$inkTitle/$titleBlue/#000000 或同效显式属性），竖向落 [chart.y−45, chart.y−6]、
  // 横向与图相交 ≥30% 题宽；多图页绑定图顶最近者（同距取相交更大）
  {
    const charts = els.filter((e) => e?.elementType === 'chart' && Array.isArray(e.bounds))
    for (const c of charts) {
      const [cx, cy, cw] = c.bounds
      const cands = els.filter((t) => {
        if (t?.elementType !== 'text' || !Array.isArray(t.bounds)) return false
        const st = t.content?.style ? (pres?.theme?.textStyles ?? {})[String(t.content.style).slice(1)] : null
        const fs = t.content?.fontSize ?? st?.fontSize
        const bold = t.content?.bold ?? st?.bold ?? false
        const color = (resolveColor(t.content?.color ?? st?.color ?? '') ?? '').slice(0, 7).toUpperCase()
        if (!(fs >= 16 && fs <= 18 && bold === true && ['#2F2F2F', '#3570C0', '#000000', '#3865BB'].includes(color))) return false
        const [tx, ty, tw, th] = t.bounds
        if (ty < cy - 45 || ty + th > cy - 6) return false
        const ov = Math.max(0, Math.min(tx + tw, cx + cw) - Math.max(tx, cx))
        return ov >= 0.3 * tw
      })
      if (!cands.length) continue
      cands.sort((a, b) => {
        const da = cy - (a.bounds[1] + a.bounds[3])
        const db = cy - (b.bounds[1] + b.bounds[3])
        if (Math.abs(da - db) > 0.5) return da - db
        const oa = Math.max(0, Math.min(a.bounds[0] + a.bounds[2], cx + cw) - Math.max(a.bounds[0], cx))
        const ob = Math.max(0, Math.min(b.bounds[0] + b.bounds[2], cx + cw) - Math.max(b.bounds[0], cx))
        return ob - oa
      })
      const t = cands[0]
      const aligns = Array.isArray(t.content?.align) ? t.content.align : []
      const leftOk = aligns[0] === 'left'
      const xOk = Math.abs(t.bounds[0] - (cx + 2)) <= 3
      if (!leftOk || !xOk) {
        report('warn', pageId, 'chart_title_align', `图题 ${t.elementId} x=${t.bounds[0]} align=${aligns.join('/') || '?'}——未左对齐 ${c.elementId} 左缘（期望 x=${cx + 2}±3 且左锚；图题禁居中）`)
      }
    }
  }

  // ——— 元素碰撞扫描（替代截图目检的几何闸：text×text 与 image×text 重叠 >30%）———
  {
    const vis = els.filter((e) => e && (e.elementType === 'text' || e.elementType === 'image') && Array.isArray(e.bounds))
    for (let a = 0; a < vis.length; a++) {
      for (let b = a + 1; b < vis.length; b++) {
        const [x1, y1, w1, h1] = vis[a].bounds
        const [x2, y2, w2, h2] = vis[b].bounds
        const ox = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2))
        const oy = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2))
        const a1 = w1 * h1
        const a2 = w2 * h2
        // 页面级背景层豁免（全幅底图/底色，覆盖 ≥85% 页面即视为背景）
        if (a1 >= 1440 * 810 * 0.85 || a2 >= 1440 * 810 * 0.85) continue
        const ov = ox * oy
        if (ov === 0) continue
        const smaller = Math.min(w1 * h1, w2 * h2)
        if (smaller > 0 && ov / smaller > 0.3) {
          report('error', pageId, 'element_collision', `${vis[a].elementId} × ${vis[b].elementId} 重叠 ${Math.round(ov / smaller * 100)}%`)
        }
      }
    }
  }

  // ——— z 序遮挡：小 image（icon）与后出现的有填充 shape 重叠 >50% → 会被盖住（C19 scenario icon 案）———
  {
    const shapes = els.filter((e) => e?.elementType === 'shape' && e.fill && Array.isArray(e.bounds))
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      if (el?.elementType !== 'image' || !Array.isArray(el.bounds)) continue
      const [x, y, w, h] = el.bounds
      const area = w * h
      if (area >= PAGE_W * PAGE_H * 0.1) continue // 大图（封面照/背景层）豁免
      const laterShapes = shapes.filter((s) => els.indexOf(s) > i)
      for (const s of laterShapes) {
        const [sx, sy, sw, sh] = s.bounds
        const ox = Math.max(0, Math.min(x + w, sx + sw) - Math.max(x, sx))
        const oy = Math.max(0, Math.min(y + h, sy + sh) - Math.max(y, sy))
        if (ox * oy > 0.5 * area) {
          report('error', pageId, 'z_order_occlusion', `${el.elementId} 写在 ${s.elementId} 之前且被其覆盖 ${Math.round(ox * oy / area * 100)}%——z 序铁律：icon 写在背景之后（YAML 元素序即绘制序）`)
          break
        }
      }
    }
  }

  // ——— z 序遮盖（content 版）：text/chart 被后出现的实色 shape 盖住 → 内容被遮（k3 p12 文本藏进 panel 案 / k3hs p19 横带压图案）———
  {
    const solidShapes = els.filter((e) => e?.elementType === 'shape' && e.fill?.type === 'solid' && Array.isArray(e.bounds))
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      if (!el || !Array.isArray(el.bounds)) continue
      if (el.elementType !== 'text' && el.elementType !== 'chart') continue
      if (el.elementId?.startsWith('chrome-')) continue
      const [x, y, w, h] = el.bounds
      const area = w * h
      if (area <= 0) continue
      const later = solidShapes.filter((s) => els.indexOf(s) > i)
      for (const s of later) {
        const [sx, sy, sw, sh] = s.bounds
        const ox = Math.max(0, Math.min(x + w, sx + sw) - Math.max(x, sx))
        const oy = Math.max(0, Math.min(y + h, sy + sh) - Math.max(y, sy))
        const ov = ox * oy
        if (ov === 0) continue
        const ratio = ov / area
        const limit = el.elementType === 'chart' ? 0.05 : 0.3
        if (ratio > limit) {
          report('error', pageId, 'z_order_cover', `${el.elementId} 被后出现的 ${s.elementId}（实色 shape）覆盖 ${Math.round(ratio * 100)}%——YAML 元素序即绘制序，内容会被盖住：把内容元素挪到 shape 之后、或重排几何解除重叠`)
          break
        }
      }
    }
  }




  // ——— 柱内标签冗余（bar_label_redundant）：bar 系列 dataLabels 的值在页面伴随表/正文里全部已出现 → 冗余可撤（2026-09-22 用户定「普通柱不要顶标」；capex 案）———
  {
    const charts = els.filter((e) => e?.elementType === 'chart')
    const pageText = els.filter((e) => e?.elementType === 'text').map((e) => textOf(e)).join(' ')
    const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const pageNums = new Set(nums(pageText).map((v) => Math.round(v * 100) / 100))
    for (const chart of charts) {
      const cols = chart.data?.cols ?? []
      const rows = chart.data?.rows ?? []
      for (const s of (chart.series ?? []).filter((x) => x?.type === 'bar' && x?.dataLabels?.show === true)) {
        if ((chart.series ?? []).some((x) => x?.name === '_base')) continue // 瀑布 proxy 的 delta/anchor 标签是 canonical 读法，非冗余
        // 真堆积柱（某行 ≥2 个非空段）的段内 ctr 标签是 R6 canonical（段内 ctr 标签维持），非冗余；稀疏单值堆积不算
        const stackCols = (chart.series ?? []).filter((x) => x?.type === 'bar' && x?.stack).map((x) => cols.indexOf(x.encode?.y)).filter((i) => i >= 0)
        const isRealStack = stackCols.length >= 2 && rows.some((r) => stackCols.filter((ci) => typeof r?.[ci] === 'number' && Number.isFinite(r[ci])).length >= 2)
        if (isRealStack) continue
        const ci = cols.indexOf(s.encode?.y)
        if (ci < 0) continue
        const vals = rows.map((r) => r?.[ci]).filter((v) => typeof v === 'number' && Number.isFinite(v))
        if (!vals.length) continue
        if (vals.every((v) => pageNums.has(Math.round(v * 100) / 100))) {
          report('warn', pageId, 'bar_label_redundant', `${chart.elementId} 系列「${s.name ?? s.encode?.y}」的柱内标签值（${vals.slice(0, 4).join('/')}…）在页面伴随表/正文里全部已出现——冗余可不挂（charts.md 通用纪律 4 取舍：普通柱标签只在柱值在别处读不到时挂）`)
        }
      }
      // ——— 堆积柱缺柱顶标（stacked_toplabel_missing，warn 建议档；本体系无 cagr-line 工具）———
      // 柱顶标可选；判据：真堆积（某类目 ≥2 非空段）且页上找不到任一「数值≈某类目合计且框落图区」的文本 → 建议加
      const stackCols2 = (chart.series ?? []).filter((x) => x?.type === 'bar' && x?.stack && x?.name !== '_base').map((x) => cols.indexOf(x.encode?.y)).filter((i) => i >= 0)
      const isWaterfallProxy = (chart.series ?? []).some((x) => x?.name === '_base')
      if (stackCols2.length && !isWaterfallProxy) {
        const nonNull = (r, ci) => typeof r?.[ci] === 'number' && Number.isFinite(r[ci])
        const realRows = rows.filter((r) => stackCols2.filter((ci) => nonNull(r, ci)).length >= 2)
        if (realRows.length) {
          const totals = realRows.map((r) => stackCols2.reduce((acc, ci) => acc + (Number(r[ci]) || 0), 0))
          const cb = Array.isArray(chart.bounds) ? chart.bounds : null
          const hasToplabel = cb != null && els.some((e) => {
            if (e?.elementType !== 'text' || !Array.isArray(e.bounds)) return false
            const v = Number(textOf(e).replace(/[,%\s]/g, ''))
            if (!Number.isFinite(v) || !totals.some((t) => Math.abs(t - v) < 0.5001)) return false
            const [tx, ty, tw, th] = e.bounds
            return tx + tw > cb[0] && tx < cb[0] + cb[2] && ty + th > cb[1] - 40 && ty < cb[1] + cb[3]
          })
          if (!hasToplabel) {
            report('warn', pageId, 'stacked_toplabel_missing', `${chart.elementId} 是堆积柱（≥2 个非空段）但没有柱顶标——柱顶标可选，手摆需对齐类目中心（总和或份额；本体系无 cagr-line 工具）`)
          }
        }
      }
    }
  }

  // ——— 单行文本宽度估算（wrap:false 溢出闸：Georgia 62px H1 折行案/stat label 截断案）———
  // 宽表与 cw 用模块级定义（与 title_render_lines 共用）；延伸右缘撞到邻居元素才 error，右侧空旷仅 warn
  {
    for (const el of els) {
      if (el?.elementType !== 'text' || !Array.isArray(el.bounds)) continue
      if (el.content?.wrap !== false) continue
      const rawHtml = typeof el.content?.text === 'string' ? el.content.text : ''
      if (/&nbsp;/.test(rawHtml)) {
        report('error', pageId, 'no_nbsp', `${el.elementId} 含 &nbsp;（渲染器不认会吞空格——用「 — 」或普通空格）`)
      }
      const raw = rawHtml
        .replace(/<sup>(.*?)<\/sup>/g, (m, g1) => '￿'.repeat(String(g1).replace(/<[^>]*>/g, '').length))
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      if (!raw) continue
      const st = el.content?.style ? pres.theme.textStyles[String(el.content.style).slice(1)] : null
      const fs = el.content?.fontSize ?? st?.fontSize ?? 14
      const ff = String(el.content?.fontFamily ?? st?.fontFamily ?? '')
      const bold = el.content?.bold ?? st?.bold ?? false
      const ls = el.content?.letterSpacing ?? st?.letterSpacing ?? 0
      let est = 0
      for (const ch of raw) est += cw(ch) * fs
      est += ls * Math.max(0, raw.length - 1)
      if (bold) est *= 1.03
      if (/georgia/i.test(ff)) est *= 1.03
      const bw = el.bounds[2]
      if (est <= bw * 1.04) continue
      // 延伸右缘（仅左对齐可判定方向）：撞到邻居 → error；空旷 → warn
      const hAlign = Array.isArray(el.content?.align) ? el.content.align[0] : 'left'
      const extRight = el.bounds[0] + est
      const [ex, ey, , eh] = el.bounds
      const hit = hAlign === 'left' && els.some((o) => {
        if (o === el || !Array.isArray(o?.bounds)) return false
        if (o.bounds[2] * o.bounds[3] >= PAGE_W * PAGE_H * 0.85) return false // 背景层
        const [ox, oy, ow, oh] = o.bounds
        return ox >= ex + bw - 1 && ox < extRight && oy < ey + eh && oy + oh > ey
      })
      const hitName = hAlign === 'left' ? (els.find((o) => {
        if (o === el || !Array.isArray(o?.bounds)) return false
        if (o.bounds[2] * o.bounds[3] >= PAGE_W * PAGE_H * 0.85) return false
        const [ox, oy, ow, oh] = o.bounds
        return ox >= ex + bw - 1 && ox < extRight && oy < ey + eh && oy + oh > ey
      })?.elementId ?? '') : ''
      if (hit) {
        report('error', pageId, 'text_width_estimate', `${el.elementId} 单行估算宽 ${Math.round(est)}px 超框宽 ${bw} 且撞到 ${hitName}（"${raw.slice(0, 30)}"）`)
      } else {
        report('warn', pageId, 'text_width_estimate', `${el.elementId} 单行估算宽 ${Math.round(est)}px 超框宽 ${bw}（右侧空旷，"${raw.slice(0, 30)}"）`)
      }
    }
  }

  // ——— 纵向溢出闸（text_vfit_overflow，v3 新增：折行文本估算高 > 框高即拦）———
  // 与 fit-deck.mjs 共用 text-metrics 估算模型；容差 1.06（略松于 fit 的 0.96，fit 是工艺、闸是事故线）
  // 只查 wrap:true 文本（wrap:false 由 text_width_estimate 管宽）；页码豁免
  {
    for (const el of els) {
      if (el?.elementType !== 'text' || !Array.isArray(el.bounds)) continue
      if (el.content?.wrap === false) continue
      if (el.elementId === 'chrome-pageno') continue
      if (!textOf(el).trim()) continue
      const { h } = estTextHeight(el, pres.theme.textStyles ?? {})
      if (h > el.bounds[3] * 1.06 && el.bounds[3] >= 18) {
        report('error', pageId, 'text_vfit_overflow', `${el.elementId} 估算渲染高 ${Math.round(h)}px 超框高 ${el.bounds[3]}px——先跑 fit-deck --fix 机械降档；到地板仍溢出走 geometry-decision.md（瘦身文本→调行高→扩框→减元素）`)
      }
    }
  }

  // ——— 文本对比度闸（text_contrast，移植 ppt-master shared-standards 对比度纪律）———
  // 判定：找文本中心点之下、z 序最靠上的 solid/gradient shape 作底色（gradient 取对比最差端保守判定），
  // 无承载 shape 时取页面背景（缺省白）。WCAG 对比度 <1.8 = error（不可读）、<2.6 = warn。
  // 阈值刻意低于 WCAG AA 4.5：$accent 橙字是本体系合法强调（对 white ≈2.64），闸只拦真事故（黄上白/白上浅蓝/灰字上白）。
  // 豁免：图片背景上的文字（无法采样，封面 cover-* 属此类）；<span> 内联色不逐段判（取元素级色）。
  {
    const pageBg = resolveColor(doc?.background?.color ?? '$lt1') ?? '#FFFFFF'
    for (const el of els) {
      if (el?.elementType !== 'text' || !Array.isArray(el.bounds)) continue
      const id = String(el.elementId ?? '')
      if (/^cover-/.test(id)) continue
      const rawTxt = textOf(el).trim()
      if (rawTxt.length < 2) continue
      const st = el.content?.style ? pres.theme.textStyles[String(el.content.style).slice(1)] : null
      const fgRaw = el.content?.color ?? st?.color
      if (typeof fgRaw !== 'string') continue
      const fg = resolveColor(fgRaw)
      if (!fg || !relLum(fg)) continue
      const cx = el.bounds[0] + el.bounds[2] / 2
      const cy = el.bounds[1] + el.bounds[3] / 2
      let bgCandidates = [pageBg]
      const idx = els.indexOf(el)
      for (let i = idx - 1; i >= 0; i--) {
        const o = els[i]
        if (o?.elementType !== 'shape' || !Array.isArray(o.bounds)) continue
        // 空心族形状的 bounds ≠ 涂布区（环/弧/框的中心是空洞），不作底色候选
        if (['blockArc', 'donut', 'arc', 'chord', 'frame', 'halfFrame', 'pie'].includes(String(o.shapeName))) continue
        const [ox, oy, ow, oh] = o.bounds
        if (cx < ox || cx > ox + ow || cy < oy || cy > oy + oh) continue
        if (o.fill?.type === 'solid' && typeof o.fill.color === 'string') {
          bgCandidates = [resolveColor(o.fill.color)]
          break
        }
        if (o.fill?.type === 'gradient' && Array.isArray(o.fill.stops)) {
          const stops = o.fill.stops.map((s) => resolveColor(s?.color)).filter(Boolean)
          if (stops.length) { bgCandidates = stops; break }
        }
      }
      let minC = null
      let sawLightBg = false
      for (const bg of bgCandidates) {
        if (relLum(bg) != null && relLum(bg) > 0.55) sawLightBg = true
        const c = contrastOf(fg, bg)
        if (c != null && (minC == null || c < minC)) minC = c
      }
      if (minC == null) continue
      // 豁免：浅底上的 $accent/$accentDeep 橙字是铁律明文强调色（浅底强调恒橙），不参与对比度裁决
      if (sawLightBg && ['#FF7829', '#ED7D31'].includes(fg)) continue
      if (minC < 1.8) {
        report('error', pageId, 'text_contrast', `${id} 文本色 ${fgRaw} 对底色对比度 ${minC.toFixed(2)} <1.8（不可读；on-dark 用 $lt1/$accentOnDark，浅底用墨色/蓝）`)
      } else if (minC < 2.6) {
        report('warn', pageId, 'text_contrast', `${id} 文本色 ${fgRaw} 对底色对比度 ${minC.toFixed(2)} <2.6——核对是否为刻意的浅底橙强调（$accent 合法），否则换色`)
      }
    }
  }

  // ——— 孤行闸（orphan_line，移植 ppt-master 自然折行纪律：末行 ≤2 字符 = 吊尾孤字）———
  // 只查折行文（wrap 非 false）≥12 字的正文类元素；与 text_width_estimate 共用 cw 宽表
  {
    for (const el of els) {
      if (el?.elementType !== 'text' || !Array.isArray(el.bounds)) continue
      if (el.content?.wrap === false) continue
      const rawHtml = typeof el.content?.text === 'string' ? el.content.text : ''
      const paras = rawHtml.split(/<\/p>\s*<p[^>]*>|\n/).map((p) =>
        p.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim())
      const st = el.content?.style ? pres.theme.textStyles[String(el.content.style).slice(1)] : null
      const fs = el.content?.fontSize ?? st?.fontSize ?? 16
      const bold = el.content?.bold ?? st?.bold ?? false
      const bw = el.bounds[2]
      for (const para of paras) {
        if (para.length < 12) continue
        let lines = 1, acc = 0, lastChars = para.length
        for (const ch of para) {
          let w = cw(ch) * fs
          if (bold) w *= 1.03
          if (acc + w > bw * 0.98 && acc > 0) { lines++; acc = w; lastChars = 1 }
          else { acc += w; if (lines > 1) lastChars++ }
        }
        if (lines >= 2 && lastChars >= 1 && lastChars <= 2) {
          report('warn', pageId, 'orphan_line', `${el.elementId} 折行后末行仅 ${lastChars} 字符（孤字吊尾）——提前一处自然断句或微调框宽（"${para.slice(0, 26)}…"）`)
        }
      }
    }
  }

  // ——— 瀑布图类目标签长度（单行 >12 字符触发渲染器 interval 跳号，R5 案：改双行）———
  for (const el of els) {
    if (el?.elementType !== 'chart' || !Array.isArray(el.series) || !el.data?.cols) continue
    const isWaterfall = el.series.some((s) => s && s.name === '_base' && s.stack)
    if (!isWaterfall) continue
    const xCol = el.series.find((s) => s?.encode?.x)?.encode?.x ?? el.data.cols[0]
    const xi = el.data.cols.indexOf(xCol)
    if (xi < 0 || !Array.isArray(el.data.rows)) continue
    const longCats = el.data.rows
      .map((r) => String(Array.isArray(r) ? r[xi] : r?.[xCol] ?? ''))
      .filter((c) => c && !c.includes('\n') && c.length > 12)
    if (longCats.length > 0) {
      report('warn', pageId, 'waterfall_cat_label_len', `瀑布图 ${longCats.length} 个类名单行 >12 字符（${longCats[0].slice(0, 20)}…）——渲染器会跳号，改双行标签（名\\n值）`)
    }
  }

  // ——— chart 导出链纪律（codec 事实，与设计无关）———
  for (const el of els) {
    if (el?.elementType !== 'chart' || !Array.isArray(el.series)) continue
    const horizontal = el.xAxis?.type === 'value' && el.yAxis?.type === 'category'
    if (horizontal && el.series.some((s) => s?.type === 'line')) {
      report('error', pageId, 'hbar_no_line_series', `${el.elementId} 横向 bar（value×category）含 line 系列——codec 导出即坏（barDir 错写 col、valAx min/max 丢失）`)
    }
    // 纯数字系列名 → codec 导出即崩（name:"2022" 让 codec DOM 操作拿到非 Node，TypeError）
    for (const s of el.series) {
      if (s && /^\d+$/.test(String(s.name ?? '').trim())) {
        report('error', pageId, 'series_name_numeric', `${el.elementId} 系列名 "${s.name}" 是纯数字——codec 导出必崩；系列名必须含非数字字符（"2022年"/"FY2022"/"2022A" 均可；类目名纯数字不受影响）`)
      }
    }
    // doughnut 洞心大数字 + 原生 right 图例 → PowerPoint 图例压环撞中心数字
    const pieLike = el.series.some((s) => ['pie', 'doughnut'].includes(s?.type))
    if (pieLike && el.legend && el.legend.show !== false && el.legend.position === 'right') {
      const hasCenterText = els.some((o) => o?.elementType === 'text' && /center|hole/i.test(String(o?.elementId ?? '')))
      if (hasCenterText) {
        report('error', pageId, 'doughnut_legend_right', `${el.elementId} doughnut 洞心有大数字但用原生 right 图例——PowerPoint 里图例压环撞中心数字；改 legend: false（段名由左栏表承担）或 position: bottom`)
      }
    }
  }




}

// deck 级去 AI 腔判定必须放在打印循环**之前**——放后面只会加计数不打印行
// （bg_color_limit 就是那个形态，qa-gate.md 专门登记过这个坑）
// --pages 子集模式下整组跳过：破折号密度是「个/千字」的比值、not_but/背景数是全 deck 计数，
// 拿几页算出来的既可能假阳也可能假阴，报了反而误导写页 agent。全量复核时自然会跑到。
if (!SUBSET && deckChars >= HUMANIZE.MIN_CHARS) {
  const dens = deckDash / deckChars * 1000
  if (dens >= HUMANIZE.DASH_BUDGET) {
    report('warn', 'deck', 'dash_density', `破折号 ${dens.toFixed(1)} 个/千字（${deckDash} 个 / ${deckChars} 字，slide 预算 ${HUMANIZE.DASH_BUDGET}）——每处都该是有意选择，否则换句号/逗号/冒号（prose-humanizer §10；标定：黄金件 2.2、canonical examples 3.3）`)
  }
}
if (!SUBSET && deckNotBut >= HUMANIZE.NOT_BUT_MAX) {
  report('warn', 'deck', 'not_but_parallel', `否定/递进排比 ${deckNotBut} 处 ≥${HUMANIZE.NOT_BUT_MAX}——「不是…而是…」「不仅…而且…」是在否定一个没人提出的主张，直接陈述即可（prose-humanizer §7；纠正读者真实误解的 sharp title 可留）`)
}

// 2026-09-16：bg_color_limit 挪到打印循环**之前**——它原先在循环之后，只手工 nWarn++、
// **永远不打印**（qa-gate.md 专门登记过这个坑，这次顺手清掉）；手工计数在 --only 下还会虚增。
if (!SUBSET && deckBgs.size > 2) {
  report('warn', 'deck', 'bg_color_limit', `全 deck 页面背景 ${deckBgs.size} 种 >2（本体系页面恒白底；封面背景走全幅 image，不占此额度）`)
}

// ——— 策划层闸（planning.md；全部 warn 级——策划判断由人裁决，闸只提醒失配）———
// plan_contract：PLAN.md 六要素齐不齐；page_rhythm_*：节奏列声明 vs 实测元素数；closing_missing：末页须收尾页
if (!SUBSET) {
  const planPath = join(dir, 'PLAN.md')
  if (!existsSync(planPath)) {
    report('warn', 'deck', 'plan_contract', '缺 PLAN.md（SKILL.md 第 2 步：页纲必须冻结落盘；planning.md §1 契约六行写在头部）')
  } else {
    const plan = readFileSync(planPath, 'utf8')
    const missing = ['tone', 'mode', 'audience', 'purpose', 'action', 'core']
      .filter((k) => !new RegExp(`^\\s*${k}\\s*[:：]`, 'mi').test(plan))
    if (missing.length) {
      report('warn', 'deck', 'plan_contract', `PLAN.md 契约六要素缺 ${missing.join(' / ')}（planning.md §1：tone/mode/audience/purpose/action/core 六行固定块）`)
    }
    // 节奏列：页纲表行内出现 anchor|dense|breathing|锚点|密集|呼吸 独立单元格即识别
    const RH_MAP = { anchor: 'anchor', dense: 'dense', breathing: 'breathing', '锚点': 'anchor', '密集': 'dense', '呼吸': 'breathing' }
    const rhythms = new Map()
    for (const line of plan.split('\n')) {
      const m = line.match(/^\s*\|\s*(\d+)\s*\|(.+)\|\s*$/)
      if (!m) continue
      const cells = m[2].split('|').map((s) => s.trim())
      const hit = cells.find((c) => RH_MAP[c.toLowerCase()])
      if (hit) rhythms.set(Number(m[1]), RH_MAP[hit.toLowerCase()])
    }
    for (const [pg, rh] of rhythms) {
      const cnt = pageElCount.get(`page-${pg}`)
      if (cnt == null) continue
      const bad =
        (rh === 'anchor' && cnt < 60) ||
        (rh === 'breathing' && cnt >= 55) ||
        (rh === 'dense' && (cnt < 35 || cnt > 100))
      if (bad) {
        report('warn', `page-${pg}`, 'page_rhythm_mismatch', `节奏声明 ${rh} 但实测元素 ${cnt} 个（带宽：anchor≥60 / dense 35–100 / breathing<55）——声明或实现有一个错了（planning.md §3）`)
      }
    }
    // content_underfill（v3）：内容底缘 < 0.78×735 且非呼吸页 → 提醒「少而大」拉伸/放大（auto-fit.md §3）
    for (const [pg, bot] of pageContentBottom) {
      if (bot <= 0 || bot >= 735 * 0.78) continue
      const rh = rhythms.get(Number(pg.replace('page-', '')))
      if (rh === 'breathing') continue
      report('warn', pg, 'content_underfill', `内容底缘 ${Math.round(bot)}px，内容区只用到 ${Math.round(bot / 735 * 100)}%——空区先拉伸/放大（node scripts/fit-deck.mjs <deck> --fix --stretch），或把 PLAN 节奏列订正为呼吸`)
    }
    const vals = [...rhythms.values()]
    if (vals.length >= 6 && vals.every((v) => v === 'dense')) {
      report('warn', 'deck', 'page_rhythm_flat', `${vals.length} 页节奏清一色 dense——节奏必须有起伏：anchor 页前后用 breathing/dense 过渡（planning.md §3）`)
    }
  }
  // closing_missing：末页（presentation.pptd pages 末位）须为收尾页（pageType final 或 closing-* 元素）
  const lastRef = Array.isArray(pres?.pages) ? pres.pages[pres.pages.length - 1] : null
  if (lastRef) {
    const lastFile = join(dir, String(lastRef))
    let lastDoc = null
    try { lastDoc = yaml.load(readFileSync(lastFile, 'utf8')) } catch { /* yaml_parse 已在主循环报过 */ }
    if (lastDoc) {
      const lastIds = (lastDoc.elements ?? []).map((e) => String(e?.elementId ?? ''))
      const isClosing = lastDoc.pageType === 'final' || lastIds.some((i) => /^(closing|end)-/.test(i))
      if (!isClosing) {
        report('warn', 'deck', 'closing_missing', `末页 ${lastRef} 不是收尾页（pageType final 或 closing-* 元素）——deck 不得以内容页戛然结尾（planning.md §6）`)
      }
    }
  }
}

let nErr = 0
let nWarn = 0
if (!SUBSET) {
  // deck 载荷体积闸（STORE zip 不压缩，上传大小=文件总和，服务端 nginx ≈1MB 硬顶，留 50KB 余量）
  {
    let payload = statSync(join(dir, 'presentation.pptd')).size
    const addDir = (sub) => {
      const abs = join(dir, sub)
      if (!existsSync(abs)) return
      for (const name of readdirSync(abs)) {
        const p = join(abs, name)
        if (statSync(p).isDirectory()) addDir(join(sub, name))
        else payload += statSync(p).size
      }
    }
    addDir('pages')
    addDir('media')
    if (payload > 950 * 1024) {
      report('error', 'deck', 'deck_payload_over_1mb', `deck 载荷（pptd+pages+media）${(payload / 1024).toFixed(0)}KB > 950KB——STORE zip 不压缩、服务端 ≈1MB 硬顶：先跑 node scripts/optimize-media.mjs <deckDir> 再导`)
    }
  }
}

for (const i of issues) {
  if (i.sev === 'error') nErr++
  else nWarn++
  console.log(`${i.sev === 'error' ? 'ERROR' : 'warn '}  ${i.page}  [${i.check}] ${i.msg}`)
}
if (SUBSET) {
  console.log(`\n${CHECK_FILES.length}/${pageFiles.length} pages checked (--pages ${PAGES_SPEC}): ${nErr} error(s), ${nWarn} warning(s)`)
  console.log('  ℹ deck 级三项（dash_density / not_but_parallel / bg_color_limit）子集模式跳过，交付前跑一次全量复核')
} else {
  console.log(`\n${pageFiles.length} pages checked: ${nErr} error(s), ${nWarn} warning(s)`)
}
process.exit(nErr > 0 && !args.includes('--warn-only') ? 1 : 0)
