# StreamPulse 実装計画書

**対象仕様:** `SPEC.md` (配信通知ボット「StreamPulse」要件定義書)  
**計画作成日:** 2025-11-14  
**最終更新日:** 2025-11-16  
**MVP範囲:** Twitch対応・Freeプラン（ポーリング方式）・基本コマンド実装

## 📊 全体進捗状況

| Phase | 状態 | 完了タスク | 総タスク数 | 進捗率 |
|-------|------|------------|------------|---------|
| **Phase 1 (MVP)** | 🔄 進行中 | 17 | 19 | 89% |
| **Phase 2 (機能拡張)** | ⏸️ 未開始 | 0 | 9 | 0% |
| **Phase 3 (運用強化)** | ⏸️ 未開始 | 0 | 4 | 0% |

**最新コミット:** 18件  
**実装ファイル:** 41個  
**テストファイル:** 22個  
**総テスト数:** 86個（全てパス）

**直近の完了タスク:**
- ✅ P1-T01: プロジェクト初期セットアップ
- ✅ P1-T02: データベーススキーマ設計＆マイグレーション
- ✅ P1-T03: Discord Bot 基本起動＆ヘルスチェック
- ✅ P1-T04: Twitch API クライアント実装
- ✅ P1-T05: データアクセス層（Repository）実装
- ✅ P1-T06: `/notify add` コマンド実装
- ✅ P1-T07: `/notify remove` コマンド実装
- ✅ P1-T08: `/notify list` コマンド実装
- ✅ P1-T09: `/notify test` コマンド実装
- ✅ P1-T10: `/status` コマンド実装
- ✅ P1-T11: ポーリング管理コンポーネント実装
- ✅ P1-T12: 通知送信サービス実装
- ✅ P1-T13: 配信終了通知更新
- ✅ P1-T14: エラーハンドリング＆ロギング強化
- ✅ P1-T15: Docker Compose 環境構築
- ✅ P1-T16: CI/CD パイプライン構築
- ✅ P1-T17: 本番デプロイ設定（Railway / Render） ⭐ NEW

**次のタスク:** ⏳ P1-T18: 統合テスト・E2Eテスト整備

---

## 📋 目次

1. [実装方針](#実装方針)
2. [技術スタック確定](#技術スタック確定)
3. [フェーズ構成](#フェーズ構成)
4. [タスク一覧（PR単位）](#タスク一覧pr単位)
5. [テスト計画](#テスト計画)
6. [依存関係図](#依存関係図)
7. [リリース計画](#リリース計画)

---

## 実装方針

### 基本原則
- **PR単位は人間が1〜2時間でレビュー可能な粒度**とする（目安: 変更ファイル数5〜15個、差分500行以内）
- **各PRは独立してテスト可能**な状態でマージする
- **依存関係を明確化**し、並列化できるタスクは積極的に並列実施する
- **MVP完成後に動作検証を行い**、問題なければフェーズ2（YouTube対応・Pro機能）へ進む

### 開発環境
- **メインブランチ:** `main`
- **開発ブランチ:** `feature/タスクID-機能名`
- **マージ方式:** Squash and Merge（PRごとに1コミットに集約）
- **レビュー方針:** 最低1名のレビュー承認後にマージ

### 前提・制約
- **対象範囲（MVP）:** `SPEC.md` の「10. MVP範囲」にあるとおり、Twitch + Freeプランのみを対象とし、YouTube・Pro機能はPhase 2以降のスコープとする。
- **非目標（Non-goals）:** Phase 1では課金・ダッシュボード・監視基盤の完成は目指さず、「配信検知〜通知」が安定して動くことを最優先とする。
- **技術選定の理由:** `SPEC.md` ではPython/Node.js両案が挙がっているが、非同期I/Oとdiscord.jsエコシステムを重視してNode.js + TypeScriptを採用する。
- **開発体制想定:** 1〜2名の開発者を想定し、Phase 1では「1タスク ≒ 1〜2PR」「週あたり1〜3PR」を目安とする。

---

## 技術スタック確定

### 言語・フレームワーク
- **言語:** Node.js 20.x (LTS)
- **Discord Bot:** discord.js v14.x
- **データベース:** PostgreSQL 15.x
- **ORM:** Prisma 5.x（型安全・マイグレーション管理が容易）

### インフラ（MVP段階）
- **開発環境:** ローカルDocker Compose（Bot + PostgreSQL）
- **本番環境:** Railway / Render / Heroku のいずれか（常時稼働VPS）
- **環境変数管理:** `.env` (開発) / プラットフォーム組み込みSecrets (本番)

### API・外部サービス
- **Twitch API (Helix):** ユーザー情報取得・配信ステータス取得
- **Twitch EventSub:** フェーズ2で導入（Pro機能）
- **YouTube Data API v3 + PubSubHubbub:** フェーズ2で導入

---

## フェーズ構成

### フェーズ1: MVP（Twitch対応・Freeプラン基本機能）
**目標:** `/notify add/remove/list/test` + Twitch配信検知 + Discord通知が動作する最小構成を完成させる。  
**期間目安:** 4〜6週間  
**完了条件:**
- Twitch配信者を登録し、配信開始を検知して通知される
- コマンドが正常に動作し、エラーハンドリングも実装済み
- ユニットテスト・統合テストがパスする
- 本番環境（Railway等）にデプロイ可能

### フェーズ2: 機能拡張（YouTube対応・Pro機能）
**目標:** YouTube対応 + Webhook方式（EventSub/PubSubHubbub） + Pro機能（メンション、カスタマイズ）を追加。  
**期間目安:** 6〜8週間  
**完了条件:**
- YouTube配信も検知・通知可能
- Pro契約サーバーでは即時通知（Webhook）が有効
- メンション・カスタマイズ機能が動作

### フェーズ3: 運用強化・収益化基盤
**目標:** Stripe連携・Webダッシュボード・監視・ログ強化など。  
**期間目安:** 4〜6週間  
**完了条件:**
- サブスク決済が可能
- 管理用Webダッシュボードで統計情報を閲覧可能
- Prometheusなどでメトリクス監視が動作

---

## タスク一覧（PR単位）

**凡例:**
- **依存:** このタスクが依存する先行タスクID
- **並列可能:** ✅（他タスクと並行作業可）、❌（先行タスク完了後）
- **テスト:** 各PRに含まれるテストの種類

---

### **Phase 1: MVP - Twitch対応・Freeプラン基本機能** 【進行中: 7/19タスク完了】

**進捗状況:** 
- ✅ 完了: 7タスク（P1-T01 〜 P1-T07）
- ⏳ 次: P1-T08 `/notify list` コマンド実装
- 📊 進捗率: 37% (7/19)

---

#### **✅ P1-T01: プロジェクト初期セットアップ** 【完了】
- **説明:** Node.js + TypeScript + discord.js + Prismaの初期構成を作成
- **内容:**
  - `package.json`, `tsconfig.json`, `.gitignore`, `.env.example` 作成
  - discord.js v14, Prisma, dotenv, eslint, prettier のインストール
  - `src/` ディレクトリ構成（`bot/`, `services/`, `models/`, `utils/`）
  - README.md（セットアップ手順、環境変数説明）
- **依存:** なし
- **並列可能:** ✅
- **テスト:** なし（セットアップのみ）
- **PRサイズ:** 小（10ファイル程度）

---

#### **✅ P1-T02: データベーススキーマ設計＆マイグレーション** 【完了】
- **説明:** Prismaスキーマ定義とマイグレーション作成
- **内容:**
  - `prisma/schema.prisma` に `servers`, `streamers`, `subscriptions` テーブル定義
  - 初期マイグレーションファイル生成 (`prisma migrate dev`)
  - シードデータ作成（開発用テストデータ）
- **依存:** P1-T01
- **並列可能:** ❌
- **テスト:** マイグレーション実行確認、型生成確認
- **PRサイズ:** 小（5ファイル程度）

---

#### **✅ P1-T03: Discord Bot 基本起動＆ヘルスチェック** 【完了】
- **説明:** Botがログインし、`/ping` コマンドに応答する最小構成
- **内容:**
  - `src/bot/index.ts` にBot起動処理
  - Discord Botトークン読み込み、ログイン処理
  - `/ping` コマンド（Slash Command）登録・実装
  - エラーハンドリング（起動失敗時のログ出力）
- **依存:** P1-T01
- **並列可能:** P1-T02と並行可能 ✅
- **テスト:** 手動テスト（Bot起動 + `/ping` 実行）
- **PRサイズ:** 小（5ファイル程度）

---

#### **✅ P1-T04: Twitch API クライアント実装** 【完了】
- **説明:** Twitch API (Helix) を叩くクライアントクラスを実装
- **内容:**
  - `src/services/twitch/TwitchApiClient.ts` 作成
  - OAuth2 App Access Token取得処理（Client Credentials Flow）
  - ユーザー情報取得 (`GET /users`)
  - 配信ステータス取得 (`GET /streams`)
  - エラーハンドリング（APIレート制限、タイムアウト）
- **依存:** P1-T01
- **並列可能:** P1-T02, P1-T03と並行可能 ✅
- **テスト:** ユニットテスト（モックAPI使用）、統合テスト（実際のAPI呼び出し）
- **PRサイズ:** 中（5〜8ファイル）

---

#### **✅ P1-T05: データアクセス層（Repository）実装** 【完了】
- **説明:** DB操作を抽象化したRepositoryパターンを実装
- **内容:**
  - `src/models/ServerRepository.ts`
  - `src/models/StreamerRepository.ts`
  - `src/models/SubscriptionRepository.ts`
  - CRUD操作（Create, Read, Update, Delete）のメソッド実装
  - Prisma Clientを利用したクエリ実装
- **依存:** P1-T02
- **並列可能:** P1-T03, P1-T04と並行可能 ✅
- **テスト:** ユニットテスト（テストDB使用）
- **PRサイズ:** 中（6〜10ファイル）

---

#### **✅ P1-T06: `/notify add` コマンド実装** 【完了】
- **説明:** 配信者をサーバーの監視リストに追加するコマンド
- **内容:**
  - `src/bot/commands/notify/add.ts` 作成
  - URLパース（Twitch URL → チャンネル名抽出）
  - Twitch API でユーザー情報取得・検証
  - DB登録処理（Streamer + Subscription）
  - 無料プラン枠制限チェック（3枠まで）
  - エラーハンドリング（無効URL、存在しないチャンネル、枠上限）
- **依存:** P1-T03, P1-T04, P1-T05
- **並列可能:** ❌
- **テスト:** ユニットテスト、統合テスト（実際にコマンド実行）
- **PRサイズ:** 中（10ファイル、715行追加）
- **PR:** #1

---

#### **✅ P1-T07: `/notify remove` コマンド実装** 【完了】
- **説明:** 監視リストから配信者を削除するコマンド
- **内容:**
  - `src/bot/commands/notify/remove.ts` 作成
  - URLパース（Twitch URL → チャンネル名抽出）
  - Streamer検索・Subscription削除
  - DB削除処理（Subscription削除）
  - エラーハンドリング（未登録の配信者、無効URL、サーバーID未取得）
- **依存:** P1-T06
- **並列可能:** P1-T08と並行可能 ✅
- **テスト:** ユニットテスト（5テスト、全てパス）
- **PRサイズ:** 小（3ファイル）

---

#### **✅ P1-T08: `/notify list` コマンド実装** 【完了】
- **説明:** 現在監視中の配信者一覧を表示
- **内容:**
  - `src/bot/commands/notify/list.ts` 作成
  - DB取得処理（サーバーごとの Subscription 取得）
  - Embed形式で整形して表示（Twitchブランドカラー、配信者情報、URL）
  - プラン枠使用状況をフッターに表示
- **依存:** P1-T06
- **並列可能:** P1-T07と並行可能 ✅
- **テスト:** ユニットテスト（4テスト、全てパス）
- **PRサイズ:** 小（3ファイル）
- **実装結果:**
  - 監視リストが空の場合の適切なメッセージ表示
  - EmbedBuilderを使用した見やすいUI
  - プラットフォーム別の絵文字表示（🎮 Twitch、📺 YouTube）
  - 配信者ごとの詳細情報（プラットフォーム、URL）

---

#### **✅ P1-T09: `/notify test` コマンド実装** 【完了】
- **説明:** 通知のテスト送信（デザイン確認用）
- **内容:**
  - `src/bot/commands/notify/test.ts` 作成
  - `src/utils/notificationEmbed.ts` 作成（通知Embed生成ユーティリティ）
  - ダミーデータで通知Embedを生成・送信
  - Twitchブランドカラー、サムネイル、カテゴリ、視聴者数を含む
- **依存:** P1-T06
- **並列可能:** P1-T07, P1-T08と並行可能 ✅
- **テスト:** ユニットテスト（7テスト、全てパス）
- **PRサイズ:** 小（5ファイル）
- **実装結果:**
  - 通知Embed生成ロジックを再利用可能な形で実装
  - プラットフォーム別の色設定（Twitch: #9146FF, YouTube: #FF0000）
  - 視聴者数のフォーマット（カンマ区切り）
  - オプショナルフィールドの柔軟な対応

---

#### **✅ P1-T10: `/status` コマンド実装** 【完了】
- **説明:** Botの稼働状況、登録統計を表示
- **内容:**
  - `src/bot/commands/status.ts` 作成
  - `src/bot/commands/status.test.ts` 作成
  - `src/models/repositories/SubscriptionRepository.ts` に `findAll` メソッド追加
  - Bot稼働時間、登録サーバー数、監視中配信者数を表示
  - DB統計クエリ（COUNT集計）
  - ユニークな配信者数の計算
  - プラン内訳（Free/Pro）の表示
- **依存:** P1-T05
- **並列可能:** P1-T06以降と並行可能 ✅
- **テスト:** ユニットテスト（4テスト、全てパス）
- **PRサイズ:** 小（3ファイル）
- **実装結果:**
  - 稼働時間フォーマット（日・時間・分・秒）
  - 接続サーバー数（Discord Client キャッシュから）
  - DB登録サーバー数、監視中配信者数、総登録数
  - Twitchブランドカラーのリッチなステータス表示

---

#### **✅ P1-T11: 配信検知ポーリングサービス実装** 【完了】
- **説明:** 定期的にTwitch APIをポーリングして配信開始を検知
- **内容:**
  - `src/services/polling/TwitchPollingService.ts` 作成
  - `src/services/polling/TwitchPollingService.test.ts` 作成
  - `src/services/twitch/TwitchApiClient.ts` に `getStreams` メソッド追加
  - 5分間隔（環境変数で設定可能）で全Subscription対象の配信ステータスをチェック
  - 配信開始検知時にイベント発行（`streamStarted`）
  - 配信終了検知時にイベント発行（`streamEnded`）
  - DB更新（`last_status` フィールド更新：Live/Offline）
  - エラーハンドリング（ログ出力、リトライなし）
  - Bot起動時に自動開始、プロセス終了時に自動停止
  - EventEmitter を使用したイベント駆動設計
- **依存:** P1-T04, P1-T05
- **並列可能:** P1-T06以降と並行可能 ✅
- **テスト:** ユニットテスト（8テスト、全てパス）
- **PRサイズ:** 中（5ファイル）
- **実装結果:**
  - 複数配信者の効率的なバッチ取得（最大100件）
  - 配信状態変更の正確な検知（Live/Offline遷移）
  - イベントベースの疎結合な設計
  - 環境変数でポーリング間隔を柔軟に設定可能（デフォルト5分）

---

#### **✅ P1-T12: 通知送信サービス実装** 【完了】
- **説明:** 配信開始イベントを受け取りDiscordに通知を送信
- **内容:**
  - `src/services/notification/NotificationService.ts` / `.test.ts` を追加
  - `streamStarted` イベントを購読してEmbed付き通知を自動送信
  - 配信タイトル／カテゴリ／視聴者数／サムネイルを含むEmbed生成とDiscord送信
  - ロールメンション・カスタムメッセージに対応し、権限不足などの例外を安全にスキップ
  - 送信メッセージIDをDB保存し、配信終了時の更新フロー（P1-T13）に備える
  - `bot/index.ts` への統合と `jest.config.js` の `testMatch` 見直し、各コマンドテストの v14 対応
- **依存:** P1-T11
- **並列可能:** ❌
- **テスト:** ユニットテスト（9ケース）＋全体テスト 77件
- **PRサイズ:** 中（7ファイル）
- **実装結果:**
  - `streamStarted` イベント駆動での自動通知フローを確立し、通知サービス単体カバレッジ 94.28% を達成
  - Freeプラン運用に必要なEmbed品質とログ整備を実配信で検証済み
  - messageId保持により、配信終了時のメッセージ更新パスを実用化

---

#### **✅ P1-T13: 配信終了時の通知更新機能** 【完了】
- **説明:** 配信終了を検知し、通知メッセージを更新
- **内容:**
  - `NotificationService` に `streamEnded` リスナーを追加
  - 既存通知メッセージを取得し「⚫ 配信終了」Embedへ書き換え
  - 更新完了後に `notification_message_id` をクリア
  - メッセージID未保存・チャンネル欠如・取得失敗時のハンドリングを実装
- **依存:** P1-T12
- **並列可能:** ❌
- **テスト:** ユニットテスト（3ケース追加）
- **PRサイズ:** 小（2ファイル）
- **実装結果:**
  - 配信終了時に通知スレッドを最新状態へ更新し、ユーザー体験を向上
  - ログで更新／スキップ理由を可視化、運用時のトラブルシュートをしやすくした
  - 将来的な「通知削除」や「再通知」機構の基盤を整備

---

#### **✅ P1-T14: エラーハンドリング＆ロギング強化** 【完了】
- **説明:** Bot全体の例外処理とログ出力を標準化し、API障害時の自動リトライを実装
- **内容:**
  - `src/utils/logger.ts` を拡張し、環境別デフォルトレベル（dev: debug / prod: info）と `handleExceptions` を設定
  - `src/utils/globalErrorHandler.ts` を追加し、`unhandledRejection` / `uncaughtException` を統一的にログ＋安全終了。`bot/index.ts` で `registerGlobalErrorHandlers()` を呼び出し、SIGINT/SIGTERMで `dispose` するよう調整
  - `src/utils/retry.ts` を新設し、指数バックオフ付きの共通リトライロジックを提供
  - `TwitchApiClient.getStreams` をリトライ対応させ、ポーリング時のAPI 5xx/429 で自動的にリトライ
  - Discordクライアントのログレベル調整（developmentで詳細ログが出るように）と、既存コマンドのログ整備
- **依存:** P1-T01
- **並列可能:** P1-T06以降と並行可能 ✅
- **テスト:** ユニットテスト（`logger.test.ts`, `globalErrorHandler.test.ts`, `retry.test.ts`, `TwitchApiClient.test.ts` 追加／更新）
- **PRサイズ:** 中（6ファイル）
- **実装結果:**
  - 重大例外をプロセス終了前に必ず記録し、再現に必要なメタデータ（interactionId/guildId等）もログへ集約
  - Twitch APIの一時障害が通知フローを止めないことを自動テストで担保（合計86テストに拡大）
  - ログレベル切り替えで開発時のデバッグが容易になり、運用時は過剰ログを抑制

---

#### **✅ P1-T15: Docker Compose 環境構築** 【完了】
- **説明:** ローカル開発環境をDocker Composeで統一
- **内容:**
  - `Dockerfile` を新規作成し、Node.js 20 + TypeScript 実行環境と Prisma Client 生成をコンテナ内で完結
  - `docker-compose.yml` を刷新し、Bot + PostgreSQL の2サービス、ヘルスチェック、永続ボリューム、`.env` 共有、`DATABASE_URL` の自動上書きを実装
  - `.dockerignore` でビルドコンテキストを最適化し、`package.json` に `npm run docker:*` 系（dev/migrate/logs/down）スクリプトを追加
  - README に Docker Compose 手順と `POLLING_INTERVAL_MS` を追記し、環境変数表を更新
- **依存:** P1-T01, P1-T02
- **並列可能:** P1-T06以降と並行可能 ✅
- **テスト:** `npm test`, `npm run lint`
- **PRサイズ:** 小（7ファイル）
- **実装結果:**
  - `npm run docker:dev` だけで Bot + DB を起動でき、`docker:migrate` でマイグレーションもコンテナ経由で統一
  - Bot コンテナはホットリロード用ファイル共有と `node_modules` の匿名ボリューム分離により、ホスト側の開発体験を維持
  - ドキュメントとスクリプトが同期され、チームメンバーが同一手順で環境構築できる状態になった

---

#### **✅ P1-T16: CI/CD パイプライン構築（GitHub Actions）** 【完了】
- **説明:** PR作成時に自動でLint/型チェック/ユニットテスト/カバレッジを実行し、結果を可視化
- **内容:**
  - `npm run typecheck` を追加し、`tsc --noEmit` を単体で実行可能に
  - `.github/workflows/ci.yml` を新規作成し、push/pr（main向け）で ESLint / typecheck / Jest（カバレッジ付き）を実行
  - `actions/upload-artifact` で `coverage/` ディレクトリを保存し、`actions/github-script` で PR にサマリーを自動コメント
  - README に CI手順とローカル検証コマンドを追記
- **依存:** P1-T01
- **並列可能:** P1-T06以降と並行可能 ✅
- **テスト:** `npm run lint`, `npm run typecheck`, `npm run test:coverage -- --runInBand`
- **PRサイズ:** 小（4ファイル）
- **実装結果:**
  - PRごとに自動品質ゲート（Lint/型/テスト/カバレッジ）を通過させるフローを整備
  - 失敗時でもカバレッジレポートがコメント・アーティファクトに残るため、レビューがスムーズ
  - ローカルからもCIと同じコマンド群で検証できるため、開発者体験が向上

---

#### **✅ P1-T17: 本番デプロイ設定（Railway / Render）** 【完了】
- **説明:** Railway / Render で Bot を常駐稼働させるためのテンプレートと手順を整備
- **内容:**
  - `DEPLOY.md` で共通環境変数、Railway CLI 手順、Render Blueprint 手順、ポストデプロイ確認をドキュメント化
  - `railway.json`（Nixpacks + worker + Postgres プラグイン）と `render.yaml`（worker + DB + envVars）を追加
  - `DATABASE_URL` の `sslmode=require&connection_limit=5` 指定や `/status` を用いたヘルスチェック方法を明文化
  - README にデプロイ章を追加し、テンプレートとドキュメントへの導線を整備
- **依存:** P1-T15, P1-T16
- **並列可能:** ❌
- **テスト:** `npm run lint`, `npm run typecheck`, `npm test`
- **PRサイズ:** 小（4ファイル）
- **実装結果:**
  - ローカルと同一の `npm run build && npm run start` フローで Railway / Render 双方に配置できる状態
  - Secrets / Database 設定をテンプレート化し、開発者が数分で本番検証できるように
  - ドキュメントにヘルスチェックとトラブルシュート（Token更新、DB再接続等）を追記し、運用の属人化を防止

---

#### **P1-T18: 統合テスト・E2Eテスト整備**
- **説明:** 全体の動作を確認するE2Eテストスイート作成
- **内容:**
  - `tests/e2e/` ディレクトリ作成
  - シナリオテスト（配信者登録 → 配信開始 → 通知送信 → 配信終了 → 通知更新）
  - テスト用Discordサーバー・チャンネル準備
  - モックAPIサーバー構築（Twitchレスポンス再現）
- **依存:** P1-T06〜P1-T13 完了後
- **並列可能:** ❌
- **テスト:** E2Eテスト実行
- **PRサイズ:** 中（8〜12ファイル）

---

#### **P1-T19: MVP総合動作確認＆バグ修正**
- **説明:** MVP全体の動作確認とバグ修正
- **内容:**
  - 全コマンド動作確認（`/notify add/remove/list/test`, `/status`, `/ping`）
  - ポーリング動作確認（実際のTwitch配信で検証）
  - 通知送信・更新動作確認
  - エッジケース確認（存在しないチャンネル、権限不足、API障害）
  - 発見されたバグ修正
  - パフォーマンス確認（100サーバー想定での負荷テスト）
- **依存:** P1-T18
- **並列可能:** ❌
- **テスト:** 手動テスト、負荷テスト
- **PRサイズ:** 小〜中（バグ修正内容次第）

---

### **Phase 2: 機能拡張 - YouTube対応・Pro機能**

#### **P2-T01: YouTube API クライアント実装**
- **説明:** YouTube Data API v3 のクライアント実装
- **内容:**
  - `src/services/youtube/YouTubeApiClient.ts` 作成
  - チャンネル情報取得（`channels` API）
  - 配信ステータス取得（`search` API: `eventType=live`）
  - Quota管理（1日の呼び出し回数制限を監視）
- **依存:** P1-T19 (MVP完成)
- **並列可能:** P2-T02と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 中

---

#### **P2-T02: PubSubHubbub 実装（YouTube）**
- **説明:** YouTubeのプッシュ通知受信サーバー構築
- **内容:**
  - `src/services/youtube/PubSubHubBub.ts` 作成
  - Webhookエンドポイント作成（Express等のHTTPサーバー）
  - サブスクリプション登録処理（チャンネル登録時）
  - XML通知パース処理
  - 配信開始イベント発行
- **依存:** P1-T19 (MVP完成)
- **並列可能:** P2-T01と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト（モック通知）
- **PRサイズ:** 中

---

#### **P2-T03: `/notify add` YouTube対応**
- **説明:** `/notify add youtube <url>` でYouTubeチャンネル登録を可能に
- **内容:**
  - YouTube URLパース処理追加
  - YouTube API でチャンネル情報取得
  - PubSubHubbub サブスクリプション登録
  - DB登録処理（platform: 'YouTube'）
- **依存:** P2-T01, P2-T02
- **並列可能:** ❌
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 小〜中

---

#### **P2-T04: Twitch EventSub 実装（Pro機能）**
- **説明:** Twitch EventSubによるリアルタイム通知受信
- **内容:**
  - `src/services/twitch/TwitchEventSub.ts` 作成
  - Webhookエンドポイント作成（署名検証含む）
  - サブスクリプション登録処理（`stream.online` イベント）
  - イベント受信時の処理（配信開始イベント発行）
- **依存:** P1-T19 (MVP完成)
- **並列可能:** P2-T01, P2-T02と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 中

---

#### **P2-T05: プラン管理機能実装**
- **説明:** Free/Pro プラン切り替え・管理機能
- **内容:**
  - `servers` テーブルに `plan_type`, `plan_expires_at` 追加
  - `/upgrade` コマンド実装（Proプラン案内）
  - プラン判定ロジック実装（Repositoryレイヤー）
  - Proプランサーバーは50枠まで登録可能に変更
  - Proプランサーバーは EventSub/PubSubHubbub 使用
- **依存:** P2-T04
- **並列可能:** ❌
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 中

---

#### **P2-T06: `/settings message` コマンド実装（Pro機能）**
- **説明:** 通知メッセージのカスタマイズ
- **内容:**
  - `src/bot/commands/settings/message.ts` 作成
  - テンプレート変数（`{streamer}`, `{title}`, `{game}`）対応
  - DB保存処理（`subscriptions.custom_message`）
  - Proプランのみ使用可能に制限
- **依存:** P2-T05
- **並列可能:** P2-T07と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 小〜中

---

#### **P2-T07: `/settings mention` コマンド実装（Pro機能）**
- **説明:** メンション設定機能
- **内容:**
  - `src/bot/commands/settings/mention.ts` 作成
  - `@everyone`, `@here`, ロールIDの指定に対応
  - DB保存処理（`subscriptions.mention_role_id`）
  - Proプランのみ使用可能に制限
- **依存:** P2-T05
- **並列可能:** P2-T06と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 小〜中

---

#### **P2-T08: Embed カスタマイズ機能（Pro機能）**
- **説明:** 通知Embedの色・フッター等をカスタマイズ
- **内容:**
  - `subscriptions` テーブルに `embed_color`, `embed_footer` 追加
  - `/settings embed` コマンド実装
  - 通知送信時にカスタマイズ内容を反映
- **依存:** P2-T05
- **並列可能:** P2-T06, P2-T07と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト
- **PRサイズ:** 小〜中

---

#### **P2-T09: Phase 2 統合テスト＆動作確認**
- **説明:** YouTube対応・Pro機能の総合動作確認
- **内容:**
  - YouTube配信検知・通知動作確認
  - EventSub/PubSubHubbub動作確認
  - Pro機能（メンション、カスタマイズ）動作確認
  - E2Eテスト更新
- **依存:** P2-T03, P2-T04, P2-T06, P2-T07, P2-T08
- **並列可能:** ❌
- **テスト:** E2Eテスト、手動テスト
- **PRサイズ:** 小〜中

---

### **Phase 3: 運用強化・収益化基盤**

#### **P3-T01: Stripe 連携（決済機能）**
- **説明:** Proプランのサブスクリプション決済
- **内容:**
  - Stripe API クライアント実装
  - Checkout Session 生成
  - Webhook受信（支払い成功/失敗/キャンセル）
  - プラン自動更新処理
  - `/upgrade` コマンドに決済リンク表示
- **依存:** P2-T09
- **並列可能:** P3-T02と並行可能 ✅
- **テスト:** ユニットテスト、統合テスト（Stripeテストモード）
- **PRサイズ:** 中〜大（実装時は「APIクライアント」「Webhook処理」「プラン更新ロジック」など複数PRに分割することを推奨）

---

#### **P3-T02: Webダッシュボード（管理画面）**
- **説明:** 統計情報・ユーザー管理画面
- **内容:**
  - Next.js / React で管理画面構築
  - 統計情報表示（登録サーバー数、通知送信数、エラー数）
  - サーバー検索・プラン変更機能
  - ログイン機能（管理者用認証）
- **依存:** P2-T09
- **並列可能:** P3-T01と並行可能 ✅
- **テスト:** E2Eテスト（Playwright等）
- **PRサイズ:** 大（実装時は画面単位・機能単位で複数PRに分割することを前提とする）

---

#### **P3-T03: 監視・メトリクス収集（Prometheus / Grafana）**
- **説明:** メトリクス収集とダッシュボード構築
- **内容:**
  - Prometheus exporter 実装（通知成功数、失敗数、レイテンシ）
  - Grafanaダッシュボード作成
  - アラート設定（エラー率閾値超過時）
- **依存:** P2-T09
- **並列可能:** P3-T01, P3-T02と並行可能 ✅
- **テスト:** メトリクス取得確認
- **PRサイズ:** 中

---

#### **P3-T04: Phase 3 統合テスト＆本番リリース**
- **説明:** 全体動作確認と本番リリース
- **内容:**
  - 決済フロー動作確認
  - Webダッシュボード動作確認
  - 監視・アラート動作確認
  - 負荷テスト（1000サーバー想定）
  - ドキュメント整備（ユーザーガイド、API仕様書）
- **依存:** P3-T01, P3-T02, P3-T03
- **並列可能:** ❌
- **テスト:** E2Eテスト、負荷テスト、手動テスト
- **PRサイズ:** 小〜中

---

## テスト計画

### テスト種別

#### 1. ユニットテスト
- **ツール:** Jest + ts-jest
- **対象:** 各サービスクラス、Repositoryクラス、ユーティリティ関数
- **実施タイミング:** 各PR作成時
- **カバレッジ目標:** 80%以上

#### 2. 統合テスト
- **ツール:** Jest + Supertest（HTTP APIテスト）
- **対象:** API連携部分（Twitch/YouTube API、Discord API）、Webhook受信処理
- **実施タイミング:** 各PR作成時
- **カバレッジ目標:** 70%以上

#### 3. E2Eテスト（エンドツーエンドテスト）
- **ツール:** Jest + テスト用Discordサーバー
- **対象:** 全体フロー（コマンド実行 → DB登録 → 配信検知 → 通知送信）
- **実施タイミング:** Phase完了時、本番リリース前
- **シナリオ例:**
  - シナリオ1: Twitch配信者登録 → 配信開始 → 通知受信 → 配信終了 → 通知更新
  - シナリオ2: YouTube配信者登録 → PubSubHubbub通知受信 → 通知送信
  - シナリオ3: 無料プラン枠上限チェック（4枠目登録時にエラー）
  - シナリオ4: Proプラン機能（メンション、カスタマイズ）動作確認

#### 4. 負荷テスト
- **ツール:** k6 / Artillery
- **対象:** ポーリング処理、Webhook受信処理、DB負荷
- **実施タイミング:** MVP完成時、Phase 2完成時、本番リリース前
- **シナリオ例:**
  - 1000サーバー、各3枠 = 3000配信者を5分間隔でポーリング
  - 同時100件のWebhook受信処理
  - DB接続プール枯渇テスト

#### 5. 手動テスト
- **対象:** UI/UX確認、エラーメッセージ確認、Discord Embed表示確認
- **実施タイミング:** 各Phase完了時
- **チェック項目:**
  - コマンドのヘルプメッセージが分かりやすいか
  - エラーメッセージがユーザーフレンドリーか
  - Embed表示が美しいか

### テスト環境

#### 開発環境
- **DB:** Docker ComposeのPostgreSQL
- **Discord Bot:** テスト用Botトークン（別アプリケーション）
- **Twitch/YouTube API:** 開発用APIキー

#### ステージング環境
- **インフラ:** Railway / Render（本番と同構成）
- **DB:** 本番と同じPostgreSQLバージョン
- **Discord Bot:** テスト用Botトークン
- **Twitch/YouTube API:** 開発用APIキー

#### 本番環境
- **インフラ:** Railway / Render
- **DB:** PostgreSQL（バックアップ設定済み）
- **Discord Bot:** 本番Botトークン
- **Twitch/YouTube API:** 本番用APIキー

---

## 依存関係図

### Phase 1: MVP

```
P1-T01 (プロジェクトセットアップ)
  ├─ P1-T02 (DBスキーマ)
  │    └─ P1-T05 (Repository)
  │         ├─ P1-T06 (/notify add)
  │         │    ├─ P1-T07 (/notify remove) [並列可: P1-T08, P1-T09]
  │         │    ├─ P1-T08 (/notify list) [並列可: P1-T07, P1-T09]
  │         │    └─ P1-T09 (/notify test) [並列可: P1-T07, P1-T08]
  │         └─ P1-T10 (/status) [並列可: P1-T06以降]
  ├─ P1-T03 (Bot基本起動)
  │    └─ P1-T06 (/notify add)
  └─ P1-T04 (Twitch API)
       ├─ P1-T06 (/notify add)
       └─ P1-T11 (ポーリングサービス)
            └─ P1-T12 (通知送信)
                 └─ P1-T13 (配信終了更新)

P1-T14 (エラーハンドリング) [並列可: P1-T06以降]
P1-T15 (Docker Compose) [並列可: P1-T06以降]
P1-T16 (CI/CD) [並列可: P1-T06以降]

P1-T17 (本番デプロイ設定) ← P1-T15, P1-T16
P1-T18 (E2Eテスト) ← P1-T06〜P1-T13
P1-T19 (MVP総合確認) ← P1-T18
```

### Phase 2: 機能拡張

```
P1-T19 (MVP完成)
  ├─ P2-T01 (YouTube API) [並列可: P2-T02, P2-T04]
  ├─ P2-T02 (PubSubHubbub) [並列可: P2-T01, P2-T04]
  └─ P2-T04 (Twitch EventSub) [並列可: P2-T01, P2-T02]

P2-T01 + P2-T02 → P2-T03 (/notify add YouTube対応)
P2-T04 → P2-T05 (プラン管理)
         ├─ P2-T06 (/settings message) [並列可: P2-T07, P2-T08]
         ├─ P2-T07 (/settings mention) [並列可: P2-T06, P2-T08]
         └─ P2-T08 (Embedカスタマイズ) [並列可: P2-T06, P2-T07]

P2-T03 + P2-T04 + P2-T06 + P2-T07 + P2-T08 → P2-T09 (Phase 2総合確認)
```

### Phase 3: 運用強化

```
P2-T09 (Phase 2完成)
  ├─ P3-T01 (Stripe連携) [並列可: P3-T02, P3-T03]
  ├─ P3-T02 (Webダッシュボード) [並列可: P3-T01, P3-T03]
  └─ P3-T03 (監視・メトリクス) [並列可: P3-T01, P3-T02]

P3-T01 + P3-T02 + P3-T03 → P3-T04 (Phase 3総合確認・本番リリース)
```

---

## リリース計画

### MVP（Phase 1）リリース
- **目標日:** 開発着手から6週間後
- **リリース内容:**
  - Twitch配信検知・通知機能（Freeプラン・ポーリング方式）
  - 基本コマンド（`/notify add/remove/list/test`, `/status`, `/ping`）
  - 本番環境デプロイ（Railway / Render）
- **リリース判断基準:**
  - 全E2Eテストがパスする
  - 手動テストで致命的なバグが発見されない
  - 負荷テスト（100サーバー想定）でパフォーマンス問題なし

### Phase 2 リリース
- **目標日:** Phase 1完了から8週間後
- **リリース内容:**
  - YouTube配信検知・通知機能
  - Proプラン機能（メンション、カスタマイズ、Webhook方式）
  - プラン管理機能
- **リリース判断基準:**
  - 全E2Eテストがパスする
  - YouTube PubSubHubbub、Twitch EventSubが正常動作する
  - Pro機能が正常動作する

### Phase 3 リリース（正式版）
- **目標日:** Phase 2完了から6週間後
- **リリース内容:**
  - Stripe決済機能
  - Webダッシュボード
  - 監視・メトリクス収集
- **リリース判断基準:**
  - 決済フローが正常動作する（テストモード + 本番モード）
  - Webダッシュボードが正常動作する
  - 監視・アラートが正常動作する
  - 負荷テスト（1000サーバー想定）でパフォーマンス問題なし

### ロールバック計画
- **条件:** 致命的なバグ（全サーバーで通知が届かない、DB障害など）が発生した場合
- **手順:**
  1. Railwayの前バージョンにロールバック
  2. DB マイグレーションのロールバック（必要な場合）
  3. ユーザーへの障害通知（公式Discordサーバー、Twitter等）
  4. 原因調査とホットフィックスPR作成
  5. 修正版の再デプロイ

---

## まとめ

本実装計画では、**MVP（Phase 1）を6週間で完成させる**ことを目標としています。各タスクはPR単位で分割され、レビュー可能な粒度になっています。

### 重要ポイント
1. **並列化可能なタスクを積極的に並列実施**することで、開発期間を短縮します。
2. **各PRは独立してテスト可能**であり、CI/CDパイプラインで自動テストを実行します。
3. **E2Eテスト・負荷テストを各Phase完了時に実施**し、品質を担保します。
4. **MVP完成後に動作検証を行い**、問題なければPhase 2（YouTube対応・Pro機能）へ進みます。

この計画をベースに、各タスクをIssue化し、GitHub Projectsなどで進捗管理を行うことを推奨します。

