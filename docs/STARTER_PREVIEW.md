# GitHub Codespaces Starter Preview

This test-only preview keeps the application on GitHub and the database on Supabase. It does not deploy the application to Vercel or another production host.

## Security boundary

- Port 3000 is configured as private and requires the codespace owner's GitHub authentication.
- Use synthetic data only.
- Codespaces secrets are injected as environment variables and must never be committed or printed.
- Stop the codespace when the review session ends.

## Required Codespaces secrets

Add these as GitHub Codespaces development-environment secrets for this repository:

- `DATABASE_URL`: Supabase Session Pooler URI.
- `DIRECT_DATABASE_URL`: the same Session Pooler URI for this starter.
- `AUTH_SECRET`: value from the private local `.env.local` file.
- `STUDENT_DATA_ENCRYPTION_KEY`: value from the private local `.env.local` file.

The dev-container configuration recommends these names when creating a codespace with advanced options.

## Start the preview

1. Create a codespace from the repository's `main` branch.
2. Wait for the post-create setup to finish.
3. In the codespace terminal, run `pnpm dev`.
4. Open the forwarded `NASAQ School ERP` port when GitHub prompts. The port must remain private.
5. Open `/sign-in` and use one of the synthetic starter accounts documented in `docs/SEED_DATA.md`.

The preview URL is temporary and normally follows GitHub's `https://CODESPACENAME-3000.app.github.dev` format. It exists only while the codespace is running.

## Supabase connection and sign-in checks

Prisma is the application's PostgreSQL client; it does not create or operate a
second database. Both the bootstrap workflow and the Codespace must point to the
same Supabase project. GitHub stores Actions secrets and Codespaces secrets
separately, so changing `STARTER_DATABASE_URL` does not update the Codespaces
`DATABASE_URL` automatically.

If the bootstrap workflow passes but browser sign-in does not:

1. Confirm the Codespaces `DATABASE_URL` and `DIRECT_DATABASE_URL` contain the
   same Supabase project reference as the Actions `STARTER_DATABASE_URL`.
2. Stop and restart the Codespace after changing a Codespaces secret.
3. Run `pnpm prisma:generate`, then `pnpm dev`.
4. Open `/api/ready`; continue only when it reports `{"status":"ready"}`.
5. Use the exact value saved as `STARTER_LOGIN_PASSWORD`. GitHub never displays
   an existing secret again; replace it and rerun the bootstrap if its exact
   value is no longer known.

The application accepts the forwarded HTTPS origin used by a private Codespace
while retaining exact-origin enforcement in production. The session cookie is
marked Secure whenever GitHub forwards the request over HTTPS.
