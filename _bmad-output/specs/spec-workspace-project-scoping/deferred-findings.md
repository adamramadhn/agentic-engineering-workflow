# deferred-findings.md — Temuan di luar scope, untuk diperbaiki setelah spec ini selesai

Berkas ini menampung temuan nyata yang **bukan** milik story mana pun di `stories.yaml`. Setiap entri punya bukti dan cara verifikasinya, supaya bisa dikerjakan di sesi terpisah tanpa menggali ulang.

## D-1 — `ensureSchema()` tidak punya lock bootstrap global (race multi-instance)

**Bukti:** diuji dengan 8 boot bersamaan terhadap satu database. HEAD tanpa perubahan story 1 gagal **5 dari 8** boot; dengan `pg_advisory_xact_lock` di v7 turun menjadi 1 dari 8.

**Akar masalah:** blok v2 menjalankan `ALTER TABLE refresh_tokens ... ADD COLUMN IF NOT EXISTS`, yang mengambil `AccessExclusiveLock` sebelum kode v7 mana pun berjalan. Blok DDL multi-statement lain juga berlomba di `pg_type`. Lock per-blok (seperti v7 punya) tidak cukup — yang dibutuhkan satu lock di seluruh `ensureSchema()`.

**Dampak:** deployment dengan lebih dari satu instance/replica dapat gagal boot secara acak. Untuk satu instance (kondisi sekarang) tidak berdampak.

**Cara menutup:** bungkus seluruh `ensureSchema()` dalam satu transaksi yang diawali `pg_advisory_xact_lock` dengan kunci tetap, atau pisahkan bootstrap ke proses migrasi terpisah yang dijalankan sekali sebelum instance naik.

## D-2 — Empat tool MCP memanggil route backlog yang tidak ada

**Bukti:** `internal/client/api_client.go` di repo `bmad-monitor-mcp` memanggil `/api/projects/{id}/backlogs`, `/backlogs/{id}/impact`, dan `/backlogs/{id}/promote`. Tidak ada satu pun route tersebut di `src/app/api/`. Tabel `bmad_backlogs` dibuat di `src/lib/db.ts` tetapi tidak pernah dibaca atau ditulis oleh kode TypeScript mana pun.

**Dampak:** `awm_backlog_create`, `awm_backlog_list`, `awm_backlog_report_impact`, dan `awm_backlog_promote` akan 404 pada pemakaian pertama.

**Cara menutup:** bangun tiga route backlog (list/create, impact, promote) dengan guard `guardBmadApi` dan scoping `projectId`, mengikuti pola route `tasks/`.

## D-3 — Tidak ada test otomatis yang menyentuh tabel BMad

**Bukti:** `vitest.config.mts` hanya menyertakan `src/**/*.test.{ts,tsx}` (dua berkas, keduanya tanpa `@/lib/db`). Grep `tests/` dan `e2e/` untuk `bmad_tasks`, `tasks/batch`, `prj_default`, `getBMadTasks` tidak menemukan apa pun.

**Dampak:** semua jaminan story 1 (composite key, cascade, idempoten, penolakan duplikat) hanya diverifikasi secara manual. Regresi tidak akan tertangkap `npm run verify`.

**Cara menutup:** tambahkan spec ke `tests/matrix/` (harness sudah menyediakan scratch DB dan `getPool()`): dua project dengan `TASK-101` masing-masing, delete task memverifikasi cascade, dua bentuk remote ditolak unique index, dan pembacaan `pg_constraint` untuk memastikan bentuk PK/FK.
