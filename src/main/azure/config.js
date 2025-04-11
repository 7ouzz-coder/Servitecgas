const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const electron = require('electron');

// Claves por defecto
const DEFAULT_AZURE_CONFIG = {
    connectionString: '',
    containerName: 'servitecgas-data',
    tableName: 'servitecgassynclog',
    maxRetries: 3,
    syncIntervalMinutes: 10,
    lastSync: null
};

// Clave para cifrar y descifrar
let encryptionKey = null;

/**
 * Inicializa la configuración de Azure
 * @param {string} appDataPath - Ruta para almacenar datos
 * @returns {Object} - Configuración cargada
 */
function initAzureConfig(appDataPath = null) {
    try {
        // Usar ruta proporcionada o la predeterminada de la aplicación
        const configPath = appDataPath || (electron.app ? 
            path.join(electron.app.getPath('userData'), 'config') : 
            path.join(os.homedir(), '.servitecgas'));
            
        // Asegurarnos de que el directorio existe
        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(configPath, { recursive: true });
        }
        
        // Ruta al archivo de configuración
        const configFile = path.join(configPath, 'azure-config.json');
        
        // Inicializar clave de cifrado
        initEncryptionKey(configPath);
        
        // Cargar configuración si existe
        let config = DEFAULT_AZURE_CONFIG;
        if (fs.existsSync(configFile)) {
            const encryptedConfig = fs.readFileSync(configFile, 'utf8');
            try {
                const decryptedConfig = decryptData(encryptedConfig);
                config = JSON.parse(decryptedConfig);
            } catch (decryptError) {
                console.warn('Error al descifrar configuración, se usarán valores por defecto:', decryptError.message);
                // No sobrescribir el archivo en caso de error de descifrado
                return config;
            }
        } else {
            // Guardar configuración por defecto
            saveAzureConfig(config, configFile);
        }
        
        return config;
    } catch (error) {
        console.error('Error al inicializar configuración de Azure:', error);
        return DEFAULT_AZURE_CONFIG;
    }
}

/**
 * Guarda la configuración de Azure
 * @param {Object} config - Configuración a guardar
 * @param {string} configFilePath - Ruta al archivo (opcional)
 * @returns {boolean} - Verdadero si se guardó correctamente
 */
function saveAzureConfig(config, configFilePath = null) {
    try {
        // Determinar ruta del archivo
        const configFile = configFilePath || (electron.app ? 
            path.join(electron.app.getPath('userData'), 'config', 'azure-config.json') : 
            path.join(os.homedir(), '.servitecgas', 'azure-config.json'));
            
        // Asegurarnos de que el directorio existe
        const configDir = path.dirname(configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Serializar y cifrar configuración
        const configJson = JSON.stringify(config, null, 2);
        const encryptedConfig = encryptData(configJson);
        
        // Guardar archivo
        fs.writeFileSync(configFile, encryptedConfig);
        return true;
    } catch (error) {
        console.error('Error al guardar configuración de Azure:', error);
        return false;
    }
}

/**
 * Inicializa la clave de cifrado para la configuración
 * @param {string} configPath - Ruta de configuración
 */
function initEncryptionKey(configPath) {
    try {
        const keyFile = path.join(configPath, '.key');
        
        // Si ya existe una clave, la cargamos
        if (fs.existsSync(keyFile)) {
            encryptionKey = fs.readFileSync(keyFile, 'utf8');
        } else {
            // Crear una nueva clave aleatoria
            encryptionKey = crypto.randomBytes(32).toString('hex');
            fs.writeFileSync(keyFile, encryptionKey);
            
            // Establecer permisos restrictivos para el archivo de clave
            try {
                fs.chmodSync(keyFile, 0o600); // Solo lectura/escritura para el propietario
            } catch (permError) {
                console.warn('No se pudieron establecer permisos restrictivos para la clave:', permError.message);
            }
        }
    } catch (error) {
        console.error('Error al inicializar clave de cifrado:', error);
        // Usar una clave por defecto (menos seguro, pero funcional)
        encryptionKey = 'servitecgas-default-encryption-key-' + os.hostname();
    }
}

/**
 * Cifra datos usando la clave de cifrado
 * @param {string} data - Datos a cifrar
 * @returns {string} - Datos cifrados en formato hexadecimal
 */
function encryptData(data) {
    if (!encryptionKey) {
        throw new Error('Clave de cifrado no inicializada');
    }
    
    // Generar un IV aleatorio
    const iv = crypto.randomBytes(16);
    
    // Derivar clave AES de la clave maestra
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    
    // Crear cipher y cifrar datos
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Concatenar IV y datos cifrados
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Descifra datos usando la clave de cifrado
 * @param {string} encryptedData - Datos cifrados en formato hexadecimal
 * @returns {string} - Datos descifrados
 */
function decryptData(encryptedData) {
    if (!encryptionKey) {
        throw new Error('Clave de cifrado no inicializada');
    }
    
    // Separar IV y datos cifrados
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
        throw new Error('Formato de datos cifrados inválido');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Derivar clave AES de la clave maestra
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    
    // Crear decipher y descifrar datos
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Actualiza la configuración de Azure
 * @param {Object} newConfig - Nueva configuración
 * @returns {Object} - Configuración actualizada
 */
function updateAzureConfig(newConfig) {
    try {
        // Cargar configuración actual
        const currentConfig = initAzureConfig();
        
        // Actualizar valores
        const updatedConfig = {
            ...currentConfig,
            ...newConfig,
            lastUpdated: new Date().toISOString()
        };
        
        // Guardar configuración actualizada
        saveAzureConfig(updatedConfig);
        
        return updatedConfig;
    } catch (error) {
        console.error('Error al actualizar configuración de Azure:', error);
        return null;
    }
}

/**
 * Actualiza el timestamp de última sincronización
 * @param {string} timestamp - Timestamp en formato ISO
 * @returns {boolean} - Verdadero si se actualizó correctamente
 */
function updateLastSyncTime(timestamp = null) {
    try {
        // Cargar configuración actual
        const config = initAzureConfig();
        
        // Actualizar timestamp
        config.lastSync = timestamp || new Date().toISOString();
        
        // Guardar configuración actualizada
        return saveAzureConfig(config);
    } catch (error) {
        console.error('Error al actualizar timestamp de sincronización:', error);
        return false;
    }
}

/**
 * Obtiene el timestamp de última sincronización
 * @returns {string|null} - Timestamp de última sincronización
 */
function getLastSyncTime() {
    try {
        // Cargar configuración
        const config = initAzureConfig();
        return config.lastSync;
    } catch (error) {
        console.error('Error al obtener timestamp de sincronización:', error);
        return null;
    }
}

/**
 * Verifica si la configuración de Azure es válida para la sincronización
 * @returns {boolean} - Verdadero si la configuración es válida
 */
function isAzureConfigValid() {
    try {
        const config = initAzureConfig();
        return !!config.connectionString && 
               !!config.containerName && 
               !!config.tableName;
    } catch (error) {
        console.error('Error al verificar configuración de Azure:', error);
        return false;
    }
}

module.exports = {
    initAzureConfig,
    saveAzureConfig,
    updateAzureConfig,
    updateLastSyncTime,
    getLastSyncTime,
    isAzureConfigValid
};