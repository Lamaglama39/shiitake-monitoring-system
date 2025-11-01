#!/bin/bash
# deploy.sh - Deploy frontend to S3 and invalidate CloudFront cache

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Frontend Deployment ===${NC}"
echo ""

# Check if terraform outputs are available
if [ ! -f "../terraform/terraform.tfstate" ]; then
    echo -e "${RED}Error: terraform.tfstate not found${NC}"
    echo "Please run 'terraform apply' first in the terraform directory"
    exit 1
fi

# Get outputs from Terraform
echo "Getting Terraform outputs..."
cd ../terraform
BUCKET_NAME=$(terraform output -raw frontend_bucket_name 2>/dev/null)
DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null)
cd ../frontend

if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Error: Could not get bucket name from Terraform${NC}"
    exit 1
fi

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}Error: Could not get CloudFront distribution ID from Terraform${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Bucket: $BUCKET_NAME${NC}"
echo -e "${GREEN}✓ Distribution: $DISTRIBUTION_ID${NC}"
echo ""

# Sync files to S3
echo "Uploading files to S3..."
aws s3 sync . s3://${BUCKET_NAME}/ \
    --exclude "*.sh" \
    --exclude "*.md" \
    --exclude ".git/*" \
    --exclude ".DS_Store" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html" \
    --exclude "*.html"

# Upload HTML files with different cache settings
aws s3 sync . s3://${BUCKET_NAME}/ \
    --exclude "*" \
    --include "*.html" \
    --cache-control "public, max-age=0, must-revalidate" \
    --content-type "text/html"

echo -e "${GREEN}✓ Files uploaded successfully${NC}"
echo ""

# Invalidate CloudFront cache
echo "Creating CloudFront invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id ${DISTRIBUTION_ID} \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✓ Invalidation created: $INVALIDATION_ID${NC}"
echo ""

# Get CloudFront domain
CLOUDFRONT_DOMAIN=$(cd ../terraform && terraform output -raw cloudfront_domain_name)
FRONTEND_URL=$(cd ../terraform && terraform output -raw frontend_url)

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Your frontend is now available at:"
echo -e "${GREEN}  ${FRONTEND_URL}${NC}"
echo ""
echo "CloudFront domain:"
echo -e "${GREEN}  https://${CLOUDFRONT_DOMAIN}${NC}"
echo ""
echo "Note: It may take a few minutes for the CloudFront cache to clear"
