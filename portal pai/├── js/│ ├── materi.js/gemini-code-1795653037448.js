// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/materi.js
// Deskripsi: CRUD Materi PAI, Filter Kelas & Kategori, Modal Baca & Media
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, uploadFileToBucket, escapeHTML } = window.PAI_APP;
  const { user, profile } = authCtx;
  const canManage = profile.role === "admin" || profile.role === "guru";

  let classesList = [];
  let materialsData = [];

  if (canManage) {
    document.getElementById("btnAddMaterial").classList.remove("d-none");
  }

  await loadClassesSelects();
  await loadMaterials();

  document.getElementById("filterClass").addEventListener("change", renderMaterials);
  document.getElementById("filterCategory").addEventListener("change", renderMaterials);
  document.getElementById("searchMaterialInput").addEventListener("input", renderMaterials);

  async function loadClassesSelects() {
    const { data } = await db.from("classes").select("*").order("class_name");
    classesList = data || [];

    const filterClassEl = document.getElementById("filterClass");
    const formClassEl = document.getElementById("matClassId");

    filterClassEl.innerHTML = `<option value="">Semua Kelas</option>` + classesList.map((c) =>
      `<option value="${c.id}" ${profile.role === "siswa" && profile.class_id === c.id ? "selected" : ""}>${escapeHTML(c.class_name)}</option>`
    ).join("");

    if (formClassEl) {
      formClassEl.innerHTML = classesList.map((c) =>
        `<option value="${c.id}">${escapeHTML(c.class_name)}</option>`
      ).join("");
    }
  }

  async function loadMaterials() {
    const { data, error } = await db
      .from("materials")
      .select("*, classes(class_name), profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      document.getElementById("materialsGrid").innerHTML = `<div class="col-12 text-danger">Gagal memuat materi: ${escapeHTML(error.message)}</div>`;
      return;
    }

    materialsData = data || [];
    renderMaterials();
  }

  function renderMaterials() {
    const clsFilter = document.getElementById("filterClass").value;
    const catFilter = document.getElementById("filterCategory").value;
    const kw = document.getElementById("searchMaterialInput").value.trim().toLowerCase();

    const filtered = materialsData.filter((m) => {
      if (clsFilter && m.class_id !== clsFilter) return false;
      if (catFilter && m.category !== catFilter) return false;
      if (kw && !m.title.toLowerCase().includes(kw) && !(m.chapter || "").toLowerCase().includes(kw)) return false;
      return true;
    });

    const grid = document.getElementById("materialsGrid");
    if (!filtered.length) {
      grid.innerHTML = `<div class="col-12"><div class="pai-card p-4 text-center text-muted">Belum ada materi yang sesuai filter.</div></div>`;
      return;
    }

    grid.innerHTML = filtered.map((m) => `
      <div class="col-md-6 col-lg-4">
        <div class="pai-card p-4 h-100 d-flex flex-column justify-content-between">
          <div>
            ${m.thumbnail_url ? `<img src="${escapeHTML(m.thumbnail_url)}" alt="${escapeHTML(m.title)}" class="w-100 rounded-3 mb-3" style="height:150px;object-fit:cover;" />` : ""}
            <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span class="badge bg-success-subtle text-success-emphasis">${escapeHTML(m.category)}</span>
              <span class="badge bg-info-subtle text-info-emphasis">${escapeHTML(m.classes?.class_name || "Kelas")}</span>
            </div>
            <h5 class="fw-bold mb-1">${escapeHTML(m.title)}</h5>
            <small class="text-muted d-block mb-2">${escapeHTML(m.chapter || "Bab Umum")} • Semester ${escapeHTML(m.semester || "Ganjil")}</small>
            <p class="small text-muted">${escapeHTML(m.description || m.content.slice(0, 120) + "...")}</p>
          </div>

          <div class="pt-3 border-top d-flex flex-wrap gap-2">
            <button class="btn btn-pai-primary btn-sm rounded-3 btn-read-mat" data-id="${m.id}">Baca Materi</button>
            ${canManage ? `
              <button class="btn btn-outline-secondary btn-sm rounded-3 btn-edit-mat" data-id="${m.id}">Edit</button>
              <button class="btn btn-outline-danger btn-sm rounded-3 btn-del-mat" data-id="${m.id}">Hapus</button>
            ` : ""}
          </div>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".btn-read-mat").forEach((btn) => {
      btn.addEventListener("click", () => openReadModal(btn.dataset.id));
    });

    if (canManage) {
      document.querySelectorAll(".btn-edit-mat").forEach((btn) => {
        btn.addEventListener("click", () => openEditModal(btn.dataset.id));
      });
      document.querySelectorAll(".btn-del-mat").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Yakin ingin menghapus materi ini?")) return;
          const { error } = await db.from("materials").delete().eq("id", btn.dataset.id);
          if (error) return alert("Gagal menghapus: " + error.message);
          loadMaterials();
        });
      });
    }
  }

  function getEmbedVideoHTML(url) {
    if (!url) return "";
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    if (ytMatch) {
      return `<div class="ratio ratio-16x9 mb-3"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen class="rounded-3"></iframe></div>`;
    }
    return `<div class="mb-3"><a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">Tonton Video Pembelajaran</a></div>`;
  }

  function openReadModal(id) {
    const m = materialsData.find((item) => item.id === id);
    if (!m) return;

    document.getElementById("readMatCategory").textContent = `${m.category} • ${m.classes?.class_name || ""}`;
    document.getElementById("readMatTitle").textContent = m.title;

    document.getElementById("readMatBody").innerHTML = `
      ${m.thumbnail_url ? `<img src="${escapeHTML(m.thumbnail_url)}" class="w-100 rounded-3 mb-3" style="max-height:260px;object-fit:cover;" />` : ""}
      ${getEmbedVideoHTML(m.video_url)}
      ${m.description ? `<div class="p-3 rounded-3 stat-card-blue mb-3"><strong>Tujuan & Capaian Pembelajaran:</strong><p class="mb-0 small mt-1">${escapeHTML(m.description)}</p></div>` : ""}
      <div class="mb-3" style="white-space: pre-line;">${escapeHTML(m.content)}</div>
      ${m.file_url ? `<a href="${escapeHTML(m.file_url)}" target="_blank" rel="noopener" class="btn btn-pai-yellow btn-sm">Unduh File Pendukung</a>` : ""}
    `;

    new bootstrap.Modal(document.getElementById("readMaterialModal")).show();
  }

  function openEditModal(id) {
    const m = materialsData.find((item) => item.id === id);
    if (!m) return;
    document.getElementById("materialModalTitle").textContent = "Edit Materi Pembelajaran";
    document.getElementById("editMaterialId").value = m.id;
    document.getElementById("matTitle").value = m.title;
    document.getElementById("matClassId").value = m.class_id;
    document.getElementById("matCategory").value = m.category;
    document.getElementById("matSemester").value = m.semester || "Ganjil";
    document.getElementById("matChapter").value = m.chapter || "";
    document.getElementById("matDescription").value = m.description || "";
    document.getElementById("matContent").value = m.content;
    document.getElementById("matVideoUrl").value = m.video_url || "";
    new bootstrap.Modal(document.getElementById("materialFormModal")).show();
  }

  document.getElementById("btnAddMaterial").addEventListener("click", () => {
    document.getElementById("materialModalTitle").textContent = "Tambah Materi Pembelajaran";
    document.getElementById("materialForm").reset();
    document.getElementById("editMaterialId").value = "";
  });

  document.getElementById("materialForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("btnSaveMaterial");
    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";

    const editId = document.getElementById("editMaterialId").value;
    const existing = editId ? materialsData.find((x) => x.id === editId) : null;

    let thumbnailUrl = existing?.thumbnail_url || null;
    let fileUrl = existing?.file_url || null;

    const imgFile = document.getElementById("matImageFile").files[0];
    if (imgFile) {
      const { url, error } = await uploadFileToBucket("materials", imgFile, "thumbnails");
      if (error) {
        alert("Gagal upload gambar: " + error.message);
        saveBtn.disabled = false;
        saveBtn.textContent = "Simpan Materi";
        return;
      }
      thumbnailUrl = url;
    }

    const docFile = document.getElementById("matDocFile").files[0];
    if (docFile) {
      const { url, error } = await uploadFileToBucket("materials", docFile, "documents");
      if (error) {
        alert("Gagal upload file pendukung: " + error.message);
        saveBtn.disabled = false;
        saveBtn.textContent = "Simpan Materi";
        return;
      }
      fileUrl = url;
    }

    const payload = {
      title: document.getElementById("matTitle").value.trim(),
      class_id: document.getElementById("matClassId").value,
      category: document.getElementById("matCategory").value,
      semester: document.getElementById("matSemester").value,
      chapter: document.getElementById("matChapter").value.trim() || null,
      description: document.getElementById("matDescription").value.trim() || null,
      content: document.getElementById("matContent").value.trim(),
      video_url: document.getElementById("matVideoUrl").value.trim() || null,
      thumbnail_url: thumbnailUrl,
      file_url: fileUrl,
      created_by: existing?.created_by || user.id
    };

    const res = editId
      ? await db.from("materials").update(payload).eq("id", editId)
      : await db.from("materials").insert(payload);

    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan Materi";

    if (res.error) {
      alert("Gagal menyimpan materi: " + res.error.message);
      return;
    }

    bootstrap.Modal.getInstance(document.getElementById("materialFormModal")).hide();
    loadMaterials();
  });
});