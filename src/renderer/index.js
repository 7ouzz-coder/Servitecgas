document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes
    initNavigation();
    initAlerts();
    
    // Configurar manejadores de eventos para modales
    setupModalHandlers();
    
    // Cargar dashboard al inicio
    loadDashboard();
    
    // Manejar eventos de notificaciones
    setupNotificationHandlers();
  });
  
  // Inicializar navegación entre secciones
  function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute('data-section');
        
        // Actualizar enlaces activos
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        link.classList.add('active');
        
        // Mostrar sección correspondiente
        contentSections.forEach(section => {
          section.classList.remove('active');
          if (section.id === `${targetSection}-section`) {
            section.classList.add('active');
            
            // Cargar contenido de la sección
            switch (targetSection) {
              case 'dashboard':
                loadDashboard();
                break;
              case 'clients':
                loadClients();
                break;
              case 'installations':
                loadInstallations();
                break;
              case 'maintenance':
                loadMaintenance();
                break;
              case 'notifications':
                loadNotifications();
                break;
              case 'reports':
                loadReports();
                break;
            }
          }
        });
      });
    });
  }
  
  // Inicializar sistema de alertas
  function initAlerts() {
    // Escuchar eventos de alerta desde el proceso principal
    window.api.onAlert((data) => {
      showAlert(data.type, data.message);
    });
  }
  
  // Mostrar una alerta en la interfaz
  function showAlert(type, message, duration = 5000) {
    const alertContainer = document.getElementById('alert-container');
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Cerrar automáticamente después de la duración
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alertDiv);
      bsAlert.close();
    }, duration);
  }
  
  // Configurar manejadores para modales
  function setupModalHandlers() {
    // Modal de WhatsApp
    document.getElementById('whatsappMessageTemplate').addEventListener('change', function() {
      const templateType = this.value;
      const clientName = document.getElementById('whatsappRecipientName').value;
      
      let messageData = {
        clientName
      };
      
      // Para mantenimiento, podemos usar datos genéricos si no hay específicos
      if (templateType === 'maintenance') {
        messageData.componentName = messageData.componentName || 'equipo';
        messageData.address = messageData.address || 'su dirección';
        messageData.nextMaintenanceDate = messageData.nextMaintenanceDate || 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // Si es personalizado, dejar vacío
      if (templateType === 'custom') {
        document.getElementById('whatsappMessage').value = '';
        return;
      }
      
      document.getElementById('whatsappMessage').value = createMessageTemplate(templateType, messageData);
    });
    
    // Botón para enviar mensaje de WhatsApp
    document.getElementById('sendWhatsappBtn').addEventListener('click', async function() {
      const phone = document.getElementById('whatsappRecipientPhone').value;
      const message = document.getElementById('whatsappMessage').value;
      
      if (!phone || !message) {
        showAlert('warning', 'Debes proporcionar un número de teléfono y un mensaje');
        return;
      }
      
      try {
        // Enviar mensaje
        const result = await window.api.sendWhatsAppMessage({
          phone,
          message
        });
        
        if (result.success) {
          showAlert('success', 'Mensaje enviado correctamente');
          
          // Cerrar modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappModal'));
          modal.hide();
        } else {
          showAlert('danger', `Error al enviar mensaje: ${result.message}`);
        }
      } catch (error) {
        showAlert('danger', `Error al enviar mensaje: ${error.message}`);
      }
    });
  }
  
  // Configurar manejadores de notificaciones
function setupNotificationHandlers() {
  // Verificar si las funciones de API están disponibles
  if (!window.api) {
    console.error("API no disponible para configurar notificaciones");
    return;
  }

  // Escuchar cuando hay mantenimientos próximos - Solo si la función existe
  if (window.api.onMaintenanceDue) {
    window.api.onMaintenanceDue((maintenanceData) => {
      // Mostrar alerta para cada mantenimiento próximo
      if (Array.isArray(maintenanceData)) {
        maintenanceData.forEach(maint => {
          showAlert('warning', `Mantenimiento próximo: ${maint.componentName} en ${maint.address} (Cliente: ${maint.clientName}). Días restantes: ${maint.daysLeft}`);
        });
      } else {
        showAlert('warning', `Mantenimiento próximo para el cliente ${maintenanceData.clientName}. Días restantes: ${maintenanceData.daysLeft}`);
      }
      
      // Actualizar la sección de notificaciones si está visible
      const notificationsSection = document.getElementById('notifications-section');
      if (notificationsSection && notificationsSection.classList.contains('active')) {
        loadNotifications();
      }
    });
  } else {
    console.log("Función onMaintenanceDue no disponible - saltando configuración");
  }
  
  // Escuchar cuando se importa la base de datos - Solo si la función existe
  if (window.api.onDatabaseImported) {
    window.api.onDatabaseImported(() => {
      // Recargar la sección actual
      const activeSection = document.querySelector('.content-section.active');
      if (!activeSection) return;
      
      const sectionId = activeSection.id.replace('-section', '');
      
      switch (sectionId) {
        case 'dashboard':
          if (typeof loadDashboard === 'function') loadDashboard();
          break;
        case 'clients':
          if (typeof loadClients === 'function') loadClients();
          break;
        case 'installations':
          if (typeof loadInstallations === 'function') loadInstallations();
          break;
        case 'maintenance':
          if (typeof loadMaintenance === 'function') loadMaintenance();
          break;
        case 'notifications':
          if (typeof loadNotifications === 'function') loadNotifications();
          break;
        case 'reports':
          if (typeof loadReports === 'function') loadReports();
          break;
      }
    });
  } else {
    console.log("Función onDatabaseImported no disponible - saltando configuración");
  }
  
  // Eventos para WhatsApp - Solo si las funciones existen
  if (window.api.onWhatsAppQr) {
    window.api.onWhatsAppQr((qr) => {
      // Mostrar código QR para escanear
      if (typeof showWhatsAppQrModal === 'function') {
        showWhatsAppQrModal(qr);
      } else {
        console.log("Código QR de WhatsApp recibido, pero la función showWhatsAppQrModal no está disponible");
      }
    });
  }
  
  if (window.api.onWhatsAppReady) {
    window.api.onWhatsAppReady(() => {
      showAlert('success', 'WhatsApp conectado correctamente');
    });
  }
  
  if (window.api.onWhatsAppAuthFailure) {
    window.api.onWhatsAppAuthFailure(() => {
      showAlert('danger', 'Error de autenticación en WhatsApp');
    });
  }
  
  // Mostrar mensaje de estado
  console.log("Manejadores de notificaciones configurados según funciones disponibles");
}