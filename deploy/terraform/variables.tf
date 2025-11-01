variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "shiitake-monitoring"
}

variable "stream_name" {
  description = "Name of the Kinesis Video Stream"
  type        = string
  default     = "dockerStream"
}

variable "data_retention_hours" {
  description = "Data retention period in hours"
  type        = number
  default     = 168  # 7 days (7 * 24 hours)
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}
