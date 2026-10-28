> 历史 v3 配方参考：用于理解形状与信息关系。当前执行、单位、字号、来源纪律与全页验收以 SKILL.md / native-workflow.md 为准；不执行本文件中的旧引擎、凭据或抽查限制。

# Layouts — 页面级布局 L01–L04（1440×810）

> 定案：DECISIONS §4（坐标全部实测自 87 页模板，findings/layouts.md §2/§3；pptd = EMU/12700×1.5）。
> ⚠️ **L02/L03 是「推演配方」**——原模板是版式库：仅 1 个封面（p1）+ 86 内容页，**无原生目录页、无章节隔页**
> （findings/layouts.md:L12），两者用实测零件拼出，落地后按实跑件校准。

## 🔖 取节索引（**勿整读本文**）

定好布局 ID 后只取那一节：

```bash
D=$SKILL_DIR/reference; L=L04     # L 换成你要的 ID
sed -n "/^## ${L} /,/^## /p" $D/layouts.md
sed -n "/^## chrome 变体纪律/,\$p" $D/layouts.md          # 恒取
```

⚠️ **`chrome 变体纪律` 对任何 L 都成立，取任一布局时必须一并取。**
内容页恒为 `L04`，骨架直接抄 `assets/chrome-L04.page`，通常不需要读 L04 正文。

小节：`L01` 封面（实测 p1） · `L02` 目录页（**推演**） · `L03` 章节隔页（**推演**） · `L04` 内容页（主力，实测） · `chrome 变体纪律`

> 一页 = 恰好一个 L + 展区内 1–4 个构件。chrome 精确坐标见 `assets/chrome-L04.page` 与本表。

## L01 — 封面（实测 p1；固定光弧背景，不生图）

- 背景 image `assets/media/cover-bg-arc.jpeg`（白底+底部双蓝弧，4000×2250）bounds `[-72, -40.5, 1584, 891]` fit fill（出血 72/40.5）
- 标题 coverH1 `[96, 28.5, 1100, 120]`（36pt $coverTitleBlue；原实测 34.65pt 系缩放痕迹，取字阶 36）
- 副题/日期 caption 16pt $inkSecondary `[96, 150]`
- 可选编号目录列表 `[96, 220, 1150, 400]`：28pt，当前条 $tocActive、其余 $tocInactive，编号+条目，行距 ~1.9
- **0 chrome 0 页码**；无 logo 位（品牌中立，铁律 10）
- 出处：findings/layouts.md:L16、DECISIONS §4 L01

## L02 — 目录页（**推演配方**，模板无实例）

- 用 L04 chrome：title「目录」$titleBlue + title-accent 渐变条 + pageno（三件）
- 4–6 行条目：编号 chip = parallelogram `[45.2, y, 220, 60]` gradient $gradParalFrom→$gradParalTo 45°，白 20pt bold 居中
- 条目文本 18pt $inkTitle `[290, y, 1000, 60]`，**每条 = 含数字+判断的观点句**（沿用 institutional toc_msg_viewpoint 纪律；禁话题罗列，qa `toc_msg_viewpoint` warn 兜底）
- 行底发丝线 0.5pt $chartNeutral；首行 y=160，行高 95
- 零件出处：平行四边形卡头实测 p65（findings/layouts.md:L70，渐变 #5A80CD→#2F5192）、DECISIONS §4 L02

## L03 — 章节隔页（**推演配方**，模板无实例）

- 白底；左缘 x=96：dividerNum「02」44pt $brand1 `[96, 240]`，dividerH 章节名 40pt `[96, 300, 1000, 120]`
- 底部通栏 $brand3 rect `[0, 681.3, 1440, 73.4]` + 白 16pt 章节英文/简述居中
- **0 chrome 0 页码**
- 出处：底部通栏复用 KPI 带实测几何（findings/layouts.md:L62）、DECISIONS §4 L03

## L04 — 内容页（唯一内容页布局，实测主力）

chrome 8 件 = **必备 2 + 可选 6**（骨架 = `assets/chrome-L04.page`，坐标钉死不可挪）：

| elementId | 可选性 | bounds [x,y,w,h] | 样式 | 实测出处 |
|---|---|---|---|---|
| `chrome-title` | **必备** | [45.2, 8.5, 1350.9, 60] | pageTitle 32pt bold，align [left, middle]；**双色标题合法**（$titleBlue 整行 / $accentDeep 前缀 + $inkTitle） | layouts.md:L59,L125（标题位 (45.2,8.5)×26 页、清一色 32pt） |
| `chrome-pageno` | **必备** | [41.0, 769.5, 79.5, 24.2] | pageno 12pt $inkSecondary，左下（实测 13.35pt 是 WPS 缩放痕迹，定稿 12） | layouts.md:L126（(41,769.5)×51 页绝对主流） |
| `chrome-title-accent` | 可选 | [36.4, 104.0, 202.3, 4.4] | rect，gradient $gradUnderlineFrom→$gradUnderlineTo 0°（**矢量化**，不用原位图） | layouts.md:L60（p7/p65 同一位置；位图 54 页复用，assets.md:L48） |
| `chrome-banner` | 可选（高频） | [0, 136.2, 1440, 73.7] | rect solid $brand3（变体 $brand4 或同色相渐变）；贴边满幅出血——实测原值 [-4.3, 136.2, 1448.7, 73.7]，为 check BoundsOutside 全绿收成贴边（渲染等价） | layouts.md:L49（p29 实测）、L127 |
| `chrome-banner-text` | 可选（随 banner） | [0, 143.1, 1440, 63.5] | bannerText 24pt 居中，白 + 关键词 `<span>` $accentOnDark；**文案 = 本页核心结论句（含数字+判断）**（qa `banner_text_viewpoint` warn）；实测原值宽 1451.8，同上收贴边 | layouts.md:L50 |
| `chrome-kpi-band` | 可选变体 | [0.1, 681.3, 1437.6, 73.4] | rect $brand3 + 5 格文本 x=10.0/310.5/600.3/849.8/1120.8 宽 ~250，数字 statOnDark 32pt、标签 16pt 白（2026-10-19 上抬）；格文本框 y=673.5（带顶−8，渲染底 ≤744，2026-10-20 去叠层终裁） | layouts.md:L62–63（p7 实测） |
| `chrome-bottom-rule` | 可选 | [43.5, 746.0, 1359.8, 0] | line 0.75pt $chartNeutral（原为 10px 位图条，矢量化） | layouts.md:L106（p73 实测位）、L192 |
| `chrome-logo` | 可选 | [1221.0, 756.5, 186.3, 50.8] | image，**恒用 `assets/media/logo-placeholder.png` 占位符**（自绘灰框 LOGO），用户替换（qa `logo_placeholder_left` warn） | layouts.md:L108（p73 logo 位实测） |
| `chrome-title-dots` | 可选（2026-10-19 新增） | [1186, 22, 210, 42] | image `assets/media/halftone-chevrons.png` fit contain（半调点阵 » 装饰，模板 p5/p7 页眉两侧手法；挂时 chrome-title 框宽收成 1120 避让） | 模板 p5/p7/p9 页眉点阵（components.md §0-7） |

- **展区**：有 banner y 210..740；无 banner y 120..740；x 45.2..1396.1（宽 1351）
- 分栏网格 pitch 表见 `reference/design-tokens.md` §页面网格（2 栏分界 x≈715 / 3 栏卡片 46.5·500.6·970.6 / 4 栏 pill pitch≈334–352 / KPI 5 格 pitch≈295）
- 每栏只允许一个主展区；出血件仅限 banner/KPI 带/封面背景（铁律 9）

## chrome 变体纪律

- **L01 封面 / L03 隔页 = 0 chrome**（页码也不带）；L02 目录页带 chrome（title + title-accent + pageno 三件）
- **banner 与 KPI 带不同时出现**在一页（都是通栏蓝带，视觉重复）；KPI 带页展区底缘压到 y≤681
- banner 文案必须是本页核心结论句（含数字+判断），24pt 一行；关键词 `<span>` 包 $accentOnDark 黄
- 双色标题（橙前缀+黑 / 整行蓝）是原生特征，QA 不报警；但单页强调色 ≤2 种（铁律 3，qa `dual_accent_limit`）
- chrome 元素 elementId 必须 `chrome-*`；qa `chrome_complete` 只检内容页必备 2 件（chrome-title + chrome-pageno，缺 = error）
- `chrome-title` 位置闸 [45.2, 8.5]±8（warn `chrome_title_position`）；`chrome-pageno` 位置 [41, 769.5]±10（warn）
- logo 位恒用占位符，**禁出现任何真实公司 logo/商标**（铁律 10 品牌中立）

## 讲话场景扩展页型（2026-10-20 蒸馏自官方信披 deck；规范全文见 `reference/speech-deck-writing.md`）

> 讲话类 deck 首选本族页型；主体系 L01/L03 白底族仍合法但讲话场景让位。构造几何均经官方 deck XML 实测（证据索引 speech-deck-writing §2）。

### L01-photo — 照片封面（讲话首选）
- 背景：全幅照片（media 登记制，蓝调城市/科技感）+ 整页 rect 蒙版 $brand1 系深蓝 alpha 75%（官方=accent1 lumMod50%+alpha75）
- 文案：对仗 slogan 双行（7+7 言黄金格式，可空心描边字），44pt bold 白 [96, 240, 1100, 200]；可选 pill 标签（「冲刺季」型胶囊 $brand2 底 $accentOnDark 字，[96, 180, 180, 48]）；中下「——会议全称 / 日期」16pt 白 [96, 560]
- 0 chrome 0 页码；logo 恒占位符（铁律 10）

### L03-photo — 照片隔页（左暗右亮）+ morphing 组
- 构造：全幅山景照片 + 整页蒙版同上 → **右侧 40% 再铺原图**（x=792, w=576，通高，fit fill）= 左暗右亮
- 文案：章节名两行 [96, 300, 900, 160]，第一行 40pt 白、第二行 40pt $accentOnDark 金（≤20 字）
- **morphing 组**（与 L02 目录互斥）：同一底版出 N 帧，帧间只变导航高亮——Q1 型=三圆环（当前圆放大金字白环，其余缩小半透明）+ 白 ▲ marker；GM 型=大白圆盘（$lt1 alpha 81%）内 parallelogram pill ×3（当前 $gradChipLight 底金字，其余半透明白）。底版/标题/编号三件逐帧一致（qa 锚点）

### L05 — 照片收尾页（讲话必备末页）
- 构造：全幅航行/远征隐喻照片 + 深蓝渐变蒙版（#0E2841→#215F9A，alpha 53%→0，90°）
- 文案：左侧两行对仗 [96, 280, 1100, 260]，**前四字 44pt bold 白 + 破折号注解 28pt 白**（官方 62/38pt 超白名单，就近取 44/28——L05 专用字档，qa 放行）；引号单字锚点保留
- 跨会议固定模板先例：「知重负重—认清"时"与"势"，方能负重前行 / 唯实唯勤—把握"实"与"勤"，方能行稳致远」

### CONF — 保密提示页（p2 恒位固定件）
- 白底；标题「保密提示」14pt $inkSecondary [45.2, 60]；正文 16pt $navy 三段、首行缩进 2 字符 [96, 160, 900, 420]；底部蓝弧背景位图（复用 cover-bg-arc 族裁切）
- canonical 文案照录 speech-deck-writing §2.4；五关键词机械闸（checklist #2，缺一 error）
- **qa 豁免**：CONF 页 0 chrome，以 `conf-*` 元素识别豁免 `chrome_complete` 闸（2026-10-20 闭环补登）
