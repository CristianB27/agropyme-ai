import { useEffect, useMemo, useState } from 'react';
import { loadAppData } from '../services/agropyme';
import { resumirCosechas } from '../utils/easterEgg';
import { formatCOP } from '../utils/format';

/**
 * Easter egg "Cosecha dorada": se abre al tocar cinco veces seguidas el logo.
 * Escena animada solo con CSS y SVG: amanecer, maíz que crece, tractor,
 * hojas y granos que caen, confeti y un contador de cosecha.
 * Con "reducir movimiento" activado se muestra la escena final sin animaciones.
 */

interface Props {
  onClose: () => void;
}

const TITULO = 'FELICIDADES';

interface Resumen {
  kgCosechados: number;
  margen: number;
  enGanancias: boolean;
}

// Generador pseudoaleatorio con semilla para que la escena sea estable entre renders.
function aleatorio(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function MataDeMaiz({ indice }: { indice: number }) {
  return (
    <svg viewBox="0 0 60 200" className="cd-mata-svg" aria-hidden="true">
      <g className="cd-espiga" style={{ animationDelay: `${2.2 + indice * 0.12}s` }}>
        <line x1="30" y1="40" x2="22" y2="18" />
        <line x1="30" y1="40" x2="30" y2="12" />
        <line x1="30" y1="40" x2="38" y2="18" />
      </g>
      <rect x="27" y="38" width="6" height="162" rx="3" fill="#3E8E41" />
      <path d="M30 150 Q4 128 2 92 Q20 122 30 138 Z" fill="#4CAF50" />
      <path d="M30 118 Q56 100 58 64 Q40 96 30 108 Z" fill="#66BB6A" />
      <path d="M30 175 Q50 165 56 140 Q42 160 30 166 Z" fill="#43A047" />
      <g className="cd-mazorca" style={{ animationDelay: `${2.0 + indice * 0.12}s` }}>
        <path d="M33 62 Q48 70 46 110 Q40 92 33 88 Z" fill="#7CB342" />
        <ellipse cx="40" cy="84" rx="8" ry="20" fill="#F9C846" />
        {[0, 1, 2, 3, 4, 5].map((fila) =>
          [0, 1].map((col) => (
            <circle key={`${fila}-${col}`} cx={37 + col * 6} cy={70 + fila * 5.5} r="1.6" fill="#E8A317" />
          )),
        )}
      </g>
    </svg>
  );
}

function Tractor() {
  return (
    <svg viewBox="0 0 170 110" className="cd-tractor-svg" aria-hidden="true">
      <g className="cd-tractor-cuerpo">
        <rect x="60" y="22" width="44" height="40" rx="6" fill="#C62828" />
        <rect x="66" y="28" width="32" height="22" rx="3" fill="#BBDEFB" />
        <rect x="30" y="52" width="120" height="26" rx="8" fill="#E53935" />
        <rect x="128" y="40" width="8" height="16" rx="2" fill="#424242" />
        <rect x="140" y="58" width="18" height="10" rx="3" fill="#FFCA28" />
      </g>
      <g className="cd-rueda" style={{ transformOrigin: '52px 80px' }}>
        <circle cx="52" cy="80" r="26" fill="#263238" />
        <circle cx="52" cy="80" r="11" fill="#FFCA28" />
        <rect x="49" y="56" width="6" height="48" fill="#37474F" />
        <rect x="28" y="77" width="48" height="6" fill="#37474F" />
      </g>
      <g className="cd-rueda" style={{ transformOrigin: '135px 88px' }}>
        <circle cx="135" cy="88" r="16" fill="#263238" />
        <circle cx="135" cy="88" r="7" fill="#FFCA28" />
        <rect x="133" y="73" width="4" height="30" fill="#37474F" />
      </g>
    </svg>
  );
}

export default function CosechaDorada({ onClose }: Props) {
  const [kilos, setKilos] = useState(0);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abiertoEn] = useState(() => performance.now());

  // Datos reales del productor: kilos cosechados y si va en ganancias.
  useEffect(() => {
    let vigente = true;
    loadAppData()
      .then((data) => { if (vigente) setResumen(resumirCosechas(data)); })
      .catch(() => { /* Sin datos la escena se muestra igual, sin cifras. */ });
    return () => { vigente = false; };
  }, []);

  // Contador de kilos que arranca cuando la escena ya está armada.
  const kilosFinales = resumen?.kgCosechados ?? 0;
  useEffect(() => {
    if (kilosFinales <= 0) return undefined;
    let cuadro = 0;
    const inicio = Math.max(abiertoEn + 2600, performance.now());
    const duracion = 2200;
    const paso = (t: number) => {
      const avance = Math.min(Math.max((t - inicio) / duracion, 0), 1);
      const suave = 1 - (1 - avance) ** 3;
      setKilos(Math.round(kilosFinales * suave));
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [kilosFinales, abiertoEn]);

  // Escape cierra la escena.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  const escena = useMemo(() => {
    const r = aleatorio(42);
    const estrellas = Array.from({ length: 40 }, () => ({
      left: r() * 100, top: r() * 55, size: 1 + r() * 2.5, delay: r() * 2,
    }));
    const particulas = Array.from({ length: 42 }, (_, i) => ({
      tipo: i % 3 === 0 ? 'grano' : 'hoja',
      left: r() * 100, delay: 2.5 + r() * 7, dur: 5 + r() * 5, size: 10 + r() * 14, giro: r() * 360,
    }));
    const confeti = Array.from({ length: 34 }, (_, i) => {
      const angulo = (i / 34) * Math.PI * 2 + r() * 0.3;
      const distancia = 160 + r() * 220;
      return {
        x: Math.cos(angulo) * distancia, y: Math.sin(angulo) * distancia,
        color: ['#FFCA28', '#66BB6A', '#29B6F6', '#EF5350', '#FFFFFF'][i % 5], delay: 2.6 + r() * 0.3,
      };
    });
    const matas = Array.from({ length: 13 }, (_, i) => ({
      left: 2 + i * 7.6 + (r() - 0.5) * 2, altura: 22 + r() * 14, delay: 1.3 + i * 0.12,
    }));
    return { estrellas, particulas, confeti, matas };
  }, []);

  return (
    <div className="cd" role="dialog" aria-modal="true" aria-label="Felicidades">
      <style>{ESTILOS}</style>

      <div className="cd-cielo-dia" />
      <div className="cd-cielo-noche">
        {escena.estrellas.map((e, i) => (
          <span key={i} className="cd-estrella"
            style={{ left: `${e.left}%`, top: `${e.top}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s` }} />
        ))}
      </div>

      <div className="cd-sol"><div className="cd-rayos" /></div>

      {[0, 1, 2].map((i) => (
        <div key={i} className={`cd-nube cd-nube-${i}`} />
      ))}

      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 40 16" className={`cd-ave cd-ave-${i}`} aria-hidden="true">
          <path d="M0 8 Q10 0 20 8 Q30 0 40 8" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ))}

      <svg className="cd-colinas" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 160 Q240 70 480 140 T960 120 T1440 150 V320 H0 Z" fill="#9CCC65" />
        <path d="M0 220 Q300 150 600 210 T1200 190 T1440 210 V320 H0 Z" fill="#7CB342" />
      </svg>

      <div className="cd-campo">
        {escena.matas.map((m, i) => (
          <div key={i} className="cd-mata"
            style={{ left: `${m.left}%`, height: `${m.altura}vh`, animationDelay: `${m.delay}s, ${m.delay + 1.2}s` }}>
            <MataDeMaiz indice={i} />
          </div>
        ))}
      </div>

      <div className="cd-tractor">
        <Tractor />
        {[0, 1, 2].map((i) => <span key={i} className="cd-humo" style={{ animationDelay: `${i * 0.5}s` }} />)}
      </div>

      {escena.particulas.map((p, i) => (
        <span key={i} className={p.tipo === 'hoja' ? 'cd-hoja' : 'cd-grano'}
          style={{
            left: `${p.left}%`, width: p.size, height: p.tipo === 'hoja' ? p.size * 0.6 : p.size * 0.7,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
            ['--giro' as string]: `${p.giro}deg`,
          }} />
      ))}

      <div className="cd-explosion" aria-hidden="true">
        {escena.confeti.map((c, i) => (
          <span key={i} className="cd-confeti"
            style={{ background: c.color, animationDelay: `${c.delay}s`, ['--x' as string]: `${c.x}px`, ['--y' as string]: `${c.y}px` }} />
        ))}
      </div>

      <div className="cd-tarjeta">
        <h2 className="cd-titulo">
          {[...TITULO].map((letra, i) => (
            <span key={i} style={{ animationDelay: `${2.4 + i * 0.06}s` }}>{letra === ' ' ? ' ' : letra}</span>
          ))}
        </h2>
        {kilosFinales > 0 && (
          <p className="cd-kilos">{kilos.toLocaleString('es-CO')} <small>kg cosechados</small></p>
        )}
        <p className="cd-texto">
          ¡Gracias por usar AgroPyme AI! Cada registro que haces nos ayuda a que tu finca crezca con números claros.
        </p>
        {resumen?.enGanancias && (
          <div className="cd-ganancias">
            <span className="cd-ganancias-icono" aria-hidden="true">🏆</span>
            <p>
              <strong>¡Vas en ganancias!</strong> Llevas {formatCOP(resumen.margen)} de margen.
              Tu esfuerzo en el campo está dando frutos: sigue así.
            </p>
          </div>
        )}
        <p className="cd-creditos">
          Con cariño,<br /><strong>Cristian Benitez y Santiago Payares</strong><br />UTB 2026
        </p>
        <button type="button" className="cd-boton" onClick={onClose} autoFocus>Volver a la finca</button>
      </div>
    </div>
  );
}

const ESTILOS = `
.cd { position: fixed; inset: 0; z-index: 100; overflow: hidden; font-family: 'Inter', system-ui, sans-serif;
  animation: cd-aparecer .5s ease-out both; }
.cd-cielo-dia { position: absolute; inset: 0; background: linear-gradient(180deg, #4FA3E0 0%, #8FD3F4 35%, #FFD27F 70%, #FFB74D 100%); }
.cd-cielo-noche { position: absolute; inset: 0; background: linear-gradient(180deg, #0B1033 0%, #1E2A5A 60%, #3B3F7A 100%);
  animation: cd-amanecer 2.6s ease-in .4s both; }
.cd-estrella { position: absolute; border-radius: 50%; background: #fff; animation: cd-titilar 1.2s ease-in-out infinite alternate; }

.cd-sol { position: absolute; left: 50%; top: 12%; width: 150px; height: 150px; margin-left: -75px; border-radius: 50%;
  background: radial-gradient(circle, #FFF59D 0%, #FFD54F 55%, #FFB300 100%);
  box-shadow: 0 0 60px 25px rgba(255, 213, 79, .65); animation: cd-salir-sol 2.8s cubic-bezier(.2,.8,.2,1) .6s both; }
.cd-rayos { position: absolute; inset: -90px; border-radius: 50%; opacity: .35;
  background: repeating-conic-gradient(from 0deg, rgba(255,236,179,.9) 0deg 8deg, transparent 8deg 20deg);
  animation: cd-girar 18s linear infinite; mask: radial-gradient(circle, #000 35%, transparent 70%);
  -webkit-mask: radial-gradient(circle, #000 35%, transparent 70%); }

.cd-nube { position: absolute; background: #fff; border-radius: 999px; opacity: .9; filter: blur(1px);
  box-shadow: 40px -18px 0 8px #fff, 85px -4px 0 2px #fff; animation: cd-nube 38s linear infinite; }
.cd-nube-0 { top: 10%; width: 120px; height: 40px; animation-delay: -6s; }
.cd-nube-1 { top: 22%; width: 90px; height: 30px; animation-duration: 50s; animation-delay: -28s; }
.cd-nube-2 { top: 6%; width: 70px; height: 24px; animation-duration: 44s; animation-delay: -16s; }

.cd-ave { position: absolute; width: 34px; animation: cd-volar 11s linear infinite; }
.cd-ave path { animation: cd-aletear .45s ease-in-out infinite alternate; transform-origin: center; transform-box: fill-box; }
.cd-ave-0 { top: 18%; animation-delay: 2.5s; }
.cd-ave-1 { top: 23%; width: 26px; animation-delay: 3.1s; }
.cd-ave-2 { top: 15%; width: 22px; animation-delay: 3.6s; }

.cd-colinas { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 42vh; animation: cd-subir 1.2s ease-out .9s both; }
.cd-campo { position: absolute; left: 0; right: 0; bottom: 0; height: 40vh; }
.cd-mata { position: absolute; bottom: 2vh; width: 7vw; max-width: 70px; min-width: 34px; transform-origin: 50% 100%;
  animation: cd-crecer 1.1s cubic-bezier(.3,1.5,.6,1) both, cd-mecer 3.2s ease-in-out infinite alternate; }
.cd-mata-svg { width: 100%; height: 100%; overflow: visible; }
.cd-mazorca { transform-origin: 40px 84px; transform-box: view-box; animation: cd-brotar .6s cubic-bezier(.3,1.8,.5,1) both; }
.cd-espiga line { stroke: #FBC02D; stroke-width: 2.5; stroke-linecap: round; }
.cd-espiga { transform-origin: 30px 40px; transform-box: view-box; animation: cd-brotar .5s ease-out both; }

.cd-tractor { position: absolute; bottom: 3vh; left: 0; width: 170px; animation: cd-tractor 9s linear 2.4s infinite both; }
.cd-tractor-svg { width: 100%; overflow: visible; }
.cd-tractor-cuerpo { animation: cd-rebote .35s ease-in-out infinite alternate; }
.cd-rueda { animation: cd-girar 1s linear infinite; }
.cd-humo { position: absolute; left: 128px; top: 24px; width: 16px; height: 16px; border-radius: 50%; background: rgba(120,120,120,.55);
  animation: cd-humo 1.5s ease-out infinite; }

.cd-hoja, .cd-grano { position: absolute; top: -6vh; animation-name: cd-caer; animation-timing-function: linear;
  animation-iteration-count: infinite; animation-fill-mode: both; }
.cd-hoja { background: linear-gradient(135deg, #81C784, #388E3C); border-radius: 0 80% 0 80%; }
.cd-grano { background: radial-gradient(circle at 35% 35%, #FFF59D, #F9A825); border-radius: 50% 50% 45% 45%; }

.cd-explosion { position: absolute; left: 50%; top: 42%; width: 0; height: 0; }
.cd-confeti { position: absolute; width: 10px; height: 14px; border-radius: 2px; opacity: 0;
  animation: cd-estallar 1.6s cubic-bezier(.1,.8,.3,1) both; }

.cd-tarjeta { position: absolute; left: 50%; top: 44%; width: min(88vw, 460px); transform: translate(-50%, -50%);
  padding: 26px 24px 22px; text-align: center; border-radius: 24px; color: #1B2A1B;
  background: rgba(255,255,255,.82); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 20px 60px rgba(0,0,0,.25); animation: cd-tarjeta .9s cubic-bezier(.2,1.4,.4,1) 2.2s both; }
.cd-titulo { margin: 0 0 6px; font-size: clamp(30px, 7vw, 44px); font-weight: 800; color: #2E7D32; line-height: 1.1; }
.cd-titulo span { display: inline-block; animation: cd-letra .7s cubic-bezier(.3,1.8,.5,1) both; }
.cd-kilos { margin: 8px 0 2px; font-size: clamp(26px, 6vw, 36px); font-weight: 800; color: #F57F17; font-variant-numeric: tabular-nums; }
.cd-kilos small { font-size: 15px; font-weight: 600; color: #6D4C41; }
.cd-texto { margin: 6px 0 12px; font-size: 15px; font-weight: 600; line-height: 1.45; }
.cd-ganancias { display: flex; gap: 10px; align-items: center; margin: 0 0 14px; padding: 10px 14px; text-align: left;
  border-radius: 14px; font-size: 14px; line-height: 1.4; color: #5D4037;
  background: linear-gradient(135deg, #FFF8E1, #FFECB3); border: 1px solid #FFD54F;
  animation: cd-brillo-entrada .8s cubic-bezier(.2,1.5,.4,1) 3.2s both, cd-brillo 2.4s ease-in-out 4s infinite; }
.cd-ganancias p { margin: 0; }
.cd-ganancias strong { color: #E65100; }
.cd-ganancias-icono { font-size: 28px; animation: cd-latir 1.4s ease-in-out 4s infinite; }
.cd-creditos { margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #546E7A; }
.cd-creditos strong { color: #2E7D32; }
.cd-boton { border: 0; border-radius: 999px; padding: 11px 26px; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer;
  background: #2E7D32; box-shadow: 0 6px 18px rgba(46,125,50,.4); animation: cd-latir 1.6s ease-in-out 5s infinite; }
.cd-boton:hover { background: #256628; }

@keyframes cd-aparecer { from { opacity: 0; } to { opacity: 1; } }
@keyframes cd-amanecer { from { opacity: 1; } to { opacity: 0; } }
@keyframes cd-titilar { from { opacity: .25; transform: scale(.7); } to { opacity: 1; transform: scale(1.2); } }
@keyframes cd-salir-sol { from { transform: translateY(70vh) scale(.6); } to { transform: translateY(0) scale(1); } }
@keyframes cd-girar { to { transform: rotate(360deg); } }
@keyframes cd-nube { from { transform: translateX(-180px); } to { transform: translateX(110vw); } }
@keyframes cd-volar { from { transform: translateX(-60px) translateY(0); } 50% { transform: translateX(50vw) translateY(-20px); }
  to { transform: translateX(110vw) translateY(10px); } }
@keyframes cd-aletear { from { transform: scaleY(1); } to { transform: scaleY(-.6); } }
@keyframes cd-subir { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes cd-crecer { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes cd-mecer { from { rotate: -3deg; } to { rotate: 3deg; } }
@keyframes cd-brotar { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes cd-tractor { from { transform: translateX(-200px); } to { transform: translateX(calc(100vw + 40px)); } }
@keyframes cd-rebote { from { transform: translateY(0); } to { transform: translateY(-2px); } }
@keyframes cd-humo { from { opacity: .8; transform: translate(0, 0) scale(.6); } to { opacity: 0; transform: translate(-20px, -45px) scale(2); } }
@keyframes cd-caer { from { transform: translate(0, 0) rotate(var(--giro)); }
  50% { transform: translate(30px, 55vh) rotate(calc(var(--giro) + 180deg)); }
  to { transform: translate(-20px, 112vh) rotate(calc(var(--giro) + 360deg)); } }
@keyframes cd-estallar { 0% { opacity: 1; transform: translate(0, 0) rotate(0); }
  100% { opacity: 0; transform: translate(var(--x), var(--y)) rotate(540deg); } }
@keyframes cd-tarjeta { from { opacity: 0; transform: translate(-50%, -30%) scale(.7); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes cd-letra { from { opacity: 0; transform: translateY(30px) scale(.4) rotate(-15deg); } to { opacity: 1; transform: none; } }
@keyframes cd-brillo-entrada { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
@keyframes cd-brillo { 0%, 100% { box-shadow: 0 0 0 rgba(255,193,7,0); } 50% { box-shadow: 0 0 22px rgba(255,193,7,.75); } }
@keyframes cd-latir { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

@media (prefers-reduced-motion: reduce) {
  .cd, .cd * { animation: none !important; }
  .cd-cielo-noche, .cd-confeti, .cd-hoja, .cd-grano, .cd-ave, .cd-tractor { display: none; }
}
`;
