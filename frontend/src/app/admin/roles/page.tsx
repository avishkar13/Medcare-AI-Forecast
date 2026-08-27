"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, ShieldAlert, Key, Users, Settings2, ShieldCheck } from "lucide-react";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, usePermissions, useAssignRolePermissions, useRole } from "@/hooks/use-admin-roles";
import { Role, Permission } from "@/lib/api/admin-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export default function AdminRolesPage() {
  const { data: roles, isLoading } = useRoles();
  const { data: allPermissions } = usePermissions();

  const { mutate: createRole, isPending: isCreating } = useCreateRole();
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole();
  const { mutate: deleteRole } = useDeleteRole();
  const { mutate: assignPermissions, isPending: isAssigning } = useAssignRolePermissions();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [managingPermissionsRole, setManagingPermissionsRole] = useState<Role | null>(null);

  const [formData, setFormData] = useState({ name: "", description: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { hasPermission } = useAuthStore();

  const { data: roleDetails, isFetching: isFetchingRoleDetails } = useRole(managingPermissionsRole?.id);

  useEffect(() => {
    if (roleDetails && managingPermissionsRole && roleDetails.id === managingPermissionsRole.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPermissions(roleDetails.permissions?.map((p: Permission) => p.id) || []);
    }
  }, [roleDetails, managingPermissionsRole]);

  const handleCreateRole = () => {
    if (!formData.name) return;
    createRole(formData, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setFormData({ name: "", description: "" });
      }
    });
  };

  const handleEditRole = () => {
    if (!editingRole || !formData.name) return;
    updateRole({ roleId: editingRole.id, data: formData }, {
      onSuccess: () => setEditingRole(null)
    });
  };

  const handleAssignPermissions = () => {
    if (!managingPermissionsRole) return;
    assignPermissions({
      roleId: managingPermissionsRole.id,
      data: { permissionIds: selectedPermissions }
    }, {
      onSuccess: () => setManagingPermissionsRole(null)
    });
  };

  const openEditModal = (role: Role) => {
    setFormData({ name: role.name, description: role.description || "" });
    setEditingRole(role);
  };

  const openPermissionsModal = (role: Role) => {
    setManagingPermissionsRole(role);
    // Permissions will be set by useEffect once roleDetails are fetched
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const groupedPermissions = allPermissions?.reduce((acc: Record<string, Permission[]>, curr: Permission) => {
    acc[curr.module] = acc[curr.module] || [];
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <PermissionGuard requiredPermission="roles:view">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Portal</span>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[500px]">
            Create and manage access control lists across the application.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasPermission("roles:create") && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="h-10 px-6 font-bold shadow-sm bg-primary hover:bg-primary/90 transition-all">
              <Plus className="mr-2 h-4 w-4" /> Create Role
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          roles?.map((role) => (
            <Card key={role.id} className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {role.name}
                  </CardTitle>
                  {role.isSystemRole && (
                    <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider flex items-center gap-1 bg-muted">
                      <ShieldAlert className="h-3 w-3" /> System Role
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 opacity-50 group-hover:opacity-100 transition-opacity" />}>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {hasPermission("roles:update") && (
                      <DropdownMenuItem onClick={() => openPermissionsModal(role)}>
                        <Settings2 className="mr-2 h-4 w-4" /> Manage Permissions
                      </DropdownMenuItem>
                    )}
                    {!role.isSystemRole && hasPermission("roles:update") && (
                      <DropdownMenuItem onClick={() => openEditModal(role)}>
                        Edit Role
                      </DropdownMenuItem>
                    )}
                    {!role.isSystemRole && hasPermission("roles:delete") && (
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteRole(role.id)}
                      >
                        Delete Role
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">
                  {role.description || "No description provided for this role."}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t border-border/30 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-semibold">{role.userCount || 0} Users</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Key className="h-4 w-4" />
                  <span className="text-xs font-semibold">{role.permissions?.length || 0} Permissions</span>
                </div>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRole} disabled={isCreating}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button onClick={handleEditRole} disabled={isUpdating}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={!!managingPermissionsRole} onOpenChange={(open) => !open && setManagingPermissionsRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
            <DialogDescription>
              Select the permissions that apply to the <strong>{managingPermissionsRole?.name}</strong> role.
              {isFetchingRoleDetails && <span className="ml-2 text-primary animate-pulse">Loading permissions...</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4 max-h-[60vh] overflow-y-auto">
            {groupedPermissions && Object.entries(groupedPermissions).map(([module, perms]: [string, Permission[]]) => (
              <div key={module} className="space-y-3">
                <h4 className="font-semibold text-sm capitalize border-b pb-1">{module}</h4>
                <div className="space-y-2">
                  {perms.map((p: Permission) => (
                    <div key={p.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`perm-${p.id}`}
                        checked={selectedPermissions.includes(p.id)}
                        onCheckedChange={() => togglePermission(p.id)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`perm-${p.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {p.name}
                        </label>
                        {p.description && (
                          <p className="text-[10px] text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingPermissionsRole(null)}>Cancel</Button>
            <Button onClick={handleAssignPermissions} disabled={isAssigning}>Save Permissions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </PermissionGuard>
  );
}
