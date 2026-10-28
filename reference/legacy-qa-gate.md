# blue-ib-slides QA 门禁（qa-gate.md）

> 机械闸清单与修复指引。实现：`scripts/qa.mjs`。改造来源：DECISIONS §7（2026-10-19）。
> 用法：`node scripts/qa.mjs <deckDir> [--warn-only] [--only <rule>] [--pages <spec>]`

## 门禁哲学

1. **误伤比漏检危险。** 一条乱报的闸会被整体关掉，等于没有闸。判据拿不准的一律 warn，
   由 agent 逐条裁决；只有「一定错、错了一定坏」的形态才配 error（渲染链必崩、铁律明文、
   调色板/字族/字阶封闭）。
2. **warn = 一次裁决，不是忽略。** 每条 warn 要么修、要么能一句话说清「这是合法形态」。
   说不清的修掉。合法形态反复命中同一闸 → 登记到本文「豁免登记」，不私下放行。
3. **error 清零才交付。** `--warn-only` 只用于自查过程，交付件必须退出码 0（全过或仅 warn）。
   写页 agent 用 `--pages` 自检自己那几页，主 agent 全量复核（deck 级三项 dash_density /
   not_but_parallel / bg_color_limit 子集模式自动跳过）。
4. **调色板封闭是全封闭的。** PALETTE 从本 deck `presentation.pptd` 的 `theme.colors` 展开读取，
   渐变 stop、`$引用`（fillRef 式引用色）、富文本 span 色、chart series fill/label/marker
   全部展开校验；`theme.colors` 为空时 palette_closed 关闭（无从校验，不谎报）。

## 结构闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| yaml_parse | error | .page 解析失败 | 修 YAML 语法（首行报错信息） |
| bounds_check | error | 元素溢出 1440×810（±1px 容差；整页背景豁免；chrome-banner / chrome-banner-text / chrome-kpi-band 是设计出血件豁免） | 收回页内；出血件仅限这三件与封面背景 |
| chrome_complete | error | 内容页（pageType content 或缺省）缺 chrome-title 或 chrome-pageno | L04 必备两件补齐；隔页/封面/目录用 chapter/cover/table_of_contents 页型（0 chrome） |
| title_align | error | chrome-title 未 align [left, middle] | 改 [left, middle] |
| chrome_title_position | warn | chrome-title 起点不在 x∈[37,53] 且 y∈[0,17]（canonical [45.2, 8.5]） | 挪回标准位 |
| chrome_pageno_position | warn | chrome-pageno 起点不在 x∈[31,51] 且 y∈[759,780]（canonical [41, 769.5] 左下） | 挪回标准位 |
| style_ref_exists | error | content.style 引用了 theme.textStyles 未定义样式 | 改用已定义 $样式或去 theme 补定义 |
| img_src_exists | error | image src 相对路径在 deck 目录不存在 | 补文件（media/）或改路径 |
| media_image_weight | error | 位图 >450KB 或尺寸超 1440×810（SVG 豁免；STORE zip 不压缩、服务端 ≈1MB 硬顶） | `node scripts/optimize-media.mjs <deckDir>` |
| deck_payload_over_1mb | error | pptd+pages+media 总和 >950KB | 先 optimize-media 再导 |
| element_collision | error | text×text / image×text 重叠 >30%（≥85% 页面积的背景层豁免） | 重排几何 |
| z_order_occlusion | error | 小 image 写在有填充 shape 之前且被盖 >50% | image 挪到背景 shape 之后（YAML 元素序即绘制序） |
| z_order_cover | error | text/chart 被后出现的实色 shape 盖住（text >30%、chart >5%） | 内容元素挪后或解除重叠 |
| placeholder_leftover | error | 残留 {{…}}/TBD/TODO/FIXME | 数据填实或删点，禁止带病交付 |
| svg_no_comments | error | media/*.svg 含 XML 注释（渲染器会渲成占位符） | 重新导出或手动剥除注释 |
| logo_placeholder_left | warn | image 引用 logo-placeholder.png | 交付前请用户替换真实 logo 或删 chrome-logo（品牌中立：占位符只是槽位） |
| cover_bg_present | warn | 封面页（pageType cover 或含 cover-* 元素）无全幅背景 image（≥85% 页面积） | L01 背景 assets/media/cover-bg-arc.jpeg，bounds [-72,-40.5,1584,891] fit fill |
| page_density | error / warn | 元素 >210 error、>150 warn；文本 >3000 字 error、>2400 字 warn（阈值沿用 institutional） | 拆页或删文 |
| page_sparse | warn | 内容页元素与 15–90 字短条同时低于 tone 下沿（IC 33/10、路演 22/7；隔页豁免） | 补条数不补字数：大段拆短条（字面「· 」或 ellipse 圆点），或补论证层次 |

## 形态闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| shape_rules | error | ① 阴影：色非蓝族（色相 200–230°）error，alpha >15%（HEX8 AA 字节）error，文字阴影 error；② 渐变：stop 两两色相环距 >15° error（同色/中性灰白黑豁免），方向非 0°/45°/90°/270° error，radial error（文字渐变同查）；③ round1Rect/round2SameRect/round2DiagRect/snipRoundRect error | 阴影用 $brand1/$navy/$gradChipLight 系 + AA≤26（如 #3865BB26）；渐变改同色相明度；圆角用 roundRect（chip 胶囊 adj=50000、面板 adj 4000–16667） |
| rule_as_rect | warn | shape/rect 细边 ≤2 且长宽比 ≥40（发丝线用 rect 填充） | 改 elementType: line 原生线元素 |
| row_rhythm | warn | 同列发丝线组（≥3 根、$chartNeutral/#CCCCCC/#000000、y∈[145,715]）末缝超中位缝 max(12,15%)（首缝/容量参差豁免；v1 降 warn 观察） | 行组在栏高内均分，重排分隔线 |
| chart_left_gutter | error | 图左缘 >100 且 [45.2, 图左缘) × 图高整带为空 | 图顶到左边距 45.2，或填上内容 |
| chart_right_gutter | error | 图右缘到下一元素/展区右缘 1396.1 空带 >150px | 图加宽撑满栏宽，或填上内容 |
| unit_label_align | error | unit-label/lbl-unit 等左缘不在本页任何一张图的左缘上（±6；二级轴 -right 与贴图右缘 ±40 豁免） | 单位标签对齐它那栏图的左缘 |
| chart_title_align | warn | 图上方 16–18px bold 深色候选题未左对齐图左缘 x=chart.x+2（±3）（v1 降 warn 观察） | 图题左锚对齐图左缘，禁居中 |

## 字排闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| min_font | error | fontSize（含 style 展开）<10 | 10 仅页码/独立微标签；正文 16、dense 14（2026-10-19 裁决上抬） |
| font_scale_whitelist | error | 字号 ∉ {10,11,12,14,16,18,20,24,28,32,36,40,44}（theme textStyles 与页面字面量都查） | 就近归入白名单档位 |
| font_family_discipline | error | latin ≠ Arial（大小写不敏感）或 ea ≠ 微软雅黑（单名串视为 latin+ea 同值；theme 与页面字面量都查） | 本体系只有 Arial + 微软雅黑：Georgia/楷体/宋体/Calibri 一律禁，写 `Arial, 微软雅黑` 双值 |
| peer_font_consistency | warn | 同行（y±2）同列（x 缝 <70）≥3 个文本字阶/字族不一致 | 统一角色字阶字族 |
| text_width_estimate | error / warn | wrap:false 单行估算宽 >框宽 ×1.04：延伸右缘撞邻居 error、空旷 warn | 缩短文案或加宽框；写页前用 `node scripts/text-geom.mjs` 预检 |
| title_render_lines | error / warn | chrome-title 估算渲染 >1.95 行 error、>1.75 行 warn | 缩短标题 |
| title_lines | warn | chrome-title 框高 >70.5（两行上限；canonical 框高 60，v1 降 warn 观察） | 缩短标题或收框高 |
| title_is_sentence | warn | chrome-title 不含数字（汉字数字同权；本体系观点句主要由 banner 承担，故 warn） | 标题写成带数字和判断的完整句 |
| no_nbsp | error | 文本含 `&nbsp;`（渲染器不认会吞空格） | 用「 — 」或普通空格 |
| text_block_blob | warn | 正文单块 ≥300 字符（footnote/source/disclaim/method/caption 角色豁免） | 拆多条短文本（字面「· 」或 ellipse 圆点），目标 ≤~165 字 |
| no_native_list | warn | 文本含 `<ul>/<ol>/<li>` 原生列表（L02 toc-msg 条目豁免） | 分条用字面「· 」或 ellipse 圆点配对 |

## 图表闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| series_name_numeric | error | 系列名纯数字（codec 导出必崩） | 改 "2022年"/"FY2022"/"2022A"（类目名纯数字不受影响） |
| axis_show_false | error | 轴用 show:false（导出 delete=1，部分 PowerPoint 吞该轴系列） | 改 {label:false, axisLine:false, gridLine:false} 保活隐藏 |
| chart_gridline | warn | 轴未显式 gridLine:false | 显式写 false（导出后 polish-pptx.mjs 也会兜底） |
| cat_label_length | warn | 类目标签单行 >16 字符无 \n（轴自动跳号；饼/环豁免） | 用 \n 双行 |
| xaxis_value_label | error | 竖图类目标签任一行含数值（日期/季度/FY 豁免；横图不检） | 数值进 ctr 或手摆柱顶标（对齐类目中心） |
| pie_max_slices | error | 饼/环 >6 段 | 合 top5+其他 |
| clustered_bar_limit | warn | 簇状柱 >6 类目或 >3 series | 拆页或转堆积 |
| stacked_zero_value | warn | 堆积图含 0 值段（留悬空标签） | 0 值类目删除或置 null |
| waterfall_closure | error | _base 瀑布 proxy 逐柱 running 水位不闭合 | 重算 base/可见段 |
| waterfall_negative_color | error | 负增量柱未拆 $negative #C00000 红色系列（$引用展开后判定） | 负增量拆红；正增量 $accent |
| waterfall_no_native_type | error | 用原生 waterfall 类型（dPt 逐点色导出丢失） | 改手工堆积 proxy |
| waterfall_cat_label_len | warn | 瀑布图类名单行 >12 字符（渲染器跳号） | 改双行（名\n值） |
| combo_no_bar_ctr_labels | error | 柱线组合图柱系列带 dataLabels（PowerPoint 吞 ctr 标签） | 手摆柱顶标对齐类目中心；禁并入类目标签 |
| hbar_no_line_series | error | 横向 bar（value×category）含 line 系列（codec 导出即坏） | 标记用窄条行，不用 line 系列 |
| doughnut_legend_right | error | doughnut 洞心有大数字（center/hole 命名）且用原生 right 图例（图例压环撞中心数字） | legend: false 或 position: bottom |
| label_contrast | warn | 深底（感知亮度 <0.45）系列标签非白；浅底系列标签为白 | 深底 $lt1 白、浅底 $inkBody #404040 |
| chart_color_semantics | warn | ① 系列名含估计/测算/预测/forecast/estimat/(E) 却填 $chartNeutral 灰 → 应用 $accent 橙；② ≥2 个柱系列全填灰 → 主数据应 $brand1 | 语义色：brand1=实际、accent=估计/强调、灰=别家/参考、negative 红=负增量 |
| bar_label_redundant | warn | 普通柱 dataLabels 值在页面伴随表/正文全部已出现（瀑布/真堆积豁免） | 柱值别处读不到才挂标签 |
| stacked_toplabel_missing | warn | 真堆积（某类目 ≥2 非空段）且图区内无数值≈合计的文本 → 建议加柱顶标 | 柱顶标可选，手摆需对齐类目中心（本体系无 cagr-line 工具） |

## 语义闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| toc_msg_viewpoint | warn | toc-msg-* 条目（附录 a 系行与方法论/数据来源行豁免）不含数字也不含判断词 | L02 每条 = 含数字或判断的完整观点句；栏目名归 section 列 |
| banner_text_viewpoint | warn | chrome-banner-text 纯文本不含数字也不含判断词（判据与 toc_msg_viewpoint 共用） | banner 文案 = 本页核心结论句（铁律 2），须含数字+判断 |
| dual_accent_limit | warn | 单页使用 $accent/$accentDeep/$accentOnDark 三色中 >2 种（全槽位展开统计） | 浅底强调恒橙 $accent、深底大数字/关键词恒黄 $accentOnDark、$accentDeep 仅标题前缀；单页 ≤2 种 |
| dark_text_gold | warn | 深底（填充 shape 或页面背景感知亮度 <0.45）上 fontSize ≥24 的文本色非 $accentOnDark/$lt1 | 深底大数字恒黄 $accentOnDark #FFC000 或白 $lt1（铁律 3） |
| palette_closed | error / warn | 未知 $色变量 error；解析后色值 ∉ theme.colors warn（渐变 stop、fillRef 式 $引用、span 色、series 色全部展开） | 颜色写 theme.colors token（$名），不写游离 hex；新色先入 theme |

## 散文闸

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| ai_slop | warn | 命中 AI 套话词表（综上所述/值得注意的是/赋能/抓手…；chrome 页脚件豁免） | 删掉后句子必须仍然成立（prose-humanizer §6） |
| dash_density | warn | 破折号 ≥3.5 个/千字（deck 级，样本 ≥3000 字才判；子集模式跳过） | 每处都该是有意选择，否则换句号/逗号/冒号 |
| not_but_parallel | warn | 「不是…而是…」「不仅…而且…」≥3 处/deck（子集模式跳过） | 直接陈述；纠正读者真实误解的 sharp title 可留 |
| explainer_preamble | error | 图下文字块以「读法/解读/说明/导读/看图/如何看/结构观察/观察/要点/小结/注：」开场 | 第一句就是结论；标签去掉或改写带判断的短句 |
| bg_color_limit | warn | 全 deck 页面 background.color >2 种（子集模式跳过） | 本体系页面恒白底；封面背景走全幅 image 不占此额度 |
| orphan_line | warn | 折行文本（wrap 非 false、段 ≥12 字）模拟折行后末行仅 1–2 字符（与 text_width_estimate 共用 cw 宽表） | 提前一处自然断句、删冗字或微调框宽；修辞性短句可在回执说明保留 |
| text_contrast | error / warn | 文本色对承载底色（中心点下 z 序最靠上的 solid shape；gradient 取最差端；无承载取页面背景；图片底与 cover-* 豁免；span 色取元素级）WCAG 对比度 <1.8 error、<2.6 warn；浅底 $accent/$accentDeep 橙字豁免（铁律明文强调色） | on-dark 换 $lt1/$accentOnDark；浅底换墨色/蓝；刻意浅底橙强调回执说明即可 |

## 策划闸（planning.md；全部 warn——策划判断由人裁决，闸只提醒失配；子集模式跳过）

| 闸 | 级别 | 判定 | 修复指引 |
|---|---|---|---|
| plan_contract | warn | 缺 PLAN.md，或 PLAN.md 头部缺 tone/mode/audience/purpose/action/core 任一行 | 补齐六要素固定块（planning.md §1） |
| page_rhythm_mismatch | warn | 页纲表节奏列声明（anchor/dense/breathing 或 锚点/密集/呼吸）与实测元素数失配（anchor≥60 / dense 35–100 / breathing<55） | 改声明或改实现——总有一个是错的 |
| page_rhythm_flat | warn | ≥6 页打节奏标且清一色 dense | 节奏要有起伏：anchor 前后穿插 breathing/dense |
| closing_missing | warn | presentation.pptd pages 末位页非收尾页（pageType ≠ final 且无 closing-/end- 元素） | 收尾页必备：本 deck 自己的收口句（planning.md §6） |

## 豁免登记

v1 空。合法形态反复命中同一闸时在此登记（格式：页面/闸/判据误伤点/注销条件），不许私下放行。

## v1 未携带的 K 体系能力（勿回填，需要时另立裁决）

- **cagr 叠层体系**：cagr-line.mjs / cagr-lib.mjs 及 cagr_* 九闸（柱顶标本体系手摆，对齐类目中心）
- **football field**：football_qc / football_series_limit / football_marker_naming 及 polish 贯穿带转换（本模板无此语言）
- **harvey 球**：harvey.mjs 与 harvey_adjust_range
- **icon 体系**：icon.mjs / lucide2phosphor / empty_circle_icon / no_icon_element / bullet_icon（本设计 C16 用白字形 PNG/SVG + 蓝圆，合法）
- **zh-fonts 机检**：zh_fonts.mjs 与 zh_template_latin（中文字体直接写进 theme 双值 Arial, 微软雅黑，由 font_family_discipline 管）
- **geometry-scan 外挂族**：text_overflow_est / whitespace_hole / uneven_columns / cramped_zone / panel_void / mainzone_bottom_gap
- **K 专有版式闸**：insight_panel_* / hero_numeral_max / kpi_strip_frame / panel_intrusion / panel_gap / divider_no_source / exhibit_title_rule / card_text_left / section_title_icon / source_* / footnote_* / registry_* / toc_rhythm / branding_tone_mismatch / chrome_source_width / accent_never_type（橙可作文字色）/ GOLDEN 模式与逐页豁免登记
- **gen-cover / qc-cover 封面生成链**：封面背景用 assets/media/cover-bg-arc.jpeg 固定位图
