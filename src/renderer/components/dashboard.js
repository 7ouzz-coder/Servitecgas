// Componente principal para el dashboard - Versión corregida

// Cargar el dashboard
async function loadDashboard() {
  const dashboardSection = document.getElementById('dashboard-section');

  console.log("API disponible:", window.api);
console.log("getClients disponible:", window.api?.getClients);
console.log("getInstallations disponible:", window.api?.getInstallations);
console.log("getUpcomingMaintenance disponible:", window.api?.getUpcomingMaintenance);
  
  try {
    // Obtener datos necesarios para el dashboard
    let clients = [];
    let installations = [];
    let upcomingMaintenance = [];
    
    try {
      clients = await window.api.getClients();
      console.log("Clientes cargados:", clients);
    } catch (clientError) {
      console.error("Error al cargar clientes:", clientError);
      clients = [];
    }
    
    try {
      installations = await window.api.getInstallations();
      console.log("Instalaciones cargadas:", installations);
    } catch (installError) {
      console.error("Error al cargar instalaciones:", installError);
      installations = [];
    }
    
    try {
      upcomingMaintenance = await window.api.getUpcomingMaintenance();
      console.log("Mantenimientos cargados:", upcomingMaintenance);
    } catch (maintError) {
      console.error("Error al cargar mantenimientos:", maintError);
      upcomingMaintenance = [];
    }
    
    // Obtener estadísticas
    const totalClients = clients.length || 0;
    const totalInstallations = installations.length || 0;
    const totalComponents = installations.reduce((sum, inst) => {
      return sum + (inst.components ? inst.components.length : 0);
    }, 0);
    const pendingMaintenance = upcomingMaintenance.length || 0;
    
    // Obtener instalaciones agrupadas por tipo
    const installationTypes = {};
    installations.forEach(inst => {
      const type = inst.type || 'No especificado';
      installationTypes[type] = (installationTypes[type] || 0) + 1;
    });
    
    // Crear el contenido HTML del dashboard
    dashboardSection.innerHTML = `
      <h2 class="mb-4">Dashboard</h2>
      
      <!-- Tarjetas de resumen -->
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card dashboard-card">
            <div class="card-body">
              <h5 class="card-title">Clientes</h5>
              <div class="card-value">${totalClients}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card">
            <div class="card-body">
              <h5 class="card-title">Instalaciones</h5>
              <div class="card-value">${totalInstallations}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card">
            <div class="card-body">
              <h5 class="card-title">Componentes</h5>
              <div class="card-value">${totalComponents}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card ${pendingMaintenance > 0 ? 'bg-warning bg-opacity-10' : ''}">
            <div class="card-body">
              <h5 class="card-title">Mantenciones Pendientes</h5>
              <div class="card-value ${pendingMaintenance > 0 ? 'text-warning' : ''}">${pendingMaintenance}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Mantenimientos próximos -->
      <div class="row mb-4">
        <div class="col-md-8">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Mantenimientos Próximos</h5>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Componente</th>
                      <th>Dirección</th>
                      <th>Fecha</th>
                      <th>Días Restantes</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="maintenance-table-body">
                    ${renderMaintenanceTable(upcomingMaintenance)}
                  </tbody>
                </table>
              </div>
              ${upcomingMaintenance.length === 0 ? '<p class="text-center text-muted">No hay mantenimientos próximos</p>' : ''}
            </div>
          </div>
        </div>
        
        <!-- Distribución de instalaciones -->
        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Tipos de Instalaciones</h5>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderInstallationTypesTable(installationTypes)}
                  </tbody>
                </table>
              </div>
              ${installations.length === 0 ? '<p class="text-center text-muted">No hay instalaciones registradas</p>' : ''}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Clientes recientes -->
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Clientes Recientes</h5>
              <button class="btn btn-sm btn-primary" id="add-client-btn">Agregar Cliente</button>
            </div>
            <div class="card-body">
              <div class="row" id="recent-clients-container">
                ${renderRecentClients(clients)}
              </div>
              ${clients.length === 0 ? '<p class="text-center text-muted">No hay clientes registrados</p>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Configurar eventos
    setupDashboardEvents();
    
  } catch (error) {
    console.error("Error crítico en dashboard:", error);
    dashboardSection.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error al cargar el dashboard</h4>
        <p>${error.message}</p>
        <hr>
        <p class="mb-0">Verifica la consola para más detalles.</p>
      </div>
    `;
  }
}

// Renderizar tabla de mantenimientos - Versión simplificada
// Renderizar tabla de mantenimientos - Versión segura para dashboard
function renderMaintenanceTable(maintenanceList) {
  if (!maintenanceList || !Array.isArray(maintenanceList) || maintenanceList.length === 0) {
    return '';
  }
  
  return maintenanceList.slice(0, 5).map(maint => {
    if (!maint) return '';
    
    const clientName = maint.clientName || 'Cliente no encontrado';
    const componentName = maint.componentName || 'Componente no encontrado';
    const address = maint.address || 'Sin dirección';
    const nextMaintenanceDate = maint.nextMaintenanceDate || '';
    const daysLeft = maint.daysLeft || 0;
    const clientId = maint.clientId || '';
    const clientPhone = maint.clientPhone || '';
    
    return `
      <tr class="${daysLeft <= 7 ? 'table-warning' : ''}">
        <td>${clientName}</td>
        <td>${componentName}</td>
        <td>${address}</td>
        <td>${formatDate(nextMaintenanceDate)}</td>
        <td>
          <span class="badge bg-${getBadgeColor(daysLeft)}">${daysLeft} días</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary send-whatsapp-btn" 
                  data-client-id="${clientId}" 
                  data-client-name="${clientName}" 
                  data-client-phone="${clientPhone}"
                  data-component="${componentName}"
                  data-address="${address}"
                  data-date="${nextMaintenanceDate}">
            <i class="bi bi-whatsapp"></i> Notificar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizar tabla de tipos de instalaciones
function renderInstallationTypesTable(types) {
  if (!types || Object.keys(types).length === 0) {
    return '<tr><td colspan="2" class="text-center">No hay datos disponibles</td></tr>';
  }
  
  return Object.entries(types).map(([type, count]) => `
    <tr>
      <td>${type}</td>
      <td>${count}</td>
    </tr>
  `).join('');
}

// Renderizar clientes recientes
function renderRecentClients(clients) {
  if (!clients || clients.length === 0) {
    return '';
  }
  
  // Ordenar por fecha de creación (más recientes primero) si es posible
  const sortedClients = [...clients].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  });
  
  return sortedClients.slice(0, 6).map(client => `
    <div class="col-md-4 mb-3">
      <div class="card client-card h-100">
        <div class="card-body">
          <h5 class="card-title">${client.name || 'Cliente sin nombre'}</h5>
          <p class="card-text">
            <i class="bi bi-telephone"></i> ${client.phone || 'No registrado'}<br>
            <i class="bi bi-envelope"></i> ${client.email || 'No registrado'}
          </p>
          <a href="#" class="btn btn-sm btn-outline-primary view-client-btn" data-id="${client.id}">
            Ver detalles
          </a>
        </div>
      </div>
    </div>
  `).join('');
}

// Configurar eventos del dashboard - Versión simplificada
function setupDashboardEvents() {
  // Botón para agregar cliente
  const addClientBtn = document.getElementById('add-client-btn');
  if (addClientBtn) {
    addClientBtn.addEventListener('click', () => {
      // Verificar si el modal existe
      const clientModal = document.getElementById('clientModal');
      if (clientModal) {
        // Limpiar formulario si existe
        const clientForm = document.getElementById('clientForm');
        if (clientForm) {
          clientForm.reset();
        }
        
        // Actualizar título del modal si existe
        const clientModalLabel = document.getElementById('clientModalLabel');
        if (clientModalLabel) {
          clientModalLabel.textContent = 'Agregar Cliente';
        }
        
        // Limpiar ID oculto si existe
        const clientId = document.getElementById('clientId');
        if (clientId) {
          clientId.value = '';
        }
        
        // Mostrar modal
        try {
          const modal = new bootstrap.Modal(clientModal);
          modal.show();
        } catch (error) {
          console.error("Error al mostrar modal:", error);
          alert("No se pudo mostrar el modal de cliente. Verifica la consola para más detalles.");
        }
      } else {
        console.error("Modal de cliente no encontrado");
        alert("Modal de cliente no encontrado en el DOM");
      }
    });
  }
  
  // Botones para ver detalles de cliente - Simplificado
  const viewClientBtns = document.querySelectorAll('.view-client-btn');
  viewClientBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const clientId = btn.getAttribute('data-id');
      alert(`Se solicitó ver detalles del cliente con ID: ${clientId}`);
    });
  });
  
  // Botones para enviar WhatsApp - Simplificado
  const whatsappBtns = document.querySelectorAll('.send-whatsapp-btn');
  whatsappBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const clientId = btn.getAttribute('data-client-id');
      const clientName = btn.getAttribute('data-client-name');
      alert(`Se solicitó enviar WhatsApp al cliente ${clientName} (ID: ${clientId})`);
    });
  });
}

// Obtener color para el badge según los días restantes
function getBadgeColor(days) {
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  if (days <= 15) return 'info';
  return 'secondary';
}

// Formatear fecha - Versión segura
function formatDate(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return dateString || '-';
  }
}

// Exportar funciones
window.loadDashboard = loadDashboard;