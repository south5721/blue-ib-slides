> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# Components — C01–C18 + T2a 构造配方（canonical 重构版，1440×810）

> 唯一权威输入：SKILL.md 十条铁律 + `design-tokens.md`（调色板 / 字阶 / 形态规范）与 `manifest.json`（构件清单）。几何为实测取整后的干净数字；颜色一律 $token（解析到 §1 调色板，禁游离 hex）；文字样式引用 §2 textStyle 名。构造规则抽象自授权参考模板，原始证据文件不随公开包分发。

## 🔖 取节索引（**勿整读本文**）

选哪个构件走 `reference/manifest.json` 的 `semantics`（唯一选件基准）；定好 ID 后只取那一节：

```bash
D=<skill根>/reference; C=C08      # C 换成你要的 ID（T2a 直接 C=T2a）
sed -n "/^## 通用纪律/,/^## 反模式/p" $D/components.md            # 恒取
sed -n "/^## 反模式/,/^## C01 /p" $D/components.md               # 恒取
sed -n "/^## ${C} /,/^## [CT][0-9]/p" $D/components.md           # 目标配方（T2a 用 /^## 附/ 收尾）
```

⚠️ **`通用纪律` 与 `反模式` 对任何构件都成立，取任一 C/T2a 时必须一并取**。数据图表类需求不在本文——原生 chart 配方在 `charts.md`（R1–R5），构件与图同页时两边各取各的。

小节：`通用纪律` · `反模式` · `C01` 通栏观点横幅 · `C02` 药丸徽章卡片阵列 · `C03` chevron 燕尾标签行 · `C04` 圆节点时间轴 · `C05` KPI 通栏数字条 · `C06` 奖章对比盘 · `C07` 3D 光泽环形 · `C08` 光泽球体 · `C09` 漏斗 · `C10` 流程方块+枢纽圆 · `C11` 图标列+椭圆底座 · `C12` 平行四边形标签 · `C13` 中心辐射+点阵地图 · `C14` 原子轨道装饰 · `C15` 浅蓝底板 · `C16` 图标徽章 · `C17` 仪表盘图标 · `C18` 装饰图片族 · `T2a` 形状拼装表

## 通用纪律

1. **取色要展开 fillRef 思路**：原模板大量颜色藏在 `p:style/fillRef` 引用里（spPr 看不到 fill），实测已把它们全部展开归并进 §1 调色板——写页时**只写 $token 名**，任何 hex 都必须能解析回 §1 的 31 个 token（含渐变 stop、HEX8 带 alpha 的基色）。没有对应 token 的颜色就是取错了，回去重查。
2. **渐变仅同色相明度渐变**（同色相深浅变化，含同色渐变=纯色的特例），方向 90°（上→下）或 45°；禁跨色相渐变、禁径向渐变。**文字渐变填色合法**（`content.gradient`，如标签 run 用 $brand1→$navy）——qa `palette_closed` 对渐变 stop 色放行，不只看 solidFill。
3. **阴影仅蓝系弥散柔影**：`shadow: {blur: 30–48, color: "#3865BB26"（≤15% alpha 的蓝族 HEX8）, offset: [0, 4]}`，色 ∈ 蓝族（$brand1/$brand2/$navy/$gradChipLight 系）；禁黑/灰硬阴影；**禁文字阴影**。
4. **圆角两档**：chip/徽章 = 胶囊 `roundRect, adjustments: [50000]`；面板/卡片 = 小圆角 `adjustments: [4000]–[16667]`；**禁 round1Rect/round2* 异形圆角**。
5. **bullet 用字面「· 」或 ellipse 圆点，禁 `<ul>/<li>` 原生列表**（codec 落地圆点小一半且书写层不可控）：正文条目行首写字面 `· `（可给 run 上色），或用 9×9 ellipse 圆点 shape 与文本框配对。
6. **icon 一律用 `assets/media/icons/` 白字形（SVG/PNG）叠蓝圆底**：MS 系白 icon 不允许裸放在白底上，必须配 C16 的蓝圆/胶囊底 shape；图标摆放尺寸 = 底圆直径的 55–60%。禁用 emoji 充 icon。
7. **字阶白名单**：fontSize ∈ {10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44}；最小 10（仅页码/微标签）；正文 16、 dense 14（2026-10-19 用户验收裁决上抬）。字体恒 `fontFamily: {latin: Arial, ea: 微软雅黑}`，全 deck 无第二字体。
8. **元素序即绘制序**：C15 底板/面板类恒最先写（最底层）；文字/图标恒在其底 shape 之后写。text 被后画的实色 shape 盖住 = `z_order_cover` error。
9. **line 元素画发丝线**：0.5–0.75pt 分隔线一律 `elementType: line`（custGeom 路径+stroke），不用 rect 填充冒充（`rule_as_rect` 闸）。
10. **半调点阵类装饰不逐形状重构**（见反模式 1）；需要点阵质感时用 `assets/media/` 的对应图片。
11. **命名约定**（克隆 qa 锚点，沿用模板机读名）：内容白底内容条 = `ComponentBackground1`、列标题胶囊 = `Title`、编号胶囊 = `Number2`、条目胶囊 = `Bullet1`；构件内 elementId 统一 `<构件小写>-<件名>-<序>`（如 `c02-card-1`）。
12. **品牌中立**：禁任何真实公司 logo/商标；logo 位恒用 `assets/media/logo-placeholder.png`。

## 反模式

1. **半调点阵箭头（» 形页眉装饰）不重构**——原模板是 ~144 个 1.6–5.9 pptd 的 custGeom 微菱形拼成，逐形状克隆不可行；需要时整体省略（v1 默认省略），不得以 50+ 微 shape 组页。
2. **禁手绘数据图**：任何「数值大小映射到形状尺寸」的图都必须走原生 chart（charts.md R1–R5）；shape 拼的「假柱图」是 error 级（铁律 8）。
3. **禁跨色相/径向渐变、黑灰硬阴影、文字阴影、round1/round2 异形圆角**（`shape_rules` 闸，铁律 4/5/6）。
4. **禁 stripedRightArrow 依赖**：原模板 C04 载带用 stripedRightArrow，渲染链支持不稳；canonical 用 `rightArrow` + $tintPanelDeep 填充近似（视觉差 = 无斜纹，可接受）。
5. **禁把卡片写成「灰底框+白格」重边框构造**：本体系卡片 = 浅蓝渐变底 + 0.75–1pt $navy/$rulePanel 细边 + 可选蓝柔影，不是封闭粗框。
6. **custGeom 微形状集合不克隆**：线框图标组（5–9 笔 custGeom）一律改用 C16 白字形 icon；漏斗三角等**单个**简单 custGeom 可用 `shapeName: custom` + SVG path 重建，超过 3 个路径件的装饰组改用图片或省略。
7. **禁主题色字面抄模板 theme**：模板 theme 声明的红/藏青全模板 0 次使用；取色以 §1 调色板为准，不写模板 theme 里的游离色。
8. **强调色单页 ≤2 种**：$accent/$accentDeep/$accentOnDark 同页最多出现 2 种（`dual_accent_limit` warn）；on-dark 大数字恒 $accentOnDark、浅底强调恒 $accent（`dark_text_gold` warn）。

## C01 — 通栏观点横幅（header band）

- **语义路由**：页面核心结论/长标题句需要通栏强调；banner 文案 = 本页核心结论句（**含数字+判断**，铁律 2）。
- **data_shapes**：qualitative
- **组合**：C02 / C03 / C15 / T2a；**冲突**：无（但与 chrome-kpi-band 同页时合计色带 ≤2 条）。
- **hard_constraints**：
  - 底条 `rect [0, 136.2, 1440, 73.7]`（全宽；模板实测出血值 -4.3/1448.7，canonical 取页宽内等价几何）solid $brand3；变体 $brand4 或 90° 同色相渐变（$brand3→$brand4）
  - 文案层 `text [0, 143.1, 1440, 63.5]` `$bannerText`（24pt 白 bold）居中 middle，关键词 `<span style="color:$accentOnDark">` 黄字强调；一行放不下降 20pt，禁两行以上
  - 有 banner 时展区从 y≈220 起；标题仍 32pt 于 chrome-title 位
- **构造步骤**：① 写 chrome-banner rect → ② chrome-banner-text 叠上（元素序在 rect 后）→ ③ 文案按「数字+判断」写，关键词上黄。

```yaml
  - elementId: chrome-banner
    elementType: shape
    bounds: [0, 136.2, 1440, 73.7]
    shapeName: rect
    fill: { type: solid, color: $brand3 }
  - elementId: chrome-banner-text
    elementType: text
    bounds: [0, 143.1, 1440, 63.5]
    content:
      text: "<p>2027E 收入 <span style=\"color:$accentOnDark\">810GWh</span> 五年 4.4 倍，第二曲线贡献过半</p>"
      wrap: true
      align: [center, middle]
      style: $bannerText
```

## C02 — 药丸徽章圆角卡片阵列（pill-badge card array）

- **语义路由**：3–5 个并列实体（业务线/产品/策略支柱），各带小标题+副题+要点列表；最通用的「分栏并列」构件。
- **data_shapes**：comparison, qualitative
- **组合**：C01 / C15 / C16（卡内 icon）；**冲突**：C09 / C10。
- **hard_constraints**：
  - 列网格（x 左缘）：3 列 45/500/955 宽 420；4 列 45/390/735/1080 宽 316（栏 gap 29）；5 列 45/315/585/855/1125 宽 270；gap≈35；卡高按内容顶到展区底（有 banner 250..720，无 banner 150..710，底缘留 ~24 呼吸位），顶 y 由 chrome 决定（有 banner ≥240，无 banner ≥150）
  - 卡：`roundRect, adjustments: [9000]`（小圆角，禁大圆角），fill 90° 渐变 $tintPanel→$tintPanelDeep，border 0.75pt $navy，shadow 蓝柔影（blur 40 / #3865BB26）
  - **徽章悬贴（2026-10-20 用户终裁：去叠层）**：徽章（`Title` 胶囊）roundRect adj 50000，206×52，solid $brand2，**完全位于卡片顶缘之上——徽章底 = 卡顶 y − 11（间隙 10–12），水平居中不变，z 序在卡之后；禁吊坠小 chevron**；内文 $chipLabel 白（16–20pt 按徽章宽）。注意版面让位：title-accent 页卡顶 ≥172（徽章底 ≥161 避 104 渐变条）；banner 页卡顶 ≥275（徽章顶 ≥212 避 banner 底 210）。~~骑缝式~~（徽章中心=卡顶、徽章下吊坠 chevron）留档为历史 variant，不再作 canonical
  - 副题：16pt $accent bold 居中（y = y_card + 70）+ 下划线条 42×2.5 solid $gradChipLight（y = y_card + 98）
  - **卡内填满**：**4 组 bullet**（自 y_card + 122 起均分到卡底 −24），每组 = 蓝色渐变圆点 ellipse 10×9（90° $gradChipLight→$brand2，**不用字面「·」**）+ 文本框（圆点右 +19）：蓝色条目名 $itemBlue bold 起头、$bodyDense 14pt lh 1.3 正文、关键词 run $accent
- **构造步骤**（每列）：① 卡 roundRect → ② 徽章胶囊+文字（z 序在卡后） → ③ chevron → ④ 副题 text + 下划线 rect → ⑤ 4 组（圆点 ellipse + 条目文本）。

```yaml
  - elementId: c02-card-1
    elementType: shape
    bounds: [45, 250, 420, 470]
    shapeName: roundRect
    adjustments: [9000]
    fill:
      type: gradient
      gradientType: linear
      angle: 90
      stops:
        - { position: 0, color: $tintPanel }
        - { position: 1, color: $tintPanelDeep }
    border: { style: solid, width: 0.75, color: $navy }
    shadow: { blur: 40, color: "#3865BB26", offset: [0, 4] }
  - elementId: c02-badge-1
    elementType: shape
    bounds: [152, 176, 206, 52]        # 悬贴：底 228 = 卡顶 250 − 22（gap 11×2 侧）；z 序在卡之后
    shapeName: roundRect
    adjustments: [50000]
    fill: { type: solid, color: $brand2 }
  - elementId: c02-badge-txt-1
    elementType: text
    bounds: [152, 224, 206, 52]
    content: { text: "<p>动力电池</p>", wrap: false, align: [center, middle], style: $chipLabel, fontSize: 20 }
  - elementId: c02-dot-1a
    elementType: shape
    bounds: [65, 377, 10, 9]            # 第 1 组圆点（y_card+122+5）
    shapeName: ellipse
    fill:
      type: gradient
      gradientType: linear
      angle: 90
      stops:
        - { position: 0, color: $gradChipLight }
        - { position: 1, color: $brand2 }
```

## C02b — 深蓝卡变体（navy card + chip 矩阵，模板 p63 版式）

- **语义路由**：同 C02 的并列分栏，但内容天然是「标签集合」（机制清单/动作细目/关键词矩阵）；比浅卡更重磅，一节 deck 至多一页。
- **data_shapes**：comparison, qualitative, chip_matrix
- **组合**：C01 / C15；**冲突**：C09 / C10 / C02（同页不混浅深两套卡）。
- **hard_constraints**：
  - 卡：roundRect adj 9000，solid $navy + 蓝柔影，无边；列网格同 C02
  - 徽章悬贴同 C02（底 = 卡顶 − 11，禁吊坠 chevron），但胶囊用 90° 渐变 $gradChipLight→$brand1、内文 $chipLabel 白 + $accentOnDark 关键词
  - 卡内 = 白点（ellipse 10×9 solid $lt1）+ 条目名（$chipLabel 16pt 白 bold + $accentOnDark 关键词，y_card+70 起）+ **2 列半透明蓝 chip 矩阵**
  - chip：roundRect adj 20000，174×48，solid $onDarkChip，白字 14pt（$chipLabel 覆盖）；2 列 x = x_card+24 / x_card+222，行距 62，2×2 或 2×3
  - chip 文案 ≤8 字；强调行（大数字/问责句）用 14–20pt $accentOnDark 置于矩阵下
- **构造步骤**：① 卡 → ② 徽章+文字 → ③ chevron → ④ 白点+条目名 → ⑤ chip 矩阵（形状+文字逐格） → ⑥ 可选强调行/注记行。

## C03 — chevron 燕尾标签行（chevron-labeled row）

- **语义路由**：有序/递进的 3–5 条要点（步骤、阶段、优先级），每条 = 一句话标签 + 一段说明。
- **data_shapes**：sequence, qualitative
- **组合**：C01 / C15 / C16（左端换 icon 变体）；**冲突**：C04（同为顺序叙事，同页二选一）。
- **hard_constraints**：
  - 每行 = chevron 燕尾（220×88，x=58，solid $brand2，20pt 白 + $accentOnDark 关键词，居中）+ 内容条 `ComponentBackground1` roundRect（$lt1 底 + 0.75pt $rulePanel 边，小圆角 adj 8000）；**平接留缝（2026-10-20 终裁）：内容条 x = 燕尾右缘 + 14（默认 x=292、宽 1104），禁咬合**
  - 行数与行高：3 行 bar h=180 pitch 200；4 行 bar h=135 pitch 155；5 行 bar h=100 pitch 120；首行 y：无 banner 130、有 banner 240
  - 内容条内：条目名 $itemTitle 14pt（可渐变文字 $brand1→$navy），正文 $body 16pt $inkBody，强调 run 16pt $accent bold；行首字面「· 」bullet
  - 燕尾左侧 2 根装饰短斜线（line 元素，0.75pt $gradChipLight）可选
- **构造步骤**（每行）：① 内容条 roundRect → ② chevron shape → ③ chevron 文字 → ④ 条内 itemTitle + 正文。

```yaml
  - elementId: c03-bar-1
    elementType: shape
    bounds: [170, 150, 1220, 135]
    shapeName: roundRect
    adjustments: [8000]
    fill: { type: solid, color: $lt1 }
    border: { style: solid, width: 0.75, color: $rulePanel }
  - elementId: c03-chev-1
    elementType: shape
    bounds: [58, 174, 220, 88]
    shapeName: chevron
    fill: { type: solid, color: $brand2 }
  - elementId: c03-chev-txt-1
    elementType: text
    bounds: [58, 174, 200, 88]
    content: { text: "<p>技术<span style=\"color:$accentOnDark\">壁垒</span></p>", wrap: false, align: [center, middle], style: $chipLabel, fontSize: 20 }
```

## C04 — 圆节点时间轴（circle-node timeline）

- **语义路由**：里程碑/时间线/流程阶段；节点 ≤8，每节点 2–4 字标签 + 上方说明卡。
- **data_shapes**：sequence
- **组合**：C05（流程+成果收口，经典同页）/ C01；**冲突**：C03。
- **hard_constraints**：
  - 载带 `rightArrow [10, 384, 1420, 66]` solid $tintPanelDeep（stripedRightArrow 的 canonical 近似，反模式 4）
  - 节点 ellipse 76×64，solid $brand3 + 1pt $lt1 边，**腾空（2026-10-20 终裁）：节点底 = 载带顶 − 8，与载带间用 0×8 短竖线（0.75pt $brand3）连接，禁压带**；节点内 12pt bold $accentOnDark，≤2 行
  - 节点 x 按展区均分：n 节点时第 i 个中心 = 45.2 + 1351×(i+0.5)/n
  - 节点—说明卡连接柱 = line 元素竖线（宽 0、长 25，0.75pt $brand3）
  - 说明卡 roundRect（宽 ≤200、高 84，$lt1 alpha 底 + 0.75pt $rulePanel 边），16pt $inkBody + $accent 强调；上下交错或全上置
- **构造步骤**：① 载带 → ② 节点 ellipse×n → ③ 节点文字×n → ④ 连接柱 → ⑤ 说明卡+文字。

## C05 — KPI 通栏数字条（bottom KPI strip）

- **语义路由**：页尾收口的一组大数字（≤6 个），「关键数字一览」；深底上数字恒 $accentOnDark（铁律 3）。
- **data_shapes**：kpi_list
- **组合**：C04 / C02 / R1；**冲突**：chrome-bottom-rule（位冲突，同页二选一）。
- **hard_constraints**：
  - 底条 `rect [0.1, 681.3, 1437.6, 73.4]` solid $brand3，页尾收口位钉死
  - ≤6 格；5 格 canonical x=10/310/600/850/1121 宽 ~250（pitch≈295）；格间 0.75pt $lt1 竖线高 60（line 元素）
  - 数字 $statOnDark 32pt bold、单位 16–20pt $accentOnDark、标签 16pt $lt1；同格「数字+标签」一个文本框两段；**格文本框上移（2026-10-20 终裁）：y = 带顶 − 8（683.5→673.5），渲染底 ≤744 不压页脚区**
- **构造步骤**：① 底条 → ② 分隔竖线 → ③ 每格文本框。

```yaml
  - elementId: c05-cell-1
    elementType: text
    bounds: [10, 683.5, 250, 69.1]
    content:
      align: [center, middle]
      wrap: true
      style: $chipLabel
      text: |-
        <p style="text-align:center"><span style="font-size:32px; color:$accentOnDark"><b>184</b></span><span style="font-size:16px; color:$accentOnDark"> GWh</span></p>
        <p style="text-align:center"><span style="font-size:16px; color:$lt1">2027E 产能</span></p>
```

## C06 — 奖章对比盘（medal + parallelogram bars）

- **语义路由**：两方对比（对手/前后/AB 方案），中央给结论；奖章 = 褒义结论载体。
- **data_shapes**：comparison, qualitative
- **组合**：C01 / C15；**冲突**：C08 / C10（同为中央视觉锚）。
- **hard_constraints**：
  - 中央奖章 ellipse 255×255，fill 45° 渐变 $accentDeep→$accent，border 3pt $gradChipLight；外绕 3 段 arc（直径 304，rot 0°/120°/240°，1pt $rulePanel）
  - 左右对比条 parallelogram 315–427×52，渐变 $gradParalFrom→$gradParalTo 45°；条内 16pt 白 + $accentOnDark 关键词；条端靶心 = ellipse 28（$lt1 填 + $accent 边）套 ellipse 15（$accent 填）
  - 奖章上 24pt 白 ≤3 行，中央结论句；两侧条数相等（2–4 条/侧），纵向均布
- **构造步骤**：① 两侧底版（可选 C15 变体）→ ② 奖章+弧 → ③ 对比条×n → ④ 靶心 → ⑤ 文字。

## C07 — 3D 光泽环形（glossy donut，纯矢量重建）

- **语义路由**：≤3 段构成占比（份额/结构）的装饰感展示；**真数据表达优先 charts.md R5**，本件只做「封面级」视觉锚。
- **data_shapes**：share ≤3, qualitative
- **组合**：C16 / C02；**冲突**：C09 / R5（同义二选一）。
- **hard_constraints**：
  - 3 个扇形 `shapeName: pie`（adjustments 按段角换算，角度=度×60000）或 custom path；fill 分别 90° 渐变 $brand1→$navy / $brand2→$brand1 / $gradChipLight→$brand2
  - 光环 = 2–3 个 noFill ellipse 轨道（直径 366–436，1.75pt $rulePanel 边，互相 rot 15–30° 错位）
  - 原模板光环位图（image35/36）**未入资产包**，v1 纯矢量重建，禁外挂图片凑光泽
  - 段上标注：外部 text，$statNumeral + caption
- **构造步骤**：① 轨道 ellipse → ② pie 扇形×3（rot 拼角）→ ③ 段标注。

## C08 — 光泽球体（glossy sphere，纯矢量三件套）

- **语义路由**：单一核心概念/总结论的视觉锚点；「中心思想」页。
- **data_shapes**：qualitative
- **组合**：C03（右侧要点行）/ C16 / C02；**冲突**：C09 / C10 / C06。
- **hard_constraints**：
  - 两件套同心（2026-10-20 终裁：去叠层）：外 halo **单环** ellipse 330 noFill + 1.5pt $brand1 边（多层同心描边环已废）；核 241，90° 渐变 $gradChipLight→$brand1 + 蓝柔影；~~浅壳~~留档为历史 variant
  - 大版 halo ≤457，按槽位等比缩放三件套
  - 核上文字 ≤3 行：白 + $accentOnDark 强调，$chipLabel 起步、主行 ≤28pt bold
  - 可选侧弧光 `assets/media/dots-circle-white.png` ×2 左右贴壳缘（opacity 0.7）
- **构造步骤**：① halo（3 层递减 ellipse）→ ② 壳 → ③ 核 → ④ 核上文字 → ⑤ 可选弧光图。

```yaml
  - elementId: c08-core
    elementType: shape
    bounds: [170, 235, 241, 241]
    shapeName: ellipse
    fill:
      type: gradient
      gradientType: linear
      angle: 90
      stops:
        - { position: 0, color: $gradChipLight }
        - { position: 1, color: $brand1 }
```

## C09 — 漏斗图（funnel，形状+PNG 混合）

- **语义路由**：转化/筛选/收敛逻辑（线索→成交、候选→中标），上下各接说明卡。
- **data_shapes**：funnel, sequence
- **组合**：C01 / C15；**冲突**：C08 / C10 / C07。
- **hard_constraints**：
  - 顶平台 ellipse 1395×111（90° 渐变 $brand1→$tintPanelDeep）+ 台面 ellipse 1265×83（90° 渐变 $lt1→$tintPanelDeep），居中 x
  - 漏斗体 `shapeName: triangle` + `flip: [false, true]`（倒三角，646×391，居中），90° 渐变 $rulePanel→$tintPanel（向下渐隐感）；或 custom path
  - 底平台 ellipse 1327×199 + `assets/media/ring-outline-white.png`（1243×182）+ `assets/media/ring-glow-base.png`（575×150）+ 收口圆盘 ellipse 245×28（$brand1，opacity 0.5）
  - 上下说明卡 roundRect 419×194（$tintPanel→$lt1 渐变 + $rulePanel 边），卡头胶囊 412×42（90° 渐变 $brand2→$brand1，$chipLabel）
  - 依赖图片两件，缺图即整件降级为纯形状（去底平台光环）
- **构造步骤**：① 底平台三件套 → ② 漏斗体 → ③ 顶平台 → ④ 说明卡×2–4 → ⑤ 卡间文字。

## C10 — 流程方块 + 中心枢纽圆（process squares + hub）

- **语义路由**：2–3 输入汇聚成 1 结论（或反向发散）；「组合拳/合力」叙事。
- **data_shapes**：convergence, qualitative
- **组合**：C01 / C15 / C16；**冲突**：C08 / C09 / C06。
- **hard_constraints**：
  - 方块 roundRect 254×184（adj 9000），90° 渐变 $gradChipLight→$brand1；块上 20pt $accentOnDark 日期/标签 + 28pt $lt1 bold 标题，块内白字 16pt
  - 方块间双 chevron 连接 = 2 个 chevron shape（11×19 + 15×27，$brand1 opacity 0.5/1）
  - 枢纽 ellipse 278×262，90° 渐变 $gradChipLight→$brand1 + 3pt $rulePanel 边；外绕 3 段 arc（332×312，0.75pt $rulePanel，rot 0°/120°/240°）
  - 枢纽文字 ≤3 行白 + $accentOnDark；输入→枢纽连线 = line 元素 1pt $rulePanel
- **deck 实测几何（2026-10-19 p8 落地版，2 方块对峙）**：方块 300×220 @[90,300]/[1050,300]（标题 18pt 白 + 3 条 14pt 白要点各带白圆点 8×8）；双 chevron 15×27 @[408,388]/[428,388] 与 [997,388]/[1017,388]（左右镜像，透明度 0.5/1 交替）；枢纽 halo 三层 310/295/280 @[565,238] 起 + 核 241 @[599.5,272.5]（90° 渐变 $gradChipLight→$brand1 + 蓝柔影），核文 = 18pt 白题名 + 20pt $accentOnDark 结论 + 12pt 白注；底部对峙结论 callout [45.2,610,1350.9,110]
- **构造步骤**：① 输入方块×2–3 → ② 连接 chevron/线 → ③ 枢纽三件套 → ④ 文字。

## C11 — 图标列 + 椭圆底座（icon columns on ellipse platform）

- **语义路由**：4–6 个并列支柱/能力/原则，每项图标+标题+一句注。
- **data_shapes**：qualitative, comparison
- **组合**：C01 / C15；**冲突**：C02（同为并列分栏，二选一）。
- **hard_constraints**：
  - 底座 = 4 个同心 noFill ellipse（1145×118 / 913×94 / 750×77 / 495×51，0.5pt $rulePanel 边，居中同 cx）营造透视平台
  - 图标圆 ellipse 117×109，$brand2 + opacity 0.5；字形 PNG/SVG 摆 58–67（assets/media/icons/）
  - 标题胶囊 roundRect 207×52（adj 50000，$brand2，20pt 白）；列分隔竖线 1pt $rulePanel（高 ≤375）
  - 橙色主题词 28pt $accent bold 作全件总标题；列注 18pt $inkTitle
- **deck 实测几何（2026-10-19 p7 落地版，3 列免底座）**：图标圆 117×109 @[cx−58,238] $brand2 opacity 0.55 + 白字形 62×62 @[cx−31,260]；胶囊 206×52 @[cx−103,360]（18pt 白）；列注 $bodyDense 14pt @[cx−180,428,360,84] 居中；下方可接 2×N chip 矩阵（roundRect adj 20000，435×52，$tintPanel+0.75pt $rulePanel 边，$itemBlue 16pt，行距 68）+ sectionLabel 小节标
- **构造步骤**：① 底座 4 ellipse → ② 每列 图标圆+字形+胶囊+注 → ③ 列分隔线。

## C12 — 平行四边形标签（parallelogram label）

- **语义路由**：需要「动感」的条目标签、编号 chip、卡头标签；L02 目录编号 chip 即本件。
- **data_shapes**：qualitative
- **组合**：活在 C02/C06/L02/T2a 内（inline 件）；**冲突**：无。
- **hard_constraints**：
  - parallelogram，fill 45° 渐变 $gradParalFrom→$gradParalTo；三档：编号 chip 220×60（20pt 白 bold 居中）、卡头 385×110、章节大标签 277×106（20pt 白 bold）
  - 内文恒白（浅底变体禁：本件只做深蓝渐变底）；文字框比 shape 内缩 ≥20 防斜边切字
- **构造步骤**：① parallelogram shape → ② 居中 text。

```yaml
  - elementId: c12-chip-1
    elementType: shape
    bounds: [45.2, 160, 220, 60]
    shapeName: parallelogram
    fill:
      type: gradient
      gradientType: linear
      angle: 45
      stops:
        - { position: 0, color: $gradParalFrom }
        - { position: 1, color: $gradParalTo }
  - elementId: c12-chip-txt-1
    elementType: text
    bounds: [65.2, 160, 180, 60]
    content: { text: "<p><b>01</b></p>", wrap: false, align: [center, middle], style: $chipLabel, fontSize: 20 }
```

## C13 — 中心辐射 + 点阵地图（hub-spoke with dotted map）

- **语义路由**：总部→分支、平台→子业务、全国/全球布局。
- **data_shapes**：hub-spoke, qualitative
- **组合**：C01 / C15；**冲突**：C10（同「汇聚」语义二选一）。
- **hard_constraints**：
  - 底图 `assets/media/worldmap-dots-blue.png` [0, 546, 1440, 404] 贴底（恒最底层）
  - 中心胶囊 roundRect 570×61（adj 50000，90° 渐变 $gradChipLight→$brand1），白 + $accentOnDark 字，居中偏上
  - 4 白卡 ComponentBackground1 roundRect 317×322（$lt1 + 0.75pt $rulePanel 边），卡头徽章 218×51 $brand1（16pt 白 + $accentOnDark）；卡内条目胶囊 $tintPanel 底
  - 连接线 = line 元素肘形/直线 dash 1pt $rulePanel
  - 地图 pin = `teardrop`（44×63，90° 渐变 $gradChipLight→$brand2，rot 135° 使尖朝下）
- **构造步骤**：① 地图底图 → ② 中心胶囊 → ③ 卡×4 → ④ 连接线 → ⑤ pin。

## C14 — 原子轨道装饰（atom ornament）

- **语义路由**：纯装饰，配合左标题+右列表的「科技感」页面；**禁单独成页、禁承载数据**。
- **data_shapes**：none（装饰）
- **组合**：C15 / C03；**冲突**：无。
- **hard_constraints**：
  - 竖直轨道 ellipse 100×498（$tintPanel 底 + 3pt $gradChipLight 边）
  - 上下 2 段 arc（372×244，1.75pt $rulePanel，rot 347°/13°）
  - 中心圆 ellipse 204（90° 渐变 $gradChipLight→$brand2），可载 16pt $accentOnDark 词
- **构造步骤**：① 轨道 → ② arc×2 → ③ 中心圆+字。

## C15 — 浅蓝大底板（panel base，最高频隐含构件）

- **语义路由**：内容分区打底；**恒最底层**（元素序最先写）。
- **data_shapes**：none（底版）
- **组合**：所有页可组合；**冲突**：无。
- **hard_constraints**：
  - rect 或 roundRect（adj 8000），fill $tintPanelDeep（深档）或 $tintPanel（浅档），无边无影
  - 白底变体 ComponentBackground1：$lt1 + 0.75pt $rulePanel 边
  - 尺寸随分区网格；多块并列时 gap ≥20
- **构造步骤**：① 最先写底板 → ② 其上构件正常排。

## C16 — 圆形图标徽章（icon badge，白字形）

- **语义路由**：图标列/能力支柱/条目前缀 icon；活在其他构件内（inline）。
- **data_shapes**：qualitative
- **组合**：C02 / C11 / C15 / C03；**冲突**：无。
- **hard_constraints**：
  - 徽章 ellipse 67–128：蓝制 solid $brand2（或 opacity 0.5 半透明制）、渐变制 90° $gradChipLight→$brand2；橙制仅小面积点缀（45° $accentDeep→$accent）
  - 字形一律 `assets/media/icons/` 白色 SVG/PNG，摆放 = 徽章直径 55–60%，居中
  - 图标语义需在 icon registry 登记（现 55 枚，见 assets/media/manifest.json）
- **构造步骤**：① 徽章 ellipse → ② image 字形（元素序在后）。
- **胶囊徽章内嵌用法（2026-10-19 验收启用）**：徽章胶囊（206×52 或 220×52）左端放 28×28 白字形 @[badge.x+14, badge.y+12]，文字框右移为 [badge.x+40, badge.y, badge.w−40, 52] 居中——icon+文字同胶囊（deck p5/p12/p14/p15 徽章实例）。

```yaml
  - elementId: c16-badge-1
    elementType: shape
    bounds: [100, 200, 87, 87]
    shapeName: ellipse
    fill: { type: solid, color: $brand2 }
  - elementId: c16-icon-1
    elementType: image
    bounds: [118, 218, 51, 51]
    src: "media/icons/image38.png"
    fit: { mode: contain }
```

## Icons — 语义图标库（assets/media/icons-lib/）

- **来源与用法**：Tabler 描边风策展 79 枚 × 蓝（$brand1，浅底用）/ 白（$lt1，深底徽章用）两套 SVG；引用 `media/icons-lib/blue/<语义名>.svg` / `white/<语义名>.svg`；语义名清单 `ls` 目录即得。
- **检索纪律**：按**可画对象**搜（bulb/target/trend-up/shield），不搜抽象概念（idea/growth 无结果）；找不到对象就让其它载体（图表/文字/形状）承担该语义，不强行配图标。
- **涂装**：蓝版上浅底、白版上深底/C16 徽章；**不改色**（两套已是终态），混用第三色 = off-palette。
- **规格**：icon 元素宽/高等比（viewBox 24×24），卡内常用 40–56px；徽章内白字形 28–36px。
- **按需复制**：只把本 deck 用到的图标复制进 deck `media/`（payload 950KB 硬顶，icons-lib 全量 632KB 不能整包带）。

## C17 — 仪表盘图标（gauge dial）

- **语义路由**：进度/达成率/水位的小图示（inline，装饰性，非精确数据图——精确值写旁边 text）。
- **data_shapes**：single-value（示意）
- **组合**：C02 / C16；**冲突**：无。
- **hard_constraints**：
  - 外环 ellipse 93×93（2pt $brand2 边）+ 内盘 ellipse 88×88（90° 渐变 $tintPanel→$tintPanelDeep）
  - 指针 `shapeName: triangle`（70×84，solid $brand1，rotation 按值 0–180° 换算，transform origin 即中心，接受三角近似）或 custom path
  - 文本框在表盘下，$caption 标签 + $statNumeral 值
- **构造步骤**：① 外环 → ② 内盘 → ③ 指针（rot）→ ④ 下挂文本。

## C18 — 装饰图片族（decorative image assets）

- **语义路由**：位图级背景/装饰，全部落在 `assets/media/`；**恒最底层**。
- **hard_constraints**：
  - `cover-bg-arc.jpeg`：L01 封面固定背景，[0, 0, 1440, 810] fit fill（4000×2250 与页面同比例，无出血等价几何）
  - `content-bg-silk-blue.jpeg`：内容页浅蓝绸缎全屏底 [0, 0, 1440, 810]（浅色背景款，需要时垫底）
  - `photo-bg-shanghai-skyline.jpeg`：天际线照片底（章节页/照片型版面备用）
  - `title-underline-gradient.png`：仅作 chrome-title-accent 的对照素材——**canonical 实现 = 矢量渐变 rect**（$gradUnderlineFrom→$gradUnderlineTo 0°，[36.4, 104, 202.3, 4.4]），交付页不引用此位图
  - 半调点阵箭头无对应资产：v1 省略（反模式 1）
- **冲突**：同页背景图只用一张；与 C15 底板二选一。

## T2a — 形状拼装表（CPIC 蓝白风）

- **语义路由**：多列结构化数据表（对比参数/方案打分/指标矩阵）；本体系**唯一**表格形态（原生 table 元素不用于复刻此视觉——表头圆角渐变钮无法原生表达）。
- **data_shapes**：table, comparison, matrix
- **表型选型**（6 型，词表移植自 ppt-master table-vocabulary，见 THIRD_PARTY_NOTICES.md）——先定行×列承载什么关系，再定涂装变体：

  | 表型 | 行×列模型 | T2a 涂装要点 |
  |---|---|---|
  | record 记录表 | 行=扁平记录，列=稳定异构字段 | 标准涂装；斑马行省略（$tintPanel 已是浅底） |
  | metric 指标表 | 行=实体，列=指标（现值/变动/状态/目标进度） | 变动列着色语义化（$positive/$negative），目标列可嵌迷你进度条（单元格内 rect） |
  | comparison 对比矩阵 | 行=标准，列=备选方，格=值/短评 | 推荐方列头用 $accentDeep 渐变钮（仅此一列），其余标准蓝 |
  | feature 功能矩阵 | 行=能力，列=方案，格=支持/不支持/部分 | 格内用 ●◐○（$brand1/$gradChipLight/$chartNeutral），不用文字堆砌 |
  | rating 评分矩阵 | 行=标准，列=备选，格=同一套等级刻度 | 等级用 ★ 或 1–5 数字+$accent bold；每列合计行置底加深底 |
  | hierarchical 层级表 | 行=带缩进的分组明细，列=稳定度量，含小计/合计 | 分组行 $tintPanelDeep 底 + bold；小计行上缘加 0.75pt $navy 实线 |

- **组合**：C01 / C12（行首章节大标签）/ C15；**冲突**：无。
- **hard_constraints**：
  - 表头钮：roundRect（adj 16000）243×46.5，90° 渐变 $brand2→$navy + 0.75pt $lt1 边，内文 $tableHeader 14pt 白 bold 居中
  - 单元格（`Number2`）：roundRect（adj 8000）233×42.2，$tintPanel 底 + 0.75pt $rulePanel 边，内文 14pt $itemBlue 居中（$tableBody + color 覆盖）
  - 行 pitch = 42.2（单元格高），表头行 pitch 46.5；列宽按内容 200–350，列 gap ≈10；行距不足时优先删行不压行高
  - 行分隔可用 0.75pt dash 虚线（line 元素，$rulePanel）替代逐格边框的密排感
  - 数字强调 run：$accent bold；负向/风险值用 $negative（仅语义）
  - 行首章节大标签（可选）：C12 parallelogram 277×106 竖跨 2–3 行
- **构造步骤**：① 列定位（x 网格）→ ② 表头钮×n+文字 → ③ 逐行单元格+文字 → ④ 可选行分隔虚线/章节标签。

```yaml
  - elementId: t2a-head-1
    elementType: shape
    bounds: [45.2, 240, 243, 46.5]
    shapeName: roundRect
    adjustments: [16000]
    fill:
      type: gradient
      gradientType: linear
      angle: 90
      stops:
        - { position: 0, color: $brand2 }
        - { position: 1, color: $navy }
    border: { style: solid, width: 0.75, color: $lt1 }
  - elementId: t2a-head-txt-1
    elementType: text
    bounds: [45.2, 240, 243, 46.5]
    content: { text: "<p>指标</p>", wrap: false, align: [center, middle], style: $tableHeader }
  - elementId: t2a-cell-1
    elementType: shape
    bounds: [45.2, 291.5, 233, 42.2]
    shapeName: roundRect
    adjustments: [8000]
    fill: { type: solid, color: $tintPanel }
    border: { style: solid, width: 0.75, color: $rulePanel }
  - elementId: t2a-cell-txt-1
    elementType: text
    bounds: [45.2, 291.5, 233, 42.2]
    content: { text: "<p>产能利用率</p>", wrap: false, align: [center, middle], style: $tableBody, color: $itemBlue }
```

## 附：组合裁决速查

- band-full（C01/C03/C06/C09/C10/C11/C13/T2a）独占展区主位，同页只配 band-strip/inline；band-column（C02/C07/C08）可与另一 band-column 或 band-strip 共存；band-strip（C04/C05）每页 ≤2 条；inline（C12/C14/C15/C16/C17/C18）不占槽位。
- 条目级 composes_with / conflicts_with 契约见 `manifest.json`，优先于槽位独占的字面表述。
