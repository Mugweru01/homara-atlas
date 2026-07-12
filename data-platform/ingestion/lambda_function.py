import json
import urllib.request
import os
import boto3
from datetime import datetime

# Initialize S3 client
s3 = boto3.client('s3')
BUCKET_NAME = os.environ.get('S3_BUCKET', 'homara-atlas-raw-ingestion-data')

def lambda_handler(event, context):
    """
    AWS Lambda function triggered daily by EventBridge.
    Fetches raw property data and saves it to S3.
    Operates within the 1 million free requests/month tier.
    """
    # 1. Fetch data from external API (Mock URL for now)
    # Replace with real Kenyan real estate or economic API endpoints
    url = "https://jsonplaceholder.typicode.com/posts"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HomaraAtlas/1.0'})
        with urllib.request.urlopen(req) as response:
            data = response.read()
            
            # 2. Generate a partition key for S3
            today = datetime.utcnow()
            s3_key = f"property_listings/year={today.year}/month={today.month:02d}/day={today.day:02d}/raw_data.json"
            
            # 3. Upload raw data to S3
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=data,
                ContentType='application/json'
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps(f'Successfully ingested data to s3://{BUCKET_NAME}/{s3_key}')
            }
            
    except Exception as e:
        print(f"Ingestion failed: {str(e)}")
        raise e
