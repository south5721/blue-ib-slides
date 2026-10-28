> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# Shape Vocabulary — 图解形状选型词表（IB 策展版）

> 引擎支持 177 个 OOXML 预设形状（全表 = kimi-slides 引擎随附 `reference/shapes.md`，本文件不复制全表）。
> 本文件是**选型纪律 + IB 策展子集**：先定职责再选形状。方法移植自 ppt-master native-shape-authoring
> （见 THIRD_PARTY_NOTICES.md），涂装归 blue-ib token 体系裁决。
> 拿不准某形状的 adjustments 参数时查引擎 shapes.md；本文只给常用默认值。

## 0. 选型纪律（硬规则）

1. **先职责后形状**：先说清这个形状为读者做什么（承载/指向/分组/强调/归纳/连接），再翻词表；矩形/圆角矩形不是默认答案。
2. **语义匹配，非名字联想**：名字或隐喻不是使用证据——`chartPlus/chartStar/chartX` 是分割符号不是图表，`math*` 是数学符号，`actionButton*` 不产生任何动作，scroll 不是「卷轴=方案」的万能容器。形状的几何语义必须与页面关系一致。
3. **预设优先，path 殿后**：177 个预设 + `adjustments` 能表达的轮廓，禁用 `shapeName: custom` 手绘 path——预设形状在 PPT 里原生可编辑（可调黄点），custom 是死路径。只有预设确实表达不了的轮廓（如地图、logo 形）才用 custom。
4. **风格不缩能力**：蓝调风格只决定涂装（fill/border/渐变/阴影），不把任何预设踢出候选。
5. **一个页面一种几何语言**：同页形状族 ≤2 个体系（如 chevron 链 + roundRect 面板），混入第三族要有明确层级理由。

## 1. 按职责选型（IB 策展子集）

### 递进 / 流程 / 步骤
| shapeName | 职责 | adjustments | blue-ib 涂装 |
|---|---|---|---|
| `chevron` | 步骤链节（首尾相接成链） | [50000] V 尖深度 | 渐变 $brand1→$navy 或隔节深浅交替；白字 chipLabel |
| `homePlate` | 步骤链首/尾节、五步箭头标签 | [50000] 尖头长度 | 同 chevron；作标签时白字 bold |
| `pentagon`（正五边） | 一般不用作步骤——它是规则多边形 | — | 勿当 homePlate 用 |
| `rightArrow` / `stripedRightArrow` / `notchedRightArrow` | 大尺度方向/增长动线 | 默认 | $brand1 实色或同色相渐变；单页 ≤1 个大箭头 |
| `circularArrow` / `leftRightCircularArrow` | 单向闭环 / 双向循环 | 默认 | 循环图主轴；$brand2 实色 |

### 循环 / 闭环
| shapeName | 职责 | 涂装 |
|---|---|---|
| `blockArc` | 环形分段（[起始角°, 终止角°, 厚度]，角度×60000）——循环图解的标准节段 | 3–5 段围环，段间留白 8–12°；段色 brand1/brand2/brand3 轮换，中心放结论词 |
| `donut` | 单环底座/占比环（[25000] 环厚） | 浅蓝 $tintPanelDeep 底环 + 前景 blockArc 段 |
| `circularArrow` | 带箭头的循环动线 | 叠在 blockArc 环外缘，$navy |

### 层级 / 金字塔 / 堆叠
| shapeName | 职责 | 涂装 |
|---|---|---|
| `triangle` / `trapezoid` | 金字塔分层（顶层 triangle + 下方 trapezoid 叠层） | 自下而上 brand1→navy 加深或反向；层内白字 |
| `frame` / `halfFrame` / `corner` | 嵌套包含关系（外框套内核） | 描边 $rulePanel 0.75–1.5pt，fill none 或 $tintPanel |

### 对比 / 双向 / 张力
| shapeName | 职责 |
|---|---|
| `leftRightArrow` / `upDownArrow` | 双向权衡、此消彼长 |
| `leftRightUpArrow` / `quadArrow` | 多向发散（慎用，单页至多一处） |
| `diamond` | 决策点 / 象限轴心 |

### 归纳 / 括弧（投行高频）
| shapeName | 职责 | 涂装 |
|---|---|---|
| `leftBrace` / `rightBrace` / `bracePair` | 多行归纳为一点（「这三项合计…」） | $navy 描边 1.5pt，fill none；括号尖指向结论 |
| `leftBracket` / `rightBracket` / `bracketPair` | 区间/分组的硬括弧版本 | 同上 |

### 标注 / 解说
| shapeName | 职责 | 涂装 |
|---|---|---|
| `wedgeRectCallout` / `wedgeRoundRectCallout` / `wedgeEllipseCallout` | 指向型注解（尖角指向被注对象） | $tintPanel 底 + $rulePanel 0.75pt 边；字 bodyDense |
| `borderCallout1`（线+框） | 图内引出标注 | 引线 $chartNeutral，框同上 |

### 标签 / 页签 / 徽章
| shapeName | 职责 | 涂装 |
|---|---|---|
| `plaque` / `plaqueTabs` / `cornerTabs` | 角标式标签、章节页签 | $brand2 实色 + 白字；页签挂面板边缘 |
| `foldedCorner` / `snip1Rect` | 「文档/材料」隐喻的容器变体 | 仅真指文档时用（铁律：语义匹配） |
| `star5` / `irregularSeal1` | 徽章强调（评级/推荐位） | $accent 仅一处；勿与 KPI 大数字争焦点 |
| `bevel` | 立体徽章底座 | 浅用——浮雕感弱于模板光球族（C08） |

### 容器变体（roundRect 之外的合法面板）
| shapeName | 职责 | 涂装 |
|---|---|---|
| `roundRect` | 标准面板（铁律 6：adj ≤16667）/ chip（adj 50000） | 主面板体系 |
| `round1Rect` / `snipRoundRect` | 单侧圆角/切角面板——做「有方向的书页」 | 与 roundRect 不同页混用需理由 |
| `snip1Rect` / `snip2SameRect` | 切角面板（报告/票据感） | 同 tintPanel 体系 |

### 真流程图（仅当内容真的是流程图）
`flowChartProcess`（矩形步骤）、`flowChartDecision`（菱形判断）、`flowChartTerminator`（圆角起止）、`flowChartConnector`（连接点）——只在画合规/审批/操作流程时用；不用来做装饰性「伪流程」。

## 2. 禁/慎清单

- **禁** `actionButton*`（无动作语义）、`math*`（除非真算式）、`chartPlus/chartStar/chartX`（分割符号）。
- **慎** `smileyFace/heart/sun/moon/cloud/lightningBolt`——字面隐喻才用（cloud 仅指云业务/上云，lightningBolt 仅指电价/速度）。
- **慎** 星爆族 `star8+ / irregularSeal2`：爆炸贴气质与投行版面冲突；强调优先用 $accent 文字与徽章卡（C16），不甩星爆。
- 连接器语义：直线关系用 `line` 元素（可带箭头端）；`bentConnector` 类预设不在 177 表内，折线连接用多条 line 或 custom path 殿后。

## 3. 涂装通则（所有形状）

- fill：实色走 5 档品牌蓝 / $tintPanel 系 / $accent 仅强调点；渐变仅同色相 90°/45°（铁律 4）。
- border：$rulePanel 0.75pt（白面板标准）/ $navy 1.5pt（括弧、框线）；禁黑灰粗描边。
- 阴影：仅蓝系弥散柔影 alpha≤15%（铁律 5），形状默认无影。
- 字：形状内文字居中，chipLabel/bodyDense 档；深底白字、浅底墨字，on-dark 强调恒 $accentOnDark。
- 形状内文字与形状**分两个元素**写（text 叠在 shape 上），便于 qa 宽度闸与二次编辑——除非文字就是形状标签且单行短词。
