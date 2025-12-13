# StreamPulse デプロイガイド (P1-T20: Google Cloud への移行)

Railway/Render を参照運用から外し、Google Cloud (Cloud Run + Cloud SQL + Secret Manager) を標準デプロイ先とします。GitHub Actions も Cloud Run デプロイに切り替えました。

---

## 1. 前提条件

- GCP プロジェクト + Billing 有効化済み
- Cloud Run / Artifact Registry / Cloud Build / Secret Manager / Cloud SQL API を有効化
- gcloud CLI v450+（手動デプロイ・初期セットアップ用）
- Discord/Twitch/YouTube の各種トークン/APIキー

### 必須環境変数（Secret Manager に格納）

| 変数名 | 用途 |
|--------|------|
| `DISCORD_BOT_TOKEN` | Discord Bot トークン |
| `DISCORD_CLIENT_ID` | Discord アプリケーションID |
| `TWITCH_CLIENT_ID` | Twitch API Client ID |
| `TWITCH_CLIENT_SECRET` | Twitch API Client Secret |
| `YOUTUBE_API_KEY` | YouTube Data API v3 キー |
| `DATABASE_URL` | PostgreSQL 接続文字列（Cloud SQL、後述フォーマット） |
| `CALLBACK_URL` | PubSubHubbub/YouTube Webhook の公開URL（Cloud RunのURLを指定） |
| `LOG_LEVEL` / `POLLING_INTERVAL_MS` | 任意 |

---

## 2. インフラ構成（推奨）

- **Cloud Run**: `streampulse-bot`（HTTP: 3000, `min-instances=0`, `max-instances=2`, `allow-unauthenticated`）
- **Artifact Registry**: `${REGION}-docker.pkg.dev/<PROJECT>/<REPO>/streampulse-bot`
- **Cloud SQL for PostgreSQL 15**: バックアップ有効化、最小サイズから開始
- **Secret Manager**: 上記環境変数を格納
- **(任意) Cloud Scheduler**: 定期ウォームアップでコールドスタートを緩和

### Cloud SQL 用 `DATABASE_URL` 例（Unix ソケット接続）
`postgresql://<USER>:<PASS>@/<DB>?host=/cloudsql/<INSTANCE_CONNECTION_NAME>&sslmode=disable`

デプロイ時に `--add-cloudsql-instances <INSTANCE_CONNECTION_NAME>` を指定すると Cloud Run 側でソケットが公開されます。

---

## 3. サービスアカウントと権限

- **デプロイ用 (GitHub Actions)**  
  - 役割: `Artifact Registry Writer`, `Cloud Run Admin`, `Cloud Build Editor`, `Service Account Token Creator`
  - Workload Identity Federation 設定: GitHub リポジトリと OIDC で紐付け
- **実行用 (ランタイム)**  
  - 役割: `Cloud SQL Client`, `Secret Manager Secret Accessor`, `Logging Writer`, `Monitoring Metric Writer`
  - Cloud Run デプロイ時に `--service-account` で指定

---

## 4. 手動デプロイ手順（初回検証）

```bash
PROJECT_ID=<your-project>
REGION=us-central1
REPO=streampulse
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/streampulse-bot:manual"
SERVICE=streampulse-bot
INSTANCE=<INSTANCE_CONNECTION_NAME>  # 例: myproj:us-central1:streampulse-db

# Artifact Registry 認証
gcloud auth configure-docker "${REGION}-docker.pkg.dev"

# ビルド & プッシュ（Dockerfile は本番用 multi-stage）
gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" .

# Secret Manager から環境変数を注入する場合の例
SECRETS="DISCORD_BOT_TOKEN=projects/${PROJECT_ID}/secrets/DISCORD_BOT_TOKEN:latest,\
DISCORD_CLIENT_ID=projects/${PROJECT_ID}/secrets/DISCORD_CLIENT_ID:latest,\
TWITCH_CLIENT_ID=projects/${PROJECT_ID}/secrets/TWITCH_CLIENT_ID:latest,\
TWITCH_CLIENT_SECRET=projects/${PROJECT_ID}/secrets/TWITCH_CLIENT_SECRET:latest,\
YOUTUBE_API_KEY=projects/${PROJECT_ID}/secrets/YOUTUBE_API_KEY:latest,\
DATABASE_URL=projects/${PROJECT_ID}/secrets/DATABASE_URL:latest,\
CALLBACK_URL=projects/${PROJECT_ID}/secrets/CALLBACK_URL:latest"

gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --allow-unauthenticated \
  --port=3000 \
  --min-instances=0 \
  --max-instances=2 \
  --cpu=1 \
  --memory=512Mi \
  --set-env-vars "NODE_ENV=production,PORT=3000" \
  --set-secrets "${SECRETS}" \
  --add-cloudsql-instances "${INSTANCE}" \
  --service-account "<runtime-service-account-email>"
```

デプロイ後、`gcloud run services describe ${SERVICE} --region ${REGION}` で URL を取得し、`CALLBACK_URL` として設定します。

---

## 5. GitHub Actions（Cloud Run デプロイ）

ワークフロー: `.github/workflows/deploy-cloud-run.yml`

- トリガー: `push` to `main` / `workflow_dispatch`
- ビルド: Cloud Build で Artifact Registry にプッシュ
- デプロイ: Cloud Run `streampulse-bot`

### 必須 Secrets
- `GCP_PROJECT_ID`: デプロイ先プロジェクト
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: WIF プロバイダリソースパス
- `GCP_SERVICE_ACCOUNT`: デプロイ用サービスアカウントメール

### 任意 Secrets / Vars
- `GCP_RUNTIME_SERVICE_ACCOUNT`: 実行用サービスアカウント（未設定なら Cloud Run 既定SA）
- `GCP_CLOUD_SQL_INSTANCE`: Cloud SQL 接続名（`project:region:instance`）
- `CLOUD_RUN_SECRET_MAPPINGS`: `KEY=projects/<PROJECT>/secrets/<NAME>:latest,...` 形式
- Vars: `GCP_REGION` (default: `us-central1`), `CLOUD_RUN_SERVICE` (default: `streampulse-bot`), `ARTIFACT_REPOSITORY` (default: `streampulse`)

> Note: Railway/Render へのデプロイは GitHub Actions から外しました。`railway.json` / `render.yaml` は参考用に残していますが、運用は Cloud Run に寄せてください。

---

## 6. 運用チェックリスト

| 項目 | 方法 |
|------|------|
| Bot ログイン確認 | Cloud Run ログで `Logged in as` を確認 |
| Slash Command 登録 | `/status` が即時応答するか |
| DB 接続 | Prisma ログでエラーなし、Cloud SQL 接続数が増えているか |
| Webhook疎通 | `https://<cloud-run-url>/callback` へ PubSubHubbub verification が通るか |
| スケールゼロ | アイドル時にインスタンス 0 へ戻るか（Cloud Run console で確認） |

---

## 7. トラブルシュート

- `P1001` (DB接続不可): `DATABASE_URL` のソケットパスと Cloud SQL インスタンス指定を確認。SA に `Cloud SQL Client` が付与されているかを確認。
- Slash Command 未反映: `DISCORD_GUILD_ID` を設定している場合は対象ギルドのみ。グローバル化は環境変数を外す。
- コールドスタート遅延: `min-instances=0` を `1` に、または Cloud Scheduler で 5 分おきに `/health` を叩く。

---

## 8. 参考コマンド

```bash
npm run lint && npm run typecheck && npm run test:coverage -- --runInBand
npm run build
NODE_ENV=production LOG_LEVEL=info npm run start
```
