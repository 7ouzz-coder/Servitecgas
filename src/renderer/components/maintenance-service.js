/**
 * Servicios relacionados con mantenimientos
 */

// Verificar si hay mantenimientos vencidos y notificar automáticamente
async function checkOverdueMaintenance(silentMode = false) {
    try {
      const maintenanceList = await window.api.getUpcomingMaintenance();
      if (!maintenanceList || !Array.isArray(maintenanceList)) return;
      
      // Filtrar mantenimientos vencidos (días negativos)
      const overdueMaintenances = maintenanceList.filter(maintenance => 
        maintenance && maintenance.daysLeft < 0
      );
      
      // Notificar automáticamente si hay mantenimientos vencidos y no estamos en modo silencioso
      if (overdueMaintenances.length > 0 && !silentMode) {
        // Agrupar por cliente para evitar múltiples notificaciones para el mismo cliente
        const clientGroups = {};
        
        overdueMaintenances.forEach(maint => {
          if (!clientGroups[maint.clientId]) {
            clientGroups[maint.clientId] = {
              clientName: maint.clientName,
              clientPhone: maint.clientPhone,
              components: []
            };
          }
          
          clientGroups[maint.clientId].components.push({
            name: maint.componentName,
            address: maint.address,
            days: Math.abs(maint.daysLeft)
          });
        });
        
        // Enviar notificaciones automáticas si está habilitado
        if (!silentMode && localStorage.getItem('autoNotifyEnabled') === 'true') {
          const config = JSON.parse(localStorage.getItem('notificationSchedule') || '{}');
          if (config.notifyOverdue) {
            console.log('Enviando notificaciones automáticas para mantenimientos vencidos...');
            for (const clientId in clientGroups) {
              const client = clientGroups[clientId];
              if (client.clientPhone) {
                sendAutomaticNotification(client);
              }
            }
          }
        }
        
        // Mostrar alerta en la interfaz
        if (!silentMode) {
          window.showAlert('warning', 
            `<strong>¡Atención!</strong> Hay ${overdueMaintenances.length} mantenimientos vencidos. 
             <a href="#" class="alert-link show-overdue-details">Ver detalles</a>`, 
            10000
          );
          
          // Configurar evento para mostrar detalles
          setTimeout(() => {
            const detailsLink = document.querySelector('.show-overdue-details');
            if (detailsLink) {
              detailsLink.addEventListener('click', (e) => {
                e.preventDefault();
                showOverdueDetailsModal(clientGroups);
              });
            }
          }, 100);
        }
        
        return overdueMaintenances;
      }
    } catch (error) {
      console.error("Error al verificar mantenimientos vencidos:", error);
      return [];
    }
  }
  
  // Enviar notificación automática
  async function sendAutomaticNotification(client) {
    if (!client || !client.clientPhone) return;
    
    try {
      // Primero verificar si WhatsApp está conectado
      const isConnected = await window.api.isWhatsAppConnected();
      if (!isConnected) {
        console.log("No se pueden enviar notificaciones automáticas: WhatsApp no está conectado");
        return;
      }
      
      // Crear mensaje para mantenimientos vencidos
      const message = createMaintenanceMessage(client.clientName, client.components, true);
      
      // Enviar mensaje
      const result = await window.api.sendWhatsAppMessage({
        phone: client.clientPhone,
        message: message
      });
      
      if (result.success) {
        console.log(`Notificación automática enviada a ${client.clientName}`);
      } else {
        console.error(`Error al enviar notificación automática a ${client.clientName}:`, result.message);
      }
    } catch (error) {
      console.error("Error al enviar notificación automática:", error);
    }
  }
  
  // Mostrar modal con detalles de mantenimientos vencidos
  function showOverdueDetailsModal(clientGroups) {
    // Crear modal para mostrar los detalles
    const overdueModal = document.createElement('div');
    
    // Preparar el contenido HTML para cada cliente y sus componentes
    let clientsHtml = '';
    
    Object.keys(clientGroups).forEach(clientId => {
      const client = clientGroups[clientId];
      
      // Crear lista de componentes
      const componentsHtml = client.components.map(comp => 
        `<li class="list-group-item d-flex justify-content-between align-items-center">
          ${comp.name} en ${comp.address}
          <span class="badge bg-danger rounded-pill">Vencido por ${comp.days} días</span>
        </li>`
      ).join('');
      
      // Agregar sección del cliente
      clientsHtml += `
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">${client.clientName}</h5>
            ${client.clientPhone ? 
              `<button class="btn btn-sm btn-success notify-client-btn" 
                       data-client-id="${clientId}" 
                       data-client-name="${client.clientName}" 
                       data-client-phone="${client.clientPhone}">
                <i class="bi bi-whatsapp me-1"></i> Notificar
              </button>` : 
              '<span class="badge bg-secondary">Sin teléfono</span>'}
          </div>
          <ul class="list-group list-group-flush">
            ${componentsHtml}
          </ul>
        </div>
      `;
    });
    
    // Crear el modal
    overdueModal.innerHTML = `
      <div class="modal fade" id="overdueMaintenanceModal" tabindex="-1" aria-labelledby="overdueMaintenanceModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning bg-opacity-10">
              <h5 class="modal-title" id="overdueMaintenanceModalLabel">
                <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                Mantenimientos Vencidos
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="alert alert-warning">
                <i class="bi bi-info-circle me-2"></i>
                Los siguientes mantenimientos están vencidos. Se recomienda contactar a los clientes para programar una visita.
              </p>
              ${clientsHtml}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" class="btn btn-warning" id="notifyAllOverdueBtn">
                <i class="bi bi-whatsapp me-1"></i> Notificar a Todos
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Agregar modal al DOM y mostrarlo
    document.body.appendChild(overdueModal.firstElementChild);
    const modal = new bootstrap.Modal(document.getElementById('overdueMaintenanceModal'));
    modal.show();
    
    // Configurar eventos para los botones de notificación
    document.querySelectorAll('.notify-client-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const clientId = btn.getAttribute('data-client-id');
        const clientName = btn.getAttribute('data-client-name');
        const clientPhone = btn.getAttribute('data-client-phone');
        
        // Obtener los componentes del cliente
        const client = clientGroups[clientId];
        if (!client) return;
        
        try {
          // Primero verificar si WhatsApp está conectado
          const isConnected = await window.api.isWhatsAppConnected();
          if (!isConnected) {
            window.showAlert('warning', 'WhatsApp no está conectado. Vaya a la sección de WhatsApp para conectarse.');
            return;
          }
          
          // Crear mensaje para mantenimientos vencidos
          const message = createMaintenanceMessage(clientName, client.components, true);
          
          // Configurar modal de WhatsApp
          document.getElementById('whatsappRecipientId').value = clientId;
          document.getElementById('whatsappRecipientName').value = clientName;
          document.getElementById('whatsappRecipientPhone').value = clientPhone;
          document.getElementById('whatsappMessage').value = message;
          
          // Mostrar modal de WhatsApp
          const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
          whatsappModal.show();
          
          // Ocultar modal de mantenimientos vencidos
          modal.hide();
        } catch (error) {
          console.error('Error al preparar notificación:', error);
          window.showAlert('danger', 'Error al preparar notificación: ' + error.message);
        }
      });
    });
    
    // Configurar botón de notificar a todos
    const notifyAllBtn = document.getElementById('notifyAllOverdueBtn');
    if (notifyAllBtn) {
      notifyAllBtn.addEventListener('click', async () => {
        try {
          // Primero verificar si WhatsApp está conectado
          const isConnected = await window.api.isWhatsAppConnected();
          if (!isConnected) {
            window.showAlert('warning', 'WhatsApp no está conectado. Vaya a la sección de WhatsApp para conectarse.');
            return;
          }
          
          const clientCount = Object.keys(clientGroups).filter(
            clientId => clientGroups[clientId].clientPhone
          ).length;
          
          if (clientCount === 0) {
            window.showAlert('warning', 'No hay clientes con número de teléfono para notificar');
            return;
          }
          
          if (confirm(`¿Está seguro de enviar notificaciones a ${clientCount} clientes?`)) {
            // Deshabilitar botón
            notifyAllBtn.disabled = true;
            notifyAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
            
            window.showAlert('info', `Enviando notificación a ${clientCount} clientes...`);
            
            // Contador de éxito
            let successCount = 0;
            let errorCount = 0;
            
            // Enviar mensajes
            for (const clientId in clientGroups) {
              const client = clientGroups[clientId];
              if (!client.clientPhone) continue;
              
              try {
                // Crear mensaje para mantenimientos vencidos
                const message = createMaintenanceMessage(client.clientName, client.components, true);
                
                // Enviar mensaje
                const result = await window.api.sendWhatsAppMessage({
                  phone: client.clientPhone,
                  message: message
                });
                
                if (result.success) {
                  successCount++;
                } else {
                  errorCount++;
                  console.error(`Error al enviar a ${client.clientName}:`, result.message);
                }
                
                // Pequeña pausa entre mensajes
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (error) {
                errorCount++;
                console.error(`Error al enviar a ${client.clientName}:`, error);
              }
            }
            
            // Cerrar modal
            modal.hide();
            
            // Mostrar resultado
            if (successCount > 0) {
              window.showAlert('success', `Se enviaron ${successCount} notificaciones correctamente${errorCount > 0 ? ` (${errorCount} fallaron)` : ''}`);
            } else {
              window.showAlert('danger', 'No se pudo enviar ninguna notificación');
            }
          }
        } catch (error) {
          console.error('Error al enviar notificaciones masivas:', error);
          window.showAlert('danger', 'Error al enviar notificaciones: ' + error.message);
          
          // Restaurar botón
          notifyAllBtn.disabled = false;
          notifyAllBtn.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Notificar a Todos';
        }
      });
    }
    
    // Eliminar del DOM cuando se cierre
    document.getElementById('overdueMaintenanceModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  }
  
  // Crear mensaje para mantenimiento
  function createMaintenanceMessage(clientName, components, isOverdue = false) {
    if (isOverdue) {
      // Mensaje para mantenimientos vencidos
      let componentsText = components.map(comp => 
        `• ${comp.name} en ${comp.address} (${comp.days ? `vencido por ${comp.days} días` : 'vencido'})`
      ).join('\n');
      
      return `Estimado/a ${clientName},\n\nLe informamos que tiene mantenimientos vencidos para los siguientes componentes:\n\n${componentsText}\n\nPor favor contáctenos para programar una visita técnica lo antes posible.\n\nGracias,\nServicio Técnico de Gas`;
    } else {
      // Mensaje para mantenimientos próximos
      let componentsText = components.map(comp => 
        `• ${comp.name} en ${comp.address} (${comp.days ? `en ${comp.days} días` : 'próximamente'})`
      ).join('\n');
      
      return `Estimado/a ${clientName},\n\nLe recordamos que tiene mantenimientos programados próximamente para los siguientes componentes:\n\n${componentsText}\n\nPor favor contáctenos para agendar una visita técnica.\n\nGracias,\nServicio Técnico de Gas`;
    }
  }
  
  // Verificar automáticamente los mantenimientos y enviar notificaciones
  function setupAutomaticNotifications() {
    console.log('Configurando sistema de notificaciones automáticas...');
    
    // Cargar configuración
    const config = JSON.parse(localStorage.getItem('notificationSchedule') || '{}');
    const checkFrequency = config.checkFrequency || 'daily';
    
    // Calcular intervalo según la frecuencia
    let interval = 24 * 60 * 60 * 1000; // Diario por defecto
    if (checkFrequency === 'weekly') {
      interval = 7 * 24 * 60 * 60 * 1000;
    }
    
    // Verificar mantenimientos vencidos y próximos según la configuración
    const checkMaintenance = async () => {
      console.log('Verificando mantenimientos automáticamente...');
      
      // Si las notificaciones automáticas están desactivadas, salir
      if (localStorage.getItem('autoNotifyEnabled') !== 'true') {
        console.log('Notificaciones automáticas desactivadas');
        return;
      }
      
      try {
        // Primero verificar si WhatsApp está conectado
        const isConnected = await window.api.isWhatsAppConnected();
        if (!isConnected) {
          console.log('WhatsApp no está conectado. No se pueden enviar notificaciones');
          return;
        }
        
        // Verificar mantenimientos vencidos
        await checkOverdueMaintenance(true); // True = modo silencioso
        
        // Verificar mantenimientos próximos
        if (config.notifyUpcoming) {
          await checkUpcomingMaintenance(config.notifyDays || 7);
        }
      } catch (error) {
        console.error('Error en verificación automática:', error);
      }
    };
    
    // Configurar intervalo de verificación
    const notificationInterval = setInterval(checkMaintenance, interval);
    
    // También verificar una vez al inicio
    setTimeout(checkMaintenance, 30000); // 30 segundos después de cargar para dar tiempo a que se conecte WhatsApp
    
    console.log(`Notificaciones automáticas configuradas, intervalo: ${checkFrequency}`);
    
    return notificationInterval;
  }
  
  // Verificar mantenimientos próximos y enviar notificaciones
  async function checkUpcomingMaintenance(daysBefore = 7) {
    try {
      const maintenanceList = await window.api.getUpcomingMaintenance();
      if (!maintenanceList || !Array.isArray(maintenanceList)) return;
      
      // Filtrar mantenimientos próximos según los días especificados
      const upcomingMaintenances = maintenanceList.filter(maintenance => 
        maintenance && maintenance.daysLeft >= 0 && maintenance.daysLeft <= daysBefore
      );
      
      // Notificar automáticamente si hay mantenimientos próximos
      if (upcomingMaintenances.length > 0) {
        // Agrupar por cliente para evitar múltiples notificaciones para el mismo cliente
        const clientGroups = {};
        
        upcomingMaintenances.forEach(maint => {
          if (!clientGroups[maint.clientId]) {
            clientGroups[maint.clientId] = {
              clientName: maint.clientName,
              clientPhone: maint.clientPhone,
              components: []
            };
          }
          
          clientGroups[maint.clientId].components.push({
            name: maint.componentName,
            address: maint.address,
            days: maint.daysLeft
          });
        });
        
        // Enviar notificaciones a cada cliente
        console.log(`Enviando notificaciones para ${upcomingMaintenances.length} mantenimientos próximos...`);
        
        for (const clientId in clientGroups) {
          const client = clientGroups[clientId];
          if (client.clientPhone) {
            await sendUpcomingNotification(client);
            
            // Pequeña pausa entre envíos
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        return upcomingMaintenances;
      }
    } catch (error) {
      console.error("Error al verificar mantenimientos próximos:", error);
      return [];
    }
  }
  
  // Enviar notificación de mantenimiento próximo
  async function sendUpcomingNotification(client) {
    if (!client || !client.clientPhone) return;
    
    try {
      // Primero verificar si WhatsApp está conectado
      const isConnected = await window.api.isWhatsAppConnected();
      if (!isConnected) {
        console.log("No se pueden enviar notificaciones: WhatsApp no está conectado");
        return;
      }
      
      // Crear mensaje para mantenimientos próximos
      const message = createMaintenanceMessage(client.clientName, client.components, false);
      
      // Enviar mensaje
      const result = await window.api.sendWhatsAppMessage({
        phone: client.clientPhone,
        message: message
      });
      
      if (result.success) {
        console.log(`Notificación de mantenimiento próximo enviada a ${client.clientName}`);
      } else {
        console.error(`Error al enviar notificación a ${client.clientName}:`, result.message);
      }
    } catch (error) {
      console.error("Error al enviar notificación de mantenimiento próximo:", error);
    }
  }
  
  // Exportar funciones
  window.maintenanceService = {
    checkOverdueMaintenance,
    sendAutomaticNotification,
    createMaintenanceMessage,
    setupAutomaticNotifications,
    checkUpcomingMaintenance,
    sendUpcomingNotification
  };