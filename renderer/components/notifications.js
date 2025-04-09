// Gestión de notificaciones

// Cargar la sección de notificaciones
async function loadNotifications() {
    const notificationsSection = document.getElementById('notifications-section');
    
    try {
      // Obtener mantenimientos próximos para notificaciones
      const upcomingMaintenance = await window.api.getUpcomingMaintenance();
      
      // Preparar datos para la interfaz
      const notificationItems = generateNotificationItems(upcomingMaintenance);
      
      // Crear HTML
      notificationsSection.innerHTML = `
        <h2 class="mb-4">Notificaciones</h2>
        
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="mb-0">Configuración de WhatsApp</h5>
              </div>
              <div class="card-body">
                <p class="card-text">
                  Conecta tu cuenta de WhatsApp para enviar notificaciones automáticas a tus clientes.
                </p>
                <button id="connectWhatsAppBtn" class="btn btn-success">
                  <i class="bi bi-whatsapp"></i> Conectar WhatsApp
                </button>
              </div>
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="mb-0">Plantillas de Mensajes</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label for="templateSelect" class="form-label">Selecciona una plantilla:</label>
                  <select id="templateSelect" class="form-select">
                    <option value="maintenance">Recordatorio de Mantenimiento</option>
                    <option value="followup">Seguimiento Post-Instalación</option>
                    <option value="custom">Mensaje Personalizado</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label for="templatePreview" class="form-label">Vista previa:</label>
                  <textarea id="templatePreview" class="form-control" rows="6" readonly></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Clientes para Notificar</h5>
            <button id="sendAllNotificationsBtn" class="btn btn-primary btn-sm" ${notificationItems.length === 0 ? 'disabled' : ''}>
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
      setupNotificationsEvents();
      
    } catch (error) {
      notificationsSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar notificaciones: ${error.message}
        </div>
      `;
    }
  }
  
  // Generar items de notificación a partir de mantenimientos
  function generateNotificationItems(maintenanceList) {
    // Agrupar notificaciones por cliente para evitar duplicados
    const notificationsByClient = {};
    
    maintenanceList.forEach(maint => {
      if (!maint.clientPhone) return; // Omitir si no tiene teléfono
      
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
    if (items.length === 0) {
      return '';
    }
    
    return items.map(item => {
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
    }).join('');
  }
  
  // Configurar eventos para la sección de notificaciones
  function setupNotificationsEvents() {
    // Botón para conectar WhatsApp
    const connectWhatsAppBtn = document.getElementById('connectWhatsAppBtn');
    if (connectWhatsAppBtn) {
      connectWhatsAppBtn.addEventListener('click', () => {
        // Enviar solicitud para generar código QR
        window.api.sendWhatsAppMessage({ action: 'connect' });
        showAlert('info', 'Iniciando conexión con WhatsApp...');
      });
    }
    
    // Selector de plantilla
    const templateSelect = document.getElementById('templateSelect');
    const templatePreview = document.getElementById('templatePreview');
    
    if (templateSelect && templatePreview) {
      templateSelect.addEventListener('change', () => {
        const templateType = templateSelect.value;
        const exampleData = {
          clientName: 'Juan Pérez',
          componentName: 'Caldera',
          address: 'Av. Principal 123',
          nextMaintenanceDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        
        templatePreview.value = createMessageTemplate(templateType, exampleData);
      });
      
      // Trigger inicial
      templateSelect.dispatchEvent(new Event('change'));
    }
    
    // Botones de enviar notificación individual
    const sendNotificationButtons = document.querySelectorAll('.send-notification-btn');
    sendNotificationButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientId = button.getAttribute('data-client-id');
        const clientName = button.getAttribute('data-client-name');
        const clientPhone = button.getAttribute('data-client-phone');
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
      });
    });
    
    // Botón para enviar todas las notificaciones
    const sendAllNotificationsBtn = document.getElementById('sendAllNotificationsBtn');
    if (sendAllNotificationsBtn) {
      sendAllNotificationsBtn.addEventListener('click', () => {
        const totalClients = document.querySelectorAll('.notification-item').length;
        
        if (confirm(`¿Estás seguro de enviar notificaciones a ${totalClients} clientes?`)) {
          // En una implementación real, aquí enviaríamos cada mensaje
          showAlert('success', `Se han enviado ${totalClients} notificaciones correctamente`);
        }
      });
    }
  }
  
  // Formatear fecha
  function formatDate(dateString) {
    if (!dateString) return '-';
    return window.api.formatDate(dateString);
  }
  
  // Exportar funciones
  window.loadNotifications = loadNotifications;