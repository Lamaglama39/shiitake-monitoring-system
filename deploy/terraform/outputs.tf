# outputs.tf - Centralized Terraform outputs

# Frontend S3 Bucket
output "frontend_bucket_name" {
  description = "Name of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend.id
}

# CloudFront Distribution
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

# Frontend URL
output "frontend_url" {
  description = "URL to access the frontend application"
  value       = "https://${var.domain_name}"
}

# Lambda Function
output "video_lambda_function_name" {
  description = "Name of the video retrieval Lambda function"
  value       = aws_lambda_function.video_retrieval.function_name
}

# KVS Stream
output "kinesis_video_stream_name" {
  description = "Name of the Kinesis Video Stream"
  value       = aws_kinesis_video_stream.mac_camera_stream.name
}

# IAM User Credentials for local streaming
output "access_key_id" {
  description = "Access key ID for local PC to stream to KVS"
  value       = aws_iam_access_key.kinesis_video_access_key.id
}

output "secret_access_key" {
  description = "Secret access key for local PC (sensitive)"
  value       = aws_iam_access_key.kinesis_video_access_key.secret
  sensitive   = true
}

# API Gateway
output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.video_api.api_endpoint
}
