"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDocument, getDownloadUrl, uploadVersion } from "@/lib/api/knowledge";
import type { Document } from "@/lib/types/knowledge";

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getDocument(id);
      setDoc(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load document');
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This page fetches route-scoped data after the dynamic id is available.
      void load();
    }
  }, [id, load]);

  async function handleDownload() {
    const { url } = await getDownloadUrl(id);
    window.open(url, "_blank");
  }

  async function handleUploadVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionFile) return;
    setUploading(true);
    try {
      await uploadVersion(id, versionFile, changeNote || undefined);
      setVersionFile(null);
      setChangeNote("");
      void load();
    } finally {
      setUploading(false);
    }
  }

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!doc) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Download</button>
      </div>

      {doc.description && <p className="text-gray-600">{doc.description}</p>}

      <div className="grid grid-cols-2 gap-4 border rounded p-4 text-sm">
        <div><span className="text-gray-500">Type</span><p className="font-medium">{doc.type}</p></div>
        <div><span className="text-gray-500">Status</span><p className="font-medium">{doc.status}</p></div>
        <div><span className="text-gray-500">Category</span><p className="font-medium">{doc.category?.name ?? "—"}</p></div>
        <div><span className="text-gray-500">Version</span><p className="font-medium">v{doc.version}</p></div>
        <div><span className="text-gray-500">File</span><p className="font-medium">{doc.fileName} ({(doc.fileSize / 1024).toFixed(0)} KB)</p></div>
        <div><span className="text-gray-500">Uploaded by</span><p className="font-medium">{doc.uploadedBy?.firstName || doc.uploadedBy?.email}</p></div>
        {doc.tags.length > 0 && (
          <div className="col-span-2"><span className="text-gray-500">Tags</span><div className="flex gap-1 mt-1">{doc.tags.map((t) => <span key={t} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{t}</span>)}</div></div>
        )}
      </div>

      {/* Version History */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Version History</h2>
        <div className="space-y-2">
          {doc.versions?.map((v) => (
            <div key={v.id} className="border rounded px-3 py-2 flex justify-between items-center text-sm">
              <div>
                <span className="font-medium">v{v.versionNumber}</span>
                <span className="text-gray-500 ml-2">{v.fileName}</span>
                {v.changeNote && <span className="text-gray-400 ml-2">— {v.changeNote}</span>}
              </div>
              <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleUploadVersion} className="mt-4 p-4 border rounded space-y-3">
          <h3 className="text-sm font-medium">Upload New Version</h3>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)} className="block w-full text-sm border rounded p-2" />
          <input placeholder="Change note (optional)" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm" />
          <button type="submit" disabled={!versionFile || uploading} className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50">
            {uploading ? "Uploading..." : "Upload Version"}
          </button>
        </form>
      </section>
    </div>
  );
}
