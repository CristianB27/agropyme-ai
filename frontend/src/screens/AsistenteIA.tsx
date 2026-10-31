import { useState, useRef, useEffect } from 'react';
import { Send, Leaf, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { invokeAsistente, type AsistenteResult } from '../services/asistente';
import type { AppData } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  source?: AsistenteResult['source'] | 'error';
  notice?: string;
}

function buildSuggestedQuestions(data: AppData): string[] {
  const cycle = data.ciclos_productivos[0];
  const lote = cycle
    ? data.lotes.find((item) => item.id === cycle.lote_id)
    : data.lotes[0];
  const finca = lote
    ? data.fincas.find((item) => item.id === lote.finca_id)
    : data.fincas[0];
  const cultivo = cycle
    ? data.cultivos.find((item) => item.id === cycle.cultivo_id)
    : undefined;

  return [
    cultivo && lote
      ? `¿Cuánto costó producir ${cultivo.nombre} en ${lote.nombre}?`
      : '¿Cuánto he gastado en insumos?',
    '¿Qué ciclo ha sido más rentable y cuál es el margen sobre ventas?',
    lote
      ? `¿Cuánto he gastado en jornales en ${lote.nombre}?`
      : '¿Cuánto he gastado en jornales?',
    finca
      ? `¿Cómo va el clima esta semana en ${finca.nombre}?`
      : '¿Cómo va el clima esta semana en mis fincas?',
  ];
}

export default function AsistenteIA() {
  const { data } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hola, soy tu asistente de AgroPyme AI. Consulto tus datos reales para responder sobre costos, jornales, insumos, rentabilidad o clima de tus lotes.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestedQuestions = buildSuggestedQuestions(data);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    const question = text.trim();
    if (!question || typing) return;

    const previousMessages = messages;
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setTyping(true);

    try {
      const history = previousMessages
        .filter((message) => message.source !== 'error')
        .slice(-10)
        .map((message) => ({ role: message.role, content: message.text }));
      const result = await invokeAsistente(question, history, data.clima);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: result.answer,
        source: result.source,
        notice: result.notice,
      }]);
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'No se pudo contactar al asistente.';
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `No pude responder en este momento: ${message}`,
        source: 'error',
      }]);
    } finally {
      setTyping(false);
    }
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
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Conectado a tus datos
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
                  : msg.source === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.role === 'assistant' && msg.source && msg.source !== 'error' && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    {msg.source === 'anthropic' ? 'Respuesta generada con IA' : 'Respuesta calculada con tus datos reales'}
                  </p>
                )}
                {msg.notice && (
                  <p className="mt-2 border-t border-gray-200 pt-2 text-[10px] leading-relaxed text-amber-700">
                    {msg.notice}
                  </p>
                )}
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
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  disabled={typing}
                  className="text-xs px-3 py-2 rounded-full border border-gray-200 text-gray-700 hover:bg-[#2E7D32]/5 hover:border-[#2E7D32]/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              disabled={typing}
              placeholder={typing ? 'Consultando tus datos…' : 'Escribe tu pregunta...'}
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] disabled:bg-gray-50 disabled:text-gray-500"
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || typing}
              aria-label="Enviar pregunta"
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
