> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# Design Tokens — blue-ib-slides（PPTD 1440×810 坐标系）

> 源：87 页授权参考模板的结构与视觉测量，已抽象为本文件 token；原始证据文件不随公开包分发。
> 所有 page 文件只允许出现这里的值；颜色一律用 `$变量` 引用 theme（见 `assets/theme.pptd`）。

## 🔖 取节索引（**按节查，勿整读本文**）

用到哪节取哪节（`## ` 级节名精确匹配）：

```bash
D=$SKILL_DIR/reference/design-tokens.md
sed -n "/^## 颜色/,/^## 字阶/p" $D        # 取颜色全表
sed -n "/^## 字阶/,/^## 形态规范/p" $D    # 取字阶白名单 + textStyles
sed -n "/^## 形态规范/,/^## 页面网格/p" $D # 取圆角/渐变/阴影/线宽闸值
sed -n "/^## 页面网格/,/^## 图表颜色语义/p" $D # 取 chrome 几何 + 分栏 pitch
sed -n "/^## 图表颜色语义/,\$p" $D         # 取 chart 配色语义
```

小节：`画布` · `颜色` · `字阶` · `形态规范`（圆角/渐变/阴影/线宽） · `页面网格`（L04 chrome + 分栏 pitch） · `图表颜色语义`

## 画布

- 1440 × 810（16:9，13.333in × 7.5in，导出 pptx 后 1px = 0.6667pt）
- 页边距：左 45.2 / 右 43.9（右缘 1396.1），上 ~8.5，下 ~746 起为底部保留带（页码/发丝线/logo）
- 内容宽：**1351**（45.2..1396.1）。出血件仅限：banner / KPI 带 / 封面背景（铁律 9）
- 主网格实测：左缘 45.2（×27 页）/ 右缘 1396.1（×28 页），左右基本对称（layouts.md:L136–142）

## 颜色

### 纸墨

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $dk1 | #000000 | 极少用（标题黑变体） | tokens.md:L55 |
| $lt1 | #FFFFFF | 纸面 / on-dark 文字 / 白面板 | tokens.md:L17,L50 |
| $inkBody | #404040 | 正文主墨色（n=1801，中位 14pt——模板实测记录；现行正文基准 16，见字阶节裁决注） | tokens.md:L49 |
| $inkTitle | #2F2F2F | 页面标题黑（32pt 档） | tokens.md:L53、layouts.md:L48 |
| $inkSecondary | #5A5A5A | 页码/注释灰 | tokens.md:L56、layouts.md:L53 |

### 品牌蓝 5 档 + 标题/条目蓝（原模板 10+ 近似蓝归并，tokens.md:L67）

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $brand1 | #3865BB | 主蓝：装饰、chevron、大色块、chart 主系列 | tokens.md:L16（fill ×100） |
| $brand2 | #3477C7 | chip/徽章填充蓝 | tokens.md:L19（fill ×28） |
| $brand3 | #0C75CB | 亮蓝：通栏 banner、KPI 带、圆点 | tokens.md:L20；banner 实测 layouts.md:L49 |
| $brand4 | #0070C0 | 深蓝 banner 变体、标题下划线 | tokens.md:L22 |
| $navy | #063F8E | 深 navy：chart 轴、面板描边、深蓝面板、投影色 | tokens.md:L37,L83 |
| $titleBlue | #3570C0 | 页面标题蓝（32pt 档专用） | tokens.md:L57（93 run 全在 32–36pt） |
| $itemBlue | #3577C7 | 条目名/小标题蓝（浅底上） | tokens.md:L52 |

### 面板体系

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $tintPanel | #EDF2F8 | 浅蓝 tint 面板（蓝字 chip 底） | tokens.md:L27 |
| $tintPanelDeep | #D6E4F7 | 浅蓝底板（≈accent1 lumMod20/80；C15 恒最底层） | tokens.md:L68 |
| $rulePanel | #5B9BD5 | 白面板标准蓝边框（0.75pt） | tokens.md:L36（线条色 ×72） |

### 强调（双强调制——浅底橙 / 深底黄，与 K 体系相反：橙可作文字色）

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $accent | #FF7829 | 浅底关键词强调橙：**可作文字色**（正文内嵌高亮、面板小标题） | tokens.md:L51（790 run） |
| $accentDeep | #ED7D31 | 标题前缀橙（双色标题：橙前缀 + 黑 $inkTitle） | tokens.md:L59、layouts.md:L78 |
| $accentOnDark | #FFC000 | 深蓝底上的强调黄（数字/关键词，**on-dark 专用**） | tokens.md:L54、layouts.md:L50 |
| $positive | #00B050 | 正向/达成（仅语义） | tokens.md:L62 |
| $negative | #C00000 | 风险/负增量（仅语义，瀑布负柱也用） | tokens.md:L41,L63 |

**双强调纪律**：单页强调色（$accent/$accentDeep/$accentOnDark）≤2 种（铁律 3；qa `dual_accent_limit`）；on-dark 大数字恒黄、浅底强调恒橙（qa `dark_text_gold`）。

### chart 中性色 / 封面专用

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $chartNeutral | #BFBFBF | 别家/参考系列灰；底部发丝线灰 | layouts.md:L233（chrome-bottom-rule 定稿值） |
| $coverTitleBlue | #155D9E | 封面大标题蓝 | layouts.md:L16（p1 实测 34.65pt） |
| $tocActive | #0A579B | 封面目录当前条目蓝 | layouts.md:L16 |
| $tocInactive | #A6A6A6 | 封面目录非当前条目灰 | layouts.md:L16 |

### 渐变端点（同色相明度渐变用，禁跨色相）

| token | hex | 用途 | 实测出处 |
|---|---|---|---|
| $gradChipLight | #5492DC | chip/面板渐变亮端 | tokens.md:L18（fill ×38） |
| $gradParalFrom | #5A80CD | 平行四边形标签渐变亮端（→$gradParalTo 45°） | layouts.md:L70（p65 卡头实测） |
| $gradParalTo | #2F5192 | 平行四边形标签渐变暗端 | layouts.md:L70 |
| $gradUnderlineFrom | #00B0F0 | 标题下渐变短条亮端（青，→$gradUnderlineTo 0°） | layouts.md:L219（取色自截图 p7/p65 位图） |
| $gradUnderlineTo | #2E75B6 | 标题下渐变短条暗端（蓝） | layouts.md:L219 |
| $onDarkChip | #3577C7 | 深蓝面板内嵌胶囊（同 itemBlue，独立名区分语义） | DECISIONS §1 定案 |

**调色板封闭**：page 里颜色必须解析到 palette（含渐变 stop、fillRef 展开后），禁游离蓝（原模板蓝色长尾 53 种已归并，tokens.md:L30,L142；qa `palette_closed`）。

## 字阶（1440 系 px；pt = px × 0.6667）

> **字阶白名单铁律（DECISIONS §2）**：字号必须 ∈ **10 / 11 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32 / 36 / 40 / 44**——
> 实测主峰（占比 87%，tokens.md:L106–120）：10–18 每 +2（正文密度区）、18–32 每 +4（标题区）、32+ 每 +8~12（展示区）。
> 跳档外的字号（13.35/10.65 等）全是 WPS 组缩放痕迹，不是独立档（tokens.md:L118）。qa `font_scale_whitelist`（error）。
>
> **最小字号 10**（仅页码/独立微标签）；**正文 16**；**dense 14**。
>
> ⚠️ **2026-10-19 用户验收裁决（新体系标准）**：正文基准整体上抬一档——body 14→**16**、bodyDense 12→**14**、bodyEmphasis 14→**16**、caption 11→**12**、itemTitle 12→**14**、chipLabel/chipLabelGold 14→**16**、tableBody 12→**14**（数字本体 statNumeral 24 / statOnDark 32、bannerText 24、pageTitle 32、pageno/footer 12 不变）。模板实测主峰（12/14）保留下行作历史记录，不再作写页基准。
>
> **字体全 deck 统一**：`fontFamily: Arial, 微软雅黑`（latin, ea 双值写进 theme，无需后处理脚本）。
> **无衬线、无楷体**——模板 theme12/17 的华文楷体是孤族，不克隆（tokens.md:L124–126；qa `font_family_discipline`：Georgia/楷体/宋体 error）。

| token | px | 字重 | 用途 |
|---|---|---|---|
| coverH1 | 36 | 700 | 封面大标题（$coverTitleBlue） |
| dividerNum | 44 | 700 | 隔页章节号（$brand1） |
| dividerH | 40 | 700 | 隔页章节名（$titleBlue） |
| pageTitle | 32 | 700 | 页面标题（$inkTitle / $titleBlue / $accentDeep 前缀+黑 三制） |
| statOnDark | 32 | 700 | 深底大数字（$accentOnDark，KPI 带） |
| bannerText | 24 | 700 | 通栏观点句（白 + 关键词黄） |
| statNumeral | 24 | 700 | 浅底大数字（$brand1） |
| sectionLabel | 16 | 700 | 橙色小节标 |
| chipLabel / chipLabelGold | 16 | 700 | 蓝 chip 内白字 / 深蓝 chip 内黄字（2026-10-19 上抬） |
| body / bodyEmphasis | 16 | 400/700 | 正文 lh 1.25 / 内嵌橙词（2026-10-19 上抬） |
| tableHeader | 14 | 700 | 蓝底表头白字 |
| pageno | 12 | 400 | 左下页码（实测 13.35 系缩放痕迹，定稿 12，layouts.md:L274） |
| itemTitle | 14 | 700 | 蓝色条目名/小标题（2026-10-19 上抬） |
| bodyDense / tableBody | 14 | 400 | 密排正文 / 表格单元格 lh 1.25（2026-10-19 上抬） |
| caption | 12 | 400 | 注释/来源（2026-10-19 上抬；封面副题行用 16 档 $inkSecondary，见 layouts.md L01） |

规则：双色标题、banner 内黄字强调是原生特征，不报警；同行元素字阶同源；标题 align 恒 [left, middle]。

## 形态规范（替代 K 铁律 7；qa `shape_rules` 闸值）

| 维度 | 合法 | 禁止 | 实测依据 |
|---|---|---|---|
| **圆角** | chip/徽章 = 胶囊（roundRect adj=**50000**）；面板 = 小圆角（adj **4000–16667**） | round1/round2 异形圆角 | 胶囊 adj50000 ×265 最主流，tokens.md:L89–95 |
| **渐变** | 仅**同色相明度渐变**（含同色渐变=纯色），方向 **90° 或 45°**；文字渐变填色合法（闸放行 gradFill stop 色） | 跨色相渐变、径向渐变 | 83/87 页有渐变、≈1/3 同色，90°×598/45°×362 主导、无径向，tokens.md:L74–79 |
| **阴影** | 仅**蓝系弥散柔影**：outerShdw 色 ∈ 蓝族（brand1/brand2/navy/gradChipLight 系），blur 20–32pt（pptd 30–48），alpha **≤15%**，dir 90° | 黑/灰硬阴影；**文字阴影** | 83/87 页阴影全蓝系、文字阴影实测 0，tokens.md:L81–87 |
| **线宽** | 面板/分隔 **0.75pt** 标准；强调 1–1.25pt；发丝底线 0.5pt | — | 0.75pt ×3385 绝对主导，tokens.md:L43 |

## 页面网格（L04 内容页）

```
y=8.5     chrome-title（32pt，[45.2, 8.5, 1350.9, 60]，必备）
y=104.0   chrome-title-accent 渐变短条（可选，[36.4, 104.0, 202.3, 4.4]）
y=136.2   chrome-banner 观点横幅（可选高频，[-4.3, 136.2, 1448.7, 73.7] $brand3）
y=143.1   chrome-banner-text（[0, 143.1, 1451.8, 63.5] 居中，白+黄）
y=210..740  展区（有 banner） / y=120..740（无 banner）；x 45.2..1396.1
y=681.3   chrome-kpi-band（可选变体，[0.1, 681.3, 1437.6, 73.4] $brand3 + 5 格）
y=746.0   chrome-bottom-rule 发丝线（可选，[43.5, 746.0, 1359.8, 0] 0.75pt $chartNeutral）
y=756.5   chrome-logo（可选，[1221.0, 756.5, 186.3, 50.8]，恒用占位符）
y=769.5   chrome-pageno（必备，[41.0, 769.5, 79.5, 24.2] 12pt 左下）
```

隔页/封面 0 chrome（页码也不带）。chrome 8 件 = 必备 2 + 可选 6，逐个几何/可选性见 `reference/layouts.md` L04。

### 分栏网格（实测 pitch，layouts.md:L147–156）

| 配方 | 栏 x（pptd） | 栏宽 | pitch / gap |
|---|---|---|---|
| 2 栏 | 左 45.2 起；右栏 x≈735.6 | ≈650 / 669.5 | **分界 ≈ x715** |
| 3 栏卡片 | 46.5 / 500.6 / 970.6 | 382–424 | gap ≈40 |
| 3 栏 chip 列（右区内） | 396.0 / 739.0 / 1089.0 | 289.9 | pitch ≈342–343 |
| 4 栏 pill | 88.0 / 439.7 / 777.5 / 1140.5 | 206.7 | pitch ≈334–352 |
| 4 栏平行四边形卡头 | 83.5 / 424.3 / 774.5 / 1127.0 | 254.2 | pitch ≈341–352.5，gap ≈87–98 |
| KPI 5 格底带 | 10.0 / 310.5 / 600.3 / 849.8 / 1120.8 | ≈250–290 | pitch ≈295 |

## 图表颜色语义（DECISIONS §6）

- **主系列/实际值 = $brand1**；第二系列 = $brand2 或 $brand3
- **估计/预测/强调 = $accent 橙**（qa `chart_color_semantics`：名字含估计/预测/E 却填灰 → error）
- **别家/参考 = $chartNeutral 灰**；**负增量 = $negative 红**；**正向标注 = $positive 绿**
- 主数据全灰 → 应 $brand1（同闸）
- codec 纪律（方言、dPt 丢色→系列级 fill、瀑布手工 3-series proxy、axis show:false 禁令、系列名禁纯数字、组合图柱禁 dataLabels）沿用渲染链事实，与设计无关
- 图表标题永远外部 text 元素；轴/网格纪律同渲染链（polish-pptx 剥网格线）
