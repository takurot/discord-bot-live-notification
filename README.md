# StreamPulse Bot

Discord Bot for Twitch and YouTube live stream notifications.

## 概要

StreamPulseは、TwitchおよびYouTubeのライブ配信開始を検知し、Discordサーバーの指定チャンネルに自動で通知を行うBotです。

## 機能

### Phase 1 (MVP)
- Twitch配信検知・通知機能（Freeプラン・ポーリング方式）
- 基本コマンド（`/notify add/remove/list/test`, `/status`, `/ping`）

### Phase 2 (予定)
- YouTube配信検知・通知機能
- Proプラン機能（メンション、カスタマイズ、Webhook方式）

### Phase 3 (予定)
- Stripe決済機能
- Webダッシュボード
- 監視・メトリクス収集

## セットアップ

### 必要な環境

- Node.js 20.x 以上
- PostgreSQL 15.x 以上
- npm または yarn

### インストール手順

1. リポジトリをクローン
```bash
git clone <repository-url>
cd discord-bot-live-notification
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

4. データベースをセットアップ
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Botを起動
```bash
# 開発環境
npm run dev

# 本番環境
npm run build
npm start
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DISCORD_BOT_TOKEN` | Discord Botトークン | ✅ |
| `DISCORD_CLIENT_ID` | Discord アプリケーションID | ✅ |
| `DISCORD_GUILD_ID` | テスト用Guild ID（開発時） | ❌ |
| `DATABASE_URL` | PostgreSQL接続URL | ✅ |
| `TWITCH_CLIENT_ID` | Twitch API Client ID | ✅ |
| `TWITCH_CLIENT_SECRET` | Twitch API Client Secret | ✅ |
| `NODE_ENV` | 実行環境（development/production） | ❌ |
| `LOG_LEVEL` | ログレベル（debug/info/warn/error） | ❌ |
| `POLLING_INTERVAL_MS` | Twitchポーリング間隔（ミリ秒 / 既定: 300000） | ❌ |

## コマンド

### 開発用コマンド

- `npm run dev` - 開発モードで起動（ホットリロード）
- `npm run build` - TypeScriptをコンパイル
- `npm start` - コンパイル済みのBotを起動
- `npm test` - テストを実行
- `npm run test:watch` - テストをウォッチモードで実行
- `npm run test:coverage` - テストカバレッジを取得
- `npm run lint` - ESLintでコードをチェック
- `npm run lint:fix` - ESLintで自動修正
- `npm run typecheck` - TypeScript型チェックのみ実行
- `npm run format` - Prettierでコードをフォーマット
- `npm run prisma:generate` - Prisma Clientを生成
- `npm run prisma:migrate` - データベースマイグレーションを実行
- `npm run prisma:studio` - Prisma Studioを起動
# CI/CD

- GitHub Actions（`.github/workflows/ci.yml`）で lint / typecheck / Jest（カバレッジ付き）を自動実行
- テスト結果およびカバレッジは PR に自動コメントされ、`coverage/` ディレクトリはアーティファクトとして保存されます
- ローカルで同等のチェックを行いたい場合は `npm run lint && npm run typecheck && npm run test:coverage -- --runInBand` を実行してください

- `npm run docker:dev` - Docker ComposeでBot + PostgreSQLを起動
- `npm run docker:migrate` - コンテナ経由でマイグレーションを実行
- `npm run docker:logs` - Dockerコンテナのログをフォロー
- `npm run docker:down` - Docker Compose環境を停止

### Docker Compose でのローカル起動

1. `.env` に必要な値を設定（`DATABASE_URL` はホスト用の設定で問題ありません。Botコンテナは自動で `postgres` サービスを参照します）
2. 初回のみマイグレーションを実行  
   `npm run docker:migrate`
3. Bot と PostgreSQL を起動  
   `npm run docker:dev`
4. ログを確認したい場合  
   `npm run docker:logs`
5. 作業終了時  
   `npm run docker:down`

## デプロイ

- 本番デプロイ手順（Railway / Render）、必要な環境変数、ポストデプロイチェックは `DEPLOY.md` にまとめています。
- テンプレート:
  - `railway.json`: Railway CLI で `railway up` を実行する際の設定（Nixpacks + workerサービス）
  - `render.yaml`: Render Blueprint（Node worker + PostgreSQL）
- いずれも `npm run build` → `npm run start` を前提としています。ローカルでも同じ手順で確認してからデプロイすることを推奨します。

## プロジェクト構造

```
src/
├── bot/              # Discord Bot関連
│   ├── index.ts      # Bot起動処理
│   └── commands/     # スラッシュコマンド
├── services/         # 外部API連携
│   ├── twitch/       # Twitch API
│   └── youtube/      # YouTube API (Phase 2)
├── models/           # データアクセス層
│   └── repositories/ # Repositoryパターン
├── utils/            # ユーティリティ
│   └── logger.ts     # ロガー
└── types/            # TypeScript型定義
```

## テスト

テスト駆動開発（TDD）で開発しています。

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ取得
npm run test:coverage
```

## ライセンス

MIT

## 参考資料

- [仕様書](./prompt/SPEC.md)
- [実装計画](./prompt/PLAN.md)

