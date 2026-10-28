#!/usr/bin/env node
/**
 * polish-pptx — PPTX 导出后处理（K 体系强制）：把所有 chart 部件里的
 * <c:majorGridlines> 改写为「显式全透明白线」形态。
 *
 * 为什么不是物理删除（2026-09-08 三渲染器定案）：
 * - codec 写 `<a:noFill/>`：Rust 渲染器尊重（不画），PowerPoint 无视照样画 → 用户初案
 * - 物理删除元素：PowerPoint 干净，但 Rust 渲染器对缺省网格线回退成「画默认线」→ QA 环幻影
 * - 本形态 `<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/>`：
 *   ① Rust 渲染器干净（实测）；② PowerPoint 尊重 alpha=0（DrawingML 标准透明）；
 *   ③ 就算某渲染器无视 alpha，白线画在白页上依然不可见——三重兜底。
 *
 * 用法: node polish-pptx.mjs <file.pptx>          # 就地抛光
 * 退出码: 0 成功（打印改写计数）；1 失败
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const pptx = process.argv[2]
if (!pptx || !pptx.endsWith('.pptx')) {
  console.error('usage: node polish-pptx.mjs <file.pptx>')
  process.exit(1)
}
const abs = resolve(pptx)
const dir = mkdtempSync(join(tmpdir(), 'polish-pptx-'))
const ALPHA_GRID = '<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill></a:ln></c:spPr></c:majorGridlines>'
try {
  execFileSync('unzip', ['-q', abs, '-d', dir])
  const chartsDir = join(dir, 'ppt', 'charts')
  let rewritten = 0
  let files = 0
  for (const f of (existsSync(chartsDir) ? readdirSync(chartsDir) : [])) {
    if (!f.endsWith('.xml')) continue
    files++
    const p = join(chartsDir, f)
    const before = readFileSync(p, 'utf8')
    const n = (before.match(/<c:majorGridlines>/g) || []).length
    if (n > 0) {
      writeFileSync(p, before.replace(/<c:majorGridlines>.*?<\/c:majorGridlines>/gs, ALPHA_GRID))
      rewritten += n
    }
  }
  if (rewritten > 0) {
    const out = abs + '.polished'
    rmSync(out, { force: true })
    execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
    execFileSync('mv', [out, abs])
  }
  console.log(`polish-pptx: neutralized ${rewritten} majorGridlines block(s) in ${files} chart part(s) -> ${abs}`)

  // ——— doughnut 标签反相：codec 不写标签色 → PowerPoint 全黑标签压深色扇区。
  // 按扇区亮度逐点注入 c:dLbl 颜色（lum<0.45 → 白，否则 ink #051C2C）。2026-09-08 用户定。
  // ——— doughnut 标签字体：codec 对 dataLabels.fontFamily 只写缺省 Arial；
  // 段内标签字体 = 洞心数字字体 = Georgia（2026-09-10 用户定），随反相注入一并归位。
  let contrastFixed = 0
  const lum = (hex) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
  }
  for (const f of (existsSync(chartsDir) ? readdirSync(chartsDir) : [])) {
    if (!f.endsWith('.xml')) continue
    const p = join(chartsDir, f)
    const xml = readFileSync(p, 'utf8')
    if (!xml.includes('<c:doughnutChart>') || !xml.includes('<c:dPt>')) continue
    const dlblsMatch = xml.match(/<c:dLbls>([\s\S]*?)<\/c:dLbls>/)
    if (!dlblsMatch || !/show(Val|Percent|CatName) val="1"/.test(dlblsMatch[1])) continue
    // 已注入过就跳过：本段不幂等，重跑会把同一批 idx 再叠一遍（实测 3 个 dLbl → 6 个）
    if (dlblsMatch[1].includes('<c:dLbl>')) continue
    const showFlags = ['LegendKey', 'Val', 'CatName', 'SerName', 'Percent', 'BubbleSize']
      .map((k) => {
        const on = dlblsMatch[1].includes('<c:show' + k + ' val="1"') ? 1 : 0
        return '<c:show' + k + ' val="' + on + '"/>'
      })
      .join('')
    const pts = [...xml.matchAll(/<c:dPt><c:idx val="(\d+)"\/><c:spPr><a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"/g)]
    if (pts.length === 0) continue
    // per-dLbl 必须显式带 sz——缺省时 PowerPoint 不继承 dLbls 级 sz，回退自动缩放小字（2026-09-10 回归件标签变小案：用户手动重输 14pt 才恢复）
    const baseSz = (dlblsMatch[1].match(/sz="(\d+)"/) || [null, '1400'])[1]
    const overrides = pts
      .map(([, idx, fill]) => {
        const c = lum(fill) < 0.45 ? 'FFFFFF' : '051C2C'
        // 不写 <c:delete val="0"/>：CT_DLbl 在 idx 之后是 choice——delete 与格式组互斥，
        // 两者并存 PowerPoint 判文件损坏。val="0"（不删除）本就是默认值，省掉语义不变。
        return `<c:dLbl><c:idx val="${idx}"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${baseSz}" noProof="1"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:latin typeface="Georgia"/></a:defRPr></a:pPr></a:p></c:txPr>${showFlags}</c:dLbl>`
      })
      .join('')
    // dLbls 级基础字体同步 Georgia（codec 缺省 Arial 只出现在该块 txPr，替换不出块）
    const newXml = xml.replace(dlblsMatch[0], `<c:dLbls>${overrides}${dlblsMatch[1].replace(/typeface="Arial"/g, 'typeface="Georgia"')}</c:dLbls>`)
    if (newXml !== xml) {
      writeFileSync(p, newXml)
      contrastFixed += pts.length
    }
  }
  if (contrastFixed > 0) {
    const out = abs + '.polished'
    rmSync(out, { force: true })
    execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
    execFileSync('mv', [out, abs])
  }
  if (contrastFixed > 0) console.log(`polish-pptx: doughnut label contrast injected for ${contrastFixed} slice(s)`)

  // ——— CAGR 叠层 chart：manualLayout 锁死 plot 区（R8，2026-09-10 定案）
  // PPTD 侧叠层（cagr-* line/bubble/toplabel）由 chart-geom 纯模型落位（Rust auto-layout 校准残差 ≤±2px）；
  // PowerPoint 的 auto-layout 随字体度量漂移——注入与模型同值的 manualLayout 后，交付件几何 = 模型几何，叠层零漂移。
  // 触发：slide 内含任何 cagr- 叠层元素（line-F-T 或 toplabel-i——含 --labels-only 无趋势线形态，2026-09-11 扩：
  // 手摆柱顶标在 PowerPoint 撞签/贴边案 ×2，柱顶标一律走生成器后由此锁兜底）。
  // 映射链：slide 里 name="cagr-<sfx>-line-F-T" 的 sp → 同 slide name="chart-<sfx>" 的 graphicFrame → r:id → chartN.xml
  // 几何因子从 chart XML 现取（legendPos/catAx-valAx tickLblPos+sz/numFmt/max-min/gapWidth），insets 与 chart-geom 同公式。
  {
    const { plotGeom } = await import('./chart-geom.mjs')
    const cagrSlidesDir = join(dir, 'ppt', 'slides')
    let cagrLocked = 0
    for (const sf of readdirSync(cagrSlidesDir).filter((f) => /^slide\d+\.xml$/.test(f))) {
      const sp = join(cagrSlidesDir, sf)
      const sXml = readFileSync(sp, 'utf8')
      const sfxs = new Set([...sXml.matchAll(/name="cagr-([\w-]+)-(?:line-\d+-\d+|toplabel-\d+)"/g)].map((m) => m[1]))
      if (!sfxs.size) continue
      const relsPath = join(cagrSlidesDir, '_rels', sf + '.rels')
      const rels = existsSync(relsPath) ? readFileSync(relsPath, 'utf8') : ''
      for (const sfx of sfxs) {
        // graphicFrame  named chart-<sfx>（或裸 <sfx>）→ chart 部件（回火式匹配限单帧内，防跨帧吞并）
        const fm = sXml.match(new RegExp(`<p:graphicFrame>(?:(?!</p:graphicFrame>)[\\s\\S])*?name="(?:chart-)?${sfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"(?:(?!</p:graphicFrame>)[\\s\\S])*?</p:graphicFrame>`))
        if (!fm) { console.error(`polish-pptx: ${sf} 找不到 chart-${sfx} 的 graphicFrame，跳过 manualLayout`); continue }
        const rid = (fm[0].match(/r:id="(rId\d+)"/) ?? [])[1]
        const target = rid && (rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*/>`)) ?? [''])[0].match(/Target="\.\.\/(charts\/chart[\w.]+\.xml)"/)?.[1]
        if (!target) { console.error(`polish-pptx: ${sf} chart-${sfx} r:id 解析失败，跳过`); continue }
        const cp = join(chartsDir, target.replace('charts/', ''))
        if (!existsSync(cp)) continue
        let cXml = readFileSync(cp, 'utf8')
        // —— 因子提取 ——
        const valAxBlocks = [...cXml.matchAll(/<c:valAx>[\s\S]*?<\/c:valAx>/g)].map((m) => m[0])
        const catAxBlock = (cXml.match(/<c:catAx>[\s\S]*?<\/c:catAx>/) ?? [''])[0]
        const axVisible = (ax) => !/tickLblPos val="none"/.test(ax)
        const axSz = (ax) => Number((ax.match(/sz="(\d+)"/) ?? [0, 1400])[1]) / 100
        const axFmt = (ax) => (ax.match(/<c:numFmt formatCode="([^"]+)"/) ?? [0, '#,##0'])[1]
        const axVal = (ax, tag) => { const m = ax.match(new RegExp(`<c:${tag} val="([\\d.-]+)"/>`)); return m ? Number(m[1]) : null }
        const legendB = /<c:legendPos val="b"\/>/.test(cXml)
        const [fx, fy, fw, fh] = [...fm[0].matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)][0].slice(1).map((v) => Number(v) / 12700)
        const pseudo = {
          elementId: `chart-${sfx}`,
          bounds: [fx, fy, fw, fh],
          xAxis: { label: axVisible(catAxBlock) ? { fontSize: axSz(catAxBlock) } : false },
          yAxis: valAxBlocks.length > 1
            ? valAxBlocks.slice(0, 2).map((ax, i) => ({ min: axVal(ax, 'min'), max: axVal(ax, 'max'), label: axVisible(ax) ? { numberFormat: axFmt(ax) } : false }))
            : { min: axVal(valAxBlocks[0] ?? '', 'min'), max: axVal(valAxBlocks[0] ?? '', 'max'), label: axVisible(valAxBlocks[0] ?? '') ? { numberFormat: axFmt(valAxBlocks[0] ?? '') } : false },
          legend: legendB ? { show: true, position: 'bottom' } : false,
        }
        let g
        try { g = plotGeom(pseudo) } catch (e) { console.error(`polish-pptx: ${target} 几何计算失败（${e.message}），跳过`); continue }
        const ml = `<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${(g.L / fw).toFixed(5)}"/><c:y val="${(g.T / fh).toFixed(5)}"/><c:w val="${(g.plotW / fw).toFixed(5)}"/><c:h val="${(g.plotH / fh).toFixed(5)}"/></c:manualLayout></c:layout>`
        const pa = cXml.match(/<c:plotArea>[\s\S]*?(<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)/)
        if (!pa) { console.error(`polish-pptx: ${target} plotArea layout 未找到，跳过`); continue }
        cXml = cXml.replace(pa[1], ml)
        // 幻影轴签压缩（Rust 重渲器对 tickLblPos=none 的轴仍画刻度且在 manualLayout 框内占位——artifact①姊妹现象：
        // sz→1pt（ST_TextFontSize 下限 100，⚠️ 不可再低：sz<100 越界 PowerPoint 开档即弹「修复」——2026-09-10 用户实测案）
        // 后左侧占位从 ~26px 收敛到 ~8px 残差（渲染器差异⑥登记）；PowerPoint 轴隐藏不受影响）
        cXml = cXml.replace(/<c:(?:val|cat)Ax>[\s\S]*?<\/c:(?:val|cat)Ax>/g, (ax) =>
          ax.includes('tickLblPos val="none"') ? ax.replace(/sz="\d+"/g, 'sz="100"') : ax)
        writeFileSync(cp, cXml)
        cagrLocked++
      }
    }
    if (cagrLocked > 0) {
      const out = abs + '.polished'
      rmSync(out, { force: true })
      execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
      execFileSync('mv', [out, abs])
      console.log(`polish-pptx: manualLayout locked for ${cagrLocked} cagr-overlay chart(s)`)
    }
  }

  // ——— Football field 贯穿转换（2026-09-08 晚定案，K 原版形态复刻）：
  // PPTD 侧 v3 配方用「_fairband/_entrymark 类目行」近似；导出后本段把 chart 转成贯穿版——
  // ① manualLayout 锁死 plot 区（PowerPoint 与 Rust 渲染器都尊重，叠层不再漂移）
  // ② 删 _fairband/_entrymark 系列与对应类目行
  // ③ plotArea/chartSpace 白底 → noFill（fairband tint 从 chart 下层透出）
  // ④ slide 注入两个 rect：fairband tint 带（chart 下）+ entry navy 竖线（chart 上）
  const EMU = 12700
  // ML_W 0.70 → 0.66（2026-09-13 用户案：最右一条区间上界 == axis max 时，
  // 「区间值标在 band 两端外侧」与「axis max = 最大区间上界」两条规则互斥——右端值无处可放，
  // 原 2% 右边距（590px frame 上 ≈12px）容不下 3 位数 12px 标签，标签越出 chart bounds 压进右栏。
  // 留 6% 右 gutter（≈35px）作为最大端数值的落位空间；⑤b 仍带越界 clamp 兜底。
  const ML_X = 0.28, ML_W = 0.66
  const ML = '<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="' + ML_X + '"/><c:y val="0.02"/><c:w val="' + ML_W + '"/><c:h val="0.88"/></c:manualLayout></c:layout>'
  // chart → slide 映射（读 slide rels）——必须连 r:id 一起留住：
  // 叠层几何要锚到 football chart **自己那一帧**，slide 上有第二个 graphicFrame
  // （另一张图 / 一张表）时「取第一帧」会锚错，交付件静默变形（2026-09-16 审查）。
  const slidesDir = join(dir, 'ppt', 'slides')
  const chartToSlide = new Map()
  for (const sf of readdirSync(slidesDir).filter((f) => /^slide\d+\.xml$/.test(f))) {
    const relsPath = join(slidesDir, '_rels', sf + '.rels')
    if (!existsSync(relsPath)) continue
    const rels = readFileSync(relsPath, 'utf8')
    for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const target = m[0].match(/Target="\.\.\/charts\/(chart[\w.]+\.xml)"/)
      const rid = m[0].match(/\bId="(rId\d+)"/)
      if (target && rid) chartToSlide.set(target[1], { slideFile: sf, rid: rid[1] })
    }
  }
  let footballConverted = 0
  for (const [chartFile, { slideFile, rid }] of chartToSlide) {
    const cp = join(chartsDir, chartFile)
    let xml = readFileSync(cp, 'utf8')
    if (!xml.includes('>_fairband</c:v>')) continue
    // ① valAx min/max（codec 写 max 在前 min 在后——必须独立匹配，不可假定顺序）
    const vaM = xml.match(/<c:valAx>[\s\S]*?<\/c:valAx>/)
    const minM = vaM && vaM[0].match(/<c:min val="([\d.]+)"\/>/)
    const maxM = vaM && vaM[0].match(/<c:max val="([\d.]+)"\/>/)
    if (!minM || !maxM) { console.error(`polish-pptx: ${chartFile} valAx min/max 未找到，跳过 football 转换`); continue }
    const [axisMin, axisMax] = [parseFloat(minM[1]), parseFloat(maxM[1])]
    // ② _fairband / _entrymark 数值（与 _base ser 联合：base=下界/entry−半宽，标记列=宽）
    const serBlocks = xml.match(/<c:ser>[\s\S]*?<\/c:ser>/g) ?? []
    const ptsOf = (s) => new Map([...s.matchAll(/<c:pt idx="(\d+)"><c:v>([\d.]+)<\/c:v><\/c:pt>/g)].map((m) => [parseInt(m[1], 10), parseFloat(m[2])]))
    let basePts = new Map(), bandPts = new Map(), markPts = new Map()
    const visiblePtsList = []
    for (const s of serBlocks) {
      if (s.includes('>_base</c:v>')) basePts = ptsOf(s)
      else if (s.includes('>_fairband</c:v>')) bandPts = ptsOf(s)
      else if (s.includes('>_entrymark</c:v>')) markPts = ptsOf(s)
      else visiblePtsList.push(ptsOf(s))
    }
    let bandLo = null, bandHi = null, entry = null, bandIdx = null, markIdx = null
    for (const [i, v] of bandPts) {
      if (basePts.has(i)) { bandLo = basePts.get(i); bandHi = bandLo + v; bandIdx = i; break }
    }
    for (const [i, v] of markPts) {
      if (basePts.has(i)) { entry = basePts.get(i) + v / 2; markIdx = i; break }
    }
    if (bandLo == null || entry == null) { console.error(`polish-pptx: ${chartFile} fairband/entry 数值解析失败，跳过`); continue }
    // ②b 各行区间收集（两端数值注入用；图 1 正确画法：区间值标在 band 两端外侧）
    const rangeRows = []
    for (const vp of visiblePtsList) {
      for (const [i, v] of vp) {
        if (basePts.has(i) && !bandPts.has(i) && !markPts.has(i)) {
          const lo = basePts.get(i)
          rangeRows.push({ idx: i, lo, hi: lo + v })
        }
      }
    }
    rangeRows.sort((a, b) => a.idx - b.idx)
    // ②c gutter 类目文案 + 字形（⑤c 用 slide 文本框重画）——2026-09-13 用户案「Y 轴的字能左对齐吗」。
    // ④b/④c 两条对齐注入**都不生效**：同一文件把 algn 与 lblAlgn 各改成 l/ctr/r 分别渲染，
    // 两组都逐像素完全相同，渲染器这两个属性都不读。唯一能控制对齐的办法是自己画文本框。
    const catBlock = xml.match(/<c:cat>[\s\S]*?<\/c:cat>/)?.[0] ?? ''
    const catText = new Map([...catBlock.matchAll(/<c:pt idx="(\d+)"><c:v>([\s\S]*?)<\/c:v><\/c:pt>/g)]
      .map((m) => [parseInt(m[1], 10), m[2]]))
    // 字形照抄 catAx 自己的 defRPr：字号/颜色/latin/ea 全跟着 deck 走，中文 deck 的楷体不会掉
    const catRPr = xml.match(/<c:catAx>[\s\S]*?<a:defRPr([^>]*)>([\s\S]*?)<\/a:defRPr>/)
    // ③ 删两个系列 + 对应类目行（strLit pt + 各 ser numLit pt + ptCount）
    for (const name of ['_fairband', '_entrymark']) {
      const sm = xml.match(new RegExp('<c:ser>(?:(?!</c:ser>)[\\s\\S])*?>' + name + '</c:v>[\\s\\S]*?</c:ser>'))
      if (sm) xml = xml.replace(sm[0], '')
    }
    // 类目行按 **系列 idx** 删（2026-09-13 用户案）——原实现按类目文本 'Fair value band'/'Entry ' 匹配，
    // 等于把「类目名必须写英文」钉成隐性契约：中文 deck 写中文行名则 polish 删不掉，交付件多两条假行。
    // _fairband/_entrymark 系列本身已给出行号，无需靠文案定位；类目文案自此可自由本地化。
    const dropIdx = [bandIdx, markIdx].filter((i) => i != null).sort((a, b) => b - a)
    for (const idx of dropIdx) {
      xml = xml.replace(new RegExp('<c:pt idx="' + idx + '"><c:v>[^<]*</c:v></c:pt>', 'g'), '')
      xml = xml.replace(/<c:pt idx="(\d+)">/g, (mm, i2) => parseInt(i2) > idx ? `<c:pt idx="${parseInt(i2) - 1}">` : mm)
    }
    xml = xml.replace(/<c:ptCount val="\d+"\/>/g, (mm) => {
      const n = parseInt(mm.match(/\d+/)[0])
      return `<c:ptCount val="${n - dropIdx.length}"/>`
    })
    // ④ manualLayout + 白底 noFill
    xml = xml.replace('<c:layout/>', ML)
    xml = xml.replace(/<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"\/><\/a:solidFill><\/c:spPr>/g, '<c:spPr><a:noFill/></c:spPr>')
    // ④b gutter 类目标签左对齐（2026-09-10 用户定：方法名左对齐才是 K 形态；codec 缺省 pPr 无 algn → 居中）
    xml = xml.replace(/(<c:catAx>[\s\S]*?<c:txPr><a:bodyPr\/><a:lstStyle\/><a:p><a:pPr)>/, '$1 algn="l">')
    // ④c 标签块级左对齐（2026-09-13 用户定）：段落 algn="l" 只管内联——lblAlgn=ctr 时各标签块在槽位内居中、整列左缘参差；
    // 块级要 lblAlgn="l" 才整列齐左。catAx 无 lblAlgn 时在 lblOffset 前补注（CT_CatAx sequence：lblAlgn 在 lblOffset 前）
    xml = xml.replace(/(<c:catAx>[\s\S]*?)<c:lblAlgn val="ctr"\/>/, '$1<c:lblAlgn val="l"/>')
    if (!/<c:catAx>[\s\S]*?<c:lblAlgn/.test(xml)) xml = xml.replace(/(<c:catAx>[\s\S]*?)<c:lblOffset/, '$1<c:lblAlgn val="l"/><c:lblOffset')
    // ④d 轴内类目标签抹掉，改由 ⑤c 的 slide 文本框画（否则两份重影）。
    // **不能用 tickLblPos="none"**——charts.md 已知差异①：隐藏轴的刻度标签照画（实测确认）。
    // 用 alpha=0 把字刷成全透明（与网格线中和同一招，实测有效）；轴本体保活（delete=0，禁 show:false 吞系列）。
    const caSeg = xml.match(/<c:catAx>[\s\S]*?<\/c:catAx>/)?.[0]
    if (caSeg) {
      xml = xml.replace(caSeg, caSeg.replace(
        /(<c:txPr>[\s\S]*?<a:defRPr[^>]*>[\s\S]*?)<a:solidFill><a:srgbClr val="[0-9A-Fa-f]{6}"\/><\/a:solidFill>/,
        '$1<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill>'))
    }
    writeFileSync(cp, xml)
    // ⑤ slide 注入 rect
    const sp = join(slidesDir, slideFile)
    let sXml = readFileSync(sp, 'utf8')
    // 按 r:id 定位本 chart 自己那一帧（回火式匹配限单帧内，防跨帧吞并——与 CAGR 段同款写法）。
    // 绝不能退回「slide 第一个 graphicFrame」：同页有第二张图/一张表时会锚错帧，
    // 叠层整体偏移且不报错，verify 也用同一套错口径量所以照样全绿。
    const frameRe = new RegExp(
      `<p:graphicFrame>(?:(?!</p:graphicFrame>)[\\s\\S])*?r:id="${rid}"(?:(?!</p:graphicFrame>)[\\s\\S])*?</p:graphicFrame>`)
    const frameXml = sXml.match(frameRe)?.[0]
    const fm = frameXml && frameXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)
    if (!fm) { console.error(`polish-pptx: ${slideFile} 未定位到 ${chartFile}（${rid}）的 graphicFrame 几何，跳过 football 转换`); continue }
    const [fx, fy, fw, fh] = [+fm[1], +fm[2], +fm[3], +fm[4]]
    const px = fx + ML_X * fw, py = fy + 0.02 * fh, pw = ML_W * fw, ph = 0.88 * fh
    const bx1 = Math.round(px + ((bandLo - axisMin) / (axisMax - axisMin)) * pw)
    const bw = Math.round(((bandHi - bandLo) / (axisMax - axisMin)) * pw)
    const ex = Math.round(px + ((entry - axisMin) / (axisMax - axisMin)) * pw) - 9525
    const rect = (id, name, x, w, color, alpha = null) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${Math.round(py)}"/><a:ext cx="${w}" cy="${Math.round(ph)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}">${alpha ? `<a:alpha val="${alpha}"/>` : ''}</a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
    // 2026-09-10 桌面 PowerPoint 实测（回归件足球场案）：graphicFrame 在部分 PowerPoint 里按不透明渲染，
    // chart 下注入的 fairband 会被整幅盖住（chartSpace noFill 只有 Rust 渲染器稳定 honor）。
    // 改「chart 上 + 半透明」叠层：任何渲染器都画得出。alpha 取 30%——50% 会把 navy 柱洗灰（用户观感案），
    // 30% 下柱体基本保实心、带形仍可读；entry 线 1.5px（19050EMU）防缩略图不可见。
    // 形状名带上 chart 部件名：verify-pptx 据此把标签量回**它自己那一帧**；
    // cNvPr id 按 chart 序号错开，同页两张 football 不会撞 id（撞了 PowerPoint 报修复）。
    const stem = chartFile.replace(/\.xml$/, '')
    const idBase = 9600 + Number(stem.match(/(\d+)/)?.[1] ?? 0) * 100
    const fairbandRect = rect(idBase + 1, `fairband-overlay:${stem}`, bx1, bw, 'E3F2FD', 30000)
    const entryRect = rect(idBase + 2, `entry-line-overlay:${stem}`, ex, 19050, '051C2C')
    // ⑤b 两端数值注入（图 1 正确画法：区间值标在 band 两端外侧，12px navy）
    const nRows = rangeRows.length
    const lbl = (id, x, y, w, txt, algn) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="ff-lbl-${id}:${stem}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="180000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="en-US" sz="1200" dirty="0"><a:solidFill><a:srgbClr val="051C2C"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${txt}</a:t></a:r></a:p></p:txBody></p:sp>`
    let lbls = ''
    // 越界 clamp（2026-09-13 用户案）：标签 textbox 一律不许越出 chart bounds——
    // 右端越界会压进右栏展区（截图上表现为数值被裁成半个字），左端越界会撞 gutter 方法名。
    // 12px Arial 数字宽 ≈ 0.56em ≈ 6.8pt/字符（含千分位与小数点按同宽估）。
    const frameL = fx, frameR = fx + fw
    const estW = (txt) => Math.max(1, String(txt).length) * 6.8 * EMU
    rangeRows.forEach((r, k) => {
      // 行号按删行后的类目序重映射——band/entry 行不在末尾时原 idx 会错位
      const rank = r.idx - dropIdx.filter((i) => i < r.idx).length
      const yc = py + (1 - (rank + 0.5) / nRows) * ph  // rank0 在底部
      const lx = px + ((r.lo - axisMin) / (axisMax - axisMin)) * pw
      const rx = px + ((r.hi - axisMin) / (axisMax - axisMin)) * pw
      const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
      const [loTxt, hiTxt] = [fmt(r.lo), fmt(r.hi)]
      const loX = Math.max(frameL, lx - 4 * EMU - 40 * EMU)                        // 左端外侧，撞框则贴框
      const hiX = Math.min(rx + 4 * EMU, frameR - estW(hiTxt))                     // 右端外侧，越框则回拉到框内
      lbls += lbl(idBase + 10 + k * 2, loX, yc - 8 * EMU, 40 * EMU, loTxt, 'r')
      lbls += lbl(idBase + 11 + k * 2, hiX, yc - 8 * EMU, 40 * EMU, hiTxt, 'l')
    })
    // ⑤c gutter 方法名文本框（左对齐）——坐标沿用 manualLayout 模型，与 ⑤b 两端数值同一套映射。
    // ⚠️ 不要按本机 rs 渲染器实测值标定：该渲染器的类目带是 y≈0.0995/h≈0.806（两份 deck 交叉确认），
    // 与 manualLayout 声明的 0.02/0.88 差 12–32px，但**用户侧渲染器与模型一致**（其截图里两端数值正对条心），
    // 按本机实测标定反而会把交付件标歪。本机预览里这些标签会偏高，属已登记的渲染器差异，勿当缺陷返工。
    const GUTTER_ALGN = 'l'   // 整列齐左（2026-09-10 用户定的 K 形态）；要齐右改 'r'，其余不动
    const rpA = catRPr ? catRPr[1] : ' sz="1400"'
    const rpK = catRPr ? catRPr[2] : '<a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Arial"/>'
    const gutW = Math.max(40 * EMU, px - fx - 6 * EMU)
    const LINE_H = 17 * EMU
    let gutters = ''
    rangeRows.forEach((r, k) => {
      const raw = catText.get(r.idx)
      if (raw == null) return
      const lines = String(raw).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      if (!lines.length) return
      const rank = r.idx - dropIdx.filter((i) => i < r.idx).length
      const yc = py + (1 - (rank + 0.5) / nRows) * ph
      const boxH = lines.length * LINE_H
      const paras = lines.map((t) =>
        `<a:p><a:pPr algn="${GUTTER_ALGN}"/><a:r><a:rPr lang="zh-CN"${rpA}>${rpK}</a:rPr><a:t>${t}</a:t></a:r></a:p>`).join('')
      const gid = idBase + 60 + k
      gutters += `<p:sp><p:nvSpPr><p:cNvPr id="${gid}" name="ff-cat-${gid}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
        `<p:spPr><a:xfrm><a:off x="${Math.round(fx)}" y="${Math.round(yc - boxH / 2)}"/><a:ext cx="${Math.round(gutW)}" cy="${Math.round(boxH)}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
        `<p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" rIns="0" tIns="0" bIns="0"/><a:lstStyle/>${paras}</p:txBody></p:sp>`
    })
    // 注入点是**整帧之后**（frameXml），不是 fm[0]——fm[0] 现在只是帧内的 off/ext 片段，
    // 拿它当锚会把 sp 塞进 graphicFrame 的 xfrm 里，直接产出非法 XML。
    sXml = sXml.replace(frameXml, frameXml + fairbandRect + entryRect + lbls + gutters)
    writeFileSync(sp, sXml)
    footballConverted++
  }
  if (footballConverted > 0) {
    const out = abs + '.polished'
    rmSync(out, { force: true })
    execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
    execFileSync('mv', [out, abs])
    console.log(`polish-pptx: football field converted to span-band form in ${footballConverted} chart(s)`)
  }

  // ——— <c:ser> 子元素顺序归位（2026-09-08 实锤：PowerPoint 拒开的真凶）。
  // codec 把逐段配色 <c:dPt> 写在 <c:dLbls> 之后，而 CT_PieSer 是 sequence：
  //   idx, order, tx?, spPr?, explosion?, dPt*, dLbls?, cat?, val?, extLst?
  // dPt 必须先于 dLbls。违反后 PowerPoint 开档即弹「发现内容有问题…尝试修复」，
  // 而点「修复」会直接关掉文档、根本修不好 → 用户每次打开都再弹一遍。
  // 只有真机 PowerPoint 暴露：Rust 渲染器与 LibreOffice 都容忍，QA 环看不出来。
  // 双向隔离实证：只删该图表→正常；只留该图表→仍弹；只调这个顺序→正常且图表完整渲染。
  // 放在最后一道：本文件前面几段还会往 chart XML 里塞元素，这里统一归位兜底。
  let reordered = 0
  for (const f of (existsSync(chartsDir) ? readdirSync(chartsDir) : [])) {
    if (!f.endsWith('.xml')) continue
    const p = join(chartsDir, f)
    const xml = readFileSync(p, 'utf8')
    const newXml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
      const dLblsAt = ser.indexOf('<c:dLbls')
      if (dLblsAt < 0) return ser
      const dPts = ser.match(/<c:dPt>[\s\S]*?<\/c:dPt>/g)
      if (!dPts || ser.indexOf(dPts[0]) < dLblsAt) return ser
      const stripped = ser.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '')
      const at = stripped.indexOf('<c:dLbls')
      reordered++
      return stripped.slice(0, at) + dPts.join('') + stripped.slice(at)
    })
    if (newXml !== xml) writeFileSync(p, newXml)
  }
  if (reordered > 0) {
    const out = abs + '.polished'
    rmSync(out, { force: true })
    execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
    execFileSync('mv', [out, abs])
    console.log(`polish-pptx: moved <c:dPt> before <c:dLbls> in ${reordered} series (OOXML CT_*Ser order)`)
  }

  // ——— 东亚字体补丁（2026-09-12 用户定；2026-09-13 canonical 改字体本名 程荣光刻楷）：
  // codec 解析 textStyle 双值 fontFamily「latin, ea」时把 latin 值抄进 ea 位（内联双值正常）
  // ——zh deck 的 ea 必须一律 程荣光刻楷，latin 按角色保留。
  // zh 判定：① 可选第三参 deckDir 的 presentation.pptd 含 ", 程荣光刻楷"（或旧件 ", Kai"）；
  // ② slides 里已存在 ea typeface="程荣光刻楷"（或 "Kai"）。英文 deck 不含 → 天然跳过，不误伤。
  // 放在最后一道：前面各段 chart 注入也在这兜底。旧 canonical "Kai" 的存量 deck 一并归一到 程荣光刻楷。
  let eaFixed = 0
  {
    // EA 字体从 deck theme 提取（2026-10-19 blue-ib 改造：原硬编码 楷体 只对 institutional 成立——
    // 本体系 ea=微软雅黑、楷体被明令禁止；zh 判定 = theme ea 值含 CJK，或旧件 Kai 族声明/残留）
    let EA = '楷体'
    const deckDir = process.argv[3]
    let zh = false
    const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s)
    if (deckDir) {
      try {
        const pptd = readFileSync(join(deckDir, 'presentation.pptd'), 'utf8')
        const m = pptd.match(/fontFamily:\s*\{[^}]*?ea:\s*([^,}\s]+)/) || pptd.match(/fontFamily:\s*[^,{\n]+,\s*([A-Za-z\u4e00-\u9fff][^,}\n]*)/)
        if (m && hasCJK(m[1])) { EA = m[1].trim(); zh = true }
        else zh = /, (Kai|程荣光刻楷|楷体)/.test(pptd)
      } catch { /* 非 deck 目录 */ }
    }
    const slidesDir2 = join(dir, 'ppt', 'slides')
    const slideFiles2 = readdirSync(slidesDir2).filter((f) => /^slide\d+\.xml$/.test(f))
    if (!zh) {
      for (const sf of slideFiles2) {
        const em = readFileSync(join(slidesDir2, sf), 'utf8').match(/ea typeface="([^"]+)"/)
        if (em && (hasCJK(em[1]) || /Kai|楷/i.test(em[1]))) { EA = /Kai|楷/i.test(em[1]) ? '楷体' : em[1]; zh = true; break }
      }
    }
    if (zh) {
      const targets = slideFiles2.map((f) => join(slidesDir2, f))
      if (existsSync(chartsDir)) targets.push(...readdirSync(chartsDir).filter((f) => f.endsWith('.xml')).map((f) => join(chartsDir, f)))
      for (const p of targets) {
        const before = readFileSync(p, 'utf8')
        const after = before
          .replace(/<a:ea typeface="([^"]+)"\/>/g, (m, tf) => (tf === EA ? m : (eaFixed++, `<a:ea typeface="${EA}"/>`)))
          .replace(/<a:ea typeface="([^"]+)"><\/a:ea>/g, (m, tf) => (tf === EA ? m : (eaFixed++, `<a:ea typeface="${EA}"/>`)))
          // 补 ea 缺位：defRPr/rPr 只有 <a:latin> 没有 <a:ea> 时插入（2026-10-09 图例 Arial-only 案——legend txPr 只有 latin 无 ea，CJK 落默认字体）
          .replace(/(<a:latin typeface="([^"]+)"\/>)(?!<a:ea)/g, (m, latinTag) => (eaFixed++, `${latinTag}<a:ea typeface="${EA}"/>`))
        if (after !== before) writeFileSync(p, after)
      }
      if (eaFixed > 0) {
        const out = abs + '.polished'
        rmSync(out, { force: true })
        execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
        execFileSync('mv', [out, abs])
      }
    }
    console.log(`polish-pptx: ea-font patch ${zh ? `${eaFixed} run(s) -> ${EA}` : 'skipped (non-zh deck)'}`)

    // ——— 行高绝对化 spcPct → spcPts（2026-09-23 hai 24p 跨平台溢案定案）：
    // 渲染行高 = spcPct × 字体自然行高，而字体自然行高随平台漂移（楷体 Mac 1.21em / Windows·替代 ~1.33em+）——
    // 同一 spcPct 在不同平台得到不同绝对行高，是跨平台溢出的底层机制。改写为 spcPts（绝对磅值）
    // = 字号 × spcPct 比例 × naturalRef（Mac 实测：楷体 1.21 / Georgia 1.16 / Arial 1.15），
    // 让所有平台渲染出与 Mac 一致的绝对行高。已验证 Mac 渲染逐行一致（hai 24p 全 deck 对比）。
    // 默认开启，--no-spcpts 关闭。
    if (!process.argv.includes('--no-spcpts')) {
      const NATURAL = { cjk: 1.21, georgia: 1.16, arial: 1.15 }
      const slidesDir3 = join(dir, 'ppt', 'slides')
      let nSpc = 0
      for (const sf of readdirSync(slidesDir3).filter((f) => /^slide\d+\.xml$/.test(f))) {
        const p = join(slidesDir3, sf)
        const src = readFileSync(p, 'utf8')
        const after = src.replace(/<a:lnSpc><a:spcPct val="(\d+)"\/><\/a:lnSpc>/g, (m, pct, offset) => {
          // 用回调 offset 定位（不能 indexOf(m)——相同 pct 的条目会全取到第一条的 sz/字体）
          const tail = src.slice(offset)
          const sz = +(tail.match(/sz="(\d+)"/)?.[1] ?? 1400) / 100
          const ea = tail.match(/<a:ea typeface="([^"]*)"/)?.[1] ?? ''
          const latin = tail.match(/<a:latin typeface="([^"]*)"/)?.[1] ?? ''
          const fonts = ea + ' ' + latin
          const natural = /楷体|程荣光刻楷|KaiTi|STKaiti/i.test(fonts) ? NATURAL.cjk : /georgia/i.test(fonts) ? NATURAL.georgia : NATURAL.arial
          const pts = Math.round(sz * (+pct / 100000) * natural * 100)
          nSpc++
          return `<a:lnSpc><a:spcPts val="${pts}"/></a:lnSpc>`
        })
        if (after !== src) writeFileSync(p, after)
      }
      if (nSpc > 0) {
        const out = abs + '.polished'
        rmSync(out, { force: true })
        execFileSync('zip', ['-q', '-r', out, '.'], { cwd: dir })
        execFileSync('mv', [out, abs])
      }
      console.log(`polish-pptx: lnSpc absolute ${nSpc > 0 ? `${nSpc} entries -> spcPts` : 'skipped (no spcPct)'}`)
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
