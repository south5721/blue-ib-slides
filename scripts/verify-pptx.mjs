#!/usr/bin/env node
/**
 * verify-pptx — PPTX 导出件机检（K 体系：替代导出件截图复核的脚本闸）。
 *
 * 用法: node verify-pptx.mjs <file.pptx> [pptdDir]
 *   pptdDir 可选：给的话做「源 ↔ 导出件」对齐断言（页数/chart 数/系列数/隐藏轴/双行类目）。
 * 退出码: 有 FAIL → 1；全 pass → 0
 *
 * 断言（对应 skill 的导出件验证门，2026-09-08 五路回归手工断言的固化）:
 *   V1  slide 尺寸 18288000×10287000 EMU（20in×11.25in，1440×810 @ 72dpi）
 *   V2  页数 == PPTD pages 数（需 pptdDir）
 *   V3  chart 部件数 == PPTD chart 元素数（需 pptdDir；codec 静默丢图检测）
 *   V4  系列存活：Σc:ser == ΣPPTD series（需 pptdDir）；无 0 系列 chart（show:false 吞系列检测）
 *   V5  轴删除形：catAx/valAx 不得 delete="1"；PPTD label:false 轴须有 tickLblPos="none"（保活隐藏）
 *   V6  网格线中和：所有 majorGridlines 块含 alpha val="0"（polish-pptx 已跑的证据）
 *   V7  doughnut 反相：doughnutChart 的 dLbls 内含逐点 c:dLbl 且标签色为 FFFFFF/051C2C
 *   V8  瀑布痕迹：barChart 不得含 c:dPt（原生 waterfall 类型导出痕迹；doughnut 的 dPt 合法）
 *   V9  双行类目真换行：PPTD 含 \n 类目时 XML strLit 必须有真换行符（组合图/瀑布标签通道）
 *   V10 _base 隐形：名为 _base 的系列 spPr 填充必须为 FFFFFF
 *   V12 OOXML schema：<c:ser> 里 c:dPt 必须先于 c:dLbls（CT_*Ser 是 sequence）；
 *       <c:dLbl> 不得同时带 c:delete 与格式子元素（CT_DLbl 在 idx 之后是 choice）。
 *       违反即 PowerPoint 开档弹「内容有问题」，且点「修复」直接关文档——2026-09-08 实锤
 *   V13 ST_TextFontSize 范围：chart 部件 sz 必须在 [100, 400000]（越界同样弹「修复」——2026-09-10 实锤）
 *   V14 东亚字体：zh deck 的 slides/charts 不允许非 Kai 的 <a:ea typeface>（codec textStyle 双值丢 ea，
 *       polish-pptx ea-font patch 兜底——2026-09-12 用户实机案）
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import yaml from './js-yaml.mjs'

const pptx = process.argv[2]
const pptdDir = process.argv[3] ? resolve(process.argv[3]) : null
if (!pptx || !pptx.endsWith('.pptx')) {
  console.error('usage: node verify-pptx.mjs <file.pptx> [pptdDir]')
  process.exit(2)
}
if (pptdDir && !existsSync(join(pptdDir, 'presentation.pptd'))) {
  console.error(`pptdDir ${pptdDir} 无 presentation.pptd`)
  process.exit(2)
}

const results = []
function check(id, ok, msg) {
  results.push({ id, ok, msg })
}

// ——— PPTD 侧收集（可选）———
let pptd = null
if (pptdDir) {
  const pageFiles = readdirSync(join(pptdDir, 'pages')).filter((f) => f.endsWith('.page'))
  const charts = []
  let hiddenAxisCount = 0
  let hasMultilineCat = false
  let footballCharts = 0
  for (const pf of pageFiles) {
    const doc = yaml.load(readFileSync(join(pptdDir, 'pages', pf), 'utf8'))
    for (const el of doc?.elements ?? []) {
      if (el?.elementType !== 'chart') continue
      const series = Array.isArray(el.series) ? el.series : []
      charts.push({ page: pf, series, el })
      if (series.some((s) => s?.name === '_fairband')) footballCharts++
      for (const ax of ['xAxis', 'yAxis']) {
        const a = el[ax]
        if (a && a.label === false) hiddenAxisCount++
      }
      const xCol = series.find((s) => s?.encode?.x)?.encode?.x ?? el.data?.cols?.[0]
      const xi = (el.data?.cols ?? []).indexOf(xCol)
      if (xi >= 0 && Array.isArray(el.data?.rows)) {
        if (el.data.rows.some((r) => String(Array.isArray(r) ? r[xi] : '').includes('\n'))) hasMultilineCat = true
      }
    }
  }
  pptd = { pageCount: pageFiles.length, charts, hiddenAxisCount, hasMultilineCat, footballCharts }
}

const dir = mkdtempSync(join(tmpdir(), 'verify-pptx-'))
try {
  execFileSync('unzip', ['-q', resolve(pptx), '-d', dir])

  // V1 画布
  const presXml = readFileSync(join(dir, 'ppt', 'presentation.xml'), 'utf8')
  const sz = presXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/)
  check('V1', !!sz && sz[1] === '18288000' && sz[2] === '10287000',
    sz ? `slide 尺寸 ${sz[1]}×${sz[2]} EMU${sz[1] === '18288000' && sz[2] === '10287000' ? '' : '（期望 18288000×10287000）'}` : 'sldSz 未找到')

  // V2 页数
  const slideCount = readdirSync(join(dir, 'ppt', 'slides')).filter((f) => /^slide\d+\.xml$/.test(f)).length
  if (pptd) check('V2', slideCount === pptd.pageCount, `页数 ${slideCount} ${slideCount === pptd.pageCount ? '==' : '≠'} PPTD ${pptd.pageCount}`)

  // chart 部件
  const chartsDir = join(dir, 'ppt', 'charts')
  const chartFiles = existsSync(chartsDir) ? readdirSync(chartsDir).filter((f) => f.endsWith('.xml')) : []
  if (pptd) check('V3', chartFiles.length === pptd.charts.length, `chart 部件 ${chartFiles.length} ${chartFiles.length === pptd.charts.length ? '==' : '≠'} PPTD chart ${pptd.charts.length}`)

  // 逐 chart 断言
  let totalSer = 0
  let zeroSerCharts = []
  let deletedAxes = 0
  let tickLblNone = 0
  let badGridlines = 0
  let doughnutBad = 0
  let barDPt = 0
  let baseNotWhite = 0
  let xmlHasNewlineCat = false
  let serOrderBad = 0
  let dlblChoiceBad = 0
  for (const f of chartFiles) {
    const xml = readFileSync(join(chartsDir, f), 'utf8')
    // V12 OOXML 合法性：CT_*Ser 是 sequence（dPt 必须先于 dLbls）；CT_DLbl 在 idx 之后是
    // choice（delete 与格式组互斥）。任一违反 → PowerPoint 开档弹「内容有问题」，且点「修复」
    // 直接关文档修不好。Rust 渲染器与 LibreOffice 都容忍，只有真机 PowerPoint 暴露。
    for (const s of xml.match(/<c:ser>[\s\S]*?<\/c:ser>/g) ?? []) {
      const dl = s.indexOf('<c:dLbls')
      const dp = s.indexOf('<c:dPt>')
      if (dl >= 0 && dp >= 0 && dp > dl) serOrderBad++
      for (const d of s.match(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g) ?? []) {
        if (/<c:delete val="/.test(d) && /<c:(?:layout|tx|numFmt|spPr|txPr|dLblPos|show\w+|separator)[\s/>]/.test(d)) dlblChoiceBad++
      }
    }
    const serCount = (xml.match(/<c:ser>/g) || []).length
    totalSer += serCount
    if (serCount === 0) zeroSerCharts.push(f)
    deletedAxes += (xml.match(/<c:delete val="1"\/>/g) || []).length
    tickLblNone += (xml.match(/<c:tickLblPos val="none"\/>/g) || []).length
    const gridBlocks = xml.match(/<c:majorGridlines>[\s\S]*?<\/c:majorGridlines>/g) ?? []
    for (const g of gridBlocks) if (!g.includes('alpha val="0"')) badGridlines++
    if (xml.includes('<c:doughnutChart>')) {
      const dlbls = xml.match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0] ?? ''
      // 标签全隐藏（show* 全 0）时无标签可反相，polish 本就跳过——豁免，不计缺陷（2026-09-13 一次密度回归的误伤案）
      const labelsShown = /show(?:Val|Percent|CatName) val="1"/.test(dlbls)
      const dlblsWithColor = (dlbls.match(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g) ?? []).filter((d) => /srgbClr val="(FFFFFF|051C2C)"/.test(d)).length
      const dptCount = (xml.match(/<c:dPt>/g) || []).length
      if (labelsShown && dptCount > 0 && dlblsWithColor < dptCount) doughnutBad++
    }
    if (xml.includes('<c:barChart>') && xml.includes('<c:dPt>')) barDPt++
    if (/<c:tx>\s*<c:strRef>[\s\S]*?_base/.test(xml) || xml.includes('>_base</c:v>')) {
      // _base 系列：隐形垫高必须为 FFFFFF 或 noFill（football 转换会把 chart 内 FFFFFF 统一改 noFill 以透出 fairband 叠层）
      const serBlocks = xml.match(/<c:ser>[\s\S]*?<\/c:ser>/g) ?? []
      for (const s of serBlocks) {
        if (s.includes('>_base</c:v>') && !/srgbClr val="FFFFFF"/.test(s) && !/<c:spPr><a:noFill\/><\/c:spPr>/.test(s.replace(/\s+/g, ''))) {
          baseNotWhite++
        }
      }
    }
    if (/<c:v>[^<]*(\n|&#10;)/.test((xml.match(/<c:strLit>[\s\S]*?<\/c:strLit>/g) ?? []).join(''))) xmlHasNewlineCat = true
  }

  // V4 系列存活（football chart 经 polish 转贯穿版 −2 系列：_fairband/_entrymark 移入 slide 叠层）
  if (pptd) {
    const pptdSer = pptd.charts.reduce((n, c) => n + c.series.length, 0)
    const expectSer = pptdSer - 2 * pptd.footballCharts
    check('V4', totalSer === expectSer && zeroSerCharts.length === 0,
      `系列总数 ${totalSer} ${totalSer === expectSer ? '==' : '≠'} 期望 ${expectSer}（PPTD ${pptdSer} − football×${pptd.footballCharts}×2）${zeroSerCharts.length ? `；0 系列 chart: ${zeroSerCharts.join(',')}` : ''}`)
  } else {
    check('V4', zeroSerCharts.length === 0, zeroSerCharts.length ? `0 系列 chart: ${zeroSerCharts.join(',')}` : `全部 ${chartFiles.length} chart 系列存活`)
  }

  // V5 轴删除形
  {
    const ok = deletedAxes === 0 && (!pptd || tickLblNone >= pptd.hiddenAxisCount)
    check('V5', ok, `delete="1" 轴 ${deletedAxes} 个（须为 0）；tickLblPos=none ${tickLblNone} 个${pptd ? `（PPTD 隐藏轴 ${pptd.hiddenAxisCount}）` : ''}`)
  }

  // V6 网格线
  check('V6', badGridlines === 0, badGridlines === 0 ? '全部 majorGridlines 已 alpha=0 中和' : `${badGridlines} 个 majorGridlines 未中和——跑 polish-pptx.mjs`)

  // V7 doughnut
  check('V7', doughnutBad === 0, doughnutBad === 0 ? 'doughnut 标签反相注入完整' : `${doughnutBad} 个 doughnut 标签反相缺失——跑 polish-pptx.mjs`)

  // V8 瀑布痕迹
  check('V8', barDPt === 0, barDPt === 0 ? 'barChart 无 c:dPt（无原生 waterfall 痕迹）' : `${barDPt} 个 barChart 含 c:dPt——原生 waterfall 痕迹，改手工堆积 proxy`)

  // V9 双行类目
  if (pptd?.hasMultilineCat) {
    check('V9', xmlHasNewlineCat, xmlHasNewlineCat ? '双行类目标签在 XML 为真换行' : 'PPTD 有 \\n 类目但 XML strLit 无换行——双行标签丢失')
  }

  // V10 _base 隐形
  check('V10', baseNotWhite === 0, baseNotWhite === 0 ? '_base 系列填充均为 FFFFFF/noFill（隐形）' : `${baseNotWhite} 个 _base 系列填充非 FFFFFF——瀑布垫高会露馅`)

  // V11 football 贯穿转换（polish 后：_fairband/_entrymark 应离开 chart 进入 slide 叠层 rect）
  if (pptd && pptd.footballCharts > 0) {
    let overlaySlides = 0
    let residualBands = 0
    const slidesDir2 = join(dir, 'ppt', 'slides')
    for (const sf of readdirSync(slidesDir2).filter((f) => /^slide\d+\.xml$/.test(f))) {
      const s = readFileSync(join(slidesDir2, sf), 'utf8')
      if (s.includes('fairband-overlay') && s.includes('entry-line-overlay')) overlaySlides++
    }
    for (const f of chartFiles) {
      const x = readFileSync(join(chartsDir, f), 'utf8')
      if (x.includes('>_fairband</c:v>') || x.includes('>_entrymark</c:v>')) residualBands++
    }
    const ok = overlaySlides === pptd.footballCharts && residualBands === 0
    check('V11', ok, `football 贯穿版：叠层 slide ${overlaySlides}/${pptd.footballCharts}，chart 内残留 _fairband/_entrymark ${residualBands}（须为 0——跑 polish-pptx）`)

    // V11b 两端数值标签不得越出 chart bounds（2026-09-13 用户案）：
    // 最右一条上界 == axis max 时右端标签会跑到 chart 外、压进右栏（截图上是被裁掉半个数字）。
    // 估宽口径与 polish-pptx ⑤b 一致：12px Arial 数字 ≈ 6.8pt/字符。
    // ⚠️ 量的必须是**标签所属那张 chart 自己的帧**：原来取 slide 第一个 graphicFrame，
    // 与 polish 当时同款错口径——同页多帧时两边一起锚错，越界永远量不出来（假 pass）。
    // polish 起把 chart 部件名写进形状名（ff-lbl-<id>:<stem>），这里按 stem → rels → r:id 回查帧。
    const EMU_PT = 12700
    let lblChecked = 0
    let lblLegacy = 0
    const lblBad = []
    const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const sf of readdirSync(slidesDir2).filter((f) => /^slide\d+\.xml$/.test(f))) {
      const s = readFileSync(join(slidesDir2, sf), 'utf8')
      if (!s.includes('ff-lbl-')) continue
      const relsPath2 = join(slidesDir2, '_rels', sf + '.rels')
      const rels2 = existsSync(relsPath2) ? readFileSync(relsPath2, 'utf8') : ''
      const boundsCache = new Map()
      const boundsOf = (stem) => {
        if (boundsCache.has(stem)) return boundsCache.get(stem)
        let frameXml = null
        if (stem) {
          const rel = [...rels2.matchAll(/<Relationship\b[^>]*\/>/g)].map((x) => x[0])
            .find((x) => new RegExp(`Target="\\.\\./charts/${reEsc(stem)}\\.xml"`).test(x))
          const rid = rel && (rel.match(/\bId="(rId\d+)"/) ?? [])[1]
          if (rid) {
            frameXml = (s.match(new RegExp(
              `<p:graphicFrame>(?:(?!</p:graphicFrame>)[\\s\\S])*?r:id="${rid}"(?:(?!</p:graphicFrame>)[\\s\\S])*?</p:graphicFrame>`)) ?? [])[0]
          }
        }
        // 定不到帧就返回 null，**绝不退回「第一帧」** —— 那正是当年的假 pass 来源
        const g = frameXml && frameXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)
        const b = g ? { fx: +g[1], fw: +g[3] } : null
        boundsCache.set(stem, b)
        return b
      }
      for (const m of s.matchAll(/name="ff-lbl-\d+(?::([\w.-]+))?"\/>[\s\S]*?<a:off x="(-?\d+)" y="-?\d+"\/>[\s\S]*?<a:t>([^<]*)<\/a:t>/g)) {
        const b = boundsOf(m[1])
        if (!b) { lblLegacy++; continue }   // 名字里没有 chart 归属＝旧版 polish 的件，量不了
        lblChecked++
        const x = +m[2]
        const w = Math.max(1, m[3].length) * 6.8 * EMU_PT
        if (x < b.fx - EMU_PT || x + w > b.fx + b.fw + EMU_PT) lblBad.push(`${sf}:${m[3]}`)
      }
    }
    if (lblChecked > 0 || lblLegacy > 0) {
      // 「量不了」不许当「量过了」：旧件重跑一次 polish-pptx 即可归位，代价极低
      const msg = lblBad.length
        ? `${lblBad.length}/${lblChecked} 个两端数值标签越出 chart bounds（${lblBad.slice(0, 4).join(', ')}）——右端值会被裁/压进邻栏，跑 polish-pptx 重转`
        : lblLegacy
          ? `${lblLegacy} 个两端数值标签的形状名无 chart 归属（旧版 polish 产出），无法确定该量哪一帧——重跑 polish-pptx 后再验`
          : `football 两端数值标签 ${lblChecked} 个全部落在 chart bounds 内`
      check('V11b', lblBad.length === 0 && lblLegacy === 0, msg)
    }

    // V11c gutter 标签块级左对齐（2026-09-13 用户定）：football 转换件（catAx 已注入段落 algn="l" 的横图）
    // 必须同时有 lblAlgn="l"——否则标签块在槽位内居中、整列左缘参差。跑 polish-pptx ④c 补齐。
    let axBad = 0
    for (const f of chartFiles) {
      const x = readFileSync(join(chartsDir, f), 'utf8')
      if (!x.includes('<c:barDir val="bar"/>')) continue
      const catAx = (x.match(/<c:catAx>[\s\S]*?<\/c:catAx>/) ?? [''])[0]
      if (catAx.includes('algn="l"') && !catAx.includes('<c:lblAlgn val="l"/>')) axBad++
    }
    check('V11c', axBad === 0, axBad === 0 ? 'football gutter 标签块级左对齐（lblAlgn=l）' : `${axBad} 个 football chart catAx 缺 lblAlgn="l"——跑 polish-pptx`)
  }

  // V12 OOXML chart schema 合法性（PowerPoint 拒开的直接原因，务必 0）
  check('V12', serOrderBad === 0 && dlblChoiceBad === 0,
    serOrderBad === 0 && dlblChoiceBad === 0
      ? '<c:ser> 子元素顺序合规、<c:dLbl> 无 delete/格式并存'
      : `${serOrderBad} 个 <c:ser> 把 <c:dPt> 排在 <c:dLbls> 之后、${dlblChoiceBad} 个 <c:dLbl> 同时带 <c:delete> 与格式——PowerPoint 会判文件损坏，跑 polish-pptx`)

  // V13 ST_TextFontSize 范围：chart 部件 sz 必须在 [100, 400000]（百份点；越界 PowerPoint 开档弹「修复」
  // ——2026-09-10 用户实测案：R8 幻影压缩误写 sz=1 即中招。polish 现 clamp 到 100=1pt）
  {
    let szBad = 0
    for (const f of chartFiles) {
      const xml = readFileSync(join(chartsDir, f), 'utf8')
      for (const m of xml.matchAll(/sz="(\d+)"/g)) {
        const v = Number(m[1])
        if (v < 100 || v > 400000) szBad++
      }
    }
    check('V13', szBad === 0, szBad === 0 ? 'chart 部件 sz 均在 ST_TextFontSize 合法范围' : `${szBad} 处 sz 越界（<100 或 >400000）——PowerPoint 开档弹「修复」，跑 polish-pptx 前排查字号来源`)
  }

  // V14 东亚字体：zh deck（pptdDir presentation.pptd 含 ", 程荣光刻楷"（或旧件 ", Kai"），或 slides 已含 ea=程荣光刻楷/Kai）的 slides/charts
  // 不允许非 程荣光刻楷 的 <a:ea typeface>——codec 对 textStyle 双值 fontFamily 把 latin 抄进 ea 位（2026-09-12 用户案：
  // 分隔页 $dividerH 导出 ea=Georgia），polish-pptx 的 ea-font patch 兜底，本闸验收。
  // （2026-09-13 canonical 改字体本名 程荣光刻楷：旧件 ea="Kai" 也算违例，由 polish 归一。）
  {
    // EA 字体从 deck theme 提取（2026-10-19 blue-ib 改造，同 polish-pptx：原硬编码 楷体 只对
    // institutional 成立；本体系 ea=微软雅黑。zh 判定 = theme ea 值含 CJK，或旧件 Kai 族声明/残留）
    let EA = '楷体'
    let zh = false
    const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s)
    if (pptdDir) {
      try {
        const pptd = readFileSync(join(pptdDir, 'presentation.pptd'), 'utf8')
        const m = pptd.match(/fontFamily:\s*\{[^}]*?ea:\s*([^,}\s]+)/) || pptd.match(/fontFamily:\s*[^,{\n]+,\s*([A-Za-z\u4e00-\u9fff][^,}\n]*)/)
        if (m && hasCJK(m[1])) { EA = m[1].trim(); zh = true }
        else zh = /, (Kai|程荣光刻楷|楷体)/.test(pptd)
      } catch { /* 忽略 */ }
    }
    const slidesDir3 = join(dir, 'ppt', 'slides')
    const slideFiles3 = readdirSync(slidesDir3).filter((f) => /^slide\d+\.xml$/.test(f))
    if (!zh) {
      for (const sf of slideFiles3) {
        const em = readFileSync(join(slidesDir3, sf), 'utf8').match(/ea typeface="([^"]+)"/)
        if (em && (hasCJK(em[1]) || /Kai|楷/i.test(em[1]))) { EA = /Kai|楷/i.test(em[1]) ? '楷体' : em[1]; zh = true; break }
      }
    }
    if (zh) {
      let eaBad = 0
      const targets = slideFiles3.map((f) => join(slidesDir3, f))
      if (existsSync(chartsDir)) targets.push(...readdirSync(chartsDir).filter((f) => f.endsWith('.xml')).map((f) => join(chartsDir, f)))
      for (const p of targets) {
        const xml = readFileSync(p, 'utf8')
        for (const m of xml.matchAll(/<a:ea typeface="([^"]+)"/g)) if (m[1] !== EA) eaBad++
      }
      check('V14', eaBad === 0, eaBad === 0 ? `zh deck ea 字体均为 ${EA}（东亚字体补丁生效）` : `${eaBad} 处 <a:ea> 非 ${EA}——codec textStyle 双值丢 ea，跑 polish-pptx（ea-font patch）`)
      // V16 图例字体：zh deck 的 chart legend txPr 必须带 <a:ea typeface="楷体"（或旧件 Kai）——
      // legend 只有 <a:latin> 没有 <a:ea> 时 CJK 落默认 CJK 字体（2026-10-09 CATL deck 图例 Arial-only 实案），
      // polish-pptx ea-font patch 的补 ea 缺位段兜底，本闸验收。
      if (existsSync(chartsDir)) {
        let legendBad = 0
        for (const cf of readdirSync(chartsDir).filter((f) => f.endsWith('.xml'))) {
          const xml = readFileSync(join(chartsDir, cf), 'utf8')
          for (const m of xml.matchAll(/<c:legend>[\s\S]*?<c:txPr>([\s\S]*?)<\/c:txPr>[\s\S]*?<\/c:legend>/g)) {
            const txPr = m[1]
            const hasEa = new RegExp(`<a:ea typeface="${EA}"`).test(txPr)
            if (!hasEa) legendBad++
          }
        }
        check('V16', legendBad === 0, legendBad === 0 ? `zh deck 图例 txPr 均带 ${EA} ea（图例字体补丁生效）` : `${legendBad} 个 chart legend txPr 缺 ${EA} ea（CJK 落默认字体）——跑 polish-pptx（ea-font patch 补 ea 缺位段）`)
      }
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

let nFail = 0
for (const r of results) {
  if (!r.ok) nFail++
  console.log(`${r.ok ? 'pass' : 'FAIL'}  [${r.id}] ${r.msg}`)
}
console.log(`\n${results.length} checks: ${results.length - nFail} passed, ${nFail} failed`)
process.exit(nFail > 0 ? 1 : 0)
