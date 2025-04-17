const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Sistema de manejo de errores para la aplicación
 */
class ErrorHandler {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, `app-errors-${new Date().toISOString().split('T')[0]}.log`);
    
    // Crear directorio de logs si no existe
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Configurar manejadores globales de errores
    this.setupGlobalHandlers();
  }
  
  /**
   * Configura manejadores de errores a nivel global
   */
  setupGlobalHandlers() {
    // Capturar errores no manejados en promesas
    process.on('unhandledRejection', (reason, promise) => {
      this.logError('Unhandled Promise Rejection', { reason });
      console.error('Unhandled Promise Rejection:', reason);
    });
    
    // Capturar excepciones no manejadas
    process.on('uncaughtException', (error) => {
      this.logError('Uncaught Exception', { error });
      console.error('Uncaught Exception:', error);
      
      // NOTA: En producción, puede ser mejor mostrar un diálogo y cerrar
      // la aplicación, ya que puede estar en un estado inconsistente
      // app.quit();
    });
  }
  
  /**
   * Registra un error en el archivo de log
   * @param {string} type - Tipo de error
   * @param {Object} data - Datos adicionales
   */
  logError(type, data = {}) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      type,
      ...data,
      stack: data.error?.stack || data.reason?.stack || new Error().stack
    };
    
    // Convertir a formato legible
    const logText = `[${timestamp}] ${type}: ${JSON.stringify(errorInfo, (key, value) => {
      // Manejar errores circulares
      if (key === 'error' || key === 'reason') {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack
        };
      }
      return value;
    }, 2)}\n\n`;
    
    // Escribir en archivo
    try {
      fs.appendFileSync(this.logFile, logText);
    } catch (error) {
      console.error('Error al escribir en archivo de log:', error);
    }
  }
  
  /**
   * Registra un error específico de la aplicación
   * @param {string} source - Fuente del error (componente o módulo)
   * @param {Error} error - Objeto de error
   * @param {Object} context - Datos de contexto adicionales
   */
  captureError(source, error, context = {}) {
    this.logError('Application Error', {
      source,
      error,
      context
    });
    
    console.error(`Error en ${source}:`, error);
  }
  
  /**
   * Limpia logs antiguos (más de 7 días)
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = new Date();
      
      files.forEach(file => {
        if (!file.startsWith('app-errors-') || !file.endsWith('.log')) return;
        
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const fileDate = stats.mtime;
        
        // Eliminar si tiene más de 7 días
        const diffDays = (now - fileDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
          fs.unlinkSync(filePath);
          console.log(`Log antiguo eliminado: ${file}`);
        }
      });
    } catch (error) {
      console.error('Error al limpiar logs antiguos:', error);
    }
  }
}

module.exports = new ErrorHandler();