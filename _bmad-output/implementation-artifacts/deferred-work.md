# deferred-work.md — pekerjaan yang sengaja ditunda

- source_spec: `_bmad-output/specs/spec-bmad-hardening/stories/3-identitas-workspace-case-fold-dan-tolak-kredensial.md`
  summary: Repo bmad-monitor-mcp tidak punya satu pun unit test untuk logika urutan/migrasi peta workspace dan normalisasi identitas.
  evidence: `find . -name '*_test.go'` di /Users/adamramadhan/Projects/bmad-monitor-mcp mengembalikan nol berkas dan `go test ./...` melaporkan [no test files] untuk sembilan package; komparator migrasi peta yang terbalik dan parser urutan kunci lolos tanpa terdeteksi. Fungsi-fungsi ini murni string+file dan tidak butuh database, jadi test-nya murah.
