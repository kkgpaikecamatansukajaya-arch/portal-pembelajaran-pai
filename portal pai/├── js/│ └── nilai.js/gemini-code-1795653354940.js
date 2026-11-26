// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/nilai.js
// Deskripsi: Rekap Nilai Kuis, Nilai Tugas & Riwayat Poin Prestasi
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, formatTanggalID, escapeHTML } = window.PAI_APP;

  const [quizRes, subRes, ptsRes] = await Promise.all([
    db.from("quiz_results").select("score, completed_at, quizzes(title), profiles(full_name)").order("completed_at", { ascending: false }),
    db.from("submissions").select("score, feedback, submitted_at, assignments(title), profiles(full_name)").order("submitted_at", { ascending: false }),
    db.from("student_points").select("points, activity_type, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(30)
  ]);

  document.getElementById("nilaiKuisBody").innerHTML = (quizRes.data || []).length
    ? quizRes.data.map((r) => `
      <tr>
        <td>${escapeHTML(r.profiles?.full_name || "-")}</td>
        <td>${escapeHTML(r.quizzes?.title || "-")}</td>
        <td><span class="badge bg-primary-subtle text-primary-emphasis">${Number(r.score || 0).toFixed(1)}</span></td>
        <td>${formatTanggalID(r.completed_at)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="text-center text-muted">Belum ada data nilai kuis.</td></tr>`;

  document.getElementById("nilaiTugasBody").innerHTML = (subRes.data || []).length
    ? subRes.data.map((s) => `
      <tr>
        <td>${escapeHTML(s.profiles?.full_name || "-")}</td>
        <td>${escapeHTML(s.assignments?.title || "-")}</td>
        <td>${s.score !== null ? `<span class="badge bg-success-subtle text-success-emphasis">${s.score}</span>` : `<span class="badge bg-warning text-dark">Menunggu</span>`}</td>
        <td>${escapeHTML(s.feedback || "-")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="text-center text-muted">Belum ada data nilai tugas.</td></tr>`;

  document.getElementById("riwayatPoinBody").innerHTML = (ptsRes.data || []).length
    ? ptsRes.data.map((p) => `
      <tr>
        <td>${escapeHTML(p.profiles?.full_name || "-")}</td>
        <td>${escapeHTML(p.activity_type)}</td>
        <td class="fw-bold ${p.points >= 0 ? "text-success" : "text-danger"}">${p.points >= 0 ? "+" : ""}${p.points}</td>
        <td>${formatTanggalID(p.created_at)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat poin.</td></tr>`;
});