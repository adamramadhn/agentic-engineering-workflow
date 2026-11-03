#!/usr/bin/env bash
# Add mistral-termul.mocci.web.id to the server's named Cloudflare tunnel.
# Requires CF_API_TOKEN with Cloudflare Tunnel Edit permission.
set -euo pipefail

ACCOUNT_ID="3566dd938031a88267a6c771c94c5dc9"
TUNNEL_ID="cf0dc0b3-07d8-4673-b7fc-ee50e653a84e"
HOSTNAME="mistral-termul.mocci.web.id"
SERVICE="http://127.0.0.1:3010"
API="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations"

if [[ -z "${CF_API_TOKEN:-}" && -f /root/.secrets/cloudflare.ini ]]; then
  CF_API_TOKEN=$(grep -oP 'dns_cloudflare_api_token\s*=\s*\K.*' /root/.secrets/cloudflare.ini | tr -d '\r\n')
fi

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "Set CF_API_TOKEN or place token in /root/.secrets/cloudflare.ini" >&2
  exit 1
fi

ZONE_ID="29baf5baa9587ee144b36ab21a0c0f8b"

current=$(curl -fsS \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "${API}")

ingress=$(echo "$current" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('success'):
    print(json.dumps(data), file=sys.stderr)
    sys.exit(1)
ingress = data['result']['config']['ingress']
print(json.dumps(ingress))
")

updated=$(echo "$ingress" | python3 -c "
import json, sys
hostname = sys.argv[1]
service = sys.argv[2]
ingress = json.load(sys.stdin)
ingress = [r for r in ingress if r.get('service') != 'http_status:404']
if any(r.get('hostname') == hostname for r in ingress):
    print(json.dumps(ingress))
    sys.exit(0)
ingress.append({'hostname': hostname, 'service': service})
ingress.append({'service': 'http_status:404'})
print(json.dumps(ingress))
" "$HOSTNAME" "$SERVICE")

if [[ "$ingress" == "$updated" ]]; then
  echo "Ingress for ${HOSTNAME} already points to ${SERVICE}."
  exit 0
fi

payload=$(python3 -c "import json,sys; print(json.dumps({'config': {'ingress': json.loads(sys.argv[1])}}))" "$updated")

curl -fsS -X PUT \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  "${API}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('success'):
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print('Tunnel ingress updated.')
"

existing=$(curl -fsS \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${HOSTNAME}")

count=$(echo "$existing" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))")

if [[ "$count" == "0" ]]; then
  curl -fsS -X POST \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"mistral-termul\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}" \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('success'):
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print('DNS CNAME created.')
"
else
  echo "DNS record already exists."
fi

echo "Public URL: https://${HOSTNAME}"
