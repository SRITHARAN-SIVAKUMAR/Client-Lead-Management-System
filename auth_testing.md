# Auth Testing Playbook

## Admin credentials
- Email: `admin@crm.local`
- Password: `Admin@12345`

## Curl flow
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d'=' -f2)
curl -c /tmp/cookies.txt -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.local","password":"Admin@12345"}'
curl -b /tmp/cookies.txt "$API/api/auth/me"
```

Expected: login returns `{ id, email, name, role }` and sets `access_token` cookie; `/me` returns the same user.

## MongoDB verification
```
mongosh
use test_database
db.users.find({ role: "admin" }).pretty()
```
Password hash must start with `$2b$`.
