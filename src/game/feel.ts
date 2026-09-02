export type FeelScheme = 1 | 2;

/** 整段位移曲线。时长仍是 格数 × slideMs */
export type SlideEase = 'out' | 'soft' | 'linear';

export const SLIDE_EASE_CSS: Record<SlideEase, string> = {
  /** 先快后慢，比 expo 收着，避免前半段甩完 */
  out: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  soft: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
  linear: 'linear',
};

export const SLIDE_EASE_OPTIONS: { id: SlideEase; label: string }[] = [
  { id: 'out', label: '先快后慢' },
  { id: 'soft', label: '更柔' },
  { id: 'linear', label: '匀速' },
];

export type Feel = {
  /** 1 = 距离出手（当前）；2 = 速度门槛 + 短距 */
  scheme: FeelScheme;
  /** 按下后位移小过此值（设计 px）→ 当点按，不算滑 */
  slopPx: number;
  /** 主方向位移达到此值（设计 px）才出手走棋 */
  commitPx: number;
  /** 手感2：瞬时速度达到此值（设计 px/秒）才允许出手 */
  speedPxS: number;
  /** 主轴长度必须 ≥ 副轴 × 此倍数，否则太斜、不出手 */
  axisRatio: number;
  /** 单块：穿过 1 格的毫秒 */
  tileMoveMs: number;
  /** 2048：穿过 1 格的毫秒。走得远越晚到 */
  slideMs: number;
  /** 2048：整段滑移曲线 */
  slideEase: SlideEase;
  /** 新块从小到大的时长（毫秒），滑移结束后开始 */
  appearMs: number;
  /** 2048 合并到位后轻微放大收回的时长（毫秒） */
  mergePopMs: number;
  /** 走棋后多久内不再接受下一手（毫秒）。只改输入锁 */
  inputLockMs: number;
  /** 锁解开后，按住转向再出手还要再等多少毫秒 */
  rearmMs: number;
  /** 无效滑时沿该次方向顶出去的距离（设计 px） */
  nudgePx: number;
  /** 无效回弹整段时长（毫秒） */
  nudgeMs: number;
  /** 按住不抬、同一方向继续拖，是否再走一步 */
  sameDirRepeat: boolean;
  /** 棋盘相对当前布局再往下移多少（设计 px，负数为上） */
  boardY: number;
  /** 棋盘整体缩放（1 = 原尺寸 328px） */
  boardScale: number;
};

export const FEEL_DEFAULT: Feel = {
  scheme: 1,
  slopPx: 10,
  commitPx: 16,
  speedPxS: 400,
  axisRatio: 1.55,
  tileMoveMs: 60,
  slideMs: 70,
  slideEase: 'soft',
  appearMs: 200,
  mergePopMs: 120,
  inputLockMs: 10,
  rearmMs: 10,
  nudgePx: 5,
  nudgeMs: 350,
  sameDirRepeat: false,
  boardY: 0,
  boardScale: 1.1,
};

/** 手感2：慢滑再远也不走；够快时约半格量级可出手 */
export const FEEL2_DEFAULT: Feel = {
  ...FEEL_DEFAULT,
  scheme: 2,
  commitPx: 30,
  speedPxS: 200,
  tileMoveMs: 70,
  slideMs: 70,
  appearMs: 250,
  mergePopMs: 200,
  inputLockMs: 50,
  rearmMs: 0,
};

const KEY = 'swipe2048.feel';
const KEY_BY_MODE = 'swipe2048.feel.byMode';

export type FeelMode = 'merge' | 'solo';

export const FEEL_FIELDS: {
  key: keyof Feel;
  label: string;
  why: string;
  kind: 'range' | 'check' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  schemes?: FeelScheme[];
  /** 不写则两模式都显示 */
  modes?: FeelMode[];
}[] = [
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
    why: '手感1：沿已锁轴走到此值走棋。手感2：还要同时够快；默认 30。',
    kind: 'range',
    min: 8,
    max: 80,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'speedPxS',
    label: '出手速度',
    why: '手感2专用。看最近约 80ms 沿锁轴的速度，不是单帧、不是抬手。低于此值再远也不走。',
    kind: 'range',
    min: 80,
    max: 1200,
    step: 20,
    unit: 'px/秒',
    schemes: [2],
  },
  {
    key: 'axisRatio',
    label: '主轴/副轴倍数',
    why: '主轴必须明显长于副轴才锁方向。越大越准、斜滑越不下棋。看清后由出手距离决定滑多远。',
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
    modes: ['solo'],
  },
  {
    key: 'slideMs',
    label: '每格滑移',
    why: '穿过 1 格的时间。走 3 格约 3 倍时长，比走 2 格晚到。默认 70ms/格。',
    kind: 'range',
    min: 20,
    max: 200,
    step: 5,
    unit: 'ms/格',
    modes: ['merge'],
  },
  {
    key: 'slideEase',
    label: '滑移曲线',
    why: '作用在整段路程上：走 3 格也是一条曲线，不是一格一段。',
    kind: 'choice',
    modes: ['merge'],
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
    why: '合成块放大再收回的时间，峰值跟该块自己快到格时对齐。0 则不弹。',
    kind: 'range',
    min: 0,
    max: 400,
    step: 10,
    unit: 'ms',
    modes: ['merge'],
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
    why: '不能走时棋盘沿该次滑动方向顶出去再弹回的距离。左滑只有左右，没有上下晃。',
    kind: 'range',
    min: 0,
    max: 16,
    step: 1,
    unit: 'px',
  },
  {
    key: 'nudgeMs',
    label: '无效回弹时长',
    why: '沿滑动方向回弹整段时间。前半快、后半慢，幅度先大后小。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'sameDirRepeat',
    label: '同向按住连走',
    why: '打开后：不松手、同一方向继续拖，会再走一步。关闭则必须转向或抬手。手感2 每次按下只走一步，此项无效。',
    kind: 'check',
    schemes: [1],
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

export function defaultsFor(scheme: FeelScheme): Feel {
  return scheme === 2 ? { ...FEEL2_DEFAULT } : { ...FEEL_DEFAULT };
}

function clampFeel(raw: Partial<Feel>): Feel {
  const scheme: FeelScheme = raw.scheme === 2 ? 2 : 1;
  const next = { ...defaultsFor(scheme), ...raw, scheme };
  for (const f of FEEL_FIELDS) {
    if (f.kind !== 'range') continue;
    const k = f.key as Exclude<keyof Feel, 'sameDirRepeat' | 'scheme' | 'slideEase'>;
    const n = Number(next[k]);
    const v = Number.isFinite(n) ? n : (defaultsFor(scheme)[k] as number);
    next[k] = Math.min(f.max ?? v, Math.max(f.min ?? v, v)) as never;
  }
  next.sameDirRepeat = Boolean(next.sameDirRepeat);
  next.scheme = scheme;
  next.slideEase =
    next.slideEase === 'soft' || next.slideEase === 'linear' ? next.slideEase : 'out';
  return next;
}

export function loadFeel(): Feel {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FEEL_DEFAULT };
    return clampFeel(JSON.parse(raw) as Partial<Feel>);
  } catch {
    return { ...FEEL_DEFAULT };
  }
}

export function saveFeel(feel: Feel): void {
  localStorage.setItem(KEY, JSON.stringify(feel));
}

export function defaultFeelForMode(mode: FeelMode): Feel {
  return mode === 'solo' ? { ...FEEL_DEFAULT } : { ...FEEL2_DEFAULT };
}

function readFeelMap(): Partial<Record<FeelMode, Feel>> {
  try {
    const raw = localStorage.getItem(KEY_BY_MODE);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<FeelMode, Feel>>;
  } catch {
    return {};
  }
}

export function loadFeelFor(mode: FeelMode): Feel {
  const slot = readFeelMap()[mode];
  if (slot) return clampFeel(slot);
  return defaultFeelForMode(mode);
}

export function saveFeelFor(mode: FeelMode, feel: Feel): void {
  const map = readFeelMap();
  map[mode] = clampFeel(feel);
  localStorage.setItem(KEY_BY_MODE, JSON.stringify(map));
  saveFeel(feel);
}

export function applyFeelCss(feel: Feel, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--g-tile-ms', `${feel.tileMoveMs}ms`);
  root.style.setProperty('--g-appear-ms', `${feel.appearMs}ms`);
  root.style.setProperty('--g-pop-ms', `${feel.mergePopMs}ms`);
  root.style.setProperty('--g-nudge-ms', `${feel.nudgeMs}ms`);
  root.style.setProperty('--g-nudge-px', `${feel.nudgePx}px`);
  root.style.setProperty('--g-board-y', `${feel.boardY}px`);
  const s = feel.boardScale;
  root.style.setProperty('--g-cell', `${72 * s}px`);
  root.style.setProperty('--g-gap', `${8 * s}px`);
  root.style.setProperty('--g-board', `${(4 * 72 + 5 * 8) * s}px`);
  root.style.setProperty('--g-tile-font', `${37 * s}px`);
}
