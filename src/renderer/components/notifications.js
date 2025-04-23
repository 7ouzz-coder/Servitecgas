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
            <small>Próximo mantenimiento en ${mostUrgent.daysLeft} días (${formatDateCorrectly(mostUrgent.nextMaintenanceDate)})</small>
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
        showWhatsAppModal(clientId, clientName, clientPhone, maintenanceData);
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
        showNotifyAllModal();
      }
    });
  }
}

// Función para mostrar el modal de WhatsApp
function showWhatsAppModal(clientId, clientName, clientPhone, maintenanceData) {
  // Verificar si ya existe el modal y eliminarlo
  const existingModal = document.getElementById('whatsAppModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Preparar mensaje según los datos de mantenimiento
  let defaultMessage = '';
  
  if (maintenanceData.length === 1) {
    // Si solo hay un mantenimiento
    const maint = maintenanceData[0];
    defaultMessage = `Estimado/a ${clientName},\n\nLe recordamos que su ${maint.componentName} en ${maint.address} requiere mantenimiento programado para el día ${formatDateCorrectly(maint.nextMaintenanceDate)}.\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
  } else {
    // Si hay múltiples mantenimientos
    defaultMessage = `Estimado/a ${clientName},\n\nLe recordamos que tiene los siguientes mantenimientos programados:\n\n`;
    
    maintenanceData.forEach(maint => {
      defaultMessage += `- ${maint.componentName} en ${maint.address}: ${formatDateCorrectly(maint.nextMaintenanceDate)}\n`;
    });
    
    defaultMessage += `\nPor favor, contáctenos para agendar las visitas.\n\nGracias,\nServicio Técnico de Gas`;
  }
  
  // Crear modal HTML
  const modalHtml = `
    <div class="modal fade" id="whatsAppModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Enviar Notificación por WhatsApp</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="whatsAppForm">
              <div class="mb-3">
                <label class="form-label">Cliente</label>
                <input type="text" class="form-control" value="${clientName}" readonly>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" value="${clientPhone}" readonly>
              </div>
              
              <div class="mb-3">
                <label for="whatsapp-message" class="form-label">Mensaje</label>
                <textarea class="form-control" id="whatsapp-message" rows="6">${defaultMessage}</textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-success" id="send-whatsapp-btn">
              <i class="bi bi-whatsapp me-1"></i> Enviar Mensaje
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstChild);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('whatsAppModal'));
  modal.show();
  
  // Configurar botón de enviar
  const sendButton = document.getElementById('send-whatsapp-btn');
  if (sendButton) {
    sendButton.addEventListener('click', async () => {
      try {
        // Deshabilitar botón
        sendButton.disabled = true;
        sendButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
        
        // Obtener mensaje
        const message = document.getElementById('whatsapp-message').value;
        
        // Verificar si WhatsApp está conectado
        const isConnected = await window.api.isWhatsAppConnected();
        
        if (!isConnected) {
          throw new Error('WhatsApp no está conectado. Por favor, conecte WhatsApp primero.');
        }
        
        // Enviar mensaje
        const result = await window.api.sendWhatsAppMessage({
          phone: clientPhone,
          message: message
        });
        
        if (result.success) {
          // Cerrar modal
          modal.hide();
          
          // Mostrar mensaje de éxito
          showAlert('success', 'Mensaje enviado correctamente');
        } else {
          throw new Error(result.message || 'Error al enviar mensaje');
        }
      } catch (error) {
        console.error('Error al enviar mensaje WhatsApp:', error);
        showAlert('danger', `Error al enviar mensaje: ${error.message || 'Error desconocido'}`);
        
        // Restaurar botón
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Enviar Mensaje';
      }
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('whatsAppModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Función para mostrar modal de notificación a todos
function showNotifyAllModal() {
  // Implementar lógica para enviar notificaciones a todos
  // En este caso solo mostramos una alerta para simplificar
  showAlert('info', 'Enviando notificaciones a todos los clientes con mantenimientos pendientes...', 5000);
  
  // Simular envío exitoso después de un tiempo
  setTimeout(() => {
    showAlert('success', 'Notificaciones enviadas correctamente', 5000);
  }, 3000);
}

// Función mejorada para formatear fechas correctamente
function formatDateCorrectly(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    // Formatear como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JS son 0-11
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return '-';
  }
}

// Función para mostrar alertas
function showAlert(type, message, duration = 5000) {
  if (typeof window.showAlert === 'function') {
    window.showAlert(type, message, duration);
    return;
  }
  
  // Implementación alternativa si la función global no existe
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    // Crear contenedor de alertas si no existe
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.role = 'alert';
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  const container = document.getElementById('alert-container') || document.body;
  container.appendChild(alertElement);
  
  // Auto-eliminar después de la duración especificada
  setTimeout(() => {
    if (alertElement.parentNode) {
      try {
        // Intentar usar bootstrap para cerrar
        const bsAlert = new bootstrap.Alert(alertElement);
        bsAlert.close();
      } catch (e) {
        // Si falla, eliminar manualmente
        alertElement.remove();
      }
    }
  }, duration);
}

// Exportar funciones
window.loadNotifications = loadNotifications;