# Microsoft Auth Setup

## 1) Azure App Registration

1. Create an app registration in Azure portal.
2. Add a Web redirect URI:
   - http://localhost:1420/auth/callback
3. Generate a client secret.
4. Copy values to environment variables:
   - MICROSOFT_CLIENT_ID
   - MICROSOFT_CLIENT_SECRET
   - MICROSOFT_REDIRECT_URI

## 2) Permissions and scopes

The backend uses Microsoft Live OAuth endpoints with scopes:

- XboxLive.signin
- offline_access

These are required to exchange the Microsoft token into Xbox and then Minecraft tokens.

## 3) Runtime flow

1. Launcher calls GET /v1/auth/microsoft/url
2. User authenticates on Microsoft page
3. Browser returns to /auth/callback with code and state
4. Launcher posts code/state to POST /v1/auth/microsoft/callback
5. Backend performs token chain:
   - Microsoft token
   - Xbox user token
   - XSTS token
   - Minecraft access token
   - Minecraft profile fetch
6. Launcher receives account payload with uuid, username, skin, token expiry

## 4) Notes

- State is short-lived and single-use.
- If state expires, launcher must restart the auth flow.
- For production, replace in-memory state store with Redis or database.
