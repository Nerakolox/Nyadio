# Nyadio · STYLE

品牌主题 **Sakura Cream(樱乳)**:暖奶油色作画布,樱花粉作主角,薄荷青作点缀,暖墨色作文字。浅色系为主,深色模式作镜像映射。

> 一句话基调:**奶油底、樱粉心、薄荷点睛、暖墨为字。** 甜而不腻——靠"粉只在该出现的地方出现、青极少量"维持克制。

---

## 1. 色板阶梯(原始 ramp)

这些是原料,语义 token(第 2 节)从中取值,业务里**优先用语义 token,而非直接引用阶梯**。

### Sakura Pink(主色)
| 级 | 值 | 典型用途 |
| --- | --- | --- |
| 50 | `#FFF1F5` | 粉色超浅底、hover 背景 |
| 100 | `#FFE1EA` | 选中态浅底、标签底 |
| 200 | `#FFC4D6` | 分隔、禁用态主色 |
| 300 | `#FFA0BD` | 装饰、深色模式主色 |
| **400** | **`#FF7AA2`** | **品牌主色**:字标、大面积装饰、点缀(不承载小号文字) |
| 500 | `#F1588A` | 主色 hover |
| 600 | `#D43F73` | 按钮填充、可点击主色 |
| **700** | **`#B23A63`** | **深主色**:链接、需要可读的粉色文字/图标、边框强调 |
| 800 | `#872A4C` | 按下态、深色模式文字粉 |
| 900 | `#5C1C34` | 粉底上的文字色 |

### Mint(点缀色,用量 ≤10%)
| 级 | 值 | 用途 |
| --- | --- | --- |
| 50 | `#EAF8F5` | 青色浅底 |
| 100 | `#D2F0EA` | 信息/在线浅底 |
| 300 | `#A6E0D8` | 装饰 |
| **500** | **`#7ED0C6`** | **点缀主体**:在线圆点、心标、收藏、强调小件 |
| 700 | `#3E9E92` | 青色 hover |
| 900 | `#226158` | 浅底上的青色文字 |

### Warm Neutral(暖中性 / 表面与文字)
| 名 | 值 | 用途 |
| --- | --- | --- |
| cream | `#FFF6F4` | 页面底色(画布) |
| white | `#FFFFFF` | 卡片/抬升表面 |
| subtle | `#FFFBFA` | 次级表面、分组底 |
| border | `#F2DFE4` | 默认边框/分隔 |
| border-strong | `#E6C9D1` | hover/强调边框 |
| ink | `#2B1F25` | 主文字(暖墨,非纯黑) |
| muted | `#715C64` | 次要文字 |
| faint | `#A6929A` | 提示/占位文字 |

---

## 2. 语义 token(浅色为默认,深色为映射)

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `--nya-bg` | `#FFF6F4` | `#181215` | 页面底 |
| `--nya-surface` | `#FFFFFF` | `#221A1E` | 卡片/弹层 |
| `--nya-surface-subtle` | `#FFFBFA` | `#1E171A` | 次级表面 |
| `--nya-border` | `#F2DFE4` | `#382A30` | 默认边框 |
| `--nya-border-strong` | `#E6C9D1` | `#4A3740` | hover 边框 |
| `--nya-text` | `#2B1F25` | `#F6EAEE` | 主文字 |
| `--nya-text-secondary` | `#715C64` | `#C7AEB6` | 次要文字 |
| `--nya-text-tertiary` | `#A6929A` | `#8E767F` | 提示文字 |
| `--nya-primary` | `#FF7AA2` | `#FF8FB0` | 品牌主色(装饰/大面积/字标) |
| `--nya-primary-strong` | `#B23A63` | `#FFA0BD` | 可读粉:链接、粉色文字/图标 |
| `--nya-primary-fill` | `#D43F73` | `#FF7AA2` | 主按钮填充 |
| `--nya-primary-hover` | `#C13A69` | `#FF9FBC` | 主按钮 hover |
| `--nya-on-primary` | `#FFFFFF` | `#2B0E18` | 主按钮上的文字 |
| `--nya-accent` | `#7ED0C6` | `#8FDCD2` | 点缀(在线点/心标) |
| `--nya-accent-text` | `#226158` | `#8FDCD2` | 浅底上的青色文字 |
| `--nya-link` | `#B23A63` | `#FFA0BD` | 链接 |
| `--nya-focus-ring` | `rgba(255,122,162,.45)` | `rgba(255,143,176,.5)` | 焦点环 |

### 状态色
| Token | Light 主/文字/底 | Dark 主 |
| --- | --- | --- |
| success | `#2E9E6E` / `#1C6B49` / `#E8F6EF` | `#4FC78E` |
| warning | `#DD8B1E` / `#8F570F` / `#FBF0DD` | `#F0AE4E` |
| danger | `#E0483C` / `#97271F` / `#FCE9E7` | `#FF6F63` |
| info | `#3E86E0` / `#1E4F94` / `#E8F0FC` | `#6FA8F0` |

> 危险色刻意偏橙红 `#E0483C`,和樱粉拉开色相,避免"红粉不分"。

---

## 3. CSS 变量(可直接用)

```css
:root {
  /* surfaces */
  --nya-bg: #FFF6F4;
  --nya-surface: #FFFFFF;
  --nya-surface-subtle: #FFFBFA;
  --nya-border: #F2DFE4;
  --nya-border-strong: #E6C9D1;
  /* text */
  --nya-text: #2B1F25;
  --nya-text-secondary: #715C64;
  --nya-text-tertiary: #A6929A;
  /* brand */
  --nya-primary: #FF7AA2;
  --nya-primary-strong: #B23A63;
  --nya-primary-fill: #D43F73;
  --nya-primary-hover: #C13A69;
  --nya-on-primary: #FFFFFF;
  --nya-accent: #7ED0C6;
  --nya-accent-text: #226158;
  --nya-link: #B23A63;
  --nya-focus-ring: rgba(255, 122, 162, .45);
  /* state */
  --nya-success: #2E9E6E; --nya-success-text: #1C6B49; --nya-success-bg: #E8F6EF;
  --nya-warning: #DD8B1E; --nya-warning-text: #8F570F; --nya-warning-bg: #FBF0DD;
  --nya-danger:  #E0483C; --nya-danger-text:  #97271F; --nya-danger-bg:  #FCE9E7;
  --nya-info:    #3E86E0; --nya-info-text:    #1E4F94; --nya-info-bg:    #E8F0FC;
  /* radius */
  --nya-radius-sm: 6px;
  --nya-radius-md: 10px;
  --nya-radius-lg: 14px;
  --nya-radius-xl: 20px;
  --nya-radius-pill: 999px;
  /* elevation (warm-tinted shadows) */
  --nya-shadow-sm: 0 1px 2px rgba(92, 28, 52, .06);
  --nya-shadow-md: 0 4px 12px rgba(92, 28, 52, .08);
  --nya-shadow-lg: 0 12px 32px rgba(92, 28, 52, .10);
  /* typography */
  --nya-font-sans: "Inter", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --nya-font-display: "Baloo 2", "Quicksand", var(--nya-font-sans);
  --nya-font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --nya-bg: #181215;
    --nya-surface: #221A1E;
    --nya-surface-subtle: #1E171A;
    --nya-border: #382A30;
    --nya-border-strong: #4A3740;
    --nya-text: #F6EAEE;
    --nya-text-secondary: #C7AEB6;
    --nya-text-tertiary: #8E767F;
    --nya-primary: #FF8FB0;
    --nya-primary-strong: #FFA0BD;
    --nya-primary-fill: #FF7AA2;
    --nya-primary-hover: #FF9FBC;
    --nya-on-primary: #2B0E18;
    --nya-accent: #8FDCD2;
    --nya-accent-text: #8FDCD2;
    --nya-link: #FFA0BD;
    --nya-focus-ring: rgba(255, 143, 176, .5);
    --nya-success: #4FC78E; --nya-success-text: #B7EBD2; --nya-success-bg: #16321F;
    --nya-warning: #F0AE4E; --nya-warning-text: #F6DDA8; --nya-warning-bg: #3A2A12;
    --nya-danger:  #FF6F63; --nya-danger-text:  #FBC9C4; --nya-danger-bg:  #3A1815;
    --nya-info:    #6FA8F0; --nya-info-text:    #C3DAF8; --nya-info-bg:    #14233A;
  }
}

/* manual toggle: set <html data-theme="dark"> to force dark regardless of OS */
[data-theme="dark"] {
  --nya-bg: #181215; --nya-surface: #221A1E; --nya-surface-subtle: #1E171A;
  --nya-border: #382A30; --nya-border-strong: #4A3740;
  --nya-text: #F6EAEE; --nya-text-secondary: #C7AEB6; --nya-text-tertiary: #8E767F;
  --nya-primary: #FF8FB0; --nya-primary-strong: #FFA0BD; --nya-primary-fill: #FF7AA2;
  --nya-primary-hover: #FF9FBC; --nya-on-primary: #2B0E18;
  --nya-accent: #8FDCD2; --nya-accent-text: #8FDCD2; --nya-link: #FFA0BD;
  --nya-focus-ring: rgba(255, 143, 176, .5);
  --nya-success: #4FC78E; --nya-success-text: #B7EBD2; --nya-success-bg: #16321F;
  --nya-warning: #F0AE4E; --nya-warning-text: #F6DDA8; --nya-warning-bg: #3A2A12;
  --nya-danger:  #FF6F63; --nya-danger-text:  #FBC9C4; --nya-danger-bg:  #3A1815;
  --nya-info:    #6FA8F0; --nya-info-text:    #C3DAF8; --nya-info-bg:    #14233A;
}
```

---

## 4. 字体

正文用干净中性的 sans;字标(wordmark)可用一款圆润字体增加"可爱",其余保持克制。

| 角色 | 变量 | 取值 |
| --- | --- | --- |
| 正文 | `--nya-font-sans` | Inter / system-ui / PingFang SC |
| 字标·展示 | `--nya-font-display` | Baloo 2 / Quicksand(圆润,出甜感) |
| 等宽 | `--nya-font-mono` | JetBrains Mono |

字号阶梯:`12 / 14 / 16(base)/ 18 / 22 / 28 / 36`。
字重:`400 常规`、`500 中粗`、`700 标题`。
行高:正文 `1.6`,密集 `1.25`,宽松 `1.75`。

---

## 5. 圆角 / 间距 / 阴影

圆角偏圆以贴合"可爱":卡片用 `--nya-radius-lg(14)`,按钮/输入 `--nya-radius-md(10)`,标签/状态点用 pill。
间距走 4 的倍数:`4 / 8 / 12 / 16 / 24 / 32 / 48`。
阴影是**暖粉调**(`rgba(92,28,52,…)`),不是中性灰,用以强化奶油氛围;保持轻、不堆叠。

---

## 6. 使用规则(重要)

**对比度红线。** 主色 `#FF7AA2`(400)较亮,**不可承载小号白字**(白字落在它上面对比不足)。规则:
- 大面积装饰、字标、点缀 → 用 `--nya-primary`(400)。
- 链接、需要可读的粉色文字/图标 → 用 `--nya-primary-strong`(700 `#B23A63`)。
- 带白字的粉色按钮 → 填充用 `--nya-primary-fill`(600 `#D43F73`),文字 `--nya-on-primary` 白。

**点缀克制。** 薄荷青 `--nya-accent` 用量控制在界面 10% 以内——在线圆点、心标、收藏、个别强调。一旦铺开就破坏"奶油+樱粉"的主调。

**表面层级。** 页面底 `--nya-bg`(奶油)→ 卡片 `--nya-surface`(白)靠"更白"抬升,不要白卡片压白底;次级分组用 `--nya-surface-subtle`。

**深色模式镜像。** 深色底带粉调暖味(`#181215`),主色上移到更亮的粉(`#FF8FB0`),按钮填充改用 400、文字转深(`--nya-on-primary` 暗),保证暗底可读。

**别做的:** 不用纯黑文字(用暖墨 `#2B1F25`);不用中性灰阴影(用暖粉调);危险态不用偏粉的红,坚持橙红 `#E0483C` 与品牌拉开色相。

---

**一句话给实现:** 全部取语义 token,粉分三档用途(装饰 400 / 文字 700 / 按钮 600),青只点睛,文字用暖墨,阴影带粉调,深色模式按映射表整体上移。