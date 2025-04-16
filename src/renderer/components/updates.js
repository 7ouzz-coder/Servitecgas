// Componente para gestionar actualizaciones
// Cargar la sección de actualizaciones

async function loadUpdatesSection() {
    const updatesSection = document.getElementById('updates-section');
    if (!updatesSection) return;
    
    try {
      // Verificar actualizaciones
      const updateInfo = await window.api.checkUpdates().catch(() => ({ success: false }));
      
      // Preparar contenido HTML basado en el resultado
      let html = '';
      
      if (updateInfo.success) {
        // Si hay una actualización disponible
        if (updateInfo.hasUpdate) {
          html = `
            <h2 class="mb-4">Actualización Disponible</h2>
            
            <div class="alert alert-primary">
              <h4><i class="bi bi-arrow-up-circle-fill me-2"></i>Nueva versión disponible: ${updateInfo.updateInfo.version}</h4>
              <p>Tu versión actual es ${updateInfo.currentVersion}</p>
              <hr>
              <div class="mb-3">
                <strong>Novedades de esta versión:</strong>
                <pre class="mt-2 bg-light p-3 rounded">${updateInfo.updateInfo.notes || 'No hay notas disponibles para esta versión.'}</pre>
              </div>
              <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                <button class="btn btn-primary" id="downloadUpdateBtn">
                  <i class="bi bi-download me-1"></i> Descargar Actualización
                </button>
              </div>
            </div>
            
            <div class="card mt-4">
              <div class="card-header bg-light">
                <h5 class="mb-0">Historial de Versiones</h5>
              </div>
              <div class="card-body">
                <ul class="list-group">
                  <li class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                      <h5 class="mb-1">Versión ${updateInfo.currentVersion} (Actual)</h5>
                      <small>Instalada</small>
                    </div>
                    <p class="mb-1">Versión actual instalada en el sistema.</p>
                  </li>
                  ${renderUpdateHistory(updateInfo.updateInfo.previousVersions)}
                </ul>
              </div>
            </div>
          `;
        } else {
          // Si está actualizado
          html = `
            <h2 class="mb-4">Actualizaciones</h2>
            
            <div class="alert alert-success">
              <h4><i class="bi bi-check-circle-fill me-2"></i>Tu aplicación está actualizada</h4>
              <p>Estás utilizando la versión más reciente: ${updateInfo.currentVersion}</p>
            </div>
            
            <div class="card mt-4">
              <div class="card-header bg-light">
                <h5 class="mb-0">Comprobar Actualizaciones</h5>
              </div>
              <div class="card-body">
                <p>Puedes verificar manualmente si hay nuevas actualizaciones disponibles.</p>
                <button class="btn btn-primary" id="checkUpdatesBtn">
                  <i class="bi bi-arrow-repeat me-1"></i> Comprobar Actualizaciones
                </button>
              </div>
            </div>
            
            <div class="card mt-4">
              <div class="card-header bg-light">
                <h5 class="mb-0">Historial de Versiones</h5>
              </div>
              <div class="card-body">
                <ul class="list-group">
                  <li class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                      <h5 class="mb-1">Versión ${updateInfo.currentVersion} (Actual)</h5>
                      <small>Instalada</small>
                    </div>
                    <p class="mb-1">Versión actual instalada en el sistema.</p>
                  </li>
                  ${renderUpdateHistory(updateInfo.updateInfo.previousVersions)}
                </ul>
              </div>
            </div>
          `;
        }
      } else {
        // Si hubo un error
        html = `
          <h2 class="mb-4">Actualizaciones</h2>
          
          <div class="alert alert-warning">
            <h4><i class="bi bi-exclamation-triangle-fill me-2"></i>No se pudo verificar actualizaciones</h4>
            <p>No se pudo conectar con el servidor de actualizaciones. Inténtalo más tarde.</p>
            <p class="text-muted small">Error: ${updateInfo.message || 'Error desconocido'}</p>
          </div>
          
          <div class="card mt-4">
            <div class="card-header bg-light">
              <h5 class="mb-0">Comprobar Actualizaciones</h5>
            </div>
            <div class="card-body">
              <p>Puedes verificar manualmente si hay nuevas actualizaciones disponibles.</p>
              <button class="btn btn-primary" id="checkUpdatesBtn">
                <i class="bi bi-arrow-repeat me-1"></i> Comprobar Actualizaciones
              </button>
            </div>
          </div>
        `;
      }
      
      // Actualizar contenido de la sección
      updatesSection.innerHTML = html;
      
      // Configurar eventos
      setupUpdatesEvents(updateInfo);
    } catch (error) {
      console.error('Error al cargar sección de actualizaciones:', error);
      
      // Mostrar mensaje de error
      updatesSection.innerHTML = `
        <h2 class="mb-4">Actualizaciones</h2>
        
        <div class="alert alert-danger">
          <h4><i class="bi bi-x-circle-fill me-2"></i>Error</h4>
          <p>Se produjo un error al cargar la sección de actualizaciones.</p>
          <p class="text-muted small">Error: ${error.message || 'Error desconocido'}</p>
        </div>
        
        <div class="card mt-4">
          <div class="card-header bg-light">
            <h5 class="mb-0">Comprobar Actualizaciones</h5>
          </div>
          <div class="card-body">
            <p>Puedes verificar manualmente si hay nuevas actualizaciones disponibles.</p>
            <button class="btn btn-primary" id="checkUpdatesBtn">
              <i class="bi bi-arrow-repeat me-1"></i> Comprobar Actualizaciones
            </button>
          </div>
        </div>
      `;
      
      // Configurar evento para el botón de verificar
      setupBasicCheckButton();
    }
  }
  
  /**
   * Renderiza el historial de versiones anteriores
   * @param {Array} previousVersions - Lista de versiones anteriores
   * @returns {string} - HTML con el historial
   */
  function renderUpdateHistory(previousVersions) {
    if (!previousVersions || !Array.isArray(previousVersions) || previousVersions.length === 0) {
      return '';
    }
    
    return previousVersions.map(version => `
      <li class="list-group-item">
        <div class="d-flex w-100 justify-content-between">
          <h5 class="mb-1">Versión ${version.version}</h5>
          <small>${formatDate(version.date)}</small>
        </div>
        <p class="mb-1">${version.notes || 'No hay notas disponibles para esta versión.'}</p>
      </li>
    `).join('');
  }
  
  /**
   * Configurar eventos para la sección de actualizaciones
   * @param {Object} updateInfo - Información de la actualización
   */
  function setupUpdatesEvents(updateInfo) {
    // Botón para comprobar actualizaciones
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', async () => {
        try {
          // Deshabilitar botón y mostrar progreso
          checkUpdatesBtn.disabled = true;
          const originalText = checkUpdatesBtn.innerHTML;
          checkUpdatesBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Comprobando...';
          
          // Verificar actualizaciones
          const result = await window.api.checkUpdates();
          
          // Recargar sección con la nueva información
          loadUpdatesSection();
        } catch (error) {
          console.error('Error al comprobar actualizaciones:', error);
          showAlert('danger', `Error al comprobar actualizaciones: ${error.message || 'Error desconocido'}`);
          
          // Restaurar botón
          checkUpdatesBtn.disabled = false;
          checkUpdatesBtn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Comprobar Actualizaciones';
        }
      });
    }
    
    // Botón para descargar actualización
    const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
    if (downloadUpdateBtn && updateInfo && updateInfo.success && updateInfo.hasUpdate) {
      downloadUpdateBtn.addEventListener('click', () => {
        try {
          // Abrir navegador para descargar la actualización
          const url = updateInfo.updateInfo.url;
          window.open(url, '_blank');
        } catch (error) {
          console.error('Error al abrir URL de actualización:', error);
          showAlert('danger', `Error al abrir URL de actualización: ${error.message || 'Error desconocido'}`);
        }
      });
    }
  }
  
  /**
   * Configurar evento básico para el botón de verificar actualizaciones
   */
  function setupBasicCheckButton() {
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', async () => {
        try {
          // Deshabilitar botón y mostrar progreso
          checkUpdatesBtn.disabled = true;
          const originalText = checkUpdatesBtn.innerHTML;
          checkUpdatesBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Comprobando...';
          
          // Verificar actualizaciones
          const result = await window.api.checkUpdates();
          
          // Recargar sección con la nueva información
          loadUpdatesSection();
        } catch (error) {
          console.error('Error al comprobar actualizaciones:', error);
          showAlert('danger', `Error al comprobar actualizaciones: ${error.message || 'Error desconocido'}`);
          
          // Restaurar botón
          checkUpdatesBtn.disabled = false;
          checkUpdatesBtn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Comprobar Actualizaciones';
        }
      });
    }
  }
  
  /**
   * Formatear fecha para mostrar
   * @param {string} dateString - Cadena de fecha ISO
   * @returns {string} - Fecha formateada
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      return dateString || '';
    }
  }
  
  // Configurar evento para notificaciones de actualización
  window.addEventListener('DOMContentLoaded', () => {
    // Escuchar eventos de actualización disponible
    window.api.onUpdateAvailable((updateInfo) => {
      // Mostrar notificación en barra superior
      const alertContainer = document.getElementById('alert-container');
      if (alertContainer) {
        const alertHtml = `
          <div class="alert alert-info alert-dismissible fade show" role="alert">
            <i class="bi bi-arrow-up-circle-fill me-2"></i>
            <strong>Nueva versión disponible!</strong> La versión ${updateInfo.version} está lista para descargar.
            <button type="button" class="btn btn-sm btn-primary ms-3" id="updateNotificationBtn">Ver detalles</button>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
        
        // Insertar alerta
        const alertElement = document.createElement('div');
        alertElement.innerHTML = alertHtml;
        alertContainer.appendChild(alertElement.firstChild);
        
        // Configurar botón
        const updateBtn = document.getElementById('updateNotificationBtn');
        if (updateBtn) {
          updateBtn.addEventListener('click', () => {
            // Ir a la sección de actualizaciones
            const updatesLink = document.querySelector('[data-section="updates"]');
            if (updatesLink) {
              updatesLink.click();
            } else {
              // Si no existe el enlace, intentar cargar la sección directamente
              const updatesSection = document.getElementById('updates-section');
              if (updatesSection) {
                // Mostrar sección
                const sections = document.querySelectorAll('.content-section');
                sections.forEach(section => section.classList.remove('active'));
                updatesSection.classList.add('active');
                
                // Cargar contenido
                loadUpdatesSection();
              }
            }
          });
        }
      }
    });
  });
  
  // Exportar funciones
  window.loadUpdatesSection = loadUpdatesSection;