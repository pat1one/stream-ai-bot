const { rbacManager, ROLES, PERMISSIONS } = require('../rbac_new');

describe('RBAC Manager', () => {
  beforeEach(() => {
    // Сбросить состояние перед каждым тестом
    rbacManager.userRoles.clear();
    rbacManager.userCustomPermissions.clear();
    rbacManager.customRolePermissions.clear();
  });

  test('assign and get user role', () => {
    rbacManager.assignRole('user1', ROLES.ADMIN);
    expect(rbacManager.getUserRole('user1')).toBe(ROLES.ADMIN);
    expect(rbacManager.getUserRole('unknown')).toBe(ROLES.GUEST);
  });

  test('role permissions inheritance', () => {
    const adminPerms = rbacManager.getRolePermissions(ROLES.ADMIN);
    expect(adminPerms).toContain(PERMISSIONS.MANAGE_USERS);
    expect(adminPerms).toContain(PERMISSIONS.VIEW_COMMANDS);
    expect(adminPerms).toContain(PERMISSIONS.VIEW_WEBHOOKS);
  });

  test('user custom permissions', () => {
    rbacManager.assignRole('user2', ROLES.USER);
    expect(rbacManager.hasPermission('user2', PERMISSIONS.MANAGE_COMMANDS)).toBe(false);
    rbacManager.addUserPermission('user2', PERMISSIONS.MANAGE_COMMANDS);
    expect(rbacManager.hasPermission('user2', PERMISSIONS.MANAGE_COMMANDS)).toBe(true);
    rbacManager.removeUserPermission('user2', PERMISSIONS.MANAGE_COMMANDS);
    expect(rbacManager.hasPermission('user2', PERMISSIONS.MANAGE_COMMANDS)).toBe(false);
  });

  test('role custom permissions', () => {
    rbacManager.addRolePermission(ROLES.USER, PERMISSIONS.MANAGE_COMMANDS);
    expect(rbacManager.getRolePermissions(ROLES.USER)).toContain(PERMISSIONS.MANAGE_COMMANDS);
    rbacManager.removeRolePermission(ROLES.USER, PERMISSIONS.MANAGE_COMMANDS);
    expect(rbacManager.getRolePermissions(ROLES.USER)).not.toContain(PERMISSIONS.MANAGE_COMMANDS);
  });

  test('requirePermission middleware', () => {
    const req = { user: { id: 'user3' } };
    rbacManager.assignRole('user3', ROLES.ADMIN);
    let called = false;
    const res = {};
    const next = (err) => { if (!err) called = true; };
    rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS)(req, res, next);
    expect(called).toBe(true);
  });
});
