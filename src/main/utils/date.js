// src/main/utils/date.js - Utilidades de fechas
/**
 * Formatea una fecha al formato local
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
    if (!date) return '';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString();
  }
  
  /**
   * Calcula la diferencia en días entre dos fechas
   * @param {string|Date} date1 - Primera fecha
   * @param {string|Date} date2 - Segunda fecha
   * @returns {number} - Diferencia en días
   */
  function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Convertir a días
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  module.exports = {
    formatDate,
    daysBetween
  };