// ============================================================================
// PORTAL PEMBELAJARAN PAI SDN KIARAPANDAK 01
// File: /js/auth.js
// Deskripsi: Autentikasi Supabase Auth, Role Guard, Reset Password & Logout
// ============================================================================

(function () {
  const { db, escapeHTML } = window.PAI_APP;

  /**
   * Ambil sesi aktif dan profil lengkap pengguna beserta nama kelasnya.
   */
  async function getCurrentUserProfile() {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return { user: null, profile: null };
    }

    const user = sessionData.session.user;
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select(`
        id,
        full_name,
        username,
        role,
        class_id,
        avatar_url,
        total_points,
        classes (
          id,
          class_name,
          academic_year
        )
      `)
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Gagal memuat profil pengguna:", profileError.message);
      return { user, profile: null };
    }

    return { user, profile };
  }

  /**
   * Login menggunakan email atau username + password.
   * Jika input tidak mengandung '@', sistem mencocokkan username ke email domain internal sekolah.
   */
  async function loginWithIdentifier(identifier, password) {
    const trimmed = identifier.trim();
    let email = trimmed;

    if (!trimmed.includes("@")) {
      const { data: foundProfile } = await db
        .from("profiles")
        .select("username")
        .eq("username", trimmed.toLowerCase())
        .maybeSingle();

      const uname = foundProfile?.username || trimmed.toLowerCase();
      email = `${uname}@sdnkiarapandak01.sch.id`;
    }

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    const { profile } = await getCurrentUserProfile();
    return { data, profile, error: null };
  }

  /**
   * Kirim tautan reset password (Lupa Password).
   */
  async function sendPasswordReset(email) {
    const redirectTo = `${window.location.origin}/login.html`;
    return await db.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  }

  /**
   * Logout dan arahkan ke halaman login.
   */
  async function logoutUser() {
    await db.auth.signOut();
    window.location.href = "/login.html";
  }

  /**
   * Lindungi halaman privat: jika belum login -> ke login.html;
   * jika role tidak diizinkan -> arahkan sesuai role atau tampilkan peringatan.
   * @param {string[]} allowedRoles - misal ['admin', 'guru', 'siswa']
   */
  async function requireAuth(allowedRoles = ["admin", "guru", "siswa"]) {
    const { user, profile } = await getCurrentUserProfile();

    if (!user || !profile) {
      window.location.href = "/login.html";
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      alert(`Akses ditolak: Halaman ini khusus untuk peran ${allowedRoles.join(", ")}.`);
      window.location.href = "/dashboard.html";
      return null;
    }

    renderUserNavbarInfo(profile);
    return { user, profile };
  }

  /**
   * Isi informasi nama, role, kelas, dan tombol logout pada navbar/header halaman.
   */
  function renderUserNavbarInfo(profile) {
    const nameEl = document.getElementById("navUserName");
    const roleEl = document.getElementById("navUserRole");
    const classEl = document.getElementById("navUserClass");
    const avatarEl = document.getElementById("navUserAvatar");
    const logoutBtn = document.getElementById("btnLogout");

    if (nameEl) nameEl.textContent = profile.full_name;
    if (roleEl) {
      const labelMap = { admin: "Administrator", guru: "Guru PAI", siswa: "Siswa" };
      roleEl.textContent = labelMap[profile.role] || profile.role;
    }
    if (classEl) {
      classEl.textContent = profile.classes?.class_name
        ? `${profile.classes.class_name} (${profile.classes.academic_year})`
        : "Portal Sekolah";
    }
    if (avatarEl && profile.avatar_url) {
      avatarEl.src = profile.avatar_url;
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logoutUser();
      });
    }
  }

  function badgeRoleHTML(role) {
    if (role === "admin") {
      return `<span class="badge bg-danger-subtle text-danger-emphasis rounded-pill px-3 py-2">${escapeHTML("Administrator")}</span>`;
    }
    if (role === "guru") {
      return `<span class="badge bg-primary-subtle text-primary-emphasis rounded-pill px-3 py-2">${escapeHTML("Guru PAI")}</span>`;
    }
    return `<span class="badge bg-success-subtle text-success-emphasis rounded-pill px-3 py-2">${escapeHTML("Siswa")}</span>`;
  }

  window.PAI_AUTH = {
    getCurrentUserProfile,
    loginWithIdentifier,
    sendPasswordReset,
    logoutUser,
    requireAuth,
    renderUserNavbarInfo,
    badgeRoleHTML
  };
})();