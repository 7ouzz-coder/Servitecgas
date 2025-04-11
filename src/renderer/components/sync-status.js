// Componente para mostrar el estado de sincronización en el sidebar

/**
 * Inicializa el componente de estado de sincronización
 */
async function initSyncStatus() {
    // Obtener referencia al contenedor en el sidebar
    const syncStatusContainer = document.createElement('div');
    syncStatusContainer.id = 'sync-status-container';
    syncStatusContainer.className = 'sync-status mt-auto p-3 border-top';
    
    // Añadir al sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.appendChild(syncStatusContainer);
      
      // Aplicar estilos CSS
      syncStatusContainer.style.marginTop = 'auto';
      syncStatusContainer.style.fontSize = '0.8rem';
      syncStatusContainer.style.color = 'rgba(255, 255, 255, 0.7)';
    }
    
    // Cargar estado inicial
    refreshSyncStatus();
    
    // Configurar actualización periódica del estado
    setInterval(refreshSyncStatus, 30000); // cada 30 segundos
    
    // Escuchar eventos de cambio de estado
    window.api.onSyncStatusChanged(data => {
      updateSyncStatusUI(data);
    });
    
    window.api.onSyncCompleted(data => {
      showSyncCompletedInfo(data);
    });
  }
  
  /**
   * Actualiza la interfaz según el estado de sincronización actual
   */
  async function refreshSyncStatus() {
    try {
      const status = await window.api.getSyncStatus();
      updateSyncStatusUI(status);
    } catch (error) {
      console.error('Error al obtener estado de sincronización:', error);
      // Mostrar error en la UI
      const syncStatusContainer = document.getElementById('sync-status-container');
      if (syncStatusContainer) {
        syncStatusContainer.innerHTML = `
          <div class="d-flex align-items-center">
            <span class="sync-icon text-danger me-2">
              <i class="bi bi-exclamation-triangle"></i>
            </span>
            <div>
              <span class="d-block">Error de sincronización</span>
            </div>
          </div>
        `;
      }
    }
  }
  
  /**
   * Actualiza la UI según el estado
   * @param {Object} status - Estado de sincronización
   */
  function updateSyncStatusUI(status) {
    const syncStatusContainer = document.getElementById('sync-status-container');
    if (!syncStatusContainer) return;
    
    let statusHtml = '';
    
    // Si hay sincronización en progreso
    if (status.inProgress || status.status === 'in-progress' || status.status === 'uploading' || status.status === 'downloading') {
      statusHtml = `
        <div class="d-flex align-items-center">
          <span class="sync-icon text-info me-2">
            <i class="bi bi-arrow-repeat spin"></i>
          </span>
          <div>
            <span class="d-block">Sincronizando...</span>
            <small>${status.message || 'Procesando datos'}</small>
          </div>
        </div>
      `;
    } 
    // Si hay un error
    else if (status.status === 'error') {
      statusHtml = `
        <div class="d-flex align-items-center">
          <span class="sync-icon text-danger me-2">
            <i class="bi bi-exclamation-triangle"></i>
          </span>
          <div>
            <span class="d-block">Error de sincronización</span>
            <small>${status.message || 'Error desconocido'}</small>
          </div>
        </div>
      `;
    }
    // Estado normal
    else {
      const lastSync = status.lastSync ? new Date(status.lastSync) : null;
      const lastSyncText = lastSync ? `Última: ${lastSync.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : 'Nunca sincronizado';
      
      statusHtml = `
        <div class="d-flex align-items-center">
          <span class="sync-icon text-${status.connectionAvailable ? 'success' : 'warning'} me-2">
            <i class="bi bi-cloud${status.connectionAvailable ? '-check' : ''}"></i>
          </span>
          <div>
            <span class="d-block">${status.connectionAvailable ? 'Conectado' : 'Sin conexión'}</span>
            <small>${lastSyncText}</small>
          </div>
          <button id="sync-now-btn" class="btn btn-sm btn-outline-secondary ms-auto" title="Sincronizar ahora">
            <i class="bi bi-arrow-repeat"></i>
          </button>
        </div>
      `;
    }
    
    // Actualizar contenido
    syncStatusContainer.innerHTML = statusHtml;
    
    // Configurar botón de sincronización manual
    const syncNowBtn = document.getElementById('sync-now-btn');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', triggerManualSync);
    }
    
    // Añadir estilos para el icono de sincronización animado
    const styleElement = document.getElementById('sync-animation-style');
    if (!styleElement) {
      const style = document.createElement('style');
      style.id = 'sync-animation-style';
      style.textContent = `
        .spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Inicia una sincronización manual
   */
  async function triggerManualSync() {
    try {
      // Actualizar UI a estado "sincronizando"
      updateSyncStatusUI({
        inProgress: true,
        status: 'in-progress',
        message: 'Iniciando sincronización manual'
      });
      
      // Llamar a la API para sincronizar
      const result = await window.api.syncNow();
      
      if (result.success) {
        showAlert('success', 'Sincronización completada correctamente');
      } else {
        showAlert('danger', `Error al sincronizar: ${result.message}`);
        
        // Actualizar UI a estado de error
        updateSyncStatusUI({
          status: 'error',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Error al iniciar sincronización manual:', error);
      showAlert('danger', 'Error al iniciar sincronización');
      
      // Actualizar UI a estado de error
      updateSyncStatusUI({
        status: 'error',
        message: error.message
      });
    }
  }
  
  /**
   * Muestra información de sincronización completada
   * @param {Object} data - Datos de sincronización completada
   */
  function showSyncCompletedInfo(data) {
    // Actualizamos la UI
    refreshSyncStatus();
    
    // Mostrar información si hay cambios
    if (data.stats && (data.stats.uploaded > 0 || data.stats.downloaded > 0)) {
      showAlert('info', `Sincronización completada: ${data.stats.uploaded} elementos subidos, ${data.stats.downloaded} elementos descargados`);
    }
  }
  
  // Exportar funciones
  window.initSyncStatus = initSyncStatus;