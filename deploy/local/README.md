# Shiitake Monitoring System - local

カメラ映像をYOLOで処理して、Kinesis Video Streamsに送信するストリーミングスクリプトが含まれています。

## ディレクトリ構成

```
local/
├── .venv/                     # Python仮想環境（自動作成）
├── requirements.txt           # Python依存パッケージ
├── .env.example               # 環境変数サンプル
├── Dockerfile                 # KVSコンテナ用Dockerfile
├── docker-compose.yml
├── start_streaming.sh         # ホスト側起動スクリプト
├── stream_to_kvs.py           # シイタケ検出処理 & GStreamer配信処理
├── docker-entrypoint.sh       # KVS配信処理
└── README.md
```

## 前提条件

### ホスト側（カメラ・YOLO処理）

- Python 3.8以降
- GStreamer 1.0（システムレベルでインストール）
- PyGObject（python3-gi、システムレベルでインストール）
- カメラデバイス
- YOLOモデルファイル

### Docker側（KVS送信）

- Docker
- AWS CLI
- AWS認証情報（Terraformから取得）

## デプロイ方法

### 1. ホスト側の初期セットアップ

GStreamerとPyGObjectをシステムレベルでインストールします。

```bash
# GStreamerとPyGObjectをシステムレベルでインストール（Ubuntu/Debian）
sudo apt update
sudo apt install -y \
    python3.12-venv \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    python3-gi \
    python3-gi-cairo \
    gir1.2-gstreamer-1.0
```

次に、Python仮想環境を作成します。`--system-site-packages`フラグを使用して、システムのPyGObjectパッケージにアクセスできるようにします。

```bash
# 仮想環境を作成
python3 -m venv --system-site-packages .venv;

# 仮想環境をアクティベート
source .venv/bin/activate;

# Python依存パッケージをインストール
pip3 install -r requirements.txt;
```

### 2. ホスト側でストリーミング開始

仮想環境をアクティベートした状態で実行します。

```bash
# 仮想環境をアクティベート（毎回実行前に必要）
source .venv/bin/activate

# カメラ→YOLO→TCP送信を開始
./start_streaming.sh
```

### 3. Docker 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env

# AWS認証情報を設定（Terraform outputから取得）
cd ../terraform
terraform output -raw access_key_id    # これを.envのAWS_ACCESS_KEY_IDに設定
terraform output -raw secret_access_key # これを.envのAWS_SECRET_ACCESS_KEYに設定

# .envファイルを編集
cd ../local
vim .env
```

### 4. Dockerイメージのビルド

```bash
# ECRにログイン
aws ecr get-login-password --region us-west-2 | \
  docker login -u AWS --password-stdin https://546150905175.dkr.ecr.us-west-2.amazonaws.com

# イメージをビルド
docker compose build
```

### 5. KVS受信コンテナの起動

```bash
# バックグラウンドで起動
docker compose up -d

# ログを確認
docker compose logs -f
```

## ホスト側スクリプト

### stream_to_kvs.py

カメラから映像を取得し、YOLOで物体検出を行い、GStreamerでH.264エンコードしてTCP経由でDocker側に送信します。

使用例:

```bash
python3 stream_to_kvs.py \
  --model ../../model/best.pt \
  --camera 0 \
  --width 1280 \
  --height 720 \
  --conf 0.5 \
  --host 0.0.0.0 \
  --port 5000
```

パラメータ:
- `--model`: YOLOモデルファイルのパス
- `--camera`: カメラデバイスインデックス（デフォルト: 0）
- `--width`: フレーム幅（デフォルト: 1280）
- `--height`: フレーム高さ（デフォルト: 720）
- `--conf`: 検出信頼度閾値（デフォルト: 0.5）
- `--host`: TCPサーバーホスト（デフォルト: 0.0.0.0）
- `--port`: TCPサーバーポート（デフォルト: 5000）

### start_streaming.sh

stream_to_kvs.pyを簡単に起動するためのラッパースクリプトです。

実行前に仮想環境をアクティベートしてください：

```bash
source .venv/bin/activate
```

環境変数でカスタマイズ可能：

```bash
MODEL_PATH=../../model/best.pt \
CAMERA_INDEX=0 \
WIDTH=1280 \
HEIGHT=720 \
CONF_THRESHOLD=0.5 \
./start_streaming.sh
```

## Docker構成の詳細

### Dockerfile

- ベースイメージ: AWS KVS Producer SDK for C++ (Amazon Linux)
- 環境変数: KVS SDK用のPATH設定
- エントリーポイント: 自動起動スクリプト

### docker-compose.yml

- ネットワークモード: host（TCP接続のため）
- 環境変数: .envファイルから読み込み
- ボリューム: カレントディレクトリを/workspaceにマウント

### docker-entrypoint.sh

コンテナ起動時に以下を実行

1. AWS認証情報の確認
2. GStreamerとkvssinkプラグインの確認
3. TCPホストの自動検出（Linux/macOS）
4. KVS受信パイプラインの起動

## 環境変数

### 必須

- `AWS_ACCESS_KEY_ID`: AWSアクセスキーID
- `AWS_SECRET_ACCESS_KEY`: AWSシークレットアクセスキー

### オプション

- `AWS_DEFAULT_REGION`: AWSリージョン（デフォルト: ap-northeast-1）
- `STREAM_NAME`: KVSストリーム名（デフォルト: dockerStream）
- `TCP_HOST`: TCPホストアドレス（自動検出）
- `TCP_PORT`: TCPポート（デフォルト: 5000）
