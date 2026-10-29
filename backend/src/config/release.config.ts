const COMMIT_SHA = /^[0-9a-f]{40}$/;

/**
 * The commit this build was made from. backend/Dockerfile bakes it into the
 * production image as APP_REVISION (from the Release workflow's build
 * argument), next to the image's org.opencontainers.image.revision label, so
 * scripts/ops/deploy.sh can check that the process answering /health is the
 * release it just deployed.
 *
 * Anything that isn't a full commit SHA - unset in development and tests, or
 * an image built locally without the build argument - reports as null, so
 * /health can never echo arbitrary environment content.
 */
export function parseAppRevision(value: string | undefined): string | null {
  return value !== undefined && COMMIT_SHA.test(value) ? value : null;
}

export const appRevision = parseAppRevision(process.env.APP_REVISION);
