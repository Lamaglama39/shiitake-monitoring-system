# API Gateway v2 (HTTP API)
resource "aws_apigatewayv2_api" "video_api" {
  name          = "${var.project_name}-video-api"
  protocol_type = "HTTP"
  description   = "API for video retrieval from KVS and S3"

  cors_configuration {
    allow_origins = ["https://${var.domain_name}"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = {
    Name        = "${var.project_name}-video-api"
    Environment = var.environment
  }
}

# API Gateway Integration with Lambda
resource "aws_apigatewayv2_integration" "video_lambda_integration" {
  api_id           = aws_apigatewayv2_api.video_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.video_retrieval.invoke_arn

  payload_format_version = "2.0"
}

# API Gateway Route for video retrieval
resource "aws_apigatewayv2_route" "get_video" {
  api_id    = aws_apigatewayv2_api.video_api.id
  route_key = "GET /api/video"
  target    = "integrations/${aws_apigatewayv2_integration.video_lambda_integration.id}"
}

# API Gateway Route for listing videos
resource "aws_apigatewayv2_route" "list_videos" {
  api_id    = aws_apigatewayv2_api.video_api.id
  route_key = "GET /api/videos"
  target    = "integrations/${aws_apigatewayv2_integration.video_lambda_integration.id}"
}

# API Gateway Route for KVS HLS URL
resource "aws_apigatewayv2_route" "kvs_hls_url" {
  api_id    = aws_apigatewayv2_api.video_api.id
  route_key = "GET /api/kvs/hls-url"
  target    = "integrations/${aws_apigatewayv2_integration.video_lambda_integration.id}"
}

# API Gateway Route for KVS stream status
resource "aws_apigatewayv2_route" "kvs_stream_status" {
  api_id    = aws_apigatewayv2_api.video_api.id
  route_key = "GET /api/kvs/stream-status"
  target    = "integrations/${aws_apigatewayv2_integration.video_lambda_integration.id}"
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.video_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = {
    Name        = "${var.project_name}-api-stage"
    Environment = var.environment
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.project_name}-video-api"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-api-gateway-logs"
    Environment = var.environment
  }
}

# Lambda permission for API Gateway to invoke
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_retrieval.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_api.execution_arn}/*/*"
}
