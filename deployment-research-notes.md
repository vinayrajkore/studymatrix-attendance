# Deployment and FCM Research Notes

## Render

Render’s official deployment guide describes API servers as **Web Services** and specifies configurable build/start commands, linked Git deployments, and runtime environment variables. Render’s PostgreSQL documentation recommends placing database and service in the same region and using the database’s internal connection URL for Render-to-Render traffic. [1] [2]

Render supports securely stored service variables and secret files. Its deployment guidance notes that free web services can spin down after 15 minutes of inactivity, while its free Postgres instances expire after 30 days; these are unsuitable assumptions for a production academic attendance service. [1] [3]

## Railway

Railway’s Express guide documents creating a PostgreSQL service in the same project and referencing it from the API service through `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Its PostgreSQL service exposes `DATABASE_URL` and individual `PG*` variables internally; public database access is optional and should not be enabled for ordinary API traffic. [4] [5]

## Firebase Cloud Messaging

Firebase documents the Admin Node.js SDK as the preferred server integration. A non-Google host such as Render or Railway should keep the service-account JSON only in a secure secret file, then expose its path with `GOOGLE_APPLICATION_CREDENTIALS`. The Admin SDK can target a specific device with an installation ID or registration token and include custom data fields. Firebase’s current documentation marks registration-token targeting as deprecated during a migration period and recommends Firebase Installation IDs where supported. [6] [7] [8]

## References

[1] https://render.com/docs/your-first-deploy
[2] https://render.com/docs/postgresql-creating-connecting
[3] https://render.com/docs/configure-environment-variables
[4] https://docs.railway.com/guides/express
[5] https://docs.railway.com/databases/postgresql
[6] https://firebase.google.com/docs/admin/setup
[7] https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
[8] https://firebase.google.com/docs/cloud-messaging/send/v1-api
