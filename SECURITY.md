# Security Policy

## Secret handling

Do not commit API keys, service-role keys, access tokens, passwords, private certificates, or real `.env` files. Local configuration belongs in ignored environment files; documented variable names and non-secret placeholders belong in `.env.example`.

If a real credential is ever committed, deleting the file is not sufficient. The credential must be treated as exposed, rotated or revoked at its provider, deployment configuration updated, and repository history assessed separately.

## Data boundaries

Signal AI Suite is designed around workspace-scoped access controls, auditability, and evidence-grounded AI outputs. Do not use sample or development deployments to store sensitive production datasets unless the deployment has been separately reviewed and configured for that data classification.

## Reporting

Report suspected security issues privately to the repository owner rather than placing secrets or exploit details in a public issue. Include the affected component, reproduction conditions, and impact without including live credentials.

## Verification

CI rejects tracked non-template environment files and runs linting, type checking, unit tests, and a production build. Passing CI is evidence for those checks only; it is not a blanket security certification.
