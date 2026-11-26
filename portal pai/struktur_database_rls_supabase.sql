-- ============================================================================
-- SKEMA DATABASE LENGKAP: PORTAL BELAJAR PAI KECAMATAN SUKAJAYA
-- Jalankan skrip ini di menu SQL Editor pada Dashboard Supabase Anda.
-- ============================================================================

-- 1. TABEL PROFIL PENGGUNA (SISWA, GURU, ADMIN)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('siswa', 'guru', 'admin')) DEFAULT 'siswa',
  kelas INT CHECK (kelas BETWEEN 1 AND 6),
  sekolah TEXT,
  poin INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL MATERI PEMBELAJARAN PAI (KELAS 1 - 6)
CREATE TABLE public.materi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas INT NOT NULL CHECK (kelas BETWEEN 1 AND 6),
  bab TEXT NOT NULL,
  judul TEXT NOT NULL,
  ringkasan TEXT NOT NULL,
  isi TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL VIDEO PEMBELAJARAN
CREATE TABLE public.video (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas INT NOT NULL CHECK (kelas BETWEEN 1 AND 6),
  judul TEXT NOT NULL,
  deskripsi TEXT,
  youtube_id TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL PERPUSTAKAAN DIGITAL (PDF & MODUL AJAR)
CREATE TABLE public.perpustakaan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas INT NOT NULL CHECK (kelas BETWEEN 1 AND 6),
  jenis TEXT NOT NULL,
  judul TEXT NOT NULL,
  ukuran TEXT,
  file_url TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL BANK SOAL (KUIS & GAME EDUKASI)
CREATE TABLE public.bank_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas INT NOT NULL CHECK (kelas BETWEEN 1 AND 6),
  pertanyaan TEXT NOT NULL,
  pilihan JSONB NOT NULL, -- Format Array: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"]
  jawaban_benar INT NOT NULL CHECK (jawaban_benar BETWEEN 0 AND 3),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL TUGAS SISWA
CREATE TABLE public.tugas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas INT NOT NULL CHECK (kelas BETWEEN 1 AND 6),
  judul TEXT NOT NULL,
  deskripsi TEXT NOT NULL,
  deadline DATE NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL PENGUMPULAN JAWABAN TUGAS
CREATE TABLE public.pengumpulan_tugas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tugas_id UUID REFERENCES public.tugas(id) ON DELETE CASCADE,
  siswa_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  jawaban_teks TEXT NOT NULL,
  link_file TEXT,
  nilai INT CHECK (nilai BETWEEN 0 AND 100),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL REKAP NILAI & PERKEMBANGAN BELAJAR
CREATE TABLE public.rekap_nilai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  jenis_aktivitas TEXT NOT NULL, -- 'Kuis Interaktif', 'Game Edukasi', 'Penilaian Tugas'
  judul_aktivitas TEXT NOT NULL,
  skor INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PENGATURAN KEAMANAN HAK AKSES (ROW LEVEL SECURITY / RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perpustakaan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengumpulan_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rekap_nilai ENABLE ROW LEVEL SECURITY;

-- Fungsi bantu untuk mengecek apakah pengguna adalah Guru atau Admin
CREATE OR REPLACE FUNCTION public.is_guru_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('guru', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Kebijakan Tabel Users (Semua pengguna terautentikasi bisa melihat papan peringkat)
CREATE POLICY "Lihat profil & peringkat" ON public.users FOR SELECT USING (true);
CREATE POLICY "Insert profil sendiri" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Update profil sendiri" ON public.users FOR UPDATE USING (auth.uid() = id OR public.is_guru_or_admin());

-- Kebijakan Konten Pembelajaran (Semua bisa baca; hanya Guru & Admin bisa tambah/edit/hapus)
CREATE POLICY "Semua baca materi" ON public.materi FOR SELECT USING (true);
CREATE POLICY "Guru kelola materi" ON public.materi FOR ALL USING (public.is_guru_or_admin());

CREATE POLICY "Semua baca video" ON public.video FOR SELECT USING (true);
CREATE POLICY "Guru kelola video" ON public.video FOR ALL USING (public.is_guru_or_admin());

CREATE POLICY "Semua baca perpus" ON public.perpustakaan FOR SELECT USING (true);
CREATE POLICY "Guru kelola perpus" ON public.perpustakaan FOR ALL USING (public.is_guru_or_admin());

CREATE POLICY "Semua baca soal" ON public.bank_soal FOR SELECT USING (true);
CREATE POLICY "Guru kelola soal" ON public.bank_soal FOR ALL USING (public.is_guru_or_admin());

CREATE POLICY "Semua baca tugas" ON public.tugas FOR SELECT USING (true);
CREATE POLICY "Guru kelola tugas" ON public.tugas FOR ALL USING (public.is_guru_or_admin());

-- Kebijakan Pengumpulan Tugas
CREATE POLICY "Siswa lihat tugas sendiri & guru lihat semua" ON public.pengumpulan_tugas
  FOR SELECT USING (auth.uid() = siswa_id OR public.is_guru_or_admin());
CREATE POLICY "Siswa kumpulkan tugas" ON public.pengumpulan_tugas
  FOR INSERT WITH CHECK (auth.uid() = siswa_id);
CREATE POLICY "Guru beri nilai tugas" ON public.pengumpulan_tugas
  FOR UPDATE USING (public.is_guru_or_admin());

-- Kebijakan Rekap Nilai
CREATE POLICY "Siswa lihat nilai sendiri & guru lihat semua" ON public.rekap_nilai
  FOR SELECT USING (auth.uid() = siswa_id OR public.is_guru_or_admin());
CREATE POLICY "Catat nilai aktivitas" ON public.rekap_nilai
  FOR INSERT WITH CHECK (auth.uid() = siswa_id OR public.is_guru_or_admin());