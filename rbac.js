const logger = require('./logger');

// Константы для ролей
const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest'
};

// Иерархия ролей (каждая роль включает права нижестоящих ролей)
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: [ROLES.MODERATOR, ROLES.USER, ROLES.GUEST],
  [ROLES.MODERATOR]: [ROLES.USER, ROLES.GUEST],
  [ROLES.USER]: [ROLES.GUEST],
  [ROLES.GUEST]: []
};

// Определение прав доступа
const PERMISSIONS = {
  // Управление пользователями
  MANAGE_USERS: 'manage:users',
  VIEW_USERS: 'view:users',
  
  // Управление командами
  MANAGE_COMMANDS: 'manage:commands',
  VIEW_COMMANDS: 'view:commands',
  EXECUTE_COMMANDS: 'execute:commands',
  
  // Метрики и мониторинг
  VIEW_METRICS: 'view:metrics',
  MANAGE_METRICS: 'manage:metrics',
  
  // Уведомления
  MANAGE_NOTIFICATIONS: 'manage:notifications',
  VIEW_NOTIFICATIONS: 'view:notifications',
  
  // Системные операции
  MANAGE_SYSTEM: 'manage:system',
  VIEW_SYSTEM: 'view:system',
  
  // Вебхуки
  MANAGE_WEBHOOKS: 'manage:webhooks',
  VIEW_WEBHOOKS: 'view:webhooks'
};

// Права по умолчанию для каждой роли
const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MODERATOR]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_COMMANDS,
    PERMISSIONS.VIEW_COMMANDS,
    PERMISSIONS.EXECUTE_COMMANDS,
    PERMISSIONS.VIEW_METRICS,
    PERMISSIONS.MANAGE_NOTIFICATIONS,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_SYSTEM,
    PERMISSIONS.VIEW_WEBHOOKS
  ],
  [ROLES.USER]: [
    PERMISSIONS.VIEW_COMMANDS,
    PERMISSIONS.EXECUTE_COMMANDS,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_WEBHOOKS
  ],
  [ROLES.GUEST]: [
    PERMISSIONS.VIEW_COMMANDS
  ]
};

class RBACManager {
  constructor() {
    this.customRolePermissions = new Map();
    this.userRoles = new Map();
    this.userCustomPermissions = new Map();
  }

  // Проверка существования роли
  isValidRole(role) {
    return Object.values(ROLES).includes(role);
  }

  // Проверка существования разрешения
  isValidPermission(permission) {
    return Object.values(PERMISSIONS).includes(permission);
  }

  // Получение всех разрешений для роли (включая унаследованные)
  getRolePermissions(role) {
    if (!this.isValidRole(role)) {
      throw new Error(\`Invalid role: \${role}\`);
    }

    const permissions = new Set();
    
    // Добавляем базовые разрешения для роли
    DEFAULT_ROLE_PERMISSIONS[role].forEach(p => permissions.add(p));
    
    // Добавляем кастомные разрешения для роли, если есть
    const customPerms = this.customRolePermissions.get(role);
    if (customPerms) {
      customPerms.forEach(p => permissions.add(p));
    }
    
    // Добавляем разрешения от нижестоящих ролей
    ROLE_HIERARCHY[role].forEach(inheritedRole => {
      DEFAULT_ROLE_PERMISSIONS[inheritedRole].forEach(p => permissions.add(p));
      const inheritedCustomPerms = this.customRolePermissions.get(inheritedRole);
      if (inheritedCustomPerms) {
        inheritedCustomPerms.forEach(p => permissions.add(p));
      }
    });

    return Array.from(permissions);
  }

  // Назначение роли пользователю
  assignRole(userId, role) {
    if (!this.isValidRole(role)) {
      throw new Error(\`Invalid role: \${role}\`);
    }

    this.userRoles.set(userId, role);
    logger.logWithContext('info', \`Role assigned to user\`, { userId, role });
  }

  // Получение роли пользователя
  getUserRole(userId) {
    return this.userRoles.get(userId) || ROLES.GUEST;
  }

  // Добавление кастомного разрешения для роли
  addRolePermission(role, permission) {
    if (!this.isValidRole(role)) {
      throw new Error(\`Invalid role: \${role}\`);
    }
    if (!this.isValidPermission(permission)) {
      throw new Error(\`Invalid permission: \${permission}\`);
    }

    if (!this.customRolePermissions.has(role)) {
      this.customRolePermissions.set(role, new Set());
    }
    this.customRolePermissions.get(role).add(permission);
    
    logger.logWithContext('info', \`Permission added to role\`, { role, permission });
  }

  // Удаление кастомного разрешения у роли
  removeRolePermission(role, permission) {
    if (!this.isValidRole(role)) {
      throw new Error(\`Invalid role: \${role}\`);
    }
    if (!this.isValidPermission(permission)) {
      throw new Error(\`Invalid permission: \${permission}\`);
    }

    const rolePerms = this.customRolePermissions.get(role);
    if (rolePerms) {
      rolePerms.delete(permission);
      logger.logWithContext('info', \`Permission removed from role\`, { role, permission });
    }
  }

  // Добавление кастомного разрешения для пользователя
  addUserPermission(userId, permission) {
    if (!this.isValidPermission(permission)) {
      throw new Error(\`Invalid permission: \${permission}\`);
    }

    if (!this.userCustomPermissions.has(userId)) {
      this.userCustomPermissions.set(userId, new Set());
    }
    this.userCustomPermissions.get(userId).add(permission);
    
    logger.logWithContext('info', \`Permission added to user\`, { userId, permission });
  }

  // Удаление кастомного разрешения у пользователя
  removeUserPermission(userId, permission) {
    if (!this.isValidPermission(permission)) {
      throw new Error(\`Invalid permission: \${permission}\`);
    }

    const userPerms = this.userCustomPermissions.get(userId);
    if (userPerms) {
      userPerms.delete(permission);
      logger.logWithContext('info', \`Permission removed from user\`, { userId, permission });
    }
  }

  // Проверка наличия разрешения у пользователя
  hasPermission(userId, permission) {
    if (!this.isValidPermission(permission)) {
      throw new Error(\`Invalid permission: \${permission}\`);
    }

    // Проверяем кастомные разрешения пользователя
    const userCustomPerms = this.userCustomPermissions.get(userId);
    if (userCustomPerms && userCustomPerms.has(permission)) {
      return true;
    }

    // Проверяем разрешения роли пользователя
    const role = this.getUserRole(userId);
    const rolePermissions = this.getRolePermissions(role);
    return rolePermissions.includes(permission);
  }

  // Проверка наличия любого из списка разрешений
  hasAnyPermission(userId, permissions) {
    return permissions.some(permission => this.hasPermission(userId, permission));
  }

  // Проверка наличия всех разрешений из списка
  hasAllPermissions(userId, permissions) {
    return permissions.every(permission => this.hasPermission(userId, permission));
  }

  // Получение всех разрешений пользователя
  getUserPermissions(userId) {
    const permissions = new Set();
    
    // Добавляем разрешения роли
    const rolePermissions = this.getRolePermissions(this.getUserRole(userId));
    rolePermissions.forEach(p => permissions.add(p));
    
    // Добавляем кастомные разрешения пользователя
    const userCustomPerms = this.userCustomPermissions.get(userId);
    if (userCustomPerms) {
      userCustomPerms.forEach(p => permissions.add(p));
    }
    
    return Array.from(permissions);
  }

  // Создание middleware для проверки разрешений
  requirePermission(permission) {
    return (req, res, next) => {
      const userId = req.user?.id;
      
      if (!userId) {
        const error = new Error('Authentication required');
        error.status = 401;
        return next(error);
      }

      if (!this.hasPermission(userId, permission)) {
        const error = new Error('Permission denied');
        error.status = 403;
        return next(error);
      }

      next();
    };
  }

  // Создание middleware для проверки роли
  requireRole(role) {
    return (req, res, next) => {
      const userId = req.user?.id;
      
      if (!userId) {
        const error = new Error('Authentication required');
        error.status = 401;
        return next(error);
      }

      const userRole = this.getUserRole(userId);
      if (userRole !== role && !ROLE_HIERARCHY[userRole]?.includes(role)) {
        const error = new Error('Role access denied');
        error.status = 403;
        return next(error);
      }

      next();
    };
  }
}

// Создаем единственный экземпляр менеджера RBAC
const rbacManager = new RBACManager();

// Экспортируем менеджер и константы
module.exports = {
  rbacManager,
  ROLES,
  PERMISSIONS
};