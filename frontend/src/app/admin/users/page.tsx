"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, UserCircle, Mail, Shield, Building } from "lucide-react";
import { useUsers, useCreateUser, useUpdateUser, useUpdateUserStatus, useResetPassword } from "@/hooks/use-admin-users";
import { User } from "@/lib/api/admin-users";
import { useRoles } from "@/hooks/use-admin-roles";
import { useWarehouses } from "@/hooks/use-masterdata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dcFilter, setDcFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryParams = {
    ...(roleFilter !== "all" && { roleId: roleFilter }),
    ...(dcFilter !== "all" && { warehouseId: dcFilter }),
    ...(statusFilter !== "all" && { active: statusFilter === "active" }),
  };

  const { data: users, isLoading } = useUsers(queryParams);
  const { data: roles } = useRoles();
  const { data: warehouses } = useWarehouses();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: updateStatus } = useUpdateUserStatus();
  const { mutate: resetPassword, isPending: isResetting } = useResetPassword();

  const [formData, setFormData] = useState({ name: "", email: "", password: "", roleId: "", warehouseId: "none" });
  const [resetPwd, setResetPwd] = useState("");
  
  const { hasPermission } = useAuthStore();

  const handleCreateUser = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.roleId) return;
    createUser({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      roleId: formData.roleId,
      warehouseId: formData.warehouseId === "none" ? null : formData.warehouseId,
    }, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setFormData({ name: "", email: "", password: "", roleId: "", warehouseId: "none" });
      }
    });
  };

  const handleEditUser = () => {
    if (!editingUser || !formData.name || !formData.roleId) return;
    updateUser({
      userId: editingUser.id,
      data: {
        name: formData.name,
        roleId: formData.roleId,
        warehouseId: formData.warehouseId === "none" ? null : formData.warehouseId,
      }
    }, {
      onSuccess: () => setEditingUser(null)
    });
  };

  const handleResetPassword = () => {
    if (!resetPasswordUser || !resetPwd) return;
    resetPassword({
      userId: resetPasswordUser.id,
      data: { password: resetPwd }
    }, {
      onSuccess: () => {
        setResetPasswordUser(null);
        setResetPwd("");
      }
    });
  };

  const openEditModal = (user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: "", // not used in edit
      roleId: user.roleId,
      warehouseId: user.warehouseId || "none"
    });
    setEditingUser(user);
  };

  return (
    <PermissionGuard requiredPermission="users:view">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Portal</span>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[500px]">
            Manage users, roles and distribution center access across the system.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasPermission("users:create") && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="h-10 px-6 font-bold shadow-sm bg-primary hover:bg-primary/90 transition-all">
              <Plus className="mr-2 h-4 w-4" /> Create User
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            {/*
              Three equal cells. The Role filter had no wrapper of its own, so its
              closing tag shut the grid early and the DC and Status filters - sized
              `w-1/4` - fell outside it entirely, leaving the bar visibly broken.
            */}
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block text-xs font-semibold text-muted-foreground">Role</Label>
                <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val || "all")}>
                  <SelectTrigger>
              <SelectValue placeholder="All Roles">
                {roleFilter === "all" ? "All Roles" : roles?.find(r => r.id === roleFilter)?.name || "All Roles"}
              </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles?.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
                  </SelectContent>
                </Select>
        </div>
              <div>
                <Label className="mb-2 block text-xs font-semibold text-muted-foreground">DC</Label>
                <Select value={dcFilter} onValueChange={(val) => setDcFilter(val || "all")}>
                  <SelectTrigger>
              <SelectValue placeholder="All DCs">
                {dcFilter === "all" ? "All DCs" : warehouses?.find(w => w.id === dcFilter)?.name || "All DCs"}
              </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
              <SelectItem value="all">All DCs</SelectItem>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>
              ))}
                  </SelectContent>
                </Select>
        </div>
              <div>
                <Label className="mb-2 block text-xs font-semibold text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                  <SelectTrigger>
              <SelectValue placeholder="All">
                {statusFilter === "all" ? "All Status" : statusFilter === "active" ? "Active" : "Inactive"}
              </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                  </div>
                </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground text-xs font-semibold border-b border-border/50 uppercase tracking-wider">
                <tr>
                  <th className="h-12 px-6 align-middle font-medium">Name</th>
                  <th className="h-12 px-6 align-middle font-medium">Email</th>
                  <th className="h-12 px-6 align-middle font-medium">Role</th>
                  <th className="h-12 px-6 align-middle font-medium">Assigned DC</th>
                  <th className="h-12 px-6 align-middle font-medium">Status</th>
                  <th className="h-12 px-6 align-middle font-medium w-14"></th>
                </tr>
              </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
              ) : users?.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No users found.</td></tr>
              ) : (
                users?.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="p-6 align-middle font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td className="p-6 align-middle text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                    </td>
                    <td className="p-6 align-middle">
                      <Badge variant="outline" className="bg-background flex items-center gap-1 w-fit">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        {user.role?.name}
                      </Badge>
                    </td>
                    <td className="p-6 align-middle">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="h-3 w-3" />
                        {user.warehouseId ? warehouses?.find(w => w.id === user.warehouseId)?.code || user.warehouseId : "Global Access"}
                      </div>
                    </td>
                    <td className="p-6 align-middle">
                      <Badge variant={user.isActive ? "default" : "secondary"} className={cn("flex items-center gap-1 w-fit font-semibold", user.isActive ? "bg-success/15 text-success hover:bg-success/25 border-success/30" : "opacity-70")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", user.isActive ? "bg-success" : "bg-muted-foreground")} />
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-6 align-middle text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasPermission("users:update") && (
                            <DropdownMenuItem onClick={() => openEditModal(user)}>
                              Edit User
                            </DropdownMenuItem>
                          )}
                          {hasPermission("users:update") && (
                            <DropdownMenuItem onClick={() => setResetPasswordUser(user)}>
                              Reset Password
                            </DropdownMenuItem>
                          )}
                          {hasPermission("users:deactivate") && (
                            <DropdownMenuItem onClick={() => updateStatus({ userId: user.id, data: { active: !user.isActive } })}>
                              {user.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.roleId} onValueChange={(val) => setFormData({ ...formData, roleId: val || "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role">
                    {roles?.find(r => r.id === formData.roleId)?.name || "Select Role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Distribution Center</Label>
              <Select value={formData.warehouseId} onValueChange={(val) => setFormData({ ...formData, warehouseId: val || "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select DC">
                    {formData.warehouseId === "none" ? "All DCs (Global Admin)" : warehouses?.find(w => w.id === formData.warehouseId)?.name || "Select DC"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All DCs (Global Admin)</SelectItem>
                  {warehouses?.map(w => <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={isCreating}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input disabled value={formData.email} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.roleId} onValueChange={(val) => setFormData({ ...formData, roleId: val || "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role">
                    {roles?.find(r => r.id === formData.roleId)?.name || "Select Role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Distribution Center</Label>
              <Select value={formData.warehouseId} onValueChange={(val) => setFormData({ ...formData, warehouseId: val || "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select DC">
                    {formData.warehouseId === "none" ? "All DCs (Global Admin)" : warehouses?.find(w => w.id === formData.warehouseId)?.name || "Select DC"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All DCs (Global Admin)</SelectItem>
                  {warehouses?.map(w => <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={isUpdating}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>New Password</Label>
              <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={isResetting || !resetPwd}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
}
