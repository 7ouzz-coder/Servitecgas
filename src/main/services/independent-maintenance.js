// src/main/services/independent-maintenance.js

const { v4: uuidv4 } = require('uuid');

/**
 * Servicio para gestionar mantenimientos independientes
 * (mantenimientos a equipos no instalados por el técnico)
 */
class IndependentMaintenanceService {
  constructor(store) {
    this.store = store;
    this._initializeStore();
  }

  /**
   * Inicializa el almacén para mantenimientos independientes
   * @private
   */
  _initializeStore() {
    if (!this.store.has('independentMaintenance')) {
      this.store.set('independentMaintenance', []);
    }
  }

  /**
   * Registra un nuevo mantenimiento independiente
   * @param {Object} maintenanceData - Datos del mantenimiento
   * @returns {Object} - Resultado de la operación
   */
  registerMaintenance(maintenanceData) {
    try {
      const {
        clientId,
        address,
        componentName,
        componentModel,
        maintenanceDate,
        nextMaintenanceDate,
        frequency = 12,
        notes,
        technicianId,
      } = maintenanceData;

      // Verificar datos requeridos
      if (!clientId || !componentName || !maintenanceDate) {
        return {
          success: false,
          message: 'Cliente, componente y fecha de mantenimiento son obligatorios'
        };
      }

      // Crear nuevo registro
      const newMaintenance = {
        id: uuidv4(),
        clientId,
        address: address || '',
        componentName,
        componentModel: componentModel || '',
        maintenanceDate,
        nextMaintenanceDate: nextMaintenanceDate || this._calculateNextMaintenanceDate(maintenanceDate, frequency),
        frequency: parseInt(frequency) || 12,
        notes: notes || '',
        technicianId: technicianId || 'not_specified',
        createdAt: new Date().toISOString(),
        isIndependent: true // Marca que diferencia de los mantenimientos de instalaciones propias
      };

      // Guardar en la colección
      const maintenanceList = this.store.get('independentMaintenance') || [];
      maintenanceList.push(newMaintenance);
      this.store.set('independentMaintenance', maintenanceList);

      // Guardar también en el historial general de mantenimientos
      this._saveToGeneralHistory(newMaintenance);

      return {
        success: true,
        maintenance: newMaintenance
      };
    } catch (error) {
      console.error('Error al registrar mantenimiento independiente:', error);
      return {
        success: false,
        message: `Error al registrar mantenimiento: ${error.message}`
      };
    }
  }

  /**
   * Actualiza un mantenimiento independiente existente
   * @param {string} maintenanceId - ID del mantenimiento a actualizar
   * @param {Object} maintenanceData - Nuevos datos
   * @returns {Object} - Resultado de la operación
   */
  updateMaintenance(maintenanceId, maintenanceData) {
    try {
      const maintenanceList = this.store.get('independentMaintenance') || [];
      const index = maintenanceList.findIndex(m => m.id === maintenanceId);

      if (index === -1) {
        return {
          success: false,
          message: 'Mantenimiento no encontrado'
        };
      }

      // Actualizar datos
      const updatedMaintenance = {
        ...maintenanceList[index],
        ...maintenanceData,
        lastModified: new Date().toISOString()
      };

      // Si se cambia la fecha o frecuencia, recalcular próxima fecha
      if (maintenanceData.maintenanceDate || maintenanceData.frequency) {
        const date = maintenanceData.maintenanceDate || updatedMaintenance.maintenanceDate;
        const freq = maintenanceData.frequency || updatedMaintenance.frequency;
        updatedMaintenance.nextMaintenanceDate = this._calculateNextMaintenanceDate(date, freq);
      }

      // Actualizar en la lista
      maintenanceList[index] = updatedMaintenance;
      this.store.set('independentMaintenance', maintenanceList);

      // Actualizar también en el historial general
      this._updateInGeneralHistory(updatedMaintenance);

      return {
        success: true,
        maintenance: updatedMaintenance
      };
    } catch (error) {
      console.error('Error al actualizar mantenimiento independiente:', error);
      return {
        success: false,
        message: `Error al actualizar mantenimiento: ${error.message}`
      };
    }
  }

  /**
   * Elimina un mantenimiento independiente
   * @param {string} maintenanceId - ID del mantenimiento a eliminar
   * @returns {Object} - Resultado de la operación
   */
  deleteMaintenance(maintenanceId) {
    try {
      const maintenanceList = this.store.get('independentMaintenance') || [];
      const index = maintenanceList.findIndex(m => m.id === maintenanceId);

      if (index === -1) {
        return {
          success: false,
          message: 'Mantenimiento no encontrado'
        };
      }

      // Guardar referencia antes de eliminar
      const maintenanceToDelete = maintenanceList[index];

      // Eliminar de la lista
      maintenanceList.splice(index, 1);
      this.store.set('independentMaintenance', maintenanceList);

      // Eliminar también del historial general
      this._removeFromGeneralHistory(maintenanceId);

      return {
        success: true,
        message: 'Mantenimiento eliminado correctamente'
      };
    } catch (error) {
      console.error('Error al eliminar mantenimiento independiente:', error);
      return {
        success: false,
        message: `Error al eliminar mantenimiento: ${error.message}`
      };
    }
  }

  /**
   * Obtiene todos los mantenimientos independientes
   * @returns {Array} - Lista de mantenimientos
   */
  getAllMaintenance() {
    return this.store.get('independentMaintenance') || [];
  }

  /**
   * Obtiene mantenimientos filtrados por cliente
   * @param {string} clientId - ID del cliente
   * @returns {Array} - Lista de mantenimientos del cliente
   */
  getMaintenanceByClient(clientId) {
    const maintenanceList = this.store.get('independentMaintenance') || [];
    return maintenanceList.filter(m => m.clientId === clientId);
  }

  /**
   * Obtiene mantenimientos con próximas fechas en el umbral especificado
   * @param {number} daysThreshold - Días límite para considerar próximo
   * @returns {Array} - Lista de mantenimientos próximos
   */
  getUpcomingMaintenance(daysThreshold = 30) {
    const maintenanceList = this.store.get('independentMaintenance') || [];
    const today = new Date();
    const upcomingList = [];

    maintenanceList.forEach(maintenance => {
      if (maintenance.nextMaintenanceDate) {
        const nextDate = new Date(maintenance.nextMaintenanceDate);
        const diffDays = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays <= daysThreshold) {
          // Obtener información adicional del cliente
          const clients = this.store.get('clients') || [];
          const client = clients.find(c => c.id === maintenance.clientId);

          upcomingList.push({
            ...maintenance,
            clientName: client ? client.name : 'Cliente desconocido',
            clientPhone: client ? client.phone : '',
            daysLeft: diffDays
          });
        }
      }
    });

    // Ordenar por días restantes
    return upcomingList.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  /**
   * Calcula la próxima fecha de mantenimiento
   * @param {string} lastMaintenanceDate - Fecha del último mantenimiento
   * @param {number} frequency - Frecuencia en meses
   * @returns {string} - Fecha calculada (YYYY-MM-DD)
   * @private
   */
  _calculateNextMaintenanceDate(lastMaintenanceDate, frequency) {
    const date = new Date(lastMaintenanceDate);
    const nextDate = new Date(date);
    nextDate.setMonth(date.getMonth() + parseInt(frequency, 10));
    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Guarda un mantenimiento en el historial general
   * @param {Object} maintenance - Datos del mantenimiento
   * @private
   */
  _saveToGeneralHistory(maintenance) {
    const historyList = this.store.get('maintenanceHistory') || [];
    
    // Buscar cliente para tener el nombre
    const clients = this.store.get('clients') || [];
    const client = clients.find(c => c.id === maintenance.clientId);
    
    // Crear entrada para el historial
    const historyEntry = {
      id: maintenance.id,
      date: maintenance.maintenanceDate,
      clientId: maintenance.clientId,
      clientName: client ? client.name : 'Cliente desconocido',
      componentName: maintenance.componentName,
      address: maintenance.address,
      notes: maintenance.notes,
      technicianId: maintenance.technicianId,
      isIndependent: true
    };
    
    historyList.push(historyEntry);
    this.store.set('maintenanceHistory', historyList);
  }

  /**
   * Actualiza un mantenimiento en el historial general
   * @param {Object} maintenance - Datos actualizados
   * @private
   */
  _updateInGeneralHistory(maintenance) {
    const historyList = this.store.get('maintenanceHistory') || [];
    const index = historyList.findIndex(h => h.id === maintenance.id && h.isIndependent);
    
    if (index === -1) {
      // Si no existe, crearlo
      this._saveToGeneralHistory(maintenance);
      return;
    }
    
    // Buscar cliente para tener el nombre
    const clients = this.store.get('clients') || [];
    const client = clients.find(c => c.id === maintenance.clientId);
    
    // Actualizar entrada
    historyList[index] = {
      ...historyList[index],
      date: maintenance.maintenanceDate,
      clientId: maintenance.clientId,
      clientName: client ? client.name : 'Cliente desconocido',
      componentName: maintenance.componentName,
      address: maintenance.address,
      notes: maintenance.notes,
      technicianId: maintenance.technicianId
    };
    
    this.store.set('maintenanceHistory', historyList);
  }

  /**
   * Elimina un mantenimiento del historial general
   * @param {string} maintenanceId - ID del mantenimiento
   * @private
   */
  _removeFromGeneralHistory(maintenanceId) {
    const historyList = this.store.get('maintenanceHistory') || [];
    const newHistoryList = historyList.filter(h => !(h.id === maintenanceId && h.isIndependent));
    this.store.set('maintenanceHistory', newHistoryList);
  }
}

module.exports = IndependentMaintenanceService;