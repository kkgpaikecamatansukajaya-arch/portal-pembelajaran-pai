// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/dashboard.js
// Deskripsi: Logika Dashboard Multi-Role, Realtime, Chart.js & Ekspor Excel/PDF
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, uploadFileToBucket, formatTanggalID, escapeHTML } = window.PAI_APP;
  const { user, profile } = authCtx;

  let progressChartInstance = null;
  let classChartInstance = null;
  let allClasses = [];
  let latestQuizResults = [];

  buildSidebarNavigation(profile.role);
  setupRoleUI(profile);

  await loadClasses();
  await refreshAllDashboardData();
  subscribeRealtimeUpdates();

  function buildSidebarNavigation(role) {
    const menus = [
      { label: "Dashboard", href: "/dashboard.html", icon: "layout-dashboard", active: true },
      { label: "Materi PAI", href: "/materi.html", icon: "book-open" },
      { label: "Tugas Siswa", href: "/tugas.html", icon: "clipboard-list" },
      { label: "Kuis Interaktif", href: "/kuis.html", icon: "file-question" },
      { label: "Game Edukasi PAI", href: "/game.html", icon: "gamepad-2" },
      { label: "Rekap Nilai", href: "/nilai.html", icon: "award" },
      { label: "Profil Saya", href: "/profil.html", icon: "user" }
    ];

    const html = menus.map((m) => `
      <a href="${m.href}" class="nav-link-pai ${m.active ? "active" : ""}">
        <i data-lucide="${m.icon}" style="width:18px;height:18px;"></i>
        <span>${escapeHTML(m.label)}</span>
      </a>
    `).join("");

    document.getElementById("desktopSidebarNav").innerHTML = html;
    document.getElementById("mobileSidebarNav").innerHTML = html;
    lucide.createIcons();
  }

  function setupRoleUI(prof) {
    const roleLabel = prof.role === "admin" ? "Administrator" : prof.role === "guru" ? "Guru PAI" : "Siswa";
    document.getElementById("welcomeTitle").textContent = `Assalamu'alaikum, ${prof.full_name}!`;
    document.getElementById("welcomeSubtitle").textContent = `Masuk sebagai ${roleLabel} • SDN Kiarapandak 01`;

    if (prof.role === "admin" || prof.role === "guru") {
      document.getElementById("btnOpenAnnouncementModal").classList.remove("d-none");
      document.getElementById("teacherEvaluationSection").classList.remove("d-none");
    }

    if (prof.role === "admin") {
      document.getElementById("adminManagementSection").classList.remove("d-none");
    }
  }

  async function loadClasses() {
    const { data } = await db.from("classes").select("*").order("class_name", { ascending: true });
    allClasses = data || [];
    document.getElementById("statClassesCount").textContent = allClasses.length || 6;

    const classSelect = document.getElementById("announcementClassSelect");
    if (classSelect) {
      classSelect.innerHTML = `<option value="">Semua Kelas (1–6)</option>` + allClasses.map((c) =>
        `<option value="${c.id}">${escapeHTML(c.class_name)} (${escapeHTML(c.academic_year)})</option>`
      ).join("");
    }
  }

  async function refreshAllDashboardData() {
    const [
      profilesRes,
      materialsRes,
      assignmentsRes,
      quizzesRes,
      submissionsRes,
      quizResultsRes,
      announcementsRes
    ] = await Promise.all([
      db.from("profiles").select("id, full_name, username, role, class_id, total_points, classes(class_name)"),
      db.from("materials").select("id", { count: "exact", head: true }),
      db.from("assignments").select("id", { count: "exact", head: true }),
      db.from("quizzes").select("id", { count: "exact", head: true }),
      db.from("submissions").select("id", { count: "exact", head: true }),
      db.from("quiz_results").select("id, quiz_id, student_id, score, total_correct, total_wrong, needs_manual_grading, completed_at, quizzes(title, class_id), profiles(full_name, classes(class_name))").order("completed_at", { ascending: false }),
      db.from("announcements").select("id, title, content, target_class_id, created_at, profiles(full_name), classes(class_name)").order("created_at", { ascending: false }).limit(8)
    ]);

    const profilesList = profilesRes.data || [];
    const students = profilesList.filter((p) => p.role === "siswa");
    const teachers = profilesList.filter((p) => p.role === "guru");
    latestQuizResults = quizResultsRes.data || [];

    const avgScore = latestQuizResults.length > 0
      ? (latestQuizResults.reduce((acc, r) => acc + Number(r.score || 0), 0) / latestQuizResults.length).toFixed(1)
      : "0.0";

    const myProfile = profilesList.find((p) => p.id === user.id);

    document.getElementById("statStudents").textContent = students.length;
    document.getElementById("statTeachers").textContent = teachers.length;
    document.getElementById("statMaterials").textContent = materialsRes.count || 0;
    document.getElementById("statTasksQuizzes").textContent = (assignmentsRes.count || 0) + (quizzesRes.count || 0);
    document.getElementById("statAvgScore").textContent = avgScore;
    document.getElementById("statSubmissions").textContent = submissionsRes.count || 0;
    document.getElementById("statMyPoints").textContent = `${myProfile?.total_points ?? profile.total_points ?? 0} Poin`;

    renderLeaderboard(students);
    renderAnnouncements(announcementsRes.data || []);
    renderCharts(latestQuizResults);

    if (profile.role === "admin" || profile.role === "guru") {
      renderEvaluationTable(latestQuizResults);
    }

    if (profile.role === "admin") {
      renderAdminPanel(profilesList);
    }
  }

  function renderLeaderboard(students) {
    const sorted = [...students].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).slice(0, 10);
    const tbody = document.getElementById("leaderboardBody");

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada data poin siswa.</td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map((s, idx) => `
      <tr>
        <td class="fw-bold">${idx + 1}</td>
        <td class="fw-semibold">${escapeHTML(s.full_name)}</td>
        <td><span class="badge bg-info-subtle text-info-emphasis">${escapeHTML(s.classes?.class_name || "-")}</span></td>
        <td class="text-end fw-bold text-success">${s.total_points || 0} pts</td>
      </tr>
    `).join("");
  }

  function renderAnnouncements(list) {
    const container = document.getElementById("announcementsList");
    if (!list || list.length === 0) {
      container.innerHTML = `<div class="text-muted small">Belum ada pengumuman terbaru.</div>`;
      return;
    }

    container.innerHTML = list.map((a) => `
      <div class="p-3 rounded-3 bg-light border">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <h6 class="fw-bold mb-1">${escapeHTML(a.title)}</h6>
          <span class="badge bg-success-subtle text-success-emphasis">${escapeHTML(a.classes?.class_name || "Semua Kelas")}</span>
        </div>
        <p class="small text-muted mb-2">${escapeHTML(a.content)}</p>
        <small class="text-secondary" style="font-size:0.75rem;">
          Oleh ${escapeHTML(a.profiles?.full_name || "Guru PAI")} • ${formatTanggalID(a.created_at)}
        </small>
      </div>
    `).join("");
  }

  function renderCharts(results) {
    // 1. Grafik perkembangan nilai kuis terbaru
    const recent = [...results].slice(0, 8).reverse();
    const labels = recent.map((r, i) => r.profiles?.full_name ? `${r.profiles.full_name.split(" ")[0]} #${i + 1}` : `Sesi ${i + 1}`);
    const scores = recent.map((r) => Number(r.score || 0));

    const ctx1 = document.getElementById("scoreProgressChart").getContext("2d");
    if (progressChartInstance) progressChartInstance.destroy();
    progressChartInstance = new Chart(ctx1, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["Belum Ada Data"],
        datasets: [{
          label: "Nilai Kuis",
          data: scores.length ? scores : [0],
          borderColor: "#0d9488",
          backgroundColor: "rgba(13, 148, 136, 0.15)",
          tension: 0.35,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100 } }
      }
    });

    // 2. Grafik rata-rata nilai per kelas
    const classMap = {};
    allClasses.forEach((c) => { classMap[c.id] = { name: c.class_name, sum: 0, count: 0 }; });
    results.forEach((r) => {
      const cid = r.quizzes?.class_id;
      if (cid && classMap[cid]) {
        classMap[cid].sum += Number(r.score || 0);
        classMap[cid].count += 1;
      }
    });

    const classLabels = Object.values(classMap).map((c) => c.name);
    const classAvgs = Object.values(classMap).map((c) => (c.count > 0 ? Number((c.sum / c.count).toFixed(1)) : 0));

    const ctx2 = document.getElementById("classAverageChart").getContext("2d");
    if (classChartInstance) classChartInstance.destroy();
    classChartInstance = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: classLabels.length ? classLabels : ["Kelas 1–6"],
        datasets: [{
          label: "Rata-Rata Nilai",
          data: classAvgs.length ? classAvgs : [0],
          backgroundColor: ["#0d9488", "#0284c7", "#eab308", "#10b981", "#3b82f6", "#f59e0b"],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100 } }
      }
    });
  }

  function renderEvaluationTable(results) {
    const tbody = document.getElementById("evaluationTableBody");
    if (!results.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada siswa yang mengerjakan kuis.</td></tr>`;
      return;
    }

    tbody.innerHTML = results.map((r) => `
      <tr>
        <td class="fw-semibold">${escapeHTML(r.profiles?.full_name || "-")}</td>
        <td>${escapeHTML(r.profiles?.classes?.class_name || "-")}</td>
        <td>${escapeHTML(r.quizzes?.title || "-")}</td>
        <td>${r.total_correct} Benar / ${r.total_wrong} Salah</td>
        <td><span class="badge bg-primary-subtle text-primary-emphasis fs-6">${Number(r.score).toFixed(1)}</span></td>
        <td>${r.needs_manual_grading ? '<span class="badge bg-warning text-dark">Perlu Koreksi Uraian</span>' : '<span class="badge bg-success-subtle text-success-emphasis">Selesai</span>'}</td>
      </tr>
    `).join("");
  }

  // Panel Admin
  async function renderAdminPanel(profilesList) {
    const usersBody = document.getElementById("adminUsersBody");
    usersBody.innerHTML = profilesList.map((p) => `
      <tr>
        <td>${escapeHTML(p.full_name)}</td>
        <td>${escapeHTML(p.username)}</td>
        <td>
          <select class="form-select form-select-sm role-select" data-user-id="${p.id}">
            <option value="siswa" ${p.role === "siswa" ? "selected" : ""}>siswa</option>
            <option value="guru" ${p.role === "guru" ? "selected" : ""}>guru</option>
            <option value="admin" ${p.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>
          <select class="form-select form-select-sm class-select" data-user-id="${p.id}">
            <option value="">-- Tanpa Kelas --</option>
            ${allClasses.map((c) => `<option value="${c.id}" ${p.class_id === c.id ? "selected" : ""}>${escapeHTML(c.class_name)}</option>`).join("")}
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-pai-primary btn-save-user" data-user-id="${p.id}">Simpan</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-save-user").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const uid = btn.dataset.userId;
        const newRole = document.querySelector(`.role-select[data-user-id="${uid}"]`).value;
        const newClass = document.querySelector(`.class-select[data-user-id="${uid}"]`).value || null;
        const { error } = await db.from("profiles").update({ role: newRole, class_id: newClass }).eq("id", uid);
        alert(error ? "Gagal update: " + error.message : "Data pengguna berhasil diperbarui.");
        refreshAllDashboardData();
      });
    });

    // Kelas
    document.getElementById("adminClassesList").innerHTML = allClasses.map((c) => `
      <span class="badge bg-light text-dark border px-3 py-2">${escapeHTML(c.class_name)} • ${escapeHTML(c.academic_year)}</span>
    `).join("");

    // Mapel
    const { data: subjects } = await db.from("subjects").select("*").order("subject_name");
    document.getElementById("adminSubjectsList").innerHTML = (subjects || []).map((s) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div><strong>${escapeHTML(s.subject_name)}</strong><br><small class="text-muted">${escapeHTML(s.description || "")}</small></div>
      </li>
    `).join("");

    // Galeri
    const { data: galleries } = await db.from("galleries").select("*").order("created_at", { ascending: false });
    document.getElementById("adminGalleryList").innerHTML = (galleries || []).map((g) => `
      <div class="col-md-4">
        <div class="border rounded-3 p-2 h-100">
          <img src="${escapeHTML(g.image_url)}" class="w-100 rounded-2 mb-2" style="height:120px;object-fit:cover;" />
          <div class="fw-bold small">${escapeHTML(g.title)}</div>
          <button class="btn btn-sm btn-outline-danger mt-2 btn-del-gallery" data-id="${g.id}">Hapus</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".btn-del-gallery").forEach((b) => {
      b.addEventListener("click", async () => {
        await db.from("galleries").delete().eq("id", b.dataset.id);
        refreshAllDashboardData();
      });
    });
  }

  // Form Pengumuman
  document.getElementById("announcementForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("announcementTitle").value.trim();
    const content = document.getElementById("announcementContent").value.trim();
    const targetClassId = document.getElementById("announcementClassSelect").value || null;

    const { error } = await db.from("announcements").insert({
      title,
      content,
      target_class_id: targetClassId,
      created_by: user.id
    });

    if (error) {
      alert("Gagal mengirim pengumuman: " + error.message);
      return;
    }

    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById("announcementModal")).hide();
    refreshAllDashboardData();
  });

  // Form Tambah Kelas
  document.getElementById("addClassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const className = document.getElementById("newClassName").value.trim();
    const academicYear = document.getElementById("newAcademicYear").value.trim();
    const { error } = await db.from("classes").insert({ class_name: className, academic_year: academicYear });
    if (error) return alert("Gagal menambah kelas: " + error.message);
    e.target.reset();
    await loadClasses();
    refreshAllDashboardData();
  });

  // Form Tambah Mapel
  document.getElementById("addSubjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const subjectName = document.getElementById("newSubjectName").value.trim();
    const description = document.getElementById("newSubjectDesc").value.trim();
    const { error } = await db.from("subjects").insert({ subject_name: subjectName, description });
    if (error) return alert("Gagal menambah mapel: " + error.message);
    e.target.reset();
    refreshAllDashboardData();
  });

  // Form Tambah Galeri
  document.getElementById("addGalleryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("galleryTitle").value.trim();
    const mediaType = document.getElementById("galleryMediaType").value;
    const description = document.getElementById("galleryDesc").value.trim();
    const file = document.getElementById("galleryFile").files[0];

    if (!file) return alert("Pilih file gambar atau video terlebih dahulu.");
    const { url, error: upErr } = await uploadFileToBucket("galleries", file, "aktivitas");
    if (upErr) return alert("Gagal upload media galeri: " + upErr.message);

    const { error: insErr } = await db.from("galleries").insert({
      title,
      media_type: mediaType,
      image_url: url,
      description
    });
    if (insErr) return alert("Gagal menyimpan galeri: " + insErr.message);
    e.target.reset();
    refreshAllDashboardData();
  });

  // Ekspor Excel (.xlsx)
  document.getElementById("btnExportExcel").addEventListener("click", () => {
    const rows = latestQuizResults.map((r, idx) => ({
      No: idx + 1,
      Nama_Siswa: r.profiles?.full_name || "-",
      Kelas: r.profiles?.classes?.class_name || "-",
      Judul_Kuis: r.quizzes?.title || "-",
      Benar: r.total_correct,
      Salah: r.total_wrong,
      Nilai: Number(r.score || 0),
      Tanggal: formatTanggalID(r.completed_at)
    }));

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Keterangan: "Belum ada data nilai kuis" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai PAI");
    XLSX.writeFile(wb, "Rekap_Nilai_PAI_SDN_Kiarapandak_01.xlsx");
  });

  // Ekspor PDF
  document.getElementById("btnExportPdf").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("REKAP NILAI PAI - SDN KIARAPANDAK 01", 14, 16);
    doc.setFontSize(10);
    doc.text("Belajar PAI Menyenangkan, Berakhlak Mulia, Berprestasi.", 14, 22);

    const bodyRows = latestQuizResults.map((r, i) => [
      i + 1,
      r.profiles?.full_name || "-",
      r.profiles?.classes?.class_name || "-",
      r.quizzes?.title || "-",
      `${r.total_correct} / ${r.total_wrong}`,
      Number(r.score || 0).toFixed(1)
    ]);

    doc.autoTable({
      startY: 28,
      head: [["No", "Nama Siswa", "Kelas", "Kuis", "B / S", "Nilai"]],
      body: bodyRows.length ? bodyRows : [["-", "Belum ada data", "-", "-", "-", "-"]]
    });

    doc.save("Rekap_Nilai_PAI_SDN_Kiarapandak_01.pdf");
  });

  // Supabase Realtime Subscription
  function subscribeRealtimeUpdates() {
    db.channel("portal-pai-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => refreshAllDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "student_points" }, () => refreshAllDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results" }, () => refreshAllDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => refreshAllDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refreshAllDashboardData())
      .subscribe();
  }
});