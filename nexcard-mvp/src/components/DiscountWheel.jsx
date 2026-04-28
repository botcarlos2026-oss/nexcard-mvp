import React, { useState, useMemo, useRef } from 'react';
import { X, Copy, Check, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

const SPIN_DURATION = 4000;

function getSegmentPath(index, total, cx = 150, cy = 150, r = 135) {
  const angle = (2 * Math.PI) / total;
  const start = index * angle - Math.PI / 2;
  const end = start + angle;
  const x1 = (cx + r * Math.cos(start)).toFixed(2);
  const y1 = (cy + r * Math.sin(start)).toFixed(2);
  const x2 = (cx + r * Math.cos(end)).toFixed(2);
  const y2 = (cy + r * Math.sin(end)).toFixed(2);
  const largeArc = angle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function getLabelTransform(index, total, cx = 150, cy = 150, r = 135) {
  const angle = (2 * Math.PI) / total;
  const mid = (index + 0.5) * angle - Math.PI / 2;
  const lr = r * 0.62;
  return {
    x: (cx + lr * Math.cos(mid)).toFixed(2),
    y: (cy + lr * Math.sin(mid)).toFixed(2),
    rotation: ((mid * 180) / Math.PI + 90).toFixed(1),
  };
}

function pickWinner(prizes) {
  const total = prizes.reduce((s, p) => s + (p.weight || 10), 0);
  let rnd = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    rnd -= prizes[i].weight || 10;
    if (rnd <= 0) return i;
  }
  return prizes.length - 1;
}

function ConfettiParticles() {
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];
  const particles = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: `${5 + (i * 2.7) % 90}%`,
      color: COLORS[i % COLORS.length],
      delay: `${(i * 0.08) % 1}s`,
      size: 6 + (i % 4) * 2,
    }))
  , []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: p.left,
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `wheelConfettiFall 1.8s ${p.delay} ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes wheelConfettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function DiscountWheel({ wheel, onClose }) {
  const prizes = useMemo(
    () => (wheel?.wheel_prizes || []).filter(p => p.active).sort((a, b) => a.display_order - b.display_order),
    [wheel]
  );
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const spinRef = useRef(false);

  const getVisitorId = () => {
    let id = localStorage.getItem('nx_visitor_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('nx_visitor_id', id); }
    return id;
  };

  const handleSpin = () => {
    if (spinning || winner || prizes.length === 0) return;
    spinRef.current = true;
    setSpinning(true);

    const winnerIdx = pickWinner(prizes);
    const segAngle = 360 / prizes.length;
    const winnerAngle = (360 - ((winnerIdx + 0.5) * segAngle)) % 360;
    const currentMod = rotation % 360;
    const delta = (winnerAngle - currentMod + 360) % 360;
    const newRotation = rotation + delta + 5 * 360;

    setRotation(newRotation);

    setTimeout(async () => {
      setSpinning(false);
      setShowConfetti(true);
      setWinner(prizes[winnerIdx]);
      localStorage.setItem('nx_wheel_spun', 'true');

      try {
        await api.recordWheelSpin({
          wheel_id: wheel.id,
          prize_id: prizes[winnerIdx].id,
          visitor_id: getVisitorId(),
        });
      } catch { /* silencioso */ }

      setTimeout(() => setShowConfetti(false), 2000);
    }, SPIN_DURATION + 200);
  };

  const handleCopyCoupon = () => {
    if (!winner?.coupon_code) return;
    navigator.clipboard.writeText(winner.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimWithEmail = async () => {
    if (!email.includes('@')) return;
    setSubmitted(true);
    try {
      const { data: spins } = await import('../services/supabaseClient').then(m => m.supabase.from('wheel_spins').select('id').eq('visitor_id', getVisitorId()).eq('prize_id', winner.id).limit(1).maybeSingle());
      if (spins?.id) {
        await import('../services/supabaseClient').then(m => m.supabase.from('wheel_spins').update({ email }).eq('id', spins.id));
      }
    } catch { /* silencioso */ }
  };

  const handleBuyWithDiscount = () => {
    const code = winner?.coupon_code;
    const path = code ? `/preview?coupon=${encodeURIComponent(code)}` : '/preview';
    window.location.href = path;
  };

  if (prizes.length === 0) return null;

  return (
    <>
      {showConfetti && <ConfettiParticles />}
      <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={!spinning ? onClose : undefined}>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <div>
              <p className="font-black text-lg">{wheel.banner_title || 'Gira la ruleta'}</p>
              <p className="text-zinc-400 text-sm">{wheel.banner_subtitle || 'Premio garantizado en tu primera compra'}</p>
            </div>
            <button onClick={onClose} disabled={spinning} className="text-zinc-500 hover:text-white transition-colors disabled:opacity-30"><X size={20} /></button>
          </div>

          {/* Wheel */}
          <div className="p-6 flex flex-col items-center">
            <div className="relative">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-emerald-400 drop-shadow-md" />
              </div>

              <svg
                width="300"
                height="300"
                viewBox="0 0 300 300"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.23, 1, 0.32, 1)` : 'none',
                  display: 'block',
                }}
              >
                {prizes.map((prize, i) => {
                  const label = prize.label.length > 10 ? prize.label.slice(0, 9) + '…' : prize.label;
                  const { x, y, rotation: rot } = getLabelTransform(i, prizes.length);
                  return (
                    <g key={prize.id}>
                      <path d={getSegmentPath(i, prizes.length)} fill={prize.color || '#10B981'} stroke="#09090b" strokeWidth="2" />
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={prizes.length > 6 ? 9 : 11}
                        fontWeight="bold"
                        transform={`rotate(${rot}, ${x}, ${y})`}
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
                {/* Center circle */}
                <circle cx="150" cy="150" r="24" fill="#09090b" stroke="#18181b" strokeWidth="3" />
                <text x="150" y="150" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold">
                  GIRAR
                </text>
              </svg>

              {/* Spin button overlay */}
              {!winner && (
                <button
                  onClick={handleSpin}
                  disabled={spinning}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-transparent z-20"
                  aria-label="Girar ruleta"
                />
              )}
            </div>

            {/* Spin action */}
            {!winner && (
              <button
                onClick={handleSpin}
                disabled={spinning}
                className="mt-5 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors disabled:opacity-60 text-base"
              >
                {spinning ? '¡Girando…!' : '🎰 ¡Girar ahora!'}
              </button>
            )}

            {/* Winner reveal */}
            {winner && (
              <div className="mt-5 w-full text-center animate-in slide-in-from-bottom-4 duration-500">
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-black text-xl text-emerald-400 mb-1">{winner.label}</p>
                <p className="text-zinc-400 text-sm mb-4">¡Felicidades! Ganaste este premio.</p>

                {winner.coupon_code && (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-4">
                    <p className="text-xs text-zinc-500 mb-2 font-semibold">TU CÓDIGO DE DESCUENTO</p>
                    <div className="flex items-center gap-2 justify-center">
                      <span className="font-black text-2xl tracking-widest text-white">{winner.coupon_code}</span>
                      <button onClick={handleCopyCoupon} className="p-2 text-zinc-400 hover:text-white transition-colors">
                        {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                {!submitted ? (
                  <div className="mb-4">
                    <p className="text-zinc-400 text-sm mb-2">Enviar el código a tu email (opcional)</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <button onClick={handleClaimWithEmail} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        Enviar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-emerald-400 text-sm mb-4">✓ Registrado. ¡No lo pierdas!</p>
                )}

                <button
                  onClick={handleBuyWithDiscount}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  Comprar con descuento <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
