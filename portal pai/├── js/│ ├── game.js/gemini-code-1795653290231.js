// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/game.js
// Deskripsi: 10 Game Edukasi PAI, Skor Real-Time, Pembahasan & RPC Supabase
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  const authCtx = await window.PAI_AUTH.requireAuth(["admin", "guru", "siswa"]);
  if (!authCtx) return;

  const { db, escapeHTML } = window.PAI_APP;
  const { user, profile } = authCtx;

  // Bank soal 10 Game Edukasi PAI
  const GAMES_CATALOG = [
    {
      id: "cepat_tepat",
      title: "1. Kuis Cepat Tepat",
      desc: "Jawab cepat pertanyaan dasar PAI & Budi Pekerti.",
      badgeColor: "stat-card-green",
      questions: [
        { prompt: "Kitab suci umat Islam yang diturunkan kepada Nabi Muhammad SAW adalah...", options: ["Al-Qur'an", "Taurat", "Zabur", "Injil"], answer: "Al-Qur'an", explanation: "Al-Qur'an adalah wahyu Allah SWT kepada Nabi Muhammad SAW sebagai pedoman hidup." },
        { prompt: "Salat wajib yang dikerjakan pada waktu subuh berjumlah...", options: ["2 rakaat", "3 rakaat", "4 rakaat", "1 rakaat"], answer: "2 rakaat", explanation: "Salat Subuh terdiri dari 2 rakaat." }
      ]
    },
    {
      id: "tebak_gambar",
      title: "2. Tebak Gambar Islami",
      desc: "Kenali simbol, tempat ibadah, dan ilustrasi kegiatan islami.",
      badgeColor: "stat-card-blue",
      questions: [
        { prompt: "🕌 Ilustrasi bangunan berkubah dan bermenara ini adalah tempat ibadah umat Islam yang disebut...", options: ["Masjid", "Gereja", "Pura", "Vihara"], answer: "Masjid", explanation: "Masjid adalah tempat sujud dan ibadah umat Islam." },
        { prompt: "🕋 Bangunan berbentuk kubus di tengah Masjidil Haram Kota Makkah adalah...", options: ["Ka'bah", "Menara", "Hajar Aswad", "Safar"], answer: "Ka'bah", explanation: "Ka'bah menjadi arah kiblat umat Islam di seluruh dunia saat salat." }
      ]
    },
    {
      id: "susun_hijaiyah",
      title: "3. Susun Huruf Hijaiyah",
      desc: "Urutkan dan kenali huruf hijaiyah dengan tepat.",
      badgeColor: "stat-card-yellow",
      questions: [
        { prompt: "Urutan huruf hijaiyah setelah huruf BA (ب) adalah...", options: ["TA (ت)", "JIM (ج)", "DAL (د)", "SIN (س)"], answer: "TA (ت)", explanation: "Urutannya: Alif (ا), Ba (ب), Ta (ت), Tsa (ث)." },
        { prompt: "Huruf hijaiyah yang memiliki satu titik di bawah adalah...", options: ["BA (ب)", "NUN (ن)", "YA (ي)", "TA (ت)"], answer: "BA (ب)", explanation: "Huruf Ba (ب) memiliki 1 titik di bagian bawah." }
      ]
    },
    {
      id: "sambung_ayat",
      title: "4. Sambung Ayat",
      desc: "Lengkapi potongan ayat / bacaan pendek Al-Qur'an.",
      badgeColor: "stat-card-purple",
      questions: [
        { prompt: "Lanjutan bacaan 'Bismillahirrahmanirrahim' pada awal Al-Fatihah adalah 'Alhamdulillahi rabbil...'", options: ["'alamin", "ghafur", "karim", "hakim"], answer: "'alamin", explanation: "Ayat kedua Surah Al-Fatihah berbunyi: Alhamdulillahi rabbil 'alamin." },
        { prompt: "Ayat pertama Surah Al-Ikhlas adalah 'Qul huwallahu...'", options: ["Ahad", "Samad", "Kufuan", "Rabbil"], answer: "Ahad", explanation: "Qul huwallahu ahad artinya Katakanlah (Muhammad), Dialah Allah, Yang Maha Esa." }
      ]
    },
    {
      id: "tebak_nabi",
      title: "5. Tebak Nama Nabi dan Rasul",
      desc: "Kenali kisah dan gelar para Nabi & Rasul pilihan.",
      badgeColor: "stat-card-green",
      questions: [
        { prompt: "Nabi yang mendapat gelar Ulul Azmi dan membuat kapal besar atas perintah Allah adalah...", options: ["Nabi Nuh AS", "Nabi Adam AS", "Nabi Sulaiman AS", "Nabi Yunus AS"], answer: "Nabi Nuh AS", explanation: "Nabi Nuh AS berdakwah dengan sabar dan membangun bahtera untuk menyelamatkan umat yang beriman." },
        { prompt: "Nabi dan Rasul terakhir penutup para nabi adalah...", options: ["Nabi Muhammad SAW", "Nabi Isa AS", "Nabi Musa AS", "Nabi Ibrahim AS"], answer: "Nabi Muhammad SAW", explanation: "Nabi Muhammad SAW adalah Khatamul Anbiya (penutup para nabi dan rasul)." }
      ]
    },
    {
      id: "rukun_islam",
      title: "6. Kuis Rukun Islam",
      desc: "Uji hafalan 5 Rukun Islam sejak dini.",
      badgeColor: "stat-card-blue",
      questions: [
        { prompt: "Rukun Islam yang pertama adalah membaca...", options: ["Dua Kalimat Syahadat", "Salat Lima Waktu", "Zakat Fitrah", "Puasa Ramadan"], answer: "Dua Kalimat Syahadat", explanation: "Rukun Islam ke-1 adalah Syahadat, ke-2 Salat, ke-3 Zakat, ke-4 Puasa, ke-5 Haji bila mampu." },
        { prompt: "Menunaikan ibadah puasa pada bulan Ramadan merupakan Rukun Islam ke...", options: ["4", "2", "3", "5"], answer: "4", explanation: "Puasa Ramadan adalah Rukun Islam yang keempat." }
      ]
    },
    {
      id: "rukun_iman",
      title: "7. Kuis Rukun Iman",
      desc: "Pelajari 6 pondasi keimanan seorang muslim.",
      badgeColor: "stat-card-yellow",
      questions: [
        { prompt: "Beriman kepada Qada dan Qadar merupakan Rukun Iman ke...", options: ["6", "3", "4", "5"], answer: "6", explanation: "Rukun Iman ada 6: Iman kepada Allah, Malaikat, Kitab, Rasul, Hari Akhir, dan Qada-Qadar." },
        { prompt: "Malaikat yang bertugas menyampaikan wahyu kepada para nabi adalah...", options: ["Malaikat Jibril", "Malaikat Mikail", "Malaikat Israfil", "Malaikat Izrail"], answer: "Malaikat Jibril", explanation: "Malaikat Jibril bertugas menyampaikan wahyu Allah SWT." }
      ]
    },
    {
      id: "perilaku_terpuji",
      title: "8. Game Perilaku Terpuji",
      desc: "Pilih sikap akhlak mulia dalam kehidupan sehari-hari.",
      badgeColor: "stat-card-purple",
      questions: [
        { prompt: "Ketika menemukan uang jatuh di halaman sekolah, sikap terpuji yang dilakukan adalah...", options: ["Mengembalikannya / melapor ke guru", "Mengambilnya diam-diam", "Membelanjakannya sendiri", "Membuangnya"], answer: "Mengembalikannya / melapor ke guru", explanation: "Jujur dan amanah adalah akhlak terpuji yang dicintai Allah SWT." },
        { prompt: "Sebelum dan sesudah belajar serta makan, adab yang baik adalah...", options: ["Berdoa", "Langsung berlari", "Bermain HP", "Marah-marah"], answer: "Berdoa", explanation: "Berdoa menunjukkan sikap rendah hati dan memohon keberkahan kepada Allah SWT." }
      ]
    },
    {
      id: "surat_pendek",
      title: "9. Tebak Surat Pendek",
      desc: "Kenali nama surat pendek Juz Amma dan artinya.",
      badgeColor: "stat-card-green",
      questions: [
        { prompt: "Surah Al-Lahab menceritakan tentang...", options: ["Abu Lahab dan istrinya", "Semut yang berbicara", "Gajah penyerang Ka'bah", "Waktu fajar"], answer: "Abu Lahab dan istrinya", explanation: "Surah Al-Lahab terdiri dari 5 ayat tentang balasan bagi penentang dakwah." },
        { prompt: "Surah An-Nas terdiri dari 6 ayat dan berisi permohonan perlindungan kepada...", options: ["Allah SWT", "Bintang", "Pohon besar", "Jimat"], answer: "Allah SWT", explanation: "An-Nas artinya manusia; kita memohon perlindungan dari godaan hanya kepada Allah SWT." }
      ]
    },
    {
      id: "benar_salah",
      title: "10. Benar atau Salah",
      desc: "Tentukan pernyataan PAI berikut Benar atau Salah.",
      badgeColor: "stat-card-blue",
      questions: [
        { prompt: "Pernyataan: 'Wudu wajib dilakukan sebelum melaksanakan salat.'", options: ["Benar", "Salah"], answer: "Benar", explanation: "Benar! Wudu mensucikan hadas kecil sebagai syarat sah salat." },
        { prompt: "Pernyataan: 'Berbohong kepada orang tua termasuk perbuatan terpuji.'", options: ["Salah", "Benar"], answer: "Salah", explanation: "Salah! Berbohong adalah perbuatan tercela; anak saleh/salehah wajib berkata jujur." }
      ]
    }
  ];

  let activeGame = null;
  let qIndex = 0;
  let sessionScore = 0;
  let totalPoints = profile.total_points || 0;

  document.getElementById("gameTotalPointsBadge").textContent = totalPoints;
  renderGameMenu();
  await loadLeaderboard();
  subscribeGameRealtime();

  function renderGameMenu() {
    document.getElementById("gameMenuGrid").innerHTML = GAMES_CATALOG.map((g) => `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="pai-card p-3 h-100 ${g.badgeColor} d-flex flex-column justify-content-between">
          <div>
            <h6 class="fw-bold mb-1">${escapeHTML(g.title)}</h6>
            <p class="small text-muted mb-3">${escapeHTML(g.desc)}</p>
          </div>
          <button class="btn btn-pai-primary btn-sm rounded-3 btn-play-game" data-game-id="${g.id}">Mainkan</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".btn-play-game").forEach((btn) => {
      btn.addEventListener("click", () => startGame(btn.dataset.gameId));
    });
  }

  function startGame(gameId) {
    activeGame = GAMES_CATALOG.find((g) => g.id === gameId);
    if (!activeGame) return;
    qIndex = 0;
    sessionScore = 0;
    document.getElementById("gameArenaCard").classList.remove("d-none");
    document.getElementById("arenaGameTitle").textContent = activeGame.title;
    renderGameQuestion();
  }

  function renderGameQuestion() {
    const q = activeGame.questions[qIndex];
    document.getElementById("arenaQuestionProgress").textContent = `Soal ${qIndex + 1} dari ${activeGame.questions.length}`;
    document.getElementById("arenaSessionScore").textContent = sessionScore;
    document.getElementById("arenaPromptBox").innerHTML = `<div class="fw-bold fs-6">${escapeHTML(q.prompt)}</div>`;
    document.getElementById("arenaExplanationBox").classList.add("d-none");
    document.getElementById("btnNextGameQuestion").classList.add("d-none");

    const choicesBox = document.getElementById("arenaChoicesBox");
    choicesBox.innerHTML = q.options.map((opt) => `
      <button type="button" class="btn btn-outline-dark text-start py-2 px-3 rounded-3 btn-game-choice" data-val="${escapeHTML(opt)}">
        ${escapeHTML(opt)}
      </button>
    `).join("");

    choicesBox.querySelectorAll(".btn-game-choice").forEach((b) => {
      b.addEventListener("click", () => handleAnswer(b.dataset.val, q));
    });
  }

  async function handleAnswer(chosen, q) {
    document.querySelectorAll(".btn-game-choice").forEach((b) => { b.disabled = true; });
    const isCorrect = chosen === q.answer;
    const delta = isCorrect ? 20 : -5;
    sessionScore += delta;
    document.getElementById("arenaSessionScore").textContent = sessionScore;

    const expBox = document.getElementById("arenaExplanationBox");
    expBox.classList.remove("d-none", "alert-success", "alert-danger");
    expBox.classList.add(isCorrect ? "alert-success" : "alert-danger");
    expBox.innerHTML = `
      <strong>${isCorrect ? "Alhamdulillah, Benar! (+20 Poin)" : "Kurang tepat! (-5 Poin)"}</strong><br/>
      Jawaban benar: <strong>${escapeHTML(q.answer)}</strong><br/>
      Pembahasan: ${escapeHTML(q.explanation)}
    `;

    // Simpan perubahan poin ke Supabase via RPC
    const { data: updatedTotal, error } = await db.rpc("record_game_score", {
      p_game_name: activeGame.title,
      p_points: delta
    });

    if (!error && typeof updatedTotal === "number") {
      totalPoints = updatedTotal;
      document.getElementById("gameTotalPointsBadge").textContent = totalPoints;
    }

    const nextBtn = document.getElementById("btnNextGameQuestion");
    nextBtn.classList.remove("d-none");
    nextBtn.textContent = qIndex + 1 < activeGame.questions.length ? "Lanjut Soal Berikutnya" : "Selesaikan Permainan";
  }

  document.getElementById("btnNextGameQuestion").addEventListener("click", () => {
    if (qIndex + 1 < activeGame.questions.length) {
      qIndex += 1;
      renderGameQuestion();
    } else {
      alert(`Permainan selesai! Skor sesi ini: ${sessionScore} poin.`);
      document.getElementById("gameArenaCard").classList.add("d-none");
      loadLeaderboard();
    }
  });

  document.getElementById("btnExitGame").addEventListener("click", () => {
    document.getElementById("gameArenaCard").classList.add("d-none");
  });

  async function loadLeaderboard() {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, total_points, role")
      .eq("role", "siswa")
      .order("total_points", { ascending: false })
      .limit(10);

    const tbody = document.getElementById("gameLeaderboardBody");
    if (!data || !data.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Belum ada skor.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((row, idx) => `
      <tr>
        <td class="fw-bold">${idx + 1}</td>
        <td>${escapeHTML(row.full_name)}</td>
        <td class="text-end fw-bold text-success">${row.total_points || 0}</td>
      </tr>
    `).join("");
  }

  function subscribeGameRealtime() {
    db.channel("game-leaderboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadLeaderboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "student_points" }, () => loadLeaderboard())
      .subscribe();
  }
});