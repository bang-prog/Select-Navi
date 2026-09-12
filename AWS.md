# AWS デプロイ作業ログ

Select NaviをAWS上で公開するための作業記録。初めてのAWS作業だったため、手順と発生した問題を詳しく残す。

## 今回やったこと（範囲の確認）

当初`TECH_STACK.md`ではAWS Amplify（Lambda + DynamoDB）を将来構成として設計していたが、それは「お気に入り保存」「ログイン機能」など**データを保存する機能ができてから**必要になるもの。今回はまず「アプリを公開URLで動かす」ことだけが目的なので、以下のスコープに絞った。

- 使うもの：**AWS Amplify Hosting**（GitHub連携で画面とAPI Routesをまとめてホスティング）
- 使わないもの：Lambda（個別に手で書く分）、DynamoDB、Cognito ※将来、保存機能を作る時に追加

## 手順

### 1. AWSアカウントの作成
- https://aws.amazon.com/jp/ からアカウント作成（個人アカウントとして登録）
- サポートプランは **Basic support（無料）** を選択（有料プランを誤選択しないよう注意喚起して確認）

### 2. 予算アラートの設定（安全対策）
- AWS Budgets で **ゼロ支出予算（Zero spend budget）** を作成
- 1円でも課金が発生したらメール通知が届くようにした
- 目的：無料枠のつもりが想定外に課金され始めても、すぐ気づけるようにするため

### 3. Amplify Consoleでアプリを作成
- Amplify Console →「新しいアプリを作成」→ ソースコードプロバイダーに **GitHub** を選択
- リポジトリ `bang-prog/select-navi` のブランチ `main` を接続
- アプリ名：`Select-Navi`

### 4. モノレポ設定でつまずいた点
このリポジトリは`route-backend/`（Python）と`web/`（Next.js本体）が同居する構成のため、Amplifyがリポジトリ直下を見ても自動的にNext.jsを検出できず、「自動検出されたフレームワーク」が空欄になった。

これを解消するため、「YMLファイルを編集」から、モノレポ向けの設定に書き換えた。

```yaml
version: 1
applications:
  - appRoot: web
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

- `appRoot: web` … ビルド時に`web`フォルダの中身を対象にするよう指定
- `baseDirectory: .next` … Next.jsのビルド成果物の場所。これによりAmplify側がNext.jsのSSR/APIルートに対応したホスティングだと認識する

また、「モノレポ環境」の項目にあった**「私のモノレポはAmplify Gen2バックエンドを使用しています」はチェックしなかった**（`amplify/`フォルダによるLambda/DynamoDB定義は今回使わないため、チェックすると存在しないフォルダを探しにいってしまう）。

### 5. 初回デプロイが失敗

デプロイ履歴で「失敗」となり、ビルドログを確認したところ以下のエラー。

```
npm error `npm ci` can only install packages when your package.json and package-lock.json ... are in sync
npm error Missing: @emnapi/runtime@1.11.3 from lock file
npm error Missing: @emnapi/core@1.11.3 from lock file
```

**原因**：`package-lock.json`（依存関係を一字一句固定するファイル）と`package.json`の内容がズレていた。ローカルでは普段`npm install`（多少のズレは自動調整される）を使っていたため気づかなかったが、Amplifyのビルドで使われる`npm ci`はズレがあると問答無用でエラーにして止まる仕様のため、ここで初めて発覚した。

**修正内容**：
1. `node_modules`と`package-lock.json`を両方削除
2. `npm install`でゼロから整合性の取れた`package-lock.json`を再生成
3. `node_modules`を再度消してから`npm ci`を実行し、Amplifyと全く同じコマンドで問題なく通ることをローカルで確認
4. `npm run build`でビルド自体も正常に通ることを確認
5. アプリのコードは変更せず、`package-lock.json`のみをコミット

## 現在のステータス

- Amplifyアプリ作成・GitHub連携・モノレポ設定：完了
- 初回デプロイ：失敗（`package-lock.json`のズレが原因）→ 修正をプッシュし、**再デプロイ成功**
- その後、ホスティングのプラットフォームが静的サイト用（`WEB`）に固定されてしまう問題が発覚 → **アプリを削除して作り直し**、モノレポ設定を正しい手順（最初の画面でチェック）で行うことで解消
- 環境変数（`GOOGLE_MAPS_API_KEY`、`NEXT_PUBLIC_MAPBOX_TOKEN`）：設定済み。ただしサーバー専用変数が実行時に反映されない問題があり、ビルド設定に`.env.production`書き出しコマンドを追加して解消
- 検索機能（Google Places APIによるジオコーディング）：公開URL上で動作確認済み
- 公開URL（Amplifyが自動発行、アプリ作り直し後の新しいURL）：`https://main.dmm1g4zudj9sa.amplifyapp.com`

## モノレポでのNext.js SSRプラットフォーム誤認識問題（重大）

上記の設定でデプロイには成功したが、公開URLにアクセスすると常にAmplifyの初期案内ページ（「ようこそ」ページ）が表示され続けた。原因を調査したところ、以下が判明した。

**原因**：Amplify Hostingは、リポジトリ接続直後の自動検出（フレームワーク検出）の段階で、ホスティングの「プラットフォーム」を`WEB`（S3+CloudFront配信の静的サイト用）か`WEB_COMPUTE`（Next.jsのSSR/APIルート用にLambdaを使う構成）のどちらかに**その場で確定**する。このリポジトリはNext.js本体が`web/`サブディレクトリにあるモノレポ構成のため、直下だけを見る自動検出ではNext.jsと認識されず、`WEB`（静的サイト用）に固定されてしまっていた。

一度この判定が確定すると、後から`amplify.yml`の`appRoot`を書き換えてビルド自体を通しても、**ホスティングのプラットフォーム自体は`WEB`のまま変わらない**ため、SSRやAPIルートが機能せず、実質的に「静的ファイルを探しにいって見つからない」＝404（`Server: AmazonS3`のヘッダーが返る）という状態になっていた。

**修正内容**：Amplifyアプリを一度削除し、作り直した。その際、最初の「リポジトリとブランチを追加」の画面で**「私のアプリケーションはモノレポです」のチェックボックスを、フレームワーク自動検出が走るより前の時点でチェック**し、「モノレポルートディレクトリ」に`web`を入力した。これにより自動検出が`web/`ディレクトリの中身を見てNext.jsを正しく認識し、プラットフォームが`WEB_COMPUTE`として設定された（画面上の検出結果に「Next.js」のバッジが表示されることで確認できる）。作り直した結果、公開URLへのアクセスがHTTP 200・レスポンスヘッダーに`x-nextjs-cache`が付くようになり、正しくNext.jsのSSRとして動いていることを確認した。

**教訓**：モノレポ構成でAmplify Hostingを使う場合、モノレポ設定は「アプリを作り直さない限りやり直しがきかない」最初の一歩なので、リポジトリ接続の最初の画面で必ず設定してから進めること。

## 環境変数がAPIルートの実行時に反映されない問題（重大）

アプリの作り直し後、公開URLは開けるようになったが、目的地検索が動かず、`/api/geocode`が`GOOGLE_MAPS_API_KEYが設定されていません`という500エラーを返し続けた。Amplify Consoleの環境変数画面には`GOOGLE_MAPS_API_KEY`・`NEXT_PUBLIC_MAPBOX_TOKEN`とも正しい値・正しいブランチ指定（すべてのブランチ）で設定されていることを確認済みだったにもかかわらず、再デプロイ（ビルドのやり直し含む）をしても直らなかった。

**切り分け方法**：値を返さず「環境変数が読めているか（true/false）」だけを返す一時的な診断用API（`/api/debug-env`）を追加してデプロイし、実際のLambda実行時の状態を直接確認した。結果は次の通り。

```json
{"hasGoogleKey": false, "googleKeyLength": 0, "hasMapboxToken": true, "mapboxTokenLength": 89}
```

**原因**：`NEXT_PUBLIC_`が付く環境変数（`NEXT_PUBLIC_MAPBOX_TOKEN`）は、Next.jsの**ビルド時にコード内へ直接埋め込まれる**ため、ビルドさえ通れば正しく動く。一方`GOOGLE_MAPS_API_KEY`のような`NEXT_PUBLIC_`が付かないサーバー専用の環境変数は、APIルートが**リクエストを受けるたびに実行時の`process.env`から読み込む**方式のため、Amplify Consoleで設定した値が実際にデプロイされたLambda（SSRの実行環境）まで引き継がれている必要がある。今回のようなモノレポ＋SSR（`WEB_COMPUTE`）構成では、Amplify Console上の環境変数がビルドコンテナには渡るものの、**Lambdaの実行時環境まで自動的には引き継がれない**という制約があるらしく、これが原因で`NEXT_PUBLIC_`が付かない変数だけ実行時に空になっていた。

**修正内容**：Amplify Consoleの「ビルド設定」（`amplify.yml`相当のUI）で、`npm run build`を実行する前に、環境変数の値を明示的に`.env.production`ファイルへ書き出すコマンドを追加した。

```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - echo "GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY" >> .env.production
            - npm ci --cache .npm --prefer-offline
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - .next/cache/**/*
          - .npm/**/*
    appRoot: web
```

こうすることで、ビルド時点では確実に見えている環境変数の値を`.env.production`というファイルに焼き込んでビルド成果物に含め、Next.jsのサーバーが起動時にこのファイルを読み込む仕組みを利用して、実行時にも値が渡るようにした。修正後、診断用APIで`hasGoogleKey: true`になり、実際の検索APIも正常に動作することを確認した。

**教訓**：モノレポ＋SSR（Amplify Hosting）構成では、`NEXT_PUBLIC_`が付く変数だけで動作確認したつもりでも、サーバー専用の変数が同じように動くとは限らない。両方の種類の変数を実際にAPIルート経由で動作確認する必要がある。

## 残作業（次回の続き）

1. ~~Amplify Consoleの「環境変数」設定画面で`GOOGLE_MAPS_API_KEY`・`NEXT_PUBLIC_MAPBOX_TOKEN`を追加~~ → 完了
2. ~~公開URLで実際に検索・ルート計算・ナビ機能が動くか一通り確認~~ → 検索APIの動作確認完了。ルート計算・ナビ機能は未確認
3. 動作確認用に追加した一時的な診断用エンドポイント（`web/app/api/debug-env/route.ts`）を削除する
4. （任意）本番向けにAPIキーの制限を見直す（Amplifyの送信元IPやドメインで絞り込む）

## 関連ドキュメント

- 実装済み機能の詳細：`PROGRESS.md`
- 技術選定の理由・アーキテクチャ図：`TECH_STACK.md`
