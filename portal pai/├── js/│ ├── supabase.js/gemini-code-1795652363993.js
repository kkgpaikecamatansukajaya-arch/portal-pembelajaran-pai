// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/supabase.js
// Deskripsi: Inisialisasi Supabase Client, Helper Storage, dan Format Utility
// ============================================================================

(function () {
  // Baca konfigurasi dari window.__ENV__, meta tag, atau fallback nilai proyek Anda
  const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content;
  const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;

  const SUPABASE_URL =
    window.__ENV__?.SUPABASE_URL ||
    metaUrl ||
    "https://YOUR-PROJECT-REF.supabase.co";

  const SUPABASE_ANON_KEY =
    window.__ENV__?.SUPABASE_ANON_KEY ||
    metaKey ||
    "YOUR-SUPABASE-ANON-KEY";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase SDK belum termuat. Pastikan script @supabase/supabase-js dimuat sebelum /js/supabase.js");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });

  /**
   * Unggah file ke bucket Supabase Storage dan kembalikan URL/path-nya.
   * @param {string} bucket - 'materials' | 'assignments' | 'submissions' | 'avatars' | 'galleries'
   * @param {File} file
   * @param {string} folderPrefix - opsional, misal user.id
   */
  async function uploadFileToBucket(bucket, file, folderPrefix = "") {
    if (!file) return { url: null, path: null, error: null };

    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSizeBytes) {
      return { url: null, path: null, error: new Error("Ukuran file maksimal 25 MB.") };
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${folderPrefix ? folderPrefix + "/" : ""}${Date.now()}_${cleanName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      return { url: null, path: null, error: uploadError };
    }

    if (bucket === "submissions") {
      // Bucket submissions bersifat privat; gunakan signed URL saat diakses
      const { data: signedData, error: signedError } = await supabaseClient.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60 * 24);
      if (signedError) return { url: null, path: filePath, error: signedError };
      return { url: signedData.signedUrl, path: filePath, error: null };
    }

    const { data: publicData } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);
    return { url: publicData.publicUrl, path: filePath, error: null };
  }

  /**
   * Buat signed URL sementara untuk file privat di bucket 'submissions'.
   */
  async function getSubmissionSignedUrl(filePathOrUrl) {
    if (!filePathOrUrl) return null;
    if (filePathOrUrl.startsWith("http")) return filePathOrUrl;
    const { data, error } = await supabaseClient.storage
      .from("submissions")
      .createSignedUrl(filePathOrUrl, 3600);
    return error ? null : data.signedUrl;
  }

  function formatTanggalID(isoString) {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHTML(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.PAI_APP = {
    db: supabaseClient,
    uploadFileToBucket,
    getSubmissionSignedUrl,
    formatTanggalID,
    escapeHTML
  };
})();