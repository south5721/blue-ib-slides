# JSON字段与可执行边界

根字段：`title`、`slides`，可选`font/profile/designSystem/layoutPolicy/editReserve/source/footer`。`font`使用目标应用的真实字体family；`profile`为`desk/projection`；`designSystem`为`blue-ib/report`。所有几何为英寸，字体为pt，画布13⅓×7.5。

每页含`title/layout`，可选`subtitle/source/notes`：

|layout|必需内容|
|---|---|
|peerColumns|2–4个`modules`，每项`title/action/body`，可选原生线图标`icon`|
|bullets|`bullets`，每项`heading/text`|
|hubEvidence|`hub:{title,body}`及`branches:[{title,body}]`|
|evidenceRows|`evidenceRows:[{label,evidence,implication}]`|
|causeEffect|`pairs:[{cause,effect}]`及`conclusion:{title,body}`|
|table|`columns/rows`，可选正权重`colWidths`|
|barChart|`categories/series`；series含`name/values/role`|
|dualChart|`leftChart/rightChart`各含`title/kind/categories/series`，kind为bar或line|

图表最多8类、4系列；普通report条图最多3系列。实际值用蓝色、预测用橙色，不把预测当已实现结果。所有数据必须有限且长度一致。线图标签过近时明确失败；可显式关闭标签并附完整原生数据表，不能静默隐藏重要数值。

可选线图标：`users/user-check/goal-arrow/target/layers/search/clipboard/checks/data/anchor/ship/map-pin`。它们均为本包自行绘制的原生形状。未知名称报错。

可选彩色文本run：`titleRuns/subtitleRuns`，模块的`titleRuns/actionRuns/bodyRuns`，条目的`headingRuns/textRuns`，每run为`{text,color}`。完整文本必须与主字段一致，只改变强调颜色。不要靠逐字缩小来塞字。

`layoutPolicy: reference`是显式密集案头预设：3卡正文12pt、共享枢纽16pt、4栏20/28/18pt，无增字预留。它使用公共通用组件，不包含任何私有参考稿的纹理、品牌字形或精确复刻授权。复杂架构、泳道、瀑布等未实现，需另行实现和实测。

数值表格默认采用语言的标准数字表示。需要固定小数位或保留尾零时，将单元格传为明确格式的字符串，如`"2.0"`。

## 4.3 新内容页面

默认 designSystem: blue-editorial。palette: template-blue 为全套蓝色预设；fontProfile: business-sans 为默认，template-kai 需要已有 KaiTi 字体，也可用显式 font 覆盖。

- cover: title/subtitle/eyebrow/footer。
- agenda: items[{title,body}]。
- comparison: leftHeading/rightHeading 与 pairs[{leftTitle,leftBody,rightTitle,rightBody}]。
- comparisonMatrix: columns 与等长 rows；首列为共同维度。
- timeline: range{start,end} 和 tasks[{title,start,end,owner,deliverable}]，日期为有效 YYYY-MM-DD，条带按日期比例。
- chartBrief: categories/series[{name,values,role}]，可选 kpis[{label,value,note}]、commentary、orientation/min/max。值必须完整且有限，多系列需不同语义 role。
- strategyHouse: roof、2–4项 pillars[{title,body}]、foundation{title,body}。
- cycleEvidence: centerLabel、3–6项 steps[{title,date?,text}]，须确有循环关系。
- phaseBand: 至少2项 steps[{title,date?,text}]、可选 summary，保留先后顺序。

详见 examples/editorial.json。新三类关系支持完整长文本续页；其他预设超出容量时清晰失败，需要明确拆分，不承诺任意输入都自动适配。
