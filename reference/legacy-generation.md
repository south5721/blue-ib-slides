# Generation — 内容规划 → 本渲染层的桥接

> **内容规划层 = 内置 kimi-slides 需求流程（step1–step2）+ 本 skill 内容纪律**：需求理解、输入类型、页数确认走 kimi-slides；deck 范式 / 核心分歧 / 页纲 / 每页内容卡 / data registry 的口径按本文件与 SKILL.md 第 0–2 步执行。本文件保留 renderer 耦合的两段：message→recipe 选型速查 + 逐页节点 QC。设计权威 = SKILL.md 十条铁律。

> **v2 起，页纲冻结前先过 `reference/planning.md`**：策划契约六要素（tone/mode/audience/purpose/action/core）、页面节奏列（anchor/dense/breathing）、每页内容卡首行「关系声明」、Fact ID 台账、封面/收尾 impact——该层产物全部落 PLAN.md，qa.mjs 策划闸（warn 级）兜底。

> **讲话场景（领导讲话/工作会议 → PPT）先读 `reference/speech-deck-writing.md`**：页型序列（照片封面→保密提示→morphing 隔页→内容簇→照片收尾）、标题双段式（覆盖主体系铁律 2）、压缩率 0.5–0.6、信披打星纪律、checklist 15 条——命中覆盖条款以该文件为准。

## 1. 语义路由（内容卡 → 构件组合）

**路由单元是语义，不是 pattern。** 内容页（L04）选件流程：

0. **先读内容卡首行的「关系声明」**（planning.md §4：递进/循环/层级/对比/汇聚/辐射/收敛/分解/时序/份额/桥/画像/罗列）——结构关系查 `reference/diagrams.md` §1 三级路由总表得拓扑与首选构件（含 D01–D03 图解配方）；数据关系（时序/份额/桥/分布）走 charts.md「选型总图」（33 型三档闸口：✅ 原生 / 🔧 proxy / ⛔ 不支持）。
1. 从内容卡提取语义信号：**论证动作**（对比/分解/收敛/递进/罗列…）+ **数据形态**（时序/桥/份额/漏斗/事件/画像/定性…）+ **证据类型**（披露/估计/调研）。
2. 按信号匹配 `reference/manifest.json` 条目的 `semantics` / `data_shapes` 字段得到候选构件——manifest 是机读权威基准，查单条目用 `python3 -c "import json;[print(e) for e in json.load(open('reference/manifest.json'))['entries'] if e['id']=='C06'"`，不必全读。
3. 用条目的 `slot` / `composes_with` / `conflicts_with` 校验组合：band-full 独占展区主位；band-column 可双栏共存；band-strip 每页 ≤2 条；inline 不占槽位；互斥对（如 C03↔C04、C08↔C09/C10/C06、C02↔C11、C07↔R5）不同页。
4. 选中构件的内部构造**永远**照 `components.md`/`charts.md`/`diagrams.md` 的 canonical 配方写——**组合自由，构造不自由**。组合合法性由 manifest 契约约束（composes_with 非穷尽、任一侧命中即合法；清单外组合按 slot/conflicts/密度裁决，首次走出后回补），页面质量由 qa 门（qa.mjs + 节点 QC 七问）最终裁决。
5. **形状级拼装**（构件覆盖不到的图解）查 `reference/shape-vocabulary.md`：先职责后形状、语义匹配非名字联想、177 个 OOXML 预设优先于 custom path（预设原生可编辑，path 是死路径）。

**chrome 先于构件**：每页 L04 先定 chrome——title（32pt 动作标题，$titleBlue 整行 / $accentDeep 前缀+$inkTitle 双色 / $inkTitle 黑三制）→ 要不要 title-accent 渐变条 → 要不要 banner（**有本页核心结论句才挂**，banner 文案 = 含数字+判断的结论句，`banner_text_viewpoint` 闸）→ 展区 → chrome-pageno。只有展区变化（铁律 1）。

**结构页不参与路由**：L01 封面 / L02 目录 / L03 隔页是 fixed 布局，骨架照抄 `layouts.md` + 对应 example，只换文案；内容份数随实际变化（目录 4–6 行），骨架不许重构。**L02 目录条目每条必须是含数字+判断的完整句（铁律 2 同级），禁拿话题/栏目名充数**（`toc_msg_viewpoint` 闸兜底）。

**不同公司不该长得一样**：同一 message 类型可以合法走出不同组合（如「业务构成」= C02 三列卡，也可以是 R3 堆积柱+T2a 表、R5 饼环+左栏表）——按该公司的数据形态和论证需要选，别默认套上一套的版式。

### 常见语义起点（默认值，非强制路由）

覆盖 80% 常见场景的默认起点；表外语义组合合法，按上面的 manifest 契约走。

| message 类型 | 首选版式/组件 |
|---|---|
| 本页核心结论定调 | L04 + C01 banner（结论句含数字+判断，关键词 $accentOnDark） |
| 3–5 并列业务线/支柱 | L04 + C02 药丸徽章卡阵列（3–5 列网格） |
| 投资逻辑递进/步骤 | L04 + C03 chevron 燕尾标签行（3–5 行） |
| 里程碑/募投节奏 | L04 + C04 时间轴（≤8 节点）+ C05 KPI 带收口 |
| 关键数字一览 | C05 KPI 通栏数字条（≤6 格，深底黄字） |
| 两方对比/AB 方案 | C06 奖章对比盘 或 T2a 形状拼装表 |
| 池子多大、增速 | R1 柱图（$brand1 实际 vs $accent 估计）+ 旁栏要点 |
| 从 A 到 B 的桥/增量分解 | R2 瀑布 proxy + T2a 假设表（+/− 在表里） |
| 份额/结构时序变化 | R3 堆积柱 + 柱顶合计标；截面份额用 R5 饼环（≤6 段）+ 左栏表 |
| 金额+比率双指标 | R4 柱线双轴（柱 $brand1/$accent、线 $navy） |
| 核心概念/中心思想 | C08 光泽球体 + 右侧 C03 两行要点（或 C16 图标徽章列） |
| 转化/筛选收敛 | C09 漏斗 + 上下说明卡 |
| 多输入汇聚结论 | C10 流程方块+枢纽圆 |
| 能力/原则图标列 | C11 图标列+椭圆底座 或 C16 徽章列 |
| 总部→分支/布局 | C13 中心辐射+点阵地图 |
| 结构化参数/打分矩阵 | T2a 形状拼装表（表头渐变钮 + 浅蓝单元格） |
| 目录/章节过渡 | L02（chip+观点句）/ L03（大章节号+底部蓝带） |

## 2. 写完一页就走一次「节点 QC」

**节点 QC = 每页交付前的固定七问**（对应 qa.mjs 机械闸 + 截图目检 + 语义自检），外加两条——**页内连续性**：title（判断）→ banner（结论句）→ 展区 block（证据）读得通吗，题文不符/banner 复述标题/block 与论点无关即回炉；**页纲对照**：本页还在页纲清单上吗（防中途慢漂移）：

1. 标题 32pt bold、含数字+判断、≤2 行？banner 文案是结论句不是话题？（chrome_complete/title_render_lines/banner_text_viewpoint）
2. chrome 必备两件齐（chrome-title + chrome-pageno）、位置在容差内？（chrome_title_position/chrome_pageno_position/title_align）
3. 字号全在白名单 {10,11,12,14,16,18,20,24,28,32,36,40,44}、≥10？（font_scale_whitelist/min_font）
4. 颜色全部解析到 §1 token（含渐变 stop、fillRef 展开后）？单页强调色 ≤2 种、深底大数字恒黄、浅底强调恒橙？（palette_closed/dual_accent_limit/dark_text_gold）
5. 形态合规：圆角两档（胶囊 50000/面板 ≤16667）、渐变仅同色相 90°/45°、阴影仅蓝系柔影 alpha≤15%、无文字阴影？（shape_rules）
6. 图表：原生 chart、gridLine 全 false、轴保活隐藏、瀑布闭合、组合图无柱 ctr 标签、无 0 值段、类目标签无数值、语义色正确（实际 $brand1/估计 $accent/别家灰/负增红）？（H 规则机械闸）
7. 密度：本页独立 data point 足够（IC 档目标元素中位 ~70），还是一张图拉伸撑场面？bullet 用字面「· 」或 ellipse 圆点、无 ul/li？（page_density/page_sparse）

七问全过后，才允许写下一页。
