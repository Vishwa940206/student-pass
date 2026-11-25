#!/bin/bash
# End-to-end API checks for Campus Life + the institution portal.
# Needs a running server on a freshly seeded DEV database (pnpm db:seed), never production:
#   API=http://localhost:3000/api/v1 DATABASE_URL=postgresql://…/student_pass scripts/smoke-campus.sh
# Written for macOS's bash 3.2: JSON bodies with variables are built in $D first.
B=${API:-http://localhost:3000/api/v1}; ORIGIN=${B%/api/v1}; J=$(mktemp -d); pass=0; fail=0
req() { local jar=$1 m=$2 p=$3 d=$4; local args=(-s -c "$J/$jar" -b "$J/$jar" -X "$m" "$B$p" -H 'content-type: application/json' -H "origin: $ORIGIN" -w '\n%{http_code}'); [ -n "$d" ] && args+=(--data-raw "$d"); curl "${args[@]}"; }
check() { local name=$1 want=$2 out=$3; local code=$(echo "$out" | tail -1); if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  ok   $name ($code)"; else fail=$((fail+1)); echo "  FAIL $name: want $want got $code :: $(echo "$out" | head -1 | cut -c1-200)"; fi; }
login() { req $1 POST /auth/login "{\"email\":\"$2\",\"password\":\"studentpass\"}" >/dev/null; }
rm -f $J/*.jar
login nethmi.jar nethmi@example.com; login kasun.jar kasun@example.com; login amaya.jar amaya@example.com
login reg.jar registrar@inspire-college.example; login lec.jar lecturer@inspire-college.example; login admin.jar admin@studentpass.example; login cash.jar cashier@sandbox-cafe.example

echo "Student access"
o=$(req nethmi.jar GET /campus); check "verified student sees campus" 200 "$o"; C=$(echo "$o" | head -1)
echo "$C" | python3 -c "import json,sys;d=json.load(sys.stdin);print('   ',d['institution']['shortName'],len(d['announcements']),'ann',len(d['events']),'events',len(d['clubs']),'clubs',len(d['courses']),'courses; grade:',d['courses'][0]['assignments'][0]['grade'])"
check "pending student blocked" 403 "$(req amaya.jar GET /campus)"
check "staff can't use student campus" 403 "$(req reg.jar GET /campus)"
check "signed out blocked" 401 "$(req none.jar GET /campus)"
EV_FULL=$(echo "$C" | python3 -c "import json,sys;print([e['id'] for e in json.load(sys.stdin)['events'] if e['capacity']==2][0])")
CLUB=$(echo "$C" | python3 -c "import json,sys;print([c['id'] for c in json.load(sys.stdin)['clubs'] if not c['mine']][0])")
check "join club" 200 "$(req nethmi.jar POST /campus/clubs/$CLUB/membership)"
check "join club again (idempotent)" 200 "$(req nethmi.jar POST /campus/clubs/$CLUB/membership)"
check "leave club" 200 "$(req nethmi.jar DELETE /campus/clubs/$CLUB/membership)"
check "rsvp 1/2" 200 "$(req nethmi.jar POST /campus/events/$EV_FULL/rsvp)"
check "rsvp 2/2 (kasun, other institution)" 404 "$(req kasun.jar POST /campus/events/$EV_FULL/rsvp)"

echo "Tenant isolation"
o=$(req kasun.jar GET /campus); check "UoM student campus" 200 "$o"
echo "$o" | head -1 | python3 -c "import json,sys;d=json.load(sys.stdin);assert not d['events'] and not d['clubs'] and not d['announcements'], 'LEAK';print('    UoM student sees no Inspire College data')"
check "UoM student can't join IC club" 404 "$(req kasun.jar POST /campus/clubs/$CLUB/membership)"

echo "Institution portal"
o=$(req reg.jar GET /institution); check "registrar overview" 200 "$o"; I=$(echo "$o" | head -1)
echo "$I" | python3 -c "import json,sys;d=json.load(sys.stdin);print('   ',d['me']['staffRole'],d['stats'])"
check "lecturer overview" 200 "$(req lec.jar GET /institution)"
check "student blocked from portal" 403 "$(req nethmi.jar GET /institution)"
check "platform admin isn't institution staff" 403 "$(req admin.jar GET /institution)"
check "registrar verification queue" 200 "$(req reg.jar GET /institution/verifications)"
check "lecturer can't verify" 403 "$(req lec.jar GET /institution/verifications)"
o=$(req reg.jar POST /institution/announcements '{"title":"Test notice","body":"Hello"}'); check "post announcement" 201 "$o"; AN=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
check "bad event (end before start)" 400 "$(req lec.jar POST /institution/events '{"title":"X event","location":"Hall","startsAt":"2027-01-02T10:00:00+05:30","endsAt":"2027-01-02T09:00:00+05:30"}')"
o=$(req lec.jar POST /institution/events '{"title":"Guest lecture","location":"Hall A","startsAt":"2027-01-02T10:00:00+05:30","capacity":1}'); check "create event" 201 "$o"; EV=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
check "student rsvp new event" 200 "$(req nethmi.jar POST /campus/events/$EV/rsvp)"
o=$(req lec.jar POST /institution/courses '{"code":"ds300","name":"Data Science"}'); check "create course" 201 "$o"; CO=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
check "duplicate course code" 409 "$(req lec.jar POST /institution/courses '{"code":"DS300","name":"Dup"}')"
o=$(req lec.jar POST /institution/courses/$CO/enrolments '{"studentNumbers":["IC-2026-0142","220481K","NOPE-1"]}'); check "enrol by student number" 200 "$o"; echo "    $(echo "$o" | head -1)  (UoM number + unknown must be notFound)"
o=$(req lec.jar POST /institution/courses/$CO/assignments '{"title":"Essay 1","dueAt":"2027-02-01T23:59:00+05:30","maxMarks":50}'); check "create assignment" 201 "$o"; AS=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
o=$(req lec.jar GET /institution/assignments/$AS/grades); check "gradebook" 200 "$o"; ST=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['students'][0]['id'])")
D="{\"grades\":[{\"studentId\":\"$ST\",\"marks\":51}]}"
check "grade over max rejected" 400 "$(req lec.jar PUT /institution/assignments/$AS/grades "$D")"
D="{\"grades\":[{\"studentId\":\"$ST\",\"marks\":42,\"feedback\":\"Good\"}]}"
check "save grade" 200 "$(req lec.jar PUT /institution/assignments/$AS/grades "$D")"
KST=$(node -e "const {Client}=require('pg');const c=new Client(process.env.DATABASE_URL);c.connect().then(()=>c.query(\"select s.id from \\\"StudentProfile\\\" s join \\\"User\\\" u on u.id=s.\\\"userId\\\" where u.email='kasun@example.com'\")).then(r=>{console.log(r.rows[0].id);c.end()})")
D="{\"grades\":[{\"studentId\":\"$KST\",\"marks\":10}]}"
check "can't grade non-enrolled (other institution) student" 400 "$(req lec.jar PUT /institution/assignments/$AS/grades "$D")"
o=$(req nethmi.jar GET /campus); echo "$o" | head -1 | python3 -c "import json,sys;d=json.load(sys.stdin);c=[c for c in d['courses'] if c['code']=='DS300'][0];g=c['assignments'][0]['grade'];assert g['marks']==42;print('    student sees new course + grade 42/50')"

echo "Staff accounts"
o=$(req lec.jar POST /institution/staff '{"email":"x@ic.example","name":"X Person"}'); check "lecturer can't add staff" 403 "$o"
o=$(req reg.jar POST /institution/staff '{"email":"newlec@ic.example","name":"New Lecturer"}'); check "registrar adds lecturer" 201 "$o"; TMP=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['tempPassword'])"); NEWID=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])"); echo "    one-time password format: ${TMP:0:4}-****"
check "email already used" 409 "$(req reg.jar POST /institution/staff '{"email":"nethmi@example.com","name":"Hijack"}')"
D="{\"email\":\"newlec@ic.example\",\"password\":\"$TMP\"}"
check "new lecturer logs in with one-time password" 200 "$(req new.jar POST /auth/login "$D")"
D="{\"currentPassword\":\"$TMP\",\"newPassword\":\"a-brand-new-password\"}"
check "new lecturer changes password" 200 "$(req new.jar POST /auth/password "$D")"
check "still signed in after change" 200 "$(req new.jar GET /institution)"
D="{\"email\":\"newlec@ic.example\",\"password\":\"$TMP\"}"
check "old password no longer works" 401 "$(req new2.jar POST /auth/login "$D")"
check "can't remove yourself" 400 "$(req reg.jar DELETE /institution/staff/$(req reg.jar GET /institution | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['me']['id'])"))"
check "registrar removes lecturer" 200 "$(req reg.jar DELETE /institution/staff/$NEWID)"
check "removed lecturer is signed out" 401 "$(req new.jar GET /institution)"
o=$(req admin.jar GET /institutions); UOM=$(echo "$o" | head -1 | python3 -c "import json,sys;print([i['id'] for i in json.load(sys.stdin)['institutions'] if i['shortName']=='UoM'][0])")
D="{\"institutionId\":\"$UOM\",\"email\":\"admin@uom.example\",\"name\":\"UoM Admin\"}"
o=$(req admin.jar POST /admin/institution-staff "$D"); check "platform admin creates UoM admin" 201 "$o"; UTMP=$(echo "$o" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['tempPassword'])")
check "platform admin lists staff" 200 "$(req admin.jar GET /admin/institution-staff)"
D="{\"institutionId\":\"$UOM\",\"email\":\"z@z.example\",\"name\":\"Zed\"}"
check "cashier can't create staff" 403 "$(req cash.jar POST /admin/institution-staff "$D")"
check "cross-origin blocked" 403 "$(curl -s -b $J/reg.jar -X POST $B/institution/announcements -H 'content-type: application/json' -H 'origin: https://evil.example' -d '{"title":"xx","body":"y"}' -w '\n%{http_code}')"

echo "Cleanup"
check "delete announcement" 200 "$(req reg.jar DELETE /institution/announcements/$AN)"
D="{\"email\":\"admin@uom.example\",\"password\":\"$UTMP\"}"; req uomadm.jar POST /auth/login "$D" >/dev/null
check "UoM admin can't delete IC course" 404 "$(req uomadm.jar DELETE /institution/courses/$CO)"
check "delete course" 200 "$(req lec.jar DELETE /institution/courses/$CO)"
echo "RESULT: $pass passed, $fail failed"; [ "$fail" = 0 ]
