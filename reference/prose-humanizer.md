# Prose Humanizer — 去 AI 腔清单（slide 版，自包含）

> **何时读我**：**交付前最后一道**（SKILL.md 第 5b 步，2026-09-14 用户定「这个最后跑」）——前面每步都在改文字，先跑就会被后面的改动冲掉；`qa.mjs` 的 `ai_slop` / `not_but_parallel` / `dash_density` 三条 WARN 闸是它的机械子集。
> **为什么自包含**：本 skill 不跨目录引用别的 skill（2026-09-14 用户定）。规则源头是 Wikipedia《Signs of AI writing》与 blader/humanizer v3，**但阈值按幻灯片语料另行标定**——见下「与研报口径的差异」。
> **与十条铁律的关系**：增量不替代。铁律管「像 K」（action title 句式、判断密度、chrome 恒等），本清单管「不像 AI」（去掉模型的默认选择）。冲突以铁律为准。

## 与研报口径的差异（重要）

幻灯片不是 prose，直接套研报阈值会误伤：

| 信号 | 研报阈值 | **slide 阈值** | 标定依据 |
|---|---|---|---|
| 破折号密度 | ≥2.0/千字 | **≥3.5/千字** | 实测（qa textOf 口径）：golden-ref **2.15**、demo **2.01**、canonical examples **3.19**（参照件上限）——2.0 会把 K 原版和自家配方样例全打中。幻灯片用「——」承载「标题→机制」的结构，天然比 prose 密。3.5 = 参照件上限 +10%；生成件实测 3.38 / 3.78 / 3.98 全在其上。**样本 <3000 字不判**——每千字的指标在小样本上不可信（3 页测试件 579 字里 3 个破折号就算 5.2/千字）|
| AI 套话词 | ≥1 处 | ≥1 处（同） | 黄金件 / demo / examples 全 0，零误伤 |
| 否定·递进排比 | ≥3 处/篇 | ≥3 处/deck（同） | 参照件全 0，生成件 0–2 |

## 核心五原则

1. **删填充**：开场白、强调拐杖词、宣告句——每句话都要给新信息
2. **破公式**：二元对比、三连排比、「挑战与展望」模板——意义不需要三件才完整
3. **变节奏**：长短交错；两项优于硬凑三项
4. **信任读者**：直接陈述，跳过软化与手把手引导
5. **删金句**：读起来像「可引用语录」的，重写

## 中文模式清单

**内容层**
1. **夸大意义**（强）：标志着 / 见证了 / 是…的体现 / 彰显 / 凸显 / 至关重要 / 不可磨灭的印记。普通事实穿成历史转折 → 留事实，删意义
2. **肤浅 -ing 尾巴**：句尾接「彰显着…／反映着…／凸显了其重要性」制造假深度 → 删尾巴
3. **宣传腔**：充满活力的 / 深刻的 / 开创性的 / 令人叹为观止的。研报出现广告词 = 直接删
4. **模糊归因**（强）：行业报告显示 / 观察者指出 / 专家认为 → 点名具体机构 + 角标，否则删
5. **「挑战与展望」模板**：尽管面临挑战…但前景光明 → 落在最后一个具体事实上

**语言层**
6. **AI 套话词**（机检）：综上所述 / 值得注意的是 / 值得一提的是 / 不难看出 / 显而易见 / 众所周知 / 总的来看 / 总而言之 / 引发广泛关注 / 具有里程碑意义 / 赋能 / 抓手 → 删掉后句子必须仍成立
7. **否定式排比**（强，机检）：不是…而是… / 不仅…而且（更）…——否定半句在否定一个没人提出的主张 → 直接陈述。**例外**：否定半句纠正读者真实持有的误解（`不是资产质量问题`这类 sharp title）可留
8. **三连排比**：强行凑三件显得全面 → 两件或四件
9. **系动词回避**：作为 / 充当 / 代表着 [一个] → 直接用「是 / 有」

**风格层**
10. **破折号**（机检）：slide 预算 <3.5 个/千字。每处都应是有意选择，否则换句号/逗号/冒号/括号
11. **粗体装饰**：机械地给每个短语加粗 → 删；标签无信息时改叙述
12. **装饰符**：emoji、箭头、装饰性标题 → 删

**残留层（一律直接删）**
13. 协作痕迹（希望这对您有帮助 / 当然！）、知识截止免责（基于可用信息）、谄媚语气（好问题！）
14. **标题复读**：action title 下第一句复述标题 → 删，直接进内容

## 英文 deck 适用条目（blader v3 节录）

- **Staging**（强）：not X but Y / one-line closers / the real question is / Let's dive in / I'm not saying…
- **Rhythm**：forced triads、repeated sentence openings、dashes everywhere、stacked qualifiers（could potentially）
- **Inflation**：delve / crucial / pivotal / robust / landscape / tapestry / testament / underscore / bolster / vibrant；stands as a testament / marking a pivotal moment；shallow -ing riders（highlighting / underscoring / showcasing）；borrowed authority（experts argue / industry reports）
- **Formatting**：bold as decoration、decorative headings、curly quotes 与目标格式不一致
- **Leftovers**：chatbot residue（I hope this helps）、knowledge-limit disclaimers、heading repeated in first sentence

## 豁免区（机检同此）

页脚三件套（`chrome-source` / `chrome-brand-center` / `chrome-pageno`）、`chrome-footnotes` 脚注、表格单元格、角标、来源行、法规名——这些是规定格式，不做本清单检查。

## 交付前快检

- ✓ action title 下第一句在复述标题？→ 删
- ✓ 破折号每处都是有意选择？→ 否则换标点
- ✓ 出现「综上所述 / 值得注意的是」？→ 删
- ✓ 三段式列举？→ 两件或四件
- ✓ 页面结尾是「前景光明」式虚收？→ 落在判决点或最后一个具体事实
