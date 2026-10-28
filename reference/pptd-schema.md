> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# PPTD Schema 参考（Kimi Slides / neo-ppt · v2）

> 考证日期 2026-09-08。本文是「可照写」的完整 schema 参考，重点覆盖**原生 chart 元素**。
>
> **权威来源**（按可信度排序）：
> 1. kimi-slides 引擎随附的 `reference/pptd.md` —— Moonshot 官方 DSL 完整定义（1886 行，本文主体依据）
> 2. kimi-slides 引擎随附的 `reference/shapes.md` —— 177 个 shapeName 全集
> 3. 桌面端编辑器导出引擎源码（内部仓库，不随包）—— chart 两种方言的接缝证据
> 4. 实证：4 页 chart probe deck（探针件不随包；`kimi-slides check` 零告警，4 张 PNG 全部正确渲染，见文末验证记录）

---

## 0. 总览：PPTD 是什么

PPTD 是 OOXML 的 YAML 抽象层。一个 deck 是一个**目录**：

```
project/
  slides_name.pptd     # 主入口：version/size/theme/title + 页面文件清单
  pages/               # 每页一个 .page 文件
    page-1.page
  media/               # 图片等媒体资源（可选）
```

- **YAML 1.2**。`content.text` 等含特殊字符的字段一律用块标量 `|-` 独占一块，防止 `style="..."` 被误解析。
- **路径规则**：完全自包含——所有被引用文件必须在 `.pptd` 所在目录内，只支持相对路径；例外是图片 `src` 可以是 `https://` URL（仅 jpg/jpeg/png/gif）。
- **坐标系**：单位 px，原点页面左上角；**1px = 1pt**（`fontSize: 18` 即 18pt）。推荐尺寸 16:9 → `[960, 540]`，4:3 → `[720, 540]`；真实模板用 `[1440, 810]` 也合法。
- **层叠**：`elements` 数组越靠后的元素层级越高。
- **元素类型全集**：`text | shape | line | image | icon | table | chart` 共 7 种。**没有 group/组合元素**——母版被刻意压平，每页自包含。

工具链（本机）：

```bash
export KIMI_SLIDES_FONTS_DIR=$HOME/.kimi-slides-rs/fonts   # 固定字体栈，渲染可复现
kimi-slides check <deck目录>                    # QA（溢出/数据完整性）
kimi-slides screenshot <deck目录> -o <out> --format png
kimi-slides convert <file.pptx> -o <dir>        # PPTX→PPTD（对 numRef 图表有缺陷）
```

---

## 1. 主入口 `presentation.pptd`

```ts
interface Presentation {
  version: "v2";            // 必填，固定 "v2"
  title?: string;
  size: [number, number];   // [宽, 高]，必填；必须是两元素数组（写成 {width,height} 会崩）
  theme?: Theme;
  pages: string[];          // 页面文件相对路径清单，顺序即页序
}

interface Theme {
  colors?: Record<string, Color>;                // 任何 Color 字段用 $key 引用
  textStyles?: Record<string, TextStyleConfig>;  // Text.content.style / Cell.textStyle 用 $key 引用
  tableStyles?: Record<string, TableStyleConfig>;// Table.style 用 $key 引用
}
```

可照抄的最小骨架：

```yaml
version: v2
title: My Deck
size: [1440, 810]
theme:
  colors:
    primary: "#006BA6"
    accent: "#00A9F4"
    ink: "#051C2C"
    muted: "#666666"
  textStyles:
    pageTitle: {color: $ink, fontSize: 28, fontFamily: Arial, bold: true}
    body: {color: "#333333", fontSize: 15, fontFamily: Arial, lineHeight: 1.3}
  tableStyles:
    default:
      firstRowStyle:
        fill: {type: solid, color: $primary}
        color: "#ffffff"
        bold: true
      bodyStyles:
        - {fill: {type: solid, color: "#f8fafc"}}
        - {fill: {type: solid, color: "#ffffff"}}
pages:
  - pages/page-1.page
  - pages/page-2.page
```

### TextStyleConfig（textStyles 每个键的值）

```ts
interface TextStyleConfig {
  color?: Color;                    // 默认 #000000
  fontSize?: number;                // 默认 18
  fontFamily?: FontFamily;          // 默认 "MiSans"；见 §2
  bold?: boolean;                   // 默认 false
  italic?: boolean;                 // 默认 false
  backgroundColor?: Color;          // 文字底色（高亮），默认无
  lineHeight?: number;              // 行高倍数，默认 1
  lineHeightPx?: number;            // 固定行高 px；与 lineHeight 互斥，同时设置时它赢
  letterSpacing?: number;           // 默认 0
  marginTop?: number;               // 默认 0
}
```

> convert 产物里常见 `fontFamily: Arial, Arial`——那是「latin, ea」两值拼成的字符串，手写时用单名字符串或 `{latin, ea}` 对象即可。

---

## 2. 共享类型

```ts
type Color = string;  // HEX6 "#RRGGBB" / HEX8 "#RRGGBBAA"（带透明）/ 主题引用 "$primary"

type FontFamily = string | { latin: string; ea: string };
// 字符串：中英同字体；对象：西文(latin)与中文(ea)分开指定

type Alignment = [HorizontalAlign, VerticalAlign];
// HorizontalAlign: "left"|"center"|"right"|"justify"|"distributed"
// VerticalAlign:   "top"|"middle"|"bottom"

type LineStyle = "solid" | "dash" | "dot";

interface Border { style?: LineStyle /*solid*/; width?: number /*1*/; color?: Color /*#000000*/ }

interface Shadow { blur: number; color: Color; offset?: [number, number] /*[0,0]*/ }

interface ColorStop { position: number /*[0,1]*/; color: Color }

type Fill = SolidFill | GradientFill | ImageFill;
// SolidFill:    {type: "solid", color: Color}
// GradientFill: {type: "gradient", gradientType: "linear"|"radial", stops: ColorStop[≥2], angle?: number}
//               angle ∈ [0,360)，0=左→右，顺时针增大；90=上→下
// ImageFill:    {type: "image", src, fit?: {mode}, crop?: ImageCrop, opacity?: number}

interface ImageFit  { mode: "fill" | "contain" | "cover" }   // cover=裁满(默认) contain=完整留白 fill=拉伸
interface ImageCrop { left?: number; top?: number; right?: number; bottom?: number }
// 比例值：正=向内裁，负=向外扩并补透明；须 left+right<1 且 top+bottom<1
```

**BorderSpec**（仅表格 Cell/CellStyle 用，四边分别设置）：

```ts
type BorderSpec = null                                  // 显式清除全部边线
  | Border                                              // 四边相同
  | [Border|null, Border|null]                          // [上下, 左右]
  | [Border|null, Border|null, Border|null, Border|null]; // [上, 右, 下, 左] 顺时针
```

---

## 3. 页面文件 `.page`

```ts
interface Page {
  pageType?: "cover" | "table_of_contents" | "chapter" | "content" | "final" | string;
                                    // 分类标签，不影响渲染；也允许任意自定义字符串
  background?: Fill;                // 默认白色 solid
  notes?: string;                   // 演讲者备注，纯文本
  elements: Element[];              // 越靠后层级越高
}
```

所有元素共享基座：

```ts
interface ElementBase {
  elementId: string;    // 页内唯一
  elementType: "text" | "shape" | "line" | "image" | "icon" | "table" | "chart";
  bounds: [number, number, number, number];  // [x, y, 宽, 高]
}
```

text / shape / line / image / icon 还共享三个变换字段：`rotation?: number`（度，顺时针，默认 0）、`opacity?: number`（[0,1]，默认 1）、`flip?: [boolean, boolean]`（[水平, 垂直]，默认 [false,false]）。**table 和 chart 不支持整体旋转/翻转/透明度**（PowerPoint 原生限制；需要时先渲染成 image）。

---

## 4. text 元素

```ts
interface Text extends ElementBase {
  elementType: "text";
  rotation?; opacity?; flip?;
  content: TextContent;
}

interface TextContent {
  text: string;                    // 富文本字符串（块标量）
  style?: string;                  // 引用 theme.textStyles，写 "$key"
  // 内联样式字段（未设则沿继承链回退）
  color?: Color; fontSize?: number; fontFamily?: FontFamily;
  bold?: boolean; italic?: boolean; backgroundColor?: Color;
  lineHeight?: number; lineHeightPx?: number; letterSpacing?: number; marginTop?: number;
  // 布局
  textDirection?: "horizontal" | "vertical";  // 默认 horizontal
  wrap?: boolean;                  // 默认 true；false 不换行、超宽溢出——单行文本建议显式 false
  align?: Alignment;               // 默认 [left, top]
  // 装饰（不设=不应用）
  gradient?: GradientFill;         // 文字渐变
  shadow?: Shadow;                 // 文字阴影
}
```

**样式优先级**（高→低）：富文本语义标签（`<u>` 等）→ `<span style>` → `<p style>` → content 上的内联字段 → `style: "$key"` 引用的主题样式 → 默认值。

### 富文本标签子集

| 标签 | 作用 |
|---|---|
| `<p>` | 段落，可带段落样式 |
| `<span>` | 内联样式载体 |
| `<strong>` `<em>` `<u>` `<s>` | 粗 / 斜 / 下划线 / 删除线 |
| `<sup>` `<sub>` | 上标 / 下标 |
| `<a href>` | 超链接（https/http/mailto；自动套用蓝色下划线） |
| `<ul>` `<ol>` `<li>` | 列表（`<li>` 必须配 `<ul>`/`<ol>`） |

`style="..."` 属性映射（颜色值都可用 `$primary` 主题引用）：

- **`<p>`**：`text-align`、`line-height`（无单位=倍数，带 px=固定值）、`margin-top`、`margin-left`、`margin-right`。**不要给 `<p>` 设 letter-spacing**（统一字距用 content.letterSpacing）。
- **`<li>`**：以上 + `letter-spacing`、`list-style(-type/-position/-image)`。
- **`<span>`**：仅 `color` / `font-size`(如 `24px`) / `font-family` / `background-color`。

纯文本简写：`text: "Hello"` ≡ `<p>Hello</p>`；块标量多行 ≡ 每行一个 `<p>`。`<br/>` 可段内换行但编辑再转换后不保证保留——要稳定换行用多个 `<p>`。支持 `\(...\)` LaTeX 公式（公式内不允许富文本标签，只继承 color 和 font-size）。

可照抄：

```yaml
- elementId: body-1
  elementType: text
  bounds: [60, 200, 800, 300]
  content:
    style: $body                 # 主题样式打底
    fontSize: 20                 # 内联覆盖
    lineHeight: 1.6
    align: [left, top]
    wrap: true
    text: |-
      <p><strong>关键结论</strong>：完成 <span style="color:$primary;">3</span> 个里程碑</p>
      <p style="text-align:right"><span style="font-size:14px; color:#6b7280;">—— FY2024</span></p>
      <ul><li>第一条</li><li>第二条</li></ul>
```

---

## 5. shape 元素

```ts
interface Shape extends ElementBase {
  elementType: "shape";
  rotation?; opacity?; flip?;
  shapeName: string;        // 177 个内置名（见 shapes.md）或 "custom"
  adjustments?: number[];   // 几何参数，顺序/个数与 OOXML 一致；[0,100000] 千分比；角度=度×60000
  viewBox?: [number, number]; // 仅 shapeName="custom" 时必填
  path?: string;              // 仅 shapeName="custom" 时必填；SVG path（M/L/H/V/C/S/Q/A/Z）
  fill?: Fill;              // 默认不应用（透明！）
  border?: Border;          // 默认不应用
  shadow?: Shadow;          // 默认不应用
}
```

**shape 不支持内嵌文字**——文字另起一个 text 元素叠上去。

常用 shapeName（全表 177 个见 kimi-slides 引擎随附的 `reference/shapes.md`）：

| 类别 | shapeName（默认值） |
|---|---|
| 基础 | `rect`、`roundRect`([16667])、`ellipse`、`triangle`([50000])、`rtTriangle`、`diamond`、`parallelogram`、`trapezoid`、`pentagon`、`hexagon`、`octagon`、`plus`、`donut`([25000])、`heart`、`cloud`、`sun`、`moon`、`can`、`cube`、`bevel`、`frame`、`arc`、`blockArc`、`pie`、`chord`、`teardrop`、`wave`、`doubleWave` |
| 矩形变体 | `round1Rect`、`round2DiagRect`、`round2SameRect`、`snip1Rect`、`snip2DiagRect`、`snip2SameRect`、`snipRoundRect` |
| 星爆 | `star4`…`star32`、`irregularSeal1/2` |
| 箭头 | `rightArrow`/`leftArrow`/`upArrow`/`downArrow`([50000,50000])、`leftRightArrow`、`upDownArrow`、`bentArrow`、`bentUpArrow`、`uturnArrow`、`circularArrow`、`curvedRightArrow`、`stripedRightArrow`、`notchedRightArrow`、`swooshArrow`、`quadArrow` 等 |
| 箭头标注 | `rightArrowCallout` 等 7 个 `*ArrowCallout` |
| 标注 | `wedgeRectCallout`、`wedgeRoundRectCallout`、`wedgeEllipseCallout`、`cloudCallout`、`borderCallout1-3`、`accentCallout1-3`、`callout1-3` 等 |
| 括号 | `leftBrace`/`rightBrace`([8333,50000])、`leftBracket`/`rightBracket`、`bracePair`、`bracketPair` |
| 缎带/卷轴 | `ribbon`、`ribbon2`、`ellipseRibbon(2)`、`horizontalScroll`、`verticalScroll` |
| 数学符号 | `mathPlus/Minus/Multiply/Divide/Equal/NotEqual` |
| 流程图 | `flowChartProcess/Decision/Document/Data/Terminator/...` 等 30+ |
| 其他 | 5 边箭头 `homePlate`、V 形 `chevron`、`gear6/gear9`、`plaque`、`funnel`、`lightningBolt`、`smileyFace`、`noSmoking`、`chartPlus/Star/X`、`cornerTabs/squareTabs/plaqueTabs`、`actionButton*` |

镂空画法：外轮廓顺时针（sweep=1）+ 内轮廓逆时针（sweep=0）。改 bounds 即缩放，但 viewBox 独立拉伸到 bounds——要保持比例须 `viewBoxW:viewBoxH = bounds.w:bounds.h`。

可照抄：

```yaml
- elementId: card-1
  elementType: shape
  bounds: [60, 120, 400, 220]
  shapeName: roundRect
  adjustments: [12000]
  fill: {type: solid, color: "#F5F7FA"}
  border: {style: solid, width: 1, color: "#E0E4E8"}
  shadow: {blur: 8, color: "#00000014", offset: [0, 2]}

- elementId: ring-1          # 自定义镂空圆环
  elementType: shape
  bounds: [520, 120, 150, 150]
  shapeName: custom
  viewBox: [1000, 1000]
  path: "M500,0 A500,500 0 1 1 499,0 Z M500,200 A300,300 0 1 0 499,200 Z"
  fill: {type: solid, color: $accent}
```

虚线边框：`border: {style: dash, width: 1, color: "#999"}`（`dash`/`dot`）。

---

## 6. line 元素（自由曲线/连接线）

```ts
interface Line extends ElementBase {
  elementType: "line";
  rotation?; opacity?; flip?;
  viewBox: [number, number];  // 点坐标系 [w,h]；viewBox 独立拉伸到 bounds
  points: string;             // "x1,y1 x2,y2 ..."，≥2 点；首末是曲线经过的端点，中间是贝塞尔控制点
  curve?: "sharp" | "round" | "smooth";  // 默认 round（尖角/圆角/平滑曲线）
  arrow?: [ArrowType|null, ArrowType|null];  // [起点, 终点]；ArrowType = "arrow"|"stealth"|"diamond"|"oval"
  border?: Border; shadow?: Shadow;
}
```

```yaml
- elementId: trend-line
  elementType: line
  bounds: [100, 300, 500, 120]
  viewBox: [1, 1]
  points: "0,1 0.3,0.4 0.7,0.5 1,0"
  curve: smooth
  arrow: [null, arrow]
  border: {style: dash, width: 2, color: $primary}
```

---

## 7. image 元素

```ts
interface Image extends ElementBase {
  elementType: "image";
  rotation?; opacity?; flip?;
  src: string;               // 相对路径（media/xxx.png，须在 deck 目录内）或 https URL
  cropShape?: ShapeDef;      // 裁剪外形，默认矩形；ShapeDef={shapeName,adjustments?,viewBox?,path?}
  fit?: ImageFit;            // 默认 {mode: cover}
  crop?: ImageCrop;          // 先按比例裁剪/扩边
  border?: Border; shadow?: Shadow;
}
```

渲染顺序固定：`crop`（源矩形比例调整）→ `fit`（适配 bounds）→ `cropShape`（按形状轮廓裁剪）。

```yaml
- elementId: img-1
  elementType: image
  bounds: [60, 100, 400, 300]
  src: "media/cover.jpg"
  fit: {mode: cover}
  crop: {top: 0.1, bottom: 0.1}
  cropShape: {shapeName: roundRect, adjustments: [15000]}
  shadow: {blur: 10, color: "#00000033", offset: [0, 4]}
```

---

## 8. icon 元素（Font Awesome 7.x free）

```ts
interface Icon extends ElementBase {
  elementType: "icon";
  rotation?; opacity?; flip?;
  iconName: string;   // "style:name"：fas:solid（最常用）/ far:regular / fab:brands
  fill?: Fill;        // 默认黑色 solid
  border?: Border; shadow?: Shadow;
}
```

```yaml
- elementId: icon-1
  elementType: icon
  bounds: [100, 100, 48, 48]
  iconName: "fas:lightbulb"
  fill: {type: solid, color: $primary}
```

图标检索：https://fontawesome.com/search?ic=free-collection 。注意：当前 screenshot CLI 有已知 bug——icon 会退化成圆形，属工具限制可忽略。

---

## 9. table 元素

```ts
interface Table extends ElementBase {
  elementType: "table";
  columnWidths: number[];  // 列宽比例（非 px），每项∈[0,1]，合计=1
  rowHeights: number[];    // 行高比例，同上
  rows: Cell[][];          // 二维数组；合并区域被占位置直接从数组省略（不写 null 占位）
  style?: string | TableStyleConfig;  // "$key" 引用 theme.tableStyles，或内联对象
  fill?: Fill;             // 全表底色
  shadow?: Shadow;
}

interface Cell {
  text?: string;           // 富文本，规则同 TextContent.text
  textStyle?: string;      // "$key" 引用 theme.textStyles（只套文字字段，不含 fill/border/align）
  color/fontSize/fontFamily/bold/italic/backgroundColor/lineHeight/lineHeightPx/letterSpacing/marginTop
  fill?: Fill; border?: BorderSpec; align?: Alignment;  // 默认 align [center, middle]
  rowSpan?: number; colSpan?: number;  // 默认 1
}

interface TableStyleConfig {
  cellStyle?: CellStyle;        // 全表基线
  firstRowStyle?: CellStyle;    // 行类别：对匹配的每个 cell 独立生效
  lastRowStyle?: CellStyle;
  firstColumnStyle?: CellStyle; // 列类别
  lastColumnStyle?: CellStyle;
  bodyStyles?: CellStyle[];     // 数据行按序循环
  rowOverColumn?: boolean;      // 默认 true：行列规则撞车时行赢
}
// CellStyle = TextStyleConfig + {fill, border, align}
```

单元格样式优先级：富文本标签 > span > p > Cell 内联 > textStyle 引用 > 行/列类别样式（rowOverColumn 裁定）> bodyStyles 循环 > cellStyle 基线 > 默认。

合并规则：`rowSpan`/`colSpan` 声明范围，**被覆盖的格子从 rows 数组里省略**。例：左上 2×2 合并后，row0 只剩 2 项（合并格 + 第 3 列），row1 只剩 1 项（第 3 列）。

```yaml
- elementId: table-1
  elementType: table
  bounds: [60, 140, 800, 240]
  columnWidths: [0.3, 0.35, 0.35]
  rowHeights: [0.34, 0.33, 0.33]
  style: $default
  rows:
    - - text: "Metric"
      - text: "2023"
      - text: "2024"
    - - text: "Revenue"
      - text: "82.5"
      - {text: "96.3", bold: true, color: $primary}
    - - text: "Net profit"
      - text: "12.1"
      - text: "15.8"
```

---

## 10. chart 元素（核心）

### 10.1 顶层结构——ECharts 哲学：顶层没有 `type` 字段

```ts
interface Chart extends ElementBase {
  elementType: "chart";
  data: ChartData;                    // 必填
  series: SeriesConfig[];             // 必填，≥1；每个 series 自己的 type 决定形态
  seriesDefaults?: SeriesDefaults;    // 按类型给公共默认值（见 10.6）
  // 直角坐标系（按 series.type 条件生效）
  xAxis?: AxisConfig | AxisConfig[];  // 数组形式供双轴，series 用 xAxisIndex 指认
  yAxis?: AxisConfig | AxisConfig[];
  barWidth?: number;                  // (0,1]，柱宽/类目槽宽比，默认自适应
  barGap?: number;                    // [0,1)，多柱系列间间隙，默认 0
  categoryGap?: number;               // [0,1)，类目槽间空白比，默认 0.2
  // 雷达坐标系
  spokeAxis?: SpokeAxisConfig;
  // 全局组件
  title?: string | TitleConfig;
  legend?: boolean | LegendConfig;
  dataLabels?: DataLabelConfig;       // 全局默认，可被 series.dataLabels 覆盖
  fontFamily?: FontFamily;
  // 图表外框（整个矩形容器，与系列颜色无关）
  fill?: Fill; border?: Border; shadow?: Shadow;
}
```

**13 种 series 类型全集**（`series[i].type` 取值）：

```
bar / line / area / scatter / bubble / candlestick / pie /
radar / waterfall / heatmap / treemap / sunburst / sankey
```

### 10.2 数据：`data: {cols, rows}` + encode 通道

```ts
interface ChartData {
  cols: string[];                       // 列名，唯一、非空
  rows: (number | string | null)[][];   // 每行长度 = cols.length；缺失值写 null
}
```

- 数值通道（`y`/`value`/`open`/`high`/`low`/`close`/`size`/`flow`）里的字符串会尝试解析成数字，失败报 `NonNumericValueError`。
- checker 校验：列名重复 `DuplicateColumnError`、空列名 `EmptyColumnError`、行长不符 `RowLengthError`、encode 引用未知列 `UnknownColumnError`。
- 同一列可被多个 series 引用（同一份 y 画一遍 bar 再画一遍 line 是合法的）。
- 缺失单元格写 `null`，**不要**写连续逗号。

各类型 encode 通道：

| type | encode |
|---|---|
| bar / line / area | `{x, y}` |
| scatter | `{x, y}`（多系列用宽表 + null 补齐） |
| bubble | `{x, y, size}` |
| candlestick | `{x, high, low, close, open?}`（open 省略=HLC 模式） |
| pie | `{category, value}` |
| radar | `{category, y}` |
| waterfall | `{x, y, isTotal?}`（isTotal 为 bool 列） |
| heatmap | `{x, y, value}`（x/y 必须是字符串类目） |
| treemap / sunburst | `{category, value, parent?}` |
| sankey | `{source, target, flow}`（必须 DAG，成环报 `CyclicGraphError`） |

### 10.3 各 series 类型字段

**bar**（可与 line/area/scatter/bubble/candlestick 自由混排，不限条数）

```ts
{ type: "bar", encode: {x, y}, name?: string /*默认=encode.y 列名，仅用于图例*/,
  xAxisIndex?: number /*0*/, yAxisIndex?: number /*0*/,
  stack?: "value" | "percent" /*默认不堆叠*/,
  symbol?: ShapeDef /*象形柱*/,
  fill?: Color | GradientFill, border?: Border,
  dataLabels?: DataLabelConfig /*content 只取 value*/ }
```

**line**（混排同 bar）

```ts
{ type: "line", encode: {x, y}, name?, xAxisIndex?, yAxisIndex?, dataLabels?,
  // LinearSeriesBase 公共曲线字段：
  smooth?: boolean /*false*/, lineStyle?: "solid"|"dash"|"dot" /*solid*/,
  width?: number /*2*/, marker?: false | MarkerConfig /*默认无*/,
  nullHandling?: "zero"|"gap"|"connect" /*line/area 默认 gap*/,
  lineColor?: Color | GradientFill }
```

**area**：同 line + `stack?: "value"|"percent"|"stream"`（stream=流图，area 独有）+ `areaColor`（缺省由 lineColor 派生半透明）。radar 的 nullHandling 默认 connect。

**scatter**：`{encode:{x,y}, dataFilter?:{col,value}, marker?: MarkerConfig /*不能 false*/, fill?, border?, dataLabels?}`。marker 颜色解析 `marker.fill > series.fill > 主题色循环`。

**bubble**：`{encode:{x,y,size}, sizeScale?: "linear"|"sqrt"|"log" /*sqrt*/, sizeRange?: [number,number], fill?, border?, dataLabels?, dataFilter?}`。sqrt=面积正比数值。

**candlestick**：`{encode:{x,high,low,close,open?}, upBars?:{fill,border}, downBars?:{fill,border}, wickStyle?: Border}`。只能与 bar/line/area 混排（常见：K线 + MA 叠加 line）。日期列按字符串类目等距排列，自然跳过非交易日。candlestick 本体不支持 dataLabels（叠加系列可以）。

**pie**（series 只能有 1 个，不可混排）

```ts
{ type: "pie", encode: {category, value},
  innerRadius?: number /*[0,1]，>0=甜甜圈*/, startAngle?: number /*0=12 点方向，顺时针为正*/,
  fill?: Color | GradientFill | (Color|GradientFill)[] /*数组按扇区循环*/,
  border?, dataLabels? /*content: value|percentage|category，默认 value*/ }
```

**radar**（可多 series 共享辐条，但全图必须全是 radar）：`{encode:{category,y}, name?, areaColor?, dataLabels?}` + LinearSeriesBase。所有 series 的 `encode.category` 必须相同；辐条/蛛网/值域统一由顶层 `spokeAxis` 配置。

**waterfall**（单 series，不可混排）：`{encode:{x,y,isTotal?}, totalBars?/increaseBars?/decreaseBars?: {fill,border}, dataLabels? /*value|category*/}`。isTotal 列只接受 bool/null；每个 isTotal=true 是独立总计柱，其 y 应等于前一总计柱 + 中间浮动柱之和（不符报 `WaterfallTotalMismatchWarning`）。

**heatmap**（单 series）：`{encode:{x,y,value}, colorScheme?: Color[] /*渐变端点*/, colorScale?: {type:"linear"|"diverging", domain?:[number,number]}, colorbar?: boolean|LegendConfig /*默认 true，位置默认 right*/, dataLabels?}`。linear 需 ≥2 色；diverging 需 3 色（低/中/高）。heatmap 不用 `chart.legend`，用 colorbar。

**treemap**（单 series）：`{encode:{category,value,parent?}, levels?: number, fill?: 单值|一维数组|二维数组, border?, dataLabels? /*默认 category*/}`。子节点沿 HSL.L 每级减 10% 派生；二维数组外层按根节点循环、内层直接指定层级色。

**sunburst**（单 series）：`{encode:{category,value,parent?}, levels?, fill?: 单值|数组 /*按顶层节点循环*/, border?, dataLabels? /*默认 category*/}`。

**sankey**（单 series）：`{encode:{source,target,flow}, nodeAlign?: "left"|"right"|"justify" /*justify*/, fill?: 单值|数组|Record<节点名,颜色>, border?, dataLabels? /*value|category，默认 value*/}`。节点按拓扑序排列，数组按拓扑序循环。

### 10.4 轴 / 图例 / 标题 / 数据标签配置

```ts
interface AxisConfig {
  show?: boolean;                 // 默认 true
  type?: "category" | "value";    // 默认按数据列推断（字符串→category，数字→value）
  min?: number; max?: number;     // 仅 value 轴生效，默认自适应
  reverse?: boolean;              // 默认 false
  title?: string | TitleConfig;
  label?: boolean | (TextStyle & { numberFormat?: string });  // 刻度标签，默认 true
  axisLine?: boolean | (LineStyleConfig & { arrow?: boolean|"start"|"end"|"both" }); // 默认 true
  gridLine?: boolean | LineStyleConfig;                       // 网格线，默认 true
}

interface LegendConfig extends TextStyle {
  show?: boolean;   // 默认按类型：bar/line/area/scatter/bubble/candlestick/pie/radar=true，waterfall/treemap/sunburst/sankey=false，heatmap 不用 legend
  position?: "top"|"bottom"|"left"|"right";  // 默认 bottom
}

interface TitleConfig extends TextStyle { text: string }

interface DataLabelConfig extends TextStyle {
  show?: boolean;                                   // 默认 false
  content?: "value" | "percentage" | "category";    // 允许值按类型见下表
  numberFormat?: string;                            // Excel 数字格式子集
}

interface TextStyle { color?: Color; fontSize?: number /*默认按图表大小自适应*/; fontFamily?: FontFamily }
interface LineStyleConfig { style?: "solid"|"dash"|"dot"; color?: Color; width?: number /*1*/ }
interface MarkerConfig { shape?: "circle"|"rect"|"diamond"|"triangle"; fill?: Color|GradientFill; border?: Border; size?: number }

interface SpokeAxisConfig {   // 仅 radar
  show?: boolean; min?: number /*0*/; max?: number;
  label?: boolean | (TextStyle & {numberFormat?});
  axisLine?: boolean | LineStyleConfig;   // 辐条线
  gridLine?: boolean | LineStyleConfig;   // 蛛网线
}
```

**numberFormat 子集**：`0` / `0.0` / `0%` / `0.0%` / `#,##0` / `0.0E+00`；不支持 `[Red]` 颜色段、负数段、条件格式。

**dataLabels.content 允许值**：

| type | 允许 | 默认 |
|---|---|---|
| bar/line/area/scatter/bubble/radar/heatmap | `value` | `value` |
| pie | `value`/`percentage`/`category` | `value` |
| waterfall | `value`/`category` | `value` |
| treemap/sunburst | `value`/`category` | `category` |
| sankey | `value`/`category` | `value` |

**顶层字段适用范围**：

| 字段 | 适用类型 |
|---|---|
| `xAxis`/`yAxis` | bar/line/area/scatter/bubble/candlestick/waterfall/heatmap |
| `barWidth`/`barGap` | bar/waterfall |
| `categoryGap` | bar/candlestick/waterfall |
| `spokeAxis` | radar |
| `legend` | bar/line/area/scatter/bubble/candlestick/pie/radar/waterfall（`legend:false` 对全部 13 种生效） |
| `title`/`dataLabels`/`fontFamily` | 全部 |

**柱/瀑布方向**：`xAxis.type==="category"` → 竖向（默认）；`yAxis.type==="category"` → 横向。横向时 `encode.x` 指数值列、`encode.y` 指类目列，numberFormat 写在数值轴那侧。轴类型默认从数据列推断（数字列想当类目用，如年份，要显式 `type: category`）。

**双轴**：永远在数值轴那一侧放数组——竖图 `yAxis: [{...},{...}]` + 系列 `yAxisIndex: 1`；横图用 `xAxis` 数组 + `xAxisIndex`。数组长度 ≥ max(index)+1。

### 10.5 样式优先级与合并规则

- **系列体色**：series 显式 `fill`/`lineColor`/`areaColor` > `seriesDefaults[type]` 同名字段 > theme.colors 主题色循环（按 series 出现顺序取色）。
- **字体**：子组件 fontFamily > `Chart.fontFamily` > 主题/母版字体。
- **dataLabels**：`series[i].dataLabels` > `Chart.dataLabels` > 不显示；子字段**一层浅合并**（series 只覆盖它显式写的子字段）。
- **seriesDefaults 合并**：与每个 series 做一层深合并——标量被 series 显式值覆盖；对象（marker/dataLabels/border/upBars/渐变 fill 等）递归浅合并；数组整体替换；`type`/`encode` 不允许出现在 seriesDefaults；仅 bar/line/area/scatter/bubble/candlestick/radar 支持。
- **`boolean | Config` 约定**（marker/legend/label/axisLine/gridLine/colorbar）：`false`=关，`true`=默认配置开，对象=开+自定义。唯一例外：scatter.marker 不能 false。
- **可选对象字段省略语义**：`xAxis`/`yAxis`/`spokeAxis`/`marker`/`dataLabels` 等省略 = 空配置 `{}`，子字段各自取默认（轴/网格/标签**默认仍渲染**，只是参数自动推断）——与 ElementBase 的 fill/border/shadow（省略=不应用）相反。
- **堆叠组**：同图同类型所有设了 `stack` 的 series 自动并成一组，无需组标识；同图同类型至多一个堆叠组且 `stack` 值必须一致（混用报 `StackModeMismatchError`）；不设 stack 的 series 独立显示。要多组独立堆叠就拆多个 chart 元素。

### 10.6 堆积柱状图完整页示例（实测渲染通过）

```yaml
pageType: content
background:
  type: solid
  color: "#FFFFFF"
notes: Stacked bar — 3 series via seriesDefaults.bar.stack
elements:
  - elementId: title2
    elementType: text
    bounds: [60, 36, 900, 44]
    content:
      fontSize: 28
      fontFamily: Arial
      bold: true
      color: "#051C2C"
      wrap: false
      align: [left, middle]
      text: |-
        <p>Revenue mix by segment</p>
  - elementId: stack1
    elementType: chart
    bounds: [80, 120, 1280, 620]
    title: Revenue mix by segment ($bn)
    data:
      cols: [year, dc, gaming, pro]
      rows:
        - [FY24, 18.4, 12.2, 6.1]
        - [FY25, 32.5, 14.8, 7.4]
        - [FY26, 61.0, 18.9, 9.6]
        - [FY27E, 96.2, 22.4, 11.8]
    xAxis:
      title: Fiscal year
      gridLine: false
    yAxis:
      min: 0
      label: {numberFormat: "#,##0"}
      gridLine: {style: dot, color: "#D9D9D9"}
    legend: {show: true, position: bottom}
    seriesDefaults:
      bar: {stack: value}        # 百分比堆叠改 stack: percent
    series:
      - type: bar
        encode: {x: year, y: dc}
        name: Data Center
        fill: "#006BA6"
      - type: bar
        encode: {x: year, y: gaming}
        name: Gaming
        fill: "#00A9F4"
      - type: bar
        encode: {x: year, y: pro}
        name: Pro Viz
        fill: "#ED7D31"
```

也可以不用 seriesDefaults，在每个 series 上各写 `stack: value`（效果相同，但三个都得写、且值必须一致）。

### 10.7 其他常用图的最小写法

柱状图（显式双轴 + 数据标签）：

```yaml
- elementId: bar1
  elementType: chart
  bounds: [80, 120, 1280, 620]
  data:
    cols: [quarter, revenue]
    rows:
      - [Q1, 44.1]
      - [Q2, 56.6]
  xAxis: {title: Quarter, gridLine: false}
  yAxis: {min: 0, max: 70, label: {numberFormat: "#,##0"}, gridLine: {style: dot, color: "#D9D9D9"}}
  legend: false
  barWidth: 0.55
  series:
    - type: bar
      encode: {x: quarter, y: revenue}
      fill: "#006BA6"
      dataLabels: {show: true, numberFormat: "0.0"}
```

折线图（多系列、缺失值断开）：

```yaml
- elementId: line1
  elementType: chart
  bounds: [80, 120, 1280, 620]
  data:
    cols: [qtr, actual, street]
    rows:
      - [Q1, 71.3, 70.0]
      - [Q2, 74.8, 71.5]
      - [Q3, null, 72.4]      # null + nullHandling: gap → 断口
      - [Q4, 75.0, 72.9]
  yAxis: {min: 65, max: 80}
  series:
    - type: line
      encode: {x: qtr, y: actual}
      name: Actual
      lineColor: "#006BA6"
      width: 3
      smooth: true
      marker: {shape: circle, size: 8}
      nullHandling: gap
      dataLabels: {show: true, numberFormat: "0.0"}
    - type: line
      encode: {x: qtr, y: street}
      name: Street
      lineColor: "#ED7D31"
      lineStyle: dash
      width: 2
```

饼图（百分比标签）：

```yaml
- elementId: pie1
  elementType: chart
  bounds: [320, 110, 800, 640]
  data:
    cols: [segment, share]
    rows:
      - [Data Center, 72.1]
      - [Gaming, 14.3]
      - [Pro Viz, 7.2]
      - [Auto & OEM, 6.4]
  legend: {show: true, position: right}
  series:
    - type: pie
      encode: {category: segment, value: share}
      fill: ["#006BA6", "#00A9F4", "#ED7D31", "#A5A5A5"]
      dataLabels: {show: true, content: percentage, numberFormat: "0.0%"}
      # innerRadius: 0.6  → 甜甜圈
```

水平柱状图（类目轴放 y 侧，encode 翻转）：

```yaml
- elementId: hbar
  elementType: chart
  bounds: [50, 80, 600, 360]
  data:
    cols: [dept, headcount]
    rows:
      - [Engineering, 120]
      - [Product, 45]
  xAxis: {label: {numberFormat: "#,##0"}}
  series:
    - type: bar
      encode: {x: headcount, y: dept}   # x=数值列，y=类目列 → 自动横向
      fill: "#006BA6"
      dataLabels: {show: true}
```

双轴（柱 + 百分比折线）：

```yaml
- elementId: dual
  elementType: chart
  bounds: [50, 80, 700, 420]
  data:
    cols: [month, sales, growth]
    rows:
      - [Jan, 120, 0.10]
      - [Feb, 150, 0.25]
  yAxis:
    - {title: Sales}
    - {title: Growth, label: {numberFormat: "0%"}}
  series:
    - type: bar
      encode: {x: month, y: sales}
      name: Sales
    - type: line
      encode: {x: month, y: growth}
      name: Growth
      yAxisIndex: 1
      smooth: true
```

### 10.8 方言警告：tidy-data 形式**不要写给 CLI**

桌面端编辑器的 deck 生成器（agent 产物）会产出一种 tidy-data 方言：

```yaml
# ⚠️ 仅编辑器 iframe 接受；kimi-slides CLI 报 UnknownField 并跳过该图表
- elementType: chart
  type: bar                       # 顶层 type —— codec 模型里没有这个字段
  data: [{bench: "A", s1: 67.7}]  # 行对象数组
  x: bench
  y: [s1, s2]
  names: [...]
  colors: [...]
```

实测（2026-09-08，Rust CLI 2.2.4）：`check` 报 `UnknownField: y/names/colors` + `Chart element requires data object / series array`；`screenshot` 提示「chart 缺少 series，跳过」——图表静默消失。桌面端编辑器的导出引擎在 pptd→pptx 导出前会把这种形式 reshape 成 codec 形式（`data:{cols,rows}` + `series[]`），但 CLI 不做这件事。

**结论：凡是走 `kimi-slides check/screenshot` 管线的 deck，chart 一律写 §10.1–10.7 的 codec 形式**（`data:{cols,rows}` + 显式 `series[]`，顶层无 `type`）。

### 10.9 CLI 已知渲染限制（官方 SKILL.md 声明）

当前 screenshot CLI 无法渲染：candlestick、treemap、sunburst、sankey、水平柱状图、`xAxis` 数组 + `xAxisIndex` 的图。这些只是截图工具的限制，编辑器/PPTX 导出不受影响。其它已知截图偏差：icon 退化为圆形、渐变文字退化为纯色、部分文字行距与真实渲染有差。

---

## 11. 实证验证记录

Probe deck：4 页（presentation.pptd + pages/page-1..4.page，size [1440,810]；探针件不随包）。

- `kimi-slides check`：零告警零错误。
- `kimi-slides screenshot -o shots --format png`：4 页全部渲染成功，PNG 经逐张目检确认：
  - `shots/pages/page-1.png` — 簇状柱：类目/数值双轴、轴标题、min/max、dot 网格线、柱内数据标签、barWidth 全部生效；
  - `shots/pages/page-2.png` — 3 系列堆积柱（seriesDefaults.bar.stack:value）、底部图例、三色系生效；
  - `shots/pages/page-3.png` — 双系列折线：smooth/虚线/marker/null 断口/数据标签全部生效；
  - `shots/pages/page-4.png` — 饼图：百分比数据标签（content:percentage + 0.0%）、右侧图例、扇区自定义色数组生效。
- 反例验证：临时 PPTD 目录中的 tidy-data 方言 → check 报 UnknownField，screenshot 跳过图表，证实 §10.8。
