# PPT Master 融合与执行边界

已核对本机已安装的 ppt-master 和其[官方仓库](https://github.com/hugohe3/ppt-master)。2026-10-27上游SKILL标6.7.3；本机快照无版本元数据，不把它冒称6.7.3。用 `ppt-master-bridge.py doctor` 输出文件SHA256识别实际代码。原安装保持不变，不自动更新或复制整套图标/模板。

## 能力映射

| 能力 | 当前接法 | 验收/依赖边界 |
|---|---|---|
| 文档→内容→叙事 | 可选本地convert桥接，保留Markdown/转换台账；再用blue story.json确定逐页目的、事实与必保留内容 | PPTX和XLSX转换已实测；本机当前捆绑Python缺少mammoth/PyMuPDF，DOCX/PDF上游转换未运行。其他格式取决于python-pptx、mammoth、PyMuPDF、openpyxl或pandoc，缺依赖明确失败，不自动安装 |
| 内容/结构/样式分离 | 内容仍以来源为准；intake提供几何、主题、图表/表格和SmartArt结构；native输出记录designLock和页节奏 | 不把分析侧文件当作新业务事实；只看横向单行容量的检查不能替代blue的纵向量测和真实渲染 |
| 原生可编辑形状、图表、表格 | 默认blue原生生成；可选SVG→DrawingML桥接 | 默认SVG可编辑图表/表格可能只是形状；真正Chart/Table需语义marker及本机`--native-objects`或新版`--native-charts-and-tables`。二者不可混称 |
| 现成PPTX模板填充 | intake→显式fill_plan→template-check→template-apply，保留原版设计，生成新文件 | 实测修改文字数值、原生图表与表格；本地快照会重序列化XML，未改页可见XML一致但非字节级保留；不支持的SmartArt/组合图要保留并明确限制。填充检查不保证增字后仍合适，须blue测量和实际渲染 |
| 母版/Layout | SVG模板的validated structured路线为可选深度能力；读取已安装ppt-master的create-template流程 | 自由设计flat仅有基础Master/Blank Layout，不自动获得独立设计母版；本轮未做任意模板全保真验收 |
| 讲话备注 | blue的notes字段；或现有PPTX enhance-init/apply的notes模块 | 实测6页中文备注；不向备注添加无来源事实 |
| 页面转场 | 默认静态；用户要求时可选fade等本机实际注册的效果 | 6页备注+fade已做包验证和Mac原生全页静态显示检查；动态转场未单独验收；不能用静态PDF证明动画动态效果 |
| 对象入场动画 | SVG桥接显式`--animation fade/appear/...`；默认none | 静态SVG已原生验证。单页对象fade示例在Mac出现空白PDF及黑屏放映，Mac桥接现拒绝animation非none；其他客户端未验证，不承诺可用 |
| 旁白/录播 | 仅可选本地已授权音频；enhance-apply需`--allow-local-audio` | 不运行默认edge-tts，不读取API密钥。录播需每页音频、ffprobe及受支持的自动计时；本轮无音频/TTS/录播验收 |
| 图片、图标、公式、复杂SVG/SmartArt | 用户指定需求时由已安装ppt-master相关独立流程处理 | 非本轮新增的通用保证；LaTeX/图像服务/复杂SVG需对应依赖和单项验证，不能为“特性齐全”牺牲可编辑或可读性 |

## 本地桥接命令

```text
python3 scripts/ppt-master-bridge.py doctor
python3 scripts/ppt-master-bridge.py convert source.pptx --output /task/conversion/source.md
python3 scripts/ppt-master-bridge.py intake source.pptx --output-dir /task/new-analysis
python3 scripts/ppt-master-bridge.py template-check library.json fill_plan.json
python3 scripts/ppt-master-bridge.py template-apply source.pptx fill_plan.json --library library.json --output /task/project/exports/new.pptx
python3 scripts/ppt-master-bridge.py enhance-init source.pptx --project-dir /task/new-enhancement
python3 scripts/ppt-master-bridge.py enhance-apply /task/new-enhancement --output /task/new-notes.pptx
python3 scripts/ppt-master-bridge.py enhance-validate /task/new-enhancement
python3 scripts/ppt-master-bridge.py svg-export /task/authored-project --output /task/svg-static.pptx
```

可选根目录由全局`--root /absolute/existing/ppt-master`显式指定。桥接不下载、不改原件、不启动预览服务器，不暴露云TTS命令。原生blue主入口继续独立运行。

- 现成模板换内容：原件只读，按内容关系选页，逐项测量；不合适则换页、重排或在授权后续页，不能按旧提示删除必保留事实。
- 1:1美化要求：先锁定页数/顺序/文字，不擅自进入自动拆页。需要重构时按用户已授权范围处理。
- 模板与增强计划须明确内容映射/模块并确认；已有明确用户授权可作为该计划依据，不为本skill升级重复增加泛泛审批。桥接不提供`--force`绕过计划。
- 源SVG必须包含全部可见内容；`svg_final`仅预览，不是PPTX源。SVG以px设计，blue原生以in/pt量测，两套坐标不混用。
- 默认静态专业汇报；动画不因“融合”自动开启。备注、转场、局部编辑不得破坏原生可见对象、图表工作簿及关系。
- 在具体应用检查全部新增/受影响页和整套缩略图。替代渲染不等于Windows PowerPoint或WPS验证。

版权：PPT Master ©2025–2026 Hugo He，MIT；见 `reference/licenses/ppt-master-MIT.txt`。本包的桥接是新写代码，调用用户已有本地安装；不复制ppt-master附带的第三方模板、品牌logo、字体或商业素材；本轮用户提供的原生参考页按内部素材单独管理，见THIRD_PARTY_NOTICES.md。若将来复制实质上游代码或文档，需连同MIT全文和归因保留，先单独审查再公开发布。


## 本轮兼容性实测修复

本地模板填充曾使嵌入XLSX的 mc:Ignorable=x14ac 丢失对应命名空间声明，普通XML与数值检查通过，Mac PowerPoint的“在Excel中编辑数据”却报“链接的文件不可用”。本skill在新导出件上从授权源包恢复唯一可核实的声明，不改源稿、不覆盖ppt-master安装、不猜URI。修复后的模板在PowerPoint打开嵌入Excel，实际看到C2=96；重新通过桥接全链导出的4.3件也完成命名空间审计。`build-native.py`加入嵌套Office包命名空间审计。该修复不代替实际客户端编辑数据测试。

`compact-native-template.py`可对只含所选页的模板导出件，裁去未用母版/布局再按关系可达性清理资源；保留可见slide XML和使用中的主题。必须重新验证打开/实际渲染，不能只比较slide XML。原生参考页仍有字体许可/可用性和第三方版权边界。
