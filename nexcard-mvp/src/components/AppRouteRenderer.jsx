import React, { Suspense } from 'react';
import SafeErrorState from './common/SafeErrorState';
const LandingPage = React.lazy(() => import('./LandingPage'));
const ComingSoon = React.lazy(() => import('./ComingSoon'));
const PrivacyPolicy = React.lazy(() => import('./PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./TermsAndConditions'));
const NexCardProfile = React.lazy(() => import('./NexCardProfile'));
const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const InventoryDashboard = React.lazy(() => import('./InventoryDashboard'));
const AdminCardsDashboard = React.lazy(() => import('./AdminCardsDashboard'));
const AdminProfilesDashboard = React.lazy(() => import('./AdminProfilesDashboard'));
const OrdersDashboard = React.lazy(() => import('./OrdersDashboard'));
const QAOrdersDashboard = React.lazy(() => import('./QAOrdersDashboard'));
const CRMDashboard = React.lazy(() => import('./CRMDashboard'));
const NexReviewDashboard = React.lazy(() => import('./NexReviewDashboard'));
const ReviewCardsDashboard = React.lazy(() => import('./ReviewCardsDashboard'));
const ReviewCardRedirect = React.lazy(() => import('./ReviewCardRedirect'));
const EmailDashboard = React.lazy(() => import('./EmailDashboard'));
const ProductsDashboard = React.lazy(() => import('./ProductsDashboard'));
const TeamDashboard = React.lazy(() => import('./TeamDashboard'));
const WheelDashboard = React.lazy(() => import('./WheelDashboard'));
const PrintTestGenerator = React.lazy(() => import('./PrintTestGenerator'));
const KpiDashboard = React.lazy(() => import('./KpiDashboard'));
const UnsubscribePage = React.lazy(() => import('./UnsubscribePage'));
const TrackingPage = React.lazy(() => import('./TrackingPage'));
const DeliveryConfirmation = React.lazy(() => import('./DeliveryConfirmation'));
const ActivationPage = React.lazy(() => import('./ActivationPage'));
const UserEditor = React.lazy(() => import('./UserEditor'));
const SetupWizard = React.lazy(() => import('./SetupWizard'));
const AuthPage = React.lazy(() => import('./AuthPage'));
const ProductCatalog = React.lazy(() => import('./ProductCatalog'));
const Cart = React.lazy(() => import('./Cart'));
const CheckoutForm = React.lazy(() => import('./CheckoutForm'));
const OrderConfirmation = React.lazy(() => import('./OrderConfirmation'));

const routeFallback = (
  <div className="min-h-screen bg-zinc-950 text-white grid place-items-center px-6">
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-zinc-300">Cargando módulo…</div>
  </div>
);

const withSuspense = (element) => <Suspense fallback={routeFallback}>{element}</Suspense>;

export default function AppRouteRenderer({
  loading,
  checkoutStep,
  currentOrder,
  path,
  pendingClaimToken,
  pendingClaimEmail,
  user,
  data,
  adminData,
  inventoryData,
  cardsData,
  profilesAdminData,
  ordersAdminData,
  landingContent,
  error,
  handleProceedToCart,
  handleProceedToCheckout,
  handleOrderSuccess,
  handleBackToShop,
  handleBackToCart,
  handleAuthSuccess,
  handleSave,
  handleLogout,
  handleClaimAuthRequired,
  handleContinueSetup,
  handleCheckoutStart,
  navigate,
}) {
  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center font-bold">Cargando NexCard…</div>;
  }

  if (checkoutStep === 'catalog') {
    return withSuspense(<ProductCatalog onProceedToCart={handleProceedToCart} />);
  }

  if (checkoutStep === 'cart') {
    return withSuspense(<Cart onProceedCheckout={handleProceedToCheckout} onBack={handleBackToShop} />);
  }

  if (checkoutStep === 'checkout') {
    return withSuspense(<CheckoutForm onOrderSuccess={handleOrderSuccess} onBack={handleBackToCart} />);
  }

  if (checkoutStep === 'confirmation') {
    return withSuspense(<OrderConfirmation order={currentOrder} onContinueShopping={handleBackToShop} />);
  }

  if (path === '/login') return withSuspense(<AuthPage onAuthSuccess={handleAuthSuccess} pendingClaimToken={pendingClaimToken} pendingClaimEmail={pendingClaimEmail} />);

  if (path === '/admin') return withSuspense(<AdminDashboard dashboard={adminData} />);
  if (path === '/admin/inventory') return withSuspense(<InventoryDashboard items={inventoryData.items} movements={inventoryData.movements} />);
  if (path === '/admin/cards') return withSuspense(<AdminCardsDashboard cards={cardsData.cards} profiles={cardsData.profiles} />);
  if (path === '/admin/profiles') return withSuspense(<AdminProfilesDashboard profiles={profilesAdminData} />);
  if (path === '/admin/nexreview') return withSuspense(<NexReviewDashboard profiles={profilesAdminData} />);
  if (path === '/admin/orders') return withSuspense(<OrdersDashboard orders={ordersAdminData} />);
  if (path === '/admin/orders/qa') return withSuspense(<QAOrdersDashboard orders={ordersAdminData} />);
  if (path === '/admin/emails') return withSuspense(<EmailDashboard />);
  if (path === '/admin/review-cards') return withSuspense(<ReviewCardsDashboard />);
  if (path === '/admin/products') return withSuspense(<ProductsDashboard />);
  if (path === '/admin/team') return withSuspense(<TeamDashboard />);
  if (path === '/admin/wheel') return withSuspense(<WheelDashboard />);
  if (path === '/admin/print-test') return withSuspense(<PrintTestGenerator />);
  if (path === '/admin/kpis') return withSuspense(<KpiDashboard />);

  if (path.startsWith('/r/')) {
    return withSuspense(<ReviewCardRedirect slug={path.replace('/r/', '').replace(/\/$/, '')} />);
  }
  if (path === '/baja') return withSuspense(<UnsubscribePage />);

  if (path === '/admin/crm') return withSuspense(<CRMDashboard />);

  if (path === '/edit') {
    if (!user) return null;
    return withSuspense(<UserEditor data={data} onSave={handleSave} onLogout={handleLogout} />);
  }

  if (path === '/setup') {
    return withSuspense(<SetupWizard onComplete={async (wizardData) => {
      await handleSave({ ...data, ...wizardData });
      navigate('/edit');
    }} />);
  }

  if (path.startsWith('/activar/')) {
    const token = path.replace('/activar/', '').replace(/\/$/, '');
    return withSuspense(<ActivationPage token={token} user={user} onAuthRequired={handleClaimAuthRequired} onContinueSetup={handleContinueSetup} />);
  }

  if (path.startsWith('/seguimiento/')) {
    const [orderId, token] = path.replace('/seguimiento/', '').replace(/\/$/, '').split('/');
    return withSuspense(<TrackingPage orderId={orderId} token={token} />);
  }

  if (path.startsWith('/confirmar/')) {
    const parts = path.replace('/confirmar/', '').split('/');
    return withSuspense(<DeliveryConfirmation orderId={parts[0]} token={parts[1]} />);
  }

  if (path === '/') return withSuspense(<ComingSoon />);
  if (path === '/preview') return withSuspense(<LandingPage content={landingContent} onCheckoutStart={handleCheckoutStart} />);
  if (path === '/coming-soon') return withSuspense(<LandingPage content={landingContent} onCheckoutStart={handleCheckoutStart} />);
  if (path === '/privacidad') return withSuspense(<PrivacyPolicy />);
  if (path === '/terminos') return withSuspense(<TermsAndConditions />);

  if (error) {
    const isActivationError = path.startsWith('/activar/');
    return (
      <SafeErrorState
        eyebrow={isActivationError ? 'Activación NexCard' : 'Perfil público'}
        title={isActivationError ? 'Link de activación inválido o expirado' : 'Perfil no encontrado'}
        message={isActivationError
          ? (error || 'Revisa el enlace o solicita uno nuevo al equipo NexCard.')
          : 'Este perfil no existe, fue desactivado o el enlace no es correcto.'}
        actionLabel={isActivationError ? 'Volver al inicio' : 'Ir a NexCard'}
        actionHref="/preview"
      />
    );
  }

  return withSuspense(<NexCardProfile data={data} />);
}
