# Production Deployment

How TeamOS runs in production: one Linux VM running the whole stack through Docker Compose, with Caddy as the only public entry point. For running TeamOS locally, see [`local-development.md`](./local-development.md). This document is about operating the deployed system, not designing it.

## Topology

```text
Internet ──80/443──▶ Azure VM (Ubuntu 24.04, Docker Engine + Compose plugin)
                     docker compose -f docker-compose.prod.yml  (project: teamos-prod)

                     edge network                     data network (internal: no internet)
                     ┌───────────────┐                ┌──────────────────────────────┐
                     │ caddy         │── /api/*  ────▶│ backend  (API + Socket.IO)   │
                     │  TLS, SPA,    │   /socket.io/* │ worker   (BullMQ)            │
                     │  proxy        │   /health      │ migrate  (one-shot)          │
                     └───────────────┘   /ready       │ postgres   redis             │
                                                      └──────────────────────────────┘
```

- **One HTTPS origin.** The SPA, REST API, Better Auth, and Socket.IO are all served from the same `PUBLIC_ORIGIN`, so session cookies are first-party and no cross-origin CORS is involved in normal use.
- **Only `caddy` publishes ports** (80, 443). Postgres and Redis are only on the `data` network, which is `internal: true` and which `caddy` is not attached to. `backend` and `worker` are on both networks: `data` for the databases, `edge` for Caddy's upstream and for outbound internet (the worker calls the Resend API).
- **`migrate` runs before the app.** `backend` and `worker` depend on it with `service_completed_successfully`. A failed migration leaves them stopped and the failure visible in `docker compose ps -a`.
- **`backend` and `worker` share one image** (`teamos-backend:prod`), built from `backend/Dockerfile`. `caddy` runs `teamos-web:prod`, built from `frontend/Dockerfile`: the Vite bundle plus `frontend/Caddyfile`. Both are built by GitHub Actions and pulled from GHCR by commit SHA; the VM doesn't build them (see [Releases](#releases)).

### Azure resources

| Resource | Name | Configuration |
|---|---|---|
| Resource group | `rg-teamos-prod-cin` | `centralindia` |
| VM | `vm-teamos-prod-cin` | `Standard_B2ats_v2` (2 vCPU burstable, 1 GiB RAM), non-zonal, Ubuntu Server 24.04 LTS (Canonical) |
| OS disk | created with the VM | 64 GiB Premium SSD (P6); the only disk, so all Docker volumes live on it |
| Public IP | `pip-teamos-prod-cin` | Standard SKU, static IPv4, Azure DNS label |
| NSG | `nsg-teamos-prod-cin` | inbound 22 from the administrator's IP only, plus 80 and 443 from anywhere |
| VNet / NIC | `vnet-teamos-prod-cin` / `nic-vm-teamos-prod-cin` | default subnet |

## Host preparation

How to prepare a new VM for the stack above, from an empty resource group to a host ready for [Configuration](#configuration). Steps 1–2 run on the administrator's machine (Azure CLI and SSH key); steps 3–7 run over SSH on the VM.

> **Verification status.** Steps 1–6 are adapted from how the current production VM was prepared (2026-10-15). They have been made reusable: placeholders, the `latest` image tag instead of the pinned version, a key passphrase, and `git`. In this exact form they have not been re-run on a fresh VM. Step 7 is new: the initial deployment copied a source archive instead of cloning.

Placeholders: `<resource-group>`, `<region>`, `<vm-name>`, `<dns-label>`, `<admin-public-ip>` (your own public IPv4), `<github-owner>`. The `nsg-$VM`-style names below are an illustrative pattern; the names actually in use are listed under [Azure resources](#azure-resources).

### 1. Azure: network and VM

Run with the Azure CLI, signed in to the intended subscription (`az account show`). On a subscription that has never created a VM, register the providers first. This is a one-time, free subscription change.

```bash
az provider register -n Microsoft.Compute --wait
az provider register -n Microsoft.Network --wait

RG=<resource-group>; LOC=<region>; VM=<vm-name>

az group create -n $RG -l $LOC

# Inbound rules: SSH from the administrator's IP only; HTTP/HTTPS from anywhere. Nothing else.
az network nsg create -g $RG -n nsg-$VM -l $LOC
az network nsg rule create -g $RG --nsg-name nsg-$VM -n Allow-SSH-Admin --priority 1000 \
  --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes <admin-public-ip>/32 --destination-port-ranges 22
az network nsg rule create -g $RG --nsg-name nsg-$VM -n Allow-HTTP-HTTPS --priority 1010 \
  --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes Internet --destination-port-ranges 80 443

az network vnet create -g $RG -n vnet-$VM -l $LOC --address-prefixes 10.20.0.0/16 \
  --subnet-name snet-app --subnet-prefixes 10.20.1.0/24 --network-security-group nsg-$VM

# Static Standard IPv4 with a DNS label: <dns-label>.<region>.cloudapp.azure.com becomes PUBLIC_ORIGIN's host.
az network public-ip create -g $RG -n pip-$VM -l $LOC --sku Standard \
  --allocation-method Static --version IPv4 --dns-name <dns-label>

az network nic create -g $RG -n nic-$VM -l $LOC --vnet-name vnet-$VM --subnet snet-app \
  --public-ip-address pip-$VM

# Ubuntu Server 24.04 LTS (Canonical; no Marketplace purchase plan). No --zone: non-zonal.
az vm create -g $RG -n $VM -l $LOC \
  --image Canonical:ubuntu-24_04-lts:server:latest --size Standard_B2ats_v2 \
  --nics nic-$VM --os-disk-size-gb 64 --storage-sku Premium_LRS \
  --admin-username azureuser --authentication-type ssh \
  --ssh-key-values ~/.ssh/teamos_azure_ed25519.pub
```

Create the SSH key (step 2) before `az vm create`. Check the result with `az resource list -g $RG -o table`: there should be no resources beyond the six above. The DNS label must be free in the region; `az network public-ip create` fails if it isn't.

### 2. SSH access

On the administrator's machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/teamos_azure_ed25519 -C "teamos-azure-admin"   # set a passphrase

cat >> ~/.ssh/config <<'CONF'
Host teamos-vm
    HostName <dns-label>.<region>.cloudapp.azure.com
    User azureuser
    IdentityFile ~/.ssh/teamos_azure_ed25519
    IdentitiesOnly yes
CONF

ssh teamos-vm 'sudo sshd -T | grep -E "^(passwordauthentication|kbdinteractiveauthentication)"'   # both: no
```

- **Keys only.** `--authentication-type ssh` disables password login. Never copy the private key to the VM.
- **Least exposure.** Port 22 is open only to `<admin-public-ip>/32`. When your IP changes, update the rule rather than widening it:
  ```bash
  az network nsg rule update -g $RG --nsg-name nsg-$VM -n Allow-SSH-Admin --source-address-prefixes <new-ip>/32
  ```

### 3. OS updates and Docker Engine

On the VM. This follows Docker's official instructions for Ubuntu (<https://docs.docker.com/engine/install/ubuntu/>); check them for changes before running.

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl git

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker containerd

# Lets azureuser run docker without sudo. Membership of the docker group is
# root-equivalent; azureuser already has sudo. Takes effect at the next login.
sudo usermod -aG docker "$USER"
```

Log out and back in, then verify: `docker version` and `docker compose version` should both print a version without `sudo`.

### 4. Swap (2 GiB)

The VM has about 0.9 GiB of usable RAM. Image builds and the running stack both rely on swap. Create it only if no swap is active:

```bash
if swapon --show --noheadings | grep -q .; then
  echo "Swap already active - not creating another:"; swapon --show
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || { [ -f /swapfile ] && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab; }

echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-teamos-swap.conf
sudo sysctl --system > /dev/null
free -m
```

### 5. Docker log rotation

Container logs otherwise grow without bound on the only disk. Write `daemon.json` only if it doesn't exist yet; if it does, merge the two keys into it by hand rather than overwriting it.

```bash
if [ -e /etc/docker/daemon.json ]; then
  echo "/etc/docker/daemon.json already exists - add \"log-driver\" and \"log-opts\" to it manually:"
  sudo cat /etc/docker/daemon.json
else
  sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  sudo systemctl restart docker
fi
docker info --format '{{.LoggingDriver}}'   # local
```

The setting applies to containers created afterwards. On a host with containers already running, recreate them to pick it up: `dc up -d --force-recreate`, using the `dc` alias defined under [Configuration](#configuration).

### 6. Automatic security updates

```bash
sudo apt-get install -y unattended-upgrades
sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
```

Verify:

```bash
systemctl is-enabled unattended-upgrades                    # enabled
apt-config dump APT::Periodic::Unattended-Upgrade           # ... "1";
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -n 5
```

Unattended upgrades don't reboot the VM. `/var/run/reboot-required` appears when a kernel update needs one. Reboot at a convenient time: every service restarts on its own (`restart: unless-stopped`).

### 7. Application directory and repository

The checkout lives at `~/TeamOS`. Never re-clone over an existing deployment: its `.env.production` files exist only there.

```bash
if [ -e ~/TeamOS ]; then
  echo "~/TeamOS already exists - not cloning. Releases update it; see Releases."
else
  git clone https://github.com/<github-owner>/TeamOS.git ~/TeamOS
fi
```

To convert a host whose `~/TeamOS` is **not** a git checkout:

1. Take a backup first (see [Backups](#backups)).
2. Move the old directory aside (`mv ~/TeamOS ~/TeamOS.previous`).
3. Clone.
4. Copy `.env.production` and `backend/.env.production` across, keeping them `chmod 600`.
5. Remove the old directory only once the new deployment is healthy.

Data is unaffected: Docker volumes belong to the Compose project name (`teamos-prod`), not the directory.

### 8. Next

Create the two env files as described in [Configuration](#configuration). The checkout stays **detached** at the deployed commit from then on: `deploy.sh` moves it, so never `git pull` or switch branches in it. For the very first start of a new host, pull a published release's images and tag them as `:prod`, or build them once on the host (see [Deploying by hand](#deploying-by-hand)), and `dc up -d`; after that, [Releases](#releases) take over.

## Configuration

Two env files exist **only on the VM**, each `chmod 600` and gitignored. Each is copied from its committed `.example`:

| File | Example | Consumed by |
|---|---|---|
| `.env.production` | `.env.production.example` | Compose interpolation: `PUBLIC_ORIGIN`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` |
| `backend/.env.production` | `backend/.env.production.example` | `backend` and `worker` (`env_file`): `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` |

`docker-compose.prod.yml` sets the remaining backend variables itself, so they can't drift:

- `NODE_ENV=production`. This turns on the `Secure` session cookie, HSTS, and fail-fast config validation in `src/config/security.config.ts`.
- `BETTER_AUTH_URL`, `FRONTEND_URL`, and `TRUSTED_ORIGINS` are all set to `PUBLIC_ORIGIN`.
- `TRUST_PROXY_HOPS=1`, because exactly one proxy (Caddy) sits in front of the backend.
- `DATABASE_URL` is empty, so `src/config/database.config.ts` builds the URL from the percent-encoded `POSTGRES_*` parts.
- `REDIS_HOST=redis`.

`PUBLIC_ORIGIN` is also the frontend's `VITE_API_URL` build argument and Caddy's site address.

Every required value is enforced: Compose refuses to interpolate a missing `${VAR:?}`, and the backend and worker throw at startup on missing production config.

Generate secrets on the VM. Never reuse development values:

```bash
openssl rand -hex 32     # POSTGRES_PASSWORD, REDIS_PASSWORD
openssl rand -base64 32  # BETTER_AUTH_SECRET
```

All commands below run from the repository root on the VM and use this alias:

```bash
alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'
```

## Releases

Every merge to `main` is deployed automatically: CI runs again on the merge commit, GitHub Actions publishes images tagged with the commit SHA, and the VM pulls and deploys exactly those images. The VM never builds an image. Automatic deployment is switched on once, after the path to the VM has been proven (repository variable `PRODUCTION_AUTO_DEPLOY`, see [One-time setup](#one-time-setup)); until then, and whenever it is switched off, merges publish images but deploy nothing.

```text
pull request ──▶ Backend CI · Frontend CI · Production images · Deploy tooling      (required checks)
                     │ merge
                     ▼
push to main ──▶ release.yml
                  ├─ backend / frontend / production   the same three CI workflows, on the merge commit
                  ├─ publish   (packages: write)       build → ghcr.io/<owner>/teamos-{backend,web}:<sha>
                  │                                    → anonymous pull + label check, digests in the summary
                  └─ deploy    (id-token: write, environment "production")
                       azure/login (OIDC, no stored credential)
                       → az vm run-command invoke … scripts/ops/run-deploy.sh deploy <sha>    (on the VM, as root)
                         → sudo -u azureuser: scripts/ops/deploy.sh <sha>                    (from that release)
                       → result line → external check of /ready, /health revision, /
```

Nothing in this path runs for a pull request or for any branch other than `main`. `scripts/ci/check-workflows.py` enforces that in CI (the **Deploy tooling** check), together with SHA-pinned actions and per-job least-privilege permissions; its unit tests prove each way of breaking those rules is caught.

### Workflows

| Workflow | Trigger | Jobs (check names) | Token permissions |
|---|---|---|---|
| `backend-ci.yml` | pull request; called by `release.yml` | Backend CI: lint, typecheck, tests (incl. `tests/ops/deploy.test.ts`) | `contents: read` |
| `frontend-ci.yml` | pull request; called by `release.yml` | Frontend CI: lint, tests, typecheck + production build | `contents: read` |
| `production-ci.yml` | pull request; called by `release.yml` | Production images: build both images, run the real `docker-compose.prod.yml` stack with generated throwaway credentials, and apply the same health gate as a deployment (`deploy.sh --verify`) through Caddy. Deploy tooling: shellcheck, actionlint, workflow policy, migration safety | `contents: read` |
| `release.yml` | push to `main` | the three above, then `publish`, then `deploy` (skipped unless `PRODUCTION_AUTO_DEPLOY` is `true`) | none by default; `publish`: `contents: read`, `packages: write`; `deploy`: `contents: read`, `id-token: write` |
| `production-check.yml` | manual (`workflow_dispatch`), `main` only | `preflight` or `verify` on the VM, changes nothing | `contents: read`, `id-token: write` |

`.github/actions/vm-run` is the one place that signs in to Azure and calls Run Command; `release.yml` and `production-check.yml` both use it. Run Command reports a script's output, not its exit status, so the workflow reads the `TEAMOS_DEPLOY_RESULT=` line `deploy.sh` always prints last.

### Images

| Image | Used by | Tag |
|---|---|---|
| `ghcr.io/<owner>/teamos-backend:<sha>` | `backend`, `worker`, `migrate` | full 40-character commit SHA |
| `ghcr.io/<owner>/teamos-web:<sha>` | `caddy` | full 40-character commit SHA |

- **Immutable.** There is no `latest`; a release is its commit SHA. Re-running `publish` for a commit that is already published keeps the existing images.
- **Labels.** `org.opencontainers.image.source`, `.revision` (the commit) and `.created`; the web image also records `teamos.public-origin`, the origin baked into its bundle. The backend image also carries the commit as `APP_REVISION`, which `/health` reports as `revision`.
- **Public packages.** The VM pulls anonymously and holds no registry credential. The images contain only what the public repository already contains; secrets are injected at runtime from the env files and are never in a layer.
- **On the VM** each deployed release is also tagged locally as `teamos-backend:release-<sha>` / `teamos-web:release-<sha>`, and the live one as `teamos-backend:prod` / `teamos-web:prod` — the names `docker-compose.prod.yml` and the ops scripts already use. The current and two previous known-good releases are kept; older ones are pruned.

### What a deployment does

`scripts/ops/deploy.sh <sha>` on the VM, holding a `flock` so only one runs at a time:

1. **Refuses, changing nothing**, if: the SHA isn't a full commit SHA on `origin/main`; the checkout has local modifications; a release *newer* than `<sha>` is already live (result `stale`); the images can't be pulled; their `revision`/`source` labels don't match; the web image was built for a different `PUBLIC_ORIGIN`; a previous migration is marked failed; a pending migration is destructive (see [Database migrations](#database-migrations)); or the pre-deployment backup fails.
2. Runs `scripts/ops/backup.sh`, as every production change starts with one.
3. Tags what is running now as `release-<previous sha>` (the rollback handle), then retags `:prod` to the new images and moves the checkout (detached) to `<sha>`, so the compose file and ops scripts on disk always match the running release.
4. `docker compose up -d --no-build`: `migrate` (new image) applies pending migrations while the previous release is still serving, then `backend` and `worker` are recreated, then `caddy`.
5. **Health gate** (3 consecutive passes within 5 minutes): `migrate` exited 0; `backend`, `worker` and `caddy` run the new image IDs, are healthy and haven't restarted; `postgres` and `redis` are healthy; `$PUBLIC_ORIGIN/ready` is 200, `/health` reports `revision: <sha>`, and the app answers through Caddy.
6. Records the outcome in `~/teamos-ops/releases.log` and `~/teamos-ops/state/current-release`.

Expect a few seconds of 502s and a Socket.IO reconnect while `backend` and `caddy` are recreated; this is a single instance.

| Result (last line) | Exit | Meaning | Workflow |
|---|---|---|---|
| `success` | 0 | live and healthy | green |
| `stale` | 4 | a newer release was already live; nothing changed | green, with a notice |
| `rejected` | 1 | refused before changing anything | red |
| `rolled_back` | 2 | failed the health gate; the previous release was restored and is healthy | red |
| `failed` | 3 | needs a human — see [Recovering from a failed deployment](#recovering-from-a-failed-deployment) | red |

The workflow log is public for this repository, so `deploy.sh` prints only service states, exit codes, image IDs and revisions. Container logs from a failed deployment go to `~/teamos-ops/deploys/<timestamp>-<sha>.log` on the VM (`0600`).

### Verifying the live release

- `curl -fsS "$PUBLIC_ORIGIN/health"` — `revision` is the deployed commit (`null` only for an image built without the release pipeline).
- **Actions → Production check → Run workflow → verify**: on the VM, checks the recorded release is what is running and healthy, and compares it with the public `/health`.
- On the VM: `tail ~/teamos-ops/releases.log`, `cat ~/teamos-ops/state/current-release`, `docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' teamos-backend:prod`.

### One-time setup

These steps are owner actions in GitHub and Azure. Until they are done, `publish` or `deploy` fails with an error naming the missing piece — nothing deploys silently or partially — and `deploy` stays skipped until step 8 switches it on. Do them in this order.

**Before merging the pull request that adds this pipeline**

1. **Repository variable** (Settings → Secrets and variables → Actions → Variables): `PUBLIC_ORIGIN` = the production origin, e.g. `https://<dns-label>.centralindia.cloudapp.azure.com` (no trailing slash). Public, not a secret.
2. **Environment** (Settings → Environments → New environment): `production`.
   - Deployment branches and tags: **Selected branches and tags** → add the rule `main` (branch). Nothing else.
   - **Create it before step 3b, and check the branch rule is saved.** The environment, not the workflow files, is what limits OIDC tokens to `main`: a job on any branch can declare `environment: production`, and GitHub silently creates a missing environment with *no* branch rule. Until this rule exists, the federated credential in step 3b would accept tokens from jobs on any branch someone can push to — and those tokens can run commands as root on the VM.
   - **No required reviewers** — deployment is automatic; a reviewer gate would make it manual. The environment exists to scope the variables below and the OIDC subject.
   - Environment variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_VM_RESOURCE_GROUP` (`rg-teamos-prod-cin`), `AZURE_VM_NAME` (`vm-teamos-prod-cin`). These are identifiers, not credentials. Fill the first three from step 3a. No secrets are needed anywhere.
3. **Azure deployment identity** (Azure CLI, signed in as the subscription owner). A dedicated app registration whose only credential is a federated trust in GitHub's OIDC tokens for the `production` environment, and whose only permission is Run Command on the one VM.

   **3a. Identity and permission.** Inert on its own: the app has no credential of any kind, so nothing can sign in as it yet.

   ```bash
   RG=rg-teamos-prod-cin; VM=vm-teamos-prod-cin
   SUB=$(az account show --query id -o tsv); TENANT=$(az account show --query tenantId -o tsv)
   VM_ID=$(az vm show -g $RG -n $VM --query id -o tsv)

   APP_ID=$(az ad app create --display-name teamos-github-deploy --query appId -o tsv)
   SP_ID=$(az ad sp create --id $APP_ID --query id -o tsv)

   # Custom role: read the VM and run a command on it - nothing else (no start/stop,
   # no delete, no disk, network or extension changes). Custom roles can't be
   # *assignable* below resource-group level, but the assignment itself is scoped
   # to the VM.
   az role definition create --role-definition "{
     \"Name\": \"TeamOS VM Run Command\",
     \"Description\": \"Run Command on the TeamOS production VM (GitHub Actions deploys).\",
     \"Actions\": [\"Microsoft.Compute/virtualMachines/read\", \"Microsoft.Compute/virtualMachines/runCommand/action\"],
     \"AssignableScopes\": [\"/subscriptions/$SUB/resourceGroups/$RG\"]
   }"
   az role assignment create --assignee-object-id $SP_ID --assignee-principal-type ServicePrincipal \
     --role "TeamOS VM Run Command" --scope $VM_ID

   echo "AZURE_CLIENT_ID=$APP_ID AZURE_TENANT_ID=$TENANT AZURE_SUBSCRIPTION_ID=$SUB"
   ```

   **3b. Federated credential — only once step 2's branch rule is in place.** From then on, tokens are accepted only from jobs in this repository's `production` environment, which only `main` can use. The subject uses GitHub's **immutable** form, which names the owner and repository by their numeric IDs as well. A name-only subject would also match a token from a different account that later takes over the name `<github-owner>/TeamOS`:

   ```bash
   OWNER_ID=$(curl -fsS https://api.github.com/repos/<github-owner>/TeamOS | python3 -c 'import json,sys; print(json.load(sys.stdin)["owner"]["id"])')
   REPO_ID=$(curl -fsS https://api.github.com/repos/<github-owner>/TeamOS | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
   az ad app federated-credential create --id $APP_ID --parameters "{
     \"name\": \"github-teamos-production\",
     \"issuer\": \"https://token.actions.githubusercontent.com\",
     \"subject\": \"repo:<github-owner>@$OWNER_ID/TeamOS@$REPO_ID:environment:production\",
     \"audiences\": [\"api://AzureADTokenExchange\"]
   }"
   ```

   Check the result: `az ad app federated-credential list --id $APP_ID -o table` shows exactly that one subject, and `az role assignment list --assignee $APP_ID --all -o table` shows exactly one assignment — `TeamOS VM Run Command` on the VM.

   **3c. Make GitHub issue that subject.** Repositories created before 2026-07-15 still issue the name-only subject (`repo:<github-owner>/TeamOS:…`) unless they opt in, and Azure then rejects every sign-in (`AADSTS700213: No matching federated identity record found`). Opt the repository in under Settings → Actions → OIDC (**Use immutable subject claim**), then check the setting with a request that needs no token:

   ```bash
   curl -fsS https://api.github.com/repos/<github-owner>/TeamOS/actions/oidc/customization/sub
   # "use_immutable_subject": true, "sub_claim_prefix": "repo:<github-owner>@<owner-id>/TeamOS@<repo-id>"
   ```

   The `sub_claim_prefix` followed by `:environment:production` must equal the subject in step 3b, character for character.

   Never create a client secret or certificate for this app, and don't grant it Owner, Contributor or Virtual Machine Contributor. The first Run Command installs Azure's Run Command VM extension, which the platform manages. If `preflight` (step 7) fails with `AuthorizationFailed` on `Microsoft.Compute/locations/operations/read` while polling, add that single read action in a second custom role assigned at subscription scope; the two actions above are the documented requirement for action Run Command.
4. **Branch ruleset** (Settings → Rules → Rulesets → New branch ruleset), targeting the default branch, enforcement **Active**, empty bypass list:
   - Restrict deletions; Block force pushes.
   - Require a pull request before merging, **0** required approvals (a solo maintainer can't approve their own pull request).
   - Require status checks to pass, with *Require branches to be up to date*: `Backend CI`, `Frontend CI`, `Production images`, `Deploy tooling`. A check can only be selected after it has run once — the pipeline's own pull request runs all four.
5. **Actions settings** (Settings → Actions → General): Workflow permissions **Read repository contents and packages permissions** (every workflow declares its own anyway); fork pull request workflows **Require approval for all external contributors**.

Leave the repository variable `PRODUCTION_AUTO_DEPLOY` **unset** until step 8. `production-check.yml` only exists once it is on `main`, so the merge is also what makes `preflight` runnable — and the merge starts `release.yml` at the same time. Without this variable, nothing would stop that run from deploying before `preflight` had ever proved the path to the VM.

**After merging**

6. The merge starts `release.yml`. CI runs, and the first `publish` creates the two GHCR packages. They start **private**, so its anonymous-pull check fails with *Image is not publicly pullable*. For each of `teamos-backend` and `teamos-web` (your profile → Packages → the package → Package settings): confirm it is linked to the repository, then **Change visibility → Public**. Then **Re-run failed jobs**. `publish` keeps the images it already pushed and now passes; `deploy` is **skipped**, with the notice *Automatic deployment is off*.
7. **Actions → Production check → Run workflow** (branch `main`) **→ preflight.** This is the first real use of the GitHub → Azure path. Without changing anything, it proves: the OIDC sign-in (federated credential and subject), the role assignment, Run Command and its status polling, the deploy user, the checkout and `git fetch`, Docker access, and that the stack is running. The result is `ready`. Fix anything it reports and run it again before going on.
8. **Activate automatic deployment:** set the repository variable `PRODUCTION_AUTO_DEPLOY` = `true` (exactly, lowercase). Unset or `false` keeps `deploy` skipped. Any other value fails `publish` with *PRODUCTION_AUTO_DEPLOY is invalid*, so a typo never deploys.
9. **First deployment:** open the latest `release.yml` run on `main` and choose **Re-run all jobs** — not *Re-run failed jobs*, which would keep `publish`'s earlier decision not to deploy. `publish` keeps the published images, and `deploy` performs the first automatic deployment. It records the release that was running before (built on the VM, no revision label) as the baseline it can roll back to. If more pull requests were merged in the meantime, only the newest run needs this: `deploy.sh` refuses anything older than what is live.
10. **Production check → verify**, and `curl "$PUBLIC_ORIGIN/health"`: `revision` is the deployed commit.

From then on, merging a pull request is the deployment.

**Pausing automatic deployment.** Set `PRODUCTION_AUTO_DEPLOY` to `false`. Merges still run CI and publish images, but nothing deploys. To resume, set it back to `true` and re-run all jobs of the newest `release.yml` run. The variable only orders and pauses releases. It is not what keeps other branches away from the VM: that is the environment's `main`-only rule, the federated credential bound to that environment, and the VM-scoped role.

### Deploying by hand

The pipeline is the normal path. By hand, run the same entry point on the VM (over SSH, see [SSH access](#2-ssh-access)):

```bash
cd ~/TeamOS && git fetch
sudo scripts/ops/run-deploy.sh deploy <sha>              # what the workflow runs
git show origin/main:scripts/ops/run-deploy.sh | sudo sh -s deploy <sha>   # if the checkout predates run-deploy.sh
scripts/ops/deploy.sh --verify                           # the live release, healthy?
```

`<sha>`'s images must already be published (its `release.yml` run's `publish` job passed).

**Emergency only — GHCR or Actions unavailable:** build on the VM as before this pipeline existed, one image at a time (a parallel build competes for the 1 GiB of memory, and even a single build briefly degraded `/ready` on 2026-10-28): take a backup, `git checkout --detach <sha>`, `dc build backend && dc build caddy && dc up -d`. Such images report no revision. Afterwards record what is running, so the next `deploy.sh` run starts from the truth: `echo <sha> > ~/teamos-ops/state/current-release`.

## Rollback

**Automatic.** When a new release fails its health gate, `deploy.sh` restores the previous release's images (`:release-<previous sha>` → `:prod`), moves the checkout back, recreates the services and runs the health gate on the previous release (result `rolled_back`). It does this only when it is safe:

| After the failure | Automatic rollback? |
|---|---|
| no migrations were applied | yes |
| only expand migrations were applied | yes — the previous release was already serving against that schema while `migrate` ran; the migrations stay applied |
| a migration **failed** | no — the previous release's containers were never replaced and keep serving; `:prod` and the checkout are pointed back at it (result `failed`) |
| a **contract** migration was applied | no — the previous release may use what it removed (result `failed`) |
| the migration state can't be read | no (result `failed`) |

A database backup is **never** restored automatically.

**By hand, to an earlier release** (images still in GHCR):

```bash
cd ~/TeamOS && scripts/ops/deploy.sh --allow-older <sha>
```

This bypasses only the "newer release is live" protection; every other check, the backup and the health gate still apply. While the faulty commit is the head of `main`, a re-run of its pipeline would deploy it again: prefer rolling forward with a revert pull request, which deploys like any other change.

For the release that was running before this pipeline existed (not in GHCR), while it is still kept locally: `docker tag teamos-backend:release-<sha> teamos-backend:prod && docker tag teamos-web:release-<sha> teamos-web:prod && git checkout --detach <sha> && dc up -d --no-build`, then `echo <sha> > ~/teamos-ops/state/current-release`.

## Database migrations

`migrate` runs **before** `backend` and `worker` are replaced, so for a short window the **previous** release serves against the **new** schema — and a rollback runs it there indefinitely. Every migration that deploys automatically must therefore keep the previous release working: **expand/contract**.

- **Expand** (automatic): add tables, nullable columns, columns with defaults, indexes, enum values; drop indexes or constraints. Ship the schema change first, or together with code that tolerates both shapes.
- **Contract** (manual): drop or rename tables/columns/types, change a column's type, add `NOT NULL`, bulk-delete. Ship it in a **later** release than the code that stopped using what it removes, mark the migration file with the line `-- teamos-migration: contract`, and deploy it by hand once the release that no longer uses it is live: `scripts/ops/deploy.sh --allow-contract <sha>`. The pipeline refuses it (`rejected`), so `main` waits for that manual step.
- `scripts/ops/check-migrations.sh` classifies migrations by pattern (drops, renames, type changes, `SET NOT NULL`, `TRUNCATE`, `DELETE FROM`). CI runs it on migrations a pull request adds and fails on unmarked destructive ones; `deploy.sh` runs it again on the migrations actually pending in production. It is a safety net, not a proof — review each migration for compatibility.
- **Merged migrations are immutable.** CI fails if a pull request edits or renames one: a database that already applied it would never see the change. Add a new migration instead.
- Never run `prisma migrate reset` or `prisma migrate dev` against production. Both can drop data.

## Recovering from a failed deployment

Start from the `TEAMOS_DEPLOY_RESULT` line and the `service state:` block in the deploy job's *VM output*, then read the full diagnostics on the VM: `ls -t ~/teamos-ops/deploys | head -1`, plus `grep ' deploy ' ~/teamos-ops/ops.log | tail`.

- **`rejected`**: nothing changed. The reason is in the output (unpublished or private image, label mismatch, dirty checkout, unsafe migration, backup failure, lock held). Fix the cause; re-run the job, or merge a fix.
- **`rolled_back`**: production is on the previous release and healthy. Find the cause in the diagnostics file, fix it in a pull request; merging it deploys.
- **`failed`, migration failed.** The previous release keeps serving (check the state block). Prisma refuses every further migration until the failed one is resolved:
  1. On the VM, find out what the failed migration did — Postgres may have applied part of it: `dc exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"` (values from `.env.production`), then inspect with `\d "<Table>"`. Undo partial changes by hand, or finish them if that's clearly right.
  2. Record the outcome. The migration must exist in the image that runs the command, so use the failed release's backend image briefly — `migrate` is a one-off container and nothing that is serving is touched:
     ```bash
     docker tag ghcr.io/<owner>/teamos-backend:<failed-sha> teamos-backend:prod
     dc run --rm --no-deps migrate npx prisma migrate resolve --rolled-back <migration_name>   # or --applied
     docker tag teamos-backend:release-<live-sha> teamos-backend:prod
     ```
  3. Fix forward in a pull request. For a migration resolved as rolled back, delete it and add a corrected one with a new timestamp (CI warns on the deletion, by design). Merging deploys it.
- **`failed`, contract migration applied, or the rollback didn't become healthy**: production may be degraded. Look at `dc ps -a` and the diagnostics, then either roll forward with a fix, or deploy a compatible earlier release with `--allow-older`. Restoring the pre-deployment backup ([Disaster recovery](#disaster-recovery-destructive-replaces-live-data)) loses every write since it was taken — it's the last resort, and a decision for the owner.
- **`stale`**: a newer release was already live. Nothing to do.
- **No result line / Azure error**: the workflow output shows the Azure CLI error. `AuthorizationFailed` → the role assignment (setup step 3); `AADSTS700213`/no matching federated identity → the federated credential's subject, or a job outside the `production` environment; `Conflict` → another Run Command is still running on the VM; a timeout → see `~/teamos-ops/deploys/` and `dc ps -a` on the VM (Run Command allows up to 90 minutes).

## Health and observability

| Check | Command |
|---|---|
| Liveness | `curl -fsS "$PUBLIC_ORIGIN/health"` |
| Readiness (Postgres + Redis) | `curl -fsS "$PUBLIC_ORIGIN/ready"` |
| Container state, restarts | `dc ps -a`, `docker inspect -f '{{.RestartCount}}' <container>` |
| Memory, swap | `docker stats --no-stream`, `free -m` |
| Logs | `dc logs --tail=100 <service>` |
| Requests (access log) | `dc logs backend \| grep '"msg":"Request'` |
| One request, end to end | `dc logs backend \| grep '"requestId":"<id>"'`, where the id comes from the response's `X-Request-Id` header |
| Scheduled checks | `tail -n 50 ~/teamos-ops/ops.log` |
| Deployed release | `curl -fsS "$PUBLIC_ORIGIN/health"` (`revision`), `cat ~/teamos-ops/state/current-release` |
| Release history | `tail ~/teamos-ops/releases.log` (`baseline`, `success`, `rolled_back`, `failed`, with image digests) |
| A failed deployment | `ls -t ~/teamos-ops/deploys \| head -1` (container logs captured by `deploy.sh`) |

Docker's daemon-level log rotation (`/etc/docker/daemon.json`, `local` driver with `max-size`/`max-file`) keeps container logs from filling the disk.

### Access log

The backend writes one structured line per request (`src/middleware/request-logger.ts`): request id, method, path, status, latency, the error code from the error envelope, and the user id when signed in. Levels are `info` for success, `warn` for 4xx, and `error` for 5xx. Healthy `/health` and `/ready` probes aren't logged.

The access log never contains headers, cookies, query strings, request bodies, or client IPs. Path segments that look like ids or tokens (e.g. password-reset tokens) are replaced with `:id`.

### Scheduled checks

`scripts/ops/ops-check.sh` appends one line per check to `~/teamos-ops/ops.log` and exits non-zero when something needs attention:

| Level | Condition |
|---|---|
| `ALERT` | `/ready` fails; a service isn't running or is unhealthy; email jobs permanently failed since the previous run; the newest backup is older than 26 hours |
| `WARN` | Less than 150 MB of memory available; root filesystem more than 85% used |

The email check compares the queue's failed set with the previous run, so failures retained from earlier don't alert again.

There's no external alerting service. Read the log after deploys and whenever something seems wrong:

```bash
grep -E ' (ALERT|WARN) ' ~/teamos-ops/ops.log | tail
```

### Cron on the VM

```bash
crontab -e
```

```cron
# m   h  dom mon dow  command
*/15  *  *   *   *    cd ~/TeamOS && scripts/ops/ops-check.sh    >/dev/null 2>&1
15    2  *   *   *    cd ~/TeamOS && scripts/ops/backup.sh       >/dev/null 2>&1
30    3  *   *   0    cd ~/TeamOS && scripts/ops/restore-check.sh >/dev/null 2>&1
```

Output is discarded because every script writes its own result to `~/teamos-ops/ops.log`. The VM has no mail transport for cron output.

## Data and volumes

| Volume | Contents | Mounted at |
|---|---|---|
| `teamos-prod_postgres-data` | PostgreSQL cluster | `postgres:/var/lib/postgresql/data` |
| `teamos-prod_uploads-data` | Attachments and avatars (local storage provider) | `backend` and `worker`: `/usr/src/app/uploads` |
| `teamos-prod_redis-data` | Redis AOF/RDB (BullMQ jobs, rate-limit counters) | `redis:/data` |
| `teamos-prod_caddy-data` | TLS certificates, ACME account | `caddy:/data` |
| `teamos-prod_caddy-config` | Caddy autosaved config | `caddy:/config` |

Named volumes survive `dc down`, container recreation, and VM reboots. **`dc down -v` deletes them all. Never use it in production.**

## Backups

Backups have two stages:

1. **Nightly on the VM:** `scripts/ops/backup.sh`, from the cron entry above, writes to `~/teamos-backups/`:
   - `teamos-db-<ts>.dump`: `pg_dump -Fc`
   - `teamos-uploads-<ts>.tar.gz`: the uploads volume
   - `teamos-<ts>.sha256`

   Each file is verified readable (`pg_restore --list`, `tar -t`) before the run counts as successful. Files are `0600` in a `0700` directory, and sets older than 7 days are pruned. A failed run logs `ALERT backup` and leaves no partial file behind.
2. **Off the box, on the administrator's machine:** these copies share the VM's disk, so they don't survive losing the VM. `scripts/ops/pull-backups.sh` runs on your own machine. It pulls new sets over SSH with `rsync --ignore-existing`, so a damaged remote file can never overwrite a good local copy. It verifies every checksum, keeps 30 days locally, and logs to `~/teamos-backups/pull.log`.

Take an ad-hoc backup (e.g. before a deploy) with:

```bash
scripts/ops/backup.sh                                    # on the VM
scripts/ops/pull-backups.sh                              # then on your machine
```

### Scheduling the pull on your machine

The pull needs an SSH key that loads without a prompt, plus the `teamos-vm` host alias.

The NSG only admits your current public IP. When that IP changes, pulls fail with `ALERT` in `pull.log` until the rule is updated. Check `pull.log` the same way you check the VM's ops log.

- **Linux/macOS:** a user crontab entry, e.g. `0 9 * * * ~/projects/TeamOS/scripts/ops/pull-backups.sh >/dev/null 2>&1`.
- **Windows with WSL:** WSL doesn't run cron unless it's enabled, so use Task Scheduler with a daily trigger and the action `wsl.exe -e bash -lc "~/projects/TeamOS/scripts/ops/pull-backups.sh"`.

### Verifying a restore (non-destructive)

`scripts/ops/restore-check.sh [dump]` does the following:

1. Restores the newest dump (or the one given) into a scratch database `teamos_restore_check` next to the live one, after checking its checksum.
2. Requires the migration count to match the live database and the user table to be non-empty.
3. Logs restored and live row counts side by side.
4. Drops the scratch database, even on failure.

The live database is only read. The weekly cron entry above runs it.

To check a copy on your own machine instead, restore it into a local scratch database with `pg_restore --no-owner -d <scratch-db> teamos-db-<ts>.dump`.

### Orphaned upload files

Files that no attachment or avatar row references can be left on the uploads volume. Before demo cleanup started deleting files, it left behind every expired demo workspace's attachments and every avatar, and a failed file deletion still can. To list them (read-only):

```bash
dc exec backend node dist/src/ops/find-orphan-uploads.js
```

To remove them, take and pull a backup first (the uploads archive is the undo path), review the list, then run the same command with `--delete`. It only removes orphans older than 24 hours, because an upload writes its file just before its row.

### Disaster recovery (destructive: replaces live data)

Only for restoring onto a broken or empty deployment:

```bash
dc stop backend worker
dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < teamos-db-<ts>.dump
docker run --rm -i --entrypoint tar -v teamos-prod_uploads-data:/data teamos-backend:prod -C /data -xzf - < teamos-uploads-<ts>.tar.gz
dc up -d
```

## Email

The worker sends all transactional email (verification, password reset, invitations) through Resend, and refuses to start in production without `RESEND_API_KEY` and `EMAIL_FROM`.

Until a domain is verified in Resend, the only usable sender is `onboarding@resend.dev`, and Resend then **delivers only to the Resend account owner's own address**. Mail to anyone else fails in the worker, and BullMQ retries it.

The consequences:

- Self-service sign-up only completes for that one address.
- Invitations to other people don't arrive.
- The `/try` demo is unaffected: demo provisioning marks its synthetic accounts verified itself and never enqueues verification email for them (see [`../features/demo.md`](../features/demo.md#provisioning)).

Email verification stays required regardless. The fix is a verified sending domain, not relaxing verification.

### Failure visibility

Sign-up, resend-verification, password-reset, and invitation requests only enqueue a BullMQ job, so the UI deliberately says an email was *requested* or *queued*, never *sent*. Delivery happens later in the worker:

- Each failed attempt is logged at `warn` with `"msg":"Email job attempt failed; it will be retried"`.
- After the fifth attempt the job is logged at `error` with `"alert":"EMAIL_DELIVERY_FAILED"` and kept in the queue's failed set (7 days, at most 1,000 jobs).
- Logged error messages have email addresses redacted, because provider errors can contain them.

```bash
dc logs worker | grep -c EMAIL_DELIVERY_FAILED
```

### Verifying a sending domain

`*.cloudapp.azure.com` can't be verified in Resend, because its DNS isn't yours. You need a domain whose DNS you control. A subdomain used only for mail (e.g. `mail.example.com`) keeps it separate from anything else on the domain. The site itself can stay on `PUBLIC_ORIGIN`, because the sender domain and the site origin are independent.

1. In the Resend dashboard, add the domain, choosing the region closest to the VM.
2. At your DNS provider, create exactly the records Resend shows. Copy the values from the dashboard, not from here. At the time of writing they are:

   | Purpose | Type | Name (relative to the domain) | Value |
   |---|---|---|---|
   | DKIM | TXT | `resend._domainkey` | the public key shown in the dashboard |
   | SPF (return path) | MX | `send` | `feedback-smtp.<region>.amazonses.com`, priority 10 |
   | SPF (return path) | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
   | DMARC (recommended) | TXT | `_dmarc` | `v=DMARC1; p=none;` to start, tightened once mail flows |

3. Wait until Resend shows the domain as **Verified**.
4. Take a backup (see [Backups](#backups)). The change touches no data, but every production change starts with one.
5. On the VM, record the current sender for rollback, then set the new one:

   ```bash
   grep '^EMAIL_FROM=' backend/.env.production    # note this value for rollback
   # Edit backend/.env.production so that, for example:
   #   EMAIL_FROM="TeamOS <no-reply@mail.example.com>"
   dc up -d --no-deps --force-recreate worker
   dc logs --tail=20 worker                        # "Email worker is ready."
   ```

   Only the worker sends email. `RESEND_API_KEY` doesn't change.

### Post-change delivery smoke test

Use a mailbox you control that is **not** the Resend account owner's address; that's the case the sandbox sender could never deliver. A mocked Resend test can't prove delivery; only this can.

1. Register at `$PUBLIC_ORIGIN/register` with the test mailbox.
2. The verification email arrives within about two minutes. In the message source, check `SPF: PASS`, `DKIM: PASS`, and the `From` domain.
3. The link opens `$PUBLIC_ORIGIN/verify-email` without an error, and signing in then succeeds.
4. Request a password reset for the same address, follow the link, set a new password, and sign in with it.
5. `dc logs --since 15m worker | grep -c EMAIL_DELIVERY_FAILED` prints `0`.

Accounts that registered while the sandbox sender was in place stay unverified until they request a new link. "Resend verification email" on the login screen does that. Don't mark accounts verified in the database.

### Rolling back

Restore the previous `EMAIL_FROM` value in `backend/.env.production` and run `dc up -d --no-deps --force-recreate worker`. No data changes in either direction. Jobs that fail in the meantime stay in the failed set and are visible as described above.

## Stopping, costs, and removal

| Action | Command | Still billed |
|---|---|---|
| Stop the app, keep the VM | `dc down` (no `-v`) | VM compute, disk, public IP |
| Stop the VM | `az vm deallocate -g rg-teamos-prod-cin -n vm-teamos-prod-cin` | OS disk, static public IP |
| Restart | `az vm start ...`, then `dc up -d` if containers weren't set to restart | — |
| Remove everything | Back up first, then `az group delete -n rg-teamos-prod-cin` | nothing (irreversible: deletes the disk and all data) |

The VM runs on an Azure for Students subscription with the spending limit on. When the credit is exhausted or expires, Azure disables the subscription and deallocates the VM: the site goes offline, but nothing is charged beyond the credit. A Cost Management budget alert only notifies; it never stops spending.
