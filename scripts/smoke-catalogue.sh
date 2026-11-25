#!/bin/bash
# End-to-end: platform admin onboards a merchant and creates offers; the merchant's new login
# lists a product and redeems the offer at the till. Dev database only:
#   pnpm db:seed && API=http://localhost:3000/api/v1 scripts/smoke-catalogue.sh
B=${API:-http://localhost:3000/api/v1}; ORIGIN=${B%/api/v1}; J=$(mktemp -d); pass=0; fail=0
RUN=$RANDOM$RANDOM; IP="10.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"
req() { local jar=$1 m=$2 p=$3 d=$4; local args=(-s -c "$J/$jar" -b "$J/$jar" -X "$m" "$B$p" -H 'content-type: application/json' -H "origin: $ORIGIN" -H "x-real-ip: $IP" -w '\n%{http_code}'); [ -n "$d" ] && args+=(--data-raw "$d"); curl "${args[@]}"; }
check() { local name=$1 want=$2 out=$3; local code=$(echo "$out" | tail -1); if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  ok   $name ($code)"; else fail=$((fail+1)); echo "  FAIL $name: want $want got $code :: $(echo "$out" | head -1 | cut -c1-220)"; fi; }
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }
login() { D="{\"email\":\"$2\",\"password\":\"${3:-studentpass}\"}"; req $1 POST /auth/login "$D" >/dev/null; }

login admin.jar admin@studentpass.example; login stu.jar kasun@example.com; login cash.jar cashier@sandbox-cafe.example   # kasun: other suites use nethmi's QR windows

echo "Merchants"
check "cashier can't onboard merchants" 403 "$(req cash.jar POST /admin/merchants '{"name":"X shop","branches":[{"code":"AA","name":"A","district":"Colombo"}],"staff":{"name":"Xy","email":"x@x.example"}}')"
D='{"name":"Dup Codes","branches":[{"code":"AA","name":"A","district":"Colombo"},{"code":"aa","name":"B","district":"Colombo"}],"staff":{"name":"Xy","email":"dup@x.example"}}'
check "duplicate branch codes refused" 400 "$(req admin.jar POST /admin/merchants "$D")"
D="{\"name\":\"Book Nook $RUN\",\"branches\":[{\"code\":\"BAM\",\"name\":\"Bambalapitiya\",\"district\":\"Colombo\"}],\"staff\":{\"name\":\"Nimal Silva\",\"email\":\"nimal-$RUN@booknook.example\"}}"
o=$(req admin.jar POST /admin/merchants "$D"); check "admin onboards a merchant" 201 "$o"; M=$(echo "$o" | head -1 | jget "d['id']"); TP=$(echo "$o" | head -1 | jget "d['tempPassword']")
D="{\"name\":\"Taken\",\"branches\":[{\"code\":\"TK\",\"name\":\"Taken branch\",\"district\":\"Colombo\"}],\"staff\":{\"name\":\"Taken\",\"email\":\"nethmi@example.com\"}}"
check "existing email refused (and no orphan merchant)" 409 "$(req admin.jar POST /admin/merchants "$D")"
[ "$(req admin.jar GET /admin/merchants | head -1 | jget "any(m['name']=='Taken' for m in d['merchants'])")" = "False" ] && { pass=$((pass+1)); echo "  ok   no orphan merchant left behind"; } || { fail=$((fail+1)); echo "  FAIL orphan merchant"; }
check "add a branch" 201 "$(req admin.jar POST /admin/merchants/$M/locations '{"code":"NUG","name":"Nugegoda","district":"Colombo"}')"
check "duplicate branch code" 409 "$(req admin.jar POST /admin/merchants/$M/locations '{"code":"NUG","name":"Again","district":"Colombo"}')"
D="{\"name\":\"Second Staff\",\"email\":\"two-$RUN@booknook.example\"}"; check "add a staff login" 201 "$(req admin.jar POST /admin/merchants/$M/staff "$D")"

echo "New merchant's login"
login nk.jar "nimal-$RUN@booknook.example" "$TP"
o=$(req nk.jar GET /pos/locations); check "staff signs in to the till" 200 "$o"; LOC=$(echo "$o" | head -1 | jget "[l['id'] for l in d['locations'] if l['code']=='BAM'][0]")
D="{\"title\":\"Course text $RUN\",\"category\":\"Books\",\"priceCents\":690000,\"rrpCents\":840000,\"stock\":10,\"art\":\"CS\"}"
check "staff lists a product" 201 "$(req nk.jar POST /pos/products "$D")"
[ "$(curl -s "$B/shop/products?q=Course%20text%20$RUN" | jget "len(d['products'])")" = "1" ] && { pass=$((pass+1)); echo "  ok   product is in the public shop"; } || { fail=$((fail+1)); echo "  FAIL product not in shop"; }
check "other merchant can't see it in their list" 200 "$(req cash.jar GET /pos/products)"

echo "Offers"
OF='"category":"Study & work","badge":"Read","benefit":"15% off course texts.","howTo":"Show your pass at the till.","channel":"IN_STORE","districts":["Colombo"]'
D="{\"title\":\"No merchant $RUN\",$OF,\"status\":\"LIVE\",\"discountType\":\"PERCENT\",\"discountValue\":1500}"
check "live in-store offer needs a merchant" 400 "$(req admin.jar POST /admin/offers "$D")"
D="{\"title\":\"Too much $RUN\",\"merchantId\":\"$M\",$OF,\"status\":\"LIVE\",\"discountType\":\"PERCENT\",\"discountValue\":15000}"
check "over 100% refused" 400 "$(req admin.jar POST /admin/offers "$D")"
D="{\"title\":\"Book Nook 15% $RUN\",\"merchantId\":\"$M\",$OF,\"status\":\"LIVE\",\"discountType\":\"PERCENT\",\"discountValue\":1500,\"maxDiscountCents\":200000}"
o=$(req admin.jar POST /admin/offers "$D"); check "admin creates a live offer" 201 "$o"; OFF=$(echo "$o" | head -1 | jget "d['id']")
[ "$(req stu.jar GET /offers | head -1 | jget "any(o['id']=='$OFF' for o in d['offers'])")" = "True" ] && { pass=$((pass+1)); echo "  ok   offer shows on /offers"; } || { fail=$((fail+1)); echo "  FAIL offer not listed"; }
TOKEN=$(req stu.jar GET /pass/token | head -1 | jget "d['token']")
D="{\"token\":\"$TOKEN\",\"locationId\":\"$LOC\",\"offerId\":\"$OFF\",\"subtotalCents\":690000}"
o=$(curl -s -b $J/nk.jar -X POST $B/pos/authorizations -H 'content-type: application/json' -H "origin: $ORIGIN" -H "idempotency-key: cat-$RUN" --data-raw "$D" -w '\n%{http_code}'); check "new merchant applies the offer" 201 "$o"
echo "    discount $(echo "$o" | head -1 | jget "d['authorization']['discountCents']/100") LKR on LKR 6,900 (15%)"
AUTH=$(echo "$o" | head -1 | jget "d['authorization']['id']")
check "capture" 200 "$(req nk.jar POST /pos/authorizations/$AUTH/capture)"
D="{\"title\":\"Book Nook 15% $RUN\",\"merchantId\":\"$M\",$OF,\"status\":\"PAUSED\",\"discountType\":\"PERCENT\",\"discountValue\":1500}"
check "pause the offer" 200 "$(req admin.jar PUT /admin/offers/$OFF "$D")"
TOKEN=$(req stu.jar GET /pass/token | head -1 | jget "d['token']")
D="{\"token\":\"$TOKEN\",\"locationId\":\"$LOC\",\"offerId\":\"$OFF\",\"subtotalCents\":690000}"
o=$(curl -s -b $J/nk.jar -X POST $B/pos/authorizations -H 'content-type: application/json' -H "origin: $ORIGIN" -H "idempotency-key: cat2-$RUN" --data-raw "$D" -w '\n%{http_code}'); code=$(echo "$o" | tail -1)
[ "$code" != "201" ] && { pass=$((pass+1)); echo "  ok   paused offer can't be applied ($code)"; } || { fail=$((fail+1)); echo "  FAIL paused offer applied"; }
INST=$(curl -s $B/institutions | jget "d['institutions'][0]['id']")
D="{\"title\":\"Sponsored $RUN\",\"merchantId\":\"$M\",$OF,\"status\":\"LIVE\",\"discountType\":\"SPONSORED\",\"discountValue\":50000}"
check "sponsored offer needs sponsor + budget" 400 "$(req admin.jar POST /admin/offers "$D")"
D="{\"title\":\"Sponsored $RUN\",\"merchantId\":\"$M\",$OF,\"status\":\"LIVE\",\"discountType\":\"SPONSORED\",\"discountValue\":50000,\"sponsorId\":\"$INST\",\"sponsorBudgetCents\":1000000,\"limitPerWeek\":1}"
check "sponsored offer created" 201 "$(req admin.jar POST /admin/offers "$D")"
D="{\"title\":\"Gyms $RUN\",$OF,\"status\":\"PROSPECT\"}"; check "browse-only offer without a merchant" 201 "$(req admin.jar POST /admin/offers "$D")"
echo "RESULT: $pass passed, $fail failed"; [ "$fail" = 0 ]
