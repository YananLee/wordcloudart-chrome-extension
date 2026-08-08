# Chrome Web Store 提交文案

控制台每一栏的现成内容，直接复制粘贴即可。英文为主语言，中文可在
「Store listing」右上角切换语言后另填一份。

---

## Store listing

### Name（上限 75 字符）

```
WordCloudArt — Word Cloud from Any Page
```

### Summary / 简介（上限 132 字符）

```
Turn selected text or a page's main article into a word cloud. Download the PNG or copy it to the clipboard. Runs fully offline.
```

中文版：

```
把网页上选中的文本或自动识别的正文变成词云图，可下载 PNG 或直接复制。全程本地运行，不上传任何内容。
```

### Description / 详细说明

```
Highlight a few paragraphs, or nothing at all, and get a word cloud of what
the page is actually about.

WordCloudArt lives in Chrome's side panel, next to the page you are reading.
Click Generate and it counts the words, sizes them by how often they appear,
and packs them into the shape you picked. Save the result as a PNG or copy it
straight into a slide, a document, or a chat.

HOW IT WORKS

• Select text on the page, then click Generate — the cloud is built from your
  selection.
• Select nothing, and the extension finds the main article for you. Navigation
  bars, footers, comment threads, related-story rails and ad blocks are left
  out, so the cloud reflects the writing rather than the furniture around it.
• Prefer to decide yourself? Switch the source to Selection or Whole page.

WHAT YOU CAN CHANGE

• 12 shape templates: circle, square, rounded square, triangle, diamond,
  hexagon, star, heart, oval, cloud, arrow, and a free-form classic layout.
• 5 colour palettes: Ocean, Sunset, Forest, Mono, Berry.
• Up to 500 words, with an option to repeat frequent words so the shape fills
  in densely.
• Vertical words on or off, common words (the, and, of…) kept or dropped, and
  your own exclusion list for words you never want to see.
• Four export sizes, from 600 px up to 1600 px.

ALSO USEFUL

• Table view lists every word with its count, so you can see the numbers
  behind the picture.
• Works on English and Chinese text.
• Your template, palette and exclusions are remembered for next time.

PRIVACY

Everything happens on your machine. The extension makes no network requests at
all: no analytics, no remote code, no accounts, no uploads. Page text is read
only when you click Generate, is used to count words and draw the image, and
is gone when you close the panel.

Requires Chrome 114 or newer for the side panel.

More shapes and fonts at https://wordcloud.art
```

中文版：

```
选中几段文字，或者什么都不选，就能得到一张反映这个页面在讲什么的词云图。

WordCloudArt 停在 Chrome 的侧边栏里，紧挨着你正在读的页面。点 Generate，它会
统计词频、按出现次数决定字号，再把这些词填进你选的形状里。结果可以存成 PNG，
也可以直接复制到幻灯片、文档或聊天窗口。

怎么用

• 在页面上选中文本，点 Generate，词云就基于你的选区生成。
• 什么都不选，扩展会自动找出正文。导航栏、页脚、评论区、相关推荐和广告块都会
  被排除，所以词云反映的是文章本身，而不是周围的装饰。
• 想自己决定？把来源切到 Selection（只用选区）或 Whole page（只用正文）。

可以调什么

• 12 种形状模板：圆形、方形、圆角方形、三角形、菱形、六边形、星形、心形、
  椭圆、云朵、箭头，以及自由排布的经典布局。
• 5 套配色：Ocean、Sunset、Forest、Mono、Berry。
• 最多 500 个词，可让高频词重复出现，把形状填得更满。
• 竖排词开关、常用词（the、and、of……）保留或剔除，以及你自己的排除词列表。
• 四档导出尺寸，从 600 px 到 1600 px。

还有

• 表格视图列出每个词及其出现次数，让你看到图背后的数字。
• 中英文都支持。
• 模板、配色和排除词会被记住，下次打开还在。

隐私

一切都在你的电脑上完成。扩展不发起任何网络请求：没有统计、没有远程代码、
没有账号、没有上传。页面文本只在你点 Generate 时被读取，用完即弃。

需要 Chrome 114 及以上版本（侧边栏功能）。

更多形状与字体：https://wordcloud.art
```

### Category

`Productivity` → `Workflow & Planning`

### Language

English（主语言），可另加 Chinese (Simplified)

### Official website

```
https://wordcloud.art
```

### Support URL

```
https://github.com/YananLee/wordcloudart-chrome-extension/issues
```

---

## Graphic assets

| 素材 | 尺寸 | 数量 | 说明 |
|---|---|---|---|
| Screenshot | 1280×800 或 640×400 PNG | 1–5（建议 3–5） | 见下方建议 |
| Store icon | 128×128 PNG | 1 | 用 `icons/icon128.png` |
| Small promo tile | 440×280 PNG | 可选 | 出现在商店分类页 |
| Marquee promo tile | 1400×560 PNG | 可选 | 只有被推荐时才用得上 |

截图建议拍这几张（1280×800，浏览器窗口宽度调到 1280 左右再截图）：

1. 一篇文章 + 打开的侧边栏，圆形词云已生成 —— 展示主流程
2. 换一个形状模板（心形或星形）+ 另一套配色 —— 展示多样性
3. 表格视图 —— 展示词频功能
4. 页面上有一段高亮选区 + 基于选区生成的词云 —— 展示选区模式
5. 一个中文页面的词云 —— 展示中文支持

截图里不要出现你的书签栏、个人账号头像或其他扩展图标，审核方对此比较敏感。

---

## Privacy practices

### Single purpose description

```
Generate a word cloud image from the text of the page the user is currently
viewing, either from their selection or from the page's main article.
```

### Permission justifications

| 权限 | 理由（直接粘贴） |
|---|---|
| `sidePanel` | Displays the extension's interface in Chrome's side panel, next to the page the user is reading. |
| `scripting` | Injects a one-off script into the active tab when the user clicks Generate, to read the selected text or the page's main article. Nothing is injected until the user asks for a word cloud. |
| `tabs` | Reads the active tab's title and URL to label the panel, to name the downloaded PNG, and to tell the user when a page cannot be read (for example chrome:// pages). |
| `contextMenus` | Adds a right-click menu entry so the user can open the panel directly from selected text. |
| `storage` | Stores the user's own interface settings (template, palette, word limit, exclusion list) locally so they persist between sessions. |
| Host permission `http://*/*`, `https://*/*`, `file:///*` | The user can ask for a word cloud on any page they are reading, so the text-reading script must be injectable on any site. The extension never contacts a server and reads a page only in response to an explicit Generate click. |

### Remote code

选 **No, I am not using remote code**。所有 JavaScript 都打包在扩展里，
`src/vendor/wordcloud2.js` 是随包发布的第三方布局库，不从网络加载。

### Data usage

所有数据类型 **都不勾选**，然后勾上三条声明：

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL

建议在官网放一个页面，与 `homepage_url` 同域更可信：

```
https://wordcloud.art/privacy
```

临时可用仓库里的文件：

```
https://github.com/YananLee/wordcloudart-chrome-extension/blob/master/PRIVACY.md
```

---

## Distribution

- Visibility: **Public**
- Regions: All regions
- Pricing: Free

---

## 提交前自查

- [ ] `npm run zip` 重新打包，确认 `manifest.json` 的 `version` 已递增
- [ ] 隐私政策 URL 能公开访问（无需登录）
- [ ] 截图是 1280×800，没有个人信息
- [ ] 开发者账号的联系邮箱已验证（会公开显示）
- [ ] 商店名称、简介、详细说明里没有夸大或第三方商标

首次提交因为申请了宽泛的 host permissions，审核通常要几天到一两周；
之后的版本更新一般快得多。
