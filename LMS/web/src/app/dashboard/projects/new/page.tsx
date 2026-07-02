"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/api/projects";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", startDate: "", targetEndDate: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createProject({ title: form.title, description: form.description || undefined, startDate: form.startDate || undefined, targetEndDate: form.targetEndDate || undefined });
    router.push("/dashboard/projects");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Project</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target End Date</label>
            <input type="date" value={form.targetEndDate} onChange={(e) => setForm({ ...form, targetEndDate: e.target.value })} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create Project</button>
      </form>
    </div>
  );
}
