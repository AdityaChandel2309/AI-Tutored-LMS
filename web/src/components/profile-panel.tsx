"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiFetch, apiPatch } from "@/lib/api/client";

type ProfileUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export function ProfilePanel({
  user,
  onUserChange,
}: {
  user: ProfileUser;
  onUserChange: (user: ProfileUser) => void;
}) {
  const [firstName, setFirstName] = useState(
    user.firstName ?? "",
  );
  const [lastName, setLastName] = useState(
    user.lastName ?? "",
  );
  const [isSaving, setIsSaving] =
    useState(false);
  const [isUploading, setIsUploading] =
    useState(false);
  const [message, setMessage] = useState<
    string | null
  >(null);
  const [error, setError] = useState<
    string | null
  >(null);

  async function saveProfile(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);

      const updatedUser = await apiPatch<ProfileUser>(
        "/profile",
        { firstName, lastName },
      );
      onUserChange(updatedUser);
      setMessage("Profile updated");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadAvatar(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append("file", file);

      const updatedUser = await apiFetch<ProfileUser>(
        "/avatar",
        { method: "POST", body: formData },
      );
      onUserChange(updatedUser);
      setMessage("Avatar uploaded");
      event.target.value = "";
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="space-y-6 bg-white/85">
      <SectionHeading
        badge={<Badge variant="neutral">Profile</Badge>}
        title="Identity Settings"
        description="Update your display details and avatar."
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-[var(--color-card-muted)] text-lg font-semibold text-slate-600 shadow-sm">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt="User avatar"
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <span>
                {(
                  firstName?.[0] ??
                  user.email[0] ??
                  "U"
                ).toUpperCase()}
              </span>
            )}
          </div>
          <label className="text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-800">
              Avatar
            </span>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm"
              onChange={uploadAvatar}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={saveProfile}
      >
        <Field label="First name">
          <Input
            placeholder="First name"
            value={firstName}
            onChange={(event) =>
              setFirstName(
                event.target.value,
              )
            }
          />
        </Field>
        <Field label="Last name">
          <Input
            placeholder="Last name"
            value={lastName}
            onChange={(event) =>
              setLastName(
                event.target.value,
              )
            }
          />
        </Field>
        <div className="md:col-span-2 flex items-center gap-3">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? "Saving..."
              : "Save profile"}
          </Button>
          {isUploading ? (
            <span className="text-sm text-slate-500">
              Uploading avatar...
            </span>
          ) : null}
        </div>
      </form>

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
  );
}
