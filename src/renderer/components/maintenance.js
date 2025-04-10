// Gestión de mantenimientos - Versión corregida

// Cargar la sección de mantenimientos
async function loadMaintenance() {
  const maintenanceSection = document.getElementById('maintenance-section');
  
  try {
    // Obtener datos
    let upcomingMaintenance = [];
    let installations = [];
    let clients = [];
    
    try {
      upcomingMaintenance = await window.api.getUpcomingMaintenance() || [];
      console.log("Mantenimientos próximos cargados:", upcomingMaintenance);
    } catch (error) {
      console.error("Error al cargar mantenimientos:", error);
      upcomingMaintenance = [];
    }
    
    try {
      installations = await window.api.getInstallations() || [];
      console.log("Instalaciones cargadas:", installations);
    } catch (error) {
      console.error("Error al cargar instalaciones:", error);
      installations = [];
    }
    
    try {
      clients = await window.api.getClients() || [];
      console.log("Clientes cargados:", clients);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      clients = [];
    }
    
    // Agrupar mantenimientos por urgencia
    const urgent = upcomingMaintenance.filter(m => m && m.daysLeft <= 7);
    const upcoming = upcomingMaintenance.filter(m => m && m.daysLeft > 7 && m.daysLeft <= 30);
    
    // Obtener estadísticas
    const totalInstallations = installations.length;
    const totalComponents = installations.reduce((sum, inst) => {
      return sum + (inst && inst.components ? inst.components.length : 0);
    }, 0);
    const componentsWithMaintenance = installations.reduce((sum, inst) => {
      if (!inst || !inst.components) return sum;
      return sum + inst.components.filter(c => c && c.nextMaintenanceDate).length;
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
    console.error("Error crítico en mantenimientos:", error);
    maintenanceSection.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error al cargar mantenimientos</h4>
        <p>${error.message}</p>
        <hr>
        <p class="mb-0">Verifica la consola para más detalles.</p>
      </div>
    `;
  }
}

// Renderizar opciones de clientes para el select
function renderClientOptions(clients) {
  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return '';
  }
  
  return clients.map(client => {
    if (!client || !client.id || !client.name) return '';
    return `<option value="${client.id}">${client.name}</option>`;
  }).join('');
}

// Renderizar tabla de mantenimientos - Versión corregida segura
function renderMaintenanceTable(maintenanceList, installations) {
  if (!maintenanceList || !Array.isArray(maintenanceList) || maintenanceList.length === 0) {
    return '';
  }
  
  return maintenanceList.map(maint => {
    if (!maint) return '';
    
    // Buscar la instalación para obtener la última fecha de mantenimiento
    let lastMaintenanceDate = '-';
    
    if (installations && Array.isArray(installations)) {
      const installation = installations.find(i => i && i.id === maint.installationId);
      
      if (installation && installation.components && Array.isArray(installation.components)) {
        const component = installation.components.find(c => c && c.id === maint.componentId);
        if (component && component.lastMaintenanceDate) {
          lastMaintenanceDate = formatDate(component.lastMaintenanceDate);
        }
      }
    }
    
    const clientName = maint.clientName || 'Cliente no encontrado';
    const componentName = maint.componentName || 'Componente no encontrado';
    const address = maint.address || 'Sin dirección';
    const nextMaintenanceDate = maint.nextMaintenanceDate || '';
    const daysLeft = maint.daysLeft || 0;
    const clientId = maint.clientId || '';
    const installationId = maint.installationId || '';
    const componentId = maint.componentId || '';
    const clientPhone = maint.clientPhone || '';
    
    return `
      <tr class="${getRowClass(daysLeft)}" 
          data-client-id="${clientId}"
          data-urgency="${daysLeft <= 7 ? 'urgent' : 'upcoming'}">
        <td>${clientName}</td>
        <td>${componentName}</td>
        <td>${address}</td>
        <td>${lastMaintenanceDate}</td>
        <td>${formatDate(nextMaintenanceDate)}</td>
        <td>
          <span class="badge bg-${getBadgeColor(daysLeft)}">${daysLeft} días</span>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary register-maintenance-btn" 
                    data-installation-id="${installationId}"
                    data-component-id="${componentId}">
              <i class="bi bi-check-circle"></i> Registrar
            </button>
            <button class="btn btn-sm btn-outline-success send-maintenance-whatsapp-btn" 
                    data-client-id="${clientId}" 
                    data-client-name="${clientName}" 
                    data-client-phone="${clientPhone}"
                    data-component="${componentName}"
                    data-address="${address}"
                    data-date="${nextMaintenanceDate}">
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

// Configurar eventos para la sección de mantenimientos - Versión simplificada
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
  if (registerButtons && registerButtons.length > 0) {
    registerButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const installationId = button.getAttribute('data-installation-id');
        const componentId = button.getAttribute('data-component-id');
        
        alert(`Registrando mantenimiento para la instalación ${installationId}, componente ${componentId}`);
      });
    });
  }
  
  // Botones para enviar WhatsApp - Simplificado para pruebas
  const whatsappButtons = document.querySelectorAll('.send-maintenance-whatsapp-btn');
  if (whatsappButtons && whatsappButtons.length > 0) {
    whatsappButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientName = button.getAttribute('data-client-name');
        alert(`Enviando WhatsApp a ${clientName}`);
      });
    });
  }
  
  // Botón para notificar a todos - Simplificado para pruebas
  const notifyAllButton = document.getElementById('notifyAllButton');
  if (notifyAllButton) {
    notifyAllButton.addEventListener('click', () => {
      alert('Enviando notificaciones a todos los clientes');
    });
  }
}

// Filtrar mantenimientos según los criterios seleccionados
function filterMaintenance() {
  const clientFilter = document.getElementById('maintenanceClientFilter');
  const urgencyFilter = document.getElementById('maintenanceUrgencyFilter');
  
  if (!clientFilter || !urgencyFilter) return;
  
  const clientValue = clientFilter.value;
  const urgencyValue = urgencyFilter.value;
  
  const maintenanceRows = document.querySelectorAll('#maintenance-table-body tr');
  if (!maintenanceRows || maintenanceRows.length === 0) return;
  
  maintenanceRows.forEach(row => {
    const clientId = row.getAttribute('data-client-id');
    const urgency = row.getAttribute('data-urgency');
    
    const clientMatch = !clientValue || clientId === clientValue;
    const urgencyMatch = !urgencyValue || urgency === urgencyValue;
    
    if (clientMatch && urgencyMatch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Formatear fecha - Versión segura
function formatDate(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return '-';
  }
}

// Exportar funciones
window.loadMaintenance = loadMaintenance;