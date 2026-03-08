/**
 * Main entry point for the application
 */

import { initRouter, route, navigate } from './router.js';
import PracticantesPage from './pages/practicantes.js';
import SociosPage from './pages/socios.js';
import ProfesoresPage from './pages/profesores.js';
import CostosPage from './pages/costos.js';
import DeudasPage from './pages/deudas.js';
import LugaresPage from './pages/lugares.js';
import ActividadesPage from './pages/actividades.js';
import PagosPage from './pages/pagos.js';
import TiposAbonoPage from './pages/tiposAbono.js';
import InformesPage from './pages/informes.js';
import AsistenciaPage from './pages/asistencia.js';
import HorariosPage from './pages/horarios.js';
import LoginPage from './pages/login.js';
import RegisterPage from './pages/register.js';
import PracticanteDetail from './components/PracticanteDetail.js';
import { apiClient } from './api/client.js';

// Function to check if user is authenticated
function isAuthenticated() {
  return localStorage.getItem('token') !== null;
}

/**
 * Update navigation links based on auth status
 */
function updateNavigation() {
  const navLinksDiv = document.getElementById('nav-links');
  if (!navLinksDiv) return;

  // Clear current links
  navLinksDiv.innerHTML = '';

  if (isAuthenticated()) {
    const links = [
      { href: '/practicantes', text: 'Practicantes' },
      { href: '/socios', text: 'Socios', checkAlerts: true },
      { href: '/asistencia', text: 'Asistencia' },
      { href: '/costos', text: 'Caja' },
      { href: '/deudas', text: 'Deudas' },
      { href: '/pagos', text: 'Historial' },
      { href: '/informes', text: 'Informes' },
      { href: '/horarios', text: 'Horarios' },
      { href: '/lugares', text: 'Sedes' },
      { href: '/actividades', text: 'Actividades' },
      { href: '/tipos-abono', text: 'Abonos' },
      { href: '/profesores', text: 'Profesores' }
    ];

    links.forEach(linkData => {
      const a = document.createElement('a');
      a.href = linkData.href;
      a.textContent = linkData.text;
      
      // Set active class if matches current path
      if (window.location.pathname === linkData.href) {
        a.classList.add('active');
      }
      
      navLinksDiv.appendChild(a);

      if (linkData.checkAlerts) {
        checkTeacherAlerts(a);
      }
    });

    // Logout link
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.textContent = 'Cerrar Sesión';
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    });
    navLinksDiv.appendChild(logoutLink);
  }
}

async function checkTeacherAlerts(sociosLink) {
    try {
        const response = await apiClient.get('/socios/teacher-alerts');
        const alerts = response.data;
        const totalAlerts = alerts.missingRegistration.length + alerts.expiredPayments.length;
        
        if (totalAlerts > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-danger ml-1';
            badge.style.borderRadius = '10px';
            badge.style.padding = '2px 8px';
            badge.style.fontSize = '0.75rem';
            badge.style.fontWeight = 'bold';
            badge.textContent = totalAlerts;
            badge.title = 'Tiene cuotas sociales de profesor pendientes o por vencer';
            sociosLink.appendChild(badge);
        } else if (alerts.soonToExpire.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-warning ml-1';
            badge.style.borderRadius = '10px';
            badge.style.padding = '2px 8px';
            badge.style.fontSize = '0.75rem';
            badge.style.fontWeight = 'bold';
            badge.textContent = alerts.soonToExpire.length;
            badge.title = 'Tiene cuotas sociales de profesor próximas a vencer';
            sociosLink.appendChild(badge);
        }
    } catch (error) {
        console.error('Error checking teacher alerts:', error);
    }
}

async function renderPage(PageClass, params = {}, noLayout = false) {
  const mainContent = document.getElementById('main-content');
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  
  if (!isAuthenticated() && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    navigate('/login');
    return;
  }

  if (noLayout) {
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    updateNavigation(); // Ensure nav is updated even if layout is hidden
  } else {
    if (header) header.style.display = 'block';
    if (footer) footer.style.display = 'block';
    updateNavigation();
  }
  
  if (mainContent) {
    mainContent.innerHTML = '<div class="loader text-center p-5">Cargando...</div>';
    try {
      const page = new PageClass(mainContent, params);
      await page.render();
    } catch (error) {
      console.error('Error rendering page:', error);
      mainContent.innerHTML = `
        <div class="alert alert-danger m-5">
          <h3>Error al cargar la página</h3>
          <p>${error.message || 'Ocurrió un error inesperado.'}</p>
          <button class="btn btn-primary" onclick="window.location.reload()">Reintentar</button>
        </div>
      `;
    }
  }
}

// Register routes
route('/', () => renderPage(PracticantesPage));
route('/practicantes', () => renderPage(PracticantesPage));
route('/socios', () => renderPage(SociosPage));
route('/profesores', () => renderPage(ProfesoresPage));
route('/costos', () => renderPage(CostosPage));
route('/deudas', () => renderPage(DeudasPage));
route('/lugares', () => renderPage(LugaresPage));
route('/actividades', () => renderPage(ActividadesPage));
route('/pagos', () => renderPage(PagosPage));
route('/informes', () => renderPage(InformesPage));
route('/tipos-abono', () => renderPage(TiposAbonoPage));
route('/asistencia', () => renderPage(AsistenciaPage));
route('/horarios', () => renderPage(HorariosPage));
route('/login', () => renderPage(LoginPage, {}, true));
route('/register', () => renderPage(RegisterPage, {}, true));

// Specialized routes
route('/practicantes/:id/pagar', (params) => renderPage(PracticanteDetail, { id: params.id, openPaymentModal: true }));
route('/practicantes/:id/cuota', (params) => renderPage(PracticanteDetail, { id: params.id, openCuotaModal: true }));

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initRouter();
  });
} else {
  initRouter();
}
