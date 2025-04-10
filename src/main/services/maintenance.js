/**
 * Verifica los mantenimientos próximos
 * @param {Store} store - Instancia de la base de datos
 * @param {number} daysThreshold - Días de umbral para considerar un mantenimiento como próximo
 * @returns {Array} - Lista de mantenimientos próximos
 */
function checkUpcomingMaintenance(store, daysThreshold = 7) {
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const today = new Date();
    const upcomingMaintenance = [];
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        if (component.nextMaintenanceDate) {
          const nextMaintenance = new Date(component.nextMaintenanceDate);
          const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
          
          // Notificar si el mantenimiento está dentro del umbral de días
          if (diffDays <= daysThreshold && diffDays >= -30) { // Incluimos mantenimientos vencidos hasta 30 días
            const client = clients.find(c => c.id === installation.clientId);
            
            upcomingMaintenance.push({
              clientId: installation.clientId,
              clientName: client ? client.name : 'Cliente desconocido',
              clientPhone: client ? client.phone : '',
              installationId: installation.id,
              address: installation.address,
              componentId: component.id,
              componentName: component.name,
              lastMaintenanceDate: component.lastMaintenanceDate,
              nextMaintenanceDate: component.nextMaintenanceDate,
              daysLeft: diffDays,
              urgent: diffDays <= 0 // Marcar como urgente si está vencido
            });
          }
        }
      });
    });
    
    // Ordenar: primero los vencidos, luego por días restantes
    return upcomingMaintenance.sort((a, b) => {
      // Si ambos están vencidos o ambos no están vencidos, ordenar por días restantes
      if ((a.daysLeft <= 0 && b.daysLeft <= 0) || (a.daysLeft > 0 && b.daysLeft > 0)) {
        return a.daysLeft - b.daysLeft;
      }
      // Si solo uno está vencido, ese va primero
      return a.daysLeft <= 0 ? -1 : 1;
    });
  }
  
  /**
   * Calcula la fecha de la próxima mantención
   * @param {string} lastMaintenanceDate - Fecha de la última mantención
   * @param {number} frequencyMonths - Frecuencia de mantención en meses
   * @returns {string} - Fecha de la próxima mantención
   */
  function calculateNextMaintenanceDate(lastMaintenanceDate, frequencyMonths) {
    if (!lastMaintenanceDate) return null;
    
    const lastDate = new Date(lastMaintenanceDate);
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + parseInt(frequencyMonths, 10));
    
    return nextDate.toISOString().split('T')[0];
  }
  
  /**
   * Obtiene estadísticas de mantenimientos
   * @param {Store} store - Instancia de la base de datos
   * @returns {Object} - Estadísticas de mantenimientos
   */
  function getMaintenanceStats(store) {
    const installations = store.get('installations') || [];
    const today = new Date();
    
    let totalComponents = 0;
    let componentsWithMaintenance = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let urgentCount = 0;
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        totalComponents++;
        
        if (component.nextMaintenanceDate) {
          componentsWithMaintenance++;
          
          const nextDate = new Date(component.nextMaintenanceDate);
          const diffDays = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            overdueCount++; // Vencido
          } else if (diffDays <= 7) {
            urgentCount++; // Urgente
          } else if (diffDays <= 30) {
            upcomingCount++; // Próximo
          }
        }
      });
    });
    
    return {
      totalComponents,
      componentsWithMaintenance,
      overdueCount,
      urgentCount,
      upcomingCount,
      upToDateCount: componentsWithMaintenance - overdueCount - urgentCount - upcomingCount
    };
  }
  
  /**
   * Registra un mantenimiento realizado
   * @param {Store} store - Instancia de la base de datos
   * @param {Object} data - Datos del mantenimiento
   * @returns {Object} - Resultado de la operación
   */
  function registerMaintenance(store, data) {
    try {
      const { installationId, componentId, maintenanceDate, notes, technicianId } = data;
      
      const installations = store.get('installations') || [];
      const installationIndex = installations.findIndex(i => i.id === installationId);
      
      if (installationIndex === -1) {
        return { success: false, message: 'Instalación no encontrada' };
      }
      
      const installation = installations[installationIndex];
      
      if (!installation.components) {
        return { success: false, message: 'La instalación no tiene componentes' };
      }
      
      const componentIndex = installation.components.findIndex(c => c.id === componentId);
      
      if (componentIndex === -1) {
        return { success: false, message: 'Componente no encontrado' };
      }
      
      // Actualizar fechas de mantenimiento
      const component = installation.components[componentIndex];
      const lastMaintenanceDate = maintenanceDate || new Date().toISOString().split('T')[0];
      const frequency = component.frequency || 12; // Frecuencia en meses
      
      // Crear registro de mantenimiento
      const maintenanceRecord = {
        id: require('uuid').v4(),
        date: lastMaintenanceDate,
        notes: notes || '',
        technicianId: technicianId || 'unknown',
        componentId,
        installationId
      };
      
      // Actualizar componente
      const updatedComponent = {
        ...component,
        lastMaintenanceDate,
        nextMaintenanceDate: calculateNextMaintenanceDate(lastMaintenanceDate, frequency)
      };
      
      // Si no existe array de mantenimientos, crearlo
      if (!component.maintenanceHistory) {
        updatedComponent.maintenanceHistory = [];
      }
      
      // Añadir registro al historial
      updatedComponent.maintenanceHistory = [
        ...updatedComponent.maintenanceHistory,
        maintenanceRecord
      ];
      
      // Actualizar componente en la instalación
      installation.components[componentIndex] = updatedComponent;
      
      // Actualizar instalación
      installation.lastModified = new Date().toISOString();
      installations[installationIndex] = installation;
      
      // Guardar cambios
      store.set('installations', installations);
      
      // También guardar en una colección separada de mantenimientos
      const maintenanceHistory = store.get('maintenanceHistory') || [];
      maintenanceHistory.push({
        ...maintenanceRecord,
        clientId: installation.clientId,
        componentName: component.name,
        address: installation.address
      });
      store.set('maintenanceHistory', maintenanceHistory);
      
      return {
        success: true,
        installation,
        component: updatedComponent,
        maintenanceRecord
      };
    } catch (error) {
      console.error('Error al registrar mantenimiento:', error);
      return {
        success: false,
        message: `Error al registrar mantenimiento: ${error.message}`
      };
    }
  }
  
  module.exports = {
    checkUpcomingMaintenance,
    calculateNextMaintenanceDate,
    getMaintenanceStats,
    registerMaintenance
  };