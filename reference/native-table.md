# 原生可编辑表格

本地导出器新增窄范围 `elementType: table`。输出真实 DrawingML 表格，单元格文字、行列和颜色可在支持原生表格的办公软件中编辑。它不同于旧 T2a 的文本框加矩形组合；旧页面保持原行为，不自动转换。

## 源格式

```yaml
elementId: metrics
elementType: table
bounds: [60, 160, 1200, 240]
data:
  - ["指标", "本期", "变化"]
  - ["收入", "示例值", "示例值"]
  - ["成本率", "示例值", "示例值"]
colWidths: [600, 300, 300]
rowHeights: [80, 80, 80]
headerRows: 1
body:
  fill: $lt1
  color: $inkBody
  # 字号与中西文字体继承工作副本主题的 tableBody，缺项再继承 body
  align: [left, middle]
header:
  fill: $navy
  color: $lt1
  bold: true
  align: [center, middle]
borders: {color: $rulePanel, width: 0.75, style: solid}
padding: [6, 10, 6, 10]
```

- 所有尺寸、字号、边框宽度使用 PPTD 的逻辑点，导出时乘以 `4/3` 转换为 API 像素。
- `data` 必须是非空、等列数的二维纯字符串数组。数字也写成字符串，以保留单位、小数位和百分号；不自动计算。支持字符串中的换行，不解析 HTML 或 Markdown。
- `bounds` 为 `[左, 上, 宽, 高]`。`colWidths`、`rowHeights` 必填、全部为正数，数量须与列数和行数一致，总和分别等于宽、高，允许 `0.01` 点的浮点误差。
- `headerRows` 默认 `1`，可为 `0` 至总行数的整数。它为顶部连续若干行设置表头样式，不创建合并单元格。设为 `0` 时不得提供 `header`。
- `body` 和 `header` 仅支持 `fill`、`color`、`fontSize`、`fontFamily`、`bold`、`align`。填充和文字颜色允许十六进制色或主题色引用；不支持渐变填充。`fontFamily` 可为字符串，或 `{latin, ea}`。
- 主题是唯一的颜色、字阶来源。正文填充默认 `$lt1`；字号、字体、文字颜色、加粗依次继承 `theme.textStyles.tableBody`、`theme.textStyles.body`，文字颜色无定义时用 `$inkBody`，加粗无定义时为 `false`。默认左对齐、垂直居中。若主题没有字号或字体，必须在 `body` 中显式提供，导出器不补入另一套字号或字体。
- 表头继承正文的字体、字号和对齐，默认填充 `$navy`（该 token 不存在时用 `$brand1`）、文字色 `$lt1`、加粗；显式 `header` 字段覆盖这些默认值。显式字号、字体、颜色均保留原值。使用主题色却缺少对应 token 时直接报错，不静默使用另一套颜色。
- `align` 为 `[left|center|right, top|middle|bottom]`。`padding` 为 `[上, 右, 下, 左]`，默认 `[6,10,6,10]`，不能占满最窄或最矮单元格。
- `borders` 使用统一边框：`{color, width, style}`，`style` 支持 `solid`、`dash`、`dot`；`false` 表示无边框。默认 `$rulePanel`、0.75 点实线。

## 明确不支持

合并单元格、单元格独立样式、交替行色、公式、自动增减行高、富文本、条件格式、旋转、翻转、整体透明度及其他未列字段均不在此源格式内。导出器对未知字段或不满足条件的数据直接报错，不静默丢弃。需要这些能力时，走当前环境完整原生表格 API，并另做验收。

## 验收

```text
python scripts/check-pptx.py output.pptx --expected-tables 1
```

检查器验证真实表格数量、列网格、行高和每格可编辑的文字结构，并输出 `native_tables`、`validated_native_tables`、`native_table_cells`、`editable_table_cells`。这不代替逐页渲染检查，也不证明目标办公软件中的显示效果或数据正确性。固定行高仍需按文字量设计，导出不自动缩字。

回归测试需要现成的 Node、Python 与 `@oai/artifact-tool`，不安装依赖、不联网：

```text
node scripts/test-native-table.mjs "<新测试目录>" --module-root "<node_modules>" --python "<Python路径>"
```

测试创建两页原生表格、检查 16 个可编辑单元格及不支持输入的拒绝行为，并保存预览供人工复核。测试目录父目录须存在，且新测试目录不得已存在。
