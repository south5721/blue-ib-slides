# 本机原生生成接口

依赖 Node（`pptxgenjs`, `@napi-rs/canvas`）与 Python 3.10+；优先读取已配置的捆绑运行时。`BLUE_IB_NODE` 指 Node，`BLUE_IB_PYTHON` 由构建入口设定。依赖可按 package.json 在隔离任务目录安装，不能读取远程账号配置来替代本地导出。

Mac 默认注册 Office 现有的 DengXian/Arial 字体文件。其他平台自动发现本机字体；可用 `BLUE_IB_FONT_FILES` 指向已有字体文件，以系统 path 分隔符串接。`deck.font` 须对应实际可用的 CJK 字体。拉丁段当前按 Arial 测量与输出；交付前在目标应用确认字体，缺少 Arial 时应显式配置实现后再验收。

`deck.json` 顶层：`title`, `slides`（必填）；可选 `subtitle`, `author`, `company`, `footer`, `source`, `font`, `profile`（desk/projection）, `skin`（cpic/report）, `editReserve`（0–0.5）, `expectedSlides`。

页级通用字段：`layout`, `title`, `subtitle`（或 banner）, `source`, `notes`, `skin`, `editReserve`。任何事实都应放在当前支持字段；当前不实现图片导入和动画，不可声称 JSON 中加任意字段即可出现。

- `cards`：`cards` 或 `modules: [{title,body,metric?}]`。长文、不对称自动转行。`bullets: [{heading,text}]` 可直接指定条目，字符串条目自动编号。
- `peerColumns`：`modules: [{title,action,body,icon?}]`，2–4 项。图标名称取自 `assets/media/icons-lib/white/`（不带扩展名），不写任意文件路径。
- `evidenceRows`：`evidenceRows: [{label,evidence,implication}]`。
- `causeEffect`：`pairs: [{cause,effect}]`, `conclusion: {title,body}`。只有有依据的因果才能用箭头。
- `hubEvidence`：`hub: {title,body}`, `branches: [{title,body}]`。形状和线均可编辑；不是动态绑定的 SmartArt。
- `flow`：`steps: [{date?,title,text}]`, `summary?`。当前对齐条目实现，长链分页。
- `table`：`columns: [...]`, `rows: [[...]]`；`colWidths` 可选正数权重。最多 10 列，超限需明确横向拆分及重复关键列，不截断单元格。
- `barChart`：`categories`, `series: [{name,values,role}]`；role=actual/forecast/reference/negative/positive，分别用蓝/橙/灰/红/绿。`unit`, `min`, `max`, `orientation: horizontal`, `format`, `commentary` 可选。当前为簇状柱/条图；多系列默认共享实际蓝，应显式区分系列角色，不能只靠相同蓝色解释不同类别。
- `kpis`：`kpis: [{label,value,note}]` 1–4 项。仅当内容真的是关键指标时使用；不因模板有 KPI 就制造指标。
- `cover`, `divider`：标题、子标题；divider 可加 number。不为凑页数增加结构页。

```text
python3 scripts/build-native.py examples/reference-learning.json /task/sample-v1.pptx --story examples/reference-story.json
python3 scripts/check-pptx.py /task/sample-v1.pptx --expected-slides N --expected-charts C --expected-tables T
```

`.layout.json` 为输入页→输出页映射及对象度量。源页拆成两页时全部正文保留，标题/来源/表头按需重复。`expectedSlides` 与实际规划不符即失败，不通过隐藏页面或删除事实满足数量。

v2 原 `export-pptx.mjs/build-deck.py` 为独立 artifact-tool/PPTD 本地路径，当前包不复制进执行链：其 1440 逻辑单位和当前英寸接口不同，未经适配与 Mac PowerPoint 验证，不能冒称已接入。

## 4.2 布局与桥接

默认 `designSystem: cpic-editorial`。新增输入见 `examples/editorial-learning.json`，其全部业务内容为虚构：

- `chartBrief`：原有 `categories/series/unit` 加0–4项 `kpis`、最多3行解释。多系列必须声明不同语义 role。最多12类；长类别名用横条且最多7类。轴不得隐藏数据，缺值不会补0。
- `comparison`：`leftHeading/rightHeading` 与 `pairs: [{leftTitle,leftBody,rightTitle,rightBody}]`。比较不画因果箭头。
- `comparisonMatrix`：`columns/rows`，首列为共享维度，其余2–4列为可比对象。原生 Table，正文与数据同组字号，非截图。
- `timeline`：`range:{start,end}` 和 `tasks:[{title,start,end,owner?,deliverable?,role?}]`，日期须为完整ISO日历日期。时间条按日期比例；零日或极短任务显示刻线，不能把条形人为拉长伪造工期。
- `agenda`：`items:[{title,body?}]`，按实际项数选3列及续页，不补空项。
- `cover`：可加 `eyebrow/footer`，无须素材图片。

`cpic-source` 的原稿参考模式、旧 `flow` 条目逻辑仍按原说明；`legacy-blue` 禁用新增路由设计系统。普通JSON中的不支持字段不会自动成为页面内容，须映射到支持字段并检查覆盖。

本机可选桥接命令、原生对象/形状区别与动画/音频边界见 `ppt-master-integration.md`。SVG的px坐标不能原样作为原生英寸或pt。


4.3模板风：`palette: template-blue`统一采用用户新素材的0A579B/063F8E/DCEEFC/FF7829；不设置则保留原CPIC配色。`fontProfile: template-kai`选择实际可用KaiTi/Arial，显式font优先；华文楷体声明仅在原生参考模板中保留，不代表本机安装该字体。新关系字段及JSON例子见templates123-learning.md与examples/templates123-demo.json。
