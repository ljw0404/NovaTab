import { useEffect, useRef } from 'react';
import { useSettings } from '@/stores/settings';

type Blob = {
  baseX: number;
  baseY: number;
  ax: number;
  ay: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  radius: number;
  paletteIdx: number;
  breathFreq: number;
  breathPhase: number;
};

type RGB = readonly [number, number, number];

const PALETTES: RGB[][] = [
  [
    [255, 99, 132],
    [255, 159, 64],
    [180, 162, 255],
    [120, 200, 255],
    [255, 138, 168],
    [180, 220, 255],
    [255, 200, 220],
  ],
  [
    [109, 40, 217],
    [30, 64, 175],
    [14, 116, 144],
    [219, 39, 119],
    [76, 29, 149],
    [37, 99, 235],
    [190, 24, 93],
  ],
  [
    [16, 185, 129],
    [59, 130, 246],
    [139, 92, 246],
    [236, 72, 153],
    [251, 191, 36],
    [34, 211, 238],
    [167, 139, 250],
  ],
  [
    [99, 102, 241],
    [217, 70, 239],
    [244, 63, 94],
    [251, 146, 60],
    [250, 204, 21],
    [129, 140, 248],
    [232, 121, 249],
  ],
  [
    [56, 189, 248],
    [129, 140, 248],
    [232, 121, 249],
    [251, 113, 133],
    [134, 239, 172],
    [253, 186, 116],
    [196, 181, 253],
  ],
];

const PALETTE_CYCLE_MS = 20000;
const BREATHE_PERIOD_MS = 14000;
const BLOB_COUNT = 7;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return [255, 255, 255];
}

function makeBlobs(width: number, height: number): Blob[] {
  const anchors: [number, number][] = [
    [0.18, 0.22],
    [0.78, 0.18],
    [0.5, 0.42],
    [0.12, 0.78],
    [0.85, 0.72],
    [0.5, 0.92],
    [0.28, 0.5],
  ];
  return anchors.slice(0, BLOB_COUNT).map(([fx, fy], i) => ({
    baseX: width * fx,
    baseY: height * fy,
    ax: width * (0.1 + Math.random() * 0.08),
    ay: height * (0.1 + Math.random() * 0.08),
    freqX: 0.00008 + Math.random() * 0.00007,
    freqY: 0.00007 + Math.random() * 0.00006,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    radius: Math.max(width, height) * (0.34 + Math.random() * 0.12),
    paletteIdx: i,
    breathFreq: 0.00018 + Math.random() * 0.00012,
    breathPhase: Math.random() * Math.PI * 2,
  }));
}

export function MeshGradientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const themeRef = useRef(useSettings.getState().theme);
  const customColorsRef = useRef<string[]>(useSettings.getState().customColors);

  useEffect(() => {
    return useSettings.subscribe(s => {
      themeRef.current = s.theme;
      customColorsRef.current = s.customColors;
    });
  }, []);

  // Plain useEffect (not useLayoutEffect) so mounting the canvas does NOT
  // block the first paint of the page content above it. The body has a
  // static gradient fallback in globals.css that covers the first frame;
  // once this effect runs we kick off the rAF loop and the animated
  // gradient takes over invisibly. This was the single biggest cause of
  // initial-load jank on the new tab page.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let blobs: Blob[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blobs = makeBlobs(w, h);
    };

    // Cap to ~30fps. The whole animation is a slow breathing cycle (14s) +
    // a 20s palette crossfade — neither benefits from 60fps. Halving the
    // frame rate halves the GPU cost (7 radial gradients + saturate +
    // backdrop-blur compositing).
    const FRAME_MS = 1000 / 30;
    let lastFrame = 0;

    const draw = (t: number) => {
      if (t - lastFrame < FRAME_MS) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrame = t;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isDark =
        themeRef.current === 'dark' ||
        (themeRef.current === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);

      // Global breathing: pronounced opacity + size pulse.
      const breathT = ((t % BREATHE_PERIOD_MS) / BREATHE_PERIOD_MS) * Math.PI * 2;
      const breathSin = Math.sin(breathT); // -1..1
      const globalAlpha = 0.78 + breathSin * 0.22; // 0.56..1.00
      const globalScale = 0.97 + breathSin * 0.08; // 0.89..1.05

      // Determine palette: user-customized colors override the cycling palette.
      const custom = customColorsRef.current;
      const useCustom = custom.length > 0;

      let paletteA: RGB[];
      let paletteB: RGB[];
      let pMix = 0;
      if (useCustom) {
        const rgbs = custom.map(hexToRgb);
        paletteA = rgbs;
        paletteB = rgbs;
      } else {
        const cycleT = (t % PALETTE_CYCLE_MS) / PALETTE_CYCLE_MS;
        const pCount = PALETTES.length;
        const pFloat = cycleT * pCount;
        const pIdx = Math.floor(pFloat) % pCount;
        const pNext = (pIdx + 1) % pCount;
        pMix = pFloat - Math.floor(pFloat);
        paletteA = PALETTES[pIdx];
        paletteB = PALETTES[pNext];
      }

      ctx.fillStyle = isDark ? '#08080d' : '#0e1428';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';

      for (const b of blobs) {
        const x = b.baseX + Math.sin(t * b.freqX + b.phaseX) * b.ax;
        const y = b.baseY + Math.cos(t * b.freqY + b.phaseY) * b.ay;

        // Per-blob breathing — each blob pulses on its own phase for organic feel.
        const blobBreath = Math.sin(t * b.breathFreq + b.breathPhase);
        const indivScale = 0.92 + blobBreath * 0.12;

        const color = useCustom
          ? paletteA[b.paletteIdx % paletteA.length]
          : lerpColor(
              paletteA[b.paletteIdx % paletteA.length],
              paletteB[b.paletteIdx % paletteB.length],
              pMix
            );

        const radius = b.radius * globalScale * indivScale;
        const alpha = (isDark ? 0.5 : 0.58) * globalAlpha;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(
          0,
          `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
        );
        grad.addColorStop(
          1,
          `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`
        );
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      if (visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(rafRef.current);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    // Schedule the first frame via rAF instead of drawing synchronously.
    // The browser commits its first paint of the page content first; the
    // canvas fills in on the next frame (~16ms later) on top of the CSS
    // gradient fallback so there's no perceptible black flash.
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
