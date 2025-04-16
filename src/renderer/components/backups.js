// Componente para gestionar respaldos
// Cargar la sección de respaldos

async function loadBackupsSection() {
    const backupsSection = document.getElementById('backups-section');
    if (!backupsSection) return;
    
    try {
      // Obtener lista de respaldos
      const backups = await window.api.getBackupList();
      
      // Preparar HTML
      backupsSection.innerHTML = `
        <h2 class="mb-4">Respaldos y Restauración</h2>
        
        <div class="row mb-4">
          <div class="col-lg-6 mb-4">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Crear Respaldo</h5>
              </div>
              <div class="card-body">
                <p>Crea un respaldo completo de todos tus datos para prevenir pérdidas accidentales.</p>
                <p class="text-muted small">Los respaldos contienen toda la información de clientes, instalaciones y mantenimientos.</p>
                <div class="d-flex justify-content-between align-items-center">
                  <span class="badge bg-info">El sistema crea respaldos automáticos cada 7 días</span>
                  <button class="btn btn-primary" id="createBackupBtn">
                    <i class="bi bi-save me-1"></i> Crear Respaldo Ahora
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-lg-6 mb-4">
            <div class="card h-100">
              <div class="card-header">
                <h5 class="mb-0">Restaurar desde Respaldo</h5>
              </div>
              <div class="card-body">
                <p>Recupera tus datos desde un respaldo anterior.</p>
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Advertencia:</strong> Al restaurar un respaldo, se reemplazarán todos los datos actuales.
                </div>
                <div class="d-grid">
                  <button class="btn btn-outline-secondary" id="restoreBackupBtn">
                    <i class="bi bi-arrow-counterclockwise me-1"></i> Restaurar desde Respaldo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Respaldos Disponibles</h5>
            <button class="btn btn-sm btn-outline-secondary" id="refreshBackupsBtn">
              <i class="bi bi-arrow-repeat"></i> Actualizar
            </button>
          </div>
          <div class="card-body">
            ${renderBackupsList(backups)}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Opciones Avanzadas</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <div class="d-grid">
                  <button class="btn btn-outline-primary mb-3" id="exportDatabaseBtn">
                    <i class="bi bi-download me-1"></i> Exportar Base de Datos
                  </button>
                </div>
                <p class="text-muted small">Exporta todos los datos a un archivo que puedes guardar donde quieras.</p>
              </div>
              <div class="col-md-6">
                <div class="d-grid">
                  <button class="btn btn-outline-warning mb-3" id="importDatabaseBtn">
                    <i class="bi bi-upload me-1"></i> Importar Base de Datos
                  </button>
                </div>
                <p class="text-muted small">Importa datos desde un archivo exportado previamente.</p>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Configurar eventos
      setupBackupsEvents();
    } catch (error) {
      console.error('Error al cargar sección de respaldos:', error);
      
      // Mostrar mensaje de error
      backupsSection.innerHTML = `
        <h2 class="mb-4">Respaldos y Restauración</h2>
        
        <div class="alert alert-danger">
          <h4><i class="bi bi-x-circle-fill me-2"></i>Error</h4>
          <p>Se produjo un error al cargar la sección de respaldos.</p>
          <p class="text-muted small">Error: ${error.message || 'Error desconocido'}</p>
        </div>
        
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0">Crear Respaldo</h5>
          </div>
          <div class="card-body">
            <p>Aún puedes crear un respaldo manual:</p>
            <button class="btn btn-primary" id="createBackupBtn">
              <i class="bi bi-save me-1"></i> Crear Respaldo Ahora
            </button>
          </div>
        </div>
      `;
      
      // Configurar evento básico para crear respaldo
      const createBackupBtn = document.getElementById('createBackupBtn');
      if (createBackupBtn) {
        createBackupBtn.addEventListener('click', handleCreateBackup);
      }
    }
  }
  
  /**
   * Renderiza la lista de respaldos disponibles
   * @param {Array} backups - Lista de respaldos
   * @returns {string} - HTML con la lista de respaldos
   */
  function renderBackupsList(backups) {
    if (!backups || backups.length === 0) {
      return `
        <div class="text-center py-4">
          <i class="bi bi-folder text-muted" style="font-size: 2rem;"></i>
          <p class="mt-2 text-muted">No hay respaldos disponibles</p>
        </div>
      `;
    }
    
    // Ordenar por fecha (más reciente primero)
    backups.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Función para formatear tamaño
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    // Función para formatear fecha
    const formatDate = (date) => {
      if (!date) return 'Fecha desconocida';
      try {
        const d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      } catch (error) {
        return date.toString();
      }
    };
    
    // Generar HTML para la tabla
    return `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Versión</th>
              <th>Entradas</th>
              <th>Tamaño</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${backups.map(backup => `
              <tr>
                <td>${formatDate(backup.date)}</td>
                <td>${backup.version || 'Desconocida'}</td>
                <td>Clientes: ${backup.entries?.clients || 0}, Instalaciones: ${backup.entries?.installations || 0}</td>
                <td>${formatSize(backup.size)}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary restore-backup-btn" data-path="${backup.path}" title="Restaurar este respaldo">
                      <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button class="btn btn-outline-secondary export-backup-btn" data-path="${backup.path}" title="Exportar respaldo">
                      <i class="bi bi-download"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  /**
   * Configurar eventos para la sección de respaldos
   */
  function setupBackupsEvents() {
    // Botón para crear respaldo
    const createBackupBtn = document.getElementById('createBackupBtn');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', handleCreateBackup);
    }
    
    // Botón para restaurar respaldo
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', handleRestoreBackup);
    }
    
    // Botón para actualizar lista de respaldos
    const refreshBackupsBtn = document.getElementById('refreshBackupsBtn');
    if (refreshBackupsBtn) {
      refreshBackupsBtn.addEventListener('click', () => {
        loadBackupsSection();
      });
    }
    
    // Botones para restaurar respaldos específicos
    const restoreButtons = document.querySelectorAll('.restore-backup-btn');
    restoreButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const backupPath = button.getAttribute('data-path');
        if (backupPath) {
          try {
            // Confirmar restauración
            if (confirm('¿Estás seguro de que quieres restaurar este respaldo? Se reemplazarán todos los datos actuales.')) {
              // Mostrar spinner
              button.disabled = true;
              const originalContent = button.innerHTML;
              button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
              
              // Restaurar respaldo
              const result = await window.api.restoreBackup(backupPath);
              
              if (result.success) {
                showAlert('success', 'Respaldo restaurado correctamente');
                
                // Recargar la sección después de la restauración
                loadBackupsSection();
              } else {
                showAlert('danger', `Error al restaurar respaldo: ${result.message || 'Error desconocido'}`);
                
                // Restaurar botón
                button.disabled = false;
                button.innerHTML = originalContent;
              }
            }
          } catch (error) {
            console.error('Error al restaurar respaldo:', error);
            showAlert('danger', `Error al restaurar respaldo: ${error.message || 'Error desconocido'}`);
            
            // Restaurar botón
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
          }
        }
      });
    });
    
    // Botones para exportar respaldos específicos
    const exportButtons = document.querySelectorAll('.export-backup-btn');
    exportButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const backupPath = button.getAttribute('data-path');
        if (backupPath) {
          // Esta función no está implementada en el backend, pero podría añadirse
          // Para copiar el respaldo a una ubicación seleccionada por el usuario
          alert('Funcionalidad en desarrollo: Exportar respaldo a ubicación personalizada');
        }
      });
    });
    
    // Botón para exportar base de datos
    const exportDatabaseBtn = document.getElementById('exportDatabaseBtn');
    if (exportDatabaseBtn) {
      exportDatabaseBtn.addEventListener('click', async () => {
        try {
          // Deshabilitar botón y mostrar progreso
          exportDatabaseBtn.disabled = true;
          const originalText = exportDatabaseBtn.innerHTML;
          exportDatabaseBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exportando...';
          
          // Exportar base de datos
          const result = await window.api.exportDatabase();
          
          if (result.success) {
            showAlert('success', `Base de datos exportada correctamente a: ${result.filePath}`);
          } else {
            showAlert('danger', `Error al exportar base de datos: ${result.message || 'Error desconocido'}`);
          }
        } catch (error) {
          console.error('Error al exportar base de datos:', error);
          showAlert('danger', `Error al exportar base de datos: ${error.message || 'Error desconocido'}`);
        } finally {
          // Restaurar botón
          exportDatabaseBtn.disabled = false;
          exportDatabaseBtn.innerHTML = '<i class="bi bi-download me-1"></i> Exportar Base de Datos';
        }
      });
    }
    
    // Botón para importar base de datos
    const importDatabaseBtn = document.getElementById('importDatabaseBtn');
    if (importDatabaseBtn) {
      importDatabaseBtn.addEventListener('click', async () => {
        try {
          // Confirmar importación
          if (confirm('¿Estás seguro de que quieres importar una base de datos? Se reemplazarán todos los datos actuales.')) {
            // Deshabilitar botón y mostrar progreso
            importDatabaseBtn.disabled = true;
            const originalText = importDatabaseBtn.innerHTML;
            importDatabaseBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Importando...';
            
            // Importar base de datos
            const result = await window.api.importDatabase();
            
            if (result.success) {
              showAlert('success', `Base de datos importada correctamente. Clientes: ${result.stats.clients}, Instalaciones: ${result.stats.installations}`);
              
              // Recargar la sección después de la importación
              loadBackupsSection();
            } else {
              showAlert('danger', `Error al importar base de datos: ${result.message || 'Error desconocido'}`);
            }
          }
        } catch (error) {
          console.error('Error al importar base de datos:', error);
          showAlert('danger', `Error al importar base de datos: ${error.message || 'Error desconocido'}`);
        } finally {
          // Restaurar botón
          importDatabaseBtn.disabled = false;
          importDatabaseBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Importar Base de Datos';
        }
      });
    }
  }
  
  /**
   * Manejar la creación de respaldo
   */
  async function handleCreateBackup() {
    try {
      // Obtener botón
      const createBackupBtn = document.getElementById('createBackupBtn');
      
      // Deshabilitar botón y mostrar progreso
      if (createBackupBtn) {
        createBackupBtn.disabled = true;
        const originalText = createBackupBtn.innerHTML;
        createBackupBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creando respaldo...';
      }
      
      // Crear respaldo
      const result = await window.api.createBackup();
      
      if (result.success) {
        showAlert('success', `Respaldo creado correctamente en: ${result.path}`);
        
        // Recargar la sección después de crear el respaldo
        loadBackupsSection();
      } else {
        showAlert('danger', `Error al crear respaldo: ${result.message || 'Error desconocido'}`);
        
        // Restaurar botón
        if (createBackupBtn) {
          createBackupBtn.disabled = false;
          createBackupBtn.innerHTML = '<i class="bi bi-save me-1"></i> Crear Respaldo Ahora';
        }
      }
    } catch (error) {
      console.error('Error al crear respaldo:', error);
      showAlert('danger', `Error al crear respaldo: ${error.message || 'Error desconocido'}`);
      
      // Restaurar botón
      const createBackupBtn = document.getElementById('createBackupBtn');
      if (createBackupBtn) {
        createBackupBtn.disabled = false;
        createBackupBtn.innerHTML = '<i class="bi bi-save me-1"></i> Crear Respaldo Ahora';
      }
    }
  }
  
  /**
   * Manejar la restauración de respaldo
   */
  async function handleRestoreBackup() {
    try {
      // Obtener botón
      const restoreBackupBtn = document.getElementById('restoreBackupBtn');
      
      // Deshabilitar botón y mostrar progreso
      if (restoreBackupBtn) {
        restoreBackupBtn.disabled = true;
        const originalText = restoreBackupBtn.innerHTML;
        restoreBackupBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Seleccionando respaldo...';
      }
      
      // Restaurar respaldo (sin path para abrir diálogo de selección)
      const result = await window.api.restoreBackup();
      
      if (result.success) {
        showAlert('success', `Respaldo restaurado correctamente. Clientes: ${result.stats.clients}, Instalaciones: ${result.stats.installations}`);
        
        // Recargar la sección después de la restauración
        loadBackupsSection();
      } else {
        showAlert('danger', `Error al restaurar respaldo: ${result.message || 'Error desconocido'}`);
        
        // Restaurar botón
        if (restoreBackupBtn) {
          restoreBackupBtn.disabled = false;
          restoreBackupBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i> Restaurar desde Respaldo';
        }
      }
    } catch (error) {
      console.error('Error al restaurar respaldo:', error);
      showAlert('danger', `Error al restaurar respaldo: ${error.message || 'Error desconocido'}`);
      
      // Restaurar botón
      const restoreBackupBtn = document.getElementById('restoreBackupBtn');
      if (restoreBackupBtn) {
        restoreBackupBtn.disabled = false;
        restoreBackupBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i> Restaurar desde Respaldo';
      }
    }
  }
  
  // Configurar evento para respaldos automáticos
  window.addEventListener('DOMContentLoaded', () => {
    // Escuchar eventos de respaldo automático creado
    window.api.onBackupCreated((backupInfo) => {
      // Mostrar notificación
      showAlert('info', `Respaldo automático creado: ${backupInfo.path}`, 5000);
    });
  });
  
  // Exportar funciones
  window.loadBackupsSection = loadBackupsSection;