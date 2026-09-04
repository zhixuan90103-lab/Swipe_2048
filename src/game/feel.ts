export type FeelScheme = 1 | 2;
export type FeelMode = 'merge' | 'solo';

/** 整段位移曲线。时长仍是 格数 × slideMs */
export type SlideEase = 'out' | 'soft' | 'linear';

export const SLIDE_EASE_CSS: Record<SlideEase, string> = {
  out: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  soft: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
  linear: 'linear',
};

export const SLIDE_EASE_OPTIONS: { id: SlideEase; label: string }[] = [
  { id: 'out', label: '先快后慢' },
  { id: 'soft', label: '更柔' },
  { id: 'linear', label: '匀速' },
];

type FieldSpec = {
  key: string;
  label: string;
  why: string;
  kind: 'range' | 'check' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

/** 手感1：距离出手（涂色）。不含甩动门槛。 */
export type Feel1 = {
  scheme: 1;
  slopPx: number;
  commitPx: number;
  axisRatio: number;
  tileMoveMs: number;
  appearMs: number;
  inputLockMs: number;
  rearmMs: number;
  nudgePx: number;
  nudgeMs: number;
  sameDirRepeat: boolean;
  boardY: number;
  boardScale: number;
};

/** 手感2：甩动（2048）。每次按下只一步。 */
export type Feel2 = {
  scheme: 2;
  slopPx: number;
  commitPx: number;
  speedPxS: number;
  axisRatio: number;
  slideMs: number;
  slideEase: SlideEase;
  appearMs: number;
  mergePopMs: number;
  inputLockMs: number;
  rearmMs: number;
  nudgePx: number;
  nudgeMs: number;
  boardY: number;
  boardScale: number;
};

export type Feel = Feel1 | Feel2;

export const FEEL1_DEFAULT: Feel1 = {
  scheme: 1,
  slopPx: 10,
  commitPx: 16,
  axisRatio: 1.55,
  tileMoveMs: 60,
  appearMs: 200,
  inputLockMs: 10,
  rearmMs: 10,
  nudgePx: 5,
  nudgeMs: 350,
  sameDirRepeat: false,
  boardY: 0,
  boardScale: 1.1,
};

export const FEEL2_DEFAULT: Feel2 = {
  scheme: 2,
  slopPx: 10,
  commitPx: 30,
  speedPxS: 200,
  axisRatio: 1.55,
  slideMs: 65,
  slideEase: 'soft',
  appearMs: 250,
  mergePopMs: 200,
  inputLockMs: 0,
  rearmMs: 0,
  nudgePx: 5,
  nudgeMs: 350,
  boardY: 0,
  boardScale: 1.1,
};

/** @deprecated 用 FEEL1_DEFAULT */
export const FEEL_DEFAULT: Feel1 = FEEL1_DEFAULT;

export const FEEL1_FIELDS: FieldSpec[] = [
  {
    key: 'slopPx',
    label: '点按死区',
    why: '手指移动少于此值，当成点按，不开始识别滑动。',
    kind: 'range',
    min: 0,
    max: 24,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'commitPx',
    label: '出手距离',
    why: '沿已锁轴走到此值走棋。慢但方向清楚也会走。',
    kind: 'range',
    min: 8,
    max: 80,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'axisRatio',
    label: '主轴/副轴倍数',
    why: '主轴必须明显长于副轴才锁方向。越大越准、斜滑越不下棋。',
    kind: 'range',
    min: 1,
    max: 2,
    step: 0.05,
    unit: '倍',
  },
  {
    key: 'tileMoveMs',
    label: '每格用时',
    why: '单块：穿过 1 格的毫秒，走几格就 × 几（匀速）。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms/格',
  },
  {
    key: 'appearMs',
    label: '出现时长',
    why: '新块从约半格长到满格。',
    kind: 'range',
    min: 40,
    max: 500,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'inputLockMs',
    label: '输入锁时长',
    why: '方块滑到位之后再隔这么久才接下一段。锁定期的手指位移不算进下一段。',
    kind: 'range',
    min: 0,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'rearmMs',
    label: '转向再出手续等',
    why: '输入锁结束后，按住换方向再出手还要再等这么久。0=锁一开就能转向。',
    kind: 'range',
    min: 0,
    max: 300,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'nudgePx',
    label: '无效回弹幅度',
    why: '不能走时棋盘沿该次滑动方向顶出去再弹回的距离。',
    kind: 'range',
    min: 0,
    max: 16,
    step: 1,
    unit: 'px',
  },
  {
    key: 'nudgeMs',
    label: '无效回弹时长',
    why: '沿滑动方向回弹整段时间。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'sameDirRepeat',
    label: '同向按住连走',
    why: '打开后：不松手、同一方向继续拖，会再走一步。关闭则必须转向或抬手。',
    kind: 'check',
  },
  {
    key: 'boardY',
    label: '棋盘上下',
    why: '正数把棋盘往下移，负数往上。只动棋盘，标题和分数不动。',
    kind: 'range',
    min: -80,
    max: 160,
    step: 2,
    unit: '设计px',
  },
  {
    key: 'boardScale',
    label: '棋盘大小',
    why: '整体放大或缩小棋盘。1 为原先尺寸，1.1 大约大一成。',
    kind: 'range',
    min: 0.9,
    max: 1.2,
    step: 0.02,
    unit: '倍',
  },
];

export const FEEL2_FIELDS: FieldSpec[] = [
  {
    key: 'slopPx',
    label: '点按死区',
    why: '手指移动少于此值，当成点按，不开始识别滑动。',
    kind: 'range',
    min: 0,
    max: 24,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'commitPx',
    label: '出手距离',
    why: '沿轴走到此值且窗速度够才走棋。默认 30。慢滑再远也不走。',
    kind: 'range',
    min: 8,
    max: 80,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'speedPxS',
    label: '出手速度',
    why: '最近约 80ms 沿锁轴的速度。低于此值再远也不走。',
    kind: 'range',
    min: 80,
    max: 1200,
    step: 20,
    unit: 'px/秒',
  },
  {
    key: 'axisRatio',
    label: '主轴/副轴倍数',
    why: '主轴必须明显长于副轴才锁方向。越大越准、斜滑越不下棋。',
    kind: 'range',
    min: 1,
    max: 2,
    step: 0.05,
    unit: '倍',
  },
  {
    key: 'slideMs',
    label: '每格滑移',
    why: '穿过 1 格的时间。走 3 格约 3 倍时长。默认 65ms/格。',
    kind: 'range',
    min: 20,
    max: 200,
    step: 5,
    unit: 'ms/格',
  },
  {
    key: 'slideEase',
    label: '滑移曲线',
    why: '作用在整段路程上：走 3 格也是一条曲线，不是一格一段。',
    kind: 'choice',
  },
  {
    key: 'appearMs',
    label: '出现时长',
    why: '新块从约半格长到满格。等走得最远的那块到位后再开始。',
    kind: 'range',
    min: 40,
    max: 500,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'mergePopMs',
    label: '合并弹时长',
    why: '合成块放大再收回的时间。0 则不弹。',
    kind: 'range',
    min: 0,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'inputLockMs',
    label: '输入锁时长',
    why: '方块滑到位之后再隔这么久才接下一段。',
    kind: 'range',
    min: 0,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'rearmMs',
    label: '转向再出手续等',
    why: '输入锁结束后，按住换方向再出手还要再等这么久。',
    kind: 'range',
    min: 0,
    max: 300,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'nudgePx',
    label: '无效回弹幅度',
    why: '不能走时棋盘沿该次滑动方向顶出去再弹回的距离。',
    kind: 'range',
    min: 0,
    max: 16,
    step: 1,
    unit: 'px',
  },
  {
    key: 'nudgeMs',
    label: '无效回弹时长',
    why: '沿滑动方向回弹整段时间。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'boardY',
    label: '棋盘上下',
    why: '正数把棋盘往下移，负数往上。只动棋盘，标题和分数不动。',
    kind: 'range',
    min: -80,
    max: 160,
    step: 2,
    unit: '设计px',
  },
  {
    key: 'boardScale',
    label: '棋盘大小',
    why: '整体放大或缩小棋盘。1 为原先尺寸，1.1 大约大一成。',
    kind: 'range',
    min: 0.9,
    max: 1.2,
    step: 0.02,
    unit: '倍',
  },
];

export function fieldsFor(mode: FeelMode): FieldSpec[] {
  return mode === 'solo' ? FEEL1_FIELDS : FEEL2_FIELDS;
}

export function defaultFeelForMode(mode: FeelMode): Feel {
  return mode === 'solo' ? { ...FEEL1_DEFAULT } : { ...FEEL2_DEFAULT };
}

function clampNum(v: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(v);
  const x = Number.isFinite(n) ? n : fallback;
  return Math.min(max ?? x, Math.max(min ?? x, x));
}

function clampFeel1(raw: Record<string, unknown>): Feel1 {
  const d = FEEL1_DEFAULT;
  const next: Feel1 = { ...d };
  for (const f of FEEL1_FIELDS) {
    if (f.kind === 'check') {
      if (f.key === 'sameDirRepeat') next.sameDirRepeat = Boolean(raw.sameDirRepeat);
      continue;
    }
    if (f.kind !== 'range') continue;
    const k = f.key as Exclude<keyof Feel1, 'scheme' | 'sameDirRepeat'>;
    next[k] = clampNum(raw[k], d[k], f.min, f.max) as never;
  }
  next.scheme = 1;
  return next;
}

function clampFeel2(raw: Record<string, unknown>): Feel2 {
  const d = FEEL2_DEFAULT;
  const next: Feel2 = { ...d };
  for (const f of FEEL2_FIELDS) {
    if (f.kind === 'choice') {
      const e = raw.slideEase;
      next.slideEase = e === 'soft' || e === 'linear' || e === 'out' ? e : d.slideEase;
      continue;
    }
    if (f.kind !== 'range') continue;
    const k = f.key as Exclude<keyof Feel2, 'scheme' | 'slideEase'>;
    next[k] = clampNum(raw[k], d[k], f.min, f.max) as never;
  }
  next.scheme = 2;
  return next;
}

export function clampFeelFor(mode: FeelMode, raw: unknown): Feel {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return mode === 'solo' ? clampFeel1(rec) : clampFeel2(rec);
}

const KEY = 'swipe2048.feel';
const KEY_BY_MODE = 'swipe2048.feel.byMode';

function readFeelMap(): Partial<Record<FeelMode, unknown>> {
  try {
    const raw = localStorage.getItem(KEY_BY_MODE);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<FeelMode, unknown>>;
  } catch {
    return {};
  }
}

export function loadFeelFor(mode: FeelMode): Feel {
  const slot = readFeelMap()[mode];
  if (slot) return clampFeelFor(mode, slot);
  return defaultFeelForMode(mode);
}

export function saveFeelFor(mode: FeelMode, feel: Feel): void {
  const map = readFeelMap();
  map[mode] = clampFeelFor(mode, feel);
  localStorage.setItem(KEY_BY_MODE, JSON.stringify(map));
  localStorage.setItem(KEY, JSON.stringify(feel));
}

export function isFeel2(feel: Feel): feel is Feel2 {
  return feel.scheme === 2;
}

export function isFeel1(feel: Feel): feel is Feel1 {
  return feel.scheme === 1;
}

export function applyFeelCss(feel: Feel, root: HTMLElement = document.documentElement): void {
  const tileMs = feel.scheme === 1 ? feel.tileMoveMs : 70;
  const popMs = feel.scheme === 2 ? feel.mergePopMs : 120;
  root.style.setProperty('--g-tile-ms', `${tileMs}ms`);
  root.style.setProperty('--g-appear-ms', `${feel.appearMs}ms`);
  root.style.setProperty('--g-pop-ms', `${popMs}ms`);
  root.style.setProperty('--g-nudge-ms', `${feel.nudgeMs}ms`);
  root.style.setProperty('--g-nudge-px', `${feel.nudgePx}px`);
  root.style.setProperty('--g-board-y', `${feel.boardY}px`);
  const s = feel.boardScale;
  root.style.setProperty('--g-cell', `${72 * s}px`);
  root.style.setProperty('--g-gap', `${8 * s}px`);
  root.style.setProperty('--g-board', `${(4 * 72 + 5 * 8) * s}px`);
  root.style.setProperty('--g-tile-font', `${37 * s}px`);
}
