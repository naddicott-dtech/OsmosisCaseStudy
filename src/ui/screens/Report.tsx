import { useState } from 'preact/hooks';
import { buildReport, progressList, reportText } from '../../report';
import { saved, resetAll } from '../../state';

export function Report() {
  const s = saved.value;
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const progress = progressList(s);
  const missing = progress.filter((p) => !p.done);
  const text = reportText(s);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      // Fallback: select the preview so the student can copy manually.
      const el = document.getElementById('report-text');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopied('fail');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `osmosis-case-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div class="stack">
      <section class="panel no-print">
        <h3>Submit your work</h3>
        <ol class="submit-steps">
          <li>Click <strong>Copy report</strong> (or <strong>Download</strong>).</li>
          <li>Paste it into the Canvas assignment (or upload the file).</li>
        </ol>
        {missing.length > 0 ? (
          <div class="callout warn">
            <p><strong>Not finished yet:</strong></p>
            <ul>{missing.map((m) => <li key={m.label}>{m.label}</li>)}</ul>
            <p class="small">You can still copy your report now. Unfinished parts show "(no answer)".</p>
          </div>
        ) : (
          <p class="callout good">All sections complete.</p>
        )}
        <div class="row">
          <button class="primary" onClick={copy}>📋 Copy report</button>
          <button class="secondary" onClick={download}>⬇ Download .txt</button>
          <button class="secondary" onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <span aria-live="polite" class={copied === 'ok' ? 'good' : 'warn'}>
            {copied === 'ok' ? 'Copied! Now paste into Canvas.' : copied === 'fail' ? 'Copy was blocked. The report text is selected. Press Ctrl+C (⌘C on Mac).' : ''}
          </span>
        </div>
        <p class="muted small">Your work is saved only in this browser on this device. It is not sent anywhere until you paste or upload it.</p>
      </section>

      <section class="panel report-preview">
        <h3 class="print-only">Osmosis Case Study: Juniper the calf</h3>
        <div id="report-text">
          {buildReport(s).map((sec) => (
            <div key={sec.title} class="report-sec">
              <h4>{sec.title}</h4>
              {sec.lines.map((l, i) => <p key={i} class={l.startsWith('A:') ? 'ans' : l.startsWith('Q:') ? 'q' : ''}>{l}</p>)}
            </div>
          ))}
        </div>
      </section>

      <section class="panel no-print">
        {!confirmReset ? (
          <button class="ghost danger" onClick={() => setConfirmReset(true)}>Start over (erase my work on this device)</button>
        ) : (
          <div class="row">
            <span>Erase all answers on this device? This can't be undone.</span>
            <button class="danger" onClick={() => { resetAll(); setConfirmReset(false); }}>Yes, erase</button>
            <button class="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}
