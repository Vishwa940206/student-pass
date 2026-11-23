#!/bin/bash
RUN=$RANDOM; B=http://localhost:3100/api/v1; SP=${1:-$(mktemp -d)}; B=${API:-$B}; J='content-type: application/json'
login() { curl -s -c $SP/$1.jar -H "$J" -d "{\"email\":\"$2\",\"password\":\"studentpass\"}" $B/auth/login >/dev/null; }
login k kasun@example.com; login i ishara@example.com; login a amaya@example.com; login c cashier@sandbox-cafe.example
login adm admin@studentpass.example
IC=$(curl -s $B/institutions | python3 -c 'import sys,json;print([i["id"] for i in json.load(sys.stdin)["institutions"] if i["shortName"]=="IC"][0])')
echo "## 0 signup new IC student → pending → admin approves"
curl -s -c $SP/n.jar -H "$J" -d "{\"name\":\"Test Student $RUN\",\"email\":\"t$RUN@example.com\",\"password\":\"studentpass\",\"institutionId\":\"$IC\",\"studentNumber\":\"IC-T-$RUN\"}" $B/auth/signup; echo
PID=$(curl -s -b $SP/adm.jar $B/admin/verifications | python3 -c "import sys,json;print([p['id'] for p in json.load(sys.stdin)['pending'] if p['studentNumber']=='IC-T-$RUN'][0])")
curl -s -b $SP/adm.jar -H "$J" -d '{"decision":"VERIFIED","validUntil":"2027-06-30"}' $B/admin/verifications/$PID; echo
tok() { curl -s -b $SP/$1.jar $B/pass/token | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("token") or d)'; }
LOC=$(curl -s -b $SP/c.jar $B/pos/locations)
KOL=$(echo "$LOC" | python3 -c 'import sys,json;print([l["id"] for l in json.load(sys.stdin)["locations"] if l["code"]=="KOL"][0])')
GAL=$(echo "$LOC" | python3 -c 'import sys,json;print([l["id"] for l in json.load(sys.stdin)["locations"] if l["code"]=="GAL"][0])')
OFFERS=$(curl -s $B/offers?category=Food%20%26%20drink)
SPON=$(echo "$OFFERS" | python3 -c 'import sys,json;print([o["id"] for o in json.load(sys.stdin)["offers"] if o["slug"]=="ic-weekly-coffee"][0])')
PCT=$(echo "$OFFERS" | python3 -c 'import sys,json;print([o["id"] for o in json.load(sys.stdin)["offers"] if o["slug"]=="sandbox-student-coffee"][0])')
post() { curl -s -b $SP/c.jar -H "$J" ${3:+-H "Idempotency-Key: $3"} -d "$2" $B$1; echo; }
short() { python3 -c 'import sys,json;d=json.load(sys.stdin);a=d.get("authorization") or d.get("redemption") or d.get("error") or d;print({k:a[k] for k in a if k in("code","message","status","discountCents","ref","voidedAt","id")} if isinstance(a,dict) else a)'; }

echo "## 1 pending student cannot get a token:"; curl -s -b $SP/a.jar $B/pass/token; echo
T=$(tok n); echo "## 2 new student token: $T"
echo "## 3 scan:"; post /pos/scan "{\"token\":\"$T\",\"locationId\":\"$KOL\",\"subtotalCents\":160000}"
echo "## 4 authorize sponsored:"; A=$(post /pos/authorizations "{\"token\":\"$T\",\"offerId\":\"$SPON\",\"locationId\":\"$KOL\",\"subtotalCents\":160000}" key-n-0001-$RUN); echo "$A" | short
AID=$(echo "$A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["authorization"]["id"])')
echo "## 5 retry same key (lost response) → same hold:"; post /pos/authorizations "{\"token\":\"$T\",\"offerId\":\"$SPON\",\"locationId\":\"$KOL\",\"subtotalCents\":160000}" key-n-0001-$RUN | short
echo "## 6 replay same QR with new key:"; post /pos/authorizations "{\"token\":\"$T\",\"offerId\":\"$PCT\",\"locationId\":\"$KOL\",\"subtotalCents\":160000}" key-n-0002-$RUN | short
echo "## 7 capture:"; R=$(post /pos/authorizations/$AID/capture '{}'); echo "$R" | short
echo "## 8 capture again (idempotent):"; post /pos/authorizations/$AID/capture '{}' | short
echo "## 9 next window: weekly coffee again → limit:"; sleep 31; T2=$(tok n)
post /pos/authorizations "{\"token\":\"$T2\",\"offerId\":\"$SPON\",\"locationId\":\"$KOL\",\"subtotalCents\":95000}" key-n-0003-$RUN | short
echo "## 10 standard 10% offer still OK, then cancel:"; A2=$(post /pos/authorizations "{\"token\":\"$T2\",\"offerId\":\"$PCT\",\"locationId\":\"$KOL\",\"subtotalCents\":160000}" key-n-0004-$RUN); echo "$A2" | short
A2ID=$(echo "$A2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["authorization"]["id"])'); post /pos/authorizations/$A2ID/cancel '{}' | short
echo "## 11 void sponsored redemption → allowance back:"; RID=$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["redemption"]["id"])'); post /pos/redemptions/$RID/void '{"reason":"Customer refund"}' | short
echo "## 12 Kasun (UoM) tries IC-only offer:"; TK=$(tok k); post /pos/authorizations "{\"token\":\"$TK\",\"offerId\":\"$SPON\",\"locationId\":\"$KOL\",\"subtotalCents\":95000}" key-k-0001-$RUN | short
echo "## 13 Kasun at Galle (not in programme):"; post /pos/authorizations "{\"token\":\"$TK\",\"offerId\":\"$PCT\",\"locationId\":\"$GAL\",\"subtotalCents\":95000}" key-k-0002-$RUN | short
echo "## 14 Ishara frozen:"; curl -s -b $SP/i.jar $B/pass/token; echo
echo "## 15 forged token:"; post /pos/scan "{\"token\":\"${TK%?}x\",\"locationId\":\"$KOL\",\"subtotalCents\":100}" | short
echo "## 16 student calls POS api:"; curl -s -b $SP/k.jar $B/pos/locations; echo
echo "## 17 cross-origin POST blocked:"; curl -s -b $SP/k.jar -H "$J" -H "Origin: https://evil.example" -d '{"frozen":true}' $B/pass/freeze; echo
echo "## 18 ledger:"; curl -s -b $SP/c.jar $B/pos/redemptions | python3 -c 'import sys,json;[print(r["ref"],r["offer"]["title"],r["discountCents"],"VOID" if r["voidedAt"] else "") for r in json.load(sys.stdin)["redemptions"]]'
