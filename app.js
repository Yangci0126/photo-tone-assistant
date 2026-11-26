/* ============================================================
   影调助手 · app.js
   纯前端：Canvas 像素统计 + 规则引擎 + PS 参数输出
   ============================================================ */

/* ---------------- 1. 基础工具 ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fmtNum(v, d = 0) {
  const s = Math.abs(v).toFixed(d);
  return (v > 0 ? '+' : v < 0 ? '-' : '') + s;
}
function rangeText(mid, span, digits = 0, unit = '') {
  if (!span) return fmtNum(mid, digits) + unit;
  if (Math.abs(mid) <= span * 0.5) return '±' + span.toFixed(digits) + unit;
  return fmtNum(mid - span, digits) + ' ~ ' + fmtNum(mid + span, digits) + unit;
}
function mk(name, value, area, why, tag, dir) {
  return { name: name, value: value, area: area, why: why, tag: tag, dir: dir };
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------- 2. 风格预设库 ---------------- */
const STYLES = [
  /* ---- 人像向 ---- */
  {
    id: 'jp', name: '日系清新', cat: 'portrait', tag: '人像',
    desc: '通透 · 微暖 · 低对比',
    swatch: ['#fff7e8', '#dcebe2', '#8fb4ab'],
    filter: 'brightness(1.06) contrast(0.9) saturate(0.9)',
    tint: { color: '#fff1d6', alpha: 0.14, blend: 'soft-light' },
    target: { exp: 0.45, contrast: -8, hi: -26, sh: 34, wh: 6, bl: -4, temp: 5150, tint: 3, vib: 14, sat: -10, clarity: -2 },
    curve: '黑场轻抬（输入 0 → 输出 12）；中间调上提（输入 128 → 输出 135）；高光轻压（输入 220 → 输出 214）',
    split: '高光 色相 45 / 饱和 8；阴影 色相 212 / 饱和 6',
    hsl: { orange: { h: 0, s: -12, l: 12 }, yellow: { h: -6, s: -8, l: 8 }, green: { h: 10, s: -18, l: 10 }, blue: { h: 0, s: -12, l: 8 } },
    extra: [mk('去朦胧', '-10 ~ -18', '全图', '轻微加雾能柔化空气感，是日系「通透但不寡淡」的关键；拉过 -20 会整张发灰。', 'style', 'down')]
  },
  {
    id: 'hk', name: '港风复古', cat: 'portrait', tag: '人像',
    desc: '高对比 · 青绿阴影 · 浓红',
    swatch: ['#f3d5a8', '#b9553c', '#2f3b35'],
    filter: 'brightness(0.99) contrast(1.12) saturate(1.06) sepia(0.08)',
    tint: { color: '#ff7a3d', alpha: 0.1, blend: 'soft-light' },
    target: { exp: 0.1, contrast: 12, hi: -22, sh: 16, wh: 4, bl: -14, temp: 5100, tint: -4, vib: 6, sat: 6, clarity: 8 },
    curve: 'S 曲线：输入 40 → 28；输入 202 → 210，压暗调、提亮调，中间调不要动',
    split: '高光 色相 38 / 饱和 10；阴影 色相 165 / 饱和 8（港风的青绿暗部）',
    hsl: { red: { h: 0, s: 12, l: 6 }, orange: { h: -4, s: -6, l: 10 }, green: { h: -10, s: -14, l: -6 }, blue: { h: 0, s: -10, l: -6 } },
    extra: [
      mk('颗粒', '数量 18 ~ 30 / 大小 25 / 粗糙度 50', '全图', '港片的颗粒是胶片扫描留下的，质感靠它撑住，别用「添加杂色」。', 'style', 'tune'),
      mk('可选颜色 · 红色', '青色 -10 / 洋红 +8 / 黄色 +6', '嘴唇 / 红衣', '港风的红要浓而不艳，往洋红方向偏一点更像当年的胶片。', 'style', 'tune')
    ]
  },
  {
    id: 'clean', name: '干净人像', cat: 'portrait', tag: '人像',
    desc: '中性 · 通透 · 肤色准确',
    swatch: ['#ffffff', '#f0e6dc', '#a9b6c2'],
    filter: 'brightness(1.04) contrast(1.03) saturate(1.02)',
    tint: { color: '#ffffff', alpha: 0.05, blend: 'soft-light' },
    target: { exp: 0.2, contrast: 4, hi: -18, sh: 20, wh: 8, bl: -6, temp: 5450, tint: 1, vib: 6, sat: -2, clarity: 2 },
    curve: '极轻 S：输入 60 → 56；输入 196 → 202（做成糖水片就毁了）',
    split: '高光 色相 42 / 饱和 4；阴影 色相 220 / 饱和 3',
    hsl: { orange: { h: 0, s: -6, l: 8 }, red: { h: 0, s: 0, l: 6 }, blue: { h: 0, s: -6, l: 0 } },
    extra: [
      mk('减少杂色（明度）', '12 ~ 22', '皮肤 / 暗部', '干净人像的「干净」一半来自降噪，皮肤上的彩色噪点会直接显脏。', 'style', 'tune'),
      mk('白色阶', '+6 ~ +10', '高光区', '把白点顶上去，白衣、眼白、牙齿才不发黄。', 'style', 'up')
    ]
  },
  {
    id: 'creamy', name: '奶油柔光', cat: 'portrait', tag: '人像',
    desc: '柔 · 暖 · 厚涂般的皮肤',
    swatch: ['#fff4e2', '#f2dcc4', '#c9a88b'],
    filter: 'brightness(1.08) contrast(0.9) saturate(0.95) sepia(0.06)',
    tint: { color: '#ffe8c9', alpha: 0.18, blend: 'soft-light' },
    target: { exp: 0.35, contrast: -12, hi: -30, sh: 40, wh: 10, bl: 8, temp: 5300, tint: 4, vib: 10, sat: -14, clarity: -10 },
    curve: '黑场明显上抬（输入 0 → 输出 22）；高光压 10，整体像蒙了一层薄纱',
    split: '高光 色相 35 / 饱和 12；阴影 色相 30 / 饱和 5',
    hsl: { orange: { h: -2, s: -16, l: 14 }, yellow: { h: 0, s: -12, l: 10 }, green: { h: 8, s: -22, l: 12 } },
    extra: [
      mk('柔光叠加', '复制图层 → 高斯模糊 10~16px → 混合模式「滤色」→ 不透明度 12%~20%', '全图 / 高光', '奶油感来自高光的晕染，不是靠降清晰度硬糊出来的。', 'style', 'tune'),
      mk('清晰度', '-12 ~ -6', '皮肤 / 全图', '降低中间调微反差，皮肤会瞬间「糯」起来，但注意别把五官也一起糊掉。', 'style', 'down')
    ]
  },
  {
    id: 'neon', name: '甜酷霓虹', cat: 'portrait', tag: 'COSER',
    desc: '洋红青蓝 · 高饱和 · 赛博',
    swatch: ['#ff4fa3', '#7b4dff', '#1b1f4b'],
    filter: 'brightness(1.02) contrast(1.16) saturate(1.18) hue-rotate(-6deg)',
    tint: { color: '#ff2fb0', alpha: 0.12, blend: 'soft-light' },
    target: { exp: 0.05, contrast: 14, hi: -38, sh: 24, wh: 6, bl: -12, temp: 5000, tint: 6, vib: 18, sat: 8, clarity: 8 },
    curve: 'S 曲线：输入 45 → 38；输入 205 → 212，拉开明暗才撑得住高饱和',
    split: '高光 色相 320 / 饱和 14；阴影 色相 220 / 饱和 12（洋红 + 青蓝分离）',
    hsl: { magenta: { h: -6, s: 14, l: 10 }, blue: { h: 8, s: 12, l: 6 }, cyan: { h: 0, s: 10, l: 4 }, red: { h: 0, s: 12, l: 6 }, orange: { h: 0, s: -8, l: 10 } },
    extra: [
      mk('高光发光', 'Ctrl+Alt+2 载入高光 → 新建图层填充白 → 高斯模糊 20px → 滤色 15%', '灯光 / 反光 / 眼睛', '霓虹氛围靠高光扩散，比继续加饱和有效得多，画面会「亮」而不是「艳」。', 'style', 'tune'),
      mk('色彩分离', '色彩平衡：阴影 青色 -8 / 蓝色 +12；高光 洋红 +10', '暗部 / 高光', '赛博感的本质是暗部偏蓝紫、高光偏洋红的分离，不是单纯加饱和。', 'style', 'tune')
    ]
  },

  /* ---- 通用影调 ---- */
  {
    id: 'film', name: '胶片感', cat: 'universal', tag: '通用',
    desc: '颗粒 · 灰雾 · 低饱和',
    swatch: ['#e8dcc6', '#8d9c8b', '#3a4038'],
    filter: 'contrast(1.06) saturate(0.88) sepia(0.08)',
    tint: { color: '#1a2430', alpha: 0.08, blend: 'soft-light' },
    target: { exp: 0.15, contrast: 8, hi: -24, sh: 22, wh: 2, bl: 6, temp: 5250, tint: -2, vib: 8, sat: -8, clarity: 4 },
    curve: '胶片 S：输入 25 → 20；输入 235 → 228；黑场额外抬到输出 8，暗部留灰不吃死',
    split: '高光 色相 48 / 饱和 7；阴影 色相 195 / 饱和 9',
    hsl: { green: { h: -10, s: -10, l: -4 }, orange: { h: 2, s: -6, l: 6 }, blue: { h: 0, s: -8, l: -2 } },
    extra: [mk('颗粒', '数量 22 ~ 35 / 大小 20 / 粗糙度 50', '全图', '胶片质感的来源是颗粒而不是滤镜，颗粒要「细而散」，堆在暗部更自然。', 'style', 'tune')]
  },
  {
    id: 'vintage', name: '复古暖调', cat: 'universal', tag: '通用',
    desc: '褪色 · 暖黄 · 暗角',
    swatch: ['#f0d9a8', '#c08a55', '#6b4a2f'],
    filter: 'sepia(0.22) saturate(0.86) contrast(1.04) brightness(0.99)',
    tint: { color: '#ffb066', alpha: 0.14, blend: 'soft-light' },
    target: { exp: 0.1, contrast: 2, hi: -20, sh: 26, wh: 6, bl: 14, temp: 5600, tint: 6, vib: 4, sat: -18, clarity: -4 },
    curve: '黑场大幅上抬（输入 0 → 输出 26）；高光略降，整体走「褪色」方向',
    split: '高光 色相 42 / 饱和 18；阴影 色相 35 / 饱和 8',
    hsl: { orange: { h: -4, s: -14, l: 8 }, yellow: { h: -8, s: -12, l: 6 }, green: { h: -14, s: -24, l: 6 }, red: { h: 0, s: -10, l: 4 } },
    extra: [mk('暗角', 'Camera Raw 效果 › 晕影 -18 ~ -28 / 中点 45', '四角', '复古片的注意力靠暗角收在中间，同时也能压掉画面边缘的杂物。', 'style', 'down')]
  },
  {
    id: 'cinematic', name: '电影感', cat: 'universal', tag: '通用',
    desc: '橙青分离 · 低反差 · 宽银幕',
    swatch: ['#f0b46a', '#2b6f7c', '#0d1b24'],
    filter: 'contrast(1.14) saturate(0.92) brightness(0.98)',
    tint: { color: '#0b2b34', alpha: 0.1, blend: 'soft-light' },
    target: { exp: -0.05, contrast: 12, hi: -30, sh: 18, wh: 2, bl: -16, temp: 5100, tint: 2, vib: 6, sat: -6, clarity: 6 },
    curve: '低反差 S：输入 30 → 26；输入 218 → 210，压住高光画面才「贵」',
    split: '高光 色相 38 / 饱和 12；阴影 色相 205 / 饱和 14（橙青分离）',
    hsl: { orange: { h: 0, s: 6, l: 0 }, blue: { h: -8, s: 8, l: -4 }, green: { h: -16, s: -8, l: -6 }, cyan: { h: 0, s: 6, l: -4 } },
    extra: [mk('宽银幕裁切', '裁剪比例 2.39:1，保留上下黑边', '构图', '比例本身就是电影感的最大来源，同一张图裁成宽幅气质立刻不同。', 'style', 'tune')]
  },
  {
    id: 'cool', name: '冷调', cat: 'universal', tag: '通用',
    desc: '清冷 · 蓝青 · 干净高光',
    swatch: ['#dbe9f5', '#7fa7c9', '#2c3f56'],
    filter: 'brightness(1.02) contrast(1.05) saturate(0.95) hue-rotate(6deg)',
    tint: { color: '#6fa8ff', alpha: 0.1, blend: 'soft-light' },
    target: { exp: 0.05, contrast: 6, hi: -22, sh: 18, wh: 4, bl: -8, temp: 4750, tint: 0, vib: 8, sat: -4, clarity: 4 },
    curve: '轻微 S；高光压 8（冷调最怕高光发黄）',
    split: '高光 色相 200 / 饱和 8；阴影 色相 215 / 饱和 10',
    hsl: { blue: { h: 0, s: 8, l: 6 }, cyan: { h: 0, s: 6, l: 4 }, orange: { h: 0, s: -10, l: 6 } },
    extra: [mk('可选颜色 · 白色', '黄色 -15 ~ -25 / 黑色 0', '高光区', '冷调片的高光必须干净，白里带黄一眼就假。', 'style', 'down')]
  },
  {
    id: 'warm', name: '暖调', cat: 'universal', tag: '通用',
    desc: '暖黄 · 亲肤 · 松弛',
    swatch: ['#ffe2b8', '#e8a25c', '#8a4b28'],
    filter: 'sepia(0.12) saturate(1.05) brightness(1.03)',
    tint: { color: '#ffb066', alpha: 0.12, blend: 'soft-light' },
    target: { exp: 0.2, contrast: 4, hi: -16, sh: 24, wh: 8, bl: -2, temp: 5850, tint: 4, vib: 10, sat: 0, clarity: 2 },
    curve: '黑场轻抬（输出 6）；高光轻压',
    split: '高光 色相 40 / 饱和 12；阴影 色相 28 / 饱和 6',
    hsl: { orange: { h: 0, s: 4, l: 8 }, yellow: { h: 0, s: 4, l: 6 }, blue: { h: 0, s: -8, l: 0 } },
    extra: [mk('可选颜色 · 红色', '青色 -5 / 黄色 +8', '皮肤 / 暖色毛发', '整体加暖最容易把皮肤和暖色毛发烧成橙色，用可选颜色把颜色拉回来。', 'style', 'tune')]
  },
  {
    id: 'guofeng', name: '国风', cat: 'universal', tag: '通用',
    desc: '低饱和 · 墨绿 · 留白',
    swatch: ['#efe4cc', '#8f9c7e', '#3f4a41'],
    filter: 'saturate(0.78) contrast(1.02) sepia(0.14)',
    tint: { color: '#d9c9a3', alpha: 0.12, blend: 'soft-light' },
    target: { exp: 0, contrast: 6, hi: -26, sh: 22, wh: 2, bl: 8, temp: 5400, tint: -2, vib: 2, sat: -30, clarity: 2 },
    curve: '低饱和 S 曲线：暗部保留层次，别压死，国风要「透气」',
    split: '高光 色相 45 / 饱和 10；阴影 色相 180 / 饱和 6',
    hsl: { green: { h: -12, s: -34, l: 2 }, red: { h: -4, s: -8, l: 4 }, blue: { h: 0, s: -24, l: 4 }, orange: { h: 0, s: -16, l: 4 } },
    extra: [
      mk('可选颜色 · 绿色', '青色 +10 / 黄色 +8', '植被 / 服饰', '国风的绿要往墨绿、石绿偏，鲜绿一出现整张就变「风景照」。', 'style', 'tune'),
      mk('可选颜色 · 黄色', '青色 -10 / 黄色 +10', '绢帛 / 皮肤 / 暖光', '把黄往暖里推、把绿往青里推，配色立刻有绢本质感。', 'style', 'tune')
    ]
  },

  /* ---- 风光向 ---- */
  {
    id: 'clear', name: '通透风光', cat: 'landscape', tag: '风光',
    desc: '去雾 · 高通透 · 色彩干净',
    swatch: ['#dff0ff', '#7ec0d9', '#2f5e46'],
    filter: 'contrast(1.12) saturate(1.08) brightness(1.02)',
    tint: { color: '#cfe6ff', alpha: 0.06, blend: 'soft-light' },
    target: { exp: 0.1, contrast: 10, hi: -40, sh: 26, wh: 6, bl: -10, temp: 5350, tint: 0, vib: 18, sat: 4, clarity: 14 },
    curve: '轻微 S + 高光压缩：输入 215 → 205，天空才不会白成一片',
    split: '高光 色相 48 / 饱和 8；阴影 色相 210 / 饱和 8',
    hsl: { blue: { h: -4, s: 10, l: -6 }, cyan: { h: 0, s: 6, l: -4 }, green: { h: 10, s: 8, l: -8 }, yellow: { h: -4, s: -6, l: 4 } },
    extra: [mk('去朦胧', '+8 ~ +16', '全图（尤其远景）', '风光发灰九成是空气透视，去朦胧比狂加对比干净得多，但过 20 会出脏边。', 'style', 'up')]
  },
  {
    id: 'moody', name: '暗调自然', cat: 'landscape', tag: '风光',
    desc: '压暗 · 层次 · 空气感',
    swatch: ['#7d8a72', '#2f3d33', '#111714'],
    filter: 'brightness(0.86) contrast(1.16) saturate(0.9)',
    tint: { color: '#14251f', alpha: 0.14, blend: 'soft-light' },
    target: { exp: -0.28, contrast: 16, hi: -34, sh: 8, wh: -4, bl: -22, temp: 5100, tint: -2, vib: 6, sat: -14, clarity: 10 },
    curve: '偏硬 S：输入 60 → 48；输入 195 → 205；暗部不要再提，保留黑影',
    split: '高光 色相 40 / 饱和 6；阴影 色相 190 / 饱和 8',
    hsl: { green: { h: -6, s: -24, l: -14 }, blue: { h: 0, s: -16, l: 6 }, yellow: { h: 0, s: -20, l: -10 } },
    extra: [
      mk('暗角', '晕影 -20 ~ -30 / 中点 40', '四角', '暗调风光的氛围一半靠压边，把视线逼到中间的亮部。', 'style', 'down'),
      mk('径向滤镜提亮', '曝光 +0.25 ~ +0.4 EV / 羽化 70%', '视觉中心', '整体压暗后必须有「亮的地方」，否则画面发闷。', 'local', 'up')
    ]
  },
  {
    id: 'blackgold', name: '黑金夜景', cat: 'landscape', tag: '风光',
    desc: '只剩金 · 大压暗 · 灯火',
    swatch: ['#ffcc66', '#8a5a1e', '#0a0a0c'],
    filter: 'contrast(1.25) saturate(0.85) brightness(0.95) sepia(0.18)',
    tint: { color: '#ffae42', alpha: 0.12, blend: 'soft-light' },
    target: { exp: -0.15, contrast: 20, hi: -45, sh: 6, wh: 0, bl: -26, temp: 4250, tint: 2, vib: 4, sat: -42, clarity: 8 },
    curve: '大 S：压暗中间调以下，只留下灯光所在的高光段',
    split: '高光 色相 40 / 饱和 26；阴影 色相 215 / 饱和 14',
    hsl: { orange: { h: 0, s: 14, l: 6 }, yellow: { h: -6, s: 8, l: 8 }, blue: { h: 0, s: -40, l: -4 }, cyan: { h: 0, s: -40, l: -4 } },
    extra: [mk('色相/饱和度全局收敛', '除黄橙外，所有颜色饱和 -60 ~ -80', '全图', '黑金的关键是「只剩金」，青蓝紫必须请出去，否则颜色打架。', 'style', 'down')]
  },
  {
    id: 'forest', name: '森系自然', cat: 'landscape', tag: '风光',
    desc: '绿意 · 光斑 · 柔和',
    swatch: ['#e8f2d8', '#7fa864', '#2c4326'],
    filter: 'brightness(1.03) contrast(1.02) saturate(0.94) hue-rotate(-4deg)',
    tint: { color: '#dff0cf', alpha: 0.1, blend: 'soft-light' },
    target: { exp: 0.05, contrast: 6, hi: -24, sh: 30, wh: 6, bl: -6, temp: 5100, tint: -4, vib: 12, sat: -6, clarity: 4 },
    curve: '黑场轻抬（输出 8）；暗部温和提亮，避免树叶糊成一团黑',
    split: '高光 色相 90 / 饱和 6；阴影 色相 165 / 饱和 8',
    hsl: { green: { h: 14, s: -10, l: 12 }, yellow: { h: 8, s: -12, l: 8 }, blue: { h: 0, s: -10, l: 4 }, cyan: { h: 0, s: 6, l: 4 } },
    extra: [mk('光斑强化', '载入高光 → 曲线提亮 +8 ~ +12，配合蒙版只留穿透树叶的光', '光斑 / 逆光区', '森系最动人的是漏光，把它单独提出来画面立刻有呼吸。', 'local', 'up')]
  }
];

const REC = { portrait: 'jp', coser: 'neon', landscape: 'clear', pet: 'warm' };
const styleById = id => STYLES.filter(s => s.id === id)[0] || null;

/* ---------------- 3. 类型元数据 ---------------- */
const TYPES = {
  portrait: {
    name: '普通人物',
    hint: '写真 · 日常 · 街拍',
    focus: '磨皮、肤色统一、液化与主体分离',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.5"/><path d="M4.6 20.2c1.2-4.1 4-6.2 7.4-6.2s6.2 2.1 7.4 6.2"/></svg>',
    order: [
      '复制背景层，先做裁剪 / 水平校正 / 镜头校正（人像先修构图再修皮）',
      'Camera Raw 滤镜 › 基本：曝光 → 对比 → 高光 → 阴影 → 白色 / 黑色',
      '白平衡（色温 / 色调）→ HSL（重点橙色）→ 曲线 → 分离色调',
      '回到 PS：污点修复 → 频率分离磨皮 → 液化（幅度 ≤5%）',
      '局部蒙版：压暗背景、提亮主体、眼神光与唇色',
      'USM 锐化（避开皮肤）→ 导出 sRGB'
    ]
  },
  coser: {
    name: 'COSER',
    hint: '二次元 · 妆造 · 棚拍',
    focus: '妆面强化、假发质感、环境光修正',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6l1.9 4.9 5.2.5-3.9 3.5 1.1 5.1L12 13.9 7.7 16.6l1.1-5.1L4.9 8l5.2-.5z"/><path d="M8 19.6h8"/></svg>',
    order: [
      '先校正环境光偏色（色温 / 色调 / 可选颜色），彩色灯光是 COS 图第一杀手',
      'Camera Raw 基本 + 曲线定调，拉开明暗给高饱和留空间',
      'HSL 单独处理洋红、蓝、青（妆容 / 假发 / 服装）',
      '回 PS：修补工具修假发边缘与服装瑕疵 → 妆面局部强化',
      '眼睛专项：提亮瞳孔、强化眼神光、锐化睫毛',
      '高光发光叠加 → 背景压暗或虚化 → 锐化服装纹理 → 导出'
    ]
  },
  landscape: {
    name: '自然风景',
    hint: '山川 · 海景 · 森林',
    focus: '去朦胧、天空渐变、层次与锐化',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 18.6l5.6-7.4 3.6 4.6 2.6-3.1 6.9 5.9z"/><circle cx="17.2" cy="6.4" r="1.9"/></svg>',
    order: [
      '先校正：水平线、镜头畸变、裁剪掉边缘杂物',
      'Camera Raw 基本：高光全力恢复 → 阴影提亮 → 对比微调',
      '去朦胧（远景发灰时）→ 色温定基调（暖日出 / 冷阴天）',
      'HSL 分组处理：天空蓝青、植被绿黄、土地橙黄',
      '蒙版：天空渐变压暗 + 前景提亮 + 视觉中心径向提亮',
      '输出锐化（景观锐化）+ 长边 4096 导出'
    ]
  },
  pet: {
    name: '宠物',
    hint: '猫狗 · 毛孩 · 小动物',
    focus: '毛发质感、眼睛眼神光、毛色还原',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="15.6" rx="4.1" ry="3.5"/><circle cx="6.5" cy="10.4" r="1.65"/><circle cx="9.9" cy="7.6" r="1.65"/><circle cx="14.1" cy="7.6" r="1.65"/><circle cx="17.5" cy="10.4" r="1.65"/></svg>',
    order: [
      '先校正曝光与白平衡：毛色对色温极敏感，偏黄偏绿会直接把毛色毁掉',
      'Camera Raw 基本：白毛护高光 → 黑毛提阴影 → 对比微调（毛发不能一刀切）',
      'HSL / 可选颜色：橙黄管毛色，白色单独处理白毛（减黄提亮）',
      '回 PS：污点修复去泪痕 / 眼屎 / 脏点 → 眼睛与鼻头提亮',
      '高反差保留锐化毛发（蒙版只刷毛发）→ 分层降噪保留细节',
      '背景压暗或轻微虚化分离主体 → 导出 sRGB'
    ]
  }
};

/* ---------------- 4. 状态与 DOM ---------------- */
const state = {
  file: null, fileName: '', url: '', img: null, m: null, guess: null, ai: null,
  type: null, styleId: null, tab: 'all', plan: null, busy: false, userPickedType: false
};

const el = {
  dropzone: $('#dropzone'),
  fileInput: $('#fileInput'),
  preview: $('#preview'),
  imgwrap: $('#imgwrap'),
  img: $('#previewImg'),
  tint: $('#tintLayer'),
  scanLayer: $('#scanLayer'),
  scanTxt: $('#scanTxt'),
  scanBar: $('#scanBar'),
  metaName: $('#metaName'),
  metaSize: $('#metaSize'),
  metaStyle: $('#metaStyle'),
  btnCompare: $('#btnCompare'),
  btnChange: $('#btnChange'),
  typeList: $('#typeList'),
  typeHint: $('#typeHint'),
  filterTabs: $('#filterTabs'),
  styleList: $('#styleList'),
  styleHint: $('#styleHint'),
  btnRun: $('#btnRun'),
  runHint: $('#runHint'),
  result: $('#result'),
  resultTitle: $('#resultTitle'),
  resultSub: $('#resultSub'),
  detect: $('#detect'),
  order: $('#order'),
  groups: $('#groups'),
  btnCopy: $('#btnCopy'),
  btnDownload: $('#btnDownload'),
  btnRestart: $('#btnRestart'),
  // AI 识别配置
  aiBar: $('#aiBar'),
  aiBadge: $('#aiBadge'),
  aiState: $('#aiState'),
  aiToggle: $('#aiToggle'),
  aiPanel: $('#aiPanel'),
  aiProvider: $('#aiProvider'),
  aiModel: $('#aiModel'),
  aiBase: $('#aiBase'),
  aiKey: $('#aiKey'),
  aiTip: $('#aiTip'),
  aiSave: $('#aiSave'),
  aiClear: $('#aiClear'),
  aiMsg: $('#aiMsg'),
  privacyPill: $('#privacyPill')
};

/* ---------------- 5. 图像分析 ---------------- */
const HSL_NAME = { red: '红色', orange: '橙色', yellow: '黄色', green: '绿色', cyan: '青色', blue: '蓝色', magenta: '洋红' };
const HSL_AREA = {
  red: '嘴唇 / 红色物体', orange: '皮肤 / 暖色受光面', yellow: '草地 / 沙土 / 黄光',
  green: '植被 / 绿幕', cyan: '天空 / 水面', blue: '天空 / 冷色阴影', magenta: '霓虹 / 妆容'
};
const HUE_NAMES = ['红', '橙', '黄', '黄绿', '绿', '青绿', '青', '蓝', '蓝紫', '紫', '洋红', '粉红'];

function isSkin(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (cb < 76 || cb > 134 || cr < 129 || cr > 179) return false;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return r > 68 && g > 28 && b > 14 && mx - mn > 12 && r >= g && g >= b * 0.82;
}

function analyze(img) {
  const MAXD = 380;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sc = Math.min(1, MAXD / Math.max(iw, ih));
  const w = Math.max(8, Math.round(iw * sc));
  const h = Math.max(8, Math.round(ih * sc));

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;

  const hist = new Float64Array(256);
  const gray = new Float32Array(n);
  const coatArr = new Uint8Array(n); // 0 非毛色 / 1 暖毛色 / 2 浅色毛
  const GX = 12, GY = 12;
  const cellSkin = new Float32Array(GX * GY);
  const cellAll = new Float32Array(GX * GY);
  // 毛色与中频纹理的网格分布：用来判断「毛色是长成一团主体，还是铺满整个画面」
  const cellCoat = new Float32Array(GX * GY);
  const cellTex = new Float32Array(GX * GY);

  let lumSum = 0, satSum = 0, rSum = 0, gSum = 0, bSum = 0;
  let skin = 0, sky = 0, foliage = 0, redP = 0, brown = 0, water = 0, neutralP = 0;
  let fur = 0, paleFur = 0, furLum = 0;
  let skinX = 0, skinY = 0;
  let nR = 0, nG = 0, nB = 0, nCnt = 0;
  const hueBins = new Float64Array(12);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    hist[Math.min(255, lum | 0)]++;
    lumSum += lum; rSum += r; gSum += g; bSum += b;

    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    satSum += sat;

    const x = i % w, y = (i / w) | 0;
    const ci = Math.min(GY - 1, Math.floor(y / h * GY)) * GX + Math.min(GX - 1, Math.floor(x / w * GX));
    cellAll[ci]++;

    // 肤色
    if (isSkin(r, g, b)) {
      skin++; skinX += x; skinY += y; cellSkin[ci]++;
    }

    // 天空：上半部明显偏蓝，或极亮（差值阈值 22：灰蓝影棚背景、阴天灰都不再冒充天空）
    if (y < h * 0.52 && ((b > r + 22 && lum > 68 && sat > 0.13) || (lum > 218 && y < h * 0.36))) sky++;

    // 植被
    if (g > r + 8 && g > b + 10 && lum > 28 && sat > 0.12) foliage++;

    // 红 / 棕（动物毛发、木质、暖色主体）
    if (r > 110 && r > g + 34 && r > b + 44) redP++;
    if (r > g + 8 && g > b + 6 && lum > 38 && lum < 205 && sat > 0.1 && sat < 0.62) brown++;

    // 毛色：暖棕 / 金毛 / 奶白。比 brown 放宽上限，覆盖浅色毛与高光毛
    if (r >= g - 5 && g >= b * 0.86 && r - b > 13 && lum > 26 && lum < 228 && sat > 0.06) {
      fur++; furLum += lum; coatArr[i] = 1; cellCoat[ci]++;
    } else if (sat < 0.14 && lum > 88 && lum < 250) {
      // 浅色毛只计入面积，不计入空间分布——否则浅灰墙面 / 阴天背景会被当成「毛铺满了画面」
      paleFur++; furLum += lum; coatArr[i] = 2;
    }

    // 水面 / 大面积平滑蓝青（下半部）
    if (y > h * 0.5 && b > r + 22 && sat > 0.12 && sat < 0.5 && lum > 45 && lum < 205) water++;

    // 中性灰（墙面 / 建筑）
    if (sat < 0.12 && lum > 55 && lum < 215) neutralP++;

    // 白平衡参考：只取低饱和像素
    if (sat < 0.18 && lum > 42 && lum < 232) { nR += r; nG += g; nB += b; nCnt++; }

    // 色相直方图
    if (sat > 0.16 && lum > 32 && lum < 242) {
      let hue = 0;
      if (mx === r) hue = 60 * ((g - b) / (mx - mn));
      else if (mx === g) hue = 60 * (2 + (b - r) / (mx - mn));
      else hue = 60 * (4 + (r - g) / (mx - mn));
      if (hue < 0) hue += 360;
      hueBins[Math.min(11, Math.floor(hue / 30))]++;
    }
  }

  // 边缘密度 / 纹理
  let edgeCnt = 0, gradSum = 0, midCnt = 0, centerMid = 0, centerAll = 0, coatEdge = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const mag = Math.abs(gx) + Math.abs(gy);
      gradSum += mag;
      if (mag > 70) edgeCnt++;
      // 中频纹理（毛发、绒毛）：强度不高但极密。皮肤是平滑的，这里是两者的分水岭
      if (mag > 26 && mag <= 100) midCnt++;
      const inC = (x > w * 0.18 && x < w * 0.82 && y > h * 0.12 && y < h * 0.88);
      if (inC) {
        centerAll++;
        if (mag > 26 && mag <= 100) centerMid++;
      }
      if (coatArr[i] && mag > 40) coatEdge++;
      if (mag > 26 && mag <= 100) {
        const tci = Math.min(GY - 1, ((y / h * GY) | 0)) * GX + Math.min(GX - 1, ((x / w * GX) | 0));
        cellTex[tci]++;
      }
    }
  }

  // 均值 / 标准差
  const avgLum = lumSum / n;
  let varSum = 0;
  for (let i = 0; i < n; i++) { const dv = gray[i] - avgLum; varSum += dv * dv; }
  const contrast = Math.sqrt(varSum / n);

  // 亮度分位
  let acc = 0, p05 = 0, p95 = 0, got05 = false;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (!got05 && acc >= n * 0.05) { p05 = v; got05 = true; }
    if (acc >= n * 0.95) { p95 = v; break; }
  }

  const tempDelta = nCnt > n * 0.01 ? (nR - nB) / nCnt : (rSum - bSum) / n;
  const greenDelta = nCnt > n * 0.01 ? (nG - (nR + nB) / 2) / nCnt : (gSum - (rSum + bSum) / 2) / n;

  // 肤色连通块（近似人脸 / 人数）
  const ratio = new Float32Array(GX * GY);
  for (let c = 0; c < GX * GY; c++) ratio[c] = cellAll[c] > 0 ? cellSkin[c] / cellAll[c] : 0;
  const seen = new Uint8Array(GX * GY);
  let blobs = 0, bestArea = 0, bestBox = null;
  for (let c = 0; c < GX * GY; c++) {
    if (seen[c] || ratio[c] < 0.32) continue;
    const stack = [c]; seen[c] = 1;
    let area = 0, minx = GX, maxx = 0, miny = GY, maxy = 0;
    while (stack.length) {
      const cur = stack.pop(); area++;
      const cx = cur % GX, cy = (cur / GX) | 0;
      minx = Math.min(minx, cx); maxx = Math.max(maxx, cx);
      miny = Math.min(miny, cy); maxy = Math.max(maxy, cy);
      const nb = [cur - 1, cur + 1, cur - GX, cur + GX];
      for (let k = 0; k < 4; k++) {
        const t = nb[k];
        if (t < 0 || t >= GX * GY) continue;
        if (k === 0 && cx === 0) continue;
        if (k === 1 && cx === GX - 1) continue;
        if (seen[t] || ratio[t] < 0.32) continue;
        seen[t] = 1; stack.push(t);
      }
    }
    if (area >= 2) blobs++;
    if (area > bestArea) {
      bestArea = area;
      bestBox = { x0: minx / GX, y0: miny / GY, x1: (maxx + 1) / GX, y1: (maxy + 1) / GY };
    }
  }

  // ---- 毛色的空间分布：主体是一整团居中，风光是同色肌理铺满画面 ----
  const coatRatio = new Float32Array(GX * GY);
  let coatCells = 0;
  for (let c = 0; c < GX * GY; c++) {
    coatRatio[c] = cellAll[c] > 0 ? cellCoat[c] / cellAll[c] : 0;
    if (coatRatio[c] > 0.32) coatCells++;
  }
  const seenCoat = new Uint8Array(GX * GY);
  let coatBlobCount = 0, coatMainArea = 0;
  for (let c = 0; c < GX * GY; c++) {
    if (seenCoat[c] || coatRatio[c] <= 0.32) continue;
    const stack = [c]; seenCoat[c] = 1;
    let area = 0;
    while (stack.length) {
      const cur = stack.pop(); area++;
      const ccx = cur % GX, ccy = (cur / GX) | 0;
      const nb = [cur - 1, cur + 1, cur - GX, cur + GX];
      for (let k = 0; k < 4; k++) {
        const t = nb[k];
        if (t < 0 || t >= GX * GY) continue;
        if (k === 0 && ccx === 0) continue;
        if (k === 1 && ccx === GX - 1) continue;
        if (seenCoat[t] || coatRatio[t] <= 0.32) continue;
        seenCoat[t] = 1; stack.push(t);
      }
    }
    if (area >= 2) coatBlobCount++;
    if (area > coatMainArea) coatMainArea = area;
  }

  // 纹理的中心 / 边缘比：宠物影像中心毛密、四周背景平滑；风光是整幅均匀
  let texC = 0, texCAll = 0, texB = 0, texBAll = 0;
  for (let ty = 0; ty < GY; ty++) {
    for (let tx = 0; tx < GX; tx++) {
      const c = ty * GX + tx;
      const onBorder = (ty === 0 || ty === GY - 1 || tx === 0 || tx === GX - 1);
      if (onBorder) { texB += cellTex[c]; texBAll += cellAll[c]; }
      else { texC += cellTex[c]; texCAll += cellAll[c]; }
    }
  }
  const texCenterD = texCAll > 0 ? texC / texCAll : 0;
  const texBorderD = texBAll > 0 ? texB / texBAll : 0;

  const skinPct = skin / n;
  const skyPct = sky / n;
  const foliagePct = foliage / n;

  let hueTop = 0;
  for (let i = 1; i < 12; i++) if (hueBins[i] > hueBins[hueTop]) hueTop = i;

  const skinCx = skin > 0 ? skinX / skin / w : 0.5;
  const skinCy = skin > 0 ? skinY / skin / h : 0.5;

  // 明暗端点占比（百分比）
  let shCnt = 0, hiCnt = 0, nwCnt = 0;
  for (let v = 0; v < 16; v++) shCnt += hist[v];
  for (let v = 250; v < 256; v++) hiCnt += hist[v];
  for (let v = 236; v < 256; v++) nwCnt += hist[v];

  return {
    w: iw, h: ih,
    avgLum: avgLum, contrast: contrast, p05: p05, p95: p95,
    shadowPct: shCnt / n * 100,
    clipHigh: hiCnt / n * 100,
    nearWhite: nwCnt / n * 100,
    sat: satSum / n,
    tempDelta: tempDelta,
    greenDelta: greenDelta,
    skinPct: skinPct, skyPct: skyPct, foliagePct: foliagePct,
    waterPct: water / n, brownPct: brown / n, neutralPct: neutralP / n, redPct: redP / n,
    skinCx: skinCx, skinCy: skinCy,
    faceBox: bestBox, blobCount: blobs,
    // 最大肤色连通块占画面的比例：人脸最多也就 20~25%，铺满说明这是暖色场景而不是一张脸
    skinMainPct: bestArea / (GX * GY),
    edgeDensity: edgeCnt / n,
    detail: gradSum / n,
    furPct: fur / n,
    paleFurPct: paleFur / n,
    // 毛色本身的平均亮度：判断黑毛 / 白毛要用它，而不是全图平均亮度
    coatLum: (fur + paleFur) > 0 ? furLum / (fur + paleFur) : 0,
    // 毛色像素里「落在边缘上」的比例：毛发高、皮肤低，是区分宠物与人的关键指标
    coatTexture: coatEdge / Math.max(1, fur + paleFur),
    centerMidPct: centerAll > 0 ? centerMid / centerAll : 0,
    midEdgePct: midCnt / Math.max(1, (w - 2) * (h - 2)),
    // 空间分布：毛色铺满度、最大毛色块占比、主块紧致度、纹理中心-边缘差
    coatSpread: coatCells / (GX * GY),
    coatMainPct: coatMainArea / (GX * GY),
    coatCompact: coatCells > 0 ? coatMainArea / coatCells : 0,
    coatBlobCount: coatBlobCount,
    texCenterD: texCenterD,
    texBorderD: texBorderD,
    texSep: texCenterD - texBorderD,
    hueTop: HUE_NAMES[hueTop],
    isNight: avgLum < 62,
    isLowContrast: contrast < 30,
    isFlat: edgeCnt / n < 0.06,
    isHazy: contrast < 32 && satSum / n < 0.24
  };
}

// 补齐需要 hist 的统计（放在 analyze 内部计算更自然，这里集中算一次）

/* ---------------- 6. 类型推断 ----------------
   设计原则：宁可说「不确定」，也不猜一个相近的类型。
   暖棕色场景（秋林 / 沙漠 / 岩壁 / 麦田）和暖棕动物在像素层面几乎同分布，
   纯统计无法可靠区分——这类情况交给多模态模型，本地只做保守判断。 */
function guessType(m) {
  const coatPct = m.furPct + m.paleFurPct * 0.5;
  const pct = v => Math.round(v * 100) + '%';
  const hueNature = ['黄绿', '绿', '青绿', '青'].indexOf(m.hueTop) >= 0;

  /* 人像：需要有「像一张脸的一团肤色」，而不是铺满画面的暖色。
     关键约束：皮肤是平滑的——中部纹理一旦变密，就说明这是毛发而不是脸。 */
  const skinSmooth = clamp((0.20 - m.centerMidPct) / 0.12, 0, 1);
  const faceLike = m.skinMainPct >= 0.02 && m.skinMainPct < 0.30 && m.skinPct > 0.02 && skinSmooth >= 0.35;
  const skinSpread = clamp((m.skinMainPct - 0.30) / 0.35, 0, 1); // 肤色铺满度
  let sPortrait = clamp(
    clamp(m.skinPct / 0.09, 0, 1) * 0.38
    + (faceLike ? 0.30 : 0)
    + (faceLike && m.blobCount >= 1 ? 0.12 : 0)
    + ((m.skinCy > 0.08 && m.skinCy < 0.66) ? 0.10 : 0)
    + skinSmooth * 0.10,
    0, 1);
  if (skinSpread > 0) sPortrait *= (1 - 0.78 * skinSpread);

  /* 风光：天空 / 植被 / 水面 / 整体偏绿 / 自然色相 多方取证 */
  const sLand = clamp(
    0.34 * clamp(m.skyPct / 0.13, 0, 1)
    + 0.28 * clamp(m.foliagePct / 0.18, 0, 1)
    + 0.14 * clamp(m.waterPct / 0.10, 0, 1)
    + 0.12 * clamp((m.greenDelta + 1) / 8, 0, 1)
    + 0.12 * (hueNature ? 1 : 0),
    0, 1);

  /* 宠物：纹理确凿 + 暖毛成团 + 画面里还有别的东西（有背景才叫主体） */
  const petTexture = clamp((m.centerMidPct - 0.14) / 0.14, 0, 1);
  let sPet = clamp(
    0.26 * clamp(coatPct / 0.26, 0, 1)
    + 0.38 * petTexture
    + 0.24 * clamp((0.60 - m.coatSpread) / 0.26, 0, 1)
    + 0.12 * clamp((m.coatCompact - 0.5) / 0.4, 0, 1),
    0, 1);

  const vetoes = [];
  if (m.skyPct >= 0.08) vetoes.push('天空占 ' + pct(m.skyPct));
  if (m.foliagePct >= 0.12) vetoes.push('植被占 ' + pct(m.foliagePct));
  if (m.coatSpread >= 0.60) vetoes.push('暖色纹理铺满 ' + pct(m.coatSpread) + ' 的画面');
  if (m.coatMainPct >= 0.52) vetoes.push('最大暖色块占 ' + pct(m.coatMainPct));
  if (coatPct < 0.10) vetoes.push('毛色面积只有 ' + pct(coatPct));
  if (vetoes.length) sPet *= 0.30;

  const ranked = [
    { k: 'portrait', s: sPortrait },
    { k: 'pet', s: sPet },
    { k: 'landscape', s: sLand }
  ].sort((a, b) => b.s - a.s);
  const top = ranked[0], second = ranked[1];
  const margin = clamp((top.s - second.s) / 0.22, 0, 1);
  const conf = clamp(top.s * (0.55 + 0.45 * margin), 0, 1);

  /* 三分都不够高 → 不下判断。这是这张图真正需要的诚实回答 */
  const FLOOR = 0.42;
  if (top.s < FLOOR) {
    return {
      type: null, conf: 0,
      why: '画面特征不够明确，本地规则无法可靠判断类型',
      scores: { portrait: sPortrait, pet: sPet, landscape: sLand }, vetoed: vetoes
    };
  }

  let why = '';
  if (top.k === 'pet') {
    why = '暖毛占 ' + pct(coatPct) + '、中部纹理密度 ' + pct(petTexture) + '，且毛色集中在主体区域';
  } else if (top.k === 'landscape') {
    const ev = [];
    if (m.skyPct > 0.05) ev.push('天空 ' + pct(m.skyPct));
    if (m.foliagePct > 0.04) ev.push('植被 ' + pct(m.foliagePct));
    if (m.waterPct > 0.04) ev.push('水面 ' + pct(m.waterPct));
    if (!ev.length) ev.push('自然色相为主（' + m.hueTop + '）');
    why = '检测到 ' + ev.join('、') + '，判断为自然场景';
    if (vetoes.length && vetoes[0].indexOf('天空占') < 0) why += '（已排除宠物：' + vetoes[0] + '）';
  } else {
    why = m.skinPct > 0.02
      ? '肤色占 ' + pct(m.skinPct) + (m.blobCount >= 1 ? '、检测到 ' + m.blobCount + ' 处肤色团块' : '') + '，判断为人物主体'
      : '未检测到湖泊 / 山林 / 毛色主体等特征，按人物类型起步更稳妥';
  }
  if (conf < 0.55) why += '，把握不大，建议手动确认';

  return { type: top.k, conf: conf, why: why, scores: { portrait: sPortrait, pet: sPet, landscape: sLand }, vetoed: vetoes };
}

/* ---------------- 6.5 多模态 AI 识别（可选，自带 Key） ----------------
   本地统计法分不清「暖棕色树林」和「暖棕色猫」，这不是调参能解决的：
   两者在颜色、纹理、明暗上的分布几乎重合。语义判断必须交给视觉模型。 */

const AI_PRESETS = {
  ark: {
    name: '火山方舟（豆包）',
    base: 'https://ark.cn-beijing.volces.com/api/v3',
    model: '',
    tip: '模型填「接入点 ID」（ep- 开头）或模型名，例如 doubao-1.5-vision-pro-32k-250115。在方舟控制台「在线推理」里创建接入点即可拿到。'
  },
  openai: {
    name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    tip: '需要浏览器能直接访问 api.openai.com（国内需自备网络环境）。'
  },
  dashscope: {
    name: '阿里云百炼',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max-latest',
    tip: '在阿里云百炼控制台创建 API Key，兼容 OpenAI 协议。'
  },
  zhipu: {
    name: '智谱 GLM',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4v-flash',
    tip: 'glm-4v-flash 有免费额度，适合先试通再换更强的模型。'
  },
  custom: {
    name: '自定义',
    base: '',
    model: '',
    tip: '任何兼容 OpenAI /chat/completions 协议的视觉模型接口都可以，Base URL 填到 /v1 这一层。'
  }
};

const AI_STORE = 'photo-tone-ai-config';

const AI_SYS = [
  '你是摄影后期助手。任务：判断一张照片的「主体类型」，供后续修图流程使用。',
  '类型只能从下面四个里选一个：',
  'portrait = 普通人物（人像、写真、生活照、街拍、自拍、多人合影）',
  'coser = COSER（cosplay、二次元妆造、角色扮演、漫展）',
  'landscape = 自然风景或环境场景（山林、草地、海景、天空、沙漠、城市风光、建筑、街景、室内空间，以及没有明确单一主体的风景）',
  'pet = 宠物（猫、狗等动物作为画面主体的照片）',
  '判断要点：',
  '1. 画面里即使有人，只要人很小、不是主体（风景里的游客），仍判 landscape。',
  '2. 画面里没有动物时，绝不能判 pet。暖棕色的树林、沙漠、岩壁、麦田、木地板都不是 pet。',
  '3. 有动物且动物占据画面主要位置时才判 pet；人与宠物同框且人更大时判 portrait。',
  '4. 判断不确定时，confidence 给低值（如 0.4），不要硬凑高置信。',
  '同时列出画面关键元素，从下列挑（最多 6 个）：人物 面部 皮肤 头发 妆容 服装 天空 云 山 树林 草地 花朵 水面 湖 海 沙滩 岩石 沙漠 建筑 道路 桥梁 夜景 灯光 室内 窗户 食物 宠物 毛发 眼睛',
  '只输出一行 JSON，不要解释、不要代码块、不要 markdown：',
  '{"type":"portrait|coser|landscape|pet","confidence":0.0,"elements":["元素"],"reason":"不超过25字的中文理由"}'
].join('\n');

function getAIConfig() {
  try {
    const raw = localStorage.getItem(AI_STORE);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.base || !c.model || !c.key) return null;
    return c;
  } catch (e) { return null; }
}

function aiReady() { return !!getAIConfig(); }

/* 压到长边 1024 再编码：既省 token，也避免超大 base64 被服务商拒绝 */
function imageForAI(img, maxEdge) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sc = Math.min(1, maxEdge / Math.max(iw, ih));
  const w = Math.max(16, Math.round(iw * sc));
  const h = Math.max(16, Math.round(ih * sc));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, w, h);
  cx.drawImage(img, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.82);
}

function parseAIReply(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const st = s.indexOf('{'), en = s.lastIndexOf('}');
  if (st < 0 || en <= st) return null;
  let obj;
  try { obj = JSON.parse(s.slice(st, en + 1)); } catch (e) { return null; }
  const type = String(obj.type || '').toLowerCase().trim();
  if (['portrait', 'coser', 'landscape', 'pet'].indexOf(type) < 0) return null;
  const cf = parseFloat(obj.confidence);
  return {
    type: type,
    confidence: isFinite(cf) ? clamp(cf, 0, 1) : 0.7,
    elements: Array.isArray(obj.elements) ? obj.elements.slice(0, 6).map(function (x) { return String(x); }) : [],
    reason: String(obj.reason || '')
  };
}

async function aiRecognize() {
  const cfg = getAIConfig();
  if (!cfg) throw new Error('尚未配置 AI');
  if (!state.img) throw new Error('还没有图片');

  const base = cfg.base.replace(/\/+$/, '');
  const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
  const dataUrl = imageForAI(state.img, 1024);

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 45000) : null;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          { role: 'system', content: AI_SYS },
          {
            role: 'user',
            content: [
              { type: 'text', text: '识别这张照片的主体类型和关键元素，只返回 JSON。' },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      }),
      signal: ctrl ? ctrl.signal : undefined
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('请求超时（45 秒），可换更快的模型');
    throw new Error('网络请求失败：' + ((e && e.message) || '可能是浏览器拦截或服务商未开放跨域'));
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    try {
      const j = await resp.json();
      const e2 = j.error || j;
      msg = (e2 && (e2.message || e2.code)) || msg;
    } catch (e3) { /* 忽略解析失败 */ }
    if (resp.status === 401 || resp.status === 403) msg += '（Key 无效或没有该模型权限）';
    if (resp.status === 404) msg += '（检查 Base URL 与模型名）';
    throw new Error(msg);
  }

  const j = await resp.json();
  const ch = j && j.choices && j.choices[0];
  let content = ch && ch.message ? ch.message.content : '';
  // 少数服务商返回数组结构
  if (Array.isArray(content)) {
    content = content.map(function (p) { return (p && p.text) || ''; }).join('');
  }
  const out = parseAIReply(content);
  if (!out) throw new Error('模型返回的内容不是可解析的 JSON');
  return out;
}

/* ---------------- 7. 方案生成 ---------------- */
function hueRow(key, cfg, whyExtra) {
  const name = HSL_NAME[key] || key;
  const parts = [];
  if (cfg.h) parts.push('色相 ' + fmtNum(cfg.h));
  if (cfg.s) parts.push('饱和 ' + fmtNum(cfg.s));
  if (cfg.l) parts.push('明度 ' + fmtNum(cfg.l));
  if (!parts.length) parts.push('保持 0');
  return mk('HSL · ' + name, parts.join(' / '), HSL_AREA[key] || '对应色域', whyExtra, 'style', 'tune');
}

function hslRelevant(key, m, type) {
  switch (key) {
    case 'red': return m.skinPct > 0.004 || m.redPct > 0.03 || type === 'coser';
    case 'orange': return m.skinPct > 0.004 || m.brownPct > 0.1 || type === 'portrait' || type === 'coser' || type === 'pet';
    case 'yellow': return m.foliagePct > 0.03 || m.brownPct > 0.1 || m.skinPct > 0.02 || type === 'pet';
    case 'green': return m.foliagePct > 0.02;
    case 'cyan': return m.skyPct > 0.02 || m.waterPct > 0.02;
    case 'blue': return m.skyPct > 0.03 || m.waterPct > 0.02 || m.neutralPct > 0.25 || type === 'coser';
    case 'magenta': return type === 'coser' || m.skyPct > 0.25;
    default: return true;
  }
}

function hslWhy(key, m) {
  if (key === 'orange') return '橙色既管肤色也管暖色毛发，人像和宠物图里一动橙色，皮肤与毛色立刻变干净或立刻变脏，所以放在最先调。';
  if (key === 'red') return '红色管嘴唇、妆容和红色道具，微调就能提气色。';
  if (key === 'green') return '绿色控制植被，风光里最容易「艳得失真」的就是绿色。';
  if (key === 'blue' || key === 'cyan') return '蓝青控制天空和水面，压暗明度能让天空有层次、不发白。';
  if (key === 'yellow') return '黄色影响草地、阳光和暖色反光，决定画面暖不暖。';
  return '该色域在本张画面里占比明显，单独微调比全局加饱和更可控。';
}

function buildPlan(type, style, m) {
  const T = style.target;
  const tone = [], color = [], subject = [], local = [], detail = [], extraItems = [];
  const tn = TYPES[type].name;

  /* ========== 基础影调 ========== */
  // 曝光：先按实测亮度做校正，风格只在校正幅度不大时才起主导作用
  const expFix = clamp((118 - m.avgLum) / 130, -0.6, 0.95);
  const styleWeight = clamp(1 - Math.abs(expFix) * 1.1, 0.25, 1);
  const expMid = clamp(expFix + T.exp * styleWeight, -1.2, 1.7);
  const lightWord = m.avgLum < 62 ? '明显偏暗' : m.avgLum < 92 ? '略微欠曝' : m.avgLum > 168 ? '整体偏亮' : '亮度在正常区间';
  let expWhy = '实测平均亮度 ' + Math.round(m.avgLum) + '/255，' + lightWord + '。';
  if (expMid >= 0.15) expWhy += '曝光是所有调整的地基，先把亮度拉到位，后面加对比、加饱和才有意义。';
  else if (expMid <= -0.15) expWhy += '画面已经够亮，反向压一点能把高光拉回来，皮肤和白衣的细节才保得住。';
  else expWhy += '亮度已经接近目标值，这一步只做微调——别为了「亮」把高光推爆。';
  tone.push(mk('曝光', rangeText(expMid, 0.13, 2, ' EV'), '全图', expWhy, 'diag', expMid >= 0 ? 'up' : 'down'));

  const cFix = m.contrast < 30 ? 10 : (m.contrast > 58 ? -9 : 0);
  const cMid = clamp(T.contrast + cFix, -35, 35);
  const cWord = m.contrast < 30 ? '反差偏平' : (m.contrast > 58 ? '反差偏硬' : '反差正常');
  tone.push(mk('对比度',
    rangeText(cMid, 3, 0),
    '全图',
    '画面明暗标准差 ' + Math.round(m.contrast) + '（' + cWord + '），「' + style.name + '」需要' + (T.contrast < 0 ? '低反差来留白，所以宁可少加' : '一定的层次支撑，但别拉到 30 以上') + '。',
    'diag', cMid >= 0 ? 'up' : 'down'));

  const hlRisk = m.clipHigh * 0.9 + m.nearWhite * 0.16;
  const hiMid = clamp(T.hi - hlRisk * 0.85, -95, 14);
  const hiWhy = m.clipHigh > 1.2
    ? '高光溢出 ' + m.clipHigh.toFixed(1) + '%，天空或额头已经死白，必须先压回来才能找回层次。'
    : (m.nearWhite > 8 ? '接近纯白的区域占 ' + m.nearWhite.toFixed(1) + '%，压低高光能给亮部留出细节。' : '亮部没有明显溢出，高光只做风格性的压制，保留通透感。');
  tone.push(mk('高光', rangeText(hiMid, 5, 0), '亮部 / 天空 / 额头', hiWhy, 'diag', 'down'));

  // 阴影：曝光已经提亮时，阴影要相应收敛，避免「双重提亮」把画面洗白
  const shNeed = m.shadowPct * 0.45 + (m.avgLum < 90 ? 12 : (m.avgLum < 110 ? 5 : 0));
  const shMid = clamp(T.sh + shNeed - Math.max(0, expFix) * 25, -12, 80);
  const shWhy = m.shadowPct > 5
    ? '暗部压死的像素占 ' + m.shadowPct.toFixed(1) + '%，头发、衣服、树影里已经没有细节，提阴影是找回层次最直接的办法。'
    : '暗部还有细节，提阴影主要是为了' + (type === 'portrait' ? '让皮肤过渡更柔、避免鼻影发黑' : '让暗部层次更耐看') + '。';
  tone.push(mk('阴影', rangeText(shMid, 6, 0), '暗部 / 头发 / 阴影面', shWhy, 'diag', 'up'));

  const whMid = clamp(T.wh + (m.nearWhite > 5 ? -5 : 0), -30, 30);
  const blMid = clamp(T.bl - (m.shadowPct > 12 ? 5 : 0), -60, 40);
  tone.push(mk('白色阶 / 黑色阶',
    '白色 ' + rangeText(whMid, 3, 0) + '；黑色 ' + rangeText(blMid, 3, 0),
    '两端端点',
    '白色阶决定「亮部的白有多亮」，黑色阶决定「暗部有多实」。' + style.name + '的调性需要在两端各给一点' + (T.bl > 0 ? '抬升（褪色感）' : '下压（扎实感）') + '，中间调才不会发灰。',
    'style', 'tune'));

  const clMid = T.clarity + (m.isFlat ? 4 : 0);
  tone.push(mk('清晰度 / 纹理',
    '清晰度 ' + rangeText(clMid, 4, 0) + '；纹理 ' + rangeText(T.clarity > 0 ? 6 : -3, 4, 0),
    '中间调微反差',
    '清晰度只影响中间调的局部反差：' + (clMid < 0 ? '往负方向走会柔化皮肤与空气感，是人像的常用手法' : '往正方向走能让质感、石头、树叶「立」起来，但过 20 会出白边') + '。',
    'style', clMid >= 0 ? 'up' : 'down'));

  if (m.isHazy || type === 'landscape') {
    const hzVal = m.isHazy ? '+10 ~ +20' : '-6 ~ +4';
    tone.push(mk('去朦胧',
      hzVal,
      '远景 / 全图',
      m.isHazy ? '画面平均对比 ' + Math.round(m.contrast) + '、饱和 ' + (m.sat * 100).toFixed(0) + '%，典型的空气透视发灰，去朦胧比加对比更干净。' : '远景略灰时加一点，画面通透后再减回来，避免整张发脏。',
      'diag', m.isHazy ? 'up' : 'tune'));
  }

  /* ========== 色彩与白平衡 ========== */
  const castK = clamp(-m.tempDelta * 15, -900, 900);
  const kMid = clamp(T.temp + castK, 3600, 7400);
  const absCast = Math.abs(Math.round(castK));
  let kWhy;
  if (Math.abs(m.tempDelta) > 6) {
    kWhy = '画面中性区域实测 R−B = ' + fmtNum(m.tempDelta, 0) + '，整体偏' + (m.tempDelta > 0 ? '暖' : '冷') + '，需向' + (m.tempDelta > 0 ? '冷' : '暖') + '回调约 ' + absCast + 'K；' + style.name + '的基调再叠加在上面。';
  } else {
    kWhy = '白平衡基本准确（R−B ≈ ' + fmtNum(m.tempDelta, 0) + '），色温主要服务于风格：' + style.name + '要求' + (T.temp < 5250 ? '偏冷' : (T.temp > 5700 ? '偏暖' : '接近中性')) + '，以 5500K 为基准。';
  }
  color.push(mk('色温', Math.round(kMid - 220) + ' K ~ ' + Math.round(kMid + 220) + ' K', '全图', kWhy, 'diag', 'tune'));

  const tintAdj = clamp(m.greenDelta * 1.6, -22, 22);
  const tMid = clamp(T.tint + tintAdj, -35, 35);
  const tWhy = Math.abs(m.greenDelta) > 3.5
    ? '中性区偏' + (m.greenDelta > 0 ? '绿' : '洋红') + '（G 偏差 ' + fmtNum(m.greenDelta, 0) + '），向' + (m.greenDelta > 0 ? '洋红' : '绿') + '方向修正，皮肤才不会发青。'
    : '色调只做风格微调：正值偏洋红（皮肤更粉），负值偏绿（更冷峻），幅度控制在 ±10 以内最安全。';
  color.push(mk('色调', rangeText(tMid, 4, 0), '全图 / 皮肤', tWhy, 'diag', 'tune'));

  const vibMid = clamp(T.vib + (m.sat < 0.16 ? 9 : (m.sat > 0.46 ? -7 : 0)), -20, 45);
  color.push(mk('自然饱和度',
    rangeText(vibMid, 5, 0),
    '全图（优先保护肤色）',
    '当前平均饱和度 ' + (m.sat * 100).toFixed(0) + '%（' + (m.sat < 0.18 ? '偏低' : (m.sat > 0.45 ? '偏高' : '适中')) + '）。自然饱和度会绕开已经很艳的区域，比直接拉饱和度安全。',
    'diag', vibMid >= 0 ? 'up' : 'down'));

  const satMid = clamp(T.sat + (m.sat > 0.5 ? -6 : 0), -55, 30);
  color.push(mk('饱和度',
    rangeText(satMid, 4, 0),
    '全图',
    '「' + style.name + '」的整体色彩浓度靠这一项定调。' + (satMid < 0 ? '降饱和是为了让画面「稳」，尤其人像降 10 左右肤色会更高级。' : '加饱和时优先用自然饱和度，这一项只做小幅补足。'),
    'style', satMid >= 0 ? 'up' : 'down'));

  const hslKeys = Object.keys(style.hsl).filter(k => hslRelevant(k, m, type));
  const useKeys = hslKeys.length ? hslKeys : Object.keys(style.hsl).slice(0, 2);
  useKeys.forEach(k => color.push(hueRow(k, style.hsl[k], hslWhy(k, m))));

  color.push(mk('RGB 曲线',
    style.curve,
    '全图',
    '曲线是「' + style.name + '」的影调骨架。先把曲线拉出形状，再用基础面板微调，比反复推滑块稳定得多。',
    'style', 'tune'));

  color.push(mk('分离色调 / 色彩平衡',
    style.split,
    '高光 / 阴影分别',
    '高光染一个色、阴影染另一个色，是风格辨识度最高的部分。注意幅度宁小勿大，饱和度超过 20 就容易「塑料」。',
    'style', 'tune'));

  const styleLocal = [];
  if (style.extra && style.extra.length) {
    style.extra.forEach(function (it) {
      if (it.tag === 'local') styleLocal.push(it);
      else extraItems.push(it);
    });
  }

  /* ========== 类型专项 ========== */
  const skinTxt = (m.skinPct * 100).toFixed(1);
  if (type === 'portrait') {
    subject.push(
      mk('污点修复画笔', '画笔直径 = 瑕疵尺寸 ×1.2；硬度 0%；类型「内容识别」', '面部 / 颈部 / 裸露皮肤',
        '磨皮之前先把痘印、红点、碎发、衣服线头清掉，否则磨皮会把它们糊成一块色斑，越修越脏。', 'type', 'tune'),
      mk('频率分离磨皮', '低频层：高斯模糊 6~10px；高频层：应用图像「减去」+ 线性光；修复画笔不透明度 30%~50%', '面部 / 下巴 / 手臂',
        '皮肤占画面 ' + skinTxt + '%，是主要观看区域。频率分离把「纹理」和「色块」分开，能推平肤色不均又保留毛孔，比直接高斯模糊真实得多。', 'type', 'tune'),
      mk('可选颜色 · 红色', '黑色 -8 ~ -15；洋红 +2 ~ +5', '皮肤 / 暗沉处',
        '皮肤暗沉本质是红色通道里黑色过多，压一点黑色，人立刻「亮」起来，而且不破坏质感。', 'type', 'down'),
      mk('明暗液化', '向前变形工具，压力 20~30，单次幅度 ≤5%，分 2~3 次推', '脸型 / 下颌线 / 手臂',
        '一次推到位一定会变形。小幅度多次推，五官比例和背景的直线才不会被拉歪。', 'type', 'tune'),
      mk('减淡工具 · 眼神光', '曝光 8%~12%，范围「高光」，画笔柔边', '瞳孔高光 / 眼白',
        '眼睛亮一度，整张人像就有神。这是性价比最高的一个局部操作。', 'type', 'up'),
      mk('可选颜色 · 白色', '黄色 -12 ~ -20；黑色 0', '眼白 / 牙齿 / 白衣服',
        '眼白和牙齿发黄是最容易被忽略的「脏」，减黄之后整张脸会干净一个档次。', 'type', 'down'),
      mk('曲线局部加深', '曲线下拉 -6 ~ -10，配合蒙版', '唇色 / 眉尾 / 鼻影',
        '不用调色也能提升立体感：把该暗的地方压下去，脸就有结构了。', 'type', 'down')
    );
    if (m.blobCount >= 2) {
      subject.push(mk('多人肤色统一', '分别建立蒙版，各自调 HSL 橙色明度差 ≤8', '每个人脸单独一层',
        '检测到约 ' + m.blobCount + ' 处肤色区块，多人时容易出现「一张白一张黄」，必须分开校正才自然。', 'type', 'tune'));
    }
  }

  if (type === 'coser') {
    subject.push(
      mk('环境光偏色校正', '可选颜色：按偏色通道单独减青/减洋红，幅度 -10 ~ -25', '整体受光面 / 肤色',
        'COS 图常有彩色灯或环境反光，肤色一旦偏色，后面所有妆面调整都会算错。先中性化，再加风格。', 'type', 'tune'),
      mk('频率分离磨皮（轻）', '高斯模糊 5~8px；修复画笔不透明度 25%~40%', '面部 / 手臂',
        'COS 妆通常较厚，磨皮要更轻：目标是均匀而不是无瑕，太狠会把妆面结构磨平，反而失真。', 'type', 'tune'),
      mk('妆面强化', '色相/饱和度：眼影与唇部单独 +10 ~ +20 饱和；曲线加深 -8', '眼妆 / 唇 / 腮红',
        '相机吃妆是常态。还原妆面要靠局部饱和 + 明度控制，别整张加饱和，衣服会先崩。', 'type', 'up'),
      mk('瞳孔与眼神光', '减淡工具 曝光 10%~15%；USM 锐化 数量 80% 半径 0.6px', '瞳孔 / 睫毛',
        '二次元感的眼睛要「亮 + 锐」，瞳孔提亮配合睫毛锐化，角色感立刻出来。', 'type', 'up'),
      mk('假发与发丝处理', '修补工具 / 仿制图章，画笔硬度 40%~60%；发际线用「选择并遮住」半径 1.5px', '发际线 / 假发边缘',
        '假发的硬边和胶痕是 COS 图最显假的地方，边缘处理干净，质感立刻上一个档次。', 'type', 'tune'),
      mk('服装质感与结构', '清晰度局部 +12 ~ +20（蒙版只选衣服）；USM 数量 70% 半径 1.0px', '服装 / 道具',
        '布料、皮革、金属的质感靠局部清晰度和锐化撑，全局加清晰度会把皮肤一起弄糙。', 'type', 'up'),
      mk('背景分离', '人物抠出（选择并遮住）→ 背景压暗 -0.3 ~ -0.5EV 或镜头模糊 半径 4~8px', '背景 / 边缘',
        'COS 图常常背景杂乱，压暗或轻微虚化能让角色「跳」出来，比换背景更自然。', 'type', 'tune'),
      mk('高光发光', '载入高光 → 新建图层填白 → 高斯模糊 20~30px → 滤色 10%~18%', '灯光 / 反光 / 眼睛',
        '二次元通透感的来源是高光扩散，不是提亮整体，注意用蒙版只留在光源附近。', 'type', 'up')
    );
  }

  if (type === 'landscape') {
    subject.push(
      mk('高光恢复', '高光 -60 ~ -90；白色阶 -10 ~ -20', '天空 / 云 / 水面反光',
        '风光图的天空几乎一定过曝。先把高光压到底看能不能救回层次，救不回就考虑后期换天，而不是硬拉。', 'type', 'down'),
      mk('去朦胧 / 清晰度分层', '去朦胧 +8 ~ +16（远景）；清晰度 +10 ~ +20（中景山体）', '远景 / 中景',
        '风光最忌全局一刀切。远景用去朦胧解决空气灰，中景用清晰度立结构，近景保持柔和，才有纵深。', 'type', 'up'),
      mk('可选颜色 · 绿色', '青色 +8 ~ +15；黄色 -5 ~ +5', '植被',
        '自然界的绿偏黄偏青，直接加绿饱和会变「荧光绿」。用可选颜色把绿往青里推，立刻自然。', 'type', 'tune'),
      mk('可选颜色 · 蓝色', '青色 -10 ~ -20；洋红 +3 ~ +8', '天空 / 水面',
        '天空发紫或发灰，多数是蓝里青色过多，减青加一点点洋红，天空会变成干净的湛蓝。', 'type', 'tune'),
      mk('渐变滤镜 · 天空', '从地平线向上拉的线性渐变；曝光 -0.3 ~ -0.6EV；蓝色 饱和 +10 / 明度 -8', '天空',
        '天空比地面亮 2~3 档是常态，用渐变滤镜压天空比整体降低曝光更精准，地面亮度不受影响。', 'local', 'down'),
      mk('前景提亮', '线性渐变 / 径向滤镜：曝光 +0.2 ~ +0.4EV', '前景岩石 / 沙滩 / 花丛',
        '压完天空后前景往往发闷，提一点前景能形成「亮—暗—亮」的层次，画面才有呼吸。', 'local', 'up'),
      mk('水平与透视校正', '裁剪拉直 / 透视校正：垂直 +2 ~ +6，水平 ±1', '地平线 / 建筑线条',
        '风光图的地平线歪 1° 都能被看出来，先校正再谈调色。', 'type', 'tune')
    );
  }

  if (type === 'pet') {
    const coatTxt = Math.round((m.furPct + m.paleFurPct) * 100);
    const isWhiteCoat = m.paleFurPct > 0.14 || (m.coatLum > 178 && m.paleFurPct > 0.07);
    const isDarkCoat = !isWhiteCoat && m.coatLum > 0 && m.coatLum < 108;
    let coatVal, coatArea, coatWhy;
    if (isDarkCoat) {
      coatVal = '阴影 +25 ~ +45；黑色阶 +5 ~ +10；配合明度降噪 25~35';
      coatArea = '黑毛区域 / 暗部毛发';
      coatWhy = '毛色本身实测亮度 ' + Math.round(m.coatLum) + '/255，属于偏暗的毛。黑毛最怕「没有细节」——提阴影能救回毛丝层次，但会带出噪点，所以必须同步降噪。';
    } else if (isWhiteCoat) {
      coatVal = '高光 -40 ~ -70；白色阶 -8 ~ -15；高光区加一点点冷色（蓝色 饱和 +3）';
      coatArea = '白毛区域 / 高光毛发';
      coatWhy = '浅色毛占 ' + Math.round(m.paleFurPct * 100) + '%，最容易过曝成一片纯白、看不出毛丝。压高光保住层次，再给高光一点冷色，白毛才不会发黄发闷。';
    } else {
      coatVal = '高光 -20 ~ -40；阴影 +15 ~ +30；中间调对比 +6 ~ +14';
      coatArea = '全身边缘毛发 / 背光面';
      coatWhy = '毛色不黑不白（实测毛色亮度 ' + Math.round(m.coatLum) + '/255），重点是把背光面的毛丝拉出来、同时守住高光，让毛发有「体积」而不是一片平色。';
    }
    subject.push(
      mk('污点修复 · 泪痕 / 眼屎 / 脏点', '画笔直径 = 瑕疵宽度 ×1.5；硬度 0%；类型「内容识别」；顽固泪痕追加「可选颜色 · 红色」黑色 -10', '眼角 / 嘴周 / 爪缝 / 毛发打结处',
        '泪痕是红棕色的氧化痕迹，直接修补会留一块浅印。正确的顺序是「先修形状，再压掉红棕色」，这样毛色才接得上。', 'type', 'tune'),
      mk('眼睛提亮 + 眼神光', '减淡工具曝光 10%~15%（范围「高光」）只刷瞳孔与高光点；USM 数量 80% 半径 0.6px 锐化瞳孔边缘', '瞳孔 / 眼白 / 睫毛',
        '宠物的眼睛是唯一能跟观众对视的地方。黑瞳孔在暗部容易糊成一块死黑，提亮一度、锐化边缘，整只动物立刻「活」过来。', 'type', 'up'),
      mk('鼻头湿润感', '减淡工具曝光 8%~12%，点一下鼻尖反光点；可选颜色「红色」饱和 +5', '鼻头 / 唇线',
        '健康的鼻头是微湿反光的。补一个小高光比任何磨皮都更能传达「有生命」，注意别点成油光，高光点要小。', 'type', 'up'),
      mk('可选颜色 · 毛色校正', '橙色通道 · 黄色 ' + (m.tempDelta > 6 ? '-10 ~ -18' : '-4 ~ -10') + '；白色通道 · 黄色 -15 ~ -25、黑色 -5 ~ -8', '全身毛发 / 白毛区',
        '实测毛色像素约 ' + coatTxt + '%，白平衡 R−B = ' + fmtNum(m.tempDelta, 0) + '。室内灯光会把毛色照得发黄发脏，橙色减黄能把毛色拉回本色；白色毛单独减黄，是「白猫变雪白」的关键一步。', 'type', 'tune'),
      mk(isDarkCoat ? '黑毛提阴影（护细节）' : (isWhiteCoat ? '白毛护高光（防死白）' : '毛色层次（保体积）'),
        coatVal, coatArea, coatWhy, 'type', isDarkCoat ? 'up' : (isWhiteCoat ? 'down' : 'tune')),
      mk('高反差保留 · 毛发锐化', '复制图层 → 高反差保留 半径 3~6px → 混合模式「线性光」→ 不透明度 40%~60%；蒙版擦掉背景与暗部', '毛发轮廓 / 胡须 / 耳朵绒毛',
        '毛发是典型的高频细节，全局 USM 会把噪点一起放大。高反差保留只强化「结构」，配合蒙版能精准只作用于毛发，这是宠物图最有效的一招。', 'type', 'up'),
      mk('毛发分区降噪', 'Camera Raw 细节：明度 20~35 / 颜色 25~40；用蒙版排除主体毛发，只作用背景与暗部', '背景 / 暗部毛发 / 虚化区',
        '降噪和锐化是矛盾的，同一张图里只能分区做。先降背景噪点，再锐毛发，顺序反了细节就找不回来。', 'type', 'tune'),
      mk('胡须与耳缘抠图', '选择并遮住：半径 1.5~2.5px，勾选「智能半径」，输出「新建带有图层蒙版的图层」', '胡须 / 耳缘 / 尾巴边缘',
        '毛发边缘最容易出现「剪纸感」。换背景、压暗背景之前先把边缘处理干净，整张图的专业度差别全在这里。', 'type', 'tune'),
      mk('背景虚化 · 分离主体', '抠出主体（选择并遮住）→ 背景做镜头模糊 半径 6~12px；保留地面接触处的投影，否则会「飘」', '主体以外的区域',
        '宠物照多是居家环境，背景杂乱是常态。虚化比换背景自然得多，也比单纯压暗更像「拍出来的」浅景深。', 'type', 'tune')
    );
    if (m.blobCount >= 3) {
      subject.push(mk('多只宠物', '分别建立蒙版，各自调白色平衡，毛色明度差控制在 ±10 以内', '每只动物单独一层',
        '检测到约 ' + m.blobCount + ' 处毛色区块，多只同框时常出现「一只发黄一只发白」，必须分开校正。', 'type', 'tune'));
    }
  }

  /* ========== 局部精修 ========== */
  styleLocal.forEach(function (it) { local.push(it); });

  if (m.skyPct > 0.05) {
    local.push(mk('天空蒙版', '线性渐变 从画面上 1/3 处下拉；曝光 -0.2 ~ -0.4EV；蓝色 明度 -6 / 饱和 +8；高光 -10', '天空区域',
      '识别到天空占画面 ' + (m.skyPct * 100).toFixed(0) + '%，单独压暗能让天地分层，也避免整体压暗把地面弄脏。', 'local', 'down'));
  }
  if (m.skinPct > 0.012) {
    local.push(mk('主体径向提亮', '径向滤镜以' + (type === 'pet' ? '宠物头部' : '人物') + '为中心，羽化 70%；曝光 +0.1 ~ +0.25EV；清晰度 +5', type === 'pet' ? '宠物 / 头部 / 眼睛' : '人物 / 面部',
      '把视觉重心提亮一点，等于给观众指路。幅度要小，超过 0.4EV 就会看出「贴上去的光」。', 'local', 'up'));
    local.push(mk('背景压暗', (type === 'pet' ? '选择主体 → 反选' : '选择人物 → 反选') + ' → 曲线下压 -8 ~ -14（或用 Camera Raw 蒙版「背景」）', '主体以外的区域',
      (type === 'pet' ? '宠物' : '人像') + '的立体感来自主体与背景的明度差，压背景比提主体更自然，也不会让' + (type === 'pet' ? '白毛过曝' : '皮肤过曝') + '。', 'local', 'down'));
  }
  if (m.waterPct > 0.06) {
    local.push(mk('水面处理', '径向 / 渐变蒙版：高光 -15；清晰度 -10（柔化反光）；蓝色 饱和 +6', '水面 / 倒影',
      '水面占画面 ' + (m.waterPct * 100).toFixed(0) + '%，反光容易抢主体，柔化并压一点高光会安静很多。', 'local', 'down'));
  }
  if (m.brownPct > 0.16 && m.skinPct < 0.03 && type !== 'landscape' && type !== 'pet') {
    local.push(mk('疑似毛发 / 动物主体', '径向提亮 +0.2EV；锐化局部 数量 80% 半径 0.8px；眼睛单独提亮', '画面中部暖色主体',
      '画面有 ' + (m.brownPct * 100).toFixed(0) + '% 的暖棕色调且无肤色特征，可能是宠物或毛绒主体——如果是，建议把图片类型改成「宠物」，会给出毛发与眼睛的完整方案。', 'local', 'up'));
  }
  if (!local.length) {
    local.push(mk('局部加光减光', '新建「曲线」调整图层 + 蒙版，亮部 +5 / 暗部 -5', '视觉中心 / 四角',
      '全局调整之后，用蒙版做一次「加光减光」，是让照片从「调过」变成「拍出来的」的关键一步。', 'local', 'tune'));
  }

  /* ========== 细节与输出 ========== */
  const isPortraitLike = type === 'portrait' || type === 'coser';
  let usmVal, usmArea, usmWhy;
  if (type === 'pet') {
    usmVal = '数量 70%~100% / 半径 0.8~1.2px / 阈值 6~10';
    usmArea = '毛发边缘 / 胡须 / 眼睛（避开背景与虚化区）';
    usmWhy = '宠物锐化的对象是毛，不是整张图。阈值调到 6~10 只让毛发边缘被锐化，背景噪点不会被放大；更推荐用「高反差保留」替代 USM，可控性更好。';
  } else if (isPortraitLike) {
    usmVal = '数量 60%~80% / 半径 0.8~1.0px / 阈值 8~12';
    usmArea = '五官 / 发丝 / 服装（避开皮肤）';
    usmWhy = '人像锐化阈值要高，只让边缘被锐化，皮肤上的噪点不会被放大。建议复制图层加蒙版，只刷眼睛、睫毛、发丝和衣服。';
  } else {
    usmVal = '数量 80%~120% / 半径 1.0~1.4px / 阈值 3~5';
    usmArea = '山脊 / 岩石 / 建筑边缘';
    usmWhy = '风光用「景观锐化」思路：半径略大、阈值低，让细节整体立起来，但注意天空区域要单独减掉，否则出噪点。';
  }
  detail.push(mk('USM 锐化', usmVal, usmArea, usmWhy, 'out', 'up'));

  if (m.avgLum < 85 || m.isNight || m.shadowPct > 10) {
    detail.push(mk('减少杂色',
      '明度 15 ~ 30；颜色 25 ~ 35（Camera Raw › 细节）',
      '暗部 / 皮肤 / 天空',
      '实测亮度偏低（' + Math.round(m.avgLum) + '/255），暗部与纯色区域容易出彩色噪点。先降噪再锐化，顺序反了噪点会被一起锐化出来。',
      'out', 'tune'));
  }

  detail.push(mk('导出设置',
    'sRGB / 8 位 / JPEG 质量 90~95；长边 2048px（社交）或 4096px（打印 / 交付）',
    '输出',
    '很多人调完色在 PS 里好看，发出去变灰变艳，就是色彩空间没转 sRGB。导出前务必「转换为配置文件：sRGB IEC61966-2.1」。',
    'out', 'tune'));

  detail.push(mk('保存分层文件',
    'PSD / 16 位，保留调整图层与蒙版；命名「日期_类型_风格_v1」',
    '工程文件',
    '参数永远要二次调整，分层保存意味着你随时能改一半重来，而不是从头再调一次。',
    'out', 'tune'));

  /* ========== 组装 ========== */
  const groups = [
    { title: '基础影调', path: '滤镜 › Camera Raw 滤镜 › 基本（Light）', items: tone },
    { title: '色彩与白平衡', path: 'Camera Raw › 白平衡 / 颜色 / 曲线 / 分离色调', items: color },
    { title: '风格附加调整', path: 'Camera Raw › 效果（颗粒 / 晕影）｜PS 可选颜色 / 图层叠加', items: extraItems },
    { title: TYPES[type].name + ' · 专项处理', path: TYPES[type].focus, items: subject },
    { title: '局部精修（蒙版）', path: 'Camera Raw › 蒙版 / 或 PS 调整图层 + 蒙版', items: local },
    { title: '细节与输出', path: 'USM 锐化 / Camera Raw 细节 / 导出', items: detail }
  ].filter(g => g.items.length);

  const summary =
    '识别到的画面特征：平均亮度 ' + Math.round(m.avgLum) + '、反差 ' + Math.round(m.contrast) +
    '、饱和 ' + (m.sat * 100).toFixed(0) + '%' +
    (m.skinPct > 0.01 ? '、肤色区域 ' + skinTxt + '%' : '') +
    (m.skyPct > 0.03 ? '、天空 ' + (m.skyPct * 100).toFixed(0) + '%' : '') +
    (m.foliagePct > 0.03 ? '、植被 ' + (m.foliagePct * 100).toFixed(0) + '%' : '') +
    '。按「' + TYPES[type].name + ' + ' + style.name + '」给出 ' +
    groups.reduce((a, g) => a + g.items.length, 0) + ' 条可直接执行的 PS 参数。';

  return { groups: groups, summary: summary, order: TYPES[type].order.slice() };
}

/* ---------------- 8. 渲染 ---------------- */
function renderTypes() {
  el.typeList.innerHTML = Object.keys(TYPES).map(function (k) {
    const t = TYPES[k];
    return '<button type="button" class="type-card" data-type="' + k + '" aria-pressed="false">' +
      '<span class="tc-icon">' + t.icon + '</span>' +
      '<span class="tc-body"><b>' + t.name + '</b><em>' + t.hint + '</em></span>' +
      '<span class="tc-check">✓</span></button>';
  }).join('');
}

function renderTabs() {
  const tabs = [
    { k: 'all', n: '全部' },
    { k: 'portrait', n: '人像向' },
    { k: 'landscape', n: '风光向' },
    { k: 'universal', n: '通用' }
  ];
  el.filterTabs.innerHTML = tabs.map(function (t) {
    return '<button type="button" class="chip" role="tab" data-tab="' + t.k + '" aria-selected="' + (state.tab === t.k) + '">' + t.n + '</button>';
  }).join('');
}

function renderStyles() {
  const recId = state.type ? REC[state.type] : null;
  const list = STYLES.filter(s => state.tab === 'all' || s.cat === state.tab);
  el.styleList.innerHTML = list.map(function (s) {
    const on = state.styleId === s.id;
    const rec = s.id === recId;
    return '<button type="button" class="style-card" data-id="' + s.id + '" aria-pressed="' + on + '">' +
      (rec ? '<span class="badge-rec">推荐</span>' : '') +
      '<span class="swatch" style="background:linear-gradient(150deg,' + s.swatch[0] + ',' + s.swatch[1] + ' 58%,' + s.swatch[2] + ')"></span>' +
      '<span class="sc-body"><span class="sc-top"><b>' + s.name + '</b><em>' + s.tag + '</em></span>' +
      '<span class="sc-desc">' + s.desc + '</span></span></button>';
  }).join('');
  el.styleHint.textContent = list.length + ' / ' + STYLES.length + ' 种预设';
}

function applyPreview() {
  const st = styleById(state.styleId);
  if (!st) {
    el.img.style.filter = '';
    el.tint.style.opacity = 0;
    el.metaStyle.textContent = '风格预览：未应用';
    return;
  }
  el.img.style.filter = st.filter;
  el.tint.style.background = st.tint.color;
  el.tint.style.opacity = String(st.tint.alpha);
  el.tint.style.mixBlendMode = st.tint.blend;
  el.metaStyle.textContent = '风格预览：' + st.name;
}

function updateRun() {
  const ready = !!state.img;
  const ok = ready && state.type && state.styleId;
  el.btnRun.disabled = !ok || state.busy;
  if (!ready) el.runHint.textContent = '先上传一张照片';
  else if (!state.type) el.runHint.textContent = '还差一步：选择图片类型';
  else if (!state.styleId) el.runHint.textContent = '再选一个目标风格';
  else el.runHint.innerHTML = '将按 <b>' + TYPES[state.type].name + ' · ' + styleById(state.styleId).name + '</b> 生成方案';
}

function renderDetect(m, type) {
  const cards = [];
  const push = (k, v, hot) => cards.push('<div class="dcard' + (hot ? ' hot' : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>');

  // AI 识别结果优先占前两张卡：它是语义判断，比像素统计更该被看到
  if (state.ai) {
    push('AI 判定', TYPES[state.ai.type].name + ' · ' + Math.round(state.ai.confidence * 100) + '%', true);
    if (state.ai.elements.length) push('AI 识别元素', esc(state.ai.elements.join('、')));
    if (state.ai.reason) push('AI 判断依据', esc(state.ai.reason));
  } else {
    push('主体判定', TYPES[type].name, true);
  }

  push('平均亮度', Math.round(m.avgLum) + ' / 255');
  push('反差', Math.round(m.contrast));
  push('饱和度', (m.sat * 100).toFixed(0) + '%');
  // 非人像场景里，肤色色域命中的多半是木头/泥土/落叶，改个更准确的说法免得误读
  const skinLabel = (state.ai && (state.ai.type === 'landscape' || state.ai.type === 'pet')) ? '暖色色域' : '肤色区域';
  if (m.skinPct > 0.005) push(skinLabel, (m.skinPct * 100).toFixed(1) + '%');
  if (m.furPct + m.paleFurPct > 0.06) push('毛发 / 毛色块', Math.round((m.furPct + m.paleFurPct) * 100) + '%', type === 'pet');
  if (m.coatTexture > 0.2 && (m.furPct + m.paleFurPct) > 0.06) push('毛色纹理密度', Math.round(m.coatTexture * 100) + '%');
  if (m.skyPct > 0.02) push('天空占比', (m.skyPct * 100).toFixed(0) + '%');
  if (m.foliagePct > 0.02) push('植被占比', (m.foliagePct * 100).toFixed(0) + '%');
  if (m.waterPct > 0.05) push('水面/反光', (m.waterPct * 100).toFixed(0) + '%');
  push('白平衡', Math.abs(m.tempDelta) < 6 ? '中性' : (m.tempDelta > 0 ? '偏暖 ' + fmtNum(m.tempDelta, 0) : '偏冷 ' + fmtNum(m.tempDelta, 0)));
  push('高光溢出', m.clipHigh.toFixed(1) + '%', m.clipHigh > 2);
  push('暗部死黑', m.shadowPct.toFixed(1) + '%', m.shadowPct > 8);
  push('边缘细节', (m.edgeDensity * 100).toFixed(1) + '%');
  push('主色调', m.hueTop);
  if (m.isNight) push('场景', '低照度 / 夜景', true);
  else if (m.isHazy) push('场景', '空气透视 / 发灰', true);
  el.detect.innerHTML = cards.join('');
}

function renderOrder(list) {
  el.order.innerHTML = '<h3>建议执行顺序</h3><ol>' + list.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>';
}

const TAG_TXT = { diag: '诊断', style: '风格', type: '类型', local: '局部', out: '输出' };
const DIR_TXT = { up: '↑', down: '↓', tune: '≈' };

function renderGroups(groups) {
  el.groups.innerHTML = groups.map(function (g) {
    const rows = g.items.map(function (it) {
      return '<div class="item">' +
        '<div class="item-name"><span class="dir ' + it.dir + '">' + (DIR_TXT[it.dir] || '≈') + '</span>' +
        '<span class="n">' + esc(it.name) + '</span>' +
        '<span class="tag ' + it.tag + '">' + (TAG_TXT[it.tag] || '') + '</span></div>' +
        '<div class="item-val">' + esc(it.value) + '</div>' +
        '<div class="item-area">' + esc(it.area) + '</div>' +
        '<div class="item-why">' + esc(it.why) + '</div>' +
        '</div>';
    }).join('');
    return '<section class="group">' +
      '<div class="group-head"><h3>' + esc(g.title) + '</h3><span class="path">' + esc(g.path) + '</span></div>' +
      '<div class="items"><div class="items-head"><span>调整项目</span><span>推荐参数范围</span><span>适用区域</span><span>原因</span></div>' + rows + '</div>' +
      '</section>';
  }).join('');
}

function renderResult() {
  const p = state.plan;
  if (!p) return;
  el.resultTitle.textContent = TYPES[state.type].name + ' · ' + styleById(state.styleId).name;
  el.resultSub.textContent = p.summary;
  renderDetect(state.m, state.type);
  renderOrder(p.order);
  renderGroups(p.groups);
  el.result.hidden = false;
}

/* ---------------- 9. 交互 ---------------- */
function loadFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { el.runHint.textContent = '这个文件不是图片，换一张试试'; return; }
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file;
  state.fileName = file.name || '剪贴板图片';
  state.url = URL.createObjectURL(file);
  // 换图后旧的 AI 结论作废，重新走识别
  state.ai = null;
  state.userPickedType = false;

  const img = new Image();
  img.onload = function () {
    state.img = img;
    el.img.src = state.url;
    el.dropzone.hidden = true;
    el.preview.hidden = false;
    el.result.hidden = true;
    el.btnCompare.hidden = false;
    el.btnChange.hidden = false;
    el.metaName.textContent = state.fileName;
    el.metaSize.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB';

    try {
      state.m = analyze(img);
    } catch (e) {
      state.m = null;
    }

    if (state.m) {
      const g = guessType(state.m);
      state.guess = g;
      const confTxt = Math.round(g.conf * 100) + '%';
      const TRUST = 0.55;
      if (!state.type) {
        if (g.type && g.conf >= TRUST) {
          selectType(g.type, false);
          // 自动判出类型时一并给上推荐风格，否则按钮会一直停在禁用态
          if (!state.styleId) selectStyle(REC[g.type]);
          el.typeHint.textContent = '建议：' + TYPES[g.type].name + ' · ' + g.why + '（置信 ' + confTxt + '）';
        } else if (g.type) {
          el.typeHint.textContent = '不太确定（最接近「' + TYPES[g.type].name + '」' + confTxt + '），请手动选择';
        } else {
          el.typeHint.textContent = '无法判断类型，请手动选择（或配置 AI 识别）';
        }
      } else {
        el.typeHint.textContent = g.type ? (g.why + '（置信 ' + confTxt + '）') : g.why;
      }
    } else {
      el.typeHint.textContent = '这张图无法读取像素，请换一张 JPG / PNG';
    }
    updateRun();
  };
  img.onerror = function () { el.runHint.textContent = '这张图片无法解码，建议换成 JPG / PNG'; };
  img.src = state.url;
}

function resetImage() {
  state.img = null;
  state.m = null;
  state.plan = null;
  state.file = null;
  state.fileName = '';
  el.preview.hidden = true;
  el.dropzone.hidden = false;
  el.btnCompare.hidden = true;
  el.btnChange.hidden = true;
  el.result.hidden = true;
  el.img.removeAttribute('src');
  el.img.style.filter = '';
  el.tint.style.opacity = 0;
  el.imgwrap.classList.remove('orig');
  el.metaName.textContent = '—';
  el.metaSize.textContent = '—';
  el.typeHint.textContent = '决定后续的修图重点';
  updateRun();
}

function selectType(k, autoStyle) {
  state.type = k;
  $$('.type-card', el.typeList).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === k)));

  const prefTab = k === 'landscape' ? 'landscape' : (k === 'pet' ? 'all' : 'portrait');
  const cur = state.styleId ? styleById(state.styleId) : null;
  const keep = !!(cur && (cur.cat === 'universal' || cur.cat === prefTab));
  state.tab = (keep && cur.cat === 'universal') ? 'all' : prefTab;

  if (autoStyle !== false && !keep) state.styleId = REC[k];

  renderTabs();
  renderStyles();
  applyPreview();
  updateRun();
}

function selectStyle(id) {
  state.styleId = id;
  $$('.style-card', el.styleList).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  applyPreview();
  updateRun();
}

async function run() {
  if (state.busy) return;
  if (!state.img) { toast('先上传一张照片'); return; }
  if (!state.m) { toast('这张图无法解析像素，请换一张 JPG / PNG'); return; }
  const hasAI = aiReady();
  // 配置了 AI 时不必先手选类型/风格：让模型判断，风格取推荐值
  if (!hasAI) {
    if (!state.type) { toast('先选择图片类型'); return; }
    if (!state.styleId) { toast('再选一个目标风格'); return; }
  }

  state.busy = true;
  updateRun();
  el.imgwrap.classList.remove('orig');
  el.scanLayer.hidden = false;
  el.scanBar.style.width = '0%';

  /* --- 先用大模型识别（已配置时） --- */
  let aiRes = null, aiErr = '';
  if (hasAI) {
    el.scanTxt.textContent = 'AI 正在识别画面…';
    el.scanBar.style.width = '20%';
    try {
      aiRes = await aiRecognize();
      state.ai = aiRes;
    } catch (e) {
      state.ai = null;
      aiErr = (e && e.message) || '未知错误';
    }
  }

  /* --- 类型决策：AI 结果优先，但不覆盖用户主动点选的类型 --- */
  if (aiRes) {
    if (!state.userPickedType || !state.type) {
      if (state.type !== aiRes.type) selectType(aiRes.type, true);
    }
    el.typeHint.textContent = 'AI 判断：' + TYPES[aiRes.type].name
      + '（置信 ' + Math.round(aiRes.confidence * 100) + '%）'
      + (aiRes.reason ? ' · ' + aiRes.reason : '');
  } else if (aiErr) {
    el.typeHint.textContent = 'AI 识别失败：' + aiErr + '（已回退本地规则）';
  }

  if (!state.type) {
    state.busy = false;
    el.scanLayer.hidden = true;
    updateRun();
    toast('AI 也没能确定类型' + (aiErr ? '：' + aiErr : '') + '，请手动选择图片类型');
    return;
  }
  if (!state.styleId) selectStyle(REC[state.type]);

  const steps = [
    '读取像素与直方图…',
    '识别主体与场景元素…',
    '匹配「' + styleById(state.styleId).name + '」参数…',
    '生成 PS 执行清单…'
  ];
  const startPct = hasAI && aiRes ? 45 : 0;
  for (let i = 0; i < steps.length; i++) {
    el.scanTxt.textContent = steps[i];
    el.scanBar.style.width = Math.round(startPct + (i + 1) / steps.length * (100 - startPct)) + '%';
    await sleep(230 + Math.random() * 150);
  }

  state.plan = buildPlan(state.type, styleById(state.styleId), state.m);
  renderResult();

  el.scanLayer.hidden = true;
  state.busy = false;
  updateRun();
  el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function planToText() {
  const st = styleById(state.styleId);
  const lines = [];
  lines.push('影调助手 · PS 修图建议');
  lines.push('图片：' + state.fileName);
  lines.push('类型：' + TYPES[state.type].name + ' ｜ 风格：' + st.name);
  if (state.ai) {
    lines.push('AI 识别：' + TYPES[state.ai.type].name + '（置信 ' + Math.round(state.ai.confidence * 100) + '%）'
      + (state.ai.elements.length ? ' ｜ 元素：' + state.ai.elements.join('、') : ''));
  }
  lines.push('识别：' + state.plan.summary);
  lines.push('');
  lines.push('【执行顺序】');
  state.plan.order.forEach((t, i) => lines.push((i + 1) + '. ' + t));
  state.plan.groups.forEach(function (g) {
    lines.push('');
    lines.push('【' + g.title + '】' + g.path);
    g.items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name);
      lines.push('   参数：' + it.value);
      lines.push('   区域：' + it.area);
      lines.push('   原因：' + it.why);
    });
  });
  lines.push('');
  lines.push('※ 参数为起点区间，请按实际画面微调。');
  return lines.join('\n');
}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#22262e;color:#ffe0a3;' +
    'border:1px solid #3a4049;border-radius:10px;padding:10px 18px;font-size:13px;z-index:99;' +
    'box-shadow:0 12px 30px -12px rgba(0,0,0,.9);transition:opacity .25s ease,transform .25s ease';
  document.body.appendChild(t);
  setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translate(-50%,8px)'; }, 1600);
  setTimeout(function () { t.remove(); }, 2000);
}

/* ---------------- 10. 事件绑定 ---------------- */
function setAIMsg(text, kind) {
  if (!el.aiMsg) return;
  el.aiMsg.textContent = text || '';
  el.aiMsg.className = 'ai-msg' + (kind ? ' ' + kind : '');
}

function refreshAIUI() {
  const cfg = getAIConfig();
  const on = !!cfg;
  el.aiBadge.textContent = on ? 'AI' : '本地';
  el.aiBadge.setAttribute('data-on', on ? '1' : '0');
  const p = on ? (AI_PRESETS[cfg.provider] || {}) : null;
  el.aiState.textContent = on
    ? ((p && p.name) ? p.name : '自定义接口') + ' · ' + cfg.model
    : '本地像素规则 · 暖棕色场景可能判不准';

  if (on) {
    el.aiProvider.value = cfg.provider || 'custom';
    el.aiBase.value = cfg.base;
    el.aiModel.value = cfg.model;
    el.aiKey.value = cfg.key;
    el.aiTip.textContent = (AI_PRESETS[cfg.provider] || {}).tip || '';
  } else {
    const d = AI_PRESETS.ark;
    el.aiProvider.value = 'ark';
    el.aiBase.value = d.base;
    el.aiModel.value = d.model;
    el.aiTip.textContent = d.tip;
  }

  // 隐私提示要跟着走：配置 AI 后图片确实会离开本机
  if (el.privacyPill) {
    el.privacyPill.textContent = on
      ? '📤 已接 AI：识别时图片会发送给你指定的模型服务商'
      : '🔒 默认零上传：图片只在本机解析';
    el.privacyPill.style.borderColor = on ? 'rgba(255,180,84,.34)' : '';
    el.privacyPill.style.color = on ? 'var(--warn)' : '';
  }
}

function bind() {
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('click', e => e.stopPropagation());
  el.dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
  });
  el.fileInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadFile(f);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    el.dropzone.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      el.dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    el.dropzone.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      el.dropzone.classList.remove('dragover');
    });
  });
  el.dropzone.addEventListener('drop', function (e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  window.addEventListener('paste', function (e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        const f = items[i].getAsFile();
        if (f) { loadFile(f); break; }
      }
    }
  });

  el.btnChange.addEventListener('click', function () {
    resetImage();
    el.fileInput.click();
  });

  // 按住看原图
  el.btnCompare.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    el.imgwrap.classList.add('orig');
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
    el.btnCompare.addEventListener(ev, function () { el.imgwrap.classList.remove('orig'); });
  });
  window.addEventListener('pointerup', function () { el.imgwrap.classList.remove('orig'); });
  window.addEventListener('blur', function () { el.imgwrap.classList.remove('orig'); });

  el.typeList.addEventListener('click', function (e) {
    const b = e.target.closest('.type-card');
    if (!b) return;
    state.userPickedType = true;
    selectType(b.dataset.type);
  });

  /* ---- AI 识别配置 ---- */
  el.aiToggle.addEventListener('click', function () {
    const willOpen = el.aiPanel.hidden;
    el.aiPanel.hidden = !willOpen;
    el.aiToggle.setAttribute('aria-expanded', String(willOpen));
    el.aiToggle.textContent = willOpen ? '收起' : '配置 AI';
  });

  el.aiProvider.addEventListener('change', function () {
    const p = AI_PRESETS[el.aiProvider.value] || {};
    el.aiBase.value = p.base || '';
    el.aiModel.value = p.model || '';
    el.aiTip.textContent = p.tip || '';
  });

  el.aiSave.addEventListener('click', async function () {
    const base = el.aiBase.value.trim();
    const model = el.aiModel.value.trim();
    const key = el.aiKey.value.trim();
    if (!base || !model || !key) {
      setAIMsg('Base URL / 模型 / Key 三项都要填', 'bad');
      return;
    }
    try {
      localStorage.setItem(AI_STORE, JSON.stringify({
        provider: el.aiProvider.value, base: base, model: model, key: key
      }));
    } catch (e) {
      setAIMsg('浏览器禁用了本地存储，无法保存', 'bad');
      return;
    }
    refreshAIUI();

    if (!state.img) {
      setAIMsg('已保存。上传照片后点识别即可验证', 'ok');
      return;
    }
    setAIMsg('已保存，正在测试识别…', '');
    el.aiSave.disabled = true;
    try {
      const r = await aiRecognize();
      setAIMsg('测试通过：判为「' + TYPES[r.type].name + '」置信 ' + Math.round(r.confidence * 100) + '%' + (r.elements.length ? ' · 元素：' + r.elements.join('、') : ''), 'ok');
    } catch (e) {
      setAIMsg('测试失败：' + ((e && e.message) || '未知错误'), 'bad');
    } finally {
      el.aiSave.disabled = false;
    }
  });

  el.aiClear.addEventListener('click', function () {
    try { localStorage.removeItem(AI_STORE); } catch (e) { /* 忽略 */ }
    el.aiKey.value = '';
    refreshAIUI();
    setAIMsg('已清除，回到本地规则判断', '');
  });

  el.filterTabs.addEventListener('click', function (e) {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.tab = b.dataset.tab;
    renderTabs();
    renderStyles();
  });

  el.styleList.addEventListener('click', function (e) {
    const b = e.target.closest('.style-card');
    if (b) selectStyle(b.dataset.id);
  });

  el.btnRun.addEventListener('click', run);

  el.btnCopy.addEventListener('click', async function () {
    if (!state.plan) return;
    const text = planToText();
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制全部建议');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('已复制全部建议'); }
      catch (e2) { toast('复制失败，请手动选择文本'); }
      ta.remove();
    }
  });

  el.btnDownload.addEventListener('click', function () {
    if (!state.plan) return;
    const text = planToText();
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '修图建议_' + TYPES[state.type].name + '_' + styleById(state.styleId).name + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('已下载建议文件');
  });

  el.btnRestart.addEventListener('click', function () {
    const sec = $('.panel-control');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ---------------- 11. 启动 ---------------- */
renderTypes();
renderTabs();
renderStyles();
bind();
refreshAIUI();
updateRun();
