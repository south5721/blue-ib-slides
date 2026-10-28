# 可选本地 PPT Master

主生成器独立可用。桥接只调用已有安装中的确切脚本，不安装、更新或修改原技能：

```sh
python3 scripts/ppt-master-bridge.py --root /path/to/ppt-master doctor
python3 scripts/ppt-master-bridge.py --help
```

doctor 输出存在情况和哈希，不代表能力已通过目标应用测试。命令包括本地 convert、intake、template-check/apply、enhance-init/apply/validate、svg-export。缺失脚本或依赖会报错，不猜命令或切换远程服务。

模板填充与增强需已核对内容映射和具体模块，计划设为 confirmed。已有用户授权可满足对应范围，不增加重复审批。输出须新路径，源文件不变。生成模板后审计命名空间；选定页的未使用母版/布局可用 compact-native-template.py 单独清理副本，再实际渲染复核。

SVG 默认静态。可编辑形状不等于真正 Chart/Table；--semantic-native 仅在上游提供原生导出选项时有效。自由设计页不自动拥有 Master/Layout。Mac 上拒绝非 none 对象动画，源于已测试组合的空白渲染；其他客户端也须验证。默认不生成音频、录播，不调用 edge-tts 或外部服务。

上游：[hugohe3/ppt-master](https://github.com/hugohe3/ppt-master)，MIT，Copyright (c) 2025–2026 Hugo He。本包提供原创本地适配，不捆绑上游代码、模板、图标、字体或媒体。若另行复制其代码/文档，应保留上游完整版权及许可；本桥接不替代其依赖说明。
