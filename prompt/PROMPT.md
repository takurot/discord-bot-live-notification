# タスク実行プロンプト

このリポジトリでは `prompt/PLAN.md` と `prompt/SPEC.md` を参照しながら、Discord配信通知Bot「StreamPulse」を実装します。

## 実装フロー

### 1. ブランチ作成
- `main` から `feature/<トピック>` 形式で作成（例: `feature/youtube-webhook-notify`）。
- 既存の作業ブランチがある場合はそれを継続して使う。

### 2. TDD（テスト駆動開発）
- **Red**: 失敗するテストを書く
- **Green**: テストを最小限の実装で通す
- **Refactor**: 可読性・再利用性を高める
- ユニットテスト（`src/` 配下）と統合/E2Eテスト（`tests/` 配下のJest）を追加する。

### 3. ローカル品質チェック
```bash
npm run lint
npm run typecheck
npm run test:coverage -- --runInBand
```
- JestカバレッジにはE2Eテストも含まれる。既存テストを壊していないことを確認。
- フォーマットが崩れた場合は `npm run lint:fix` または `npm run format` を利用。

### 4. PLAN.md の更新
- 対応したタスクの進捗を更新し、`Current:` や `Tests:` セクションに要約を追記。

### 5. コミット & プッシュ
- 粒度はタスク単位で、短く命令形のメッセージを推奨（例: `Fix lint and coverage summary output`）。
- 作業ブランチへプッシュし、必要に応じてPRを作成。

### 6. Pull Request 作成
```bash
gh pr create --title "<タスク名>" --body "<概要とテスト結果>"
```
- PRテンプレートがある場合は従う。関連Issue/PRをリンク。

### 7. CI結果の確認と対応
```bash
gh pr checks   # PRのCI状況
gh run list    # ワークフロー一覧
gh run view <run-id> --log   # 失敗時の詳細
```
- CIが赤の場合は原因を特定し、修正して再実行する。

## チェックリスト

- [ ] 作業ブランチが `main` から切られている（または既存の feature ブランチを継続）
- [ ] 先にテストを書いた（TDDを意識）
- [ ] `npm run lint` がパス
- [ ] `npm run typecheck` がパス
- [ ] `npm run test:coverage -- --runInBand` がパス（E2E含む）
- [ ] `prompt/PLAN.md` を更新した
- [ ] コミットメッセージが簡潔
- [ ] PRを作成した（必要な場合）
- [ ] CIがすべてパスした

## 注意事項

- 既存テストを壊さないこと。必要に応じてモックやフィクスチャを更新する。
- `coverage/` などの生成物はコミットしない（CIがアーティファクト化）。
- macOS/Linuxを前提に手順を書く。Windowsは必要に応じて補足する。
