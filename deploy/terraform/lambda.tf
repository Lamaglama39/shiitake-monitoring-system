# IAM Role for Lambda function
resource "aws_iam_role" "video_lambda_role" {
  name = "${var.project_name}-video-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-video-lambda-role"
    Environment = var.environment
  }
}

# IAM Policy for Lambda to access S3 and KVS
resource "aws_iam_policy" "video_lambda_policy" {
  name        = "${var.project_name}-video-lambda-policy"
  description = "Policy for Lambda to access S3 and Kinesis Video Streams"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesisvideo:GetDataEndpoint",
          "kinesisvideo:GetMedia",
          "kinesisvideo:GetMediaForFragmentList",
          "kinesisvideo:ListFragments",
          "kinesisvideo:DescribeStream",
          "kinesisvideo:GetHLSStreamingSessionURL"
        ]
        Resource = [
          aws_kinesis_video_stream.mac_camera_stream.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# Attach policy to Lambda role
resource "aws_iam_role_policy_attachment" "video_lambda_policy_attachment" {
  role       = aws_iam_role.video_lambda_role.name
  policy_arn = aws_iam_policy.video_lambda_policy.arn
}

# Lambda function for video retrieval
resource "aws_lambda_function" "video_retrieval" {
  filename         = "lambda_function.zip"
  function_name    = "${var.project_name}-video-retrieval"
  role            = aws_iam_role.video_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = fileexists("lambda_function.zip") ? filebase64sha256("lambda_function.zip") : ""
  runtime         = "python3.12"
  timeout         = 30
  memory_size     = 512

  environment {
    variables = {
      KVS_STREAM_NAME        = aws_kinesis_video_stream.mac_camera_stream.name
      REGION                 = var.aws_region
    }
  }

  tags = {
    Name        = "${var.project_name}-video-retrieval"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "video_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.video_retrieval.function_name}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-video-lambda-logs"
    Environment = var.environment
  }
}
