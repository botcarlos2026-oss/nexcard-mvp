import React from 'react';
import LandingPage from './LandingPage';
import ComingSoon from './ComingSoon';
import PrivacyPolicy from './PrivacyPolicy';
import TermsAndConditions from './TermsAndConditions';
import NexCardProfile from './NexCardProfile';
import AdminDashboard from './AdminDashboard';
import InventoryDashboard from './InventoryDashboard';
import AdminCardsDashboard from './AdminCardsDashboard';
import AdminProfilesDashboard from './AdminProfilesDashboard';
import OrdersDashboard from './OrdersDashboard';
import QAOrdersDashboard from './QAOrdersDashboard';
import CRMDashboard from './CRMDashboard';
import NexReviewDashboard from './NexReviewDashboard';
import ReviewCardsDashboard from './ReviewCardsDashboard';
import ReviewCardRedirect from './ReviewCardRedirect';
import EmailDashboard from './EmailDashboard';
import ProductsDashboard from './ProductsDashboard';
import TeamDashboard from './TeamDashboard';
import WheelDashboard from './WheelDashboard';
import PrintTestGenerator from './PrintTestGenerator';
import KpiDashboard from './KpiDashboard';
import UnsubscribePage from './UnsubscribePage';
import TrackingPage from './TrackingPage';
import DeliveryConfirmation from './DeliveryConfirmation';
import ActivationPage from './ActivationPage';
import UserEditor from './UserEditor';
import SetupWizard from './SetupWizard';
import AuthPage from './AuthPage';
import ProductCatalog from './ProductCatalog';
import Cart from './Cart';
import CheckoutForm from './CheckoutForm';
import OrderConfirmation from './OrderConfirmation';

export default function AppRouteRenderer({
  loading,
  checkoutStep,
  currentOrder,
  path,
  pendingClaimToken,
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
    return <ProductCatalog onProceedToCart={handleProceedToCart} />;
  }

  if (checkoutStep === 'cart') {
    return <Cart onProceedCheckout={handleProceedToCheckout} onBack={handleBackToShop} />;
  }

  if (checkoutStep === 'checkout') {
    return <CheckoutForm onOrderSuccess={handleOrderSuccess} onBack={handleBackToCart} />;
  }

  if (checkoutStep === 'confirmation') {
    return <OrderConfirmation order={currentOrder} onContinueShopping={handleBackToShop} />;
  }

  if (path === '/login') return <AuthPage onAuthSuccess={handleAuthSuccess} pendingClaimToken={pendingClaimToken} />;

  if (path === '/admin') return <AdminDashboard dashboard={adminData} />;
  if (path === '/admin/inventory') return <InventoryDashboard items={inventoryData.items} movements={inventoryData.movements} />;
  if (path === '/admin/cards') return <AdminCardsDashboard cards={cardsData.cards} profiles={cardsData.profiles} />;
  if (path === '/admin/profiles') return <AdminProfilesDashboard profiles={profilesAdminData} />;
  if (path === '/admin/nexreview') return <NexReviewDashboard profiles={profilesAdminData} />;
  if (path === '/admin/orders') return <OrdersDashboard orders={ordersAdminData} />;
  if (path === '/admin/orders/qa') return <QAOrdersDashboard orders={ordersAdminData} />;
  if (path === '/admin/emails') return <EmailDashboard />;
  if (path === '/admin/review-cards') return <ReviewCardsDashboard />;
  if (path === '/admin/products') return <ProductsDashboard />;
  if (path === '/admin/team') return <TeamDashboard />;
  if (path === '/admin/wheel') return <WheelDashboard />;
  if (path === '/admin/print-test') return <PrintTestGenerator />;
  if (path === '/admin/kpis') return <KpiDashboard />;

  if (path.startsWith('/r/')) {
    return <ReviewCardRedirect slug={path.replace('/r/', '').replace(/\/$/, '')} />;
  }
  if (path === '/baja') return <UnsubscribePage />;

  if (path === '/admin/crm') return <CRMDashboard />;

  if (path === '/edit') {
    if (!user) return null;
    return <UserEditor data={data} onSave={handleSave} onLogout={handleLogout} />;
  }

  if (path === '/setup') {
    return <SetupWizard onComplete={async (wizardData) => {
      await handleSave({ ...data, ...wizardData });
      navigate('/edit');
    }} />;
  }

  if (path.startsWith('/activar/')) {
    const token = path.replace('/activar/', '').replace(/\/$/, '');
    return <ActivationPage token={token} user={user} onAuthRequired={handleClaimAuthRequired} onContinueSetup={handleContinueSetup} />;
  }

  if (path.startsWith('/seguimiento/')) {
    const [orderId, token] = path.replace('/seguimiento/', '').replace(/\/$/, '').split('/');
    return <TrackingPage orderId={orderId} token={token} />;
  }

  if (path.startsWith('/confirmar/')) {
    const parts = path.replace('/confirmar/', '').split('/');
    return <DeliveryConfirmation orderId={parts[0]} token={parts[1]} />;
  }

  if (path === '/') return <ComingSoon />;
  if (path === '/preview') return <LandingPage content={landingContent} onCheckoutStart={handleCheckoutStart} />;
  if (path === '/coming-soon') return <LandingPage content={landingContent} onCheckoutStart={handleCheckoutStart} />;
  if (path === '/privacidad') return <PrivacyPolicy />;
  if (path === '/terminos') return <TermsAndConditions />;

  if (error) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-8 text-center"><div><p className="font-black text-2xl mb-3">NexCard no pudo cargar el perfil</p><p className="text-zinc-400">{error}</p></div></div>;
  }

  return <NexCardProfile data={data} />;
}
