#!/bin/bash
# End-to-end API checks: Student Shop (reserve → collect), Pass Points, family pay links,
# jobs & housing. Run against a server on a freshly seeded DEV database, started with
# SETTINGS_ENCRYPTION_KEY set:
#   pnpm db:seed && API=http://localhost:3000/api/v1 scripts/smoke-p4.sh
# Written for macOS's bash 3.2: JSON bodies with variables are built in $D first.
B=${API:-http://localhost:3000/api/v1}; ORIGIN=${B%/api/v1}; J=$(mktemp -d); pass=0; fail=0
RUN=$RANDOM$RANDOM; IP="10.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"
req() { local jar=$1 m=$2 p=$3 d=$4; local args=(-s -c "$J/$jar" -b "$J/$jar" -X "$m" "$B$p" -H 'content-type: application/json' -H "origin: $ORIGIN" -H "x-real-ip: $IP" -w '\n%{http_code}'); [ -n "$d" ] && args+=(--data-raw "$d"); curl "${args[@]}"; }
check() { local name=$1 want=$2 out=$3; local code=$(echo "$out" | tail -1); if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  ok   $name ($code)"; else fail=$((fail+1)); echo "  FAIL $name: want $want got $code :: $(echo "$out" | head -1 | cut -c1-220)"; fi; }
same() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1 ($2)"; else fail=$((fail+1)); echo "  FAIL $1: want $3 got $2"; fi; }
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }
login() { D="{\"email\":\"$2\",\"password\":\"studentpass\"}"; req $1 POST /auth/login "$D" >/dev/null; }
pts() { req stu.jar GET /rewards | head -1 | jget "d['balance']"; }

login stu.jar nethmi@example.com; login kas.jar kasun@example.com; login amy.jar amaya@example.com; login cash.jar cashier@sandbox-cafe.example
login admin.jar admin@studentpass.example; login reg.jar registrar@inspire-college.example; login lec.jar lecturer@inspire-college.example

echo "Pass Points"
o=$(req stu.jar GET /rewards); check "student sees points" 200 "$o"; P0=$(echo "$o" | head -1 | jget "d['balance']"); echo "    balance $P0 · tier $(echo "$o" | head -1 | jget "d['tier']['name']")"
check "pending student can't" 403 "$(req amy.jar GET /rewards)"
REW=$(echo "$o" | head -1 | jget "[r['id'] for r in d['rewards'] if r['cost']==300][0]")
o=$(req stu.jar POST /rewards/$REW/redeem); check "redeem a reward" 201 "$o"; echo "    code $(echo "$o" | head -1 | jget "d['code']")"
same "300 points spent" "$(pts)" "$((P0-300))"
D="{\"title\":\"Pricey $RUN\",\"cost\":999999}"; BIG=$(req admin.jar POST /admin/rewards "$D" | head -1 | jget "d['id']")
check "can't overspend" 409 "$(req stu.jar POST /rewards/$BIG/redeem)"
check "student can't create rewards" 403 "$(req stu.jar POST /admin/rewards '{"title":"Free","cost":1}')"
D="{\"title\":\"Last one $RUN\",\"cost\":1,\"stock\":1}"; ONE=$(req admin.jar POST /admin/rewards "$D" | head -1 | jget "d['id']")
# Two redeems at the same moment: exactly one may succeed.
( req stu.jar POST /rewards/$ONE/redeem | tail -1 > $J/r1 ) & ( req stu.jar POST /rewards/$ONE/redeem | tail -1 > $J/r2 ) & wait
same "two simultaneous redeems of the last one: one wins" "$( (cat $J/r1; echo; cat $J/r2; echo) | sort | tr '\n' ' ')" "201 409 "
check "retire reward" 200 "$(req admin.jar PATCH /admin/rewards/$BIG '{"active":false}')"

echo "Points from a till sale"
P1=$(pts)
TOKEN=$(req stu.jar GET /pass/token | head -1 | jget "d['token']")
LOC=$(req cash.jar GET /pos/locations | head -1 | jget "[l['id'] for l in d['locations'] if l['inProgramme']][0]")
OFF=$(req stu.jar GET /offers | head -1 | jget "[o['id'] for o in d['offers'] if o['status']=='LIVE' and 'Sandbox' in (o.get('merchant') or {}).get('name','') and o.get('sponsor') is None][0]")
D="{\"token\":\"$TOKEN\",\"locationId\":\"$LOC\",\"offerId\":\"$OFF\",\"subtotalCents\":200000}"
o=$(curl -s -b $J/cash.jar -X POST $B/pos/authorizations -H 'content-type: application/json' -H "origin: $ORIGIN" -H "idempotency-key: smoke-$RUN" --data-raw "$D" -w '\n%{http_code}'); check "hold discount" 201 "$o"; AUTH=$(echo "$o" | head -1 | jget "d['authorization']['id']")
o=$(req cash.jar POST /pos/authorizations/$AUTH/capture); check "capture sale" 200 "$o"; RED=$(echo "$o" | head -1 | jget "d['redemption']['id']")
check "capture again (idempotent)" 200 "$(req cash.jar POST /pos/authorizations/$AUTH/capture)"
same "+50 points once" "$(pts)" "$((P1+50))"
check "refund the sale" 200 "$(req cash.jar POST /pos/redemptions/$RED/void '{"reason":"Smoke test refund"}')"
same "refund reverses the points" "$(pts)" "$P1"

echo "Student Shop"
o=$(curl -s "$B/shop/products" -w '\n%{http_code}'); check "public catalogue" 200 "$o"
HOOD=$(echo "$o" | head -1 | jget "[p['id'] for p in d['products'] if 'hoodie' in p['title']][0]")
check "must be a verified student" 403 "$(req amy.jar POST /shop/products/$HOOD/reserve '{"quantity":1}')"
check "more than stock refused" 409 "$(req stu.jar POST /shop/products/$HOOD/reserve '{"quantity":3}')"
o=$(req stu.jar POST /shop/products/$HOOD/reserve '{"quantity":1}'); check "reserve" 201 "$o"; CODE=$(echo "$o" | head -1 | jget "d['code']"); R1=$(echo "$o" | head -1 | jget "d['id']")
o=$(req kas.jar POST /shop/products/$HOOD/reserve '{"quantity":1}'); check "last one reserved by someone else" 201 "$o"; R2=$(echo "$o" | head -1 | jget "d['id']")
check "sold out now" 409 "$(req stu.jar POST /shop/products/$HOOD/reserve '{"quantity":1}')"
check "cancel frees stock" 200 "$(req kas.jar POST /shop/reservations/$R2/cancel)"
check "cancel twice refused" 409 "$(req kas.jar POST /shop/reservations/$R2/cancel)"
check "can't cancel someone else's" 404 "$(req kas.jar POST /shop/reservations/$R1/cancel)"
o=$(req stu.jar GET /shop/reservations); same "student sees code" "$(echo "$o" | head -1 | jget "[r['code'] for r in d['reservations'] if r['id']=='$R1'][0]")" "$CODE"
P2=$(pts)
check "wrong code at the till" 404 "$(req cash.jar POST /pos/reservations/collect '{"code":"ZZZZZZZZ"}')"
D="{\"code\":\"$(echo $CODE | tr A-Z a-z)\"}"; o=$(req cash.jar POST /pos/reservations/collect "$D"); check "collect (code is case-insensitive)" 200 "$o"
check "collect twice refused" 409 "$(req cash.jar POST /pos/reservations/collect "$D")"
same "+59 points for LKR 5,900" "$(pts)" "$((P2+59))"
check "merchant lists products" 200 "$(req cash.jar GET /pos/products)"
D="{\"title\":\"Smoke notebook $RUN\",\"category\":\"Stationery & study\",\"priceCents\":50000,\"rrpCents\":40000}"; check "usual price must be ≥ student price" 400 "$(req cash.jar POST /pos/products "$D")"
D="{\"title\":\"Smoke notebook $RUN\",\"category\":\"Stationery & study\",\"priceCents\":50000,\"rrpCents\":70000,\"stock\":5,\"art\":\"NB\"}"; o=$(req cash.jar POST /pos/products "$D"); check "merchant adds product" 201 "$o"; NP=$(echo "$o" | head -1 | jget "d['id']")
check "hide product" 200 "$(req cash.jar PATCH /pos/products/$NP '{"active":false}')"
check "hidden product can't be reserved" 409 "$(req stu.jar POST /shop/products/$NP/reserve '{"quantity":1}')"
check "student can't manage products" 403 "$(req stu.jar POST /pos/products "$D")"
check "merchant reservations" 200 "$(req cash.jar GET /pos/reservations)"

echo "Family pay link"
INV=$(req stu.jar GET /campus/fees | head -1 | jget "[i['id'] for i in d['invoices'] if i['status']=='DUE'][0]")
o=$(req stu.jar POST /campus/invoices/$INV/share); check "share invoice" 200 "$o"; URL=$(echo "$o" | head -1 | jget "d['url']"); T=${URL##*/}
same "same link when shared again" "$(req stu.jar POST /campus/invoices/$INV/share | head -1 | jget "d['url']")" "$URL"
o=$(curl -s "$B/public/pay/$T" -w '\n%{http_code}'); check "parent opens link (no account)" 200 "$o"
echo "    $(echo "$o" | head -1 | jget "d['student'] + ' · ' + d['invoice']['item'] + ' · payOnline=' + str(d['payOnline'])")"
same "only the first name is shown" "$(echo "$o" | head -1 | jget "' ' in d['student']")" "False"
check "checkout needs a gateway" 409 "$(curl -s -X POST "$B/public/pay/$T/checkout" -H 'content-type: application/json' -H "origin: $ORIGIN" --data-raw '{"name":"Amma Perera","email":"amma@example.com","phone":"0771234567"}' -w '\n%{http_code}')"
SECRET="S$RUN"; D="{\"merchantId\":\"1211149\",\"secret\":\"$SECRET\",\"sandbox\":true}"; req reg.jar PATCH /institution/payments "$D" >/dev/null
o=$(curl -s -X POST "$B/public/pay/$T/checkout" -H 'content-type: application/json' -H "origin: $ORIGIN" --data-raw '{"name":"Amma Perera","email":"amma@example.com","phone":"0771234567"}' -w '\n%{http_code}'); check "parent starts PayHere checkout" 200 "$o"
check "someone else can't share your invoice" 404 "$(req kas.jar POST /campus/invoices/$INV/share)"
check "stop sharing" 200 "$(req stu.jar DELETE /campus/invoices/$INV/share)"
check "old link stops working" 404 "$(curl -s "$B/public/pay/$T" -w '\n%{http_code}')"

echo "Jobs & housing"
o=$(curl -s "$B/life/listings" -w '\n%{http_code}'); check "public listings" 200 "$o"; echo "    public: $(echo "$o" | head -1 | jget "[l['title'] for l in d['listings']]")"
o=$(req stu.jar GET /life/listings); echo "    Inspire College student: $(echo "$o" | head -1 | jget "[l['title'] for l in d['listings']]")"
o=$(req kas.jar GET /life/listings); same "UoM student doesn't see IC-only job" "$(echo "$o" | head -1 | jget "any('intern' in l['title'] for l in d['listings'])")" "False"
JOB=$(req stu.jar GET '/life/listings?kind=JOB' | head -1 | jget "[l['id'] for l in d['listings'] if 'barista' in l['title']][0]")
check "message too short" 400 "$(req stu.jar POST /life/listings/$JOB/respond '{"message":"hi"}')"
check "apply" 201 "$(req stu.jar POST /life/listings/$JOB/respond '{"message":"I can work weekends and evenings.","phone":"0771234567"}')"
check "apply twice refused" 409 "$(req stu.jar POST /life/listings/$JOB/respond '{"message":"I can work weekends and evenings."}')"
INTERN=$(req stu.jar GET '/life/listings?kind=JOB' | head -1 | jget "[l['id'] for l in d['listings'] if 'intern' in l['title']][0]")
check "UoM student can't apply to IC-only job" 404 "$(req kas.jar POST /life/listings/$INTERN/respond '{"message":"Please consider me for this."}')"
o=$(req admin.jar GET /listings); same "admin sees the application" "$(echo "$o" | head -1 | jget "sum(len(l['responses']) for l in d['listings']) >= 1")" "True"
check "lecturer can't post" 403 "$(req lec.jar POST /listings '{"kind":"JOB","title":"x job","organisation":"Org","description":"Some description here","district":"Colombo","pay":"LKR 1"}')"
D="{\"kind\":\"HOUSING\",\"title\":\"Hostel bed $RUN\",\"organisation\":\"IC hostel\",\"description\":\"Shared hostel for first years.\",\"district\":\"Colombo\",\"pay\":\"LKR 15,000 / month\",\"onlyMyStudents\":true}"
o=$(req reg.jar POST /listings "$D"); check "institution admin posts (own students only)" 201 "$o"; L=$(echo "$o" | head -1 | jget "d['id']")
same "UoM student can't see it" "$(req kas.jar GET /life/listings | head -1 | jget "any(l['id']=='$L' for l in d['listings'])")" "False"
check "cashier posts a job" 201 "$(req cash.jar POST /listings '{"kind":"JOB","title":"Weekend cashier","organisation":"Sandbox Café","description":"Saturday and Sunday shifts.","district":"Colombo","pay":"LKR 1,100 / hour"}')"
check "close listing" 200 "$(req reg.jar PATCH /listings/$L '{"open":false}')"
check "can't close someone else's" 404 "$(req cash.jar PATCH /listings/$L '{"open":true}')"
echo "RESULT: $pass passed, $fail failed"; [ "$fail" = 0 ]
