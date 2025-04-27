/**
 * Muestra el modal para editar una plantilla
 * @param {string} templateType - Tipo de plantilla
 * @param {string} currentTemplate - Contenido actual de la plantilla
 * @param {Function} onSave - Callback al guardar
 */
function showTemplateEditModal(templateType, currentTemplate, onSave) {
  // Determinar nombre de la plantilla
  let templateDisplayName = '';
  
  switch (templateType) {
    case 'maintenance':
      templateDisplayName = 'Recordatorio de Mantenimiento';
      break;
    case 'followup':
      templateDisplayName = 'Seguimiento Post-Instalación';
      break;
    default:
      templateDisplayName = 'Plantilla Personalizada';
  }
  
  // Crear y mostrar modal
  const modalHtml = `
    <div class="modal fade" id="editTemplateModal" tabindex="-1" aria-labelledby="editTemplateModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="editTemplateModalLabel">Editar Plantilla: ${templateDisplayName}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="templateContent" class="form-label">Contenido</label>
              <textarea class="form-control" id="templateContent" rows="10">${currentTemplate}</textarea>
            </div>
            <div class="mb-3">
              <p class="text-muted small">Variables disponibles:</p>
              <div class="d-flex flex-wrap gap-1">
                <span class="badge bg-primary">{clientName}</span>
                <span class="badge bg-primary">{componentName}</span>
                <span class="badge bg-primary">{address}</span>
                <span class="badge bg-primary">{nextMaintenanceDate}</span>
                <span class="badge bg-primary">{daysLeft}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveTemplateBtn">Guardar Plantilla</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstChild);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('editTemplateModal'));
  modal.show();
  
  // Configurar botón de guardar
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      // Obtener contenido actualizado
      const updatedContent = document.getElementById('templateContent').value;
      
      // Llamar callback si existe
      if (typeof onSave === 'function') {
        onSave(updatedContent);
      }
      
      // Cerrar modal
      modal.hide();
      
      // Mostrar mensaje de éxito
      showAlert('success', 'Plantilla actualizada correctamente');
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('editTemplateModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

/**
 * Muestra el modal de progreso durante el envío masivo
 * @param {number} totalCount - Número total de mensajes a enviar
 */
function showSendingProgressModal(totalCount) {
  // Verificar si ya existe el modal y eliminarlo
  const existingModal = document.getElementById('sendingProgressModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Crear modal HTML
  const modalHtml = `
    <div class="modal fade" id="sendingProgressModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Enviando Notificaciones</h5>
          </div>
          <div class="modal-body">
            <div class="text-center mb-3">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Enviando...</span>
              </div>
            </div>
            
            <div class="progress mb-3">
              <div id="send-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" 
                   role="progressbar" style="width: 0%" 
                   aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                0%
              </div>
            </div>
            
            <p class="text-center">
              Enviando mensaje <span id="current-count">0</span> de <span id="total-count">${totalCount}</span>
            </p>
            <p class="text-center" id="sending-to">Preparando envío...</p>
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
  const modal = new bootstrap.Modal(document.getElementById('sendingProgressModal'));
  modal.show();
}

/**
 * Actualiza el progreso en el modal
 * @param {number} current - Índice actual
 * @param {number} total - Total de mensajes
 * @param {string} clientName - Nombre del cliente actual
 */
function updateSendingProgress(current, total, clientName) {
  const progressBar = document.getElementById('send-progress-bar');
  const currentCount = document.getElementById('current-count');
  const sendingTo = document.getElementById('sending-to');
  
  if (progressBar && currentCount && sendingTo) {
    const percentage = Math.floor((current / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    
    currentCount.textContent = current;
    sendingTo.textContent = `Enviando a: ${clientName}`;
  }
}

/**
 * Muestra el resumen de envío de mensajes
 * @param {number} successCount - Número de mensajes enviados con éxito
 * @param {number} errorCount - Número de mensajes con error
 * @param {Array} errors - Lista de errores
 */
function showSendingSummary(successCount, errorCount, errors) {
  // Cerrar modal de progreso
  const progressModal = document.getElementById('sendingProgressModal');
  if (progressModal) {
    // Cerrar usando Bootstrap si está disponible
    try {
      const bsModal = bootstrap.Modal.getInstance(progressModal);
      if (bsModal) bsModal.hide();
    } catch (e) {
      // Si falla, eliminar directamente
      progressModal.remove();
    }
  }
  
  // Crear modal de resumen
  const modalHtml = `
    <div class="modal fade" id="sendingSummaryModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Resumen de Envío</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-center mb-4">
              <div class="text-center me-4">
                <div class="fs-1 text-success">${successCount}</div>
                <div class="text-muted">Enviados</div>
              </div>
              <div class="text-center">
                <div class="fs-1 ${errorCount > 0 ? 'text-danger' : 'text-muted'}">${errorCount}</div>
                <div class="text-muted">Errores</div>
              </div>
            </div>
            
            ${errorCount > 0 ? `
              <div class="mt-3">
                <h6>Detalles de los errores:</h6>
                <div class="alert alert-danger">
                  <ul class="mb-0">
                    ${errors.map(e => `<li><strong>${e.client}</strong>: ${e.error}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button>
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
  const modal = new bootstrap.Modal(document.getElementById('sendingSummaryModal'));
  modal.show();
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('sendingSummaryModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

/**
 * Genera un mensaje para un cliente específico según la plantilla
 * @param {Object} client - Datos del cliente
 * @param {string} templateType - Tipo de plantilla
 * @returns {string} - Mensaje generado
 */
function generateClientMessage(client, templateType) {
  // Verificar primero si hay una plantilla personalizada
  if (window.customTemplates && window.customTemplates[templateType]) {
    return applyTemplate(window.customTemplates[templateType], client);
  }
  
  // Usar plantilla predeterminada
  return generatePreviewMessage(client, templateType);
}

/**
 * Genera un mensaje de vista previa según la plantilla
 * @param {Object} client - Datos del cliente
 * @param {string} templateType - Tipo de plantilla
 * @returns {string} - Mensaje generado
 */
function generatePreviewMessage(client, templateType) {
  const firstMaintenance = client.maintenance[0] || {};
  
  switch (templateType) {
    case 'maintenance':
      if (client.maintenance.length === 1) {
        return `Estimado/a ${client.clientName},

Le recordamos que su ${firstMaintenance.componentName} en ${firstMaintenance.address} requiere mantenimiento programado para el día ${formatDateCorrectly(firstMaintenance.nextMaintenanceDate)}.

Por favor, contáctenos para agendar una visita.

Gracias,
Servicio Técnico de Gas`;
      } else {
        let message = `Estimado/a ${client.clientName},

Le recordamos que tiene los siguientes mantenimientos programados:

`;
        client.maintenance.forEach(maint => {
          message += `- ${maint.componentName} en ${maint.address}: ${formatDateCorrectly(maint.nextMaintenanceDate)}\n`;
        });
        
        message += `
Por favor, contáctenos para agendar las visitas.

Gracias,
Servicio Técnico de Gas`;
        
        return message;
      }
      
    case 'followup':
      return `Estimado/a ${client.clientName},

Esperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.

Gracias por confiar en nosotros.

Saludos cordiales,
Servicio Técnico de Gas`;
      
    default:
      return 'Mensaje personalizado';
  }
}

/**
 * Aplica una plantilla personalizada a los datos del cliente
 * @param {string} template - Plantilla con variables
 * @param {Object} client - Datos del cliente
 * @returns {string} - Mensaje con variables reemplazadas
 */
function applyTemplate(template, client) {
  let message = template;
  const firstMaintenance = client.maintenance[0] || {};
  
  // Reemplazar variables básicas
  message = message.replace(/\{clientName\}/g, client.clientName || '')
                   .replace(/\{clientPhone\}/g, client.clientPhone || '');
  
  // Reemplazar variables de mantenimiento
  if (firstMaintenance) {
    message = message.replace(/\{componentName\}/g, firstMaintenance.componentName || '')
                     .replace(/\{address\}/g, firstMaintenance.address || '')
                     .replace(/\{nextMaintenanceDate\}/g, formatDateCorrectly(firstMaintenance.nextMaintenanceDate) || '')
                     .replace(/\{daysLeft\}/g, firstMaintenance.daysLeft || '');
  }
  
  return message;
}

/**
 * Formatea una fecha correctamente
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} - Fecha formateada
 */
function formatDateCorrectly(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Si no es una fecha válida, devolver el string original
    
    // Formatear como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error al formatear fecha:', error);
    return dateString;
  }
}

/**
 * Función de pausa
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise} - Promesa que se resuelve después del tiempo especificado
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Muestra una alerta en la interfaz
 * @param {string} type - Tipo de alerta (success, danger, warning, info)
 * @param {string} message - Mensaje a mostrar
 * @param {number} duration - Duración en milisegundos
 */
function showAlert(type, message, duration = 5000) {
  // Verificar si existe una función global
  if (typeof window.showAlert === 'function') {
    window.showAlert(type, message, duration);
    return;
  }
  
  // Implementación alternativa
  let alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
    // Crear contenedor de alertas si no existe
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    alertContainer.style.zIndex = '9999';
    document.body.appendChild(alertContainer);
  }
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertElement);
  
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

// Exportar la función principal al ámbito global
window.loadNotifications = loadNotifications;/**
 * Componente para gestionar las notificaciones a clientes
 */
async function loadNotifications() {
  const notificationsSection = document.getElementById('notifications-section');
  
  if (!notificationsSection) {
    console.error('No se encontró el contenedor para la sección de notificaciones');
    return;
  }
  
  try {
    // Mostrar indicador de carga mientras se inicializa
    notificationsSection.innerHTML = `
      <h2 class="mb-4">Notificaciones</h2>
      <div class="d-flex justify-content-center align-items-center" style="min-height: 300px;">
        <div class="text-center">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p>Cargando clientes para notificar...</p>
        </div>
      </div>
    `;
    
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

/**
 * Genera items de notificación a partir de mantenimientos
 * @param {Array} maintenanceList - Lista de mantenimientos próximos
 * @returns {Array} - Items de notificación agrupados por cliente
 */
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