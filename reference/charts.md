> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# Charts — blue-ib 原生 chart 配方（R1–R5，已逐一实机验证）

## 🔖 取节索引（**勿整读本文**）

选哪个配方走 `reference/manifest.json` 的 `semantics`（唯一选件基准）；定好 ID 后只取那一节：

```bash
D=<skill根>/reference; R=R1      # R 换成你要的 ID
sed -n "/^## 通用纪律/,/^## R1\./p" $D/charts.md      # 恒取
sed -n "/^## ${R}\./,/^## R[0-9]\./p" $D/charts.md    # 目标配方（R5 用 /^## 渲染器/ 收尾）
sed -n "/^## 渲染器差异纪律/,\$p" $D/charts.md        # 恒取
```

⚠️ **`通用纪律` 与 `渲染器差异纪律` 对任何图型都成立，取任一 R 时必须一并取** —— 漏了会写出方言错误/dPt 丢色的图。

小节：`选型总图` · `通用纪律` · `R1` 实际vs估计柱 · `R2` 手工瀑布 proxy · `R3` 堆积柱 · `R4` 柱线双轴 · `R5` 饼环 · `渲染器差异纪律`

## 选型总图（信息关系 → 图型，33 型三档闸口）

> 词表移植自 ppt-master chart-vocabulary（6 类 33 型，见 THIRD_PARTY_NOTICES.md），按本体系能力分三档：
> **✅ 原生** = PPTD codec 直接可达（R1–R5 方言覆盖）；**🔧 proxy** = 形状/多系列拼装可达（R2 瀑布先例）；
> **⛔ 不支持** = 禁 shape 手绘数据图（铁律 8），改表格/拆页/换图型。选型先过本表，再进 R 配方。

**1. 时序变化**：折线 ✅（series type line）｜面积 ✅（line + areaStyle，染 $brand1 alpha 30%）｜堆积面积 ✅（多系列 stack + areaStyle）｜双轴双线 ✅（R4 同法，双双 line）｜K 线 ⛔（改「区间柱+收盘线」proxy 或表格）｜瀑布 🔧（**R2 手工 3-series 堆积 proxy，首选**；原生 waterfall 类型禁用）

**2. 类目比较与排名**：柱状 ✅（R1）｜条形 ✅（bar 横向，`hbar_no_line_series` 闸）｜分组柱 ✅（多系列无 stack）｜堆积柱 ✅（R3）｜蝴蝶图 🔧（左右两条形图镜像对置，共享类目轴居中）｜哑铃图 🔧（散点+连接线拼装，≤8 项；更多改表格）｜帕累托 🔧（R1 柱降序 + 累计占比线，R4 双轴法）

**3. 目标与进度**：子弹图 🔧（条形+目标刻度线 overlay）｜进度条 🔧（C05 格内嵌条形或单一 100% 堆积条）｜仪表盘 🔧（C17 gauge dial 构件；仅定性档位，真数值序列改柱图）

**4. 分布与多变量**：直方图 ✅（等距 bin 的柱图，barGap 0）｜箱线图 ⛔（改「均值柱+误差线表」）｜散点 ✅（series type scatter）｜气泡 ✅（scatter + symbolSize 函数）｜热力图 ⛔（改 T2a 表格+底色分级）｜雷达 ✅（radar 图型，≤6 轴；配色 brand1 vs chartNeutral）｜2×2 矩阵：定性定位走 **D03 象限矩阵**（diagrams.md），真数值走 scatter

**5. 部分-整体与层级**：饼 ✅（**一律转 doughnut**，R5）｜环 ✅（R5）｜子母饼/条 ⛔（改 R5 + 附表拆解）｜矩形树图 ⛔（改 R5 或分层条形）｜旭日图 ⛔（改 R5 嵌套说明或表格）

**6. 流程/排期/加权文本**：漏斗 = 结构关系走 **C09 构件**（非数据图）｜桑基图 ⛔（改 T2a 流向表）｜甘特图 🔧（T2a 表格内嵌色条，或 C04 时间轴变体）｜词云 ⛔（与版面气质冲突，改关键词 chip 行）

⛔ 档的共同出路：**改 T2a 表格承载数据、或换 ✅ 档最近图型**——永不 shape 手绘数据图。

> 全部图表用 PPTD **codec 方言**（ECharts 风格：`data:{cols,rows}` + `series[].type/encode`）。
> ⚠️ 不要用 agent tidy 方言（顶层 type/x/y/names/colors）——Rust CLI 会报 UnknownField 并**静默跳过图表**。
> 导出 pptx 后全部为原生可编辑 OOXML chart（c:barChart/c:lineChart/c:doughnutChart，字面量数据，双击可编辑）。
> 完整 schema 见本 skill 的 `reference/pptd-schema.md`（§10 chart 节）。

## 通用纪律

1. **图表标题永远用外部 text 元素**（$sectionLabel 或 16pt bold $itemBlue），不用 chart 内建 title；**图题左对齐图左缘（x = chart.x），禁居中于图上方**。图题与图之间不画横线。
2. **单位标注放图框内部左上角**（x 恒 45.2 与 chrome 左网格对齐，y=chart.y+4，$caption 12pt；qa `unit_label_align` 闸，左缘对图左缘）——前提：y 轴保活隐藏；y 轴刻度可见时单位标改放图题右侧或省略。图表下**不放独立说明行**（增速/口径注并进图例行或页内正文）。
3. 轴：x 轴 `gridLine: false` + `axisLine: {color: $navy, width: 1}`（1px navy 基线）；**隐藏轴一律用 `{label:false, axisLine:false, gridLine:false}` 保活隐藏，禁用 `show:false`**——`show:false` 导出为 `delete=1`，部分 PowerPoint 会把挂在该轴上的系列整组吞掉（`axis_show_false` 闸）。**任何轴都不画网格线**：每个轴显式 `gridLine: false`，且**导出后必须跑 `scripts/polish-pptx.mjs`** 把 majorGridlines 改写成显式全透明白线（alpha=0）——noFill 修饰被 PowerPoint 无视照画、物理删除会让 Rust 渲染器回退画默认线（`chart_gridline` 闸）。
4. **X 轴类目标签只留类目名，数值一律下架**：类目名可单行或双行名，任一行都不许含数值/金额/百分比。数值标签的合法位置——**单纯柱（非堆积）→ 柱内 ctr**（单系列 `stack: value` 强制稳定柱内）；**堆积/瀑布/组合图 → 柱顶外部文本框**（按轴 min/max 线性换算摆放，预留 ≥8px 净空；v1 无 cagr-line 生成器，手摆须可复算）。qa `xaxis_value_label` 闸机械拦截数值进类目。柱内 ctr 标签是「柱值在别处读不到」时才挂——值已在伴随表里重复时可不挂（`bar_label_redundant` warn）。
5. 图例：单系列/瀑布 → `legend: false`（图例行用外部 shape+text）；多系列 → `{show:true, position:bottom, fontSize:14, color:$inkSecondary}`。多系列图例色块与系列同色（原生图例自动满足，禁止手绘图例）。图例字体沿 theme 双值（latin Arial + ea 微软雅黑），导出后 polish-pptx 的 ea-font patch 验收。
6. **语义色（铁律 8，qa `chart_color_semantics` 闸）**：主系列/实际值 = **$brand1**；第二系列 = $brand2 或 $brand3；**估计/预测/强调 = $accent 橙**（系列名含 估计/预测/E 却填灰 → error）；别家/参考 = $chartNeutral 灰（主数据全灰 → error，应 $brand1）；负增量 = $negative 红；正向标注 = $positive 绿。
7. chart 元素 bounds 给足：绘图区典型高 322（225–360），宽随栏目配方；左缘恒对齐 x=45.2 网格（`chart_left_gutter` 闸）。
8. **图下/图旁文字直接给 takeaway，禁「读法 / 解读 / 说明」开场**（`explainer_preamble` 闸）：第一句就是结论（「一致预期按周期底部定价，差异全在单 Wh 净利」），图怎么读由图例和轴自己承担。
9. **展区下方的说明文字要有容器，且压到 2–3 行**：用 callout（$tintPanel 底 + 左脊 $brand1 3pt）或带 $rulePanel 边的小卡；装不下就拆页或删。
10. **系列名不许是纯数字**（`name: "2022"` 让 codec 导出时 DOM 崩溃——系列名必须含非数字字符，`2022年`/`FY2022`/`2022A` 均可；类目名纯数字不受影响；`series_name_numeric` 闸）。
11. numberFormat 子集：`0` / `0.0` / `0%` / `#,##0` / `0.0E+00`。不支持 `+` 前缀段——瀑布图的 +/− 靠配套假设表表达。
12. 缺值写 `null`（稀疏位）不是 0；0 值类目/段从图里删掉，只在与图配套的表里注明（`stacked_zero_value` warn）。

## R1. 实际 vs 估计柱状图 — 稀疏对堆积法

每年一根柱、按年份区间分色（actual 区间 $brand1、estimate 区间 $accent）：**两个稀疏 series 同堆一组**，非命中位写 `null`（不是 0）：

```yaml
  - elementId: lbl-chart-title
    elementType: text
    bounds: [45.2, 150, 600, 22]
    content:
      text: "<p>营业收入，2022–2027E（亿元）</p>"
      wrap: false
      align: [left, middle]
      style: $sectionLabel
      color: $itemBlue
  - elementId: lbl-unit
    elementType: text
    bounds: [45.2, 186, 110, 16]
    content:
      text: "<p>单位：亿元</p>"
      wrap: false
      align: [left, top]
      style: $caption
  - elementId: chart-rev
    elementType: chart
    bounds: [45.2, 182, 800, 400]
    data:
      cols: [year, actual, forecast]
      rows:
        - ["2022", 60, null]
        - ["2023", 130, null]
        - ["2024", 260, null]
        - ["2025", 430, null]
        - ["2026E", null, 620]
        - ["2027E", null, 810]
    xAxis: { gridLine: false, label: { fontSize: 14, color: $inkBody }, axisLine: { color: $navy, width: 1 } }
    yAxis: { label: false, axisLine: false, gridLine: false, min: 0 }
    legend: { show: true, position: bottom, fontSize: 14, color: $inkSecondary }
    barWidth: 0.55
    series:
      - type: bar
        encode: { x: year, y: actual }
        name: 实际
        stack: value
        fill: $brand1
        dataLabels: { show: true, numberFormat: "#,##0", color: $lt1, fontSize: 14 }
      - type: bar
        encode: { x: year, y: forecast }
        name: 估计
        stack: value
        fill: $accent
        dataLabels: { show: true, numberFormat: "#,##0", color: $inkTitle, fontSize: 14 }
```

- 标签只能 ctr（堆积图 OOXML 无 outEnd）；**$brand1 柱白字、$accent 橙柱 $inkTitle 深字**（`label_contrast` 感知亮度判定：橙属浅底）。
- 预测年份轴标签同色，靠 series 归属表达（E 后缀）。
- 增速/CAGR 注写在图题或图下外部 text（$caption），不与柱内标签重复同值信息。
- 导出为 `c:barChart grouping=stacked` 双 series，原生可编辑。
- 全页样例：`assets/examples/R1-bar-chart.page`。

## R2. 瀑布图 — 手工 3-series 堆积 proxy（首选）

⚠️ **不要用 PPTD 原生 `waterfall` 类型**：它导出 OOXML 时把端点/增减颜色写成逐点 `c:dPt` 覆盖，渲染链不识别 dPt——导出件整桥单色（`waterfall_no_native_type` error）。手工 proxy 用**系列级 fill**，全链路每个渲染器都认。

数据模型：`_base`（白底隐形）+ 锚柱 `合计`（$brand1）+ 正增量（$brand3）+ 负增量（$negative 红，拆独立 series）：

```yaml
  - elementId: chart-bridge
    elementType: chart
    bounds: [45.2, 182, 726, 435]
    data:
      cols: [stage, base, total, up, down]
      rows:
        # running: 215.9 | +96 → 311.9 | +72 → 383.9 | −28 → 355.9 | +46 → 401.9
        - ["2026A", 0, 215.9, null, null]
        - ["储能放量", 215.9, null, 96, null]
        - ["海外提价", 311.9, null, 72, null]
        - ["原料回落", 383.9, null, null, 28]     # 负增量：base=running−|v|
        - ["规模效应", 355.9, null, 46, null]
        - ["2027E", 0, 401.9, null, null]
    xAxis: { gridLine: false, label: { fontSize: 14, color: $inkBody }, axisLine: { color: $navy, width: 1 } }
    yAxis: { label: false, axisLine: false, gridLine: false, min: 0 }
    legend: false                            # 图例行用外部 shape+text（■ $brand1 合计 ■ $brand3 增量 ■ $negative 减量）
    barWidth: 0.6
    series:
      - { type: bar, encode: { x: stage, y: base }, name: _base, stack: value, fill: "#FFFFFF" }
      - type: bar
        encode: { x: stage, y: total }
        name: 合计
        stack: value
        fill: $brand1
        dataLabels: { show: true, numberFormat: "#,##0", fontSize: 14, color: $lt1 }
      - type: bar
        encode: { x: stage, y: up }
        name: 增量
        stack: value
        fill: $brand3
        dataLabels: { show: true, numberFormat: "#,##0", fontSize: 14, color: $lt1 }
      - type: bar
        encode: { x: stage, y: down }
        name: 减量
        stack: value
        fill: $negative
        dataLabels: { show: true, numberFormat: "#,##0", fontSize: 14, color: $lt1 }
```

变换算法（写数前手算或脚本化；`waterfall_closure` 闸闭合自检 `start + Σ增 − Σ|减| == total`）：
- start/total：`base=0`，柱高=绝对值
- 正增量：`base=running`，柱高=v，`running+=v`
- 负增量：`base=running−|v|`，柱高=|v|，`running+=v`（v 为负）；负增量必须拆红色系列（`waterfall_negative_color` error）

要点：
- `_base` 用 `fill:"#FFFFFF"`（schema 无 noFill，白页成立；深色背景页禁用瀑布图）
- `_base` 系列**不配 dataLabels**；可见系列标签 ctr 白字
- 类目标签只写类目名；单行 >12 字符触发渲染器跳号——类目名 ≤8 字符或双行名（`waterfall_cat_label_len` warn）
- **图宽预算**：类目槽 <~100px 即危险，6–7 类目图宽 ≥725px
- **numberFormat 按数据精度选**：增量含小数必须 `0.0`（`#,##0` 会把 2.6 舍成 3、0.4 舍成 0）
- **必须配对右侧假设表**（T2a 或文本表）：每个 delta 一行「驱动. 假设 — 值 — % build」，+/− 符号在表里表达
- 柱间 connector 虚线：v1 不画

## R3. 堆积柱（segment mix 时序）

3+ series 正常堆积（逐 series `stack: value`），标签段内 ctr：**深段（$brand1/$navy/$negative）白字、浅段（$tintPanelDeep/$chartNeutral）$inkTitle 深字**：

```yaml
  - elementId: chart-mix
    elementType: chart
    bounds: [45.2, 182, 726, 400]
    data:
      cols: [year, power, storage, other]
      rows:
        - ["2024", 168, 52, 40]
        - ["2025", 262, 118, 50]
        - ["2026E", 348, 216, 56]
        - ["2027E", 396, 358, 56]
    xAxis: { gridLine: false, label: { fontSize: 14, color: $inkBody }, axisLine: { color: $navy, width: 1 } }
    yAxis: { label: false, axisLine: false, gridLine: false, min: 0, max: 900 }
    legend: { show: true, position: bottom, fontSize: 14, color: $inkSecondary }
    barWidth: 0.55
    series:
      - type: bar
        encode: { x: year, y: power }
        name: 动力电池
        stack: value
        fill: $brand1
        dataLabels: { show: true, numberFormat: "#,##0", color: $lt1, fontSize: 14 }
      - type: bar
        encode: { x: year, y: storage }
        name: 储能系统
        stack: value
        fill: $accent
        dataLabels: { show: true, numberFormat: "#,##0", color: $inkTitle, fontSize: 14 }
      - type: bar
        encode: { x: year, y: other }
        name: 其他
        stack: value
        fill: $chartNeutral
        dataLabels: { show: true, numberFormat: "#,##0", color: $inkTitle, fontSize: 14 }
```

- **柱顶 total 标签（canonical）**：外部 text 逐柱一个（总和或头部份额 %），按轴 min/max 线性换算摆位（底边 = 柱顶−8px、水平居中柱心）；**yAxis max 必须显式给**（自适应时 mapping 不定）；柱顶标不得与段内 ctr 标签同值重复（堆顶只放段内没有的信息：总和或无标签的头部份额）。无柱顶标 → `stacked_toplabel_missing` warn。
- **y 轴处理**：有了柱顶 total + 段内 ctr 标签，y 轴信息冗余——保活隐藏，单位标照常放图内左上。
- 段数 ≤5；系列色序：主→次 = $brand1 → $accent（强调段）→ $brand3/$brand2 → $chartNeutral（「其他」恒灰）。
- 份额（100%）语义时类目值按占比填、numberFormat 用 `0`，柱顶标改写头部份额 %。

## R4. 柱线组合双轴图（柱=金额 + 线=比率）

柱（稀疏对：实际 $brand1 + 估计 $accent）+ 折线（右轴比率 $navy 实线）：

```yaml
  - elementId: chart-combo
    elementType: chart
    bounds: [45.2, 182, 726, 400]
    data:
      cols: [year, revA, revE, gm]
      rows:
        - ["2023", 130, null, 22.1]
        - ["2024", 260, null, 24.8]
        - ["2025", 430, null, 25.6]
        - ["2026E", null, 620, 26.4]
        - ["2027E", null, 810, 27.2]
    xAxis: { gridLine: false, label: { fontSize: 14, color: $inkBody }, axisLine: { color: $navy, width: 1 } }
    yAxis:
      - { min: 0, label: { numberFormat: "#,##0", fontSize: 14, color: $inkSecondary }, gridLine: false }
      - { min: 18, max: 30, label: { numberFormat: "0", fontSize: 14, color: $inkSecondary }, gridLine: false }
    legend: { show: true, position: bottom, fontSize: 14, color: $inkSecondary }
    barWidth: 0.55
    series:
      - { type: bar, encode: { x: year, y: revA }, name: 收入实际, stack: value, fill: $brand1 }
      - { type: bar, encode: { x: year, y: revE }, name: 收入估计, stack: value, fill: $accent }
      - { type: line, encode: { x: year, y: gm }, name: 毛利率%, yAxisIndex: 1, lineColor: $navy, width: 2 }
```

- 双轴规则：数值轴那一侧放**数组**（竖图 `yAxis: [{...},{...}]`），比率系列 `yAxisIndex: 1`；数组长度 ≥ max(index)+1。
- **组合图的柱子禁挂 ctr dataLabels**（PowerPoint 会吞掉——`combo_no_bar_ctr_labels` error）：柱值贴柱顶外部文本框（按轴 min/max 线性换算）或靠左轴刻度读数。
- 比率线用 $navy（机制色）；参考/指引线用 $chartNeutral dash（`lineStyle: dash, width: 2`），不出数据标签。
- ratio 轴 min/max 必须显式给（否则自适应压缩可见波动）。
- 折线缺值写 `null` 即断口（`nullHandling` 是 line/area **series 级**字段，写 chart 顶层报 UnknownField）。

## R5. 饼环（segment mix；≤6 段，饼图一律转 doughnut）

```yaml
  - elementId: chart-donut
    elementType: chart
    bounds: [45.2, 182, 480, 400]
    data:
      cols: [segment, share]
      rows:
        - ["动力电池", 49]
        - ["储能系统", 35]
        - ["材料回收", 9]
        - ["其他", 7]
    legend: false
    series:
      - type: pie
        encode: { category: segment, value: share }
        innerRadius: 0.55
        startAngle: 110
        fill: [ $brand1, $accent, $brand3, $chartNeutral ]
        dataLabels: { show: true, content: percentage, numberFormat: "0%", fontSize: 14 }
```

- 段数 ≤6，超出合并 top5+「其他」（`pie_max_slices` 闸）。
- **图洞中央放绝对数字时 `legend: false`**（`doughnut_legend_right` 闸：原生 right 图例在 PowerPoint 里压环、与洞心大数字重叠）：洞心外部 text = $statNumeral 大数 + 一行 $caption 口径小标，洞心 label 框宽 ≤160px、文案 ≤20 字符；段名/数值由**左栏 segment 表**承担（信息单源）。无中心数字的小 doughnut 可 legend bottom；图例类目名 ≤14 字符。
- **小扇区避开图例区**：用 `startAngle` 旋转把小扇区挪到 9–12 点钟方向。⚠️ `startAngle` 写在 **pie/doughnut series 层**，不是 chart 顶层（置顶层是 UnknownField，引擎静默丢弃）。
- 段色序：主段 $brand1 → 强调段 $accent → $brand3 → $brand2/$gradChipLight → 「其他」恒 $chartNeutral。
- **扇区标签必须反相**：codec 不写标签色（PowerPoint 全黑压深色扇区）——`scripts/polish-pptx.mjs` 导出后按扇区亮度逐点注入（深段白、浅段深），已自动化。

## 渲染器差异纪律

1. **ctr 柱内标签只在「纯柱状/堆积图」上用**（PowerPoint 已验证可见）。**柱线组合图里柱子的 ctr 标签会被 PowerPoint 吞掉**——组合图柱数值贴柱顶外部文本框（`combo_no_bar_ctr_labels` 闸）。
2. **类目标签是唯一对齐鲁棒的通道**：任何与图表逐行对齐的外部 text 在不同渲染器间会漂移半行——方法名/区间值必须写进 category 标签（可用 `\n` 两行），外部 gutter 禁止。
3. **柱顶上方标签**（总值/份额%）：按轴 min/max 线性换算 + 预留 ≥8px 净空，接受亚渲染器小漂移；yAxis max 显式锚定后才可复算。
4. **chart 区域叠层一律原生**：**禁止**用外部 rect/line 按渲染器标定叠在 chart 上（PowerPoint 必漂）。需要参考线用常值折线系列（$chartNeutral dash）。
5. **导出件把关以 `verify-pptx.mjs` 的 XML 断言为准**；Rust 重渲截图的已知差异（隐藏轴幻影签、堆积图无 dLbls 系列段值照画、`<sup>` 表内划痕等）不返工——对照 `render-truth-scan.mjs` 的登记表使用，表外才是 bug。

## 已知限制与债

- schema 无 noFill：隐形 base series 用 `fill:"#FFFFFF"`（白页成立，深色背景页禁用瀑布图）。
- 数据标签位置不可配（codec 决定：堆积 ctr / 瀑布柱内）；「柱顶上方」标签只有外部 text 换算通道。
- `+`/条件数字格式不支持：瀑布增量标签无显式正号，符号信息移交给配套假设表。
- v1 不带 cagr-line / football / harvey 体系（本模板无此语言，DECISIONS §6 砍除）；柱顶标手摆需按纪律 3 可复算。
- 双轴/散点/treemap 等类型以 R4 验证范围为限，其余类型 v1 不承诺。
