import { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import Layout, { type ScreenId } from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Auth from './screens/Auth';
import Dashboard from './screens/Dashboard';
import MisLotes from './screens/MisLotes';
import RegistroCostos from './screens/RegistroCostos';
import AsistenteIA from './screens/AsistenteIA';

const SCREEN_PATHS: Record<ScreenId, string> = {
  dashboard: '/',
  lotes: '/lotes',
  costos: '/costos',
  asistente: '/asistente',
};

function pathToScreen(pathname: string): ScreenId {
  const entry = Object.entries(SCREEN_PATHS).find(([, path]) => path === pathname);
  return (entry?.[0] as ScreenId | undefined) ?? 'dashboard';
}

function App() {
  const [screen, setScreen] = useState<ScreenId>(() => pathToScreen(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setScreen(pathToScreen(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (id: ScreenId) => {
    setScreen(id);
    window.history.pushState({}, '', SCREEN_PATHS[id]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (window.location.pathname === '/login') return <Auth />;

  return (
    <ProtectedRoute>
      <AppProvider>
        <Layout current={screen} onNavigate={navigate}>
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'lotes' && <MisLotes onNavigate={navigate} />}
          {screen === 'costos' && <RegistroCostos />}
          {screen === 'asistente' && <AsistenteIA />}
        </Layout>
      </AppProvider>
    </ProtectedRoute>
  );
}

export default App;
