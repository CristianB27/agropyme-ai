import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import Layout, { type ScreenId } from './components/Layout';
import Dashboard from './screens/Dashboard';
import MisLotes from './screens/MisLotes';
import RegistroCostos from './screens/RegistroCostos';
import AsistenteIA from './screens/AsistenteIA';

function App() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');

  return (
    <AppProvider>
      <Layout current={screen} onNavigate={setScreen}>
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'lotes' && <MisLotes onNavigate={setScreen} />}
        {screen === 'costos' && <RegistroCostos />}
        {screen === 'asistente' && <AsistenteIA />}
      </Layout>
    </AppProvider>
  );
}

export default App;
