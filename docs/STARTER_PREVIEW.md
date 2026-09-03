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
