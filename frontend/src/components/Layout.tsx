import { LayoutDashboard, Map, Receipt, MessageCircle, Leaf } from 'lucide-react';

export type ScreenId = 'dashboard' | 'lotes' | 'costos' | 'asistente';

export const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'lotes', label: 'Mis Lotes', icon: Map },
  { id: 'costos', label: 'Registro de Costos', icon: Receipt },
  { id: 'asistente', label: 'Asistente IA', icon: MessageCircle },
];

interface LayoutProps {
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
  children: React.ReactNode;
}

export default function Layout({ current, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex-col z-30">
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-[#2E7D32] flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">AgroPyme AI</h1>
            <p className="text-[10px] text-gray-500 leading-tight">Gestión agrícola</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#2E7D32] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#2E7D32]/10 flex items-center justify-center text-[#2E7D32] font-semibold text-sm">
              CR
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Carlos Ramírez</p>
              <p className="text-[10px] text-gray-500 truncate">Productor</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 bg-white border-b border-gray-200 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2E7D32] flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">AgroPyme AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2E7D32]/10 flex items-center justify-center text-[#2E7D32] font-semibold text-xs">
              CR
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-900 leading-tight">Carlos Ramírez</p>
              <p className="text-[9px] text-gray-500 leading-tight">Productor</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="md:ml-64 pb-20 md:pb-8 min-h-screen">
        <div className="hidden md:flex items-center gap-2.5 px-8 py-4 border-b border-gray-100 bg-white">
          <div className="w-9 h-9 rounded-full bg-[#2E7D32]/10 flex items-center justify-center text-[#2E7D32] font-semibold text-sm">
            CR
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Carlos Ramírez</p>
            <p className="text-xs text-gray-500">Productor</p>
          </div>
        </div>
        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? 'text-[#2E7D32]' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
