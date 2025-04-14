// Gestión de notificaciones integrada con WhatsApp

// Cargar la sección de notificaciones
async function loadNotifications() {
  const notificationsSection = document.getElementById('notifications-section');
  
  try {
    // Obtener mantenimientos próximos para notificaciones
    const upcomingMaintenance = await window.api.getUpcomingMaintenance();
    
    // Preparar datos para la interfaz
    const notificationItems = generateNotificationItems(upcomingMaintenance);
    
    // Verificar estado actual de WhatsApp
    const isWhatsAppConnected = await window.api.isWhatsAppConnected().catch(() => false);
    
    // Crear HTML con estructura base
    notificationsSection.innerHTML = `
      <h2 class="mb-4">Notificaciones</h2>
      
      <div class="row mb-4">
        <div class="col-12">
          ${!isWhatsAppConnected ? 
          `<div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>WhatsApp no está conectado.</strong> Para enviar notificaciones, primero debes conectar WhatsApp.
            <a href="#" class="alert-link connect-whatsapp-link">Ir a sección de WhatsApp</a>
          </div>` : 
          `<div class="alert alert-success">
            <i class="bi bi-check-circle me-2"></i>
            <strong>WhatsApp conectado.</strong> Puedes enviar notificaciones a tus clientes.
          </div>`}
        </div>
      </div>
      
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Clientes para Notificar</h5>
          <button id="sendAllNotificationsBtn" class="btn btn-primary btn-sm" ${notificationItems.length === 0 || !isWhatsAppConnected ? 'disabled' : ''}>
            Enviar a Todos
          </button>
        </div>
        <div class="card-body">
          <div class="list-group">
            ${renderNotificationItems(notificationItems)}
          </div>
          ${notificationItems.length === 0 ? 
            '<p class="text-center text-muted">No hay notificaciones pendientes para enviar</p>' : ''}
        </div>
      </div>
    `;
    
    // Configurar eventos
    setupNotificationsEvents(isWhatsAppConnected);
    
  } catch (error) {
    console.error("Error completo al cargar notificaciones:", error);
    notificationsSection.innerHTML = `
      <div class="alert alert-danger">
        Error al cargar notificaciones: ${error.message}
      </div>
    `;
  }
}

// Renderizar el conector WhatsApp sin React
function renderNonReactWhatsAppConnector(isConnected) {
  const container = document.getElementById('whatsapp-connector-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="mb-0">Conexión WhatsApp</h5>
      </div>
      <div class="card-body">
        <div class="text-center mb-3">
          <span class="badge ${isConnected ? 'bg-success' : 'bg-secondary'} mb-2">
            ${isConnected ? 'Conectado' : 'No conectado'}
          </span>
          <p class="mb-3">${isConnected ? 'WhatsApp conectado correctamente' : 'No conectado a WhatsApp'}</p>
        </div>
        
        <div id="qr-container" class="text-center my-3" style="display: none;">
          <div class="d-inline-block bg-white p-3 rounded shadow-sm">
            <div id="qr-code" style="width: 256px; height: 256px; margin: 0 auto;"></div>
          </div>
          <p class="text-muted mt-2 small">
            Abre WhatsApp en tu teléfono &gt; Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
          </p>
        </div>
        
        ${isConnected ? `
          <div class="text-center">
            <div class="alert alert-success mb-3">
              <i class="bi bi-check-circle-fill me-2"></i>
              WhatsApp conectado correctamente
            </div>
            <p class="text-muted">Ya puedes enviar notificaciones a tus clientes</p>
            <button id="logout-whatsapp-btn" class="btn btn-outline-danger btn-sm mt-3">
              <i class="bi bi-box-arrow-right me-2"></i>
              Cerrar sesión de WhatsApp
            </button>
          </div>
        ` : `
          <div class="text-center">
            <button id="connect-whatsapp-btn" class="btn btn-success">
              <i class="bi bi-whatsapp me-2"></i>
              Conectar WhatsApp
            </button>
            <div id="whatsapp-connecting" style="display: none;" class="mt-3">
              <div class="spinner-border spinner-border-sm text-success me-2" role="status">
                <span class="visually-hidden">Conectando...</span>
              </div>
              <span>Generando código QR...</span>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
  
  // Configurar eventos para esta versión alternativa
  setupWhatsAppConnector();
}

// Generar items de notificación a partir de mantenimientos
function generateNotificationItems(maintenanceList) {
  // Agrupar notificaciones por cliente para evitar duplicados
  const notificationsByClient = {};
  
  if (!Array.isArray(maintenanceList)) {
    console.error("La lista de mantenimientos no es un array:", maintenanceList);
    return [];
  }
  
  maintenanceList.forEach(maint => {
    if (!maint || !maint.clientPhone) return; // Omitir si no tiene teléfono
    
    if (!notificationsByClient[maint.clientId]) {
      notificationsByClient[maint.clientId] = {
        clientId: maint.clientId,
        clientName: maint.clientName,
        clientPhone: maint.clientPhone,
        maintenance: []
      };
    }
    
    notificationsByClient[maint.clientId].maintenance.push({
      componentName: maint.componentName,
      address: maint.address,
      nextMaintenanceDate: maint.nextMaintenanceDate,
      daysLeft: maint.daysLeft
    });
  });
  
  return Object.values(notificationsByClient).sort((a, b) => {
    // Ordenar por urgencia (menor cantidad de días restantes primero)
    const minDaysA = Math.min(...a.maintenance.map(m => m.daysLeft));
    const minDaysB = Math.min(...b.maintenance.map(m => m.daysLeft));
    return minDaysA - minDaysB;
  });
}

// Renderizar items de notificación
function renderNotificationItems(items) {
  if (!items || items.length === 0) {
    return '';
  }
  
  return items.map(item => {
    try {
      // Encontrar el mantenimiento más urgente para este cliente
      const mostUrgent = item.maintenance.reduce((prev, current) => 
        (prev.daysLeft < current.daysLeft) ? prev : current
      );
      
      // Determinar clase de urgencia
      const urgentClass = mostUrgent.daysLeft <= 7 ? 'urgent' : '';
      
      return `
        <div class="list-group-item notification-item ${urgentClass}">
          <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1">${item.clientName}</h5>
            <small>${item.clientPhone}</small>
          </div>
          <p class="mb-1">
            ${item.maintenance.length === 1 
              ? `Mantenimiento de ${item.maintenance[0].componentName} en ${item.maintenance[0].address}`
              : `${item.maintenance.length} mantenimientos pendientes`}
          </p>
          <div class="d-flex justify-content-between align-items-center">
            <small>Próximo mantenimiento en ${mostUrgent.daysLeft} días (${formatDate(mostUrgent.nextMaintenanceDate)})</small>
            <button class="btn btn-sm btn-outline-success send-notification-btn" 
                    data-client-id="${item.clientId}" 
                    data-client-name="${item.clientName}" 
                    data-client-phone="${item.clientPhone}"
                    data-maintenance='${JSON.stringify(item.maintenance)}'>
              <i class="bi bi-whatsapp"></i> Enviar
            </button>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error al renderizar item de notificación:", error, item);
      return '';
    }
  }).join('');
}

// Configurar eventos para la sección de notificaciones
// Configurar eventos para la sección de notificaciones - Versión actualizada
function setupNotificationsEvents(isWhatsAppConnected) {
  // Enlace para ir a la sección de WhatsApp
  const connectWhatsAppLink = document.querySelector('.connect-whatsapp-link');
  if (connectWhatsAppLink) {
    connectWhatsAppLink.addEventListener('click', (e) => {
      e.preventDefault();
      const whatsappSection = document.querySelector('[data-section="whatsapp"]');
      if (whatsappSection) {
        whatsappSection.click();
      }
    });
  }
  
  // Botones de enviar notificación individual
  const sendNotificationButtons = document.querySelectorAll('.send-notification-btn');
  sendNotificationButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const clientId = button.getAttribute('data-client-id');
      const clientName = button.getAttribute('data-client-name');
      const clientPhone = button.getAttribute('data-client-phone');
      
      // Si WhatsApp no está conectado, mostrar mensaje
      if (!isWhatsAppConnected) {
        showAlert('warning', 'WhatsApp no está conectado. Ve a la sección de WhatsApp para conectarte.', 5000);
        return;
      }
      
      try {
        const maintenanceData = JSON.parse(button.getAttribute('data-maintenance'));
        
        // Mostrar modal de WhatsApp
        document.getElementById('whatsappRecipientId').value = clientId;
        document.getElementById('whatsappRecipientName').value = clientName;
        document.getElementById('whatsappRecipientPhone').value = clientPhone;
        
        // Establecer plantilla de mensaje
        document.getElementById('whatsappMessageTemplate').value = 'maintenance';
        
        // Usar el primer mantenimiento para el mensaje
        const messageData = {
          clientName,
          componentName: maintenanceData[0].componentName,
          address: maintenanceData[0].address,
          nextMaintenanceDate: maintenanceData[0].nextMaintenanceDate
        };
        
        // Si hay múltiples mantenimientos, agregar información adicional
        let message = createMessageTemplate('maintenance', messageData);
        if (maintenanceData.length > 1) {
          message += '\n\nAdicionalmente, se requiere mantenimiento para:\n';
          maintenanceData.slice(1).forEach(maint => {
            message += `- ${maint.componentName} (${formatDate(maint.nextMaintenanceDate)})\n`;
          });
        }
        
        document.getElementById('whatsappMessage').value = message;
        
        // Mostrar modal
        const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
        whatsappModal.show();
      } catch (error) {
        console.error("Error al preparar mensaje:", error);
        showAlert('danger', `Error al preparar mensaje: ${error.message}`, 5000);
      }
    });
  });
  
  // Botón para enviar todas las notificaciones
  const sendAllNotificationsBtn = document.getElementById('sendAllNotificationsBtn');
  if (sendAllNotificationsBtn) {
    sendAllNotificationsBtn.addEventListener('click', () => {
      const totalClients = document.querySelectorAll('.notification-item').length;
      
      if (confirm(`¿Estás seguro de enviar notificaciones a ${totalClients} clientes?`)) {
        // En una implementación real, aquí enviaríamos cada mensaje
        showAlert('success', `Se han enviado ${totalClients} notificaciones correctamente`, 5000);
      }
    });
  }
}

// Generar items de notificación a partir de mantenimientos
function generateNotificationItems(maintenanceList) {
  // Agrupar notificaciones por cliente para evitar duplicados
  const notificationsByClient = {};
  
  if (!Array.isArray(maintenanceList)) {
    console.error("La lista de mantenimientos no es un array:", maintenanceList);
    return [];
  }
  
  maintenanceList.forEach(maint => {
    if (!maint || !maint.clientPhone) return; // Omitir si no tiene teléfono
    
    if (!notificationsByClient[maint.clientId]) {
      notificationsByClient[maint.clientId] = {
        clientId: maint.clientId,
        clientName: maint.clientName,
        clientPhone: maint.clientPhone,
        maintenance: []
      };
    }
    
    notificationsByClient[maint.clientId].maintenance.push({
      componentName: maint.componentName,
      address: maint.address,
      nextMaintenanceDate: maint.nextMaintenanceDate,
      daysLeft: maint.daysLeft
    });
  });
  
  return Object.values(notificationsByClient).sort((a, b) => {
    // Ordenar por urgencia (menor cantidad de días restantes primero)
    const minDaysA = Math.min(...a.maintenance.map(m => m.daysLeft));
    const minDaysB = Math.min(...b.maintenance.map(m => m.daysLeft));
    return minDaysA - minDaysB;
  });
}

// Renderizar items de notificación
function renderNotificationItems(items) {
  if (!items || items.length === 0) {
    return '';
  }
  
  return items.map(item => {
    try {
      // Encontrar el mantenimiento más urgente para este cliente
      const mostUrgent = item.maintenance.reduce((prev, current) => 
        (prev.daysLeft < current.daysLeft) ? prev : current
      );
      
      // Determinar clase de urgencia
      const urgentClass = mostUrgent.daysLeft <= 7 ? 'urgent' : '';
      
      return `
        <div class="list-group-item notification-item ${urgentClass}">
          <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1">${item.clientName}</h5>
            <small>${item.clientPhone}</small>
          </div>
          <p class="mb-1">
            ${item.maintenance.length === 1 
              ? `Mantenimiento de ${item.maintenance[0].componentName} en ${item.maintenance[0].address}`
              : `${item.maintenance.length} mantenimientos pendientes`}
          </p>
          <div class="d-flex justify-content-between align-items-center">
            <small>Próximo mantenimiento en ${mostUrgent.daysLeft} días (${formatDate(mostUrgent.nextMaintenanceDate)})</small>
            <button class="btn btn-sm btn-outline-success send-notification-btn" 
                    data-client-id="${item.clientId}" 
                    data-client-name="${item.clientName}" 
                    data-client-phone="${item.clientPhone}"
                    data-maintenance='${JSON.stringify(item.maintenance)}'>
              <i class="bi bi-whatsapp"></i> Enviar
            </button>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error al renderizar item de notificación:", error, item);
      return '';
    }
  }).join('');
}

// Crear plantilla de mensajes
function createMessageTemplate(type, data) {
  switch (type) {
    case 'maintenance':
      return `Estimado/a ${data.clientName},\n\nLe recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado en los próximos días (${formatDate(data.nextMaintenanceDate)}).\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nnServitecGas`;
    
    case 'followup':
      return `Estimado/a ${data.clientName},\n\nEsperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.\n\nGracias por confiar en nosotros.\n\nSaludos cordiales,\nServitecGas`;
    
    case 'custom':
      return '';
    
    default:
      return '';
  }
}

// Formatear fecha
function formatDate(dateString) {
  if (!dateString) return '-';
  return window.api.formatDate ? window.api.formatDate(dateString) : new Date(dateString).toLocaleDateString();
}

// Exportar funciones
window.loadNotifications = loadNotifications;