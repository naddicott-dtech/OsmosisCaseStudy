import { useEffect, useRef } from 'preact/hooks';
import type { Status } from '../engine/physiology';
import { MODEL } from '../engine/physiology';
import { saved, setAnswer } from '../state';

// ---------- Pressure gauge ----------

const GAUGE_MAX = 60;

export function PressureGauge({ icp }: { icp: number }) {
  const v = Math.max(0, Math.min(GAUGE_MAX, icp));
  const angle = -90 + (v / GAUGE_MAX) * 180;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / GAUGE_MAX);
    const a1 = Math.PI * (1 - to / GAUGE_MAX);
    const p = (a: number) => `${100 + 80 * Math.cos(a)} ${100 - 80 * Math.sin(a)}`;
    return `M ${p(a0)} A 80 80 0 0 1 ${p(a1)}`;
  };
  const zone = icp > MODEL.seizeAboveICP ? 'Seizure zone' : icp > 15 ? 'Elevated' : 'Normal';
  return (
    <figure class="gauge" role="meter" aria-valuemin={0} aria-valuemax={GAUGE_MAX} aria-valuenow={Math.round(icp)}
      aria-valuetext={`${icp.toFixed(0)} millimeters of mercury, ${zone}`} aria-label="Pressure inside the skull">
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <path d={arc(0, 15)} class="zone-ok" />
        <path d={arc(15, MODEL.seizeAboveICP)} class="zone-warn" />
        <path d={arc(MODEL.seizeAboveICP, GAUGE_MAX)} class="zone-bad" />
        <g transform={`rotate(${angle} 100 100)`} class="needle">
          <line x1="100" y1="100" x2="100" y2="30" />
          <circle cx="100" cy="100" r="6" />
        </g>
      </svg>
      <figcaption>
        <strong>{icp.toFixed(0)} mmHg</strong>
        <span class={`tag tag-${zone === 'Normal' ? 'ok' : zone === 'Elevated' ? 'warn' : 'bad'}`}>{zone}</span>
        <small>Pressure inside skull</small>
      </figcaption>
    </figure>
  );
}

// ---------- Simple labelled readout ----------

export function Readout({ label, value, unit, note, tone }: { label: string; value: string; unit: string; note?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div class={`readout ${tone ? `readout-${tone}` : ''}`}>
      <span class="readout-label">{label}</span>
      <span class="readout-value">
        {value} <small>{unit}</small>
      </span>
      {note && <span class="readout-note">{note}</span>}
    </div>
  );
}

export function naTone(na: number): 'ok' | 'warn' | 'bad' {
  return na < 120 ? 'bad' : na < 134 ? 'warn' : 'ok';
}

// ---------- Brain activity trace (no flashing; smooth scroll) ----------

export function ActivityTrace({ status, reduceMotion }: { status: Status; reduceMotion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 480;
    const H = 90;
    const buf: number[] = new Array(W).fill(H / 2);
    let t = 0;
    let raf = 0;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    const sample = () => {
      const s = statusRef.current;
      t += 1;
      if (s === 'seizing' || s === 'critical') {
        const amp = s === 'critical' ? 34 : 28;
        // Spike-and-wave pattern.
        const phase = (t % 22) / 22;
        const spike = phase < 0.12 ? -amp * Math.sin((phase / 0.12) * Math.PI) : amp * 0.45 * Math.sin(((phase - 0.12) / 0.88) * Math.PI);
        return H / 2 + spike + rand() * 6;
      }
      return H / 2 + 6 * Math.sin(t / 3.1) + 4 * Math.sin(t / 1.7) + rand() * 5;
    };
    const draw = () => {
      const css = getComputedStyle(canvas);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = css.getPropertyValue('--grid').trim() || '#ccc';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.strokeStyle = css.getPropertyValue('--trace').trim() || '#236';
      ctx.lineWidth = 2;
      ctx.beginPath();
      buf.forEach((y, x) => (x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    if (reduceMotion) {
      for (let i = 0; i < W; i++) buf[i] = sample();
      draw();
      return;
    }
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 33) return;
      last = now;
      for (let i = 0; i < 3; i++) {
        buf.shift();
        buf.push(sample());
      }
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, reduceMotion ? status : null]);
  const desc = status === 'seizing' || status === 'critical'
    ? 'Brain activity: large, rhythmic spikes — seizure activity.'
    : 'Brain activity: small, irregular waves — normal activity.';
  return (
    <figure class="trace">
      <canvas ref={ref} width={480} height={90} role="img" aria-label={desc} />
      <figcaption>{desc}</figcaption>
    </figure>
  );
}

// ---------- Line chart (SVG) ----------

export interface Series {
  label: string;
  points: [number, number][];
  cls: string;
}

export function LineChart({ series, yMin, yMax, xMax, yLabel, bands, title }: {
  series: Series[];
  yMin: number;
  yMax: number;
  xMax: number;
  yLabel: string;
  title: string;
  bands?: { from: number; to: number; cls: string; label: string }[];
}) {
  const W = 320;
  const H = 140;
  const L = 38;
  const B = 22;
  const sx = (x: number) => L + (x / xMax) * (W - L - 8);
  const sy = (y: number) => H - B - ((Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin)) * (H - B - 8);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const tickMin = xMax <= 480 ? 60 : 360;
  const last = series[0]?.points.at(-1);
  return (
    <figure class="chart">
      <figcaption>{title} <small class="muted">({yLabel})</small></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${title}. ${last ? `Latest value ${last[1].toFixed(1)} ${yLabel} at ${(last[0] / 60).toFixed(1)} hours.` : 'No data yet.'}`}>
        {bands?.map((b) => (
          <g key={b.label}>
            <rect x={L} width={W - L - 8} y={sy(b.to)} height={Math.max(0, sy(b.from) - sy(b.to))} class={b.cls} />
            <text x={W - 10} y={sy(b.to) + 11} text-anchor="end" class="band-label">{b.label}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 8} y1={sy(t)} y2={sy(t)} class="gridline" />
            <text x={L - 4} y={sy(t) + 4} text-anchor="end" class="axis">{t.toFixed(0)}</text>
          </g>
        ))}
        {Array.from({ length: Math.floor(xMax / tickMin) + 1 }, (_, i) => (
          <text key={i} x={sx(i * tickMin)} y={H - 6} text-anchor="middle" class="axis">{(i * tickMin) / 60}h</text>
        ))}
        {series.map((s) => (
          <polyline key={s.label} class={s.cls} fill="none"
            points={s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')} />
        ))}
      </svg>
    </figure>
  );
}

// ---------- Written prompt bound to saved answers ----------

export function Prompt({ id, label, minChars = 0, rows = 3, tag }: { id: string; label: string; minChars?: number; rows?: number; tag?: string }) {
  const value = saved.value.answers[id] ?? '';
  const short = minChars > 0 && value.trim().length < minChars;
  return (
    <div class="prompt">
      <label for={`q-${id}`}>
        {tag && <span class={`purpose purpose-${tag.toLowerCase()}`}>{tag}</span>} {label}
      </label>
      <textarea id={`q-${id}`} rows={rows} value={value}
        onInput={(e) => setAnswer(id, (e.target as HTMLTextAreaElement).value)} />
      {minChars > 0 && (
        <small class={short ? 'hint' : 'hint ok'} aria-live="polite">
          {short ? `Write at least a full sentence (${value.trim().length}/${minChars} characters).` : 'Saved on this device ✓'}
        </small>
      )}
    </div>
  );
}

export function answered(id: string, minChars = 20): boolean {
  return (saved.value.answers[id] ?? '').trim().length >= minChars;
}

// ---------- Flag selector (Low / Normal / High) ----------

export function FlagPicker({ id, value, onChange, correct, label }: {
  id: string;
  label: string;
  value: 'low' | 'normal' | 'high' | undefined;
  onChange: (v: 'low' | 'normal' | 'high') => void;
  correct?: boolean | null;
}) {
  return (
    <div class="flagpicker" role="radiogroup" aria-label={`${label}: flag as low, normal, or high`}>
      {(['low', 'normal', 'high'] as const).map((f) => (
        <button type="button" key={f} role="radio" aria-checked={value === f} id={`${id}-${f}`}
          class={`flag flag-${f} ${value === f ? 'on' : ''}`} onClick={() => onChange(f)}>
          {f === 'low' ? '↓ Low' : f === 'high' ? '↑ High' : 'Normal'}
        </button>
      ))}
      {correct === true && <span class="mark ok" aria-label="correct">✓</span>}
      {correct === false && <span class="mark bad" aria-label="check again">✗</span>}
    </div>
  );
}
