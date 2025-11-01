# Shiitake Monitoring System - frontend

このディレクトリには、しいたけモニタリングシステムのWebフロントエンドが含まれています。

## 機能

- **動画再生** - モーダルで録画映像を再生
- **ライブストリーム再生** - ほぼリアルタイムのライブストリームを動画再生
- **時間指定再生** - 時間指定再生して動画再生

## ディレクトリ構造

```
frontend/
├── index.html # メインHTML
├── css/       # スタイルシート
├── js/        # アプリケーションロジック
├── deploy.sh  # デプロイスクリプト
└── README.md
```

## ローカル環境

```bash
npm install -g http-server;
http-server -p 8000;
```

### 注意事項

ローカル環境では、API呼び出しが失敗しますが、これは正常な動作です。
実際のAPIは、AWSにデプロイ後に利用可能になります。

## AWSデプロイ

### デプロイ方法

```bash
./deploy.sh
```

このスクリプトは以下を実行します。

* 1.Terraformの出力からS3バケット名とCloudFront IDを取得
* 2.ファイルをS3にアップロード
* 3.CloudFrontのキャッシュを無効化

## API仕様

フロントエンドは以下のAPIエンドポイントを使用します。

### KVSから映像取得

```
GET /api/video?source=kvs&start_time={iso-timestamp}&end_time={iso-timestamp}
```

### ストリーム状態確認

```
GET /api/stream/status
```

レスポンス：
```json
{
  "active": true,
  "detections": 5,
  "fps": 29.5,
  "resolution": "1280x720"
}
```
