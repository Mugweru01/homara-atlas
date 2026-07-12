# Disaster Recovery & Cost Optimization

This document outlines the Disaster Recovery (DR) strategies and Cost Optimization guidelines for the Homara Atlas production environment.

## 1. Disaster Recovery (DR) Strategy

### RPO and RTO Targets
- **Recovery Point Objective (RPO):** 24 hours (maximum acceptable data loss).
- **Recovery Time Objective (RTO):** 4 hours (maximum acceptable downtime).

### Data Backups
- **Database (PostgreSQL / Redshift):** Enable automated daily snapshots. Maintain a retention policy of at least 7-14 days. 
- **Raw Data (S3 / Blob Storage):** Enable Object Versioning to prevent accidental deletions or overwrites. Use lifecycle policies to transition older data to colder, cheaper storage tiers (e.g., AWS S3 Glacier) after 90 days.

### Infrastructure as Code (IaC)
- Ensure all cloud resources are provisioned using IaC tools like Terraform or AWS CloudFormation. This allows rapid re-deployment to an alternate region in the event of a total region failure.
- Store state files securely (e.g., in S3 with versioning and state locking via DynamoDB).

## 2. Cost Optimization Guidelines

### Compute Optimization
- **Right-sizing Instances:** Do not default to large instance types. Start with general-purpose or burstable instances (e.g., AWS `t3.medium` or `t4g.small` for ECS/EC2) and monitor CPU/Memory utilization.
- **Auto-Scaling:** Configure auto-scaling groups to scale in (reduce instances) during off-peak hours to save costs.

### Storage and Data Transfer
- **S3 Lifecycle Policies:** Automatically move unaccessed Parquet files or older raw data backups to lower-cost tiers (Infrequent Access or Glacier).
- **CDN / Edge Caching:** Serve the Vite/Next.js frontend assets via a Content Delivery Network (CDN) like CloudFront. This minimizes latency and reduces egress costs from the application load balancer.

### Data Warehouse Costs
- If using Amazon Redshift, start with `ra3.xlplus` nodes and pause the cluster during periods of inactivity if the analytical workloads are batch-processed rather than continuous real-time queries.
- For local development and CI/CD pipelines, continue using DuckDB to completely bypass cloud warehouse costs.

### Budget Alerts
- Setup Cloud Billing Alerts (e.g., AWS Budgets) to notify the engineering team via email or Slack if monthly spending exceeds $50 or $100 thresholds.
