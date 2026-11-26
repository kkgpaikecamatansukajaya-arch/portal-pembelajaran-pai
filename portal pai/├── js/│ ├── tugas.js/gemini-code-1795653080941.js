// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/tugas.js
// Deskripsi: Tugas Individu/Kelompok, Pengumpulan File & Koreksi Nilai Guru
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, uploadFileToBucket, getSubmissionSignedUrl, formatTanggalID, escapeHTML } = window.PAI_APP;
  const { user, profile } = authCtx;
  const isStaff = profile.role === "admin" || profile.role === "guru";

  if (isStaff) {
    document.getElementById("btnOpenCreateAssignment").classList.remove("d-none");
    document.getElementById("teacherSubmissionsPanel").classList.remove("d-none");
    const { data: classes } = await db.from("classes").select("*").order("class_name");
    document.getElementById("asgClassId").innerHTML = (classes || []).map((c) =>
      `<option value="${c.id}">${escapeHTML(c.class_name)}</option>`
    ).join("");
  }

  await loadAssignmentsAndSubmissions();

  async function loadAssignmentsAndSubmissions() {
    const [{ data: assignments }, { data: submissions }] = await Promise.all([
      db.from("assignments").select("*, classes(class_name)").order("deadline", { ascending: true }),
      db.from("submissions").select("*, assignments(title), profiles(full_name)").order("submitted_at", { ascending: false })
    ]);

    renderAssignments(assignments || [], submissions || []);
    if (isStaff) {
      renderSubmissionsCorrection(submissions || []);
    }
  }

  function renderAssignments(assignments, submissions) {
    const container = document.getElementById("assignmentsList");
    if (!assignments.length) {
      container.innerHTML = `<div class="col-12"><div class="pai-card p-4 text-center text-muted">Belum ada tugas yang diberikan.</div></div>`;
      return;
    }

    container.innerHTML = assignments.map((a) => {
      const mySub = submissions.find((s) => s.assignment_id === a.id && s.student_id === user.id);
      return `
        <div class="col-md-6">
          <div class="pai-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-primary-subtle text-primary-emphasis">${escapeHTML(a.classes?.class_name || "Kelas")} • ${escapeHTML(a.assignment_type)}</span>
                <small class="text-danger fw-semibold">Tenggat: ${formatTanggalID(a.deadline)}</small>
              </div>
              <h5 class="fw-bold mb-2">${escapeHTML(a.title)}</h5>
              <p class="small text-muted">${escapeHTML(a.description)}</p>
            </div>

            <div class="pt-3 border-top mt-3">
              ${profile.role === "siswa" ? (
                mySub ? `
                  <div class="p-2 rounded-3 bg-success-subtle text-success-emphasis small mb-2">
                    <strong>Sudah Dikumpulkan</strong> • Nilai: <strong>${mySub.score !== null ? mySub.score : "Menunggu Koreksi"}</strong>
                    ${mySub.feedback ? `<br>Umpan balik: "${escapeHTML(mySub.feedback)}"` : ""}
                  </div>
                  ${mySub.score === null ? `<button class="btn btn-outline-primary btn-sm rounded-3 btn-open-submit" data-id="${a.id}" data-title="${escapeHTML(a.title)}">Perbarui Jawaban</button>` : ""}
                ` : `
                  <button class="btn btn-pai-primary btn-sm rounded-3 btn-open-submit" data-id="${a.id}" data-title="${escapeHTML(a.title)}">Kumpulkan Tugas</button>
                `
              ) : `
                <small class="text-muted">Total pengumpulan: <strong>${submissions.filter((s) => s.assignment_id === a.id).length}</strong> siswa</small>
              `}
            </div>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".btn-open-submit").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("subAssignmentId").value = btn.dataset.id;
        document.getElementById("submitModalTitle").textContent = `Kumpulkan: ${btn.dataset.title}`;
        new bootstrap.Modal(document.getElementById("submitAssignmentModal")).show();
      });
    });
  }

  async function renderSubmissionsCorrection(submissions) {
    const tbody = document.getElementById("submissionsCorrectionBody");
    if (!submissions.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada siswa yang mengumpulkan tugas.</td></tr>`;
      return;
    }

    const rowsHTML = await Promise.all(submissions.map(async (s) => {
      const fileLink = s.file_url ? await getSubmissionSignedUrl(s.file_url) : null;
      return `
        <tr>
          <td class="fw-semibold">${escapeHTML(s.profiles?.full_name || "-")}</td>
          <td>${escapeHTML(s.assignments?.title || "-")}</td>
          <td>
            <div class="small mb-1">${escapeHTML(s.answer_text || "-")}</div>
            ${fileLink ? `<a href="${escapeHTML(fileLink)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-info">Lihat File</a>` : ""}
          </td>
          <td style="width:110px;">
            <input type="number" min="0" max="100" step="0.5" class="form-control form-control-sm sub-score" data-id="${s.id}" value="${s.score ?? ""}" />
          </td>
          <td style="width:200px;">
            <input type="text" class="form-control form-control-sm sub-feedback" data-id="${s.id}" value="${escapeHTML(s.feedback || "")}" placeholder="Catatan guru..." />
          </td>
          <td>
            <button class="btn btn-sm btn-pai-primary btn-save-grade" data-id="${s.id}">Simpan Nilai</button>
          </td>
        </tr>
      `;
    }));

    tbody.innerHTML = rowsHTML.join("");

    document.querySelectorAll(".btn-save-grade").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const scoreVal = Number(document.querySelector(`.sub-score[data-id="${id}"]`).value);
        const feedbackVal = document.querySelector(`.sub-feedback[data-id="${id}"]`).value.trim();

        if (Number.isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          return alert("Nilai harus berada di antara 0 sampai 100.");
        }

        const { error } = await db.from("submissions").update({
          score: scoreVal,
          feedback: feedbackVal,
          graded_at: new Date().toISOString()
        }).eq("id", id);

        if (error) return alert("Gagal menyimpan nilai: " + error.message);
        alert("Nilai dan umpan balik tersimpan.");
        loadAssignmentsAndSubmissions();
      });
    });
  }

  document.getElementById("createAssignmentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await db.from("assignments").insert({
      title: document.getElementById("asgTitle").value.trim(),
      class_id: document.getElementById("asgClassId").value,
      assignment_type: document.getElementById("asgType").value,
      deadline: new Date(document.getElementById("asgDeadline").value).toISOString(),
      description: document.getElementById("asgDesc").value.trim(),
      created_by: user.id
    });

    if (error) return alert("Gagal membuat tugas: " + error.message);
    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById("createAssignmentModal")).hide();
    loadAssignmentsAndSubmissions();
  });

  document.getElementById("submitAssignmentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitAssignment");
    btn.disabled = true;
    btn.textContent = "Mengirim...";

    const assignmentId = document.getElementById("subAssignmentId").value;
    const answerText = document.getElementById("subAnswerText").value.trim();
    const file = document.getElementById("subFileInput").files[0];

    let filePath = null;
    if (file) {
      const { path, error } = await uploadFileToBucket("submissions", file, user.id);
      if (error) {
        alert("Gagal upload file jawaban: " + error.message);
        btn.disabled = false;
        btn.textContent = "Kirim Jawaban";
        return;
      }
      filePath = path;
    }

    const payload = {
      assignment_id: assignmentId,
      student_id: user.id,
      answer_text: answerText || null,
      submitted_at: new Date().toISOString()
    };
    if (filePath) payload.file_url = filePath;

    const { error } = await db.from("submissions").upsert(payload, { onConflict: "assignment_id,student_id" });
    btn.disabled = false;
    btn.textContent = "Kirim Jawaban";

    if (error) return alert("Gagal mengumpulkan tugas: " + error.message);
    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById("submitAssignmentModal")).hide();
    loadAssignmentsAndSubmissions();
  });
});