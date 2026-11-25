#!/bin/bash
# End-to-end API checks for Institution OS phases 2-3: LMS, fees, PayHere notifications,
# AI knowledge, B2B proposals and module licensing. Run against a server on a freshly
# seeded DEV database, started with SETTINGS_ENCRYPTION_KEY set and no ANTHROPIC_API_KEY:
#   pnpm db:seed && API=http://localhost:3000/api/v1 scripts/smoke-p23.sh
# Written for macOS's bash 3.2: JSON bodies with variables are built in $D first.
B=${API:-http://localhost:3000/api/v1}; ORIGIN=${B%/api/v1}; J=$(mktemp -d); pass=0; fail=0
RUN=$RANDOM$RANDOM; IP="10.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"
req() { local jar=$1 m=$2 p=$3 d=$4; local args=(-s -c "$J/$jar" -b "$J/$jar" -X "$m" "$B$p" -H 'content-type: application/json' -H "origin: $ORIGIN" -H "x-real-ip: $IP" -w '\n%{http_code}'); [ -n "$d" ] && args+=(--data-raw "$d"); curl "${args[@]}"; }
check() { local name=$1 want=$2 out=$3; local code=$(echo "$out" | tail -1); if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  ok   $name ($code)"; else fail=$((fail+1)); echo "  FAIL $name: want $want got $code :: $(echo "$out" | head -1 | cut -c1-220)"; fi; }
truthy() { if [ "$2" = "True" ] || [ "$2" = "true" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1 ($2)"; fi; }
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }
login() { D="{\"email\":\"$2\",\"password\":\"studentpass\"}"; req $1 POST /auth/login "$D" >/dev/null; }
md5u() { printf '%s' "$1" | md5 -q 2>/dev/null | tr a-f A-F || printf '%s' "$1" | md5sum | cut -d' ' -f1 | tr a-f A-F; }

login admin.jar admin@studentpass.example; login reg.jar registrar@inspire-college.example; login lec.jar lecturer@inspire-college.example
login ras.jar rashmi@inspire-college.example; login stu.jar nethmi@example.com; login kas.jar kasun@example.com

echo "LMS"
CS=$(req reg.jar GET /institution | head -1 | jget "[c['id'] for c in d['courses'] if c['code']=='CS101'][0]")
o=$(req lec.jar GET /institution/courses/$CS/content); check "lecturer reads content" 200 "$o"; echo "    $(echo "$o" | head -1 | jget "[(m['title'], len(m['lessons'])) for m in d['modules']]")"
check "counsellor can't edit content" 403 "$(req ras.jar POST /institution/courses/$CS/content '{"title":"Week 9"}')"
o=$(req lec.jar POST /institution/courses/$CS/content '{"title":"Week 3 · Functions"}'); check "add module" 201 "$o"; MOD=$(echo "$o" | head -1 | jget "d['id']")
check "lesson needs http(s) link" 400 "$(req lec.jar POST /institution/modules/$MOD/lessons '{"title":"Bad link","url":"javascript:alert(1)"}')"
o=$(req lec.jar POST /institution/modules/$MOD/lessons '{"title":"Writing functions","body":"Parameters and return values.","url":"https://example.com/fn"}'); check "add lesson" 201 "$o"; LES=$(echo "$o" | head -1 | jget "d['id']")
o=$(req stu.jar GET /campus/courses/$CS); check "student opens course" 200 "$o"; echo "    lessons $(echo "$o" | head -1 | jget "sum(len(m['lessons']) for m in d['modules'])") · attendance $(echo "$o" | head -1 | jget "d['attendance']['pct']")%"
check "complete lesson" 200 "$(req stu.jar POST /campus/lessons/$LES/complete)"
check "student from another institution can't" 404 "$(req kas.jar POST /campus/lessons/$LES/complete)"
check "can't open a course you're not in" 404 "$(req kas.jar GET /campus/courses/$CS)"
check "unpublish lesson" 200 "$(req lec.jar PATCH /institution/lessons/$LES '{"published":false}')"
check "unpublished lesson can't be completed" 404 "$(req stu.jar POST /campus/lessons/$LES/complete)"
o=$(req lec.jar GET /institution/courses/$CS/attendance); check "attendance overview" 200 "$o"; NST=$(echo "$o" | head -1 | jget "d['learners'][0]['id']")
echo "    $(echo "$o" | head -1 | jget "[(l['name'], l['attendance'], l['progress'], l['atRisk']) for l in d['learners']]")"
D="{\"date\":\"2026-12-01\",\"title\":\"Lab $RUN\",\"records\":[{\"studentId\":\"$NST\",\"status\":\"ABSENT\"}]}"
o=$(req lec.jar POST /institution/courses/$CS/attendance "$D"); check "take attendance" 201 "$o"; SES=$(echo "$o" | head -1 | jget "d['id']")
D="{\"date\":\"2026-12-01\",\"records\":[{\"studentId\":\"not-enrolled\",\"status\":\"PRESENT\"}]}"; check "can't mark non-enrolled student" 400 "$(req lec.jar POST /institution/courses/$CS/attendance "$D")"
D="{\"records\":[{\"studentId\":\"$NST\",\"status\":\"EXCUSED\"}]}"; check "correct a session" 200 "$(req lec.jar PUT /institution/attendance/$SES "$D")"
check "delete module" 200 "$(req lec.jar DELETE /institution/modules/$MOD)"
o=$(req stu.jar GET /campus/courses/$CS); A2=$(echo "$o" | head -1 | jget "[a['id'] for a in d['assignments'] if not a['grade']][0]"); A1=$(echo "$o" | head -1 | jget "[a['id'] for a in d['assignments'] if a['grade']][0]")
check "submission needs content" 400 "$(req stu.jar PUT /campus/assignments/$A2/submission '{"text":""}')"
check "submit work" 200 "$(req stu.jar PUT /campus/assignments/$A2/submission '{"text":"My project","link":"https://github.example/p"}')"
check "graded work is locked" 409 "$(req stu.jar PUT /campus/assignments/$A1/submission '{"text":"change"}')"
o=$(req lec.jar GET /institution/assignments/$A2/grades); truthy "lecturer sees submission in gradebook" "$(echo "$o" | head -1 | jget "d['students'][0]['submission'] is not None")"

echo "Fees"
check "lecturer can't see fees" 403 "$(req lec.jar GET /institution/invoices)"
o=$(req reg.jar GET /institution/invoices); check "admin lists invoices" 200 "$o"; echo "    $(echo "$o" | head -1 | jget "d['summary']")"
D="{\"studentNumbers\":[\"IC-2026-0142\",\"220481K\"],\"item\":\"Exam fee $RUN\",\"amountCents\":250000,\"dueDate\":\"2026-12-20\"}"
o=$(req reg.jar POST /institution/invoices "$D"); check "bill by student number" 201 "$o"; echo "    $(echo "$o" | head -1)  (UoM number must be notFound)"
o=$(req reg.jar GET "/institution/invoices?q=Exam%20fee%20$RUN"); INV=$(echo "$o" | head -1 | jget "d['invoices'][0]['id']"); INVNO=$(echo "$o" | head -1 | jget "d['invoices'][0]['number']")
check "record bank transfer" 201 "$(req reg.jar POST /institution/invoices/$INV/payments '{"method":"BANK_TRANSFER","reference":"BOC-1"}')"
check "can't pay twice" 409 "$(req reg.jar POST /institution/invoices/$INV/payments '{"method":"CASH"}')"
check "can't void a paid invoice" 409 "$(req reg.jar POST /institution/invoices/$INV/void)"
o=$(req stu.jar GET /campus/fees); check "student sees fees" 200 "$o"; echo "    $(echo "$o" | head -1 | jget "[(i['number'], i['display']) for i in d['invoices']]") payOnline=$(echo "$o" | head -1 | jget "d['payOnline']")"
DUE=$(echo "$o" | head -1 | jget "[i['id'] for i in d['invoices'] if i['status']=='DUE'][0]")
check "checkout refused without a gateway" 409 "$(req stu.jar POST /campus/invoices/$DUE/checkout '{"phone":"0771234567"}')"

echo "PayHere"
SECRET="TestSecret$RUN"; MID="1211149"
check "lecturer can't change gateway" 403 "$(req lec.jar PATCH /institution/payments '{"merchantId":"1211149"}')"
check "merchant id must be digits" 400 "$(req reg.jar PATCH /institution/payments '{"merchantId":"abc"}')"
D="{\"merchantId\":\"$MID\",\"secret\":\"$SECRET\",\"sandbox\":true}"; check "save gateway settings" 200 "$(req reg.jar PATCH /institution/payments "$D")"
o=$(req reg.jar GET /institution/payments); truthy "secret stored but never returned" "$(echo "$o" | head -1 | jget "d['hasSecret'] and 'secret' not in d")"
check "checkout needs a phone" 400 "$(req stu.jar POST /campus/invoices/$DUE/checkout '{"phone":"x"}')"
o=$(req stu.jar POST /campus/invoices/$DUE/checkout '{"phone":"0771234567"}'); check "start checkout" 200 "$o"
F=$(echo "$o" | head -1); ORD=$(echo "$F" | jget "d['fields']['order_id']"); AMT=$(echo "$F" | jget "d['fields']['amount']"); HASH=$(echo "$F" | jget "d['fields']['hash']")
EXP=$(md5u "$MID$ORD${AMT}LKR$(md5u "$SECRET")"); [ "$HASH" = "$EXP" ] && { pass=$((pass+1)); echo "  ok   checkout hash matches PayHere formula ($(echo "$F" | jget "d['action']"))"; } || { fail=$((fail+1)); echo "  FAIL hash $HASH != $EXP"; }
notify() { local status=$1 amount=$2 secret=$3; local sig=$(md5u "$MID$ORD${amount}LKR$status$(md5u "$secret")"); curl -s -X POST "$B/payments/payhere/notify" -H 'content-type: application/x-www-form-urlencoded' --data-urlencode "merchant_id=$MID" --data-urlencode "order_id=$ORD" --data-urlencode "payment_id=320027150501" --data-urlencode "payhere_amount=$amount" --data-urlencode "payhere_currency=LKR" --data-urlencode "status_code=$status" --data-urlencode "md5sig=$sig" -w '\n%{http_code}'; }
check "forged signature rejected" 400 "$(notify 2 "$AMT" WrongSecret)"
check "tampered amount rejected" 400 "$(notify 2 1.00 "$SECRET")"
[ "$(req stu.jar GET /campus/fees | head -1 | jget "[i['status'] for i in d['invoices'] if i['id']=='$DUE'][0]")" = "DUE" ] && { pass=$((pass+1)); echo "  ok   invoice still DUE after bad notifications"; } || { fail=$((fail+1)); echo "  FAIL invoice changed by a bad notification"; }
check "signed success notification" 200 "$(notify 2 "$AMT" "$SECRET")"
check "replayed notification is harmless" 200 "$(notify 2 "$AMT" "$SECRET")"
[ "$(req stu.jar GET /campus/fees | head -1 | jget "[i['status'] for i in d['invoices'] if i['id']=='$DUE'][0]")" = "PAID" ] && { pass=$((pass+1)); echo "  ok   invoice PAID by gateway"; } || { fail=$((fail+1)); echo "  FAIL invoice not PAID"; }
check "chargeback notification" 200 "$(notify -3 "$AMT" "$SECRET")"
[ "$(req stu.jar GET /campus/fees | head -1 | jget "[i['status'] for i in d['invoices'] if i['id']=='$DUE'][0]")" = "DUE" ] && { pass=$((pass+1)); echo "  ok   chargeback reopens the invoice"; } || { fail=$((fail+1)); echo "  FAIL chargeback didn't reopen"; }
check "unknown order rejected" 400 "$(curl -s -X POST "$B/payments/payhere/notify" -d 'merchant_id=1&order_id=nope&status_code=2' -w '\n%{http_code}')"

echo "AI assistant"
check "counsellor reads knowledge" 200 "$(req ras.jar GET /institution/knowledge)"
check "counsellor can't edit knowledge" 403 "$(req ras.jar POST /institution/knowledge '{"title":"x y","body":"zz"}')"
o=$(req reg.jar POST /institution/knowledge '{"title":"Library hours","body":"Open 8am to 10pm on weekdays.","source":"Library policy"}'); check "add knowledge" 201 "$o"; KB=$(echo "$o" | head -1 | jget "d['id']")
check "withdraw knowledge" 200 "$(req reg.jar PATCH /institution/knowledge/$KB '{"approved":false}')"
o=$(req reg.jar GET /institution/knowledge); echo "    configured=$(echo "$o" | head -1 | jget "d['configured']") entries=$(echo "$o" | head -1 | jget "len(d['entries'])")"
check "public chat without API key is a clean 503" 503 "$(req anon.jar POST /public/institutions/ic/chat '{"message":"When is the next intake?"}')"
check "student chat without API key is a clean 503" 503 "$(req stu.jar POST /campus/chat '{"message":"What do I owe?"}')"
check "lecturer has no AI section" 403 "$(req lec.jar GET /institution/knowledge)"

echo "B2B services and licensing"
check "institution admin requests proposal" 201 "$(req reg.jar POST /institution/proposals '{"items":["lms","train"],"studentsBand":"500–2,000","notes":"Pilot"}')"
check "unknown service refused" 400 "$(req reg.jar POST /institution/proposals '{"items":["free-money"]}')"
check "public proposal" 201 "$(req anon.jar POST /public/proposals '{"institutionName":"Test Campus","contactName":"Ann Test","email":"ann@test.example","items":["crm"]}')"
check "public proposal honeypot" 400 "$(req anon.jar POST /public/proposals '{"institutionName":"Bot","contactName":"Bot B","email":"b@b.example","items":["crm"],"website":"x"}')"
o=$(req admin.jar GET /admin/proposals); check "platform admin sees proposals" 200 "$o"; PR=$(echo "$o" | head -1 | jget "d['requests'][0]['id']")
check "mark proposal contacted" 200 "$(req admin.jar PATCH /admin/proposals/$PR '{"status":"CONTACTED"}')"
check "institution admin can't see all proposals" 403 "$(req reg.jar GET /admin/proposals)"
IC=$(req admin.jar GET /admin/institutions | head -1 | jget "[i['id'] for i in d['institutions'] if i['shortName']=='IC'][0]")
check "switch CRM off for IC" 200 "$(req admin.jar PUT /admin/institutions/$IC/modules '{"modules":["admissions","analytics","market","lms","fees","ai","payments"]}')"
check "CRM now refused" 403 "$(req ras.jar GET /institution/leads)"
check "admissions still works" 200 "$(req ras.jar GET /institution/applications)"
check "unknown module refused" 400 "$(req admin.jar PUT /admin/institutions/$IC/modules '{"modules":["teleport"]}')"
check "switch everything back on" 200 "$(req admin.jar PUT /admin/institutions/$IC/modules '{"modules":["crm","admissions","analytics","market","lms","fees","ai","payments"]}')"
check "CRM back" 200 "$(req ras.jar GET /institution/leads)"
echo "RESULT: $pass passed, $fail failed"; [ "$fail" = 0 ]
