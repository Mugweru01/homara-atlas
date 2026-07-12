terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., prod, staging)"
  type        = string
  default     = "prod"
}

# -----------------------------------------------------------------------------
# 1. VPC and Networking Setup
# -----------------------------------------------------------------------------
resource "aws_vpc" "homara_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "homara-atlas-vpc-${var.environment}"
  }
}

resource "aws_subnet" "public_subnet_1" {
  vpc_id                  = aws_vpc.homara_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags = { Name = "homara-public-1-${var.environment}" }
}

resource "aws_subnet" "public_subnet_2" {
  vpc_id                  = aws_vpc.homara_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags = { Name = "homara-public-2-${var.environment}" }
}

resource "aws_subnet" "private_subnet_1" {
  vpc_id            = aws_vpc.homara_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "${var.aws_region}a"
  tags = { Name = "homara-private-1-${var.environment}" }
}

resource "aws_subnet" "private_subnet_2" {
  vpc_id            = aws_vpc.homara_vpc.id
  cidr_block        = "10.0.4.0/24"
  availability_zone = "${var.aws_region}b"
  tags = { Name = "homara-private-2-${var.environment}" }
}

# -----------------------------------------------------------------------------
# 2. Security Groups
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb_sg" {
  name        = "homara-alb-sg-${var.environment}"
  description = "Allow inbound HTTPS/HTTP to ALB"
  vpc_id      = aws_vpc.homara_vpc.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app_sg" {
  name        = "homara-app-sg-${var.environment}"
  description = "Security group for EKS/ECS tasks"
  vpc_id      = aws_vpc.homara_vpc.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# -----------------------------------------------------------------------------
# 3. Amazon S3 (Data Lake)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "data_lake" {
  bucket = "homara-atlas-datalake-${var.environment}-${var.aws_region}"
}

resource "aws_s3_bucket_versioning" "data_lake_versioning" {
  bucket = aws_s3_bucket.data_lake.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake_encryption" {
  bucket = aws_s3_bucket.data_lake.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# -----------------------------------------------------------------------------
# 4. Amazon Redshift Serverless (Data Warehouse)
# -----------------------------------------------------------------------------
variable "redshift_admin_password" {
  description = "Admin password for Redshift (Injected via CI/CD secrets)"
  type        = string
  sensitive   = true
}

resource "aws_redshiftserverless_namespace" "warehouse" {
  namespace_name      = "homara-dw-${var.environment}"
  db_name             = "homara_warehouse"
  admin_username      = "homara_admin"
  admin_user_password = var.redshift_admin_password
}

resource "aws_redshiftserverless_workgroup" "warehouse_wg" {
  namespace_name = aws_redshiftserverless_namespace.warehouse.namespace_name
  workgroup_name = "homara-wg-${var.environment}"
  base_capacity  = 32

  subnet_ids = [
    aws_subnet.private_subnet_1.id,
    aws_subnet.private_subnet_2.id
  ]
}

# -----------------------------------------------------------------------------
# 5. Application Load Balancer (ALB)
# -----------------------------------------------------------------------------
resource "aws_lb" "api_alb" {
  name               = "homara-api-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]
}
