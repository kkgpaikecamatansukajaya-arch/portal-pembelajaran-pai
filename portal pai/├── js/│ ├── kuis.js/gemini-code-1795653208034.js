// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/kuis.js
// Deskripsi: Pembuatan Kuis/Soal (Guru/Admin) & Pengerjaan Aman via RPC (Siswa)
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, escapeHTML } = window.PAI_APP;
  const { user, profile } = authCtx;
  const isStaff = profile.role === "admin" || profile.role === "guru";

  let timerInterval = null;
  let currentRunningQuiz = null;
  let currentQuestions = [];

  if (isStaff) {
    document.getElementById("btnOpenCreateQuiz").classList.remove("d-none");
    const { data: classes } = await db.from("classes").select("*").order("class_name");
    document.getElementById("quizClassSelect").innerHTML = (classes || []).map((c) =>
      `<option value="${c.id}">${escapeHTML(c.class_name)}</option>`
    ).join("");
    addQuestionBuilderRow();
  }

  await loadQuizzes();

  async function loadQuizzes() {
    const [{ data: quizzes }, { data: myResults }] = await Promise.all([
      db.from("quizzes").select("*, classes(class_name)").order("created_at", { ascending: false }),
      db.from("quiz_results").select("*").eq("student_id", user.id)
    ]);

    const doneMap = {};
    (myResults || []).forEach((r) => { doneMap[r.quiz_id] = r; });

    const grid = document.getElementById("quizzesGrid");
    if (!quizzes || quizzes.length === 0) {
      grid.innerHTML = `<div class="col-12"><div class="pai-card p-4 text-center text-muted">Belum ada kuis tersedia.</div></div>`;
      return;
    }

    grid.innerHTML = quizzes.map((q) => {
      const done = doneMap[q.id];
      return `
        <div class="col-md-6 col-lg-4">
          <div class="pai-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-info-subtle text-info-emphasis">${escapeHTML(q.classes?.class_name || "Kelas")}</span>
                <span class="badge bg-warning-subtle text-dark">${q.duration} Menit</span>
              </div>
              <h5 class="fw-bold mb-1">${escapeHTML(q.title)}</h5>
              <p class="small text-muted">${escapeHTML(q.description || "Kerjakan dengan teliti dan jujur.")}</p>
            </div>
            <div class="pt-3 border-top mt-3">
              ${profile.role === "siswa" ? (
                done ? `
                  <div class="alert alert-success py-2 px-3 small mb-0">
                    Selesai • Nilai Anda: <strong>${Number(done.score).toFixed(1)}</strong> (${done.total_correct} Benar)
                  </div>
                ` : `
                  <button class="btn btn-pai-primary btn-sm rounded-3 btn-start-quiz" data-id="${q.id}">Mulai Kerjakan Kuis</button>
                `
              ) : `
                <button class="btn btn-outline-danger btn-sm rounded-3 btn-del-quiz" data-id="${q.id}">Hapus Kuis</button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".btn-start-quiz").forEach((btn) => {
      btn.addEventListener("click", () => startQuiz(btn.dataset.id, quizzes));
    });

    document.querySelectorAll(".btn-del-quiz").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Hapus kuis beserta seluruh soalnya?")) return;
        await db.from("quizzes").delete().eq("id", btn.dataset.id);
        loadQuizzes();
      });
    });
  }

  async function startQuiz(quizId, quizzesList) {
    const quiz = quizzesList.find((item) => item.id === quizId);
    if (!quiz) return;

    // Ambil soal dari student_questions_view (tanpa kolom kunci jawaban)
    const { data: questions, error } = await db
      .from("student_questions_view")
      .select("*")
      .eq("quiz_id", quizId);

    if (error || !questions || questions.length === 0) {
      return alert("Soal untuk kuis ini belum tersedia atau gagal dimuat.");
    }

    currentRunningQuiz = quiz;
    currentQuestions = questions;
    document.getElementById("quizResultBox").classList.add("d-none");
    document.getElementById("activeQuizRunner").classList.remove("d-none");
    document.getElementById("runnerQuizTitle").textContent = quiz.title;
    document.getElementById("runnerQuizDesc").textContent = quiz.description || "";

    const qContainer = document.getElementById("questionsContainer");
    qContainer.innerHTML = questions.map((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      let inputHTML = "";

      if (q.question_type === "pilihan_ganda") {
        inputHTML = opts.map((opt, oIdx) => `
          <div class="form-check mt-2">
            <input class="form-check-input" type="radio" name="q_${q.id}" id="q_${q.id}_${oIdx}" value="${escapeHTML(opt)}" />
            <label class="form-check-label" for="q_${q.id}_${oIdx}">${escapeHTML(opt)}</label>
          </div>
        `).join("");
      } else if (q.question_type === "isian") {
        inputHTML = `<input type="text" class="form-control mt-2" name="q_${q.id}" placeholder="Tulis jawaban singkat..." />`;
      } else {
        inputHTML = `<textarea class="form-control mt-2" rows="3" name="q_${q.id}" placeholder="Tulis jawaban uraian Anda..."></textarea>`;
      }

      return `
        <div class="p-3 rounded-3 border bg-light">
          <div class="d-flex justify-content-between">
            <span class="fw-bold">Soal ${idx + 1} (${q.points} Poin)</span>
            <span class="badge bg-secondary-subtle text-dark">${escapeHTML(q.question_type.replace("_", " "))}</span>
          </div>
          <p class="mt-2 mb-1 fw-semibold">${escapeHTML(q.question_text)}</p>
          ${inputHTML}
        </div>
      `;
    }).join("");

    // Mulai hitung mundur waktu kuis
    clearInterval(timerInterval);
    let remainingSeconds = Number(quiz.duration || 20) * 60;
    updateTimerText(remainingSeconds);

    timerInterval = setInterval(() => {
      remainingSeconds -= 1;
      updateTimerText(remainingSeconds);
      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        alert("Waktu pengerjaan kuis telah habis! Jawaban akan dikirim otomatis.");
        submitCurrentQuiz();
      }
    }, 1000);
  }

  function updateTimerText(sec) {
    const m = String(Math.floor(Math.max(0, sec) / 60)).padStart(2, "0");
    const s = String(Math.max(0, sec) % 60).padStart(2, "0");
    document.getElementById("quizTimerDisplay").textContent = `${m}:${s}`;
  }

  document.getElementById("btnCancelQuiz").addEventListener("click", () => {
    clearInterval(timerInterval);
    document.getElementById("activeQuizRunner").classList.add("d-none");
  });

  document.getElementById("quizQuestionsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitCurrentQuiz();
  });

  async function submitCurrentQuiz() {
    if (!currentRunningQuiz) return;
    clearInterval(timerInterval);

    const submitBtn = document.getElementById("btnSubmitQuiz");
    submitBtn.disabled = true;
    submitBtn.textContent = "Menilai jawaban...";

    const answersPayload = {};
    currentQuestions.forEach((q) => {
      if (q.question_type === "pilihan_ganda") {
        const checked = document.querySelector(`input[name="q_${q.id}"]:checked`);
        answersPayload[q.id] = checked ? checked.value : "";
      } else {
        const field = document.querySelector(`[name="q_${q.id}"]`);
        answersPayload[q.id] = field ? field.value.trim() : "";
      }
    });

    const { data, error } = await db.rpc("submit_quiz_attempt", {
      p_quiz_id: currentRunningQuiz.id,
      p_answers: answersPayload
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Kumpulkan Jawaban Kuis";

    if (error) {
      return alert("Gagal mengirim kuis: " + error.message);
    }

    document.getElementById("activeQuizRunner").classList.add("d-none");
    const resBox = document.getElementById("quizResultBox");
    resBox.classList.remove("d-none");

    const reviewItems = Array.isArray(data?.review) ? data.review : [];
    resBox.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 class="fw-bold mb-1">Hasil Kuis: ${escapeHTML(currentRunningQuiz.title)}</h4>
          <p class="text-muted mb-0">Benar: <strong>${data.total_correct}</strong> • Salah: <strong>${data.total_wrong}</strong></p>
        </div>
        <div class="badge bg-success fs-4 px-4 py-2 rounded-pill">Nilai: ${Number(data.score).toFixed(1)}</div>
      </div>
      ${data.needs_manual_grading ? `<div class="alert alert-warning small">Terdapat soal uraian yang akan dikoreksi langsung oleh Guru PAI.</div>` : ""}
      <h6 class="fw-bold mt-3 mb-2">Pembahasan Jawaban:</h6>
      <div class="d-flex flex-column gap-2">
        ${reviewItems.map((item, idx) => `
          <div class="p-3 rounded-3 border ${item.is_correct ? "border-success bg-success-subtle" : "border-light bg-light"}">
            <div class="fw-semibold">${idx + 1}. ${escapeHTML(item.question_text)}</div>
            <div class="small mt-1">Jawaban Anda: <strong>${escapeHTML(item.student_answer || "-")}</strong></div>
            <div class="small text-success">Kunci / Acuan: <strong>${escapeHTML(item.correct_answer)}</strong></div>
            <div class="small text-muted mt-1">Pembahasan: ${escapeHTML(item.explanation || "")}</div>
          </div>
        `).join("")}
      </div>
    `;

    loadQuizzes();
  }

  // Builder Soal untuk Guru & Admin
  function addQuestionBuilderRow() {
    const list = document.getElementById("questionBuilderList");
    const idx = list.children.length + 1;
    const div = document.createElement("div");
    div.className = "p-3 rounded-3 border bg-light question-row";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong class="small">Butir Soal #${idx}</strong>
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-q">Hapus</button>
      </div>
      <div class="row g-2">
        <div class="col-md-6">
          <select class="form-select form-select-sm q-type">
            <option value="pilihan_ganda">Pilihan Ganda</option>
            <option value="isian">Isian Singkat</option>
            <option value="uraian">Uraian</option>
          </select>
        </div>
        <div class="col-md-6">
          <input type="number" class="form-control form-control-sm q-points" value="10" min="1" placeholder="Bobot Poin" required />
        </div>
        <div class="col-12">
          <input type="text" class="form-control form-control-sm q-text" placeholder="Tulis pertanyaan..." required />
        </div>
        <div class="col-12">
          <input type="text" class="form-control form-control-sm q-options" placeholder="Opsi PG pisahkan koma (contoh: A. Salat, B. Zakat, C. Puasa, D. Haji)" />
        </div>
        <div class="col-md-6">
          <input type="text" class="form-control form-control-sm q-answer" placeholder="Kunci jawaban..." required />
        </div>
        <div class="col-md-6">
          <input type="text" class="form-control form-control-sm q-explanation" placeholder="Pembahasan singkat..." />
        </div>
      </div>
    `;
    div.querySelector(".btn-remove-q").addEventListener("click", () => div.remove());
    list.appendChild(div);
  }

  document.getElementById("btnAddQuestionRow")?.addEventListener("click", addQuestionBuilderRow);

  document.getElementById("createQuizForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll(".question-row");
    if (!rows.length) return alert("Minimal tambahkan 1 soal.");

    const { data: createdQuiz, error: qErr } = await db
      .from("quizzes")
      .insert({
        title: document.getElementById("quizTitleInput").value.trim(),
        class_id: document.getElementById("quizClassSelect").value,
        duration: Number(document.getElementById("quizDurationInput").value || 20),
        description: document.getElementById("quizDescInput").value.trim() || null,
        created_by: user.id
      })
      .select()
      .single();

    if (qErr) return alert("Gagal membuat kuis: " + qErr.message);

    const questionsPayload = Array.from(rows).map((row) => {
      const qType = row.querySelector(".q-type").value;
      const rawOpts = row.querySelector(".q-options").value.trim();
      const optionsArr = qType === "pilihan_ganda" && rawOpts
        ? rawOpts.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      return {
        quiz_id: createdQuiz.id,
        question_text: row.querySelector(".q-text").value.trim(),
        question_type: qType,
        options: optionsArr,
        correct_answer: row.querySelector(".q-answer").value.trim(),
        explanation: row.querySelector(".q-explanation").value.trim() || null,
        points: Number(row.querySelector(".q-points").value || 10)
      };
    });

    const { error: itemsErr } = await db.from("questions").insert(questionsPayload);
    if (itemsErr) return alert("Kuis dibuat, namun gagal menyimpan soal: " + itemsErr.message);

    e.target.reset();
    document.getElementById("questionBuilderList").innerHTML = "";
    addQuestionBuilderRow();
    bootstrap.Modal.getInstance(document.getElementById("createQuizModal")).hide();
    loadQuizzes();
  });
});