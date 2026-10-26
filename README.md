# blue-ib-slides

以蓝色标签、橙色动作词和关系图解制作可编辑PPTX的个人技能。支持字体实际测量、同级字号、内容驱动重排、完整模块拆页、原生表格和内嵌数据图表。公文条目风为可选模式。

这是待验收的`4.1.0-rc.1`公开准备版。所有示例均为虚构的社区阅读计划；不附训练文档、公司素材、源稿截图、品牌logo或字体文件。图解组件为独立原生矢量实现，公开版不宣称复刻某家公司的字体与背景。

![虚构公开样例](examples/preview.png)

[下载可编辑虚构样例](examples/demo.pptx)；源输入为`examples/demo.json`。

## 安装与运行

需要Node 22或更新版本、Python 3.9或更新版本，以及目标应用能使用的中文字体。本包使用两个固定版本依赖，安装不执行生命周期脚本：

```sh
npm ci --ignore-scripts
python3 scripts/build-native.py examples/demo.json out/demo-v1.pptx
npm test
```

若Node不在PATH，可设置`BLUE_IB_NODE`。选择本机已有CJK字体可设置`BLUE_IB_FONT`；字体文件未被canvas发现时，可通过`BLUE_IB_FONT_FILES`指定明确的本地文件，多个文件按操作系统路径分隔符分开。缺字体会报错，不会联网下载或静默替换。字体family必须同时在测量环境与目标渲染应用中可用。

将本目录作为`blue-ib-slides`技能文件夹放入工具支持的个人skills目录即可使用`SKILL.md`。保留原文件夹和依赖在一起；已有同名技能时先备份，在独立目录测试，不默认覆盖。

结构：`SKILL.md`、`references/`、`scripts/`、`assets/`、`examples/`和`tests/`。布局字段见[JSON说明](references/schema.md)。生成器保留源文件，输出已存在时停止。`out/`及旁置检查JSON不属于默认发布文件。

## 在Codex中使用

安装后新建任务、附上材料，并明确调用`$blue-ib-slides`。例如：

- 生成：`$blue-ib-slides 根据附件做一份可编辑PPTX，默认图解风，保留事实、数值和来源。长文优先重排或拆页，并渲染每页检查。`
- 精修：`$blue-ib-slides 先检查附件PPT的字体、密度与布局，再在副本上改进，保留业务事实，交付可编辑版本和实际对照。`
- 参考风格：`$blue-ib-slides 从我的参考稿提炼网格、字阶、留白和关系图解，用于这次新内容；私有素材只留在本次任务。`

可在请求中补充案头/投影、页数偏好、听众、目标应用和允许使用的字体。技能会结合内容判断版式；不承诺所有输入都能自动完美排版。

工程脚本接收声明式JSON，已覆盖四栏同级模块、共享枢纽、三段证据、原因与动作、对齐条目、表格、柱图及双图。任意PPTX的导入、复杂架构/泳道/循环或精确保真重写，需要能读取附件并操作目标应用的agent和额外实现，不能把JSON生成器描述成通用保真转换器。

## 字体与许可

原创代码和文档拟采用MIT，见[LICENSE](LICENSE)；发布前由维护者确认。直接依赖为PptxGenJS 4.0.1和@napi-rs/canvas 0.1.100，均按其MIT许可证使用，归因和完整许可见[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。依赖代码、原生二进制和字体均不在此仓库中重新打包。

Noto Sans CJK可作为开源字体选择，其上游采用SIL Open Font License 1.1；参见[Noto Sans CJK许可](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)。本包不附带该字体。其他系统或商业字体应由使用者依据相应授权自行安装，不将其名称或本机可用状态视为再分发许可。

## 验证与编辑

机械检查覆盖ZIP关系、Office锚点、文字覆盖和图表缓存/XLSX一致性。`npm test`不等于视觉通过。交付时需查看实际PPTX全套缩略图及每页渲染，并说明客户端、版本和字体。

`editReserve`是生成期预留估计；noAutofit保持几何和角色字号，但不保证编辑后不溢出。长文先换版/拆页；有限增字需在目标应用保存重开实测。Windows PowerPoint、WPS等环境未实测时应明确说明。

## 本轮实际验证

在独立目录通过`npm ci --ignore-scripts`安装锁定依赖，确认未借用宿主的node_modules；Node24.19.0、Python3.9.6和3.12.14环境中17项生成/内容/表格/图表/负向测试通过。6页虚构样例在Mac PowerPoint16.112实际打开、导出PDF并逐页查看，中文字体为DengXian Regular/Bold，无字体替换。字体文件不随包分发。

以上是隔离依赖目录测试，未重装操作系统；Windows PowerPoint、WPS和其他字体环境尚未验证。公开组件与私有定制稿有差别，私有稿相似度评分不适用于本包。
