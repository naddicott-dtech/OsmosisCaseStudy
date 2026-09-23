import { useEffect, useState } from 'preact/hooks';
import type { Status } from '../engine/physiology';

// Calf illustration. Pose follows patient status:
// seizing/critical → lying on her side; stable → lying upright, head up; healthy → standing.

export interface IVState {
  /** Short fluid label printed on the bag. */
  label: string;
  /** Fraction of the bag still left (0–1). */
  remaining: number;
  /** Fluid is currently running. */
  running: boolean;
  /** Tint for the bag contents. */
  tint: string;
}

interface Props {
  status: Status;
  reduceMotion: boolean;
  iv?: IVState | null;
}

/** Where an IV catheter goes (jugular vein on the neck), per pose, in the 400×260 viewBox. */
// From art/calf-anchors.json (1200×780 px) divided by 3.
export const NECK_ANCHOR: Record<'side' | 'sternal' | 'standing', [number, number]> = {
  side: [126.5, 185.2],
  sternal: [126.6, 165.6],
  standing: [125.3, 107.1],
};

export function poseFor(status: Status): 'side' | 'sternal' | 'standing' {
  return status === 'seizing' || status === 'critical' ? 'side' : status === 'stable' ? 'sternal' : 'standing';
}

/** IV pole, bag, drip chamber and line to the neck. Drawn over the calf. */
export function IVLine({ iv, neck, reduceMotion }: { iv: IVState; neck: [number, number]; reduceMotion: boolean }) {
  const poleX = 362;
  const bagTop = 58;
  const bagH = 56;
  const fillH = Math.max(0, Math.min(1, iv.remaining)) * (bagH - 8);
  const [nx, ny] = neck;
  const dripY = bagTop + bagH + 16;
  return (
    <g class="iv" aria-hidden="true">
      <line x1={poleX} y1={46} x2={poleX} y2={236} stroke="#8a9299" stroke-width="4" stroke-linecap="round" />
      <line x1={poleX - 22} y1={236} x2={poleX + 22} y2={236} stroke="#8a9299" stroke-width="4" stroke-linecap="round" />
      <path d={`M${poleX} 50 h-20 v8`} stroke="#8a9299" stroke-width="3" fill="none" />
      <rect x={poleX - 48} y={bagTop} width="52" height={bagH} rx="8" fill="rgba(255,255,255,0.85)" stroke="#6b7680" stroke-width="2" />
      <rect x={poleX - 44} y={bagTop + bagH - 4 - fillH} width="44" height={fillH} rx="4" fill={iv.tint} opacity="0.85" />
      <text x={poleX - 22} y={bagTop + 16} text-anchor="middle" font-size="8.5" font-weight="700" fill="#1d2327">{iv.label}</text>
      <rect x={poleX - 22} y={bagTop + bagH} width="8" height="26" rx="3" fill="rgba(255,255,255,0.9)" stroke="#6b7680" stroke-width="1.5" />
      {iv.running && !reduceMotion && <circle class="drip" cx={poleX - 18} cy={dripY - 8} r="2.2" fill={iv.tint} />}
      <path d={`M${poleX - 18} ${bagTop + bagH + 26} C ${poleX - 30} 190, ${nx + 70} ${ny - 60}, ${nx} ${ny}`}
        fill="none" stroke={iv.running ? iv.tint : '#b9c2c9'} stroke-width="2.5" stroke-dasharray={iv.running && !reduceMotion ? '6 5' : undefined}
        class={iv.running && !reduceMotion ? 'flow' : undefined} />
      <circle cx={nx} cy={ny} r="4" fill="#f2f2f2" stroke="#6b7680" stroke-width="1.5" />
      <rect x={nx - 7} y={ny - 3} width="14" height="6" rx="2" fill="#fff" stroke="#9aa3aa" stroke-width="1" transform={`rotate(-20 ${nx} ${ny})`} />
    </g>
  );
}

// Calf art: 2D renders of an original 3D model (Blender, see art/). 1200×780 images drawn at 400×260.
const ART = (name: string) => `${import.meta.env.BASE_URL}art/calf-${name}.webp`;
const SIDE_FRAMES = ['side-1', 'side-2', 'side-3'];

function Straw() {
  const blades = [];
  for (let i = 0; i < 46; i++) {
    const x = 8 + ((i * 37) % 390);
    const y = 222 + ((i * 13) % 30);
    const len = 14 + ((i * 7) % 14);
    const ang = ((i * 29) % 50) - 25;
    blades.push(
      <line
        key={i}
        x1={x}
        y1={y}
        x2={x + len * Math.cos((ang * Math.PI) / 180)}
        y2={y + len * Math.sin((ang * Math.PI) / 180)}
        stroke={i % 3 ? '#d9b44a' : '#c49a2c'}
        stroke-width="2.4"
        stroke-linecap="round"
      />,
    );
  }
  return (
    <g>
      <rect x="0" y="215" width="400" height="45" fill="#ecd48a" />
      {blades}
    </g>
  );
}

if (typeof window !== 'undefined') {
  for (const n of [...SIDE_FRAMES, 'sternal', 'standing']) {
    const img = new Image();
    img.src = ART(n);
  }
}

function useFrame(active: boolean, count: number, ms: number) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setF((x) => (x + 1) % count), ms);
    return () => clearInterval(id);
  }, [active, count, ms]);
  return active ? f : 0;
}

const LABEL: Record<Status, string> = {
  critical: 'Juniper is lying on her side having severe, frequent seizures.',
  seizing: 'Juniper is lying on her side, trembling, with repeated seizures.',
  stable: 'Juniper is lying upright with her head raised. No seizures.',
  healthy: 'Juniper is standing up and alert.',
};

export function Calf({ status, reduceMotion, iv }: Props) {
  const pose = poseFor(status);
  const frame = useFrame(pose === 'side' && !reduceMotion, 3, status === 'critical' ? 260 : 380);
  const src = pose === 'side' ? ART(SIDE_FRAMES[frame]) : ART(pose);
  const cls = ['calf', `calf-${status}`, reduceMotion ? 'no-motion' : ''].join(' ');
  return (
    <svg class={cls} viewBox="30 40 350 220" role="img"
      aria-label={`${LABEL[status]}${iv ? ` An IV line runs to her neck from a bag of ${iv.label}${iv.running ? ', dripping' : ''}.` : ''}`}>
      <rect x="0" y="0" width="400" height="260" fill="var(--barn)" />
      <g stroke="var(--barn-line)" stroke-width="2">
        <line x1="0" y1="60" x2="400" y2="60" />
        <line x1="0" y1="120" x2="400" y2="120" />
        <line x1="0" y1="180" x2="400" y2="180" />
      </g>
      <Straw />
      <g class="calf-figure">
        <g class="breath">
          <image href={src} x="0" y="0" width="400" height="260" />
        </g>
      </g>
      {iv && <IVLine iv={iv} neck={NECK_ANCHOR[pose]} reduceMotion={reduceMotion} />}
    </svg>
  );
}

export const CALF_LABEL = LABEL;
