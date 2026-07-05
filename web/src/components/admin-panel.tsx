"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stat } from "@/components/ui/stat";
import { Table } from "@/components/ui/table";
import { apiFetch, apiPatch, apiPost } from "@/lib/api/client";

type AdminUser = {
  id: string;
  email: string;
  roles: string[];
  tenantId: string;
  isActive: boolean;
};

type CreateUserForm = {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  roles: string[];
};

const initialForm: CreateUserForm = {
  email: "",
  firstName: "",
  lastName: "",
  temporaryPassword: "",
  roles: ["learner"],
};

// Roles an admin can explicitly assign. These map 1:1 to Keycloak realm roles.
// `employee` is implicit for everyone and `learner` is implied for admins and
// instructors, so those are shown as derived badges rather than assignable here.
const roleOptions = [
  "admin",
  "instructor",
  "learner",
];

// Mirrors the backend `deriveEffectiveRoles` rules so the admin UI can preview
// the full effective role set a user will actually have.
function deriveEffectiveRoles(assigned: string[]): string[] {
  const set = new Set(assigned.map((r) => r.trim().toLowerCase()).filter(Boolean));
  set.add("employee");
  if (set.has("super_admin")) set.add("admin");
  if (set.has("admin") || set.has("instructor")) set.add("learner");
  const order = ["super_admin", "admin", "instructor", "learner", "employee"];
  return order.filter((r) => set.has(r));
}

export function AdminPanel() {
  const [users, setUsers] = useState<
    AdminUser[]
  >([]);
  const [form, setForm] =
    useState<CreateUserForm>(initialForm);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isCreating, setIsCreating] =
    useState(false);
  const [message, setMessage] = useState<
    string | null
  >(null);
  const [error, setError] = useState<
    string | null
  >(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setError(null);

      const data = await apiFetch<AdminUser[]>("/users");
      setUsers(data);
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }

  async function createUser(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setIsCreating(true);
      setError(null);
      setMessage(null);

      await apiPost("/users", {
        email: form.email,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        temporaryPassword: form.temporaryPassword,
        roles: form.roles.length > 0 ? form.roles : ["learner"],
      });

      setForm(initialForm);
      setMessage("User created");
      await loadUsers();
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateRoles(
    userId: string,
    roles: string[],
  ) {
    try {
      setError(null);
      setMessage(null);

      const updatedUser = await apiPatch<AdminUser>(
        `/users/${userId}`,
        { roles: roles.length > 0 ? roles : ["learner"] },
      );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id
            ? updatedUser
            : user,
        ),
      );
      setMessage("Roles updated");
    } catch (updateError) {
      console.error(updateError);
      setError(updateError instanceof Error ? updateError.message : "Failed to update roles");
    }
  }

  async function deactivateUser(userId: string) {
    try {
      setError(null);
      setMessage(null);

      const updatedUser = await apiPatch<AdminUser>(
        `/users/${userId}/deactivate`,
        {},
      );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id
            ? updatedUser
            : user,
        ),
      );
      setMessage("User deactivated");
    } catch (deactivateError) {
      console.error(deactivateError);
      setError(deactivateError instanceof Error ? deactivateError.message : "Failed to deactivate user");
    }
  }

  function updateForm(
    field: keyof CreateUserForm,
    value: string | string[],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function toggleFormRole(role: string) {
    setForm((currentForm) => {
      const has = currentForm.roles.includes(role);
      const roles = has
        ? currentForm.roles.filter((r) => r !== role)
        : [...currentForm.roles, role];
      return { ...currentForm, roles };
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5 bg-[color:var(--color-card-muted)]/80">
        <SectionHeading
          badge={<Badge variant="warning">Tenant Admin</Badge>}
          title="Tenant Admin"
          description="Create users, assign one role, and deactivate accounts inside the current tenant."
          actions={
            <Button
              variant="outline"
              onClick={() => void loadUsers()}
              disabled={isLoading}
            >
              Refresh
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Stat
            label="Users"
            value={users.length}
            hint="Current tenant roster"
          />
          <Stat
            label="Active"
            value={
              users.filter((user) => user.isActive)
                .length
            }
            hint="Can still sign in"
          />
          <Stat
            label="Inactive"
            value={
              users.filter((user) => !user.isActive)
                .length
            }
            hint="Deactivated accounts"
          />
        </div>

        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={createUser}
        >
          <Field label="Email">
            <Input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                updateForm(
                  "email",
                  event.target.value,
                )
              }
              required
            />
          </Field>
          <Field label="First name">
            <Input
              placeholder="First name"
              value={form.firstName}
              onChange={(event) =>
                updateForm(
                  "firstName",
                  event.target.value,
                )
              }
            />
          </Field>
          <Field label="Last name">
            <Input
              placeholder="Last name"
              value={form.lastName}
              onChange={(event) =>
                updateForm(
                  "lastName",
                  event.target.value,
                )
              }
            />
          </Field>
          <Field
            label="Temporary password"
            hint="The user will reset this inside Keycloak."
          >
            <Input
              placeholder="Temporary password"
              type="password"
              value={form.temporaryPassword}
              onChange={(event) =>
                updateForm(
                  "temporaryPassword",
                  event.target.value,
                )
              }
              required
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Roles" className="w-full" hint="Admins & instructors are also learners. Everyone is an employee.">
              <div className="flex flex-wrap items-center gap-3">
                {roleOptions.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-1.5 text-sm text-[var(--color-foreground)]"
                  >
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={() => toggleFormRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </Field>
            <Button
              type="submit"
              disabled={isCreating}
              className="self-end"
            >
              {isCreating
                ? "Creating..."
                : "Create"}
            </Button>
          </div>
        </form>

        {form.roles.length > 0 && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Effective roles:{" "}
            <span className="font-medium text-[var(--color-foreground)]">
              {deriveEffectiveRoles(form.roles).join(", ")}
            </span>
          </p>
        )}

        {message ? (
          <Notice variant="success">
            {message}
          </Notice>
        ) : null}

        {error ? (
          <Notice variant="danger">
            {error}
          </Notice>
        ) : null}
      </Card>

      <Card>
        <SectionHeading
          title="Current Users"
          description="Changes apply to the currently resolved tenant only."
          actions={
            <div className="text-sm text-slate-500">
              {users.length} users
            </div>
          }
        />

        {isLoading ? (
          <div className="py-6 text-sm text-slate-500">
            Loading users...
          </div>
        ) : (
          <Table>
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-3 py-3 font-medium">
                  Email
                </th>
                <th className="px-3 py-3 font-medium">
                  Role
                </th>
                <th className="px-3 py-3 font-medium">
                  Status
                </th>
                <th className="px-3 py-3 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-3 py-4 text-sm text-slate-700">
                    {user.email}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => {
                          const assigned = user.roles.includes(role);
                          return (
                            <label
                              key={role}
                              className="flex items-center gap-1 text-xs text-[var(--color-foreground)]"
                            >
                              <input
                                type="checkbox"
                                checked={assigned}
                                disabled={!user.isActive}
                                onChange={(event) => {
                                  const next = event.target.checked
                                    ? [...user.roles.filter((r) => roleOptions.includes(r)), role]
                                    : user.roles.filter(
                                        (r) => roleOptions.includes(r) && r !== role,
                                      );
                                  void updateRoles(user.id, next);
                                }}
                              />
                              {role}
                            </label>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-[var(--color-muted-foreground)]">
                        Effective: {deriveEffectiveRoles(user.roles).join(", ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm">
                    <Badge
                      variant={
                        user.isActive
                          ? "success"
                          : "neutral"
                      }
                    >
                      {user.isActive
                        ? "active"
                        : "inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!user.isActive}
                      onClick={() =>
                        void deactivateUser(
                          user.id,
                        )
                      }
                    >
                      Deactivate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
