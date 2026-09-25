import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App, { RoleHomeRedirect } from './App.tsx'
import { SessionProvider } from './context/SessionContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import './index.css'
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx'
import { TeamPerformance } from './pages/admin/TeamPerformance.tsx'
import { ProductsPage } from './pages/admin/ProductsPage.tsx'
import { CityInventoriesPage } from './pages/admin/CityInventoriesPage.tsx'
import { EmployeesPage } from './pages/admin/EmployeesPage.tsx'
import { SalesRegister } from './pages/admin/SalesRegister.tsx'
import { LeaderRoster } from './pages/leader/LeaderRoster.tsx'
import { LeaderPerformance } from './pages/leader/LeaderPerformance.tsx'
import { MemberOrders } from './pages/leader/MemberOrders.tsx'
import { FseOrder } from './pages/fse/FseOrder.tsx'
import { FseOrders } from './pages/fse/FseOrders.tsx'
import { UnproductiveForm } from './pages/fse/UnproductiveForm.tsx'
import { OfficeOrder } from './pages/office/OfficeOrder.tsx'
import { OfficeOrders } from './pages/office/OfficeOrders.tsx'
import { CallQueue } from './pages/caller/CallQueue.tsx'
import { CallOrder } from './pages/caller/CallOrder.tsx'
import { StockLedger } from './pages/warehouse/StockLedger.tsx'
import { PurchaseEntry } from './pages/warehouse/PurchaseEntry.tsx'
import { StockAlerts } from './pages/warehouse/StockAlerts.tsx'
import { CodReconciliation } from './pages/accounts/CodReconciliation.tsx'
import { SchemesPage } from './pages/admin/SchemesPage.tsx'
import { SchemeTrackingPage } from './pages/shared/SchemeTrackingPage.tsx'
import { CustomerDesk } from './pages/shared/CustomerDesk.tsx'
import { JourneyFlow } from './pages/shared/JourneyFlow.tsx'
import { OrderApprovals } from './pages/shared/OrderApprovals.tsx'
import { ReturnOrdersPage } from './pages/shared/ReturnOrdersPage.tsx'
import { SchemeOrdersPage } from './pages/shared/SchemeOrdersPage.tsx'
import { DispatchDesk } from './pages/dispatch/DispatchDesk.tsx'
import { ReportsPage } from './pages/shared/ReportsPage.tsx'
import { InvoicePage } from './pages/shared/InvoicePage.tsx'
import { HrmsPage } from './pages/shared/HrmsPage.tsx'
import { SupportPage } from './pages/shared/SupportPage.tsx'
import { MarketplacePage } from './pages/shared/MarketplacePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<RoleHomeRedirect />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/performance" element={<TeamPerformance />} />
              <Route path="admin/products" element={<ProductsPage />} />
              <Route path="admin/employees" element={<EmployeesPage />} />
              <Route path="admin/inventories" element={<CityInventoriesPage />} />
              <Route path="admin/orders" element={<SalesRegister />} />
              <Route path="admin/schemes" element={<SchemesPage />} />
              <Route path="leader" element={<LeaderRoster />} />
              <Route path="leader/performance" element={<LeaderPerformance />} />
              <Route path="leader/member/:id" element={<MemberOrders />} />
              <Route path="fse" element={<FseOrder />} />
              <Route path="fse/orders" element={<FseOrders />} />
              <Route path="fse/unproductive" element={<UnproductiveForm />} />
              <Route path="office" element={<OfficeOrder />} />
              <Route path="office/orders" element={<OfficeOrders />} />
              <Route path="caller/queue" element={<CallQueue />} />
              <Route path="caller/order" element={<CallOrder />} />
              <Route path="customers" element={<CustomerDesk />} />
              <Route path="warehouse/ledger" element={<StockLedger />} />
              <Route path="warehouse/purchase" element={<PurchaseEntry />} />
              <Route path="warehouse/alerts" element={<StockAlerts />} />
              <Route path="accounts/cod" element={<CodReconciliation />} />
              <Route path="schemes" element={<SchemeTrackingPage />} />
              <Route path="approvals" element={<OrderApprovals />} />
              <Route path="returns" element={<ReturnOrdersPage />} />
              <Route path="scheme-orders" element={<SchemeOrdersPage />} />
              <Route path="dispatch" element={<DispatchDesk />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="invoices" element={<InvoicePage />} />
              <Route path="hrms" element={<HrmsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="marketplace" element={<MarketplacePage />} />
              <Route path="flow" element={<JourneyFlow />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
