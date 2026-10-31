import { useState, type FormEvent } from 'react';
import { Leaf, LogIn, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (mode === 'register' && !nombre.trim()) return setError('Escribe tu nombre.');
    if (!email.trim()) return setError('Escribe tu correo.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        window.location.replace('/');
      } else {
        const result = await signUp(email.trim(), password, nombre);
        if (result.needsConfirmation) {
          setMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta.');
        } else {
          window.location.replace('/');
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo completar la operación.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-11 h-11 rounded-xl bg-[#2E7D32] flex items-center justify-center"><Leaf className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-bold text-gray-900 leading-tight">AgroPyme AI</h1><p className="text-xs text-gray-500">Gestión agrícola</p></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button type="button" onClick={() => changeMode('login')} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white text-[#2E7D32] shadow-sm' : 'text-gray-600'}`}><LogIn className="w-4 h-4" /> Iniciar sesión</button>
            <button type="button" onClick={() => changeMode('register')} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-white text-[#2E7D32] shadow-sm' : 'text-gray-600'}`}><UserPlus className="w-4 h-4" /> Registrarse</button>
          </div>

          <h2 className="text-xl font-bold text-gray-900">{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
          <p className="text-sm text-gray-500 mt-1 mb-6">{mode === 'login' ? 'Ingresa para administrar tus fincas y ciclos.' : 'Registra tus datos para empezar a registrar costos y cosechas.'}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && <div><label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" placeholder="Ej. Carlos Ramírez" className={inputClass} /></div>}
            <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Correo</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" className={inputClass} /></div>
            <div><label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label><div className="relative"><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo 6 caracteres" className={`${inputClass} pr-11`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>

            {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3"><AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-700">{error}</p></div>}
            {message && <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3"><CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-green-700">{message}</p></div>}

            <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">AgroPyme AI · Cada usuario solo ve sus propios datos</p>
      </div>
    </div>
  );
}
