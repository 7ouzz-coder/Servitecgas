// src/main/services/auth.js - Servicio de autenticación local
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio de autenticación local que gestiona usuarios y sesiones
 */
class AuthService {
  constructor(store) {
    this.store = store;
    this.currentUser = null;
    this.sessionToken = null;
    
    // Inicializar colección de usuarios si no existe
    if (!this.store.has('users')) {
      this.store.set('users', []);
      
      // Crear usuario administrador por defecto
      this.createUser({
        username: 'admin',
        password: 'admin123',
        name: 'Administrador',
        email: 'admin@servitecgas.com',
        role: 'admin'
      });
    }
  }
  
  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Object} - Resultado de la operación
   */
  createUser(userData) {
    const users = this.store.get('users');
    
    // Verificar si el usuario ya existe
    if (users.some(user => user.username === userData.username)) {
      return {
        success: false,
        message: 'El nombre de usuario ya existe'
      };
    }
    
    // Generar hash y salt para la contraseña
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(userData.password, salt);
    
    // Crear nuevo usuario
    const newUser = {
      id: uuidv4(),
      username: userData.username,
      passwordHash: hash,
      passwordSalt: salt,
      name: userData.name || userData.username,
      email: userData.email || '',
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    // Eliminar datos sensibles antes de guardar
    delete newUser.password;
    
    // Guardar usuario
    this.store.set('users', [...users, newUser]);
    
    return {
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    };
  }
  
  /**
   * Autentica a un usuario
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Object} - Resultado de la autenticación
   */
  login(username, password) {
    const users = this.store.get('users');
    const user = users.find(user => user.username === username);
    
    if (!user) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    }
    
    // Verificar contraseña
    const hash = this.hashPassword(password, user.passwordSalt);
    if (hash !== user.passwordHash) {
      return {
        success: false,
        message: 'Contraseña incorrecta'
      };
    }
    
    // Generar sesión
    this.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    this.sessionToken = uuidv4();
    
    // Actualizar último login
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          lastLogin: new Date().toISOString()
        };
      }
      return u;
    });
    
    this.store.set('users', updatedUsers);
    
    return {
      success: true,
      user: this.currentUser,
      token: this.sessionToken
    };
  }
  
  /**
   * Cierra la sesión del usuario actual
   * @returns {Object} - Resultado de la operación
   */
  logout() {
    this.currentUser = null;
    this.sessionToken = null;
    
    return {
      success: true
    };
  }
  
  /**
   * Verifica si hay una sesión activa
   * @returns {Object} - Estado de la autenticación
   */
  checkAuth() {
    return {
      isAuthenticated: !!this.currentUser,
      user: this.currentUser
    };
  }
  
  /**
   * Obtiene información del usuario actual
   * @returns {Object|null} - Información del usuario
   */
  getCurrentUser() {
    return this.currentUser;
  }
  
  /**
   * Actualiza datos del usuario
   * @param {string} userId - ID del usuario
   * @param {Object} userData - Nuevos datos
   * @returns {Object} - Resultado de la operación
   */
  updateUser(userId, userData) {
    const users = this.store.get('users');
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    }
    
    // Actualizar campos permitidos
    const updatedUser = {
      ...users[userIndex],
      name: userData.name || users[userIndex].name,
      email: userData.email || users[userIndex].email
    };
    
    // Actualizar contraseña si se proporciona
    if (userData.password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = this.hashPassword(userData.password, salt);
      
      updatedUser.passwordHash = hash;
      updatedUser.passwordSalt = salt;
    }
    
    // Guardar cambios
    users[userIndex] = updatedUser;
    this.store.set('users', users);
    
    // Si es el usuario actual, actualizar datos en sesión
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      };
    }
    
    return {
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    };
  }
  
  /**
   * Cambia la contraseña de un usuario
   * @param {string} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Object} - Resultado de la operación
   */
  changePassword(userId, currentPassword, newPassword) {
    const users = this.store.get('users');
    const user = users.find(user => user.id === userId);
    
    if (!user) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    }
    
    // Verificar contraseña actual
    const currentHash = this.hashPassword(currentPassword, user.passwordSalt);
    if (currentHash !== user.passwordHash) {
      return {
        success: false,
        message: 'Contraseña actual incorrecta'
      };
    }
    
    // Generar hash para la nueva contraseña
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(newPassword, salt);
    
    // Actualizar usuario
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          passwordHash: hash,
          passwordSalt: salt
        };
      }
      return u;
    });
    
    this.store.set('users', updatedUsers);
    
    return {
      success: true,
      message: 'Contraseña actualizada correctamente'
    };
  }
  
  /**
   * Elimina un usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Resultado de la operación
   */
  deleteUser(userId) {
    // No permitir eliminar el usuario actual
    if (this.currentUser && this.currentUser.id === userId) {
      return {
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      };
    }
    
    const users = this.store.get('users');
    
    // No permitir eliminar el último administrador
    const adminUsers = users.filter(user => user.role === 'admin');
    const userToDelete = users.find(user => user.id === userId);
    
    if (userToDelete && userToDelete.role === 'admin' && adminUsers.length === 1) {
      return {
        success: false,
        message: 'No puedes eliminar el último administrador'
      };
    }
    
    // Eliminar usuario
    const updatedUsers = users.filter(user => user.id !== userId);
    this.store.set('users', updatedUsers);
    
    return {
      success: true,
      message: 'Usuario eliminado correctamente'
    };
  }
  
  /**
   * Lista todos los usuarios (sin información sensible)
   * @returns {Array} - Lista de usuarios
   */
  listUsers() {
    const users = this.store.get('users');
    
    // Filtrar información sensible
    return users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
  }
  
  /**
   * Genera un hash para una contraseña
   * @param {string} password - Contraseña
   * @param {string} salt - Salt
   * @returns {string} - Hash
   */
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }
}

module.exports = AuthService;