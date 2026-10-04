#!/usr/bin/env bash
# End-to-end API smoke test with curl.
#
#   BASE_URL=http://localhost:3000 scripts/smoke-api.sh
#   BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... scripts/smoke-api.sh
#
# Without admin credentials it checks only what needs no database: health,
# unknown routes, and that every protected route refuses a missing token.
# With credentials it also runs the full staff flow against the real
# database: it creates a temporary salesperson, owner, vehicle and leads
# (names start with "ZZ Smoke"), then deactivates the salesperson and closes
# the leads. The vehicle ends `sold` because sold is terminal.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SHOWROOM_ID="${SHOWROOM_ID:-b0000000-0000-4000-8000-000000000001}"
ID="11111111-1111-4111-8111-111111111111"
PASS=0
FAIL=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    PASS=$((PASS + 1))
    printf 'PASS  %-62s %s\n' "$label" "$actual"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL  %-62s expected %s, got %s\n' "$label" "$expected" "$actual"
    [[ -s /tmp/smoke-body.json ]] && printf '      %s\n' "$(head -c 300 /tmp/smoke-body.json)"
  fi
}

# call METHOD PATH [TOKEN] [JSON] -> prints status, body in /tmp/smoke-body.json
call() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-sS -o /tmp/smoke-body.json -w '%{http_code}' -X "$method" "$BASE_URL$path")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl "${args[@]}"
}

field() { jq -r "$1" /tmp/smoke-body.json; }

echo "== Public and token-free checks against $BASE_URL"
check 'GET /health' 200 "$(call GET /health)"
check 'GET /health body status=ok' ok "$(field .status)"
check 'GET /does-not-exist' 404 "$(call GET /does-not-exist)"
check 'POST /auth/login malformed body' 422 "$(call POST /auth/login '' '{"email":"nope"}')"

PROTECTED=(
  "GET /auth/me" "GET /users" "POST /users" "GET /users/$ID" "PATCH /users/$ID"
  "PUT /users/$ID/roles" "DELETE /users/$ID" "GET /owners" "POST /owners"
  "GET /owners/$ID" "PATCH /owners/$ID" "DELETE /owners/$ID" "GET /catalog/makes"
  "GET /catalog/makes/$ID/models" "GET /catalog/models/$ID/variants" "GET /vehicles"
  "POST /vehicles" "GET /vehicles/$ID" "PATCH /vehicles/$ID" "POST /vehicles/$ID/status"
  "GET /vehicles/$ID/status-history" "POST /vehicles/$ID/media/uploads"
  "POST /vehicles/$ID/media" "GET /vehicles/$ID/media" "DELETE /vehicles/$ID/media/$ID"
  "POST /vehicles/$ID/documents/uploads" "POST /vehicles/$ID/documents"
  "GET /vehicles/$ID/documents" "DELETE /vehicles/$ID/documents/$ID" "GET /leads"
  "POST /leads" "GET /leads/$ID" "PATCH /leads/$ID/vehicle" "PUT /leads/$ID/assignment"
  "POST /leads/$ID/status" "POST /leads/$ID/follow-ups" "GET /notifications"
  "PATCH /notifications/$ID/read"
)
for route in "${PROTECTED[@]}"; do
  check "$route without token" 401 "$(call ${route% *} ${route#* })"
done

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo
  echo "Skipped live checks: set ADMIN_EMAIL and ADMIN_PASSWORD to run them."
  echo "Result: $PASS passed, $FAIL failed"
  exit $((FAIL > 0))
fi

echo
echo "== Live staff flow"
RUN="$(date +%s)"
SUFFIX="${RUN: -7}"

check 'POST /auth/login (admin)' 200 \
  "$(call POST /auth/login '' "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
ADMIN="$(field .accessToken)"
check 'GET /auth/me (admin)' 200 "$(call GET /auth/me "$ADMIN")"
check 'me.roles includes admin' true "$(field '.roles | index("admin") != null')"

for path in /users /owners /catalog/makes /vehicles /leads /notifications; do
  check "GET $path (admin baseline)" 200 "$(call GET "$path?limit=1" "$ADMIN")"
done

SALES_EMAIL="zz.smoke.$RUN@example.com"
SALES_PASSWORD="smoke-$RUN"
check 'POST /users (temporary salesperson)' 201 "$(call POST /users "$ADMIN" "{
  \"fullName\":\"ZZ Smoke Sales $RUN\",\"phone\":\"+9170${SUFFIX}11\",\"email\":\"$SALES_EMAIL\",
  \"password\":\"$SALES_PASSWORD\",\"showroomId\":\"$SHOWROOM_ID\",\"roles\":[\"salesperson\"]}")"
SALES_ID="$(field .id)"
check 'GET /users/:id' 200 "$(call GET "/users/$SALES_ID" "$ADMIN")"
check 'PATCH /users/:id' 200 "$(call PATCH "/users/$SALES_ID" "$ADMIN" "{
  \"fullName\":\"ZZ Smoke Sales $RUN\",\"phone\":\"+9170${SUFFIX}11\",\"email\":\"$SALES_EMAIL\",
  \"showroomId\":\"$SHOWROOM_ID\"}")"

check 'POST /owners' 201 "$(call POST /owners "$ADMIN" "{
  \"fullName\":\"ZZ Smoke Owner $RUN\",\"phone\":\"+9171${SUFFIX}22\",\"email\":null,
  \"address\":\"1 Test Road\",\"city\":\"Bengaluru\",\"preferredContactMethod\":\"phone\",
  \"altPhone\":null,\"idInfo\":null,\"notes\":\"smoke test\"}")"
OWNER_ID="$(field .id)"
check 'GET /owners/:id' 200 "$(call GET "/owners/$OWNER_ID" "$ADMIN")"
check 'PATCH /owners/:id' 200 "$(call PATCH "/owners/$OWNER_ID" "$ADMIN" "{
  \"fullName\":\"ZZ Smoke Owner $RUN\",\"phone\":\"+9171${SUFFIX}22\",\"email\":null,
  \"address\":\"2 Test Road\",\"city\":\"Bengaluru\",\"preferredContactMethod\":\"whatsapp\",
  \"altPhone\":null,\"idInfo\":null,\"notes\":\"smoke test\"}")"

call GET '/catalog/makes?limit=1' "$ADMIN" >/dev/null
MAKE_ID="$(field '.items[0].id')"
call GET "/catalog/makes/$MAKE_ID/models?limit=1" "$ADMIN" >/dev/null
MODEL_ID="$(field '.items[0].id')"
check 'GET /catalog/models/:id/variants' 200 "$(call GET "/catalog/models/$MODEL_ID/variants?limit=1" "$ADMIN")"
VARIANT_ID="$(field '.items[0].id')"

check 'POST /vehicles (admin, explicit showroom)' 201 "$(call POST /vehicles "$ADMIN" "{
  \"showroomId\":\"$SHOWROOM_ID\",\"ownerId\":\"$OWNER_ID\",\"variantId\":\"$VARIANT_ID\",
  \"year\":2019,\"registrationNumber\":\"ZZ${SUFFIX}\",\"fuelType\":\"petrol\",
  \"transmission\":\"manual\",\"kmDriven\":42000,\"numPreviousOwners\":1,\"colour\":\"White\",
  \"insuranceValidUntil\":null,\"rcStatus\":\"clear\",\"serviceHistory\":\"full\",
  \"accidentHistory\":false,\"loanStatus\":\"clear\",\"location\":\"Bengaluru\",
  \"description\":\"smoke test\",\"acquisitionType\":\"consignment\"}")"
VEHICLE_ID="$(field .id)"
check 'GET /vehicles/:id' 200 "$(call GET "/vehicles/$VEHICLE_ID" "$ADMIN")"
check 'PATCH /vehicles/:id' 200 "$(call PATCH "/vehicles/$VEHICLE_ID" "$ADMIN" "{
  \"year\":2019,\"registrationNumber\":\"ZZ${SUFFIX}\",\"fuelType\":\"petrol\",
  \"transmission\":\"manual\",\"kmDriven\":43000,\"numPreviousOwners\":1,\"colour\":\"Silver\",
  \"insuranceValidUntil\":null,\"rcStatus\":\"clear\",\"serviceHistory\":\"full\",
  \"accidentHistory\":false,\"loanStatus\":\"clear\",\"location\":\"Bengaluru\",
  \"description\":\"smoke test\"}")"
check 'GET /vehicles/:id/media' 200 "$(call GET "/vehicles/$VEHICLE_ID/media" "$ADMIN")"
check 'GET /vehicles/:id/documents' 200 "$(call GET "/vehicles/$VEHICLE_ID/documents" "$ADMIN")"

for status in inspection_pending under_inspection approved available reserved available reserved; do
  check "POST /vehicles/:id/status -> $status" 200 \
    "$(call POST "/vehicles/$VEHICLE_ID/status" "$ADMIN" "{\"status\":\"$status\",\"reason\":\"smoke\"}")"
done
check 'vehicle reserved -> approved is rejected' 422 \
  "$(call POST "/vehicles/$VEHICLE_ID/status" "$ADMIN" '{"status":"approved","reason":null}')"
check 'GET /vehicles/:id/status-history' 200 "$(call GET "/vehicles/$VEHICLE_ID/status-history" "$ADMIN")"

check 'POST /leads (admin, with vehicle)' 201 "$(call POST /leads "$ADMIN" "{
  \"showroomId\":\"$SHOWROOM_ID\",\"fullName\":\"ZZ Smoke Buyer $RUN\",\"phone\":\"+9172${SUFFIX}33\",
  \"email\":null,\"source\":\"walkin\",\"vehicleId\":\"$VEHICLE_ID\",\"budget\":800000,
  \"preferredVehicle\":null,\"purchaseTimeline\":null,\"financeRequired\":false,
  \"currentVehicle\":null,\"tradeInRequired\":false,\"notes\":\"smoke test\"}")"
LEAD_ID="$(field .id)"
check 'admin lead starts unassigned' null "$(field .assignedTo)"

check 'POST /leads (admin, second lead stays unassigned)' 201 "$(call POST /leads "$ADMIN" "{
  \"showroomId\":\"$SHOWROOM_ID\",\"fullName\":\"ZZ Smoke Other $RUN\",\"phone\":\"+9173${SUFFIX}44\",
  \"email\":null,\"source\":\"phone\",\"vehicleId\":null,\"budget\":null,\"preferredVehicle\":null,
  \"purchaseTimeline\":null,\"financeRequired\":null,\"currentVehicle\":null,
  \"tradeInRequired\":null,\"notes\":null}")"
OTHER_LEAD_ID="$(field .id)"
check 'GET /leads/:id (admin)' 200 "$(call GET "/leads/$OTHER_LEAD_ID" "$ADMIN")"
check 'PATCH /leads/:id/vehicle' 200 \
  "$(call PATCH "/leads/$OTHER_LEAD_ID/vehicle" "$ADMIN" "{\"vehicleId\":\"$VEHICLE_ID\"}")"
check 'PUT /users/:id/roles' 200 \
  "$(call PUT "/users/$SALES_ID/roles" "$ADMIN" '{"roles":["salesperson"]}')"

check 'PUT /leads/:id/assignment (to salesperson)' 200 \
  "$(call PUT "/leads/$LEAD_ID/assignment" "$ADMIN" "{\"assignedTo\":\"$SALES_ID\"}")"
check 'assignment response assignedTo' "$SALES_ID" "$(field .assignedTo)"
check 'assignment to a non-staff id is rejected' 422 \
  "$(call PUT "/leads/$OTHER_LEAD_ID/assignment" "$ADMIN" "{\"assignedTo\":\"$ID\"}")"
check 'GET /leads?assignedTo= (admin filter)' 200 "$(call GET "/leads?assignedTo=$SALES_ID" "$ADMIN")"
check 'admin filter returns only that assignee' true \
  "$(field "[.items[].assignedTo] | all(. == \"$SALES_ID\")")"

echo
echo "== Salesperson view"
check 'POST /auth/login (salesperson)' 200 \
  "$(call POST /auth/login '' "{\"email\":\"$SALES_EMAIL\",\"password\":\"$SALES_PASSWORD\"}")"
SALES="$(field .accessToken)"
SALES_REFRESH="$(field .refreshToken)"
check 'GET /leads (salesperson)' 200 "$(call GET /leads "$SALES")"
check 'salesperson sees only own leads' true "$(field "[.items[].assignedTo] | all(. == \"$SALES_ID\")")"
check 'salesperson sees the assigned lead' true "$(field "[.items[].id] | index(\"$LEAD_ID\") != null")"
check 'GET /leads/:id (unassigned lead) hidden' 404 "$(call GET "/leads/$OTHER_LEAD_ID" "$SALES")"
check 'GET /notifications (salesperson)' 200 "$(call GET /notifications "$SALES")"
check 'lead_assigned notification present' true \
  "$(field "[.items[] | select(.type == \"lead_assigned\" and .entityId == \"$LEAD_ID\")] | length == 1")"
NOTIFICATION_ID="$(field "[.items[] | select(.type == \"lead_assigned\")][0].id")"
check 'PATCH /notifications/:id/read (salesperson)' 204 \
  "$(call PATCH "/notifications/$NOTIFICATION_ID/read" "$SALES")"
check 'salesperson cannot change vehicle status' 403 \
  "$(call POST "/vehicles/$VEHICLE_ID/status" "$SALES" '{"status":"available","reason":null}')"
check 'salesperson cannot assign leads' 403 \
  "$(call PUT "/leads/$LEAD_ID/assignment" "$SALES" "{\"assignedTo\":\"$SALES_ID\"}")"
check 'GET /vehicles/:id (salesperson)' 200 "$(call GET "/vehicles/$VEHICLE_ID" "$SALES")"
check 'GET /catalog/makes (salesperson)' 200 "$(call GET '/catalog/makes?limit=1' "$SALES")"
check 'POST /auth/refresh' 200 "$(call POST /auth/refresh '' "{\"refreshToken\":\"$SALES_REFRESH\"}")"

check 'POST /leads (salesperson, home showroom)' 201 "$(call POST /leads "$SALES" "{
  \"fullName\":\"ZZ Smoke Walkin $RUN\",\"phone\":\"+9174${SUFFIX}55\",\"email\":null,
  \"source\":\"walkin\",\"vehicleId\":null,\"budget\":null,\"preferredVehicle\":null,
  \"purchaseTimeline\":null,\"financeRequired\":null,\"currentVehicle\":null,
  \"tradeInRequired\":null,\"notes\":null}")"
OWN_LEAD_ID="$(field .id)"
check 'salesperson lead is self-assigned' "$SALES_ID" "$(field .assignedTo)"
check 'salesperson lead filed in home showroom' "$SHOWROOM_ID" "$(field .showroomId)"

check 'POST /leads/:id/follow-ups (salesperson)' 201 "$(call POST "/leads/$LEAD_ID/follow-ups" "$SALES" \
  '{"scheduledAt":"2030-01-01T10:00:00.000Z","taskType":"call","notes":"smoke"}')"
check 'follow-up assigned to lead owner' "$SALES_ID" "$(field .assignedTo)"

check 'markVehicleSold with a non-sold status' 422 \
  "$(call POST "/leads/$LEAD_ID/status" "$SALES" '{"status":"contacted","notes":null,"markVehicleSold":true}')"
for status in contacted interested follow_up test_drive negotiation booking_confirmed; do
  check "POST /leads/:id/status -> $status (salesperson)" 200 \
    "$(call POST "/leads/$LEAD_ID/status" "$SALES" "{\"status\":\"$status\",\"notes\":\"smoke\"}")"
done
check 'close lead as sold with markVehicleSold' 200 \
  "$(call POST "/leads/$LEAD_ID/status" "$SALES" '{"status":"sold","notes":"smoke","markVehicleSold":true}')"
check 'response vehicleMarkedSold' true "$(field .vehicleMarkedSold)"
check 'repeat close is a no-op' 200 \
  "$(call POST "/leads/$LEAD_ID/status" "$SALES" '{"status":"sold","notes":null,"markVehicleSold":true}')"
call GET "/vehicles/$VEHICLE_ID" "$ADMIN" >/dev/null
check 'vehicle is now sold' sold "$(field .status)"
check 'closed lead cannot be reassigned' 422 \
  "$(call PUT "/leads/$LEAD_ID/assignment" "$ADMIN" '{"assignedTo":null}')"

echo
echo "== Cleanup"
check 'close salesperson lead as lost' 200 \
  "$(call POST "/leads/$OWN_LEAD_ID/status" "$SALES" '{"status":"lost","notes":"smoke cleanup"}')"
check 'close unassigned lead as lost' 200 \
  "$(call POST "/leads/$OTHER_LEAD_ID/status" "$ADMIN" '{"status":"lost","notes":"smoke cleanup"}')"
check 'DELETE /users/:id (temporary salesperson)' 204 "$(call DELETE "/users/$SALES_ID" "$ADMIN")"

echo
echo "Result: $PASS passed, $FAIL failed"
exit $((FAIL > 0))
