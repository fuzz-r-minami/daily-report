# drepo - 日報・週報自動生成デスクトップアプリ

Git / SVN / Slack / ファイル変更情報を収集し、Claude AI で整形してメール送信する Electron 製 Windows デスクトップアプリ。

---

## 技術スタック

### フレームワーク・ランタイム

| 技術 | バージョン | 役割 |
|------|-----------|------|
| Electron | 33.x | Windows EXE/MSI 配布、Node.js 統合 |
| React | 18.x | UI コンポーネント |
| TypeScript | 5.x | 型安全性 |
| electron-vite | 3.x | ビルドツール（Vite ベース） |

### UI

| 技術 | 役割 |
|------|------|
| Tailwind CSS | スタイリング |
| React Router DOM | 画面遷移 |
| Zustand | UI 状態管理 |

### メインプロセス（Node.js）

| パッケージ | 役割 |
|-----------|------|
| simple-git | Git コミット取得 |
| xml2js | SVN XML 出力パース |
| @slack/web-api | Slack メッセージ取得 |
| @anthropic-ai/sdk | Claude API 連携 |
| electron-store | 設定永続化（JSON） |
| keytar | Windows 資格情報マネージャー連携 |
| glob | ファイル変更検出 |

### ビルド・配布

| パッケージ | 役割 |
|-----------|------|
| electron-builder | MSI / NSIS / ZIP インストーラ生成 |

---

## プロジェクト構成

```
daily-report/
├── src/
│   ├── main/                         # Electron メインプロセス（Node.js）
│   │   ├── index.ts                  # エントリポイント、BrowserWindow 生成
│   │   ├── ipc/                      # IPC ハンドラ（レンダラー→メインプロセス通信）
│   │   │   ├── settings.handler.ts   # 設定の CRUD
│   │   │   ├── git.handler.ts        # Git 操作
│   │   │   ├── svn.handler.ts        # SVN 操作
│   │   │   ├── slack.handler.ts      # Slack 操作
│   │   │   ├── file.handler.ts       # ファイル操作
│   │   │   ├── claude.handler.ts     # Claude API
│   │   │   ├── report.handler.ts     # レポート生成オーケストレーション
│   │   │   └── mail.handler.ts       # mailto: でメーラー起動
│   │   ├── services/                 # ビジネスロジック
│   │   │   ├── git.service.ts        # Git コミット収集
│   │   │   ├── svn.service.ts        # SVN コミット収集
│   │   │   ├── slack.service.ts      # Slack メッセージ収集
│   │   │   ├── file-watcher.service.ts # ファイル変更検出
│   │   │   ├── claude.service.ts     # Claude フォーマット
│   │   │   └── report.service.ts     # 生テキスト生成
│   │   ├── store/
│   │   │   ├── settings.store.ts     # electron-store ラッパー
│   │   │   └── credentials.store.ts  # keytar ラッパー
│   │   └── preload/
│   │       └── index.ts              # contextBridge で API 公開
│   │
│   ├── renderer/                     # React フロントエンド
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx                   # ルーティング
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx         # メイン画面（プロジェクト選択・生成）
│   │   │   ├── Projects.tsx          # プロジェクト一覧
│   │   │   ├── ProjectEdit.tsx       # プロジェクト追加・編集
│   │   │   ├── Templates.tsx         # テンプレート管理
│   │   │   ├── Settings.tsx          # アプリ設定
│   │   │   └── ReportPreview.tsx     # 生成結果プレビュー・送信
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── project/
│   │   │   │   ├── GitConfig.tsx
│   │   │   │   ├── SvnConfig.tsx
│   │   │   │   ├── SlackConfig.tsx
│   │   │   │   └── FilePathConfig.tsx
│   │   │   ├── report/
│   │   │   │   ├── DateRangePicker.tsx
│   │   │   │   ├── ProjectSelector.tsx
│   │   │   │   ├── ReportEditor.tsx
│   │   │   │   └── ProgressLog.tsx
│   │   │   └── common/
│   │   │       ├── StatusBadge.tsx
│   │   │       └── ConnectionTest.tsx
│   │   ├── store/
│   │   │   └── app.store.ts          # Zustand ストア
│   │   └── lib/
│   │       ├── api.ts                # window.electronAPI ラッパー
│   │       └── utils.ts
│   │
│   └── shared/                       # メイン・レンダラー共通型定義
│       ├── types/
│       │   ├── project.types.ts
│       │   ├── report.types.ts
│       │   ├── settings.types.ts
│       │   └── ipc.types.ts
│       └── constants.ts
│
├── build/
│   └── icon.ico
├── electron-builder.config.js
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── tsconfig.web.json
```

---

## 機能概要

### レポート生成フロー

1. **Dashboard** でプロジェクト・期間・テンプレートを選択
2. 各ソースからデータを並行収集
   - Git: `simple-git` でコミット取得（日時・著者フィルタあり）
   - SVN: `svn log --xml` CLI をラップして XML パース
   - Slack: `conversations.history` + `search.messages` でメッセージ収集
   - ファイル: `glob` + `mtime` で変更ファイル検出
3. 収集データを生テキスト（Markdown 形式）に結合（`report.service.ts`）
4. 任意で Claude API に渡してテンプレートに沿って整形
5. **ReportPreview** で確認・編集
6. `mailto:` でデフォルトメーラーを起動して送信

### 設定・認証情報の保存

- 設定: `electron-store` → `%APPDATA%\drepo\config.json`
- 認証情報（API キー・トークン・パスワード）: `keytar` → Windows 資格情報マネージャー（設定ファイルには一切保存しない）

### IPC 通信アーキテクチャ

```
Renderer（React）
    ↓ window.electronAPI.xxx()   ← contextBridge で公開
Preload（contextBridge）
    ↓ ipcRenderer.invoke(channel, args)
Main（IPC Handler）
    ↓
Service Layer（Node.js）
```

IPC 戻り値の統一フォーマット:
```typescript
type IpcResult<T> = { success: true; data: T } | { success: false; error: string }
```

---

## セットアップ

### 前提条件

- Node.js 20 LTS 以上
- SVN 連携を使う場合: TortoiseSVN または SilkSVN（`svn` コマンドが PATH に必要）

### 開発

```bash
npm install
npm run dev
```

### ビルド（Windows インストーラ生成）

```bash
npm run dist:win
# → release/ に NSIS インストーラ・MSI・ZIP を出力
```

---

## 外部サービスの認証設定

| 連携先 | 認証方式 | 保存場所 |
|--------|---------|---------|
| Git (HTTPS) | Personal Access Token | keytar |
| Git (SSH) | `~/.ssh/` の既存キーを自動利用 | ファイルシステム |
| SVN | ユーザー名 + パスワード | keytar |
| Slack | User Token（xoxp-） | keytar |
| Claude | API Key | keytar |

### Slack アプリのセットアップ

1. [api.slack.com/apps](https://api.slack.com/apps) でアプリを新規作成
2. **OAuth & Permissions → User Token Scopes** に以下を追加:
   - `channels:history`, `channels:read`
   - `groups:history`, `groups:read`
   - `im:history`, `mpim:history`
   - `users:read`
3. ワークスペースにインストールし、発行された **User OAuth Token（xoxp-...）** をアプリの設定画面に入力

---

## セキュリティ

- `contextIsolation: true` / `nodeIntegration: false` を維持
- API キー・トークン類は keytar 経由で Windows 資格情報マネージャーに保存
- IPC チャンネル名・引数・戻り値の型は `src/shared/types/ipc.types.ts` で一元管理
