---
title: 'JWT Access + Refresh Auth Upgrade'
type: 'refactor'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: '443d3c3ab2d6d13c30833e9b8c713b3f3c73e2e3'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 2
context:
  - '{project-root}/src/lib/auth.ts'
  - '{project-root}/src/lib/db.ts'
  - '{project-root}/src/proxy.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Auth saat ini memakai opaque session table + cookie 30 hari + scrypt + id TEXT `usr_*` — bukan sistem token yang proper untuk dashboard, dan tidak sesuai permintaan: JWT access/refresh, UUID, bcrypt.

**Approach:** Ganti dengan JWT access token (15 menit) + JWT refresh token (7 hari, rotasi & revocable via tabel `refresh_tokens`), password bcrypt (bcryptjs), id user UUID native Postgres. Semua token dikirim via httpOnly cookie; client melakukan silent refresh saat access token kedaluwarsa.

## Boundaries & Constraints

**Always:**
- UI template Onyx tidak boleh berubah (hanya logika data/auth yang berubah)
- Password diverifikasi dengan bcryptjs; id user UUID `gen_random_uuid()`
- Access & refresh token hanya via httpOnly cookie (tidak pernah localStorage/URL)
- Refresh token: disimpan di DB sebagai SHA-256 hash jti, dirotasi setiap refresh, direvoke saat logout; deteksi reuse → revoke
- Proxy (edge) memakai `jose` untuk verifikasi kriptografis — tidak boleh import `pg`/db.ts
- Kredensial hanya di `.env.local` (gitignored); `AUTH_SECRET` wajib ada (fail-fast)

**Never:**
- Tidak mengubah tampilan/komponen UI template (form, users-view layout, auth-shell)
- Tidak memakai library auth pihak ketiga (NextAuth/Clerk) — JWT manual dengan `jose` + `bcryptjs`
- Tidak mempertahankan data lama (tabel sessions & hash scrypt di-drop; 3 akun demo di-reseed via script)
- Tidak menaruh JWT di localStorage atau Authorization header untuk navigasi halaman

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Register baru | name/email/password valid, email unik | 201, user UUID, cookie access+refresh ter-set | 409 email duplikat, 400 validasi |
| Login benar | email + password cocok bcrypt | 200, cookie access+refresh ter-set | — |
| Login salah | password tidak cocok | 401 `Invalid email or password` | timing-safe (compare selalu dijalankan) |
| Access token valid | cookie access < 15 menit | API memproses request normal | — |
| Access expired, refresh valid | client apiFetch dapat 401 | POST /api/auth/refresh → rotasi jti → retry request berhasil | — |
| Refresh reuse | jti lama dipakai lagi | Semua token user direvoke, 401 | Client redirect ke /login |
| Logout | cookie refresh valid | Refresh revoked di DB, kedua cookie dihapus, 200 | Tetap 200 walau cookie kosong |
| Navigasi, access expired, refresh valid | proxy: access invalid + refresh cookie ada | Halaman dimuat; client silently refresh | Data API tetap butuh token valid |
| Navigasi tanpa keduanya | belum login | 307 redirect ke /login?next=… | — |

</frozen-after-approval>

## Code Map

- `src/lib/db.ts` -- Pool pg + ensureSchema. REWRITE: schema v2 (users UUID PK + refresh_tokens dengan revoked_reason), migrasi drop tabel legacy users(TEXT id)+sessions saat deteksi kolom id bertipe TEXT, ALTER idempoten untuk tabel v2 lama
- `src/lib/jwt.ts` -- BARU, edge-safe (jose + constants saja): sign/verify access & refresh, cookie names, lifetime constants; AUTH_SECRET fail-fast di module load; expired-path cek type access
- `src/lib/auth.ts` -- REWRITE: bcrypt hash/verify, issueTokenPair (access cookie maxAge = refresh TTL), rotateRefreshToken atomik + revoked_reason + grace 30s jam-Postgres + status Active, revokeAllUserTokens, getSessionUser (verify access JWT → load user)
- `src/lib/auth-constants.ts` -- Tetap edge-safe; cookie names pindah ke sini (dipakai proxy & jwt.ts)
- `.gitignore` -- tambah `!.env.example` negation (tanpa ini deliverable plan tak ter-commit)
- `src/app/api/auth/register|login|logout|me/route.ts` -- Adaptasi ke auth.ts baru; register/login issue token pair; logout revoke; me dari access token
- `src/app/api/auth/refresh/route.ts` -- BARU: rotasi refresh token
- `src/app/api/users/route.ts` -- id UUID; mapping display USR-XXX (index) tetap; add user → bcrypt + UUID
- `src/proxy.ts` -- verify access JWT via jose; jika invalid tapi refresh cookie ada → allow (client refresh); jika tidak ada sama sekali → /login
- `src/lib/api.ts` -- BARU: `apiFetch` client — sekali retry setelah /api/auth/refresh saat 401
- `src/components/dashboard/users-view.tsx`, `user-profile-menu.tsx` -- Ganti fetch → apiFetch (hanya mekanik, UI sama)
- `scripts/seed-users.mjs` -- BARU: reseed 3 akun demo (bcrypt + UUID) setelah migrasi
- `.env.local` / `.env.example` -- Tambah AUTH_SECRET (random 64 hex)
- `src/components/auth/login-form.tsx`, `register-form.tsx` -- TIDAK diubah (endpoint & response shape sama)

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- install `jose`, `bcryptjs`, `@types/bcryptjs` -- dependensi JWT & bcrypt
- [ ] `.env.local` + `.env.example` -- tambah AUTH_SECRET (generate random) -- signing key JWT; `.env.local` sudah ada (jangan dibuat ulang)
- [ ] `.gitignore` -- tambah negation `!.env.example` setelah rule `.env*` -- tanpa ini `.env.example` tak bisa ter-commit (bug loop-1 F5)
- [ ] `src/lib/auth-constants.ts` -- pindahkan cookie names access/refresh ke sini -- dipakai proxy (edge) & server
- [ ] `src/lib/jwt.ts` -- sign/verify access & refresh JWT (jose, HS256, payload sub/email/role/type/jti) -- edge-safe, tanpa import pg; `AUTH_SECRET` divalidasi di module load (throw saat import); `verifyAccessTokenStatus` cabang expired cek `payload.type === "access"`
- [ ] `src/lib/db.ts` -- schema v2: users (UUID PK DEFAULT gen_random_uuid(), kolom sama), refresh_tokens (id UUID, user_id FK CASCADE, token_hash TEXT UNIQUE, expires_at, revoked_at, **revoked_reason TEXT**, created_at); migrasi: drop users+sessions legacy bila id bertipe TEXT (bandingkan lowercase); **`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason TEXT`** untuk DB yang sudah punya tabel v2 tanpa kolom itu
- [ ] `src/lib/auth.ts` -- bcrypt (cost 10) hashPassword/verifyPassword; issueTokenPair(user) set 2 cookie httpOnly (refresh: path=/api/auth; **access cookie `maxAge` = `REFRESH_TOKEN_TTL_SECONDS`**); rotateRefreshToken **atomik + revoked_reason + grace 30s dihitung jam Postgres + cek status Active di kedua jalur** (lihat Design Notes); revokeRefreshToken menulis `revoked_reason='logout'`; revokeAllUserTokens menulis `'reuse'`; getSessionUser dari access JWT
- [ ] `src/app/api/auth/register/route.ts` -- bcrypt + UUID (DB default), issue token pair, role Admin untuk user pertama
- [ ] `src/app/api/auth/login/route.ts` -- bcrypt.compare, issue token pair; compare tetap dijalankan walau user tidak ada (timing-safe via DUMMY_PASSWORD_HASH)
- [ ] `src/app/api/auth/refresh/route.ts` -- verify refresh JWT + rotasi atomik → set cookie baru → 200 {user}; rotated >30s → revoke semua → 401; replay token logout/'reuse' → 401 + clear cookies TANPA grace; user non-Active → revoke semua + 401; token tak dikenal/expired → 401 + clear cookies
- [ ] `src/app/api/auth/logout/route.ts` -- revoke jti refresh di DB dengan `revoked_reason='logout'`, hapus kedua cookie
- [ ] `src/app/api/auth/me/route.ts` -- tak berubah secara perilaku (getSessionUser baru)
- [ ] `src/app/api/users/route.ts` -- INSERT tanpa id eksplisit (pakai DB default UUID); sisanya sama
- [ ] `src/proxy.ts` -- cek access JWT via jose; **expired-but-signed** → allow (client silent refresh); refresh cookie ada → allow through; keduanya absen → redirect /login; login+valid access → redirect /
- [ ] `src/lib/api.ts` -- apiFetch: fetch → 401 && belum retry → POST refresh → ok: retry sekali; gagal: window.location /login; single-flight per module
- [ ] `src/components/dashboard/users-view.tsx`, `src/components/dashboard/user-profile-menu.tsx` -- pakai apiFetch untuk /api/users, /api/auth/me, /api/users POST, logout tetap fetch biasa + redirect manual
- [ ] `scripts/seed-users.mjs` -- mirror schema v2 termasuk ALTER revoked_reason; reseed admin@onyx.dev/password123 (Admin), fathur@onyx.dev/password123 (Admin), sarah@onyx.dev/rahasia123 (Editor); ON CONFLICT DO NOTHING
- [ ] Jalankan migrasi + seed: restart dev server (ensureSchema jalan) → `node scripts/seed-users.mjs`

**Acceptance Criteria:**
- Given email unik & password ≥8 char, when register, then user tersimpan dengan id UUID (regex UUID v4) dan password_hash berprefix `$2b$`
- Given login sukses, when response diterima, then ada cookie `onyx_access` (httpOnly) dan `onyx_refresh` (httpOnly, path=/api/auth)
- Given access token kadaluarsa tapi refresh valid, when client apiFetch, then request di-retry sukses setelah sekali rotasi refresh (jti lama revoked di DB)
- Given refresh token yang sudah dirotasi dipakai lagi, when /api/auth/refresh dipanggil, then semua refresh token user itu direvoke dan response 401
- Given logout, when selesai, then baris refresh_tokens revoked_at terisi dan kedua cookie hilang
- Given user belum login, when GET /users, then 307 ke /login; given login, when GET /api/users, then list user dari DB dengan UUID id internal

## Implementation Notes

- Login selalu menjalankan bcrypt compare terhadap `DUMMY_PASSWORD_HASH` saat email tidak dikenal — response time konstan (timing-safe).
- `apiFetch` refresh single-flight: 401 paralel berbagi satu POST /api/auth/refresh; dua refresh paralel akan saling memicu reuse-detection dan logout tak sengaja.
- **Konflik plan (diselesaikan implementer, disetujui orchestrator):** matrix "access expired + refresh valid → halaman dimuat" tidak dapat diimplementasikan literal — cookie refresh path-scoped `/api/auth` tidak pernah terkirim ke route halaman, jadi proxy tak bisa melihatnya. Solusi: proxy membedakan access token *expired-tapi-tertanda-tangan-valid* (via `verifyAccessTokenStatus`) dari yang garbage; expired-signed → halaman tetap disajikan, client silently refresh. Perilaku akhir identik dengan baris matrix.
- `window.location.assign("/login")` di api.ts memakai eslint-disable eksplisit — hard navigation memang disengaja (reset seluruh client state); `useRouter` tidak tersedia di module non-komponen.
- Migrasi berjalan otomatis via ensureSchema (deteksi `users.id` bertipe TEXT → drop users+sessions); seed demo dilakukan `scripts/seed-users.mjs` (idempotent, ON CONFLICT DO NOTHING).
- 1 warning eslint tersisa (`BrightdeskMark` unused) adalah bawaan template — dibiarkan sesuai mandate 1:1.

## Plan Change Log

### Loop 1 — quick review setelah implementasi pertama

- **Trigger:** F1 (medium, bad_plan): access cookie `maxAge` = TTL JWT (900s) → browser meng-evict cookie bersamaan dengan expiry token, sehingga cabang proxy "expired-but-signed" tak pernah terjadi di browser nyata; user idle >15 menit di-redirect ke /login meski refresh token 7 hari masih valid — baris matrix "access expired + refresh valid → halaman dimuat" tidak terpenuhi. F2 (medium, bad_plan): `rotateRefreshToken` non-atomik (SELECT lalu UPDATE terpisah, affected-row-count diabaikan, tanpa transaksi) — dua tab yang refresh bersamaan menghasilkan logout spontan (reuse palsu → revoke keluarga) atau dua keluarga token live; pola ini persis pseudocode di Design Notes lama, jadi akar masalahnya plan.
- **Amendemen (section non-frozen):** Design Notes diganti pola rotasi atomik `UPDATE … WHERE revoked_at IS NULL RETURNING` + kebijakan grace window 30 detik (loser konkuren → issue pair baru tanpa family-revoke; replay >30s → revoke keluarga sesuai AC frozen). Tasks ditambah: access cookie `maxAge` = `REFRESH_TOKEN_TTL_SECONDS` (cookie outlive JWT sehingga proxy melihat token expired-signed → halaman disajikan → client silent refresh); `AUTH_SECRET` divalidasi di module-load jwt.ts (mirror db.ts); `verifyAccessTokenStatus` cabang expired wajib cek `payload.type === "access"`; `.gitignore` negation `!.env.example`.
- **Known-bad yang dihindari:** silent-refresh yang hanya hidup di sub-detik transit-skew; race dua tab yang tak bisa dideteksi dari log; operator deploy tanpa `AUTH_SECRET` hanya melihat 500 opaq; checkout baru tanpa dokumentasi env.
- **KEEP (harus bertahan di re-derivation):** timing-safe login via `DUMMY_PASSWORD_HASH` (bcrypt compare selalu jalan); pembagian modul edge-safe (`jwt.ts` jose-only tanpa pg, `auth-constants.ts`); cookie attributes (access `Path=/` httpOnly, refresh `Path=/api/auth` httpOnly); `apiFetch` single-flight + retry-once + hard-redirect /login; `DUMMY`/cost 10 bcrypt; skema v2 (UUID PK `gen_random_uuid()`, `refresh_tokens` dengan sha256(jti) UNIQUE, deteksi legacy TEXT-id → drop); seed script idempotent; mapping display USR-XXX; revocation pada logout di path cookie asli; proxy tanpa import pg; eslint-disable beralasan di api.ts; UI template tak tersentuh (hanya fetch → apiFetch).

### Loop 2 — quick review setelah re-derivation pertama

- **Trigger:** F6 (medium, bad_plan): rotasi refresh re-issue pair untuk user `status != 'Active'` tanpa batas waktu — login menolak dengan 403 tapi `loadUserById` tanpa filter status; deactivation tak pernah efektif. F7 (medium, bad_plan): aritmetika grace window mencampur jam Postgres (penulis `revoked_at`) dengan jam Node (pengukur `Date.now()`) pada dua host berbeda; skew >30s menggagalkan grace (family-revoke palsu — bug F2 lagi) atau melebarkan window serang. F8 (medium, bad_plan): cabang grace tak membedakan asal revocation — replay token yang di-revoke oleh **logout** dalam ≤30s mendapat pair baru; sesi hidup kembali setelah logout eksplisit, melanggar constraint frozen "direvoke saat logout".
- **Amendemen (section non-frozen):** kolom baru `refresh_tokens.revoked_reason TEXT` ('rotated' | 'logout' | 'reuse') — grace window HANYA berlaku untuk `revoked_reason='rotated'`; replay token 'logout'/'reuse' → 401 + clear cookies tanpa re-issue dan tanpa family-revoke baru. Perbandingan grace dipindah ke SQL pada jam Postgres (`now() - revoked_at <= interval '30 seconds'`) — setiap timestamp dibandingkan pada jam yang menulisnya (expires_at ditulis Node → dibanding Node; revoked_at ditulis Postgres → dibanding Postgres). Migrasi idempoten `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason TEXT` (DB produksi sudah punya tabel tanpa kolom ini) di db.ts + mirror seed script. Penegakan status di kedua jalur rotasi: user tidak-Active → `revokeAllUserTokens` + 401 + clear cookies; sisa akses ≤15 menit via access token yang masih valid di `getSessionUser` ditoleransi (paritas baseline, dicatat).
- **Known-bad yang dihindari:** logout yang bisa "dibatalkan" dalam 30 detik; akun nonaktif yang tak pernah benar-benar terputus; keputusan keamanan yang bergantung pada sinkronisasi jam antar host.
- **KEEP loop-2 (di atas KEEP loop-1):** kerangka rotasi atomik `UPDATE … WHERE revoked_at IS NULL AND expires_at > now() RETURNING` (hanya alasan revocation yang berubah); log warning terstruktur di jalur grace/reuse; fix migrasi `data_type` lowercase + `DROP TABLE IF EXISTS sessions` idempoten; early-return proxy untuk route non-protected/non-auth; `decodeTokenClaims` (decode tak terverifikasi) untuk revocation logout dengan rasional terdokumentasi; helper `isProduction()`; validasi register 409/400; seed loader .env.local tanpa dependensi.

## Review Triage Log

- Loop 1 (quick): verdict counts — high 0 · medium 2 · low 3 · false 0 · maybe-false 0.
  - F1 `src/lib/auth.ts:106` + `src/proxy.ts` — medium · bad_plan — terverifikasi: `maxAge: ACCESS_TOKEN_TTL_SECONDS` identik dengan `exp` JWT; browser meng-evict cookie saat expiry sehingga `verifyAccessTokenStatus` tak pernah menerima token expired-signed di navigasi nyata; user idle >15 mnt di-redirect ke /login meski refresh valid. Matriks frozen menuntut perilaku tersebut, plan tidak menetapkan masa hidup cookie → akar di plan.
  - F2 `src/lib/auth.ts` `rotateRefreshToken` — medium · bad_plan — terverifikasi: SELECT dan UPDATE adalah statement terpisah tanpa transaksi, affected-row-count UPDATE diabaikan; dua tab memicu dua POST /api/auth/refresh paralel (single-flight hanya per-tab/module). Interleaving (a) → dua baris refresh live (orphan tetap valid), (b) → reuse palsu → revokeAllUserTokens mematikan token yang baru ter-issue → logout spontan. Pseudocode Design Notes plan memang non-atomik.
  - F3 `src/lib/jwt.ts` — low · patch — terverifikasi: `getSigningKey` lazy; semua path verify catch-all → secret hilang = semua request "invalid"/500 opaq, bukan boot failure. Constraint frozen "fail-fast" tidak terpenuhi sebagaimana pola db.ts.
  - F4 `src/lib/jwt.ts` `verifyAccessTokenStatus` — low · patch — terverifikasi: cabang catch mengembalikan "expired" untuk JWTExpired apa pun tanpa cek `type==="access"`; refresh JWT kadaluarsa yang ditanam sebagai cookie access dipercaya proxy untuk menyajikan shell halaman. API data tetap ketat → dampak terbatas.
  - F5 `.gitignore:35` — low · patch — terverifikasi via `git check-ignore`: `.env*` tanpa negation menelan `.env.example`; deliverable plan tak ter-commit, checkout baru kehilangan dokumentasi env.

- Loop 2 (quick, pasca re-derivation): verdict counts — high 0 · medium 3 · low 0 · false 0 · maybe-false 0. Temuan loop-1 F1–F5 dipenuhi di kode baru (access cookie `Max-Age=604800` terkonfirmasi di header HTTP; rotasi atomik `UPDATE … WHERE revoked_at IS NULL RETURNING`; grace 30s teruji race paralel 200+200 tanpa family-revoke; replay backdated >30s → 401 + 4/4 revoked; `AUTH_SECRET` module-load; expired-path cek type; `!.env.example` bekerja). Tiga temuan baru:
  - F6 `src/lib/auth.ts` `rotateRefreshToken`/`loadUserById` — medium · bad_plan — terverifikasi: login menolak `status !== "Active"` dengan 403, tapi `loadUserById` tanpa filter status dan kedua jalur rotasi (winner & grace) memanggil `issueTokenPair` unconditional — user yang dinonaktifkan tetap mendapat access token 15 menit baru selamanya (window 7 hari ter-roll tiap rotasi); `revokeAllUserTokens` hanya dipanggil dari cabang reuse. Plan tak pernah menetapkan kebijakan status di rotasi.
  - F7 `src/lib/auth.ts` grace arithmetic — medium · bad_plan — terverifikasi: `revoked_at` ditulis jam Postgres (`now()` di UPDATE/SELECT) tapi diukur dengan `Date.now()` Node — dua host berbeda (app di mesini ini, DB remote pgsql.lenscan.dev). Skew >30s: loser sah dua-tab jatuh ke cabang replay → family-revoke (bug F2 yang persis mau dicegah) atau window serang efektif melebar. Pseudocode Design Notes plan memuat campuran dua jam yang sama.
  - F8 `src/lib/auth.ts` cabang grace vs `revokeRefreshToken` — medium · bad_plan — terverifikasi: logout juga menulis `revoked_at = now()`; replay token logout ≤30s masuk cabang grace → pair baru di-issue → sesi hidup kembali setelah logout eksplisit (termasuk attacker yang menyalin cookie refresh lalu replay pasca-logout korban). Constraint frozen "direvoke saat logout" digagalkan oleh desain grace yang hanya mempertimbangkan balapan rotasi.

- Loop 3 (quick, pasca re-derivation kedua): verdict counts — high 0 · medium 0 · low 3 · false 0 · maybe-false 0. Temuan loop-2 F6–F8 dipenuhi (login Inactive 403 + refresh 401 + 10/10 revoked; grace dihitung SQL `now() - revoked_at`; replay pasca-logout 401 dengan `revoked_reason='logout'`; race 200+200 tanpa family-revoke; replay rotated >30s 401 + 5/5 revoked; cabang proxy semua benar).
  - F9 `src/lib/auth.ts` claim UPDATE — low · patch — terverifikasi: `expires_at > now()` membandingkan kolom buatan jam Node dengan jam Postgres, melanggar bullet "satu jam" plan sendiri (pseudocode plan memuat `now()` yang sama — inkonsistensi internal plan; bullet normatifnya sudah benar). Dampak: pada skew, sesi putus prematur δ detik di ujung jendela 7 hari. Fix: bind `new Date(Date.now())` sebagai parameter PG, bukan `now()`.
  - F10 `src/lib/auth.ts` jalur loser — low · patch — terverifikasi: row expired-tak-pernah-revoked → `grace_eligible` NULL (SQL 3-valued) → jatuh ke cabang `refresh_revoked_token_replayed` reason "unknown" — event log menyesatkan untuk forensik reuse; tipe `grace_eligible: boolean` bohong (bisa null). HTTP 401 tetap benar. Fix: cabang eksplisit untuk expired/unknown + tipe `boolean | null`.
  - F11 `src/lib/jwt.ts` header — low · patch — terverifikasi: komentar menyebut mengimpor `./auth-constants` padahal hanya `jose` (dan tidak memerlukannya); baris Code Map plan ("dipakai proxy & jwt.ts") ikut keliru — koreksi sisi kode (komentar), Code Map dibiarkan sebagai catatan historis.

## Design Notes

- Refresh cookie path=`/api/auth` → browser hanya mengirim refresh ke endpoint auth (mengurangi exposure). Access cookie path=`/`, dan **`maxAge` access cookie = `REFRESH_TOKEN_TTL_SECONDS` (7 hari), BUKAN TTL access token**. Cookie harus meng-outlive JWT-nya: kalau `maxAge` == TTL token, browser meng-evict cookie tepat saat token expired, proxy tak pernah melihat access token expired-signed, dan user idle >15 menit di-kick ke /login padahal refresh masih valid (bug loop-1 F1). Masa hidup cookie ≠ masa hidup token — server selalu re-verifikasi `exp` via jose.
- Proxy tidak bisa import pg (edge) → hanya jose verify + keberadaan refresh cookie untuk keputusan routing; otorisasi data tetap di API layer (strict). Catatan: refresh cookie path-scoped `/api/auth` tak pernah sampai proxy di route halaman — jadi cabang "expired-but-signed access token" di `verifyAccessTokenStatus` adalah satu-satunya yang membuat baris matrix "access expired + refresh valid → halaman dimuat" bekerja di browser nyata (dan hanya bekerja karena cookie maxAge 7 hari di atas).
- `verifyAccessTokenStatus` cabang expired wajib mengonfirmasi `payload.type === "access"` sebelum mengembalikan "expired" — JWTExpired dari token type lain (mis. refresh JWT kadaluarsa yang ditanam sebagai cookie access) harus jatuh ke "invalid".
- `AUTH_SECRET` divalidasi **di module load** `jwt.ts` (throw saat import, mirror pola `DATABASE_URL` di db.ts) — bukan lazy di getSigningKey. Secret hilang = boot failure yang jelas, bukan 500/401 opaq per-request.
- bcryptjs dipilih atas bcrypt native: pure JS, tanpa node-gyp di ARM ini. Cost 10 (~100ms) — cukup untuk dashboard, latency login masih ringan.
- Payload access: `{sub, email, role, type:"access"}`; refresh: `{sub, jti, type:"refresh"}`. DB menyimpan `sha256(jti)` bukan token.
- **Rotasi refresh token HARUS atomik** (bug loop-1 F2): klaim + revoke dalam SATU statement — `UPDATE … WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now() RETURNING …`. affected-row-count menentukan jalur. `apiFetch` single-flight hanya per-tab; dua tab yang refresh bersamaan adalah race nyata yang harus ditangani, bukan diabaikan.
- **Asal revocation harus dibedakan** (bug loop-2 F8): kolom `refresh_tokens.revoked_reason` bernilai `'rotated'` (rotasi normal), `'logout'` (logout eksplisit), `'reuse'` (family revoke). Grace window HANYA untuk `revoked_reason='rotated'` — replay token yang di-revoke logout/reuse → 401 + clear cookies, TANPA pair baru dan TANPA family-revoke tambahan. Tanpa ini, logout bisa "dibatalkan" dalam 30 detik.
- **Satu jam per keputusan** (bug loop-2 F7): setiap timestamp dibandingkan pada jam yang menulisnya. `revoked_at` ditulis jam Postgres → selisih grace dihitung DI SQL (`now() - revoked_at <= interval '30 seconds'`), bukan `Date.now()` Node. `expires_at` ditulis clock Node (param INSERT dari `Date.now()+TTL`) → boleh dibanding `Date.now()` Node. Jangan pernah mencampur.
- **User non-Active diputus di rotasi** (bug loop-2 F6): kedua jalur rotasi (winner & grace) wajib cek `status !== 'Active'` → `revokeAllUserTokens` + 401 + clear cookies. Login sudah 403; tanpa cek ini deactivation tak pernah efektif karena rotasi terus meng-roll window 7 hari. Sisa akses ≤15 menit via access token yang masih valid di `getSessionUser` ditoleransi (paritas baseline — tanpa denylist token, access token yang sudah terbit tak bisa ditarik; dicatat sebagai keterbatuan).

```ts
// rotasi atomik + asal revocation + satu jam (lib/auth.ts)
const { payload } = await verifyRefreshJwt(token); // sub, jti, type:"refresh"
const hash = sha256(payload.jti);
// SATU statement: klaim & revoke atomik, catat alasannya. rowCount=1 → pemenang.
const claimed = await query(
  `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'rotated'
   WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
   RETURNING id, user_id, expires_at`, [hash]);
if (claimed.rowCount === 1) {
  const user = await loadUserById(payload.sub);
  if (!user || user.status !== "Active") { await revokeAllUserTokens(payload.sub); return fail; } // F6
  await issueTokenPair(user); return ok;
}
// Kalah klaim: tentukan nasib dari alasan revocation — selisih grace dihitung JAM PG (F7).
const row = (await query(
  `SELECT user_id, expires_at, revoked_reason,
          (revoked_reason = 'rotated' AND now() - revoked_at <= interval '30 seconds') AS grace_eligible
   FROM refresh_tokens WHERE token_hash = $1`, [hash])).rows[0];
if (!row) return fail;                                  // tak dikenal → 401 + clear
if (row.expires_at.getTime() <= Date.now()) return fail; // expired (jam Node — penulisnya Node) → 401 + clear
if (row.grace_eligible) {
  const user = await loadUserById(payload.sub);
  if (!user || user.status !== "Active") { await revokeAllUserTokens(row.user_id); return fail; } // F6
  log warning; await issueTokenPair(user); return ok;   // loser konkuren: pair baru tanpa family-revoke
}
if (row.revoked_reason === 'rotated') { revokeAllUserTokens(row.user_id); return fail; } // rotated >30s = reuse lama → AC frozen
return fail;                                            // replay token 'logout'/'reuse' → 401 + clear, tanpa grace (F8)
```
- `GRACE_WINDOW_MS` = 30 detik (di SQL sebagai `interval '30 seconds'`) — cukup untuk dua tab yang refresh hampir bersamaan, terlalu pendek untuk penyerang yang mereplay token lama. Logout dan family-revoke TIDAK pernah masuk grace.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 error
- `npx eslint src/lib src/app/api src/proxy.ts scripts/seed-users.mjs --ext .ts,.mjs` -- expected: 0 error pada file yang diubah
- `node scripts/seed-users.mjs` -- expected: 3 akun ter-seed (idempotent)
- E2E curl (port dev server): register 201 → login 200 + 2 cookie (`Set-Cookie` onyx_access `Max-Age=604800`, onyx_refresh `Max-Age=604800; Path=/api/auth`) → /api/users 200 → hapus cookie access → /api/users 401 → POST /api/auth/refresh 200 + jti baru → /api/users 200 → **replay token refresh LAMA segera** (cookie jar sebelum rotasi) → 200 + pair baru (jalur grace ≤30s — concurrency dua tab, TANPA family revoke; verifikasi via log warning) → **backdate** `UPDATE refresh_tokens SET revoked_at = now() - interval '60 seconds' WHERE token_hash = <sha256 jti lama>` → replay lagi → 401 + semua refresh token user itu revoked (AC frozen reuse-detection, jalur >30s) → logout → cookies hilang
- Proxy expired-branch: mint access JWT `exp` di masa lalu via node satu-liner (jose + AUTH_SECRET dari .env.local), tanam sebagai cookie onyx_access, GET / → 200 halaman (bukan 307 ke /login) — inilah baris matrix "access expired + refresh valid"; GET /api/users dengan cookie yang sama → 401 (API layer tetap ketat)
- Race dua refresh paralel: dua POST /api/auth/refresh bersamaan dengan cookie jar sama → salah satu 200 rotasi normal, yang lain 200 jalur grace (atau 401 bila antre di belakang rotasi selesai >grace — yang penting BUKAN family revoke; cek DB: refresh_tokens user itu tidak semua revoked)
- Logout tak bisa dihidupkan lagi (bug loop-2 F8): login → simpan nilai cookie refresh → logout → replay cookie itu SEGERA (≤30s) → harus 401 + clear cookies, BUKAN 200 grace; DB: baris tetap `revoked_reason='logout'`, tak ada token baru untuk user itu
- User non-Active diputus (bug loop-2 F6): `UPDATE users SET status='Inactive'` untuk akun uji → POST /api/auth/refresh dengan token live-nya → 401 + SEMUA token user itu revoked; `UPDATE … status='Active'` kembali setelah uji
- Satu jam (bug loop-2 F7): inspeksi kode — perbandingan grace ada di SQL (`now() - revoked_at <= interval '30 seconds'`), tidak ada `Date.now() - revoked_at` Node untuk revoked_at; expires_at dibanding Node (penulisnya Node)
- `npm run build` -- expected: sukses, proxy terdaftar
- Login via UI di https://vesper.tailf6c5fc.ts.net:3011 (admin@onyx.dev/password123) → dashboard terbuka, users list dari DB, add user works
