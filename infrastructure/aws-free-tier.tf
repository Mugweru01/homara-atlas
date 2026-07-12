# Terraform Configuration for Homara Atlas (Strictly AWS Free Tier)

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# 1. EC2 Instance for Docker Compose (API + Web)
# t3.micro is free tier eligible (750 hours/month)
resource "aws_instance" "app_server" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS (us-east-1)
  instance_type = "t3.micro"
  key_name      = "homara-deploy-key"
  
  root_block_device {
    volume_size = 30 # Maximum free tier EBS limit
    volume_type = "gp3"
  }

  tags = {
    Name = "homara-atlas-web-api"
  }
}

# 2. RDS PostgreSQL Database (Data Warehouse)
# db.t4g.micro is free tier eligible for PostgreSQL
resource "aws_db_instance" "data_warehouse" {
  allocated_storage    = 20
  max_allocated_storage = 20 # Prevent auto-scaling costs
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t4g.micro"
  db_name              = "homara_atlas_dw"
  username             = "postgres_admin"
  password             = "change_me_in_production"
  skip_final_snapshot  = true
  publicly_accessible  = false

  tags = {
    Name = "homara-atlas-warehouse"
  }
}

# 3. S3 Bucket for Raw Ingestion Data
# 5GB limit on free tier standard storage
resource "aws_s3_bucket" "raw_data" {
  bucket = "homara-atlas-raw-ingestion-data"
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_data_lifecycle" {
  bucket = aws_s3_bucket.raw_data.id

  rule {
    id     = "delete-old-data"
    status = "Enabled"
    
    filter {}

    # Delete raw files after 30 days to stay under the 5GB limit permanently
    expiration {
      days = 30
    }
  }
}
