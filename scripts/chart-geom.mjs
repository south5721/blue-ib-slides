// chart-geom.mjs — 纵向柱状图 plot 几何纯计算模型（零依赖、零截图）
// 模型来源：2026-09-10 41 例单因子校准探针（实验室 calib* 件，不随包），残差 ≤±0.7px
//   L = 0.03w + 左轴标签列   R = 0.04w + 右轴标签列   T = 0.0975h
//   B = (0.03h+0.84) + [legend=bottom ? 0.152h−0.88 : 0] + [x 标签 ? fs+8 : 0]
//   轴标签列 = 12 + 6.3×最长刻度字符数（fs14）
//   slot 均铺 plot：cx_i = plotX + (i+0.5)×slotW；barW = barWidth×slotW
// 适用：竖图 bar（单系列/稀疏对/堆积/柱线组合），min/max 必须显式给（自适应 mapping 引擎内部，不承诺）
// PowerPoint 交付件由 polish-pptx 注入 manualLayout 锁同一组 insets → 双渲染器几何一致
const L0 = 0.03, R0 = 0.04, TFRAC = 0.0975
const B0A = 0.03, B0B = 0.84, LEGA = 0.152, LEGB = -0.88

// numberFormat 子集：'0' / '0.0' / '0%' / '#,##0'（charts.md 通用纪律 7）
export function fmtValue(v, fmt = '#,##0') {
  if (v == null || Number.isNaN(Number(v))) return ''
  const n = Number(v)
  switch (fmt) {
    case '0': return String(Math.round(n))
    case '0.0': return n.toFixed(1)
    case '0%': return `${Math.round(n * 100)}%`
    case '#,##0': {
      const r = Math.round(n)
      const neg = r < 0 ? '-' : ''
      return neg + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    default: return String(Math.round(n))
  }
}

// 轴标签列宽（字符数 → px；fs14 校准，其他字号按 fs/14 线性外推——未校准区，文档化容差）
export function axisLabelCol(nchars, fs = 14) {
  return (12 + 6.3 * nchars) * (fs / 14)
}

// 从 chart 元素提取几何因子
export function chartFactors(chartEl) {
  const yAxes = Array.isArray(chartEl.yAxis) ? chartEl.yAxis : [chartEl.yAxis ?? {}]
  const y0 = yAxes[0] ?? {}
  const y1 = yAxes[1] ?? null
  const x = chartEl.xAxis ?? {}
  const legend = chartEl.legend
  const legendBottom = !!(legend && legend !== false && legend.show !== false && (legend.position ?? 'bottom') === 'bottom')
  const legendOther = !!(legend && legend !== false && legend.show !== false && (legend.position ?? 'bottom') !== 'bottom')
  const xFs = x.label === false || x.label == null ? (x.label === false ? 0 : 14) : (x.label.fontSize ?? 14)
  const leftLabels = y0.label !== false && y0.label != null
  const rightLabels = !!(y1 && y1.label !== false && y1.label != null)
  return {
    min: y0.min, max: y0.max,
    yFmt: (typeof y0.label === 'object' && y0.label?.numberFormat) || '#,##0',
    y1Fmt: (y1 && typeof y1.label === 'object' && y1.label?.numberFormat) || '#,##0',
    y1Max: y1?.max, y1Min: y1?.min,
    xFs, legendBottom, legendOther, leftLabels, rightLabels,
    barWidth: chartEl.barWidth ?? 0.55,
  }
}

// plot 区几何（page 坐标）：显式 min/max 是硬前提（qa cagr_axis_explicit 同责）
export function plotGeom(chartEl) {
  const [x, y, w, h] = chartEl.bounds
  const f = chartFactors(chartEl)
  if (f.min == null || f.max == null) {
    throw new Error(`chart ${chartEl.elementId} 缺显式 yAxis min/max——CAGR 线/柱顶标定位必须显式给（自适应 mapping 不定，R6 同规）`)
  }
  if (f.legendOther) throw new Error(`chart ${chartEl.elementId} legend 非 bottom——几何模型只覆盖 legend:false|bottom`)
  const lCol = f.leftLabels ? axisLabelCol(fmtValue(f.max, f.yFmt).length) : 0
  const rCol = f.rightLabels ? axisLabelCol(Math.max(fmtValue(f.y1Max ?? 0, f.y1Fmt).length, fmtValue(f.y1Min ?? 0, f.y1Fmt).length)) : 0
  const L = L0 * w + lCol
  const R = R0 * w + rCol
  const T = TFRAC * h
  const B = (B0A * h + B0B) + (f.legendBottom ? LEGA * h + LEGB : 0) + (f.xFs ? f.xFs + 8 : 0)
  const plotX = x + L, plotY = y + T
  const plotW = w - L - R, plotH = h - T - B
  const baseline = plotY + plotH
  return { plotX, plotY, plotW, plotH, baseline, L, R, T, B, min: f.min, max: f.max, barWidth: f.barWidth, legendBottom: f.legendBottom }
}

// 每柱几何：values = 各类目堆积和（不含 _base）
export function barGeom(chartEl, values) {
  const g = plotGeom(chartEl)
  const n = values.length
  const slotW = g.plotW / n
  const barW = g.barWidth * slotW
  const span = g.max - g.min
  if (!(span > 0)) throw new Error(`chart ${chartEl.elementId} yAxis span ≤0`)
  return values.map((v, i) => {
    const cx = g.plotX + (i + 0.5) * slotW
    return {
      i, cx, x0: cx - barW / 2, x1: cx + barW / 2, slotW, barW,
      top: g.baseline - ((v - g.min) / span) * g.plotH,
      bottom: g.baseline,
    }
  })
}
