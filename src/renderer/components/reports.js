// Generación de reportes y estadísticas

// Cargar sección de reportes
async function loadReports() {
  const reportsSection = document.getElementById('reports-section');
  
  try {
    // Obtener datos necesarios para los reportes
    const clients = await window.api.getClients();
    const installations = await window.api.getInstallations();
    const upcomingMaintenance = await window.api.getUpcomingMaintenance();
    
    // Crear contenido HTML
    reportsSection.innerHTML = `
      <h2 class="mb-4">Reportes y Estadísticas</h2>
      
      <div class="row mb-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Generar Reportes</h5>
            </div>
            <div class="card-body">
              <div class="list-group">
                <button class="list-group-item list-group-item-action" id="maintenanceReportBtn">
                  <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">Reporte de Mantenimientos</h5>
                    <small class="text-muted">PDF/Excel</small>
                  </div>
                  <p class="mb-1">Genera un reporte detallado de los mantenimientos programados y realizados en un periodo específico.</p>
                </button>
                
                <button class="list-group-item list-group-item-action" id="clientReportBtn">
                  <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">Reporte de Clientes</h5>
                    <small class="text-muted">PDF/Excel</small>
                  </div>
                  <p class="mb-1">Lista de clientes con sus instalaciones y componentes asociados.</p>
                </button>
                
                <button class="list-group-item list-group-item-action" id="installationTypeReportBtn">
                  <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">Reporte por Tipo de Instalación</h5>
                    <small class="text-muted">PDF/Excel</small>
                  </div>
                  <p class="mb-1">Análisis detallado por tipo de instalación (Residencial, Comercial, Industrial).</p>
                </button>
                
                <button class="list-group-item list-group-item-action" id="componentReportBtn">
                  <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">Reporte de Componentes</h5>
                    <small class="text-muted">PDF/Excel</small>
                  </div>
                  <p class="mb-1">Inventario de componentes instalados por marca, modelo y fecha de instalación.</p>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Exportar Datos</h5>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="exportTypeSelect" class="form-label">Selecciona qué exportar:</label>
                <select id="exportTypeSelect" class="form-select mb-2">
                  <option value="all">Todos los datos</option>
                  <option value="clients">Solo clientes</option>
                  <option value="installations">Solo instalaciones</option>
                  <option value="maintenance">Solo mantenimientos programados</option>
                </select>
              </div>
              
              <div class="mb-3">
                <label for="exportFormatSelect" class="form-label">Formato:</label>
                <select id="exportFormatSelect" class="form-select mb-3">
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="selectFolderCheck" checked>
                <label class="form-check-label" for="selectFolderCheck">
                  Seleccionar carpeta de destino
                </label>
              </div>
              
              <button id="exportDataBtn" class="btn btn-primary">
                <i class="bi bi-download"></i> Exportar Datos
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Gráficos y Estadísticas -->
      <div class="row">
        <!-- Distribución de tipos de instalación -->
        <div class="col-md-6 mb-4">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Distribución por Tipo de Instalación</h5>
            </div>
            <div class="card-body">
              <canvas id="installationTypeChart" height="250"></canvas>
            </div>
          </div>
        </div>
        
        <!-- Estado de mantenimientos -->
        <div class="col-md-6 mb-4">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Estado de Mantenimientos</h5>
            </div>
            <div class="card-body">
              <canvas id="maintenanceStatusChart" height="250"></canvas>
            </div>
          </div>
        </div>
        
        <!-- Componentes por cliente (top 10) -->
        <div class="col-md-12 mb-4">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Componentes por Cliente (Top 10)</h5>
            </div>
            <div class="card-body">
              <canvas id="componentsPerClientChart" height="200"></canvas>
            </div>
          </div>
        </div>
        
        <!-- Actividad mensual -->
        <div class="col-md-12">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Actividad Mensual (Mantenimientos)</h5>
            </div>
            <div class="card-body">
              <canvas id="monthlyActivityChart" height="200"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Configurar eventos y gráficos
    setupReportsEvents();
    renderCharts(clients, installations, upcomingMaintenance);
    
  } catch (error) {
    reportsSection.innerHTML = `
      <div class="alert alert-danger">
        Error al cargar reportes: ${error.message}
      </div>
    `;
  }
}

// Configurar eventos para la sección de reportes
function setupReportsEvents() {
// Botones de reportes
const maintenanceReportBtn = document.getElementById('maintenanceReportBtn');
const clientReportBtn = document.getElementById('clientReportBtn');
const installationTypeReportBtn = document.getElementById('installationTypeReportBtn');
const componentReportBtn = document.getElementById('componentReportBtn');

if (maintenanceReportBtn) {
  maintenanceReportBtn.addEventListener('click', () => {
    showReportConfigModal('maintenance');
  });
}

if (clientReportBtn) {
  clientReportBtn.addEventListener('click', () => {
    showReportConfigModal('clients');
  });
}

if (installationTypeReportBtn) {
  installationTypeReportBtn.addEventListener('click', () => {
    showReportConfigModal('installation-type');
  });
}

if (componentReportBtn) {
  componentReportBtn.addEventListener('click', () => {
    showReportConfigModal('components');
  });
}

// Botón de exportación
const exportDataBtn = document.getElementById('exportDataBtn');
if (exportDataBtn) {
  exportDataBtn.addEventListener('click', async () => {
    const exportType = document.getElementById('exportTypeSelect').value;
    const exportFormat = document.getElementById('exportFormatSelect').value;
    const selectFolder = document.getElementById('selectFolderCheck').checked;
    
    try {
      // Deshabilitar botón mientras se procesa la exportación
      exportDataBtn.disabled = true;
      const originalText = exportDataBtn.innerHTML;
      exportDataBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exportando...';
      
      showAlert('info', `Preparando exportación de ${exportType} en formato ${exportFormat}...`);
      
      // Solicitar al backend que exporte los datos
      const result = await window.api.exportData({
        dataType: exportType,
        format: exportFormat,
        selectFolder: selectFolder // Indicar si queremos seleccionar la carpeta de destino
      });
      
      if (result.success) {
        showAlert('success', `Datos exportados correctamente a: ${result.filePath}`);
      } else {
        showAlert('danger', `Error al exportar datos: ${result.message}`);
      }
    } catch (error) {
      console.error('Error al exportar datos:', error);
      showAlert('danger', `Error al exportar datos: ${error.message}`);
    } finally {
      // Restaurar botón
      exportDataBtn.disabled = false;
      exportDataBtn.innerHTML = originalText;
    }
  });
}
}

// Mostrar modal para configurar un reporte
function showReportConfigModal(reportType) {
let title = '';
let customFields = '';

switch (reportType) {
  case 'maintenance':
    title = 'Reporte de Mantenimientos';
    customFields = `
      <div class="row mb-3">
        <div class="col-md-6">
          <label for="reportStartDate" class="form-label">Fecha de inicio:</label>
          <input type="date" class="form-control" id="reportStartDate">
        </div>
        <div class="col-md-6">
          <label for="reportEndDate" class="form-label">Fecha de fin:</label>
          <input type="date" class="form-control" id="reportEndDate">
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Estado de mantenimiento:</label>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="pending" id="pendingCheck" checked>
          <label class="form-check-label" for="pendingCheck">
            Pendientes
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="completed" id="completedCheck" checked>
          <label class="form-check-label" for="completedCheck">
            Realizados
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="urgent" id="urgentCheck" checked>
          <label class="form-check-label" for="urgentCheck">
            Urgentes
          </label>
        </div>
      </div>
    `;
    break;
      case 'clients':
        title = 'Reporte de Clientes';
        customFields = `
          <div class="mb-3">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="includeInstallations" id="includeInstallations" checked>
              <label class="form-check-label" for="includeInstallations">
                Incluir instalaciones
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="includeComponents" id="includeComponents" checked>
              <label class="form-check-label" for="includeComponents">
                Incluir componentes
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="includeContactInfo" id="includeContactInfo" checked>
              <label class="form-check-label" for="includeContactInfo">
                Incluir información de contacto
              </label>
            </div>
          </div>
        `;
        break;
      case 'installation-type':
        title = 'Reporte por Tipo de Instalación';
        customFields = `
          <div class="mb-3">
            <label class="form-label">Tipos de instalación:</label>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="residential" id="residentialCheck" checked>
              <label class="form-check-label" for="residentialCheck">
                Residencial
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="commercial" id="commercialCheck" checked>
              <label class="form-check-label" for="commercialCheck">
                Comercial
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="industrial" id="industrialCheck" checked>
              <label class="form-check-label" for="industrialCheck">
                Industrial
              </label>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Agrupar por:</label>
            <select class="form-select" id="groupBySelect">
              <option value="client">Cliente</option>
              <option value="component">Componente</option>
              <option value="date">Fecha de instalación</option>
            </select>
          </div>
        `;
        break;
      case 'components':
        title = 'Reporte de Componentes';
        customFields = `
          <div class="mb-3">
            <label class="form-label">Filtrar por tipo de componente:</label>
            <input type="text" class="form-control" id="componentTypeFilter" placeholder="Ej: Caldera, Calefón, etc.">
          </div>
          <div class="mb-3">
            <label class="form-label">Ordenar por:</label>
            <select class="form-select" id="sortBySelect">
              <option value="name">Nombre</option>
              <option value="installation_date">Fecha de instalación</option>
              <option value="next_maintenance">Próximo mantenimiento</option>
              <option value="client">Cliente</option>
            </select>
          </div>
        `;
        break;
    }
    
    const modalHtml = `
      <div class="modal fade" id="reportConfigModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="reportConfigForm">
                <!-- Campos específicos del reporte -->
                ${customFields}
                
                <!-- Campos comunes -->
                <div class="mb-3">
                  <label for="reportFormatSelect" class="form-label">Formato de salida:</label>
                  <select class="form-select" id="reportFormatSelect">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
                
                <div class="form-check mb-3">
                  <input class="form-check-input" type="checkbox" value="includeCharts" id="includeCharts" checked>
                  <label class="form-check-label" for="includeCharts">
                    Incluir gráficos en el reporte
                  </label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="generateReportBtn">Generar Reporte</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Añadir modal al DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
    
    // Configurar evento para generar reporte
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
      generateReportBtn.addEventListener('click', () => {
        // En una implementación real, aquí recopilaríamos todos los valores del formulario
        // y enviaríamos al proceso principal para generar el reporte
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('reportConfigModal'));
        modal.hide();
        
        showAlert('info', 'Generando reporte...');
        
        // Simulamos tiempo de generación
        setTimeout(() => {
          showAlert('success', `Reporte de ${title} generado correctamente`);
        }, 2000);
      });
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('reportConfigModal'));
    modal.show();
    
    // Eliminar modal del DOM cuando se cierre
    document.getElementById('reportConfigModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  }
  
  // Renderizar gráficos estadísticos
  function renderCharts(clients, installations, upcomingMaintenance) {
    // Gráfico de distribución por tipo de instalación
    renderInstallationTypeChart(installations);
    
    // Gráfico de estado de mantenimientos
    renderMaintenanceStatusChart(installations);
    
    // Gráfico de componentes por cliente
    renderComponentsPerClientChart(clients, installations);
    
    // Gráfico de actividad mensual
    renderMonthlyActivityChart(installations);
  }
  
  // Gráfico de distribución por tipo de instalación
  function renderInstallationTypeChart(installations) {
    const ctx = document.getElementById('installationTypeChart');
    if (!ctx) return;
    
    // Contar instalaciones por tipo
    const typeCount = {
      'Residencial': 0,
      'Comercial': 0,
      'Industrial': 0,
      'No especificado': 0
    };
    
    installations.forEach(installation => {
      const type = installation.type || 'No especificado';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    // Crear gráfico
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(typeCount),
        datasets: [{
          data: Object.values(typeCount),
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(201, 203, 207, 0.7)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  // Gráfico de estado de mantenimientos
  function renderMaintenanceStatusChart(installations) {
    const ctx = document.getElementById('maintenanceStatusChart');
    if (!ctx) return;
    
    // Contar componentes por estado de mantenimiento
    let upToDate = 0;
    let upcoming = 0;
    let urgent = 0;
    let overdue = 0;
    let noMaintenance = 0;
    
    const today = new Date();
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        if (!component.nextMaintenanceDate) {
          noMaintenance++;
          return;
        }
        
        const nextDate = new Date(component.nextMaintenanceDate);
        const diffDays = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          overdue++;
        } else if (diffDays <= 7) {
          urgent++;
        } else if (diffDays <= 30) {
          upcoming++;
        } else {
          upToDate++;
        }
      });
    });
    
    // Crear gráfico
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Al día', 'Próximos', 'Urgentes', 'Vencidos', 'No programados'],
        datasets: [{
          data: [upToDate, upcoming, urgent, overdue, noMaintenance],
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 205, 86, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(201, 203, 207, 0.7)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
  
  // Gráfico de componentes por cliente (top 10)
  function renderComponentsPerClientChart(clients, installations) {
    const ctx = document.getElementById('componentsPerClientChart');
    if (!ctx) return;
    
    // Contar componentes por cliente
    const componentsByClient = {};
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      const clientId = installation.clientId;
      if (!componentsByClient[clientId]) {
        componentsByClient[clientId] = 0;
      }
      
      componentsByClient[clientId] += installation.components.length;
    });
    
    // Obtener nombres de clientes y ordenar por cantidad de componentes
    const clientData = [];
    for (const clientId in componentsByClient) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        clientData.push({
          name: client.name,
          count: componentsByClient[clientId]
        });
      }
    }
    
    // Ordenar y tomar los top 10
    clientData.sort((a, b) => b.count - a.count);
    const top10 = clientData.slice(0, 10);
    
    // Crear gráfico
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(c => c.name),
        datasets: [{
          label: 'Componentes',
          data: top10.map(c => c.count),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
  
  // Gráfico de actividad mensual (mantenimientos)
  function renderMonthlyActivityChart(installations) {
    const ctx = document.getElementById('monthlyActivityChart');
    if (!ctx) return;
    
    // Preparar datos mensuales
    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const maintenanceByMonth = Array(12).fill(0);
    
    // Para simplificar, asumimos que estamos en el año actual
    const currentYear = new Date().getFullYear();
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        if (!component.lastMaintenanceDate) return;
        
        const lastDate = new Date(component.lastMaintenanceDate);
        
        // Solo contar mantenimientos del año actual
        if (lastDate.getFullYear() === currentYear) {
          const month = lastDate.getMonth();
          maintenanceByMonth[month]++;
        }
      });
    });
    
    // Crear gráfico
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Mantenimientos realizados',
          data: maintenanceByMonth,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }
  
  // Exportar funciones
  window.loadReports = loadReports;