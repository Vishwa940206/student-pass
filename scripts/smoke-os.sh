#!/bin/bash
# End-to-end API checks for Institution OS (CRM, admissions, analytics, branding,
# public enquiries, rate limits). Run against a server on a freshly seeded DEV database:
#   pnpm db:seed && API=http://localhost:3000/api/v1 scripts/smoke-os.sh
# Written for macOS's bash 3.2: JSON bodies with variables are built in $D first.
B=${API:-http://localhost:3000/api/v1}; ORIGIN=${B%/api/v1}; J=$(mktemp -d); pass=0; fail=0
RUN=$RANDOM; IP="10.$((RUN % 250)).$((RANDOM % 250)).$((RANDOM % 250))"   # fresh rate-limit bucket per run
req() { local jar=$1 m=$2 p=$3 d=$4 ip=${5:-$IP}; local args=(-s -c "$J/$jar" -b "$J/$jar" -X "$m" "$B$p" -H 'content-type: application/json' -H "origin: $ORIGIN" -H "x-real-ip: $ip" -w '\n%{http_code}'); [ -n "$d" ] && args+=(--data-raw "$d"); curl "${args[@]}"; }
check() { local name=$1 want=$2 out=$3; local code=$(echo "$out" | tail -1); if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  ok   $name ($code)"; else fail=$((fail+1)); echo "  FAIL $name: want $want got $code :: $(echo "$out" | head -1 | cut -c1-220)"; fi; }
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }
login() { D="{\"email\":\"$2\",\"password\":\"${3:-studentpass}\"}"; req $1 POST /auth/login "$D" >/dev/null; }

login admin.jar admin@studentpass.example; login reg.jar registrar@inspire-college.example; login lec.jar lecturer@inspire-college.example
login ras.jar rashmi@inspire-college.example; login kev.jar kevin@inspire-college.example; login stu.jar nethmi@example.com

echo "Roles"
check "counsellor: brain" 200 "$(req ras.jar GET /institution/brain)"
check "counsellor: leads" 200 "$(req ras.jar GET /institution/leads)"
check "counsellor: analytics" 200 "$(req ras.jar GET /institution/analytics)"
check "counsellor: market" 200 "$(req ras.jar GET /institution/market)"
check "counsellor: can't post notices" 403 "$(req ras.jar POST /institution/announcements '{"title":"Hi there","body":"x"}')"
check "counsellor: can't create courses" 403 "$(req ras.jar POST /institution/courses '{"code":"ZZ1","name":"Nope"}')"
check "counsellor: can't create programmes" 403 "$(req ras.jar POST /institution/programmes '{"name":"Nope programme"}')"
check "lecturer: no CRM" 403 "$(req lec.jar GET /institution/leads)"
check "lecturer: no analytics" 403 "$(req lec.jar GET /institution/analytics)"
check "lecturer: brain" 200 "$(req lec.jar GET /institution/brain)"
check "student: no CRM" 403 "$(req stu.jar GET /institution/leads)"
o=$(req reg.jar GET /institution/brain); check "admin: brain" 200 "$o"
echo "    actions: $(echo "$o" | head -1 | jget "[a['id'] for a in d['actions']]")"

echo "Analytics"
o=$(req reg.jar GET /institution/analytics); check "admin: analytics" 200 "$o"
echo "$o" | head -1 | python3 -c "
import json,sys;d=json.load(sys.stdin);f=[x['count'] for x in d['funnel']]
assert all(a>=b for a,b in zip(f,f[1:])), f; assert len(d['weekly'])==12
print('    funnel',f,'| weeks',len(d['weekly']),'| sources',len(d['sources']),'| counsellors',[c['name'] for c in d['counsellors']])"
o=$(req reg.jar GET /institution/market); check "admin: market" 200 "$o"
echo "    demand: $(echo "$o" | head -1 | jget "[(x['name'][:18],x['count']) for x in d['demand']]")"

echo "Programmes"
o=$(req reg.jar GET /institution/programmes); PROG=$(echo "$o" | head -1 | jget "d['programmes'][0]['id']")
D="{\"name\":\"Smoke Programme $RUN\",\"intakes\":[\"Jan 2027\"]}"; o=$(req reg.jar POST /institution/programmes "$D"); check "admin creates programme" 201 "$o"; NEWP=$(echo "$o" | head -1 | jget "d['id']")
check "duplicate programme" 409 "$(req reg.jar POST /institution/programmes "$D")"
check "close programme" 200 "$(req reg.jar PATCH /institution/programmes/$NEWP '{"open":false}')"
check "can't delete programme with applications" 409 "$(req reg.jar DELETE /institution/programmes/$PROG)"

echo "CRM flow"
check "lead needs phone or email" 400 "$(req ras.jar POST /institution/leads '{"name":"No Contact","source":"WALK_IN"}')"
D="{\"name\":\"Smoke Lead $RUN\",\"phone\":\"+94 77 000 $RUN\",\"source\":\"WALK_IN\",\"programmeId\":\"$PROG\",\"note\":\"Asked about fees\"}"
o=$(req ras.jar POST /institution/leads "$D"); check "counsellor adds lead" 201 "$o"; L=$(echo "$o" | head -1 | jget "d['id']")
o=$(req ras.jar GET /institution/leads/$L); echo "    owner=$(echo "$o" | head -1 | jget "d['lead']['counsellor']['name']") stage=$(echo "$o" | head -1 | jget "d['lead']['stage']") timeline=$(echo "$o" | head -1 | jget "len(d['lead']['activities'])")"
check "log a call" 201 "$(req ras.jar POST /institution/leads/$L/activities '{"kind":"CALL","body":"Called, interested in Jan intake"}')"
o=$(req ras.jar GET /institution/leads/$L); check "first contact → Contacted" 200 "$o"; [ "$(echo "$o" | head -1 | jget "d['lead']['stage']")" = "CONTACTED" ] && echo "    stage is CONTACTED" || { fail=$((fail+1)); echo "  FAIL stage not CONTACTED"; }
check "can't jump to Applied without an application" 409 "$(req ras.jar PATCH /institution/leads/$L '{"stage":"APPLIED"}')"
check "other counsellor can't reassign" 403 "$(req kev.jar PATCH /institution/leads/$L "{\"counsellorId\":null}")"
D="{\"programmeId\":\"$NEWP\",\"intake\":\"Jan 2027\"}"; check "closed programme refuses applications" 409 "$(req ras.jar POST /institution/leads/$L/application "$D")"
D="{\"programmeId\":\"$PROG\",\"intake\":\"Jan 2027\"}"; o=$(req ras.jar POST /institution/leads/$L/application "$D"); check "create application" 201 "$o"; A=$(echo "$o" | head -1 | jget "d['id']")
check "only one application per lead" 409 "$(req ras.jar POST /institution/leads/$L/application "$D")"
check "issue offer" 200 "$(req ras.jar PATCH /institution/applications/$A '{"status":"OFFER_ISSUED"}')"
[ "$(req ras.jar GET /institution/leads/$L | head -1 | jget "d['lead']['stage']")" = "OFFER" ] && { pass=$((pass+1)); echo "  ok   lead follows → OFFER"; } || { fail=$((fail+1)); echo "  FAIL lead stage not OFFER"; }
check "enrol" 200 "$(req ras.jar PATCH /institution/applications/$A '{"status":"ENROLLED"}')"
[ "$(req ras.jar GET /institution/leads/$L | head -1 | jget "d['lead']['stage']")" = "ENROLLED" ] && { pass=$((pass+1)); echo "  ok   lead follows → ENROLLED"; } || { fail=$((fail+1)); echo "  FAIL lead stage not ENROLLED"; }
check "withdraw" 200 "$(req ras.jar PATCH /institution/applications/$A '{"status":"WITHDRAWN","note":"Moved abroad"}')"
[ "$(req ras.jar GET /institution/leads/$L | head -1 | jget "d['lead']['lostReason']")" = "Withdrawn" ] && { pass=$((pass+1)); echo "  ok   withdrawn marks lead lost"; } || { fail=$((fail+1)); echo "  FAIL not marked lost"; }
check "admissions board" 200 "$(req ras.jar GET '/institution/applications?status=UNDER_REVIEW')"
check "lead filters" 200 "$(req ras.jar GET '/institution/leads?counsellor=me&stage=NEW&q=a&idleDays=3')"

echo "Isolation (another institution)"
o=$(req admin.jar GET /institutions); UOM=$(echo "$o" | head -1 | jget "[i['id'] for i in d['institutions'] if i['shortName']=='UoM'][0]")
D="{\"institutionId\":\"$UOM\",\"email\":\"os-admin-$RUN@uom.example\",\"name\":\"UoM OS Admin\"}"; o=$(req admin.jar POST /admin/institution-staff "$D"); UT=$(echo "$o" | head -1 | jget "d['tempPassword']")
login uom.jar "os-admin-$RUN@uom.example" "$UT"
o=$(req uom.jar GET /institution/leads); check "UoM admin: own CRM" 200 "$o"; [ "$(echo "$o" | head -1 | jget "len(d['leads'])")" = "0" ] && { pass=$((pass+1)); echo "  ok   sees no Inspire College leads"; } || { fail=$((fail+1)); echo "  FAIL LEAK"; }
check "UoM admin can't open IC lead" 404 "$(req uom.jar GET /institution/leads/$L)"
check "UoM admin can't move IC application" 404 "$(req uom.jar PATCH /institution/applications/$A '{"status":"ENROLLED"}')"
check "UoM admin can't edit IC programme" 404 "$(req uom.jar PATCH /institution/programmes/$PROG '{"open":false}')"
D="{\"programmeId\":\"$PROG\",\"intake\":\"x1\"}"; check "UoM admin can't apply IC lead" 404 "$(req uom.jar POST /institution/leads/$L/application "$D")"

echo "Branding"
check "counsellor can't brand" 403 "$(req ras.jar PATCH /institution/branding '{"brandColor":"#112233"}')"
check "bad colour" 400 "$(req reg.jar PATCH /institution/branding '{"brandColor":"red"}')"
PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
D="{\"brandColor\":\"#7c5cff\",\"tagline\":\"Learn by building.\",\"logo\":\"$PNG\"}"; o=$(req reg.jar PATCH /institution/branding "$D"); check "set colour + logo" 200 "$o"
LOGO=$(echo "$o" | head -1 | jget "d['logoUrl']"); echo "    colour $(echo "$o" | head -1 | jget "d['brandColor']") logo $LOGO"
ct=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$ORIGIN$LOGO"); [ "$ct" = "200 image/png" ] && { pass=$((pass+1)); echo "  ok   logo served as image/png"; } || { fail=$((fail+1)); echo "  FAIL logo: $ct"; }
check "SVG refused" 400 "$(req reg.jar PATCH /institution/branding '{"logo":"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="}')"
check "fake PNG refused" 400 "$(req reg.jar PATCH /institution/branding '{"logo":"data:image/png;base64,aGVsbG8gd29ybGQ="}')"

echo "Public enquiry page"
o=$(curl -s "$B/public/institutions/ic" -w '\n%{http_code}'); check "public institution page" 200 "$o"; echo "    $(echo "$o" | head -1 | jget "d['branding']['displayName'] + ' · ' + str(len(d['programmes'])) + ' open programmes'")"
check "unknown institution" 404 "$(curl -s "$B/public/institutions/no-such-place" -w '\n%{http_code}')"
EIP="10.250.$((RUN % 250)).1"
check "consent required" 400 "$(req anon.jar POST /public/institutions/ic/enquiries '{"name":"Web Person","phone":"0771234567"}' $EIP)"
check "honeypot catches bots" 400 "$(req anon.jar POST /public/institutions/ic/enquiries '{"name":"Bot","phone":"0771234567","consent":true,"website":"spam.example"}' $EIP)"
D="{\"name\":\"Web Enquirer $RUN\",\"email\":\"web$RUN@example.com\",\"district\":\"Kandy\",\"programmeId\":\"$PROG\",\"message\":\"Do you have weekend classes?\",\"consent\":true}"
check "enquiry accepted" 201 "$(req anon.jar POST /public/institutions/ic/enquiries "$D" $EIP)"
o=$(req reg.jar GET "/institution/leads?q=Web%20Enquirer%20$RUN"); echo "    in CRM as: $(echo "$o" | head -1 | jget "[(l['source'], l['counsellor']['name'] if l['counsellor'] else None) for l in d['leads']]")"
for i in 1 2; do req anon.jar POST /public/institutions/ic/enquiries "$D" $EIP >/dev/null; done
check "6th enquiry from one IP in an hour is limited" 429 "$(req anon.jar POST /public/institutions/ic/enquiries "$D" $EIP)"

echo "Login rate limit"
LIP="10.251.$((RUN % 250)).1"
for i in 1 2 3 4 5 6 7 8 9 10; do D="{\"email\":\"nobody-$RUN@example.com\",\"password\":\"wrong\"}"; req x.jar POST /auth/login "$D" "10.252.$i.$((RUN % 250))" >/dev/null; done
check "11th wrong password for one email is limited (from any IP)" 429 "$(req x.jar POST /auth/login "$D" $LIP)"

echo "Cleanup"
check "admin deletes test lead" 200 "$(req reg.jar DELETE /institution/leads/$L)"
echo "RESULT: $pass passed, $fail failed"; [ "$fail" = 0 ]
