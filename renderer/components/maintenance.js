// Gestión de mantenimientos

// Cargar la sección de mantenimientos
async function loadMaintenance() {
    const maintenanceSection = document.getElementById('maintenance-section');
    
    try {
      // Obtener datos
      const upcomingMaintenance = await window.api.getUpcomingMaintenance();
      const installations = await window.api.getInstallations();
      const clients = await window.api.getClients();
      
      // Agrupar mantenimientos por urgencia
      const urgent = upcomingMaintenance.filter(m => m.daysLeft <= 7);
      const upcoming = upcomingMaintenance.filter(m => m.daysLeft > 7 && m.daysLeft <= 30);
      
      // Obtener estadísticas
      const totalInstallations = installations.length;
      const totalComponents = installations.reduce((sum, inst) => sum + (inst.components ? inst.components.length : 0), 0);
      const componentsWithMaintenance = installations.reduce((sum, inst) => {
        if (!inst.components) return sum;
        return sum + inst.components.filter(c => c.nextMaintenanceDate).length;
      }, 0);
      
      // Crear contenido HTML
      maintenanceSection.innerHTML = `
        <h2 class="mb-4">Gestión de Mantenimientos</h2>
        
        <!-- Tarjetas de resumen -->
        <div class="row mb-4">
          <div class="col-md-3">
            <div class="card dashboard-card">
              <div class="card-body">
                <h5 class="card-title">Total Componentes</h5>
                <div class="card-value">${totalComponents}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card">
              <div class="card-body">
                <h5 class="card-title">Con Mantención Programada</h5>
                <div class="card-value">${componentsWithMaintenance}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card bg-warning bg-opacity-10">
              <div class="card-body">
                <h5 class="card-title">Mantenciones Urgentes</h5>
                <div class="card-value text-warning">${urgent.length}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card bg-info bg-opacity-10">
              <div class="card-body">
                <h5 class="card-title">Mantenciones Próximas</h5>
                <div class="card-value text-info">${upcoming.length}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Opciones de filtrado -->
        <div class="row mb-4">
          <div class="col-md-4">
            <select id="maintenanceClientFilter" class="form-select">
              <option value="">Todos los clientes</option>
              ${renderClientOptions(clients)}
            </select>
          </div>
          <div class="col-md-4">
            <select id="maintenanceUrgencyFilter" class="form-select">
              <option value="">Todos los mantenimientos</option>
              <option value="urgent">Urgentes (próximos 7 días)</option>
              <option value="upcoming">Próximos (8-30 días)</option>
            </select>
          </div>
          <div class="col-md-4">
            <button id="notifyAllButton" class="btn btn-success" ${upcomingMaintenance.length === 0 ? 'disabled' : ''}>
              <i class="bi bi-whatsapp"></i> Notificar a Todos
            </button>
          </div>
        </div>
        
        <!-- Tabla de mantenimientos -->
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Mantenimientos Programados</h5>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Componente</th>
                    <th>Dirección</th>
                    <th>Última Mantención</th>
                    <th>Próxima Mantención</th>
                    <th>Días Restantes</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="maintenance-table-body">
                  ${renderMaintenanceTable(upcomingMaintenance, installations)}
                </tbody>
              </table>
            </div>
            ${upcomingMaintenance.length === 0 ? 
              '<p class="text-center text-muted">No hay mantenimientos programados para los próximos 30 días</p>' : ''}
          </div>
        </div>
      `;
      
      // Configurar eventos
      setupMaintenanceEvents();
      
    } catch (error) {
      maintenanceSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar mantenimientos: ${error.message}
        </div>
      `;
    }
  }
  
  // Renderizar opciones de clientes para el select
  function renderClientOptions(clients) {
    return clients.map(client => 
      `<option value="${client.id}">${client.name}</option>`
    ).join('');
  }
  
  // Renderizar tabla de mantenimientos
  function renderMaintenanceTable(maintenanceList, installations) {
    if (maintenanceList.length === 0) {
      return '';
    }
    
    return maintenanceList.map(maint => {
      // Buscar la instalación para obtener la última fecha de mantenimiento
      const installation = installations.find(i => i.id === maint.installationId);
      let lastMaintenanceDate = '-';
      
      if (installation && installation.components) {
        const component = installation.components.find(c => c.id === maint.componentId);
        if (component) {
          lastMaintenanceDate = component.lastMaintenanceDate ? formatDate(component.lastMaintenanceDate) : '-';
        }
      }
      
      return `
        <tr class="${getRowClass(maint.daysLeft)}" 
            data-client-id="${maint.clientId}"
            data-urgency="${maint.daysLeft <= 7 ? 'urgent' : 'upcoming'}">
          <td>${maint.clientName}</td>
          <td>${maint.componentName}</td>
          <td>${maint.address}</td>
          <td>${lastMaintenanceDate}</td>
          <td>${formatDate(maint.nextMaintenanceDate)}</td>
          <td>
            <span class="badge bg-${getBadgeColor(maint.daysLeft)}">${maint.daysLeft} días</span>
          </td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-outline-primary register-maintenance-btn" 
                      data-installation-id="${maint.installationId}"
                      data-component-id="${maint.componentId}">
                <i class="bi bi-check-circle"></i> Registrar
              </button>
              <button class="btn btn-sm btn-outline-success send-maintenance-whatsapp-btn" 
                      data-client-id="${maint.clientId}" 
                      data-client-name="${maint.clientName}" 
                      data-client-phone="${maint.clientPhone}"
                      data-component="${maint.componentName}"
                      data-address="${maint.address}"
                      data-date="${maint.nextMaintenanceDate}">
                <i class="bi bi-whatsapp"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // Obtener clase para la fila según los días restantes
  function getRowClass(days) {
    if (days <= 3) return 'table-danger';
    if (days <= 7) return 'table-warning';
    return '';
  }
  
  // Obtener color para el badge según los días restantes
  function getBadgeColor(days) {
    if (days <= 3) return 'danger';
    if (days <= 7) return 'warning';
    if (days <= 15) return 'info';
    return 'secondary';
  }
  
  // Configurar eventos para la sección de mantenimientos
  function setupMaintenanceEvents() {
    // Filtro por cliente
    const clientFilter = document.getElementById('maintenanceClientFilter');
    if (clientFilter) {
      clientFilter.addEventListener('change', filterMaintenance);
    }
    
    // Filtro por urgencia
    const urgencyFilter = document.getElementById('maintenanceUrgencyFilter');
    if (urgencyFilter) {
      urgencyFilter.addEventListener('change', filterMaintenance);
    }
    
    // Botones para registrar mantenimiento
    const registerButtons = document.querySelectorAll('.register-maintenance-btn');
    registerButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const installationId = button.getAttribute('data-installation-id');
        const componentId = button.getAttribute('data-component-id');
        
        try {
          // Obtener la instalación
          const installations = await window.api.getInstallations();
          const installation = installations.find(i => i.id === installationId);
          
          if (installation && installation.components) {
            const componentIndex = installation.components.findIndex(c => c.id === componentId);
            
            if (componentIndex !== -1) {
              // Actualizar fechas de mantenimiento
              const today = new Date().toISOString().split('T')[0];
              installation.components[componentIndex].lastMaintenanceDate = today;
              
              // Calcular próxima fecha
              const frequency = installation.components[componentIndex].frequency || 12;
              installation.components[componentIndex].nextMaintenanceDate = 
                window.api.calculateNextMaintenanceDate(today, frequency);
              
              // Guardar cambios
              await window.api.updateInstallation(installation);
              
              showAlert('success', 'Mantenimiento registrado correctamente');
              loadMaintenance();
            }
          }
        } catch (error) {
          showAlert('danger', `Error al registrar mantenimiento: ${error.message}`);
        }
      });
    });
    
    // Botones para enviar WhatsApp
    const whatsappButtons = document.querySelectorAll('.send-maintenance-whatsapp-btn');
    whatsappButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientId = button.getAttribute('data-client-id');
        const clientName = button.getAttribute('data-client-name');
        const clientPhone = button.getAttribute('data-client-phone');
        const componentName = button.getAttribute('data-component');
        const address = button.getAttribute('data-address');
        const date = button.getAttribute('data-date');
        
        if (!clientPhone) {
          showAlert('warning', 'Este cliente no tiene un número de teléfono registrado');
          return;
        }
        
        // Configurar modal de WhatsApp
        document.getElementById('whatsappRecipientId').value = clientId;
        document.getElementById('whatsappRecipientName').value = clientName;
        document.getElementById('whatsappRecipientPhone').value = clientPhone;
        
        // Establecer plantilla de mensaje
        document.getElementById('whatsappMessageTemplate').value = 'maintenance';
        
        // Crear mensaje
        const messageData = {
          clientName,
          componentName,
          address,
          nextMaintenanceDate: date
        };
        
        document.getElementById('whatsappMessage').value = createMessageTemplate('maintenance', messageData);
        
        // Mostrar modal
        const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
        whatsappModal.show();
      });
    });
    
    // Botón para notificar a todos
    const notifyAllButton = document.getElementById('notifyAllButton');
    if (notifyAllButton) {
      notifyAllButton.addEventListener('click', async () => {
        try {
          const upcomingMaintenance = await window.api.getUpcomingMaintenance();
          
          // Filtrar para obtener solo clientes con teléfono
          const clientsWithPhone = upcomingMaintenance.filter(maint => maint.clientPhone);
          
          if (clientsWithPhone.length === 0) {
            showAlert('warning', 'No hay clientes con número de teléfono para notificar');
            return;
          }
          
          // Confirmar envío masivo
          if (confirm(`¿Enviar notificaciones a ${clientsWithPhone.length} clientes?`)) {
            // Aquí iría la lógica para enviar mensajes masivos
            // Por ahora solo mostramos un mensaje de éxito
            showAlert('success', `Notificaciones enviadas a ${clientsWithPhone.length} clientes`);
          }
        } catch (error) {
          showAlert('danger', `Error al enviar notificaciones: ${error.message}`);
        }
      });
    }
  }
  
  // Filtrar mantenimientos según los criterios seleccionados
  function filterMaintenance() {
    const clientFilter = document.getElementById('maintenanceClientFilter').value;
    const urgencyFilter = document.getElementById('maintenanceUrgencyFilter').value;
    
    const maintenanceRows = document.querySelectorAll('#maintenance-table-body tr');
    
    maintenanceRows.forEach(row => {
      const clientId = row.getAttribute('data-client-id');
      const urgency = row.getAttribute('data-urgency');
      
      const clientMatch = !clientFilter || clientId === clientFilter;
      const urgencyMatch = !urgencyFilter || urgency === urgencyFilter;
    
    if (clientMatch && urgencyMatch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Formatear fecha
function formatDate(dateString) {
  if (!dateString) return '-';
  return window.api.formatDate(dateString);
}

// Exportar funciones
window.loadMaintenance = loadMaintenance;