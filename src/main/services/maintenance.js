// src/main/services/maintenance.js - Servicio de mantenimiento
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
          if (diffDays <= daysThreshold && diffDays >= 0) {
            const client = clients.find(c => c.id === installation.clientId);
            
            upcomingMaintenance.push({
              clientName: client ? client.name : 'Cliente desconocido',
              clientPhone: client ? client.phone : '',
              address: installation.address,
              componentName: component.name,
              nextMaintenanceDate: component.nextMaintenanceDate,
              daysLeft: diffDays,
              clientId: installation.clientId,
              installationId: installation.id,
              componentId: component.id
            });
          }
        }
      });
    });
    
    return upcomingMaintenance.sort((a, b) => a.daysLeft - b.daysLeft);
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
  
  module.exports = {
    checkUpcomingMaintenance,
    calculateNextMaintenanceDate
  };