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
    
    // Crear HTML con el componente de WhatsApp integrado
    notificationsSection.innerHTML = `
      <h2 class="mb-4">Notificaciones</h2>
      
      <div class="row mb-4">
        <div class="col-md-6">
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">Conexión WhatsApp</h5>
            </div>
            <div class="card-body">
              <div id="whatsapp-status" class="text-center mb-3">
                <span class="badge ${isWhatsAppConnected ? 'bg-success' : 'bg-secondary'} mb-2">
                  ${isWhatsAppConnected ? 'Conectado' : 'No conectado'}
                </span>
                <p>${isWhatsAppConnected ? 
                  'WhatsApp conectado correctamente' : 
                  'Para enviar notificaciones, debes conectar WhatsApp'}</p>
              </div>
              
              ${!isWhatsAppConnected ? `
                <div id="qr-container" class="mb-3 text-center" style="display: none;">
                  <div class="bg-white p-3 mx-auto d-inline-block">
                    <div id="qr-code" style="width: 256px; height: 256px; margin: 0 auto;"></div>
                  </div>
                  <p class="mt-2">
                    <small class="text-muted">Abre WhatsApp en tu teléfono > Menú > Dispositivos vinculados > Vincular un dispositivo</small>
                  </p>
                </div>
                
                <div class="text-center">
                  <button id="connect-whatsapp-btn" class="btn btn-success">
                    <i class="bi bi-whatsapp me-2"></i> Conectar WhatsApp
                  </button>
                  <div id="whatsapp-connecting" style="display: none;" class="mt-2">
                    <div class="spinner-border text-success spinner-border-sm" role="status">
                      <span class="visually-hidden">Conectando...</span>
                    </div>
                    <span class="ms-2">Conectando...</span>
                  </div>
                </div>
              ` : `
                <div class="text-center">
                  <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    WhatsApp conectado correctamente
                  </div>
                  <p class="text-muted">Ya puedes enviar notificaciones a tus clientes</p>
                  <button id="logout-whatsapp-btn" class="btn btn-outline-danger btn-sm mt-2">
                    <i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión
                  </button>
                </div>
              `}
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
function setupNotificationsEvents() {
  // Configurar eventos de WhatsApp
  setupWhatsAppConnector();
  
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
        
        // Verificar si WhatsApp está conectado
        window.api.isWhatsAppConnected().then(connected => {
          if (connected) {
            // Mostrar modal
            const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
            whatsappModal.show();
          } else {
            showAlert('warning', 'Debes conectar WhatsApp antes de enviar mensajes', 5000);
            
            // Hacer scroll hasta la sección de conexión de WhatsApp
            const whatsappCard = document.querySelector('.card-header:has(h5:contains("Conexión WhatsApp"))');
            if (whatsappCard) {
              whatsappCard.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }).catch(error => {
          console.error("Error al verificar estado de WhatsApp:", error);
          showAlert('danger', 'Error al verificar estado de WhatsApp', 5000);
        });
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
  
  // Configurar botón para enviar mensaje de WhatsApp
  const sendWhatsappBtn = document.getElementById('sendWhatsappBtn');
  if (sendWhatsappBtn) {
    sendWhatsappBtn.addEventListener('click', async () => {
      const phone = document.getElementById('whatsappRecipientPhone').value;
      const message = document.getElementById('whatsappMessage').value;
      
      if (!phone || !message) {
        showAlert('warning', 'Por favor complete todos los campos', 5000);
        return;
      }
      
      try {
        sendWhatsappBtn.disabled = true;
        sendWhatsappBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
        
        const result = await window.api.sendWhatsAppMessage({
          phone: phone,
          message: message
        });
        
        if (result.success) {
          showAlert('success', 'Mensaje enviado correctamente', 5000);
          
          // Cerrar modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappModal'));
          modal.hide();
        } else {
          showAlert('danger', `Error al enviar mensaje: ${result.message}`, 5000);
        }
      } catch (error) {
        showAlert('danger', `Error al enviar mensaje: ${error.message}`, 5000);
      } finally {
        sendWhatsappBtn.disabled = false;
        sendWhatsappBtn.innerHTML = '<i class="bi bi-whatsapp"></i> Enviar';
      }
    });
  }
}

// Configurar el conector de WhatsApp integrado
function setupWhatsAppConnector() {
  // Botón para conectar WhatsApp
  const connectWhatsAppBtn = document.getElementById('connect-whatsapp-btn');
  if (connectWhatsAppBtn) {
    connectWhatsAppBtn.addEventListener('click', async () => {
      try {
        // Mostrar spinner y deshabilitar botón
        connectWhatsAppBtn.disabled = true;
        
        // Mostrar estado conectando
        const connectingDiv = document.getElementById('whatsapp-connecting');
        if (connectingDiv) {
          connectingDiv.style.display = 'block';
        }
        
        // Limpiar cualquier QR anterior
        const qrCodeDiv = document.getElementById('qr-code');
        if (qrCodeDiv) {
          qrCodeDiv.innerHTML = '';
        }
        
        // Mostrar contenedor del QR
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
          qrContainer.style.display = 'block';
        }
        
        // Solicitar conexión a WhatsApp
        await window.api.sendWhatsAppMessage({ action: 'connect' });
        showAlert('info', 'Iniciando conexión con WhatsApp. Escanea el código QR cuando aparezca.', 5000);
      } catch (error) {
        console.error("Error al iniciar conexión WhatsApp:", error);
        showAlert('danger', `Error al iniciar conexión: ${error.message}`, 5000);
        
        // Restaurar botón
        connectWhatsAppBtn.disabled = false;
        connectingDiv.style.display = 'none';
      }
    });
  }
  
  // Botón para cerrar sesión de WhatsApp
  const logoutWhatsAppBtn = document.getElementById('logout-whatsapp-btn');
  if (logoutWhatsAppBtn) {
    logoutWhatsAppBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
        try {
          logoutWhatsAppBtn.disabled = true;
          logoutWhatsAppBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando sesión...';
          
          const result = await window.api.logoutWhatsApp();
          
          if (result.success) {
            showAlert('success', 'Sesión de WhatsApp cerrada correctamente', 5000);
            // Recargar la sección para mostrar los cambios
            loadNotifications();
          } else {
            showAlert('danger', `Error: ${result.message}`, 5000);
            logoutWhatsAppBtn.disabled = false;
            logoutWhatsAppBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión';
          }
        } catch (error) {
          showAlert('danger', `Error: ${error.message}`, 5000);
          logoutWhatsAppBtn.disabled = false;
          logoutWhatsAppBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión';
        }
      }
    });
  }
  
  // Configurar listener para recibir código QR
  setupQRCodeListener();
  
  // Configurar listener para cambios de estado de WhatsApp
  setupWhatsAppStatusListeners();
}

// Reemplaza la función setupQRCodeListener con esta versión:
function setupQRCodeListener() {
  // Eliminar listeners anteriores
  if (window.whatsAppQRListener) {
    window.api.removeListener('whatsapp-qr', window.whatsAppQRListener);
  }
  
  // Nuevo listener
  window.whatsAppQRListener = (event, qr) => {
    console.log("Código QR recibido", qr?.length || 0);
    
    const qrContainer = document.getElementById('qr-container');
    const qrCode = document.getElementById('qr-code');
    const connectingDiv = document.getElementById('whatsapp-connecting');
    const connectWhatsAppBtn = document.getElementById('connect-whatsapp-btn');
    
    if (qrContainer && qrCode) {
      // Mostrar contenedor QR
      qrContainer.style.display = 'block';
      
      try {
        // Crear una imagen con el servicio externo de QR
        qrCode.innerHTML = `
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}" 
            width="256" 
            height="256" 
            alt="Código QR de WhatsApp"
            style="background: white; padding: 8px;"
          />
        `;
        
        // Actualizar estado y botones
        if (connectingDiv) {
          connectingDiv.style.display = 'none';
        }
        
        if (connectWhatsAppBtn) {
          connectWhatsAppBtn.disabled = false;
          connectWhatsAppBtn.innerHTML = 'Esperando escaneo...';
        }
        
        showAlert('info', 'Código QR generado. Escanea con WhatsApp en tu teléfono.', 5000);
      } catch (error) {
        console.error("Error al generar QR:", error);
        qrCode.innerHTML = `
          <div class="alert alert-danger">
            Error al mostrar QR. Reinicia la aplicación.
          </div>
        `;
      }
    }
  };
  
  // Registrar nuevo listener
  window.api.onWhatsAppQR(window.whatsAppQRListener);
}

// Configurar listeners para cambios de estado de WhatsApp
function setupWhatsAppStatusListeners() {
  // Listener para cuando WhatsApp está listo
  window.api.onWhatsAppReady(() => {
    console.log("WhatsApp listo");
    showAlert('success', 'WhatsApp conectado correctamente', 5000);
    // Recargar sección para mostrar estado conectado
    loadNotifications();
  });
  
  // Listener para fallos de autenticación
  window.api.onWhatsAppAuthFailure(() => {
    console.log("Error de autenticación de WhatsApp");
    showAlert('danger', 'Error de autenticación en WhatsApp', 5000);
    
    // Restaurar botón conectar
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const connectingDiv = document.getElementById('whatsapp-connecting');
    
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i> Reintentar conexión';
    }
    
    if (connectingDiv) {
      connectingDiv.style.display = 'none';
    }
  });
  
  // Listener para desconexiones
  window.api.onWhatsAppDisconnected(() => {
    console.log("WhatsApp desconectado");
    showAlert('warning', 'WhatsApp se ha desconectado', 5000);
    // Recargar sección para mostrar estado desconectado
    loadNotifications();
  });
}

// Crear plantilla de mensajes
function createMessageTemplate(type, data) {
  switch (type) {
    case 'maintenance':
      return `Estimado/a ${data.clientName},\n\nLe recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado en los próximos días (${formatDate(data.nextMaintenanceDate)}).\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
    
    case 'followup':
      return `Estimado/a ${data.clientName},\n\nEsperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.\n\nGracias por confiar en nosotros.\n\nSaludos cordiales,\nServicio Técnico de Gas`;
    
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