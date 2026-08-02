# みんなのスケジュール（複数人スケジュール共有アプリ）

30人前後のメンバーがGoogleアカウントでログインし、各自のGoogleカレンダーの予定を持ち寄って
1つのカレンダー上に横断表示する。誰かの予定が更新されると、開いている全員の画面に
数分以内（同期間隔で調整可）に反映される。アプリ内で「チーム予定」を直接追加することも可能。

## 構成

- `index.html` / `css/style.css` — フロントエンド（Firebase Hosting で公開、ビルド不要）
- `js/firebase-config.js` — Firebaseプロジェクトの接続設定・同期間隔の設定
- `js/auth.js` — Googleサインイン（Calendar読み取りスコープ込み）
- `js/calendar-sync.js` — Google Calendar API → Firestore への同期処理（サインイン時＋5分毎）
- `js/app.js` — Firestoreのリアルタイム購読とFullCalendarでの描画、チーム予定追加
- `firestore.rules` — Firestoreセキュリティルール
- `firebase.json` / `.firebaserc` — Firebase Hosting/Firestore設定

## セットアップ手順

### 1. Firebaseプロジェクトの作成

1. https://console.firebase.google.com/ で新規プロジェクトを作成
2. 「Authentication」→「Sign-in method」で **Google** プロバイダを有効化
3. 「Firestore Database」を作成（本番モードでOK。ルールは後で`firestore.rules`をデプロイする）
4. 「プロジェクトの設定」→「マイアプリ」でウェブアプリを追加し、表示された設定オブジェクトを
   `js/firebase-config.js` の `FIREBASE_CONFIG` に貼り付ける

### 2. Google Calendar API の有効化とOAuth同意画面の設定

このプロジェクトはFirebaseと同じGoogle Cloudプロジェクトを使う。

1. https://console.cloud.google.com/ で該当プロジェクトを選択
2. 「APIとサービス」→「ライブラリ」から **Google Calendar API** を有効化
3. 「APIとサービス」→「OAuth同意画面」
   - User Type: **外部(External)**
   - 公開ステータス: **テスト中(Testing)** のままにする
   - スコープに `https://www.googleapis.com/auth/calendar.readonly` を追加
   - 「テストユーザー」に参加する30人分のGoogleアカウントのメールアドレスを登録する
     （テストモードでは、ここに登録されていないアカウントはログイン時のカレンダー権限
     許可画面を通過できません。30人を超える場合や登録の手間を省きたい場合は、
     Googleの本番公開審査（アプリ検証）が必要になります）

### 3. Firebase CLIでのデプロイ

```bash
npm install -g firebase-tools
firebase login
```

`.firebaserc` の `YOUR_FIREBASE_PROJECT_ID` を実際のプロジェクトIDに書き換えてから:

```bash
firebase deploy --only firestore:rules,hosting
```

デプロイ後、`https://<プロジェクトID>.web.app/` でアクセスできる。

## 動作確認

```bash
firebase emulators:start
```

でローカルのAuth/Firestore/Hostingエミュレータを起動し、`http://localhost:5000` にアクセスして
Googleログイン→カレンダー同期→別タブでの予定追加がリアルタイムに反映されるかを確認する。

## 既知の制約

- Google OAuthのアクセストークンはブラウザのセッション中のみ有効（約1時間で失効）。
  失効後は自動更新されないため、長時間開きっぱなしのタブでは再ログインが必要になる場合がある
- サインインした参加者は、他の参加者のGoogleカレンダーの予定タイトルも閲覧できる設計。
  タイトルに機微な内容を書かないよう運用上の注意が必要
- 同期はアプリを開いている本人のブラウザが起点となるため、誰もアプリを開いていない間は
  Googleカレンダー側の変更がFirestoreに反映されない（次に誰かが開いたタイミングで同期される）
