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
- **`backend` and `worker` share one image** (`teamos-backend:prod`), built from `backend/Dockerfile`. `caddy` runs `teamos-web:prod`, built from `frontend/Dockerfile`: the Vite bundle plus `frontend/Caddyfile`.

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
  echo "~/TeamOS already exists - not cloning. Update it as described under Deploying."
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

Create the two env files as described in [Configuration](#configuration), then build and start the stack as described in [Deploying](#deploying).

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

## Deploying

```bash
dc build backend        # builds teamos-backend:prod (also used by migrate and worker)
dc build caddy          # builds teamos-web:prod
dc up -d
dc ps -a                # migrate: Exited (0); every other service: healthy
dc logs migrate         # "All migrations have been successfully applied." / "No pending migrations"
```

Build the two images one at a time. On a 1 GiB VM a parallel build competes for memory.

To deploy a new version:

1. Take a backup first: run `scripts/ops/backup.sh` on the VM, then `scripts/ops/pull-backups.sh` on your machine (see [Backups](#backups)).
2. Update the checkout: `git pull --ff-only`.
3. Run `dc build backend && dc build caddy && dc up -d`.

Compose recreates the containers whose image changed. `migrate` runs again and applies only pending migrations.

Never run `prisma migrate reset` or `prisma migrate dev` against production. Both can drop data.

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
