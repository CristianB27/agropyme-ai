import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Leaf, Info } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  '¿Cuánto costó producir el maíz del Lote Norte?',
  '¿Qué ciclo ha sido más rentable?',
  '¿Cuánto he gastado en jornales en el Lote Norte?',
  '¿Cómo va el clima esta semana en Finca El Progreso?',
];

const RESPONSES: { keywords: string[]; text: string }[] = [
  {
    keywords: ['costó', 'costo', 'coste', 'cuanto costo'],
    text: 'El ciclo de maíz del Lote Norte (2,5 ha) tuvo un costo total de $8.856.000: insumos $3.466.000, jornales $3.390.000 y otros costos $2.000.000. Eso equivale a $3.542.400 por hectárea y $787,2 por kg producido.',
  },
  {
    keywords: ['rentable', 'rentabilidad', 'utilidad', 'ganancia'],
    text: 'Entre los ciclos con ventas registradas, el más rentable es el maíz del Lote Norte: ingresos de $11.775.000, costos de $8.856.000 y utilidad estimada de $2.919.000 (rentabilidad estimada de 33,0 %). Los otros tres ciclos siguen activos y todavía no tienen ventas registradas.',
  },
  {
    keywords: ['jornales', 'jornal', 'mano de obra', 'trabajo'],
    text: 'En el ciclo de maíz del Lote Norte se registraron 72 jornales por un total de $3.390.000: siembra (12), fertilización (10), deshierba (20) y cosecha (30).',
  },
  {
    keywords: ['clima', 'lluvia', 'pronóstico', 'pronostico', 'tiempo', 'temperatura'],
    text: 'Para Finca El Progreso se pronostican 48 mm de lluvia dentro de 2 días, lo que activa una alerta de lluvia intensa. Los demás días tienen lluvias ligeras o nulas.',
  },
  {
    keywords: ['insumos', 'insumo', 'semilla', 'fertilizante', 'herbicida', 'urea'],
    text: 'En el ciclo de maíz del Lote Norte gastaste $3.466.000 en insumos: semilla $700.000, fertilizante NPK $1.350.000, urea $960.000 y herbicida $456.000.',
  },
];

const DEFAULT_RESPONSE = 'Por ahora puedo responder sobre costos, jornales, insumos, rentabilidad y clima de tus lotes. Prueba con una de las preguntas sugeridas.';

function getResponse(question: string): string {
  const lower = question.toLowerCase();
  for (const r of RESPONSES) {
    if (r.keywords.some((kw) => lower.includes(kw))) {
      return r.text;
    }
  }
  return DEFAULT_RESPONSE;
}

export default function AsistenteIA() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hola, soy tu asistente de AgroPyme AI. Pregúntame por los costos, jornales, rentabilidad o clima de tus lotes.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: text.trim() }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const response = getResponse(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
      setTyping(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Asistente IA</h2>
        <p className="text-sm text-gray-500 mt-1">Pregunta sobre tus costos, rentabilidad y clima</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        {/* Header with avatar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-[#2E7D32]/10 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-[#2E7D32]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Asistente AgroPyme AI</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> En línea
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#2E7D32] text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">Soy un asistente de apoyo: no reemplazo el criterio de un ingeniero agrónomo.</p>
          </div>
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">Preguntas sugeridas:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-2 rounded-full border border-gray-200 text-gray-700 hover:bg-[#2E7D32]/5 hover:border-[#2E7D32]/30 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage(input);
              }}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="w-10 h-10 rounded-full bg-[#2E7D32] text-white flex items-center justify-center hover:bg-[#256628] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
