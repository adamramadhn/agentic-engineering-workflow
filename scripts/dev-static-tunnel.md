# Static dev URL (Cloudflare Tunnel)

Proyek ini memakai **named tunnel** di server (`cloudflared.service`), bukan quick tunnel `trycloudflare.com` yang URL-nya berubah setiap restart.

| Item | Value |
|------|--------|
| Public URL | https://mistral-termul.mocci.web.id |
| Local dev | http://127.0.0.1:3010 |
| Origin | `http://127.0.0.1:3010` on tunnel `cf0dc0b3-07d8-4673-b7fc-ee50e653a84e` |

## Run

```bash
npm run dev
```

Tunnel sudah jalan via systemd — tidak perlu `cloudflared tunnel --url …`.

```bash
sudo systemctl status cloudflared
```

## Setup ingress (sekali)

Jika hostname belum ada di tunnel:

```bash
sudo ./scripts/setup-static-tunnel.sh
```

Token diambil otomatis dari `/root/.secrets/cloudflare.ini` (sama seperti vesper).

Atau tambahkan manual di Cloudflare Zero Trust → Networks → Tunnels → Public Hostname:

- **Hostname:** `mistral-termul.mocci.web.id`
- **Service:** `http://127.0.0.1:3010`

## Notes

- Jangan pakai `dev:tunnel` / quick tunnel — URL-nya berubah tiap restart.
- Port lain di server: `vesper-termul` → 3001, `arusku-termul` → 3012.
