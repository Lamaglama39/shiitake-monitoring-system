# Kinesis Video Stream
resource "aws_kinesis_video_stream" "mac_camera_stream" {
  name                    = var.stream_name
  data_retention_in_hours = var.data_retention_hours
  media_type              = "video/h264"

  tags = {
    Name        = var.stream_name
    Environment = var.environment
  }
}

# IAM Role for Kinesis Video Streams
resource "aws_iam_role" "kinesis_video_role" {
  name = "${var.stream_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "kinesisvideo.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.stream_name}-role"
    Environment = var.environment
  }
}

# IAM Policy for Kinesis Video Streams
resource "aws_iam_policy" "kinesis_video_policy" {
  name        = "${var.stream_name}-policy"
  description = "Policy for Kinesis Video Streams access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesisvideo:CreateStream",
          "kinesisvideo:DescribeStream",
          "kinesisvideo:GetDataEndpoint",
          "kinesisvideo:PutMedia",
          "kinesisvideo:GetMedia",
          "kinesisvideo:ListStreams",
          "kinesisvideo:UpdateStream",
          "kinesisvideo:GetStreamSession",
          "kinesisvideo:StartStreamEncryption",
          "kinesisvideo:StopStreamEncryption"
        ]
        Resource = [
          aws_kinesis_video_stream.mac_camera_stream.arn,
          "${aws_kinesis_video_stream.mac_camera_stream.arn}/*",
          "arn:aws:kinesisvideo:${var.aws_region}:${data.aws_caller_identity.current.account_id}:stream/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kinesisvideo:ListStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach Policy to Role
resource "aws_iam_role_policy_attachment" "kinesis_video_policy_attachment" {
  role       = aws_iam_role.kinesis_video_role.name
  policy_arn = aws_iam_policy.kinesis_video_policy.arn
}

# IAM User for application access (optional)
resource "aws_iam_user" "kinesis_video_user" {
  name = "${var.stream_name}-user"

  tags = {
    Name        = "${var.stream_name}-user"
    Environment = var.environment
  }
}

# Attach Policy to User
resource "aws_iam_user_policy_attachment" "kinesis_video_user_policy_attachment" {
  user       = aws_iam_user.kinesis_video_user.name
  policy_arn = aws_iam_policy.kinesis_video_policy.arn
}

# Access Key for the user (optional, for programmatic access)
resource "aws_iam_access_key" "kinesis_video_access_key" {
  user = aws_iam_user.kinesis_video_user.name
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

