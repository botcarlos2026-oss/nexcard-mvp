import React from 'react';
import AdminShell from './AdminShell';

const card1Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <rect width="856" height="540" fill="white"/>
  <!-- Safe area marker (hides at print) -->
  <rect class="safe-area" x="28.35" y="28.35" width="799.3" height="483.3" fill="none" stroke="rgba(255,0,0,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <!-- Title -->
  <text x="50" y="75" font-family="sans-serif" font-size="22" font-weight="700" fill="#111">Fargo DTC1500 — Calibración / Tipografía</text>
  <!-- Typography sizes -->
  <text x="50" y="115" font-family="sans-serif" font-size="14" fill="#555">Tamaños de fuente</text>
  <text x="50" y="145" font-family="sans-serif" font-size="48" fill="#111">NexCard 48</text>
  <text x="50" y="180" font-family="sans-serif" font-size="36" fill="#111">NexCard 36</text>
  <text x="50" y="208" font-family="sans-serif" font-size="24" fill="#111">NexCard 24</text>
  <text x="50" y="230" font-family="sans-serif" font-size="18" fill="#111">NexCard 18</text>
  <text x="50" y="248" font-family="sans-serif" font-size="14" fill="#111">NexCard 14px — texto base</text>
  <text x="50" y="263" font-family="sans-serif" font-size="12" fill="#111">NexCard 12px — subtítulo</text>
  <text x="50" y="276" font-family="sans-serif" font-size="10" fill="#111">NexCard 10px — caption mínimo legible</text>
  <!-- Font weights -->
  <text x="420" y="115" font-family="sans-serif" font-size="14" fill="#555">Pesos (18px)</text>
  <text x="420" y="140" font-family="sans-serif" font-size="18" font-weight="300" fill="#111">NexCard Light 300</text>
  <text x="420" y="162" font-family="sans-serif" font-size="18" font-weight="400" fill="#111">NexCard Regular 400</text>
  <text x="420" y="184" font-family="sans-serif" font-size="18" font-weight="500" fill="#111">NexCard Medium 500</text>
  <text x="420" y="206" font-family="sans-serif" font-size="18" font-weight="600" fill="#111">NexCard SemiBold 600</text>
  <text x="420" y="228" font-family="sans-serif" font-size="18" font-weight="700" fill="#111">NexCard Bold 700</text>
  <text x="420" y="250" font-family="sans-serif" font-size="18" font-weight="800" fill="#111">NexCard ExtraBold 800</text>
  <text x="420" y="272" font-family="sans-serif" font-size="18" font-weight="900" fill="#111">NexCard Black 900</text>
  <!-- Strokes -->
  <text x="50" y="320" font-family="sans-serif" font-size="14" fill="#555">Strokes horizontales</text>
  <line x1="50" y1="335" x2="380" y2="335" stroke="#111" stroke-width="1"/>
  <text x="388" y="339" font-family="sans-serif" font-size="11" fill="#555">1px</text>
  <line x1="50" y1="350" x2="380" y2="350" stroke="#111" stroke-width="2"/>
  <text x="388" y="354" font-family="sans-serif" font-size="11" fill="#555">2px</text>
  <line x1="50" y1="368" x2="380" y2="368" stroke="#111" stroke-width="3"/>
  <text x="388" y="372" font-family="sans-serif" font-size="11" fill="#555">3px</text>
  <line x1="50" y1="389" x2="380" y2="389" stroke="#111" stroke-width="4"/>
  <text x="388" y="393" font-family="sans-serif" font-size="11" fill="#555">4px</text>
  <line x1="50" y1="413" x2="380" y2="413" stroke="#111" stroke-width="5"/>
  <text x="388" y="417" font-family="sans-serif" font-size="11" fill="#555">5px</text>
  <line x1="50" y1="440" x2="380" y2="440" stroke="#111" stroke-width="6"/>
  <text x="388" y="444" font-family="sans-serif" font-size="11" fill="#555">6px</text>
  <!-- Footer -->
  <text x="50" y="510" font-family="sans-serif" font-size="10" fill="#aaa">Fargo DTC1500 — Calibración / Tipografía</text>
</svg>`;

const card2Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <rect width="856" height="540" fill="white"/>
  <rect class="safe-area" x="28.35" y="28.35" width="799.3" height="483.3" fill="none" stroke="rgba(255,0,0,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <text x="50" y="65" font-family="sans-serif" font-size="22" font-weight="700" fill="#111">Fargo DTC1500 — Calibración / Color</text>
  <!-- Grayscale ramp -->
  <text x="50" y="95" font-family="sans-serif" font-size="13" fill="#555">Escala de grises (10%–100%)</text>
  ${[10,20,30,40,50,60,70,80,90,100].map((pct, i) => {
    const val = Math.round(255 * (1 - pct / 100));
    const hex = val.toString(16).padStart(2,'0');
    return `<rect x="${50 + i * 76}" y="104" width="70" height="40" fill="#${hex}${hex}${hex}"/>
            <text x="${85 + i * 76}" y="157" font-family="sans-serif" font-size="10" fill="#555" text-anchor="middle">${pct}%</text>`;
  }).join('')}
  <!-- Pure colors -->
  <text x="50" y="185" font-family="sans-serif" font-size="13" fill="#555">Colores puros CMYK</text>
  ${[['#00FFFF','C'],['#FF00FF','M'],['#FFFF00','Y'],['#000000','K'],['#FF0000','R'],['#00FF00','G'],['#0000FF','B']].map(([color, label], i) => `
    <rect x="${50 + i * 110}" y="194" width="100" height="50" fill="${color}"/>
    <text x="${100 + i * 110}" y="258" font-family="sans-serif" font-size="11" fill="#555" text-anchor="middle">${label} ${color}</text>`).join('')}
  <!-- Gradient banding test -->
  <text x="50" y="285" font-family="sans-serif" font-size="13" fill="#555">Gradiente negro→blanco (test banding)</text>
  <defs>
    <linearGradient id="banding" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect x="50" y="294" width="756" height="55" fill="url(#banding)"/>
  <!-- K panel test -->
  <text x="50" y="375" font-family="sans-serif" font-size="13" fill="#555">Panel resina K</text>
  <rect x="50" y="384" width="180" height="60" fill="#000000"/>
  <text x="140" y="420" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Texto blanco</text>
  <rect x="250" y="384" width="180" height="60" fill="#FFFF00"/>
  <text x="340" y="420" font-family="sans-serif" font-size="16" font-weight="700" fill="#000000" text-anchor="middle">Texto negro</text>
  <rect x="450" y="384" width="180" height="60" fill="#ffffff" stroke="#ccc" stroke-width="1"/>
  <text x="540" y="420" font-family="sans-serif" font-size="16" font-weight="700" fill="#000000" text-anchor="middle">Negro sobre blanco</text>
  <!-- Footer -->
  <text x="50" y="510" font-family="sans-serif" font-size="10" fill="#aaa">Fargo DTC1500 — Calibración / Color</text>
</svg>`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printCard(svgContent, title) {
  const win = window.open('', '_blank');
  const safeTitle = escapeHtml(title);

  win.document.write(`<!DOCTYPE html><html><head><title>${safeTitle}</title><style>
    @page{size:85.6mm 54mm;margin:0;bleed:1mm;}
    body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .safe-area{display:block;}
    @media print{.safe-area{display:none;}}
    svg{width:85.6mm;height:54mm;display:block;}
  </style></head><body>${svgContent}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function downloadSvg(svgContent, filename) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function svgToDataUri(svgContent) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

function CardPreviewPanel({ title, description, svgContent, filename }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h3 className="font-bold text-lg text-white mb-1">{title}</h3>
      <p className="text-zinc-400 text-sm mb-4">{description}</p>
      <div
        className="overflow-hidden rounded-xl border border-zinc-700 mb-4 bg-white"
        style={{ width: '100%', aspectRatio: '856/540' }}
      >
        <img
          src={svgToDataUri(svgContent)}
          alt={`Previsualización ${title}`}
          className="block h-full w-full object-contain"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => printCard(svgContent, title)}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
        >
          Imprimir esta carta
        </button>
        <button
          onClick={() => downloadSvg(svgContent, filename)}
          className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-sm transition-colors"
        >
          Descargar SVG
        </button>
      </div>
    </div>
  );
}

export default function PrintTestGenerator() {
  return (
    <AdminShell active="print-test">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Calibración Fargo DTC1500</h1>
          <p className="text-zinc-400">Cartas de prueba técnica para validar la impresora</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardPreviewPanel
            title="Carta 1 — Tipografía y Líneas"
            description="Valida tamaños de fuente (10–48px), pesos (300–900) y grosores de stroke (1–6px)."
            svgContent={card1Svg}
            filename="fargo-calibracion-tipografia.svg"
          />
          <CardPreviewPanel
            title="Carta 2 — Color y Banding"
            description="Valida escala de grises, colores CMYK puros, gradiente de banding y panel resina K."
            svgContent={card2Svg}
            filename="fargo-calibracion-color.svg"
          />
        </div>
      </div>
    </AdminShell>
  );
}
