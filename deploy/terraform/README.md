# Shiitake Monitoring System - backend

このTerraformは、しいたけの成長をモニタリングするためのAWSインフラストラクチャを構築します。

## ディレクトリ構造

```
terraform/
├── variables.tf        # 変数定義
├── kvs.tf              # メイン設定、KVS、IAM
├── s3.tf               # S3バケット
├── cloudfront.tf       # CloudFront、ACM
├── route53.tf          # Route53レコード
├── lambda.tf           # Lambda関数、IAM
├── api_gateway.tf      # API Gateway
├── terraform.tfvars.example  # 設定例
├── lambda_src/         # Lambda関数のソースコード
└── README.md
```

## 構成要素

### ネットワーク層
- **Route53**: ドメイン名をCloudFrontに紐付け
- **CloudFront**: グローバルCDN、HTTPS対応
- **ACM**: SSL/TLS証明書

### ストレージ
- **S3 (frontend)**: 静的Webサイトのホスティング

### API層
- **API Gateway (HTTP API)**: RESTful API
- **Lambda**: 映像取得・配信ロジック

### ストリーミング
- **Kinesis Video Streams**: リアルタイム映像ストリーム

### 認証・認可
- **IAM Role**: Lambda実行用
- **IAM User**: ローカルPCからのKVSアクセス用

## 前提条件

1. AWSアカウント
2. Terraform >= 1.0
3. AWS CLI設定済み
4. Route53でドメイン取得/ホストゾーン作成済み

## デプロイ方法

### 1. 設定ファイルの作成

```bash
cp terraform.tfvars.example terraform.tfvars;
```

### 2. terraform.tfvarsの編集

```hcl
# Route53のホストゾーンIDを設定 (必須)
route53_zone_id = "Z1234567890ABC"

# ドメイン名を設定 (必須)
domain_name = "monitoring.your-domain.com"
```

### 3. Lambda関数のパッケージング

```bash
zip ./lambda_function.zip  ./lambda_src/index.py;
```

### 4. Terraformデプロイ

```bash
terraform init;
terraform plan;
terraform apply;
```

## 出力情報

デプロイ後、以下の情報が出力されます。

### 主要な出力

- `kvs_recordings_bucket_name`: 録画保管用S3バケット名
- `access_key_id`: ローカルPC用のアクセスキーID
- `secret_access_key`: ローカルPC用のシークレットアクセスキー（sensitive）

シークレットアクセスキーの取得例

```bash
terraform output -raw secret_access_key
```

## Lambda関数の更新

```bash
zip ./lambda_function.zip  ./lambda_src/index.py;

aws lambda update-function-code \
  --function-name $(terraform output -raw video_lambda_function_name) \
  --zip-file fileb://lambda_function.zip
```

## API エンドポイント

### 映像取得（KVSから）
```
GET https://{domain}/api/video?source=kvs&start_time={iso-timestamp}&end_time={iso-timestamp}
```

### 映像一覧
```
GET https://{domain}/api/videos
```
