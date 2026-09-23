import type { Status } from '../engine/physiology';

// Original flat-vector calf. Pose follows patient status:
// seizing/critical → lying on her side; stable → lying upright, head up; healthy → standing.

interface Props {
  status: Status;
  reduceMotion: boolean;
}

const WHITE = '#fbfaf7';
const BLACK = '#23201e';
const PINK = '#e9a3a3';
const OUT = '#3b3430';

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

function SidePose({ critical }: { critical: boolean }) {
  return (
    <g>
      <ellipse cx="205" cy="232" rx="150" ry="10" fill="#000" opacity="0.12" />
      <g class="legs-paddle">
        <g stroke={OUT} stroke-width="3" fill={WHITE} stroke-linejoin="round">
          <path d="M140 200 L112 244 L124 247 L152 206 Z" />
          <path d="M165 204 L150 250 L162 251 L176 208 Z" />
          <path d="M262 204 L300 244 L310 238 L276 200 Z" />
          <path d="M285 200 L335 232 L341 222 L296 194 Z" />
        </g>
        <g fill={BLACK}>
          <rect x="108" y="240" width="16" height="9" rx="2" transform="rotate(-57 116 244)" />
          <rect x="146" y="246" width="16" height="8" rx="2" transform="rotate(-70 154 250)" />
          <rect x="298" y="236" width="16" height="9" rx="2" transform="rotate(45 306 240)" />
          <rect x="333" y="222" width="14" height="9" rx="2" transform="rotate(30 340 226)" />
        </g>
      </g>
      <g class="breath">
        <ellipse cx="215" cy="178" rx="118" ry="44" fill={WHITE} stroke={OUT} stroke-width="3" />
        <clipPath id="bodyclip-side">
          <ellipse cx="215" cy="178" rx="116" ry="42" />
        </clipPath>
        <g clip-path="url(#bodyclip-side)" fill={BLACK}>
          <path d="M150 130 C185 140 200 175 170 200 C140 215 120 180 120 150 Z" />
          <path d="M240 128 C280 130 300 160 275 185 C255 200 230 170 235 150 Z" />
          <path d="M300 180 C320 175 340 190 335 225 L290 225 Z" />
        </g>
        <path d="M312 160 C335 150 345 168 340 180" fill="none" stroke={OUT} stroke-width="3" />
      </g>
      <g transform={critical ? 'rotate(-26 110 180)' : 'rotate(-16 110 180)'}>
        <path d="M112 164 C98 160 92 175 100 190" fill={WHITE} stroke={OUT} stroke-width="3" />
        <ellipse cx="72" cy="182" rx="46" ry="27" fill={WHITE} stroke={OUT} stroke-width="3" />
        <path d="M58 160 C70 150 92 156 98 172 C84 176 66 174 58 160 Z" fill={BLACK} />
        <ellipse cx="34" cy="190" rx="17" ry="15" fill={PINK} stroke={OUT} stroke-width="2.5" />
        <circle cx="28" cy="186" r="2.4" fill={OUT} />
        <circle cx="30" cy="196" r="2.4" fill={OUT} />
        <path d="M68 174 q6 4 12 0" stroke={OUT} stroke-width="2.5" fill="none" stroke-linecap="round" />
        <ellipse cx="100" cy="160" rx="18" ry="8" fill={BLACK} stroke={OUT} stroke-width="2" transform="rotate(-30 100 160)" />
        <ellipse cx="108" cy="190" rx="16" ry="7" fill={WHITE} stroke={OUT} stroke-width="2" transform="rotate(25 108 190)" />
      </g>
    </g>
  );
}

function SternalPose() {
  return (
    <g>
      <ellipse cx="210" cy="233" rx="140" ry="10" fill="#000" opacity="0.12" />
      <g stroke={OUT} stroke-width="3" fill={WHITE}>
        <ellipse cx="150" cy="222" rx="30" ry="10" />
        <ellipse cx="290" cy="222" rx="34" ry="11" />
      </g>
      <g class="breath">
        <ellipse cx="220" cy="186" rx="112" ry="42" fill={WHITE} stroke={OUT} stroke-width="3" />
        <clipPath id="bodyclip-sternal">
          <ellipse cx="220" cy="186" rx="110" ry="40" />
        </clipPath>
        <g clip-path="url(#bodyclip-sternal)" fill={BLACK}>
          <path d="M170 140 C205 150 215 180 190 205 C160 215 140 185 145 160 Z" />
          <path d="M255 140 C290 142 310 170 290 195 C265 205 245 175 250 160 Z" />
        </g>
        <path d="M318 175 C338 170 344 186 336 200" fill="none" stroke={OUT} stroke-width="3" />
      </g>
      <path d="M150 160 C130 150 118 128 112 110 L140 104 C146 124 160 144 172 156 Z" fill={WHITE} stroke={OUT} stroke-width="3" />
      <g>
        <ellipse cx="108" cy="104" rx="42" ry="25" fill={WHITE} stroke={OUT} stroke-width="3" transform="rotate(12 108 104)" />
        <path d="M100 82 C114 76 134 84 138 100 C122 102 106 96 100 82 Z" fill={BLACK} />
        <ellipse cx="72" cy="116" rx="16" ry="14" fill={PINK} stroke={OUT} stroke-width="2.5" />
        <circle cx="66" cy="112" r="2.4" fill={OUT} />
        <circle cx="69" cy="122" r="2.4" fill={OUT} />
        <circle cx="104" cy="98" r="4" fill={OUT} />
        <circle cx="105.5" cy="96.5" r="1.3" fill="#fff" />
        <ellipse cx="140" cy="84" rx="18" ry="8" fill={BLACK} stroke={OUT} stroke-width="2" transform="rotate(-25 140 84)" />
      </g>
    </g>
  );
}

function StandingPose() {
  return (
    <g>
      <ellipse cx="205" cy="240" rx="130" ry="9" fill="#000" opacity="0.12" />
      <g stroke={OUT} stroke-width="3" fill={WHITE}>
        <rect x="128" y="150" width="20" height="84" rx="6" />
        <rect x="160" y="150" width="20" height="84" rx="6" />
        <rect x="250" y="150" width="20" height="84" rx="6" />
        <rect x="280" y="150" width="20" height="84" rx="6" />
      </g>
      <g fill={BLACK}>
        <rect x="128" y="226" width="20" height="10" rx="2" />
        <rect x="160" y="226" width="20" height="10" rx="2" />
        <rect x="250" y="226" width="20" height="10" rx="2" />
        <rect x="280" y="226" width="20" height="10" rx="2" />
      </g>
      <g class="breath">
        <ellipse cx="212" cy="128" rx="112" ry="44" fill={WHITE} stroke={OUT} stroke-width="3" />
        <clipPath id="bodyclip-stand">
          <ellipse cx="212" cy="128" rx="110" ry="42" />
        </clipPath>
        <g clip-path="url(#bodyclip-stand)" fill={BLACK}>
          <path d="M160 80 C200 90 210 120 185 150 C150 160 130 130 138 100 Z" />
          <path d="M250 84 C290 86 310 116 290 140 C265 150 245 120 250 100 Z" />
        </g>
        <path d="M322 110 C345 112 348 140 338 160" fill="none" stroke={OUT} stroke-width="3" />
      </g>
      <path d="M130 108 C118 96 110 80 106 64 L134 58 C138 76 146 92 154 102 Z" fill={WHITE} stroke={OUT} stroke-width="3" />
      <g class="head-bob">
        <ellipse cx="100" cy="60" rx="42" ry="25" fill={WHITE} stroke={OUT} stroke-width="3" transform="rotate(14 100 60)" />
        <path d="M92 38 C106 32 126 40 130 56 C114 58 98 52 92 38 Z" fill={BLACK} />
        <ellipse cx="64" cy="74" rx="16" ry="14" fill={PINK} stroke={OUT} stroke-width="2.5" />
        <circle cx="58" cy="70" r="2.4" fill={OUT} />
        <circle cx="61" cy="80" r="2.4" fill={OUT} />
        <circle cx="96" cy="54" r="4" fill={OUT} />
        <circle cx="97.5" cy="52.5" r="1.3" fill="#fff" />
        <ellipse cx="132" cy="40" rx="18" ry="8" fill={BLACK} stroke={OUT} stroke-width="2" transform="rotate(-25 132 40)" />
      </g>
    </g>
  );
}

const LABEL: Record<Status, string> = {
  critical: 'Juniper is lying on her side having severe, frequent seizures.',
  seizing: 'Juniper is lying on her side, trembling, with repeated seizures.',
  stable: 'Juniper is lying upright with her head raised. No seizures.',
  healthy: 'Juniper is standing up and alert.',
};

export function Calf({ status, reduceMotion }: Props) {
  const cls = ['calf', `calf-${status}`, reduceMotion ? 'no-motion' : ''].join(' ');
  return (
    <svg class={cls} viewBox="0 0 400 260" role="img" aria-label={LABEL[status]}>
      <rect x="0" y="0" width="400" height="260" fill="var(--barn)" />
      <g stroke="var(--barn-line)" stroke-width="2">
        <line x1="0" y1="60" x2="400" y2="60" />
        <line x1="0" y1="120" x2="400" y2="120" />
        <line x1="0" y1="180" x2="400" y2="180" />
      </g>
      <Straw />
      <g class="calf-figure">
        {status === 'seizing' || status === 'critical' ? (
          <SidePose critical={status === 'critical'} />
        ) : status === 'stable' ? (
          <SternalPose />
        ) : (
          <StandingPose />
        )}
      </g>
    </svg>
  );
}

export const CALF_LABEL = LABEL;
