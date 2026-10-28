# Blue IB Slides：PPTD 兼容工作流

> **公开包边界**：公开版不包含 `assets/media`，只保留 PPTD 配方、兼容诊断和 QA 工具；文中涉及的历史位图、图标及参考资产沿用用户已有项目，不随公开包分发。
>
> 仅用于维护既有 `.pptd/.page` 项目；新任务默认使用 `SKILL.md` 的原生 PPTX 主流程。本文中的 `reference/generation.md` 和 `reference/qa-gate.md` 分别指同目录的 `legacy-generation.md` 和 `legacy-qa-gate.md`。不得把本流程的 1440×810 坐标、旧导出链或截图抽检限制带入原生主流程。

风格一句话：白底 + 品牌蓝 5 档 + 橙/黄双强调的「中式投行版式库」风——圆角卡片、同色相渐变、蓝色柔影均为合法手法。视觉体系逆向自 87 页模板实测。

## 与内置 kimi-slides 的融合关系（先读这段）

本 skill 是内置 `kimi-slides` 的**设计系统与工艺增强层**，不是替代品——两者共用同一份 .pptd 中间格式与同一条 CLI：

- **格式与引擎行为以 kimi-slides 为准**：.pptd DSL 语义、`kimi-slides check/screenshot/convert` 行为冲突时，查 kimi-slides 的 `reference/pptd.md` 与 `reference/cli.md`；本 skill 的 `reference/pptd-schema.md` 是同源副本，按字段查。
- **样式决策以本 skill 为准**：颜色/字阶/圆角/渐变/阴影/构件构造法/十条铁律全部由本 skill 的 token 体系与配方裁决，不混用 kimi-slides 自带的场景设计文档。
- **工艺纪律由本 skill 补齐**：PLAN.md 页纲冻结、语义路由选件、qa.mjs 静态闸、render-truth-scan 渲染真值闸、去 AI 腔清单，都是 kimi-slides 裸流程之上新增的硬门。
- **`$SKILL_DIR` 约定**：本 SKILL.md 所在目录记为 `$SKILL_DIR`；开工先 `export SKILL_DIR=<SKILL.md 所在目录绝对路径>`，下文所有 `$SKILL_DIR/...` 命令依赖该变量。skill 可能被安装到任意位置，**永不写死安装路径**。
- **`kimi-slides` CLI 一律按 PATH 调用**（先 `which kimi-slides` 确认），不写死安装目录。

## 体系分层（单一来源原则：每条规则只活在一个地方）

```
assets/theme.pptd        → 视觉 token 唯一来源（颜色/字阶白名单/命名样式，全部实测归并）
reference/design-tokens  → token 语义表（含形态规范：圆角/渐变/阴影/线宽闸值）
reference/planning       → 策划层（v2 新增，移植 ppt-master plan-core）：契约六要素/阅读模式/页面节奏/关系声明/Fact ID
reference/layouts        → L01–L04 布局配方（chrome 8 件逐个几何；L02/L03 为推演配方）
reference/diagrams       → 图解层（v2 新增）：关系→拓扑→构件三级路由 + D01–D03 配方（金字塔/循环环/象限矩阵）
reference/shape-vocabulary → 形状选型词表（v2 新增）：177 预设的 IB 策展 + 选型纪律 + blue-ib 涂装
reference/components|charts|manifest|qa-gate|generation → 构件/图型配方与门禁（charts 含 33 型选型总图，T2a 含 6 表型选型）
assets/chrome-L04.page   → 内容页骨架（必备 2 件 + 可选 6 件）
assets/media/            → 位图资产 + manifest.json（封面光弧/环图/点阵地图/icons/logo 占位符 + icons-lib 语义图标库 79×2）
scripts/*.mjs            → 工具链（qa.mjs 按新 palette/字阶/形态闸改造，v2 增对比度/孤行/策划四闸）
reference/pptd-schema    → PPTD 格式完整 schema（与设计无关）
reference/geometry-decision → 版面几何修复决策规则（空位/溢出两类决策序；已改本体系边距）
reference/prose-humanizer → 去 AI 腔清单（中英双语，自包含）
scripts/qa.mjs           → 机械闸本身
scripts/render-truth-scan.mjs → 渲染真值闸（交付硬闸：交付目标原生渲染 vs 声明几何）
```

**缺陷处理闭环（每修一类问题必须三步同落）**：① 配方写进 reference（怎么构造才对）→ ② 机械闸写进 qa.mjs（以后自动拦截）→ ③ 全 deck 扫描清零（同类实例一个不留）。只修被点到的那一页 = 没有闭环。

## 工作流（严格按序；reference 按需读取——用到哪个组件/图型才翻对应章节，不必全读）

0. **先定 tone 与规模（动工前必问）**：用户没明说时，开工前用一次提问工具同时问两件事——① tone：**路演（Roadshow）还是投决会（IC）**；② 规模：**短版 ~20 页还是长版 ~35 页**（长版 token 消耗约为短版 2 倍，提问时须向用户明示）。这是内容层决策，规则细节在本 skill `reference/generation.md`；此处只列对渲染层的影响：
   - **路演（Roadshow）** = 发行方/卖方叙事：tone 吹嘘积极（强势断言标题、每页回答「为什么是我们、为什么是现在」）；字阶与 IC 统一，差异只在**密度**：每页构件 1–2 个、表格 ≤5 行、要点短句化，默认页数可向 20–24 页收敛。**少而大不是少而空**：构件少但尺度大——出现空区时优先用「放大」填充（图标/卡片尺度/行距按比例上调，把版面撑满），不靠加内容填空；`page_density` 闸仍兜底。
   - **投决会（IC）** = 原流程（买方分析笔法：分歧对照、风险登记册、每页填满——不写 kill criteria）。
   选定后写进 PLAN.md 头部（**`tone: 路演` / `tone: IC` 一行**，缺省 = IC），后续页纲/内容卡/选件都按该 tone 执行。
1. **定内容（内容规划 = 内置 kimi-slides 需求流程 + 本 skill 内容纪律）**：按内置 kimi-slides 的 step1–step2 完成需求理解（请求类型 / 输入类型 / 页数确认，含糊处用提问工具澄清）；在其之上叠加本 skill 的内容层纪律——**先过 `reference/planning.md` 策划层**（契约六要素 tone/mode/audience/purpose/action/core 写进 PLAN.md 头部；页纲表带节奏列 anchor/dense/breathing；每页内容卡首行写「关系声明」；数据进 Fact ID 台账），再按 `reference/generation.md` 走 deck 范式、核心分歧、页纲、内容卡。**规模按第 0 步选定的档执行**：长版 ~35 页 ≈ 28 内容页；短版 ~20 页 ≈ 14 内容页；封面/目录/隔页/附录是固定开销（6–8 页）。内容是数据，样式是 token——内容里永远不许出现颜色/字号字面值。
   - **内容页密度目标，按 tone 分**。量的是**元素数**（每个 text/shape 各算一个，与 `page_density` 闸同口径）与**短条数/页**（15–90 字条），不是构件数：

     | tone | content 页元素中位 | 短条数/页（主指标） | 标定来源 |
     |---|---|---|---|
     | **IC** | **~70** | **~14** | 本模板 87 页实测密度高（元素中位 ~75/页），IC 档按 ~70 定 |
     | 路演 | 未单列钦定值——沿用「每页构件 1–2 个 + 少而大」原则，`page_density` 闸兜底 |

     🚫 **不许靠塞字达标**：大段文字应该 bullet，应该增加元素。达标路径 = 加条数不加长度：单块正文控制在 ~165 字、≥300 字触发 `text_block_blob` 闸；条数涨在**新增构件**上，不在把一个构件切碎上。
     本体系**正文 16pt、dense 14pt**（2026-10-19 用户验收裁决自 14/12 上抬），字阶地板 10（仅页码/独立微标签）。
     💡 密度在内容卡阶段配够最省时间——事后补强密度是最贵的轮次来源。密度不足时在交付说明里声明即可（元素/短条 guide 无硬闸）。
     📐 **版面几何决策规则**：检出版面问题后的修复决策序——**空位先拉伸后填充禁塞字**、**溢出/碰撞先瘦身文本（≤2 行）→ 调行高（1.25–1.3）→ 扩框 → 最后才减元素**（禁把字号压出白名单）。检出时按 `reference/geometry-decision.md` 执行。
2. **建 deck 骨架**：复制 `assets/theme.pptd` 为 deck 的 `presentation.pptd`（全部颜色 token + 命名 textStyle 都在里面），填 `pages:` 列表，建 `pages/` 目录。**页纲同时落盘为 deck 目录的 `PLAN.md`**，冻结前先过页纲检验——**message/title 连读成一段连贯论证、每页都指向同一分歧，不过不许进第 3 步**；冻结后节点 QC 对照「这页还在清单上吗」，防长 deck 中途慢漂移。

   ⚠️ **PLAN.md 必须写定稿 action title，且 title 独立成列可机械提取**：用表格，`| # | 布局 | action title |`，**title 列只放标题句本身**（满足铁律 2：含数字和判断的完整句），构件/图型说明另起一列或写在页纲正文，**不要与 title 挤在同一行**。单条标题确认宽度：
   ```bash
   node $SKILL_DIR/scripts/text-geom.mjs --text "<定稿 title>" --width 1351 --size 32 --bold
   ```
3. **逐页生成（语义路由）**：每页 = 恰好一个 L 布局 + 按页面语义组合的构件。**结构页不参与路由**——L01 封面（固定光弧背景，唯一合法封面，不生图）/ L02 目录 / L03 隔页是 fixed 布局，骨架 schema 固定照抄（`reference/layouts.md`），只换文案、内容份数随实际（目录 4–6 行；**目录条目每条 = 含数字+判断的观点句，禁话题罗列**，规格见 layouts.md L02，`toc_msg_viewpoint` 闸兜底）。**内容页一律 L04**：从 `assets/chrome-L04.page` 骨架起手（chrome 8 件 = 必备 2 + 可选 6，按 `# 可选:` 注释块成组启用/删除），展区按内容卡**关系声明**（递进/循环/层级/对比/汇聚/辐射…）先过 `reference/diagrams.md` §1 三级路由总表，再从 `reference/manifest.json` 选件组合——选件自由（1–4 个是经验指导不是硬上限，密度由 qa.mjs `page_density` 闸兜底），但每个构件的内部构造永远按 `reference/components.md`/`charts.md`/`diagrams.md` 的 canonical 配方；构件覆盖不到的形状级图解查 `reference/shape-vocabulary.md`（177 预设 IB 策展，预设优先于 custom path）。

   **是否派发写页子 agent 由你自行判断**（长 deck 通常值得派、短 deck 通常不值），派发时每个子 agent **只带该 section 的页纲 + 选中构件的配方，不带全 deck 历史**；语义边界按 section（一个 section 的论证在一个 agent 内完成，这是 title 连读连贯的保证），**不要机械按页数硬切**。**前提：第 2 步的 PLAN.md 已冻结且每页 action title 已定稿**。

   **子 agent briefing 固定五段**：① deck 整体 storyline 与核心分歧（一段，让它知道自己这几页在论证链的哪一环）→ ② 本人负责的那几页：定稿 action title + key message → ③ **配方包路径**（见下）→ ④ 数据（data registry 中本 section 用到的条目）→ ⑤ **交付前自检**（见下）。**不给全 deck 已写页，不给其它 section 的内容。**

   ③ **配方包用 `pack-recipes.mjs` 预先打好，briefing 里只给路径**——不要让子 agent 自己去 Read reference
   （它会整读：components.md + charts.md 一次几十 KB，而真正用得上的通常两三节）。
   🚫 **不派发就不要打包**：本步全部由你自己写的时候，打包是**净开销**——多一步生成、多一步读回，
   而你本来就能直接 `sed` 取你要的那一节。`pack-recipes` 只在「真的派了子 agent、且子 agent 看不到你的上下文」时才有收益。

   ⚠️ **给了包就必须同时封住旧路径**（否则打包纯亏）：
   briefing 第 ③ 段里**必须原样带上**下面这句，不带等于白打包——
   > 配方只看这一个文件：`<recipes 包路径>`。🚫 **不许再 Read `reference/components.md` /
   > `charts.md` / `layouts.md` / `pptd-schema.md`**——包里已经按你这几页用到的构件抽好，
   > 含各文件的「恒取」通用纪律。包里缺什么就回报给我补发，**不要自己去翻 reference**。

   ```bash
   node $SKILL_DIR/scripts/pack-recipes.mjs \
     --out <deckDir>/briefing/recipes-<section>.md C01 C08 R3 L04 [--qa] [--tokens]
   ```
   ID 走 `reference/manifest.json` 的 `semantics` 选；脚本按 ID 抽节、把「通用纪律/反模式」这些
   恒取节**全局去重**后打成一个包。`--qa` 附上这些构件关联的闸规则行，子 agent 自检时知道自己会被什么拦。

   ⑤ **自检是交付的前提，不是可选项**：
   ```bash
   node $SKILL_DIR/scripts/qa.mjs <deckDir> --pages <你负责的页>
   ```
   **error 清零才许交付**，warn 逐条裁决（要么修、要么在回执里说明理由）。
   `--pages` 收 `page-7,page-8` / `7,8` / `7-9`；点名的页不存在会 exit 2。

   💡 **想一轮过的写法参考（可选，不强制）**：`wrap:false` 单行文本与 action title 的宽度/折行可用
   `scripts/text-geom.mjs` 预检（与 qa.mjs 两道闸共用同一套 em 宽表与系数）：
   ```bash
   node $SKILL_DIR/scripts/text-geom.mjs --text "…" --width <框宽> --size <字号> [--bold] [--single]
   ```
   `--single` 判单行是否超框（对应 `text_width_estimate`），不带则判折行行数（对应 `title_render_lines`）。图表几何同理走 `chart-geom.mjs`。

4. **图表**：一律 PPTD 原生 chart 元素（`reference/charts.md` 配方）；**选型先过 charts.md「选型总图」**（33 型信息关系词表，三档闸口：✅ 原生 codec / 🔧 拼装 proxy / ⛔ 不支持改表格——⛔ 档永不手绘）。
   - ⚠️ **只写 codec 方言**（`data:{cols,rows}` + `series[].type/encode`）；agent tidy 方言（顶层 type/x/y/names/colors）会被 CLI 静默丢弃图表
   - ⚠️ **颜色语义走系列级 fill**，不用逐点 dPt（pptx 渲染链路丢 dPt 色——瀑布图必须手工 3-series 堆积 proxy，不用原生 waterfall 类型）
   - **颜色语义（铁律 8）**：`$brand1` = 实际/已报告；`$accent` 橙 = 估计/预测/强调；`$chartNeutral` 灰 = 别家/参考；`$negative` 红 = 负增量；`$positive` 绿 = 正向标注。颜色是语义，不是装饰
   - 禁止 shape 手绘数据图表；图表标题永远外部 text 元素
5. **QA 门**（机器裁决，禁止口头宣布通过）：
   > `kimi-slides` 一律**按 PATH 调用**，不要写死安装目录（融合关系一节已定）；
   > 找不到时先 `which kimi-slides` 确认。
   ```bash
   node $SKILL_DIR/scripts/qa.mjs <deckDir>          # ① authoring 静态规约；写页时可用 --pages
   kimi-slides check <deckDir>                     # ② 引擎检查（UnknownField 也要清零）
   kimi-slides screenshot <deckDir> -p all -o <shots>  # ③ 渲染全部页面并逐页目检
   node $SKILL_DIR/scripts/optimize-media.mjs <deckDir>  # ④ 位图优化
   ```
   对**已经存在**的旧 PPTX 导出件，可补充运行 `polish-pptx.mjs`、`verify-pptx.mjs` 与 `render-truth-scan.mjs` 做诊断；这些工具不替代全页视觉检查。旧远程导出已退役，不得读取账号凭据或调用 `pptd2pptx.mjs` 恢复该链路；新 PPTX 交付统一走 `SKILL.md` 的原生主流程。
   **warn 级 = 逐条裁决**：修复或在交付说明中写明保留理由；error 清零才交付。截图必须实际查看，检查字体、折行、遮挡、图表标签、表格、页码和来源；替代渲染器与目标应用存在差异时，应披露验证边界。

   ➡️ **机械闸全绿之后不要直接跳第 6 步交付，先过 5b**（就在下面）。5b 是 warn 级，最容易被「error 已清零」的错觉跳过。

**5b. 去 AI 腔（交付前最后一道）**：机械闸全绿之后、交付之前，对照 `reference/prose-humanizer.md` 收拾全 deck 文案。**放在最后跑**——前面每一步都在改文字，谁先跑谁的成果就被后面的改动冲掉。

   🚫 **这一步不许省**：它是 warn 级，所以 agent 一路只清 error、到这儿看见 warn 直接交付——省到这一步上就是省掉真活，不是省 token。

   **硬判据（做完的定义，不是建议）**：下面三项机检必须 **全部为 0**，或**逐条写明为什么保留**（写进交付回复）。报了却既不改也不说明 = 本步没做。
   ```bash
   node $SKILL_DIR/scripts/qa.mjs <deckDir> 2>&1 | grep -E "ai_slop|dash_density|not_but_parallel"
   ```
   **低成本做法（别整读全 deck）**——机检报了哪类就定位哪类：
   ```bash
   cd <deckDir> && grep -n "综上所述\|值得注意的是\|不难看出\|显而易见\|众所周知\|总而言之\|赋能\|抓手" pages/*.page   # ai_slop
   cd <deckDir> && grep -n "——" pages/*.page | cut -c1-120        # dash_density：逐条判「这个破折号是有意的吗」
   cd <deckDir> && grep -n "不是.*而是\|不仅.*而\(且\|更\)" pages/*.page  # not_but_parallel
   ```
   - 机检三项是**下限**不是全部；机检清零后**再扫一遍 action title 与 banner 观点句**（信息密度最高、也最容易带腔调），不必逐页通读正文
   - 英文 deck 走清单的 Part 二（Staging / Rhythm / Inflation / Formatting / Leftovers）
   - 改完**重跑一次 qa.mjs**——改文字可能碰到 `text_width_estimate` / `title_render_lines` 这类宽度闸

6. **交付兼容项目**：保留 `.pptd` 源目录、页面文件、媒体依赖和检查记录，不挪动或破坏其相对路径。旧远程导出已退役，不能读取凭据或用 `pptd2pptx.mjs` 恢复；需要新 PPTX 时，按 `SKILL.md` 将内容映射到原生主流程并重新验收。已有 PPTX 仅可用兼容诊断工具检查，不把历史导出结果冒充本次新生成。

## 十条铁律（违反任一条即 off-system）

1. 内容页 chrome 相同：title（+可选渐变条）（+可选 banner）→ 展区 → 左下页码；只有展区变化。
2. banner 文案 = 本页核心结论句（含数字+判断）；title 32pt bold，蓝/黑/橙前缀双色三制。
3. 调色板封闭：5 档品牌蓝 + 橙/黄双强调；单页强调色 ≤2；on-dark 大数字恒黄、浅底强调恒橙。
4. 渐变仅同色相明度 90°/45°；禁跨色相、禁径向。
5. 阴影仅蓝系弥散柔影 alpha≤15%；禁黑灰硬影、禁文字阴影。
6. 圆角：chip 胶囊 50%、面板小圆角 ≤16.7%；禁 round1/round2。
7. 字阶白名单 10–44（10/11/12/14/16/18/20/24/28/32/36/40/44）；字体只有 Arial + 微软雅黑。
8. 图表：brand1=实际、accent=估计/强调、灰=别家、红=负增量；禁 shape 手绘数据图。
9. 每栏一个主展区；分栏 pitch 走网格配方；出血件仅限 banner/KPI 带/封面背景。
10. 品牌中立：禁出现任何真实公司 logo/商标；logo 位恒用占位符。

## 关键替换与纪律

- **字体双值直接写进 theme**：`fontFamily: Arial, 微软雅黑`（latin, ea 双值），全 deck 统一；**无衬线、无楷体**（模板里的楷体是孤族，不克隆）。无字体后处理脚本——双值在 canonical theme 里就是终态。
- **橙可作文字色**（与 K 相反）：浅底关键词强调恒 $accent 橙；标题可 $accentDeep 橙前缀双色；**on-dark 大数字恒 $accentOnDark 黄**。
- **圆角/渐变/蓝影合法**（与 K 铁律 7 相反）——但闸值收死：chip 胶囊 50% / 面板小圆角 ≤16.7%、渐变仅同色相明度 90°/45°、阴影仅蓝系弥散柔影 alpha≤15%（闸值全表见 `reference/design-tokens.md` §形态规范）。
- **字阶纪律（白名单）**：字号必须 ∈ 10/11/12/14/16/18/20/24/28/32/36/40/44（qa `font_scale_whitelist` error）；最小 10 仅页码/独立微标签，正文 16，dense 14（2026-10-19 用户验收裁决上抬）。实测的 13.35/10.65 等尾数全是 WPS 缩放痕迹，不是独立档。
- **品牌中立**：logo 位恒用 `assets/media/logo-placeholder.png`（自绘灰框 LOGO），用户替换；禁出现任何真实公司 logo/商标；交付时仍引用占位符会触发 `logo_placeholder_left` warn。
- **banner 与 KPI 带不同页**（两条通栏蓝带视觉重复）；banner 文案必须是本页核心结论句（`banner_text_viewpoint` warn 兜底）。
- 图表标题永远外部 text 元素；图例色块用 rect 不用文字「■」。

## 文件索引

- `reference/design-tokens.md` — 颜色/字阶/形态规范（圆角/渐变/阴影/线宽闸值）/网格/间距全表（1440×810）；**按节查勿整读**（文件头有取节法）
- `reference/planning.md` — **策划层**（v2，移植 ppt-master plan-core）：契约六要素 / 阅读模式三档 / 页面节奏 anchor·dense·breathing / 关系声明 / Fact ID 台账 / 封面收尾 impact；产物全落 PLAN.md，qa 策划闸兜底
- `reference/diagrams.md` — **图解层**（v2）：关系→拓扑→构件三级路由总表 + D01 金字塔 / D02 循环环 / D03 象限矩阵配方（推演配方，引擎渲染已验证）
- `reference/shape-vocabulary.md` — **形状选型词表**（v2）：177 个 OOXML 预设的 IB 策展 + 「先职责后形状」选型纪律 + blue-ib 涂装通则
- `reference/layouts.md` — L01–L04 布局配方（chrome 8 件逐个几何/样式/可选性 + 分栏网格 pitch 表；L02/L03 为推演配方）+ **讲话场景扩展页型**（L01-photo/L03-photo morphing/L05 收尾/CONF 保密提示）；**按 ID 取节勿整读**（文件头有取节法；`chrome 变体纪律` 恒随取）
- `reference/speech-deck-writing.md` — **讲话类 deck 覆盖层**（领导讲话→PPT）：官方信披 deck 格式基因（照片仪式三页/morphing 隔页/续页编号/保密提示页）、语言规范（数字概括/对仗口号/比喻场/三段式）、转化法则（压缩率 0.5–0.6/取舍/标题双段式覆盖铁律 2）、信披打星纪律、checklist 15 条
- `reference/components.md` / `reference/charts.md` / `reference/manifest.json` — 构件/图型构造法与语义路由契约（components 含 T2a 六表型选型与 Icons 语义图标库用法；charts 含 33 型选型总图；**按 ID 取节勿整读**）
- `reference/qa-gate.md` — 门禁规则与缺陷类注册表
- `reference/geometry-decision.md` — 版面几何修复决策规则（空位/溢出两类决策序；已改本体系边距 45.2，无固定侧栏契约）
- `reference/prose-humanizer.md` — 去 AI 腔清单（中英双语，自包含）
- `reference/pptd-schema.md` — PPTD 格式完整 schema（按字段查，勿整读）
- `assets/theme.pptd` — canonical theme（deck 的 presentation.pptd 模板）
- `assets/chrome-L04.page` — 内容页 chrome 骨架（必备 2 件 + 可选 6 件，kimi-slides check 全绿）
- `assets/media/` — 位图资产（cover-bg-arc 封面光弧 / 环图 / 点阵地图 / 绸缎底 / 天际线 / icons 白字形库 / logo 占位符）+ `icons-lib/` 语义图标库（Tabler 策展 79 枚 × 蓝/白两套 SVG，用法见 components.md § Icons）+ `manifest.json` 台账；封面用固定光弧背景，**不生图、无 covers/ 目录**
- `THIRD_PARTY_NOTICES.md` — 第三方归因（ppt-master MIT 方法层移植 / Tabler Icons MIT）
- `scripts/qa.mjs` — 静态规约检查（机械闸本身；按新 palette/字阶白名单/形态闸改造）；`--pages <页>` 供写页 agent 交付前自检
- `scripts/render-truth-scan.mjs` — 渲染真值闸（交付硬闸）：pptx → 交付目标原生渲染 → 声明几何 vs 渲染真值比对
- `scripts/pack-recipes.mjs` — 按 ID 打包 canonical 配方给写页子 agent（manifest 驱动，恒取节去重）：`--out <path> C01 R3 L04 [--qa] [--tokens]`
- `scripts/optimize-media.mjs` — 旧 PPTD 项目的位图统一 1440×810 JPG
- `scripts/pptd2pptx.mjs` — 旧远程导出的退役保护：固定退出并提示改用原生主流程，不读取凭据
- `scripts/polish-pptx.mjs` — 导出后处理（剥 chart 网格线等）
- `scripts/verify-pptx.mjs` — 导出件机检（XML 断言）
- `scripts/text-geom.mjs` / `text-metrics.mjs` / `chart-geom.mjs` — 文本/图表几何纯计算模型（写页前先算，别等闸拦）
- 本体系**不带**：cagr 叠层、harvey、football、封面生图（gen-cover/qc-cover）、字体 remap/zh-fonts 后处理（双值字体已在 theme 落定为终态）
