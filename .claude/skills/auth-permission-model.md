---
name: auth-permission-model
description: Auth and permission model — RBAC hierarchy, ABAC policies, permission guards, resource-level authorization, ownership model, permission middleware, role management, permission testing, and access control patterns for TypeScript/Node.js applications
---

# Auth / Permission Model

## Permission Model Comparison

```
RBAC (Role-Based)     → User has Role → Role has Permissions
ABAC (Attribute-Based) → User + Resource + Environment → Policy decision
ReBAC (Relation-Based) → User has Relation to Resource → Access granted
Hybrid                → RBAC for broad access + ABAC for fine-grained

Recommendation:
  Start with RBAC (simple, covers 90% of cases)
  Add ABAC policies for resource-level checks
  Use ReBAC for complex multi-tenant / ownership scenarios
```

## Role & Permission Definitions

### Core Types

```typescript
// src/types/permissions.ts

type Role = 'super_admin' | 'admin' | 'manager' | 'staff' | 'viewer';
type Action = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'share';
type Resource = 'quotation' | 'customer' | 'user' | 'report' | 'settings' | 'audit_log';

type Permission = `${Action}:${Resource}`;

interface RoleDefinition {
    name: Role;
    label: string;
    description: string;
    permissions: Permission[];
    inherits?: Role;  // inherit all permissions from parent role
}

interface UserRole {
    userId: string;
    role: Role;
    scope?: string;    // optional scope (e.g., department, branch)
    grantedBy: string;
    grantedAt: Date;
}
```

### Role Hierarchy

```typescript
// src/auth/roles.ts

const ROLE_HIERARCHY: Record<Role, RoleDefinition> = {
    super_admin: {
        name: 'super_admin',
        label: 'Super Admin',
        description: 'Full system access, can manage other admins',
        permissions: [
            // All permissions — computed from wildcard
            ...([] as Permission[]), // super_admin bypasses all checks
        ],
    },
    admin: {
        name: 'admin',
        label: 'Administrator',
        description: 'Manage users, settings, and all business data',
        permissions: [
            'create:quotation', 'read:quotation', 'update:quotation', 'delete:quotation', 'approve:quotation', 'export:quotation',
            'create:customer', 'read:customer', 'update:customer', 'delete:customer',
            'create:user', 'read:user', 'update:user', 'delete:user',
            'read:report', 'export:report',
            'read:settings', 'update:settings',
            'read:audit_log',
        ],
        inherits: 'manager',
    },
    manager: {
        name: 'manager',
        label: 'Manager',
        description: 'Manage quotations, customers, and approve requests',
        permissions: [
            'create:quotation', 'read:quotation', 'update:quotation', 'approve:quotation', 'export:quotation',
            'create:customer', 'read:customer', 'update:customer',
            'read:user',
            'read:report', 'export:report',
        ],
        inherits: 'staff',
    },
    staff: {
        name: 'staff',
        label: 'Staff',
        description: 'Create and manage quotations and customers',
        permissions: [
            'create:quotation', 'read:quotation', 'update:quotation', 'export:quotation',
            'create:customer', 'read:customer', 'update:customer',
        ],
        inherits: 'viewer',
    },
    viewer: {
        name: 'viewer',
        label: 'Viewer',
        description: 'Read-only access to quotations and customers',
        permissions: [
            'read:quotation',
            'read:customer',
        ],
    },
};
```

### Permission Resolution (with inheritance)

```typescript
// src/auth/permission-resolver.ts

function resolvePermissions(role: Role): Set<Permission> {
    const definition = ROLE_HIERARCHY[role];
    if (!definition) return new Set();

    const permissions = new Set(definition.permissions);

    // Resolve inheritance chain
    if (definition.inherits) {
        const inherited = resolvePermissions(definition.inherits);
        for (const perm of inherited) {
            permissions.add(perm);
        }
    }

    return permissions;
}

function hasPermission(role: Role, permission: Permission): boolean {
    if (role === 'super_admin') return true;

    const permissions = resolvePermissions(role);
    return permissions.has(permission);
}

function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    if (role === 'super_admin') return true;
    const resolved = resolvePermissions(role);
    return permissions.some(p => resolved.has(p));
}

function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    if (role === 'super_admin') return true;
    const resolved = resolvePermissions(role);
    return permissions.every(p => resolved.has(p));
}

// Get all permissions for a role (including inherited)
function listPermissions(role: Role): Permission[] {
    return [...resolvePermissions(role)].sort();
}
```

## Permission Middleware

### Route-Level Guard

```typescript
// src/middleware/permission.ts
import { NextFunction, Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: Role;
        permissions: Permission[];
    };
}

// Require a specific permission
function requirePermission(permission: Permission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: permission,
                role: req.user.role,
            });
        }

        next();
    };
}

// Require ANY of the listed permissions
function requireAnyPermission(...permissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!hasAnyPermission(req.user.role, permissions)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: permissions,
                role: req.user.role,
            });
        }

        next();
    };
}

// Require ALL listed permissions
function requireAllPermissions(...permissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!hasAllPermissions(req.user.role, permissions)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: permissions,
                role: req.user.role,
            });
        }

        next();
    };
}

// Require specific role (or higher in hierarchy)
function requireRole(minRole: Role) {
    const roleLevels: Record<Role, number> = {
        viewer: 0,
        staff: 1,
        manager: 2,
        admin: 3,
        super_admin: 4,
    };

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userLevel = roleLevels[req.user.role] ?? -1;
        const requiredLevel = roleLevels[minRole] ?? 99;

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                error: 'Insufficient role',
                required: minRole,
                current: req.user.role,
            });
        }

        next();
    };
}

export {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireRole,
};
```

### Route Usage

```typescript
import { Router } from 'elit/router';
import { authenticate } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/permission';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// Quotation routes
router.get('/quotations', requirePermission('read:quotation'), listQuotations);
router.post('/quotations', requirePermission('create:quotation'), createQuotation);
router.patch('/quotations/:id', requirePermission('update:quotation'), updateQuotation);
router.delete('/quotations/:id', requirePermission('delete:quotation'), deleteQuotation);
router.post('/quotations/:id/approve', requirePermission('approve:quotation'), approveQuotation);
router.get('/quotations/export', requirePermission('export:quotation'), exportQuotations);

// User management — admin only
router.get('/users', requirePermission('read:user'), listUsers);
router.post('/users', requirePermission('create:user'), createUser);
router.patch('/users/:id', requirePermission('update:user'), updateUser);
router.delete('/users/:id', requirePermission('delete:user'), deleteUser);

// Settings — admin only
router.get('/settings', requirePermission('read:settings'), getSettings);
router.patch('/settings', requirePermission('update:settings'), updateSettings);

// Audit log — admin+ only
router.get('/audit-log', requireRole('admin'), listAuditLog);
```

## Resource-Level Authorization (ABAC)

### Ownership Model

```typescript
// src/auth/resource-auth.ts

interface ResourceOwner {
    ownerId: string;
    department?: string;
    branch?: string;
    visibility?: 'private' | 'department' | 'company';
}

type AccessLevel = 'own' | 'department' | 'all';

interface ResourcePolicy {
    resource: Resource;
    action: Action;
    role: Role;
    accessLevel: AccessLevel;
}

// Policies define WHO can access WHOSE resources
const RESOURCE_POLICIES: ResourcePolicy[] = [
    // Quotation policies
    { resource: 'quotation', action: 'read', role: 'viewer', accessLevel: 'own' },
    { resource: 'quotation', action: 'read', role: 'staff', accessLevel: 'department' },
    { resource: 'quotation', action: 'read', role: 'manager', accessLevel: 'all' },
    { resource: 'quotation', action: 'update', role: 'staff', accessLevel: 'own' },
    { resource: 'quotation', action: 'update', role: 'manager', accessLevel: 'department' },
    { resource: 'quotation', action: 'update', role: 'admin', accessLevel: 'all' },
    { resource: 'quotation', action: 'delete', role: 'admin', accessLevel: 'all' },
    { resource: 'quotation', action: 'approve', role: 'manager', accessLevel: 'department' },
    { resource: 'quotation', action: 'approve', role: 'admin', accessLevel: 'all' },

    // Customer policies
    { resource: 'customer', action: 'read', role: 'staff', accessLevel: 'department' },
    { resource: 'customer', action: 'update', role: 'staff', accessLevel: 'own' },
    { resource: 'customer', action: 'update', role: 'manager', accessLevel: 'all' },
];

class ResourceAuthorizer {
    private policies: ResourcePolicy[];

    constructor(policies: ResourcePolicy[] = RESOURCE_POLICIES) {
        this.policies = policies;
    }

    canAccess(params: {
        user: { id: string; role: Role; department?: string };
        resource: Resource;
        action: Action;
        target: ResourceOwner;
    }): boolean {
        if (params.user.role === 'super_admin') return true;

        const policy = this.policies.find(
            p => p.resource === params.resource
                && p.action === params.action
                && p.role === params.user.role
        );

        if (!policy) return false;

        switch (policy.accessLevel) {
            case 'own':
                return params.target.ownerId === params.user.id;
            case 'department':
                return params.target.ownerId === params.user.id
                    || params.target.department === params.user.department;
            case 'all':
                return true;
        }
    }

    // Build database query filter for list endpoints
    getAccessFilter(params: {
        user: { id: string; role: Role; department?: string };
        resource: Resource;
        action: Action;
    }): Record<string, unknown> {
        if (params.user.role === 'super_admin') return {};

        const policy = this.policies.find(
            p => p.resource === params.resource
                && p.action === params.action
                && p.role === params.user.role
        );

        if (!policy) return { _noAccess: true }; // matches nothing

        switch (policy.accessLevel) {
            case 'own':
                return { ownerId: params.user.id };
            case 'department':
                return {
                    $or: [
                        { ownerId: params.user.id },
                        { department: params.user.department },
                    ],
                };
            case 'all':
                return {};
        }
    }
}

const authorizer = new ResourceAuthorizer();
```

### Resource Authorization Middleware

```typescript
// src/middleware/resource-auth.ts

function authorizeResource(resource: Resource, action: Action) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // First check role-level permission
        const permission: Permission = `${action}:${resource}`;
        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({ error: 'Forbidden', required: permission });
        }

        // For single-resource actions, check ownership
        if (['read', 'update', 'delete'].includes(action) && req.params.id) {
            const targetResource = await fetchResourceOwner(resource, req.params.id);

            if (!targetResource) {
                return res.status(404).json({ error: 'Not found' });
            }

            const canAccess = authorizer.canAccess({
                user: {
                    id: req.user.id,
                    role: req.user.role,
                    department: req.user.department,
                },
                resource,
                action,
                target: targetResource,
            });

            if (!canAccess) {
                return res.status(403).json({ error: 'Access denied for this resource' });
            }

            // Attach resource for handler use
            req.resource = targetResource;
        }

        // For list actions, apply filter
        if (action === 'read' && !req.params.id) {
            const filter = authorizer.getAccessFilter({
                user: { id: req.user.id, role: req.user.role, department: req.user.department },
                resource,
                action,
            });
            req.accessFilter = filter;
        }

        next();
    };
}

// Usage
router.get('/quotations', authorizeResource('quotation', 'read'), listQuotations);
router.patch('/quotations/:id', authorizeResource('quotation', 'update'), updateQuotation);
router.delete('/quotations/:id', authorizeResource('quotation', 'delete'), deleteQuotation);
router.post('/quotations/:id/approve', authorizeResource('quotation', 'approve'), approveQuotation);
```

## Role Management

### Role Assignment Service

```typescript
// src/services/role-service.ts

class RoleService {
    // Grant role to user
    async grantRole(params: {
        userId: string;
        role: Role;
        grantedBy: string;
        scope?: string;
    }): Promise<UserRole> {
        // Validate: cannot grant role higher than your own
        const granter = await this.getUser(params.grantedBy);
        const granterLevel = getRoleLevel(granter.role);
        const targetLevel = getRoleLevel(params.role);

        if (granterLevel <= targetLevel) {
            throw new ForbiddenError('Cannot grant equal or higher role than your own');
        }

        // Validate: only super_admin can grant admin
        if (params.role === 'admin' && granter.role !== 'super_admin') {
            throw new ForbiddenError('Only super admin can grant admin role');
        }

        // Check if user already has this role
        const existing = await this.findUserRole(params.userId, params.role);
        if (existing) {
            throw new ConflictError('User already has this role');
        }

        const userRole: UserRole = {
            userId: params.userId,
            role: params.role,
            scope: params.scope,
            grantedBy: params.grantedBy,
            grantedAt: new Date(),
        };

        await this.repo.create(userRole);

        // Audit log
        await this.auditLog({
            action: 'role.granted',
            actor: params.grantedBy,
            target: params.userId,
            details: { role: params.role, scope: params.scope },
        });

        return userRole;
    }

    // Revoke role from user
    async revokeRole(params: {
        userId: string;
        role: Role;
        revokedBy: string;
    }): Promise<void> {
        const revoker = await this.getUser(params.revokedBy);
        const revokerLevel = getRoleLevel(revoker.role);
        const targetLevel = getRoleLevel(params.role);

        if (revokerLevel <= targetLevel) {
            throw new ForbiddenError('Cannot revoke equal or higher role than your own');
        }

        // Cannot revoke your own role
        if (params.userId === params.revokedBy) {
            throw new ForbiddenError('Cannot revoke your own role');
        }

        await this.repo.delete(params.userId, params.role);

        await this.auditLog({
            action: 'role.revoked',
            actor: params.revokedBy,
            target: params.userId,
            details: { role: params.role },
        });
    }

    // Get effective permissions for a user (including all roles)
    async getUserPermissions(userId: string): Promise<Permission[]> {
        const userRoles = await this.repo.findUserRoles(userId);
        const allPermissions = new Set<Permission>();

        for (const ur of userRoles) {
            const perms = resolvePermissions(ur.role);
            for (const p of perms) {
                allPermissions.add(p);
            }
        }

        return [...allPermissions].sort();
    }
}

function getRoleLevel(role: Role): number {
    const levels: Record<Role, number> = {
        viewer: 0,
        staff: 1,
        manager: 2,
        admin: 3,
        super_admin: 4,
    };
    return levels[role] ?? -1;
}
```

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Roles table
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'staff', 'viewer')),
    scope TEXT,
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Permissions audit log
CREATE TABLE permission_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    resource_type TEXT,
    resource_id TEXT,
    permission TEXT,
    granted BOOLEAN,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_permission_audit_actor ON permission_audit(actor_id);
CREATE INDEX idx_permission_audit_target ON permission_audit(target_user_id);
CREATE INDEX idx_permission_audit_created ON permission_audit(created_at);
```

## Permission Checking Patterns

### Conditional Permission Check

```typescript
// In service layer — not just middleware
class QuotationService {
    async approve(id: string, approver: AuthenticatedUser): Promise<Quotation> {
        const quotation = await this.repo.findById(id);
        if (!quotation) throw new NotFoundError('Quotation', id);

        // Check basic permission
        if (!hasPermission(approver.role, 'approve:quotation')) {
            throw new ForbiddenError('You do not have permission to approve quotations');
        }

        // Check resource-level access
        if (!authorizer.canAccess({
            user: { id: approver.id, role: approver.role, department: approver.department },
            resource: 'quotation',
            action: 'approve',
            target: quotation,
        })) {
            throw new ForbiddenError('You cannot approve this quotation');
        }

        // Business rule: cannot approve own quotation
        if (quotation.ownerId === approver.id) {
            throw new ForbiddenError('Cannot approve your own quotation');
        }

        // Business rule: only draft quotations can be approved
        if (quotation.status !== 'draft') {
            throw new ConflictError('Only draft quotations can be approved');
        }

        return this.repo.update(id, {
            status: 'approved',
            approvedBy: approver.id,
            approvedAt: new Date(),
        });
    }
}
```

### Frontend Permission Check

```typescript
// src/client/permissions.ts
// Mirror of server-side permission checks for UI rendering

type ClientPermission = Permission;

function hasClientPermission(role: Role, permission: ClientPermission): boolean {
    // Same logic as server-side
    return hasPermission(role, permission);
}

// React hook
function usePermission(permission: ClientPermission): boolean {
    const user = useCurrentUser();
    if (!user) return false;
    return hasClientPermission(user.role, permission);
}

// Usage in components
function QuotationActions({ quotation }: { quotation: Quotation }) {
    const canEdit = usePermission('update:quotation');
    const canDelete = usePermission('delete:quotation');
    const canApprove = usePermission('approve:quotation');
    const isOwner = quotation.ownerId === useCurrentUserId();

    return (
        <div>
            {canEdit && <button>Edit</button>}
            {canDelete && <button>Delete</button>}
            {canApprove && !isOwner && quotation.status === 'draft' && (
                <button>Approve</button>
            )}
        </div>
    );
}
```

## Permission Testing

### Permission Matrix Test

```typescript
// tests/permissions/matrix.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission, resolvePermissions } from '../../src/auth/permission-resolver';

type Role = 'super_admin' | 'admin' | 'manager' | 'staff' | 'viewer';

describe('Permission Matrix', () => {
    const roles: Role[] = ['super_admin', 'admin', 'manager', 'staff', 'viewer'];

    // Quotation permissions
    const quotationPermissions: Record<string, Role[]> = {
        'create:quotation': ['super_admin', 'admin', 'manager', 'staff'],
        'read:quotation': ['super_admin', 'admin', 'manager', 'staff', 'viewer'],
        'update:quotation': ['super_admin', 'admin', 'manager', 'staff'],
        'delete:quotation': ['super_admin', 'admin'],
        'approve:quotation': ['super_admin', 'admin', 'manager'],
        'export:quotation': ['super_admin', 'admin', 'manager', 'staff'],
    };

    for (const [permission, allowedRoles] of Object.entries(quotationPermissions)) {
        describe(`${permission}`, () => {
            for (const role of roles) {
                const shouldHave = allowedRoles.includes(role);
                it(`${shouldHave ? 'GRANTS' : 'DENIES'} ${role}`, () => {
                    expect(hasPermission(role, permission as Permission)).toBe(shouldHave);
                });
            }
        });
    }

    // User management permissions
    const userPermissions: Record<string, Role[]> = {
        'create:user': ['super_admin', 'admin'],
        'read:user': ['super_admin', 'admin', 'manager'],
        'update:user': ['super_admin', 'admin'],
        'delete:user': ['super_admin', 'admin'],
    };

    for (const [permission, allowedRoles] of Object.entries(userPermissions)) {
        describe(`${permission}`, () => {
            for (const role of roles) {
                const shouldHave = allowedRoles.includes(role);
                it(`${shouldHave ? 'GRANTS' : 'DENIES'} ${role}`, () => {
                    expect(hasPermission(role, permission as Permission)).toBe(shouldHave);
                });
            }
        });
    }
});

describe('Permission Inheritance', () => {
    it('admin inherits all staff permissions', () => {
        const staffPerms = resolvePermissions('staff');
        const adminPerms = resolvePermissions('admin');

        for (const perm of staffPerms) {
            expect(adminPerms.has(perm)).toBe(true);
        }
    });

    it('manager inherits all viewer permissions', () => {
        const viewerPerms = resolvePermissions('viewer');
        const managerPerms = resolvePermissions('manager');

        for (const perm of viewerPerms) {
            expect(managerPerms.has(perm)).toBe(true);
        }
    });

    it('super_admin has all permissions', () => {
        expect(hasPermission('super_admin', 'delete:user')).toBe(true);
        expect(hasPermission('super_admin', 'update:settings')).toBe(true);
        expect(hasPermission('super_admin', 'approve:quotation')).toBe(true);
    });
});
```

### Resource Authorization Test

```typescript
// tests/permissions/resource-auth.test.ts
import { describe, it, expect } from 'vitest';
import { ResourceAuthorizer } from '../../src/auth/resource-auth';

const authorizer = new ResourceAuthorizer();

describe('Quotation resource access', () => {
    const owner = { id: 'user-1', role: 'staff' as const, department: 'sales' };
    const sameDept = { id: 'user-2', role: 'staff' as const, department: 'sales' };
    const otherDept = { id: 'user-3', role: 'staff' as const, department: 'marketing' };
    const manager = { id: 'mgr-1', role: 'manager' as const, department: 'sales' };

    const ownQuotation = { ownerId: 'user-1', department: 'sales', visibility: 'department' as const };

    describe('read', () => {
        it('owner can read own quotation', () => {
            expect(authorizer.canAccess({ user: owner, resource: 'quotation', action: 'read', target: ownQuotation })).toBe(true);
        });

        it('same department staff can read', () => {
            expect(authorizer.canAccess({ user: sameDept, resource: 'quotation', action: 'read', target: ownQuotation })).toBe(true);
        });

        it('other department staff cannot read', () => {
            expect(authorizer.canAccess({ user: otherDept, resource: 'quotation', action: 'read', target: ownQuotation })).toBe(false);
        });

        it('manager can read all quotations', () => {
            expect(authorizer.canAccess({ user: manager, resource: 'quotation', action: 'read', target: ownQuotation })).toBe(true);
        });
    });

    describe('update', () => {
        it('owner can update own quotation', () => {
            expect(authorizer.canAccess({ user: owner, resource: 'quotation', action: 'update', target: ownQuotation })).toBe(true);
        });

        it('same department staff cannot update others quotation', () => {
            expect(authorizer.canAccess({ user: sameDept, resource: 'quotation', action: 'update', target: ownQuotation })).toBe(false);
        });

        it('manager can update department quotations', () => {
            expect(authorizer.canAccess({ user: manager, resource: 'quotation', action: 'update', target: ownQuotation })).toBe(true);
        });
    });
});
```

### API Integration Test

```typescript
// tests/integration/permission-guard.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { createTestToken } from '../helpers/auth';

describe('Permission Guards', () => {
    describe('POST /api/quotations/:id/approve', () => {
        it('viewer cannot approve (403)', async () => {
            const token = createTestToken({ role: 'viewer' });
            await request(app)
                .post('/api/quotations/qt-001/approve')
                .set('Authorization', `Bearer ${token}`)
                .expect(403);
        });

        it('staff cannot approve (403)', async () => {
            const token = createTestToken({ role: 'staff' });
            await request(app)
                .post('/api/quotations/qt-001/approve')
                .set('Authorization', `Bearer ${token}`)
                .expect(403);
        });

        it('manager can approve', async () => {
            const token = createTestToken({ role: 'manager' });
            await request(app)
                .post('/api/quotations/qt-001/approve')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
        });

        it('unauthenticated returns 401', async () => {
            await request(app)
                .post('/api/quotations/qt-001/approve')
                .expect(401);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('manager cannot delete users (403)', async () => {
            const token = createTestToken({ role: 'manager' });
            await request(app)
                .delete('/api/users/user-123')
                .set('Authorization', `Bearer ${token}`)
                .expect(403);
        });

        it('admin can delete users', async () => {
            const token = createTestToken({ role: 'admin' });
            await request(app)
                .delete('/api/users/user-123')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
        });
    });
});
```

## Permission Audit

### Audit Logging Middleware

```typescript
// src/middleware/audit-log.ts

function auditAccess(resource: Resource, action: Action) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Run the handler first
        next();

        // After response, log the access decision
        res.on('finish', async () => {
            if (!req.user) return;

            const granted = res.statusCode < 400;

            await auditRepo.create({
                action: `${action}:${resource}`,
                actorId: req.user.id,
                resourceType: resource,
                resourceId: req.params.id ?? null,
                granted,
                statusCode: res.statusCode,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date(),
            });
        });
    };
}

// Usage
router.delete('/quotations/:id',
    authenticate,
    authorizeResource('quotation', 'delete'),
    auditAccess('quotation', 'delete'),
    deleteQuotation,
);
```

## Code Style Rules

- Define all permissions as typed string literals (`${Action}:${Resource}`) — never use magic strings
- Use role hierarchy with inheritance — avoid duplicating permissions across roles
- Check permissions at both middleware level (route guard) AND service level (business logic)
- Resource-level authorization (ownership/department) must be checked after role-level permission
- Never trust client-side permission checks alone — always verify on the server
- Log all permission decisions (grant/deny) to audit table for compliance
- Test the full permission matrix — every role × every permission must have an explicit test
- Super admin bypasses all checks but is still logged in audit trail
- Role assignment must follow the rule: cannot grant a role equal to or higher than your own
- Frontend mirrors permission checks for UI rendering, but server is the source of truth
