import { useEffect, useRef } from 'preact/hooks';
import anchorsJson from '../../art/exam-anchors.json';

// Pop-up card for an exam tool: a close-up render (Blender, see art/exam.py) plus the finding.
// Text on the thermometer display and blood-tube label is overlaid here, so it stays crisp.

type Rect = { x: number; y: number; width: number; height: number; rotationDeg?: number };
const ANCHORS = anchorsJson as unknown as Record<string, { display?: Rect; label?: Rect }>;
const IMG_W = 800;
const IMG_H = 600;

const OVERLAY_TEXT: Record<string, { lines: string[]; kind: 'lcd' | 'label' }> = {
  'exam-thermometer': { lines: ['38.9 °C'], kind: 'lcd' },
  'exam-blood': { lines: ['Juniper', '9/24/26'], kind: 'label' },
};

export interface ExamCardProps {
  open: boolean;
  onClose: () => void;
  title: string;
  image: string;
  alt: string;
  finding: string;
}

function findRect(image: string): Rect | null {
  const a = ANCHORS[image.replace(/^exam-/, '')];
  return a?.display ?? a?.label ?? null;
}

export function ExamCard({ open, onClose, title, image, alt, finding }: ExamCardProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const overlay = OVERLAY_TEXT[image];
  const rect = overlay ? findRect(image) : null;
  const src = `${import.meta.env.BASE_URL}art/${image}.webp`;

  return (
    <dialog ref={ref} class="examcard" aria-labelledby="examcard-title" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <form method="dialog">
        <h3 id="examcard-title">{title}</h3>
        <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} role="img" aria-label={alt} class="examcard-img">
          <image href={src} x="0" y="0" width={IMG_W} height={IMG_H} />
          {overlay && rect && (() => {
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + rect.height / 2;
            const n = overlay.lines.length;
            const size = Math.min(rect.height / (n * 1.25), rect.width / (Math.max(...overlay.lines.map((l) => l.length)) * 0.62));
            return (
              <g transform={`rotate(${rect.rotationDeg ?? 0} ${cx} ${cy})`} aria-hidden="true">
                {overlay.lines.map((line, i) => (
                  <text key={line} x={cx} y={cy + (i - (n - 1) / 2) * size * 1.15} text-anchor="middle" dominant-baseline="central"
                    class={overlay.kind === 'lcd' ? 'lcd-text' : 'label-text'} font-size={size}>
                    {line}
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>
        <p class="examcard-finding">{finding}</p>
        <button class="primary" value="close">Close</button>
      </form>
    </dialog>
  );
}
