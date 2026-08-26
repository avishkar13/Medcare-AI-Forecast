# Authentication, Dynamic RBAC, and DC Isolation

This document outlines the complete flow of identity and access management in the MedCare Pharma backend. The system ensures robust authentication, dynamic role-based access control (RBAC), and strict single-DC data isolation.

---

## 1. Request Flow Overview

When an API request enters the backend, it passes through a strict chain of security middleware before it ever reaches a business controller:

1. **Authentication (`authenticate.ts`)**: Verifies the JWT and ensures the user account is active.
2. **DC Isolation Scoping (`scopeDc.ts`)**: Maps the user to their permitted Warehouse/DC boundary.
3. **User Context (`currentUser.ts`)**: Attaches standard user data to `req.user`.
4. **Authorization (`authorize.ts`)**: Verifies that the user has the dynamic permission required for the specific endpoint.
5. **Business Controller**: Executes the request, safely respecting the `req.warehouseScope` boundary injected earlier.

---

## 2. Authentication (`authenticate.ts`)

The authentication middleware handles identity verification using **JSON Web Tokens (JWT)**.

- **Token Validation**: The token is extracted from the `Authorization: Bearer <token>` header and validated using `jsonwebtoken`.
- **Database Verification**: Rather than trusting solely the contents of the JWT payload, the middleware checks the database to verify that the user still exists.
- **Active Status Check**: The middleware actively checks `user.isActive`. If an administrator deactivates a user, their access is cut off immediately—even if they possess a valid, unexpired JWT.

---

## 3. Distribution Center (DC) Data Isolation (`scopeDc.ts`)

A critical security requirement for MedCare Pharma is that E1 users operate in a **SINGLE-DC** paradigm. A user scoped to one Warehouse must absolutely never read or mutate data from another Warehouse.

- **`req.warehouseScope`**: If `user.warehouseId` is populated in the database (e.g., standard users), that ID is bound to `req.warehouseScope`. If it is `null` (e.g., Global Admins), the user enjoys global access.
- **`enforceScopeConflict` Utility**: Any controller that accepts a specific `warehouseId` as a URL parameter or request body payload must run this check. If a user asks for `warehouse2` data while scoped to `warehouse1`, they receive a `403 Forbidden` response.
- **Business Layer Integration**: Services (like Inventory, Forecast, and Dashboard) natively accept an optional `{ warehouseId?: string | null }` scope object. They blindly append this to Prisma `where` clauses, ensuring accidental cross-DC data spillage is impossible.

---

## 4. Dynamic RBAC Authorization (`authorize.ts`)

The authorization layer enforces **Role-Based Access Control** that is fully dynamic and backed by the database.

- **Schema**: 
  - `User` belongs to one `Role`.
  - `Permission` represents a system capability (e.g., `inventory:edit`).
  - `RolePermission` acts as the join table mapping roles to their capabilities.
- **Dynamic Checking**: The middleware is invoked on routes as `authorize("module:action")`. It executes a real-time Prisma query to ensure the current user's role contains the required permission.
- **Immediate Effect**: Because permissions are checked at the database level on every request, if an Admin assigns or revokes a capability (e.g., giving the Inventory Manager role `alerts:view`), the change takes effect immediately without requiring the user to re-authenticate or receive a new JWT.

---

## 5. Admin Management APIs

The system exposes a robust set of Admin APIs to manage Users, Roles, and Permissions, adhering strictly to security best practices.

### Role & Permission Management
Endpoints: `GET/POST/PATCH/DELETE /api/admin/roles` and `PUT /api/admin/roles/:roleId/permissions`
- **Dynamic Role Creation**: Admins can create custom roles on the fly.
- **System Role Protection**: System-critical roles (like `ADMIN`, `PLANNER`, `VIEWER`) are protected via the `isSystemRole` flag. Admins cannot delete or rename them.
- **ACID Transactions**: Assigning permissions to a role (`PUT /permissions`) happens in a single Prisma `$transaction`, guaranteeing consistency.

### User Management
Endpoints: `GET/POST/PATCH /api/admin/users`
- **Scope Assignment**: Users can be assigned to custom roles and scoped to specific Warehouses via `warehouseId` during creation or updates.
- **Deactivation**: Admins can deactivate users (`PATCH /api/admin/users/:userId/status`), immediately cutting off their API access.
- **Last Admin Safety Net**: The backend tracks active system `ADMIN` users. If a user attempts to change the role of, or deactivate, the final active admin in the system, the operation is blocked (`403 Forbidden`). This prevents the organization from accidentally locking itself out of the backend.
- **Secure Password Handling**: Passwords are securely hashed via `bcryptjs`. Hashed passwords are never returned in the API responses.

---

## Summary

By interlocking active token verification, database-driven dynamic capabilities, and a strict middleware-injected data scope, the backend acts as the absolute authority on access control. It does not trust the frontend, ensuring MedCare Pharma's data remains isolated, secure, and manageable.
