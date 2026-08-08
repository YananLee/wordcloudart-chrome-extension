# WordCloudArt — Chrome 扩展

把网页上选中的文本、或自动识别出的正文，变成一张词云图。与 Google Docs 插件版
（`wordcloudart-docs-addon`）功能一致，但运行在浏览器侧边栏里，独立仓库、独立发布。

## 功能

- 侧边栏面板（Manifest V3 Side Panel），点工具栏图标或右键菜单打开
- 文本来源三选一：
  - **Auto**：有选区就用选区，没有就用正文（与 Docs 版行为一致）
  - **Selection**：只用当前选中的文本
  - **Whole page**：忽略选区，直接抽取页面正文
- 正文识别：Readability 风格打分，排除导航/页脚/侧栏/评论/广告等噪声块
- 基于 [wordcloud2.js](https://github.com/timdream/wordcloud2.js) 布局
- 英文分词 + 中文二字词 + 停用词/自定义排除词
- 12 个内置几何模板（形状用像素蒙版裁剪）、5 套配色
- 可重复填充至 Max words（默认 150）
- 预设导出尺寸 Small / Medium / Large / XL
- 下载 PNG、复制图片到剪贴板、查看词频表
- 设置项自动记忆（`chrome.storage.local`）

## 目录

```
manifest.json                     # MV3 清单
src/background/service-worker.js  # 打开侧边栏、右键菜单
src/content/extract.js            # 按需注入：读选区 + 识别正文
src/lib/text.js                   # 分词、词频、重复填充
src/lib/templates.js              # 内置模板配置
src/lib/wordcloud-engine.js       # Canvas 词云引擎 + 形状蒙版
src/vendor/wordcloud2.js          # 上游布局库（未改动）
src/sidepanel/                    # 侧边栏 UI
icons/                            # 16/32/48/128 图标
```

无构建步骤，源码即产物。

## 本地加载

1. 打开 `chrome://extensions`
2. 右上角开启 **开发者模式**
3. 点 **加载已解压的扩展程序**，选择本目录
4. 在任意网页点工具栏的 WordCloudArt 图标打开侧边栏

需要 Chrome 114 及以上（Side Panel API）。

## 打包

```bash
npm run zip     # 生成 dist/wordcloudart-<version>.zip
```

## 权限说明

| 权限 | 用途 |
|---|---|
| `sidePanel` | 显示侧边栏面板 |
| `scripting` | 点击 Generate 时向当前标签页注入一次取词脚本 |
| `tabs` | 读取当前标签页的标题/URL，用于状态提示与文件名 |
| `contextMenus` | 右键菜单入口 |
| `storage` | 本地记忆界面设置 |
| `host_permissions` | 允许在普通网页上取词；`chrome://`、Chrome 应用商店等页面 Chrome 本身禁止注入 |

所有处理都在本地完成，不上传任何文本或图片。详见 [PRIVACY.md](PRIVACY.md)。

## 已知限制

- 中文仍是二字词切分，没有真正的分词词典（与 Docs 版一致）
- 只读取主框架，正文在 iframe 里的页面（少数）取不到
- PDF 内置阅读器、`chrome://` 页面、Chrome 应用商店无法注入

## 与 Docs 版的关系

两个仓库互相独立，不共享构建或运行时。词云引擎（`wordcloud-engine.js`）和模板配置
从 Docs 版逐字移植，改动只发生在文本来源和导出方式上：Docs 版「插入到文档」在这里
换成「下载 / 复制到剪贴板」。
