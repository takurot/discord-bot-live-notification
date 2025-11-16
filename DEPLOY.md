# StreamPulse デプロイガイド (P1-T17)

本書は Phase 1 (MVP) を Railway もしくは Render にデプロイする際の手順をまとめたものです。いずれのサービスでも Node.js 20.x および PostgreSQL 15.x を前提とし、Bot はバックグラウンドワーカーとして常駐させます。

---

## 1. 前提条件

- Node.js 20.x（ローカル検証用）
- PostgreSQL（Railway / Render いずれもマネージドDBを利用）
- Discord Bot トークン・クライアントID・テスト用Guild ID
- Twitch API `client_id` / `client_secret`
- `.env` に設定済みの値を本番環境にも反映する

### 共通環境変数

| 変数名 | 必須 | 説明 / 設定先 |
|--------|------|---------------|
| `DISCORD_BOT_TOKEN` | ✅ | Discord Developer Portal の Bot Token |
| `DISCORD_CLIENT_ID` | ✅ | 同アプリケーションの Client ID |
| `DISCORD_GUILD_ID` | ❌ | 開発用Guildに限定配布する場合のみ。未設定ならグローバル登録（最大1時間反映） |
| `TWITCH_CLIENT_ID` | ✅ | Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | ✅ | 同上 |
| `DATABASE_URL` | ✅ | Railway/Render が払い出すPostgreSQL接続文字列。`?sslmode=require&connection_limit=5` を付与 |
| `NODE_ENV` | ✅ | `production` を推奨 |
| `LOG_LEVEL` | ❌ | `info` など |
| `POLLING_INTERVAL_MS` | ❌ | Freeプランのポーリング間隔（ms）。未設定時は 300000 (5分) |

---

## 2. Railway へのデプロイ

### 2.1 プロジェクトの初期化

1. CLI をインストール: `npm i -g railway`
2. ログイン: `railway login`
3. プロジェクト作成: `railway init`
4. リポジトリとリンク: `railway link`

### 2.2 設定ファイル

リポジトリ直下の `railway.json` は以下を定義します。

- Nixpacks ビルド（`npm install && npm run build`）
- スタートコマンド `npm run start`
- Postgres プラグイン（free tier）を自動でアタッチ

Railway 側では Build 時に `npm run build`、Run 時に `node dist/bot/index.js` が実行されます。

### 2.3 データベースと環境変数

1. `railway plugins add postgresql`
2. 接続文字列を取得し、`DATABASE_URL` を `?sslmode=require&connection_limit=5` 付きで上書き  
   例: `railway variables set DATABASE_URL=$(railway status --json | jq -r '.plugins[] | select(.name=="postgresql") | .connectionString')'?sslmode=require&connection_limit=5'`
3. 残りのトークン類を `railway variables set KEY=VALUE` で登録

### 2.4 デプロイ & ヘルスチェック

```bash
railway up --environment production
railway logs -f  # `Logged in as <bot>` が出れば成功
```

Bot ログイン後、Discord の `/ping` または `/status` を実行してレスポンスが返ることを確認してください。Railway には HTTP ヘルスチェックが無いため、ログ + Discord コマンドを組み合わせて監視します。

---

## 3. Render へのデプロイ

### 3.1 Blueprint を使ったデプロイ

1. Render Dashboard → **Blueprints** → **New Blueprint Instance** を選択し、このリポジトリを指定
2. `render.yaml` が自動検出され、以下のリソースが作成されます
   - `streampulse-bot` (Node worker)
   - `streampulse-db` (PostgreSQL)

### 3.2 環境変数の設定

Blueprint 内で以下が処理されます。

- ビルド: `npm install && npm run build`
- 実行: `npm run start`
- `DATABASE_URL` は `streampulse-db` の `connectionString` を参照（Render 側で `?sslmode=require` 付き）

Deploy 後、Render の **Events → Logs** で `Logged in as ...` が表示されれば成功です。Discord 側で `/ping` を実行し、遅延なく返答が来るかを確認してください。

---

## 4. 運用チェックリスト

| 項目 | 方法 |
|------|------|
| Bot ログイン確認 | プラットフォームのリアルタイムログで `Logged in as` を確認 |
| Slash Command 登録 | `/status` 実行時に最新統計が取得できるか |
| Twitch API 資格情報 | `TwitchPollingService` ログに `Missing Twitch API credentials` が出力されていないか |
| DB 接続 (SSL) | Prisma ログに `sslmode=require` が含まれているか |
| Graceful Shutdown | Railway: `railway down`. Render: `Manual Redeploy` 時に `Received SIGTERM` ログが出るか |

---

## 5. トラブルシュート

- **`Invalid token`**: Discord Bot Token を再発行し、Secrets を更新
- **`P1001` (DB接続不可)**: DB のパスワード変更後は `DATABASE_URL` を必ず再設定。Render/ Railway の内向きホスト名を使用
- **Slash Command が反映されない**: `DISCORD_GUILD_ID` を設定している場合は対象ギルドのみ反映。グローバルコマンドに切り替える場合は環境変数を削除
- **高頻度リスタート**: Twitch API 429 → `POLLING_INTERVAL_MS` を延ばすか、Render/Railway の `restartPolicy` 設定を `ON_FAILURE` に変更

---

## 6. 参考コマンド

```bash
# 本番ビルド
npm run build

# 本番と同じスクリプトで起動
NODE_ENV=production LOG_LEVEL=info npm run start

# Prisma マイグレーション
npm run prisma:migrate
```

これらを本番環境で実行することで、Phase 1 (MVP) を Railway / Render の無料枠で安定稼働させることができます。

