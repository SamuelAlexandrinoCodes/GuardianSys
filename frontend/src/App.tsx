import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AdministrativoPage } from "./pages/AdministrativoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UnitsPage } from "./pages/UnitsPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { CalendarPage } from "./pages/CalendarPage";
import { BackupPage } from "./pages/BackupPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="units" element={<UnitsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="administrativo" element={<AdministrativoPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="system" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
